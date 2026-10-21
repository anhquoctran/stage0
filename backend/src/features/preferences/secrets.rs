use serde_json::Value;

pub(super) fn is_secret_env_name(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    name.contains("token")
        || name.contains("secret")
        || name.contains("password")
        || name.contains("credential")
        || name.contains("key")
}

pub(super) fn reject_secrets(value: &Value, path: &str) -> Result<(), String> {
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

pub(super) fn reject_git_credentials(value: &Value, path: &str) -> Result<(), String> {
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

pub(super) fn looks_like_secret(value: &str) -> bool {
    ["sk-", "ghp_", "github_pat_", "glpat-", "xoxb-", "xoxp-"]
        .iter()
        .any(|prefix| value.trim().starts_with(prefix))
}
