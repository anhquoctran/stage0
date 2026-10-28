use super::*;
use crate::features::git::runner::run_git_strict;

fn git(dir: &tempfile::TempDir, args: &[&str]) -> String {
    run_git_strict(dir.path().to_str().unwrap(), args).unwrap()
}

fn repo() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    git(&dir, &["init", "-q", "-b", "main"]);
    git(&dir, &["config", "user.name", "Fixture User"]);
    git(&dir, &["config", "user.email", "fixture@example.test"]);
    std::fs::write(dir.path().join("initial.txt"), "original\n").unwrap();
    git(&dir, &["add", "."]);
    git(
        &dir,
        &["commit", "-qm", "Root subject\n\nFull message body."],
    );
    dir
}

#[test]
fn root_commit_returns_message_metadata_and_added_file_without_changing_repository() {
    let dir = repo();
    let hash = git(&dir, &["rev-parse", "HEAD"]).trim().to_owned();
    let details = get_commit_details(dir.path().to_str().unwrap(), &hash).unwrap();
    assert_eq!(details.hash, hash);
    assert!(details.parents.is_empty());
    assert_eq!(details.author_name, "Fixture User");
    assert_eq!(details.author_email, "fixture@example.test");
    assert_eq!(details.message, "Root subject\n\nFull message body.");
    assert_eq!(details.files.len(), 1);
    assert_eq!(details.files[0].status, "ADDED");
    assert_eq!(details.files[0].additions, 1);
    assert!(details.raw_diff.contains("+original"));
    assert!(!details.truncated);
    assert!(git(&dir, &["status", "--porcelain"]).is_empty());
    assert_eq!(git(&dir, &["rev-parse", "HEAD"]).trim(), hash);
}

#[test]
fn normal_commit_preserves_renames_binary_flags_and_uncommitted_work() {
    let dir = repo();
    git(&dir, &["mv", "initial.txt", "renamed file.txt"]);
    std::fs::write(dir.path().join("binary.bin"), [0, 1, 2, 0, 255]).unwrap();
    git(&dir, &["add", "."]);
    git(&dir, &["commit", "-qm", "Rename and binary"]);
    let hash = git(&dir, &["rev-parse", "HEAD"]).trim().to_owned();
    std::fs::write(dir.path().join("renamed file.txt"), "uncommitted\n").unwrap();
    let before = git(&dir, &["status", "--porcelain"]);
    let details = get_commit_details(dir.path().to_str().unwrap(), &hash).unwrap();
    let renamed = details
        .files
        .iter()
        .find(|file| file.path == "renamed file.txt")
        .unwrap();
    assert_eq!(renamed.status, "RENAMED");
    assert_eq!(renamed.old_path.as_deref(), Some("initial.txt"));
    assert!(
        details
            .files
            .iter()
            .find(|file| file.path == "binary.bin")
            .unwrap()
            .is_binary
    );
    assert!(!details.raw_diff.contains("uncommitted"));
    assert_eq!(git(&dir, &["status", "--porcelain"]), before);
    assert_eq!(
        std::fs::read_to_string(dir.path().join("renamed file.txt")).unwrap(),
        "uncommitted\n"
    );
}

#[test]
fn merge_commit_shows_first_parent_changes_without_aggregating_branch_history() {
    let dir = repo();
    git(&dir, &["checkout", "-qb", "feature"]);
    std::fs::write(dir.path().join("feature.txt"), "feature\n").unwrap();
    git(&dir, &["add", "."]);
    git(&dir, &["commit", "-qm", "Feature"]);
    git(&dir, &["checkout", "main"]);
    std::fs::write(dir.path().join("main.txt"), "main\n").unwrap();
    git(&dir, &["add", "."]);
    git(&dir, &["commit", "-qm", "Main"]);
    git(
        &dir,
        &["merge", "--no-ff", "feature", "-m", "Merge feature"],
    );
    let hash = git(&dir, &["rev-parse", "HEAD"]).trim().to_owned();
    let details = get_commit_details(dir.path().to_str().unwrap(), &hash).unwrap();
    assert_eq!(details.parents.len(), 2);
    assert_eq!(details.files.len(), 1);
    assert_eq!(details.files[0].path, "feature.txt");
}

#[test]
fn invalid_or_unavailable_commit_ids_return_errors() {
    let dir = repo();
    for hash in ["HEAD", "--help", "abc", &"f".repeat(40)] {
        assert!(get_commit_details(dir.path().to_str().unwrap(), hash).is_err());
    }
}

#[test]
fn oversized_patch_keeps_bounded_complete_file_previews_and_explicit_truncation() {
    let dir = repo();
    std::fs::write(
        dir.path().join("large.txt"),
        "a long source line for a bounded preview\n".repeat(180_000),
    )
    .unwrap();
    git(&dir, &["add", "."]);
    git(&dir, &["commit", "-qm", "Large addition"]);
    let hash = git(&dir, &["rev-parse", "HEAD"]).trim().to_owned();
    let details = get_commit_details(dir.path().to_str().unwrap(), &hash).unwrap();
    assert!(details.truncated);
    assert!(details.raw_diff.len() <= MAX_PATCH_BYTES);
    assert!(
        details.raw_diff.is_empty(),
        "one oversized file must not render a partial hunk"
    );
    assert_eq!(details.files[0].additions, 180_000);
}
