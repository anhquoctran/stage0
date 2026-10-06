use tauri::{
    menu::{IconMenuItemBuilder, Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, Submenu, SubmenuBuilder},
    AppHandle, Emitter, Manager, Wry,
};
use crate::git::RepoInfo;
use crate::window_manager::{create_welcome_window, focused_window, WindowManagerState};

pub fn sync_repo_dependent_menus_for_window(app: &AppHandle, window_label: &str) {
    let enabled = app
        .try_state::<WindowManagerState>()
        .is_some_and(|manager| manager.has_repository(window_label));

    let Some(app_menu) = app.menu() else {
        return;
    };
    if let Some(repository_menu) = app_menu
        .get("repository_menu")
        .and_then(|item| item.as_submenu().cloned())
    {
        let _ = repository_menu.set_enabled(enabled);
    }

    if let Some(view_menu) = app_menu
        .get("view_menu")
        .and_then(|item| item.as_submenu().cloned())
    {
        for item_id in [
            "view_split",
            "view_unified",
            "toggle_blame",
            "toggle_inline_blame",
        ] {
            if let Some(item) = view_menu.get(item_id).and_then(|item| item.as_menuitem().cloned()) {
                let _ = item.set_enabled(enabled);
            }
        }
    }

    if let Some(edit_menu) = app_menu
        .get("edit_menu")
        .and_then(|item| item.as_submenu().cloned())
    {
        for item_id in ["view_blame", "copy_rel_path"] {
            if let Some(item) = edit_menu.get(item_id).and_then(|item| item.as_menuitem().cloned()) {
                let _ = item.set_enabled(enabled);
            }
        }
    }
}

