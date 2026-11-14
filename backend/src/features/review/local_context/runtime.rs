use super::{
    cache_session::CacheSession, cache_status::CacheStatus, embedding_runtime::EmbeddingRuntime,
    files, model, model_install, repository_cache::RepositoryCache,
};
use crate::features::review::ReviewSnapshot;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, RwLock, Weak,
    },
};

pub struct LocalContextRuntime {
    root: PathBuf,
    epoch: Arc<RwLock<u64>>,
    integrity_key: Arc<[u8; 32]>,
    read_gates: Mutex<std::collections::HashMap<String, Weak<Mutex<()>>>>,
    embedding: Arc<EmbeddingRuntime>,
    installing: Arc<AtomicBool>,
}

impl LocalContextRuntime {
    pub fn new(root: PathBuf) -> Self {
        let mut key = [0; 32];
        key[..16].copy_from_slice(uuid::Uuid::new_v4().as_bytes());
        key[16..].copy_from_slice(uuid::Uuid::new_v4().as_bytes());
        Self {
            embedding: EmbeddingRuntime::new(root.join("model")),
            root,
            integrity_key: Arc::new(key),
            epoch: Arc::new(RwLock::new(0)),
            read_gates: Mutex::new(std::collections::HashMap::new()),
            installing: Arc::new(AtomicBool::new(false)),
        }
    }
    pub(crate) fn session(&self, snapshot: &ReviewSnapshot, policy: &str) -> Option<CacheSession> {
        let repo = std::fs::canonicalize(&snapshot.repo_path).ok()?;
        let id = files::digest(repo.to_string_lossy().as_bytes());
        let root = self.root.join("repositories");
        let mut epoch = self.epoch.write().ok()?;
        files::directory(&self.root).ok()?;
        files::directory(&root).ok()?;
        // At most four 128-MiB databases. Eviction changes the epoch so all
        // queued work is invalidated before an old directory is removed.
        if !root.join(&id).exists() {
            let mut dirs = std::fs::read_dir(&root)
                .ok()?
                .flatten()
                .filter(|e| e.file_type().is_ok_and(|t| t.is_dir() && !t.is_symlink()))
                .collect::<Vec<_>>();
            dirs.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());
            if dirs.len() >= 4 {
                *epoch += 1;
                for old in dirs.iter().take(dirs.len() - 3) {
                    std::fs::remove_dir_all(old.path()).ok()?;
                }
            }
        }
        let read_gate = {
            let mut gates = self.read_gates.lock().ok()?;
            gates.retain(|_, gate| gate.strong_count() > 0);
            if let Some(gate) = gates.get(&id).and_then(Weak::upgrade) {
                gate
            } else {
                let gate = Arc::new(Mutex::new(()));
                gates.insert(id.clone(), Arc::downgrade(&gate));
                gate
            }
        };
        let cache = RepositoryCache {
            directory: root.join(id),
            epoch: Arc::clone(&self.epoch),
            generation: *epoch,
            policy: policy.into(),
            integrity_key: Arc::clone(&self.integrity_key),
            read_gate,
        };
        cache.open().ok()?;
        let snapshot_key = cache.key(
            "snapshot",
            &serde_json::json!([
                snapshot.base_sha,
                snapshot.head_sha,
                snapshot.merge_base_sha
            ]),
        );
        Some(CacheSession {
            cache,
            embedding: Arc::clone(&self.embedding),
            snapshot: snapshot_key,
            stats: Arc::new(std::array::from_fn(|_| {
                std::sync::atomic::AtomicU64::new(0)
            })),
        })
    }
    pub fn status(&self) -> CacheStatus {
        CacheStatus {
            model_ready: model_install::ready(&self.root.join("model")),
            installing: self.installing.load(Ordering::Acquire),
            cache_bytes: files::disk_bytes(&self.root.join("repositories")),
            model_bytes: files::disk_bytes(&self.root.join("model")),
            download_bytes: model::FILES.iter().map(|f| f.1).sum(),
        }
    }
    pub fn clear(&self) -> Result<(), String> {
        let mut epoch = self.epoch.write().map_err(|e| e.to_string())?;
        *epoch += 1;
        let path = self.root.join("repositories");
        files::reject_link(&path).map_err(|e| e.to_string())?;
        if path.exists() {
            std::fs::remove_dir_all(path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }
    pub async fn install(&self) -> Result<(), String> {
        if self.installing.swap(true, Ordering::AcqRel) {
            return Err("Model installation is already running".into());
        }
        let flag = Arc::clone(&self.installing);
        let root = self.root.join("model");
        // Owned task retains serialization and activity lease after IPC cancellation.
        tauri::async_runtime::spawn(async move {
            let outcome = async {
                let _lease = crate::common::activity::OperationLease::acquire()?;
                model_install::install(&root).await
            }
            .await;
            flag.store(false, Ordering::Release);
            outcome
        })
        .await
        .map_err(|_| "Model installation worker stopped".to_string())?
    }
}
