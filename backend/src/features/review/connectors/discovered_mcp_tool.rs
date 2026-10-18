#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredMcpTool {
    pub name: String,
    pub namespaced_name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
    /// Untrusted server annotation. Never sufficient for authorization.
    pub read_only_hint: Option<bool>,
}
