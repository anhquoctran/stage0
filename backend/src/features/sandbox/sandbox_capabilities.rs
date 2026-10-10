use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SandboxCapabilities {
    pub can_run_commands: bool,
    pub can_write_files: bool,
    pub isolation_level: String, // "in_memory" | "local_worktree" | "container"
    pub requires_daemon: bool,
    pub supports_networking: bool,
}
