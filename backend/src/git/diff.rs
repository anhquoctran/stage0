use std::collections::HashMap;
use std::collections::HashSet;
use std::time::Duration;

use super::conflict::check_conflicts;
use super::runner::{resolve_ref, run_git_strict, run_git_with_limits};
use super::{ChangedFile, MrDiffPayload};

const MAX_RAW_DIFF_BYTES: usize = 5 * 1024 * 1024; // 5MB IPC ceiling
const DIFF_TRUNCATION_NOTICE: &str =
    "\n\n[Diff payload truncated at the 5MB IPC ceiling. File diffs are available on demand.]";

pub fn get_mr_diff(repo_path: &str, base: &str, compare: &str) -> Result<MrDiffPayload, String> {
    let (base_commit, effective_base) = resolve_ref(repo_path, base)?;
    let (compare_commit, effective_compare) = resolve_ref(repo_path, compare)?;

    let three_dot = format!("{}...{}", effective_base, effective_compare);

    // 1. Cap the child process output itself. Do not capture a huge diff and
    // truncate it only after it has already consumed unbounded memory.
    let diff_result = run_git_with_limits(
        repo_path,
        &[
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "-U3",
            "--end-of-options",
            &three_dot,
        ],
        MAX_RAW_DIFF_BYTES,
        1024 * 1024,
        Duration::from_secs(120),
    )?;
    if !diff_result.success && !diff_result.output_truncated {
        let detail = if diff_result.stderr.trim().is_empty() {
            diff_result.stdout.trim()
        } else {
            diff_result.stderr.trim()
        };
        return Err(format!(
            "Git diff failed: {}",
            super::runner::redact_sensitive_text(detail)
        ));
    }
    let mut raw_diff = diff_result.stdout;
    if diff_result.output_truncated {
        let available_bytes = MAX_RAW_DIFF_BYTES.saturating_sub(DIFF_TRUNCATION_NOTICE.len());
        while raw_diff.len() > available_bytes {
            raw_diff.pop();
        }
        raw_diff.push_str(DIFF_TRUNCATION_NOTICE);
    }

    // 2. Get name-status
    let name_status_output = run_git_strict(
        repo_path,
        &[
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--name-status",
            "-z",
            "--end-of-options",
            &three_dot,
        ],
    )?;

    // 3. Get numstat
    let numstat_output = run_git_strict(
        repo_path,
        &[
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--numstat",
            "-z",
            "--end-of-options",
            &three_dot,
        ],
    )?;

    // 4. Check conflicts to mark is_conflicted
    let conflict_report = check_conflicts(repo_path, &effective_base, &effective_compare)?;
    let conflict_files: HashSet<&str> = conflict_report
        .conflicted_files
        .iter()
        .map(String::as_str)
        .collect();

    let numstats = parse_numstat_z(&numstat_output);
    let changed = parse_name_status_z(&name_status_output);

    let mut files = Vec::with_capacity(changed.len());
    for (status, path, old_path) in changed {
        let stats = numstats.get(&path);
        let (additions, deletions, is_binary) = stats.copied().unwrap_or((0, 0, false));

        let is_conflicted = conflict_files.contains(path.as_str())
            || old_path
                .as_deref()
                .map(|old_path| conflict_files.contains(old_path))
                .unwrap_or(false);

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

fn parse_name_status_z(output: &str) -> Vec<(String, String, Option<String>)> {
    let fields: Vec<&str> = output.split('\0').collect();
    let mut parsed = Vec::new();
    let mut index = 0;
    while index + 1 < fields.len() {
        let status = fields[index];
        index += 1;
        let Some(status_char) = status.chars().next() else {
            continue;
        };
        let Some(first_path) = fields.get(index).filter(|path| !path.is_empty()) else {
            break;
        };
        let first_path = (*first_path).to_string();
        index += 1;
        let (status_name, path, old_path) = if matches!(status_char, 'R' | 'C') {
            let Some(new_path) = fields.get(index).filter(|path| !path.is_empty()) else {
                break;
            };
            index += 1;
            (
                "RENAMED".to_string(),
                (*new_path).to_string(),
                Some(first_path),
            )
        } else {
            let status_name = match status_char {
                'A' => "ADDED",
                'D' => "DELETED",
                _ => "MODIFIED",
            };
            (status_name.to_string(), first_path, None)
        };
        parsed.push((status_name, path, old_path));
    }
    parsed
}

fn parse_numstat_z(output: &str) -> HashMap<String, (u32, u32, bool)> {
    let fields: Vec<&str> = output.split('\0').collect();
    let mut parsed = HashMap::new();
    let mut index = 0;
    while index < fields.len() {
        let Some(record) = fields.get(index) else {
            break;
        };
        index += 1;
        let mut columns = record.splitn(3, '\t');
        let (Some(adds), Some(dels), Some(path_or_empty)) =
            (columns.next(), columns.next(), columns.next())
        else {
            continue;
        };
        let is_binary = adds == "-" && dels == "-";
        let additions = adds.parse::<u32>().unwrap_or(0);
        let deletions = dels.parse::<u32>().unwrap_or(0);
        let path = if path_or_empty.is_empty() {
            // For renames with -z, Git emits an empty path in the numstat
            // record followed by the old and new paths as separate fields.
            let Some(_old_path) = fields.get(index) else {
                break;
            };
            let Some(new_path) = fields.get(index + 1) else {
                break;
            };
            index += 2;
            (*new_path).to_string()
        } else {
            path_or_empty.to_string()
        };
        parsed.insert(path, (additions, deletions, is_binary));
    }
    parsed
}

#[cfg(test)]
mod tests {
    use super::{parse_name_status_z, parse_numstat_z};

    #[test]
    fn parses_tabs_and_newlines_in_git_paths() {
        let unusual = "name\twith\nnewline.txt";
        let statuses = format!("M\0{unusual}\0A\0new\tfile\n.txt\0");
        let parsed = parse_name_status_z(&statuses);
        assert_eq!(parsed[0].1, unusual);
        assert_eq!(parsed[1].1, "new\tfile\n.txt");

        let stats = format!("2\t1\t{unusual}\0-\t-\tnew\tfile\n.txt\0");
        let parsed_stats = parse_numstat_z(&stats);
        assert_eq!(parsed_stats.get(unusual), Some(&(2, 1, false)));
        assert_eq!(parsed_stats.get("new\tfile\n.txt"), Some(&(0, 0, true)));
    }

    #[test]
    fn parses_rename_records_without_assuming_path_characters() {
        let old_path = "old\tname.txt";
        let new_path = "new\nname.txt";
        let statuses = format!("R100\0{old_path}\0{new_path}\0");
        let parsed = parse_name_status_z(&statuses);
        assert_eq!(
            parsed,
            vec![("RENAMED".into(), new_path.into(), Some(old_path.into()))]
        );

        let stats = format!("3\t1\t\0{old_path}\0{new_path}\0");
        assert_eq!(parse_numstat_z(&stats).get(new_path), Some(&(3, 1, false)));
    }
}
