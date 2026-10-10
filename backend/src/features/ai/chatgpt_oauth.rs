mod chat_gpt_o_auth_start_result;
pub use chat_gpt_o_auth_start_result::ChatGptOAuthStartResult;
mod chat_gpt_auth_status;
pub use chat_gpt_auth_status::ChatGptAuthStatus;
mod chat_gpt_token_response;
use chat_gpt_token_response::ChatGptTokenResponse;
mod user_info_response;
use user_info_response::UserInfoResponse;

use base64::Engine;
use sha2::{Digest, Sha256};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::Mutex;

// Default client ID for OpenAI Sign in with ChatGPT (Dynamic Agent Client for native apps)
pub const DEFAULT_CHATGPT_CLIENT_ID: &str = "dynamic_agent_client";

/// Generate cryptographically secure PKCE verifier and S256 challenge
pub fn generate_pkce() -> (String, String) {
    let verifier = format!("{}-{}", uuid::Uuid::new_v4(), uuid::Uuid::new_v4());
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(hash);
    (verifier, challenge)
}

/// Global holder for ongoing PKCE verifier
static PENDING_CHATGPT_VERIFIER: Mutex<Option<String>> = Mutex::const_new(None);

/// Get or generate a persistent local host ID for this machine
fn get_or_create_host_id() -> String {
    if let Ok(id) = crate::features::credentials::get_ai_key("chatgpt_host_id") {
        if !id.trim().is_empty() {
            if id.starts_with("urn:uuid:") {
                return id;
            } else {
                let formatted = format!("urn:uuid:{}", id.trim());
                let _ = crate::features::credentials::store_ai_key("chatgpt_host_id", &formatted);
                return formatted;
            }
        }
    }
    let new_id = format!("urn:uuid:{}", uuid::Uuid::new_v4());
    let _ = crate::features::credentials::store_ai_key("chatgpt_host_id", &new_id);
    new_id
}

/// Start ChatGPT OAuth 2.0 PKCE Loopback Server
pub async fn start_chatgpt_oauth(
    client_id: Option<String>,
) -> Result<ChatGptOAuthStartResult, String> {
    // If we previously saved an issued client_id for this user/host, prefer it
    let saved_cid = crate::features::credentials::get_ai_key("openai_subscription_client_id").ok();
    let cid = client_id
        .or(saved_cid)
        .unwrap_or_else(|| DEFAULT_CHATGPT_CLIENT_ID.to_string());

    let (verifier, challenge) = generate_pkce();

    // Store verifier for token exchange
    {
        let mut lock = PENDING_CHATGPT_VERIFIER.lock().await;
        *lock = Some(verifier);
    }

    // Bind local listener to ephemeral port
    let listener = TcpListener::bind("127.0.0.1:0").await.map_err(|e| {
        format!(
            "Failed to start loopback server for ChatGPT OAuth callback: {}",
            e
        )
    })?;

    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to read local loopback port: {}", e))?
        .port();

    let redirect_uri = format!("http://127.0.0.1:{}/callback", port);
    let state = uuid::Uuid::new_v4().to_string();
    let nonce = uuid::Uuid::new_v4().to_string();
    let host_id = get_or_create_host_id();
    let encoded_host_id = host_id.replace(':', "%3A");

    let encoded_redirect = format!("http%3A%2F%2F127.0.0.1%3A{}%2Fcallback", port);
    // Only standard supported scopes: openid profile email offline_access
    let scope_str = "openid%20profile%20email%20offline_access";

    let agent_hint_param = if cid == DEFAULT_CHATGPT_CLIENT_ID {
        "&agent_name_hint=Stage0"
    } else {
        ""
    };

    let auth_url = format!(
        "https://auth.openai.com/api/accounts/authorize?\
        response_type=code&\
        client_id={}&\
        redirect_uri={}&\
        scope={}&\
        code_challenge={}&\
        code_challenge_method=S256&\
        state={}&\
        nonce={}{}&\
        ext_agent_host_id={}",
        cid,
        encoded_redirect,
        scope_str,
        challenge,
        state,
        nonce,
        agent_hint_param,
        encoded_host_id
    );

    // Spawn background task to accept single redirect callback
    let state_clone = state.clone();
    let cid_clone = cid.clone();
    tokio::spawn(async move {
        handle_chatgpt_loopback_callback(listener, state_clone, redirect_uri, cid_clone).await;
    });

    // Automatically open default system browser
    if let Err(e) = crate::features::ai::open_system_browser(&auth_url) {
        eprintln!("[OAuth] Failed to open system browser: {}", e);
    }

    Ok(ChatGptOAuthStartResult {
        auth_url,
        state,
        port,
    })
}

