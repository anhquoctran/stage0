mod watcher_manager;
pub use watcher_manager::WatcherManager;
mod watcher_state;
pub use watcher_state::WatcherState;

use std::path::Path;

fn should_ignore(path: &Path) -> bool {
    let s = path.to_string_lossy().replace('\\', "/");
    s.contains("/node_modules/")
        || s.contains("/target/")
        || s.contains("/dist/")
        || s.contains("/build/")
        || s.contains("/.next/")
        || s.contains("/.turbo/")
        || s.contains("/.cache/")
        || s.contains("/coverage/")
        || s.contains("/__pycache__/")
        || s.contains("/.venv/")
        || s.contains("/bin/")
        || s.contains("/obj/")
        || s.contains("/.git/objects/")
        || s.contains("/.git/logs/")
        || s.ends_with(".lock")
        || s.ends_with(".DS_Store")
        || s.ends_with(".swp")
        || s.ends_with(".tmp")
}
