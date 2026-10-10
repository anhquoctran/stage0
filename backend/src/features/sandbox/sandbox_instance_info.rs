use super::SandboxType;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SandboxInstanceInfo {
    pub id: String,
    pub adapter_type: SandboxType,
    pub repo_path: String,
    pub base_branch: String,
    pub compare_branch: String,
    pub worktree_path: Option<String>,
    pub container_id: Option<String>,
    pub created_at: String,
}
