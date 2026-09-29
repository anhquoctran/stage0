use std::path::Path;
use super::runner::run_git;
use super::{ConflictReport, ConflictedFileInfo};

pub fn check_conflicts(
    repo_path: &str,
    base: &str,
    compare: &str,
) -> Result<ConflictReport, String> {
    let res = run_git(repo_path, &["merge-tree", "--write-tree", base, compare])?;

    let combined = format!("{}\n{}", res.stdout, res.stderr);
    let mut conflicted_files = Vec::new();
    let mut details: Vec<ConflictedFileInfo> = Vec::new();

    let mut has_conflicts = !res.success || combined.contains("CONFLICT");

    for line in combined.lines() {
        let line = line.trim();
        if line.starts_with("CONFLICT") {
            has_conflicts = true;
            let mut conflict_type = "content".to_string();
            if let Some(open_paren) = line.find('(') {
                if let Some(close_paren) = line.find(')') {
                    if open_paren < close_paren {
                        conflict_type = line[open_paren + 1..close_paren].to_string();
                    }
                }
            }

            let mut matched_path: Option<String> = None;
            if let Some(idx) = line.find("Merge conflict in ") {
                let path = line[idx + "Merge conflict in ".len()..].trim();
                let clean_path = path.trim_matches(|c| c == '\'' || c == '"');
                if !clean_path.is_empty() {
                    matched_path = Some(clean_path.to_string());
                }
            } else if let Some(idx) = line.find("): ") {
                let rest = &line[idx + 3..];
                let words: Vec<&str> = rest.split_whitespace().collect();
                if let Some(first) = words.first() {
                    let clean_path = first.trim_matches(|c| c == '\'' || c == '"');
                    if !clean_path.is_empty() {
                        matched_path = Some(clean_path.to_string());
                    }
                }
            }

            if let Some(path) = matched_path {
                let on_disk_path = Path::new(repo_path).join(&path);
                let mut conflict_markers_count = 0;
                if on_disk_path.exists() {
                    if let Ok(content) = std::fs::read_to_string(&on_disk_path) {
                        conflict_markers_count = content.lines().filter(|l| l.starts_with("<<<<<<<")).count();
                    }
                }

                if !conflicted_files.contains(&path) {
                    conflicted_files.push(path.clone());
                }

                details.push(ConflictedFileInfo {
                    path,
                    conflict_type,
                    message: line.to_string(),
                    conflict_markers_count,
                });
            }
        }
    }

    Ok(ConflictReport {
        has_conflicts,
        conflicted_files,
        details,
        base_branch: Some(base.to_string()),
        compare_branch: Some(compare.to_string()),
    })
}
