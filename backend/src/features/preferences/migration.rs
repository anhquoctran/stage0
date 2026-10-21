use super::secrets::{is_secret_env_name, looks_like_secret};
use serde_json::{Map, Value};

pub(super) fn sanitize_legacy(value: Value) -> Map<String, Value> {
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

pub(super) fn sanitize_value(value: &Value) -> Value {
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
