use serde::{Deserialize, Serialize};

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
    pub launch_mode: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
}
