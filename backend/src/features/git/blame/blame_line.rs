use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BlameLine {
    pub line_no: usize,
    pub orig_line_no: usize,
    pub commit_id: String,
    pub content: String,
}
