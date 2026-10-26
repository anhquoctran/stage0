#[cfg(target_os = "linux")]
mod linux_host;

use crate::core::db::Database;
use crate::core::window_manager::{create_welcome_window, open_repo_path};
use crate::features::git::RepoInfo;
use tauri::{
    image::Image,
    menu::{Menu, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Wry,
};

pub const TRAY_ID: &str = "stage0-tray";
const MAX_RECENT_IN_TRAY: usize = 10;

pub fn build_tray_menu(app: &AppHandle, repositories: &[RepoInfo]) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::new(app)?;

    let new_window = MenuItemBuilder::with_id("tray_new_window", "New Window").build(app)?;
    menu.append(&new_window)?;

    menu.append(&PredefinedMenuItem::separator(app)?)?;

    if repositories.is_empty() {
        let empty = MenuItemBuilder::with_id("tray_no_recent", "No Recent Repositories")
            .enabled(false)
            .build(app)?;
        menu.append(&empty)?;
    } else {
        for repo in repositories.iter().take(MAX_RECENT_IN_TRAY) {
            let item = MenuItemBuilder::with_id(format!("tray_repo_{}", repo.id), &repo.name)
                .build(app)?;
            menu.append(&item)?;
        }
    }

    menu.append(&PredefinedMenuItem::separator(app)?)?;

    let quit = MenuItemBuilder::with_id("tray_quit", "Quit Stage0").build(app)?;
    menu.append(&quit)?;

    Ok(menu)
}

pub fn setup_tray(
    app: &AppHandle,
    repositories: &[RepoInfo],
) -> Result<TrayIcon, Box<dyn std::error::Error>> {
    #[cfg(target_os = "linux")]
    if !linux_host::available() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "This Wayland session has no StatusNotifier tray host",
        )
        .into());
    }
    let menu = build_tray_menu(app, repositories)?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Stage0 — Virtual MR Sandbox")
        .menu(&menu)
        .show_menu_on_left_click(true);

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    } else if let Ok(image) = Image::from_bytes(include_bytes!("../../icons/32x32.png")) {
        builder = builder.icon(image);
    }

    let app_handle = app.clone();
    let tray = builder
        .on_menu_event(move |_app, event| {
            handle_tray_menu_event(&app_handle, event);
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(tray)
}

pub fn update_tray_menu(
    app: &AppHandle,
    repositories: &[RepoInfo],
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let menu = build_tray_menu(app, repositories)?;
        tray.set_menu(Some(menu))?;
    }
    Ok(())
}

pub fn handle_tray_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let id = event.id().as_ref();
    match id {
        "tray_new_window" => {
            if let Err(error) = create_welcome_window(app) {
                eprintln!("Failed to create new window from tray: {error}");
            }
        }
        "tray_quit" => {
            app.exit(0);
        }
        id if id.starts_with("tray_repo_") => {
            let repo_id = &id["tray_repo_".len()..];
            let db = app.state::<Database>();
            if let Ok(repos) = db.get_recent_repositories() {
                if let Some(repo) = repos.iter().find(|r| r.id == repo_id) {
                    if let Err(error) = open_repo_path(app, &repo.local_path, None, false) {
                        eprintln!("Failed to open recent repo from tray: {error}");
                    }
                }
            }
        }
        _ => {}
    }
}
