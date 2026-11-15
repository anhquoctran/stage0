#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackMemory {
    pub id: String,
    pub file_path: String,
    pub finding: String,
    pub feedback: String,
    pub reason: String,
    pub discussion_id: String,
    pub comment_id: String,
    pub updated_at: String,
}
