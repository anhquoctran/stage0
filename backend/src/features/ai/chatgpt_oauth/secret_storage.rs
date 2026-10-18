//! OS-keyring-only records. Only Windows uses chunked records; macOS/Linux use
//! one native item per record so authorizing a session does not prompt per chunk.
use crate::features::ai::keyring_write_progress::{read_item, KeyringWriteProgress};
use base64::{engine::general_purpose::STANDARD, Engine};
use zeroize::Zeroizing;

const CHUNK: usize = 1000; // Base64 ASCII => at most 2000 UTF-16 bytes.
const LIMIT: usize = 256 * 1024;
pub(super) const LEGACY_ACCESS_REQUIRED: &str = "Older ChatGPT sign-ins could not be imported without additional Keychain permissions. No further prompts were opened. Select Add a ChatGPT account or workspace and Continue with ChatGPT to reconnect. Older keyring items are retained.";
#[cfg(any(not(target_os = "windows"), test))]
fn native_key(key: &str) -> String {
    format!("chatgpt_native_v3_{key}")
}
#[cfg(not(test))]
fn entry(key: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(crate::features::credentials::AI_KEYRING_SERVICE, key)
        .map_err(|_| "Could not initialize ChatGPT OS keyring".into())
}
#[cfg(test)]
fn entry(key: &str) -> Result<super::test_keyring_entry::TestKeyringEntry, String> {
    Ok(super::test_keyring_entry::TestKeyringEntry::new(key))
}
pub(super) fn raw(key: &str) -> Result<Option<Zeroizing<String>>, String> {
    let layout = if key.starts_with("chatgpt_native_v3_") {
        "native_single"
    } else {
        "chunked"
    };
    read_item(record_kind(key), layout, || raw_unlogged(key))
}
fn raw_unlogged(key: &str) -> Result<Option<Zeroizing<String>>, String> {
    match entry(key)?.get_password() {
        Ok(value) => Ok(Some(Zeroizing::new(value))),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err(
            "Could not read ChatGPT OS keyring. Unlock or enable the OS credential store.".into(),
        ),
    }
}
fn manifest(raw: &str) -> Result<(String, usize), String> {
    let value: serde_json::Value =
        serde_json::from_str(raw).map_err(|_| "Invalid ChatGPT keyring manifest")?;
    let generation = value["generation"]
        .as_str()
        .filter(|s| uuid::Uuid::parse_str(s).is_ok())
        .ok_or("Invalid keyring generation")?;
    let count = value["count"]
        .as_u64()
        .filter(|n| (1..=512).contains(n))
        .ok_or("Invalid keyring chunk count")? as usize;
    Ok((generation.into(), count))
}
fn chunk_key(key: &str, generation: &str, index: usize) -> String {
    format!("{key}_{generation}_{index}")
}
fn record_kind(key: &str) -> &'static str {
    let key = key.strip_prefix("chatgpt_native_v3_").unwrap_or(key);
    if key.starts_with("chatgpt_browser_v2_catalog") {
        "chatgpt_catalog"
    } else if key.starts_with("chatgpt_browser_v2_session_") {
        "chatgpt_session"
    } else {
        "chatgpt_record"
    }
}
#[cfg(any(target_os = "windows", test))]
fn cleanup(
    key: &str,
    generation: &str,
    count: usize,
    mut progress: Option<&mut KeyringWriteProgress>,
) -> bool {
    let mut success = true;
    for index in 0..count {
        let remove = || match entry(&chunk_key(key, generation, index))?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err("Could not remove credential chunk".into()),
        };
        let result = if let Some(progress) = progress.as_deref_mut() {
            progress.rollback_item(remove)
        } else {
            remove()
        };
        if result.is_err() {
            success = false;
        }
    }
    success
}
pub(super) fn read_chunked(
    key: &str,
    read: impl Fn(&str) -> Result<Option<Zeroizing<String>>, String>,
) -> Result<Option<Zeroizing<String>>, String> {
    let Some(pointer) = read(key)? else {
        return Ok(None);
    };
    let (generation, count) = manifest(&pointer)?;
    let mut encoded = Zeroizing::new(String::new());
    for index in 0..count {
        let chunk = read(&chunk_key(key, &generation, index))?
            .ok_or("ChatGPT keyring record is incomplete")?;
        if chunk.len() > CHUNK || !chunk.is_ascii() {
            return Err("Invalid ChatGPT keyring chunk".into());
        }
        encoded.push_str(&chunk);
        if encoded.len() > LIMIT.div_ceil(3) * 4 {
            return Err("ChatGPT keyring record exceeded its size limit".into());
        }
    }
    let bytes = STANDARD
        .decode(encoded.as_bytes())
        .map_err(|_| "Invalid ChatGPT keyring encoding")?;
    if bytes.len() > LIMIT {
        return Err("ChatGPT keyring record exceeded its size limit".into());
    }
    String::from_utf8(bytes)
        .map(|s| Some(Zeroizing::new(s)))
        .map_err(|_| "Invalid ChatGPT keyring record".into())
}
#[cfg(any(target_os = "windows", test))]
pub(super) fn write_chunked(key: &str, value: &str) -> Result<(), String> {
    if value.len() > LIMIT || value.is_empty() {
        return Err("ChatGPT keyring record exceeded its size limit".into());
    }
    let generation = uuid::Uuid::new_v4().to_string();
    let encoded = Zeroizing::new(STANDARD.encode(value));
    let count = encoded.len().div_ceil(CHUNK);
    let mut progress = KeyringWriteProgress::new(record_kind(key), "windows_chunked", count + 1);
    progress.stage("read_previous_manifest");
    let old = raw(key)?.map(|s| manifest(&s)).transpose()?;
    for (index, chunk) in encoded.as_bytes().chunks(CHUNK).enumerate() {
        let chunk = std::str::from_utf8(chunk).map_err(|_| "Invalid keyring chunk encoding")?;
        if progress
            .write_item("chunk", || {
                entry(&chunk_key(key, &generation, index))?
                    .set_password(chunk)
                    .map_err(|_| "Could not save credential chunk".into())
            })
            .is_err()
        {
            cleanup(key, &generation, index + 1, Some(&mut progress));
            return Err("Could not securely save ChatGPT credentials. Unlock or enable the OS keyring; no plaintext fallback was used.".into());
        }
    }
    let pointer = serde_json::json!({"generation":generation,"count":count}).to_string();
    if progress
        .write_item("manifest", || {
            entry(key)?
                .set_password(&pointer)
                .map_err(|_| "Could not save credential manifest".into())
        })
        .is_err()
    {
        cleanup(key, &generation, count, Some(&mut progress));
        return Err("Could not commit ChatGPT keyring record".into());
    }
    progress.commit();
    if let Some((old_generation, old_count)) = old {
        cleanup(key, &old_generation, old_count, None);
    }
    Ok(())
}
#[cfg(any(target_os = "windows", test))]
pub(super) fn delete_chunked(key: &str) -> Result<(), String> {
    let Some(pointer) = raw(key)? else {
        return Ok(());
    };
    let (generation, count) = manifest(&pointer)?;
    entry(key)?
        .delete_credential()
        .map_err(|_| "Could not remove the ChatGPT keyring manifest")?;
    if !cleanup(key, &generation, count, None) {
        return Err(
            "Signed out locally, but some OS-keyring credential chunks could not be removed".into(),
        );
    }
    Ok(())
}

