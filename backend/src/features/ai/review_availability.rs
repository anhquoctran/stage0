pub const AI_REVIEW_UNAVAILABLE: &str =
    "Automatic AI fix re-verification is not available yet. Use the read-only AI review panel; no verification or approval was recorded.";

/// Read-only review findings never authorize verification or approval writes.
pub fn require_review_runtime() -> Result<(), String> {
    Err(AI_REVIEW_UNAVAILABLE.to_string())
}

#[cfg(test)]
mod tests {
    #[test]
    fn verification_cannot_succeed_without_a_review_runtime() {
        assert_eq!(
            super::require_review_runtime(),
            Err(super::AI_REVIEW_UNAVAILABLE.to_string())
        );
    }
}