/// Wait for redirect HTTP GET /callback?code=...
async fn handle_chatgpt_loopback_callback(
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
                let end = first_line[query_start..]
                    .find(' ')
                    .unwrap_or(first_line.len() - query_start);
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
                    let exchange_res =
                        exchange_chatgpt_code(&auth_code, &redirect_uri, &client_id).await;

                    let (status_line, body): (&str, String) = match exchange_res {
                        Ok(email) => (
                            "HTTP/1.1 200 OK",
                            format!(
                                r#"<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#11111b;color:#cdd6f4;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:2.5rem;background:#181825;border-radius:16px;border:1px solid #313244;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:440px;"><div style="font-size:42px;margin-bottom:12px;">💬</div><h2 style="color:#a6e3a1;margin:0 0 10px 0;">ChatGPT Subscription Connected!</h2><p style="color:#a6adc8;font-size:14px;margin:0 0 12px 0;">Signed in as <strong style="color:#cdd6f4;">{}</strong></p><p style="color:#6c7086;font-size:12px;margin:0 0 24px 0;">Your ChatGPT Plus/Pro subscription is linked to Stage0. You can now close this tab.</p><button onclick="window.close()" style="background:#89b4fa;color:#11111b;border:none;padding:10px 24px;border-radius:8px;font-weight:600;font-size:14px;cursor:pointer;">Close Tab</button></div></body></html>"#,
                                email
                            ),
                        ),
                        Err(err) => (
                            "HTTP/1.1 400 Bad Request",
                            format!(
                                r#"<!DOCTYPE html><html><body style="font-family:system-ui;background:#11111b;color:#f38ba8;padding:2rem;"><div style="max-width:480px;margin:auto;"><h2>ChatGPT Authorization Failed</h2><p>{}</p></div></body></html>"#,
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

/// Exchange ChatGPT Auth Code for Access and Refresh Tokens
async fn exchange_chatgpt_code(
    code: &str,
    redirect_uri: &str,
    client_id: &str,
) -> Result<String, String> {
    let verifier = {
        let mut lock = PENDING_CHATGPT_VERIFIER.lock().await;
        lock.take()
            .ok_or_else(|| "No pending PKCE verifier found".to_string())?
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let params = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", redirect_uri),
        ("client_id", client_id),
        ("code_verifier", &verifier),
    ];

    let resp = client
        .post("https://auth.openai.com/api/accounts/oauth/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network error contacting OpenAI token endpoint: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "OpenAI token exchange failed (HTTP {}): {}",
            status, body
        ));
    }

    let token_data: ChatGptTokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI token JSON: {}", e))?;

    // Store Access Token in Keyring
    crate::features::credentials::store_ai_key("openai_subscription", &token_data.access_token)?;

    // Store Refresh Token if provided
    if let Some(ref rt) = token_data.refresh_token {
        let _ = crate::features::credentials::store_ai_key("openai_subscription_refresh", rt);
    }

    // Save issued client_id if dynamic registration returned one
    if let Some(ref issued_id) = token_data.issued_client_id {
        let _ =
            crate::features::credentials::store_ai_key("openai_subscription_client_id", issued_id);
    }

    // Determine user account email
    let mut account_email = None;

    // Try extracting from id_token (JWT payload without signature verification)
    if let Some(ref idt) = token_data.id_token {
        if let Some(payload_b64) = idt.split('.').nth(1) {
            let padded = match payload_b64.len() % 4 {
                2 => format!("{}==", payload_b64),
                3 => format!("{}=", payload_b64),
                _ => payload_b64.to_string(),
            };
            if let Ok(decoded) = base64::engine::general_purpose::URL_SAFE.decode(padded.as_bytes())
            {
                if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&decoded) {
                    if let Some(email) = json.get("email").and_then(|e| e.as_str()) {
                        account_email = Some(email.to_string());
                    }
                }
            }
        }
    }

    // If email not found in JWT, query userinfo endpoint
    if account_email.is_none() {
        if let Ok(userinfo_resp) = client
            .get("https://auth.openai.com/api/accounts/oauth/userinfo")
            .header(
                "Authorization",
                format!("Bearer {}", token_data.access_token),
            )
            .send()
            .await
        {
            if let Ok(info) = userinfo_resp.json::<UserInfoResponse>().await {
                account_email = info.email.or(info.preferred_username).or(info.name);
            }
        }
    }

    let final_email = account_email.unwrap_or_else(|| "ChatGPT Subscriber".to_string());
    let _ = crate::features::credentials::store_ai_key("openai_subscription_email", &final_email);

    Ok(final_email)
}

/// Check existing ChatGPT Subscription Auth Status
pub async fn check_chatgpt_auth_status() -> ChatGptAuthStatus {
    let token = match crate::features::credentials::get_ai_key("openai_subscription") {
        Ok(t) if !t.trim().is_empty() => t,
        _ => {
            return ChatGptAuthStatus {
                connected: false,
                account_email: None,
                error: None,
            };
        }
    };

    let email = crate::features::credentials::get_ai_key("openai_subscription_email").ok();

    // Verify token validity by testing a lightweight request
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return ChatGptAuthStatus {
                connected: true,
                account_email: email,
                error: Some(e.to_string()),
            };
        }
    };

    let test_resp = client
        .get("https://auth.openai.com/api/accounts/oauth/userinfo")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    match test_resp {
        Ok(resp) if resp.status().is_success() => {
            let info = resp.json::<UserInfoResponse>().await.ok();
            let resolved_email = info.and_then(|i| i.email).or(email);
            ChatGptAuthStatus {
                connected: true,
                account_email: resolved_email,
                error: None,
            }
        }
        Ok(resp) if resp.status().as_u16() == 401 => {
            // Attempt to refresh the access token
            if let Ok(_new_token) = refresh_chatgpt_token().await {
                ChatGptAuthStatus {
                    connected: true,
                    account_email: email,
                    error: None,
                }
            } else {
                ChatGptAuthStatus {
                    connected: false,
                    account_email: None,
                    error: Some("Session expired. Please sign in with ChatGPT again.".to_string()),
                }
            }
        }
        _ => ChatGptAuthStatus {
            connected: true,
            account_email: email,
            error: None,
        },
    }
}

