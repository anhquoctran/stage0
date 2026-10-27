use super::{git, ReviewContext};
use crate::features::review::security;
use std::{collections::BTreeSet, sync::Arc};

pub(super) struct SnapshotDiff {
    pub lines: Vec<String>,
    pub redacted: bool,
    prefixes: Vec<char>,
    pub coordinates: Vec<Option<(usize, usize)>>,
}

impl SnapshotDiff {
    pub fn batch_text(&self, offset: usize, count: usize) -> String {
        self.lines
            .iter()
            .enumerate()
            .skip(offset)
            .take(count)
            .map(|(index, line)| {
                if line.starts_with("[REDACTED") && matches!(self.prefixes[index], '+' | '-' | ' ')
                {
                    format!("{}{line}", self.prefixes[index])
                } else {
                    line.clone()
                }
            })
            .collect::<Vec<_>>()
            .join("\n")
    }
}

impl ReviewContext {
    pub(super) fn snapshot_diff(&mut self, path: &str) -> Result<Arc<SnapshotDiff>, String> {
        self.allowed_changed(path)?;
        if let Some(diff) = self.diff_cache.get(path) {
            return Ok(Arc::clone(diff));
        }
        let raw = git(
            &self.snapshot.repo_path,
            &[
                "diff",
                "--no-ext-diff",
                "--no-textconv",
                "--no-renames",
                "--no-color",
                "--word-diff=none",
                "--output-indicator-new=+",
                "--output-indicator-old=-",
                "--output-indicator-context= ",
                "--submodule=short",
                "-U3",
                &self.snapshot.merge_base_sha,
                &self.snapshot.head_sha,
                "--",
                path,
            ],
            512 * 1024,
        )?;
        let mut sensitive_lines = BTreeSet::new();
        for side in ["base", "head"] {
            if let Some(content) = self.raw_blob(path, side)? {
                let sanitized = security::redact(&content);
                for (original, filtered) in content.lines().zip(sanitized.lines()) {
                    if original != filtered {
                        sensitive_lines.insert(original.to_string());
                    }
                }
            }
        }
        let protected = raw
            .lines()
            .map(|line| {
                if let Some(rest) = line.strip_prefix("@@ ") {
                    if let Some(end) = rest.find(" @@") {
                        return &line[..3 + end + 3];
                    }
                }
                let source = line.strip_prefix(['+', '-', ' ']).unwrap_or(line);
                if sensitive_lines.contains(source) {
                    "[REDACTED BY SOURCE EGRESS POLICY]"
                } else {
                    line
                }
            })
            .collect::<Vec<_>>()
            .join("\n");
        let filtered = security::redact(&protected);
        let mut old = 0;
        let mut new = 0;
        let mut in_hunk = false;
        let mut coordinates = Vec::new();
        let mut prefixes = Vec::new();
        for line in raw.lines() {
            let prefix = line.chars().next().unwrap_or(' ');
            prefixes.push(prefix);
            if line.starts_with("@@ ") {
                let ranges = line
                    .split_whitespace()
                    .skip(1)
                    .take(2)
                    .map(|range| {
                        range
                            .trim_start_matches(['-', '+'])
                            .split(',')
                            .next()
                            .unwrap_or("0")
                            .parse::<usize>()
                            .unwrap_or(0)
                    })
                    .collect::<Vec<_>>();
                old = ranges[0];
                new = ranges[1];
                in_hunk = true;
                coordinates.push(None);
            } else if in_hunk && matches!(prefix, '+' | '-' | ' ') {
                coordinates.push(Some((old, new)));
                if prefix != '+' {
                    old += 1;
                }
                if prefix != '-' {
                    new += 1;
                }
            } else {
                coordinates.push(None);
            }
        }
        let diff = Arc::new(SnapshotDiff {
            redacted: filtered != raw.trim_end_matches('\n'),
            lines: filtered.lines().map(str::to_string).collect(),
            prefixes,
            coordinates,
        });
        let cache_bytes = diff
            .lines
            .iter()
            .map(|line| line.len().saturating_add(64))
            .sum::<usize>();
        if self.diff_cache_bytes.saturating_add(cache_bytes) <= 2 * 1024 * 1024 {
            self.diff_cache_bytes += cache_bytes;
            self.diff_cache.insert(path.to_owned(), Arc::clone(&diff));
        }
        Ok(diff)
    }
}
