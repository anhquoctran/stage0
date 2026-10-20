pub const AI_REVIEW_UNAVAILABLE: &str =
    "Client-supplied AI verification is not accepted. Run the sandboxed AI review so its discussion action can be validated against the current diff.";

/// Legacy commands have no snapshot and evidence context, so they cannot authorize verification.
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
