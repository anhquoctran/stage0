use super::*;
use crate::features::review::runtime::{
    action_dispatch::dispatch_action, tool_state::ReviewToolState,
};

#[tokio::test]
async fn continuation_reserves_replayed_input_and_keeps_thinking_and_final_submission_guards() {
    let repo = TestRepo::new();
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let model = PlanningModel::new(vec![
        response("get_diff", json!({}), 10000, 16000),
        response("list_changed_files", json!({"offset":0}), 13000, 10000),
        response(
            "submit_review",
            json!({"summary":"Only available context reviewed; excluded source remains excluded","decision":"comment","findings":[]}),
            7000,
            1000,
        ),
    ]);
    let result = execute_with_adapter(
        &db,
        &config("http://localhost".into()),
        &mut run,
        &Arc::new(Mutex::new(ctx)),
        &model,
    )
    .await;
    assert!(result.is_ok(), "{result:?}");
    run.finish(result);
    assert_eq!(run.status, "partial");
    assert_eq!(run.usage_tokens, 57000);
    assert_eq!(run.decision.as_deref(), Some("comment"));
    let requests = model.requests.lock().unwrap();
    assert_eq!(requests.len(), 3);
    let last = &requests[2];
    assert_eq!(last["tools"].as_array().unwrap().len(), 1);
    assert_eq!(last["tools"][0]["function"]["name"], "submit_review");
    assert!(last["max_tokens"].as_u64().unwrap() < 15000);
    let reasoning: Vec<_> = last["messages"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|m| m["reasoning_content"].as_str())
        .collect();
    assert_eq!(
        reasoning,
        vec![
            "Preserved reasoning for get_diff",
            "Preserved reasoning for list_changed_files"
        ]
    );
    assert!(db
        .review_events(&run.id)
        .unwrap()
        .iter()
        .any(|e| e["kind"] == "budget_finalization"));
    let mut state = ReviewToolState::new(false);
    state.finalizing = true;
    let forbidden = super::discussion_fixture::call(
        "read_file_range",
        json!({"filePath":"source.rs","side":"head","startLine":1,"endLine":1}),
    );
    let (_r, mut other, context, db2) = super::discussion_fixture::setup("Finding");
    assert!(
        dispatch_action(&db2, &mut other, &context, &forbidden, &mut state)
            .await
            .unwrap()
            .is_err()
    );
    let approval = super::discussion_fixture::call(
        "submit_review",
        json!({"summary":"Cannot approve unread/excluded source","decision":"approve","findings":[]}),
    );
    let mut results = vec![];
    assert!(!super::super::submission::submit_review(
        &db2,
        &mut other,
        &context,
        approval,
        &mut state,
        &mut results
    )
    .await
    .unwrap());
    assert_eq!(results[0].1["isError"], true);
}

#[tokio::test]
async fn unaffordable_next_input_stops_before_another_api_call_without_claiming_an_overrun() {
    let repo = TestRepo::new();
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let model = PlanningModel::new(vec![response("get_diff", json!({}), 47000, 1000)]);
    let result = execute_with_adapter(
        &db,
        &config("http://localhost".into()),
        &mut run,
        &Arc::new(Mutex::new(ctx)),
        &model,
    )
    .await;
    let error = result.as_ref().unwrap_err();
    assert!(error.contains("tokenBudgetCannotContinue"), "{error}");
    run.finish(result);
    assert_eq!(run.status, "incomplete");
    assert!(!run.published);
    assert_eq!(run.usage_tokens, 48000);
    assert_eq!(model.requests.lock().unwrap().len(), 1);
    assert!(db
        .review_events(&run.id)
        .unwrap()
        .iter()
        .any(|e| e["kind"] == "budget_exhausted" && e["detail"]["requestSent"] == false));
}

#[test]
fn native_provider_input_usage_is_optional_and_never_double_counts_cached_input() {
    for (provider_name, usage, expected) in [
        (
            "deepseek",
            json!({"usage":{"prompt_tokens":2000,"prompt_cache_hit_tokens":1500,"total_tokens":2200}}),
            2000,
        ),
        (
            "qwen",
            json!({"usage":{"prompt_tokens":2000,"total_tokens":2200}}),
            2000,
        ),
        (
            "kimi",
            json!({"usage":{"prompt_tokens":2000,"total_tokens":2200}}),
            2000,
        ),
        (
            "openai",
            json!({"usage":{"input_tokens":2000,"input_tokens_details":{"cached_tokens":1500}}}),
            2000,
        ),
        (
            "anthropic",
            json!({"usage":{"input_tokens":100,"cache_creation_input_tokens":400,"cache_read_input_tokens":1500}}),
            2000,
        ),
        (
            "gemini",
            json!({"usageMetadata":{"promptTokenCount":2000,"cachedContentTokenCount":1500}}),
            2000,
        ),
        ("ollama", json!({"prompt_eval_count":2000}), 2000),
    ] {
        assert_eq!(
            provider::input_token_usage(provider_name, &usage),
            Some(expected),
            "{provider_name}"
        );
        assert_eq!(
            provider::input_token_usage(provider_name, &json!({"usage":{"total_tokens":2000}})),
            None
        );
    }
}

