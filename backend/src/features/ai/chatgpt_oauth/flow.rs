use super::{
    auth_catalog::AuthCatalog, auth_profile::AuthProfile, discovery::Discovery,
    pending_login::PendingLogin, stored_session::StoredSession, token_response::TokenResponse,
};

pub(super) const REAUTHORIZE: &str =
    "ChatGPT session is no longer renewable. Sign in again using its saved registration.";

pub(super) fn issued_client(value: &str) -> bool {
    value.starts_with("oaiapp_")
        && (8..=200).contains(&value.len())
        && value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'_' | b'-'))
}
pub(super) fn authorization_url(pending: &PendingLogin) -> Result<reqwest::Url, String> {
    let mut url = reqwest::Url::parse(&format!("{}/api/accounts/authorize", super::ISSUER))
        .map_err(|_| "Invalid authorization endpoint")?;
    let mut query = url.query_pairs_mut();
    query.extend_pairs([
        ("response_type", "code"),
        ("client_id", &pending.profile.client_id),
        ("redirect_uri", &pending.redirect),
        (
            "scope",
            "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
        ),
        ("resource", super::RESOURCE),
        ("state", &pending.state),
        ("nonce", &pending.nonce),
        ("code_challenge_method", "S256"),
        ("code_challenge", &pending.challenge),
        ("ext_agent_host_id", &pending.host_id),
    ]);
    if pending.profile.client_id == super::DYNAMIC_CLIENT {
        query.append_pair("agent_name_hint", "Stage0");
    } else if let Some(email) = &pending.profile.email {
        query.append_pair("login_hint", email);
    }
    drop(query);
    Ok(url)
}
pub(super) async fn complete(
    listener: tokio::net::TcpListener,
    mut pending: PendingLogin,
) -> Result<(AuthProfile, StoredSession), String> {
    let (code, client_id) = super::callback::receive(listener, &pending).await?;
    pending.profile.client_id = client_id;
    {
        let runtime = super::AUTH.lock().await;
        if runtime.pending.as_deref() != Some(&pending.id) {
            return Err(crate::common::messages::failure(
                "backend.ai.chatGptSignInCancelled",
                serde_json::json!({}),
                "ChatGPT sign-in was cancelled".into(),
            ));
        }
        // Retain the issued ID before exchange, even if the code expires. Never activate it here.
        AuthCatalog::load()?.register(pending.profile.clone())?;
    }
    let client = super::http::client()?;
    let discovery = Discovery::fetch(&client).await?;
    let response = client
        .post(&discovery.token_endpoint)
        .form(&[
            ("grant_type", "authorization_code"),
            ("client_id", &pending.profile.client_id),
            ("code", &code),
            ("code_verifier", &pending.verifier),
            ("redirect_uri", &pending.redirect),
            ("resource", super::RESOURCE),
        ])
        .send()
        .await
        .map_err(|_| {
            "Could not exchange the ChatGPT authorization code. Retry with the saved registration."
        })?;
    let tokens = exchange_response(response).await?;
    let id_token = tokens
        .id_token
        .as_deref()
        .ok_or_else(|| {
            crate::common::messages::failure(
                "backend.ai.chatGptIdTokenMissing",
                serde_json::json!({}),
                "OpenAI did not return an ID token; no session was activated".into(),
            )
        })?;
    let identity = super::identity::fetch_and_verify(
        &client,
        &discovery,
        id_token,
        &pending.profile.client_id,
        Some(&pending.nonce),
    )
    .await?;
    if pending
        .profile
        .subject
        .as_deref()
        .is_some_and(|subject| subject != identity.sub)
    {
        return Err(
            "The returned ChatGPT identity differs from the selected saved registration".into(),
        );
    }
    pending.profile.subject = Some(identity.sub);
    pending.profile.email = identity
        .email
        .filter(|s| s.len() <= 254 && !s.chars().any(char::is_control));
    // Initial sign-in never infers granted permissions from the scopes we requested.
    let session = tokens.session(&[])?;
    Ok((pending.profile.clone(), session))
}

