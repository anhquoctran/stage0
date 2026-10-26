use serde_json::{json, Value};
use tauri_plugin_updater::{Updater, UpdaterExt};

fn updater() -> Updater {
    let mut context = tauri::test::mock_context(tauri::test::noop_assets());
    context.config_mut().plugins.0.insert(
        "updater".into(),
        json!({
            "pubkey": include_str!("fixtures/test.pub").trim(),
            "requireSignedVersion": true,
        }),
    );
    let app = tauri::test::mock_builder()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(context)
        .unwrap();
    app.updater_builder()
        .target("test-target")
        .executable_path("/tmp/Stage0.app/Contents/MacOS/Stage0")
        .configure_client(|_| panic!("Signature verification must not make network requests"))
        .endpoints(vec!["https://example.invalid/latest.json".parse().unwrap()])
        .unwrap()
        .build()
        .unwrap()
}

fn manifest() -> Value {
    json!({
        "version": "2.0.0",
        "platforms": {"test-target": {
            "url": "https://github.com/anhquoctran/stage0/releases/download/v2.0.0/package",
            "signature": include_str!("fixtures/payload.sig").trim(),
        }},
    })
}

#[test]
fn valid_version_bound_package_verifies_without_installation() {
    let update = updater().restore_update(manifest()).unwrap().unwrap();
    assert!(update.verify(b"stage0-updater-test-payload").is_ok());
    assert!(update.verify(b"tampered-package").is_err());
}

#[test]
fn inflated_manifest_version_cannot_replay_an_older_signed_package() {
    let mut manifest = manifest();
    manifest["version"] = json!("99.0.0");
    let update = updater().restore_update(manifest).unwrap().unwrap();
    assert!(matches!(
        update.verify(b"stage0-updater-test-payload"),
        Err(tauri_plugin_updater::Error::SignedVersionMismatch { .. })
    ));
}

#[test]
fn same_or_older_release_does_not_offer_an_update() {
    let mut manifest = manifest();
    // mock_app's installed version is 0.1.0.
    for version in ["0.1.0", "0.0.1"] {
        manifest["version"] = json!(version);
        assert!(updater()
            .restore_update(manifest.clone())
            .unwrap()
            .is_none());
    }
}

#[test]
fn malformed_or_missing_signature_cannot_verify() {
    let mut manifest = manifest();
    manifest["platforms"]["test-target"]["signature"] = json!("invalid-signature");
    let update = updater().restore_update(manifest.clone()).unwrap().unwrap();
    assert!(update.verify(b"stage0-updater-test-payload").is_err());
    manifest["platforms"]["test-target"]
        .as_object_mut()
        .unwrap()
        .remove("signature");
    assert!(updater().restore_update(manifest).is_err());
}
