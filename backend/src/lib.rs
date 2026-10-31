pub mod common;
pub mod core;
pub mod features;

use crate::core::{commands, db, menu, window_manager};
use crate::features::git::watcher;
use crate::features::{credentials, notifications, performance, sandbox};
use db::Database;
use sandbox::SandboxManager;
use std::path::{Path, PathBuf};
use tauri::webview::PageLoadEvent;
use tauri::{Manager, WindowEvent};
use watcher::WatcherState;
use window_manager::{
    destroy_window, focus_window, focused_window, open_repo_path, WindowManagerState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut context = tauri::generate_context!();
    #[cfg(target_os = "macos")]
    if let Some(main_window) = context
        .config_mut()
        .app
        .windows
        .iter_mut()
        .find(|window| window.label == "main")
    {
        main_window.transparent = true;
        main_window.background_color = None;
    }
    #[cfg(not(dev))]
    let context = {
        let mut context = context;
        if let Some(main_window) = context
            .config_mut()
            .app
            .windows
            .iter_mut()
            .find(|window| window.label == "main")
        {
            main_window.url = tauri::WebviewUrl::CustomProtocol(
                tauri::Url::parse("stagezero://localhost")
                    .expect("Stage0's production URI scheme should be a valid URL"),
            );
        }
        context
    };

    #[cfg(all(target_os = "linux", dev))]
    if let Err(error) = core::desktop::initialize_dev_desktop(
        &context.config().identifier,
        context.config().product_name.as_deref().unwrap_or("Stage0"),
    ) {
        eprintln!("{error}");
    }

    let builder = tauri::Builder::default();
    let builder = builder.manage(features::review::coordinator::ReviewCoordinator::default());
    #[cfg(not(dev))]
    let builder = builder.register_uri_scheme_protocol("stagezero", |context, request| {
        let uri = request.uri();
        let scheme = uri.scheme_str().unwrap_or("stagezero");
        let origin = uri
            .authority()
            .map(|authority| format!("{scheme}://{authority}"))
            .unwrap_or_else(|| format!("{scheme}://localhost"));
        let path = uri.path().to_string();
        let use_https_scheme = scheme == "https";
        let response = context
            .app_handle()
            .asset_resolver()
            .get_for_scheme(path, use_https_scheme)
            .map(|asset| {
                let mut builder = tauri::http::Response::builder()
                    .status(tauri::http::StatusCode::OK)
                    .header("Access-Control-Allow-Origin", &origin)
                    .header(tauri::http::header::CONTENT_TYPE, asset.mime_type());
                if let Some(csp) = asset.csp_header() {
                    builder = builder.header(tauri::http::header::CONTENT_SECURITY_POLICY, csp);
                }
                builder
                    .body(asset.bytes)
                    .expect("Stage0 asset response should be valid")
            })
            .unwrap_or_else(|| {
                tauri::http::Response::builder()
                    .status(tauri::http::StatusCode::NOT_FOUND)
                    .header("Access-Control-Allow-Origin", &origin)
                    .body(b"Not Found".to_vec())
                    .expect("Stage0 404 response should be valid")
            });
        response
    });

    builder
        .on_page_load(|webview, payload| {
            if payload.event() == PageLoadEvent::Started { notifications::forget_window(webview.app_handle(), webview.window().label()); }
            if webview.label() != "main" || payload.event() != PageLoadEvent::Finished {
                return;
            }
            let manager = webview.state::<WindowManagerState>();
            if manager.should_show_main_on_page_load() {
                let window = webview.window();
                if let Err(error) = window.show() {
                    eprintln!("Could not show the main window after its splash loaded: {error}");
                } else {
                    let _ = window.set_focus();
                }
            }
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::Focused(true) => {
                    menu::sync_repo_dependent_menus_for_window(
                        &window.app_handle(), window.label(),
                    );
                }
                WindowEvent::Destroyed => {
                    if window.label() == window_manager::preferences_window::LABEL {
                        window.app_handle().state::<window_manager::PreferencesWindowState>().destroyed();
                    }
                    notifications::forget_window(window.app_handle(), window.label());
                    menu::forget_window(&window.app_handle(), window.label());
                    destroy_window(&window.app_handle(), window.label());
                }
                WindowEvent::CloseRequested { api, .. }
                    if window.label() == window_manager::preferences_window::LABEL
                        && window.app_handle().state::<window_manager::PreferencesWindowState>().is_ready() =>
                {
                    use tauri::Emitter;
                    api.prevent_close();
                    let _ = window.emit_to(window_manager::preferences_window::LABEL,
                        window_manager::preferences_window::CLOSE_EVENT, ());
                }
                _ => {}
            }
        })
        .plugin(
            tauri::plugin::Builder::<tauri::Wry>::new("context-menu-policy")
                .js_init_script(
                    r#"
                    document.addEventListener('contextmenu', (event) => {
                      const target = event.target;
                      if (
                        target instanceof Element &&
                        target.closest('input, textarea, [contenteditable="true"]')
                      ) {
                        return;
                      }
                      event.preventDefault();
                    }, true);

                    // Ensure $RefreshReg$ and $RefreshSig$ are globally safe fallbacks so Vite preamble never crashes
                    if (typeof window !== 'undefined') {
                      if (!window.$RefreshReg$) window.$RefreshReg$ = () => {};
                      if (!window.$RefreshSig$) window.$RefreshSig$ = () => (type) => type;
                    }
                    "#,
                )
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            if let Some(repo_path) = find_repo_argument(&args, Path::new(&cwd)) {
                if let Err(error) = open_repo_path(app, &repo_path, None, false) {
                    eprintln!("Could not route repository from second app launch: {error}");
                }
            } else if let Some(window) = focused_window(app) {
                let _ = focus_window(&window);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(WatcherState::new())
        .manage(SandboxManager::new())
        .manage(WindowManagerState::default())
        .manage(window_manager::PreferencesWindowState::default())
        .manage(menu::MenuRuntimeState::default())
        .manage(credentials::GitCredentialScanCoordinator::default())
        .manage(notifications::NotificationRuntime::default())
        .setup(|app| {
            let handle = app.handle();
            let preferences_dir = handle.path().app_data_dir()
                .map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
            let preferences = features::preferences::PreferencesManager::new(preferences_dir)
                .map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
            app.manage(preferences);
            app.manage(features::updates::UpdateRuntime::new());
            let db = Database::init(handle)
                .map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

            // Initialize active Git binary path from persisted settings
            if let Ok(Some(saved_path)) = db.get_setting("git_binary_path") {
                if !saved_path.trim().is_empty() && saved_path != "system" {
                    crate::features::git::runner::set_active_git_path(Some(saved_path));
                }
            }

            let initial_repos = db.get_recent_repositories().unwrap_or_default();
            app.manage(db);
            features::credentials::preference_snapshot::initialize(handle);
            features::preferences::recover_prepared_credentials(handle);

            let _ = crate::core::tray::setup_tray(handle, &initial_repos);
            crate::core::dock::setup_dock_menu(handle, &initial_repos);

            let args = std::env::args().collect::<Vec<_>>();
            let has_background_flag = args.iter().any(|arg| arg == "--background" || arg == "--hidden");
            let pref_start_in_background = app.state::<features::preferences::PreferencesManager>()
                .read().ok().and_then(|d| d.settings)
                .as_ref().and_then(|s| s.pointer("/general/startInBackground"))
                .and_then(serde_json::Value::as_bool).unwrap_or(false);

            let mut has_opened_repo = false;
            if let Ok(cwd) = std::env::current_dir() {
                if let Some(repo_path) = find_repo_argument(&args, &cwd) {
                    if let Err(error) = open_repo_path(app.handle(), &repo_path, Some("main"), false) {
                        eprintln!("Could not open repository passed on startup: {error}");
                    } else {
                        has_opened_repo = true;
                    }
                }
            }

            let show_main_on_page_load =
                !(has_background_flag || pref_start_in_background) || has_opened_repo;
            app.state::<WindowManagerState>()
                .set_show_main_on_page_load(show_main_on_page_load);

            if let Some(window) = app.get_webview_window("main") {
                app.state::<WindowManagerState>().register_welcome_window("main", true);
                if !show_main_on_page_load {
                    let _ = window.hide();
                } else if !has_opened_repo {
                    let _ = window.center();
                }
            }

            notifications::initialize(handle);
            features::updates::start_background_checks(handle);

            #[cfg(target_os = "macos")]
            {
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
            commands::get_window_startup_context,
            commands::create_new_window,
            commands::close_repository_window,
            commands::get_recent_repos,
            commands::validate_repo,
            commands::delete_recent_repo,
            commands::clear_recent_repos,
            menu::update_recent_repositories_menu,
            menu::update_application_menu_state,
            commands::get_branches,
            commands::get_current_branch_graph,
            commands::get_git_commit_message,
            commands::get_git_commit_details,
            commands::search_git_commit_messages,
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
            commands::open_webview_devtools,
            commands::window_toggle_maximize,
            commands::window_toggle_fullscreen,
            commands::window_maximize,
            commands::window_reset_size,
            commands::window_prepare_main,
            commands::get_window_chrome,
            commands::window_start_dragging,
            commands::window_close,
            commands::open_preferences_window,
            commands::preferences_window_ready,
            commands::close_preferences_window,
            commands::window_is_maximized,
            commands::window_is_fullscreen,
            commands::window_show,
            commands::list_git_credentials,
            commands::save_git_credential,
            commands::delete_git_credential,
            commands::verify_git_credential,
            commands::get_keyring_info,
            commands::store_ai_api_key,
            commands::commit_ai_preferences,
            commands::commit_preferences_transaction,
            commands::initialize_preferences,
            commands::load_preferences_json,
            commands::save_preferences_json,
            commands::patch_preferences,
            commands::reset_preferences_json,
            commands::list_system_font_families,
            commands::has_ai_api_key,
            commands::delete_ai_api_key,
            commands::open_external_url,
            features::ai::acp::acp_fetch_registry,
            features::ai::acp::acp_fetch_registry_icon,
            features::ai::acp::acp_prepare_registry_agent,
            features::ai::acp::acp_agent_auth_methods,
            features::ai::acp::acp_agent_connection_info,
            features::ai::acp::acp_agent_authenticate,
            features::ai::acp::acp_agent_logout,
            features::ai::acp::acp_agent_prompt,
            features::ai::acp::review_config::acp_agent_review_config_options,
            commands::start_ai_review,
            commands::test_ai_review_provider,
            commands::discover_harness_mcp,
            commands::inspect_harness_cli,
            commands::get_ai_review,
            commands::list_ai_reviews,
            commands::cancel_ai_review,
            commands::publish_ai_review,
            commands::fetch_ai_models,
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
            commands::get_clone_remote_refs,
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
            commands::get_git_ref_sha,
            commands::get_git_user_identity_cmd,
            // Discussions & Comments
            commands::list_mr_discussions,
            commands::create_mr_discussion,
            commands::add_mr_comment,
            commands::resolve_mr_discussion,
            commands::verify_mr_discussion,
            commands::reanchor_file_discussions,
            commands::save_mr_image_attachment,
            // Sandbox Synchronization & Tool Bridge
            commands::sync_active_sandbox,
            commands::get_sandbox_tool_schemas,
            commands::dispatch_sandbox_tool,
            // AI & MCP Security Guardrails
            commands::get_guardrail_policy,
            commands::update_guardrail_policy,
            commands::reset_guardrail_policy,
            commands::get_guardrail_audit_log,
            commands::clear_guardrail_audit_log,
            commands::simulate_guardrail_check,
            // Git Binary Management & App Lifecycle
            commands::scan_git_binaries,
            commands::get_active_git_binary,
            commands::set_active_git_binary,
            commands::validate_custom_git_binary,
            commands::pick_git_executable,
            commands::restart_app,
            commands::get_app_info,
            commands::get_release_notes,
            commands::get_software_update_status,
            commands::check_software_update,
            commands::download_software_update,
            commands::install_software_update,
            commands::consume_software_update_release_notes,
            // Native OS notifications
            notifications::dispatch_notification,
            notifications::send_test_notification,
            notifications::set_notification_service_ready,
            notifications::get_notification_permission,
            notifications::request_notification_permission,
            notifications::open_notification_settings,
            notifications::dispatch_notification_action,
            performance::get_performance_metrics,
        ])
        .build(context)
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                for error in app.state::<SandboxManager>().cleanup_all() {
                    eprintln!("{error}");
                }
            }
        });
}

fn find_repo_argument(args: &[String], cwd: &Path) -> Option<String> {
    let mut explicit_next = false;
    for argument in args {
        if explicit_next {
            explicit_next = false;
            let candidate = PathBuf::from(argument);
            let candidate = if candidate.is_absolute() {
                candidate
            } else {
                cwd.join(candidate)
            };
            if candidate.is_dir() && candidate.join(".git").exists() {
                return Some(candidate.to_string_lossy().into_owned());
            }
            continue;
        }

        if argument == "--open-repo" {
            explicit_next = true;
            continue;
        }
        if argument.starts_with('-') {
            continue;
        }

        let candidate = PathBuf::from(argument);
        let candidate = if candidate.is_absolute() {
            candidate
        } else {
            cwd.join(candidate)
        };
        if candidate.is_dir() && candidate.join(".git").exists() {
            return Some(candidate.to_string_lossy().into_owned());
        }
    }
    None
}
