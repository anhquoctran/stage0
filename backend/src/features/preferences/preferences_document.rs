use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferencesDocument {
    pub content: String,
    pub revision: String,
    pub path: String,
    pub migrated: bool,
    pub settings: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validation_error: Option<String>,
}
