use super::WindowChrome;
use std::collections::HashSet;

pub(super) fn desktop_name(current: &str, session: &str) -> &'static str {
    for value in [current, session] {
        for token in value.split(':').map(|s| s.trim().to_ascii_lowercase()) {
            match token.as_str() {
                "gnome" | "gnome-classic" | "ubuntu" | "ubuntu-wayland" => return "gnome",
                "kde" | "plasma" | "plasmawayland" | "plasmax11" => return "kde",
                "xfce" | "xfce4" | "xubuntu" => return "xfce",
                _ => {}
            }
        }
    }
    "unknown"
}

pub(super) fn session_name(session: &str, wayland: bool) -> &'static str {
    match session.to_ascii_lowercase().as_str() {
        "wayland" => "wayland",
        "x11" => "x11",
        _ if wayland => "wayland",
        _ => "unknown",
    }
}

pub(super) fn set_layout(profile: &mut WindowChrome, layout: &str, desktop: &str) -> bool {
    let layout = layout.trim().trim_matches(['\'', '"']);
    let separator = if desktop == "gnome" { ':' } else { '|' };
    let Some((left, right)) = layout.split_once(separator) else {
        return false;
    };
    if right.contains(separator) {
        return false;
    }
    let mut seen = HashSet::new();
    let mut parse = |value: &str| -> Vec<String> {
        let names: Vec<&str> = if desktop == "gnome" {
            value.split(',').map(str::trim).collect()
        } else {
            value.split("").filter(|s| !s.is_empty()).collect()
        };
        names
            .into_iter()
            .filter_map(|name| {
                let button = match (desktop, name) {
                    ("gnome", "minimize") | ("kde", "I") | ("xfce", "H") => "minimize",
                    ("gnome", "maximize") | ("kde", "A") | ("xfce", "M") => "maximize",
                    ("gnome", "close") | ("kde", "X") | ("xfce", "C") => "close",
                    _ => return None,
                };
                seen.insert(button).then(|| button.into())
            })
            .collect()
    };
    profile.controls_left = parse(left);
    profile.controls_right = parse(right);
    true
}

pub(super) fn ini_value<'a>(content: &'a str, group: &str, key: &str) -> Option<&'a str> {
    let mut selected = false;
    for line in content.lines().map(str::trim) {
        if line.starts_with('#') || line.starts_with(';') {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            selected = &line[1..line.len() - 1] == group;
        } else if selected {
            if let Some((name, value)) = line.split_once('=') {
                if name.trim() == key {
                    return Some(value.trim());
                }
            }
        }
    }
    None
}

pub(super) fn double_click_action(value: &str) -> &'static str {
    match value
        .trim()
        .trim_matches(['\'', '"'])
        .to_ascii_lowercase()
        .as_str()
    {
        "toggle-maximize" | "maximize" => "maximize",
        "minimize" | "hide" => "minimize",
        _ => "none",
    }
}
