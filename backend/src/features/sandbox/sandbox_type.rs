use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SandboxType {
    InMemory,
    LocalWorktree,
    Docker,
}

impl Default for SandboxType {
    fn default() -> Self {
        SandboxType::InMemory
    }
}

impl std::fmt::Display for SandboxType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SandboxType::InMemory => write!(f, "in_memory"),
            SandboxType::LocalWorktree => write!(f, "local_worktree"),
            SandboxType::Docker => write!(f, "docker"),
        }
    }
}
