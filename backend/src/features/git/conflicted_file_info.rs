use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictedFileInfo {
    pub path: String,
    pub conflict_type: String,
    pub message: String,
    pub conflict_markers_count: usize,
}
