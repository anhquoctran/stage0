#[tauri::command]
pub async fn store_ai_api_key(
    app: tauri::AppHandle,
    provider: String,
    api_key: String,
) -> Result<(), String> {
    let result: Result<_, String> = async {
        let api_key = zeroize::Zeroizing::new(api_key);
        let p = provider.trim();
        let k = api_key.trim();
        if p.is_empty() {
            return Err(crate::common::messages::code("backend.ai.providerRequired"));
        }
        let mut keys = std::collections::BTreeMap::new();
        let removals = if k.is_empty() {
            vec![p.to_string()]
        } else {
            keys.insert(p.to_string(), k.to_string());
            vec![]
        };
        super::preferences::commit_ai_preferences(app, keys, Some(removals), None, None, None)
            .await
            .map(|_| ())
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("ai", error))
}

#[tauri::command]
pub async fn has_ai_api_key(provider: String) -> Result<bool, String> {
    let result: Result<_, String> = async {
        let p = provider.trim();
        if p.is_empty() {
            return Ok(false);
        }
        crate::features::credentials::ai_key_exists(p)
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("ai", error))
}

#[tauri::command]
pub async fn delete_ai_api_key(app: tauri::AppHandle, provider: String) -> Result<(), String> {
    let result: Result<_, String> = async {
        let p = provider.trim();
        if p.is_empty() {
            return Ok(());
        }
        store_ai_api_key(app, provider, String::new()).await
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("ai", error))
}

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    let result: Result<_, String> = async { crate::features::ai::open_system_browser(&url) }.await;
    result.map_err(|error| crate::common::messages::command_error("ai", error))
}

#[tauri::command]
pub async fn fetch_ai_models(
    provider: String,
    mut api_key: Option<String>,
    base_url: Option<String>,
) -> Result<Vec<crate::features::ai::dynamic_models::DynamicModelInfo>, String> {
    let result: Result<_, String> = async {
        use zeroize::Zeroize;

        let result = crate::features::ai::dynamic_models::fetch_provider_models(
            &provider,
            api_key.as_deref(),
            base_url.as_deref(),
        )
        .await;
        if let Some(key) = api_key.as_mut() {
            key.zeroize();
        }
        result
    }
    .await;
    result.map_err(|error| {
        if error.starts_with(crate::common::messages::PREFIX) {
            error
        } else {
            crate::common::messages::failure(
                "backend.ai.modelDiscoveryFailed",
                serde_json::json!({}),
                error,
            )
        }
    })
}
