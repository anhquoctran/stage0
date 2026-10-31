use reqwest::Client;

use super::collection_endpoint;
use crate::features::ai::dynamic_models::gemini_model_list_response::GeminiModelListResponse;
use crate::features::ai::dynamic_models::DynamicModelInfo;

pub(super) async fn fetch(
    client: &Client,
    api_key: Option<&str>,
    base_url: Option<&str>,
) -> Result<Vec<DynamicModelInfo>, String> {
    let key =
        api_key.ok_or_else(|| crate::common::messages::code("backend.ai.modelApiKeyRequired"))?;
    let default_url = "https://generativelanguage.googleapis.com/v1beta";
    let endpoint = collection_endpoint(base_url.unwrap_or(default_url), default_url, "models")?;
    let response = client
        .get(&endpoint)
        .header("x-goog-api-key", key)
        .send()
        .await
        .map_err(|error| crate::features::ai::provider_errors::network_error(&error))?;
    let data: GeminiModelListResponse =
        crate::features::ai::provider_errors::response_json(response).await?;
    let mut models = data
        .models
        .unwrap_or_default()
        .into_iter()
        .filter(|item| {
            item.name
                .trim_start_matches("models/")
                .starts_with("gemini-")
                && item
                    .supported_generation_methods
                    .as_ref()
                    .is_some_and(|methods| methods.iter().any(|method| method == "generateContent"))
        })
        .map(|item| {
            let id = item.name.trim_start_matches("models/").to_string();
            DynamicModelInfo {
                name: item.display_name.unwrap_or_else(|| id.clone()),
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
