use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChangedFile {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String, // "ADDED" | "MODIFIED" | "DELETED" | "RENAMED"
    pub additions: u32,
    pub deletions: u32,
    pub is_binary: bool,
    pub is_conflicted: bool,
}
