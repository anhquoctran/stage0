use super::endpoint::anthropic_supports_forced_tool_choice;
use crate::features::review::{ReviewRequest, ReviewToolCall};
use serde_json::{json, Value};

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
