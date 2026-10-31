use crate::features::review::ReviewRequest;
use serde_json::Value;
use std::time::Duration;
use zeroize::Zeroizing;

pub async fn request(config: &ReviewRequest, url: &str, body: &Value) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| crate::common::messages::failure("backend.review.providerClientInitFailed", serde_json::json!({}), "Could not initialize provider client".into()))?;
    let mut request = client.post(url).json(body);
    if config.provider != "ollama" {
        let key = Zeroizing::new(
            crate::features::credentials::get_ai_key(&config.provider).map_err(|_| {
                "Provider API key is missing or unavailable in the OS credential store"
            })?,
        );
        request = match config.provider.as_str() {
            "anthropic" => request
                .header("x-api-key", key.as_str())
                .header("anthropic-version", "2023-06-01"),
            "gemini" => request.header("x-goog-api-key", key.as_str()),
            _ => request.bearer_auth(key.as_str()),
        };
    }
    let mut response = request
        .try_clone()
        .ok_or_else(|| crate::common::messages::failure("backend.review.providerRequestPrepareFailed", serde_json::json!({}), "Could not prepare provider request".into()))?
        .send()
        .await
        .map_err(|_| {
            "Provider request failed or timed out; check your connection and configuration"
        })?;
    // Retry once only for explicit transient HTTP statuses. Do not replay an
    // ambiguous network timeout or interrupted successful response (billing).
    if matches!(response.status().as_u16(), 429 | 502 | 503 | 504) {
        let delay = response
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(1)
            .clamp(1, 2);
        drop(response);
        tokio::time::sleep(Duration::from_secs(delay)).await;
        response = request
            .send()
            .await
            .map_err(|_| crate::common::messages::failure("backend.review.providerRetryFailedOrTimeout", serde_json::json!({}), "Provider retry failed or timed out".into()))?;
    }
    let status = response.status();
    if !status.is_success() {
        return Err(crate::common::messages::failure(
            "backend.review.providerHttpError",
            serde_json::json!({ "status": status.as_u16().to_string() }),
            format!("Provider returned HTTP {}. Check authentication, model/tool support and rate limits (at most one retry for transient HTTP errors).", status.as_u16()),
        ));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| crate::common::messages::failure("backend.review.providerResponseInterrupted", serde_json::json!({}), "Provider response interrupted".into()))?
    {
        if bytes.len() + chunk.len() > 512 * 1024 {
            return Err(crate::common::messages::failure("backend.review.providerResponseSafetyLimit", serde_json::json!({}), "Provider response exceeded the safety limit".into()));
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| crate::common::messages::failure("backend.review.providerResponseJsonInvalid", serde_json::json!({}), "Provider returned invalid JSON".into()))
}
