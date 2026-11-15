use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositorySettingsDocument {
    pub revision: String,
    pub publication_sequence: u64,
    pub content: String,
    pub settings: Value,
    pub validation_error: Option<String>,
    pub labels: Vec<crate::features::git::persistence::RepoLabelDb>,
}
