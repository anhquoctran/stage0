use reqwest::Client;

use super::collection_endpoint;
use crate::features::ai::dynamic_models::ollama_tags_response::OllamaTagsResponse;
use crate::features::ai::dynamic_models::DynamicModelInfo;

pub(super) async fn fetch(
    client: &Client,
    base_url: Option<&str>,
) -> Result<Vec<DynamicModelInfo>, String> {
    let endpoint = collection_endpoint(
        base_url.unwrap_or("http://localhost:11434"),
        "http://localhost:11434",
        "api/tags",
    )?;
    let response = client
        .get(endpoint)
        .send()
        .await
        .map_err(|error| crate::features::ai::provider_errors::network_error(&error))?;
    let data: OllamaTagsResponse =
        crate::features::ai::provider_errors::response_json(response).await?;
    let mut models = data
        .models
        .unwrap_or_default()
        .into_iter()
        .filter(|item| !item.name.trim().is_empty())
        .map(|item| DynamicModelInfo {
            id: item.name.clone(),
            name: item.name,
            description: None,
            reasoning_efforts: None,
            supports_fast_mode: None,
        })
        .collect::<Vec<_>>();
    models.sort_by(|left, right| left.id.cmp(&right.id));
    models.dedup_by(|left, right| left.id == right.id);
    Ok(models)
}
