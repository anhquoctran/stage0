use super::{definition::definition, flags::MenuFlags, node::MenuNode};
use crate::core::window_manager::{focused_window, WindowManagerState};
use std::{collections::HashMap, sync::Mutex};
use tauri::{menu::MenuItemKind, AppHandle, Manager, WebviewWindow, Wry};

#[derive(Default)]
pub struct MenuRuntimeState(pub Mutex<HashMap<String, MenuFlags>>);

pub fn window_flags(app: &AppHandle, window_label: &str) -> MenuFlags {
    let mut flags = app
        .try_state::<MenuRuntimeState>()
        .and_then(|state| state.0.lock().ok()?.get(window_label).cloned())
        .unwrap_or_default();
    // Repository identity is authoritative in the native window manager.
    flags.repository = app
        .try_state::<WindowManagerState>()
        .is_some_and(|manager| manager.has_repository(window_label));
    flags
}

pub fn sync_repo_dependent_menus_for_window(app: &AppHandle, window_label: &str) {
    if focused_window(app).is_some_and(|window| window.label() != window_label) {
        return;
    }
    if let Some(menu) = app.menu() {
        sync_items(
            menu.items().unwrap_or_default(),
            &window_flags(app, window_label),
        );
    }
}

fn sync_items(items: Vec<MenuItemKind<Wry>>, flags: &MenuFlags) {
    for item in items {
        match item {
            MenuItemKind::Submenu(submenu) => {
                if let Some(requires) = node_requires(&definition().menus, submenu.id().as_ref()) {
                    let _ = submenu.set_enabled(flags.enabled(requires));
                }
                sync_items(submenu.items().unwrap_or_default(), flags);
            }
            MenuItemKind::MenuItem(item) => {
                if let Some(command) = definition().commands.get(item.id().as_ref()) {
                    let _ = item.set_enabled(flags.enabled(&command.requires));
                }
            }
            MenuItemKind::Check(item) => {
                if let Some(command) = definition().commands.get(item.id().as_ref()) {
                    let _ = item.set_enabled(flags.enabled(&command.requires));
                    let _ = item
                        .set_checked(command.checked.as_ref().is_some_and(|key| flags.value(key)));
                }
            }
            _ => {}
        }
    }
}

fn node_requires<'a>(nodes: &'a [MenuNode], id: &str) -> Option<&'a [String]> {
    for node in nodes {
        if node.id.as_deref() == Some(id) {
            return Some(&node.requires);
        }
        if let Some(requires) = node_requires(&node.items, id) {
            return Some(requires);
        }
    }
    None
}

#[tauri::command]
pub fn update_application_menu_state(app: AppHandle, window: WebviewWindow, flags: MenuFlags) {
    if let Some(state) = app.try_state::<MenuRuntimeState>() {
        if let Ok(mut windows) = state.0.lock() {
            windows.insert(window.label().to_owned(), flags);
        }
    }
    sync_repo_dependent_menus_for_window(&app, window.label());
}

pub fn forget_window(app: &AppHandle, label: &str) {
    if let Some(state) = app.try_state::<MenuRuntimeState>() {
        if let Ok(mut windows) = state.0.lock() {
            windows.remove(label);
        }
    }
}