// Synthetic provider usage: validates orchestration, not real-model quality or billing savings.
use crate::features::review::{model_adapter::ReviewModelAdapter, ReviewToolCall};
use std::{collections::VecDeque, future::Future, pin::Pin};

pub(super) struct PlanningModel {
    responses: Mutex<VecDeque<Value>>,
    pub requests: Mutex<Vec<Value>>,
    paging: bool,
}
impl PlanningModel {
    pub fn new(responses: Vec<Value>) -> Self {
        Self {
            responses: Mutex::new(responses.into()),
            requests: Mutex::new(vec![]),
            paging: false,
        }
    }
    pub fn paging() -> Self {
        Self {
            paging: true,
            ..Self::new(vec![])
        }
    }
}
impl ReviewModelAdapter for PlanningModel {
    fn initial_history(&self, prompt: &str) -> Vec<Value> {
        provider::initial_history("deepseek", prompt)
    }
    fn payload(&self, system: &str, history: &[Value], tools: &[Value], limit: u64) -> Value {
        let mut cfg = config("https://api.deepseek.com".into());
        cfg.provider = "deepseek".into();
        provider::payload(&cfg, system, history, tools, limit)
    }
    fn truncated_output_usage(&self, response: &Value) -> Option<u64> {
        (response["choices"][0]["finish_reason"] == "length")
            .then(|| response["usage"]["total_tokens"].as_u64().unwrap())
    }
    fn input_token_usage(&self, response: &Value) -> Option<u64> {
        provider::input_token_usage("deepseek", response)
    }
    fn request<'a>(
        &'a self,
        body: &'a Value,
    ) -> Pin<Box<dyn Future<Output = Result<Value, String>> + Send + 'a>> {
        Box::pin(async move {
            self.requests.lock().unwrap().push(body.clone());
            if !self.paging {
                return self
                    .responses
                    .lock()
                    .unwrap()
                    .pop_front()
                    .ok_or("Unexpected request".into());
            }
            let previous = body["messages"]
                .as_array()
                .unwrap()
                .iter()
                .rev()
                .find(|m| m["role"] == "tool");
            let next = previous.map(|m| {
                serde_json::from_str::<Value>(m["content"].as_str().unwrap()).unwrap()["result"]
                    ["nextOffset"]
                    .clone()
            });
            let (tool, args) = match next {
                None => ("list_open_discussions", json!({"offset":0})),
                Some(next) if next.is_u64() => ("list_open_discussions", json!({"offset":next})),
                _ => (
                    "submit_review",
                    json!({"summary":"Inspected the supplied ten-file snapshot and all six discussion roots and latest comments; no unsupported approval.","decision":"comment","findings":[]}),
                ),
            };
            Ok(response(
                tool,
                args,
                body.to_string().len().div_ceil(3) as u64,
                4500,
            ))
        })
    }
    fn decode(&self, r: &Value, h: &mut Vec<Value>) -> Result<(Vec<ReviewToolCall>, u64), String> {
        provider::decode("deepseek", r, h)
    }
    fn append_results(&self, h: &mut Vec<Value>, r: &[(ReviewToolCall, Value)]) {
        provider::append_results("deepseek", h, r)
    }
}

pub(super) fn response(name: &str, args: Value, input: u64, output: u64) -> Value {
    json!({"choices":[{"finish_reason":"tool_calls","message":{"role":"assistant","content":null,"reasoning_content":format!("Preserved reasoning for {name}"),
        "tool_calls":[{"id":uuid::Uuid::new_v4().to_string(),"type":"function","function":{"name":name,"arguments":args.to_string()}}]}}],
        "usage":{"prompt_tokens":input,"completion_tokens":output,"total_tokens":input+output}})
}

