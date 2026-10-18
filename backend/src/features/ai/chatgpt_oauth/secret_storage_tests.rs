//! Every test uses only the thread-local fake, including Windows-format fixtures.
use super::{
    auth_catalog::AuthCatalog, secret_storage::*, test_keyring_entry::TestKeyringEntry as Fake,
};

fn setup() {
    Fake::reset();
    Fake::windows_limit(false);
}
fn native(key: &str) -> Fake {
    Fake::new(&format!("chatgpt_native_v3_{key}"))
}
fn legacy_chunks(key: &str) -> (String, usize) {
    let pointer: serde_json::Value =
        serde_json::from_str(&Fake::new(key).get_password().unwrap()).unwrap();
    (
        pointer["generation"].as_str().unwrap().into(),
        pointer["count"].as_u64().unwrap() as usize,
    )
}

#[test]
fn native_large_record_is_one_item_and_one_read_not_a_windows_chunk_sequence() {
    setup();
    let value = "private 🔐".repeat(1000);
    write_native("fixture", &value).unwrap();
    assert_eq!(Fake::entries(), 1);
    assert_eq!(&**read_native("fixture").unwrap().as_ref().unwrap(), &value);
    assert_eq!(Fake::reads(), 1);
    assert_eq!(Fake::silent_reads(), 0);
    Fake::fail_after(0);
    assert!(write_native("fixture", "replacement").is_err());
    assert_eq!(&**read_native("fixture").unwrap().as_ref().unwrap(), &value);
    assert_eq!(Fake::entries(), 1);
    delete_native("fixture").unwrap();
    assert_eq!(Fake::entries(), 0);
    assert!(read_native("fixture").unwrap().is_none());
}

#[test]
fn legacy_import_reads_silently_once_preserves_old_items_and_then_uses_one_native_item() {
    setup();
    let value = "old credential 🔐".repeat(1000);
    Fake::windows_limit(true);
    write_chunked("fixture", &value).unwrap();
    Fake::windows_limit(false);
    let old_count = Fake::entries();
    let reads = Fake::reads();
    assert_eq!(&**read_native("fixture").unwrap().as_ref().unwrap(), &value);
    assert_eq!(Fake::entries(), old_count + 1);
    assert_eq!(Fake::reads(), reads + 1); // Only the new native item's lookup, not old chunks.
    let silent = Fake::silent_reads();
    assert!(silent > 2);
    for _ in 0..5 {
        assert_eq!(&**read_native("fixture").unwrap().as_ref().unwrap(), &value);
    }
    assert_eq!(Fake::silent_reads(), silent);
    // Native sign-out removes exactly the old generation and cannot resurrect it.
    Fake::new("unrelated-provider")
        .set_password("untouched")
        .unwrap();
    delete_native("fixture").unwrap();
    assert!(read_native("fixture").unwrap().is_none());
    assert_eq!(native("fixture").get_password().unwrap(), "");
    assert_eq!(Fake::entries(), 2); // Tombstone + unrelated credential only.
    assert_eq!(
        Fake::new("unrelated-provider").get_password().unwrap(),
        "untouched"
    );
}

#[test]
fn denied_legacy_chunk_stops_immediately_without_interactive_reads_or_partial_import() {
    setup();
    write_chunked("fixture", &"credential".repeat(1000)).unwrap();
    let (generation, count) = legacy_chunks("fixture");
    assert!(count > 2);
    Fake::deny(&format!("fixture_{generation}_0"));
    let entries = Fake::entries();
    let reads = Fake::reads();
    assert_eq!(read_native("fixture").unwrap_err(), LEGACY_ACCESS_REQUIRED);
    assert_eq!(Fake::silent_reads(), 2); // Manifest, denied first chunk; no remaining attempts.
    assert_eq!(Fake::reads(), reads + 1);
    assert_eq!(Fake::entries(), entries);
    assert!(matches!(
        native("fixture").get_password(),
        Err(keyring::Error::NoEntry)
    ));
}

#[test]
fn failed_import_write_keeps_all_legacy_data_for_retry() {
    setup();
    let value = "retained".repeat(1000);
    write_chunked("fixture", &value).unwrap();
    let entries = Fake::entries();
    Fake::fail_after(0);
    assert!(read_native("fixture").is_err());
    assert_eq!(Fake::entries(), entries);
    assert_eq!(
        &**read_chunked("fixture", raw).unwrap().as_ref().unwrap(),
        &value
    );
}

