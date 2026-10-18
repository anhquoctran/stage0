use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewSnapshot {
    pub repo_path: String,
    pub base_sha: String,
    pub head_sha: String,
    pub merge_base_sha: String,
    pub changed_files: Vec<String>,
    #[serde(skip)]
    pub tree_files: Vec<String>,
    pub excluded_files: Vec<String>,
}
