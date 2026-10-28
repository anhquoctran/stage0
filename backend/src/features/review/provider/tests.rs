use super::*;
use crate::features::review::ReviewRequest;
use serde_json::{json, Value};
fn config(provider: &str, url: &str) -> ReviewRequest {
    ReviewRequest {
        session_id: "s".into(),
        provider: provider.into(),
        auth_mode: "api_key".into(),
        model: "fixture-model".into(),
        reasoning_effort: None,
        fast_mode: false,
        execution_mode: "provider".into(),
        acp_agent: None,
        acp_config_options: None,
        reviewer_id: None,
        reviewer_name: None,
        reply_discussion_id: None,
        manual_review_discussion_id: None,
        reviewer_role: None,
        base_url: url.into(),
        instructions: String::new(),
        allow_remote: true,
        generate_description: false,
        agent_output_language: "en".into(),
    }
}
#[test]
fn endpoints_require_explicit_consent_and_do_not_send_provider_keys_to_arbitrary_hosts() {
    let mut cfg = config("openai", "https://api.openai.com/v1");
    assert!(endpoint(&cfg).unwrap().ends_with("/responses"));
    cfg.allow_remote = false;
    assert!(endpoint(&cfg).is_err());
    cfg.allow_remote = true;
    for url in [
        "https://attacker.example/v1",
        "https://api.openai.com.attacker.example/v1",
        "https://user:pass@api.openai.com/v1",
        "http://api.openai.com/v1",
    ] {
        cfg.base_url = url.into();
        assert!(endpoint(&cfg).is_err());
    }
    assert!(endpoint(&config("ollama", "http://localhost:11434")).is_ok());
    assert!(endpoint(&config("ollama", "https://remote.example")).is_err());
    let mut cli = config("anthropic", "https://api.anthropic.com/v1");
    cli.auth_mode = "cli_bridge".into();
    assert!(endpoint(&cli).is_err());
}
#[test]
fn codecs_preserve_call_ids_and_native_reasoning_signatures() {
    let fixtures = [
        (
            "openai",
            json!({"status":"completed","output":[{"type":"reasoning","encrypted_content":"opaque-signature"},{"type":"function_call","call_id":"call-1","name":"get_diff","arguments":"{}"}],"usage":{"total_tokens":12}}),
        ),
        (
            "anthropic",
            json!({"stop_reason":"tool_use","content":[{"type":"thinking","thinking":"fixture","signature":"opaque-signature"},{"type":"tool_use","id":"call-1","name":"get_diff","input":{}}]}),
        ),
        (
            "gemini",
            json!({"candidates":[{"finishReason":"STOP","content":{"role":"model","parts":[{"thoughtSignature":"opaque-signature","functionCall":{"id":"call-1","name":"get_diff","args":{}}}]}}]}),
        ),
        (
            "custom",
            json!({"choices":[{"finish_reason":"tool_calls","message":{"role":"assistant","content":null,"tool_calls":[{"id":"call-1","type":"function","function":{"name":"get_diff","arguments":"{}"}}]}}]}),
        ),
        (
            "ollama",
            json!({"done":true,"message":{"role":"assistant","tool_calls":[{"function":{"name":"get_diff","arguments":{}}}]}}),
        ),
    ];
    for (provider, response) in fixtures {
        let mut history = initial_history(provider, "fixture");
        let (calls, _) = decode(provider, &response, &mut history).unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].name, "get_diff");
        if provider != "ollama" {
            assert_eq!(calls[0].id, "call-1");
        }
        append_results(
            provider,
            &mut history,
            &[(
                calls[0].clone(),
                json!({"isError":false,"result":"fixture"}),
            )],
        );
        let serialized = serde_json::to_string(&history).unwrap();
        if ["openai", "anthropic", "gemini"].contains(&provider) {
            assert!(serialized.contains("opaque-signature"));
        }
        assert!(serialized.contains("fixture"));
    }
}
#[test]
fn truncation_malformed_arguments_and_duplicate_ids_fail_closed() {
    for response in [
        json!({"status":"incomplete","output":[]}),
        json!({"status":"completed","output":[{"type":"function_call","status":"in_progress","call_id":"1","name":"get_diff","arguments":"{}"}]}),
        json!({"status":"completed","output":[{"type":"function_call","call_id":"1","name":"get_diff","arguments":"{"}]}),
        json!({"status":"completed","output":[{"type":"function_call","call_id":"1","name":"get_diff","arguments":"{}"},{"type":"function_call","call_id":"1","name":"get_diff","arguments":"{}"}]}),
    ] {
        assert!(decode("openai", &response, &mut vec![]).is_err());
    }
    let tools = super::super::schemas::tools();
    for provider in ["openai", "anthropic", "gemini", "ollama", "custom"] {
        let request = payload(
            &config(provider, "http://localhost"),
            "policy",
            &initial_history(provider, "fixture"),
            &tools,
            2048,
        );
        assert!(request.to_string().contains("submit_review"));
        assert!(!request.to_string().contains("execute_terminal_cmd"));
    }
}
#[test]
fn tool_call_policy_matches_the_configured_provider_and_model() {
    let tools = super::super::schemas::tools();
    let cfg = config("openai", "https://api.openai.com/v1");
    let request = payload(
        &cfg,
        "policy",
        &initial_history("openai", "fixture"),
        &tools,
        2048,
    );
    assert_eq!(request["tool_choice"], "required");
    assert_eq!(request["parallel_tool_calls"], false);
    assert!(request["tools"]
        .as_array()
        .is_some_and(|tools| !tools.is_empty()));

    let mut legacy_anthropic = config("anthropic", "https://api.anthropic.com/v1");
    legacy_anthropic.model = "claude-haiku-4-5-20251001".into();
    let legacy = payload(&legacy_anthropic, "policy", &[], &tools, 2048);
    assert_eq!(legacy["tool_choice"]["type"], "any");
    assert_eq!(legacy["tool_choice"]["disable_parallel_tool_use"], true);

    let mut frontier_anthropic = legacy_anthropic;
    frontier_anthropic.model = "claude-opus-5-5".into();
    let frontier = payload(&frontier_anthropic, "policy", &[], &tools, 2048);
    assert_eq!(frontier["tool_choice"]["type"], "auto");

    let gemini = payload(
        &config("gemini", "https://generativelanguage.googleapis.com/v1beta"),
        "policy",
        &[],
        &tools,
        2048,
    );
    assert_eq!(gemini["toolConfig"]["functionCallingConfig"]["mode"], "ANY");

    for provider in ["custom", "xai_grok"] {
        let openai_compatible = payload(
            &config(provider, "https://provider.example/v1"),
            "policy",
            &[],
            &tools,
            2048,
        );
        assert_eq!(openai_compatible["tool_choice"], "required");
        assert_eq!(openai_compatible["parallel_tool_calls"], false);
    }

    let ollama = payload(
        &config("ollama", "http://localhost:11434"),
        "policy",
        &[],
        &tools,
        2048,
    );
    assert!(ollama.get("tool_choice").is_none());
}
#[test]
fn gemini_native_ids_are_echoed_exactly_even_with_fallback_like_prefixes() {
    for id in [Some("gemini-actual-provider-id"), None] {
        let mut call = json!({"name":"get_diff","args":{}});
        if let Some(id) = id {
            call["id"] = json!(id);
        }
        let response = json!({"candidates":[{"finishReason":"STOP","content":{"role":"model","parts":[{"thoughtSignature":"opaque","functionCall":call}]}}]});
        let mut history = initial_history("gemini", "fixture");
        let (calls, _) = decode("gemini", &response, &mut history).unwrap();
        append_results(
            "gemini",
            &mut history,
            &[(calls[0].clone(), json!({"result":"fixture"}))],
        );
        let result = &history.last().unwrap()["parts"][0]["functionResponse"];
        assert_eq!(result.get("id").and_then(Value::as_str), id);
    }
    assert!(decode("custom",&json!({"choices":[{"finish_reason":"tool_calls","message":{"role":"assistant","tool_calls":[{"function":{"name":"get_diff","arguments":"{}"}}]}}]}),&mut vec![]).is_err());
}
