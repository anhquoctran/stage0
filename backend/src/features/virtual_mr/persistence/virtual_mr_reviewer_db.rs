#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
pub struct VirtualMrReviewerDb {
    pub agent_id: String,
    pub agent_name: String,
    pub review_status: String,
    pub assigned_at: String,
}
