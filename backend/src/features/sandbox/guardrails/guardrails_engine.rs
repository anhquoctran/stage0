use super::super::SandboxType;
use super::{
    GuardrailAuditEvent, GuardrailEvaluationResult, GuardrailMode, GuardrailPolicy,
    GuardrailSeverity, GuardrailViolation,
};
use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::Instant;

pub struct GuardrailsEngine {
    pub(super) policy: Mutex<GuardrailPolicy>,
    pub(super) call_timestamps: Mutex<VecDeque<Instant>>,
    pub(super) audit_log: Mutex<Vec<GuardrailAuditEvent>>,
}

impl GuardrailsEngine {
    pub fn new() -> Self {
        Self {
            policy: Mutex::new(GuardrailPolicy::balanced()),
            call_timestamps: Mutex::new(VecDeque::new()),
            audit_log: Mutex::new(Vec::new()),
        }
    }

    pub fn get_policy(&self) -> GuardrailPolicy {
        self.policy
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone()
    }

    pub fn update_policy(&self, new_policy: GuardrailPolicy) {
        const MAX_POLICY_ENTRIES: usize = 256;
        const MAX_POLICY_TEXT_BYTES: usize = 1024;
        let mut new_policy = new_policy;
        new_policy.max_execution_timeout_secs = new_policy.max_execution_timeout_secs.clamp(1, 120);
        new_policy.max_file_read_lines = new_policy.max_file_read_lines.clamp(1, 5000);
        new_policy.max_output_bytes = new_policy.max_output_bytes.clamp(1024, 1024 * 1024);
        new_policy.rate_limit_per_minute = new_policy.rate_limit_per_minute.clamp(1, 120);

        for entries in [
            &mut new_policy.allowed_commands,
            &mut new_policy.blocked_commands,
            &mut new_policy.blocked_patterns,
            &mut new_policy.sensitive_path_patterns,
        ] {
            entries.truncate(MAX_POLICY_ENTRIES);
            for entry in entries.iter_mut() {
                if entry.len() > MAX_POLICY_TEXT_BYTES {
                    let mut boundary = MAX_POLICY_TEXT_BYTES;
                    while !entry.is_char_boundary(boundary) {
                        boundary -= 1;
                    }
                    entry.truncate(boundary);
                }
            }
        }
        let mut policy = self.policy.lock().unwrap_or_else(|p| p.into_inner());
        *policy = new_policy;
    }

    pub fn reset_policy(&self, mode: GuardrailMode) {
        let mut policy = self.policy.lock().unwrap_or_else(|p| p.into_inner());
        *policy = match mode {
            GuardrailMode::Strict => GuardrailPolicy::strict(),
            GuardrailMode::Balanced => GuardrailPolicy::balanced(),
            GuardrailMode::Permissive => GuardrailPolicy::permissive(),
        };
    }

    pub fn get_audit_log(&self, limit: Option<usize>) -> Vec<GuardrailAuditEvent> {
        let log = self.audit_log.lock().unwrap_or_else(|p| p.into_inner());
        let take_count = limit.unwrap_or(50).min(log.len());
        log.iter().rev().take(take_count).cloned().collect()
    }

    pub fn clear_audit_log(&self) {
        let mut log = self.audit_log.lock().unwrap_or_else(|p| p.into_inner());
        log.clear();
    }

    pub(super) fn check_rate_limit(&self, max_per_min: u32) -> Result<(), GuardrailViolation> {
        let mut calls = self
            .call_timestamps
            .lock()
            .unwrap_or_else(|p| p.into_inner());
        let now = Instant::now();
        let one_min_ago = now
            .checked_sub(std::time::Duration::from_secs(60))
            .unwrap_or(now);

        while let Some(&first) = calls.front() {
            if first < one_min_ago {
                calls.pop_front();
            } else {
                break;
            }
        }

        if calls.len() >= max_per_min as usize {
            return Err(GuardrailViolation {
                rule: "RATE_LIMIT_EXCEEDED".to_string(),
                severity: GuardrailSeverity::High,
                message: format!(
                    "Tool call rate limit exceeded: maximum {} calls per minute allowed.",
                    max_per_min
                ),
            });
        }

        calls.push_back(now);
        Ok(())
    }

