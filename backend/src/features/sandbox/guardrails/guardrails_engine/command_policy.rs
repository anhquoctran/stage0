use super::GuardrailsEngine;
use crate::features::sandbox::guardrails::GuardrailMode;
use crate::features::sandbox::guardrails::{
    GuardrailEvaluationResult, GuardrailSeverity, GuardrailViolation,
};
use crate::features::sandbox::SandboxType;

impl GuardrailsEngine {
    pub fn evaluate_command(
        &self,
        command: &str,
        args: &[String],
        sandbox_type: &SandboxType,
    ) -> Result<GuardrailEvaluationResult, GuardrailViolation> {
        let policy = self.get_policy();
        // 1. InMemory Prohibition
        if *sandbox_type == SandboxType::InMemory {
            let v = GuardrailViolation {
                rule: "IN_MEMORY_TERMINAL_DISABLED".to_string(),
                severity: GuardrailSeverity::Critical,
                message:
                    "Terminal command execution is strictly forbidden in InMemory sandbox mode."
                        .to_string(),
            };
            self.record_audit_event("execute_terminal_cmd", command, false, 100, vec![v.clone()]);
            return Err(v);
        }

        let cmd_clean = command.trim().to_lowercase();

        // Explicitly blocked names should retain their specific denial even
        // though they are also excluded from the adapter's command allowlist.
        for blocked in &policy.blocked_commands {
            if cmd_clean == blocked.to_lowercase() {
                let v = GuardrailViolation {
                    rule: "BLOCKED_COMMAND_DETECTED".to_string(),
                    severity: GuardrailSeverity::Critical,
                    message: format!(
                        "Execution of command '{}' is explicitly blocked by guardrail policy.",
                        command
                    ),
                };
                self.record_audit_event(
                    "execute_terminal_cmd",
                    command,
                    false,
                    100,
                    vec![v.clone()],
                );
                return Err(v);
            }
        }

        // Validate bounds before joining or copying untrusted IPC arguments.
        if let Err(error) = crate::features::sandbox::validate_sandbox_command(command, args) {
            let violation = GuardrailViolation {
                rule: "INVALID_SANDBOX_COMMAND".to_string(),
                severity: GuardrailSeverity::Critical,
                message: error,
            };
            self.record_policy_denial(
                "execute_terminal_cmd",
                "Rejected invalid sandbox command input",
                violation.clone(),
            );
            return Err(violation);
        }

        let cmd_line = format!("{} {}", command, args.join(" ")).trim().to_string();
        let mut violations = Vec::new();
        let mut risk_score = 10u32;

        // Rate limit only valid, non-blocked command attempts.
        if let Err(e) = self.check_rate_limit(policy.rate_limit_per_minute) {
            self.record_audit_event(
                "execute_terminal_cmd",
                &cmd_line,
                false,
                90,
                vec![e.clone()],
            );
            return Err(e);
        }

        // 4. Blocked Dangerous Patterns Check
        let full_cmd_lower = cmd_line.to_lowercase();
        for pattern in &policy.blocked_patterns {
            if full_cmd_lower.contains(&pattern.to_lowercase()) {
                let v = GuardrailViolation {
                    rule: "DANGEROUS_PATTERN_DETECTED".to_string(),
                    severity: GuardrailSeverity::Critical,
                    message: format!(
                        "Command contains dangerous shell pattern '{}'. Execution aborted.",
                        pattern
                    ),
                };
                self.record_audit_event(
                    "execute_terminal_cmd",
                    &cmd_line,
                    false,
                    100,
                    vec![v.clone()],
                );
                return Err(v);
            }
        }

        // 5. Mode Specific Whitelist Evaluation
        match policy.mode {
            GuardrailMode::Strict => {
                let is_allowed = policy.allowed_commands.iter().any(|allowed| {
                    let a_lower = allowed.to_lowercase();
                    if a_lower == cmd_clean || full_cmd_lower.starts_with(&a_lower) {
                        return true;
                    }
                    false
                });

                if !is_allowed {
                    let v = GuardrailViolation {
                        rule: "STRICT_WHITELIST_VIOLATION".to_string(),
                        severity: GuardrailSeverity::High,
                        message: format!(
                            "Command '{}' is not in the Strict Policy allowed whitelist.",
                            command
                        ),
                    };
                    self.record_audit_event(
                        "execute_terminal_cmd",
                        &cmd_line,
                        false,
                        85,
                        vec![v.clone()],
                    );
                    return Err(v);
                }
            }
            GuardrailMode::Balanced => {
                let is_whitelisted = policy.allowed_commands.iter().any(|allowed| {
                    let a_lower = allowed.to_lowercase();
                    cmd_clean == a_lower || full_cmd_lower.starts_with(&a_lower)
                });

                if !is_whitelisted {
                    risk_score += 30;
                    violations.push(GuardrailViolation {
                        rule: "NON_WHITELISTED_TOOL".to_string(),
                        severity: GuardrailSeverity::Medium,
                        message: format!("Command '{}' is not standard toolchain binary.", command),
                    });
                }
            }
            GuardrailMode::Permissive => {
                risk_score += 10;
            }
        }

        // 6. Git operations that can publish, rewrite, or change repository state
        if cmd_clean == "git" {
            let mutating = args.iter().any(|argument| {
                matches!(
                    argument.to_ascii_lowercase().as_str(),
                    "push"
                        | "fetch"
                        | "pull"
                        | "reset"
                        | "clean"
                        | "commit"
                        | "merge"
                        | "rebase"
                        | "cherry-pick"
                        | "revert"
                        | "checkout"
                        | "switch"
                        | "config"
                        | "worktree"
                        | "gc"
                )
            }) || args.windows(2).any(|pair| {
                pair[0] == "branch" && matches!(pair[1].as_str(), "-d" | "-D")
                    || pair[0] == "tag" && pair[1] == "-d"
                    || pair[0] == "remote" && !matches!(pair[1].as_str(), "-v" | "--verbose")
            });
            if mutating {
                risk_score += 60;
                violations.push(GuardrailViolation {
                    rule: "POTENTIALLY_MUTATING_GIT_COMMAND".to_string(),
                    severity: GuardrailSeverity::High,
                    message: "This Git operation can publish changes or modify repository state and requires human confirmation.".to_string(),
                });
            }
        }

        let requires_confirmation = policy.require_human_confirmation_for_commands
            || (policy.mode == GuardrailMode::Strict)
            || (risk_score >= 60);

        let result = GuardrailEvaluationResult {
            allowed: true,
            risk_score,
            violations: violations.clone(),
            requires_confirmation,
        };

        self.record_audit_event(
            "execute_terminal_cmd",
            &cmd_line,
            true,
            risk_score,
            violations,
        );
        Ok(result)
    }
}
