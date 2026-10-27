use super::*;
use crate::features::review::test_repo::TestRepo;
use crate::features::review::ReviewFinding;
use serde_json::json;
fn context(repo: &TestRepo) -> ReviewContext {
    let guards = Arc::new(GuardrailsEngine::new());
    ReviewContext::new(
        capture(repo.path(), "main", "feature", &guards).unwrap(),
        guards,
    )
}
#[test]
fn large_inventory_keeps_eligible_paths_without_consuming_read_rate_limits() {
    let repo = TestRepo::new();
    for index in 0..150 {
        repo.write(&format!("unchanged_{index:03}.rs"), "fn unchanged() {}\n");
    }
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Large base inventory"]);
    repo.git(&["branch", "-f", "main"]);
    repo.write("source.rs", "fn value() -> u32 { 3 }\n");
    repo.write("z_last.rs", "fn last_changed() {}\n");
    repo.write("z_private.rs", "private fixture\n");
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Changes after a large inventory"]);

    let guards = Arc::new(GuardrailsEngine::new());
    let mut policy = guards.get_policy();
    policy.rate_limit_per_minute = 1;
    policy.sensitive_path_patterns.push("z_private.rs".into());
    guards.update_policy(policy);
    for _ in 0..2 {
        let snapshot = capture(repo.path(), "main", "feature", &guards).unwrap();
        assert_eq!(snapshot.changed_files, vec!["source.rs", "z_last.rs"]);
        assert_eq!(snapshot.excluded_files, vec!["z_private.rs"]);
        assert!(snapshot.tree_files.len() > 150);
        let ctx = ReviewContext::new(snapshot, Arc::clone(&guards));
        assert!(ctx
            .blob("z_last.rs", "head")
            .unwrap()
            .contains("last_changed"));
        assert!(ctx.blob("z_private.rs", "head").is_err());
    }
    assert!(guards.evaluate_read_file("source.rs", 1, 1).is_ok());
    assert_eq!(
        guards
            .evaluate_read_file("source.rs", 1, 1)
            .unwrap_err()
            .rule,
        "RATE_LIMIT_EXCEEDED"
    );
}
#[test]
fn tools_read_fixed_commits_not_checkout_and_filter_diff_and_search() {
    let repo = TestRepo::new();
    let mut ctx = context(&repo);
    repo.git(&["checkout", "main"]);
    repo.write("source.rs", "wrong working tree\n");
    assert!(ctx.blob("source.rs", "head").unwrap().contains("{ 2 }"));
    assert!(ctx.blob("source.rs", "base").unwrap().contains("{ 1 }"));
    assert!(ctx.blob(".env", "head").is_err());
    assert!(ctx.snapshot.excluded_files.contains(&".env".to_string()));
    let diff = ctx
        .execute("get_file_diff", &json!({"filePath":"source.rs","offset":0}))
        .unwrap()
        .to_string();
    assert!(
        diff.contains("REDACTED")
            && !diff.contains("fixture-only")
            && !diff.contains("wrong working tree")
    );
    let search = ctx
        .execute("search_code", &json!({"query":"fixture-only"}))
        .unwrap()
        .to_string();
    assert!(!search.contains("fixture-only") && !search.contains("VERY_PRIVATE"));
    assert!(ctx.blob("deleted.rs", "base").unwrap().contains("deleted"));
    assert!(ctx.blob("deleted.rs", "head").is_err());
    assert!(ctx.limited);
}

#[test]
fn stage0_guardrail_policy_limits_diff_search_and_structured_output() {
    let repo = TestRepo::new();
    let guards = Arc::new(GuardrailsEngine::new());
    let mut policy = guards.get_policy();
    policy.max_file_read_lines = 2;
    policy.max_output_bytes = 1024;
    guards.update_policy(policy);
    let snapshot = capture(repo.path(), "main", "feature", &guards).unwrap();
    let mut ctx = ReviewContext::new(snapshot, Arc::clone(&guards));

    let diff = ctx
        .execute("get_file_diff", &json!({"filePath":"source.rs","offset":0}))
        .unwrap();
    assert!(diff["items"].as_array().unwrap().len() <= 2);
    let search = ctx
        .execute("search_code", &json!({"query":"fixture-only"}))
        .unwrap();
    assert!(search["matches"].as_array().unwrap().len() <= 2);

    repo.write(
        "source.rs",
        &format!("{}\n", "ordinary_source_line ".repeat(200)),
    );
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Oversized output fixture"]);
    let mut policy = guards.get_policy();
    policy.max_file_read_lines = 100;
    guards.update_policy(policy);
    let snapshot = capture(repo.path(), "main", "feature", &guards).unwrap();
    let mut oversized_ctx = ReviewContext::new(snapshot, Arc::clone(&guards));
    assert!(oversized_ctx
        .execute("get_file_diff", &json!({"filePath":"source.rs","offset":0}))
        .unwrap_err()
        .contains("output-size policy"));
    assert!(oversized_ctx.inspected.is_empty());
    assert!(oversized_ctx.complete_diffs.is_empty());
    assert!(oversized_ctx.diff_offsets.is_empty());
    assert!(guards.get_audit_log(Some(20)).iter().any(|event| {
        event.tool_name == "get_file_diff"
            && event
                .violations
                .iter()
                .any(|violation| violation.rule == "REVIEW_OUTPUT_LIMIT_EXCEEDED")
    }));
}

