use sha2::{Digest, Sha256};

pub(crate) fn https_origin(value: &str) -> Result<String, String> {
    crate::features::git::ops::validate_remote_url(value)?;
    let parsed = reqwest::Url::parse(value)
        .map_err(|_| crate::common::messages::code("backend.git.httpsCredentialRequired"))?;
    if parsed.scheme() != "https"
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err(crate::common::messages::code(
            "backend.git.httpsCredentialRequired",
        ));
    }
    Ok(parsed.origin().ascii_serialization())
}

pub(super) fn contains_protocol_control(value: &str) -> bool {
    value
        .bytes()
        .any(|byte| byte == b'\n' || byte == b'\r' || byte == 0)
}

pub(super) fn tokenized_helper_ref(remote_url: &str, username: &str) -> String {
    let mut digest = Sha256::new();
    digest.update(remote_url.as_bytes());
    digest.update([0]);
    digest.update(username.as_bytes());
    let bytes = digest.finalize();
    let suffix = bytes[..16]
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    format!("sys_git_{suffix}")
}

pub(super) fn canonical_remote_identity(remote_url: &str) -> String {
    let Some((scheme, remainder)) = remote_url.split_once("://") else {
        return remote_url.to_string();
    };
    let (authority, path) = remainder.split_once('/').unwrap_or((remainder, ""));
    format!(
        "{}://{}{}",
        scheme.to_ascii_lowercase(),
        authority.to_ascii_lowercase(),
        if path.is_empty() {
            String::new()
        } else {
            format!("/{path}")
        }
    )
}

pub(super) fn provider_for_remote(remote_url: &str) -> String {
    let host = remote_url
        .split_once("://")
        .map(|(_, remainder)| remainder)
        .and_then(|remainder| remainder.split('/').next())
        .unwrap_or_default()
        .split(':')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();

    if host == "github.com" {
        "github"
    } else if host == "gitlab.com" {
        "gitlab"
    } else if host == "bitbucket.org" {
        "bitbucket"
    } else if host == "dev.azure.com" || host.ends_with(".visualstudio.com") {
        "azure_devops"
    } else {
        "custom"
    }
    .to_string()
}
