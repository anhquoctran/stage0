use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs::File;
use std::io::{BufRead, BufReader, Cursor};
use std::process::Command;
use std::time::Duration;

use super::{SandboxInstanceInfo, SandboxManager, SandboxType};
use crate::process::run_bounded_command;

#[derive(Debug, Serialize, Deserialize)]
pub struct ReadFileRangeArgs {
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecuteTerminalCmdArgs {
    pub command: String,
    pub args: Vec<String>,
}

const MAX_TOOL_FILE_SCAN_BYTES: usize = 64 * 1024 * 1024;
const HARD_MAX_TOOL_OUTPUT_BYTES: usize = 1024 * 1024;
const TOOL_OUTPUT_TRUNCATION_NOTICE: &str = "\n[File output truncated by the sandbox read limit.]";
const DOCKER_READ_TIMEOUT: Duration = Duration::from_secs(120);

fn normalize_tool_file_path(file_path: &str) -> Result<String, String> {
    if file_path.len() > 4096 {
        return Err("File path exceeds the 4096-byte safety limit".to_string());
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
        return Err("File path must be a relative path inside the sandbox workspace".to_string());
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
        return Err("File not found or unreadable in Docker sandbox".to_string());
    }

    let canonical_path = String::from_utf8_lossy(&resolved.stdout).trim().to_string();
    let Some(canonical_relative_path) = canonical_path.strip_prefix("/workspace/") else {
        return Err("Resolved file path is outside the Docker workspace".to_string());
    };
    if canonical_relative_path.is_empty() {
        return Err("Only files inside the Docker workspace can be read".to_string());
    }
    manager
        .guardrails()
        .evaluate_resolved_read_path(canonical_relative_path)
        .map_err(|violation| format!("🛡️ Guardrail Policy Blocked: {}", violation.message))?;

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
        return Err("File not found or unreadable in Docker sandbox".to_string());
    }

    read_file_range(
        &mut Cursor::new(output.stdout),
        start_line,
        end_line,
        output_limit,
    )
}

struct FileRangeResult {
    content: String,
    total_lines: Option<usize>,
    actual_end_line: usize,
    output_truncated: bool,
}

/// Reads only the requested line range, retaining at most the configured
/// response size and scanning at most 64 MiB. It never accumulates the file or
/// an individual giant line in memory.
fn read_file_range<R: BufRead>(
    reader: &mut R,
    start_line: usize,
    end_line: usize,
    output_limit: usize,
) -> Result<FileRangeResult, String> {
    let output_limit = output_limit.min(HARD_MAX_TOOL_OUTPUT_BYTES);
    let content_limit = output_limit.saturating_sub(TOOL_OUTPUT_TRUNCATION_NOTICE.len());
    let mut output = Vec::with_capacity(content_limit.min(16 * 1024));
    let mut line_number = 1usize;
    let mut completed_lines = 0usize;
    let mut selected_lines = 0usize;
    let mut line_started = false;
    let mut current_line_has_bytes = false;
    let mut output_truncated = false;
    let mut scanned_bytes = 0usize;

    loop {
        let available = reader
            .fill_buf()
            .map_err(|error| format!("Failed to read file range: {}", error))?;
        if available.is_empty() {
            if current_line_has_bytes {
                completed_lines += 1;
            }
            let actual_end_line = end_line.min(completed_lines);
            let mut content = String::from_utf8_lossy(&output).into_owned();
            if output_truncated {
                content.push_str(TOOL_OUTPUT_TRUNCATION_NOTICE);
            }
            return Ok(FileRangeResult {
                content,
                total_lines: Some(completed_lines),
                actual_end_line,
                output_truncated,
            });
        }

        if scanned_bytes >= MAX_TOOL_FILE_SCAN_BYTES {
            if line_number < end_line {
                return Err("Requested file range is beyond the 64 MiB scan limit".to_string());
            }
            output_truncated = true;
            let mut content = String::from_utf8_lossy(&output).into_owned();
            content.push_str(TOOL_OUTPUT_TRUNCATION_NOTICE);
            return Ok(FileRangeResult {
                content,
                total_lines: None,
                actual_end_line: line_number.min(end_line),
                output_truncated,
            });
        }

        let scan_count = available
            .len()
            .min(MAX_TOOL_FILE_SCAN_BYTES - scanned_bytes);
        let scanned = &available[..scan_count];
        let newline_at = scanned.iter().position(|byte| *byte == b'\n');
        let content_count = newline_at.unwrap_or(scanned.len());
        let line_selected = line_number >= start_line && line_number <= end_line;

        if line_selected {
            if !line_started {
                if selected_lines > 0 && !output_truncated {
                    if output.len() < content_limit {
                        output.push(b'\n');
                    } else {
                        output_truncated = true;
                    }
                }
                selected_lines += 1;
                line_started = true;
            }

            if !output_truncated {
                let remaining = content_limit.saturating_sub(output.len());
                let keep = content_count.min(remaining);
                output.extend_from_slice(&scanned[..keep]);
                if keep < content_count {
                    output_truncated = true;
                }
            }
        }
        current_line_has_bytes |= content_count > 0;

        let consumed = content_count + usize::from(newline_at.is_some());
        reader.consume(consumed);
        scanned_bytes += consumed;

        if newline_at.is_some() {
            if line_selected && output.last() == Some(&b'\r') {
                output.pop();
            }
            completed_lines += 1;
            line_number += 1;
            current_line_has_bytes = false;
            line_started = false;

            if line_number > end_line {
                let more = reader
                    .fill_buf()
                    .map_err(|error| format!("Failed to inspect file range: {}", error))?;
                let total_lines = if more.is_empty() {
                    Some(completed_lines)
                } else {
                    None
                };
                let mut content = String::from_utf8_lossy(&output).into_owned();
                if output_truncated {
                    content.push_str(TOOL_OUTPUT_TRUNCATION_NOTICE);
                }
                return Ok(FileRangeResult {
                    content,
                    total_lines,
                    actual_end_line: end_line,
                    output_truncated,
                });
            }
        }
    }
}

