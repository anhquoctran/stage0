use super::{
    cli_readiness::{self, CliHarnessReadiness},
    mcp_http_client::McpHttpClient,
    McpDiscoveryReport, McpDiscoveryRequest,
};

#[tauri::command]
pub async fn discover_harness_mcp(
    request: McpDiscoveryRequest,
) -> Result<McpDiscoveryReport, String> {
    static SLOTS: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(2);
    let _permit = SLOTS
        .try_acquire()
        .map_err(|_| "At most two MCP discoveries can run concurrently")?;
    McpHttpClient::probe(&request).await
}

#[tauri::command]
pub async fn inspect_harness_cli(cli_type: String) -> Result<CliHarnessReadiness, String> {
    tauri::async_runtime::spawn_blocking(move || cli_readiness::inspect(&cli_type))
        .await
        .map_err(|_| "CLI preflight failed")?
}
