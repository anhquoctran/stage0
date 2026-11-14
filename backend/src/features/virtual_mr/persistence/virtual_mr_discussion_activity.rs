#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VirtualMrDiscussionActivity {
    pub id: String,
    pub session_id: String,
    pub discussion_id: String,
    pub action: String,
    pub actor_id: String,
    pub actor_name: String,
    pub reviewer_name: String,
    pub file_path: Option<String>,
    pub created_at: String,
}