    pub fn evaluate_read_file(
        &self,
        file_path: &str,
        start_line: usize,
        end_line: usize,
    ) -> Result<GuardrailEvaluationResult, GuardrailViolation> {
        let policy = self.get_policy();
        let mut violations = Vec::new();
        let mut risk_score = 0u32;

        if start_line == 0 || end_line < start_line {
            let violation = GuardrailViolation {
                rule: "INVALID_LINE_RANGE".to_string(),
                severity: GuardrailSeverity::High,
                message: "Requested file line range is invalid.".to_string(),
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

        // 1. Rate Limit
        if let Err(e) = self.check_rate_limit(policy.rate_limit_per_minute) {
            self.record_audit_event("read_file_range", file_path, false, 90, vec![e.clone()]);
            return Err(e);
        }

        // 2. Directory Traversal Check
        let normalized = file_path.replace('\\', "/");
        if normalized.contains("../")
            || normalized.starts_with('/')
            || (normalized.len() > 1 && normalized.as_bytes()[1] == b':')
        {
            let v = GuardrailViolation {
                rule: "PATH_TRAVERSAL_DETECTED".to_string(),
                severity: GuardrailSeverity::Critical,
                message: format!("Access to path '{}' blocked: Directory traversal outside workspace is prohibited.", file_path),
            };
            self.record_audit_event("read_file_range", file_path, false, 100, vec![v.clone()]);
            return Err(v);
        }

        // 3. Sensitive Path Protection
        let lower_path = normalized.to_lowercase();
        for sensitive in &policy.sensitive_path_patterns {
            let sensitive_lower = sensitive.to_lowercase();
            if lower_path.contains(&sensitive_lower) || lower_path.ends_with(&sensitive_lower) {
                let v = GuardrailViolation {
                    rule: "SENSITIVE_FILE_ACCESS_DENIED".to_string(),
                    severity: GuardrailSeverity::Critical,
                    message: format!(
                        "Access to '{}' blocked: Path matches sensitive pattern '{}'. Credentials, tokens, and private keys are protected.",
                        file_path, sensitive
                    ),
                };
                self.record_audit_event("read_file_range", file_path, false, 100, vec![v.clone()]);
                return Err(v);
            }
        }

        // 4. Max Read Lines Check
        let line_count = end_line
            .checked_sub(start_line)
            .and_then(|count| count.checked_add(1))
            .unwrap_or(usize::MAX);

        if line_count > policy.max_file_read_lines {
            let v = GuardrailViolation {
                rule: "LINE_RANGE_EXCEEDED".to_string(),
                severity: GuardrailSeverity::Medium,
                message: format!(
                    "Requested range ({} lines) exceeds maximum allowable limit of {} lines per tool call.",
                    line_count, policy.max_file_read_lines
                ),
            };
            self.record_audit_event("read_file_range", file_path, false, 50, vec![v.clone()]);
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

        self.record_audit_event("read_file_range", file_path, true, risk_score, violations);
        Ok(result)
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
        if let Err(error) = super::super::validate_sandbox_command(command, args) {
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

    pub fn record_diff_audit(&self, repo_path: &str, base: &str, compare: &str) {
        let action = format!("Diff inspection: {}...{} ({})", base, compare, repo_path);
        self.record_audit_event("get_diff", &action, true, 5, Vec::new());
    }

    pub fn truncate_output_if_needed<'a>(
        &self,
        text: &'a str,
    ) -> (std::borrow::Cow<'a, str>, bool) {
        let policy = self.get_policy();
        if text.len() > policy.max_output_bytes {
            let mut safe_end = policy.max_output_bytes.min(text.len());
            while !text.is_char_boundary(safe_end) {
                safe_end -= 1;
            }
            let truncated = format!(
                "{}\n\n[🛡️ GUARDRAIL NOTICE: Output truncated at {} bytes (max limit: {} bytes)]",
                &text[..safe_end],
                policy.max_output_bytes,
                policy.max_output_bytes
            );
            (std::borrow::Cow::Owned(truncated), true)
        } else {
            (std::borrow::Cow::Borrowed(text), false)
        }
    }

    pub(super) fn record_audit_event(
        &self,
        tool_name: &str,
        action_summary: &str,
        allowed: bool,
        risk_score: u32,
        violations: Vec<GuardrailViolation>,
    ) {
        let mut log = self.audit_log.lock().unwrap_or_else(|p| p.into_inner());
        let violations = violations
            .into_iter()
            .map(|mut violation| {
                violation.message =
                    crate::features::git::runner::redact_sensitive_text(&violation.message);
                violation
            })
            .collect();
        let event = GuardrailAuditEvent {
            id: format!("gr-{}", uuid::Uuid::new_v4()),
            timestamp: chrono::Utc::now().timestamp_millis(),
            tool_name: tool_name.to_string(),
            action_summary: crate::features::git::runner::redact_sensitive_text(action_summary),
            allowed,
            risk_score,
            violations,
        };

        log.push(event);
        if log.len() > 100 {
            log.remove(0);
        }
    }

    pub fn record_policy_denial(
        &self,
        tool_name: &str,
        action_summary: &str,
        violation: GuardrailViolation,
    ) {
        self.record_audit_event(tool_name, action_summary, false, 100, vec![violation]);
    }

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
