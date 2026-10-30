//! UI wire messages. Internal diagnostics retain their original text for logs,
//! error classification and model-facing tool recovery; only the IPC boundary
//! replaces them with a locale-independent message code.
use serde::Serializer;
use serde_json::{json, Value};

pub const PREFIX: &str = "stage0-message:";

pub fn code(key: &str) -> String {
    message(key, json!({}))
}

pub fn message(code: &str, params: Value) -> String {
    format!("{PREFIX}{}", json!({ "code": code, "params": params }))
}

/// Do not wrap an already-coded failure when one command calls another.
/// Diagnostic text is separate from interpolation and is never UI copy.
pub fn command_error(domain: &str, diagnostic: String) -> String {
    if diagnostic.starts_with(PREFIX) {
        return diagnostic;
    }
    failure(&format!("backend.errors.{domain}"), json!({}), diagnostic)
}

pub fn failure(code: &str, params: Value, diagnostic: String) -> String {
    format!(
        "{PREFIX}{}",
        json!({ "code": code, "params": params, "diagnostic": diagnostic })
    )
}

pub fn serialize_optional_error<S: Serializer>(
    value: &Option<String>,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    match value {
        Some(error) => serializer.serialize_some(&command_error("operation", error.clone())),
        None => serializer.serialize_none(),
    }
}

#[cfg(test)]
mod tests;
