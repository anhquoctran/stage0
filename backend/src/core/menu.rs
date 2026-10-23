mod command;
mod definition;
mod flags;
mod native;
mod node;
mod runtime_state;
#[cfg(test)]
mod tests;

pub use native::create_macos_menu;
// Tauri command macros must be re-exported alongside the command.
pub use runtime_state::*;

use crate::core::window_manager::{create_welcome_window, focused_window};
use crate::features::git::RepoInfo;
use tauri::{
    menu::{MenuItemBuilder, PredefinedMenuItem, Submenu},
    AppHandle, Emitter,
};

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
        if id == "no_recent_repos"
            || id == "clear_recent"
            || id == "remove_recent_menu"
            || id.starts_with("recent_repo_")
            || item.as_predefined_menuitem().is_some()
        {
            recent_menu
                .remove(&item)
                .map_err(|error| error.to_string())?;
        }
    }

    if repositories.is_empty() {
        let item = MenuItemBuilder::with_id(
            "no_recent_repos",
            &definition::definition().recent["emptyLabel"],
        )
        .enabled(false)
        .build(&app)
        .map_err(|error| error.to_string())?;
        recent_menu
            .append(&item)
            .map_err(|error| error.to_string())?;
    } else {
        for repository in &repositories {
            let item = MenuItemBuilder::with_id(
                format!("recent_repo_{}", repository.id),
                &repository.name,
            )
            .build(&app)
            .map_err(|error| error.to_string())?;
            recent_menu
                .append(&item)
                .map_err(|error| error.to_string())?;
        }
        recent_menu
            .append(&PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        let remove = Submenu::with_id(
            &app,
            "remove_recent_menu",
            &definition::definition().recent["removeLabel"],
            true,
        )
        .map_err(|e| e.to_string())?;
        for repository in &repositories {
            remove
                .append(
                    &MenuItemBuilder::with_id(
                        format!("remove_recent_repo_{}", repository.id),
                        &repository.name,
                    )
                    .build(&app)
                    .map_err(|e| e.to_string())?,
                )
                .map_err(|e| e.to_string())?;
        }
        recent_menu.append(&remove).map_err(|e| e.to_string())?;
        let command = &definition::definition().commands["clear_recent"];
        recent_menu
            .append(
                &MenuItemBuilder::with_id("clear_recent", &command.label)
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
    }

    Ok(())
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
