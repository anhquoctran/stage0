//! JSONC preferences: a stable facade over validation, storage and IPC modules.
mod commands;
mod fonts;
mod jsonc_patch;
mod manager;
mod migration;
mod preferences_document;
mod runtime_config;
mod schema;
mod secrets;
mod storage;
mod supported_language;
pub(crate) mod system_integration;
mod validation;
mod validation_fields;
mod validation_records;

pub use commands::*;
pub use fonts::*;
pub use manager::PreferencesManager;
pub use preferences_document::PreferencesDocument;
pub(crate) use supported_language::{
    is_supported_agent_output_language, is_supported_app_language, DEFAULT_AGENT_OUTPUT_LANGUAGE,
    DEFAULT_APP_LANGUAGE,
};

const DEFAULT_PREFERENCES: &str = include_str!("../../resources/default_preferences.jsonc");
const PREFERENCES_FILE: &str = "preferences.json";
const LAST_KNOWN_GOOD_FILE: &str = "preferences.json.last-known-good";
const MAX_PREFERENCES_BYTES: usize = 2 * 1024 * 1024;
const MAX_JSON_DEPTH: usize = 64;
const SUPPORTED_SCHEMA_VERSION: u64 = 1;
static PROCESS_PREFERENCES_WRITE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[cfg(test)]
mod tests;
