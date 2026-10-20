use std::time::Duration;

/// Sanitized agent/provider failure metadata. Never contains raw source,
/// credentials, or arbitrary provider error bodies.
pub struct ReviewModelFailure {
    pub kind: &'static str,
    pub message: String,
    pub http_status: Option<u16>,
    pub retryable: bool,
    pub retry_after: Option<Duration>,
}

impl ReviewModelFailure {
    pub fn retry_delay(&self, attempt: usize) -> Option<Duration> {
        if !self.retryable || !(1..=2).contains(&attempt) {
            return None;
        }
        let maximum = Duration::from_secs(60);
        // The agent may already have exhausted its own retries. Give its
        // provider time to recover instead of starting another rapid loop.
        let fallback = Duration::from_secs(20 * (1 << (attempt - 1)));
        let minimum = self.retry_after.unwrap_or_default().max(fallback);
        if minimum > maximum {
            return None;
        }
        let jitter = Duration::from_millis((uuid::Uuid::new_v4().as_u128() % 1000) as u64);
        Some(minimum + jitter.min(maximum - minimum))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delays_increase_respect_server_hints_and_never_retry_terminal_errors() {
        let mut failure = ReviewModelFailure {
            kind: "rate_limit",
            message: "Rate limited".into(),
            http_status: Some(429),
            retryable: true,
            retry_after: None,
        };
        let first = failure.retry_delay(1).unwrap();
        let second = failure.retry_delay(2).unwrap();
        assert!((Duration::from_secs(20)..Duration::from_secs(21)).contains(&first));
        assert!((Duration::from_secs(40)..Duration::from_secs(41)).contains(&second));
        assert!(failure.retry_delay(3).is_none());
        failure.retry_after = Some(Duration::from_secs(50));
        assert!(failure.retry_delay(1).unwrap() >= Duration::from_secs(50));
        failure.retry_after = Some(Duration::from_secs(120));
        assert!(failure.retry_delay(1).is_none());
        failure.retryable = false;
        failure.retry_after = None;
        assert!(failure.retry_delay(1).is_none());
    }
}
