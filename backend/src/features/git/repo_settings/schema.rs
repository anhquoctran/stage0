use crate::features::preferences::{reject_settings_secrets, validate_reviewer};
use serde_json::{json, Value};
use std::collections::HashSet;

pub const MAX_BYTES: usize = 1024 * 1024;
pub const FIELDS: &[&str] = &[
    "schemaVersion",
    "defaultBaseBranch",
    "inheritGlobalAgents",
    "customAgentRules",
    "activeAgentIds",
    "customReviewers",
    "labels",
];

pub fn defaults(base: &str) -> Value {
    json!({ "schemaVersion": 1, "defaultBaseBranch": base, "inheritGlobalAgents": true,
        "customAgentRules": "", "activeAgentIds": null, "customReviewers": [], "labels": [] })
}

pub fn keys(value: &Value, allowed: &[&str], path: &str) -> Result<(), String> {
    let object = value
        .as_object()
        .ok_or_else(|| format!("{path} must be an object"))?;
    for key in object.keys() {
        if !allowed.contains(&key.as_str()) {
            return Err(format!("Unknown field {path}.{key}"));
        }
    }
    Ok(())
}

fn text<'a>(value: &'a Value, key: &str, max: usize, nonempty: bool) -> Result<&'a str, String> {
    let text = value[key]
        .as_str()
        .ok_or_else(|| format!("{key} must be a string"))?;
    if text.len() > max || (nonempty && text.trim().is_empty()) || text.contains('\0') {
        return Err(format!("Invalid or oversized {key}"));
    }
    Ok(text)
}

pub fn validate(value: &Value) -> Result<(), String> {
    keys(value, FIELDS, "settings")?;
    if value["schemaVersion"].as_u64() != Some(1) {
        return Err("Unsupported repository schemaVersion (expected 1)".into());
    }
    for key in FIELDS {
        if value.get(*key).is_none() {
            return Err(format!("Missing settings.{key}"));
        }
    }
    let branch = text(value, "defaultBaseBranch", 1024, true)?;
    // HEAD is the intentional fallback for empty repositories. Ref expressions
    // and option-like branch names must never reach downstream Git commands.
    if branch != "HEAD"
        && (branch.starts_with(['-', '/'])
            || branch.ends_with(['.', '/'])
            || branch.contains("..")
            || branch.contains("@{")
            || branch == "@"
            || branch
                .chars()
                .any(|c| c.is_control() || c.is_whitespace() || "~^:?*[\\".contains(c))
            || branch
                .split('/')
                .any(|s| s.is_empty() || s.starts_with('.') || s.ends_with(".lock")))
    {
        return Err("Invalid defaultBaseBranch".into());
    }
    if !value["inheritGlobalAgents"].is_boolean() {
        return Err("inheritGlobalAgents must be boolean".into());
    }
    text(value, "customAgentRules", 32_000, false)?;
    if !value["activeAgentIds"].is_null() {
        let ids = value["activeAgentIds"]
            .as_array()
            .ok_or("activeAgentIds must be null or an array")?;
        let mut seen = HashSet::new();
        if ids.len() > 256 {
            return Err("Too many activeAgentIds".into());
        }
        for id in ids {
            let id = id.as_str().ok_or("Agent ID must be a string")?;
            if id.is_empty()
                || id.len() > 256
                || id.chars().any(char::is_control)
                || !seen.insert(id)
            {
                return Err("Invalid or duplicate agent ID".into());
            }
        }
    }
    let reviewers = value["customReviewers"]
        .as_array()
        .ok_or("customReviewers must be an array")?;
    if reviewers.len() > 128 {
        return Err("Too many customReviewers".into());
    }
    let mut seen = HashSet::new();
    for (index, reviewer) in reviewers.iter().enumerate() {
        keys(
            reviewer,
            &[
                "id",
                "name",
                "tagline",
                "description",
                "category",
                "avatarEmoji",
                "customInstructions",
                "enabled",
                "provider",
                "model",
                "acpAgentId",
                "acpConfigOptions",
                "temperature",
                "reasoningEffort",
                "fastMode",
                "isBuiltin",
            ],
            "customReviewers",
        )?;
        validate_reviewer(reviewer, index)?;
        let id = text(reviewer, "id", 256, true)?;
        text(reviewer, "name", 256, true)?;
        if !seen.insert(id) || reviewer["isBuiltin"] == true {
            return Err("Invalid custom reviewer ID/type".into());
        }
        // Source-transfer consent stays machine-local. A checked-out document
        // cannot authorize an ACP process to receive source code.
    }
    let labels = value["labels"]
        .as_array()
        .ok_or("labels must be an array")?;
    if labels.len() > 256 {
        return Err("Too many labels".into());
    }
    let mut ids = HashSet::new();
    let mut names = HashSet::new();
    for label in labels {
        keys(label, &["id", "name", "color", "description"], "labels")?;
        let id = text(label, "id", 256, true)?;
        let name = text(label, "name", 128, true)?;
        let color = text(label, "color", 7, true)?;
        if !ids.insert(id)
            || !names.insert(name)
            || color.len() != 7
            || !color.starts_with('#')
            || !color[1..].bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err("Invalid label ID, duplicate name or color (expected #RRGGBB)".into());
        }
        if !label["description"].is_null() {
            text(label, "description", 4096, false)?;
        }
    }
    reject_settings_secrets(value, "")?;
    Ok(())
}
