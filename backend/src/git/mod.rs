use serde::{Deserialize, Serialize};

pub mod runner;
pub mod branches;
pub mod diff;
pub mod conflict;
pub mod ops;
pub mod blame;

pub use blame::{BlameAuthorStat, BlameCommit, BlameLine, FileBlamePayload};

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
pub struct RepoChangedEvent {
    pub repo_path: String,
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::process::Command;
    use super::branches::list_branches;
    use super::conflict::check_conflicts;
    use super::diff::get_mr_diff;

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

        // 3. Create feature branch and add non-conflicting change
        run_git(dir_str, &["checkout", "-b", "feature-x"]);
        fs::write(&file_path, "Line 1: Header\nLine 2: Content\nLine 3: From feature\n").unwrap();
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
        assert!(!diff.files[0].is_conflicted);
        assert!(diff.raw_diff.contains("+Line 3: From feature"));

        // 6. Test in-memory conflict detection:
        // Checkout main, make conflicting edit on line 3, commit
        run_git(dir_str, &["checkout", "main"]);
        fs::write(&file_path, "Line 1: Header\nLine 2: Content\nLine 3: From main conflicting\n").unwrap();
        run_git(dir_str, &["commit", "-am", "Conflicting change on main"]);

        // Run check_conflicts
        let report = check_conflicts(dir_str, "main", "feature-x").expect("Failed to check conflicts");
        assert!(report.has_conflicts, "Conflict must be detected between main and feature-x");
        assert!(
            report.conflicted_files.iter().any(|f| f.contains("sample.txt")),
            "sample.txt must be reported as conflicted"
        );

        // Verify working tree is NOT modified (no merge conflict markers like <<<<<<<)
        let disk_content = fs::read_to_string(&file_path).unwrap();
        assert!(!disk_content.contains("<<<<<<<"), "Working tree must remain untouched by git merge-tree");
        assert_eq!(disk_content, "Line 1: Header\nLine 2: Content\nLine 3: From main conflicting\n");

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
