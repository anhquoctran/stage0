use super::storage::revision;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferencesDocument {
    pub content: String,
    pub revision: String,
    pub path: String,
    pub migrated: bool,
    pub settings: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validation_error: Option<String>,
}

pub(super) fn document(
    path: PathBuf,
    content: String,
    migrated: bool,
    _value: Value,
) -> PreferencesDocument {
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

pub(super) fn document_with_error(
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
