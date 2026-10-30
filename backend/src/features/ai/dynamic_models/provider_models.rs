mod anthropic;
mod gemini;
mod ollama;
mod openai_compatible;
mod qwen;

use reqwest::Url;
use std::time::Duration;
use zeroize::Zeroizing;

use super::DynamicModelInfo;

pub(super) fn collection_endpoint(
    base_url: &str,
    default_url: &str,
    collection: &str,
) -> Result<String, String> {
    let base = if base_url.trim().is_empty() {
        default_url
    } else {
        base_url.trim()
    };
    let mut endpoint = Url::parse(base)
        .map_err(|_| crate::common::messages::code("backend.ai.modelBaseUrlInvalid"))?;
    if !matches!(endpoint.scheme(), "http" | "https") || endpoint.host_str().is_none() {
        return Err(crate::common::messages::code(
            "backend.ai.modelBaseUrlInvalid",
        ));
    }

    endpoint
        .set_username("")
        .map_err(|_| crate::common::messages::code("backend.ai.modelBaseUrlInvalid"))?;
    endpoint
        .set_password(None)
        .map_err(|_| crate::common::messages::code("backend.ai.modelBaseUrlInvalid"))?;
    endpoint.set_query(None);
    endpoint.set_fragment(None);
    let path = endpoint.path().trim_end_matches('/');
    if collection == "api/tags" && path.ends_with("/api") {
        endpoint.set_path(&format!("{path}/tags"));
    } else if !path.ends_with(&format!("/{collection}")) {
        endpoint.set_path(&format!("{path}/{collection}"));
    }
    Ok(endpoint.to_string())
}

/// Lists models only from the configured provider endpoint. This is called by an explicit UI action.
pub async fn fetch_provider_models(
    provider: &str,
    api_key: Option<&str>,
    base_url: Option<&str>,
) -> Result<Vec<DynamicModelInfo>, String> {
    if provider == "custom" && base_url.is_none_or(|url| url.trim().is_empty()) {
        return Err(crate::common::messages::code(
            "backend.ai.customModelBaseUrlRequired",
        ));
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|error| {
            crate::common::messages::failure(
                "backend.ai.modelDiscoveryFailed",
                serde_json::json!({}),
                format!("Failed to create HTTP client: {error}"),
            )
        })?;

    let resolved_key = if provider == "ollama" {
        None
    } else if let Some(key) = api_key.filter(|key| !key.trim().is_empty()) {
        Some(Zeroizing::new(key.trim().to_string()))
    } else {
        crate::features::credentials::get_ai_key(provider)
            .ok()
            .filter(|key| !key.trim().is_empty())
            .map(Zeroizing::new)
    };
    let resolved_key = resolved_key.as_deref().map(|key| key.as_str());

    match provider {
        "openai" | "xai_grok" | "grok" | "xai" | "deepseek" | "kimi" | "custom" => {
            openai_compatible::fetch(&client, provider, resolved_key, base_url).await
        }
        "qwen" => qwen::fetch(&client, resolved_key, base_url).await,
        "anthropic" => anthropic::fetch(&client, resolved_key, base_url).await,
        "gemini" => gemini::fetch(&client, resolved_key, base_url).await,
        "ollama" => ollama::fetch(&client, base_url).await,
        _ => Err(crate::common::messages::code(
            "backend.ai.modelDiscoveryUnsupported",
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::collection_endpoint;

    #[test]
    fn collection_endpoint_strips_embedded_credentials_and_query_values() {
        let endpoint = collection_endpoint(
            "https://user:secret@example.test/v1/?token=hidden#fragment",
            "https://fallback.test/v1",
            "models",
        )
        .unwrap();

        assert_eq!(endpoint, "https://example.test/v1/models");
        assert!(!endpoint.contains("secret"));
        assert!(!endpoint.contains("hidden"));
    }

    #[test]
    fn collection_endpoint_keeps_a_complete_resource_path() {
        let endpoint = collection_endpoint(
            "https://example.test/v1/models",
            "https://fallback.test/v1",
            "models",
        )
        .unwrap();

        assert_eq!(endpoint, "https://example.test/v1/models");
    }

    #[test]
    fn ollama_base_url_can_include_its_api_prefix() {
        let endpoint = collection_endpoint(
            "http://localhost:11434/api",
            "http://localhost:11434",
            "api/tags",
        )
        .unwrap();

        assert_eq!(endpoint, "http://localhost:11434/api/tags");
    }

    #[test]
    fn collection_endpoint_rejects_non_http_schemes() {
        let result =
            collection_endpoint("file:///tmp/models", "https://fallback.test/v1", "models");

        assert!(result.unwrap_err().contains("HTTP or HTTPS"));
    }
}
