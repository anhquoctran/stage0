pub mod commands;
pub mod credentials;
pub mod db;
pub mod git;
pub mod watcher;

use db::Database;
use watcher::WatcherState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(WatcherState::new())
        .setup(|app| {
            let handle = app.handle();
            let db = Database::init(handle)
                .map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
            app.manage(db);

            #[cfg(target_os = "macos")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_decorations(true);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_repo_dialog,
            commands::open_repo_by_path,
            commands::get_recent_repos,
            commands::validate_repo,
            commands::delete_recent_repo,
            commands::get_branches,
            commands::get_mr_diff,
            commands::check_merge_conflicts,
            commands::run_git_sync,
            commands::list_git_remotes,
            commands::get_git_remote_url,
            commands::reveal_file_in_os,
            commands::open_repo_in,
            commands::check_rebase_status,
            commands::get_file_blame,
            commands::window_minimize,
            commands::window_toggle_maximize,
            commands::window_close,
            commands::window_is_maximized,
            commands::list_git_credentials,
            commands::save_git_credential,
            commands::delete_git_credential,
            commands::verify_git_credential,
            commands::get_keyring_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