#[tauri::command]
pub fn update_recent_repositories_menu(
    app: AppHandle,
    repositories: Vec<RepoInfo>,
) -> Result<(), String> {
    let Some(app_menu) = app.menu() else {
        return Ok(());
    };
    let Some(file_menu) = app_menu
        .get("file_menu")
        .and_then(|item| item.as_submenu().cloned())
    else {
        return Ok(());
    };
    let Some(recent_menu) = file_menu
        .get("open_recent")
        .and_then(|item| item.as_submenu().cloned())
    else {
        return Ok(());
    };

    let existing_items = recent_menu.items().map_err(|error| error.to_string())?;
    for item in existing_items {
        let id = item.id().as_ref();
        if id == "no_recent_repos" || id.starts_with("recent_repo_") {
            recent_menu
                .remove(&item)
                .map_err(|error| error.to_string())?;
        }
    }

    if repositories.is_empty() {
        let item = MenuItemBuilder::with_id("no_recent_repos", "No Recent Repositories")
            .enabled(false)
            .build(&app)
            .map_err(|error| error.to_string())?;
        recent_menu
            .append(&item)
            .map_err(|error| error.to_string())?;
    } else {
        for repository in repositories {
            let item = MenuItemBuilder::with_id(
                format!("recent_repo_{}", repository.id),
                repository.name,
            )
            .build(&app)
            .map_err(|error| error.to_string())?;
            recent_menu
                .append(&item)
                .map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

pub fn create_macos_menu(app: &AppHandle) -> Result<Menu<Wry>, Box<dyn std::error::Error>> {
    let repository_menu_enabled = focused_window(app).is_some_and(|window| {
        app.state::<WindowManagerState>()
            .has_repository(window.label())
    });

    // 1. Application Menu (App name "Stage0" in bold on macOS)
    let app_submenu = SubmenuBuilder::new(app, "Stage0")
        .item(&MenuItemBuilder::with_id("about", "About Stage0").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("preferences", "Preferences...").accelerator("CmdOrCtrl+,").build(app)?)
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some("Hide Stage0"))?)
        .item(&PredefinedMenuItem::hide_others(app, Some("Hide Others"))?)
        .item(&PredefinedMenuItem::show_all(app, Some("Show All"))?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("Quit Stage0"))?)
        .build()?;

    // 2. File Menu
    let file_submenu = SubmenuBuilder::with_id(app, "file_menu", "File")
        .item(&MenuItemBuilder::with_id("open_repo", "Open...").accelerator("CmdOrCtrl+O").build(app)?)
        .item(&MenuItemBuilder::with_id("open_repo_new_window", "Open in New Window...").build(app)?)
        .item(&MenuItemBuilder::with_id("clone_repo", "Clone...").accelerator("CmdOrCtrl+Shift+O").build(app)?)
        .item(&recent_repositories_submenu(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("new_window", "New Window").accelerator("CmdOrCtrl+Shift+N").build(app)?)
        .item(&MenuItemBuilder::with_id("close_repo", "Close Repository").build(app)?)
        .item(&MenuItemBuilder::with_id("close_window", "Close Window").accelerator("CmdOrCtrl+W").build(app)?)
        .build()?;

    // 3. Edit Menu
    let edit_submenu = SubmenuBuilder::with_id(app, "edit_menu", "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .item(&MenuItemBuilder::with_id("view_blame", "View Git Blame").accelerator("Alt+B").enabled(repository_menu_enabled).build(app)?)
        .item(&MenuItemBuilder::with_id("copy_rel_path", "Copy Relative Path").accelerator("CmdOrCtrl+Shift+C").enabled(repository_menu_enabled).build(app)?)
        .build()?;

    let performance_item = IconMenuItemBuilder::with_id(
        "toggle_perf_monitor",
        "Display Perf Monitor",
    )
    .icon(performance_menu_icon())
    .accelerator("CmdOrCtrl+Shift+F12")
    .build(app)?;
    let performance_submenu = SubmenuBuilder::new(app, "Performance")
        .item(&performance_item)
        .build()?;

    // 4. View Menu
    let view_submenu = SubmenuBuilder::with_id(app, "view_menu", "View")
        .item(&MenuItemBuilder::with_id("view_split", "Side-by-side (Split)").accelerator("CmdOrCtrl+1").enabled(repository_menu_enabled).build(app)?)
        .item(&MenuItemBuilder::with_id("view_unified", "Inline (Unified)").accelerator("CmdOrCtrl+2").enabled(repository_menu_enabled).build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("toggle_blame", "Toggle File Blame").enabled(repository_menu_enabled).build(app)?)
        .item(&MenuItemBuilder::with_id("toggle_inline_blame", "Toggle Inline Blame").accelerator("Alt+Shift+B").enabled(repository_menu_enabled).build(app)?)
        .separator()
        .item(&performance_submenu)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;

    // 5. Repository Menu
    let repo_submenu = SubmenuBuilder::with_id(app, "repository_menu", "Repository")
        .enabled(repository_menu_enabled)
        .item(&MenuItemBuilder::with_id("new_mr", "New Virtual MR...").accelerator("CmdOrCtrl+T").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("fetch", "Fetch (All & Prune)").accelerator("CmdOrCtrl+Shift+F").build(app)?)
        .item(&MenuItemBuilder::with_id("pull", "Pull").accelerator("CmdOrCtrl+Shift+P").build(app)?)
        .item(&MenuItemBuilder::with_id("rebase", "Rebase").accelerator("CmdOrCtrl+Shift+R").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("repo_settings", "Repository Settings...").accelerator("CmdOrCtrl+Alt+S").build(app)?)
        .build()?;

    // 6. Window Menu
    let window_submenu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .item(&MenuItemBuilder::with_id("zoom", "Zoom").build(app)?)
        .separator()
        .item(&PredefinedMenuItem::bring_all_to_front(app, None)?)
        .build()?;

    // 7. Help Menu
    let help_submenu = SubmenuBuilder::new(app, "Help")
        .item(&MenuItemBuilder::with_id("shortcuts", "Keyboard Shortcuts").accelerator("CmdOrCtrl+/").build(app)?)
        .item(&MenuItemBuilder::with_id("open_webview_devtools", "Developer Tools").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("about", "About Stage0").build(app)?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &app_submenu,
            &file_submenu,
            &edit_submenu,
            &view_submenu,
            &repo_submenu,
            &window_submenu,
            &help_submenu,
        ])
        .build()?;

    Ok(menu)
}

fn performance_menu_icon() -> tauri::image::Image<'static> {
    const SIZE: usize = 20;
    const PURPLE: [u8; 4] = [190, 140, 255, 255];
    let points = [(1_i32, 10_i32), (5, 10), (7, 6), (10, 14), (13, 7), (15, 10), (18, 10)];
    let mut rgba = vec![0_u8; SIZE * SIZE * 4];

    for pair in points.windows(2) {
        let (mut x, mut y) = pair[0];
        let (end_x, end_y) = pair[1];
        let dx = (end_x - x).abs();
        let sx = if x < end_x { 1 } else { -1 };
        let dy = -(end_y - y).abs();
        let sy = if y < end_y { 1 } else { -1 };
        let mut error = dx + dy;
        loop {
            for offset_y in -1_i32..=1 {
                for offset_x in -1_i32..=1 {
                    if offset_x.abs() + offset_y.abs() > 1 {
                        continue;
                    }
                    let px = x + offset_x;
                    let py = y + offset_y;
                    if px >= 0 && py >= 0 && px < SIZE as i32 && py < SIZE as i32 {
                        let index = (py as usize * SIZE + px as usize) * 4;
                        rgba[index..index + 4].copy_from_slice(&PURPLE);
                    }
                }
            }
            if x == end_x && y == end_y {
                break;
            }
            let doubled_error = 2 * error;
            if doubled_error >= dy {
                error += dy;
                x += sx;
            }
            if doubled_error <= dx {
                error += dx;
                y += sy;
            }
        }
    }

    tauri::image::Image::new_owned(rgba, SIZE as u32, SIZE as u32)
}

fn recent_repositories_submenu(app: &AppHandle) -> Result<Submenu<Wry>, Box<dyn std::error::Error>> {
    let submenu = Submenu::with_id(app, "open_recent", "Recents", true)?;
    let placeholder = MenuItemBuilder::with_id("no_recent_repos", "No Recent Repositories")
        .enabled(false)
        .build(app)?;
    submenu.append(&placeholder)?;
    Ok(submenu)
}

pub fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let id = event.id().as_ref();
    match id {
        "zoom" => {
            if let Some(window) = focused_window(app) {
                if let Ok(is_max) = window.is_maximized() {
                    if is_max {
                        let _ = window.unmaximize();
                    } else {
                        let _ = window.maximize();
                    }
                }
            }
        }
        "new_window" => {
            if let Err(error) = create_welcome_window(app) {
                eprintln!("Could not create a new window: {error}");
            }
        }
        "close_window" => {
            if let Some(window) = focused_window(app) {
                let _ = window.close();
            }
        }
        action => {
            if let Some(window) = focused_window(app) {
                let _ = window.emit("menu-action", action.to_string());
            }
        }
    }
}
