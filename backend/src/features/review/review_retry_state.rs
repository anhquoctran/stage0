use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRetryState {
    pub reason: String,
    pub http_status: Option<u16>,
    pub attempt: usize,
    pub max_attempts: usize,
    pub retry_at: String,
}
