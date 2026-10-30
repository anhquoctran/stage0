//! Immutable references select credentials at the JSON commit point.
use crate::core::db::Database;
use crate::features::preferences::PreferencesManager;
use serde_json::Value;
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};
use zeroize::Zeroizing;

static APPLICATION: OnceLock<AppHandle> = OnceLock::new();

pub fn initialize(app: &AppHandle) {
    let _ = APPLICATION.set(app.clone());
}

/// None means a legacy identity; Some(None) is a committed removal.
pub fn current(logical: &str) -> Result<Option<Option<Zeroizing<String>>>, String> {
    let Some(app) = APPLICATION.get() else {
        return Ok(None);
    };
    let document = app.state::<PreferencesManager>().read()?;
    let settings = document.settings.ok_or("Preferences are unavailable")?;
    read(app.state::<Database>().inner(), &settings, logical)
}

pub fn read(
    db: &Database,
    settings: &Value,
    logical: &str,
) -> Result<Option<Option<Zeroizing<String>>>, String> {
    let Some(value) = settings
        .get("credentialReferences")
        .and_then(|v| v.get(logical))
    else {
        return Ok(None);
    };
    if value.is_null() {
        return Ok(Some(None));
    }
    let id = value
        .as_str()
        .filter(|id| id.starts_with("txn/") && id.len() == 36)
        .ok_or("Invalid credential reference")?;
    let reference = db
        .get_preference_secret_ref(id)
        .map_err(|_| "Could not read credential reference")?
        .ok_or("Committed credential reference is missing")?;
    super::retrieve_preference_secret(&reference).map(|secret| Some(Some(Zeroizing::new(secret))))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn db() -> Database {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE preference_secret_refs(id TEXT PRIMARY KEY,keychain_ref TEXT NOT NULL);",
        )
        .unwrap();
        Database::from_connection(conn)
    }

    #[test]
    fn committed_removal_does_not_fall_back_to_a_legacy_credential() {
        let db = db();
        assert!(read(&db, &json!({}), "ai/openai").unwrap().is_none());
        let removed = read(
            &db,
            &json!({"credentialReferences":{"ai/openai":null}}),
            "ai/openai",
        )
        .unwrap();
        assert!(removed.is_some());
        assert!(removed.unwrap().is_none());
    }

    #[test]
    fn missing_committed_mapping_fails_instead_of_using_another_generation() {
        let settings =
            json!({"credentialReferences":{"ai/openai":"txn/11111111111111111111111111111111"}});
        assert!(read(&db(), &settings, "ai/openai").is_err());
    }
}
