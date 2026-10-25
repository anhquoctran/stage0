#[cfg(target_os = "linux")]
use super::parsing::{desktop_name, session_name};
use super::parsing::{double_click_action, ini_value, set_layout};
use super::WindowChrome;
#[cfg(target_os = "linux")]
use std::{env, io::Read, path::PathBuf, process::Command, time::Duration};

#[cfg(target_os = "linux")]
pub(super) fn read_profile() -> WindowChrome {
    let desktop = desktop_name(
        &env::var("XDG_CURRENT_DESKTOP").unwrap_or_default(),
        &env::var("XDG_SESSION_DESKTOP")
            .or_else(|_| env::var("DESKTOP_SESSION"))
            .unwrap_or_default(),
    );
    let session = session_name(
        &env::var("XDG_SESSION_TYPE").unwrap_or_default(),
        env::var_os("WAYLAND_DISPLAY").is_some(),
    );
    profile_for(desktop, session, |setting| match setting {
        "gnome.layout" => output(
            "gsettings",
            &["get", "org.gnome.desktop.wm.preferences", "button-layout"],
        ),
        "gnome.doubleClick" => output(
            "gsettings",
            &[
                "get",
                "org.gnome.desktop.wm.preferences",
                "action-double-click-titlebar",
            ],
        ),
        "kde.config" => kwin_config(),
        "xfce.layout" => output(
            "xfconf-query",
            &["-c", "xfwm4", "-p", "/general/button_layout"],
        ),
        "xfce.doubleClick" => output(
            "xfconf-query",
            &["-c", "xfwm4", "-p", "/general/double_click_action"],
        ),
        _ => None,
    })
}

pub(super) fn profile_for(
    desktop: &str,
    session: &str,
    mut read: impl FnMut(&str) -> Option<String>,
) -> WindowChrome {
    let mut profile = WindowChrome {
        desktop: desktop.into(),
        platform: "linux".into(),
        session: session.into(),
        ..WindowChrome::default()
    };
    match desktop {
        "gnome" => {
            if let Some(layout) = read("gnome.layout") {
                set_layout(&mut profile, &layout, desktop);
            }
            if let Some(action) = read("gnome.doubleClick") {
                profile.double_click_action = double_click_action(&action).into();
            }
        }
        "kde" => {
            if let Some(config) = read("kde.config") {
                let left =
                    ini_value(&config, "org.kde.kdecoration2", "ButtonsOnLeft").unwrap_or("MS");
                let right =
                    ini_value(&config, "org.kde.kdecoration2", "ButtonsOnRight").unwrap_or("IAX");
                set_layout(&mut profile, &format!("{left}|{right}"), desktop);
                if let Some(action) = ini_value(&config, "Windows", "TitlebarDoubleClickCommand") {
                    profile.double_click_action = double_click_action(action).into();
                }
            }
        }
        "xfce" => {
            if let Some(layout) = read("xfce.layout") {
                set_layout(&mut profile, &layout, desktop);
            }
            if let Some(action) = read("xfce.doubleClick") {
                profile.double_click_action = double_click_action(&action).into();
            }
        }
        _ => {}
    }
    profile
}

#[cfg(target_os = "linux")]
fn output(program: &str, args: &[&str]) -> Option<String> {
    let output = crate::common::process::run_bounded_command(
        Command::new(program).args(args),
        4096,
        1024,
        Duration::from_millis(750),
    )
    .ok()?;
    if !output.status.success() || output.output_truncated {
        return None;
    }
    String::from_utf8(output.stdout).ok()
}

#[cfg(target_os = "linux")]
fn kwin_config() -> Option<String> {
    let directory = env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .filter(|p| p.is_absolute())
        .or_else(|| {
            env::var_os("HOME")
                .map(PathBuf::from)
                .filter(|p| p.is_absolute())
                .map(|p| p.join(".config"))
        })?;
    let mut content = String::new();
    std::fs::File::open(directory.join("kwinrc"))
        .ok()?
        .take(65537)
        .read_to_string(&mut content)
        .ok()?;
    (content.len() <= 65536).then_some(content)
}
