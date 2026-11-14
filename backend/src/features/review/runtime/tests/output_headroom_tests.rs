use super::{
    continuation_tests::{response, PlanningModel},
    *,
};
use crate::features::review::{model_adapter::ReviewModelAdapter, ReviewToolCall};
use std::{future::Future, pin::Pin};

/// The floor matches native DeepSeek thinking. Fixed byte size replays telemetry
/// for the failed run without copying user source, prompts or model reasoning.
struct ThinkingTraceAdapter {
    inner: PlanningModel,
    wire_bytes: Option<usize>,
}
impl ReviewModelAdapter for ThinkingTraceAdapter {
    fn initial_history(&self, prompt: &str) -> Vec<Value> {
        self.inner.initial_history(prompt)
    }
    fn payload(&self, s: &str, h: &[Value], t: &[Value], n: u64) -> Value {
        self.inner.payload(s, h, t, n)
    }
    fn output_token_limit(&self, expanded: bool) -> u64 {
        if expanded {
            32768
        } else {
            16384
        }
    }
    fn minimum_output_tokens(&self) -> u64 {
        4096
    }
    fn request_size(&self, body: &Value) -> usize {
        self.wire_bytes.unwrap_or_else(|| body.to_string().len())
    }
    fn input_token_usage(&self, r: &Value) -> Option<u64> {
        self.inner.input_token_usage(r)
    }
    fn truncated_output_usage(&self, r: &Value) -> Option<u64> {
        self.inner.truncated_output_usage(r)
    }
    fn request<'a>(
        &'a self,
        b: &'a Value,
    ) -> Pin<Box<dyn Future<Output = Result<Value, String>> + Send + 'a>> {
        self.inner.request(b)
    }
    fn decode(&self, r: &Value, h: &mut Vec<Value>) -> Result<(Vec<ReviewToolCall>, u64), String> {
        self.inner.decode(r, h)
    }
    fn append_results(&self, h: &mut Vec<Value>, r: &[(ReviewToolCall, Value)]) {
        self.inner.append_results(h, r)
    }
}

#[test]
fn failed_run_telemetry_never_sends_a_504_token_thinking_continuation() {
    use super::super::{request_budget::RequestBudget, tool_state::ReviewToolState};
    let repo = TestRepo::new();
    let (mut run, _) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    run.usage_tokens = 42574;
    let model = ThinkingTraceAdapter {
        inner: PlanningModel::new(vec![]),
        wire_bytes: Some(69031),
    };
    let mut budget = RequestBudget::default();
    budget
        .observe(
            &db,
            &run,
            &model,
            &response("search_code", json!({"query":"fixture"}), 18080, 124),
            66445,
        )
        .unwrap();
    let mut state = ReviewToolState::new(true);
    let mut history = model.initial_history("Synthetic telemetry reproduction");
    let registry =
        crate::features::review::tool_registry::ReviewToolRegistry::native_for_review(true);
    let result = budget.prepare(
        &db,
        &run,
        &model,
        "Immutable source policy",
        &mut history,
        registry.definitions(),
        16384,
        64000,
        &mut state,
        false,
    );
    assert!(result.unwrap_err().contains("tokenBudgetCannotContinue"));
    assert!(model.inner.requests.lock().unwrap().is_empty());
    let event = db
        .review_events(&run.id)
        .unwrap()
        .into_iter()
        .find(|e| e["kind"] == "budget_exhausted")
        .unwrap();
    assert_eq!(event["detail"]["availableOutputTokens"], 504);
    assert_eq!(event["detail"]["minimumOutputTokens"], 4096);
    assert_eq!(event["detail"]["requestSent"], false);
    assert!(!run.published);
}

