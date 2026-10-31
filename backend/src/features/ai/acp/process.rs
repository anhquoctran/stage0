use super::{
    auth::sanitize_auth_status,
    launch_config::{make_command, validate_config},
    AcpAgentConfig,
};
use serde_json::{json, Value};
use std::{path::Path, time::Duration};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, ChildStdout},
};

const AUTH_STATUS_UPDATE_METHOD: &str = "_auth/status_update";

pub(super) struct AcpProcess {
    _activity: crate::common::activity::OperationLease,
    pub(super) child: Child,
    input: ChildStdin,
    output: BufReader<ChildStdout>,
    pub(super) auth_status: Option<Value>,
}

impl AcpProcess {
    pub(super) async fn start(
        config: &AcpAgentConfig,
        working_directory: Option<&Path>,
    ) -> Result<Self, String> {
        let activity = crate::common::activity::OperationLease::acquire()?;
        validate_config(config)?;
        let mut child = make_command(config, working_directory)
            .spawn()
            .map_err(|error| {
                if config.launch_mode.as_deref() == Some("binary") {
                    crate::common::messages::failure(
                        "backend.acp.agentStartFailed",
                        serde_json::json!({}),
                        format!(
                            "Could not start installed binary for {}: {error}",
                            config.name
                        ),
                    )
                } else {
                    crate::common::messages::failure(
                        "backend.acp.agentStartFailed",
                        serde_json::json!({}),
                        format!("Could not start {}: {error}", config.name),
                    )
                }
            })?;
        let input = child.stdin.take().ok_or_else(|| {
            crate::common::messages::failure(
                "backend.acp.agentStdinUnavailable",
                serde_json::json!({}),
                "ACP agent stdin is unavailable".into(),
            )
        })?;
        let output = child.stdout.take().ok_or_else(|| {
            crate::common::messages::failure(
                "backend.acp.agentStdoutUnavailable",
                serde_json::json!({}),
                "ACP agent stdout is unavailable".into(),
            )
        })?;
        Ok(Self {
            _activity: activity,
            child,
            input,
            output: BufReader::new(output),
            auth_status: None,
        })
    }

    pub(super) async fn send(&mut self, message: &Value) -> Result<(), String> {
        let mut bytes = serde_json::to_vec(message).map_err(|_| {
            crate::common::messages::failure(
                "backend.acp.encodeMessageFailed",
                serde_json::json!({}),
                "Could not encode ACP message".into(),
            )
        })?;
        bytes.push(b'\n');
        self.input.write_all(&bytes).await.map_err(|_| {
            crate::common::messages::failure(
                "backend.acp.agentClosedInput",
                serde_json::json!({}),
                "ACP agent closed its input".into(),
            )
        })?;
        self.input.flush().await.map_err(|_| {
            crate::common::messages::failure(
                "backend.acp.flushMessageFailed",
                serde_json::json!({}),
                "Could not flush ACP message".into(),
            )
        })
    }

    pub(super) async fn next_message(&mut self) -> Result<Value, String> {
        let mut line = String::new();
        loop {
            line.clear();
            let read =
                tokio::time::timeout(Duration::from_secs(180), self.output.read_line(&mut line))
                    .await
                    .map_err(|_| {
                        crate::common::messages::failure(
                            "backend.acp.agentTimedOut",
                            serde_json::json!({}),
                            "ACP agent timed out".into(),
                        )
                    })?
                    .map_err(|_| {
                        crate::common::messages::failure(
                            "backend.acp.readResponseFailed",
                            serde_json::json!({}),
                            "Could not read ACP agent response".into(),
                        )
                    })?;
            if read == 0 {
                return Err(crate::common::messages::failure(
                    "backend.acp.agentStartFailed",
                    serde_json::json!({}),
                    "ACP agent exited before replying. Check its installation and sign-in state."
                        .into(),
                ));
            }
            if line.len() > 1024 * 1024 {
                return Err(crate::common::messages::failure(
                    "backend.acp.responseSizeLimit",
                    serde_json::json!({}),
                    "ACP agent response exceeded the 1 MB limit".into(),
                ));
            }
            if let Ok(value) = serde_json::from_str::<Value>(&line) {
                return Ok(value);
            }
        }
    }

    pub(super) async fn request(
        &mut self,
        id: u64,
        method: &str,
        params: Value,
    ) -> Result<Value, String> {
        self.send(&json!({"jsonrpc":"2.0","id":id,"method":method,"params":params}))
            .await?;
        loop {
            let message = self.next_message().await?;
            self.capture_auth_status(&message);
            if message.get("method").is_some() && message.get("id").is_some() {
                let _ = self.send(&json!({"jsonrpc":"2.0","id":message["id"],"error":{"code":-32601,"message":"Stage0 does not expose workspace tools over ACP yet"}})).await;
                continue;
            }
            if message.get("id").and_then(Value::as_u64) == Some(id) {
                if let Some(error) = message.get("error") {
                    let detail = error
                        .get("message")
                        .and_then(Value::as_str)
                        .unwrap_or("ACP request failed");
                    return Err(detail.chars().take(400).collect());
                }
                return Ok(message.get("result").cloned().unwrap_or(Value::Null));
            }
        }
    }

    fn capture_auth_status(&mut self, message: &Value) {
        if message.get("method").and_then(Value::as_str) == Some(AUTH_STATUS_UPDATE_METHOD) {
            self.auth_status = message
                .pointer("/params/authStatus")
                .and_then(sanitize_auth_status);
        }
    }

    pub(super) async fn wait_for_auth_status(
        &mut self,
        timeout: Duration,
    ) -> Result<Option<Value>, String> {
        if self.auth_status.is_some() {
            return Ok(self.auth_status.clone());
        }

        let deadline = tokio::time::Instant::now() + timeout;
        loop {
            let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
            if remaining.is_zero() {
                return Ok(self.auth_status.clone());
            }

            let message = match tokio::time::timeout(remaining, self.next_message()).await {
                Ok(message) => message?,
                Err(_) => return Ok(self.auth_status.clone()),
            };
            self.capture_auth_status(&message);
            if message.get("method").is_some() && message.get("id").is_some() {
                self.send(&json!({"jsonrpc":"2.0","id":message["id"],"error":{"code":-32601,"message":"Stage0 does not expose workspace tools over ACP yet"}})).await?;
            }
            if self.auth_status.is_some() {
                return Ok(self.auth_status.clone());
            }
        }
    }

    pub(super) async fn initialize(&mut self) -> Result<Value, String> {
        let response = self.request(0, "initialize", json!({
            "protocolVersion": 1,
            "clientCapabilities": {"session":{"configOptions":{"boolean":{}}}},
            "clientInfo": {"name":"stage0","title":"Stage0","version":env!("CARGO_PKG_VERSION")}
        })).await?;
        if response.get("protocolVersion").and_then(Value::as_u64) != Some(1) {
            return Err("The agent does not support ACP protocol version 1".into());
        }
        Ok(response)
    }

    pub(super) async fn close(&mut self) {
        let _ = self.child.kill().await;
        let _ = self.child.wait().await;
    }
}

impl Drop for AcpProcess {
    fn drop(&mut self) {
        let _ = self.child.start_kill();
    }
}
