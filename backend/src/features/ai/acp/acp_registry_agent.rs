use serde::{Deserialize, Serialize};
use serde_json::Value;

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
