mod repo_identity;
pub use repo_identity::RepoIdentity;
mod repository_context;
pub use repository_context::RepositoryContext;
mod window_record;
use window_record::WindowRecord;
mod registry;
use registry::Registry;
mod window_manager_state;
pub use window_manager_state::WindowManagerState;
mod preferences_window_state;
pub use preferences_window_state::PreferencesWindowState;
mod open_repo_outcome;
pub mod preferences_window;
pub use open_repo_outcome::OpenRepoOutcome;
mod window_startup_context;
pub use window_startup_context::WindowStartupContext;
mod open_plan;
use open_plan::OpenPlan;
#[cfg(target_os = "windows")]
mod snap_layout;
pub mod startup_window;
use startup_window::{request_maximize, SPLASH_HEIGHT, SPLASH_WIDTH};
#[cfg(test)]
mod startup_window_tests;

#[cfg(unix)]
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::core::db::Database;
use crate::features::git::watcher::WatcherState;

pub const fn default_window_size() -> (f64, f64) {
    (1280.0, 840.0)
}

pub const fn minimum_window_size() -> (f64, f64) {
    #[cfg(target_os = "macos")]
    {
        (1024.0, 768.0)
    }
    #[cfg(not(target_os = "macos"))]
    {
        (1120.0, 800.0)
    }
}

pub fn app_webview_url(app: &AppHandle, path: &str) -> WebviewUrl {
    let custom_protocol_url = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .and_then(|window| match &window.url {
            WebviewUrl::CustomProtocol(url) => Some(url.clone()),
            _ => None,
        });

    if let Some(mut url) = custom_protocol_url {
        url.set_path(path.trim_start_matches('/'));
        url.set_query(None);
        url.set_fragment(None);
        WebviewUrl::CustomProtocol(url)
    } else {
        WebviewUrl::App(path.into())
    }
}

pub fn resolve_repository(
    path: impl AsRef<Path>,
) -> Result<(PathBuf, RepoIdentity, String), String> {
    let input = path.as_ref();
    if !input.exists() {
        return Err(crate::common::messages::code("backend.repository.missing"));
    }

    let canonical = dunce::canonicalize(input).map_err(|error| {
        crate::common::messages::failure(
            "backend.window.canonicalizeRepoFailed",
            serde_json::json!({ "error": error.to_string() }),
            format!("Could not canonicalize repository path: {error}"),
        )
    })?;
    if !canonical.is_dir() {
        return Err(crate::common::messages::code(
            "backend.repository.notDirectory",
        ));
    }
    if !canonical.join(".git").exists() {
        return Err(crate::common::messages::code("backend.repository.notGit"));
    }

    #[cfg(unix)]
    let identity = {
        let metadata = fs::metadata(&canonical).map_err(|error| {
            crate::common::messages::failure(
                "backend.window.inspectRepoDirFailed",
                serde_json::json!({ "error": error.to_string() }),
                format!("Could not inspect repository directory: {error}"),
            )
        })?;
        use std::os::unix::fs::MetadataExt;
        RepoIdentity::File {
            volume: metadata.dev(),
            file_index: metadata.ino(),
        }
    };

    #[cfg(windows)]
    let identity = windows_directory_identity(&canonical)?;

    #[cfg(not(any(unix, windows)))]
    let identity = RepoIdentity::Path(canonical.clone());

    let name = canonical
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Repository".to_string());

    Ok((canonical, identity, name))
}

