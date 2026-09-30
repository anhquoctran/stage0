use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEvent, Debouncer};
use tauri::{AppHandle, Emitter};
use crate::git::RepoChangedEvent;

pub struct WatcherManager {
    watchers: HashMap<String, Debouncer<notify::RecommendedWatcher>>,
}

pub struct WatcherState(pub Mutex<WatcherManager>);

impl WatcherState {
    pub fn new() -> Self {
        Self(Mutex::new(WatcherManager {
            watchers: HashMap::new(),
        }))
    }

    pub fn watch_repo(
        &self,
        app: AppHandle,
        window_label: String,
        path: PathBuf,
    ) -> Result<(), String> {
        if !path.exists() {
            return Err(format!("Path does not exist: {}", path.display()));
        }

        let target_repo = path.to_string_lossy().into_owned();
        let target_window = window_label.clone();
        let app_clone = app.clone();

        let mut debouncer = new_debouncer(
            Duration::from_millis(300),
            move |res: Result<Vec<DebouncedEvent>, _>| {
                match res {
                    Ok(events) => {
                        let has_relevant_changes = events.iter().any(|ev| !should_ignore(&ev.path));
                        if has_relevant_changes {
                            let _ = app_clone.emit_to(
                                &target_window,
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

        let previous = self
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .watchers
            .insert(window_label, debouncer);
        drop(previous);
        Ok(())
    }

    pub fn unwatch_window(&self, window_label: &str) {
        let watcher = self
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .watchers
            .remove(window_label);
        drop(watcher);
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
