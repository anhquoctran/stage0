use super::DiscoveredMcpTool;
use serde_json::Value;
use sha2::{Digest, Sha256};

// Deliberately pinned, not an assertion that this is the latest MCP revision.
pub const VERSION: &str = "2025-11-25";
pub fn fingerprint(text: &str) -> String {
    format!("{:x}", Sha256::digest(text.as_bytes()))
}

pub fn result(message: &Value, id: u64) -> Result<Value, String> {
    if message["jsonrpc"] != "2.0"
        || message["id"].as_u64() != Some(id)
        || message.get("method").is_some()
    {
        return Err("Invalid or mismatched MCP response ID".into());
    }
    if message.get("error").is_some() {
        return Err(
            "MCP server returned a protocol error; its raw error body was not retained".into(),
        );
    }
    message
        .get("result")
        .filter(|v| v.is_object())
        .cloned()
        .ok_or("Missing MCP response result".into())
}

/// SSE is parsed incrementally by the bounded HTTP reader. No server requests,
/// roots, sampling, elicitation, instructions or icons are followed/executed.
pub fn sse_result(bytes: &[u8], id: u64, eof: bool) -> Result<Option<Value>, String> {
    let text = match std::str::from_utf8(bytes) {
        Ok(s) => s,
        Err(e) if e.error_len().is_none() && !eof => return Ok(None),
        Err(_) => return Err("Invalid UTF-8 MCP stream".into()),
    };
    let text = text.replace("\r\n", "\n").replace('\r', "\n");
    let end = if eof {
        text.len()
    } else {
        text.rfind("\n\n").map(|n| n + 2).unwrap_or(0)
    };
    for (count, event) in text[..end].split("\n\n").enumerate() {
        if count >= 32 {
            return Err("Too many MCP stream events".into());
        }
        let data = event
            .lines()
            .filter_map(|line| {
                line.strip_prefix("data:")
                    .map(|s| s.strip_prefix(' ').unwrap_or(s))
            })
            .collect::<Vec<_>>()
            .join("\n");
        if data.trim().is_empty() {
            continue;
        }
        let message: Value = serde_json::from_str(&data).map_err(|_| "Invalid MCP stream JSON")?;
        if message.get("method").is_some() {
            if message.get("id").is_some() {
                return Err("Server-initiated MCP requests are not supported by discovery".into());
            }
            continue;
        }
        return result(&message, id).map(Some);
    }
    Ok(None)
}

pub fn catalog_page(connection: &str, page: &Value) -> Result<Vec<DiscoveredMcpTool>, String> {
    let items = page["tools"]
        .as_array()
        .ok_or("MCP tools/list did not return tools")?;
    if items.len() > 100 {
        return Err("MCP catalog exceeds 100 tools".into());
    }
    items
        .iter()
        .map(|tool| {
            let name = tool["name"]
                .as_str()
                .filter(|s| !s.is_empty() && s.len() <= 128 && !s.chars().any(char::is_control))
                .ok_or("Invalid MCP tool name")?;
            let schema = tool
                .get("inputSchema")
                .filter(|s| s.is_object())
                .ok_or("MCP tool requires a JSON Schema object")?;
            if schema.to_string().len() > 16 * 1024 {
                return Err("MCP tool schema exceeds safety limit".into());
            }
            Ok(DiscoveredMcpTool {
                name: name.into(),
                namespaced_name: format!(
                    "mcp_{}_{}",
                    &fingerprint(connection)[..12],
                    &fingerprint(name)[..12]
                ),
                description: super::super::security::redact(
                    &tool["description"]
                        .as_str()
                        .unwrap_or("")
                        .chars()
                        .take(2000)
                        .collect::<String>(),
                ),
                input_schema: schema.clone(),
                read_only_hint: tool["annotations"]["readOnlyHint"].as_bool(),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn json_rpc_ids_stream_framing_and_untrusted_requests_fail_closed() {
        assert!(result(&json!({"jsonrpc":"2.0","id":2,"result":{}}), 1).is_err());
        assert!(result(
            &json!({"jsonrpc":"2.0","id":1,"error":{"message":"fixture secret"}}),
            1
        )
        .unwrap_err()
        .find("fixture secret")
        .is_none());
        let stream =
            b": heartbeat\r\n\r\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{}}\r\n\r\n";
        assert!(sse_result(&stream[..stream.len() - 4], 1, false)
            .unwrap()
            .is_none());
        assert_eq!(sse_result(stream, 1, false).unwrap(), Some(json!({})));
        assert!(sse_result(
            b"data: {\"jsonrpc\":\"2.0\",\"id\":9,\"method\":\"sampling/createMessage\"}\n\n",
            1,
            false
        )
        .is_err());
    }
    #[test]
    fn catalog_names_are_namespaced_and_read_only_hints_never_attach_tools() {
        let page = json!({"tools":[{"name":"submit_review","inputSchema":{"type":"object"},"annotations":{"readOnlyHint":true}}]});
        let a = catalog_page("a", &page).unwrap();
        let b = catalog_page("b", &page).unwrap();
        assert!(a[0].namespaced_name.starts_with("mcp_") && a[0].namespaced_name.len() < 64);
        assert_ne!(a[0].namespaced_name, b[0].namespaced_name);
        assert!(
            super::super::super::tool_registry::ReviewToolRegistry::native()
                .validate_call(&a[0].namespaced_name, &json!({}))
                .is_err()
        );
    }
}
