use crate::features::sandbox::SandboxType;
use serde_json::json;

/// Generates function calling schemas compatible with OpenAI, Anthropic, and MCP tools.
/// Strictly omits `execute_terminal_cmd` when the active sandbox is `InMemory`.
pub fn get_tool_schemas(
    sandbox_type: &SandboxType,
    policy: &crate::features::sandbox::guardrails::GuardrailPolicy,
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
        && policy.mode != crate::features::sandbox::guardrails::GuardrailMode::Strict
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
