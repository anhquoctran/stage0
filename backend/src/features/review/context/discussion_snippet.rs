use super::{git, ReviewContext};
use crate::features::review::ReviewFinding;
use crate::features::virtual_mr::persistence::DiscussionCodeSnippet;

impl ReviewContext {
    /// Display context comes from the reviewed objects, never the current worktree.
    /// Redact the complete blob before slicing, including multi-line private keys.
    pub(crate) fn discussion_code_snippet(
        &self,
        finding: &ReviewFinding,
    ) -> Result<DiscussionCodeSnippet, String> {
        self.allowed_changed(&finding.file_path)?;
        let content = self.blob(&finding.file_path, &finding.side)?;
        let lines = content.lines().collect::<Vec<_>>();
        if finding.start_line == 0
            || finding.end_line < finding.start_line
            || finding.end_line > lines.len()
            || finding.end_line - finding.start_line >= 200
        {
            return Err("Discussion range is outside the reviewed snapshot".into());
        }
        let side_index = match finding.side.as_str() {
            "base" => 0,
            "head" => 1,
            _ => return Err("Unknown discussion snapshot side".into()),
        };
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
                &finding.file_path,
            ],
            512 * 1024,
        )?;
        let changed_ranges = diff
            .lines()
            .filter(|line| line.starts_with("@@ "))
            .filter_map(|line| {
                let range = line
                    .split("@@")
                    .nth(1)?
                    .split_whitespace()
                    .nth(side_index)?;
                let mut parts = range.trim_start_matches(['-', '+']).splitn(2, ',');
                let start = parts.next()?.parse::<usize>().ok()?;
                let count = parts.next().unwrap_or("1").parse::<usize>().ok()?;
                Some(start..start.saturating_add(count))
            })
            .collect::<Vec<_>>();
        if !changed_ranges
            .iter()
            .any(|range| range.contains(&finding.start_line))
        {
            return Err("Discussion anchor is not a changed line".into());
        }
        let start = finding.start_line.saturating_sub(3).max(1);
        let end = finding
            .end_line
            .saturating_add(3)
            .min(start + 14)
            .min(lines.len());
        let snippet_lines = (start..=end)
            .map(|number| {
                let prefix = if changed_ranges.iter().any(|range| range.contains(&number)) {
                    if side_index == 0 {
                        '-'
                    } else {
                        '+'
                    }
                } else {
                    ' '
                };
                format!("{prefix}{}", lines[number - 1])
            })
            .collect::<Vec<_>>();
        if snippet_lines.iter().any(|line| line.len() > 8192)
            || snippet_lines.iter().map(String::len).sum::<usize>() > 32768
        {
            return Err("Discussion excerpt exceeds the display limit".into());
        }
        Ok(DiscussionCodeSnippet {
            start_line: start as i64,
            selected_line: Some(finding.start_line as i64),
            selected_end_line: Some(finding.end_line as i64),
            format: Some("diff".into()),
            lines: snippet_lines,
        })
    }
}
