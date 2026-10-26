use super::{git, ReviewContext};
use crate::features::review::{security, ReviewFinding};

impl ReviewContext {
    pub fn validate_resolution_change(&self, path: &str, original_sha: &str) -> Result<(), String> {
        security::safe_path(path, &self.guards)?;
        if ![40, 64].contains(&original_sha.len())
            || !original_sha.bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err("The original finding snapshot is unavailable".into());
        }
        let previous = self.raw_blob_at(path, original_sha)?;
        let current = self.raw_blob_at(path, &self.snapshot.head_sha)?;
        if current.is_none() || current == previous {
            return Err("The file has not changed since the original finding. Explain the concern or leave it open for manual resolution.".into());
        }
        Ok(())
    }

    pub(super) fn allowed_changed(&self, path: &str) -> Result<(), String> {
        security::safe_path(path, &self.guards)?;
        if !self.snapshot.changed_files.iter().any(|p| p == path) {
            return Err("Finding/diff must target an eligible changed path".into());
        }
        Ok(())
    }

    fn is_changed_line(&self, path: &str, side: &str, line: usize) -> Result<bool, String> {
        let diff = git(
            &self.snapshot.repo_path,
            &[
                "diff",
                "--no-ext-diff",
                "--no-textconv",
                "--no-renames",
                "--no-color",
                "--unified=0",
                &self.snapshot.merge_base_sha,
                &self.snapshot.head_sha,
                "--",
                path,
            ],
            512 * 1024,
        )?;
        let token_index = match side {
            "base" => 0,
            "head" => 1,
            _ => return Err("side must be base or head".into()),
        };
        for line_text in diff.lines() {
            if !line_text.starts_with("@@ ") {
                continue;
            }
            let Some(header) = line_text.split("@@").nth(1) else {
                continue;
            };
            let Some(range) = header.split_whitespace().nth(token_index) else {
                continue;
            };
            let range = range.trim_start_matches(['-', '+']);
            let mut parts = range.splitn(2, ',');
            let Ok(start) = parts.next().unwrap_or_default().parse::<usize>() else {
                continue;
            };
            let count = parts
                .next()
                .map(|count| count.parse::<usize>())
                .transpose()
                .ok()
                .flatten()
                .unwrap_or(1);
            if count > 0 && line >= start && line < start.saturating_add(count) {
                return Ok(true);
            }
        }
        Ok(false)
    }

    pub fn validate_findings(&self, findings: &[ReviewFinding]) -> Result<(), String> {
        for finding in findings {
            self.allowed_changed(&finding.file_path)?;
            if finding.start_line == 0
                || finding.end_line < finding.start_line
                || finding.end_line - finding.start_line >= 200
            {
                return Err("Invalid finding line range".into());
            }
            let content = self.blob(&finding.file_path, &finding.side)?;
            let lines = content.lines().collect::<Vec<_>>();
            if finding.end_line > lines.len() {
                return Err("Finding range is outside the snapshot".into());
            }
            let quoted = lines[finding.start_line - 1..finding.end_line].join("\n");
            if finding.evidence.trim().is_empty()
                || finding.evidence.contains("[REDACTED")
                || !quoted.contains(&finding.evidence)
            {
                return Err(
                    "Finding must quote exact non-redacted source evidence in its stated range"
                        .into(),
                );
            }
            if !self.is_changed_line(&finding.file_path, &finding.side, finding.start_line)? {
                return Err("Inline discussions must anchor to an actual changed line in the selected diff side".into());
            }
        }
        Ok(())
    }

    pub fn validate_reverted_finding(
        &self,
        finding: &ReviewFinding,
        original_commit_id: &str,
        original_side: &str,
    ) -> Result<(), String> {
        if original_side != "right" || finding.side != "head" {
            return Err(
                "Only a previously reviewed right-side change can be verified as reverted".into(),
            );
        }
        if ![40, 64].contains(&original_commit_id.len())
            || !original_commit_id
                .bytes()
                .all(|byte| byte.is_ascii_hexdigit())
        {
            return Err("The original review commit is unavailable".into());
        }
        let resolved = git(
            &self.snapshot.repo_path,
            &[
                "rev-parse",
                "--verify",
                "--end-of-options",
                &format!("{original_commit_id}^{{commit}}"),
            ],
            256,
        )?;
        if resolved.trim() != original_commit_id {
            return Err("The original review commit could not be verified".into());
        }

        let base = self.raw_blob_at(&finding.file_path, &self.snapshot.merge_base_sha)?;
        let head = self.raw_blob_at(&finding.file_path, &self.snapshot.head_sha)?;
        let original = self.raw_blob_at(&finding.file_path, original_commit_id)?;
        if head != base || original.is_none() || original == base {
            return Err(
                "The file is not an exact revert of the previously reviewed branch change".into(),
            );
        }

        let current = self.blob(&finding.file_path, "head")?;
        let lines = current.lines().collect::<Vec<_>>();
        if finding.start_line == 0
            || finding.end_line < finding.start_line
            || finding.end_line > lines.len()
            || finding.end_line - finding.start_line >= 200
        {
            return Err("Invalid current-head evidence range for revert verification".into());
        }
        let quoted = lines[finding.start_line - 1..finding.end_line].join("\n");
        if finding.evidence.trim().is_empty()
            || finding.evidence.contains("[REDACTED")
            || !quoted.contains(&finding.evidence)
        {
            return Err(
                "Revert verification must quote exact non-redacted source from the current head"
                    .into(),
            );
        }
        Ok(())
    }
}
