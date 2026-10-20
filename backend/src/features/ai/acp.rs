use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{path::{Path, PathBuf}, process::Stdio, time::Duration};
use tauri::command;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, ChildStdout, Command},
};

const REGISTRY_URL: &str = "https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpRegistry {
    pub agents: Vec<AcpRegistryAgent>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpRegistryAgent {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub icon: Option<String>,
    pub website: Option<String>,
    pub repository: Option<String>,
    pub license: Option<String>,
    #[serde(rename = "license_url")]
    pub license_url: Option<String>,
    pub distribution: Value,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AcpAgentConfig {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    pub source: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
}

#[derive(Deserialize)]
struct RegistryPayload {
    agents: Vec<AcpRegistryAgent>,
}

#[command]
pub async fn acp_fetch_registry() -> Result<AcpRegistry, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::limited(3))
        .build()
        .map_err(|_| "Could not initialize ACP Registry client")?;
    let response = client
        .get(REGISTRY_URL)
        .send()
        .await
        .map_err(|_| "Could not reach the ACP Registry")?;
    if !response.status().is_success() {
        return Err(format!("ACP Registry returned HTTP {}", response.status().as_u16()));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|_| "Could not read the ACP Registry response")?;
    if bytes.len() > 5 * 1024 * 1024 {
        return Err("ACP Registry response is too large".into());
    }
    let parsed: RegistryPayload = serde_json::from_slice(&bytes)
        .map_err(|_| "ACP Registry returned invalid JSON")?;
    Ok(AcpRegistry { agents: parsed.agents })
}

#[command]
pub async fn acp_prepare_registry_agent(agent_id: String) -> Result<AcpAgentConfig, String> {
    if agent_id.len() > 100 || !agent_id.bytes().all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-') {
        return Err("Invalid ACP Registry agent ID".into());
    }
    let registry = acp_fetch_registry().await?;
    let agent = registry.agents.into_iter().find(|agent| agent.id == agent_id)
        .ok_or("The selected agent is no longer available in the ACP Registry")?;
    let distribution = &agent.distribution;
    let (command, package, args) = if let Some(value) = distribution.get("npx") {
        let package = value.get("package").and_then(Value::as_str).ok_or("ACP Registry npx entry has no package")?;
        ("npx", package, value.get("args"))
    } else if let Some(value) = distribution.get("uvx") {
        let package = value.get("package").and_then(Value::as_str).ok_or("ACP Registry uvx entry has no package")?;
        ("uvx", package, value.get("args"))
    } else {
        return Err("This Registry agent is distributed as a platform binary. Binary installation is not supported by this build yet.".into());
    };
    if !safe_package_name(package) {
        return Err("ACP Registry returned an unsupported package name".into());
    }
    let extra_args = parse_safe_args(args)?;
    let mut launch_args = Vec::with_capacity(extra_args.len() + 2);
    if command == "npx" { launch_args.push("-y".to_owned()); }
    launch_args.push(package.to_owned());
    launch_args.extend(extra_args);
    Ok(AcpAgentConfig {
        id: agent.id,
        name: agent.name,
        version: Some(agent.version),
        description: Some(agent.description),
        source: "registry".into(),
        command: command.into(),
        args: launch_args,
    })
}

fn safe_package_name(value: &str) -> bool {
    !value.is_empty() && value.len() <= 250 && value.bytes().all(|byte| {
        byte.is_ascii_alphanumeric() || matches!(byte, b'@' | b'/' | b'.' | b'_' | b'-' | b'+')
    })
}

fn parse_safe_args(value: Option<&Value>) -> Result<Vec<String>, String> {
    let Some(value) = value else { return Ok(Vec::new()); };
    let args = value.as_array().ok_or("ACP Registry args are invalid")?;
    if args.len() > 64 { return Err("ACP Registry entry has too many launch arguments".into()); }
    args.iter().map(|arg| {
        let arg = arg.as_str().ok_or("ACP Registry argument is invalid")?;
        if arg.len() > 1024 || !arg.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'@' | b'/' | b'.' | b'_' | b'-' | b'+' | b':' | b'=' | b',')) {
            return Err("ACP Registry argument contains unsupported characters".into());
        }
        Ok(arg.to_owned())
    }).collect()
}

fn validate_config(config: &AcpAgentConfig) -> Result<(), String> {
    if config.id.trim().is_empty() || config.id.len() > 100
        || config.name.trim().is_empty() || config.name.len() > 200
        || config.args.len() > 64
        || config.args.iter().any(|arg| arg.len() > 2048 || arg.chars().any(char::is_control))
        || config.command.trim().is_empty() || config.command.len() > 512
        || config.command.chars().any(char::is_control)
        || !matches!(config.source.as_str(), "registry" | "custom")
    {
        return Err("Invalid External Agent configuration".into());
    }
    #[cfg(target_os = "windows")]
    if config.command.chars().any(|ch| matches!(ch, '&' | '|' | '<' | '>' | '%' | '^' | '!' | '"' | '(' | ')'))
        || config.args.iter().any(|arg| arg.chars().any(|ch| matches!(ch, '&' | '|' | '<' | '>' | '%' | '^' | '!' | '"' | '(' | ')')))
    {
        return Err("The Windows ACP launcher cannot safely pass shell control characters".into());
    }
    if config.source == "registry" && !matches!(config.command.as_str(), "npx" | "uvx") {
        return Err("Unsupported ACP Registry launch command".into());
    }
    Ok(())
}

