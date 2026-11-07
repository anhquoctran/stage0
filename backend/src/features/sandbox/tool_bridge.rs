mod read_file_range_args;
pub use read_file_range_args::ReadFileRangeArgs;
mod execute_terminal_cmd_args;
pub use execute_terminal_cmd_args::ExecuteTerminalCmdArgs;
mod file_range_result;
use file_range_result::FileRangeResult;

use serde_json::json;
use std::fs::File;
use std::io::{BufReader, Cursor};
use std::process::Command;
use std::time::Duration;

use super::{SandboxInstanceInfo, SandboxManager, SandboxType};
use crate::common::process::run_bounded_command;

const MAX_TOOL_FILE_SCAN_BYTES: usize = 64 * 1024 * 1024;
const HARD_MAX_TOOL_OUTPUT_BYTES: usize = 1024 * 1024;
const TOOL_OUTPUT_TRUNCATION_NOTICE: &str = "\n[File output truncated by the sandbox read limit.]";
const DOCKER_READ_TIMEOUT: Duration = Duration::from_secs(120);

fn normalize_tool_file_path(file_path: &str) -> Result<String, String> {
    if file_path.len() > 4096 {
        return Err(crate::common::messages::code(
            "backend.sandbox.filePathTooLong",
        ));
    }
    let normalized = file_path.replace('\\', "/");
    let components = normalized.split('/').collect::<Vec<_>>();

    if normalized.is_empty()
        || normalized.starts_with('/')
        || normalized.contains('\0')
        || components
            .iter()
            .any(|part| part.is_empty() || *part == "." || *part == ".." || part.contains(':'))
    {
        return Err(crate::common::messages::code(
            "backend.sandbox.filePathNotRelative",
        ));
    }

    Ok(components.join("/"))
}

fn read_docker_file_range(
    cid: &str,
    relative_path: &str,
    start_line: usize,
    end_line: usize,
    output_limit: usize,
    manager: &SandboxManager,
) -> Result<FileRangeResult, String> {
    let requested_path = format!("/workspace/{}", relative_path);
    let mut resolve = Command::new("docker");
    resolve.args(["exec", cid, "readlink", "-f", &requested_path]);
    let resolved = run_bounded_command(&mut resolve, 4096, 16 * 1024, Duration::from_secs(5))?;
    if !resolved.status.success() || resolved.output_truncated {
        return Err(crate::common::messages::code(
            "backend.sandbox.fileNotFound",
        ));
    }

    let canonical_path = String::from_utf8_lossy(&resolved.stdout).trim().to_string();
    let Some(canonical_relative_path) = canonical_path.strip_prefix("/workspace/") else {
        return Err(crate::common::messages::code(
            "backend.sandbox.filePathOutsideWorkspace",
        ));
    };
    if canonical_relative_path.is_empty() {
        return Err(crate::common::messages::code(
            "backend.sandbox.fileOutsideWorkspace",
        ));
    }
    manager
        .guardrails()
        .evaluate_resolved_read_path(canonical_relative_path)
        .map_err(|violation| guardrail_error(&violation.message))?;

    // The path is an argument, never shell-interpolated. Use the container's
    // shell only to reject non-regular files before `cat` (for example FIFOs).
    let mut read = Command::new("docker");
    read.args([
        "exec",
        cid,
        "sh",
        "-c",
        "test -f \"$1\" || exit 66; cat \"$1\"",
        "stage0-read-file",
        &canonical_path,
    ]);
    let output = run_bounded_command(
        &mut read,
        MAX_TOOL_FILE_SCAN_BYTES,
        16 * 1024,
        DOCKER_READ_TIMEOUT,
    )?;
    if !output.status.success() && !output.output_truncated {
        return Err(crate::common::messages::code(
            "backend.sandbox.dockerFileNotFound",
        ));
    }

    read_file_range(
        &mut Cursor::new(output.stdout),
        start_line,
        end_line,
        output_limit,
    )
}

mod file_reader;
use file_reader::read_file_range;

mod schemas;
pub use schemas::get_tool_schemas;

