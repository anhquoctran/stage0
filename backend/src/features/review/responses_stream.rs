use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

/// Reconstruct completed output items before decoding tool calls. A streaming
/// response can deliver its output in item events and leave the terminal
/// response's output empty. Partial deltas never authorize a tool invocation.
pub(super) fn decode(bytes: &[u8]) -> Result<Value, String> {
    let stream =
        std::str::from_utf8(bytes).map_err(|_| "ChatGPT returned an invalid event stream")?;
    let normalized = stream.replace("\r\n", "\n");
    let mut items = BTreeMap::new();
    let mut started = BTreeSet::new();
    for frame in normalized.split("\n\n") {
        let data = frame
            .lines()
            .filter_map(|line| line.strip_prefix("data:"))
            .map(str::trim_start)
            .collect::<Vec<_>>()
            .join("\n");
        if data.is_empty() || data == "[DONE]" {
            continue;
        }
        let event: Value = serde_json::from_str(&data)
            .map_err(|_| "ChatGPT returned an invalid event in the response stream")?;
        match event["type"].as_str().unwrap_or_default() {
            "response.output_item.added" => {
                started.insert(output_index(&event)?);
            }
            "response.output_item.done" => {
                let index = output_index(&event)?;
                let item = event
                    .get("item")
                    .filter(|item| item.is_object() && item["type"].is_string())
                    .ok_or("ChatGPT returned an invalid completed output item")?;
                if items.get(&index).is_some_and(|previous| previous != item) {
                    return Err("ChatGPT returned conflicting completed output items".into());
                }
                items.insert(index, item.clone());
            }
            "response.completed" => {
                let mut response = event
                    .get("response")
                    .filter(|response| response.is_object())
                    .cloned()
                    .ok_or("ChatGPT completed without a response payload")?;
                if response["status"] != "completed" {
                    return Err("ChatGPT response was incomplete, refused or truncated".into());
                }
                let terminal_items = match response.get("output") {
                    Some(Value::Array(output)) => output.clone(),
                    None | Some(Value::Null) => Vec::new(),
                    _ => return Err("ChatGPT returned an invalid response output".into()),
                };
                let streamed_count = items.len();
                let terminal_count = terminal_items.len();
                for (index, item) in terminal_items.into_iter().enumerate() {
                    if let Some(streamed) = items.get(&index) {
                        // Use the final item event (including opaque reasoning
                        // signatures), but reject contradictory call identities.
                        for key in ["id", "type", "call_id", "name", "arguments"] {
                            if let (Some(left), Some(right)) = (streamed.get(key), item.get(key)) {
                                if left != right {
                                    return Err(
                                        "ChatGPT returned conflicting response output".into()
                                    );
                                }
                            }
                        }
                    } else {
                        items.insert(index, item);
                    }
                }
                if started.iter().any(|index| !items.contains_key(index))
                    || items.keys().copied().ne(0..items.len())
                {
                    return Err(
                        "ChatGPT completed with unfinished output items; the review is incomplete."
                            .into(),
                    );
                }
                response["output"] = Value::Array(items.into_values().collect());
                // Counts only; never persist raw streamed source or reasoning.
                response["_stage0Stream"] = json!({
                    "completedOutputItems":streamed_count,
                    "terminalOutputItems":terminal_count
                });
                return Ok(response);
            }
            "response.failed" | "error" => {
                let code = event["response"]["error"]["code"]
                    .as_str()
                    .or(event["error"]["code"].as_str())
                    .unwrap_or("request_failed");
                return Err(match code {
                    "subscription_sharing_usage_limit_exceeded"
                    | "subscription_sharing_usage_unavailable" => {
                        "ChatGPT plan usage is currently unavailable or its usage limit was reached. Check the account's plan limits and retry later.".into()
                    }
                    _ => format!("ChatGPT subscription inference failed ({code}). Check model access and account settings."),
                });
            }
            "response.incomplete" => {
                return Err(
                    "ChatGPT subscription response was incomplete. The review was not submitted."
                        .into(),
                );
            }
            _ => {}
        }
    }
    Err(
        "ChatGPT response stream ended without response.completed; the review is incomplete."
            .into(),
    )
}