#[cfg(target_os = "windows")]
pub(super) fn read(key: &str) -> Result<Option<Zeroizing<String>>, String> {
    read_chunked(key, raw)
}
#[cfg(target_os = "windows")]
pub(super) fn write(key: &str, value: &str) -> Result<(), String> {
    write_chunked(key, value)
}
#[cfg(target_os = "windows")]
pub(super) fn delete(key: &str) -> Result<(), String> {
    delete_chunked(key)
}

#[cfg(any(not(target_os = "windows"), test))]
fn legacy_raw(key: &str) -> Result<Option<Zeroizing<String>>, String> {
    read_item(record_kind(key), "legacy_silent", || {
        legacy_raw_unlogged(key)
    })
}
#[cfg(any(not(target_os = "windows"), test))]
fn legacy_raw_unlogged(key: &str) -> Result<Option<Zeroizing<String>>, String> {
    #[cfg(test)]
    {
        entry(key)?
            .get_password_silent()
            .map(|value| Some(Zeroizing::new(value)))
            .or_else(|error| match error {
                keyring::Error::NoEntry => Ok(None),
                _ => Err(LEGACY_ACCESS_REQUIRED.into()),
            })
    }
    #[cfg(all(target_os = "macos", not(test)))]
    {
        super::macos_legacy_keyring::read(key)
    }
    #[cfg(all(not(target_os = "macos"), not(test)))]
    {
        raw_unlogged(key)
    }
}

