use crate::git::{ConflictFilePreview, ConflictReport, MrDiffPayload};
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub mod docker;
pub mod guardrails;
pub mod in_memory;
pub mod local_worktree;
pub mod manager;
pub mod sync;
pub mod tool_bridge;

pub use docker::DockerSandboxAdapter;
pub use guardrails::{
    GuardrailAuditEvent, GuardrailEvaluationResult, GuardrailMode, GuardrailPolicy,
    GuardrailSeverity, GuardrailViolation, GuardrailsEngine,
};
pub use in_memory::InMemorySandboxAdapter;
pub use local_worktree::LocalWorktreeSandboxAdapter;
pub use manager::SandboxManager;
pub use sync::sync_changes_to_sandbox;
pub use tool_bridge::{dispatch_tool_call, get_tool_schemas};

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
    pub output_truncated: bool,
}

pub trait SandboxAdapter: Send + Sync {
    fn adapter_type(&self) -> SandboxType;
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn capabilities(&self) -> SandboxCapabilities;
    fn get_adapter_info(&self) -> SandboxAdapterInfo;

    fn get_diff(&self, repo_path: &str, base: &str, compare: &str)
        -> Result<MrDiffPayload, String>;

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

    fn destroy_instance(&self, instance: &SandboxInstanceInfo) -> Result<(), String>;

    fn execute_command(
        &self,
        instance: &SandboxInstanceInfo,
        command: &str,
        args: &[String],
        timeout: Duration,
    ) -> Result<SandboxExecutionResult, String>;
}

const ALLOWED_SANDBOX_COMMANDS: &[&str] = &[
    "git", "cargo", "rustc", "npm", "npx", "pnpm", "yarn", "bun", "node", "deno", "go", "python",
    "python3", "pytest", "mvn", "gradle", "make", "cmake", "dotnet",
];

pub(crate) fn validate_sandbox_command(command: &str, args: &[String]) -> Result<String, String> {
    const MAX_ARGS: usize = 256;
    const MAX_ARG_BYTES: usize = 64 * 1024;
    const MAX_TOTAL_ARG_BYTES: usize = 1024 * 1024;
    const MAX_COMMAND_BYTES: usize = 32;

    let trimmed_command = command.trim();
    if trimmed_command.is_empty() || trimmed_command.len() > MAX_COMMAND_BYTES {
        return Err("Command name is empty or exceeds the 32-byte limit".to_string());
    }
    if trimmed_command.contains('/')
        || trimmed_command.contains('\\')
        || trimmed_command.contains(':')
    {
        return Err(
            "Command paths are not permitted; only approved toolchain commands can run".to_string(),
        );
    }
    if args.len() > MAX_ARGS {
        return Err(format!(
            "Command exceeds the {}-argument safety limit",
            MAX_ARGS
        ));
    }
    let total_arg_bytes = args.iter().try_fold(0usize, |total, arg| {
        if arg.contains('\0') || arg.len() > MAX_ARG_BYTES {
            return None;
        }
        total.checked_add(arg.len())
    });
    if !matches!(total_arg_bytes, Some(size) if size <= MAX_TOTAL_ARG_BYTES) {
        return Err("Command arguments are invalid or exceed the 1 MiB safety limit".to_string());
    }

    let command_lower = trimmed_command.to_ascii_lowercase();
    let base_name = command_lower
        .strip_suffix(".exe")
        .or_else(|| command_lower.strip_suffix(".cmd"))
        .or_else(|| command_lower.strip_suffix(".bat"))
        .unwrap_or(&command_lower);
    if !ALLOWED_SANDBOX_COMMANDS.contains(&base_name) {
        return Err(format!(
            "Execution of '{}' is not permitted in the sandbox",
            trimmed_command
        ));
    }

    Ok(trimmed_command.to_string())
}
