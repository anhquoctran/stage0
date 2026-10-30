use super::{credential_stage, PreferencesManager, PreferencesTransactionRequest};
use serde_json::{json, Value};
use std::cell::{Cell, RefCell};
use std::collections::BTreeMap;
use std::path::PathBuf;
use zeroize::Zeroizing;

fn fixture() -> (PathBuf, PreferencesManager) {
    let path = std::env::temp_dir().join(format!("stage0-atomic-prefs-{}", uuid::Uuid::new_v4()));
    let manager = PreferencesManager::new(path.clone()).unwrap();
    manager.initialize(Value::Null, None).unwrap();
    (path, manager)
}

fn request() -> PreferencesTransactionRequest {
    let mut request = PreferencesTransactionRequest::default();
    request.patch = json!({"appearance":{"language":"vi"},"ai":{"agentOutputLanguage":"ja"}});
    request.api_keys = BTreeMap::from([
        ("openai".into(), "private-one".into()),
        ("anthropic".into(), "private-two".into()),
    ]);
    request
}

#[test]
fn preparation_failures_never_publish_json_or_change_existing_credentials() {
    for fail_at in 0..2 {
        let (path, manager) = fixture();
        let before = manager.read().unwrap();
        let vault = RefCell::new(BTreeMap::from([(
            "legacy".to_string(),
            "old-private-value".to_string(),
        )]));
        let count = Cell::new(0);
        let request = request();
        credential_stage::validate(&request).unwrap();
        let result = manager.patch_prepared(
            request.patch.clone(),
            before.revision.clone(),
            |candidate| {
                credential_stage::prepare_with(
                    candidate,
                    &request,
                    |_| Ok(None),
                    |secret| {
                        let index = count.get();
                        count.set(index + 1);
                        if index == fail_at {
                            return Err("injected vault failure".into());
                        }
                        let id = format!("txn/{:032x}", index + 1);
                        vault.borrow_mut().insert(id.clone(), secret.to_string());
                        Ok(Value::String(id))
                    },
                )
            },
        );
        assert!(result.is_err());
        let after = manager.read().unwrap();
        assert_eq!(after.content, before.content);
        assert_eq!(after.revision, before.revision);
        assert_eq!(vault.borrow()["legacy"], "old-private-value");
        assert!(credential_stage::referenced(after.settings.as_ref().unwrap()).is_empty());
        std::fs::remove_dir_all(path).unwrap();
    }
}

#[test]
fn stale_or_invalid_candidates_are_rejected_before_secret_staging() {
    let (path, manager) = fixture();
    let before = manager.read().unwrap();
    let calls = Cell::new(0);
    for (patch, revision) in [
        (json!({"appearance":{"language":"vi"}}), "stale".to_string()),
        (
            json!({"appearance":{"language":"invalid"}}),
            before.revision.clone(),
        ),
        (json!({"credentialReferences":{}}), before.revision.clone()),
    ] {
        assert!(manager
            .patch_prepared(patch, revision, |_| {
                calls.set(calls.get() + 1);
                Ok(Value::Null)
            })
            .is_err());
    }
    assert_eq!(calls.get(), 0);
    assert_eq!(manager.read().unwrap().content, before.content);
    std::fs::remove_dir_all(path).unwrap();
}

#[test]
fn external_edit_while_credential_preparation_waits_is_not_overwritten() {
    let (path, manager) = fixture();
    let before = manager.read().unwrap();
    let mut external = before.settings.unwrap();
    external["appearance"]["language"] = json!("fr");
    let file = path.join("preferences.json");
    assert!(manager
        .patch_prepared(
            json!({"appearance":{"language":"vi"}}),
            before.revision,
            |_| {
                std::fs::write(&file, external.to_string()).unwrap();
                Ok(Value::Null)
            }
        )
        .is_err());
    assert_eq!(
        manager.read().unwrap().settings.unwrap()["appearance"]["language"],
        "fr"
    );
    std::fs::remove_dir_all(path).unwrap();
}

#[test]
fn mcp_merge_and_removals_are_immutable_and_removal_cannot_resurrect_legacy_keys() {
    let mut request = request();
    request.api_keys.clear();
    request.api_key_removals = vec!["openai".into()];
    request.mcp_env_secrets.insert(
        "server".into(),
        BTreeMap::from([("NEW_TOKEN".into(), "new-secret".into())]),
    );
    request
        .mcp_env_removals
        .insert("server".into(), vec!["OLD_TOKEN".into()]);
    let staged = RefCell::new(Vec::new());
    let settings = json!({});
    let patch = credential_stage::prepare_with(
        &settings,
        &request,
        |_| {
            Ok(Some(Zeroizing::new(
                json!({"OLD_TOKEN":"old-secret","KEPT_TOKEN":"kept-secret"}).to_string(),
            )))
        },
        |value| {
            staged.borrow_mut().push(value.to_string());
            Ok(json!("txn/11111111111111111111111111111111"))
        },
    )
    .unwrap();
    assert!(patch["credentialReferences"]["ai/openai"].is_null());
    let record: Value = serde_json::from_str(&staged.borrow()[0]).unwrap();
    assert!(record.get("OLD_TOKEN").is_none());
    assert_eq!(record["NEW_TOKEN"], "new-secret");
    assert_eq!(record["KEPT_TOKEN"], "kept-secret");
    assert!(!patch.to_string().contains("secret"));
}

