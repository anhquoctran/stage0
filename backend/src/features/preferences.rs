use fs2::FileExt;
use jsonc_parser::cst::{CstInputValue, CstObject, CstRootNode};
use jsonc_parser::{parse_to_serde_value, ParseOptions};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

mod preferences_document;
pub use preferences_document::PreferencesDocument;

const DEFAULT_PREFERENCES: &str = include_str!("../../resources/default_preferences.jsonc");
const PREFERENCES_FILE: &str = "preferences.json";
const LAST_KNOWN_GOOD_FILE: &str = "preferences.json.last-known-good";
const MAX_PREFERENCES_BYTES: usize = 2 * 1024 * 1024;
const MAX_JSON_DEPTH: usize = 64;
const SUPPORTED_SCHEMA_VERSION: u64 = 1;
static PROCESS_PREFERENCES_WRITE_LOCK: Mutex<()> = Mutex::new(());

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
        merge_object(&root_object, &migrated)?;
        let content = root.to_string();
        let value = parse_and_validate(&content)?;
        atomic_write(&path, content.as_bytes())?;
        Ok(document(path, content, true, value))
    }

    pub fn read(&self) -> Result<PreferencesDocument, String> {
        let path = self.file_path();
        reject_symlink(&path)?;
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
        let current = read_limited(&path)?;
        if revision(&current) != expected_revision {
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

fn document(path: PathBuf, content: String, migrated: bool, _value: Value) -> PreferencesDocument {
    let settings = (!_value.is_null()).then_some(_value);
    PreferencesDocument {
        revision: revision(&content),
        content,
        path: path.display().to_string(),
        migrated,
        settings,
        validation_error: None,
    }
}

fn document_with_error(
    path: PathBuf,
    content: String,
    settings: Value,
    error: String,
) -> PreferencesDocument {
    PreferencesDocument {
        revision: revision(&content),
        content,
        path: path.display().to_string(),
        migrated: false,
        settings: (!settings.is_null()).then_some(settings),
        validation_error: Some(error),
    }
}

fn validate_runtime_preferences(settings: &Value) -> Result<(), String> {
    if let Some(kind) = settings.pointer("/sandbox/type") {
        serde_json::from_value::<crate::features::sandbox::SandboxType>(kind.clone())
            .map_err(|_| "Unsupported sandbox type in preferences.json".to_string())?;
    }
    if let Some(policy) = settings.pointer("/ai/guardrailPolicy") {
        serde_json::from_value::<crate::features::sandbox::GuardrailPolicy>(policy.clone())
            .map_err(|_| "Invalid AI guardrail policy in preferences.json".to_string())?;
    }
    if let Some(path) = settings.pointer("/git/binaryPath").and_then(Value::as_str) {
        if path.trim().is_empty() || path.len() > 4096 {
            return Err("Git binary path is empty or too long".into());
        }
        if path != "git" && path != "system" {
            crate::features::git::test_git_version(path).map_err(|_| {
                "Selected Git executable is invalid. Preferences were not saved.".to_string()
            })?;
        }
    }
    Ok(())
}

fn apply_runtime_preferences(app: &AppHandle, settings: &Value) {
    if let Some(kind) = settings.pointer("/sandbox/type") {
        if let Ok(adapter) =
            serde_json::from_value::<crate::features::sandbox::SandboxType>(kind.clone())
        {
            app.state::<crate::features::sandbox::SandboxManager>()
                .set_active_type(adapter);
        }
    }
    if let Some(policy) = settings.pointer("/ai/guardrailPolicy") {
        if let Ok(policy) =
            serde_json::from_value::<crate::features::sandbox::GuardrailPolicy>(policy.clone())
        {
            app.state::<crate::features::sandbox::SandboxManager>()
                .update_guardrail_policy(policy);
        }
    }
    if let Some(path) = settings.pointer("/git/binaryPath").and_then(Value::as_str) {
        if path == "git" || path == "system" {
            crate::features::git::runner::set_active_git_path(None);
        } else if crate::features::git::test_git_version(path).is_ok() {
            crate::features::git::runner::set_active_git_path(Some(path.to_string()));
        } else {
            crate::features::git::runner::set_active_git_path(None);
        }
    }
}

fn strict_jsonc_options() -> ParseOptions {
    ParseOptions {
        allow_comments: true,
        allow_loose_object_property_names: false,
        allow_trailing_commas: true,
        allow_missing_commas: false,
        allow_single_quoted_strings: false,
        allow_hexadecimal_numbers: false,
        allow_unary_plus_numbers: false,
        allow_bare_decimal_point_numbers: false,
        allow_non_finite_numbers: false,
        allow_extended_string_escapes: false,
    }
}

fn parse_and_validate(content: &str) -> Result<Value, String> {
    if content.len() > MAX_PREFERENCES_BYTES {
        return Err("Preferences file is too large (maximum 2 MiB)".into());
    }
    let value: Value = parse_to_serde_value(content, &strict_jsonc_options())
        .map_err(|error| format_parse_error(&error))?;
    if !value.is_object() {
        return Err("Preferences JSONC must contain a top-level object".into());
    }
    if depth(&value, 0) > MAX_JSON_DEPTH {
        return Err("Preferences JSONC exceeds the maximum nesting depth of 64".into());
    }
    let version = value
        .get("schemaVersion")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Preferences must include an integer schemaVersion".to_string())?;
    if version > SUPPORTED_SCHEMA_VERSION {
        return Err(format!("Preferences schema version {version} is newer than this Stage0 build supports. The file was left unchanged."));
    }
    if version == 0 {
        return Err("Preferences schemaVersion must be at least 1".into());
    }
    for key in [
        "general",
        "appearance",
        "ai",
        "reviewers",
        "sandbox",
        "git",
        "notifications",
    ] {
        if value.get(key).is_none() {
            return Err(format!("Preferences are missing required field '{key}'"));
        }
    }
    validate_schema(&value)?;
    reject_secrets(&value, "")?;
    Ok(value)
}

fn validate_schema(value: &Value) -> Result<(), String> {
    let general = object_section(value, "general")?;
    validate_optional_bool(general, "showInlineBlame", "general")?;
    validate_optional_bool(general, "streamResponse", "general")?;
    validate_optional_bool(general, "enableCodeReviewAssist", "general")?;

    let appearance = object_section(value, "appearance")?;
    if let Some(theme) = appearance.get("themeMode") {
        if !matches!(theme.as_str(), Some("system" | "dark" | "light")) {
            return Err("appearance.themeMode must be 'system', 'dark', or 'light'".into());
        }
    }
    if let Some(font) = appearance.get("viewerFont") {
        let font = font
            .as_object()
            .ok_or("appearance.viewerFont must be an object")?;
        validate_optional_string(font, "fontFamily", "appearance.viewerFont", 128, false)?;
        validate_optional_number(font, "fontSize", "appearance.viewerFont", 6.0, 96.0)?;
        validate_optional_bool(font, "isBold", "appearance.viewerFont")?;
        validate_optional_bool(font, "isItalic", "appearance.viewerFont")?;
        validate_optional_bool(font, "isUnderline", "appearance.viewerFont")?;
        validate_optional_number(font, "lineSpacing", "appearance.viewerFont", 0.5, 4.0)?;
        validate_optional_bool(font, "enableLigatures", "appearance.viewerFont")?;
    }

    let ai = object_section(value, "ai")?;
    if let Some(config) = ai.get("aiConfig") {
        let config = config.as_object().ok_or("ai.aiConfig must be an object")?;
        validate_enum_string(
            config,
            "provider",
            "ai.aiConfig",
            &[
                "openai",
                "anthropic",
                "gemini",
                "xai_grok",
                "github_copilot",
                "ollama",
                "custom",
            ],
        )?;
        validate_optional_enum(
            config,
            "authMode",
            "ai.aiConfig",
            &["api_key", "subscription_oauth", "cli_bridge"],
        )?;
        validate_optional_enum(
            config,
            "cliType",
            "ai.aiConfig",
            &["claude", "gh_copilot", "gcloud", "grok"],
        )?;
        validate_optional_string(config, "model", "ai.aiConfig", 512, false)?;
        validate_optional_string(config, "baseUrl", "ai.aiConfig", 4096, false)?;
        if let Some(api_key) = config.get("apiKey") {
            if api_key.as_str().is_none_or(|key| !key.is_empty()) {
                return Err("ai.aiConfig.apiKey must be omitted or empty; credentials belong in the OS keychain".into());
            }
        }
        validate_optional_number(config, "temperature", "ai.aiConfig", 0.0, 2.0)?;
        validate_optional_enum(
            config,
            "reasoningEffort",
            "ai.aiConfig",
            &["none", "minimal", "low", "medium", "high", "xhigh", "max"],
        )?;
        validate_optional_bool(config, "fastMode", "ai.aiConfig")?;
        validate_optional_integer(config, "maxTokens", "ai.aiConfig", 1, 1_000_000)?;
        validate_optional_string(config, "reviewerInstructions", "ai.aiConfig", 32_000, true)?;
        validate_optional_bool(config, "streamResponse", "ai.aiConfig")?;
        validate_optional_bool(config, "enableCodeReviewAssist", "ai.aiConfig")?;
    }
    if let Some(servers) = ai.get("mcpServers") {
        let servers = servers.as_array().ok_or("ai.mcpServers must be an array")?;
        if servers.len() > 256 {
            return Err("ai.mcpServers cannot contain more than 256 entries".into());
        }
        for (index, server) in servers.iter().enumerate() {
            validate_mcp_server(server, index)?;
        }
    }
    if let Some(policy) = ai.get("guardrailPolicy") {
        serde_json::from_value::<crate::features::sandbox::GuardrailPolicy>(policy.clone())
            .map_err(|_| {
                "ai.guardrailPolicy does not match the supported policy schema".to_string()
            })?;
    }

    let reviewers = value["reviewers"]
        .as_array()
        .ok_or("reviewers must be an array")?;
    if reviewers.len() > 256 {
        return Err("reviewers cannot contain more than 256 entries".into());
    }
    for (index, reviewer) in reviewers.iter().enumerate() {
        validate_reviewer(reviewer, index)?;
    }

    let sandbox = object_section(value, "sandbox")?;
    if let Some(kind) = sandbox.get("type") {
        serde_json::from_value::<crate::features::sandbox::SandboxType>(kind.clone()).map_err(
            |_| "sandbox.type must be 'in_memory', 'local_worktree', or 'docker'".to_string(),
        )?;
    }

    let git = object_section(value, "git")?;
    validate_optional_string(git, "binaryId", "git", 256, false)?;
    validate_optional_string(git, "binaryPath", "git", 4096, false)?;

    let notifications = object_section(value, "notifications")?;
    if let Some(channels) = notifications.get("channels") {
        let channels = channels
            .as_object()
            .ok_or("notifications.channels must be an object")?;
        validate_optional_bool(channels, "aiReview", "notifications.channels")?;
        validate_optional_bool(channels, "gitSync", "notifications.channels")?;
        validate_optional_bool(channels, "guardrails", "notifications.channels")?;
    }

    if let Some(credentials) = value.get("gitCredentials") {
        let credentials = credentials
            .as_array()
            .ok_or("gitCredentials must be an array")?;
        if credentials.len() > 10_000 {
            return Err("gitCredentials cannot contain more than 10,000 entries".into());
        }
        for (index, credential) in credentials.iter().enumerate() {
            validate_git_credential(credential, index)?;
        }
    }
    Ok(())
}

fn object_section<'a>(value: &'a Value, name: &str) -> Result<&'a Map<String, Value>, String> {
    value
        .get(name)
        .and_then(Value::as_object)
        .ok_or_else(|| format!("{name} must be an object"))
}

