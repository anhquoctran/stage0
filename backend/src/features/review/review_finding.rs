use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReviewFinding {
    pub file_path: String,
    pub side: String,
    pub start_line: usize,
    pub end_line: usize,
    pub severity: String,
    pub title: String,
    pub body: String,
    pub evidence: String,
}
