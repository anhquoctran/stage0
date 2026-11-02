use super::*;
use crate::features::review::{
    model_adapter::ReviewModelAdapter, native_model_adapter::NativeModelAdapter, ReviewToolCall,
};
use std::{collections::VecDeque, future::Future, pin::Pin};

struct TruncationAdapter {
    codec: NativeModelAdapter,
    responses: Mutex<VecDeque<Value>>,
    requests: Mutex<Vec<Value>>,
}

impl ReviewModelAdapter for TruncationAdapter {
    fn initial_history(&self, prompt: &str) -> Vec<Value> {
        self.codec.initial_history(prompt)
    }
    fn payload(&self, system: &str, history: &[Value], tools: &[Value], limit: u64) -> Value {
        self.codec.payload(system, history, tools, limit)
    }
    fn output_token_limit(&self, expanded: bool) -> u64 {
        self.codec.output_token_limit(expanded)
    }
    fn truncated_output_usage(&self, response: &Value) -> Option<u64> {
        self.codec.truncated_output_usage(response)
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
                .ok_or("Unexpected additional request".into())
        })
    }
    fn decode(
        &self,
        response: &Value,
        history: &mut Vec<Value>,
    ) -> Result<(Vec<ReviewToolCall>, u64), String> {
        self.codec.decode(response, history)
    }
    fn append_results(&self, history: &mut Vec<Value>, results: &[(ReviewToolCall, Value)]) {
        self.codec.append_results(history, results)
    }
}

fn truncated(usage: u64) -> Value {
    json!({"choices":[{"finish_reason":"length","message":{
        "role":"assistant","content":"discarded private output","reasoning_content":"discarded private reasoning",
        "tool_calls":[{"id":"discarded-call","type":"function","function":{"name":"execute_terminal_cmd","arguments":"{}"}}]
    }}],"usage":{"total_tokens":usage}})
}

fn fixture(responses: Vec<Value>) -> (ReviewRequest, TruncationAdapter) {
    let mut request = config("https://api.deepseek.com".into());
    request.provider = "deepseek".into();
    request.model = "deepseek-flash".into();
    request.allow_remote = true;
    let adapter = TruncationAdapter {
        codec: NativeModelAdapter::new(&request).unwrap(),
        responses: Mutex::new(responses.into()),
        requests: Mutex::new(vec![]),
    };
    (request, adapter)
}

#[test]
fn deepseek_output_allowance_accounts_for_thinking_mode() {
    let (mut request, _) = fixture(vec![]);
    request.reasoning_effort = Some("none".into());
    let adapter = NativeModelAdapter::new(&request).unwrap();
    assert_eq!(adapter.output_token_limit(false), 8192);
    assert_eq!(adapter.output_token_limit(true), 16384);
}

#[tokio::test]
async fn truncated_thinking_retries_once_with_more_output_without_replaying_partial_calls() {
    let repo = TestRepo::new();
    let (mut run, context) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let completed = json!({"choices":[{"finish_reason":"tool_calls","message":{"role":"assistant","content":null,
        "tool_calls":[{"id":"submit","type":"function","function":{"name":"submit_review","arguments":"{\"summary\":\"Review completed\",\"decision\":\"comment\",\"findings\":[]}"}}]
    }}],"usage":{"total_tokens":10}});
    let (request, adapter) = fixture(vec![truncated(7000), completed]);
    let result = execute_with_adapter(
        &db,
        &request,
        &mut run,
        &Arc::new(Mutex::new(context)),
        &adapter,
    )
    .await;
    assert!(result.is_ok(), "{result:?}");
    assert_eq!(run.usage_tokens, 7010);
    assert_eq!(run.tool_calls, 1);
    assert!(run.published);
    let requests = adapter.requests.lock().unwrap();
    assert_eq!(requests.len(), 2);
    assert_eq!(requests[0]["max_tokens"], 16384);
    assert_eq!(requests[1]["max_tokens"], 32768);
    assert_eq!(requests[0]["messages"], requests[1]["messages"]);
    assert!(!serde_json::to_string(&db.review_events(&run.id).unwrap())
        .unwrap()
        .contains("discarded private"));
}

#[tokio::test]
async fn repeated_truncation_stops_with_accounted_usage_and_no_tool_execution() {
    let repo = TestRepo::new();
    let (mut run, context) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let (request, adapter) = fixture(vec![truncated(7000), truncated(8000)]);
    let error = execute_with_adapter(
        &db,
        &request,
        &mut run,
        &Arc::new(Mutex::new(context)),
        &adapter,
    )
    .await
    .unwrap_err();
    assert!(error.contains("backend.review.providerOutputTruncated"));
    assert_eq!(run.usage_tokens, 15000);
    assert_eq!(run.tool_calls, 0);
    assert!(!run.published);
    assert_eq!(adapter.requests.lock().unwrap().len(), 2);
}

#[tokio::test]
async fn truncation_does_not_retry_past_the_total_review_budget() {
    let repo = TestRepo::new();
    let (mut run, context) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    run.usage_tokens = 63000;
    let (request, adapter) = fixture(vec![truncated(1000)]);
    let error = execute_with_adapter(
        &db,
        &request,
        &mut run,
        &Arc::new(Mutex::new(context)),
        &adapter,
    )
    .await
    .unwrap_err();
    assert!(error.contains("backend.review.tokenBudgetExceeded"));
    assert_eq!(run.usage_tokens, 64000);
    assert_eq!(run.tool_calls, 0);
    assert_eq!(adapter.requests.lock().unwrap().len(), 1);
    assert_eq!(adapter.requests.lock().unwrap()[0]["max_tokens"], 1000);
}

#[tokio::test]
async fn content_filter_is_not_retried_as_token_truncation() {
    let repo = TestRepo::new();
    let (mut run, context) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let mut refusal = truncated(10);
    refusal["choices"][0]["finish_reason"] = json!("content_filter");
    let (request, adapter) = fixture(vec![refusal]);
    assert!(execute_with_adapter(
        &db,
        &request,
        &mut run,
        &Arc::new(Mutex::new(context)),
        &adapter
    )
    .await
    .is_err());
    assert_eq!(run.tool_calls, 0);
    assert_eq!(adapter.requests.lock().unwrap().len(), 1);
}
