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
        "Ollama",
    )?;
    let response = client
        .get(endpoint)
        .send()
        .await
        .map_err(|error| format!("Could not query the local Ollama model catalog: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Ollama model API returned HTTP {}.",
            response.status()
        ));
    }

    let data: OllamaTagsResponse = response
        .json()
        .await
        .map_err(|error| format!("Could not read the Ollama model catalog: {error}"))?;
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
