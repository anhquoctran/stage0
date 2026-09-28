use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEvent, Debouncer};
use tauri::{AppHandle, Emitter};
use crate::git::RepoChangedEvent;

pub struct WatcherManager {
    _debouncer: Option<Debouncer<notify::RecommendedWatcher>>,
    current_repo: Option<PathBuf>,
}

pub struct WatcherState(pub Mutex<WatcherManager>);

impl WatcherState {
    pub fn new() -> Self {
        Self(Mutex::new(WatcherManager {
            _debouncer: None,
            current_repo: None,
        }))
    }

    pub fn watch_repo(&self, app: AppHandle, repo_path: String) -> Result<(), String> {
        let mut mgr = self.0.lock().map_err(|e| e.to_string())?;

        let path = PathBuf::from(&repo_path);
        if !path.exists() {
            return Err(format!("Path does not exist: {}", repo_path));
        }

        mgr._debouncer = None;
        mgr.current_repo = Some(path.clone());

        let target_repo = repo_path.clone();
        let app_clone = app.clone();

        let mut debouncer = new_debouncer(
            Duration::from_millis(300),
            move |res: Result<Vec<DebouncedEvent>, _>| {
                match res {
                    Ok(events) => {
                        let has_relevant_changes = events.iter().any(|ev| !should_ignore(&ev.path));
                        if has_relevant_changes {
                            let _ = app_clone.emit(
                                "repo-fs-changed",
                                RepoChangedEvent {
                                    repo_path: target_repo.clone(),
                                },
                            );
                        }
                    }
                    Err(errors) => {
                        eprintln!("Watcher error: {:?}", errors);
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        debouncer
            .watcher()
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;

        mgr._debouncer = Some(debouncer);
        Ok(())
    }
}

fn should_ignore(path: &Path) -> bool {
    let s = path.to_string_lossy().replace('\\', "/");
    s.contains("/node_modules/")
        || s.contains("/target/")
        || s.contains("/bin/")
        || s.contains("/obj/")
        || s.contains("/.git/objects/")
        || s.contains("/.git/logs/")
}
