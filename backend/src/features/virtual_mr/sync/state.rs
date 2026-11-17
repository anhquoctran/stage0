use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MrSyncState {
    pub session_id: String,
    pub repo_id: String,
    pub base_branch: String,
    pub compare_branch: String,
    pub base_sha: Option<String>,
    pub head_sha: Option<String>,
    pub revision: i64,
    pub needs_review: bool,
    pub ref_status: String,
    pub session_status: String,
    pub reviewers: BTreeMap<String, String>,
}
