use reqwest::Client;

use super::collection_endpoint;
use crate::features::ai::dynamic_models::anthropic_model_list_response::AnthropicModelListResponse;
use crate::features::ai::dynamic_models::DynamicModelInfo;

pub(super) async fn fetch(
    client: &Client,
    api_key: Option<&str>,
    base_url: Option<&str>,
) -> Result<Vec<DynamicModelInfo>, String> {
    let key =
        api_key.ok_or_else(|| "An API key is required to load Anthropic models.".to_string())?;
    let default_url = "https://api.anthropic.com/v1";
    let endpoint = collection_endpoint(
        base_url.unwrap_or(default_url),
        default_url,
        "models",
        "Anthropic",
    )?;
    let response = client
        .get(&endpoint)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|error| format!("Could not query the Anthropic model catalog: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Anthropic model API returned HTTP {}.",
            response.status()
        ));
    }

    let data: AnthropicModelListResponse = response
        .json()
        .await
        .map_err(|error| format!("Could not read the Anthropic model catalog: {error}"))?;
    let mut models = data
        .data
        .unwrap_or_default()
        .into_iter()
        .filter(|item| item.id.starts_with("claude-"))
        .map(|item| {
            let reasoning_efforts = supported_efforts(item.capabilities.as_ref());
            let supports_fast_mode = Some(item.id == "claude-opus-5-5");
            let name = item.display_name.unwrap_or_else(|| item.id.clone());
            DynamicModelInfo {
                id: item.id,
                name,
                description: None,
                reasoning_efforts,
                supports_fast_mode,
            }
        })
        .collect::<Vec<_>>();
    models.sort_by(|left, right| left.id.cmp(&right.id));
    models.dedup_by(|left, right| left.id == right.id);
    Ok(models)
}

fn supported_efforts(capabilities: Option<&serde_json::Value>) -> Option<Vec<String>> {
    let effort = capabilities?.get("effort")?;
    if effort.get("supported")?.as_bool()? != true {
        return None;
    }
    Some(
        ["low", "medium", "high", "xhigh", "max"]
            .iter()
            .filter(|level| {
                effort
                    .get(**level)
                    .and_then(|v| v.get("supported"))
                    .and_then(|v| v.as_bool())
                    == Some(true)
            })
            .map(|level| (*level).to_string())
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use super::supported_efforts;
    use serde_json::json;

    #[test]
    fn effort_levels_come_from_the_advertised_capabilities() {
        let capabilities = json!({"effort": {"supported": true, "low": {"supported": true}, "high": {"supported": true}, "max": {"supported": false}}});
        assert_eq!(
            supported_efforts(Some(&capabilities)),
            Some(vec!["low".into(), "high".into()])
        );
        assert_eq!(
            supported_efforts(Some(&json!({"effort": {"supported": false}}))),
            None
        );
        assert_eq!(supported_efforts(None), None);
    }
}
