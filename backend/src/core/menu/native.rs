use super::{
    definition::{definition, nodes_for_platform},
    flags::MenuFlags,
    node::MenuNode,
    runtime_state::window_flags,
};
use crate::core::window_manager::focused_window;
use tauri::{
    menu::{
        CheckMenuItemBuilder, Menu, MenuItemBuilder, MenuItemKind, PredefinedMenuItem, Submenu,
    },
    AppHandle, Wry,
};

pub fn create_macos_menu(app: &AppHandle) -> Result<Menu<Wry>, Box<dyn std::error::Error>> {
    let flags = focused_window(app)
        .map(|window| window_flags(app, window.label()))
        .unwrap_or_default();
    let menu = Menu::new(app)?;
    let language = super::runtime_state::app_language(app);
    for node in nodes_for_platform(&definition().menus, "macos") {
        menu.append(&build_node(app, node, &flags, &language)?)?;
    }
    Ok(menu)
}

fn build_node(
    app: &AppHandle,
    node: &MenuNode,
    flags: &MenuFlags,
    language: &str,
) -> tauri::Result<MenuItemKind<Wry>> {
    if node.separator {
        return Ok(MenuItemKind::Predefined(PredefinedMenuItem::separator(
            app,
        )?));
    }
    if let Some(id) = &node.command {
        let command = &definition().commands[id];
        let title = super::localized_menu_label(&command.label, language, "macos");
        if let Some(role) = &command.native {
            return predefined(app, role, &title);
        }
        let enabled = if flags.onboarding {
            false
        } else {
            flags.enabled(&command.requires)
        };
        if let Some(key) = &command.checked {
            let builder = CheckMenuItemBuilder::with_id(id, title)
                .enabled(enabled)
                .checked(!flags.onboarding && flags.value(key));
            return Ok(MenuItemKind::Check(builder.build(app)?));
        }
        // Remappable accelerators are installed from the hydrated window keymap,
        // never from stale defaults while preferences are still loading.
        let builder = MenuItemBuilder::with_id(id, title).enabled(enabled);
        return Ok(MenuItemKind::MenuItem(builder.build(app)?));
    }
    let submenu = Submenu::with_id(
        app,
        node.id.as_deref().unwrap_or_default(),
        node.label
            .as_deref()
            .map(|key| super::localized_menu_label(key, language, "macos"))
            .as_deref()
            .unwrap_or_default(),
        if flags.onboarding {
            node.id.as_deref() == Some("application_menu")
        } else {
            flags.enabled(&node.requires)
        },
    )?;
    if node.dynamic.as_deref() == Some("recentRepositories") {
        submenu.append(
            &MenuItemBuilder::with_id(
                "no_recent_repos",
                super::localized_menu_label(&definition().recent["emptyLabel"], language, "macos"),
            )
            .enabled(false)
            .build(app)?,
        )?;
    } else {
        for child in nodes_for_platform(&node.items, "macos") {
            submenu.append(&build_node(app, child, flags, language)?)?;
        }
    }
    Ok(MenuItemKind::Submenu(submenu))
}

fn predefined(app: &AppHandle, role: &str, title: &str) -> tauri::Result<MenuItemKind<Wry>> {
    let text = Some(title);
    let item = match role {
        "undo" => PredefinedMenuItem::undo(app, text)?,
        "redo" => PredefinedMenuItem::redo(app, text)?,
        "cut" => PredefinedMenuItem::cut(app, text)?,
        "copy" => PredefinedMenuItem::copy(app, text)?,
        "paste" => PredefinedMenuItem::paste(app, text)?,
        "select_all" => PredefinedMenuItem::select_all(app, text)?,
        "services" => PredefinedMenuItem::services(app, text)?,
        "hide" => PredefinedMenuItem::hide(app, text)?,
        "hide_others" => PredefinedMenuItem::hide_others(app, text)?,
        "show_all" => PredefinedMenuItem::show_all(app, text)?,
        "quit" => PredefinedMenuItem::quit(app, text)?,
        "fullscreen" => PredefinedMenuItem::fullscreen(app, text)?,
        "minimize" => PredefinedMenuItem::minimize(app, text)?,
        "bring_all_to_front" => PredefinedMenuItem::bring_all_to_front(app, text)?,
        _ => unreachable!("menu native roles are validated by tests"),
    };
    Ok(MenuItemKind::Predefined(item))
}
