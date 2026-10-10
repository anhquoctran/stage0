use super::{BlameAuthorStat, BlameCommit, BlameLine};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileBlamePayload {
    pub file_path: String,
    pub revision: String,
    pub commits: HashMap<String, BlameCommit>,
    pub lines: Vec<BlameLine>,
    pub author_stats: Vec<BlameAuthorStat>,
    pub total_lines: usize,
    pub current_user_name: Option<String>,
    pub current_user_email: Option<String>,
}
