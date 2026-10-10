mod guardrail_mode;
pub use guardrail_mode::GuardrailMode;
mod guardrail_severity;
pub use guardrail_severity::GuardrailSeverity;
mod guardrail_violation;
pub use guardrail_violation::GuardrailViolation;
mod guardrail_policy;
pub use guardrail_policy::GuardrailPolicy;
mod guardrail_audit_event;
pub use guardrail_audit_event::GuardrailAuditEvent;
mod guardrail_evaluation_result;
pub use guardrail_evaluation_result::GuardrailEvaluationResult;
mod guardrails_engine;
pub use guardrails_engine::GuardrailsEngine;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::sandbox::SandboxType;

    #[test]
    fn test_guardrail_blocks_sensitive_file_read() {
        let engine = GuardrailsEngine::new();
        // Trying to read .env
        let err = engine.evaluate_read_file(".env", 1, 10).unwrap_err();
        assert_eq!(err.rule, "SENSITIVE_FILE_ACCESS_DENIED");

        // Trying to read credentials
        let err2 = engine
            .evaluate_read_file("config/id_rsa", 1, 5)
            .unwrap_err();
        assert_eq!(err2.rule, "SENSITIVE_FILE_ACCESS_DENIED");
    }

    #[test]
    fn test_guardrail_blocks_directory_traversal() {
        let engine = GuardrailsEngine::new();
        let err = engine
            .evaluate_read_file("../../etc/passwd", 1, 10)
            .unwrap_err();
        assert_eq!(err.rule, "PATH_TRAVERSAL_DETECTED");
    }

    #[test]
    fn test_guardrail_blocks_dangerous_commands() {
        let engine = GuardrailsEngine::new();
        let err = engine
            .evaluate_command(
                "rm",
                &["-rf".to_string(), "/".to_string()],
                &SandboxType::LocalWorktree,
            )
            .unwrap_err();
        assert_eq!(err.rule, "BLOCKED_COMMAND_DETECTED");
    }

    #[test]
    fn test_guardrail_blocks_shell_injection_patterns() {
        let engine = GuardrailsEngine::new();
        let err = engine
            .evaluate_command(
                "npm",
                &["test".to_string(), "| sh".to_string()],
                &SandboxType::LocalWorktree,
            )
            .unwrap_err();
        assert_eq!(err.rule, "DANGEROUS_PATTERN_DETECTED");
    }

    #[test]
    fn test_guardrail_allows_whitelisted_commands() {
        let engine = GuardrailsEngine::new();
        let res = engine
            .evaluate_command("cargo", &["check".to_string()], &SandboxType::LocalWorktree)
            .unwrap();
        assert!(res.allowed);
    }

    #[test]
    fn test_guardrail_rejects_overflowing_line_ranges() {
        let engine = GuardrailsEngine::new();
        let err = engine
            .evaluate_read_file("src/main.rs", 0, usize::MAX)
            .unwrap_err();
        assert_eq!(err.rule, "INVALID_LINE_RANGE");

        let err = engine
            .evaluate_read_file("src/main.rs", 1, usize::MAX)
            .unwrap_err();
        assert_eq!(err.rule, "LINE_RANGE_EXCEEDED");
    }

    #[test]
    fn test_output_truncation_respects_utf8_boundaries() {
        let engine = GuardrailsEngine::new();
        let mut policy = engine.get_policy();
        policy.max_output_bytes = 1024;
        engine.update_policy(policy);

        let input = format!("{}界b", "a".repeat(1023));
        let (truncated, did_truncate) = engine.truncate_output_if_needed(&input);
        assert!(did_truncate);
        assert!(truncated.starts_with(&format!("{}\n\n", "a".repeat(1023))));
    }

    #[test]
    fn test_policy_limits_are_clamped_and_git_publish_requires_confirmation() {
        let engine = GuardrailsEngine::new();
        let mut policy = engine.get_policy();
        policy.max_execution_timeout_secs = u64::MAX;
        policy.max_file_read_lines = usize::MAX;
        policy.max_output_bytes = usize::MAX;
        policy.rate_limit_per_minute = u32::MAX;
        engine.update_policy(policy);
        let policy = engine.get_policy();
        assert_eq!(policy.max_execution_timeout_secs, 120);
        assert_eq!(policy.max_file_read_lines, 5000);
        assert_eq!(policy.max_output_bytes, 1024 * 1024);
        assert_eq!(policy.rate_limit_per_minute, 120);

        let result = engine
            .evaluate_command("git", &["push".to_string()], &SandboxType::Docker)
            .unwrap();
        assert!(result.requires_confirmation);
    }
}
