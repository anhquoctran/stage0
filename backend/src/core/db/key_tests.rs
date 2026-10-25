use super::encrypted_storage::needs_existing_key;
use super::encryption_key::{derive_key, resolve_key};
use super::key_manifest::KeyManifest;
use super::storage::acquire_database_lock;
use std::{cell::RefCell, io};
use zeroize::Zeroizing;

#[test]
fn native_machine_fingerprint_is_stable_without_publishing_the_identifier() {
    let first = super::machine_identity::machine_fingerprint().unwrap();
    let second = super::machine_identity::machine_fingerprint().unwrap();
    assert_eq!(first.len(), 32);
    assert!(first == second);
}

#[test]
fn keys_depend_on_random_secret_machine_and_installation() {
    let first = derive_key(&[7; 32], b"machine-a", "installation-a").unwrap();
    assert_eq!(first.len(), 32);
    assert_eq!(
        first,
        derive_key(&[7; 32], b"machine-a", "installation-a").unwrap()
    );
    assert_ne!(
        first,
        derive_key(&[8; 32], b"machine-a", "installation-a").unwrap()
    );
    assert_ne!(
        first,
        derive_key(&[7; 32], b"machine-b", "installation-a").unwrap()
    );
    assert_ne!(
        first,
        derive_key(&[7; 32], b"machine-a", "installation-b").unwrap()
    );
}

#[test]
fn new_installation_saves_only_a_public_reference_and_reuses_its_vault_key() {
    let directory = tempfile::tempdir().unwrap();
    let saved = RefCell::new(None);
    let first = resolve_key(
        directory.path(),
        false,
        |_| panic!("a new installation must not inventory the vault"),
        |id, key| {
            *saved.borrow_mut() = Some((id.to_owned(), key.to_vec()));
            Ok(())
        },
        |id| derive_key(&[42; 32], b"hardware-identity-must-not-be-persisted", id),
    )
    .unwrap();
    let public = std::fs::read_to_string(directory.path().join("database-key.json")).unwrap();
    assert!(!public.contains("hardware-identity"));
    let metadata: serde_json::Value = serde_json::from_str(&public).unwrap();
    assert_eq!(metadata.as_object().unwrap().len(), 2);
    let (id, stored) = saved.into_inner().unwrap();
    let reopened = resolve_key(
        directory.path(),
        true,
        |reference| {
            assert_eq!(reference, id);
            Ok(Zeroizing::new(stored))
        },
        |_, _| panic!("an existing installation must not overwrite its key"),
        |_| panic!("hardware is not re-read after the key has been created"),
    )
    .unwrap();
    assert_eq!(first, reopened);
}

#[test]
fn encrypted_data_without_a_manifest_is_retained_without_key_generation() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("stage0.db");
    let original = vec![39; 128];
    std::fs::write(&path, &original).unwrap();
    assert!(needs_existing_key(&path).unwrap());
    let result = resolve_key(
        directory.path(),
        true,
        |_| panic!("there is no key reference to read"),
        |_, _| panic!("must never save a replacement key"),
        |_| panic!("must never generate a replacement key"),
    );
    assert!(result.is_err());
    assert_eq!(std::fs::read(path).unwrap(), original);
    assert!(!directory.path().join("database-key.json").exists());
}

#[test]
fn missing_or_inaccessible_vault_key_never_generates_a_replacement() {
    let directory = tempfile::tempdir().unwrap();
    KeyManifest::new().save_new(directory.path()).unwrap();
    let result = resolve_key(
        directory.path(),
        true,
        |_| Err(io::Error::other("vault locked or key missing")),
        |_, _| panic!("missing keys must not be overwritten"),
        |_| panic!("missing keys must not be regenerated"),
    );
    assert!(result.is_err());
    assert!(KeyManifest::read(directory.path()).unwrap().is_some());
}

#[test]
fn failed_secret_write_does_not_publish_a_key_reference() {
    let directory = tempfile::tempdir().unwrap();
    let result = resolve_key(
        directory.path(),
        false,
        |_| panic!("new key"),
        |_, _| Err(io::Error::other("vault unavailable")),
        |_| Ok(Zeroizing::new(vec![24; 32])),
    );
    assert!(result.is_err());
    assert!(!directory.path().join("database-key.json").exists());
    assert!(!directory.path().join("stage0.db").exists());
}

#[test]
fn malformed_manifest_and_invalid_key_material_fail_closed() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("database-key.json");
    for value in [
        r#"{"version":2,"installation_id":"c4a13c00-734a-4afb-a893-5a8d00707754"}"#,
        r#"{"version":1,"installation_id":"not-a-reference"}"#,
        r#"{"version":1,"installation_id":"00000000-0000-0000-0000-000000000000"}"#,
        "{truncated",
    ] {
        std::fs::write(&path, value).unwrap();
        assert!(KeyManifest::read(directory.path()).is_err());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), value);
    }
    std::fs::remove_file(path).unwrap();
    KeyManifest::new().save_new(directory.path()).unwrap();
    assert!(resolve_key(
        directory.path(),
        true,
        |_| Ok(Zeroizing::new(vec![1; 31])),
        |_, _| panic!("do not replace malformed keys"),
        |_| panic!("do not replace malformed keys"),
    )
    .is_err());
}

#[test]
fn database_lock_prevents_a_second_opener_until_the_first_closes() {
    let directory = tempfile::tempdir().unwrap();
    let first = acquire_database_lock(directory.path()).unwrap();
    assert!(acquire_database_lock(directory.path()).is_err());
    drop(first);
    assert!(acquire_database_lock(directory.path()).is_ok());
}

#[cfg(unix)]
#[test]
fn key_reference_is_private_and_cannot_be_a_symlink() {
    use std::os::unix::fs::{symlink, PermissionsExt};
    let directory = tempfile::tempdir().unwrap();
    let manifest = KeyManifest::new();
    manifest.save_new(directory.path()).unwrap();
    let path = directory.path().join("database-key.json");
    assert_eq!(
        std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
        0o600
    );
    let destination = directory.path().join("other.json");
    std::fs::rename(&path, &destination).unwrap();
    symlink(&destination, &path).unwrap();
    assert!(KeyManifest::read(directory.path()).is_err());
    assert!(manifest.save_new(directory.path()).is_err());
}
