#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MenuCommand {
    pub label: String,
    pub shortcut: Option<String>,
    pub native: Option<String>,
    #[serde(default)]
    pub requires: Vec<String>,
    pub checked: Option<String>,
    #[allow(dead_code)] // Presentation metadata consumed by the frontend renderer.
    pub icon: Option<String>,
}
