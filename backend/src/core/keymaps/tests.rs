use super::{
    catalog::{config, resolve},
    shortcut::normalize,
    validate_settings,
};
use serde_json::json;

#[test]
fn every_bundled_preset_is_valid_on_all_supported_platforms() {
    for preset in config()["presets"].as_array().unwrap() {
        let settings = json!({"preset": preset["id"], "overrides": []});
        validate_settings(&settings).unwrap_or_else(|error| panic!("{}: {error}", preset["id"]));
        for platform in ["macos", "windows", "linux"] {
            let commands = resolve(&settings, platform);
            assert!(commands.contains_key("close_tab"));
            assert!(commands.contains_key("keymaps"));
        }
    }
}

#[test]
fn keymaps_inherit_override_and_explicitly_unbind() {
    let settings = json!({"preset": "vscode", "overrides": [
        {"command": "pull", "keys": []},
        {"command": "fetch", "keys": ["CmdOrCtrl+Alt+F9", "Ctrl+F10"]}
    ]});
    validate_settings(&settings).unwrap();
    let commands = resolve(&settings, "macos");
    assert_eq!(commands["keymaps"].keys, ["CmdOrCtrl+K CmdOrCtrl+S"]);
    assert!(commands["pull"].keys.is_empty());
    assert_eq!(commands["fetch"].keys.len(), 2);
}

#[test]
fn rejects_conflicts_prefixes_reserved_keys_and_invalid_records() {
    for item in [
        json!({"command": "fetch", "keys": ["CmdOrCtrl+Shift+P"]}),
        json!({"command": "fetch", "keys": ["CmdOrCtrl+K"]}),
        json!({"command": "fetch", "keys": ["CmdOrCtrl+C"]}),
        json!({"command": "fetch", "keys": ["Escape"]}),
        json!({"command": "fetch", "keys": ["CmdOrCtrl+K Escape"]}),
        json!({"command": "fetch", "keys": ["CmdOrCtrl+K Tab"]}),
        json!({"command": "fetch", "keys": ["Ctrl+Ctrl+A"]}),
        json!({"command": "fetch", "keys": ["Ctrl+A Ctrl+B Ctrl+C"]}),
        json!({"command": "unknown", "keys": []}),
        json!({"command": "copy", "keys": []}),
        json!({"command": "fetch", "keys": [3]}),
        json!({"command": "fetch", "keys": ["Ctrl+F8"], "unknown": true}),
    ] {
        let settings = json!({"preset": "vscode", "overrides": [item]});
        assert!(validate_settings(&settings).is_err(), "accepted {settings}");
    }
    assert!(validate_settings(&json!({"preset": "missing", "overrides": []})).is_err());
    assert!(validate_settings(&json!({"preset": "stage0", "overrides": [
        {"command": "fetch", "keys": []}, {"command": "fetch", "keys": []}
    ]}))
    .is_err());
}

#[test]
fn shortcuts_distinguish_control_from_command_and_bound_chords() {
    assert_eq!(
        normalize("CmdOrCtrl+Shift+K Ctrl+S", true).unwrap(),
        "Cmd+Shift+K Ctrl+S"
    );
    assert_eq!(
        normalize("CmdOrCtrl+Shift+K Ctrl+S", false).unwrap(),
        "Ctrl+Shift+K Ctrl+S"
    );
    assert_eq!(
        normalize("Option+Control+Backquote", true).unwrap(),
        "Ctrl+Alt+Backquote"
    );
    for invalid in [
        "Ctrl+",
        "Ctrl+Shift",
        "CmdOrCtrl+Ctrl+K",
        "Ctrl+K Ctrl+S Ctrl+T",
    ] {
        assert!(normalize(invalid, true).is_err());
    }
}
