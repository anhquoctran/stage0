use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::Mutex;

// Default Desktop OAuth Client ID for Gemini / Generative Language
pub const DEFAULT_GOOGLE_CLIENT_ID: &str =
    "838848492025-a1s9p5m13k0o4e815n9g3j3r2g5b1a0p.apps.googleusercontent.com";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleOAuthStartResult {
    pub auth_url: String,
    pub state: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleAuthStatus {
    pub connected: bool,
    pub account_email: Option<String>,
    pub auth_method: String, // "oauth_pkce", "gcloud_adc", "none"
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    #[allow(dead_code)]
    expires_in: Option<u64>,
    #[allow(dead_code)]
    token_type: Option<String>,
}

/// Generate cryptographically secure PKCE verifier and S256 challenge
pub fn generate_pkce() -> (String, String) {
    let verifier = format!("{}-{}", uuid::Uuid::new_v4(), uuid::Uuid::new_v4());
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(hash);
    (verifier, challenge)
}

/// Inspect standard locations for Google Cloud Application Default Credentials (ADC)
pub fn check_gcloud_adc() -> Option<(String, String)> {
    let mut path = None;

    if let Some(config_dir) = crate::ai::cli_bridge::get_config_dir() {
        let p = config_dir.join("gcloud").join("application_default_credentials.json");
        if p.exists() {
            path = Some(p);
        }
    }

    if path.is_none() {
        if let Some(home_dir) = crate::ai::cli_bridge::get_home_dir() {
            let p = home_dir.join(".config").join("gcloud").join("application_default_credentials.json");
            if p.exists() {
                path = Some(p);
            }
        }
    }

    if let Some(p) = path {
        if let Ok(content) = std::fs::read_to_string(p) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                let refresh_token = json.get("refresh_token").and_then(|r| r.as_str()).map(|s| s.to_string());
                let email = json.get("account").or_else(|| json.get("client_email")).and_then(|e| e.as_str()).map(|s| s.to_string());
                if let Some(rt) = refresh_token {
                    return Some((rt, email.unwrap_or_else(|| "gcloud ADC User".to_string())));
                }
            }
        }
    }

    None
}

/// Global holder for ongoing PKCE verifier using tokio Mutex
static PENDING_VERIFIER: Mutex<Option<String>> = Mutex::const_new(None);

/// Start Google OAuth 2.0 PKCE Loopback Server
pub async fn start_google_oauth(
    client_id: Option<String>,
) -> Result<GoogleOAuthStartResult, String> {
    let cid = client_id.unwrap_or_else(|| DEFAULT_GOOGLE_CLIENT_ID.to_string());
    let (verifier, challenge) = generate_pkce();

    // Store verifier for token exchange
    {
        let mut lock = PENDING_VERIFIER.lock().await;
        *lock = Some(verifier);
    }

    // Bind local listener to ephemeral port
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to start loopback server for OAuth callback: {}", e))?;

    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to read local loopback port: {}", e))?
        .port();

    let redirect_uri = format!("http://127.0.0.1:{}/callback", port);
    let state = uuid::Uuid::new_v4().to_string();

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?\
        client_id={}&\
        redirect_uri={}&\
        response_type=code&\
        scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgenerative-language%20email&\
        code_challenge={}&\
        code_challenge_method=S256&\
        state={}&\
        access_type=offline&\
        prompt=consent",
        cid,
        redirect_uri,
        challenge,
        state
    );

    // Spawn background task to accept single redirect callback
    let state_clone = state.clone();
    let cid_clone = cid.clone();
    tokio::spawn(async move {
        handle_loopback_callback(listener, state_clone, redirect_uri, cid_clone).await;
    });

    // Automatically open default system browser
    if let Err(e) = crate::ai::open_system_browser(&auth_url) {
        eprintln!("[OAuth] Failed to open system browser: {}", e);
    }

    Ok(GoogleOAuthStartResult {
        auth_url,
        state,
        port,
    })
}

