use super::{storage, RepositorySettingsDocument};
use crate::core::db::Database;
use serde_json::{json, Value};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

fn locations(app: &AppHandle, repo_id: &str) -> Result<(PathBuf, PathBuf), String> {
    let path = app.state::<Database>().repository_settings_path(repo_id)?;
    let root = dunce::canonicalize(path).map_err(|e| e.to_string())?;
    storage::regular(&root, true)?;
    // Registered repositories are worktree roots, including linked worktrees.
    if !root.join(".git").try_exists().map_err(|e| e.to_string())? {
        return Err("Not a Git worktree root".into());
    }
    let recovery = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("repo-settings-recovery");
    Ok((root, recovery))
}

fn project(
    app: &AppHandle,
    repo_id: &str,
    document: &mut RepositorySettingsDocument,
) -> Result<(), String> {
    document.labels = app.state::<Database>().project_repository_labels(
        repo_id,
        document.settings["labels"]
            .as_array()
            .ok_or("Invalid labels")?,
    )?;
    Ok(())
}

fn initialize_legacy(
    app: &AppHandle,
    repo_id: &str,
    root: &std::path::Path,
    recovery: &std::path::Path,
) -> Result<(), String> {
    let path = storage::path(root)?;
    if path.try_exists().map_err(|e| e.to_string())? {
        return Ok(());
    }
    // Recovery presence records that this installation already saw the file.
    // Deleting it later creates fresh defaults instead of resurrecting SQLite.
    if super::recovery_file(root, recovery)?
        .try_exists()
        .map_err(|e| e.to_string())?
    {
        return Ok(());
    }
    let db = app.state::<Database>();
    let mut settings = super::default_settings(root)?;
    if let Some(old) = db.get_repo_settings(repo_id).map_err(|e| e.to_string())? {
        settings["defaultBaseBranch"] = json!(old.default_base_branch);
        settings["inheritGlobalAgents"] = json!(old.inherit_global_agents);
        settings["customAgentRules"] = json!(old.custom_agent_rules.unwrap_or_default());
    }
    settings["labels"] = json!(db
        .list_repo_labels(repo_id)
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(
            |l| json!({"id": l.id, "name": l.name, "color": l.color, "description": l.description})
        )
        .collect::<Vec<_>>());
    let content = format!("// Stage0 repository settings. Credentials and source-transfer consent stay machine-local.\n{}\n",
        serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?);
    super::jsonc::parse(&content)?;
    storage::initialize(&path, &content)
}

pub(crate) fn load_document(
    app: &AppHandle,
    repo_id: &str,
) -> Result<RepositorySettingsDocument, String> {
    let (root, recovery) = locations(app, repo_id)?;
    super::transaction(&root, || {
        initialize_legacy(app, repo_id, &root, &recovery)?;
        let mut doc = super::load_locked(&root, &recovery)?;
        project(app, repo_id, &mut doc)?;
        Ok(doc)
    })
}

pub(crate) fn commit_document(
    app: &AppHandle,
    repo_id: &str,
    expected_revision: &str,
    patch: &Value,
) -> Result<RepositorySettingsDocument, String> {
    let (root, recovery) = locations(app, repo_id)?;
    let mut labels = Vec::new();
    let mut saved = super::commit(&root, &recovery, expected_revision, patch, |doc| {
        labels = publish_document(app, repo_id, doc)?;
        Ok(())
    })?;
    saved.labels = labels;
    Ok(saved)
}

fn publish_document(
    app: &AppHandle,
    repo_id: &str,
    doc: &RepositorySettingsDocument,
) -> Result<Vec<crate::features::git::persistence::RepoLabelDb>, String> {
    let labels = app
        .state::<Database>()
        .project_repository_labels(repo_id, doc.settings["labels"].as_array().unwrap())?;
    app.emit(
        "repo-settings-changed",
        json!({"repoId": repo_id, "revision": doc.revision,
        "publicationSequence": doc.publication_sequence}),
    )
    .map_err(|e| e.to_string())?;
    Ok(labels)
}

#[tauri::command]
pub async fn save_repository_settings_document(
    app: AppHandle,
    repo_id: String,
    expected_revision: String,
    content: String,
) -> Result<RepositorySettingsDocument, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (root, recovery) = locations(&app, &repo_id)?;
        let mut labels = Vec::new();
        let mut saved =
            super::save_source(&root, &recovery, &expected_revision, &content, |doc| {
                labels = publish_document(&app, &repo_id, doc)?;
                Ok(())
            })?;
        saved.labels = labels;
        Ok(saved)
    })
    .await
    .map_err(|e| format!("Repository settings worker failed: {e}"))?
    .map_err(|e: String| crate::common::messages::command_error("git", e))
}

#[tauri::command]
pub async fn get_repository_settings_document(
    app: AppHandle,
    repo_id: String,
) -> Result<RepositorySettingsDocument, String> {
    tauri::async_runtime::spawn_blocking(move || load_document(&app, &repo_id))
        .await
        .map_err(|e| format!("Repository settings worker failed: {e}"))?
        .map_err(|e| crate::common::messages::command_error("git", e))
}

#[tauri::command]
pub async fn commit_repository_settings(
    app: AppHandle,
    repo_id: String,
    expected_revision: String,
    patch: Value,
) -> Result<RepositorySettingsDocument, String> {
    // Worker owns its transaction even if its IPC waiter is cancelled.
    tauri::async_runtime::spawn_blocking(move || {
        commit_document(&app, &repo_id, &expected_revision, &patch)
    })
    .await
    .map_err(|e| format!("Repository settings worker failed: {e}"))?
    .map_err(|e| crate::common::messages::command_error("git", e))
}

pub(crate) async fn mutate_legacy_label(
    app: AppHandle,
    label: Option<crate::features::git::persistence::RepoLabelDb>,
    delete_id: Option<String>,
    expected: Option<String>,
) -> Result<(), String> {
    let expected = expected.ok_or("A repository settings revision is required")?;
    tauri::async_runtime::spawn_blocking(move || {
        let repo_id = if let Some(label) = &label { label.repo_id.clone() } else {
            app.state::<Database>().conn().query_row("SELECT repo_id FROM repo_labels WHERE id=?1", [delete_id.as_deref().unwrap_or("")], |r| r.get::<_, String>(0))
                .map_err(|e| e.to_string())?
        };
        let doc = load_document(&app, &repo_id)?;
        let mut labels = doc.settings["labels"].as_array().unwrap().clone();
        let requested = label.as_ref().map(|l| l.id.as_str()).or(delete_id.as_deref()).unwrap_or("");
        let position = doc.labels.iter().position(|l| l.id == requested);
        if let Some(label) = label {
            let id = position.map(|i| labels[i]["id"].as_str().unwrap().to_string()).unwrap_or(label.id);
            let value = json!({"id": id, "name": label.name, "color": label.color, "description": label.description});
            if let Some(i) = position { labels[i] = value; } else { labels.push(value); }
        } else if let Some(i) = position { labels.remove(i); } else { return Err("Label not found".into()); }
        commit_document(&app, &repo_id, &expected, &json!({"labels": labels}))?;
        Ok(())
    }).await.map_err(|e| e.to_string())?
}
