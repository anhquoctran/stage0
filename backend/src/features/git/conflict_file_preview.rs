use super::ConflictRegion;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictFilePreview {
    pub file_path: String,
    pub base_branch: String,
    pub compare_branch: String,
    pub conflict_type: String,
    pub has_conflict_markers: bool,
    pub conflict_markers_count: usize,
    pub merged_content: String,
    pub base_content: Option<String>,
    pub compare_content: Option<String>,
    pub conflict_regions: Vec<ConflictRegion>,
}
