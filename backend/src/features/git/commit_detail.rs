use super::ChangedFile;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitDetail {
    pub hash: String,
    pub parents: Vec<String>,
    pub author_name: String,
    pub author_email: String,
    pub authored_date: String,
    pub message: String,
    pub files: Vec<ChangedFile>,
    pub raw_diff: String,
    pub truncated: bool,
}