fn validate_optional_bool(
    object: &Map<String, Value>,
    key: &str,
    path: &str,
) -> Result<(), String> {
    if object.get(key).is_some_and(|value| !value.is_boolean()) {
        return Err(format!("{path}.{key} must be a boolean"));
    }
    Ok(())
}

fn validate_optional_string(
    object: &Map<String, Value>,
    key: &str,
    path: &str,
    max: usize,
    allow_empty: bool,
) -> Result<(), String> {
    if let Some(value) = object.get(key) {
        let text = value
            .as_str()
            .ok_or_else(|| format!("{path}.{key} must be a string"))?;
        if text.len() > max || (!allow_empty && text.trim().is_empty()) {
            return Err(format!(
                "{path}.{key} is empty or exceeds the {max}-character limit"
            ));
        }
    }
    Ok(())
}

fn validate_optional_number(
    object: &Map<String, Value>,
    key: &str,
    path: &str,
    min: f64,
    max: f64,
) -> Result<(), String> {
    if let Some(value) = object.get(key) {
        let number = value
            .as_f64()
            .ok_or_else(|| format!("{path}.{key} must be a number"))?;
        if !number.is_finite() || number < min || number > max {
            return Err(format!("{path}.{key} must be between {min} and {max}"));
        }
    }
    Ok(())
}

