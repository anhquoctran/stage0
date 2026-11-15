use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelatedHit {
    pub file_path: String,
    pub side: String,
    pub start_line: usize,
    pub end_line: usize,
    pub distance: f64,
}
