use super::{
    catalog::{config, resolve, KeymapCommand},
    shortcut::normalize,
};
use serde_json::Value;
use std::collections::BTreeSet;

pub fn validate_settings(settings: &Value) -> Result<(), String> {
    let object = settings.as_object().ok_or("keymap must be an object")?;
    if object
        .keys()
        .any(|key| !["preset", "overrides"].contains(&key.as_str()))
    {
        return Err("Unknown keymap property".into());
    }
    if !config()["presets"]
        .as_array()
        .unwrap()
        .iter()
        .any(|item| item["id"] == settings["preset"] && settings["preset"].is_string())
    {
        return Err("keymap.preset is not supported".into());
    }
    let overrides = settings["overrides"]
        .as_array()
        .ok_or("keymap.overrides must be an array")?;
    if overrides.len() > 256 {
        return Err("keymap.overrides cannot exceed 256 entries".into());
    }
    let mut known = resolve(&serde_json::json!({}), "macos");
    known.extend(resolve(&serde_json::json!({}), "windows"));
    known.extend(resolve(&serde_json::json!({}), "linux"));
    let mut seen = BTreeSet::new();
    for item in overrides {
        let item = item
            .as_object()
            .ok_or("Every keymap override must be an object")?;
        if item
            .keys()
            .any(|key| !["command", "keys"].contains(&key.as_str()))
        {
            return Err("Unknown keymap override property".into());
        }
        let id = item
            .get("command")
            .and_then(Value::as_str)
            .ok_or("keymap override needs a command")?;
        if !known.get(id).is_some_and(|command| command.editable) {
            return Err(format!("Unknown or system-managed keymap command: {id}"));
        }
        if !seen.insert(id) {
            return Err(format!("Duplicate keymap override: {id}"));
        }
        let keys = item
            .get("keys")
            .and_then(Value::as_array)
            .ok_or("keymap keys must be an array")?;
        if keys.len() > 4 || keys.iter().any(|key| !key.is_string()) {
            return Err("Use up to four keymap shortcuts, or an empty array to unbind".into());
        }
    }
    for platform in ["macos", "windows", "linux"] {
        validate_conflicts(settings, platform)?;
    }
    Ok(())
}

fn overlaps(a: &KeymapCommand, b: &KeymapCommand) -> bool {
    !(a.scope == "welcome" && ["workspace", "tabs"].contains(&b.scope.as_str())
        || b.scope == "welcome" && ["workspace", "tabs"].contains(&a.scope.as_str()))
}

fn validate_conflicts(settings: &Value, platform: &str) -> Result<(), String> {
    let commands = resolve(settings, platform);
    let mut entries: Vec<(&KeymapCommand, String)> = Vec::new();
    for command in commands.values() {
        for key in &command.keys {
            let normalized = normalize(key, platform == "macos")?;
            if command.editable
                && normalized
                    .split(' ')
                    .any(|stroke| ["Escape", "Tab", "Shift+Escape", "Shift+Tab"].contains(&stroke))
            {
                return Err("Escape and Tab are reserved for cancel and focus navigation".into());
            }
            for (other, previous) in &entries {
                if overlaps(command, other)
                    && (normalized == *previous
                        || normalized.starts_with(&format!("{previous} "))
                        || previous.starts_with(&format!("{normalized} ")))
                {
                    return Err(format!(
                        "Keymap conflict on {platform}: {} and {} use {normalized}",
                        command.label, other.label
                    ));
                }
            }
            entries.push((command, normalized));
        }
    }
    Ok(())
}
