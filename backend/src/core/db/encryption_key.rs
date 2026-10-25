use super::key_manifest::KeyManifest;
use super::machine_identity::machine_fingerprint;
use base64::{engine::general_purpose::STANDARD, Engine};
use hkdf::Hkdf;
use sha2::Sha256;
use std::{io, path::Path};
use zeroize::Zeroizing;

const KEYRING_SERVICE: &str = "com.stage0.database";
const KEY_BYTES: usize = 32;

pub(super) fn load_or_create_key(
    directory: &Path,
    encrypted: bool,
) -> io::Result<Zeroizing<Vec<u8>>> {
    resolve_key(
        directory,
        encrypted,
        read_native_key,
        store_native_key,
        |id| {
            let machine = machine_fingerprint()?;
            let mut seed = Zeroizing::new([0u8; KEY_BYTES]);
            getrandom::getrandom(seed.as_mut())
                .map_err(|_| io::Error::other("Could not securely generate a database key"))?;
            derive_key(&seed[..], &machine, id)
        },
    )
}

pub(super) fn resolve_key(
    directory: &Path,
    encrypted: bool,
    read: impl FnOnce(&str) -> io::Result<Zeroizing<Vec<u8>>>,
    store: impl FnOnce(&str, &[u8]) -> io::Result<()>,
    generate: impl FnOnce(&str) -> io::Result<Zeroizing<Vec<u8>>>,
) -> io::Result<Zeroizing<Vec<u8>>> {
    if let Some(manifest) = KeyManifest::read(directory)? {
        let key = read(&manifest.installation_id)?;
        validate_key(&key)?;
        return Ok(key);
    }
    if encrypted {
        return Err(io::Error::other(
            "The encrypted database has no key reference. Restore database-key.json and its OS-vault key from the same installation. The database was retained",
        ));
    }
    let manifest = KeyManifest::new();
    let key = generate(&manifest.installation_id)?;
    validate_key(&key)?;
    // Commit the secret first. A crash before the public manifest can leave an
    // unused vault item, but can never leave an encrypted DB without a saved key.
    store(&manifest.installation_id, &key)?;
    manifest.save_new(directory)?;
    Ok(key)
}

pub(super) fn derive_key(
    seed: &[u8],
    machine: &[u8],
    installation_id: &str,
) -> io::Result<Zeroizing<Vec<u8>>> {
    let context = format!("com.stage0.app/database/sqlcipher/v1/{installation_id}");
    let mut key = Zeroizing::new(vec![0u8; KEY_BYTES]);
    Hkdf::<Sha256>::new(Some(machine), seed)
        .expand(context.as_bytes(), &mut key)
        .map_err(|_| io::Error::other("Could not derive the database key"))?;
    Ok(key)
}

fn validate_key(key: &[u8]) -> io::Result<()> {
    if key.len() != KEY_BYTES {
        return Err(io::Error::other(
            "The saved database key is invalid; no replacement was generated",
        ));
    }
    Ok(())
}

fn vault_entry(id: &str) -> io::Result<keyring::Entry> {
    keyring::Entry::new(KEYRING_SERVICE, &format!("installation-v1/{id}"))
        .map_err(|_| io::Error::other("Could not initialize the OS vault for the database key"))
}

fn read_native_key(id: &str) -> io::Result<Zeroizing<Vec<u8>>> {
    let encoded = Zeroizing::new(vault_entry(id)?.get_password().map_err(|_| {
        io::Error::other("Cannot unlock the database. Unlock or restore this installation's OS-vault key; the database was retained")
    })?);
    let decoded = Zeroizing::new(
        STANDARD
            .decode(encoded.as_bytes())
            .map_err(|_| io::Error::other("The saved database key is invalid"))?,
    );
    validate_key(&decoded)?;
    Ok(decoded)
}

fn store_native_key(id: &str, key: &[u8]) -> io::Result<()> {
    let encoded = Zeroizing::new(STANDARD.encode(key));
    vault_entry(id)?.set_password(&encoded).map_err(|_| {
        io::Error::other("Could not save the database key. Unlock or enable the OS vault; no plaintext fallback was used")
    })?;
    // Verify persistence before creating a manifest or encrypting any data.
    let stored = read_native_key(id)?;
    if stored.as_slice() != key {
        return Err(io::Error::other(
            "The OS vault did not persist the database key",
        ));
    }
    Ok(())
}