#[cfg(any(not(target_os = "windows"), test))]
pub(super) fn read_native(key: &str) -> Result<Option<Zeroizing<String>>, String> {
    if let Some(value) = raw(&native_key(key))? {
        // An empty, secret-free item is a sign-out tombstone. Never fall back to
        // a retained legacy token after sign-out or failed legacy cleanup.
        if value.is_empty() {
            return Ok(None);
        }
        if value.len() > LIMIT {
            return Err("ChatGPT keyring record exceeded its size limit".into());
        }
        return Ok(Some(value));
    }
    // Legacy imports cannot open authorization UI on macOS. Stop at the first
    // denied item instead of queueing a dialog for every remaining chunk.
    let old = read_chunked(key, legacy_raw)?;
    if let Some(value) = &old {
        write_native(key, value)?;
        // Preserve old items during migration. Sign-out removes the exact old
        // generation without UI, or reports incomplete cleanup without retrying.
    }
    Ok(old)
}

#[cfg(any(not(target_os = "windows"), test))]
pub(super) fn write_native(key: &str, value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > LIMIT {
        return Err("ChatGPT keyring record exceeded its size limit".into());
    }
    let mut progress = KeyringWriteProgress::new(record_kind(key), "native_single", 1);
    progress.write_item("record", || entry(&native_key(key))?.set_password(value).map_err(|_| "Could not save ChatGPT credentials to the OS keyring. Previous records were retained; no plaintext fallback was used.".into()))?;
    progress.commit();
    Ok(())
}

#[cfg(any(not(target_os = "windows"), test))]
pub(super) fn delete_native(key: &str) -> Result<(), String> {
    let legacy = legacy_raw(key);
    if matches!(&legacy, Ok(None)) {
        // Native-only records have no legacy fallback to suppress. Delete them
        // normally rather than accumulating an empty item on every token rotation.
        return match entry(&native_key(key))?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err("Could not remove the native ChatGPT keyring record".into()),
        };
    }
    // Commit sign-out before cleanup. Failure to write the tombstone leaves the
    // active item unchanged; no legacy deletion is attempted in that case.
    let mut progress = KeyringWriteProgress::new("chatgpt_signout_marker", "native_single", 1);
    progress.write_item("signout_marker", || {
        entry(&native_key(key))?
            .set_password("")
            .map_err(|_| "Could not clear the native ChatGPT keyring record".into())
    })?;
    progress.commit();
    let pointer = legacy.map_err(|_| "Signed out locally, but older keyring items could not be inspected without additional permission. They were retained; no further prompts were opened.")?.ok_or("Legacy keyring cleanup changed unexpectedly")?;
    let (generation, count) = manifest(&pointer)?;
    for index in 0..count {
        delete_legacy_silent(&chunk_key(key, &generation, index))?;
    }
    delete_legacy_silent(key)
}

#[cfg(any(not(target_os = "windows"), test))]
fn delete_legacy_silent(key: &str) -> Result<(), String> {
    #[cfg(all(target_os = "macos", not(test)))]
    {
        super::macos_legacy_keyring::delete(key)
    }
    #[cfg(not(all(target_os = "macos", not(test))))]
    {
        match entry(key)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err("Legacy keyring cleanup was incomplete".into()),
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub(super) fn read(key: &str) -> Result<Option<Zeroizing<String>>, String> {
    read_native(key)
}
#[cfg(not(target_os = "windows"))]
pub(super) fn write(key: &str, value: &str) -> Result<(), String> {
    write_native(key, value)
}
#[cfg(not(target_os = "windows"))]
pub(super) fn delete(key: &str) -> Result<(), String> {
    delete_native(key)
}

#[cfg(test)]
mod tests {
    #[test]
    fn chunks_fit_windows_password_limits_and_manifests_are_bounded() {
        use super::*;
        let source = "🔐".repeat(5000);
        let encoded = STANDARD.encode(&source);
        for chunk in encoded.as_bytes().chunks(CHUNK) {
            assert!(std::str::from_utf8(chunk).unwrap().encode_utf16().count() * 2 <= 2560);
        }
        assert_eq!(
            String::from_utf8(STANDARD.decode(encoded).unwrap()).unwrap(),
            source
        );
        assert!(manifest(r#"{"generation":"../../key","count":1}"#).is_err());
        assert!(manifest(
            &serde_json::json!({"generation":uuid::Uuid::new_v4(),"count":999999}).to_string()
        )
        .is_err());
    }
}
