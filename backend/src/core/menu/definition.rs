use super::{command::MenuCommand, node::MenuNode};
use std::{collections::HashMap, sync::OnceLock};

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MenuDefinition {
    pub commands: HashMap<String, MenuCommand>,
    pub recent: HashMap<String, String>,
    pub menus: Vec<MenuNode>,
}

pub fn definition() -> &'static MenuDefinition {
    static CONFIG: OnceLock<MenuDefinition> = OnceLock::new();
    CONFIG.get_or_init(|| {
        serde_json::from_str(include_str!("../../../../shared/application-menu.json"))
            .expect("bundled application menu must be valid; covered by menu tests")
    })
}

pub fn nodes_for_platform<'a>(nodes: &'a [MenuNode], platform: &str) -> Vec<&'a MenuNode> {
    let visible: Vec<_> = nodes
        .iter()
        .filter(|node| node.visible_on(platform))
        .collect();
    visible
        .iter()
        .enumerate()
        .filter_map(|(index, node)| {
            (!node.separator
                || (index > 0 && index + 1 < visible.len() && !visible[index - 1].separator))
                .then_some(*node)
        })
        .collect()
}

pub fn label(text: &str, platform: &str) -> String {
    let manager = match platform {
        "macos" => "Finder",
        "windows" => "File Explorer",
        _ => "File Manager",
    };
    text.replace("{fileManager}", manager)
}