#[test]
fn pagination_and_evidence_are_validated_and_no_command_is_exposed() {
    let repo = TestRepo::new();
    repo.write(
        "large.rs",
        &(0..250)
            .map(|n| format!("let value_{n} = {n};\n"))
            .collect::<String>(),
    );
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Large fixture"]);
    let mut ctx = context(&repo);
    ctx.execute(
        "get_file_diff",
        &json!({"filePath":"large.rs","offset":200}),
    )
    .unwrap();
    assert!(!ctx.complete_diffs.contains("large.rs"));
    for offset in [0, 100, 200] {
        ctx.execute(
            "get_file_diff",
            &json!({"filePath":"large.rs","offset":offset}),
        )
        .unwrap();
    }
    assert!(ctx.complete_diffs.contains("large.rs"));
    let mut finding = ReviewFinding {
        file_path: "source.rs".into(),
        side: "head".into(),
        start_line: 1,
        end_line: 1,
        severity: "medium".into(),
        title: "Fixture".into(),
        body: "Fixture".into(),
        evidence: "fn value() -> u32 { 2 }".into(),
    };
    assert!(ctx.validate_findings(&[finding.clone()]).is_ok());
    finding.evidence = "invented source".into();
    assert!(ctx.validate_findings(&[finding.clone()]).is_err());
    finding.evidence = "fn value() -> u32 { 2 }".into();
    finding.start_line = 100;
    finding.end_line = 100;
    assert!(ctx.validate_findings(&[finding]).is_err());
    assert!(ctx
        .execute("execute_terminal_cmd", &json!({"command":"git","args":[]}))
        .is_err());
    assert!(ctx
        .execute(
            "read_file_range",
            &json!({"filePath":"../escape","side":"head","startLine":1,"endLine":2})
        )
        .is_err());
}
#[test]
fn search_and_middle_diff_hunks_cannot_leak_private_key_interiors() {
    let repo = TestRepo::new();
    let lines = (0..30)
        .map(|n| format!("BASE64FIXTURE{n}\n"))
        .collect::<String>();
    let original = format!("-----BEGIN PRIVATE KEY-----\n{lines}-----END PRIVATE KEY-----\n");
    repo.write("material.txt", &original);
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Fixture key block"]);
    repo.git(&["branch", "-f", "main"]);
    repo.write(
        "material.txt",
        &original.replace("BASE64FIXTURE15", "CHANGEDBASE64FIXTURE15"),
    );
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Interior line fixture"]);
    repo.git(&["config", "color.diff", "always"]);
    repo.git(&["config", "color.grep", "always"]);
    repo.git(&["config", "diff.outputIndicatorNew", ">"]);
    repo.git(&["config", "diff.outputIndicatorOld", "<"]);
    repo.git(&["config", "diff.outputIndicatorContext", "|"]);
    let mut ctx = context(&repo);
    let diff = ctx
        .execute(
            "get_file_diff",
            &json!({"filePath":"material.txt","offset":0}),
        )
        .unwrap()
        .to_string();
    assert!(
        diff.contains("REDACTED") && !diff.contains("BASE64FIXTURE") && !diff.contains("\\u001b")
    );
    let batch = ctx
        .execute("get_diff_batch", &json!({"fileOffset":0,"diffOffset":0}))
        .unwrap()
        .to_string();
    assert!(
        batch.contains("REDACTED")
            && !batch.contains("BASE64FIXTURE")
            && !batch.contains("\\u001b")
    );
    let search = ctx
        .execute("search_code", &json!({"query":"CHANGEDBASE64FIXTURE15"}))
        .unwrap()
        .to_string();
    assert!(search.contains("REDACTED") && !search.contains("BASE64FIXTURE"));
    assert!(ctx.limited);
}
#[test]
fn missing_partial_clone_blobs_never_fetch_implicitly() {
    let repo = TestRepo::new();
    let ctx = context(&repo);
    let oid = repo.git(&["rev-parse", "feature:source.rs"]);
    let oid = oid.trim();
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    repo.git(&[
        "remote",
        "add",
        "origin",
        &format!("http://{}", listener.local_addr().unwrap()),
    ]);
    repo.git(&["config", "remote.origin.promisor", "true"]);
    repo.git(&["config", "remote.origin.partialclonefilter", "blob:none"]);
    // This is a disposable fixture object, not a user repository.
    std::fs::remove_file(
        repo.path
            .join(".git/objects")
            .join(&oid[..2])
            .join(&oid[2..]),
    )
    .unwrap();
    assert!(ctx.blob("source.rs", "head").is_err());
    assert_eq!(
        listener.accept().unwrap_err().kind(),
        std::io::ErrorKind::WouldBlock
    );
}
#[test]
fn replace_refs_do_not_change_source_for_a_captured_object_id() {
    let repo = TestRepo::new();
    let ctx = context(&repo);
    let before = repo.git(&["rev-parse", "main:source.rs"]);
    let after = repo.git(&["rev-parse", "feature:source.rs"]);
    repo.git(&["replace", after.trim(), before.trim()]);
    assert!(ctx.blob("source.rs", "head").unwrap().contains("{ 2 }"));
}
#[cfg(unix)]
#[test]
fn symlinks_cannot_escape_the_snapshot_or_sensitive_path_policy() {
    let repo = TestRepo::new();
    std::os::unix::fs::symlink("/etc/passwd", repo.path.join("alias.txt")).unwrap();
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Symlink fixture"]);
    let mut ctx = context(&repo);
    assert!(!ctx.snapshot.tree_files.contains(&"alias.txt".into()));
    assert!(ctx.blob("alias.txt", "head").is_err());
    assert!(ctx
        .execute("get_file_diff", &json!({"filePath":"alias.txt","offset":0}))
        .is_err());
}
