use serde_json::Value;
use tauri::{AppHandle, Manager};

pub(super) fn validate_runtime_preferences(settings: &Value) -> Result<(), String> {
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

pub(super) fn apply_runtime_preferences(app: &AppHandle, settings: &Value) {
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
