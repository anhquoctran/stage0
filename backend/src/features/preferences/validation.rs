use super::schema::validate_schema;
use super::secrets::reject_secrets;
use super::{MAX_JSON_DEPTH, MAX_PREFERENCES_BYTES, SUPPORTED_SCHEMA_VERSION};
use jsonc_parser::{parse_to_serde_value, ParseOptions};
use serde_json::Value;

pub(super) fn strict_jsonc_options() -> ParseOptions {
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

pub(super) fn parse_and_validate(content: &str) -> Result<Value, String> {
    if content.len() > MAX_PREFERENCES_BYTES {
        return Err(crate::common::messages::failure(
            "backend.preferences.fileTooLarge",
            serde_json::json!({}),
            "Preferences file is too large (maximum 2 MiB)".into(),
        ));
    }
    let value: Value = parse_to_serde_value(content, &strict_jsonc_options())
        .map_err(|error| format_parse_error(&error))?;
    if !value.is_object() {
        return Err(crate::common::messages::failure(
            "backend.preferences.mustBeObject",
            serde_json::json!({}),
            "Preferences JSONC must contain a top-level object".into(),
        ));
    }
    if depth(&value, 0) > MAX_JSON_DEPTH {
        return Err(crate::common::messages::failure(
            "backend.preferences.nestingDepthExceeded",
            serde_json::json!({}),
            "Preferences JSONC exceeds the maximum nesting depth of 64".into(),
        ));
    }
    let version = value
        .get("schemaVersion")
        .and_then(Value::as_u64)
        .ok_or_else(|| {
            crate::common::messages::failure(
                "backend.preferences.schemaVersionRequired",
                serde_json::json!({}),
                "Preferences must include an integer schemaVersion".into(),
            )
        })?;
    if version > SUPPORTED_SCHEMA_VERSION {
        return Err(crate::common::messages::failure("backend.preferences.schemaVersionNewer", serde_json::json!({ "version": version }), format!("Preferences schema version {version} is newer than this Stage0 build supports. The file was left unchanged.")));
    }
    if version == 0 {
        return Err(crate::common::messages::failure(
            "backend.preferences.schemaVersionMin",
            serde_json::json!({}),
            "Preferences schemaVersion must be at least 1".into(),
        ));
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
            return Err(crate::common::messages::failure(
                "backend.preferences.missingRequiredField",
                serde_json::json!({ "field": key }),
                format!("Preferences are missing required field '{key}'"),
            ));
        }
    }
    validate_schema(&value)?;
    reject_secrets(&value, "")?;
    Ok(value)
}

pub(super) fn format_parse_error(error: &jsonc_parser::errors::ParseError) -> String {
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
