use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicModelInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}
