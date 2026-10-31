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
    #[serde(serialize_with = "crate::common::messages::serialize_optional_error")]
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
            let code = error
                .strip_prefix(crate::common::messages::PREFIX)
                .and_then(|value| serde_json::from_str::<serde_json::Value>(value).ok())
                .and_then(|value| value["code"].as_str().map(str::to_owned));
            self.status = if code.as_deref() == Some("backend.review.cancelled")
                || error.starts_with("Review cancelled")
            {
                "cancelled"
            } else if matches!(
                code.as_deref(),
                Some(
                    "backend.review.deadlineExceeded"
                        | "backend.review.tokenBudgetExceeded"
                        | "backend.review.toolCallBudgetExceeded"
                        | "backend.review.turnBudgetExceeded"
                )
            ) || (code.is_none()
                && (error.contains("budget") || error.contains("deadline")))
            {
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
