//! Sanitized operational errors shared by native providers and ACP adapters.
use serde_json::{json, Value};

pub fn financial_limit(status: u16, text: &str) -> Option<&'static str> {
    let text = text.to_ascii_lowercase();
    if [
        "budget_exceeded",
        "budget exceeded",
        "budget limit",
        "cost limit",
        "spend limit",
        "spend_limit",
        "hard_limit_reached",
        "organization_usage_limit_exceeded",
    ]
    .iter()
    .any(|s| text.contains(s))
    {
        Some("backend.ai.providerCostLimit")
    } else if status == 402
        || [
            "billing_error",
            "arrearage",
            "insufficientbalance",
            "insufficient credits",
            "insufficient balance",
            "credit balance",
            "credit_balance_exhausted",
            "balance too low",
            "payment required",
        ]
        .iter()
        .any(|s| text.contains(s))
    {
        Some("backend.ai.providerBilling")
    } else if [
        "insufficient_quota",
        "insufficient_user_quota",
        "exceeded_current_quota",
        "quotaexhausted",
        "quotaexceeded",
        "allocationquota",
        "quota exceeded",
        "quota has been exceeded",
        "exceeded your current quota",
        "usage limit",
        "perday",
        "per_day",
        "daily quota",
    ]
    .iter()
    .any(|s| text.contains(s))
    {
        Some("backend.ai.providerQuota")
    } else {
        None
    }
}

pub fn http_error(status: u16, body: &Value) -> String {
    // Inspect only the bounded error envelope; never echo it into UI/logs.
    let error = body.get("error").unwrap_or(body);
    let text = error.to_string();
    let key = financial_limit(status, &text).unwrap_or(
        if ["invalid_api_key", "authentication failed", "unauthorized"]
            .iter()
            .any(|s| text.to_ascii_lowercase().contains(s))
        {
            "backend.ai.providerAuthentication"
        } else {
            match status {
                0 => "backend.errors.ai",
                401 => "backend.ai.providerAuthentication",
                403 => "backend.ai.providerAccessDenied",
                429 => "backend.ai.providerRateLimit",
                500 | 502 | 503 | 504 | 529 => "backend.ai.providerUnavailable",
                _ => "backend.review.providerHttpError",
            }
        },
    );
    crate::common::messages::failure(
        key,
        json!({"status":status.to_string()}),
        format!("Provider returned HTTP {status}"),
    )
}

pub fn network_error(error: &reqwest::Error) -> String {
    // reqwest Display may contain a credential-bearing URL. Do not serialize it.
    crate::common::messages::code(if error.is_timeout() {
        "backend.ai.providerTimeout"
    } else if error.is_connect() {
        "backend.ai.providerConnection"
    } else {
        "backend.ai.providerInterrupted"
    })
}

pub async fn read_json(mut response: reqwest::Response) -> Result<Value, String> {
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| crate::common::messages::code("backend.ai.providerInterrupted"))?
    {
        if bytes.len().saturating_add(chunk.len()) > 512 * 1024 {
            return Err(crate::common::messages::code(
                "backend.review.providerResponseSafetyLimit",
            ));
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes)
        .map_err(|_| crate::common::messages::code("backend.review.providerResponseJsonInvalid"))
}

pub async fn response_json<T: serde::de::DeserializeOwned>(
    response: reqwest::Response,
) -> Result<T, String> {
    let status = response.status().as_u16();
    let data = read_json(response).await;
    if !(200..300).contains(&status) {
        return Err(http_error(status, &data.unwrap_or(Value::Null)));
    }
    let data = data?;
    if data.get("error").is_some_and(|error| !error.is_null()) {
        return Err(http_error(status, &data));
    }
    serde_json::from_value(data)
        .map_err(|_| crate::common::messages::code("backend.ai.modelDiscoveryFailed"))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn financial_errors_are_terminal_even_when_the_status_says_rate_limit() {
        for (status, code, expected) in [
            (429, "insufficient_quota", "providerQuota"),
            (429, "insufficient_user_quota", "providerQuota"),
            (403, "AllocationQuota.FreeTierOnly", "providerQuota"),
            (403, "Arrearage", "providerBilling"),
            (402, "billing_error", "providerBilling"),
            (400, "Your credit balance is too low", "providerBilling"),
            (429, "budget_exceeded", "providerCostLimit"),
            (
                429,
                "organization_usage_limit_exceeded",
                "providerCostLimit",
            ),
        ] {
            let error = http_error(
                status,
                &json!({"error":{"code":code,"message":"secret sk-EXAMPLE"}}),
            );
            assert!(error.contains(expected));
            assert!(!error.contains("sk-EXAMPLE"));
        }
        assert!(
            http_error(429, &json!({"error":{"code":"rate_limit_exceeded"}}))
                .contains("providerRateLimit")
        );
        assert!(http_error(503, &json!({})).contains("providerUnavailable"));
    }
}
