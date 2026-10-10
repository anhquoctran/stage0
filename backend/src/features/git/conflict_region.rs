use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictRegion {
    pub start_line: usize,
    pub end_line: usize,
    pub base_code: String,
    pub compare_code: String,
}
