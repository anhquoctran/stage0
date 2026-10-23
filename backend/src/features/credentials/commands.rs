use crate::core::db::Database;
use crate::features::credentials::{GitCredentialMeta, GitCredentialPreferenceRecord};
use tauri::{AppHandle, Emitter, Manager};
use zeroize::Zeroizing;

fn output_meta(
    record: GitCredentialPreferenceRecord,
    token_ref: Option<String>,
) -> GitCredentialMeta {
    let is_in_keyring = record.source == "system_global"
        || token_ref
            .as_deref()
            .is_some_and(crate::features::credentials::exists_in_keyring);
    GitCredentialMeta {
        id: record.id,
        provider: record.provider,
        server_url: record.server_url,
        account_name: record.account_name,
        token_ref: token_ref.unwrap_or_default(),
        token_type: record.token_type,
        label: record.label,
        source: record.source,
        helper_name: record.helper_name,
        created_at: record.created_at,
        updated_at: record.updated_at,
        is_in_keyring,
    }
}

#[tauri::command]
pub async fn list_git_credentials(app: AppHandle) -> Result<Vec<GitCredentialMeta>, String> {
    let db = app.state::<Database>();
    db.list_git_credential_metadata()
        .map_err(|_| "Git credential metadata could not be loaded from SQLite".to_string())?
        .into_iter()
        .map(|record| {
            let token_ref = db.get_git_credential_token_ref(&record.id).map_err(|_| {
                "Git credential keychain references could not be loaded".to_string()
            })?;
            Ok(output_meta(record, token_ref))
        })
        .collect()
}

#[tauri::command]
pub async fn save_git_credential(
    app: AppHandle,
    payload: crate::features::credentials::SaveGitCredentialPayload,
) -> Result<GitCredentialMeta, String> {
    let crate::features::credentials::SaveGitCredentialPayload {
        provider,
        server_url,
        account_name,
        token_type,
        label,
        secret,
    } = payload;
    let secret = Zeroizing::new(secret);
    if account_name.trim().is_empty() {
        return Err("Account name cannot be empty".into());
    }
    if secret.trim().is_empty() {
        return Err("Secret / token cannot be empty".into());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let token_ref = format!("st0_tok_{}", uuid::Uuid::new_v4().simple());
    crate::features::credentials::store_secret(&token_ref, secret.trim())?;

    let now = chrono::Utc::now().to_rfc3339();
    let record = GitCredentialPreferenceRecord {
        id: id.clone(),
        provider,
        server_url,
        account_name: account_name.trim().to_string(),
        token_type,
        label,
        source: "stage0".into(),
        helper_name: None,
        created_at: now.clone(),
        updated_at: now,
    };
    let db = app.state::<Database>();
    if db.upsert_git_credential(&record, &token_ref).is_err() {
        let _ = crate::features::credentials::delete_secret(&token_ref);
        return Err(
            "Git credential metadata and keychain mapping could not be saved to SQLite".into(),
        );
    }

    let _ = app.emit("git-credentials-updated", ());
    Ok(output_meta(record, Some(token_ref)))
}

#[tauri::command]
pub async fn delete_git_credential(app: AppHandle, id: String) -> Result<(), String> {
    let db = app.state::<Database>();
    let record = db
        .get_git_credential_metadata(&id)
        .map_err(|_| "Credential metadata could not be loaded from SQLite".to_string())?
        .ok_or_else(|| "Credential not found".to_string())?;
    if record.source == "system_global" {
        return Err(
            "This credential is managed by the system/global Git helper and cannot be deleted here."
                .into(),
        );
    }

    let token_ref = db
        .get_git_credential_token_ref(&id)
        .map_err(|_| "Credential keychain mapping could not be loaded".to_string())?;
    let previous_secret = token_ref
        .as_deref()
        .and_then(|reference| crate::features::credentials::retrieve_secret(reference).ok())
        .map(Zeroizing::new);
    if let Some(reference) = token_ref.as_deref() {
        crate::features::credentials::delete_secret(reference)?;
    }

    if db.delete_git_credential(&id).is_err() {
        if let (Some(reference), Some(secret)) = (token_ref.as_deref(), previous_secret.as_deref())
        {
            let _ = crate::features::credentials::store_secret(reference, secret);
        }
        return Err(
            "Credential metadata could not be removed from SQLite; the keychain entry was restored where possible."
                .into(),
        );
    }

    let _ = app.emit("git-credentials-updated", ());
    Ok(())
}

#[tauri::command]
pub async fn verify_git_credential(app: AppHandle, id: String) -> Result<bool, String> {
    let db = app.state::<Database>();
    let token_ref = db
        .get_git_credential_token_ref(&id)
        .map_err(|_| "Credential mapping could not be loaded".to_string())?;
    if let Some(token_ref) = token_ref {
        Ok(crate::features::credentials::exists_in_keyring(&token_ref))
    } else {
        Err("Credential not found".to_string())
    }
}

#[tauri::command]
pub fn get_keyring_info() -> crate::features::credentials::OsKeyringInfo {
    crate::features::credentials::get_os_keyring_info()
}
