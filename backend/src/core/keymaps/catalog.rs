use crate::core::menu::definition::{definition, nodes_for_platform};
use serde_json::Value;
use std::{collections::BTreeMap, sync::OnceLock};

pub struct KeymapCommand {
    pub label: String,
    pub scope: String,
    pub keys: Vec<String>,
    pub editable: bool,
}

pub fn config() -> &'static Value {
    static CONFIG: OnceLock<Value> = OnceLock::new();
    CONFIG.get_or_init(|| {
        serde_json::from_str(include_str!("../../../../shared/keymaps.json"))
            .expect("bundled keymaps must be valid")
    })
}

fn keys(value: &Value) -> Vec<String> {
    value
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|key| key.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}

pub fn resolve(settings: &Value, platform: &str) -> BTreeMap<String, KeymapCommand> {
    let mut visible = Vec::new();
    let mut nodes = nodes_for_platform(&definition().menus, platform);
    while let Some(node) = nodes.pop() {
        if let Some(id) = &node.command {
            visible.push(id.clone());
        }
        nodes.extend(nodes_for_platform(&node.items, platform));
    }
    let config = config();
    let preset = config["presets"]
        .as_array()
        .unwrap()
        .iter()
        .find(|item| item["id"] == settings["preset"])
        .unwrap_or(&config["presets"][0]);
    let mut commands = BTreeMap::new();
    for id in visible {
        let command = &definition().commands[&id];
        let defaults = if config["defaults"][&id].is_array() {
            keys(&config["defaults"][&id])
        } else if let Some(shortcut) = &command.shortcut {
            vec![shortcut.clone()]
        } else {
            keys(&config["system"][&id])
        };
        let workspace = command
            .requires
            .iter()
            .any(|key| ["repository", "file", "textFile"].contains(&key.as_str()));
        commands.insert(
            id.clone(),
            KeymapCommand {
                label: command.label.clone(),
                scope: if workspace {
                    "workspace"
                } else {
                    "application"
                }
                .into(),
                keys: defaults,
                editable: command.native.is_none() && id != "exit",
            },
        );
    }
    for (id, item) in config["commands"].as_object().unwrap() {
        commands.insert(
            id.clone(),
            KeymapCommand {
                label: item["label"].as_str().unwrap().into(),
                scope: item["scope"].as_str().unwrap().into(),
                keys: keys(&item["keys"]),
                editable: true,
            },
        );
    }
    for (id, command) in &mut commands {
        if !command.editable {
            continue;
        }
        if preset["bindings"][id].is_array() {
            command.keys = keys(&preset["bindings"][id]);
        }
        if preset["platforms"][platform][id].is_array() {
            command.keys = keys(&preset["platforms"][platform][id]);
        }
        if let Some(item) = settings["overrides"].as_array().and_then(|items| {
            items
                .iter()
                .find(|item| item["command"].as_str() == Some(id))
        }) {
            command.keys = keys(&item["keys"]);
        }
    }
    commands
}
