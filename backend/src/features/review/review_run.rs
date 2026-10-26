use super::{ReviewFinding, ReviewRetryState, ReviewSnapshot};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRun {
    pub id: String,
    pub session_id: String,
    pub provider: String,
    pub model: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reviewer_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reviewer_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reply_discussion_id: Option<String>,
    #[serde(default)]
    pub endpoint: String,
    pub snapshot: ReviewSnapshot,
    pub status: String,
    pub summary: String,
    #[serde(default)]
    pub decision: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub generated_description: Option<String>,
    pub error: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub retry: Option<ReviewRetryState>,
    pub findings: Vec<ReviewFinding>,
    pub inspected_files: Vec<String>,
    pub turns: usize,
    pub tool_calls: usize,
    pub usage_tokens: u64,
    pub context_bytes: usize,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub published: bool,
    pub prompt_version: String,
}

impl ReviewRun {
    pub fn finish(&mut self, outcome: Result<(), String>) {
        self.retry = None;
        if let Err(error) = outcome {
            self.status = if error.starts_with("Review cancelled") {
                "cancelled"
            } else if error.contains("budget") || error.contains("deadline") {
                "incomplete"
            } else {
                "failed"
            }
            .into();
            self.error = Some(error);
        }
        self.finished_at = Some(chrono::Utc::now().to_rfc3339());
    }
}
