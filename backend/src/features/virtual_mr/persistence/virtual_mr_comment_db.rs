#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct VirtualMrCommentDb {
    pub id: String,
    pub discussion_id: String,
    pub author_type: String,
    pub author_id: String,
    pub author_name: String,
    pub author_avatar: Option<String>,
    pub body: String,
    pub review_action: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
