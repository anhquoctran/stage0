use tauri::utils::{config::BundleType, platform::bundle_type};

pub(super) fn manifest_url(version: &str) -> &'static str {
    match channel(version) {
        Some("nightly") => {
            "https://github.com/anhquoctran/stage0/releases/download/channel-nightly/latest.json"
        }
        Some("beta") => {
            "https://github.com/anhquoctran/stage0/releases/download/channel-beta/latest.json"
        }
        _ => "https://github.com/anhquoctran/stage0/releases/download/channel-stable/latest.json",
    }
}

fn channel(version: &str) -> Option<&'static str> {
    let version = semver::Version::parse(version).ok()?;
    if version.pre.is_empty() {
        Some("stable")
    } else if version.pre.as_str().starts_with("nightly.") {
        Some("nightly")
    } else if version.pre.as_str().starts_with("beta.") {
        Some("beta")
    } else {
        None
    }
}

pub(super) fn same_channel(current: &str, candidate: &str) -> bool {
    channel(current).is_some() && channel(current) == channel(candidate)
}

pub(super) const MANIFEST_LIMIT: usize = 1024 * 1024;
pub(super) const PACKAGE_LIMIT: usize = 512 * 1024 * 1024;

pub(super) fn check_due(last: Option<&str>, now: chrono::DateTime<chrono::Utc>) -> bool {
    last.and_then(|date| chrono::DateTime::parse_from_rfc3339(date).ok())
        .is_none_or(|date| {
            let elapsed = now.signed_duration_since(date);
            elapsed < chrono::Duration::zero() || elapsed >= chrono::Duration::hours(24)
        })
}

pub(super) fn unsupported_reason() -> Option<String> {
    if cfg!(dev) || cfg!(debug_assertions) {
        return Some(crate::common::messages::code("backend.updates.development"));
    }
    let packaged = match std::env::consts::OS {
        "linux" => matches!(
            bundle_type(),
            Some(BundleType::AppImage | BundleType::Deb | BundleType::Rpm)
        ),
        "macos" => matches!(bundle_type(), Some(BundleType::App)),
        "windows" => matches!(bundle_type(), Some(BundleType::Nsis | BundleType::Msi)),
        _ => false,
    };
    (!packaged).then(|| crate::common::messages::code("backend.updates.packageRequired"))
}

pub(super) fn validate_download(url: &tauri::Url, version: &str) -> Result<(), String> {
    let prefix = format!("/anhquoctran/stage0/releases/download/v{version}/");
    if url.scheme() != "https"
        || url.host_str() != Some("github.com")
        || url.port().is_some_and(|port| port != 443)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !url.path().starts_with(&prefix)
        || url.path().len() <= prefix.len()
    {
        return Err(crate::common::messages::code(
            "backend.updates.packageInvalid",
        ));
    }
    Ok(())
}

pub(super) fn allowed_host(url: &tauri::Url) -> bool {
    url.scheme() == "https"
        && matches!(
            url.host_str(),
            Some(
                "github.com"
                    | "release-assets.githubusercontent.com"
                    | "objects.githubusercontent.com"
            )
        )
        && url.username().is_empty()
        && url.password().is_none()
        && url.port().is_none_or(|port| port == 443)
}