#[tokio::test]
async fn full_preload_generates_description_first_then_returns_to_full_review_with_output_headroom()
{
    let repo = TestRepo::new();
    repo.git(&["rm", ".env"]);
    repo.write("source.rs", "fn value() -> u32 { 2 }\n");
    for n in 0..8 {
        repo.write(
            &format!("change-{n}.rs"),
            &format!("pub fn item_{n}() -> usize {{ {n} }}\n"),
        );
    }
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Description phase fixture"]);
    let (mut run, ctx) = repo.review();
    assert_eq!(run.snapshot.changed_files.len(), 10);
    let context = Arc::new(Mutex::new(ctx));
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let mut cfg = config("http://localhost".into());
    cfg.generate_description = true;
    let model = ThinkingTraceAdapter {
        inner: PlanningModel::new(vec![
            response(
                "update_mr_description",
                json!({"description":"Add eight helpers, update the source and remove the obsolete file."}),
                6000,
                500,
            ),
            response("list_open_discussions", json!({"offset":0}), 9200, 2000),
            response(
                "submit_review",
                json!({"summary":"Reviewed the full supplied snapshot without unsupported findings.","decision":"comment","findings":[]}),
                13000,
                1000,
            ),
        ]),
        wire_bytes: None,
    };
    let result = execute_with_adapter(&db, &cfg, &mut run, &context, &model).await;
    assert!(result.is_ok(), "{result:?}");
    run.finish(result);
    assert_eq!(run.status, "completed");
    assert!(run.published);
    assert!(run.generated_description.is_some());
    assert_eq!(run.usage_tokens, 31700);
    assert_eq!(context.lock().unwrap().complete_diffs.len(), 10);
    let requests = model.inner.requests.lock().unwrap();
    assert_eq!(requests.len(), 3);
    assert_eq!(requests[0]["tools"].as_array().unwrap().len(), 1);
    assert_eq!(
        requests[0]["tools"][0]["function"]["name"],
        "update_mr_description"
    );
    assert!(requests[1]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .any(|t| t["function"]["name"] == "read_file_range"));
    assert!(requests
        .iter()
        .all(|r| r["max_tokens"].as_u64().unwrap() >= 4096));
    assert!(requests[1]["messages"]
        .as_array()
        .unwrap()
        .iter()
        .any(|m| m["reasoning_content"] == "Preserved reasoning for update_mr_description"));
}

#[tokio::test]
async fn projected_description_phase_never_grants_coverage_or_allows_publication_before_delivery() {
    use super::super::{
        action_dispatch::dispatch_action, description_phase, tool_state::ReviewToolState,
    };
    let repo = TestRepo::new();
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let context = Arc::new(Mutex::new(ctx));
    let batch = context
        .lock()
        .unwrap()
        .prepare_diff_batch(0, 0, 24000, true)
        .unwrap();
    assert!(description_phase::source_ready(&context, Some(&batch)).unwrap());
    assert!(!description_phase::source_ready(&context, None).unwrap());
    assert!(context.lock().unwrap().complete_diffs.is_empty());
    let mut state = ReviewToolState::new(true);
    let call = super::discussion_fixture::call(
        "update_mr_description",
        json!({"description":"Not authorized before source delivery"}),
    );
    assert!(dispatch_action(&db, &mut run, &context, &call, &mut state)
        .await
        .unwrap()
        .is_err());
    assert!(run.generated_description.is_none());
    assert!(!run.published);
    let create = super::discussion_fixture::call("create_review_discussion", json!({}));
    assert!(super::super::scope::validate_call(&state, &create).is_err());
}

#[test]
fn deepseek_output_floor_tracks_thinking_without_changing_the_user_reasoning_setting() {
    use crate::features::review::native_model_adapter::NativeModelAdapter;
    let mut cfg = config("http://localhost:1420".into());
    cfg.provider = "deepseek".into();
    cfg.model = "deepseek-flash".into();
    cfg.reasoning_effort = Some("high".into());
    let model = NativeModelAdapter::new(&cfg).unwrap();
    assert_eq!(model.minimum_output_tokens(), 4096);
    assert_eq!(model.output_token_limit(false), 16384);
    cfg.reasoning_effort = Some("none".into());
    let model = NativeModelAdapter::new(&cfg).unwrap();
    assert_eq!(model.minimum_output_tokens(), 0);
    assert_eq!(
        model.payload("policy", &[], &[], 8192)["thinking"]["type"],
        "disabled"
    );
}
