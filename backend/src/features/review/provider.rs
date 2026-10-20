use super::{ReviewRequest, ReviewToolCall};
use serde_json::{json, Value};
use std::time::Duration;
use zeroize::Zeroizing;

const OPENAI_API_BASE_URL: &str = "https://api.openai.com/v1";

fn openai_reasoning_efforts(model: &str) -> &'static [&'static str] {
    match model {
        "gpt-6-astra" | "gpt-6.1-sol" => &["low", "medium", "high", "xhigh", "max"],
        "gpt-6-sol" | "gpt-6-luna" | "gpt-5.6-sol" | "gpt-5.6-terra" | "gpt-5.6-luna" => {
            &["none", "low", "medium", "high", "xhigh", "max"]
        }
        "gpt-5.5" => &["none", "low", "medium", "high", "xhigh"],
        _ => &[],
    }
}

fn openai_supports_fast_mode(model: &str) -> bool {
    matches!(
        model,
        "gpt-6-astra" | "gpt-6.1-sol" | "gpt-6-sol" | "gpt-6-luna" | "gpt-5.6-sol"
    )
}

fn anthropic_supports_forced_tool_choice(model: &str) -> bool {
    // Claude 5.5/5.1 frontier models currently reject tool_choice=any. Only
    // force calls for the Anthropic models Stage0 explicitly knows support it;
    // unknown IDs use auto plus the review prompt and bounded retry instead.
    ["claude-haiku-4-5", "claude-3-7-sonnet", "claude-3-5-sonnet"]
        .iter()
        .any(|prefix| model.starts_with(prefix))
}

pub fn endpoint(config: &ReviewRequest) -> Result<String, String> {
    if config.model.trim().is_empty()
        || config.model.len() > 200
        || config.instructions.len() > 8000
    {
        return Err("Invalid model or instruction length".into());
    }
    if config.auth_mode != "api_key" {
        return Err("Built-in providers require API-key authentication. Use External Agents for cloud subscription sign-in.".into());
    }
    let url =
        reqwest::Url::parse(config.base_url.trim()).map_err(|_| "Invalid provider base URL")?;
    let local = matches!(
        url.host_str(),
        Some("localhost" | "127.0.0.1" | "[::1]" | "::1")
    );
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || (!local && url.scheme() != "https")
        || !matches!(url.scheme(), "https" | "http")
    {
        return Err("Provider URL must be HTTPS (HTTP only on loopback), without credentials/query/fragment".into());
    }
    if !local && !config.allow_remote {
        return Err(
            "Explicit consent is required before sharing source with a remote provider".into(),
        );
    }
    let root = url.as_str().trim_end_matches('/');
    if let Some(effort) = config.reasoning_effort.as_deref() {
        if config.provider != "openai"
            || root != OPENAI_API_BASE_URL
            || !openai_reasoning_efforts(&config.model).contains(&effort)
        {
            return Err(
                "The selected provider/model does not declare support for this reasoning effort"
                    .into(),
            );
        }
    }
    if config.fast_mode
        && (config.provider != "openai"
            || root != OPENAI_API_BASE_URL
            || !openai_supports_fast_mode(&config.model))
    {
        return Err("Fast mode is not supported for the selected provider/model".into());
    }
    let suffix=match config.provider.as_str(){
        "openai" if root=="https://api.openai.com/v1"=>"responses",
        "anthropic" if root=="https://api.anthropic.com/v1"=>"messages",
        "gemini" if root=="https://generativelanguage.googleapis.com/v1beta"=>"gemini",
        "xai_grok" if root=="https://api.x.ai/v1"=>"chat/completions",
        "custom"=>"chat/completions",
        "ollama" if local=>"api/chat",
        _=>return Err("Unsupported provider/base URL combination. Use its official endpoint, or a separately configured Custom API key.".into()),
    };
    if suffix == "gemini" {
        if !config
            .model
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.')
        {
            return Err("Invalid Gemini model ID".into());
        }
        return Ok(format!("{root}/models/{}:generateContent", config.model));
    }
    Ok(format!("{root}/{suffix}"))
}

pub fn initial_history(provider: &str, prompt: &str) -> Vec<Value> {
    if provider == "gemini" {
        vec![json!({"role":"user","parts":[{"text":prompt}]})]
    } else {
        vec![json!({"role":"user","content":prompt})]
    }
}