#[test]
fn native_signout_tombstone_prevents_legacy_resurrection_even_when_cleanup_is_denied() {
    setup();
    write_chunked("fixture", &"old".repeat(1000)).unwrap();
    write_native("fixture", "active replacement").unwrap();
    let (generation, _) = legacy_chunks("fixture");
    Fake::deny(&format!("fixture_{generation}_0"));
    assert!(delete_native("fixture").is_err());
    let silent = Fake::silent_reads();
    assert!(read_native("fixture").unwrap().is_none());
    assert_eq!(Fake::silent_reads(), silent); // No fallback after sign-out.
    assert_eq!(native("fixture").get_password().unwrap(), "");
}

#[test]
fn native_signout_with_unreadable_manifest_clears_active_item_without_prompting_for_chunks() {
    setup();
    write_chunked("fixture", "legacy").unwrap();
    write_native("fixture", "active").unwrap();
    Fake::deny("fixture");
    let entries = Fake::entries();
    assert!(delete_native("fixture")
        .unwrap_err()
        .contains("Signed out locally"));
    assert_eq!(Fake::silent_reads(), 1);
    assert!(read_native("fixture").unwrap().is_none());
    assert_eq!(Fake::entries(), entries);
}

#[cfg(not(target_os = "windows"))]
#[test]
fn reconnect_is_explicit_and_preserves_blocked_legacy_registrations_instead_of_resetting_them() {
    setup();
    let key = "chatgpt_browser_v2_catalog";
    write_chunked(key, r#"{"old":"protected registration"}"#).unwrap();
    Fake::deny(key);
    assert!(AuthCatalog::load_for_sign_in(false).is_err()); // Never substitute another saved profile.
    let mut replacement = AuthCatalog::load_for_sign_in(true).unwrap();
    assert!(replacement.profiles.is_empty());
    let old_pointer = Fake::new(key).get_password().unwrap();
    replacement.save().unwrap();
    assert_eq!(Fake::new(key).get_password().unwrap(), old_pointer);
    assert_eq!(AuthCatalog::load().unwrap().host_id, replacement.host_id);
}

#[test]
fn failed_tombstone_write_never_deletes_active_or_legacy_secrets() {
    setup();
    write_chunked("fixture", "old").unwrap();
    write_native("fixture", "active").unwrap();
    let entries = Fake::entries();
    Fake::fail_after(0);
    assert!(delete_native("fixture").is_err());
    assert_eq!(Fake::entries(), entries);
    assert_eq!(
        &**read_native("fixture").unwrap().as_ref().unwrap(),
        "active"
    );
    assert_eq!(
        &**read_chunked("fixture", raw).unwrap().as_ref().unwrap(),
        "old"
    );
}

#[test]
fn native_write_logs_one_planned_and_written_item_without_secret_or_account_identifiers() {
    use crate::features::ai::keyring_write_progress::take_test_logs;
    setup();
    take_test_logs();
    write_native(
        "chatgpt_browser_v2_session_private-profile-id",
        "private-access-token",
    )
    .unwrap();
    let logs = take_test_logs();
    let summary = logs.last().unwrap();
    for expected in [
        "kind=chatgpt_session",
        "layout=native_single",
        "event=complete",
        "planned=1",
        "written=1",
        "committed=true",
    ] {
        assert!(summary.contains(expected), "{expected}");
    }
    assert!(logs.iter().all(|line| !line.contains("private-")));
}

#[test]
fn windows_write_logs_manifest_in_total_and_reports_partial_writes_and_cleanup_on_failure() {
    use crate::features::ai::keyring_write_progress::take_test_logs;
    setup();
    Fake::windows_limit(true);
    take_test_logs();
    let value = "private-token".repeat(1000);
    write_chunked("private-profile-id", &value).unwrap();
    let items = Fake::entries();
    let logs = take_test_logs();
    let summary = logs.last().unwrap();
    assert!(
        summary.contains(&format!("planned={items}"))
            && summary.contains(&format!("written={items}"))
    );
    assert!(summary.contains("committed=true"));
    assert!(logs.iter().all(|line| !line.contains("private-")));
    Fake::fail_after(1);
    assert!(write_chunked("private-profile-id", &value).is_err());
    let logs = take_test_logs();
    let summary = logs.last().unwrap();
    for expected in [
        "event=failed",
        "written=1",
        "failed=1",
        "committed=false",
        "rollback_attempted=2",
        "rollback_succeeded=2",
        "rollback_failed=0",
    ] {
        assert!(summary.contains(expected), "{expected}");
    }
    assert_eq!(Fake::entries(), items);
    assert!(logs.iter().all(|line| !line.contains("private-")));
}