pub fn open_repo_path(
    app: &AppHandle,
    repo_path: &str,
    caller_label: Option<&str>,
    force_new_window: bool,
) -> Result<OpenRepoOutcome, String> {
    let (canonical_path, identity, name) = resolve_repository(repo_path)?;
    let db = app.state::<Database>();
    let repo = db
        .upsert_repository("", &name, &canonical_path.to_string_lossy())
        .map_err(|error| {
            crate::common::messages::failure(
                "backend.window.registerRepoFailed",
                serde_json::json!({ "error": error.to_string() }),
                format!("Failed to register repository: {error}"),
            )
        })?;
    crate::features::credentials::schedule_system_git_credential_rescan(app);
    let context = RepositoryContext {
        identity,
        info: repo.clone(),
    };
    let manager = app.state::<WindowManagerState>();

    match manager.plan_open(app, &context, caller_label, force_new_window) {
        OpenPlan::Existing(label) | OpenPlan::Opening(label) => {
            let target = wait_for_window(app, &label);
            let Some(window) = target else {
                return Err(crate::common::messages::failure(
                    "backend.window.windowStillCreating",
                    serde_json::json!({}),
                    "A window for this repository is still being created. Retry shortly.".into(),
                ));
            };
            let _ = request_maximize(&window.as_ref().window());
            focus_window(&window)?;
            if caller_label == Some(label.as_str()) {
                Ok(OpenRepoOutcome::OpenedHere { repo })
            } else {
                Ok(OpenRepoOutcome::FocusedExisting {
                    window_label: label,
                    repo,
                })
            }
        }
        OpenPlan::AssignedHere(label) => {
            if let Some(window) = app.get_webview_window(&label) {
                let _ = window.set_title(&format!("Stage0 — {}", repo.name));
                let _ = request_maximize(&window.as_ref().window());
            }
            start_watcher(app, &label, &canonical_path);
            crate::core::menu::sync_repo_dependent_menus_for_window(app, &label);
            Ok(OpenRepoOutcome::OpenedHere { repo })
        }
        OpenPlan::AssignedExternal(label) => {
            start_watcher(app, &label, &canonical_path);
            if let Some(window) = app.get_webview_window(&label) {
                let _ = window.set_title(&format!("Stage0 — {}", repo.name));
                let _ = request_maximize(&window.as_ref().window());
                let _ = window.emit("repo-open-request", repo.clone());
                focus_window(&window)?;
            }
            Ok(OpenRepoOutcome::FocusedExisting {
                window_label: label,
                repo,
            })
        }
        OpenPlan::CreateRepoWindow(label) => {
            let title = format!("Stage0 — {}", repo.name);
            if let Err(error) = build_window(app, &label, &title) {
                manager.remove_failed_window(&label);
                return Err(error);
            }
            manager.finish_open(&label);
            start_watcher(app, &label, &canonical_path);
            if let Some(window) = app.get_webview_window(&label) {
                let _ = window.emit("repo-open-request", repo.clone());
                focus_window(&window)?;
            }
            Ok(OpenRepoOutcome::OpenedNewWindow {
                window_label: label,
                repo,
            })
        }
    }
}

pub fn create_welcome_window(app: &AppHandle) -> Result<String, String> {
    let label = format!("win_welcome_{}", uuid::Uuid::new_v4().simple());
    app.state::<WindowManagerState>()
        .register_welcome_window(&label, false);
    if let Err(error) = build_window(app, &label, "Stage0 — Virtual MR Sandbox") {
        app.state::<WindowManagerState>()
            .remove_failed_window(&label);
        return Err(error);
    }
    if let Some(window) = app.get_webview_window(&label) {
        focus_window(&window)?;
    }
    Ok(label)
}

fn build_window(app: &AppHandle, label: &str, title: &str) -> Result<WebviewWindow, String> {
    let focus_after_initial_load = Arc::new(AtomicBool::new(true));
    let focus_after_initial_load_callback = Arc::clone(&focus_after_initial_load);
    let mut builder = WebviewWindowBuilder::new(app, label, app_webview_url(app, "index.html"))
        .title(title)
        .inner_size(SPLASH_WIDTH, SPLASH_HEIGHT)
        .center()
        .resizable(false)
        .maximizable(false)
        .decorations(false)
        .shadow(true);
    #[cfg(target_os = "macos")]
    {
        builder = builder.transparent(true);
    }
    let builder = builder.on_page_load(move |window, payload| {
        if matches!(payload.event(), PageLoadEvent::Finished)
            && focus_after_initial_load_callback.swap(false, Ordering::AcqRel)
        {
            // Re-assert focus after the new WebView is ready. On some platforms,
            // focusing immediately after build can happen before native window
            // activation completes, leaving the first window in front.
            let _ = focus_window(&window);
        }
    });

    let window = builder.build().map_err(|error| {
        crate::common::messages::failure(
            "backend.window.createWindowFailed",
            serde_json::json!({ "error": error.to_string() }),
            format!("Failed to create window: {error}"),
        )
    })?;
    Ok(window)
}

fn start_watcher(app: &AppHandle, label: &str, path: &Path) {
    if let Err(error) =
        app.state::<WatcherState>()
            .watch_repo(app.clone(), label.to_string(), path.to_path_buf())
    {
        eprintln!(
            "Warning: failed to watch repository {}: {error}",
            path.display()
        );
    }
}