/// Generates function calling schemas compatible with OpenAI, Anthropic, and MCP tools.
/// Strictly omits `execute_terminal_cmd` when the active sandbox is `InMemory`.
pub fn get_tool_schemas(
    sandbox_type: &SandboxType,
    policy: &super::guardrails::GuardrailPolicy,
) -> serde_json::Value {
    let mut tools = vec![
        json!({
            "name": "read_file_range",
            "description": "Read specific lines from a file in the active sandbox workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Relative path of the target file to inspect."
                    },
                    "start_line": {
                        "type": "integer",
                        "description": "1-indexed starting line number (inclusive)."
                    },
                    "end_line": {
                        "type": "integer",
                        "description": "1-indexed ending line number (inclusive)."
                    }
                },
                "required": ["file_path", "start_line", "end_line"]
            }
        }),
        json!({
            "name": "get_diff",
            "description": "Retrieve the virtual MR diff payload between base and compare branches in the sandbox.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }),
    ];

    // AI-generated commands must not run directly on the host. A Git worktree
    // is a filesystem layout, not an operating-system security boundary.
    if *sandbox_type == SandboxType::Docker
        && !policy.require_human_confirmation_for_commands
        && !policy.require_human_confirmation_for_writes
        && policy.mode != super::guardrails::GuardrailMode::Strict
    {
        tools.push(json!({
            "name": "execute_terminal_cmd",
            "description": "Execute build, test, or linter commands inside the Docker sandbox. Host Local Worktree command execution is not exposed to AI/MCP tools. Commands requiring human approval are blocked until an approval dialog exists.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Whitelisted toolchain command (e.g. 'cargo', 'npm', 'pytest', 'make')."
                    },
                    "args": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Arguments passed to the command."
                    }
                },
                "required": ["command", "args"]
            }
        }));
    }

    json!(tools)
}

