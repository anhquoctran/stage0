use reqwest::{Client, Url};

use crate::features::ai::dynamic_models::DynamicModelInfo;

const DEFAULT_COMPATIBLE_URL: &str = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const MAX_CATALOG_PAGES: usize = 10;

pub(super) async fn fetch(
    client: &Client,
    api_key: Option<&str>,
    base_url: Option<&str>,
) -> Result<Vec<DynamicModelInfo>, String> {
    let Some(api_key) = api_key else {
        return Err(crate::common::messages::code(
            "backend.ai.modelApiKeyRequired",
        ));
    };
    let catalog_url = catalog_url(base_url.unwrap_or(DEFAULT_COMPATIBLE_URL))?;
    let mut models = Vec::new();

    for page in 1..=MAX_CATALOG_PAGES {
        let mut request_url = catalog_url.clone();
        request_url
            .query_pairs_mut()
            .append_pair("page_no", &page.to_string())
            .append_pair("page_size", "100")
            .append_pair("providers", "qwen")
            .append_pair("capabilities", "TG")
            .append_pair("capabilities", "Reasoning")
            .append_pair("language", "en-US");

        let response = client
            .get(request_url)
            .bearer_auth(api_key)
            .send()
            .await
            .map_err(|error| {
                crate::common::messages::failure(
                    "backend.ai.modelDiscoveryFailed",
                    serde_json::json!({}),
                    format!("Qwen model catalog request failed: {error}"),
                )
            })?;
        if !response.status().is_success() {
            return Err(crate::common::messages::message(
                "backend.ai.modelCatalogHttp",
                serde_json::json!({ "status": response.status().as_u16() }),
            ));
        }
        let catalog: serde_json::Value = response.json().await.map_err(|error| {
            crate::common::messages::failure(
                "backend.ai.modelDiscoveryFailed",
                serde_json::json!({}),
                format!("Qwen model catalog response was invalid: {error}"),
            )
        })?;
        let page_models = catalog
            .pointer("/output/models")
            .and_then(serde_json::Value::as_array)
            .cloned()
            .unwrap_or_default();
        let total = catalog
            .pointer("/output/total")
            .and_then(serde_json::Value::as_u64)
            .unwrap_or(page_models.len() as u64) as usize;
        let page_count = page_models.len();

        for item in page_models {
            let Some(id) = item.get("model").and_then(serde_json::Value::as_str) else {
                continue;
            };
            if id.trim().is_empty() || !model_has_text_output(&item) {
                continue;
            }
            let has_reasoning = item
                .get("capabilities")
                .and_then(serde_json::Value::as_array)
                .is_some_and(|capabilities| {
                    capabilities
                        .iter()
                        .any(|capability| capability.as_str() == Some("Reasoning"))
                })
                || id.starts_with("qwen3.8");
            models.push(DynamicModelInfo {
                id: id.to_string(),
                name: item
                    .get("name")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or(id)
                    .to_string(),
                description: item
                    .get("description")
                    .and_then(serde_json::Value::as_str)
                    .map(str::to_string),
                reasoning_efforts: qwen_reasoning_efforts(id, has_reasoning),
                supports_fast_mode: None,
            });
        }

        if page_count == 0 || page.saturating_mul(100) >= total {
            break;
        }
    }

    models.sort_by(|left, right| left.id.cmp(&right.id));
    models.dedup_by(|left, right| left.id == right.id);
    Ok(models)
}

fn catalog_url(base_url: &str) -> Result<Url, String> {
    let mut endpoint = Url::parse(base_url.trim())
        .map_err(|_| crate::common::messages::code("backend.ai.modelBaseUrlInvalid"))?;
    if !matches!(endpoint.scheme(), "https" | "http") || endpoint.host_str().is_none() {
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
    endpoint.set_path("/api/v1/models");
    endpoint.set_query(None);
    endpoint.set_fragment(None);
    Ok(endpoint)
}

fn model_has_text_output(item: &serde_json::Value) -> bool {
    let Some(response_modalities) = item
        .pointer("/inference_metadata/response_modality")
        .and_then(serde_json::Value::as_array)
    else {
        return true;
    };
    response_modalities.iter().any(|modality| {
        modality
            .as_str()
            .is_some_and(|value| value.eq_ignore_ascii_case("text"))
    })
}

fn qwen_reasoning_efforts(model: &str, has_reasoning: bool) -> Option<Vec<String>> {
    if has_reasoning && model.starts_with("qwen3.8") {
        Some(vec![
            "none".into(),
            "low".into(),
            "medium".into(),
            "xhigh".into(),
        ])
    } else {
        None
    }
}
