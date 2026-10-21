use super::{process::AcpProcess, AcpAgentConfig};
use serde_json::{json, Value};
use std::time::Duration;
use tauri::command;

const AUTH_STATUS_WAIT: Duration = Duration::from_secs(5);

#[command]
pub async fn acp_agent_auth_methods(config: AcpAgentConfig) -> Result<Vec<Value>, String> {
    let mut process = AcpProcess::start(&config, None).await?;
    let result = process.initialize().await;
    process.close().await;
    let initialized = result?;
    Ok(initialized
        .get("authMethods")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default())
}

#[command]
pub async fn acp_agent_connection_info(config: AcpAgentConfig) -> Result<Value, String> {
    let mut process = AcpProcess::start(&config, None).await?;
    let result = async {
        let initialized = process.initialize().await?;
        let supports_auth_status = initialized
            .pointer("/agentCapabilities/_meta/authStatus")
            .is_some();
        let auth_methods = initialized
            .get("authMethods")
            .and_then(Value::as_array)
            .map(|methods| {
                methods
                    .iter()
                    .filter_map(sanitize_auth_method)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let agent_info = initialized
            .get("agentInfo")
            .or_else(|| initialized.get("implementation"))
            .and_then(sanitize_agent_info);
        let auth_status = if supports_auth_status {
            process.wait_for_auth_status(AUTH_STATUS_WAIT).await?
        } else {
            process.auth_status.clone()
        };

        Ok(json!({
            "authMethods": auth_methods,
            "authStatus": auth_status,
            "supportsAuthStatus": supports_auth_status,
            "agentInfo": agent_info,
        }))
    }
    .await;
    process.close().await;
    result
}

fn bounded_agent_text(value: &Value, limit: usize) -> Option<String> {
    let text = value
        .as_str()?
        .chars()
        .filter(|character| !character.is_control())
        .take(limit)
        .collect::<String>()
        .trim()
        .to_owned();
    (!text.is_empty()).then_some(text)
}

pub(super) fn sanitize_auth_status(value: &Value) -> Option<Value> {
    let kind = bounded_agent_text(value.get("kind")?, 40)?;
    let label = bounded_agent_text(value.get("label")?, 160)?;
    let mut result = serde_json::Map::new();
    result.insert("kind".into(), Value::String(kind));
    result.insert("label".into(), Value::String(label));

    if let Some(detail) = value
        .get("detail")
        .and_then(|detail| bounded_agent_text(detail, 240))
    {
        result.insert("detail".into(), Value::String(detail));
    }

    if let Some(account) = value.get("account").and_then(Value::as_object) {
        let mut safe_account = serde_json::Map::new();
        for (key, limit) in [("email", 254), ("organization", 160), ("plan", 80)] {
            if let Some(text) = account
                .get(key)
                .and_then(|field| bounded_agent_text(field, limit))
            {
                safe_account.insert(key.into(), Value::String(text));
            }
        }
        if !safe_account.is_empty() {
            result.insert("account".into(), Value::Object(safe_account));
        }
    }

    Some(Value::Object(result))
}

pub(super) fn sanitize_auth_method(value: &Value) -> Option<Value> {
    let id = bounded_agent_text(value.get("id")?, 200)?;
    let mut result = serde_json::Map::new();
    result.insert("id".into(), Value::String(id));
    for (key, limit) in [("name", 160), ("description", 400), ("type", 40)] {
        if let Some(text) = value
            .get(key)
            .and_then(|field| bounded_agent_text(field, limit))
        {
            result.insert(key.into(), Value::String(text));
        }
    }
    Some(Value::Object(result))
}

pub(super) fn sanitize_agent_info(value: &Value) -> Option<Value> {
    let mut result = serde_json::Map::new();
    for (key, limit) in [("name", 120), ("title", 120), ("version", 80)] {
        if let Some(text) = value
            .get(key)
            .and_then(|field| bounded_agent_text(field, limit))
        {
            result.insert(key.into(), Value::String(text));
        }
    }
    (!result.is_empty()).then_some(Value::Object(result))
}

#[command]
pub async fn acp_agent_authenticate(
    config: AcpAgentConfig,
    method_id: String,
) -> Result<Value, String> {
    if method_id.trim().is_empty() || method_id.len() > 200 {
        return Err("Invalid ACP authentication method".into());
    }
    let mut process = AcpProcess::start(&config, None).await?;
    let result = async {
        let initialized = process.initialize().await?;
        let methods = initialized.get("authMethods").and_then(Value::as_array).ok_or("This agent does not offer ACP sign-in")?;
        let method = methods.iter().find(|method| method.get("id").and_then(Value::as_str) == Some(method_id.as_str()))
            .ok_or("The selected authentication method is no longer available")?;
        if method.get("type").and_then(Value::as_str).unwrap_or("agent") != "agent" {
            return Err("This login method requires an interactive terminal, which this client does not advertise".into());
        }
        process.request(1, "authenticate", json!({"methodId":method_id})).await?;
        Ok(json!({"authStatus": process.auth_status.clone()}))
    }.await;
    process.close().await;
    result
}
