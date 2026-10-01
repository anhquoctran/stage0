use std::collections::HashMap;
use super::runner::{run_git_strict, resolve_ref};
use super::{ChangedFile, MrDiffPayload};
use super::conflict::check_conflicts;

const MAX_RAW_DIFF_BYTES: usize = 5 * 1024 * 1024; // 5MB IPC ceiling

pub fn get_mr_diff(
    repo_path: &str,
    base: &str,
    compare: &str,
) -> Result<MrDiffPayload, String> {
    let (base_commit, effective_base) = resolve_ref(repo_path, base)?;
    let (compare_commit, effective_compare) = resolve_ref(repo_path, compare)?;

    let three_dot = format!("{}...{}", effective_base, effective_compare);

    // 1. Get raw diff with IPC safety ceiling
    let raw_diff_str = run_git_strict(repo_path, &["diff", "-U3", "--end-of-options", &three_dot])?;
    let raw_diff = if raw_diff_str.len() > MAX_RAW_DIFF_BYTES {
        let mut truncated = raw_diff_str[..MAX_RAW_DIFF_BYTES].to_string();
        truncated.push_str("\n\n[Diff payload truncated: exceeded 5MB IPC ceiling. File diffs available on demand.]");
        truncated
    } else {
        raw_diff_str
    };

    // 2. Get name-status
    let name_status_output = run_git_strict(repo_path, &["diff", "--name-status", "--end-of-options", &three_dot])?;

    // 3. Get numstat
    let numstat_output = run_git_strict(repo_path, &["diff", "--numstat", "--end-of-options", &three_dot])?;

    // 4. Check conflicts to mark is_conflicted
    let conflict_report = check_conflicts(repo_path, &effective_base, &effective_compare).unwrap_or_else(|_| {
        super::ConflictReport {
            has_conflicts: false,
            conflicted_files: Vec::new(),
            details: Vec::new(),
            base_branch: Some(base.to_string()),
            compare_branch: Some(compare.to_string()),
        }
    });

    let mut numstats: HashMap<String, (u32, u32, bool)> = HashMap::new();
    for line in numstat_output.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 3 {
            let is_binary = parts[0] == "-" && parts[1] == "-";
            let adds = parts[0].parse::<u32>().unwrap_or(0);
            let dels = parts[1].parse::<u32>().unwrap_or(0);
            let file_key = parts[2].trim().to_string();
            numstats.insert(file_key, (adds, dels, is_binary));
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

        let stats = numstats.get(&path).or_else(|| {
            numstats
                .iter()
                .find(|(key, _)| key.ends_with(&path))
                .map(|(_, stats)| stats)
        });
        let (additions, deletions, is_binary) = stats.copied().unwrap_or((0, 0, false));

        let is_conflicted = conflict_report.conflicted_files.iter().any(|cf| cf == &path || old_path.as_deref() == Some(cf));

        files.push(ChangedFile {
            path,
            old_path,
            status,
            additions,
            deletions,
            is_binary,
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