fn output_index(event: &Value) -> Result<usize, String> {
    event["output_index"]
        .as_u64()
        .filter(|index| *index < 1024)
        .map(|index| index as usize)
        .ok_or_else(|| "ChatGPT returned an invalid output item index".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::review::provider;

    fn stream(events: &[Value]) -> Vec<u8> {
        events
            .iter()
            .map(|event| {
                format!(
                    "event: {}\r\ndata: {event}\r\n\r\n",
                    event["type"].as_str().unwrap()
                )
            })
            .collect::<String>()
            .into_bytes()
    }

    fn call() -> Value {
        json!({"id":"fc_fixture","type":"function_call","status":"completed","call_id":"call_fixture","name":"get_diff","arguments":"{}"})
    }

    #[test]
    fn sparse_completion_restores_ordered_calls_and_reasoning_for_history_replay() {
        let reasoning = json!({"id":"rs_fixture","type":"reasoning","encrypted_content":"opaque-fixture-signature","summary":[]});
        let response = decode(&stream(&[
            json!({"type":"response.output_item.added","output_index":0,"item":{"type":"reasoning"}}),
            json!({"type":"response.output_item.added","output_index":1,"item":{"type":"function_call","arguments":""}}),
            json!({"type":"response.function_call_arguments.delta","output_index":1,"delta":"{"}),
            json!({"type":"response.function_call_arguments.done","output_index":1,"arguments":"{}"}),
            json!({"type":"response.output_item.done","output_index":1,"item":call()}),
            json!({"type":"response.output_item.done","output_index":0,"item":reasoning}),
            json!({"type":"response.completed","response":{"status":"completed","output":[],"usage":{"total_tokens":2346}}}),
        ])).unwrap();
        assert_eq!(response["output"], json!([reasoning, call()]));
        assert_eq!(response["_stage0Stream"]["completedOutputItems"], 2);
        assert_eq!(response["_stage0Stream"]["terminalOutputItems"], 0);
        let mut history = provider::initial_history("openai", "Fixture review");
        let (calls, usage) = provider::decode("openai", &response, &mut history).unwrap();
        assert_eq!(usage, 2346);
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].id, "call_fixture");
        assert_eq!(calls[0].name, "get_diff");
        assert_eq!(calls[0].arguments, json!({}));
        provider::append_results(
            "openai",
            &mut history,
            &[(calls[0].clone(), json!({"result":"fixture"}))],
        );
        assert_eq!(history[1], reasoning);
        assert_eq!(history[2], call());
        assert_eq!(history[3]["call_id"], "call_fixture");
        assert_eq!(history[3]["type"], "function_call_output");
    }

    #[test]
    fn full_terminal_output_and_streamed_items_are_not_duplicated() {
        let response = decode(&stream(&[
            json!({"type":"response.output_item.done","output_index":0,"item":call()}),
            json!({"type":"response.output_item.done","output_index":0,"item":call()}),
            json!({"type":"response.completed","response":{"status":"completed","output":[call()]}}),
        ])).unwrap();
        let (calls, _) = provider::decode("openai", &response, &mut Vec::new()).unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(response["output"].as_array().unwrap().len(), 1);
        let terminal_only = decode(&stream(&[
            json!({"type":"response.completed","response":{"status":"completed","output":[call()]}}),
        ])).unwrap();
        assert_eq!(terminal_only["output"], response["output"]);
    }

    #[test]
    fn sparse_completion_preserves_refusal_content() {
        let refusal = json!({"type":"message","role":"assistant","content":[{"type":"refusal","refusal":"Fixture refusal"}]});
        let response = decode(&stream(&[
            json!({"type":"response.output_item.done","output_index":0,"item":refusal}),
            json!({"type":"response.completed","response":{"status":"completed"}}),
        ]))
        .unwrap();
        assert_eq!(response["output"], json!([refusal]));
        assert!(provider::decode("openai", &response, &mut Vec::new())
            .unwrap()
            .0
            .is_empty());
    }

    #[test]
    fn unfinished_conflicting_and_failed_streams_never_authorize_calls() {
        let done = json!({"type":"response.output_item.done","output_index":0,"item":call()});
        let completed =
            json!({"type":"response.completed","response":{"status":"completed","output":[]}});
        for events in [
            vec![done.clone()],
            vec![done.clone(), json!({"type":"response.incomplete"})],
            vec![
                done.clone(),
                json!({"type":"response.failed","response":{"error":{"code":"subscription_sharing_usage_limit_exceeded"}}}),
            ],
            vec![
                done.clone(),
                json!({"type":"error","error":{"code":"request_failed"}}),
            ],
            vec![
                json!({"type":"response.output_item.added","output_index":0,"item":call()}),
                completed.clone(),
            ],
            vec![
                json!({"type":"response.output_item.done","output_index":1,"item":call()}),
                completed.clone(),
            ],
            vec![
                json!({"type":"response.output_item.done","output_index":9999999,"item":call()}),
                completed.clone(),
            ],
            vec![
                json!({"type":"response.output_item.done","item":call()}),
                completed.clone(),
            ],
            vec![
                done.clone(),
                json!({"type":"response.completed","response":{"status":"completed","output":[{"type":"message"}]}}),
            ],
            vec![
                done,
                json!({"type":"response.completed","response":{"status":"incomplete","output":[]}}),
            ],
        ] {
            assert!(decode(&stream(&events)).is_err(), "{events:?}");
        }
    }
}