fn validate_optional_integer(
    object: &Map<String, Value>,
    key: &str,
    path: &str,
    min: u64,
    max: u64,
) -> Result<(), String> {
    if let Some(value) = object.get(key) {
        let number = value
            .as_u64()
            .ok_or_else(|| format!("{path}.{key} must be a positive integer"))?;
        if number < min || number > max {
            return Err(format!("{path}.{key} must be between {min} and {max}"));
        }
    }
    Ok(())
}

fn validate_optional_enum(
    object: &Map<String, Value>,
    key: &str,
    path: &str,
    values: &[&str],
) -> Result<(), String> {
    if object.contains_key(key) {
        validate_enum_string(object, key, path, values)?;
    }
    Ok(())
}

fn validate_enum_string(
    object: &Map<String, Value>,
    key: &str,
    path: &str,
    values: &[&str],
) -> Result<(), String> {
    let value = object
        .get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("{path}.{key} must be a string"))?;
    if !values.contains(&value) {
        return Err(format!("{path}.{key} has an unsupported value"));
    }
    Ok(())
}

fn validate_string_array(
    value: &Value,
    path: &str,
    max_items: usize,
    max_item_len: usize,
) -> Result<(), String> {
    let values = value
        .as_array()
        .ok_or_else(|| format!("{path} must be an array of strings"))?;
    if values.len() > max_items {
        return Err(format!("{path} has too many entries"));
    }
    for item in values {
        let text = item
            .as_str()
            .ok_or_else(|| format!("{path} must contain only strings"))?;
        if text.len() > max_item_len {
            return Err(format!("An entry in {path} exceeds its length limit"));
        }
    }
    Ok(())
}

