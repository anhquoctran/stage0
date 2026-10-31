use reqwest::Client;

use super::collection_endpoint;
use crate::features::ai::dynamic_models::open_ai_model_list_response::OpenAiModelListResponse;
use crate::features::ai::dynamic_models::DynamicModelInfo;

pub(super) async fn fetch(
    client: &Client,
    provider: &str,
    api_key: Option<&str>,
    base_url: Option<&str>,
) -> Result<Vec<DynamicModelInfo>, String> {
    if provider != "custom" && api_key.is_none() {
        return Err(crate::common::messages::code(
            "backend.ai.modelApiKeyRequired",
        ));
    }

    let default_url = match provider {
        "openai" => "https://api.openai.com/v1",
        "xai_grok" | "grok" | "xai" => "https://api.x.ai/v1",
        "deepseek" => "https://api.deepseek.com",
        "kimi" => "https://api.moonshot.ai/v1",
        "zai" | "z_ai" => "https://api.z.ai/api/coding/paas/v4",
        "opencode" => "https://opencode.ai/zen/v1",
        _ => "https://api.openai.com/v1",
    };
    let endpoint = collection_endpoint(base_url.unwrap_or(default_url), default_url, "models")?;
    let mut request = client.get(&endpoint);
    if let Some(key) = api_key {
        request = request.bearer_auth(key);
    }

    let response = request
        .send()
        .await
        .map_err(|error| crate::features::ai::provider_errors::network_error(&error))?;
    let data: OpenAiModelListResponse =
        crate::features::ai::provider_errors::response_json(response).await?;
    let mut models = data
        .data
        .unwrap_or_default()
        .into_iter()
        .filter(|model| model_is_usable(provider, &model.id))
        .map(|model| {
            let id = model.id;
            let reasoning_efforts = if provider == "deepseek" {
                model.effort.and_then(|effort| {
                    let supported = effort
                        .get("supported_levels")
                        .and_then(serde_json::Value::as_array)
                        .into_iter()
                        .flatten()
                        .filter_map(serde_json::Value::as_str)
                        .filter(|level| matches!(*level, "low" | "high" | "max"))
                        .map(str::to_string)
                        .collect::<Vec<_>>();
                    (!supported.is_empty()).then(|| {
                        let mut levels = vec!["none".to_string()];
                        levels.extend(supported);
                        levels
                    })
                })
            } else if provider == "kimi" && matches!(id.as_str(), "kimi-k3" | "kimi-k3.1-pro") {
                Some(vec!["low".into(), "high".into(), "max".into()])
            } else {
                None
            };
            DynamicModelInfo {
                name: model.name.unwrap_or_else(|| id.clone()),
                id,
                description: None,
                reasoning_efforts,
                supports_fast_mode: None,
            }
        })
        .collect::<Vec<_>>();
    models.sort_by(|left, right| left.id.cmp(&right.id));
    models.dedup_by(|left, right| left.id == right.id);
    Ok(models)
}

fn model_is_usable(provider: &str, id: &str) -> bool {
    if id.trim().is_empty() || is_non_generation_model(id) {
        return false;
    }
    match provider {
        "openai" => {
            id.starts_with("gpt-")
                || id.starts_with("o1")
                || id.starts_with("o3")
                || id.starts_with("o4")
                || id.starts_with("chatgpt-")
        }
        "xai_grok" | "grok" | "xai" => id.starts_with("grok"),
        "deepseek" | "kimi" | "zai" | "z_ai" | "opencode" => true,
        _ => true,
    }
}

fn is_non_generation_model(id: &str) -> bool {
    [
        "embedding",
        "whisper",
        "tts",
        "dall-e",
        "moderation",
        "realtime",
    ]
    .iter()
    .any(|excluded| id.to_ascii_lowercase().contains(excluded))
}

#[cfg(test)]
mod tests {
    use super::model_is_usable;

    #[test]
    fn official_catalogs_filter_to_provider_generation_models() {
        assert!(model_is_usable("openai", "gpt-4.1"));
        assert!(!model_is_usable("openai", "text-embedding-3-large"));
        assert!(model_is_usable("xai_grok", "grok-3"));
        assert!(!model_is_usable("xai_grok", "gpt-4.1"));
    }

    #[test]
    fn compatible_custom_catalog_keeps_unrecognized_model_ids_but_excludes_non_generation_models() {
        assert!(model_is_usable("custom", "provider/model-v2"));
        assert!(!model_is_usable("custom", "custom-embedding-model"));
        assert!(!model_is_usable("custom", "  "));
    }
}
