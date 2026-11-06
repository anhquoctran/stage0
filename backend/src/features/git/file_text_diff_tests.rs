use super::file_text_diff::get_file_text_diff;
use super::runner::run_git_strict;

#[test]
fn manual_file_encoding_reloads_the_diff_without_mutating_source() {
    let dir = tempfile::tempdir().unwrap();
    let repo = dir.path().to_str().unwrap();
    for args in [
        vec!["init", "-q", "-b", "main"],
        vec!["config", "user.name", "Fixture"],
        vec!["config", "user.email", "fixture@example.test"],
        vec!["config", "commit.gpgsign", "false"],
    ] {
        run_git_strict(repo, &args).unwrap();
    }
    std::fs::write(dir.path().join("a.txt"), b"value\x80\n").unwrap();
    run_git_strict(repo, &["add", "."]).unwrap();
    run_git_strict(repo, &["commit", "-qm", "Legacy base"]).unwrap();
    let old = run_git_strict(repo, &["rev-parse", "HEAD"]).unwrap();
    std::fs::write(dir.path().join("a.txt"), b"next\x80\n").unwrap();
    run_git_strict(repo, &["commit", "-qam", "UTF-8 head"]).unwrap();
    let new = run_git_strict(repo, &["rev-parse", "HEAD"]).unwrap();
    let selected = get_file_text_diff(
        repo,
        Some(old.trim()),
        new.trim(),
        "a.txt",
        None,
        Some("Windows-1252"),
    )
    .unwrap();
    assert_eq!(selected.old_encoding.as_deref(), Some("Windows-1252"));
    assert_eq!(selected.new_encoding.as_deref(), Some("Windows-1252"));
    assert!(selected.raw_diff.contains("+next\u{20ac}"));
    let other = get_file_text_diff(
        repo,
        Some(old.trim()),
        new.trim(),
        "a.txt",
        None,
        Some("ISO-8859-1"),
    )
    .unwrap();
    assert!(other.raw_diff.contains("+next\u{80}"));
    assert_eq!(other.additions, 1);
    assert_eq!(other.deletions, 1);
    assert!(
        get_file_text_diff(repo, Some(old.trim()), new.trim(), "../outside", None, None).is_err()
    );
    assert!(get_file_text_diff(
        repo,
        Some(old.trim()),
        new.trim(),
        "a.txt",
        None,
        Some("unknown")
    )
    .is_err());
    assert_eq!(
        std::fs::read(dir.path().join("a.txt")).unwrap(),
        b"next\x80\n"
    );
    assert!(run_git_strict(repo, &["status", "--porcelain"])
        .unwrap()
        .is_empty());
}
