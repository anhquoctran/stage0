use super::archive_format::ArchiveFormat;
use sha2::{Digest, Sha256};
use std::{path::Path, time::Duration};
use tokio::io::AsyncWriteExt;

pub const MAX_DOWNLOAD_BYTES: u64 = 512 * 1024 * 1024;

pub async fn download(
    url: &str,
    destination: &Path,
    expected_sha256: Option<&str>,
) -> Result<(), String> {
    ArchiveFormat::from_url(url)?;
    if let Some(expected) = expected_sha256 {
        if expected.len() != 64 || !expected.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err(crate::common::messages::code("backend.acp.checksumInvalid").into());
        }
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 3 {
                attempt.error(crate::common::messages::code("backend.acp.redirectLimit"))
            } else if attempt.url().scheme() != "https"
                || !attempt.url().username().is_empty()
                || attempt.url().password().is_some()
            {
                attempt.error(crate::common::messages::code("backend.acp.unsafeRedirect"))
            } else {
                attempt.follow()
            }
        }))
        .build()
        .map_err(|_| crate::common::messages::code("backend.acp.downloadClient"))?;
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|_| crate::common::messages::code("backend.acp.downloadFailed"))?;
    if !response.status().is_success() {
        return Err(crate::common::messages::message(
            "backend.acp.downloadHttp",
            serde_json::json!({ "status": response.status().as_u16() }),
        ));
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_DOWNLOAD_BYTES)
    {
        return Err(crate::common::messages::code("backend.acp.downloadTooLarge").into());
    }
    let mut file = tokio::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(destination)
        .await
        .map_err(|_| crate::common::messages::code("backend.acp.downloadFileCreate"))?;
    let mut hasher = Sha256::new();
    let mut total = 0u64;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| crate::common::messages::code("backend.acp.downloadRead"))?
    {
        total = total.saturating_add(chunk.len() as u64);
        if total > MAX_DOWNLOAD_BYTES {
            return Err(crate::common::messages::code("backend.acp.downloadTooLarge").into());
        }
        hasher.update(&chunk);
        file.write_all(&chunk)
            .await
            .map_err(|_| crate::common::messages::code("backend.acp.downloadWrite"))?;
    }
    if total == 0 {
        return Err(crate::common::messages::code("backend.acp.downloadEmpty").into());
    }
    file.flush()
        .await
        .map_err(|_| crate::common::messages::code("backend.acp.downloadFlush"))?;
    verify_checksum(&format!("{:x}", hasher.finalize()), expected_sha256)
}

fn verify_checksum(actual: &str, expected: Option<&str>) -> Result<(), String> {
    if expected.is_some_and(|expected| !actual.eq_ignore_ascii_case(expected)) {
        return Err(crate::common::messages::code("backend.acp.checksumMismatch").into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn supplied_checksums_are_enforced_without_requiring_publishers_to_supply_them() {
        assert!(verify_checksum("aabb", Some("AABB")).is_ok());
        assert!(verify_checksum("aabb", Some("aabc")).is_err());
        assert!(verify_checksum("aabb", None).is_ok());
    }
}
