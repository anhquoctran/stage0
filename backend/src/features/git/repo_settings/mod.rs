//! Repository JSONC is the commit authority. No filesystem/advisory locks.
pub mod commands;
mod document;
mod jsonc;
mod projection;
mod schema;
mod storage;
pub use document::RepositorySettingsDocument;

use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock, Weak};

static GATES: OnceLock<Mutex<HashMap<PathBuf, Weak<Mutex<()>>>>> = OnceLock::new();
static SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn transaction<T>(root: &Path, operation: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
    let gate = {
        let mut gates = GATES
            .get_or_init(Default::default)
            .lock()
            .map_err(|_| "Settings service unavailable")?;
        gates.retain(|_, gate| gate.strong_count() > 0);
        let gate = gates
            .get(root)
            .and_then(Weak::upgrade)
            .unwrap_or_else(|| Arc::new(Mutex::new(())));
        gates.insert(root.to_path_buf(), Arc::downgrade(&gate));
        gate
    };
    let _guard = gate
        .lock()
        .map_err(|_| "Repository transaction unavailable")?;
    operation()
}

fn document(content: String, settings: Value, error: Option<String>) -> RepositorySettingsDocument {
    RepositorySettingsDocument {
        revision: storage::revision(&content),
        content,
        settings,
        publication_sequence: SEQUENCE.fetch_add(1, Ordering::SeqCst) + 1,
        validation_error: error,
        labels: Vec::new(),
    }
}

fn recovery_file(root: &Path, recovery: &Path) -> Result<PathBuf, String> {
    std::fs::create_dir_all(recovery).map_err(|e| e.to_string())?;
    storage::regular(recovery, true)?;
    Ok(recovery.join(format!(
        "{}.jsonc",
        storage::revision(&root.to_string_lossy())
    )))
}

fn default_settings(root: &Path) -> Result<Value, String> {
    let branches = super::branches::list_branches(&root.to_string_lossy())?;
    let base = ["main", "origin/main", "master", "origin/master"]
        .into_iter()
        .find(|name| {
            branches
                .local
                .iter()
                .chain(branches.remote.iter())
                .any(|b| b == name)
        })
        .map(str::to_string)
        .or_else(|| branches.local.first().cloned())
        .unwrap_or("HEAD".into());
    Ok(schema::defaults(&base))
}

fn read_or_initialize(root: &Path) -> Result<String, String> {
    let path = storage::path(root)?;
    if !path.try_exists().map_err(|e| e.to_string())? {
        let content = format!(
            "// Stage0 repository settings. Source-transfer consent is machine-local.\n{}\n",
            serde_json::to_string_pretty(&default_settings(root)?).map_err(|e| e.to_string())?
        );
        jsonc::parse(&content)?;
        storage::initialize(&path, &content)?;
    }
    storage::read(&path)
}

fn load_locked(root: &Path, recovery: &Path) -> Result<RepositorySettingsDocument, String> {
    let content = read_or_initialize(root)?;
    let backup = recovery_file(root, recovery)?;
    match jsonc::parse(&content) {
        Ok(settings) => {
            // A valid externally edited snapshot may become the recovery baseline.
            if storage::read(&backup).ok().as_deref() != Some(&content) {
                storage::write(&backup, &content)?;
            }
            Ok(document(content, settings, None))
        }
        Err(error) => {
            let settings = storage::read(&backup)
                .and_then(|text| jsonc::parse(&text))
                .map_err(|_| {
                    format!(
                        ".stage0/repos.json: {error}. No valid recovery snapshot; repair the file."
                    )
                })?;
            Ok(document(
                content,
                settings,
                Some(format!(".stage0/repos.json: {error}")),
            ))
        }
    }
}

pub fn load(root: &Path, recovery: &Path) -> Result<RepositorySettingsDocument, String> {
    transaction(root, || load_locked(root, recovery))
}

pub fn commit(
    root: &Path,
    recovery: &Path,
    expected_revision: &str,
    patch: &Value,
    publish: impl FnOnce(&RepositorySettingsDocument) -> Result<(), String>,
) -> Result<RepositorySettingsDocument, String> {
    commit_candidate(
        root,
        recovery,
        expected_revision,
        |before| {
            if let Some(error) = &before.validation_error {
                return Err(error.clone());
            }
            jsonc::patch(&before.content, patch)
        },
        publish,
    )
}

pub fn save_source(
    root: &Path,
    recovery: &Path,
    expected_revision: &str,
    content: &str,
    publish: impl FnOnce(&RepositorySettingsDocument) -> Result<(), String>,
) -> Result<RepositorySettingsDocument, String> {
    // Validate before touching disk; unlike a UI patch, a complete document
    // may repair an invalid primary while retaining its exact revision check.
    jsonc::parse(content)?;
    commit_candidate(
        root,
        recovery,
        expected_revision,
        |_| Ok(content.to_string()),
        publish,
    )
}

fn commit_candidate(
    root: &Path,
    recovery: &Path,
    expected_revision: &str,
    prepare: impl FnOnce(&RepositorySettingsDocument) -> Result<String, String>,
    publish: impl FnOnce(&RepositorySettingsDocument) -> Result<(), String>,
) -> Result<RepositorySettingsDocument, String> {
    transaction(root, || {
        let before = load_locked(root, recovery)?;
        if expected_revision.is_empty() || before.revision != expected_revision {
            return Err("Repository settings changed. Reload before saving.".into());
        }
        let content = prepare(&before)?;
        let settings = jsonc::parse(&content)?;
        let path = storage::path(root)?;
        // Editors do not participate in our coordinator. Detect changes again
        // after preparation; the final check/rename race cannot be eliminated
        // without a cooperating cross-process protocol.
        if storage::revision(&storage::read(&path)?) != before.revision {
            return Err(
                "Repository settings changed during preparation. Reload before saving.".into(),
            );
        }
        if let Err(error) = storage::write(&path, &content) {
            if let Ok(actual) = storage::read(&path) {
                if actual != before.content && jsonc::parse(&actual).is_ok() {
                    let current = document(actual.clone(), jsonc::parse(&actual)?, None);
                    let _ = publish(&current);
                    return Err("Repository settings changed on disk; durable completion is uncertain. Reload before retrying.".into());
                }
            }
            return Err(error);
        }
        let saved = document(content, settings, None);
        // Secondary recovery updates are best effort after the commit point.
        if let Ok(backup) = recovery_file(root, recovery) {
            let _ = storage::write(&backup, &saved.content);
        }
        publish(&saved)
            .map_err(|e| format!("Settings committed; runtime projection needs reload: {e}"))?;
        Ok(saved)
    })
}

#[cfg(test)]
mod tests;