#[test]
fn successful_snapshot_survives_reopen_and_reference_metadata_is_read_only() {
    let (path, manager) = fixture();
    let before = manager.read().unwrap();
    let request = request();
    let count = Cell::new(0u64);
    let saved = manager
        .patch_prepared(request.patch.clone(), before.revision, |candidate| {
            credential_stage::prepare_with(
                candidate,
                &request,
                |_| Ok(None),
                |_| {
                    count.set(count.get() + 1);
                    Ok(json!(format!("txn/{:032x}", count.get())))
                },
            )
        })
        .unwrap();
    assert!(!saved.content.contains("private-one"));
    assert!(!saved.content.contains("private-two"));
    drop(manager);
    let reopened = PreferencesManager::new(path.clone()).unwrap();
    let loaded = reopened.read().unwrap();
    assert_eq!(
        loaded.settings.as_ref().unwrap()["appearance"]["language"],
        "vi"
    );
    assert_eq!(
        loaded.settings.as_ref().unwrap()["ai"]["agentOutputLanguage"],
        "ja"
    );
    assert_eq!(
        credential_stage::referenced(loaded.settings.as_ref().unwrap()).len(),
        2
    );
    let mut edited = loaded.settings.clone().unwrap();
    edited
        .as_object_mut()
        .unwrap()
        .remove("credentialReferences");
    assert!(reopened.save(edited.to_string(), loaded.revision).is_err());
    let reset = reopened.reset().unwrap();
    assert_eq!(
        reset.settings.as_ref().unwrap()["credentialReferences"],
        saved.settings.as_ref().unwrap()["credentialReferences"]
    );
    std::fs::remove_dir_all(path).unwrap();
}

#[test]
fn crash_child() {
    let Some(path) = std::env::var_os("STAGE0_PREF_CRASH_FIXTURE") else {
        return;
    };
    let mode = std::env::var("STAGE0_PREF_CRASH_MODE").unwrap();
    let path = PathBuf::from(path);
    let manager = PreferencesManager::new(path.clone()).unwrap();
    let before = manager.read().unwrap();
    let request = request();
    let index = rusqlite::Connection::open(path.join("credential-index.db")).unwrap();
    index.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE preference_secret_refs(id TEXT PRIMARY KEY,keychain_ref TEXT NOT NULL);").unwrap();
    let db = crate::core::db::Database::from_connection(index);
    manager
        .patch_prepared(request.patch.clone(), before.revision, |candidate| {
            credential_stage::prepare_with(
                candidate,
                &request,
                |_| Ok(None),
                |value| {
                    // A separate durable fake-vault object models an acknowledged keychain write.
                    let id = uuid::Uuid::new_v4().simple().to_string();
                    db.stage_preference_secret_ref(&format!("txn/{id}"), &format!("vault-{id}"))
                        .unwrap();
                    let mut file = std::fs::File::create(path.join(format!("vault-{id}"))).unwrap();
                    std::io::Write::write_all(&mut file, value.as_bytes()).unwrap();
                    file.sync_all().unwrap();
                    if mode == "prepared" {
                        std::process::exit(73);
                    }
                    Ok(json!(format!("txn/{id}")))
                },
            )
        })
        .unwrap();
    std::process::exit(74);
}

#[test]
fn abrupt_process_exit_recovers_either_the_old_or_complete_new_snapshot() {
    for mode in ["prepared", "committed"] {
        let (path, manager) = fixture();
        let before = manager.read().unwrap();
        drop(manager);
        let status = std::process::Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "features::preferences::commit_tests::crash_child",
                "--nocapture",
            ])
            .env("STAGE0_PREF_CRASH_FIXTURE", &path)
            .env("STAGE0_PREF_CRASH_MODE", mode)
            .status()
            .unwrap();
        assert_eq!(
            status.code(),
            Some(if mode == "prepared" { 73 } else { 74 })
        );
        let reopened = PreferencesManager::new(path.clone())
            .unwrap()
            .read()
            .unwrap();
        if mode == "prepared" {
            assert_eq!(reopened.content, before.content);
        } else {
            let settings = reopened.settings.unwrap();
            assert_eq!(settings["appearance"]["language"], "vi");
            for id in credential_stage::referenced(&settings) {
                let index = rusqlite::Connection::open(path.join("credential-index.db")).unwrap();
                let reference: String = index
                    .query_row(
                        "SELECT keychain_ref FROM preference_secret_refs WHERE id=?1",
                        [&id],
                        |row| row.get(0),
                    )
                    .unwrap();
                assert!(path.join(reference).exists());
            }
        }
        std::fs::remove_dir_all(path).unwrap();
    }
}
