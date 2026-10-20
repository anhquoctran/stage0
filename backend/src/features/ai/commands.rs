#[tauri::command]
pub async fn store_ai_api_key(provider: String, api_key: String) -> Result<(), String> {
    let p = provider.trim();
    let k = api_key.trim();
    if p.is_empty() {
        return Err("AI provider cannot be empty".to_string());
    }
    if k.is_empty() {
        return crate::features::credentials::delete_ai_key(p);
    }
    crate::features::credentials::store_ai_key(p, k)
}

#[tauri::command]
pub async fn has_ai_api_key(provider: String) -> Result<bool, String> {
    let p = provider.trim();
    if p.is_empty() {
        return Ok(false);
    }
    crate::features::credentials::ai_key_exists(p)
}

#[tauri::command]
pub async fn delete_ai_api_key(provider: String) -> Result<(), String> {
    let p = provider.trim();
    if p.is_empty() {
        return Ok(());
    }
    crate::features::credentials::delete_ai_key(p)
}

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    crate::features::ai::open_system_browser(&url)
}

#[tauri::command]
pub async fn fetch_ai_models(
    provider: String,
    api_key: Option<String>,
    base_url: Option<String>,
) -> Result<Vec<crate::features::ai::dynamic_models::DynamicModelInfo>, String> {
    crate::features::ai::dynamic_models::fetch_provider_models(
        &provider,
        api_key.as_deref(),
        base_url.as_deref(),
    )
    .await
}
