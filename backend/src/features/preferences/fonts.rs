use font_kit::source::SystemSource;
use std::collections::BTreeMap;

// Enumerate family metadata through Core Text (macOS), DirectWrite (Windows),
// or Fontconfig (Linux). No guessed names, file contents, paths, or network I/O
// are returned to the webview. Keep native font work off the UI thread.
#[tauri::command]
pub async fn list_system_font_families() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(installed_font_families)
        .await
        .map_err(|_| "System font discovery could not complete".to_string())?
}

fn installed_font_families() -> Result<Vec<String>, String> {
    let families = SystemSource::new()
        .all_families()
        .map_err(|error| format!("Could not read installed font families: {error}"))?;
    Ok(normalize_families(families))
}

fn normalize_families(families: Vec<String>) -> Vec<String> {
    let mut names = BTreeMap::new();
    for name in families {
        let name = name.trim();
        // Internal platform families aren't public CSS family choices. The byte
        // bound matches appearance.uiFont.fontFamily preference validation.
        if name.is_empty()
            || name.starts_with('.')
            || name.len() > 128
            || name.chars().any(char::is_control)
        {
            continue;
        }
        names
            .entry(name.to_lowercase())
            .or_insert_with(|| name.to_string());
    }
    names.into_values().collect()
}

#[cfg(test)]
mod tests {
    use super::{installed_font_families, normalize_families};

    #[test]
    fn family_names_are_normalized_without_inventing_platform_defaults() {
        let names = vec![
            "  Custom UI  ",
            "custom ui",
            ".Hidden",
            "",
            "Bad\nName",
            "真正的字体",
        ]
        .into_iter()
        .map(str::to_string)
        .chain(["x".repeat(129)])
        .collect();
        assert_eq!(normalize_families(names), vec!["Custom UI", "真正的字体"]);
        assert!(normalize_families(Vec::new()).is_empty());
    }

    #[test]
    fn native_system_font_source_can_enumerate_installed_families() {
        let names = installed_font_families().expect("native font enumeration should succeed");
        #[cfg(target_os = "macos")]
        assert!(
            !names.is_empty(),
            "desktop test host should have installed fonts"
        );
        eprintln!("Discovered {} installed public font families", names.len());
        assert_eq!(normalize_families(names.clone()), names);
    }
}
