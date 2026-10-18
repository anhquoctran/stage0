#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct McpDiscoveryRequest {
    pub connection_id: String,
    pub url: String,
    pub allow_network: bool,
}