/// Dispatches an AI / MCP tool execution to the appropriate sandbox adapter method.
pub fn dispatch_tool_call(
    manager: &SandboxManager,
    instance: &SandboxInstanceInfo,
    tool_name: &str,
    arguments: serde_json::Value,
) -> Result<serde_json::Value, String> {
    match tool_name {
        "read_file_range" => {
            let args: ReadFileRangeArgs = serde_json::from_value(arguments).map_err(|e| {
                crate::common::messages::failure(
                    "backend.sandbox.invalidReadFileRangeArgs",
                    serde_json::json!({ "error": e.to_string() }),
                    format!("Invalid arguments for read_file_range: {}", e),
                )
            })?;

            if args.start_line == 0 || args.end_line < args.start_line {
                return Err(crate::common::messages::code(
                    "backend.sandbox.invalidLineBounds",
                ));
            }

            let relative_path = normalize_tool_file_path(&args.file_path)?;

            // 🛡️ Guardrails: Evaluate path safety, sensitive file protection, line count limit
            manager
                .guardrails()
                .evaluate_read_file(&args.file_path, args.start_line, args.end_line)
                .map_err(|v| guardrail_error(&v.message))?;

            let range = match instance.adapter_type {
                SandboxType::InMemory => {
                    let safe_path = crate::features::git::resolve_safe_repo_path(
                        &instance.repo_path,
                        &args.file_path,
                    )?;
                    manager
                        .guardrails()
                        .evaluate_resolved_read_path(&safe_path.to_string_lossy())
                        .map_err(|violation| {
                            format!("🛡️ Guardrail Policy Blocked: {}", violation.message)
                        })?;
                    read_local_file_range(&safe_path, args.start_line, args.end_line, manager)?
                }
                SandboxType::LocalWorktree => {
                    let worktree_dir = instance.worktree_path.as_deref().ok_or_else(|| {
                        crate::common::messages::code("backend.sandbox.worktreePathMissing")
                    })?;
                    let safe_path = crate::features::git::resolve_safe_repo_path(
                        worktree_dir,
                        &args.file_path,
                    )?;
                    manager
                        .guardrails()
                        .evaluate_resolved_read_path(&safe_path.to_string_lossy())
                        .map_err(|violation| {
                            format!("🛡️ Guardrail Policy Blocked: {}", violation.message)
                        })?;
                    read_local_file_range(&safe_path, args.start_line, args.end_line, manager)?
                }
                SandboxType::Docker => {
                    let cid = instance.container_id.as_deref().ok_or_else(|| {
                        "Container ID missing for Docker sandbox instance".to_string()
                    })?;
                    read_docker_file_range(
                        cid,
                        &relative_path,
                        args.start_line,
                        args.end_line,
                        manager.guardrails().get_policy().max_output_bytes,
                        manager,
                    )?
                }
            };

            Ok(json!({
                "file_path": args.file_path,
                "start_line": args.start_line,
                "end_line": range.actual_end_line,
                "total_lines": range.total_lines,
                "output_truncated": range.output_truncated,
                "content": range.content
            }))
        }
        "get_diff" => {
            // 🛡️ Guardrails: Record diff read audit
            manager.guardrails().record_diff_audit(
                &instance.repo_path,
                &instance.base_branch,
                &instance.compare_branch,
            );

            let diff_payload = manager.get_mr_diff(
                &instance.repo_path,
                &instance.base_branch,
                &instance.compare_branch,
            )?;
            serde_json::to_value(diff_payload).map_err(|e| e.to_string())
        }
        "execute_terminal_cmd" => {
            let args: ExecuteTerminalCmdArgs = serde_json::from_value(arguments).map_err(|e| {
                crate::common::messages::failure(
                    "backend.sandbox.invalidExecuteTerminalCmdArgs",
                    serde_json::json!({ "error": e.to_string() }),
                    format!("Invalid arguments for execute_terminal_cmd: {}", e),
                )
            })?;

            if instance.adapter_type == SandboxType::LocalWorktree {
                let violation = super::guardrails::GuardrailViolation {
                    rule: "HOST_COMMAND_EXECUTION_DISABLED_FOR_TOOLS".to_string(),
                    severity: super::guardrails::GuardrailSeverity::Critical,
                    message: "AI/MCP terminal execution is disabled for Local Worktree because its commands run on the host with the current user's permissions. Select Docker to use the command tool.".to_string(),
                };
                manager.guardrails().record_policy_denial(
                    "execute_terminal_cmd",
                    &args.command,
                    violation.clone(),
                );
                return Err(format!(
                    "🛡️ Guardrail Policy Blocked: {}",
                    violation.message
                ));
            }

            if manager
                .guardrails()
                .get_policy()
                .require_human_confirmation_for_writes
            {
                let violation = super::guardrails::GuardrailViolation {
                    rule: "WRITE_CONFIRMATION_REQUIRED".to_string(),
                    severity: super::guardrails::GuardrailSeverity::High,
                    message: "Terminal commands can modify files. Write confirmation is enabled, but Stage0 has no approval dialog for tool calls, so this command was not executed.".to_string(),
                };
                manager.guardrails().record_policy_denial(
                    "execute_terminal_cmd",
                    &args.command,
                    violation.clone(),
                );
                return Err(format!(
                    "🛡️ Guardrail Policy Blocked: {}",
                    violation.message
                ));
            }

            // 🛡️ Guardrails: Evaluate command safety, whitelist, blacklist, patterns, isolation
            let eval = manager
                .guardrails()
                .evaluate_command(&args.command, &args.args, &instance.adapter_type)
                .map_err(|v| guardrail_error(&v.message))?;

            if eval.requires_confirmation {
                manager.guardrails().record_policy_denial(
                    "execute_terminal_cmd",
                    &args.command,
                    super::guardrails::GuardrailViolation {
                        rule: "HUMAN_CONFIRMATION_REQUIRED".to_string(),
                        severity: super::guardrails::GuardrailSeverity::High,
                        message: "The command requires human confirmation. Stage0 has no approval dialog for tool calls, so it was not executed.".to_string(),
                    },
                );
                return Err(
                    "Guardrail policy requires human confirmation; Stage0 has no approval dialog for tool calls, so the command was not executed."
                        .to_string(),
                );
            }

            let mut res = manager.execute_command(&instance.id, &args.command, &args.args)?;

            // 🛡️ Guardrails: Truncate oversized terminal output buffers
            let (trunc_stdout, s_out_truncated) =
                manager.guardrails().truncate_output_if_needed(&res.stdout);
            let (trunc_stderr, s_err_truncated) =
                manager.guardrails().truncate_output_if_needed(&res.stderr);
            if s_out_truncated {
                res.stdout = trunc_stdout.into_owned();
            }
            if s_err_truncated {
                res.stderr = trunc_stderr.into_owned();
            }

            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        unknown => Err(crate::common::messages::message(
            "backend.sandbox.unknownTool",
            serde_json::json!({ "tool": unknown }),
        )),
    }
}

fn read_local_file_range(
    path: &std::path::Path,
    start_line: usize,
    end_line: usize,
    manager: &SandboxManager,
) -> Result<FileRangeResult, String> {
    let metadata = std::fs::symlink_metadata(path).map_err(|error| {
        crate::common::messages::failure(
            "backend.sandbox.inspectRepoFileFailed",
            serde_json::json!({ "error": error.to_string() }),
            format!("Failed to inspect repository file: {}", error),
        )
    })?;
    if !metadata.file_type().is_file() {
        return Err(crate::common::messages::code(
            "backend.sandbox.onlyRegularFiles",
        ));
    }
    let file = File::open(path).map_err(|error| {
        crate::common::messages::failure(
            "backend.sandbox.readRepoFileFailed",
            serde_json::json!({ "error": error.to_string() }),
            format!("Failed to read file in repository: {}", error),
        )
    })?;
    read_file_range(
        &mut BufReader::new(file),
        start_line,
        end_line,
        manager.guardrails().get_policy().max_output_bytes,
    )
}

fn guardrail_error(message: &str) -> String {
    crate::common::messages::failure(
        "backend.sandbox.guardrailPolicyBlocked",
        serde_json::json!({ "message": message }),
        format!("🛡️ Guardrail Policy Blocked: {}", message),
    )
}

#[cfg(test)]
mod tests;