fn make_command(config: &AcpAgentConfig, working_directory: Option<&Path>) -> Command {
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut cmd = Command::new("cmd.exe");
        cmd.args(["/D", "/S", "/C", &config.command]);
        cmd
    };
    #[cfg(not(target_os = "windows"))]
    let mut command = Command::new(&config.command);
    if let Some(path) = working_directory {
        command.current_dir(path);
    }
    command.args(&config.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    command
}

struct AcpProcess {
    child: Child,
    input: ChildStdin,
    output: BufReader<ChildStdout>,
}

impl AcpProcess {
    async fn start(config: &AcpAgentConfig, working_directory: Option<&Path>) -> Result<Self, String> {
        validate_config(config)?;
        let mut child = make_command(config, working_directory).spawn().map_err(|_| {
            format!("Could not start {}. Install Node.js/uv or check the agent command.", config.name)
        })?;
        let input = child.stdin.take().ok_or("ACP agent stdin is unavailable")?;
        let output = child.stdout.take().ok_or("ACP agent stdout is unavailable")?;
        Ok(Self { child, input, output: BufReader::new(output) })
    }

    async fn send(&mut self, message: &Value) -> Result<(), String> {
        let mut bytes = serde_json::to_vec(message).map_err(|_| "Could not encode ACP message")?;
        bytes.push(b'\n');
        self.input.write_all(&bytes).await.map_err(|_| "ACP agent closed its input")?;
        self.input.flush().await.map_err(|_| "Could not flush ACP message".to_owned())
    }

    async fn next_message(&mut self) -> Result<Value, String> {
        let mut line = String::new();
        loop {
            line.clear();
            let read = tokio::time::timeout(Duration::from_secs(180), self.output.read_line(&mut line))
                .await.map_err(|_| "ACP agent timed out")?
                .map_err(|_| "Could not read ACP agent response")?;
            if read == 0 { return Err("ACP agent exited before replying. Check its installation and sign-in state.".into()); }
            if line.len() > 1024 * 1024 { return Err("ACP agent response exceeded the 1 MB limit".into()); }
            if let Ok(value) = serde_json::from_str::<Value>(&line) {
                return Ok(value);
            }
        }
    }

    async fn request(&mut self, id: u64, method: &str, params: Value) -> Result<Value, String> {
        self.send(&json!({"jsonrpc":"2.0","id":id,"method":method,"params":params})).await?;
        loop {
            let message = self.next_message().await?;
            if message.get("method").is_some() && message.get("id").is_some() {
                let _ = self.send(&json!({"jsonrpc":"2.0","id":message["id"],"error":{"code":-32601,"message":"Stage0 does not expose workspace tools over ACP yet"}})).await;
                continue;
            }
            if message.get("id").and_then(Value::as_u64) == Some(id) {
                if let Some(error) = message.get("error") {
                    let detail = error.get("message").and_then(Value::as_str).unwrap_or("ACP request failed");
                    return Err(detail.chars().take(400).collect());
                }
                return Ok(message.get("result").cloned().unwrap_or(Value::Null));
            }
        }
    }

    async fn initialize(&mut self) -> Result<Value, String> {
        let response = self.request(0, "initialize", json!({
            "protocolVersion": 1,
            "clientCapabilities": {},
            "clientInfo": {"name":"stage0","title":"Stage0","version":env!("CARGO_PKG_VERSION")}
        })).await?;
        if response.get("protocolVersion").and_then(Value::as_u64) != Some(1) {
            return Err("The agent does not support ACP protocol version 1".into());
        }
        Ok(response)
    }

    async fn close(&mut self) {
        let _ = self.child.kill().await;
        let _ = self.child.wait().await;
    }
}

#[command]
pub async fn acp_agent_auth_methods(config: AcpAgentConfig) -> Result<Vec<Value>, String> {
    let mut process = AcpProcess::start(&config, None).await?;
    let result = process.initialize().await;
    process.close().await;
    let initialized = result?;
    Ok(initialized.get("authMethods").and_then(Value::as_array).cloned().unwrap_or_default())
}

#[command]
pub async fn acp_agent_authenticate(config: AcpAgentConfig, method_id: String) -> Result<(), String> {
    if method_id.trim().is_empty() || method_id.len() > 200 { return Err("Invalid ACP authentication method".into()); }
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
        Ok(())
    }.await;
    process.close().await;
    result
}

#[command]
pub async fn acp_agent_prompt(config: AcpAgentConfig, prompt: String, cwd: Option<String>) -> Result<String, String> {
    if prompt.trim().is_empty() || prompt.len() > 64 * 1024 { return Err("Enter a prompt under 64 KB".into()); }
    let working_directory = match cwd.filter(|path| !path.trim().is_empty()) {
        Some(path) => PathBuf::from(path),
        None => std::env::current_dir().map_err(|_| "Could not determine the default working directory")?,
    };
    if working_directory.as_os_str().len() > 4096
        || !working_directory.is_absolute()
        || working_directory.to_string_lossy().chars().any(char::is_control)
        || !working_directory.is_dir()
    {
        return Err("Working directory must be an existing absolute path".into());
    }
    let working_directory_text = working_directory.to_string_lossy().into_owned();
    let mut process = AcpProcess::start(&config, Some(&working_directory)).await?;
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
