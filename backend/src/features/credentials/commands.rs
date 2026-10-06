use crate::core::db::Database;
use tauri::{AppHandle, Manager};
use zeroize::Zeroizing;

#[tauri::command]
pub async fn list_git_credentials(
    app: AppHandle,
) -> Result<Vec<crate::features::credentials::GitCredentialMeta>, String> {
    let db = app.state::<Database>();
    db.get_all_git_credentials()
        .map_err(|e| format!("Failed to load git credentials: {}", e))
}

#[tauri::command]
pub async fn save_git_credential(
    app: AppHandle,
    payload: crate::features::credentials::SaveGitCredentialPayload,
) -> Result<crate::features::credentials::GitCredentialMeta, String> {
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
        return Err("Account name cannot be empty".to_string());
    }
    if secret.trim().is_empty() {
        return Err("Secret / token cannot be empty".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let token_ref = format!("st0_tok_{}", uuid::Uuid::new_v4().simple());

    // 1. Store secret in OS Credential Manager
    crate::features::credentials::store_secret(&token_ref, secret.trim())?;

    // 2. Store tokenized record in SQLite
    let db = app.state::<Database>();
    if let Err(e) = db.insert_git_credential(
        &id,
        &provider,
        &server_url,
        account_name.trim(),
        &token_ref,
        &token_type,
        label.as_deref(),
    ) {
        // Rollback keyring secret if db fails
        let _ = crate::features::credentials::delete_secret(&token_ref);
        return Err(format!("Failed to save credential to database: {}", e));
    }

    Ok(crate::features::credentials::GitCredentialMeta {
        id,
        provider,
        server_url,
        account_name,
        token_ref,
        token_type,
        label,
        source: "stage0".to_string(),
        helper_name: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
        is_in_keyring: true,
    })
}

#[tauri::command]
pub async fn delete_git_credential(app: AppHandle, id: String) -> Result<(), String> {
    let db = app.state::<Database>();
    let source = db
        .get_git_credential_source(&id)
        .map_err(|error| format!("Failed to query credential source: {error}"))?;
    if source.as_deref() == Some("system_global") {
        return Err(
            "This credential is managed by the system/global Git helper and cannot be deleted here."
                .to_string(),
        );
    }
    let token_ref = db
        .get_git_credential_token_ref(&id)
        .map_err(|e| format!("Failed to query credential: {}", e))?;
    if let Some(token_ref) = token_ref {
        // Remove the secret first so a database failure can leave only stale
        // metadata, never an orphaned credential that the user thought deleted.
        crate::features::credentials::delete_secret(&token_ref)?;
        db.delete_git_credential(&id)
            .map_err(|e| format!("Failed to delete credential metadata: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn verify_git_credential(app: AppHandle, id: String) -> Result<bool, String> {
    let db = app.state::<Database>();
    let token_ref_opt = db
        .get_git_credential_token_ref(&id)
        .map_err(|e| format!("Failed to query credential: {}", e))?;

    if let Some(token_ref) = token_ref_opt {
        Ok(crate::features::credentials::exists_in_keyring(&token_ref))
    } else {
        Err("Credential not found".to_string())
    }
}

#[tauri::command]
pub fn get_keyring_info() -> crate::features::credentials::OsKeyringInfo {
    crate::features::credentials::get_os_keyring_info()
}
