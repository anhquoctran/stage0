use super::ConflictedFileInfo;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictReport {
    pub has_conflicts: bool,
    pub conflicted_files: Vec<String>,
    pub details: Vec<ConflictedFileInfo>,
    pub base_branch: Option<String>,
    pub compare_branch: Option<String>,
}
