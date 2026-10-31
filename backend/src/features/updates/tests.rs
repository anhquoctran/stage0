use super::policy::{allowed_host, validate_download};
use tauri::Url;

#[test]
fn daily_check_survives_restarts_and_recovers_from_clock_changes() {
    let now = chrono::DateTime::parse_from_rfc3339("2026-10-26T12:00:00Z")
        .unwrap()
        .with_timezone(&chrono::Utc);
    assert!(super::policy::check_due(None, now));
    assert!(super::policy::check_due(Some("invalid"), now));
    assert!(!super::policy::check_due(Some("2026-10-26T11:59:00Z"), now));
    assert!(!super::policy::check_due(Some("2026-10-25T12:00:01Z"), now));
    assert!(super::policy::check_due(Some("2026-10-25T12:00:00Z"), now));
    assert!(super::policy::check_due(Some("2026-10-27T12:00:00Z"), now));
}

#[test]
fn packages_must_match_the_official_repository_and_announced_tag() {
    let valid = "https://github.com/anhquoctran/stage0/releases/download/v0.1.12/Stage0.AppImage";
    assert!(validate_download(&Url::parse(valid).unwrap(), "0.1.12").is_ok());
    for invalid in [
        valid.replace("stage0/releases", "other/releases"),
        valid.replace("v0.1.12", "v0.1.11"),
        valid.replace("https:", "http:"),
        valid.replace("github.com", "github.com.attacker.test"),
        valid.replace("github.com", "user@github.com"),
        format!("{valid}?token=secret"),
        format!("{valid}#fragment"),
        "https://github.com/anhquoctran/stage0/releases/download/v0.1.12/".into(),
    ] {
        assert!(
            validate_download(&Url::parse(&invalid).unwrap(), "0.1.12").is_err(),
            "{invalid}"
        );
    }
}

#[test]
fn redirects_are_limited_to_https_github_asset_hosts() {
    for host in [
        "github.com",
        "release-assets.githubusercontent.com",
        "objects.githubusercontent.com",
    ] {
        assert!(allowed_host(
            &Url::parse(&format!("https://{host}/asset")).unwrap()
        ));
    }
    for url in [
        "http://github.com/asset",
        "https://example.test/asset",
        "https://github.com:444/asset",
        "https://user:password@github.com/asset",
        "https://127.0.0.1/asset",
    ] {
        assert!(!allowed_host(&Url::parse(url).unwrap()), "{url}");
    }
}

#[test]
fn installed_version_selects_only_its_own_release_feed() {
    use super::policy::{manifest_url, same_channel};
    for (version, channel) in [
        ("0.0.1", "stable"),
        ("0.0.2-nightly.20261031.1", "nightly"),
        ("0.0.2-beta.20261031.2", "beta"),
    ] {
        assert!(manifest_url(version).contains(&format!("channel-{channel}/")));
        assert!(same_channel(version, version));
    }
    assert!(!same_channel("0.0.1", "0.0.2-beta.20261031.1"));
    assert!(!same_channel("0.0.2-nightly.20261031.1", "0.0.2-beta.20261031.2"));
    assert!(!same_channel("0.0.1", "0.0.2-rc.1"));
    assert!(!same_channel("invalid", "invalid"));
}
