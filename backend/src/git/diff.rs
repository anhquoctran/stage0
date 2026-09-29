use std::collections::HashMap;
use super::runner::run_git_strict;
use super::{ChangedFile, MrDiffPayload};
use super::conflict::check_conflicts;

pub fn get_mr_diff(
    repo_path: &str,
    base: &str,
    compare: &str,
) -> Result<MrDiffPayload, String> {
    let base_commit = run_git_strict(repo_path, &["rev-parse", "--short", base])?
        .trim()
        .to_string();
    let compare_commit = run_git_strict(repo_path, &["rev-parse", "--short", compare])?
        .trim()
        .to_string();

    let three_dot = format!("{}...{}", base, compare);

    // 1. Get raw diff
    let raw_diff = run_git_strict(repo_path, &["diff", "-U3", &three_dot])?;

    // 2. Get name-status
    let name_status_output = run_git_strict(repo_path, &["diff", "--name-status", &three_dot])?;

    // 3. Get numstat
    let numstat_output = run_git_strict(repo_path, &["diff", "--numstat", &three_dot])?;

    // 4. Check conflicts to mark is_conflicted
    let conflict_report = check_conflicts(repo_path, base, compare).unwrap_or_else(|_| {
        super::ConflictReport {
            has_conflicts: false,
            conflicted_files: Vec::new(),
            details: Vec::new(),
            base_branch: Some(base.to_string()),
            compare_branch: Some(compare.to_string()),
        }
    });

    let mut numstats: HashMap<String, (u32, u32)> = HashMap::new();
    for line in numstat_output.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 3 {
            let adds = parts[0].parse::<u32>().unwrap_or(0);
            let dels = parts[1].parse::<u32>().unwrap_or(0);
            let file_key = parts[2].trim().to_string();
            numstats.insert(file_key, (adds, dels));
        }
    }

    let mut files = Vec::new();
    for line in name_status_output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split('\t').collect();
        if parts.is_empty() {
            continue;
        }

        let raw_status = parts[0];
        let status_char = raw_status.chars().next().unwrap_or('M');

        let (status, path, old_path) = match status_char {
            'A' => ("ADDED".to_string(), parts.get(1).unwrap_or(&"").to_string(), None),
            'D' => ("DELETED".to_string(), parts.get(1).unwrap_or(&"").to_string(), None),
            'R' => (
                "RENAMED".to_string(),
                parts.get(2).unwrap_or(&"").to_string(),
                Some(parts.get(1).unwrap_or(&"").to_string()),
            ),
            _ => ("MODIFIED".to_string(), parts.get(1).unwrap_or(&"").to_string(), None),
        };

        if path.is_empty() {
            continue;
        }

        let (additions, deletions) = if let Some(stats) = numstats.get(&path) {
            *stats
        } else {
            let mut found = (0, 0);
            for (k, v) in &numstats {
                if k.ends_with(&path) {
                    found = *v;
                    break;
                }
            }
            found
        };

        let is_conflicted = conflict_report.conflicted_files.iter().any(|cf| cf == &path || old_path.as_deref() == Some(cf));

        files.push(ChangedFile {
            path,
            old_path,
            status,
            additions,
            deletions,
            is_conflicted,
        });
    }

    Ok(MrDiffPayload {
        base_commit,
        compare_commit,
        files,
        raw_diff,
    })
}
