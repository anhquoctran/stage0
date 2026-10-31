use super::*;

#[tokio::test]
async fn real_http_tool_loop_validates_evidence_redacts_context_and_persists_findings() {
    let repo = TestRepo::new();
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let (url,requests)=server(vec![
        reply("get_file_diff",json!({"filePath":"source.rs","offset":0})),
        reply("execute_terminal_cmd",json!({"command":"touch","args":["forbidden"]})),
        reply("submit_review",json!({"summary":"Fixture review with excluded content","decision":"request_changes","findings":[{"filePath":"source.rs","side":"head","startLine":1,"endLine":1,"severity":"medium","title":"Fixture finding","body":"Evidence-backed fixture, not a live model judgment","evidence":"fn value() -> u32 { 2 }"}]})),
    ]).await;
    let result = execute(&db, &config(url), &mut run, &Arc::new(Mutex::new(ctx))).await;
    assert!(result.is_ok(), "{result:?}");
    run.finish(result);
    db.save_review_run(&run).unwrap();
    assert_eq!(run.status, "partial");
    assert_eq!(run.findings.len(), 1);
    assert_eq!(run.turns, 3);
    assert_eq!(run.usage_tokens, 45);
    assert!(!repo.path.join("forbidden").exists());
    let requests = requests.await.unwrap();
    assert!(requests[0]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .any(|t| t["function"]["name"] == "submit_review"));
    let later = requests[2].to_string();
    assert!(later.contains("REDACTED") && later.contains("unauthorized"));
    assert!(!later.contains("fixture-only"));
    assert_eq!(db.get_review_run(&run.id).unwrap().findings.len(), 1);
    assert!(!serde_json::to_string(&db.review_events(&run.id).unwrap())
        .unwrap()
        .contains("fn value"));
}

#[tokio::test]
async fn one_missing_tool_call_gets_a_bounded_provider_neutral_retry() {
    let repo = TestRepo::new();
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let (url, requests) = server(vec![
        prose_reply(),
        reply("get_diff", json!({})),
        reply(
            "submit_review",
            json!({"summary":"No issues identified in inspected context","decision":"comment","findings":[]}),
        ),
    ])
    .await;

    let result = execute(&db, &config(url), &mut run, &Arc::new(Mutex::new(ctx))).await;
    assert!(result.is_ok(), "{result:?}");
    assert_eq!(run.turns, 3);
    assert_eq!(run.status, "partial");
    let requests = requests.await.unwrap();
    assert!(requests[1]["messages"]
        .to_string()
        .contains("did not invoke a tool"));
    assert_eq!(
        db.review_events(&run.id)
            .unwrap()
            .iter()
            .filter(|event| event["kind"] == "tool_call_retry")
            .count(),
        1
    );
}

#[tokio::test]
async fn non_terminating_models_hit_the_turn_budget_and_never_succeed() {
    use crate::features::review::{
        connectors::cli_protocol, fixture_cli_adapter::FixtureCliAdapter,
    };
    let repo = TestRepo::new();
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let replies = (0..MAX_REVIEW_TURNS)
        .map(|index| {
            json!({
                "protocolVersion":cli_protocol::VERSION,
                "toolCalls":[{"id":format!("call-{index}"),"name":"get_diff","arguments":{}}],
                "usageTokens":0
            })
        })
        .collect();
    let adapter = FixtureCliAdapter::new(replies);
    let result = execute_with_adapter(
        &db,
        &config("http://localhost".into()),
        &mut run,
        &Arc::new(Mutex::new(ctx)),
        &adapter,
    )
    .await;
    assert!(result.as_ref().unwrap_err().contains("budget"));
    run.finish(result);
    assert_eq!(run.status, "incomplete");
    assert!(run.findings.is_empty());
    assert_eq!(adapter.requests.lock().unwrap().len(), MAX_REVIEW_TURNS);
    let flag = Arc::new(AtomicBool::new(true));
    tokio::time::timeout(Duration::from_millis(100), wait_cancel(flag))
        .await
        .unwrap();
    run.finish(Err("Review cancelled".into()));
    assert_eq!(run.status, "cancelled");
}