fn validate_mcp_server(value: &Value, index: usize) -> Result<(), String> {
    let path = format!("ai.mcpServers[{index}]");
    let server = value
        .as_object()
        .ok_or_else(|| format!("{path} must be an object"))?;
    for key in ["id", "name", "type", "command", "args", "env", "enabled"] {
        if !server.contains_key(key) {
            return Err(format!("{path}.{key} is required"));
        }
    }
    validate_optional_string(server, "id", &path, 256, false)?;
    validate_optional_string(server, "name", &path, 256, false)?;
    validate_optional_string(server, "description", &path, 8_000, true)?;
    validate_enum_string(server, "type", &path, &["stdio", "http", "sse"])?;
    validate_optional_string(server, "command", &path, 4096, true)?;
    if server.get("type").and_then(Value::as_str) == Some("stdio")
        && server
            .get("command")
            .and_then(Value::as_str)
            .is_none_or(str::is_empty)
    {
        return Err(format!("{path}.command is required for stdio servers"));
    }
    validate_string_array(&server["args"], &format!("{path}.args"), 256, 8192)?;
    validate_optional_bool(server, "enabled", &path)?;
    let env = server["env"]
        .as_object()
        .ok_or_else(|| format!("{path}.env must be an object"))?;
    if env.len() > 256 {
        return Err(format!("{path}.env has too many entries"));
    }
    for (name, value) in env {
        let text = value.as_str().ok_or_else(|| {
            format!("{path}.env entries must be strings within the supported size limit")
        })?;
        if name.len() > 256 || text.len() > 16_384 {
            return Err(format!(
                "{path}.env entries must be strings within the supported size limit"
            ));
        }
        if is_secret_env_name(name) && !text.is_empty() || looks_like_secret(text) {
            return Err(format!("{path}.env.{name} appears to contain a secret; store it in the OS keychain before saving preferences"));
        }
    }
    if let Some(secret_env_keys) = server.get("secretEnvKeys") {
        validate_string_array(
            secret_env_keys,
            &format!("{path}.secretEnvKeys"),
            256,
            256,
        )?;
        let mut names = std::collections::HashSet::new();
        for item in secret_env_keys.as_array().into_iter().flatten() {
            let name = item.as_str().unwrap_or_default();
            if !valid_env_name(name) || !names.insert(name) {
                return Err(format!("{path}.secretEnvKeys contains an invalid or duplicate environment variable name"));
            }
        }
    }
    validate_optional_string(server, "url", &path, 8192, false)?;
    validate_optional_string(server, "cwd", &path, 4096, false)?;
    if matches!(
        server.get("type").and_then(Value::as_str),
        Some("http" | "sse")
    ) && server.get("url").and_then(Value::as_str).is_none()
    {
        return Err(format!("{path}.url is required for HTTP/SSE servers"));
    }
    Ok(())
}

fn is_secret_env_name(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    name.contains("token")
        || name.contains("secret")
        || name.contains("password")
        || name.contains("credential")
        || name.contains("key")
}

fn valid_env_name(name: &str) -> bool {
    let mut chars = name.chars();
    matches!(chars.next(), Some(first) if first == '_' || first.is_ascii_alphabetic())
        && chars.all(|ch| ch == '_' || ch.is_ascii_alphanumeric())
}

fn validate_reviewer(value: &Value, index: usize) -> Result<(), String> {
    let path = format!("reviewers[{index}]");
    let reviewer = value
        .as_object()
        .ok_or_else(|| format!("{path} must be an object"))?;
    for key in [
        "id",
        "name",
        "tagline",
        "description",
        "category",
        "avatarEmoji",
        "customInstructions",
        "enabled",
    ] {
        if !reviewer.contains_key(key) {
            return Err(format!("{path}.{key} is required"));
        }
    }
    for key in [
        "id",
        "name",
        "tagline",
        "description",
        "avatarEmoji",
        "customInstructions",
    ] {
        validate_optional_string(
            reviewer,
            key,
            &path,
            if key == "customInstructions" {
                32_000
            } else {
                8_000
            },
            true,
        )?;
    }
    validate_enum_string(
        reviewer,
        "category",
        &path,
        &[
            "security",
            "performance",
            "architecture",
            "style",
            "test",
            "documentation",
            "custom",
        ],
    )?;
    validate_optional_bool(reviewer, "enabled", &path)?;
    validate_optional_string(reviewer, "provider", &path, 128, false)?;
    validate_optional_string(reviewer, "model", &path, 512, false)?;
    validate_optional_number(reviewer, "temperature", &path, 0.0, 2.0)?;
    validate_optional_enum(
        reviewer,
        "reasoningEffort",
        &path,
        &["none", "minimal", "low", "medium", "high", "xhigh", "max"],
    )?;
    validate_optional_bool(reviewer, "fastMode", &path)?;
    validate_optional_bool(reviewer, "isBuiltin", &path)?;
    Ok(())
}

fn validate_git_credential(value: &Value, index: usize) -> Result<(), String> {
    let path = format!("gitCredentials[{index}]");
    let credential = value
        .as_object()
        .ok_or_else(|| format!("{path} must be an object"))?;
    for key in [
        "id",
        "provider",
        "server_url",
        "account_name",
        "token_type",
        "source",
        "created_at",
        "updated_at",
    ] {
        validate_optional_string(credential, key, &path, 4096, false)?;
        if !credential.contains_key(key) {
            return Err(format!("{path}.{key} is required"));
        }
    }
    for key in ["label", "helper_name"] {
        if let Some(value) = credential.get(key) {
            if !value.is_null() {
                validate_optional_string(credential, key, &path, 4096, true)?;
            }
        }
    }
    Ok(())
}

fn format_parse_error(error: &jsonc_parser::errors::ParseError) -> String {
    format!(
        "Invalid JSONC at line {}, column {}: {}",
        error.line_display(),
        error.column_display(),
        error.kind()
    )
}

fn depth(value: &Value, level: usize) -> usize {
    match value {
        Value::Array(items) => items
            .iter()
            .map(|item| depth(item, level + 1))
            .max()
            .unwrap_or(level),
        Value::Object(items) => items
            .values()
            .map(|item| depth(item, level + 1))
            .max()
            .unwrap_or(level),
        _ => level,
    }
}

