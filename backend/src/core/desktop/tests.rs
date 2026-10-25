use super::parsing::{desktop_name, double_click_action, ini_value, session_name, set_layout};
use super::WindowChrome;

#[test]
fn detects_three_desktops_and_session_without_guessing_unknown_environments() {
    for (current, session, expected) in [
        ("ubuntu:GNOME", "", "gnome"),
        ("GNOME-Classic:GNOME", "", "gnome"),
        ("KDE", "plasmawayland", "kde"),
        ("", "plasmax11", "kde"),
        ("XFCE", "", "xfce"),
        ("", "xfce4", "xfce"),
        ("sway", "sway", "unknown"),
        ("notgnome", "", "unknown"),
    ] {
        assert_eq!(desktop_name(current, session), expected);
    }
    assert_eq!(session_name("wayland", false), "wayland");
    assert_eq!(session_name("x11", true), "x11");
    assert_eq!(session_name("", true), "wayland");
    assert_eq!(session_name("", false), "unknown");
}

#[test]
fn gnome_layout_preserves_side_order_and_hidden_buttons() {
    let mut profile = WindowChrome::default();
    assert!(set_layout(
        &mut profile,
        "'close,minimize:maximize'",
        "gnome"
    ));
    assert_eq!(profile.controls_left, ["close", "minimize"]);
    assert_eq!(profile.controls_right, ["maximize"]);
    assert!(set_layout(&mut profile, "appmenu:close", "gnome"));
    assert!(profile.controls_left.is_empty());
    assert_eq!(profile.controls_right, ["close"]);
    assert!(set_layout(&mut profile, ":", "gnome"));
    assert!(profile.controls_left.is_empty());
    assert!(profile.controls_right.is_empty());
}

#[test]
fn kde_and_xfce_decode_their_own_button_alphabets_and_deduplicate() {
    let mut profile = WindowChrome::default();
    assert!(set_layout(&mut profile, "XAI|MS", "kde"));
    assert_eq!(profile.controls_left, ["close", "maximize", "minimize"]);
    assert!(profile.controls_right.is_empty());
    assert!(set_layout(&mut profile, "O|SHMC", "xfce"));
    assert!(profile.controls_left.is_empty());
    assert_eq!(profile.controls_right, ["minimize", "maximize", "close"]);
    assert!(set_layout(&mut profile, "CC|HMM", "xfce"));
    assert_eq!(profile.controls_left, ["close"]);
    assert_eq!(profile.controls_right, ["minimize", "maximize"]);
    let previous = profile.controls_right.clone();
    assert!(!set_layout(&mut profile, "invalid", "xfce"));
    assert!(!set_layout(&mut profile, "O|H|C", "xfce"));
    assert_eq!(profile.controls_right, previous);
}

#[test]
fn kde_ini_settings_are_group_scoped_and_explicit_empty_values_are_preserved() {
    let config = "# comment\n[Other]\nButtonsOnRight=X\n[org.kde.kdecoration2]\nButtonsOnLeft=\nButtonsOnRight=IAX\n[Windows]\nTitlebarDoubleClickCommand=Minimize\n";
    assert_eq!(
        ini_value(config, "org.kde.kdecoration2", "ButtonsOnLeft"),
        Some("")
    );
    assert_eq!(
        ini_value(config, "org.kde.kdecoration2", "ButtonsOnRight"),
        Some("IAX")
    );
    assert_eq!(
        ini_value(config, "Windows", "TitlebarDoubleClickCommand"),
        Some("Minimize")
    );
    assert_eq!(ini_value(config, "Missing", "ButtonsOnLeft"), None);
}

#[test]
fn double_click_settings_only_enable_supported_native_actions() {
    for value in ["'toggle-maximize'", "Maximize", "maximize"] {
        assert_eq!(double_click_action(value), "maximize");
    }
    for value in ["'minimize'", "Minimize", "hide"] {
        assert_eq!(double_click_action(value), "minimize");
    }
    for value in ["none", "Nothing", "shade", "menu", "unknown"] {
        assert_eq!(double_click_action(value), "none");
    }
}

#[test]
fn frame_policy_defaults_to_system_only_on_linux_and_preserves_custom_choice() {
    use serde_json::json;
    for settings in [
        json!({}),
        json!({"appearance": {"linuxTitleBar": "system"}}),
    ] {
        assert!(super::system_frame_for("linux", &settings));
        assert!(!super::system_frame_for("macos", &settings));
        assert!(!super::system_frame_for("windows", &settings));
    }
    assert!(!super::system_frame_for(
        "linux",
        &json!({"appearance": {"linuxTitleBar": "custom"}})
    ));
}

#[test]
fn desktop_profiles_read_only_the_owning_settings_and_fall_back_without_tools() {
    let fixtures = [
        ("gnome", "gnome.layout", "'close:minimize,maximize'", "gnome.doubleClick", "'minimize'"),
        ("kde", "kde.config", "[org.kde.kdecoration2]\nButtonsOnLeft=X\nButtonsOnRight=IA\n[Windows]\nTitlebarDoubleClickCommand=Minimize", "", ""),
        ("xfce", "xfce.layout", "C|HM", "xfce.doubleClick", "hide"),
    ];
    for (desktop, layout_key, layout, action_key, action) in fixtures {
        let mut requests = Vec::new();
        let profile = super::linux::profile_for(desktop, "wayland", |key| {
            requests.push(key.to_string());
            if key == layout_key {
                Some(layout.into())
            } else if key == action_key {
                Some(action.into())
            } else {
                panic!("Read an unrelated desktop setting: {key}");
            }
        });
        assert_eq!(profile.desktop, desktop);
        assert_eq!(profile.session, "wayland");
        assert_eq!(profile.controls_left, ["close"]);
        assert_eq!(profile.controls_right, ["minimize", "maximize"]);
        assert_eq!(profile.double_click_action, "minimize");
        assert!(requests.iter().all(|key| key.starts_with(desktop)));
        let fallback = super::linux::profile_for(desktop, "x11", |_| None);
        assert_eq!(fallback.controls_right, ["minimize", "maximize", "close"]);
        assert_eq!(fallback.double_click_action, "maximize");
    }
    let unknown = super::linux::profile_for("unknown", "unknown", |_| {
        panic!("Unknown desktop must not execute commands")
    });
    assert_eq!(unknown.controls_right, ["minimize", "maximize", "close"]);
}