#[cfg(windows)]
fn windows_directory_identity(path: &Path) -> Result<RepoIdentity, String> {
    use std::os::windows::ffi::OsStrExt;
    use std::os::windows::io::{AsRawHandle, FromRawHandle};
    use windows_sys::Win32::Foundation::{HANDLE, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
        FILE_FLAG_BACKUP_SEMANTICS, FILE_READ_ATTRIBUTES, FILE_SHARE_DELETE, FILE_SHARE_READ,
        FILE_SHARE_WRITE, OPEN_EXISTING,
    };

    let wide_path = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();

    // Opening a directory requires FILE_FLAG_BACKUP_SEMANTICS. Share all access
    // modes so identity lookup does not block Git or another filesystem reader.
    let handle = unsafe {
        CreateFileW(
            wide_path.as_ptr(),
            FILE_READ_ATTRIBUTES,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            std::ptr::null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS,
            std::ptr::null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return Err(format!(
            "Could not open repository directory to determine its physical identity: {}",
            std::io::Error::last_os_error()
        ));
    }

    // Transfer ownership to File so the native handle is closed on every path.
    let file = unsafe { std::fs::File::from_raw_handle(handle as HANDLE) };
    let mut information = BY_HANDLE_FILE_INFORMATION::default();
    let succeeded =
        unsafe { GetFileInformationByHandle(file.as_raw_handle() as HANDLE, &mut information) };
    if succeeded == 0 {
        return Err(format!(
            "Could not read repository physical identity: {}",
            std::io::Error::last_os_error()
        ));
    }

    Ok(RepoIdentity::File {
        volume: u64::from(information.dwVolumeSerialNumber),
        file_index: (u64::from(information.nFileIndexHigh) << 32)
            | u64::from(information.nFileIndexLow),
    })
}

fn wait_for_window(app: &AppHandle, label: &str) -> Option<WebviewWindow> {
    for _ in 0..80 {
        if let Some(window) = app.get_webview_window(label) {
            return Some(window);
        }
        thread::sleep(Duration::from_millis(25));
    }
    None
}

pub fn focused_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.webview_windows()
        .into_values()
        .find(|window| window.is_focused().unwrap_or(false))
        .or_else(|| app.get_webview_window("main"))
}

pub fn focus_window(window: &WebviewWindow) -> Result<(), String> {
    let _ = window.unminimize();
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

pub fn close_repo_for_window(app: &AppHandle, label: &str) {
    let _ = app.state::<WindowManagerState>().close_repository(label);
    app.state::<WatcherState>().unwatch_window(label);
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.set_title("Stage0 — Virtual MR Sandbox");
    }
    crate::core::menu::sync_repo_dependent_menus_for_window(app, label);
}

pub fn destroy_window(app: &AppHandle, label: &str) {
    let _ = app.state::<WindowManagerState>().unregister_window(label);
    app.state::<WatcherState>().unwatch_window(label);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[cfg(unix)]
    #[test]
    fn repository_symlink_aliases_resolve_to_the_same_identity() {
        use std::os::unix::fs::symlink;

        let root =
            std::env::temp_dir().join(format!("stage0_window_manager_{}", uuid::Uuid::new_v4()));
        let repository = root.join("repository");
        let alias = root.join("repository-alias");
        fs::create_dir_all(repository.join(".git")).unwrap();
        symlink(&repository, &alias).unwrap();

        let (_, canonical_identity, _) = resolve_repository(&repository).unwrap();
        let (alias_canonical_path, alias_identity, _) = resolve_repository(&alias).unwrap();

        assert_eq!(canonical_identity, alias_identity);
        assert_eq!(
            alias_canonical_path,
            dunce::canonicalize(&repository).unwrap()
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn repository_symlink_aliases_resolve_to_the_same_physical_identity() {
        use std::os::windows::fs::symlink_dir;

        let root =
            std::env::temp_dir().join(format!("stage0_window_manager_{}", uuid::Uuid::new_v4()));
        let repository = root.join("repository");
        let alias = root.join("repository-alias");
        fs::create_dir_all(repository.join(".git")).unwrap();

        if let Err(error) = symlink_dir(&repository, &alias) {
            let _ = fs::remove_dir_all(&root);
            if error.kind() == std::io::ErrorKind::PermissionDenied {
                // Windows may require Developer Mode or an elevated test runner
                // to create directory symlinks.
                return;
            }
            panic!("Could not create repository symlink: {error}");
        }

        let (_, canonical_identity, _) = resolve_repository(&repository).unwrap();
        let (_, alias_identity, _) = resolve_repository(&alias).unwrap();

        assert!(matches!(canonical_identity, RepoIdentity::File { .. }));
        assert_eq!(canonical_identity, alias_identity);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn repository_path_must_be_a_git_worktree() {
        let root =
            std::env::temp_dir().join(format!("stage0_window_manager_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();

        assert!(resolve_repository(&root).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
