use super::GuardrailsEngine;
use crate::features::sandbox::guardrails::{
    GuardrailEvaluationResult, GuardrailSeverity, GuardrailViolation,
};

impl GuardrailsEngine {
    pub fn evaluate_read_file(
        &self,
        file_path: &str,
        start_line: usize,
        end_line: usize,
    ) -> Result<GuardrailEvaluationResult, GuardrailViolation> {
        if start_line == 0 || end_line < start_line {
            let violation = GuardrailViolation {
                rule: "INVALID_LINE_RANGE".to_string(),
                severity: GuardrailSeverity::High,
                message: crate::common::messages::code("backend.sandbox.invalidLineRange"),
            };
            self.record_audit_event(
                "read_file_range",
                file_path,
                false,
                85,
                vec![violation.clone()],
            );
            return Err(violation);
        }
        let line_count = end_line
            .checked_sub(start_line)
            .and_then(|count| count.checked_add(1))
            .unwrap_or(usize::MAX);
        self.evaluate_review_read("read_file_range", Some(file_path), line_count)
    }

    /// Apply the Stage0 source-read policy to every review tool that can return
    /// repository content, including review runs executed through ACP.
    pub fn evaluate_review_read(
        &self,
        tool_name: &str,
        file_path: Option<&str>,
        line_count: usize,
    ) -> Result<GuardrailEvaluationResult, GuardrailViolation> {
        let policy = self.get_policy();
        let action = file_path.unwrap_or("repository content search");
        let mut violations = Vec::new();
        let mut risk_score = 0u32;

        if line_count == 0 {
            let violation = GuardrailViolation {
                rule: "INVALID_READ_SIZE".to_string(),
                severity: GuardrailSeverity::High,
                message: crate::common::messages::code("backend.sandbox.invalidReadSize"),
            };
            self.record_audit_event(tool_name, action, false, 85, vec![violation.clone()]);
            return Err(violation);
        }

        // 1. Rate Limit
        if let Err(e) = self.check_rate_limit(policy.rate_limit_per_minute) {
            self.record_audit_event(tool_name, action, false, 90, vec![e.clone()]);
            return Err(e);
        }

        if let Some(file_path) = file_path {
            // 2. Directory Traversal Check
            let normalized = file_path.replace('\\', "/");
            if normalized.contains("../")
                || normalized.starts_with('/')
                || (normalized.len() > 1 && normalized.as_bytes()[1] == b':')
            {
                let violation = GuardrailViolation {
                    rule: "PATH_TRAVERSAL_DETECTED".to_string(),
                    severity: GuardrailSeverity::Critical,
                    message: format!("Access to path '{}' blocked: Directory traversal outside workspace is prohibited.", file_path),
                };
                self.record_audit_event(tool_name, action, false, 100, vec![violation.clone()]);
                return Err(violation);
            }

            // 3. Sensitive Path Protection
            let lower_path = normalized.to_lowercase();
            for sensitive in &policy.sensitive_path_patterns {
                let sensitive_lower = sensitive.to_lowercase();
                if lower_path.contains(&sensitive_lower) || lower_path.ends_with(&sensitive_lower) {
                    let violation = GuardrailViolation {
                        rule: "SENSITIVE_FILE_ACCESS_DENIED".to_string(),
                        severity: GuardrailSeverity::Critical,
                        message: format!(
                            "Access to '{}' blocked: Path matches sensitive pattern '{}'. Credentials, tokens, and private keys are protected.",
                            file_path, sensitive
                        ),
                    };
                    self.record_audit_event(tool_name, action, false, 100, vec![violation.clone()]);
                    return Err(violation);
                }
            }
        }

        // 4. Max Read Lines Check
        if line_count > policy.max_file_read_lines {
            let v = GuardrailViolation {
                rule: "LINE_RANGE_EXCEEDED".to_string(),
                severity: GuardrailSeverity::Medium,
                message: format!(
                    "Requested range ({} lines) exceeds maximum allowable limit of {} lines per tool call.",
                    line_count, policy.max_file_read_lines
                ),
            };
            self.record_audit_event(tool_name, action, false, 50, vec![v.clone()]);
            return Err(v);
        }

        if line_count > policy.max_file_read_lines / 2 {
            risk_score += 15;
            violations.push(GuardrailViolation {
                rule: "LARGE_FILE_READ_WARNING".to_string(),
                severity: GuardrailSeverity::Low,
                message: format!("Reading large file slice ({} lines).", line_count),
            });
        }

        let result = GuardrailEvaluationResult {
            allowed: true,
            risk_score,
            violations: violations.clone(),
            requires_confirmation: false,
        };

        self.record_audit_event(tool_name, action, true, risk_score, violations);
        Ok(result)
    }

    /// Reject oversized structured review output instead of byte-truncating JSON.
    pub fn evaluate_review_output(
        &self,
        tool_name: &str,
        output_bytes: usize,
    ) -> Result<(), GuardrailViolation> {
        let limit = self.get_policy().max_output_bytes;
        if output_bytes <= limit {
            return Ok(());
        }
        let violation = GuardrailViolation {
            rule: "REVIEW_OUTPUT_LIMIT_EXCEEDED".to_string(),
            severity: GuardrailSeverity::High,
            message: format!(
                "Review tool output ({output_bytes} bytes) exceeds the configured Stage0 limit of {limit} bytes."
            ),
        };
        self.record_policy_denial(
            tool_name,
            "Blocked oversized structured review output",
            violation.clone(),
        );
        Err(violation)
    }

    /// Re-check sensitive-file rules after resolving a path through symlinks.
    /// Lexical checks alone can be bypassed by a benign-looking link name.
    pub fn evaluate_resolved_read_path(
        &self,
        resolved_path: &str,
    ) -> Result<(), GuardrailViolation> {
        let policy = self.get_policy();
        let normalized = resolved_path.replace('\\', "/").to_lowercase();
        for sensitive in &policy.sensitive_path_patterns {
            let pattern = sensitive.replace('\\', "/").to_lowercase();
            if normalized.contains(&pattern) || normalized.ends_with(&pattern) {
                let violation = GuardrailViolation {
                    rule: "SENSITIVE_FILE_ACCESS_DENIED".to_string(),
                    severity: GuardrailSeverity::Critical,
                    message: format!(
                        "Access to the resolved path is blocked by sensitive-file policy ('{}').",
                        sensitive
                    ),
                };
                self.record_audit_event(
                    "read_file_range",
                    resolved_path,
                    false,
                    100,
                    vec![violation.clone()],
                );
                return Err(violation);
            }
        }
        Ok(())
    }
}
