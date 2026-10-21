use crate::features::review::ReviewToolCall;
use serde_json::{json, Value};

pub fn decode(
    provider: &str,
    response: &Value,
    history: &mut Vec<Value>,
) -> Result<(Vec<ReviewToolCall>, u64), String> {
    let mut calls = Vec::new();
    match provider {
        "openai" => {
            if response["status"] != "completed" {
                return Err("Provider response was incomplete, refused or truncated".into());
            }
            let output = response["output"]
                .as_array()
                .ok_or("Missing response output")?;
            for item in output {
                if item["type"] == "function_call" {
                    if item
                        .get("status")
                        .is_some_and(|status| status != "completed")
                    {
                        return Err("Provider returned an unfinished function call".into());
                    }
                    calls.push(ReviewToolCall {
                        id: text(item, "call_id")?,
                        native_id: Some(text(item, "call_id")?),
                        name: text(item, "name")?,
                        arguments: parse_arguments(&item["arguments"])?,
                    });
                }
                history.push(item.clone());
            }
        }
        "anthropic" => {
            if !matches!(
                response["stop_reason"].as_str(),
                Some("end_turn" | "tool_use")
            ) {
                return Err("Provider response was refused or truncated".into());
            }
            let content = response["content"]
                .as_array()
                .ok_or("Missing Claude content")?;
            for item in content {
                if item["type"] == "tool_use" {
                    calls.push(ReviewToolCall {
                        id: text(item, "id")?,
                        native_id: Some(text(item, "id")?),
                        name: text(item, "name")?,
                        arguments: item["input"].clone(),
                    });
                }
            }
            history.push(json!({"role":"assistant","content":content}));
        }
        "gemini" => {
            let candidate = response["candidates"]
                .get(0)
                .ok_or("No Gemini candidate (possibly blocked)")?;
            if candidate["finishReason"] != "STOP" {
                return Err("Gemini response was blocked or truncated".into());
            }
            let parts = candidate["content"]["parts"]
                .as_array()
                .ok_or("Missing Gemini parts")?;
            for (i, item) in parts.iter().enumerate() {
                if let Some(call) = item.get("functionCall") {
                    calls.push(ReviewToolCall {
                        id: call["id"]
                            .as_str()
                            .map(str::to_string)
                            .unwrap_or_else(|| format!("gemini-{i}")),
                        native_id: call["id"].as_str().map(str::to_string),
                        name: text(call, "name")?,
                        arguments: call["args"].clone(),
                    });
                }
            }
            // Retain original parts, including thought signatures, for continuation.
            history.push(candidate["content"].clone());
        }
        _ => {
            let message = if provider == "ollama" {
                &response["message"]
            } else {
                let choice = response["choices"].get(0).ok_or("No completion choice")?;
                if !matches!(
                    choice["finish_reason"].as_str(),
                    Some("stop" | "tool_calls")
                ) {
                    return Err("Provider response was refused or truncated".into());
                }
                &choice["message"]
            };
            if !message.is_object() {
                return Err("Missing assistant message".into());
            }
            if provider == "ollama"
                && (response["done"] != true || response["done_reason"] == "length")
            {
                return Err("Local response was incomplete or truncated".into());
            }
            if let Some(items) = message["tool_calls"].as_array() {
                for (i, item) in items.iter().enumerate() {
                    calls.push(ReviewToolCall {
                        id: if provider == "ollama" {
                            item["id"]
                                .as_str()
                                .map(str::to_string)
                                .unwrap_or_else(|| format!("local-{i}"))
                        } else {
                            text(item, "id")?
                        },
                        native_id: item["id"].as_str().map(str::to_string),
                        name: text(&item["function"], "name")?,
                        arguments: parse_arguments(&item["function"]["arguments"])?,
                    });
                }
            }
            history.push(message.clone());
        }
    }
    if calls.len() > 8
        || calls.iter().any(|c| {
            c.id.is_empty() || c.id.len() > 200 || c.name.len() > 100 || !c.arguments.is_object()
        })
    {
        return Err("Invalid or excessive tool calls".into());
    }
    let mut ids = std::collections::HashSet::new();
    if calls.iter().any(|c| !ids.insert(c.id.clone())) {
        return Err("Duplicate tool call IDs".into());
    }
    let usage = response["usage"]["total_tokens"]
        .as_u64()
        .or_else(|| response["usageMetadata"]["totalTokenCount"].as_u64())
        .unwrap_or_else(|| {
            response["usage"]["input_tokens"]
                .as_u64()
                .unwrap_or(0)
                .saturating_add(response["usage"]["output_tokens"].as_u64().unwrap_or(0))
                .saturating_add(response["prompt_eval_count"].as_u64().unwrap_or(0))
                .saturating_add(response["eval_count"].as_u64().unwrap_or(0))
        });
    Ok((calls, usage))
}

fn text(value: &Value, key: &str) -> Result<String, String> {
    value[key]
        .as_str()
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .ok_or_else(|| format!("Missing tool {key}"))
}
fn parse_arguments(value: &Value) -> Result<Value, String> {
    if let Some(s) = value.as_str() {
        serde_json::from_str(s).map_err(|_| "Invalid tool argument JSON".into())
    } else {
        Ok(value.clone())
    }
}
