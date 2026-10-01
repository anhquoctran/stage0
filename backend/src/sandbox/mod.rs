use serde::{Deserialize, Serialize};
use crate::git::{ConflictFilePreview, ConflictReport, MrDiffPayload};

pub mod guardrails;
pub mod in_memory;
pub mod local_worktree;
pub mod docker;
pub mod manager;
pub mod sync;
pub mod tool_bridge;

pub use guardrails::{
    GuardrailAuditEvent, GuardrailEvaluationResult, GuardrailMode, GuardrailPolicy,
    GuardrailSeverity, GuardrailViolation, GuardrailsEngine,
};
pub use in_memory::InMemorySandboxAdapter;
pub use local_worktree::LocalWorktreeSandboxAdapter;
pub use docker::DockerSandboxAdapter;
pub use manager::SandboxManager;
pub use sync::sync_changes_to_sandbox;
pub use tool_bridge::{get_tool_schemas, dispatch_tool_call};

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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SandboxCapabilities {
    pub can_run_commands: bool,
    pub can_write_files: bool,
    pub isolation_level: String, // "in_memory" | "local_worktree" | "container"
    pub requires_daemon: bool,
    pub supports_networking: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SandboxAdapterInfo {
    pub adapter_type: SandboxType,
    pub name: String,
    pub description: String,
    pub is_available: bool,
    pub version_info: Option<String>,
    pub status_message: String,
    pub capabilities: SandboxCapabilities,
}

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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SandboxExecutionResult {
    pub command: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u64,
}

pub trait SandboxAdapter: Send + Sync {
    fn adapter_type(&self) -> SandboxType;
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn capabilities(&self) -> SandboxCapabilities;
    fn get_adapter_info(&self) -> SandboxAdapterInfo;

    fn get_diff(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
    ) -> Result<MrDiffPayload, String>;

    fn check_conflicts(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
    ) -> Result<ConflictReport, String>;

    fn get_conflict_preview(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
        file_path: &str,
    ) -> Result<ConflictFilePreview, String>;

    fn create_instance(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
    ) -> Result<SandboxInstanceInfo, String>;

    fn destroy_instance(
        &self,
        instance: &SandboxInstanceInfo,
    ) -> Result<(), String>;

    fn execute_command(
        &self,
        instance: &SandboxInstanceInfo,
        command: &str,
        args: &[String],
    ) -> Result<SandboxExecutionResult, String>;
}
