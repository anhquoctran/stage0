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
