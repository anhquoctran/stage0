use super::git_refs;
use notify::{RecursiveMode, Watcher};
use std::{
    collections::{HashMap, HashSet},
    path::PathBuf,
    sync::{Arc, Mutex},
};

/// All MR subscriptions share one native watcher/thread. Physical Git metadata
/// paths are reference-counted, including common dirs shared by linked repos.
pub(super) struct RefWatcher {
    watcher: Option<notify::RecommendedWatcher>,
    index: Arc<Mutex<HashMap<PathBuf, HashSet<String>>>>,
    changed: Arc<dyn Fn(String) + Send + Sync>,
    roots: HashMap<String, Vec<PathBuf>>,
    targets: HashMap<PathBuf, (HashSet<String>, bool)>,
}
impl RefWatcher {
    pub fn new(changed: impl Fn(String) + Send + Sync + 'static) -> Self {
        Self {
            watcher: None,
            index: Arc::new(Mutex::new(HashMap::new())),
            changed: Arc::new(changed),
            roots: HashMap::new(),
            targets: HashMap::new(),
        }
    }
    pub fn remove(&mut self, root: &str) {
        if let Some(paths) = self.roots.remove(root) {
            let mut index = self.index.lock().unwrap_or_else(|e| e.into_inner());
            for path in paths {
                if let Some(owners) = index.get_mut(&path) {
                    owners.remove(root);
                    if owners.is_empty() {
                        index.remove(&path);
                    }
                }
            }
        }
        let obsolete = self
            .targets
            .iter_mut()
            .filter_map(|(path, (owners, _))| {
                owners.remove(root);
                owners.is_empty().then(|| path.clone())
            })
            .collect::<Vec<_>>();
        for path in obsolete {
            self.targets.remove(&path);
            if let Some(w) = &mut self.watcher {
                let _ = w.unwatch(&path);
            }
        }
    }
    pub fn install(&mut self, root: &str, paths: Vec<PathBuf>) -> bool {
        if paths.is_empty() {
            return false;
        }
        if self.roots.get(root).is_some_and(|old| old != &paths) {
            self.remove(root);
        }
        if self.watcher.is_none() {
            let index = Arc::clone(&self.index);
            let changed = Arc::clone(&self.changed);
            self.watcher =
                notify::recommended_watcher(move |event: Result<notify::Event, notify::Error>| {
                    let mut selected = HashSet::new();
                    {
                        let index = index.lock().unwrap_or_else(|e| e.into_inner());
                        match event {
                            Ok(event) => {
                                for path in event.paths {
                                    for ancestor in path.ancestors() {
                                        if let Some(owners) = index.get(ancestor) {
                                            if git_refs::relevant(&path, &[ancestor.to_path_buf()])
                                            {
                                                selected.extend(owners.iter().cloned());
                                            }
                                        }
                                    }
                                }
                            }
                            Err(_) => {
                                for owners in index.values() {
                                    selected.extend(owners.iter().cloned());
                                }
                            }
                        }
                    }
                    for root in selected {
                        changed(root);
                    }
                })
                .ok();
        }
        let Some(watcher) = &mut self.watcher else {
            return false;
        };
        self.roots.insert(root.to_owned(), paths.clone());
        {
            let mut index = self.index.lock().unwrap_or_else(|e| e.into_inner());
            for path in &paths {
                index
                    .entry(path.clone())
                    .or_default()
                    .insert(root.to_owned());
            }
        }
        let mut requested = paths.iter().map(|p| (p.clone(), false)).collect::<Vec<_>>();
        for path in paths {
            for name in ["refs", "reftable"] {
                let child = path.join(name);
                if child.exists() {
                    requested.push((child, true));
                }
            }
        }
        for (path, recursive) in requested {
            if let Some((owners, old_recursive)) = self.targets.get_mut(&path) {
                owners.insert(root.to_owned());
                if recursive && !*old_recursive {
                    if watcher.watch(&path, RecursiveMode::Recursive).is_err() {
                        self.remove(root);
                        return false;
                    }
                    *old_recursive = true;
                }
            } else {
                let mode = if recursive {
                    RecursiveMode::Recursive
                } else {
                    RecursiveMode::NonRecursive
                };
                if watcher.watch(&path, mode).is_err() {
                    let _ = watcher.unwatch(&path);
                    self.remove(root);
                    return false;
                }
                self.targets
                    .insert(path, (HashSet::from([root.to_owned()]), recursive));
            }
        }
        true
    }
}
