//! Release contracts use the serialized request, so optional fields can grow
//! without weakening old-provider behavior or depending on struct literals.
use super::*;
use crate::features::review::ReviewRequest;
use serde_json::json;

fn request() -> ReviewRequest {
    serde_json::from_value(json!({
        "sessionId":"regression", "provider":"deepseek", "authMode":"api_key",
        "model":"deepseek-flash", "reasoningEffort":"high", "fastMode":false,
        "executionMode":"provider", "baseUrl":"https://api.deepseek.com",
        "instructions":"", "allowRemote":true, "generateDescription":false
    }))
    .unwrap()
}

#[test]
fn deepseek_thinking_continuations_keep_reasoning_and_matching_tool_results() {
    let mut cfg = request();
    let tools = super::super::schemas::tools();
    for effort in [None, Some("high")] {
        cfg.reasoning_effort = effort.map(str::to_string);
        assert_eq!(
            payload(&cfg, "policy", &[], &tools, 2048)["tool_choice"],
            "auto"
        );
    }
    let response = json!({"choices":[{"finish_reason":"tool_calls","message":{
        "role":"assistant","content":null,"reasoning_content":"reasoning",
        "tool_calls":[{"id":"call-1","type":"function","function":{"name":"get_diff","arguments":"{}"}}]
    }}]});
    let mut history = initial_history("deepseek", "fixture");
    let (calls, _) = decode("deepseek", &response, &mut history).unwrap();
    append_results(
        "deepseek",
        &mut history,
        &[(calls[0].clone(), json!({"result":"ok"}))],
    );
    let body = payload(&cfg, "policy", &history, &tools, 2048);
    assert_eq!(body["messages"][2]["reasoning_content"], "reasoning");
    assert_eq!(body["messages"][3]["tool_call_id"], "call-1");
}

#[test]
fn truncated_refused_or_interrupted_responses_never_publish_or_modify_history() {
    for (reason, code) in [
        ("length", "backend.review.providerOutputTruncated"),
        (
            "content_filter",
            "backend.review.providerResponseRefusedOrTruncated",
        ),
        (
            "insufficient_system_resource",
            "backend.ai.providerUnavailable",
        ),
        ("aborted", "backend.ai.providerInterrupted"),
    ] {
        let mut history = initial_history("deepseek", "fixture");
        let original = history.clone();
        let response = json!({"choices":[{"finish_reason":reason,"message":{"role":"assistant","content":"incomplete"}}]});
        assert!(decode("deepseek", &response, &mut history)
            .unwrap_err()
            .contains(code));
        assert_eq!(history, original);
    }
}
