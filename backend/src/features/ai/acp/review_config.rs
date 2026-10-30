use super::{validate_review_config_overrides, AcpAgentConfig, AcpProcess};
use serde_json::{json, Value};
use std::time::Duration;
use tauri::command;

const REVIEW_CONFIG_DISCOVERY_TIMEOUT: Duration = Duration::from_secs(45);

#[command]
pub async fn acp_agent_review_config_options(
    config: AcpAgentConfig,
    config_overrides: Option<Value>,
) -> Result<Vec<Value>, String> {
    let result: Result<_, String> = async {
        let working_directory =
            std::env::temp_dir().join(format!("stage0-acp-config-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&working_directory)
            .map_err(|_| "Could not create an isolated ACP configuration directory")?;
        let mut process = match tokio::time::timeout(
            REVIEW_CONFIG_DISCOVERY_TIMEOUT,
            AcpProcess::start(&config, Some(&working_directory)),
        )
        .await
        {
            Ok(Ok(process)) => process,
            Ok(Err(error)) => {
                let _ = std::fs::remove_dir_all(&working_directory);
                return Err(error);
            }
            Err(_) => {
                let _ = std::fs::remove_dir_all(&working_directory);
                return Err("ACP agent startup timed out while loading reviewer options.".into());
            }
        };
        let result = tokio::time::timeout(REVIEW_CONFIG_DISCOVERY_TIMEOUT, async {
            process.initialize().await?;
            let session = process
                .request(
                    1,
                    "session/new",
                    json!({
                        "cwd": working_directory.to_string_lossy(),
                        "mcpServers": []
                    }),
                )
                .await?;
            let session_id = session
                .get("sessionId")
                .and_then(Value::as_str)
                .ok_or("ACP agent did not return a session ID")?;
            let mut options = session
                .get("configOptions")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            if let Some(overrides) = config_overrides.as_ref() {
                validate_review_config_overrides(overrides)?;
                if let Some(overrides) = overrides.as_object() {
                    options =
                        apply_review_config_options(&mut process, session_id, &options, overrides)
                            .await?;
                }
            }
            Ok(filter_review_config_options(&options))
        })
        .await;
        let result = match result {
            Ok(result) => result,
            Err(_) => Err("ACP agent did not return reviewer options within 45 seconds.".into()),
        };
        process.close().await;
        let _ = std::fs::remove_dir_all(&working_directory);
        result
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("ai", error))
}

pub(super) fn filter_review_config_options(options: &[Value]) -> Vec<Value> {
    options
        .iter()
        .filter_map(|option| {
            let id = option.get("id").and_then(Value::as_str)?;
            let name = option.get("name").and_then(Value::as_str)?;
            let kind = review_config_option_kind(option)?;
            let option_type = option.get("type").and_then(Value::as_str)?;
            let current_value = option.get("currentValue")?;
            let supported_type = match option_type {
                "select" => {
                    current_value.is_string()
                        && option.get("options").and_then(Value::as_array).is_some()
                }
                "boolean" => current_value.is_boolean(),
                _ => false,
            };
            if !supported_type || id.len() > 128 || name.len() > 160 {
                return None;
            }
            let mut normalized = json!({
                "id": id,
                "name": name,
                "type": option_type,
                "currentValue": current_value,
                "reviewKind": kind,
            });
            if let Some(description) = option
                .get("description")
                .and_then(Value::as_str)
                .filter(|text| text.len() <= 500)
            {
                normalized["description"] = Value::String(description.to_owned());
            }
            if let Some(category) = option
                .get("category")
                .and_then(Value::as_str)
                .filter(|text| text.len() <= 80)
            {
                normalized["category"] = Value::String(category.to_owned());
            }
            if option_type == "select" {
                normalized["options"] = Value::Array(flatten_config_option_values(
                    option
                        .get("options")
                        .and_then(Value::as_array)
                        .map(Vec::as_slice)
                        .unwrap_or(&[]),
                ));
            }
            Some(normalized)
        })
        .collect()
}

fn flatten_config_option_values(options: &[Value]) -> Vec<Value> {
    let mut values = Vec::new();
    for option in options {
        if let Some(group_options) = option.get("options").and_then(Value::as_array) {
            let group_name = option.get("name").and_then(Value::as_str).unwrap_or("");
            for value in group_options {
                if let Some(value) = sanitize_config_option_value(value, group_name) {
                    values.push(value);
                }
            }
        } else if let Some(value) = sanitize_config_option_value(option, "") {
            values.push(value);
        }
        if values.len() >= 200 {
            break;
        }
    }
    values
}

fn sanitize_config_option_value(option: &Value, group_name: &str) -> Option<Value> {
    let value = option.get("value").and_then(Value::as_str)?;
    let name = option.get("name").and_then(Value::as_str)?;
    if value.len() > 256 || name.len() > 160 {
        return None;
    }
    let name = if group_name.is_empty() {
        name.to_owned()
    } else {
        format!("{group_name} · {name}")
    };
    let mut sanitized = json!({"value":value,"name":name});
    if let Some(description) = option
        .get("description")
        .and_then(Value::as_str)
        .filter(|text| text.len() <= 500)
    {
        sanitized["description"] = Value::String(description.to_owned());
    }
    Some(sanitized)
}

fn review_config_option_kind(option: &Value) -> Option<&'static str> {
    let category = option.get("category").and_then(Value::as_str).unwrap_or("");
    let id = option
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_ascii_lowercase();
    let name = option
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_ascii_lowercase();
    match category {
        "model" => Some("model"),
        "thought_level" => Some("reasoning"),
        "model_config" if id.contains("fast") || name.contains("fast mode") => Some("fastMode"),
        _ if matches!(
            id.as_str(),
            "reasoning_effort" | "reasoning-effort" | "thought_level"
        ) =>
        {
            Some("reasoning")
        }
        _ if matches!(id.as_str(), "fast_mode" | "fast-mode" | "fastmode")
            || name == "fast mode" =>
        {
            Some("fastMode")
        }
        _ => None,
    }
}

fn config_option_value_is_valid(option: &Value, value: &Value) -> bool {
    match option.get("type").and_then(Value::as_str) {
        Some("boolean") => value.is_boolean(),
        Some("select") => value.as_str().is_some_and(|value| {
            option
                .get("options")
                .and_then(Value::as_array)
                .is_some_and(|options| {
                    options
                        .iter()
                        .any(|item| item.get("value").and_then(Value::as_str) == Some(value))
                })
        }),
        _ => false,
    }
}

pub(super) async fn apply_review_config_options(
    process: &mut AcpProcess,
    session_id: &str,
    initial_options: &[Value],
    overrides: &serde_json::Map<String, Value>,
) -> Result<Vec<Value>, String> {
    let mut current_options = initial_options.to_vec();
    let mut requested: Vec<_> = overrides.iter().collect();
    requested.sort_by_key(|(id, _)| {
        let option = current_options
            .iter()
            .find(|option| option.get("id").and_then(Value::as_str) == Some(id.as_str()));
        match option.and_then(review_config_option_kind) {
            Some("model") => 0,
            Some("reasoning") => 1,
            Some("fastMode") => 2,
            _ => 3,
        }
    });
    // Keep config requests separate from the review prompt IDs starting at 2.
    let mut request_id = 1_000_000;
    for (config_id, value) in requested {
        let option = current_options.iter().find(|option| option.get("id").and_then(Value::as_str) == Some(config_id.as_str()))
            .filter(|option| review_config_option_kind(option).is_some())
            .ok_or_else(|| format!("ACP reviewer option “{config_id}” is no longer available. Update the reviewer profile."))?;
        if !config_option_value_is_valid(option, value) {
            return Err(format!("Saved ACP reviewer value for “{config_id}” is no longer supported. Update the reviewer profile."));
        }
        let mut params = json!({"sessionId":session_id,"configId":config_id,"value":value});
        if option.get("type").and_then(Value::as_str) == Some("boolean") {
            params["type"] = Value::String("boolean".into());
        }
        let updated = process
            .request(request_id, "session/set_config_option", params)
            .await?;
        request_id = request_id.saturating_add(1);
        if let Some(options) = updated.get("configOptions").and_then(Value::as_array) {
            current_options = options.clone();
        }
    }
    Ok(current_options)
}
