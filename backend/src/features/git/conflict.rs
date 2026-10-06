use super::runner::run_git;
use super::{ConflictFilePreview, ConflictRegion, ConflictReport, ConflictedFileInfo};
use std::io::Read;

const MAX_CONFLICT_FILE_BYTES: u64 = 8 * 1024 * 1024;
const MAX_TOTAL_CONFLICT_SCAN_BYTES: usize = 64 * 1024 * 1024;

pub fn check_conflicts(
    repo_path: &str,
    base: &str,
    compare: &str,
) -> Result<ConflictReport, String> {
    let (_, effective_base) = super::runner::resolve_ref(repo_path, base)?;
    let (_, effective_compare) = super::runner::resolve_ref(repo_path, compare)?;

    let res = run_git(
        repo_path,
        &[
            "merge-tree",
            "--write-tree",
            "--name-only",
            "-z",
            "--messages",
            &effective_base,
            &effective_compare,
        ],
    )?;
    if res.output_truncated {
        return Err("Git merge-tree output exceeded the configured safety limit".to_string());
    }

    // `merge-tree --write-tree` uses status 1 to mean a merge conflict. Other
    // non-zero statuses are invocation/repository errors, not conflicts.
    if res.code != Some(0) && res.code != Some(1) {
        let detail = if res.stderr.trim().is_empty() {
            res.stdout.trim()
        } else {
            res.stderr.trim()
        };
        return Err(format!(
            "Git merge-tree failed: {}",
            super::runner::redact_sensitive_text(detail)
        ));
    }

    let combined = res.stdout;
    let mut conflicted_files = Vec::new();
    let mut details: Vec<ConflictedFileInfo> = Vec::new();

    let has_conflicts = res.code == Some(1);
    let mut sections = combined.split('\0');
    // First field is the result tree object id. The conflicted-file section is
    // NUL-delimited and ends at the empty field that starts informational
    // messages; never parse filenames from Git's human-readable diagnostics.
    let _tree_oid = sections.next();
    let mut message_fields = Vec::new();
    let mut in_messages = false;
    for field in sections {
        if in_messages {
            message_fields.push(field);
        } else if field.is_empty() {
            in_messages = true;
        } else {
            conflicted_files.push(field.to_string());
        }
    }

    let mut typed_messages = std::collections::HashMap::<String, (String, String)>::new();
    let mut index = 0;
    while index < message_fields.len() {
        let Some(path_count) = message_fields[index].parse::<usize>().ok() else {
            break;
        };
        index += 1;
        if index + path_count + 1 >= message_fields.len() {
            break;
        }
        let paths = &message_fields[index..index + path_count];
        index += path_count;
        let message_type = message_fields[index].to_string();
        let message = message_fields[index + 1].to_string();
        index += 2;
        if message_type.starts_with("CONFLICT") {
            for path in paths {
                typed_messages.insert(path.to_string(), (message_type.clone(), message.clone()));
            }
        }
    }

    let mut scanned_conflict_bytes = 0usize;
    for path in &conflicted_files {
        let conflict_markers_count = if scanned_conflict_bytes < MAX_TOTAL_CONFLICT_SCAN_BYTES {
            super::resolve_safe_repo_path(repo_path, path)
                .map(|path| {
                    let remaining = MAX_TOTAL_CONFLICT_SCAN_BYTES - scanned_conflict_bytes;
                    let (count, bytes_read) = count_on_disk_conflict_markers(&path, remaining);
                    scanned_conflict_bytes += bytes_read;
                    count
                })
                .unwrap_or(0)
        } else {
            0
        };
        let (conflict_type, message) = typed_messages
            .get(path)
            .cloned()
            .unwrap_or_else(|| ("merge".to_string(), format!("Merge conflict in {}", path)));
        details.push(ConflictedFileInfo {
            path: path.clone(),
            conflict_type,
            message,
            conflict_markers_count,
        });
    }

    Ok(ConflictReport {
        has_conflicts,
        conflicted_files,
        details,
        base_branch: Some(base.to_string()),
        compare_branch: Some(compare.to_string()),
    })
}

