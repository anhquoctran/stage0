use super::VirtualMrCommentDb;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct VirtualMrDiscussionDb {
    pub id: String,
    pub session_id: String,
    pub file_path: Option<String>,
    pub diff_side: Option<String>,
    pub line_number: Option<i64>,
    pub commit_id: Option<String>,
    #[serde(default)]
    pub content_hash: Option<String>,
    #[serde(default)]
    pub context_before: Option<String>,
    #[serde(default)]
    pub context_after: Option<String>,
    pub is_resolved: bool,
    pub resolve_type: String,
    pub resolved_by: Option<String>,
    pub resolved_at: Option<String>,
    pub verification_status: String,
    pub verified_by_bot: Option<String>,
    pub verified_at: Option<String>,
    pub created_at: String,
    #[serde(default)]
    pub comments: Vec<VirtualMrCommentDb>,
}