pub(super) async fn refresh(
    profile: &AuthProfile,
    old: StoredSession,
) -> Result<StoredSession, String> {
    let refresh = old.refresh_token.as_deref().ok_or(REAUTHORIZE)?;
    let client = super::http::client()?;
    let discovery = Discovery::fetch(&client).await?;
    let response = client
        .post(&discovery.token_endpoint)
        .form(&[
            ("grant_type", "refresh_token"),
            ("client_id", &profile.client_id),
            ("refresh_token", refresh),
            ("resource", super::RESOURCE),
        ])
        .send()
        .await
        .map_err(|_| {
            "ChatGPT refresh could not reach OpenAI. Saved credentials were retained; retry later."
        })?;
    if !response.status().is_success() {
        let status = response.status();
        if status.is_client_error() {
            // Parse only the bounded machine-readable error; never surface the raw payload.
            let bytes = super::http::body(response, 16 * 1024).await?;
            if bytes.len() <= 16 * 1024 {
                if let Ok(value) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                    let code = value["error"]
                        .as_str()
                        .or(value["error"]["code"].as_str())
                        .unwrap_or("");
                    if matches!(
                        code,
                        "invalid_grant"
                            | "invalid_refresh_token"
                            | "token_expired"
                            | "refresh_token_expired"
                            | "refresh_token_invalidated"
                            | "refresh_token_reused"
                    ) {
                        return Err(REAUTHORIZE.into());
                    }
                }
            }
        }
        return Err(format!(
            "ChatGPT refresh failed (HTTP {}). Saved credentials were retained.",
            status.as_u16()
        ));
    }
    let tokens: TokenResponse = super::http::json(response).await?;
    if let Some(id_token) = &tokens.id_token {
        let identity = super::identity::fetch_and_verify(
            &client,
            &discovery,
            id_token,
            &profile.client_id,
            None,
        )
        .await?;
        if profile.subject.as_deref() != Some(&identity.sub) {
            return Err(crate::common::messages::failure(
                "backend.ai.chatGptIdentityMismatch",
                serde_json::json!({}),
                "Refreshed ChatGPT identity did not match the saved registration".into(),
            ));
        }
    }
    let mut next = tokens.session(&old.scopes)?;
    if next.id_token.is_none() {
        next.id_token = old.id_token.clone();
    }
    if next.refresh_token.as_ref().is_none_or(|s| s.is_empty()) {
        return Err(crate::common::messages::failure(
            "backend.ai.chatGptRefreshTokenMissing",
            serde_json::json!({}),
            "OpenAI did not return a replacement refresh token. Sign in again.".into(),
        ));
    }
    Ok(next)
}
async fn exchange_response(response: reqwest::Response) -> Result<TokenResponse, String> {
    if response.status().is_success() {
        return super::http::json(response).await;
    }
    let status = response.status().as_u16();
    let bytes = super::http::body(response, 16 * 1024).await?;
    let value = serde_json::from_slice::<serde_json::Value>(&bytes).unwrap_or_default();
    let code = value["error"]
        .as_str()
        .or(value["error"]["code"].as_str())
        .unwrap_or("");
    Err(match code {
        "invalid_client" => "OpenAI rejected the client registration. Stage0 may need an approved client configuration; no private Codex client ID was substituted.".into(),
        "invalid_grant" => "The authorization code could not be exchanged. Retry using the saved registration; do not reuse the previous browser callback.".into(),
        "access_denied" => "OpenAI declined authorization. Check account/workspace permissions, then retry.".into(),
        _ => format!("OpenAI sign-in failed (HTTP {status}). No raw server payload was retained."),
    })
}
pub(super) async fn revoke(profile: &AuthProfile, session: &StoredSession) -> bool {
    let Some(refresh) = session.refresh_token.as_deref() else {
        return false;
    };
    let Ok(client) = super::http::client() else {
        return false;
    };
    let Ok(discovery) = Discovery::fetch(&client).await else {
        return false;
    };
    let Some(endpoint) = discovery.revocation_endpoint else {
        return false;
    };
    for attempt in 0..2 {
        let response = client
            .post(&endpoint)
            .form(&[
                ("token", refresh),
                ("token_type_hint", "refresh_token"),
                ("client_id", &profile.client_id),
            ])
            .send()
            .await;
        match response {
            Ok(response) if response.status() == reqwest::StatusCode::OK => return true,
            Ok(response) if !response.status().is_server_error() => return false,
            _ => {}
        }
        if attempt == 0 {
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        }
    }
    false
}
