use super::*;
use crate::features::review::{persistence::test_database, test_repo::TestRepo, ReviewFinding};

fn finding(path: &str, side: &str, start: usize, end: usize) -> ReviewFinding {
    ReviewFinding {
        file_path: path.into(),
        side: side.into(),
        start_line: start,
        end_line: end,
        severity: "medium".into(),
        title: "Fixture".into(),
        body: "A finding".into(),
        evidence: "source evidence".into(),
    }
}

fn publish(repo: &TestRepo, findings: Vec<ReviewFinding>) -> (Database, ReviewRun) {
    let (mut run, _) = repo.review();
    run.status = "completed".into();
    run.findings = findings;
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    db.publish_review(&run).unwrap();
    (db, run)
}

#[test]
fn old_ai_findings_get_redacted_original_head_and_deleted_base_excerpts_and_cache_them() {
    let repo = TestRepo::new();
    let (db, run) = publish(
        &repo,
        vec![
            finding("source.rs", "head", 1, 1),
            finding("deleted.rs", "base", 1, 1),
        ],
    );
    assert!(db
        .list_discussions("session")
        .unwrap()
        .iter()
        .all(|item| item.code_snippet.is_none()));
    repo.write("source.rs", "different branch content\n");
    repo.git(&["add", "source.rs"]);
    repo.git(&["commit", "-m", "Advance head after review"]);
    let loaded = list_with_code_context(&db, "session", Arc::new(GuardrailsEngine::new())).unwrap();
    let new = loaded
        .iter()
        .find(|item| item.diff_side.as_deref() == Some("right"))
        .unwrap();
    let snippet = new.code_snippet.as_ref().unwrap();
    assert_eq!(snippet.selected_line, Some(1));
    assert_eq!(snippet.selected_end_line, Some(1));
    assert_eq!(snippet.format.as_deref(), Some("diff"));
    assert_eq!(snippet.lines[0], "+fn value() -> u32 { 2 }");
    assert!(snippet.lines[1].contains("[REDACTED"));
    assert!(!snippet.lines.join("\n").contains("fixture-only"));
    assert!(!snippet
        .lines
        .join("\n")
        .contains("different branch content"));
    assert_eq!(
        new.commit_id.as_deref(),
        Some(run.snapshot.head_sha.as_str())
    );
    let old = loaded
        .iter()
        .find(|item| item.diff_side.as_deref() == Some("left"))
        .unwrap();
    assert_eq!(
        old.code_snippet.as_ref().unwrap().lines,
        ["-fn deleted() {}"]
    );
    assert_eq!(
        old.commit_id.as_deref(),
        Some(run.snapshot.merge_base_sha.as_str())
    );
    assert!(db
        .list_discussions("session")
        .unwrap()
        .iter()
        .all(|item| item.code_snippet.is_some()));
}

#[test]
fn excerpt_preserves_head_coordinates_context_rows_and_multi_line_finding_range() {
    let repo = TestRepo::new();
    repo.git(&["checkout", "main"]);
    repo.write("sample.rs", "one\nsame\nold\nlast\n");
    repo.git(&["add", "sample.rs"]);
    repo.git(&["commit", "-m", "Context base"]);
    repo.git(&["checkout", "feature"]);
    repo.git(&["merge", "main", "--no-edit"]);
    repo.write(
        "sample.rs",
        "one\ninserted a\ninserted b\nsame\nnew\nlast\n",
    );
    repo.git(&["add", "sample.rs"]);
    repo.git(&["commit", "-m", "Shifted lines"]);
    let (_, context) = repo.review();
    let snippet = context
        .discussion_code_snippet(&finding("sample.rs", "head", 5, 6))
        .unwrap();
    assert_eq!(snippet.start_line, 2);
    assert_eq!(snippet.selected_line, Some(5));
    assert_eq!(snippet.selected_end_line, Some(6));
    assert_eq!(
        snippet.lines,
        ["+inserted a", "+inserted b", " same", "+new", " last"]
    );
    assert!(context
        .discussion_code_snippet(&finding("sample.rs", "head", 4, 4))
        .is_err());
}

#[test]
fn reconstruction_respects_current_source_policy_and_never_reanchors_a_mismatched_discussion() {
    let repo = TestRepo::new();
    let (db, _) = publish(&repo, vec![finding("source.rs", "head", 1, 1)]);
    let guards = Arc::new(GuardrailsEngine::new());
    let mut policy = guards.get_policy();
    policy.sensitive_path_patterns.push("source.rs".into());
    guards.update_policy(policy);
    let loaded = list_with_code_context(&db, "session", guards).unwrap();
    assert!(loaded[0].code_snippet.is_none());
    db.conn()
        .execute("UPDATE virtual_mr_discussions SET line_number=2", [])
        .unwrap();
    let loaded = list_with_code_context(&db, "session", Arc::new(GuardrailsEngine::new())).unwrap();
    assert!(loaded[0].code_snippet.is_none());
    assert_eq!(loaded[0].line_number, Some(2));
}

#[test]
fn slicing_redacts_private_keys_that_begin_before_the_excerpt_and_bounds_large_ranges() {
    let repo = TestRepo::new();
    let mut content = "-----BEGIN PRIVATE KEY-----\n".to_owned();
    for index in 0..15 {
        content.push_str(&format!("private-material-{index}\n"));
    }
    content.push_str("-----END PRIVATE KEY-----\nfn observed() {}\n");
    repo.write("notes.rs", &content);
    repo.write(
        "large.rs",
        &(0..40)
            .map(|index| format!("line {index}\n"))
            .collect::<String>(),
    );
    repo.git(&["add", "notes.rs", "large.rs"]);
    repo.git(&["commit", "-m", "Excerpt fixtures"]);
    let (_, context) = repo.review();
    let snippet = context
        .discussion_code_snippet(&finding("notes.rs", "head", 18, 18))
        .unwrap();
    assert_eq!(snippet.start_line, 15);
    assert!(snippet.lines[..3]
        .iter()
        .all(|line| line.contains("[REDACTED")));
    assert!(!snippet.lines.join("\n").contains("private-material"));
    assert_eq!(snippet.lines[3], "+fn observed() {}");
    let large = context
        .discussion_code_snippet(&finding("large.rs", "head", 5, 30))
        .unwrap();
    assert_eq!(large.lines.len(), 15);
    assert_eq!(large.selected_end_line, Some(30));
}
