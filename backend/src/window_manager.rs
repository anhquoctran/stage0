use std::collections::HashMap;
#[cfg(unix)]
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::webview::PageLoadEvent;
#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::db::Database;
use crate::git::RepoInfo;
use crate::watcher::WatcherState;

pub const fn default_window_size() -> (f64, f64) {
    #[cfg(target_os = "windows")]
    {
        (1024.0, 680.0)
    }
    #[cfg(not(target_os = "windows"))]
    {
        (1280.0, 800.0)
    }
}

pub const fn minimum_window_size() -> (f64, f64) {
    #[cfg(target_os = "macos")]
    {
        (640.0, 500.0)
    }
    #[cfg(not(target_os = "macos"))]
    {
        (1024.0, 680.0)
    }
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub enum RepoIdentity {
    File { volume: u64, file_index: u64 },
    Path(PathBuf),
}

#[derive(Clone, Debug)]
pub struct RepositoryContext {
    pub identity: RepoIdentity,
    pub info: RepoInfo,
}

#[derive(Clone, Debug)]
struct WindowRecord {
    repo: Option<RepositoryContext>,
    restore_recent: bool,
    opening: bool,
}

#[derive(Default)]
struct Registry {
    windows: HashMap<String, WindowRecord>,
    repo_to_window: HashMap<RepoIdentity, String>,
}

#[derive(Default)]
pub struct WindowManagerState(Mutex<Registry>);

impl WindowManagerState {
    fn lock(&self) -> MutexGuard<'_, Registry> {
        self.0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    pub fn register_welcome_window(&self, label: &str, restore_recent: bool) {
        self.lock()
            .windows
            .entry(label.to_string())
            .or_insert(WindowRecord {
                repo: None,
                restore_recent,
                opening: false,
            });
    }

    pub fn startup_context(&self, label: &str) -> WindowStartupContext {
        let registry = self.lock();
        let record = registry.windows.get(label);
        WindowStartupContext {
            repo: record.and_then(|window| window.repo.as_ref().map(|repo| repo.info.clone())),
            restore_recent: record.map(|window| window.restore_recent).unwrap_or(false),
        }
    }

    fn plan_open(
        &self,
        app: &AppHandle,
        context: &RepositoryContext,
        caller_label: Option<&str>,
        force_new_window: bool,
    ) -> OpenPlan {
        let live_windows = app.webview_windows();
        let focused_labels = live_windows
            .iter()
            .filter_map(|(label, window)| {
                window
                    .is_focused()
                    .ok()
                    .filter(|focused| *focused)
                    .map(|_| label.clone())
            })
            .collect::<Vec<_>>();

        let mut registry = self.lock();
        if let Some(label) = registry.repo_to_window.get(&context.identity).cloned() {
            if live_windows.contains_key(&label) {
                return OpenPlan::Existing(label);
            }

            let is_opening = registry
                .windows
                .get(&label)
                .map(|record| record.opening)
                .unwrap_or(false);
            if is_opening {
                return OpenPlan::Opening(label);
            }

            registry.repo_to_window.remove(&context.identity);
            registry.windows.remove(&label);
        }

        if !force_new_window {
            if let Some(label) = caller_label {
                if registry
                    .windows
                    .get(label)
                    .is_some_and(|record| record.repo.is_none())
                {
                    Self::assign_repo(&mut registry, label, context);
                    return OpenPlan::AssignedHere(label.to_string());
                }
            } else {
                let mut candidates = focused_labels;
                candidates.push("main".to_string());
                candidates.extend(registry.windows.keys().cloned());
                let welcome_label = candidates
                    .iter()
                    .find(|label| {
                        registry
                            .windows
                            .get(*label)
                            .is_some_and(|record| record.repo.is_none())
                            && live_windows.contains_key(*label)
                    })
                    .cloned();
                if let Some(label) = welcome_label {
                    Self::assign_repo(&mut registry, &label, context);
                    return OpenPlan::AssignedExternal(label);
                }
            }
        }

        let label = format!("win_repo_{}", uuid::Uuid::new_v4().simple());
        registry.windows.insert(
            label.clone(),
            WindowRecord {
                repo: Some(context.clone()),
                restore_recent: false,
                opening: true,
            },
        );
        registry
            .repo_to_window
            .insert(context.identity.clone(), label.clone());
        OpenPlan::CreateRepoWindow(label)
    }

    fn assign_repo(registry: &mut Registry, label: &str, context: &RepositoryContext) {
        if let Some(record) = registry.windows.get_mut(label) {
            record.repo = Some(context.clone());
            record.restore_recent = false;
            record.opening = false;
            registry
                .repo_to_window
                .insert(context.identity.clone(), label.to_string());
        }
    }

    fn finish_open(&self, label: &str) {
        if let Some(record) = self.lock().windows.get_mut(label) {
            record.opening = false;
        }
    }

    pub fn close_repository(&self, label: &str) -> Option<RepositoryContext> {
        let mut registry = self.lock();
        let old_repo = {
            let record = registry.windows.get_mut(label)?;
            let old_repo = record.repo.take();
            record.restore_recent = false;
            record.opening = false;
            old_repo
        };
        if let Some(repo) = &old_repo {
            registry.repo_to_window.remove(&repo.identity);
        }
        old_repo
    }

    pub fn unregister_window(&self, label: &str) -> Option<RepositoryContext> {
        let mut registry = self.lock();
        let record = registry.windows.remove(label)?;
        if let Some(repo) = &record.repo {
            registry.repo_to_window.remove(&repo.identity);
        }
        record.repo
    }

    fn remove_failed_window(&self, label: &str) {
        let _ = self.unregister_window(label);
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum OpenRepoOutcome {
    OpenedHere {
        repo: RepoInfo,
    },
    FocusedExisting {
        window_label: String,
        repo: RepoInfo,
    },
    OpenedNewWindow {
        window_label: String,
        repo: RepoInfo,
    },
}

#[derive(Clone, Debug, Serialize)]
pub struct WindowStartupContext {
    pub repo: Option<RepoInfo>,
    pub restore_recent: bool,
}

enum OpenPlan {
    Existing(String),
    Opening(String),
    AssignedHere(String),
    AssignedExternal(String),
    CreateRepoWindow(String),
}

pub fn resolve_repository(
    path: impl AsRef<Path>,
) -> Result<(PathBuf, RepoIdentity, String), String> {
    let input = path.as_ref();
    if !input.exists() {
        return Err(format!(
            "Repository path does not exist: {}",
            input.display()
        ));
    }

    let canonical = dunce::canonicalize(input)
        .map_err(|error| format!("Could not canonicalize repository path: {error}"))?;
    if !canonical.is_dir() {
        return Err("Repository path must be a directory".to_string());
    }
    if !canonical.join(".git").exists() {
        return Err("Directory is not a Git working tree (missing .git)".to_string());
    }

    #[cfg(unix)]
    let identity = {
        let metadata = fs::metadata(&canonical)
            .map_err(|error| format!("Could not inspect repository directory: {error}"))?;
        use std::os::unix::fs::MetadataExt;
        RepoIdentity::File {
            volume: metadata.dev(),
            file_index: metadata.ino(),
        }
    };

    #[cfg(windows)]
    let identity = {
        let normalized = canonical
            .to_str()
            .map(|s| PathBuf::from(s.to_lowercase()))
            .unwrap_or_else(|| canonical.clone());
        RepoIdentity::Path(normalized)
    };

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
        .map_err(|error| format!("Failed to register repository: {error}"))?;
    crate::credentials::schedule_system_git_credential_rescan(app);
    let context = RepositoryContext {
        identity,
        info: repo.clone(),
    };
    let manager = app.state::<WindowManagerState>();

    match manager.plan_open(app, &context, caller_label, force_new_window) {
        OpenPlan::Existing(label) | OpenPlan::Opening(label) => {
            let target = wait_for_window(app, &label);
            let Some(window) = target else {
                return Err(
                    "A window for this repository is still being created. Retry shortly."
                        .to_string(),
                );
            };
            let _ = window.maximize();
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
                let _ = window.maximize();
            }
            start_watcher(app, &label, &canonical_path);
            Ok(OpenRepoOutcome::OpenedHere { repo })
        }
        OpenPlan::AssignedExternal(label) => {
            start_watcher(app, &label, &canonical_path);
            if let Some(window) = app.get_webview_window(&label) {
                let _ = window.set_title(&format!("Stage0 — {}", repo.name));
                let _ = window.maximize();
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
        let (min_width, min_height) = minimum_window_size();
        let min_size = tauri::LogicalSize {
            width: min_width,
            height: min_height,
        };
        let (width, height) = default_window_size();
        let _ = window.unmaximize();
        let _ = window.set_min_size(Some(tauri::Size::Logical(min_size)));
        let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }));
        let _ = window.center();
        focus_window(&window)?;
    }
    Ok(label)
}

fn build_window(app: &AppHandle, label: &str, title: &str) -> Result<WebviewWindow, String> {
    let focus_after_initial_load = Arc::new(AtomicBool::new(true));
    let focus_after_initial_load_callback = Arc::clone(&focus_after_initial_load);
    let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title(title)
        .inner_size(1360.0, 840.0)
        .decorations(false)
        .shadow(true)
        .on_page_load(move |window, payload| {
            if matches!(payload.event(), PageLoadEvent::Finished)
                && focus_after_initial_load_callback.swap(false, Ordering::AcqRel)
            {
                // Re-assert focus after the new WebView is ready. On some platforms,
                // focusing immediately after build can happen before native window
                // activation completes, leaving the first window in front.
                let _ = focus_window(&window);
            }
        });

    #[cfg(target_os = "macos")]
    let builder = builder
        // Keep the native macOS title bar controls (traffic lights) on dynamically
        // created windows, matching the main window configuration. The title bar
        // remains overlaid so the app can keep its custom title-bar content.
        .decorations(true)
        .title_bar_style(TitleBarStyle::Overlay)
        .hidden_title(true);

    let (min_width, min_height) = minimum_window_size();
    let builder = builder.min_inner_size(min_width, min_height);

    let window = builder
        .build()
        .map_err(|error| format!("Failed to create window: {error}"))?;
    crate::notifications::ensure_notification_host(app);
    let _ = window.maximize();
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

    #[test]
    fn repository_path_must_be_a_git_worktree() {
        let root =
            std::env::temp_dir().join(format!("stage0_window_manager_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();

        assert!(resolve_repository(&root).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
