use serde::{Deserialize, Serialize};
use std::time::Duration;

pub const DEFAULT_COPILOT_CLIENT_ID: &str = "Iv1.b507a08c87ecfe48";
const APP_EDITOR_VERSION: &str = "stage0/0.1.2";
const APP_PLUGIN_VERSION: &str = "stage0-copilot/0.1.2";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotDeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotPollResponse {
    pub status: String, // "authorized", "pending", "slow_down", "expired", "error"
    pub access_token: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotInternalSessionToken {
    pub token: String,
    pub expires_at: u64,
    pub endpoints: Option<CopilotEndpoints>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotEndpoints {
    pub api: Option<String>,
    pub proxy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotAuthStatus {
    pub connected: bool,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub has_subscription: bool,
    pub expires_at: Option<u64>,
    pub error: Option<String>,
}

/// Step 1: Start GitHub Device Code Authorization Flow (RFC 8628)
pub async fn start_copilot_device_flow(
    client_id: Option<String>,
) -> Result<CopilotDeviceCodeResponse, String> {
    let cid = client_id.unwrap_or_else(|| DEFAULT_COPILOT_CLIENT_ID.to_string());
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let payload = serde_json::json!({
        "client_id": cid,
        "scope": "read:user"
    });

    let resp = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .header("User-Agent", APP_EDITOR_VERSION)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error contacting GitHub device endpoint: {}", e))?;

    if !resp.status().is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub device code request failed: {}", err_text));
    }

    let result: CopilotDeviceCodeResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub device code response: {}", e))?;

    Ok(result)
}

/// Step 2: Poll GitHub for OAuth token completion
pub async fn poll_copilot_token(
    device_code: &str,
    client_id: Option<String>,
) -> Result<CopilotPollResponse, String> {
    let cid = client_id.unwrap_or_else(|| DEFAULT_COPILOT_CLIENT_ID.to_string());
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let payload = serde_json::json!({
        "client_id": cid,
        "device_code": device_code,
        "grant_type": "urn:ietf:params:oauth:grant-type:device_code"
    });

    let resp = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .header("User-Agent", APP_EDITOR_VERSION)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error polling GitHub token: {}", e))?;

    let val: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))?;

    if let Some(token) = val.get("access_token").and_then(|t| t.as_str()) {
        // Successfully authorized! Save to Keyring
        crate::features::credentials::store_ai_key("github_copilot", token)?;

        return Ok(CopilotPollResponse {
            status: "authorized".to_string(),
            access_token: Some(token.to_string()),
            error_message: None,
        });
    }

    if let Some(error) = val.get("error").and_then(|e| e.as_str()) {
        match error {
            "authorization_pending" => Ok(CopilotPollResponse {
                status: "pending".to_string(),
                access_token: None,
                error_message: None,
            }),
            "slow_down" => Ok(CopilotPollResponse {
                status: "slow_down".to_string(),
                access_token: None,
                error_message: None,
            }),
            "expired_token" => Ok(CopilotPollResponse {
                status: "expired".to_string(),
                access_token: None,
                error_message: Some(
                    "Device authorization code expired. Please restart sign-in.".to_string(),
                ),
            }),
            "access_denied" => Ok(CopilotPollResponse {
                status: "denied".to_string(),
                access_token: None,
                error_message: Some("Authorization was cancelled by user.".to_string()),
            }),
            other => Ok(CopilotPollResponse {
                status: "error".to_string(),
                access_token: None,
                error_message: Some(
                    val.get("error_description")
                        .and_then(|d| d.as_str())
                        .unwrap_or(other)
                        .to_string(),
                ),
            }),
        }
    } else {
        Ok(CopilotPollResponse {
            status: "error".to_string(),
            access_token: None,
            error_message: Some("Unexpected response from GitHub".to_string()),
        })
    }
}

/// Exchange GitHub user token for Copilot internal session token
pub async fn get_internal_copilot_token(
    gh_token: &str,
) -> Result<CopilotInternalSessionToken, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let resp = client
        .get("https://api.github.com/copilot_internal/v2/token")
        .header("Authorization", format!("Bearer {}", gh_token))
        .header("Editor-Version", APP_EDITOR_VERSION)
        .header("Editor-Plugin-Version", APP_PLUGIN_VERSION)
        .header("User-Agent", APP_EDITOR_VERSION)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Error contacting Copilot token endpoint: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        if status.as_u16() == 403 {
            return Err("GitHub account is authorized, but no active GitHub Copilot subscription was found.".to_string());
        }
        return Err(format!(
            "Copilot session exchange failed (HTTP {}): {}",
            status, body
        ));
    }

    let val: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Copilot token JSON: {}", e))?;

    let token = val
        .get("token")
        .and_then(|t| t.as_str())
        .ok_or_else(|| "Missing token field in Copilot internal response".to_string())?
        .to_string();

    let expires_at = val
        .get("expires_at")
        .and_then(|e| e.as_u64())
        .unwrap_or_else(|| chrono::Utc::now().timestamp() as u64 + 1800);

    let endpoints = val.get("endpoints").map(|ep| CopilotEndpoints {
        api: ep
            .get("api")
            .and_then(|a| a.as_str())
            .map(|s| s.to_string()),
        proxy: ep
            .get("proxy")
            .and_then(|p| p.as_str())
            .map(|s| s.to_string()),
    });

    Ok(CopilotInternalSessionToken {
        token,
        expires_at,
        endpoints,
    })
}

