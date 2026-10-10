use super::ChangedFile;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MrDiffPayload {
    pub base_commit: String,
    pub compare_commit: String,
    pub files: Vec<ChangedFile>,
    pub raw_diff: String,
}
