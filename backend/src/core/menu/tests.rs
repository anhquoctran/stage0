use super::{
    definition::{definition, label, nodes_for_platform},
    flags::MenuFlags,
    node::MenuNode,
};
use std::collections::BTreeSet;

fn actions(nodes: &[MenuNode], platform: &str, result: &mut BTreeSet<String>) {
    for node in nodes_for_platform(nodes, platform) {
        if let Some(id) = &node.command {
            assert!(
                definition().commands.contains_key(id),
                "unknown action {id}"
            );
            let command = &definition().commands[id];
            if command.native.is_none() && !matches!(id.as_str(), "zoom" | "exit") {
                result.insert(id.clone());
            }
        }
        actions(&node.items, platform, result);
    }
}

#[test]
fn bundled_menu_has_equal_application_actions_on_all_desktop_platforms() {
    let mut expected = BTreeSet::new();
    actions(&definition().menus, "windows", &mut expected);
    assert!(expected.contains("release_notes"));
    assert!(expected.contains("repo_overview"));
    assert!(expected.contains("rebase_abort"));
    assert!(expected.contains("open_vscode"));
    for platform in ["macos", "linux"] {
        let mut actual = BTreeSet::new();
        actions(&definition().menus, platform, &mut actual);
        assert_eq!(
            actual, expected,
            "application actions diverged on {platform}"
        );
    }
}

#[test]
fn platform_overlays_keep_common_order_and_no_empty_separators() {
    for platform in ["windows", "macos", "linux"] {
        let roots = nodes_for_platform(&definition().menus, platform);
        let common: Vec<_> = roots
            .iter()
            .filter_map(|node| node.id.as_deref())
            .filter(|id| !matches!(*id, "application_menu" | "window_menu"))
            .collect();
        assert_eq!(
            common,
            [
                "file_menu",
                "edit_menu",
                "view_menu",
                "repository_menu",
                "help_menu"
            ]
        );
        fn check(nodes: &[MenuNode], platform: &str) {
            let visible = nodes_for_platform(nodes, platform);
            assert!(!visible.first().is_some_and(|node| node.separator));
            assert!(!visible.last().is_some_and(|node| node.separator));
            assert!(visible
                .windows(2)
                .all(|pair| !pair[0].separator || !pair[1].separator));
            for node in visible {
                check(&node.items, platform);
            }
        }
        check(&definition().menus, platform);
    }
    assert_eq!(label("Open in {fileManager}", "macos"), "Open in Finder");
    assert_eq!(label("{fileManager}", "windows"), "File Explorer");
    assert_eq!(label("{fileManager}", "linux"), "File Manager");
}

#[test]
fn gates_distinguish_repository_file_sync_and_rebase_states() {
    let mut flags = MenuFlags::default();
    flags.file = true;
    flags.text_file = true;
    assert!(!flags.value("file")); // A stale file cannot enable another window's repo actions.
    flags.repository = true;
    assert!(flags.enabled(&definition().commands["copy_rel_path"].requires));
    assert!(!flags.enabled(&definition().commands["fetch"].requires));
    flags.idle = true;
    assert!(flags.enabled(&definition().commands["fetch"].requires));
    assert!(!flags.enabled(&definition().commands["rebase_continue"].requires));
    flags.rebasing = true;
    assert!(flags.enabled(&definition().commands["rebase_continue"].requires));
    flags.text_file = false;
    assert!(!flags.enabled(&definition().commands["view_blame"].requires));
    assert!(flags.enabled(&definition().commands["copy_rel_path"].requires));
    assert!(!flags.value("unrecognized"));
    flags.onboarding = true;
    assert!(!flags.enabled(&definition().commands["copy_rel_path"].requires));
    assert!(!flags.value("repository"));
}

#[test]
fn command_metadata_only_uses_supported_gates_roles_and_unique_shortcuts() {
    let gates = [
        "repository",
        "file",
        "textFile",
        "idle",
        "rebasing",
        "recents",
    ];
    let checks = [
        "split",
        "unified",
        "blame",
        "inlineBlame",
        "flat",
        "tree",
        "performance",
    ];
    let roles = [
        "undo",
        "redo",
        "cut",
        "copy",
        "paste",
        "select_all",
        "services",
        "hide",
        "hide_others",
        "show_all",
        "quit",
        "fullscreen",
        "minimize",
        "bring_all_to_front",
    ];
    let mut shortcuts = BTreeSet::new();
    for (id, command) in &definition().commands {
        assert!(!command.label.is_empty(), "empty label for {id}");
        assert!(command
            .requires
            .iter()
            .all(|gate| gates.contains(&gate.as_str())));
        if let Some(check) = &command.checked {
            assert!(checks.contains(&check.as_str()));
        }
        if let Some(role) = &command.native {
            assert!(roles.contains(&role.as_str()));
        }
        if let Some(shortcut) = &command.shortcut {
            assert!(shortcuts.insert(shortcut), "duplicate shortcut {shortcut}");
        }
    }
}

#[test]
fn window_keymaps_validate_inputs_and_keep_webview_owned_shortcuts_visible() {
    use super::keymap::NativeMenuKeymap;
    use std::collections::HashMap;
    let keymap = NativeMenuKeymap::from_input(
        HashMap::from([("open_repo".into(), "Cmd+O".into())]),
        HashMap::from([
            ("keymaps".into(), "⌘+K ⌘+S".into()),
            ("open_repo".into(), "⌘+O".into()),
        ]),
    )
    .unwrap();
    assert_eq!(keymap.title("open_repo", "en"), "Open...");
    assert_eq!(
        keymap.title("keymaps", "en"),
        "Customize Keymap...  (⌘+K ⌘+S)"
    );
    for (id, key) in [
        ("copy", "Cmd+F8"),
        ("unknown", "Cmd+F8"),
        ("fetch", "Ctrl+K Ctrl+S"),
    ] {
        assert!(NativeMenuKeymap::from_input(
            HashMap::from([(id.into(), key.into())]),
            HashMap::new()
        )
        .is_err());
    }
}