fn reject_secrets(value: &Value, path: &str) -> Result<(), String> {
    match value {
        Value::Object(items) => {
            for (key, child) in items {
                let lower = key.to_ascii_lowercase();
                if matches!(
                    lower.as_str(),
                    "token_ref" | "tokenref" | "is_in_keyring" | "isinkeyring" | "systemprompt"
                ) {
                    return Err(format!("Field '{}{}' is runtime or keychain metadata and is not allowed in preferences.json.", path, key));
                }
                let is_secret_field = matches!(
                    lower.as_str(),
                    "apikey"
                        | "api_key"
                        | "clientsecret"
                        | "client_secret"
                        | "accesstoken"
                        | "access_token"
                        | "refreshtoken"
                        | "refresh_token"
                        | "password"
                        | "secretvalue"
                        | "secret_value"
                );
                if is_secret_field && !child.as_str().unwrap_or_default().is_empty() {
                    return Err(format!("Secret value at '{}{}' cannot be stored in preferences.json. Store it in the OS keychain and reference it by ID.", path, key));
                }
                let next = if path.is_empty() {
                    format!("{key}.")
                } else {
                    format!("{path}{key}.")
                };
                reject_secrets(child, &next)?;
            }
        }
        Value::Array(items) => {
            for child in items {
                reject_secrets(child, path)?;
            }
        }
        Value::String(text) if looks_like_secret(text) => {
            return Err(format!(
                "A value at '{}' resembles a credential and cannot be stored in preferences.json.",
                path.trim_end_matches('.')
            ))
        }
        _ => {}
    }
    Ok(())
}

fn reject_git_credentials(value: &Value, path: &str) -> Result<(), String> {
    match value {
        Value::Object(items) => {
            for (key, child) in items {
                if key.eq_ignore_ascii_case("gitCredentials") {
                    return Err(
                        "Git credentials are managed in Preferences and cannot be edited in preferences.json."
                            .into(),
                    );
                }
                let next = if path.is_empty() {
                    format!("{key}.")
                } else {
                    format!("{path}{key}.")
                };
                reject_git_credentials(child, &next)?;
            }
        }
        Value::Array(items) => {
            for child in items {
                reject_git_credentials(child, path)?;
            }
        }
        _ => {}
    }
    Ok(())
}

fn looks_like_secret(value: &str) -> bool {
    ["sk-", "ghp_", "github_pat_", "glpat-", "xoxb-", "xoxp-"]
        .iter()
        .any(|prefix| value.trim().starts_with(prefix))
}

fn sanitize_legacy(value: Value) -> Map<String, Value> {
    let mut out = Map::new();
    let Some(root) = value.as_object() else {
        return out;
    };
    for key in [
        "general",
        "appearance",
        "ai",
        "reviewers",
        "sandbox",
        "git",
        "notifications",
    ] {
        if let Some(value) = root.get(key) {
            out.insert(key.into(), sanitize_value(value));
        }
    }
    out
}

fn sanitize_value(value: &Value) -> Value {
    match value {
        Value::Object(items) => {
            let mut result = Map::new();
            for (key, value) in items {
                let lower = key.to_ascii_lowercase();
                if matches!(
                    lower.as_str(),
                    "apikey"
                        | "api_key"
                        | "clientsecret"
                        | "client_secret"
                        | "accesstoken"
                        | "access_token"
                        | "refreshtoken"
                        | "refresh_token"
                        | "password"
                        | "token"
                        | "token_ref"
                        | "tokenref"
                        | "is_in_keyring"
                        | "isin_keyring"
                        | "systemprompt"
                ) {
                    continue;
                }
                if matches!(
                    key.as_str(),
                    "toolsCount" | "resourcesCount" | "lastTestedAt" | "testStatus" | "testMessage"
                ) {
                    continue;
                }
                if lower == "env" {
                    if let Some(environment) = value.as_object() {
                        let secret_env_keys = environment
                            .iter()
                            .filter(|(name, secret)| {
                                secret.as_str().is_some_and(|text| {
                                    !text.trim().is_empty()
                                        && (is_secret_env_name(name) || looks_like_secret(text))
                                })
                            })
                            .map(|(name, _)| Value::String(name.clone()))
                            .collect::<Vec<_>>();
                        let safe_environment = environment
                            .iter()
                            .filter(|(name, secret)| {
                                !is_secret_env_name(name)
                                    && !secret.as_str().is_some_and(looks_like_secret)
                            })
                            .map(|(name, secret)| (name.clone(), sanitize_value(secret)))
                            .collect();
                        result.insert(key.clone(), Value::Object(safe_environment));
                        if !secret_env_keys.is_empty() {
                            result.insert("secretEnvKeys".into(), Value::Array(secret_env_keys));
                        }
                        continue;
                    }
                }
                result.insert(key.clone(), sanitize_value(value));
            }
            Value::Object(result)
        }
        Value::Array(items) => Value::Array(items.iter().map(sanitize_value).collect()),
        _ => value.clone(),
    }
}

fn merge_object(target: &CstObject, patch: &Map<String, Value>) -> Result<(), String> {
    for (key, value) in patch {
        let converted = to_cst(value)?;
        match (target.get(key), value.as_object()) {
            (Some(prop), Some(nested)) => match prop.value().and_then(|node| node.as_object()) {
                Some(child) => merge_object(&child, nested)?,
                None => prop.set_value(converted),
            },
            (Some(prop), None) => prop.set_value(converted),
            (None, _) => {
                target.append(key, converted);
            }
        }
    }
    Ok(())
}

fn to_cst(value: &Value) -> Result<CstInputValue, String> {
    Ok(match value {
        Value::Null => CstInputValue::Null,
        Value::Bool(value) => CstInputValue::Bool(*value),
        Value::Number(value) => CstInputValue::Number(value.to_string()),
        Value::String(value) => CstInputValue::String(value.clone()),
        Value::Array(values) => {
            CstInputValue::Array(values.iter().map(to_cst).collect::<Result<_, _>>()?)
        }
        Value::Object(values) => CstInputValue::Object(
            values
                .iter()
                .map(|(key, value)| Ok((key.clone(), to_cst(value)?)))
                .collect::<Result<_, String>>()?,
        ),
    })
}

