use super::{queue::SyncQueue, ref_watcher::RefWatcher, subscription::Subscription, worker};
use crate::core::db::Database;
use std::{
    collections::{HashMap, HashSet},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager};
use tokio::{sync::Notify, task::JoinSet};

pub struct MrSyncRuntime {
    pending: Mutex<SyncQueue>,
    priority: Mutex<HashSet<String>>,
    changed: AtomicBool,
    wake: Notify,
    started: Instant,
}
impl Default for MrSyncRuntime {
    fn default() -> Self {
        Self {
            pending: Mutex::new(SyncQueue::default()),
            priority: Mutex::new(HashSet::new()),
            changed: AtomicBool::new(true),
            wake: Notify::new(),
            started: Instant::now(),
        }
    }
}
impl MrSyncRuntime {
    fn now(&self) -> u64 {
        self.started.elapsed().as_millis().min(u64::MAX as u128) as u64
    }
    pub(super) fn mark(&self, root: String) {
        self.pending
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .mark(root, self.now());
        self.wake.notify_one();
    }
}
pub(crate) fn registry_changed(app: &AppHandle) {
    if let Some(runtime) = app.try_state::<MrSyncRuntime>() {
        runtime.changed.store(true, Ordering::Release);
        runtime.wake.notify_one();
    }
}
pub(crate) fn repository_changed(app: &AppHandle, path: &str) {
    if let Some(runtime) = app.try_state::<MrSyncRuntime>() {
        let root = dunce::canonicalize(path)
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|_| path.to_owned());
        runtime
            .priority
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(root.clone());
        runtime
            .pending
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .prioritize(root, runtime.now());
        runtime.wake.notify_one();
    }
}
pub fn start(app: &AppHandle) {
    app.manage(MrSyncRuntime::default());
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let runtime = app.state::<MrSyncRuntime>();
        let callback_app = app.clone();
        let mut watcher =
            RefWatcher::new(move |root| callback_app.state::<MrSyncRuntime>().mark(root));
        let mut subscriptions = HashMap::<String, Subscription>::new();
        let mut groups = HashMap::new();
        let mut active = HashSet::<String>::new();
        let mut jobs = JoinSet::new();
        let mut refresh = 0;
        let mut last_refresh = 0;
        let mut next_start = 0;
        loop {
            let now = runtime.now();
            if now >= refresh
                || (runtime.changed.load(Ordering::Acquire)
                    && now.saturating_sub(last_refresh) >= 1000)
            {
                runtime.changed.store(false, Ordering::Release);
                let lookup = app.clone();
                if let Ok(Ok(next)) = tauri::async_runtime::spawn_blocking(move || {
                    worker::groups(&lookup.state::<Database>())
                })
                .await
                {
                    let roots = next.keys().cloned().collect::<HashSet<_>>();
                    for root in subscriptions
                        .keys()
                        .filter(|root| !roots.contains(*root))
                        .cloned()
                        .collect::<Vec<_>>()
                    {
                        watcher.remove(&root);
                    }
                    subscriptions.retain(|root, _| roots.contains(root));
                    runtime
                        .pending
                        .lock()
                        .unwrap_or_else(|e| e.into_inner())
                        .retain(&roots);
                    for (root, sessions) in &next {
                        let different = groups
                            .get(root)
                            .map(|old: &Vec<super::tracked_mr::TrackedMr>| {
                                old.iter()
                                    .map(|s| (&s.id, &s.base, &s.head))
                                    .collect::<Vec<_>>()
                                    != sessions
                                        .iter()
                                        .map(|s| (&s.id, &s.base, &s.head))
                                        .collect::<Vec<_>>()
                            })
                            .unwrap_or(true);
                        subscriptions
                            .entry(root.clone())
                            .or_insert_with(|| Subscription::new(now));
                        if different {
                            runtime.mark(root.clone());
                        }
                    }
                    groups = next;
                }
                last_refresh = now;
                refresh = now + 30_000;
            }
            for (root, subscription) in &mut subscriptions {
                if now >= subscription.next_poll {
                    runtime.mark(root.clone());
                    subscription.next_poll = now + 30_000;
                }
            }
            let priority = runtime
                .priority
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .drain()
                .collect::<Vec<_>>();
            for root in priority {
                if subscriptions
                    .get(&root)
                    .is_some_and(Subscription::needs_watcher)
                    && subscriptions
                        .values()
                        .filter(|s| !s.needs_watcher())
                        .count()
                        >= 256
                {
                    if let Some(key) = subscriptions
                        .iter()
                        .filter(|(_, s)| !s.needs_watcher())
                        .min_by_key(|(_, s)| s.focused_at)
                        .map(|(k, _)| k.clone())
                    {
                        subscriptions.get_mut(&key).unwrap().unwatch();
                        watcher.remove(&key);
                    }
                }
                if let Some(sub) = subscriptions.get_mut(&root) {
                    sub.retry_after = 0;
                    sub.focused_at = now;
                }
            }
            let mut blocked = active.clone();
            blocked.extend(
                subscriptions
                    .iter()
                    .filter(|(_, s)| s.retry_after > now)
                    .map(|(root, _)| root.clone()),
            );
            while jobs.len() < 2 && now >= next_start {
                let root = runtime
                    .pending
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .take(now, &blocked);
                let Some(root) = root else { break };
                let Some(sessions) = groups.get(&root).cloned() else {
                    continue;
                };
                let locate = subscriptions
                    .get(&root)
                    .is_some_and(Subscription::needs_watcher)
                    && subscriptions
                        .values()
                        .filter(|s| !s.needs_watcher())
                        .count()
                        < 256;
                let cached = subscriptions.get(&root).map(|s| {
                    (
                        s.sent.values().cloned().collect::<Vec<_>>(),
                        s.epochs.clone(),
                    )
                });
                let worker_app = app.clone();
                let key = root.clone();
                active.insert(root);
                next_start = now + 250;
                jobs.spawn(async move {
                    let scan_root = key.clone();
                    let result = tauri::async_runtime::spawn_blocking(move || {
                        worker::scan(
                            &worker_app.state::<Database>(),
                            &scan_root,
                            &sessions,
                            locate,
                            cached
                                .as_ref()
                                .map(|(states, epochs)| (states.as_slice(), epochs)),
                        )
                    })
                    .await;
                    (key, result)
                });
            }
            let delay = {
                let queue = runtime.pending.lock().unwrap_or_else(|e| e.into_inner());
                if jobs.len() >= 2 {
                    // Completion/notification wakes select immediately. Do not
                    // spin on a ready queue while both blocking slots are busy.
                    1000
                } else {
                    queue
                        .delay(runtime.now(), &blocked)
                        .max(next_start.saturating_sub(runtime.now()))
                        .min(1000)
                }
            };
            let completed = tokio::select! {
                _=tokio::time::sleep(Duration::from_millis(delay))=>None,
                _=runtime.wake.notified()=>None,
                result=jobs.join_next(),if !jobs.is_empty()=>result,
            };
            if let Some(result) = completed {
                if let Ok((root, result)) = result {
                    active.remove(&root);
                    let can_install = subscriptions
                        .values()
                        .filter(|s| !s.needs_watcher())
                        .count()
                        < 256;
                    if let Some(sub) = subscriptions.get_mut(&root) {
                        let success = result
                            .as_ref()
                            .ok()
                            .and_then(|r| r.as_ref().ok())
                            .is_some_and(|r| r.healthy);
                        if let Ok(Ok(observation)) = result {
                            let states = observation.states;
                            let paths = observation.paths;
                            sub.epochs = observation.epochs;
                            let ids = states
                                .iter()
                                .map(|s| s.session_id.as_str())
                                .collect::<HashSet<_>>();
                            sub.sent.retain(|id, _| ids.contains(id.as_str()));
                            if can_install && !paths.is_empty() {
                                sub.native = watcher.install(&root, paths);
                                if sub.native {
                                    runtime.mark(root.clone());
                                }
                            }
                            let tracked_by_id = groups
                                .get(&root)
                                .map(|items| {
                                    items
                                        .iter()
                                        .map(|s| (s.id.as_str(), s))
                                        .collect::<HashMap<_, _>>()
                                })
                                .unwrap_or_default();
                            let notes = states
                                .iter()
                                .filter_map(|state| {
                                    let tracked = tracked_by_id.get(state.session_id.as_str())?;
                                    let before = sub
                                        .sent
                                        .get(&state.session_id)
                                        .map(|s| s.session_status.as_str())
                                        .unwrap_or(&tracked.status);
                                    (before == "resolved"
                                        && state.session_status == "open"
                                        && state.needs_review)
                                        .then(|| tracked.title.clone())
                                })
                                .collect::<Vec<_>>();
                            if !notes.is_empty() {
                                let notify_app = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    for title in notes {
                                        crate::features::virtual_mr::status_notification::send(
                                            notify_app.clone(),
                                            title,
                                            "resolved".into(),
                                            "open".into(),
                                        )
                                        .await;
                                    }
                                });
                            }
                            let changed = states
                                .into_iter()
                                .filter(|s| sub.sent.get(&s.session_id) != Some(s))
                                .collect::<Vec<_>>();
                            for chunk in changed.chunks(64) {
                                let _ = app.emit("mr-sync-updated", chunk);
                            }
                            for s in changed {
                                sub.sent.insert(s.session_id.clone(), s);
                            }
                        }
                        let jitter = root
                            .bytes()
                            .fold(0u64, |a, b| a.wrapping_mul(31).wrapping_add(b as u64))
                            % 15_000;
                        sub.schedule(runtime.now(), success, jitter);
                    }
                }
            }
        }
    });
}
