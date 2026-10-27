use super::ReviewContext;
use serde_json::{json, Value};

pub(crate) struct PreparedDiffBatch {
    pub value: Value,
    progress: Vec<(String, usize, usize, bool)>,
    read_lines: usize,
    bytes: usize,
    limited: bool,
}

impl ReviewContext {
    pub(crate) fn initial_diff_limit(&self) -> usize {
        self.guards
            .get_policy()
            .max_output_bytes
            .min(64 * 1024)
            .min(
                self.max_bytes
                    .saturating_sub(self.bytes)
                    .saturating_sub(32 * 1024),
            )
    }

    /// Prepare data without granting coverage. The caller must authorize the
    /// actual output and commit only the packet delivered to the model.
    pub(crate) fn prepare_diff_batch(
        &mut self,
        file_offset: usize,
        diff_offset: usize,
        max_bytes: usize,
        include_manifest: bool,
    ) -> Result<PreparedDiffBatch, String> {
        let total = self.snapshot.changed_files.len();
        if file_offset > total || (file_offset == total && diff_offset != 0) {
            return Err("Invalid diff batch cursor".into());
        }
        let mut manifest = None;
        if include_manifest {
            let mut paths = Vec::new();
            for path in &self.snapshot.changed_files {
                paths.push(path.clone());
                if serde_json::to_vec(&paths)
                    .map_err(|_| "Could not encode inventory")?
                    .len()
                    > (max_bytes / 4).min(8 * 1024)
                {
                    paths.pop();
                    break;
                }
            }
            let next = if paths.len() < total {
                Some(paths.len())
            } else {
                None
            };
            manifest = Some(json!({"paths":paths,"nextOffset":next,"total":total}));
        }
        let mut files = Vec::new();
        let mut progress = Vec::new();
        let mut cursor = (file_offset, diff_offset);
        let mut read_lines = 0;
        let line_limit = self.guards.get_policy().max_file_read_lines.min(100_000);
        let mut limited = false;
        while cursor.0 < total && read_lines < line_limit {
            let path = self.snapshot.changed_files[cursor.0].clone();
            let diff = match self.snapshot_diff(&path) {
                Ok(diff) => diff,
                Err(error) => {
                    let mut candidate = files.clone();
                    candidate.push(json!({"filePath":path,"error":error,"completeFile":false}));
                    let next = (cursor.0 + 1, 0);
                    if self
                        .diff_batch_value(&candidate, next, &progress, manifest.as_ref())
                        .to_string()
                        .len()
                        > max_bytes
                    {
                        if files.is_empty() {
                            return Err("Diff batch metadata exceeds the output budget".into());
                        }
                        break;
                    }
                    files = candidate;
                    cursor = next;
                    limited = true;
                    continue;
                }
            };
            if cursor.1 > diff.lines.len() {
                return Err("Invalid file diff offset".into());
            }
            let remaining = diff.lines.len() - cursor.1;
            let available = remaining.min(line_limit - read_lines);
            let entry = |count: usize| {
                json!({
                    "filePath":path,
                    "group":path.rsplit_once('/').map_or(".", |(directory, _)| directory),
                    "diffLineOffset":cursor.1,"totalDiffLines":diff.lines.len(),
                    "completeFile":cursor.1 + count == diff.lines.len(),
                    "startCoordinates":diff.coordinates.get(cursor.1).copied().flatten().map(|(base, head)| json!({"base":base,"head":head})),
                    "diff":diff.batch_text(cursor.1, count),
                })
            };
            let fits = |count: usize| {
                let end = cursor.1 + count;
                let next = if end == diff.lines.len() {
                    (cursor.0 + 1, 0)
                } else {
                    (cursor.0, end)
                };
                let mut candidate = files.clone();
                candidate.push(entry(count));
                let mut candidate_progress = progress.clone();
                candidate_progress.push((path.clone(), cursor.1, end, end == diff.lines.len()));
                self.diff_batch_value(&candidate, next, &candidate_progress, manifest.as_ref())
                    .to_string()
                    .len()
                    <= max_bytes
            };
            let mut low = if fits(available) { available } else { 0 };
            let mut high = available;
            while low < high {
                let middle = low + (high - low + 1) / 2;
                if fits(middle) {
                    low = middle;
                } else {
                    high = middle - 1;
                }
            }
            // Keep a file together if it fits a fresh packet; very large files
            // may use the remaining space rather than wasting this request.
            if low < remaining && !files.is_empty() && cursor.1 == 0 {
                let standalone = self.diff_batch_value(
                    &[entry(remaining)],
                    (cursor.0 + 1, 0),
                    &[(path.clone(), 0, diff.lines.len(), true)],
                    manifest.as_ref(),
                );
                if remaining <= line_limit && standalone.to_string().len() <= max_bytes {
                    break;
                }
            }
            if (remaining > 0 && low == 0) || !fits(low) {
                if !files.is_empty() {
                    break;
                }
                return Err("A diff row cannot fit the batch budget; use a targeted file read or report incomplete coverage".into());
            }
            files.push(entry(low));
            let end = cursor.1 + low;
            progress.push((path, cursor.1, end, end == diff.lines.len()));
            read_lines += low;
            limited |= diff.redacted;
            cursor = if end == diff.lines.len() {
                (cursor.0 + 1, 0)
            } else {
                (cursor.0, end)
            };
            if low < remaining {
                break;
            }
        }
        if cursor == (file_offset, diff_offset) && cursor.0 < total {
            return Err("The configured diff batch line/output budget permits no progress".into());
        }
        let value = self.diff_batch_value(&files, cursor, &progress, manifest.as_ref());
        let bytes = value.to_string().len();
        if bytes > max_bytes {
            return Err("Diff batch exceeds the output budget".into());
        }
        Ok(PreparedDiffBatch {
            value,
            progress,
            read_lines,
            bytes,
            limited,
        })
    }