/// Wait for redirect HTTP GET /callback?code=...
async fn handle_loopback_callback(
    listener: TcpListener,
    expected_state: String,
    redirect_uri: String,
    client_id: String,
) {
    if let Ok(Ok((mut socket, _))) =
        tokio::time::timeout(Duration::from_secs(180), listener.accept()).await
    {
        let mut buffer = [0u8; 4096];
        if let Ok(n) = socket.read(&mut buffer).await {
            let request = String::from_utf8_lossy(&buffer[..n]);
            let first_line = request.lines().next().unwrap_or_default();

            // Extract query from GET /callback?code=...&state=...
            if let Some(query_start) = first_line.find("/callback?") {
                let end = first_line[query_start..].find(' ').unwrap_or(first_line.len() - query_start);
                let query = &first_line[query_start + 10..query_start + end];

                let mut code = None;
                let mut state = None;

                for pair in query.split('&') {
                    let mut parts = pair.splitn(2, '=');
                    if let (Some(k), Some(v)) = (parts.next(), parts.next()) {
                        if k == "code" {
                            code = Some(v.to_string());
                        } else if k == "state" {
                            state = Some(v.to_string());
                        }
                    }
                }

                if state.as_deref() == Some(&expected_state) && code.is_some() {
                    let auth_code = code.unwrap();
                    let exchange_res = exchange_google_code(&auth_code, &redirect_uri, &client_id).await;

                    let (status_line, body): (&str, String) = match exchange_res {
                        Ok(_) => (
                            "HTTP/1.1 200 OK",
                            r#"<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#181825;color:#cdd6f4;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:2.5rem;background:#1e1e2e;border-radius:16px;border:1px solid #313244;box-shadow:0 8px 32px rgba(0,0,0,0.4);max-width:420px;"><div style="font-size:40px;margin-bottom:12px;">✨</div><h2 style="color:#a6e3a1;margin:0 0 10px 0;">Google AI Pro Connected!</h2><p style="color:#a6adc8;font-size:14px;margin:0 0 20px 0;">Your Google AI subscription has been verified. You may close this window and return to Stage0.</p><button onclick="window.close()" style="background:#89b4fa;color:#11111b;border:none;padding:8px 20px;border-radius:8px;font-weight:600;cursor:pointer;">Close Window</button></div></body></html>"#.to_string(),
                        ),
                        Err(err) => (
                            "HTTP/1.1 400 Bad Request",
                            format!(
                                r#"<!DOCTYPE html><html><body style="font-family:system-ui;background:#181825;color:#f38ba8;padding:2rem;"><div style="max-width:480px;margin:auto;"><h2>Authentication Error</h2><p>{}</p></div></body></html>"#,
                                err
                            ),
                        ),
                    };

                    let response = format!(
                        "{}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        status_line,
                        body.len(),
                        body
                    );
                    let _ = socket.write_all(response.as_bytes()).await;
                    let _ = socket.flush().await;
                }
            }
        }
    }
}

