use super::GuardrailsEngine;
use crate::features::sandbox::guardrails::{
    GuardrailEvaluationResult, GuardrailSeverity, GuardrailViolation,
};
use crate::features::sandbox::SandboxType;

impl GuardrailsEngine {
    pub fn simulate_check(
        &self,
        tool_name: &str,
        arguments: serde_json::Value,
    ) -> GuardrailEvaluationResult {
        match tool_name {
            "read_file_range" => {
                let file_path = arguments
                    .get("file_path")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let start_line = arguments
                    .get("start_line")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(1) as usize;
                let end_line = arguments
                    .get("end_line")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(10) as usize;

                match self.evaluate_read_file(file_path, start_line, end_line) {
                    Ok(res) => res,
                    Err(v) => GuardrailEvaluationResult {
                        allowed: false,
                        risk_score: 95,
                        violations: vec![v],
                        requires_confirmation: false,
                    },
                }
            }
            "execute_terminal_cmd" => {
                let command = arguments
                    .get("command")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let args: Vec<String> = arguments
                    .get("args")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|x| x.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();

                match self.evaluate_command(command, &args, &SandboxType::LocalWorktree) {
                    Ok(res) => res,
                    Err(v) => GuardrailEvaluationResult {
                        allowed: false,
                        risk_score: 100,
                        violations: vec![v],
                        requires_confirmation: false,
                    },
                }
            }
            "get_diff" => GuardrailEvaluationResult {
                allowed: true,
                risk_score: 5,
                violations: Vec::new(),
                requires_confirmation: false,
            },
            unknown => GuardrailEvaluationResult {
                allowed: false,
                risk_score: 75,
                violations: vec![GuardrailViolation {
                    rule: "UNRECOGNIZED_TOOL".to_string(),
                    severity: GuardrailSeverity::High,
                    message: format!(
                        "Tool '{}' is not registered in Stage0 Tool Bridge.",
                        unknown
                    ),
                }],
                requires_confirmation: false,
            },
        }
    }
}
