pub mod commands;
pub mod credentials;
pub mod db;
pub mod git;
pub mod menu;
pub mod sandbox;
pub mod watcher;

use db::Database;
use sandbox::SandboxManager;
use watcher::WatcherState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(WatcherState::new())
        .manage(SandboxManager::new())
        .setup(|app| {
            let handle = app.handle();
            let db = Database::init(handle)
                .map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

            // Initialize active Git binary path from persisted settings
            if let Ok(Some(saved_path)) = db.get_setting("git_binary_path") {
                if !saved_path.trim().is_empty() && saved_path != "system" {
                    crate::git::runner::set_active_git_path(Some(saved_path));
                }
            }

            app.manage(db);

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize {
                    width: 1024.0,
                    height: 680.0,
                })));
                let _ = window.maximize();
            }

            #[cfg(target_os = "macos")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_decorations(false);
                }
                if let Ok(m) = menu::create_macos_menu(handle) {
                    let _ = handle.set_menu(m);
                }
            }

            let app_handle = app.handle().clone();
            app.on_menu_event(move |_app, event| {
                menu::handle_menu_event(&app_handle, event);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_repo_dialog,
            commands::open_repo_by_path,
            commands::get_recent_repos,
            commands::validate_repo,
            commands::delete_recent_repo,
            commands::clear_recent_repos,
            commands::get_branches,
            commands::get_mr_diff,
            commands::check_merge_conflicts,
            commands::get_conflicted_file_preview,
            commands::run_git_sync,
            commands::list_git_remotes,
            commands::get_git_remote_url,
            commands::reveal_file_in_os,
            commands::open_repo_in,
            commands::open_file_in_editor,
            commands::check_rebase_status,
            commands::get_file_blame,
            commands::window_minimize,
            commands::window_toggle_maximize,
            commands::window_close,
            commands::window_is_maximized,
            commands::window_show,
            commands::list_git_credentials,
            commands::save_git_credential,
            commands::delete_git_credential,
            commands::verify_git_credential,
            commands::get_keyring_info,
            commands::get_available_sandboxes,
            commands::get_active_sandbox,
            commands::set_active_sandbox,
            commands::create_sandbox_instance,
            commands::destroy_sandbox_instance,
            commands::list_sandbox_instances,
            commands::execute_sandbox_command,
            commands::pick_folder,
            commands::clone_repository,
            commands::check_remote_repo_url,
            // Repo Settings & Labels
            commands::get_repo_settings,
            commands::save_repo_settings,
            commands::list_repo_labels,
            commands::create_repo_label,
            commands::update_repo_label,
            commands::delete_repo_label,
            // Git Remotes Detailed & Connectivity
            commands::list_git_remotes_detailed,
            commands::add_git_remote,
            commands::remove_git_remote,
            commands::set_git_remote_url,
            commands::test_git_remote,
            // Git Branches & Tags
            commands::list_git_tags,
            commands::create_git_tag,
            commands::delete_git_tag,
            commands::create_git_branch,
            commands::delete_git_branch,
            commands::rename_git_branch,
            // Virtual MR Sessions, Commits & Identity
            commands::list_virtual_mr_sessions,
            commands::save_virtual_mr_session,
            commands::delete_virtual_mr_session,
            commands::get_commits_between_refs,
            commands::get_git_user_identity_cmd,
            // Discussions & Comments
            commands::list_mr_discussions,
            commands::create_mr_discussion,
            commands::add_mr_comment,
            commands::resolve_mr_discussion,
            commands::verify_mr_discussion,
            // Git Binary Management & App Lifecycle
            commands::scan_git_binaries,
            commands::get_active_git_binary,
            commands::set_active_git_binary,
            commands::validate_custom_git_binary,
            commands::pick_git_executable,
            commands::restart_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
