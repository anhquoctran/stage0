use super::GitGraphCommit;
use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct GitGraph {
    pub branch: String,
    pub is_detached: bool,
    pub truncated: bool,
    pub commits: Vec<GitGraphCommit>,
}
