use super::*;

#[tokio::test(start_paused = true)]
async fn acp_rate_limit_waits_then_continues_and_generates_the_description() {
    use crate::features::review::fixture_acp_adapter::FixtureAcpAdapter;
    let repo = TestRepo::new();
    repo.git(&["rm", ".env"]);
    repo.write("source.rs", "fn value() -> u32 { 2 }\n");
    repo.write("deleted.rs", "fn deleted() {}\n");
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Clean rate limit fixture"]);
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let description = "## Summary\nChange the value compared with main.";
    let envelope = |name: &str, arguments: Value| json!({"output":json!({"calls":[{"name":name,"arguments":arguments}]}).to_string()});
    let adapter = FixtureAcpAdapter::new(vec![
        json!({"output":"exceeded retry limit, last status: 429 Too Many Requests","stopReason":"end_turn"}),
        envelope("get_file_diff", json!({"filePath":"source.rs","offset":0})),
        envelope("update_mr_description", json!({"description":description})),
        envelope(
            "submit_review",
            json!({"summary":"Reviewed the value change.","decision":"comment","findings":[]}),
        ),
    ]);
    let mut request = config("http://localhost".into());
    request.execution_mode = "acp".into();
    request.generate_description = true;
    let run_id = run.id.clone();
    let context = Arc::new(Mutex::new(ctx));
    let started = tokio::time::Instant::now();
    let work = execute_with_adapter(&db, &request, &mut run, &context, &adapter);
    let observe_wait = async {
        tokio::time::sleep(Duration::from_secs(1)).await;
        let saved = db.get_review_run(&run_id).unwrap();
        assert_eq!(saved.status, "running");
        let retry = saved.retry.unwrap();
        assert_eq!(retry.reason, "rate_limit");
        assert_eq!(retry.http_status, Some(429));
        assert_eq!(retry.attempt, 1);
        assert_eq!(retry.max_attempts, MAX_PROVIDER_RETRIES);
        assert_eq!(adapter.requests.lock().unwrap().len(), 1);
    };
    let (outcome, ()) = tokio::join!(work, observe_wait);
    assert!(outcome.is_ok(), "{outcome:?}");
    run.finish(outcome);
    assert!(started.elapsed() >= Duration::from_secs(20));
    assert_eq!(run.status, "completed");
    assert_eq!(run.generated_description.as_deref(), Some(description));
    assert!(run.retry.is_none());
    assert_eq!(run.turns, 4);
    assert_eq!(run.tool_calls, 3);
    let requests = adapter.requests.lock().unwrap();
    assert!(requests[1]["history"].to_string().contains("client waited"));
    assert!(!requests[1]["history"]
        .to_string()
        .contains("could not decode"));
    let events = db.review_events(&run.id).unwrap();
    assert_eq!(
        events
            .iter()
            .filter(|event| event["kind"] == "description_updated")
            .count(),
        1
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| event["kind"] == "provider_retry_scheduled")
            .count(),
        1
    );
    assert!(!events
        .iter()
        .any(|event| event["kind"] == "tool_call_retry"));
}

#[tokio::test(start_paused = true)]
async fn acp_provider_failures_remain_accurate_and_retries_are_bounded() {
    use crate::features::review::fixture_acp_adapter::FixtureAcpAdapter;
    for (response, expected_kind, retries) in [
        (
            json!({"output":"exceeded retry limit, last status: 429 Too Many Requests"}),
            "rate_limit",
            2,
        ),
        (
            json!({"error":{"code":-32000,"message":"You've hit your usage limit","data":{"http_status_code":429}}}),
            "quota_exhausted",
            0,
        ),
        (
            json!({"error":{"code":-32000,"message":"Unauthorized","data":{"http_status_code":401}}}),
            "authentication",
            0,
        ),
    ] {
        let repo = TestRepo::new();
        let (mut run, ctx) = repo.review();
        let db = test_database(&run);
        db.save_review_run(&run).unwrap();
        let adapter = FixtureAcpAdapter::new(vec![response; retries + 1]);
        let mut request = config("http://localhost".into());
        request.execution_mode = "acp".into();
        let started = tokio::time::Instant::now();
        let outcome = execute_with_adapter(
            &db,
            &request,
            &mut run,
            &Arc::new(Mutex::new(ctx)),
            &adapter,
        )
        .await;
        assert!(outcome.is_err());
        run.finish(outcome);
        assert_eq!(run.status, "failed");
        assert_eq!(
            crate::features::review::debug_log::error_class(run.error.as_deref().unwrap()),
            expected_kind
        );
        assert!(run.retry.is_none());
        assert!(run.generated_description.is_none());
        assert_eq!(run.tool_calls, 0);
        assert_eq!(adapter.requests.lock().unwrap().len(), retries + 1);
        let events = db.review_events(&run.id).unwrap();
        assert_eq!(
            events
                .iter()
                .filter(|event| event["kind"] == "provider_retry_scheduled")
                .count(),
            retries
        );
        assert!(!events
            .iter()
            .any(|event| event["kind"] == "tool_call_retry"));
        if retries > 0 {
            assert!(started.elapsed() >= Duration::from_secs(60));
            assert!(run.error.as_deref().unwrap().contains("HTTP 429"));
        }
    }
}

