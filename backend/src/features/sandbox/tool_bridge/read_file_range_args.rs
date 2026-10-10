use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ReadFileRangeArgs {
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
}
