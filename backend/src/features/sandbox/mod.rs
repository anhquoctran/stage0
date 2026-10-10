mod sandbox_type;
pub use sandbox_type::SandboxType;
mod sandbox_capabilities;
pub use sandbox_capabilities::SandboxCapabilities;
mod sandbox_adapter_info;
pub use sandbox_adapter_info::SandboxAdapterInfo;
mod sandbox_instance_info;
pub use sandbox_instance_info::SandboxInstanceInfo;
mod sandbox_execution_result;
pub use sandbox_execution_result::SandboxExecutionResult;
mod sandbox_adapter;
pub use sandbox_adapter::SandboxAdapter;

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
pub mod commands;
