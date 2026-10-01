use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;

use super::{SandboxInstanceInfo, SandboxManager, SandboxType};

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

/// Generates function calling schemas compatible with OpenAI, Anthropic, and MCP tools.
/// Strictly omits `execute_terminal_cmd` when the active sandbox is `InMemory`.
pub fn get_tool_schemas(sandbox_type: &SandboxType) -> serde_json::Value {
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

    // Only expose command execution tool for environments with physical execution isolation
    if *sandbox_type != SandboxType::InMemory {
        tools.push(json!({
            "name": "execute_terminal_cmd",
            "description": "Execute build, test, or linter toolchain commands in the isolated sandbox. Only available in Worktree and Docker environments.",
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

            // 🛡️ Guardrails: Evaluate path safety, sensitive file protection, line count limit
            manager
                .guardrails()
                .evaluate_read_file(&args.file_path, args.start_line, args.end_line)
                .map_err(|v| format!("🛡️ Guardrail Policy Blocked: {}", v.message))?;

            let content = match instance.adapter_type {
                SandboxType::InMemory => {
                    let safe_path = crate::git::resolve_safe_repo_path(&instance.repo_path, &args.file_path)?;
                    fs::read_to_string(&safe_path)
                        .map_err(|e| format!("Failed to read file in repo: {}", e))?
                }
                SandboxType::LocalWorktree => {
                    let worktree_dir = instance.worktree_path.as_deref().ok_or_else(|| {
                        "Worktree path missing for sandbox instance".to_string()
                    })?;
                    let safe_path = crate::git::resolve_safe_repo_path(worktree_dir, &args.file_path)?;
                    fs::read_to_string(&safe_path)
                        .map_err(|e| format!("Failed to read file in worktree: {}", e))?
                }
                SandboxType::Docker => {
                    let cid = instance.container_id.as_deref().ok_or_else(|| {
                        "Container ID missing for Docker sandbox instance".to_string()
                    })?;
                    let target_in_container = format!("/workspace/{}", args.file_path.trim_start_matches('/'));
                    let out = std::process::Command::new("docker")
                        .args(["exec", cid, "cat", &target_in_container])
                        .output()
                        .map_err(|e| format!("Docker cat failed: {}", e))?;
                    if !out.status.success() {
                        return Err(format!("File not found in container: {}", String::from_utf8_lossy(&out.stderr).trim()));
                    }
                    String::from_utf8_lossy(&out.stdout).to_string()
                }
            };

            let lines: Vec<&str> = content.lines().collect();
            let total_lines = lines.len();
            let start_idx = (args.start_line - 1).min(total_lines);
            let end_idx = args.end_line.min(total_lines);

            let slice = if start_idx < end_idx {
                lines[start_idx..end_idx].join("\n")
            } else {
                String::new()
            };

            Ok(json!({
                "file_path": args.file_path,
                "start_line": args.start_line,
                "end_line": end_idx,
                "total_lines": total_lines,
                "content": slice
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

            // 🛡️ Guardrails: Evaluate command safety, whitelist, blacklist, patterns, isolation
            let _eval = manager
                .guardrails()
                .evaluate_command(&args.command, &args.args, &instance.adapter_type)
                .map_err(|v| format!("🛡️ Guardrail Policy Blocked: {}", v.message))?;

            let mut res = manager.execute_command(&instance.id, &args.command, &args.args)?;

            // 🛡️ Guardrails: Truncate oversized terminal output buffers
            let (trunc_stdout, s_out_truncated) = manager.guardrails().truncate_output_if_needed(&res.stdout);
            let (trunc_stderr, s_err_truncated) = manager.guardrails().truncate_output_if_needed(&res.stderr);
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