/// Exchange Google Auth Code for Access and Refresh Tokens
async fn exchange_google_code(
    code: &str,
    redirect_uri: &str,
    client_id: &str,
) -> Result<(), String> {
    let verifier = {
        let mut lock = PENDING_VERIFIER.lock().await;
        lock.take().ok_or_else(|| "No pending PKCE verifier found".to_string())?
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let params = [
        ("client_id", client_id),
        ("code", code),
        ("code_verifier", &verifier),
        ("grant_type", "authorization_code"),
        ("redirect_uri", redirect_uri),
    ];

    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Failed to contact Google token endpoint: {}", e))?;

    if !resp.status().is_success() {
        let err_body = resp.text().await.unwrap_or_default();
        return Err(format!("Google OAuth token exchange failed: {}", err_body));
    }

    let token_data: GoogleTokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Google token JSON: {}", e))?;

    if let Some(refresh_token) = token_data.refresh_token {
        crate::credentials::store_ai_key("google_gemini_oauth", &refresh_token)?;
    } else {
        crate::credentials::store_ai_key("google_gemini_oauth", &token_data.access_token)?;
    }

    Ok(())
}

/// Refresh Google Access Token using the saved Refresh Token
pub async fn get_google_access_token() -> Result<String, String> {
    // 1. Check if we have an OAuth refresh token in Keyring
    if let Ok(token) = crate::credentials::get_ai_key("google_gemini_oauth") {
        if !token.trim().is_empty() {
            if token.starts_with("1//") || token.len() > 60 {
                let client = reqwest::Client::builder()
                    .timeout(Duration::from_secs(15))
                    .build()
                    .map_err(|e| format!("HTTP client error: {}", e))?;

                let params = [
                    ("client_id", DEFAULT_GOOGLE_CLIENT_ID),
                    ("refresh_token", token.as_str()),
                    ("grant_type", "refresh_token"),
                ];

                let resp = client
                    .post("https://oauth2.googleapis.com/token")
                    .form(&params)
                    .send()
                    .await;

                if let Ok(res) = resp {
                    if res.status().is_success() {
                        if let Ok(data) = res.json::<GoogleTokenResponse>().await {
                            return Ok(data.access_token);
                        }
                    }
                }
            }
            return Ok(token);
        }
    }

    // 2. Check Application Default Credentials fallback
    if let Some((adc_refresh, _)) = check_gcloud_adc() {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|e| format!("HTTP client error: {}", e))?;

        let params = [
            ("client_id", DEFAULT_GOOGLE_CLIENT_ID),
            ("refresh_token", adc_refresh.as_str()),
            ("grant_type", "refresh_token"),
        ];

        if let Ok(resp) = client.post("https://oauth2.googleapis.com/token").form(&params).send().await {
            if resp.status().is_success() {
                if let Ok(data) = resp.json::<GoogleTokenResponse>().await {
                    return Ok(data.access_token);
                }
            }
        }
    }

    Err("Not signed into Google AI Pro. Please sign in via Google OAuth or gcloud ADC in preferences.".to_string())
}

/// Check current Google AI Pro / Gemini OAuth session status
pub async fn check_google_auth_status() -> GoogleAuthStatus {
    // Check Keyring
    if let Ok(token) = crate::credentials::get_ai_key("google_gemini_oauth") {
        if !token.trim().is_empty() {
            return GoogleAuthStatus {
                connected: true,
                account_email: Some("Google Subscription Active".to_string()),
                auth_method: "oauth_pkce".to_string(),
                error: None,
            };
        }
    }

    // Check ADC
    if let Some((_, email)) = check_gcloud_adc() {
        return GoogleAuthStatus {
            connected: true,
            account_email: Some(email),
            auth_method: "gcloud_adc".to_string(),
            error: None,
        };
    }

    GoogleAuthStatus {
        connected: false,
        account_email: None,
        auth_method: "none".to_string(),
        error: None,
    }
}

/// Sign out from Google AI Pro
pub fn disconnect_google() -> Result<(), String> {
    crate::credentials::delete_ai_key("google_gemini_oauth")
}

/// Send a chat completion request to Google Gemini endpoint via OAuth Bearer token
pub async fn chat_gemini_oauth(
    prompt: &str,
    system_prompt: Option<&str>,
    model: Option<&str>,
) -> Result<String, String> {
    let access_token = get_google_access_token().await?;
    let selected_model = model.unwrap_or("gemini-2.0-flash");

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
        selected_model
    );

    let mut body = serde_json::json!({
        "contents": [
            {
                "role": "user",
                "parts": [{ "text": prompt }]
            }
        ]
    });

    if let Some(sys) = system_prompt {
        if !sys.trim().is_empty() {
            body["systemInstruction"] = serde_json::json!({
                "parts": [{ "text": sys }]
            });
        }
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network request to Gemini API failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let err_body = resp.text().await.unwrap_or_default();
        return Err(format!("Gemini API error (HTTP {}): {}", status, err_body));
    }

    let val: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Gemini API JSON: {}", e))?;

    let text = val
        .get("candidates")
        .and_then(|c| c.get(0))
        .and_then(|c0| c0.get("content"))
        .and_then(|cnt| cnt.get("parts"))
        .and_then(|p| p.get(0))
        .and_then(|part0| part0.get("text"))
        .and_then(|t| t.as_str())
        .ok_or_else(|| "No text candidates returned from Gemini API".to_string())?;

    Ok(text.to_string())
}