#[tokio::test]
async fn transient_http_errors_retry_once_but_authentication_errors_do_not() {
    let (url, requests) = server(vec![
        json!({"fixtureHttpStatus":429}),
        reply("get_diff", json!({})),
    ])
    .await;
    assert!(
        provider::request(&config(url.clone()), &format!("{url}/api/chat"), &json!({}),)
            .await
            .is_ok()
    );
    assert_eq!(requests.await.unwrap().len(), 2);
    let (url, requests) = server(vec![json!({"fixtureHttpStatus":401})]).await;
    assert!(
        provider::request(&config(url.clone()), &format!("{url}/api/chat"), &json!({}),)
            .await
            .unwrap_err()
            .contains("401")
    );
    assert_eq!(requests.await.unwrap().len(), 1);
}

#[tokio::test]
async fn fabricated_evidence_is_returned_as_an_error_before_corrected_submission() {
    let repo = TestRepo::new();
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let finding = json!({"filePath":"source.rs","side":"head","startLine":1,"endLine":1,"severity":"medium","title":"Fixture","body":"Fixture","evidence":"invented code"});
    let mut corrected = finding.clone();
    corrected["evidence"] = json!("fn value() -> u32 { 2 }");
    let (url, requests) = server(vec![
        reply(
            "submit_review",
            json!({"summary":"Invalid","decision":"request_changes","findings":[finding]}),
        ),
        reply(
            "submit_review",
            json!({"summary":"Corrected with incomplete coverage","decision":"request_changes","findings":[corrected]}),
        ),
    ])
    .await;
    let result = execute(&db, &config(url), &mut run, &Arc::new(Mutex::new(ctx))).await;
    assert!(result.is_ok());
    run.finish(result);
    assert_eq!(run.status, "partial");
    assert_eq!(run.findings.len(), 1);
    let requests = requests.await.unwrap();
    assert!(requests[1]
        .to_string()
        .contains("exact non-redacted source evidence"));
}

#[tokio::test]
async fn quota_and_billing_during_a_review_stop_without_replaying_or_approving() {
    for (status, code, expected) in [(429, "insufficient_quota", "providerQuota"), (402, "billing_error", "providerBilling"), (429, "budget_exceeded", "providerCostLimit")] {
        let repo = TestRepo::new();
        let (mut run, ctx) = repo.review();
        let db = test_database(&run);
        db.save_review_run(&run).unwrap();
        let (url, requests) = server(vec![reply("get_diff", json!({})), json!({"fixtureHttpStatus":status,"error":{"code":code,"message":"private sk-EXAMPLE"}})]).await;
        let result = execute(&db, &config(url), &mut run, &Arc::new(Mutex::new(ctx))).await;
        let error = result.as_ref().unwrap_err();
        assert!(error.contains(expected), "{error}");
        assert!(!error.contains("sk-EXAMPLE"));
        run.finish(result);
        db.save_review_run(&run).unwrap();
        let saved = db.get_review_run(&run.id).unwrap();
        assert_eq!(saved.status, "failed");
        assert!(!saved.published);
        assert!(saved.retry.is_none());
        assert_eq!(requests.await.unwrap().len(), 2, "Only the initial turn and rejected turn may be sent");
    }
}

#[tokio::test]
async fn connection_loss_mid_response_never_replays_a_potentially_billed_request() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut buffer = [0; 8192];
        socket.read(&mut buffer).await.unwrap();
        socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 10000\r\n\r\n{\"message\":").await.unwrap();
        drop(socket);
        assert!(tokio::time::timeout(Duration::from_millis(200), listener.accept()).await.is_err(), "Interrupted requests must not be retried");
    });
    let error = provider::request(&config(url.clone()), &format!("{url}/api/chat"), &json!({})).await.unwrap_err();
    assert!(error.contains("providerInterrupted"), "{error}");
    task.await.unwrap();
}

#[test]
fn coded_cancellation_and_local_budgets_keep_their_terminal_status() {
    let repo = TestRepo::new();
    for (code, status) in [("backend.review.cancelled", "cancelled"), ("backend.review.deadlineExceeded", "incomplete"), ("backend.ai.providerCostLimit", "failed")] {
        let (mut run, _) = repo.review();
        run.finish(Err(crate::common::messages::code(code)));
        assert_eq!(run.status, status);
        assert!(run.finished_at.is_some());
        assert!(run.retry.is_none());
    }
}
