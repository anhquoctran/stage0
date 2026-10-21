use super::secrets::{is_secret_env_name, looks_like_secret};
use super::validation_fields::{
    validate_enum_string, validate_optional_bool, validate_optional_enum, validate_optional_number,
    validate_optional_string, validate_string_array,
};
use serde_json::Value;

pub(super) fn validate_mcp_server(value: &Value, index: usize) -> Result<(), String> {
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
        validate_string_array(secret_env_keys, &format!("{path}.secretEnvKeys"), 256, 256)?;
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

fn valid_env_name(name: &str) -> bool {
    let mut chars = name.chars();
    matches!(chars.next(), Some(first) if first == '_' || first.is_ascii_alphabetic())
        && chars.all(|ch| ch == '_' || ch.is_ascii_alphanumeric())
}

pub(super) fn validate_reviewer(value: &Value, index: usize) -> Result<(), String> {
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
    validate_optional_string(reviewer, "acpAgentId", &path, 200, false)?;
    validate_optional_number(reviewer, "temperature", &path, 0.0, 2.0)?;
    validate_optional_enum(
        reviewer,
        "reasoningEffort",
        &path,
        &["none", "minimal", "low", "medium", "high", "xhigh", "max"],
    )?;
    validate_optional_bool(reviewer, "fastMode", &path)?;
    validate_optional_bool(reviewer, "allowAcpSourceTransfer", &path)?;
    if let Some(options) = reviewer.get("acpConfigOptions") {
        let options = options
            .as_object()
            .ok_or_else(|| format!("{path}.acpConfigOptions must be an object"))?;
        if options.len() > 32 {
            return Err(format!("{path}.acpConfigOptions has too many options"));
        }
        for (id, value) in options {
            if id.is_empty() || id.len() > 128 || id.chars().any(char::is_control) {
                return Err(format!(
                    "{path}.acpConfigOptions contains an invalid option ID"
                ));
            }
            if !value.as_bool().is_some()
                && !value
                    .as_str()
                    .is_some_and(|text| text.len() <= 256 && !text.chars().any(char::is_control))
            {
                return Err(format!(
                    "{path}.acpConfigOptions contains an invalid option value"
                ));
            }
        }
    }
    validate_optional_bool(reviewer, "isBuiltin", &path)?;
    Ok(())
}

pub(super) fn validate_git_credential(value: &Value, index: usize) -> Result<(), String> {
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
