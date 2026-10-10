#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct VirtualMrSessionDb {
    pub id: String,
    pub repo_id: String,
    pub title: String,
    pub description: Option<String>,
    pub base_branch: String,
    pub compare_branch: String,
    pub status: String,
    pub assignee_name: Option<String>,
    pub assignee_email: Option<String>,
    pub is_pinned: bool,
    pub sandbox_adapter_type: String,
    pub sandbox_instance_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub label_ids: Vec<String>,
}
