use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DynamicModelInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub reasoning_efforts: Option<Vec<String>>,
    pub supports_fast_mode: Option<bool>,
}
