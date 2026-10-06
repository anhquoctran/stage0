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

// ---------------------------------------------------------------------------
// AI Cloud Subscription & CLI Bridge Commands (Phases 1, 2, 3)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn ai_detect_cli(
    cli_type: String,
) -> Result<crate::features::ai::cli_bridge::CliDetectionResult, String> {
    Ok(crate::features::ai::cli_bridge::detect_cli(&cli_type).await)
}

#[tauri::command]
pub async fn ai_execute_cli(
    cli_type: String,
    prompt: String,
    repo_path: Option<String>,
) -> Result<crate::features::ai::cli_bridge::CliExecutionResult, String> {
    crate::features::ai::cli_bridge::execute_cli(&cli_type, &prompt, repo_path.as_deref()).await
}

#[tauri::command]
pub async fn copilot_start_device_flow(
    client_id: Option<String>,
) -> Result<crate::features::ai::copilot::CopilotDeviceCodeResponse, String> {
    crate::features::ai::copilot::start_copilot_device_flow(client_id).await
}

#[tauri::command]
pub async fn copilot_poll_token(
    device_code: String,
    client_id: Option<String>,
) -> Result<crate::features::ai::copilot::CopilotPollResponse, String> {
    crate::features::ai::copilot::poll_copilot_token(&device_code, client_id).await
}

#[tauri::command]
pub async fn copilot_check_status(
) -> Result<crate::features::ai::copilot::CopilotAuthStatus, String> {
    Ok(crate::features::ai::copilot::check_copilot_auth_status().await)
}

#[tauri::command]
pub async fn copilot_disconnect() -> Result<(), String> {
    crate::features::ai::copilot::disconnect_copilot()
}

#[tauri::command]
pub async fn google_oauth_start(
    client_id: Option<String>,
) -> Result<crate::features::ai::google_oauth::GoogleOAuthStartResult, String> {
    crate::features::ai::google_oauth::start_google_oauth(client_id).await
}

#[tauri::command]
pub async fn google_oauth_check_status(
) -> Result<crate::features::ai::google_oauth::GoogleAuthStatus, String> {
    Ok(crate::features::ai::google_oauth::check_google_auth_status().await)
}

#[tauri::command]
pub async fn google_oauth_disconnect() -> Result<(), String> {
    crate::features::ai::google_oauth::disconnect_google()
}

#[tauri::command]
pub async fn chatgpt_oauth_start(
    client_id: Option<String>,
) -> Result<crate::features::ai::chatgpt_oauth::ChatGptOAuthStartResult, String> {
    crate::features::ai::chatgpt_oauth::start_chatgpt_oauth(client_id).await
}

#[tauri::command]
pub async fn chatgpt_oauth_check_status(
) -> Result<crate::features::ai::chatgpt_oauth::ChatGptAuthStatus, String> {
    Ok(crate::features::ai::chatgpt_oauth::check_chatgpt_auth_status().await)
}

#[tauri::command]
pub async fn chatgpt_oauth_disconnect() -> Result<(), String> {
    crate::features::ai::chatgpt_oauth::disconnect_chatgpt_subscription()
}

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    crate::features::ai::open_system_browser(&url)
}

#[tauri::command]
pub async fn ai_chat_dispatch(
    req: crate::features::ai::UnifiedAiChatRequest,
) -> Result<crate::features::ai::UnifiedAiChatResponse, String> {
    crate::features::ai::dispatch_ai_chat(req).await
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
