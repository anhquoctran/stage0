use super::GuardrailsEngine;
use crate::features::sandbox::guardrails::{
    GuardrailAuditEvent, GuardrailSeverity, GuardrailViolation,
};
use std::time::Instant;

impl GuardrailsEngine {
    pub fn get_audit_log(&self, limit: Option<usize>) -> Vec<GuardrailAuditEvent> {
        let log = self.audit_log.lock().unwrap_or_else(|p| p.into_inner());
        let take_count = limit.unwrap_or(50).min(log.len());
        log.iter().rev().take(take_count).cloned().collect()
    }

    pub fn clear_audit_log(&self) {
        let mut log = self.audit_log.lock().unwrap_or_else(|p| p.into_inner());
        log.clear();
    }

    pub(in crate::features::sandbox::guardrails) fn check_rate_limit(
        &self,
        max_per_min: u32,
    ) -> Result<(), GuardrailViolation> {
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

    pub(in crate::features::sandbox::guardrails) fn record_audit_event(
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
}
