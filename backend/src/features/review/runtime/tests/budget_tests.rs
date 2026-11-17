use super::*;
use crate::features::review::{model_adapter::ReviewModelAdapter, ReviewToolCall};
use std::{collections::VecDeque, future::Future, pin::Pin};

struct BudgetAdapter {
    responses: Mutex<VecDeque<Value>>,
    requests: Mutex<Vec<Value>>,
    request_bytes: Option<usize>,
}

impl ReviewModelAdapter for BudgetAdapter {
    fn initial_history(&self, prompt: &str) -> Vec<Value> {
        provider::initial_history("deepseek", prompt)
    }
    fn payload(&self, system: &str, history: &[Value], tools: &[Value], limit: u64) -> Value {
        let mut request = config("https://api.deepseek.com".into());
        request.provider = "deepseek".into();
        provider::payload(&request, system, history, tools, limit)
    }
    fn request_size(&self, body: &Value) -> usize {
        self.request_bytes.unwrap_or_else(|| body.to_string().len())
    }
    fn request<'a>(
        &'a self,
        body: &'a Value,
    ) -> Pin<Box<dyn Future<Output = Result<Value, String>> + Send + 'a>> {
        Box::pin(async move {
            self.requests.lock().unwrap().push(body.clone());
            self.responses
                .lock()
                .unwrap()
                .pop_front()
                .ok_or("Unexpected extra request".into())
        })
    }
    fn decode(
        &self,
        response: &Value,
        history: &mut Vec<Value>,
    ) -> Result<(Vec<ReviewToolCall>, u64), String> {
        provider::decode("deepseek", response, history)
    }
    fn append_results(&self, history: &mut Vec<Value>, results: &[(ReviewToolCall, Value)]) {
        provider::append_results("deepseek", history, results);
    }
}

fn response(name: &str, args: Value, usage: u64) -> Value {
    json!({"choices":[{"finish_reason":"tool_calls","message":{"role":"assistant","content":null,
        "tool_calls":[{"id":format!("call-{usage}"),"type":"function","function":{"name":name,"arguments":args.to_string()}}]}}],
        "usage":{"prompt_tokens":usage.saturating_sub(100),"completion_tokens":100,"total_tokens":usage}})
}

fn adapter(responses: Vec<Value>, request_bytes: Option<usize>) -> BudgetAdapter {
    BudgetAdapter {
        responses: Mutex::new(responses.into()),
        requests: Mutex::new(vec![]),
        request_bytes,
    }
}

fn envelope(error: &str) -> Value {
    serde_json::from_str(error.strip_prefix(crate::common::messages::PREFIX).unwrap()).unwrap()
}

#[tokio::test]
async fn deepseek_cumulative_usage_explains_the_local_limit_before_executing_over_budget_calls() {
    let repo = TestRepo::new();
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let model = adapter(
        vec![
            response("list_changed_files", json!({"offset":0}), 16000),
            response("list_changed_files", json!({"offset":0}), 16000),
            response("list_changed_files", json!({"offset":0}), 16000),
            response(
                "submit_review",
                json!({"summary":"Must not publish","decision":"approve","findings":[]}),
                16057,
            ),
        ],
        None,
    );
    let outcome = execute_with_adapter(
        &db,
        &config("http://localhost".into()),
        &mut run,
        &Arc::new(Mutex::new(ctx)),
        &model,
    )
    .await;
    let message = envelope(outcome.as_ref().unwrap_err());
    assert_eq!(message["code"], "backend.review.tokenBudgetExceededDetails");
    assert_eq!(message["params"], json!({"used":64057,"limit":64000}));
    run.finish(outcome);
    assert_eq!(run.status, "incomplete");
    assert_eq!(run.usage_tokens, 64057);
    assert_eq!(run.tool_calls, 3);
    assert!(!run.published);
    assert_eq!(model.requests.lock().unwrap().len(), 4);
    let events = db.review_events(&run.id).unwrap();
    let event = events
        .iter()
        .find(|e| e["kind"] == "budget_exhausted")
        .unwrap();
    assert_eq!(event["detail"]["resource"], "reported_tokens");
    assert_eq!(event["detail"]["used"], 64057);
    assert_eq!(event["detail"]["limit"], 64000);
}

#[tokio::test]
async fn budget_warning_allows_safe_completion_without_raising_limits_or_claiming_approval() {
    let repo = TestRepo::new();
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let model = adapter(
        vec![
            response("list_changed_files", json!({"offset":0}), 32000),
            response(
                "submit_review",
                json!({"summary":"Only reviewed available context","decision":"comment","findings":[]}),
                100,
            ),
        ],
        None,
    );
    let outcome = execute_with_adapter(
        &db,
        &config("http://localhost".into()),
        &mut run,
        &Arc::new(Mutex::new(ctx)),
        &model,
    )
    .await;
    assert!(outcome.is_ok(), "{outcome:?}");
    run.finish(outcome);
    assert_eq!(run.status, "partial");
    assert_eq!(run.decision.as_deref(), Some("comment"));
    let requests = model.requests.lock().unwrap();
    let initial: Value =
        serde_json::from_str(requests[0]["messages"][1]["content"].as_str().unwrap()).unwrap();
    assert_eq!(initial["executionBudget"]["tokenLimit"], 64000);
    let warning = requests[1]["messages"]
        .as_array()
        .unwrap()
        .iter()
        .find_map(|m| {
            let value: Value = serde_json::from_str(m["content"].as_str()?).ok()?;
            (value["kind"] == "review_budget_warning").then_some(value)
        })
        .unwrap();
    assert_eq!(warning["remainingTokens"], 32000);
    assert!(warning["instruction"]
        .as_str()
        .unwrap()
        .contains("Never skip coverage"));
    assert_eq!(
        db.review_events(&run.id)
            .unwrap()
            .iter()
            .filter(|e| e["kind"] == "budget_warning")
            .count(),
        1
    );
}

#[tokio::test]
async fn request_and_cumulative_wire_limits_are_not_misreported_as_provider_tokens() {
    for (bytes, code, resource, sent, used, limit) in [
        (
            160 * 1024 + 1,
            "backend.review.requestBudgetExceeded",
            "request_bytes",
            0,
            160 * 1024 + 1,
            160 * 1024,
        ),
        (
            128 * 1024,
            "backend.review.wireBudgetExceeded",
            "reserved_wire_bytes",
            2,
            768 * 1024,
            512 * 1024,
        ),
    ] {
        let repo = TestRepo::new();
        let (mut run, ctx) = repo.review();
        let db = test_database(&run);
        db.save_review_run(&run).unwrap();
        let model = adapter(
            vec![response("list_changed_files", json!({"offset":0}), 10); sent],
            Some(bytes),
        );
        let outcome = execute_with_adapter(
            &db,
            &config("http://localhost".into()),
            &mut run,
            &Arc::new(Mutex::new(ctx)),
            &model,
        )
        .await;
        let message = envelope(outcome.as_ref().unwrap_err());
        assert_eq!(message["code"], code);
        assert_eq!(message["params"], json!({"used":used,"limit":limit}));
        run.finish(outcome);
        assert_eq!(run.status, "incomplete");
        assert!(!run.published);
        assert_eq!(model.requests.lock().unwrap().len(), sent);
        let events = db.review_events(&run.id).unwrap();
        assert!(events
            .iter()
            .any(|e| e["kind"] == "budget_exhausted" && e["detail"]["resource"] == resource));
    }
}
