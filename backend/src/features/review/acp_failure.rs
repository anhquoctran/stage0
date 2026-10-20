use super::ReviewModelFailure;
use serde_json::Value;
use std::time::Duration;

/// Some ACP bridges (including Codex ACP) send provider failures as ordinary
/// agent text followed by end_turn. Recognize only error-shaped messages,
/// never a mention of HTTP 429 inside a valid Stage0 tool-call envelope.
pub fn from_response(response: &Value) -> Option<ReviewModelFailure> {
    let rpc_error = response.get("error").filter(|error| !error.is_null());
    let output = response["output"].as_str().unwrap_or("").trim();
    let embedded_error = if rpc_error.is_none() && output.starts_with('{') {
        serde_json::from_str::<Value>(output)
            .ok()
            .filter(|value| value.get("calls").is_none() && value.get("error").is_some())
    } else {
        None
    };
    let error = rpc_error.or_else(|| embedded_error.as_ref().and_then(|value| value.get("error")));
    let raw_message = error
        .and_then(|error| {
            error
                .get("message")
                .and_then(Value::as_str)
                .or_else(|| error.as_str())
        })
        .unwrap_or(output);
    let message = raw_message
        .chars()
        .take(4096)
        .collect::<String>()
        .to_ascii_lowercase();
    let error_text = error.is_some()
        || [
            "exceeded retry limit",
            "error:",
            "request failed",
            "rate limit",
            "too many requests",
            "you've hit your usage limit",
            "you have hit your usage limit",
            "usage limit reached",
            "quota exceeded",
            "insufficient_quota",
            "insufficient credits",
            "credit balance",
            "authentication failed",
            "unauthorized",
        ]
        .iter()
        .any(|prefix| message.starts_with(prefix));

    let status = error
        .and_then(|error| {
            [
                "/data/http_status_code",
                "/data/httpStatusCode",
                "/data/status",
                "/data/statusCode",
            ]
            .iter()
            .find_map(|pointer| error.pointer(pointer).and_then(Value::as_u64))
            .filter(|status| (400..=599).contains(status))
            .map(|status| status as u16)
        })
        .or_else(|| {
            if !error_text {
                return None;
            }
            [
                "last status: ",
                "http status ",
                "http ",
                "status code: ",
                "status: ",
            ]
            .iter()
            .find_map(|marker| {
                message.split_once(marker).and_then(|(_, rest)| {
                    rest.chars()
                        .take_while(char::is_ascii_digit)
                        .collect::<String>()
                        .parse::<u16>()
                        .ok()
                })
            })
            .filter(|status| (400..=599).contains(status))
        });
    let retry_after = error.and_then(|error| {
        [
            "/data/retry_after",
            "/data/retry_after_seconds",
            "/data/retryAfterSeconds",
        ]
        .iter()
        .find_map(|pointer| error.pointer(pointer).and_then(Value::as_u64))
        .map(Duration::from_secs)
    });
    let make = |kind, text: &str, http_status, retryable| ReviewModelFailure {
        kind,
        message: text.into(),
        http_status,
        retryable,
        retry_after,
    };

    match response["stopReason"].as_str() {
        Some("cancelled") => return Some(make("cancelled", "Review cancelled by the ACP agent.", None, false)),
        Some("refusal") => return Some(make("refusal", "The ACP agent refused this review request.", None, false)),
        Some("max_tokens" | "max_turn_requests") => return Some(make("agent_limit", "The ACP agent stopped because its output or turn limit was reached. The review is incomplete.", None, false)),
        _ => {},
    }

    if error_text {
        // A 429 can also represent an exhausted subscription/quota. Retrying
        // these errors without user action only adds requests to the failure.
        if [
            "insufficient_quota",
            "usage limit",
            "quota exceeded",
            "quota has been exceeded",
            "billing",
            "insufficient credits",
            "credit balance",
        ]
        .iter()
        .any(|pattern| message.contains(pattern))
        {
            return Some(make("quota_exhausted", "The ACP agent reports an exhausted quota or account usage limit. Check the agent's account/plan before retrying this review.", status, false));
        }
        if status == Some(429)
            || message.contains("too many requests")
            || message.contains("rate limit")
        {
            return Some(make("rate_limit", "The ACP agent's provider returned HTTP 429 (Too Many Requests). The review could not continue because the provider is rate limiting requests. Wait and check the agent's usage limits before retrying.", Some(429), true));
        }
        if matches!(status, Some(401 | 403))
            || message.contains("authentication failed")
            || message.contains("unauthorized")
        {
            return Some(make("authentication", "The ACP agent's provider rejected authentication or account access. Check the agent's saved sign-in before retrying.", status, false));
        }
        if matches!(status, Some(502 | 503 | 504)) {
            return Some(make("provider_unavailable", "The ACP agent's provider is temporarily unavailable. The review could not continue; retry later.", status, true));
        }
        return Some(make("agent_error", "The ACP agent reported an error while processing this review. Check its account, model availability and connection.", status, false));
    }
    match response["stopReason"].as_str() {
        Some("end_turn") | None => None,
        Some(_) => Some(make(
            "agent_stop",
            "The ACP agent stopped the review without completing the requested turn.",
            None,
            false,
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn exact_codex_rate_limit_text_is_a_provider_failure_not_a_json_error() {
        let text = "exceeded retry limit, last status: 429 Too Many Requests";
        for output in [text.to_owned(), format!("\n{text}\n")] {
            let failure = from_response(&json!({"output":output,"stopReason":"end_turn"})).unwrap();
            assert_eq!(failure.kind, "rate_limit");
            assert_eq!(failure.http_status, Some(429));
            assert!(failure.retryable);
            assert!(failure.message.contains("HTTP 429"));
        }
    }

    #[test]
    fn source_text_and_descriptions_mentioning_rate_limits_are_not_agent_errors() {
        let output = json!({"calls":[{"name":"update_mr_description","arguments":{"description":"Fix HTTP 429 Too Many Requests and rate limit handling."}}]}).to_string();
        assert!(from_response(&json!({"output":output})).is_none());
        assert!(from_response(&json!({"output":"I will now inspect the next file."})).is_none());
    }

    #[test]
    fn structured_errors_preserve_retry_hints_but_never_retry_quota_or_authentication() {
        let error = |message, status| json!({"error":{"code":-32000,"message":message,"data":{"http_status_code":status,"retry_after":45}}});
        let transient = from_response(&error("Too Many Requests", 429)).unwrap();
        assert_eq!(transient.retry_after, Some(Duration::from_secs(45)));
        assert_eq!(transient.kind, "rate_limit");
        let quota = from_response(&error("You've hit your usage limit", 429)).unwrap();
        assert_eq!(quota.kind, "quota_exhausted");
        assert!(!quota.retryable);
        let auth = from_response(&error("Unauthorized", 401)).unwrap();
        assert_eq!(auth.kind, "authentication");
        assert!(!auth.retryable);
        assert_eq!(
            from_response(&json!({"output":"","stopReason":"cancelled"}))
                .unwrap()
                .kind,
            "cancelled"
        );
        assert_eq!(
            from_response(&json!({"output":"partial", "stopReason":"max_tokens"}))
                .unwrap()
                .kind,
            "agent_limit"
        );
    }
}