fn revision(text: &str) -> String {
    format!("{:x}", Sha256::digest(text.as_bytes()))
}

fn read_limited(path: &Path) -> Result<String, String> {
    reject_symlink(path)?;
    let metadata =
        fs::metadata(path).map_err(|_| "Preferences file could not be read".to_string())?;
    if metadata.len() as usize > MAX_PREFERENCES_BYTES {
        return Err("Preferences file is too large (maximum 2 MiB)".into());
    }
    fs::read_to_string(path).map_err(|_| "Preferences file is not readable UTF-8 text".to_string())
}

fn reject_symlink(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            Err("Preferences paths cannot be symbolic links".into())
        }
        Ok(_) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("Preferences path could not be inspected".into()),
    }
}

fn secure_directory(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .map_err(|_| "Preferences directory permissions could not be secured".to_string())?;
    }
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

fn secure_file(path: &Path) -> io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    #[cfg(not(unix))]
    let _ = path; // Windows inherits the private ACL from the per-user app-data directory.
    Ok(())
}

fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Invalid preferences path".to_string())?;
    reject_symlink(parent)?;
    reject_symlink(path)?;
    let temp = parent.join(format!(".preferences-{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&temp)
            .map_err(|_| "Could not create a temporary preferences file".to_string())?;
        file.write_all(content)
            .map_err(|_| "Could not write preferences to disk".to_string())?;
        file.sync_all()
            .map_err(|_| "Could not flush preferences to disk".to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&temp, fs::Permissions::from_mode(0o600))
                .map_err(|_| "Preferences file permissions could not be secured".to_string())?;
        }
        #[cfg(windows)]
        {
            use std::os::windows::ffi::OsStrExt;
            use windows_sys::Win32::Storage::FileSystem::{
                MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
            };
            let from: Vec<u16> = temp.as_os_str().encode_wide().chain(Some(0)).collect();
            let to: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
            let moved = unsafe {
                MoveFileExW(
                    from.as_ptr(),
                    to.as_ptr(),
                    MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
                )
            };
            if moved == 0 {
                return Err("Could not atomically replace preferences.json".to_string());
            }
        }
        #[cfg(not(windows))]
        fs::rename(&temp, path)
            .map_err(|_| "Could not atomically replace preferences.json".to_string())?;
        if let Ok(directory) = OpenOptions::new().read(true).open(parent) {
            let _ = directory.sync_all();
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

#[tauri::command]
pub async fn initialize_preferences(
    app: AppHandle,
    legacy: Value,
) -> Result<PreferencesDocument, String> {
    let db = app.state::<crate::core::db::Database>();
    let git = match (
        db.get_setting("git_binary_id"),
        db.get_setting("git_binary_path"),
    ) {
        (Ok(Some(id)), Ok(Some(path))) => Some((id, path)),
        _ => None,
    };
    let legacy_credentials = legacy
        .get("gitCredentials")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let manager = app.state::<PreferencesManager>();
    manager.initialize(legacy, git)?;
    migrate_git_credentials_to_sqlite(&app, legacy_credentials)?;
    let document = manager.read()?;
    if let Some(settings) = document.settings.as_ref() {
        apply_runtime_preferences(&app, settings);
    }
    db.compact_git_credentials_metadata().map_err(|_| {
        "Legacy Git credential references could not be compacted in SQLite".to_string()
    })?;
    db.delete_settings(&["git_binary_id", "git_binary_path"])
        .map_err(|_| "Legacy Git preference values could not be removed from SQLite".to_string())?;
    crate::features::credentials::schedule_system_git_credential_rescan(&app);
    Ok(document)
}

#[tauri::command]
pub async fn load_preferences_json(app: AppHandle) -> Result<PreferencesDocument, String> {
    migrate_git_credentials_to_sqlite(&app, Vec::new())?;
    app.state::<PreferencesManager>().read()
}

fn migrate_git_credentials_to_sqlite(
    app: &AppHandle,
    mut additional_records: Vec<Value>,
) -> Result<(), String> {
    let manager = app.state::<PreferencesManager>();
    let db = app.state::<crate::core::db::Database>();
    let (file_records, revision) = manager.legacy_git_credentials()?;
    let had_file_records = file_records.is_some();
    if let Some(mut file_records) = file_records {
        additional_records.append(&mut file_records);
    }

    for value in additional_records {
        let Ok(record) = serde_json::from_value::<
            crate::features::credentials::GitCredentialPreferenceRecord,
        >(value)
        else {
            // A malformed legacy record is never copied into the database or exposed by the editor.
            continue;
        };
        db.upsert_git_credential_metadata(&record).map_err(|_| {
            "Git credential metadata could not be migrated to SQLite".to_string()
        })?;
    }

    if had_file_records {
        manager.remove_legacy_git_credentials(revision)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn save_preferences_json(
    app: AppHandle,
    content: String,
    expected_revision: String,
) -> Result<PreferencesDocument, String> {
    let settings = parse_and_validate(&content)?;
    reject_git_credentials(&settings, "")?;
    validate_runtime_preferences(&settings)?;
    let saved = app
        .state::<PreferencesManager>()
        .save(content, expected_revision)?;
    apply_runtime_preferences(&app, &settings);
    let _ = app.emit("preferences-changed", saved.revision.clone());
    Ok(saved)
}

#[tauri::command]
pub async fn patch_preferences(
    app: AppHandle,
    patch: Value,
    expected_revision: String,
) -> Result<PreferencesDocument, String> {
    let saved = app
        .state::<PreferencesManager>()
        .patch(patch, expected_revision)?;
    if let Some(settings) = &saved.settings {
        apply_runtime_preferences(&app, settings);
    }
    let _ = app.emit("preferences-changed", saved.revision.clone());
    Ok(saved)
}

#[tauri::command]
pub async fn reset_preferences_json(app: AppHandle) -> Result<PreferencesDocument, String> {
    let saved = app.state::<PreferencesManager>().reset()?;
    if let Some(settings) = &saved.settings {
        apply_runtime_preferences(&app, settings);
    }
    let _ = app.emit("preferences-changed", saved.revision.clone());
    Ok(saved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn cst_patch_preserves_comments_unknown_fields_and_jsonc_format() {
        let source = "{\n  // preserve me\n  \"schemaVersion\": 1,\n  \"general\": {\n    \"showInlineBlame\": true,\n    \"futureOption\": 7,\n  },\n  \"unknown\": \"keep\",\n  \"appearance\": {}, \"ai\": {}, \"reviewers\": [], \"sandbox\": {}, \"git\": {}, \"notifications\": {}, \"gitCredentials\": []\n}";
        let root = CstRootNode::parse(source, &strict_jsonc_options()).unwrap();
        let patch = json!({"general": {"showInlineBlame": false}});
        merge_object(&root.object_value().unwrap(), patch.as_object().unwrap()).unwrap();
        let result = root.to_string();
        assert!(result.contains("// preserve me"));
        assert!(result.contains("\"futureOption\": 7"));
        assert!(result.contains("\"unknown\": \"keep\""));
        assert!(result.contains("\"showInlineBlame\": false"));
    }

    #[test]
    fn strict_jsonc_accepts_comments_and_trailing_commas_but_not_json5() {
        let valid = "{\"schemaVersion\":1, // ok\n \"general\":{},\"appearance\":{},\"ai\":{},\"reviewers\":[],\"sandbox\":{},\"git\":{},\"notifications\":{},\"gitCredentials\":[],}";
        assert!(parse_and_validate(valid).is_ok());
        assert!(CstRootNode::parse("{schemaVersion: 1}", &strict_jsonc_options()).is_err());
        assert!(CstRootNode::parse("{'schemaVersion': 1}", &strict_jsonc_options()).is_err());
    }

    #[test]
    fn schema_validation_rejects_wrong_types_ranges_and_malformed_records() {
        let valid = json!({
            "schemaVersion": 1,
            "general": {"showInlineBlame": true},
            "appearance": {"themeMode": "dark", "viewerFont": {"fontSize": 13}},
            "ai": {"aiConfig": {"provider": "openai", "temperature": 0.2}},
            "reviewers": [],
            "sandbox": {"type": "in_memory"},
            "git": {"binaryPath": "git"},
            "notifications": {"channels": {"gitSync": false}},
            "gitCredentials": []
        });
        assert!(validate_schema(&valid).is_ok());

        let mut wrong_type = valid.clone();
        wrong_type["general"]["showInlineBlame"] = json!("true");
        assert!(validate_schema(&wrong_type).is_err());

        let mut out_of_range = valid.clone();
        out_of_range["ai"]["aiConfig"]["temperature"] = json!(3.0);
        assert!(validate_schema(&out_of_range).is_err());

        let mut malformed_credential = valid;
        malformed_credential["gitCredentials"] = json!([{"id":"credential-1"}]);
        assert!(validate_schema(&malformed_credential).is_err());

        let secret_mcp_env = json!({
            "schemaVersion": 1,
            "general": {}, "appearance": {},
            "ai": {"mcpServers": [{
                "id": "github", "name": "GitHub", "type": "stdio", "command": "npx",
                "args": [], "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "not-written"}, "enabled": true
            }]},
            "reviewers": [], "sandbox": {}, "git": {}, "notifications": {}, "gitCredentials": []
        });
        assert!(validate_schema(&secret_mcp_env).is_err());

        let keychain_backed_mcp_env = json!({
            "schemaVersion": 1,
            "general": {}, "appearance": {},
            "ai": {"mcpServers": [{
                "id": "github", "name": "GitHub", "type": "stdio", "command": "npx",
                "args": [], "env": {}, "secretEnvKeys": ["GITHUB_PERSONAL_ACCESS_TOKEN"], "enabled": true
            }]},
            "reviewers": [], "sandbox": {}, "git": {}, "notifications": {}, "gitCredentials": []
        });
        assert!(validate_schema(&keychain_backed_mcp_env).is_ok());
        let mut duplicate_secret_env_names = keychain_backed_mcp_env.clone();
        duplicate_secret_env_names["ai"]["mcpServers"][0]["secretEnvKeys"] =
            json!(["TOKEN", "TOKEN"]);
        assert!(validate_schema(&duplicate_secret_env_names).is_err());

        let api_key = json!({
            "schemaVersion": 1, "general": {}, "appearance": {},
            "ai": {"aiConfig": {"apiKey": "plaintext"}},
            "reviewers": [], "sandbox": {}, "git": {}, "notifications": {}, "gitCredentials": []
        });
        assert!(validate_schema(&api_key).is_err());
    }

    #[test]
    fn secret_fields_are_rejected_and_migration_removes_them() {
        let secret = json!({ "apiKey": "sk-secret" });
        assert!(reject_secrets(&secret, "").is_err());
        let sanitized =
            sanitize_value(&json!({"apiKey":"secret", "model":"gpt", "nested":{"password":"x"}}));
        assert_eq!(sanitized, json!({"model":"gpt", "nested":{}}));
    }

    #[test]
    fn first_run_migration_keeps_supported_values_and_never_writes_legacy_secrets() {
        let directory = std::env::temp_dir().join(format!(
            "stage0-preferences-migration-{}",
            uuid::Uuid::new_v4()
        ));
        let manager = PreferencesManager::new(directory.clone()).unwrap();
        let legacy = json!({
            "general": {"showInlineBlame": false},
            "ai": {
                "aiConfig": {"provider":"openai", "model":"gpt-custom", "apiKey":"sk-legacy-secret"},
                "mcpServers": [{
                    "id":"github", "name":"GitHub", "type":"stdio", "command":"npx",
                    "args":[], "env":{"GITHUB_TOKEN":"ghp-legacy-secret", "LOG_LEVEL":"debug"}, "enabled":true
                }]
            },
            "reviewers": []
        });

        let migrated = manager.initialize(legacy, None).unwrap();
        let settings = migrated.settings.unwrap();
        assert_eq!(settings["general"]["showInlineBlame"], false);
        assert_eq!(settings["ai"]["aiConfig"]["model"], "gpt-custom");
        assert!(settings["ai"]["aiConfig"].get("apiKey").is_none());
        assert_eq!(settings["ai"]["mcpServers"][0]["env"]["LOG_LEVEL"], "debug");
        assert!(settings["ai"]["mcpServers"][0]["env"]
            .get("GITHUB_TOKEN")
            .is_none());
        assert_eq!(
            settings["ai"]["mcpServers"][0]["secretEnvKeys"],
            json!(["GITHUB_TOKEN"])
        );
        assert!(!migrated.content.contains("sk-legacy-secret"));
        assert!(!migrated.content.contains("ghp-legacy-secret"));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn invalid_file_uses_last_known_good_for_runtime_without_overwriting_editor_text() {
        let directory =
            std::env::temp_dir().join(format!("stage0-preferences-{}", uuid::Uuid::new_v4()));
        let manager = PreferencesManager::new(directory.clone()).unwrap();
        let initial = manager.initialize(Value::Null, None).unwrap();
        let patched = manager
            .patch(
                json!({"general":{"showInlineBlame":false}}),
                initial.revision,
            )
            .unwrap();

        let invalid = "{ not valid JSONC";
        fs::write(directory.join(PREFERENCES_FILE), invalid).unwrap();
        let recovered = manager.read().unwrap();

        assert_eq!(recovered.content, invalid);
        assert!(recovered.validation_error.is_some());
        assert_eq!(
            recovered.settings.as_ref().unwrap()["general"]["showInlineBlame"],
            false
        );
        assert_eq!(
            fs::read_to_string(directory.join(PREFERENCES_FILE)).unwrap(),
            invalid
        );

        let saved = manager
            .save(DEFAULT_PREFERENCES.to_string(), recovered.revision)
            .unwrap();
        assert!(saved.validation_error.is_none());
        assert_eq!(saved.settings.unwrap()["general"]["showInlineBlame"], true);
        assert_ne!(patched.revision, saved.revision);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn concurrent_managers_cannot_overwrite_the_same_revision() {
        use std::sync::{Arc, Barrier};

        let directory =
            std::env::temp_dir().join(format!("stage0-preferences-lock-{}", uuid::Uuid::new_v4()));
        let first_manager = PreferencesManager::new(directory.clone()).unwrap();
        let initial = first_manager.initialize(Value::Null, None).unwrap();
        let second_manager = PreferencesManager::new(directory.clone()).unwrap();
        let barrier = Arc::new(Barrier::new(3));

        let first_barrier = barrier.clone();
        let first_revision = initial.revision.clone();
        let first = std::thread::spawn(move || {
            first_barrier.wait();
            first_manager.patch(json!({"general":{"showInlineBlame":false}}), first_revision)
        });

        let second_barrier = barrier.clone();
        let second_revision = initial.revision;
        let second = std::thread::spawn(move || {
            second_barrier.wait();
            second_manager.patch(json!({"appearance":{"themeMode":"dark"}}), second_revision)
        });

        barrier.wait();
        let results = [first.join().unwrap(), second.join().unwrap()];
        assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
        assert_eq!(
            results
                .iter()
                .filter(|result| result
                    .as_ref()
                    .is_err_and(|error| error.contains("changed outside")))
                .count(),
            1
        );
        let latest = second_manager_for_test(&directory).read().unwrap();
        assert!(matches!(
            latest.settings.unwrap()["general"]["showInlineBlame"].as_bool(),
            Some(false | true)
        ));
        let _ = fs::remove_dir_all(directory);
    }

    fn second_manager_for_test(directory: &Path) -> PreferencesManager {
        PreferencesManager::new(directory.to_path_buf()).unwrap()
    }

    #[test]
    fn revision_is_content_sensitive() {
        assert_ne!(revision("{}"), revision("{ }"));
    }
}