pub(super) fn add_threads(db: &Database, count: usize, body: &str) {
    for i in 0..count {
        let id = format!("discussion-{i}");
        db.conn().execute("INSERT INTO virtual_mr_discussions(id,session_id,file_path,diff_side,line_number) VALUES(?1,'session','source.rs','right',1)",[&id]).unwrap();
        for (suffix, kind) in [("root", "ai_agent"), ("latest", "user")] {
            db.conn().execute("INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES(?1,?2,?3,?4,'Fixture',?5,'now','now')",rusqlite::params![format!("{id}-{suffix}"),id,kind,suffix,body]).unwrap();
        }
    }
}

#[tokio::test]
async fn truncated_finalization_is_not_retried_when_input_reservation_cannot_expand_output() {
    let repo = TestRepo::new();
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let mut truncated = response(
        "submit_review",
        json!({"summary":"Partial output must never publish","decision":"comment","findings":[]}),
        7000,
        100,
    );
    truncated["choices"][0]["finish_reason"] = json!("length");
    let model = PlanningModel::new(vec![
        response("get_diff", json!({}), 10000, 16000),
        response("list_changed_files", json!({"offset":0}), 13000, 10000),
        truncated,
    ]);
    let result = execute_with_adapter(
        &db,
        &config("http://localhost".into()),
        &mut run,
        &Arc::new(Mutex::new(ctx)),
        &model,
    )
    .await;
    let error = result.unwrap_err();
    assert!(error.contains("providerOutputTruncated"), "{error}");
    assert_eq!(model.requests.lock().unwrap().len(), 3);
    assert_eq!(run.usage_tokens, 56100);
    assert!(!run.published);
    let events = db.review_events(&run.id).unwrap();
    assert!(events
        .iter()
        .any(|e| e["kind"] == "model_output_truncated" && e["detail"]["retry"] == false));
}

#[tokio::test]
async fn finalization_does_not_hide_a_required_description_update_or_relax_its_submission_gate() {
    let repo = TestRepo::new();
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    let mut cfg = config("http://localhost".into());
    cfg.generate_description = true;
    let final_response = response(
        "update_mr_description",
        json!({"description":"Changes to the immutable source snapshot."}),
        13000,
        500,
    );
    let model = PlanningModel::new(vec![
        response("get_diff", json!({}), 10000, 16000),
        response("list_changed_files", json!({"offset":0}), 13000, 10000),
        final_response,
    ]);
    let outcome =
        execute_with_adapter(&db, &cfg, &mut run, &Arc::new(Mutex::new(ctx)), &model).await;
    assert!(
        outcome
            .as_ref()
            .unwrap_err()
            .contains("tokenBudgetCannotContinue"),
        "{outcome:?}"
    );
    run.finish(outcome);
    assert_eq!(run.status, "incomplete");
    assert!(!run.published);
    assert!(run.generated_description.is_some());
    let requests = model.requests.lock().unwrap();
    assert_eq!(requests.len(), 3);
    assert!(requests[2]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .any(|t| t["function"]["name"] == "update_mr_description"));
    let events = db.review_events(&run.id).unwrap();
    let description = events
        .iter()
        .find(|e| e["kind"] == "description_updated")
        .unwrap()["seq"]
        .as_u64()
        .unwrap();
    let finalizing = events
        .iter()
        .find(|e| e["kind"] == "budget_finalization")
        .unwrap()["seq"]
        .as_u64()
        .unwrap();
    assert!(description < finalizing);
}

#[tokio::test]
async fn reply_only_budget_planning_keeps_reply_tools_instead_of_forcing_a_silent_completion() {
    let (_repo, mut run, context, db) = super::discussion_fixture::setup("Original finding");
    let mut cfg = config("http://localhost".into());
    cfg.reviewer_id = Some("bot".into());
    cfg.reply_discussion_id = Some("thread".into());
    let model = PlanningModel::new(vec![
        response("list_open_discussions", json!({"offset":0}), 3000, 10000),
        response(
            "get_file_diff",
            json!({"filePath":"source.rs","offset":0}),
            5000,
            4000,
        ),
        response(
            "submit_review",
            json!({"summary":"No useful answer needed for this fixture's acknowledgement","decision":"comment","findings":[]}),
            5000,
            200,
        ),
    ]);
    let outcome = execute_with_adapter(&db, &cfg, &mut run, &context, &model).await;
    assert!(outcome.is_ok(), "{outcome:?}");
    let requests = model.requests.lock().unwrap();
    assert_eq!(requests.len(), 3);
    assert!(requests[2]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .any(|t| t["function"]["name"] == "reply_to_discussion"));
    assert!(!db
        .review_events(&run.id)
        .unwrap()
        .iter()
        .any(|e| e["kind"] == "budget_finalization"));
}