#[tokio::test(start_paused = true)]
async fn cancelling_an_acp_rate_limit_wait_prevents_the_next_request() {
    use crate::features::review::fixture_acp_adapter::FixtureAcpAdapter;
    let repo = TestRepo::new();
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let adapter = FixtureAcpAdapter::new(vec![
        json!({"output":"exceeded retry limit, last status: 429 Too Many Requests"}),
    ]);
    let request = config("http://localhost".into());
    let context = Arc::new(Mutex::new(ctx));
    let outcome = tokio::select! {
        result = execute_with_adapter(&db, &request, &mut run, &context, &adapter) => result,
        _ = tokio::time::sleep(Duration::from_secs(1)) => Err("Review cancelled during provider backoff".into()),
    };
    run.finish(outcome);
    assert_eq!(run.status, "cancelled");
    assert!(run.retry.is_none());
    assert_eq!(adapter.requests.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn acp_recovers_a_malformed_turn_and_saves_the_generated_description() {
    use crate::features::review::fixture_acp_adapter::FixtureAcpAdapter;
    let repo = TestRepo::new();
    repo.git(&["rm", ".env"]);
    repo.write("source.rs", "fn value() -> u32 { 2 }\n");
    repo.write("deleted.rs", "fn deleted() {}\n");
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Clean description fixture"]);
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let description = "## Summary\nChange the source value from 1 to 2 compared with main.";
    let envelope = |name: &str, arguments: Value| {
        json!({"calls":[{"name":name,"arguments":arguments}]}).to_string()
    };
    let adapter = FixtureAcpAdapter::new(vec![
        json!({"output":format!("```json\n{}\n```", envelope("get_file_diff", json!({"filePath":"source.rs","offset":0})))}),
        json!({"output":"I will now summarize the changes."}),
        json!({"output":envelope("update_mr_description", json!({"description":description}))}),
        json!({"output":envelope("submit_review", json!({"summary":"Inspected the value change.","decision":"comment","findings":[]}))}),
    ]);
    let mut request = config("http://localhost".into());
    request.execution_mode = "acp".into();
    request.generate_description = true;
    let outcome = execute_with_adapter(
        &db,
        &request,
        &mut run,
        &Arc::new(Mutex::new(ctx)),
        &adapter,
    )
    .await;
    assert!(outcome.is_ok(), "{outcome:?}");
    run.finish(outcome);
    assert_eq!(run.generated_description.as_deref(), Some(description));
    assert_eq!(run.status, "completed");
    assert_eq!(run.tool_calls, 3);
    assert_eq!(run.turns, 4);
    let stored: String = db
        .conn()
        .query_row(
            "SELECT description FROM virtual_mr_sessions WHERE id='session'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(stored, description);
    assert_eq!(
        db.get_review_run(&run.id)
            .unwrap()
            .generated_description
            .as_deref(),
        Some(description)
    );
    let requests = adapter.requests.lock().unwrap();
    assert!(requests[2]["history"]
        .to_string()
        .contains("None of that response's tool requests were executed"));
    let events = db.review_events(&run.id).unwrap();
    assert_eq!(
        events
            .iter()
            .filter(|event| event["kind"] == "tool_call_retry")
            .count(),
        1
    );
    assert!(!serde_json::to_string(&events)
        .unwrap()
        .contains("I will now summarize"));
}

#[tokio::test]
async fn repeated_acp_protocol_errors_fail_but_do_not_erase_a_saved_description() {
    use crate::features::review::fixture_acp_adapter::FixtureAcpAdapter;
    for save_description in [false, true] {
        let repo = TestRepo::new();
        repo.git(&["rm", ".env"]);
        repo.write("source.rs", "fn value() -> u32 { 2 }\n");
        repo.write("deleted.rs", "fn deleted() {}\n");
        repo.git(&["add", "."]);
        repo.git(&["commit", "-m", "Clean failure fixture"]);
        let (mut run, ctx) = repo.review();
        let db = test_database(&run);
        db.save_review_run(&run).unwrap();
        let description = "## Summary\nChange the value compared with main.";
        let mut replies = Vec::new();
        if save_description {
            for (name, arguments) in [
                ("get_file_diff", json!({"filePath":"source.rs","offset":0})),
                ("update_mr_description", json!({"description":description})),
            ] {
                replies.push(json!({"output":json!({"calls":[{"name":name,"arguments":arguments}]}).to_string()}));
            }
        }
        replies.extend((0..=MAX_DECODE_RECOVERIES).map(|_| json!({"output":"invalid ACP text"})));
        let adapter = FixtureAcpAdapter::new(replies);
        let mut request = config("http://localhost".into());
        request.execution_mode = "acp".into();
        request.generate_description = true;
        let outcome = execute_with_adapter(
            &db,
            &request,
            &mut run,
            &Arc::new(Mutex::new(ctx)),
            &adapter,
        )
        .await;
        assert!(outcome.is_err());
        run.finish(outcome);
        assert_eq!(run.status, "failed");
        assert!(!run.published);
        assert_eq!(
            run.generated_description.as_deref(),
            save_description.then_some(description)
        );
        let stored: String = db
            .conn()
            .query_row(
                "SELECT COALESCE(description, '') FROM virtual_mr_sessions WHERE id='session'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stored, if save_description { description } else { "" });
        let events = db.review_events(&run.id).unwrap();
        assert_eq!(
            events
                .iter()
                .filter(|event| event["kind"] == "tool_call_retry")
                .count(),
            MAX_DECODE_RECOVERIES
        );
        assert_eq!(
            run.turns,
            MAX_DECODE_RECOVERIES + 1 + if save_description { 2 } else { 0 }
        );
    }
}

#[tokio::test]
async fn structured_cli_adapter_seam_keeps_common_filtering_and_evidence_validation() {
    use crate::features::review::{
        connectors::cli_protocol, fixture_cli_adapter::FixtureCliAdapter,
    };
    let repo = TestRepo::new();
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let response = |name: &str, args: serde_json::Value| json!({"protocolVersion":cli_protocol::VERSION,"toolCalls":[{"id":name,"name":name,"arguments":args}],"usageTokens":10});
    let adapter = FixtureCliAdapter::new(vec![
        response("get_file_diff", json!({"filePath":"source.rs","offset":0})),
        response(
            "submit_review",
            json!({"summary":"Fixture CLI review; incomplete coverage","decision":"request_changes","findings":[{"filePath":"source.rs","side":"head","startLine":1,"endLine":1,"severity":"medium","title":"Fixture","body":"Fixture evidence","evidence":"fn value() -> u32 { 2 }"}]}),
        ),
    ]);
    let result = execute_with_adapter(
        &db,
        &config("http://localhost".into()),
        &mut run,
        &Arc::new(Mutex::new(ctx)),
        &adapter,
    )
    .await;
    assert!(result.is_ok(), "{result:?}");
    run.finish(result);
    assert_eq!(run.status, "partial");
    assert_eq!(run.findings.len(), 1);
    let requests = adapter.requests.lock().unwrap();
    let last = requests[1].to_string();
    assert!(last.contains("REDACTED") && !last.contains("fixture-only"));
    assert_eq!(requests[0]["capabilities"]["hostFilesystem"], false);
}