/// Dispatches an AI / MCP tool execution to the appropriate sandbox adapter method.
pub fn dispatch_tool_call(
    manager: &SandboxManager,
    instance: &SandboxInstanceInfo,
    tool_name: &str,
    arguments: serde_json::Value,
) -> Result<serde_json::Value, String> {
    match tool_name {
        "read_file_range" => {
            let args: ReadFileRangeArgs = serde_json::from_value(arguments)
                .map_err(|e| format!("Invalid arguments for read_file_range: {}", e))?;

            if args.start_line == 0 || args.end_line < args.start_line {
                return Err("start_line must be >= 1 and <= end_line".to_string());
            }

            let relative_path = normalize_tool_file_path(&args.file_path)?;

            // 🛡️ Guardrails: Evaluate path safety, sensitive file protection, line count limit
            manager
                .guardrails()
                .evaluate_read_file(&args.file_path, args.start_line, args.end_line)
                .map_err(|v| format!("🛡️ Guardrail Policy Blocked: {}", v.message))?;

            let range = match instance.adapter_type {
                SandboxType::InMemory => {
                    let safe_path =
                        crate::git::resolve_safe_repo_path(&instance.repo_path, &args.file_path)?;
                    manager
                        .guardrails()
                        .evaluate_resolved_read_path(&safe_path.to_string_lossy())
                        .map_err(|violation| {
                            format!("🛡️ Guardrail Policy Blocked: {}", violation.message)
                        })?;
                    read_local_file_range(&safe_path, args.start_line, args.end_line, manager)?
                }
                SandboxType::LocalWorktree => {
                    let worktree_dir = instance
                        .worktree_path
                        .as_deref()
                        .ok_or_else(|| "Worktree path missing for sandbox instance".to_string())?;
                    let safe_path =
                        crate::git::resolve_safe_repo_path(worktree_dir, &args.file_path)?;
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
            let args: ExecuteTerminalCmdArgs = serde_json::from_value(arguments)
                .map_err(|e| format!("Invalid arguments for execute_terminal_cmd: {}", e))?;

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
                .map_err(|v| format!("🛡️ Guardrail Policy Blocked: {}", v.message))?;

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
        unknown => Err(format!("Unknown sandbox tool '{}'", unknown)),
    }
}

fn read_local_file_range(
    path: &std::path::Path,
    start_line: usize,
    end_line: usize,
    manager: &SandboxManager,
) -> Result<FileRangeResult, String> {
    let metadata = std::fs::symlink_metadata(path)
        .map_err(|error| format!("Failed to inspect repository file: {}", error))?;
    if !metadata.file_type().is_file() {
        return Err("Only regular files can be read by the sandbox tool".to_string());
    }
    let file = File::open(path)
        .map_err(|error| format!("Failed to read file in repository: {}", error))?;
    read_file_range(
        &mut BufReader::new(file),
        start_line,
        end_line,
        manager.guardrails().get_policy().max_output_bytes,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn rejects_non_relative_tool_paths() {
        for path in [
            "../secret",
            "src/../../secret",
            "/etc/passwd",
            "C:\\secret",
            "src\\..\\secret",
            "src/file:stream",
        ] {
            assert!(normalize_tool_file_path(path).is_err(), "accepted {path:?}");
        }
        assert_eq!(
            normalize_tool_file_path("src\\main.rs").unwrap(),
            "src/main.rs"
        );
    }

    #[test]
    fn exposes_terminal_tools_only_for_docker() {
        let mut policy = super::super::guardrails::GuardrailPolicy::balanced();
        for sandbox in [SandboxType::InMemory, SandboxType::LocalWorktree] {
            let tools = get_tool_schemas(&sandbox, &policy).to_string();
            assert!(!tools.contains("execute_terminal_cmd"));
        }
        assert!(!get_tool_schemas(&SandboxType::Docker, &policy)
            .to_string()
            .contains("execute_terminal_cmd"));
        policy.require_human_confirmation_for_writes = false;
        assert!(get_tool_schemas(&SandboxType::Docker, &policy)
            .to_string()
            .contains("execute_terminal_cmd"));
    }

    #[test]
    fn reads_only_requested_lines_and_reports_unknown_total() {
        let mut reader = Cursor::new(b"one\ntwo\nthree\nfour".to_vec());
        let range = read_file_range(&mut reader, 2, 3, 1024).unwrap();
        assert_eq!(range.content, "two\nthree");
        assert_eq!(range.actual_end_line, 3);
        assert_eq!(range.total_lines, None);
        assert!(!range.output_truncated);
    }

    #[test]
    fn caps_a_single_oversized_line_without_buffering_it_all() {
        let mut reader = Cursor::new(vec![b'x'; 1024 * 1024]);
        let range = read_file_range(&mut reader, 1, 1, 128).unwrap();
        assert!(range.output_truncated);
        assert!(range.content.len() <= 128);
        assert!(range.content.ends_with(TOOL_OUTPUT_TRUNCATION_NOTICE));
    }
}