pub fn get_conflicted_file_preview(
    repo_path: &str,
    base: &str,
    compare: &str,
    file_path: &str,
) -> Result<ConflictFilePreview, String> {
    let (_, effective_base) = super::runner::resolve_ref(repo_path, base)?;
    let (_, effective_compare) = super::runner::resolve_ref(repo_path, compare)?;

    let clean_path = file_path.replace('\\', "/");
    let on_disk_path = match super::resolve_safe_repo_path(repo_path, &clean_path) {
        Ok(safe_p) => safe_p,
        Err(e) => return Err(format!("Invalid file path for conflict preview: {}", e)),
    };
    let mut on_disk_markers_count = 0;
    let mut on_disk_content: Option<String> = None;

    if let Ok(metadata) = std::fs::symlink_metadata(&on_disk_path) {
        if metadata.file_type().is_file() && metadata.len() > MAX_CONFLICT_FILE_BYTES {
            return Err("Conflict preview is limited to files up to 8 MiB".to_string());
        }
        if metadata.file_type().is_file() {
            let file = std::fs::File::open(&on_disk_path)
                .map_err(|error| format!("Failed to open conflict preview file: {}", error))?;
            let mut bytes = Vec::with_capacity(metadata.len() as usize);
            file.take(MAX_CONFLICT_FILE_BYTES + 1)
                .read_to_end(&mut bytes)
                .map_err(|error| format!("Failed to read conflict preview file: {}", error))?;
            if bytes.len() as u64 > MAX_CONFLICT_FILE_BYTES {
                return Err("Conflict preview is limited to files up to 8 MiB".to_string());
            }
            if let Ok(content) = String::from_utf8(bytes) {
                on_disk_markers_count = content
                    .lines()
                    .filter(|line| line.starts_with("<<<<<<<"))
                    .count();
                if on_disk_markers_count > 0 {
                    on_disk_content = Some(content);
                }
            }
        }
    }

    // 1. Get base content and compare content via git show
    let base_spec = format!("{}:{}", effective_base, clean_path);
    let compare_spec = format!("{}:{}", effective_compare, clean_path);

    let base_content = run_git(repo_path, &["show", &base_spec])
        .ok()
        .map(|r| r.stdout);
    let compare_content = run_git(repo_path, &["show", &compare_spec])
        .ok()
        .map(|r| r.stdout);
    if base_content
        .as_deref()
        .is_some_and(|content| content.contains('\0'))
        || compare_content
            .as_deref()
            .is_some_and(|content| content.contains('\0'))
    {
        return Err("Binary conflict previews are not supported".to_string());
    }

    // 2. Find common ancestor
    let merge_base = run_git(
        repo_path,
        &["merge-base", &effective_base, &effective_compare],
    )
    .map(|r| r.stdout.trim().to_string())
    .unwrap_or_default();

    let mut merged_content = String::new();
    let mut conflict_markers_count = on_disk_markers_count;

    if let Some(c) = on_disk_content {
        merged_content = c;
    } else {
        // Attempt 3-way in-memory merge using git merge-file
        let base_oid = run_git(repo_path, &["rev-parse", "--verify", &base_spec])
            .map(|r| r.stdout.trim().to_string());
        let compare_oid = run_git(repo_path, &["rev-parse", "--verify", &compare_spec])
            .map(|r| r.stdout.trim().to_string());

        let ancestor_spec = if !merge_base.is_empty() {
            format!("{}:{}", merge_base, clean_path)
        } else {
            "".to_string()
        };

        let ancestor_oid = if !ancestor_spec.is_empty() {
            run_git(repo_path, &["rev-parse", "--verify", &ancestor_spec])
                .map(|r| r.stdout.trim().to_string())
                .unwrap_or_else(|_| "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391".to_string())
        } else {
            "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391".to_string()
        };

        if let (Ok(b_oid), Ok(c_oid)) = (base_oid, compare_oid) {
            let res = run_git(
                repo_path,
                &[
                    "merge-file",
                    "-p",
                    "--object-id",
                    "-L",
                    base,
                    "-L",
                    "ancestor",
                    "-L",
                    compare,
                    &b_oid,
                    &ancestor_oid,
                    &c_oid,
                ],
            );
            if let Ok(m_res) = res {
                merged_content = m_res.stdout;
                conflict_markers_count = merged_content
                    .lines()
                    .filter(|l| l.starts_with("<<<<<<<"))
                    .count();
            }
        }
    }

    // Fallback if merged_content is still empty
    if merged_content.is_empty() {
        if let Some(ref c) = compare_content {
            merged_content = c.clone();
        } else if let Some(ref b) = base_content {
            merged_content = b.clone();
        }
    }

    // 3. Parse conflict regions from merged_content
    let mut conflict_regions = Vec::new();
    let lines: Vec<&str> = merged_content.lines().collect();
    let mut in_conflict = false;
    let mut in_compare = false;
    let mut start_line = 0;
    let mut base_lines: Vec<&str> = Vec::new();
    let mut compare_lines: Vec<&str> = Vec::new();

    for (idx, line) in lines.iter().enumerate() {
        let line_num = idx + 1;
        if line.starts_with("<<<<<<<") {
            in_conflict = true;
            in_compare = false;
            start_line = line_num;
            base_lines.clear();
            compare_lines.clear();
        } else if in_conflict && line.starts_with("=======") {
            in_compare = true;
        } else if in_conflict && line.starts_with(">>>>>>>") {
            in_conflict = false;
            conflict_regions.push(ConflictRegion {
                start_line,
                end_line: line_num,
                base_code: base_lines.join("\n"),
                compare_code: compare_lines.join("\n"),
            });
            base_lines.clear();
            compare_lines.clear();
        } else if in_conflict {
            if in_compare {
                compare_lines.push(line);
            } else {
                base_lines.push(line);
            }
        }
    }

    let conflict_type = if conflict_markers_count > 0 {
        "content".to_string()
    } else if base_content.is_none() && compare_content.is_some() {
        "deleted in base".to_string()
    } else if base_content.is_some() && compare_content.is_none() {
        "deleted in compare".to_string()
    } else {
        "content".to_string()
    };

    Ok(ConflictFilePreview {
        file_path: clean_path,
        base_branch: base.to_string(),
        compare_branch: compare.to_string(),
        conflict_type,
        has_conflict_markers: conflict_markers_count > 0,
        conflict_markers_count,
        merged_content,
        base_content,
        compare_content,
        conflict_regions,
    })
}

fn count_on_disk_conflict_markers(path: &std::path::Path, byte_budget: usize) -> (usize, usize) {
    let Ok(metadata) = std::fs::symlink_metadata(path) else {
        return (0, 0);
    };
    if !metadata.file_type().is_file() || metadata.len() > MAX_CONFLICT_FILE_BYTES {
        return (0, 0);
    }
    let Ok(file) = std::fs::File::open(path) else {
        return (0, 0);
    };
    let to_read = (metadata.len() as usize).min(byte_budget);
    let mut bytes = Vec::with_capacity(to_read);
    let Ok(bytes_read) = file.take(to_read as u64).read_to_end(&mut bytes) else {
        return (0, 0);
    };
    let count = bytes
        .split(|byte| *byte == b'\n')
        .filter(|line| line.starts_with(b"<<<<<<<"))
        .count();
    (count, bytes_read)
}
