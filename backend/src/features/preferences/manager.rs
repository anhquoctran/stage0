use super::jsonc_patch::merge_object;
use super::migration::sanitize_legacy;
use super::preferences_document::{document, document_with_error};
use super::runtime_config::validate_runtime_preferences;
use super::secrets::{reject_git_credentials, reject_secrets};
use super::storage::{
    atomic_write, read_limited, reject_symlink, revision, secure_directory, secure_file,
};
use super::validation::{format_parse_error, parse_and_validate, strict_jsonc_options};
use super::{
    PreferencesDocument, DEFAULT_PREFERENCES, LAST_KNOWN_GOOD_FILE, PREFERENCES_FILE,
    PROCESS_PREFERENCES_WRITE_LOCK,
};
use fs2::FileExt;
use jsonc_parser::{cst::CstRootNode, parse_to_serde_value};
use serde_json::Value;
use std::fs::{self, OpenOptions};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct PreferencesManager {
    directory: PathBuf,
    write_lock: Mutex<()>,
}

impl PreferencesManager {
    pub fn new(directory: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&directory)
            .map_err(|_| "Could not prepare the preferences directory".to_string())?;
        reject_symlink(&directory)?;
        secure_directory(&directory)?;
        Ok(Self {
            directory,
            write_lock: Mutex::new(()),
        })
    }

    fn file_path(&self) -> PathBuf {
        self.directory.join(PREFERENCES_FILE)
    }

    /// Serializes writers across Stage0 processes. The OS releases this lock if
    /// a process exits unexpectedly, unlike an application-managed lockfile.
    fn acquire_process_lock(&self) -> Result<std::fs::File, String> {
        let path = self.directory.join(".preferences.json.lock");
        reject_symlink(&path)?;
        let file = OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .open(&path)
            .map_err(|_| "Could not open the preferences write lock".to_string())?;
        secure_file(&path)
            .map_err(|_| "Could not secure the preferences write lock".to_string())?;
        FileExt::lock_exclusive(&file)
            .map_err(|_| "Could not acquire the preferences write lock".to_string())?;
        Ok(file)
    }

    pub fn initialize(
        &self,
        legacy: Value,
        legacy_git: Option<(String, String)>,
    ) -> Result<PreferencesDocument, String> {
        let _guard = self
            .write_lock
            .lock()
            .map_err(|_| "Preferences service is unavailable".to_string())?;
        let _process_guard = PROCESS_PREFERENCES_WRITE_LOCK
            .lock()
            .map_err(|_| "Preferences service is unavailable".to_string())?;
        let _process_lock = self.acquire_process_lock()?;
        let path = self.file_path();
        reject_symlink(&path)?;
        if path.exists() {
            return self.read();
        }

        parse_and_validate(DEFAULT_PREFERENCES)?;
        let root = CstRootNode::parse(DEFAULT_PREFERENCES, &strict_jsonc_options())
            .map_err(|error| format_parse_error(&error))?;
        let root_object = root
            .object_value()
            .ok_or_else(|| "Packaged preferences defaults are invalid".to_string())?;
        let mut migrated = sanitize_legacy(legacy);
        if let Some((id, binary_path)) = legacy_git {
            migrated.insert(
                "git".into(),
                serde_json::json!({ "binaryId": id, "binaryPath": binary_path }),
            );
        }
        let (content, value) = match (|| -> Result<(String, Value), String> {
            merge_object(&root_object, &migrated)?;
            let content = root.to_string();
            let value = parse_and_validate(&content)?;
            Ok((content, value))
        })() {
            Ok(result) => result,
            Err(_) => {
                let default_content = DEFAULT_PREFERENCES.to_string();
                let default_value = parse_and_validate(&default_content)?;
                (default_content, default_value)
            }
        };
        atomic_write(&path, content.as_bytes())?;
        Ok(document(path, content, true, value))
    }

    pub fn read(&self) -> Result<PreferencesDocument, String> {
        let path = self.file_path();
        reject_symlink(&path)?;
        if !path.exists() {
            return self.initialize(Value::Null, None);
        }
        let content = read_limited(&path)?;
        match parse_and_validate(&content) {
            Ok(settings) => Ok(document(path, content, false, settings)),
            Err(error) => {
                let settings = self.recovery_settings();
                Ok(document_with_error(path, content, settings, error))
            }
        }
    }

    pub fn legacy_git_credentials(&self) -> Result<(Option<Vec<Value>>, String), String> {
        let path = self.file_path();
        reject_symlink(&path)?;
        if !path.exists() {
            return Ok((None, String::new()));
        }
        let content = read_limited(&path)?;
        let value: Value = parse_to_serde_value(&content, &strict_jsonc_options())
            .map_err(|error| format_parse_error(&error))?;
        let mut found = false;
        let mut credentials = Vec::new();
        if let Some(object) = value.as_object() {
            for (key, value) in object {
                if key.eq_ignore_ascii_case("gitCredentials") {
                    found = true;
                    if let Some(records) = value.as_array() {
                        credentials.extend(records.iter().cloned());
                    }
                }
            }
        }
        Ok((found.then_some(credentials), revision(&content)))
    }

    pub fn remove_legacy_git_credentials(
        &self,
        expected_revision: String,
    ) -> Result<PreferencesDocument, String> {
        let _guard = self
            .write_lock
            .lock()
            .map_err(|_| "Preferences service is unavailable".to_string())?;
        let _process_guard = PROCESS_PREFERENCES_WRITE_LOCK
            .lock()
            .map_err(|_| "Preferences service is unavailable".to_string())?;
        let _process_lock = self.acquire_process_lock()?;
        let path = self.file_path();
        reject_symlink(&path)?;
        let current = read_limited(&path)?;
        if revision(&current) != expected_revision {
            return Err(
                "Preferences changed while Git credentials were being migrated. Retry the migration."
                    .into(),
            );
        }
        let root = CstRootNode::parse(&current, &strict_jsonc_options())
            .map_err(|error| format_parse_error(&error))?;
        let properties = root
            .object_value()
            .map(|object| object.properties())
            .unwrap_or_default();
        let mut removed = false;
        for property in properties {
            let is_git_credentials = property
                .name()
                .and_then(|name| name.decoded_value().ok())
                .is_some_and(|name| name.eq_ignore_ascii_case("gitCredentials"));
            if is_git_credentials {
                property.remove();
                removed = true;
            }
        }
        if !removed {
            let settings = parse_and_validate(&current)?;
            return Ok(document(path, current, false, settings));
        }

        let content = root.to_string();
        let parsed = parse_and_validate(&content);
        if parse_and_validate(&current).is_ok() {
            atomic_write(
                &self.directory.join(LAST_KNOWN_GOOD_FILE),
                current.as_bytes(),
            )?;
        }
        atomic_write(&path, content.as_bytes())?;
        let settings = match parsed {
            Ok(settings) => {
                let _ = atomic_write(
                    &self.directory.join(LAST_KNOWN_GOOD_FILE),
                    content.as_bytes(),
                );
                settings
            }
            Err(error) => {
                let recovery = self.recovery_settings();
                return Ok(document_with_error(path, content, recovery, error));
            }
        };
        Ok(document(path, content, false, settings))
    }

    fn recovery_settings(&self) -> Value {
        let backup = self.directory.join(LAST_KNOWN_GOOD_FILE);
        let _ = reject_symlink(&backup);
        if let Ok(content) = read_limited(&backup) {
            if let Ok(settings) = parse_and_validate(&content) {
                return settings;
            }
        }
        parse_and_validate(DEFAULT_PREFERENCES).unwrap_or(Value::Null)
    }

    pub fn save(
        &self,
        content: String,
        expected_revision: String,
    ) -> Result<PreferencesDocument, String> {
        let value = parse_and_validate(&content)?;
        reject_git_credentials(&value, "")?;
        reject_secrets(&value, "")?;
        let _guard = self
            .write_lock
            .lock()
            .map_err(|_| "Preferences service is unavailable".to_string())?;
        let _process_guard = PROCESS_PREFERENCES_WRITE_LOCK
            .lock()
            .map_err(|_| "Preferences service is unavailable".to_string())?;
        let _process_lock = self.acquire_process_lock()?;
        let path = self.file_path();
        reject_symlink(&path)?;
        let current = read_limited(&path)?;
        if revision(&current) != expected_revision {
            return Err(
                "Preferences changed outside this editor. Reload the latest file before saving."
                    .into(),
            );
        }
        // Invalid drafts never reach disk. Keep the last valid file as a recovery copy.
        if parse_and_validate(&current).is_ok() {
            atomic_write(
                &self.directory.join(LAST_KNOWN_GOOD_FILE),
                current.as_bytes(),
            )?;
        }
        atomic_write(&path, content.as_bytes())?;
        // Refresh the recovery copy after the primary write succeeds. If that
        // secondary write fails, the previous valid recovery copy is retained.
        let _ = atomic_write(
            &self.directory.join(LAST_KNOWN_GOOD_FILE),
            content.as_bytes(),
        );
        Ok(document(path, content, false, value))
    }

    pub fn patch(
        &self,
        patch: Value,
        expected_revision: String,
    ) -> Result<PreferencesDocument, String> {
        if !patch.is_object() {
            return Err("Preferences updates must be a JSON object".into());
        }
        reject_git_credentials(&patch, "")?;
        let _guard = self
            .write_lock
            .lock()
            .map_err(|_| "Preferences service is unavailable".to_string())?;
        let _process_guard = PROCESS_PREFERENCES_WRITE_LOCK
            .lock()
            .map_err(|_| "Preferences service is unavailable".to_string())?;
        let _process_lock = self.acquire_process_lock()?;
        let path = self.file_path();
        reject_symlink(&path)?;
        if !path.exists() {
            atomic_write(&path, DEFAULT_PREFERENCES.as_bytes())?;
        }
        let current = read_limited(&path)?;
        if !expected_revision.is_empty() && revision(&current) != expected_revision {
            return Err("Preferences changed outside Stage0. Reload the latest file before applying settings.".into());
        }
        let root = CstRootNode::parse(&current, &strict_jsonc_options())
            .map_err(|error| format_parse_error(&error))?;
        let object = root
            .object_value()
            .ok_or_else(|| "Preferences root must be an object".to_string())?;
        merge_object(&object, patch.as_object().unwrap())?;
        let content = root.to_string();
        let value = parse_and_validate(&content)?;
        reject_git_credentials(&value, "")?;
        reject_secrets(&value, "")?;
        if patch.get("git").is_some() {
            validate_runtime_preferences(&value)?;
        }
        atomic_write(
            &self.directory.join(LAST_KNOWN_GOOD_FILE),
            current.as_bytes(),
        )?;
        atomic_write(&path, content.as_bytes())?;
        let _ = atomic_write(
            &self.directory.join(LAST_KNOWN_GOOD_FILE),
            content.as_bytes(),
        );
        Ok(document(path, content, false, value))
    }

    pub fn reset(&self) -> Result<PreferencesDocument, String> {
        let value = parse_and_validate(DEFAULT_PREFERENCES)?;
        let _guard = self
            .write_lock
            .lock()
            .map_err(|_| "Preferences service is unavailable".to_string())?;
        let _process_guard = PROCESS_PREFERENCES_WRITE_LOCK
            .lock()
            .map_err(|_| "Preferences service is unavailable".to_string())?;
        let _process_lock = self.acquire_process_lock()?;
        let path = self.file_path();
        reject_symlink(&path)?;
        if path.exists() {
            let current = read_limited(&path)?;
            if parse_and_validate(&current).is_ok() {
                atomic_write(
                    &self.directory.join(LAST_KNOWN_GOOD_FILE),
                    current.as_bytes(),
                )?;
            }
        }
        atomic_write(&path, DEFAULT_PREFERENCES.as_bytes())?;
        let _ = atomic_write(
            &self.directory.join(LAST_KNOWN_GOOD_FILE),
            DEFAULT_PREFERENCES.as_bytes(),
        );
        Ok(document(
            path,
            DEFAULT_PREFERENCES.to_string(),
            false,
            value,
        ))
    }
}
