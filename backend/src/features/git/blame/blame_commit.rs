use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BlameCommit {
    pub commit_id: String,
    pub author: String,
    pub author_mail: String,
    pub author_time: i64,
    pub author_tz: String,
    pub committer: String,
    pub committer_mail: String,
    pub committer_time: i64,
    pub summary: String,
    pub previous_commit: Option<String>,
}