    fn diff_batch_value(
        &self,
        files: &[Value],
        cursor: (usize, usize),
        progress: &[(String, usize, usize, bool)],
        manifest: Option<&Value>,
    ) -> Value {
        let coverage = self.snapshot.changed_files.iter().all(|path| {
            self.complete_diffs.contains(path)
                || progress.iter().any(|(candidate, start, _, complete)| {
                    candidate == path
                        && *complete
                        && *start <= *self.diff_offsets.get(path).unwrap_or(&0)
                })
        });
        let next = (cursor.0 < self.snapshot.changed_files.len())
            .then(|| json!({"fileOffset":cursor.0,"diffOffset":cursor.1}));
        let mut value = json!({
            "source":"immutable_git_diff","authority":"untrusted_repository_data",
            "baseSha":self.snapshot.base_sha,"headSha":self.snapshot.head_sha,"mergeBaseSha":self.snapshot.merge_base_sha,
            "totalFiles":self.snapshot.changed_files.len(),"files":files,"next":next,
            "coverageCompleteAfterDelivery":coverage,
            "excludedFileCount":self.snapshot.excluded_files.len(),
        });
        if let Some(manifest) = manifest {
            value["manifest"] = manifest.clone();
        }
        value
    }

    pub(crate) fn authorize_diff_batch(
        &mut self,
        batch: &PreparedDiffBatch,
        output_cap: usize,
    ) -> Result<(), String> {
        if self
            .guards
            .evaluate_review_output("get_diff_batch", batch.bytes)
            .is_err()
            || batch.bytes > output_cap
            || self.bytes.saturating_add(batch.bytes) > self.max_bytes
        {
            self.limited = true;
            return Err("Review diff batch output/context budget exceeded".into());
        }
        self.guards
            .evaluate_review_read("get_diff_batch", None, batch.read_lines.max(1))
            .map_err(|_| "Diff batch read blocked by Stage0 guardrail policy".to_string())?;
        Ok(())
    }

    pub(crate) fn commit_diff_batch(&mut self, batch: PreparedDiffBatch) {
        self.bytes = self.bytes.saturating_add(batch.bytes);
        self.limited |= batch.limited;
        for (path, start, next, complete) in batch.progress {
            let expected = *self.diff_offsets.get(&path).unwrap_or(&0);
            if start <= expected && next >= expected {
                self.diff_offsets.insert(path.clone(), next);
                if complete {
                    self.complete_diffs.insert(path.clone());
                }
            }
            self.inspected.insert(path);
        }
    }
}

#[cfg(test)]
mod tests;
