use super::auth::{sanitize_agent_info, sanitize_auth_method, sanitize_auth_status};
use super::review_config::filter_review_config_options;
use super::validate_review_config_overrides;
use serde_json::json;

#[cfg(unix)]
#[tokio::test]
async fn review_transport_preserves_agent_error_text_and_stop_reason() {
    // A local ACP fixture reproduces the actual Codex bridge behavior:
    // the provider error arrives as agent_message_chunk + end_turn.
    let script = r#"
while IFS= read -r request; do
  case "$request" in
*'"method":"initialize"'*)
  printf '%s\n' '{"jsonrpc":"2.0","id":0,"result":{"protocolVersion":1}}' ;;
*'"method":"session/new"'*)
  printf '%s\n' '{"jsonrpc":"2.0","id":1,"result":{"sessionId":"fixture"}}' ;;
*'"method":"session/prompt"'*)
  printf '%s\n' '{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"fixture","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"exceeded retry limit, last status: 429 Too Many Requests"}}}}' ;
  printf '%s\n' '{"jsonrpc":"2.0","id":2,"result":{"stopReason":"end_turn"}}' ;;
  esac
done
"#.lines().map(str::trim).collect::<Vec<_>>().join(" ");
    let config = super::AcpAgentConfig {
        id: "fixture".into(),
        name: "Fixture".into(),
        version: None,
        description: None,
        source: "custom".into(),
        command: "/bin/sh".into(),
        launch_mode: None,
        args: vec!["-c".into(), script.into()],
    };
    let mut session = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        super::AcpAgentReviewSession::start(&config, &serde_json::Value::Null),
    )
    .await
    .unwrap()
    .unwrap();
    let response = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        session.prompt_turn(&json!({"history":[]})),
    )
    .await
    .unwrap()
    .unwrap();
    assert_eq!(response["stopReason"], "end_turn");
    assert_eq!(
        response["output"],
        "exceeded retry limit, last status: 429 Too Many Requests"
    );
    session.close().await;
}

#[test]
fn auth_status_exposes_only_bounded_account_identity_fields() {
    let status = sanitize_auth_status(&json!({
        "kind": "account",
        "label": "ChatGPT Plus",
        "detail": "Primary account",
        "account": {
            "email": "person@example.com",
            "organization": "Example",
            "plan": "plus",
            "accessToken": "must-not-escape"
        },
        "vendor": {"refreshToken": "must-not-escape"}
    }));

    assert_eq!(
        status.unwrap(),
        json!({
            "kind": "account",
            "label": "ChatGPT Plus",
            "detail": "Primary account",
            "account": {
                "email": "person@example.com",
                "organization": "Example",
                "plan": "plus"
            }
        })
    );
}

#[test]
fn auth_methods_and_agent_info_drop_unneeded_or_secret_fields() {
    let method = sanitize_auth_method(&json!({
        "id": "chatgpt",
        "name": "Sign in with ChatGPT",
        "description": "Use account login",
        "type": "agent",
        "env": {"TOKEN": "must-not-escape"}
    }));
    assert_eq!(
        method.unwrap(),
        json!({
            "id": "chatgpt",
            "name": "Sign in with ChatGPT",
            "description": "Use account login",
            "type": "agent"
        })
    );

    let agent = sanitize_agent_info(&json!({
        "name": "codex-acp",
        "title": "Codex",
        "version": "2.2.2",
        "token": "must-not-escape"
    }));
    assert_eq!(
        agent.unwrap(),
        json!({"name":"codex-acp","title":"Codex","version":"2.2.2"})
    );
}

#[test]
fn reviewer_config_discovery_keeps_model_reasoning_and_fast_mode_only() {
    let options = filter_review_config_options(&[
        json!({"id":"model","name":"Model","category":"model","type":"select","currentValue":"gpt-6-luna","options":[{"group":"recommended","name":"Recommended","options":[{"value":"gpt-6-luna","name":"GPT-6 Luna"}]}]}),
        json!({"id":"reasoning_effort","name":"Reasoning effort","category":"thought_level","type":"select","currentValue":"high","options":[{"value":"high","name":"High"}]}),
        json!({"id":"fast-mode","name":"Fast mode","category":"model_config","type":"boolean","currentValue":false}),
        json!({"id":"mode","name":"Permission mode","category":"mode","type":"select","currentValue":"ask","options":[{"value":"ask","name":"Ask"}]}),
    ]);

    assert_eq!(options.len(), 3);
    assert_eq!(options[0]["reviewKind"], "model");
    assert_eq!(options[0]["options"][0]["name"], "Recommended · GPT-6 Luna");
    assert_eq!(options[1]["reviewKind"], "reasoning");
    assert_eq!(options[2]["reviewKind"], "fastMode");
}

#[test]
fn reviewer_config_overrides_are_bounded_and_typed() {
    assert!(
        validate_review_config_overrides(&json!({"model":"gpt-6-luna","fast-mode":true})).is_ok()
    );
    assert!(validate_review_config_overrides(&json!(["not an object"])).is_err());
    assert!(validate_review_config_overrides(&json!({"model":["bad value"]})).is_err());
}
