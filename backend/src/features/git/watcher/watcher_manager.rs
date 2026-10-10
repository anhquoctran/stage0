use notify_debouncer_mini::Debouncer;
use std::collections::HashMap;

pub struct WatcherManager {
    pub(super) watchers: HashMap<String, Debouncer<notify::RecommendedWatcher>>,
}
