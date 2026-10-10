use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BlameAuthorStat {
    pub name: String,
    pub email: String,
    pub line_count: usize,
    pub percentage: f32,
}