pub fn payload(
    config: &ReviewRequest,
    system: &str,
    history: &[Value],
    tools: &[Value],
    max_tokens: u64,
) -> Value {
    match config.provider.as_str() {
        "openai" => {
            let tool_definitions = tools
                .iter()
                .map(|tool| {
                    json!({
                        "type":"function",
                        "name":tool["name"],
                        "description":tool["description"],
                        "parameters":tool["parameters"],
                        "strict":true
                    })
                })
                .collect::<Vec<_>>();
            let mut body = json!({"model":config.model,"instructions":system,"input":history,"store":false,"include":["reasoning.encrypted_content"],"max_output_tokens":max_tokens,"parallel_tool_calls":false,"tool_choice":"required","tools":tool_definitions});
            if let Some(effort) = config.reasoning_effort.as_deref() {
                body["reasoning"] = json!({"effort": effort});
            }
            if config.fast_mode {
                body["service_tier"] = json!("fast");
            }
            body
        }
        "anthropic" => {
            let mut body = json!({"model":config.model,"system":system,"messages":history,"max_tokens":max_tokens,"tools":tools.iter().map(|t|json!({"name":t["name"],"description":t["description"],"input_schema":t["parameters"]})).collect::<Vec<_>>()});
            body["tool_choice"] = if anthropic_supports_forced_tool_choice(&config.model) {
                json!({"type":"any","disable_parallel_tool_use":true})
            } else {
                json!({"type":"auto","disable_parallel_tool_use":true})
            };
            body
        }
        "gemini" => {
            json!({"contents":history,"systemInstruction":{"parts":[{"text":system}]},"generationConfig":{"maxOutputTokens":max_tokens},"toolConfig":{"functionCallingConfig":{"mode":"ANY"}},"tools":[{"functionDeclarations":tools.iter().map(|t|json!({"name":t["name"],"description":t["description"],"parametersJsonSchema":t["parameters"]})).collect::<Vec<_>>()}]})
        }
        _ => {
            let mut messages = vec![json!({"role":"system","content":system})];
            messages.extend_from_slice(history);
            let mut body = json!({"model":config.model,"messages":messages,"stream":false,"tools":tools.iter().map(|t|json!({"type":"function","function":{"name":t["name"],"description":t["description"],"parameters":t["parameters"]}})).collect::<Vec<_>>()});
            if config.provider == "ollama" {
                body["options"] = json!({"num_predict":max_tokens});
            } else {
                body["tool_choice"] = json!("required");
                body["parallel_tool_calls"] = json!(false);
                body["max_tokens"] = json!(max_tokens);
            }
            body
        }
    }
}

pub async fn request(
    config: &ReviewRequest,
    url: &str,
    body: &Value,
) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Could not initialize provider client")?;
    let mut request = client.post(url).json(body);
    if config.provider != "ollama" {
        let key = Zeroizing::new(
            crate::features::credentials::get_ai_key(&config.provider).map_err(|_| {
                "Provider API key is missing or unavailable in the OS credential store"
            })?,
        );
        request = match config.provider.as_str() {
            "anthropic" => request
                .header("x-api-key", key.as_str())
                .header("anthropic-version", "2023-06-01"),
            "gemini" => request.header("x-goog-api-key", key.as_str()),
            _ => request.bearer_auth(key.as_str()),
        };
    }
    let mut response = request
        .try_clone()
        .ok_or("Could not prepare provider request")?
        .send()
        .await
        .map_err(|_| {
            "Provider request failed or timed out; check your connection and configuration"
        })?;
    // Retry once only for explicit transient HTTP statuses. Do not replay an
    // ambiguous network timeout or interrupted successful response (billing).
    if matches!(response.status().as_u16(), 429 | 502 | 503 | 504) {
        let delay = response
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(1)
            .clamp(1, 2);
        drop(response);
        tokio::time::sleep(Duration::from_secs(delay)).await;
        response = request
            .send()
            .await
            .map_err(|_| "Provider retry failed or timed out")?;
    }
    let status = response.status();
    if !status.is_success() {
        return Err(format!("Provider returned HTTP {}. Check authentication, model/tool support and rate limits (at most one retry for transient HTTP errors).",status.as_u16()));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Provider response interrupted")?
    {
        if bytes.len() + chunk.len() > 512 * 1024 {
            return Err("Provider response exceeded the safety limit".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| "Provider returned invalid JSON".into())
}

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

pub fn append_results(
    provider: &str,
    history: &mut Vec<Value>,
    results: &[(ReviewToolCall, Value)],
) {
    match provider {
        "anthropic"=>history.push(json!({"role":"user","content":results.iter().map(|(call,result)|json!({"type":"tool_result","tool_use_id":call.id,"is_error":result["isError"]==true,"content":result.to_string()})).collect::<Vec<_>>()})),
        "gemini"=>history.push(json!({"role":"user","parts":results.iter().map(|(call,result)|{
            let mut value=json!({"functionResponse":{"name":call.name,"response":result}});
            if let Some(id)=&call.native_id {value["functionResponse"]["id"]=json!(id);}
            value
        }).collect::<Vec<_>>()})),
        "openai"=>for (call,result) in results{history.push(json!({"type":"function_call_output","call_id":call.id,"output":result.to_string()}));},
        "ollama"=>for (call,result) in results{history.push(json!({"role":"tool","tool_name":call.name,"content":result.to_string()}));},
        _=>for (call,result) in results{history.push(json!({"role":"tool","tool_call_id":call.id,"content":result.to_string()}));},
    }
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

#[cfg(test)]
mod tests {
    use super::*;
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
            reviewer_role: None,
            base_url: url.into(),
            instructions: String::new(),
            allow_remote: true,
            generate_description: false,
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
        assert!(request["tools"].as_array().is_some_and(|tools| !tools.is_empty()));

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
}
