use tauri::{AppHandle, Manager};

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareAboutInfo {
    pub name: String,
    pub author: String,
    pub package_version: String,
    pub git_commit: String,
    pub arch: String,
    pub version: String,
    pub release_date: String,
    pub current_year: String,
    pub copyright: String,
    pub license: String,
    pub tagline: String,
    pub description: String,
    pub website: String,
    pub os: String,
}

#[tauri::command]
pub fn get_app_info() -> Result<SoftwareAboutInfo, String> {
    const RAW_JSON: &str = include_str!("../../../about.json");
    let mut info: SoftwareAboutInfo = serde_json::from_str(RAW_JSON)
        .map_err(|e| format!("Failed to parse embedded about metadata: {e}"))?;
    info.os = std::env::consts::OS.to_string();
    Ok(info)
}

/// Reads the release notes markdown file for the current version.
/// Priority:
/// 1. Next to the executable (portable / downloaded folder mode)
/// 2. Tauri resource directory (bundled application)
/// 3. Current working directory (development mode)
/// 4. Embedded release notes fallback
#[tauri::command]
pub fn get_release_notes(app: AppHandle) -> Result<String, String> {
    // 1. Check directory containing executable
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let candidate = exe_dir.join("RELEASE_NOTES.md");
            if candidate.is_file() {
                if let Ok(content) = std::fs::read_to_string(&candidate) {
                    return Ok(content);
                }
            }
        }
    }

    // 2. Check Tauri resource directory
    if let Ok(res_dir) = app.path().resource_dir() {
        let candidate = res_dir.join("RELEASE_NOTES.md");
        if candidate.is_file() {
            if let Ok(content) = std::fs::read_to_string(&candidate) {
                return Ok(content);
            }
        }
    }

    // 3. Check current working directory
    let cwd_candidate = std::path::Path::new("RELEASE_NOTES.md");
    if cwd_candidate.is_file() {
        if let Ok(content) = std::fs::read_to_string(cwd_candidate) {
            return Ok(content);
        }
    }

    // 4. Fallback to compile-time embedded release notes
    const EMBEDDED_RELEASE_NOTES: &str = include_str!("../../../../RELEASE_NOTES.md");
    Ok(EMBEDDED_RELEASE_NOTES.to_string())
}
