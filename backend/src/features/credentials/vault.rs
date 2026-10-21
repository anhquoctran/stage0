use super::{OsKeyringInfo, KEYRING_SERVICE};

fn map_keyring_error(action: &str, err: keyring::Error) -> String {
    match err {
        keyring::Error::NoStorageAccess(ref inner) => {
            #[cfg(target_os = "linux")]
            {
                format!("Cannot access secure credential vault: {}. Ensure a FreeDesktop Secret Service daemon (such as gnome-keyring or ksecretservice) is installed, unlocked, and running.", inner)
            }
            #[cfg(target_os = "macos")]
            {
                format!("macOS Keychain access error: {}. Ensure Keychain is unlocked and permission is granted.", inner)
            }
            #[cfg(target_os = "windows")]
            {
                format!("Windows Credential Manager access error: {}.", inner)
            }
            #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
            {
                format!("Cannot access OS credential store: {}.", inner)
            }
        }
        keyring::Error::PlatformFailure(ref inner) => {
            format!(
                "OS Credential Manager platform error while attempting to {}: {}",
                action, inner
            )
        }
        keyring::Error::NoEntry => {
            format!(
                "No matching credential entry found while attempting to {}.",
                action
            )
        }
        other => format!("Failed to {} in OS Credential Manager: {}", action, other),
    }
}

pub fn get_os_keyring_info() -> OsKeyringInfo {
    #[cfg(target_os = "windows")]
    {
        OsKeyringInfo {
            os: "windows".to_string(),
            keyring_name: "Windows Credential Manager".to_string(),
            is_available: true,
        }
    }
    #[cfg(target_os = "macos")]
    {
        OsKeyringInfo {
            os: "macos".to_string(),
            keyring_name: "macOS Keychain".to_string(),
            is_available: true,
        }
    }
    #[cfg(target_os = "linux")]
    {
        OsKeyringInfo {
            os: "linux".to_string(),
            keyring_name: "Secret Service (GNOME Keyring / KWallet)".to_string(),
            is_available: true,
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        OsKeyringInfo {
            os: "unknown".to_string(),
            keyring_name: "OS Credential Manager".to_string(),
            is_available: true,
        }
    }
}

pub fn store_secret(token_ref: &str, secret: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, token_ref)
        .map_err(|e| map_keyring_error("initialize", e))?;
    entry
        .set_password(secret)
        .map_err(|e| map_keyring_error("store secret", e))?;
    Ok(())
}

pub fn retrieve_secret(token_ref: &str) -> Result<String, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, token_ref)
        .map_err(|e| map_keyring_error("initialize", e))?;
    entry
        .get_password()
        .map_err(|e| map_keyring_error("retrieve secret", e))
}

pub fn delete_secret(token_ref: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, token_ref)
        .map_err(|e| map_keyring_error("initialize", e))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(map_keyring_error("delete secret", error)),
    }
}

pub fn exists_in_keyring(token_ref: &str) -> bool {
    match keyring::Entry::new(KEYRING_SERVICE, token_ref) {
        Ok(entry) => entry.get_password().is_ok(),
        Err(_) => false,
    }
}

pub const AI_KEYRING_SERVICE: &str = "stage0.ai.credentials";
pub const PREFERENCES_KEYRING_SERVICE: &str = "stage0.preferences.secrets";

pub fn store_ai_key(provider: &str, api_key: &str) -> Result<(), String> {
    let mut progress = crate::features::ai::keyring_write_progress::KeyringWriteProgress::new(
        "ai_credential",
        "native_single",
        1,
    );
    progress.write_item("record", || store_ai_key_unlogged(provider, api_key))?;
    progress.commit();
    Ok(())
}

// The Preferences batch already owns the counters, including compensating writes.
pub(crate) fn store_ai_key_unlogged(provider: &str, api_key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(AI_KEYRING_SERVICE, provider)
        .map_err(|e| map_keyring_error("initialize AI secret", e))?;
    entry
        .set_password(api_key)
        .map_err(|e| map_keyring_error("store AI secret", e))?;
    Ok(())
}

pub fn ai_key_exists(provider: &str) -> Result<bool, String> {
    let entry = keyring::Entry::new(AI_KEYRING_SERVICE, provider)
        .map_err(|e| map_keyring_error("initialize AI secret", e))?;
    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(error) => Err(map_keyring_error("check AI secret", error)),
    }
}

pub fn delete_ai_key(provider: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(AI_KEYRING_SERVICE, provider)
        .map_err(|e| map_keyring_error("initialize AI secret", e))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(map_keyring_error("delete AI secret", error)),
    }
}

pub fn get_ai_key(provider: &str) -> Result<String, String> {
    let entry = keyring::Entry::new(AI_KEYRING_SERVICE, provider)
        .map_err(|e| map_keyring_error("initialize AI secret", e))?;
    entry
        .get_password()
        .map_err(|e| map_keyring_error("read AI secret", e))
}

pub fn store_preference_secret(reference: &str, secret: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(PREFERENCES_KEYRING_SERVICE, reference)
        .map_err(|e| map_keyring_error("initialize preference secret", e))?;
    entry
        .set_password(secret)
        .map_err(|e| map_keyring_error("store preference secret", e))
}

pub fn retrieve_preference_secret(reference: &str) -> Result<String, String> {
    let entry = keyring::Entry::new(PREFERENCES_KEYRING_SERVICE, reference)
        .map_err(|e| map_keyring_error("initialize preference secret", e))?;
    entry
        .get_password()
        .map_err(|e| map_keyring_error("retrieve preference secret", e))
}

pub fn delete_preference_secret(reference: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(PREFERENCES_KEYRING_SERVICE, reference)
        .map_err(|e| map_keyring_error("initialize preference secret", e))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(map_keyring_error("delete preference secret", error)),
    }
}
