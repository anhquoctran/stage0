use super::policy::allowed_host;
use reqwest::{redirect::Policy, Client, StatusCode};
use std::time::Duration;

/// Bounded HTTPS downloads from GitHub and its release asset CDN only.
pub(super) async fn fetch(
    url: &str,
    limit: usize,
    timeout: Duration,
    mut progress: impl FnMut(u64, Option<u64>),
) -> Result<Option<Vec<u8>>, String> {
    let url = tauri::Url::parse(url).map_err(|_| "Invalid update URL")?;
    if !allowed_host(&url) {
        return Err("The updater only connects to GitHub Releases over HTTPS.".into());
    }
    let client = Client::builder()
        .user_agent(concat!("Stage0/", env!("CARGO_PKG_VERSION")))
        .timeout(timeout)
        .redirect(Policy::custom(|attempt| {
            if attempt.previous().len() >= 5 || !allowed_host(attempt.url()) {
                attempt.error("Update redirect is outside GitHub Releases")
            } else {
                attempt.follow()
            }
        }))
        .build()
        .map_err(|_| "Could not initialize the updater connection")?;
    let mut response =
        client.get(url).send().await.map_err(|_| {
            "Could not connect to GitHub Releases. Check your network and try again."
        })?;
    if response.status() == StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(format!(
            "GitHub Releases returned HTTP {}. Try again later.",
            response.status().as_u16()
        ));
    }
    let total = response.content_length();
    if total.is_some_and(|total| total > limit as u64) {
        return Err("The update exceeds Stage0's download size limit.".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "The update download was interrupted. Try again.")?
    {
        if chunk.len() > limit.saturating_sub(bytes.len()) {
            return Err("The update exceeds Stage0's download size limit.".into());
        }
        bytes.extend_from_slice(&chunk);
        progress(bytes.len() as u64, total);
    }
    Ok(Some(bytes))
}