/// Check existing Copilot subscription and GitHub account info
pub async fn check_copilot_auth_status() -> CopilotAuthStatus {
    let gh_token = match crate::features::credentials::get_ai_key("github_copilot") {
        Ok(t) if !t.trim().is_empty() => t,
        _ => {
            return CopilotAuthStatus {
                connected: false,
                username: None,
                avatar_url: None,
                has_subscription: false,
                expires_at: None,
                error: None,
            };
        }
    };

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return CopilotAuthStatus {
                connected: false,
                username: None,
                avatar_url: None,
                has_subscription: false,
                expires_at: None,
                error: Some(e.to_string()),
            };
        }
    };

    // 1. Fetch user profile
    let user_resp = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", gh_token))
        .header("User-Agent", APP_EDITOR_VERSION)
        .header("Accept", "application/json")
        .send()
        .await;

    let (username, avatar_url) = match user_resp {
        Ok(res) if res.status().is_success() => {
            if let Ok(u) = res.json::<serde_json::Value>().await {
                let name = u
                    .get("login")
                    .and_then(|l| l.as_str())
                    .map(|s| s.to_string());
                let avatar = u
                    .get("avatar_url")
                    .and_then(|a| a.as_str())
                    .map(|s| s.to_string());
                (name, avatar)
            } else {
                (None, None)
            }
        }
        _ => (None, None),
    };

    // 2. Validate Copilot subscription access
    match get_internal_copilot_token(&gh_token).await {
        Ok(session) => CopilotAuthStatus {
            connected: true,
            username,
            avatar_url,
            has_subscription: true,
            expires_at: Some(session.expires_at),
            error: None,
        },
        Err(err) => CopilotAuthStatus {
            connected: true,
            username,
            avatar_url,
            has_subscription: false,
            expires_at: None,
            error: Some(err),
        },
    }
}

/// Sign out from Copilot by removing token from Keyring
pub fn disconnect_copilot() -> Result<(), String> {
    crate::features::credentials::delete_ai_key("github_copilot")
}

/// Send a chat completion request to GitHub Copilot endpoint
pub async fn chat_copilot(
    prompt: &str,
    system_prompt: Option<&str>,
    model: Option<&str>,
) -> Result<String, String> {
    let gh_token = crate::features::credentials::get_ai_key("github_copilot").map_err(|_| {
        "Not signed into GitHub Copilot. Please connect in preferences.".to_string()
    })?;

    let session = get_internal_copilot_token(&gh_token).await?;

    let base_api = session
        .endpoints
        .as_ref()
        .and_then(|ep| ep.api.as_deref())
        .unwrap_or("https://api.individual.githubcopilot.com");

    let chat_endpoint = format!("{}/chat/completions", base_api);
    let selected_model = model.unwrap_or("gpt-4o");

    let mut messages = Vec::new();
    if let Some(sys) = system_prompt {
        if !sys.trim().is_empty() {
            messages.push(serde_json::json!({
                "role": "system",
                "content": sys
            }));
        }
    }
    messages.push(serde_json::json!({
        "role": "user",
        "content": prompt
    }));

    let body = serde_json::json!({
        "model": selected_model,
        "messages": messages,
        "temperature": 0.2,
        "stream": false
    });

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let resp = client
        .post(&chat_endpoint)
        .header("Authorization", format!("Bearer {}", session.token))
        .header("Editor-Version", APP_EDITOR_VERSION)
        .header("Editor-Plugin-Version", APP_PLUGIN_VERSION)
        .header("Copilot-Integration-Id", "vscode-chat")
        .header("Openai-Organization", "github-copilot")
        .header("Openai-Intent", "conversation-panel")
        .header("User-Agent", APP_EDITOR_VERSION)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Copilot Chat network request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let err_body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Copilot Chat error (HTTP {}): {}",
            status, err_body
        ));
    }

    let resp_json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Copilot Chat response: {}", e))?;

    let content = resp_json
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c0| c0.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|text| text.as_str())
        .ok_or_else(|| "No completion choices received from Copilot".to_string())?;

    Ok(content.to_string())
}
