use std::path::Path;
use super::runner::run_git;
use super::{ConflictFilePreview, ConflictRegion, ConflictReport, ConflictedFileInfo};

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

pub fn get_conflicted_file_preview(
    repo_path: &str,
    base: &str,
    compare: &str,
    file_path: &str,
) -> Result<ConflictFilePreview, String> {
    let clean_path = file_path.replace('\\', "/");
    let on_disk_path = Path::new(repo_path).join(&clean_path);
    let mut on_disk_markers_count = 0;
    let mut on_disk_content: Option<String> = None;

    if on_disk_path.exists() {
        if let Ok(c) = std::fs::read_to_string(&on_disk_path) {
            on_disk_markers_count = c.lines().filter(|l| l.starts_with("<<<<<<<")).count();
            if on_disk_markers_count > 0 {
                on_disk_content = Some(c);
            }
        }
    }

    // 1. Get base content and compare content via git show
    let base_spec = format!("{}:{}", base, clean_path);
    let compare_spec = format!("{}:{}", compare, clean_path);

    let base_content = run_git(repo_path, &["show", &base_spec]).ok().map(|r| r.stdout);
    let compare_content = run_git(repo_path, &["show", &compare_spec]).ok().map(|r| r.stdout);

    // 2. Find common ancestor
    let merge_base = run_git(repo_path, &["merge-base", base, compare])
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
