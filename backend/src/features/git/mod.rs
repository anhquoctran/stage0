use serde::{Deserialize, Serialize};

pub mod anchor;
pub mod binary;
pub mod blame;
pub mod branches;
pub mod commands;
pub mod conflict;
pub mod diff;
pub mod ops;
pub mod persistence;
pub mod runner;
pub mod watcher;

pub use anchor::{compute_line_hash, extract_line_fingerprint, reanchor_discussions};
pub use binary::{scan_system_git_binaries, test_git_version, GitBinaryInfo};
pub use blame::{BlameAuthorStat, BlameCommit, BlameLine, FileBlamePayload};

use std::path::{Path, PathBuf};

/// Safely resolves a relative path within a repository root.
/// Returns an error if the path attempts to escape the repository root boundary.
pub fn resolve_safe_repo_path(repo_root: &str, relative_path: &str) -> Result<PathBuf, String> {
    let clean_rel = relative_path.replace('\\', "/");
    let rel_path = Path::new(&clean_rel);

    if rel_path.is_absolute() {
        return Err("Absolute file paths are not permitted in repository operations".to_string());
    }

    let repo_path = Path::new(repo_root);
    let canonical_repo = repo_path
        .canonicalize()
        .map_err(|e| format!("Invalid repository root path '{}': {}", repo_root, e))?;

    // Check components depth to prevent parent traversal
    let mut depth: i32 = 0;
    for component in rel_path.components() {
        match component {
            std::path::Component::ParentDir => {
                depth -= 1;
                if depth < 0 {
                    return Err(format!(
                        "Path traversal attempt detected: '{}' escapes repository root",
                        relative_path
                    ));
                }
            }
            std::path::Component::Normal(_) => {
                depth += 1;
            }
            std::path::Component::RootDir | std::path::Component::Prefix(_) => {
                return Err(
                    "Drive prefix or root directory is not permitted in relative path".to_string(),
                );
            }
            _ => {}
        }
    }

    let combined = canonical_repo.join(rel_path);

    // Canonicalize the nearest existing ancestor even when the requested leaf
    // does not exist yet. A plain `exists()` check follows symlinks, so it used
    // to miss `repo/link-to-outside/new-file` and return that escaped path.
    let mut ancestor = combined.as_path();
    let mut missing_components = Vec::new();
    loop {
        match std::fs::symlink_metadata(ancestor) {
            Ok(_) => break,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                let name = ancestor.file_name().ok_or_else(|| {
                    format!(
                        "Unable to resolve repository path '{}': no existing ancestor",
                        relative_path
                    )
                })?;
                missing_components.push(name.to_os_string());
                ancestor = ancestor.parent().ok_or_else(|| {
                    format!(
                        "Unable to resolve repository path '{}': no existing ancestor",
                        relative_path
                    )
                })?;
            }
            Err(error) => {
                return Err(format!(
                    "Unable to inspect repository path '{}': {}",
                    relative_path, error
                ));
            }
        }
    }

    let mut canonical_target = ancestor.canonicalize().map_err(|e| {
        format!(
            "Failed to canonicalize path '{}': {}",
            ancestor.display(),
            e
        )
    })?;
    if !canonical_target.starts_with(&canonical_repo) {
        return Err(format!(
            "Path traversal detected: '{}' resolves outside repository root",
            relative_path
        ));
    }

    for component in missing_components.iter().rev() {
        canonical_target.push(component);
    }
    Ok(canonical_target)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoInfo {
    pub id: String,
    pub name: String,
    pub local_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BranchList {
    pub current: String,
    pub local: Vec<String>,
    pub remote: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChangedFile {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String, // "ADDED" | "MODIFIED" | "DELETED" | "RENAMED"
    pub additions: u32,
    pub deletions: u32,
    pub is_binary: bool,
    pub is_conflicted: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MrDiffPayload {
    pub base_commit: String,
    pub compare_commit: String,
    pub files: Vec<ChangedFile>,
    pub raw_diff: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictedFileInfo {
    pub path: String,
    pub conflict_type: String,
    pub message: String,
    pub conflict_markers_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictReport {
    pub has_conflicts: bool,
    pub conflicted_files: Vec<String>,
    pub details: Vec<ConflictedFileInfo>,
    pub base_branch: Option<String>,
    pub compare_branch: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictRegion {
    pub start_line: usize,
    pub end_line: usize,
    pub base_code: String,
    pub compare_code: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictFilePreview {
    pub file_path: String,
    pub base_branch: String,
    pub compare_branch: String,
    pub conflict_type: String,
    pub has_conflict_markers: bool,
    pub conflict_markers_count: usize,
    pub merged_content: String,
    pub base_content: Option<String>,
    pub compare_content: Option<String>,
    pub conflict_regions: Vec<ConflictRegion>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoChangedEvent {
    pub repo_path: String,
}

#[cfg(test)]
mod tests {
    use super::branches::list_branches;
    use super::conflict::check_conflicts;
    use super::diff::get_mr_diff;
    use super::ops::get_commits_between;
    use super::resolve_safe_repo_path;
    use std::fs;
    use std::process::Command;

    fn run_git(dir: &str, args: &[&str]) {
        let status = Command::new("git")
            .current_dir(dir)
            .args(args)
            .status()
            .expect("Failed to run git command");
        assert!(status.success(), "Git command failed: {:?}", args);
    }

    #[test]
    fn test_git_engine_and_in_memory_conflicts() {
        let temp_dir = std::env::temp_dir().join(format!("local_mr_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();
        let dir_str = temp_dir.to_str().unwrap();

        // 1. Initialize git repo
        run_git(dir_str, &["init", "-b", "main"]);
        run_git(dir_str, &["config", "user.name", "Test User"]);
        run_git(dir_str, &["config", "user.email", "test@test.com"]);

        // 2. Commit initial file
        let file_path = temp_dir.join("sample.txt");
        fs::write(&file_path, "Line 1: Header\nLine 2: Content\n").unwrap();
        run_git(dir_str, &["add", "."]);
        run_git(dir_str, &["commit", "-m", "Initial commit on main"]);

        // Identical refs and different branch names at the same commit are
        // valid comparisons with no files or commits to review.
        run_git(dir_str, &["branch", "same-tip"]);
        let same_branch_diff = get_mr_diff(dir_str, "main", "main").unwrap();
        assert!(same_branch_diff.files.is_empty());
        assert!(same_branch_diff.raw_diff.is_empty());
        assert_eq!(
            same_branch_diff.base_commit,
            same_branch_diff.compare_commit
        );

        let same_tip_diff = get_mr_diff(dir_str, "main", "same-tip").unwrap();
        assert!(same_tip_diff.files.is_empty());
        assert_eq!(same_tip_diff.base_commit, same_tip_diff.compare_commit);
        assert!(get_commits_between(dir_str, "main", "same-tip")
            .unwrap()
            .is_empty());

        let same_tip_conflicts = check_conflicts(dir_str, "main", "same-tip").unwrap();
        assert!(!same_tip_conflicts.has_conflicts);
        assert!(same_tip_conflicts.conflicted_files.is_empty());

        assert!(get_mr_diff(dir_str, "missing-branch", "main").is_err());
        assert!(check_conflicts(dir_str, "missing-branch", "main").is_err());
        assert!(get_commits_between(dir_str, "missing-branch", "main").is_err());
        assert!(get_mr_diff(dir_str, "main...same-tip", "main").is_err());

        // 3. Create feature branch and add non-conflicting change
        run_git(dir_str, &["checkout", "-b", "feature-x"]);
        fs::write(
            &file_path,
            "Line 1: Header\nLine 2: Content\nLine 3: From feature\n",
        )
        .unwrap();
        run_git(dir_str, &["commit", "-am", "Add line 3 on feature-x"]);

        // 4. Test branch enumeration
        let branches = list_branches(dir_str).expect("Failed to list branches");
        assert_eq!(branches.current, "feature-x");
        assert!(branches.local.contains(&"main".to_string()));
        assert!(branches.local.contains(&"feature-x".to_string()));

        // 5. Test 3-dot MR diff calculation
        let diff = get_mr_diff(dir_str, "main", "feature-x").expect("Failed to get diff");
        assert_eq!(diff.files.len(), 1);
        assert_eq!(diff.files[0].path, "sample.txt");
        assert_eq!(diff.files[0].status, "MODIFIED");
        assert_eq!(diff.files[0].additions, 1);
        assert_eq!(diff.files[0].deletions, 0);
        assert!(!diff.files[0].is_binary);
        assert!(!diff.files[0].is_conflicted);
        assert!(diff.raw_diff.contains("+Line 3: From feature"));

        // 6. Test in-memory conflict detection:
        // Checkout main, make conflicting edit on line 3, commit
        run_git(dir_str, &["checkout", "main"]);
        fs::write(
            &file_path,
            "Line 1: Header\nLine 2: Content\nLine 3: From main conflicting\n",
        )
        .unwrap();
        run_git(dir_str, &["commit", "-am", "Conflicting change on main"]);

        // Run check_conflicts
        let report =
            check_conflicts(dir_str, "main", "feature-x").expect("Failed to check conflicts");
        assert!(
            report.has_conflicts,
            "Conflict must be detected between main and feature-x"
        );
        assert!(
            report
                .conflicted_files
                .iter()
                .any(|f| f.contains("sample.txt")),
            "sample.txt must be reported as conflicted"
        );

        // Verify working tree is NOT modified (no merge conflict markers like <<<<<<<)
        let disk_content = fs::read_to_string(&file_path).unwrap();
        assert!(
            !disk_content.contains("<<<<<<<"),
            "Working tree must remain untouched by git merge-tree"
        );
        assert_eq!(
            disk_content,
            "Line 1: Header\nLine 2: Content\nLine 3: From main conflicting\n"
        );

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn detects_binary_files_in_branch_diff() {
        let temp_dir =
            std::env::temp_dir().join(format!("binary_diff_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();
        let dir_str = temp_dir.to_str().unwrap();

        run_git(dir_str, &["init", "-b", "main"]);
        run_git(dir_str, &["config", "user.name", "Test User"]);
        run_git(dir_str, &["config", "user.email", "test@test.com"]);

        let binary_path = temp_dir.join("image.bin");
        fs::write(&binary_path, [0, 1, 2, 3, 0xff]).unwrap();
        run_git(dir_str, &["add", "."]);
        run_git(dir_str, &["commit", "-m", "Add binary file"]);

        run_git(dir_str, &["checkout", "-b", "binary-change"]);
        fs::write(&binary_path, [0, 9, 8, 7, 0xff]).unwrap();
        run_git(dir_str, &["commit", "-am", "Change binary file"]);

        let diff = get_mr_diff(dir_str, "main", "binary-change").unwrap();
        assert_eq!(diff.files.len(), 1);
        assert_eq!(diff.files[0].path, "image.bin");
        assert!(diff.files[0].is_binary);
        assert_eq!(diff.files[0].additions, 0);
        assert_eq!(diff.files[0].deletions, 0);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_resolve_safe_repo_path_prevents_traversal() {
        let temp_dir = std::env::temp_dir().join(format!("path_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();
        let dir_str = temp_dir.to_str().unwrap();

        // Valid relative path inside repo
        let valid = resolve_safe_repo_path(dir_str, "src/main.rs").unwrap();
        assert!(valid.to_string_lossy().contains("src"));

        // Path traversal attempts must be rejected
        assert!(resolve_safe_repo_path(dir_str, "../outside.txt").is_err());
        assert!(resolve_safe_repo_path(dir_str, "src/../../outside.txt").is_err());
        assert!(resolve_safe_repo_path(dir_str, "/etc/passwd").is_err());

        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            let outside =
                temp_dir.with_file_name(format!("path_test_outside_{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&outside).unwrap();
            symlink(&outside, temp_dir.join("outside-link")).unwrap();
            assert!(resolve_safe_repo_path(dir_str, "outside-link/not-created.txt").is_err());
            let _ = fs::remove_dir_all(outside);
        }

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn large_diff_is_capped_without_panicking_on_utf8_boundary() {
        const MAX_DIFF: usize = 5 * 1024 * 1024;
        let temp_dir =
            std::env::temp_dir().join(format!("large_diff_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();
        let dir_str = temp_dir.to_str().unwrap();

        run_git(dir_str, &["init", "-b", "main"]);
        run_git(dir_str, &["config", "user.name", "Test User"]);
        run_git(dir_str, &["config", "user.email", "test@test.com"]);
        let file_path = temp_dir.join("large.txt");
        fs::write(&file_path, "small\n").unwrap();
        run_git(dir_str, &["add", "."]);
        run_git(dir_str, &["commit", "-m", "Initial"]);
        run_git(dir_str, &["checkout", "-b", "large-change"]);
        fs::write(&file_path, format!("{}\n", "界".repeat(2_000_000))).unwrap();
        run_git(dir_str, &["commit", "-am", "Large UTF-8 diff"]);

        let diff = get_mr_diff(dir_str, "main", "large-change").unwrap();
        assert!(diff.raw_diff.len() <= MAX_DIFF);
        assert!(diff.raw_diff.ends_with(
            "[Diff payload truncated at the 5MB IPC ceiling. File diffs are available on demand.]"
        ));

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
