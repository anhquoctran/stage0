use super::*;

#[tokio::test]
async fn prose_and_uninspected_empty_findings_cannot_manufacture_complete_coverage() {
    let repo = TestRepo::new();
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let (url, requests) = server(vec![reply(
        "submit_review",
        json!({"summary":"No findings; context uninspected","decision":"comment","findings":[]}),
    )])
    .await;
    let result = execute(&db, &config(url), &mut run, &Arc::new(Mutex::new(ctx))).await;
    assert!(result.is_ok());
    run.finish(result);
    assert_eq!(run.status, "partial");
    requests.await.unwrap();
    let (url, requests) = server(vec![
        json!({"done":true,"message":{"role":"assistant","content":"Everything is safe"}}),
    ])
    .await;
    let (_, ctx) = repo.review();
    run.status = "running".into();
    let result = execute(&db, &config(url), &mut run, &Arc::new(Mutex::new(ctx))).await;
    assert!(result.is_err());
    run.finish(result);
    assert_eq!(run.status, "failed");
    requests.await.unwrap();
}

#[tokio::test]
async fn unchanged_snapshot_needs_no_model_request_and_records_no_approval() {
    let repo = TestRepo::new();
    let (mut run, mut ctx) = repo.review();
    let guards = crate::features::sandbox::guardrails::GuardrailsEngine::new();
    ctx.snapshot =
        crate::features::review::context::capture(repo.path(), "main", "main", &guards).unwrap();
    run.snapshot = ctx.snapshot.clone();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let result = execute(
        &db,
        &config("http://127.0.0.1:1".into()),
        &mut run,
        &Arc::new(Mutex::new(ctx)),
    )
    .await;
    assert!(result.is_ok());
    run.finish(result);
    assert_eq!(run.status, "completed");
    assert_eq!(run.turns, 0);
    assert!(run.summary.contains("no approval"));
    assert!(db.review_events(&run.id).unwrap().is_empty());
}

#[tokio::test]
async fn fully_excluded_snapshot_finishes_partial_without_contacting_a_model() {
    let repo = TestRepo::new();
    repo.git(&["checkout", "main"]);
    repo.git(&["checkout", "-b", "excluded-only"]);
    repo.write(".env", "PRIVATE_FIXTURE=value\n");
    repo.git(&["add", ".env"]);
    repo.git(&["commit", "-m", "Only excluded changes"]);
    let (mut run, mut ctx) = repo.review();
    let guards = crate::features::sandbox::guardrails::GuardrailsEngine::new();
    ctx.snapshot =
        crate::features::review::context::capture(repo.path(), "main", "excluded-only", &guards)
            .unwrap();
    run.snapshot = ctx.snapshot.clone();
    assert!(run.snapshot.changed_files.is_empty());
    assert_eq!(run.snapshot.excluded_files, vec![".env"]);
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let result = execute(
        &db,
        &config("http://127.0.0.1:1".into()),
        &mut run,
        &Arc::new(Mutex::new(ctx)),
    )
    .await;
    assert!(result.is_ok(), "{result:?}");
    run.finish(result);
    assert_eq!(run.status, "partial");
    assert_eq!(run.turns, 0);
    assert_eq!(run.tool_calls, 0);
    assert_eq!(run.usage_tokens, 0);
    assert!(run.findings.is_empty());
    assert!(run.summary.contains("no code was reviewed"));
    let events = db.review_events(&run.id).unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0]["kind"], "no_eligible_files");
}

#[tokio::test]
async fn complete_eligible_diff_coverage_can_finish_without_approving_the_mr() {
    let repo = TestRepo::new();
    repo.git(&["rm", ".env"]);
    repo.write("source.rs", "fn value() -> u32 { 2 }\n");
    repo.write("deleted.rs", "fn deleted() {}\n");
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Clean fixture"]);
    let (mut run, ctx) = repo.review();
    assert_eq!(run.snapshot.changed_files, vec!["source.rs"]);
    assert!(run.snapshot.excluded_files.is_empty());
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let (url,requests)=server(vec![reply("get_file_diff",json!({"filePath":"source.rs","offset":0})),reply("submit_review",json!({"summary":"No issue identified in inspected changes","decision":"comment","findings":[]}))]).await;
    let result = execute(&db, &config(url), &mut run, &Arc::new(Mutex::new(ctx))).await;
    assert!(result.is_ok());
    run.finish(result);
    assert_eq!(run.status, "completed");
    assert_eq!(requests.await.unwrap().len(), 2);
    let status: String = db
        .conn()
        .query_row(
            "SELECT status FROM virtual_mr_sessions WHERE id='session'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(status, "open");
}
