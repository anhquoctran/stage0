#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpDiscoveryReport {
    pub connection_id: String,
    pub endpoint_fingerprint: String,
    pub catalog_fingerprint: String,
    pub protocol_version: String,
    pub server_name: String,
    pub server_version: String,
    pub tools: Vec<super::DiscoveredMcpTool>,
    pub discovered_at: String,
    pub attached_to_harness: bool,
}
