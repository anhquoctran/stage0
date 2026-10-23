#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MenuNode {
    pub id: Option<String>,
    pub label: Option<String>,
    #[allow(dead_code)]
    pub icon: Option<String>,
    pub command: Option<String>,
    #[serde(default)]
    pub separator: bool,
    pub dynamic: Option<String>,
    #[serde(default)]
    pub requires: Vec<String>,
    pub platforms: Option<Vec<String>>,
    #[serde(default)]
    pub items: Vec<MenuNode>,
}

impl MenuNode {
    pub fn visible_on(&self, platform: &str) -> bool {
        self.platforms
            .as_ref()
            .map_or(true, |items| items.iter().any(|item| item == platform))
    }
}
