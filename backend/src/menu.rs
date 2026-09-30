use tauri::{
    menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Emitter, Manager, Wry,
};

pub fn create_macos_menu(app: &AppHandle) -> Result<Menu<Wry>, Box<dyn std::error::Error>> {
    // 1. Application Menu (App name "Stage0" in bold on macOS)
    let app_submenu = SubmenuBuilder::new(app, "Stage0")
        .item(&PredefinedMenuItem::about(app, Some("About Stage0"), None)?)
        .separator()
        .item(&MenuItemBuilder::with_id("preferences", "Preferences...").accelerator("CmdOrCtrl+,").build(app)?)
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some("Hide Stage0"), None)?)
        .item(&PredefinedMenuItem::hide_others(app, Some("Hide Others"), None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("Quit Stage0"), None)?)
        .build()?;

    // 2. File Menu
    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(&MenuItemBuilder::with_id("open_repo", "Open Repository...").accelerator("CmdOrCtrl+O").build(app)?)
        .item(&MenuItemBuilder::with_id("clone_repo", "Clone Repository...").accelerator("CmdOrCtrl+Shift+O").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("close_repo", "Close Repository").accelerator("CmdOrCtrl+W").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("preferences_file", "Preferences...").accelerator("CmdOrCtrl+,").build(app)?)
        .build()?;

    // 3. Edit Menu
    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .item(&MenuItemBuilder::with_id("view_blame", "View Git Blame").accelerator("Alt+B").build(app)?)
        .item(&MenuItemBuilder::with_id("copy_rel_path", "Copy Relative Path").accelerator("CmdOrCtrl+Shift+C").build(app)?)
        .build()?;

    // 4. View Menu
    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(&MenuItemBuilder::with_id("view_split", "Side-by-side (Split)").accelerator("CmdOrCtrl+1").build(app)?)
        .item(&MenuItemBuilder::with_id("view_unified", "Inline (Unified)").accelerator("CmdOrCtrl+2").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("toggle_blame", "Toggle File Blame").build(app)?)
        .item(&MenuItemBuilder::with_id("toggle_inline_blame", "Toggle Inline Blame").accelerator("Alt+Shift+B").build(app)?)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;

    // 5. Repository Menu
    let repo_submenu = SubmenuBuilder::new(app, "Repository")
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

pub fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let id = event.id().as_ref();
    match id {
        "zoom" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.toggle_maximize();
            }
        }
        action => {
            let _ = app.emit("menu-action", action);
        }
    }
}