/// Refresh ChatGPT Access Token using stored Refresh Token
pub async fn refresh_chatgpt_token() -> Result<String, String> {
    let refresh_token = crate::features::credentials::get_ai_key("openai_subscription_refresh")
        .map_err(|_| "No ChatGPT refresh token found in OS Keyring".to_string())?;

    let cid = crate::features::credentials::get_ai_key("openai_subscription_client_id")
        .unwrap_or_else(|_| DEFAULT_CHATGPT_CLIENT_ID.to_string());

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let params = [
        ("grant_type", "refresh_token"),
        ("refresh_token", &refresh_token),
        ("client_id", &cid),
    ];

    let resp = client
        .post("https://auth.openai.com/api/accounts/oauth/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network error refreshing ChatGPT token: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "ChatGPT token refresh failed with HTTP {}",
            resp.status()
        ));
    }

    let token_data: ChatGptTokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse refreshed token JSON: {}", e))?;

    crate::features::credentials::store_ai_key("openai_subscription", &token_data.access_token)?;

    if let Some(ref rt) = token_data.refresh_token {
        let _ = crate::features::credentials::store_ai_key("openai_subscription_refresh", rt);
    }

    Ok(token_data.access_token)
}

/// Disconnect and wipe ChatGPT Subscription credentials from Keyring
pub fn disconnect_chatgpt_subscription() -> Result<(), String> {
    let _ = crate::features::credentials::delete_ai_key("openai_subscription");
    let _ = crate::features::credentials::delete_ai_key("openai_subscription_refresh");
    let _ = crate::features::credentials::delete_ai_key("openai_subscription_email");
    let _ = crate::features::credentials::delete_ai_key("openai_subscription_client_id");
    Ok(())
}

/// Chat execution using ChatGPT Subscription token
pub async fn chat_chatgpt_subscription(
    prompt: &str,
    system_prompt: Option<&str>,
    model: Option<&str>,
) -> Result<String, String> {
    let token = match crate::features::credentials::get_ai_key("openai_subscription") {
        Ok(t) => t,
        Err(_) => refresh_chatgpt_token().await?,
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let chosen_model = model.unwrap_or("gpt-4o");

    let mut messages = Vec::new();
    if let Some(sys) = system_prompt {
        messages.push(serde_json::json!({
            "role": "system",
            "content": sys
        }));
    }
    messages.push(serde_json::json!({
        "role": "user",
        "content": prompt
    }));

    let payload = serde_json::json!({
        "model": chosen_model,
        "messages": messages
    });

    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", token))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Error contacting OpenAI chat endpoint: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("OpenAI returned HTTP {}: {}", status, body));
    }

    let res_json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

    let content = res_json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or_default()
        .to_string();

    Ok(content)
}
