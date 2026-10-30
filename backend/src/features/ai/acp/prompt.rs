use super::{process::AcpProcess, AcpAgentConfig};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use tauri::command;

#[command]
pub async fn acp_agent_prompt(
    config: AcpAgentConfig,
    prompt: String,
    cwd: Option<String>,
) -> Result<String, String> {
    let result: Result<_, String> = async {
        if prompt.trim().is_empty() || prompt.len() > 64 * 1024 {
            return Err("Enter a prompt under 64 KB".into());
        }
        let working_directory = match cwd.filter(|path| !path.trim().is_empty()) {
            Some(path) => PathBuf::from(path),
            None => std::env::current_dir()
                .map_err(|_| "Could not determine the default working directory")?,
        };
        if working_directory.as_os_str().len() > 4096
            || !working_directory.is_absolute()
            || working_directory
                .to_string_lossy()
                .chars()
                .any(char::is_control)
            || !working_directory.is_dir()
        {
            return Err("Working directory must be an existing absolute path".into());
        }
        prompt_agent_in_directory(&config, &prompt, &working_directory).await
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("ai", error))
}

async fn prompt_agent_in_directory(
    config: &AcpAgentConfig,
    prompt: &str,
    working_directory: &Path,
) -> Result<String, String> {
    let working_directory_text = working_directory.to_string_lossy().into_owned();
    if working_directory_text.len() > 4096
        || !working_directory.is_absolute()
        || working_directory_text.chars().any(char::is_control)
        || !working_directory.is_dir()
    {
        return Err("Working directory must be an existing absolute path".into());
    }
    let mut process = AcpProcess::start(config, Some(working_directory)).await?;
    let result = async {
        process.initialize().await?;
        let session = process.request(1, "session/new", json!({"cwd":working_directory_text,"mcpServers":[]})).await?;
        let session_id = session.get("sessionId").and_then(Value::as_str).ok_or("ACP agent did not return a session ID")?;
        process.send(&json!({"jsonrpc":"2.0","id":2,"method":"session/prompt","params":{"sessionId":session_id,"prompt":[{"type":"text","text":prompt}]}})).await?;
        let mut output = String::new();
        loop {
            let message = process.next_message().await?;
            if message.get("method").and_then(Value::as_str) == Some("session/update") {
                let update = &message["params"]["update"];
                if update.get("sessionUpdate").and_then(Value::as_str) == Some("agent_message_chunk") {
                    if let Some(text) = update["content"]["text"].as_str() {
                        if output.len() + text.len() > 128 * 1024 { return Err("ACP response exceeded the 128 KB limit".into()); }
                        output.push_str(text);
                    }
                }

                continue;
            }
            if message.get("method").is_some() && message.get("id").is_some() {
                process.send(&json!({"jsonrpc":"2.0","id":message["id"],"error":{"code":-32601,"message":"Stage0 does not expose workspace tools over ACP yet"}})).await?;
                continue;
            }
            if message.get("id").and_then(Value::as_u64) == Some(2) {
                if let Some(error) = message.get("error") { return Err(error.get("message").and_then(Value::as_str).unwrap_or("ACP prompt failed").to_owned()); }
                return if output.trim().is_empty() { Err("ACP agent completed without a text response".into()) } else { Ok(output) };
            }
        }
    }.await;
    process.close().await;
    result
}
