mod auth_catalog;
mod auth_profile;
mod auth_runtime;
mod callback;
mod chat_gpt_auth_status;
mod discovery;
mod flow;
mod http;
mod id_claims;
mod identity;
#[cfg(all(target_os = "macos", not(test)))]
mod macos_legacy_keyring;
mod pending_login;
mod public_profile;
mod secret_storage;
#[cfg(test)]
mod secret_storage_tests;
mod stored_session;
#[cfg(test)]
mod test_keyring_entry;
#[cfg(test)]
mod tests;
mod token_response;

use auth_catalog::AuthCatalog;
use auth_runtime::AuthRuntime;
pub use chat_gpt_auth_status::ChatGptAuthStatus;
use tokio::sync::Mutex;

pub(super) const ISSUER: &str = "https://auth.openai.com";
pub(super) const RESOURCE: &str = "https://api.openai.com/v1";
pub(super) const DYNAMIC_CLIENT: &str = "dynamic_agent_client";
static AUTH: Mutex<AuthRuntime> = Mutex::const_new(AuthRuntime::new());

pub async fn start_chatgpt_oauth(profile_id: Option<String>) -> Result<ChatGptAuthStatus, String> {
    let mut runtime = AUTH.lock().await;
    if runtime.pending.is_some() {
        return Err("A ChatGPT browser sign-in is already pending. Cancel it first.".into());
    }
    let mut catalog = AuthCatalog::load_for_sign_in(profile_id.is_none())?;
    let host = catalog.host_id.clone();
    let profile = if let Some(id) = profile_id {
        catalog
            .profiles
            .iter()
            .find(|p| p.id == id)
            .cloned()
            .ok_or("Saved ChatGPT registration not found")?
    } else {
        if catalog.profiles.len() >= 12 {
            return Err("The saved ChatGPT registration limit has been reached.".into());
        }
        auth_profile::AuthProfile::new()
    };
    catalog.save()?;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|_| "Could not start the local ChatGPT callback listener")?;
    let pending = pending_login::PendingLogin::new(
        profile,
        host,
        listener
            .local_addr()
            .map_err(|_| "Could not inspect callback port")?
            .port(),
    );
    let attempt = pending.id.clone();
    let url = flow::authorization_url(&pending)?;
    let (cancel, cancelled) = tokio::sync::oneshot::channel();
    runtime.pending = Some(attempt.clone());
    runtime.cancel = Some(cancel);
    runtime.phase = "pending".into();
    runtime.error = None;
    // Open once, in the backend; never return authorization URLs or ID-token hints over IPC.
    if super::open_system_browser(url.as_str()).is_err() {
        runtime.pending = None;
        runtime.cancel = None;
        runtime.phase = "failed".into();
        runtime.error = Some(
            "Could not open your system browser. Check your default browser and retry.".into(),
        );
        return runtime.snapshot(&catalog);
    }
    tokio::spawn(async move {
        let outcome = tokio::select! {
            _ = cancelled => Err("ChatGPT sign-in cancelled locally. Browser authorization may already have completed.".into()),
            result = tokio::time::timeout(std::time::Duration::from_secs(600), flow::complete(listener, pending)) => {
                result.unwrap_or_else(|_| Err("ChatGPT browser sign-in timed out. Please try again.".into()))
            }
        };
        let mut runtime = AUTH.lock().await;
        if runtime.pending.as_deref() != Some(&attempt) {
            return;
        }
        match outcome {
            Ok((profile, session)) => {
                let saved = AuthCatalog::load().and_then(|mut catalog| {
                    catalog.commit(profile, &session)?;
                    runtime.snapshot(&catalog).map(|_| ())
                });
                runtime.phase = if saved.is_ok() { "signed_in" } else { "failed" }.into();
                runtime.error = saved.err();
            }
            Err(error) => {
                runtime.phase = "failed".into();
                runtime.error = Some(error);
            }
        }
        runtime.pending = None;
        runtime.cancel = None;
    });
    runtime.snapshot(&catalog)
}

pub async fn check_chatgpt_auth_status() -> Result<ChatGptAuthStatus, String> {
    Ok(AUTH.lock().await.status())
}

pub async fn load_saved_chatgpt_auth() -> Result<ChatGptAuthStatus, String> {
    let mut runtime = AUTH.lock().await;
    if runtime.pending.is_some() {
        return Ok(runtime.status());
    }
    let catalog = AuthCatalog::load()?;
    runtime.phase.clear();
    runtime.error = None;
    runtime.snapshot(&catalog)
}

pub async fn cancel_chatgpt_oauth(attempt_id: &str) -> Result<ChatGptAuthStatus, String> {
    let mut runtime = AUTH.lock().await;
    if runtime.pending.as_deref() != Some(attempt_id) {
        return Err("No matching pending ChatGPT sign-in".into());
    }
    if let Some(cancel) = runtime.cancel.take() {
        let _ = cancel.send(());
    }
    runtime.pending = None;
    runtime.phase = "cancelled".into();
    runtime.error = None;
    Ok(runtime.status())
}

pub async fn refresh_chatgpt_session(profile_id: &str) -> Result<ChatGptAuthStatus, String> {
    let mut runtime = AUTH.lock().await;
    if runtime.pending.is_some() {
        return Err("Finish or cancel the pending sign-in first".into());
    }
    let mut catalog = AuthCatalog::load()?;
    let profile = catalog
        .profiles
        .iter()
        .find(|p| p.id == profile_id)
        .cloned()
        .ok_or("Saved ChatGPT registration not found")?;
    let session = profile
        .session()?
        .ok_or("Sign in again to restore this ChatGPT session")?;
    match flow::refresh(&profile, session).await {
        Ok(session) => {
            catalog.commit(profile, &session)?;
            runtime.phase = "signed_in".into();
            runtime.error = None;
        }
        Err(error) => {
            if error == flow::REAUTHORIZE {
                runtime.forget_session(profile_id);
                catalog.clear_session(profile_id)?;
            }
            runtime.phase = "failed".into();
            runtime.error = Some(error);
        }
    }
    runtime.snapshot(&catalog)
}

pub async fn disconnect_chatgpt_subscription(
    profile_id: &str,
) -> Result<ChatGptAuthStatus, String> {
    let mut runtime = AUTH.lock().await;
    if runtime.pending.is_some() {
        return Err("Finish or cancel the pending sign-in before signing out".into());
    }
    let mut catalog = AuthCatalog::load()?;
    let profile = catalog
        .profiles
        .iter()
        .find(|p| p.id == profile_id)
        .cloned()
        .ok_or("Saved ChatGPT registration not found")?;
    let session = profile.session()?;
    let revoked = match session {
        Some(session) => flow::revoke(&profile, &session).await,
        None => true,
    };
    runtime.forget_session(profile_id);
    catalog.clear_session(profile_id)?;
    runtime.phase = "signed_out".into();
    runtime.error = if revoked {
        None
    } else {
        Some("Signed out locally, but remote revocation was not confirmed. Disconnect Stage0 in ChatGPT Settings.".into())
    };
    runtime.snapshot(&catalog)
}

// The general-purpose chat dispatcher still uses a separate adapter. Keep it
// explicit rather than accidentally passing SIWC credentials to Chat Completions.
pub async fn chat_chatgpt_subscription(
    _: &str,
    _: Option<&str>,
    _: Option<&str>,
) -> Result<String, String> {
    Err("ChatGPT subscription sign-in is currently available for native AI code reviews; the general AI chat adapter is not connected to Responses API yet.".into())
}
