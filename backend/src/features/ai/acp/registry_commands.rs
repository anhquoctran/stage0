use super::launch_config::{parse_safe_args, safe_package_name};
use super::registry_payload::RegistryPayload;
use super::{binary_install, binary_platform, AcpAgentConfig, AcpRegistry, AcpRegistryAgent};
use serde_json::Value;
use std::time::Duration;
use tauri::{command, AppHandle, Manager};

const REGISTRY_URL: &str = "https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json";

fn supported_binary_target() -> Option<String> {
    binary_platform::current_target()
}

#[command]
pub async fn acp_fetch_registry() -> Result<AcpRegistry, String> {
    let result: Result<_, String> = async {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::limited(3))
            .build()
            .map_err(|_| crate::common::messages::code("backend.acp.registryUnavailable"))?;
        let response = client
            .get(REGISTRY_URL)
            .send()
            .await
            .map_err(|_| crate::common::messages::code("backend.acp.registryUnavailable"))?;
        if !response.status().is_success() {
            return Err(crate::common::messages::message(
                "backend.acp.registryHttp",
                serde_json::json!({ "status": response.status().as_u16() }),
            ));
        }
        let bytes = response
            .bytes()
            .await
            .map_err(|_| crate::common::messages::code("backend.acp.registryUnavailable"))?;
        if bytes.len() > 5 * 1024 * 1024 {
            return Err(crate::common::messages::code(
                "backend.acp.registryTooLarge",
            ));
        }
        let parsed: RegistryPayload = serde_json::from_slice(&bytes)
            .map_err(|_| crate::common::messages::code("backend.acp.registryInvalid"))?;
        Ok(AcpRegistry {
            agents: parsed.agents,
            supported_binary_target: supported_binary_target(),
        })
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("ai", error))
}

#[command]
pub async fn acp_prepare_registry_agent(
    app: AppHandle,
    agent_id: String,
) -> Result<AcpAgentConfig, String> {
    let result: Result<_, String> = async {
        if agent_id.len() > 100
            || !agent_id
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        {
            return Err(crate::common::messages::code("backend.acp.agentIdInvalid"));
        }
        let registry = acp_fetch_registry().await?;
        let agent = registry
            .agents
            .into_iter()
            .find(|agent| agent.id == agent_id)
            .ok_or_else(|| crate::common::messages::code("backend.acp.agentUnavailable"))?;
        let distribution = &agent.distribution;
        let (command, package, args) = if let Some(value) = distribution.get("npx") {
            let package = value
                .get("package")
                .and_then(Value::as_str)
                .ok_or_else(|| crate::common::messages::code("backend.acp.registryInvalid"))?;
            ("npx", package, value.get("args"))
        } else if let Some(value) = distribution.get("uvx") {
            let package = value
                .get("package")
                .and_then(Value::as_str)
                .ok_or_else(|| crate::common::messages::code("backend.acp.registryInvalid"))?;
            ("uvx", package, value.get("args"))
        } else {
            return prepare_registry_binary_agent(&app, agent).await;
        };
        if !safe_package_name(package) {
            return Err(crate::common::messages::code("backend.acp.registryInvalid"));
        }
        let extra_args = parse_safe_args(args)?;
        let mut launch_args = Vec::with_capacity(extra_args.len() + 2);
        if command == "npx" {
            launch_args.push("-y".to_owned());
        }
        launch_args.push(package.to_owned());
        launch_args.extend(extra_args);
        Ok(AcpAgentConfig {
            id: agent.id,
            name: agent.name,
            version: Some(agent.version),
            description: Some(agent.description),
            source: "registry".into(),
            command: command.into(),
            launch_mode: None,
            args: launch_args,
        })
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("ai", error))
}

async fn prepare_registry_binary_agent(
    app: &AppHandle,
    agent: AcpRegistryAgent,
) -> Result<AcpAgentConfig, String> {
    let data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "Could not locate Stage0's local data directory")?;
    binary_install::install(&data_dir, agent).await
}
