use reqwest::{Client, StatusCode};

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
        return Err(format!(
            "An API key is required to load models from {provider}."
        ));
    }

    let default_url = match provider {
        "openai" => "https://api.openai.com/v1",
        "xai_grok" | "grok" | "xai" => "https://api.x.ai/v1",
        _ => "https://api.deepseek.com/v1",
    };
    let endpoint = collection_endpoint(
        base_url.unwrap_or(default_url),
        default_url,
        "models",
        provider,
    )?;
    let mut request = client.get(&endpoint);
    if let Some(key) = api_key {
        request = request.bearer_auth(key);
    }

    let response = request
        .send()
        .await
        .map_err(|error| format!("Could not query the {provider} model catalog: {error}"))?;
    ensure_success(response.status(), provider)?;
    let data: OpenAiModelListResponse = response
        .json()
        .await
        .map_err(|error| format!("Could not read the {provider} model catalog: {error}"))?;

    let mut models = data
        .data
        .unwrap_or_default()
        .into_iter()
        .filter(|model| model_is_usable(provider, &model.id))
        .map(|model| {
            let id = model.id;
            DynamicModelInfo {
                name: id.clone(),
                id,
                description: None,
                reasoning_efforts: None,
                supports_fast_mode: None,
            }
        })
        .collect::<Vec<_>>();
    models.sort_by(|left, right| left.id.cmp(&right.id));
    models.dedup_by(|left, right| left.id == right.id);
    Ok(models)
}

fn ensure_success(status: StatusCode, provider: &str) -> Result<(), String> {
    if status.is_success() {
        Ok(())
    } else {
        Err(format!("{provider} model API returned HTTP {status}."))
    }
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
