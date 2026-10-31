use super::{
    cli_readiness::{self, CliHarnessReadiness},
    mcp_http_client::McpHttpClient,
    McpDiscoveryReport, McpDiscoveryRequest,
};

#[tauri::command]
pub async fn discover_harness_mcp(
    request: McpDiscoveryRequest,
) -> Result<McpDiscoveryReport, String> {
    let result: Result<_, String> = async {
        static SLOTS: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(2);
        let _permit = SLOTS.try_acquire().map_err(|_| {
            crate::common::messages::failure(
                "backend.review.mcpConcurrentDiscoveryLimit",
                serde_json::json!({}),
                "At most two MCP discoveries can run concurrently".into(),
            )
        })?;
        McpHttpClient::probe(&request).await
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("review", error))
}

#[tauri::command]
pub async fn inspect_harness_cli(cli_type: String) -> Result<CliHarnessReadiness, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || cli_readiness::inspect(&cli_type))
            .await
            .map_err(|_| {
                crate::common::messages::failure(
                    "backend.review.cliPreflightFailed",
                    serde_json::json!({}),
                    "CLI preflight failed".into(),
                )
            })?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("review", error))
}
