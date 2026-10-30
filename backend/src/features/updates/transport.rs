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
    let url = tauri::Url::parse(url)
        .map_err(|_| crate::common::messages::code("backend.updates.packageInvalid"))?;
    if !allowed_host(&url) {
        return Err(crate::common::messages::code(
            "backend.updates.packageInvalid",
        ));
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
        .map_err(|_| crate::common::messages::code("backend.updates.updaterUnavailable"))?;
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|_| crate::common::messages::code("backend.updates.networkUnavailable"))?;
    if response.status() == StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(crate::common::messages::message(
            "backend.updates.httpFailure",
            serde_json::json!({ "status": response.status().as_u16() }),
        ));
    }
    let total = response.content_length();
    if total.is_some_and(|total| total > limit as u64) {
        return Err(crate::common::messages::code(
            "backend.updates.downloadTooLarge",
        ));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| crate::common::messages::code("backend.updates.downloadInterrupted"))?
    {
        if chunk.len() > limit.saturating_sub(bytes.len()) {
            return Err(crate::common::messages::code(
                "backend.updates.downloadTooLarge",
            ));
        }
        bytes.extend_from_slice(&chunk);
        progress(bytes.len() as u64, total);
    }
    Ok(Some(bytes))
}
