use crate::features::review::ReviewRequest;
use serde_json::Value;
use std::time::Duration;
use zeroize::Zeroizing;

pub async fn request(config: &ReviewRequest, url: &str, body: &Value) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| {
            crate::common::messages::failure(
                "backend.review.providerClientInitFailed",
                serde_json::json!({}),
                "Could not initialize provider client".into(),
            )
        })?;
    let mut request = client.post(url).json(body);
    if config.provider != "ollama" {
        let key = Zeroizing::new(
            crate::features::credentials::get_ai_key(&config.provider).map_err(|_| {
                crate::common::messages::code("backend.review.providerApiKeyRequired")
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
    // Retry only explicit transient rejections, never ambiguous transport loss.
    for attempt in 0..2 {
        let response = request
            .try_clone()
            .ok_or_else(|| {
                crate::common::messages::code("backend.review.providerRequestPrepareFailed")
            })?
            .send()
            .await
            .map_err(|error| crate::features::ai::provider_errors::network_error(&error))?;
        let status = response.status().as_u16();
        let delay = response
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(1);
        let body = crate::features::ai::provider_errors::read_json(response).await;
        if (200..300).contains(&status) {
            let body = body?;
            if body.get("error").is_some_and(|v| !v.is_null()) {
                return Err(crate::features::ai::provider_errors::http_error(
                    status, &body,
                ));
            }
            return Ok(body);
        }
        // HTML/invalid JSON errors still retain their HTTP classification.
        let error =
            crate::features::ai::provider_errors::http_error(status, &body.unwrap_or(Value::Null));
        let transient = error.contains("backend.ai.providerRateLimit")
            || error.contains("backend.ai.providerUnavailable");
        if attempt == 0 && transient && delay <= 2 {
            tokio::time::sleep(Duration::from_secs(delay.max(1))).await;
        } else {
            return Err(error);
        }
    }
    Err(crate::common::messages::code(
        "backend.ai.providerUnavailable",
    ))
}
