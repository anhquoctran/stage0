use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use std::time::Duration;
use tauri::command;

const MAX_REGISTRY_ICON_BYTES: usize = 128 * 1024;

#[command]
pub async fn acp_fetch_registry_icon(icon_url: String) -> Result<String, String> {
    let parsed_url = reqwest::Url::parse(&icon_url).map_err(|_| "Invalid ACP Registry icon URL")?;
    if !is_registry_icon_url(&parsed_url) {
        return Err("ACP Registry icons must come from the official Registry CDN".into());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if is_registry_icon_url(attempt.url()) {
                attempt.follow()
            } else {
                attempt.error("ACP Registry icon redirect left the official CDN")
            }
        }))
        .build()
        .map_err(|_| "Could not initialize ACP Registry icon client")?;
    let mut response = client
        .get(parsed_url)
        .send()
        .await
        .map_err(|_| "Could not load ACP Registry icon")?;
    if !response.status().is_success() || !is_registry_icon_url(response.url()) {
        return Err("ACP Registry returned an invalid icon response".into());
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_REGISTRY_ICON_BYTES as u64)
    {
        return Err("ACP Registry icon is too large".into());
    }

    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Could not read ACP Registry icon")?
    {
        if bytes.len().saturating_add(chunk.len()) > MAX_REGISTRY_ICON_BYTES {
            return Err("ACP Registry icon is too large".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let svg = std::str::from_utf8(&bytes).map_err(|_| "ACP Registry icon is not valid SVG")?;
    if !svg.to_ascii_lowercase().contains("<svg") {
        return Err("ACP Registry returned an invalid SVG icon".into());
    }

    Ok(format!(
        "data:image/svg+xml;base64,{}",
        BASE64.encode(bytes)
    ))
}

fn is_registry_icon_url(url: &reqwest::Url) -> bool {
    if url.scheme() != "https"
        || url.host_str() != Some("cdn.agentclientprotocol.com")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return false;
    }

    let segments: Vec<_> = url.path().split('/').collect();
    segments.len() == 5
        && segments[1] == "registry"
        && segments[2] == "v1"
        && !segments[3].is_empty()
        && segments[3]
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
        && segments[4].strip_suffix(".svg").is_some_and(|slug| {
            !slug.is_empty()
                && slug
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        })
}
