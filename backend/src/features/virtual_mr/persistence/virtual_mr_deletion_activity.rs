#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VirtualMrDeletionActivity {
    pub id: String,
    pub session_id: String,
    pub discussion_id: String,
    pub comment_id: String,
    pub target_kind: String,
    pub actor_id: String,
    pub actor_name: String,
    pub created_at: String,
}
