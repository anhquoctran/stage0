use super::{definition::definition, flags::MenuFlags, keymap::NativeMenuKeymap, node::MenuNode};
use crate::core::window_manager::{focused_window, WindowManagerState};
use std::{collections::HashMap, sync::Mutex};
use tauri::{menu::MenuItemKind, AppHandle, Manager, WebviewWindow, Wry};

#[derive(Default)]
pub struct MenuRuntimeState {
    pub flags: Mutex<HashMap<String, MenuFlags>>,
    pub keymaps: Mutex<HashMap<String, NativeMenuKeymap>>,
    pub language: Mutex<String>,
}

pub fn window_flags(app: &AppHandle, window_label: &str) -> MenuFlags {
    let mut flags = app
        .try_state::<MenuRuntimeState>()
        .and_then(|state| state.flags.lock().ok()?.get(window_label).cloned())
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
        let keymap = app
            .try_state::<MenuRuntimeState>()
            .and_then(|state| state.keymaps.lock().ok()?.get(window_label).cloned());
        sync_items(
            menu.items().unwrap_or_default(),
            &window_flags(app, window_label),
            keymap.as_ref(),
            app_language(app),
        );
    }
}

pub(super) fn app_language(app: &AppHandle) -> String {
    app.try_state::<MenuRuntimeState>()
        .and_then(|state| state.language.lock().ok().map(|language| language.clone()))
        .filter(|language| crate::features::preferences::is_supported_app_language(language))
        .unwrap_or_else(|| crate::features::preferences::DEFAULT_APP_LANGUAGE.to_string())
}

fn sync_items(
    items: Vec<MenuItemKind<Wry>>,
    flags: &MenuFlags,
    keymap: Option<&NativeMenuKeymap>,
    language: String,
) {
    let onboarding = flags.onboarding;
    for item in items {
        match item {
            MenuItemKind::Submenu(submenu) => {
                let id = submenu.id();
                let label_key = node_label_key(&definition().menus, id.as_ref());
                if let Some(label_key) = label_key {
                    let _ = submenu
                        .set_text(super::localized_menu_label(label_key, &language, "macos"));
                }
                let is_app_menu = id.as_ref() == "application_menu";
                if onboarding {
                    let _ = submenu.set_enabled(is_app_menu);
                } else if let Some(requires) = node_requires(&definition().menus, id.as_ref()) {
                    let _ = submenu.set_enabled(flags.enabled(requires));
                } else {
                    let _ = submenu.set_enabled(true);
                }
                sync_items(
                    submenu.items().unwrap_or_default(),
                    flags,
                    if onboarding { None } else { keymap },
                    language.clone(),
                );
            }
            MenuItemKind::MenuItem(item) => {
                let Some(command) = definition().commands.get(item.id().as_ref()) else {
                    continue;
                };
                let _ = item.set_text(super::localized_menu_label(
                    &command.label,
                    &language,
                    "macos",
                ));
                if onboarding {
                    let _ = item.set_enabled(false);
                    let _ = item.set_accelerator(None::<&str>);
                } else {
                    let _ = item.set_enabled(flags.enabled(&command.requires));
                    if let Some(keymap) = keymap {
                        let _ = item.set_accelerator(keymap.accelerators.get(item.id().as_ref()));
                        let _ = item.set_text(keymap.title(item.id().as_ref(), &language));
                    }
                }
            }
            MenuItemKind::Check(item) => {
                let Some(command) = definition().commands.get(item.id().as_ref()) else {
                    continue;
                };
                let _ = item.set_text(super::localized_menu_label(
                    &command.label,
                    &language,
                    "macos",
                ));
                if onboarding {
                    let _ = item.set_enabled(false);
                    let _ = item.set_accelerator(None::<&str>);
                } else {
                    let _ = item.set_enabled(flags.enabled(&command.requires));
                    let _ = item
                        .set_checked(command.checked.as_ref().is_some_and(|key| flags.value(key)));
                    if let Some(keymap) = keymap {
                        let _ = item.set_accelerator(keymap.accelerators.get(item.id().as_ref()));
                        let _ = item.set_text(keymap.title(item.id().as_ref(), &language));
                    }
                }
            }
            MenuItemKind::Predefined(item) => {
                if let Some(command) = definition().commands.get(item.id().as_ref()) {
                    let _ = item.set_text(super::localized_menu_label(
                        &command.label,
                        &language,
                        "macos",
                    ));
                }
            }
            _ => {}
        }
    }
}

fn node_label_key<'a>(nodes: &'a [MenuNode], id: &str) -> Option<&'a str> {
    for node in nodes {
        if node.id.as_deref() == Some(id) {
            return node.label.as_deref();
        }
        if let Some(label) = node_label_key(&node.items, id) {
            return Some(label);
        }
    }
    None
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
pub fn update_application_menu_state(
    app: AppHandle,
    window: WebviewWindow,
    flags: MenuFlags,
    language: String,
    accelerators: Option<HashMap<String, String>>,
    shortcut_labels: Option<HashMap<String, String>>,
) -> Result<(), String> {
    let result = (|| -> Result<_, String> {
        set_application_menu_language(&app, &language)?;
        let keymap = accelerators
            .map(|keys| NativeMenuKeymap::from_input(keys, shortcut_labels.unwrap_or_default()))
            .transpose()?;
        if let Some(state) = app.try_state::<MenuRuntimeState>() {
            if let Ok(mut windows) = state.flags.lock() {
                windows.insert(window.label().to_owned(), flags);
            }
            if let Some(keymap) = keymap {
                if let Ok(mut windows) = state.keymaps.lock() {
                    windows.insert(window.label().to_owned(), keymap);
                }
            }
        }
        sync_repo_dependent_menus_for_window(&app, window.label());
        Ok(())
    })();
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

pub fn set_application_menu_language(app: &AppHandle, language: &str) -> Result<(), String> {
    if !crate::features::preferences::is_supported_app_language(language) {
        return Err(crate::common::messages::code(
            "backend.preferences.unsupportedLanguage",
        ));
    }
    if let Some(state) = app.try_state::<MenuRuntimeState>() {
        *state
            .language
            .lock()
            .map_err(|_| "Native menu state is unavailable")? = language.to_owned();
    }
    if let Some(window) = focused_window(app) {
        sync_repo_dependent_menus_for_window(app, window.label());
    }
    Ok(())
}

pub fn forget_window(app: &AppHandle, label: &str) {
    if let Some(state) = app.try_state::<MenuRuntimeState>() {
        if let Ok(mut windows) = state.flags.lock() {
            windows.remove(label);
        }
        if let Ok(mut windows) = state.keymaps.lock() {
            windows.remove(label);
        }
    }
}
