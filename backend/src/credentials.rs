use serde::{Deserialize, Serialize};

pub const KEYRING_SERVICE: &str = "stage0.git.credentials";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OsKeyringInfo {
    pub os: String,
    pub keyring_name: String,
    pub is_available: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitCredentialMeta {
    pub id: String,
    pub provider: String,
    pub server_url: String,
    pub account_name: String,
    pub token_ref: String,
    pub token_type: String,
    pub label: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub is_in_keyring: bool,
}

#[derive(Deserialize, Clone, Debug)]
pub struct SaveGitCredentialPayload {
    pub provider: String,
    pub server_url: String,
    pub account_name: String,
    pub token_type: String,
    pub label: Option<String>,
    pub secret: String,
}

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
            format!("OS Credential Manager platform error while attempting to {}: {}", action, inner)
        }
        keyring::Error::NoEntry => {
            format!("No matching credential entry found while attempting to {}.", action)
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
    let _ = entry.delete_credential();
    Ok(())
}

pub fn exists_in_keyring(token_ref: &str) -> bool {
    match keyring::Entry::new(KEYRING_SERVICE, token_ref) {
        Ok(entry) => entry.get_password().is_ok(),
        Err(_) => false,
    }
}
