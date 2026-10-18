use super::super::{tool_registry::ReviewToolRegistry, ReviewToolCall};
use serde_json::{json, Value};

pub const VERSION: &str = "stage0-review-cli-v1";

/// Contract for a FUTURE reviewed CLI wrapper. This does not spawn a process,
/// and declared capability restrictions are not a substitute for OS isolation.
pub fn turn_request(
    system: &str,
    history: &[Value],
    tools: &[Value],
    max_tokens: u64,
) -> Result<Value, String> {
    if max_tokens == 0 || max_tokens > 2048 {
        return Err("CLI output budget exceeds harness policy".into());
    }
    let value = json!({"protocolVersion":VERSION,"system":system,"history":history,"tools":tools,"maxOutputTokens":max_tokens,"capabilities":{"hostExecution":false,"hostFilesystem":false,"automaticApproval":false}});
    if value.to_string().len() > 160 * 1024 {
        return Err("CLI request exceeds context budget".into());
    }
    Ok(value)
}

pub fn decode_turn(
    bytes: &[u8],
    registry: &ReviewToolRegistry,
) -> Result<(Vec<ReviewToolCall>, u64), String> {
    if bytes.len() > 512 * 1024 {
        return Err("CLI response exceeds safety limit".into());
    }
    let value: Value = serde_json::from_slice(bytes).map_err(|_| {
        "CLI wrapper must return one structured JSON object, not prose or raw agent events"
    })?;
    let object = value.as_object().ok_or("Invalid CLI turn response")?;
    if object.len() != 3
        || value["protocolVersion"] != VERSION
        || !object
            .keys()
            .all(|k| ["protocolVersion", "toolCalls", "usageTokens"].contains(&k.as_str()))
    {
        return Err("Unsupported CLI protocol or unknown response fields".into());
    }
    let usage = value["usageTokens"]
        .as_u64()
        .ok_or("Missing CLI usage counter")?;
    let items = value["toolCalls"]
        .as_array()
        .filter(|v| !v.is_empty() && v.len() <= 8)
        .ok_or("CLI must return 1–8 tool calls")?;
    let mut seen = std::collections::HashSet::new();
    let mut calls = Vec::new();
    for item in items {
        let object = item
            .as_object()
            .filter(|v| {
                v.len() == 3
                    && v.keys()
                        .all(|k| ["id", "name", "arguments"].contains(&k.as_str()))
            })
            .ok_or("Malformed CLI tool call")?;
        let id = object["id"]
            .as_str()
            .filter(|s| !s.is_empty() && s.len() <= 200 && !s.chars().any(char::is_control))
            .ok_or("Invalid CLI call ID")?;
        let name = object["name"].as_str().ok_or("Missing CLI tool name")?;
        if !seen.insert(id.to_string()) {
            return Err("Duplicate CLI call ID".into());
        }
        registry.validate_call(name, &object["arguments"])?;
        calls.push(ReviewToolCall {
            id: id.into(),
            native_id: Some(id.into()),
            name: name.into(),
            arguments: object["arguments"].clone(),
        });
    }
    if calls.len() != 1 && calls.iter().any(|c| c.name == "submit_review") {
        return Err("CLI final submission must be exclusive".into());
    }
    Ok((calls, usage))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn wrapper_contract_never_accepts_unstructured_success_or_host_tools() {
        let registry = ReviewToolRegistry::native();
        let request = turn_request("policy", &[], registry.definitions(), 2048).unwrap();
        assert_eq!(request["capabilities"]["hostExecution"], false);
        assert!(turn_request("policy", &[], &[], 4096).is_err());
        let reply = json!({"protocolVersion":VERSION,"toolCalls":[{"id":"1","name":"get_diff","arguments":{}}],"usageTokens":10});
        assert_eq!(
            decode_turn(reply.to_string().as_bytes(), &registry)
                .unwrap()
                .0[0]
                .id,
            "1"
        );
        for value in [
            json!({"success":true,"output":"approved"}),
            json!({"protocolVersion":VERSION,"toolCalls":[{"id":"1","name":"execute_terminal_cmd","arguments":{}}],"usageTokens":1}),
            json!({"protocolVersion":VERSION,"toolCalls":[{"id":"1","name":"get_diff","arguments":{}},{"id":"1","name":"get_diff","arguments":{}}],"usageTokens":1}),
        ] {
            assert!(decode_turn(value.to_string().as_bytes(), &registry).is_err());
        }
    }
}
