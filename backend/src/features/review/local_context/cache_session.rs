use super::{
    embedding_runtime::EmbeddingRuntime, files, index_job::IndexJob, related_hit::RelatedHit,
    repository_cache::RepositoryCache,
};
use serde_json::Value;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};

#[derive(Clone)]
pub(crate) struct CacheSession {
    pub(super) cache: RepositoryCache,
    pub(super) embedding: Arc<EmbeddingRuntime>,
    pub(super) snapshot: String,
    pub(super) stats: Arc<[AtomicU64; 3]>,
}

impl CacheSession {
    pub fn read_gate(&self) -> Arc<std::sync::Mutex<()>> {
        Arc::clone(&self.cache.read_gate)
    }
    pub fn key(&self, kind: &str, identity: &Value) -> String {
        self.cache.key(kind, identity)
    }
    pub fn get(&self, key: &str) -> Option<Value> {
        self.stats[0].fetch_add(1, Ordering::Relaxed);
        let result = self.cache.get(key);
        if result.is_some() {
            self.stats[1].fetch_add(1, Ordering::Relaxed);
        }
        result
    }
    pub fn saved_bytes(&self, bytes: usize) {
        self.stats[2].fetch_add(bytes as u64, Ordering::Relaxed);
    }
    pub fn metrics(&self) -> Value {
        serde_json::json!({"cacheReads":self.stats[0].load(Ordering::Relaxed),"cacheHits":self.stats[1].load(Ordering::Relaxed),"deduplicatedBytes":self.stats[2].load(Ordering::Relaxed),"semanticAvailable":self.semantic_ready()})
    }
    pub fn put(&self, key: &str, value: &Value) {
        self.cache.put(key, value);
    }
    pub fn semantic_ready(&self) -> bool {
        self.embedding.ready()
    }
    pub fn observe(&self, path: &str, side: &str, source: &str) {
        let key = self.key(
            "indexed",
            &serde_json::json!([
                self.snapshot,
                path,
                side,
                files::digest(source.as_bytes()),
                super::model::IDENTITY
            ]),
        );
        if self.cache.get(&key).is_some() {
            return;
        }
        self.embedding.observe(IndexJob {
            cache: self.cache.clone(),
            snapshot: self.snapshot.clone(),
            path: path.into(),
            side: side.into(),
            source: source.into(),
        });
    }
    pub fn search(&self, query: &str) -> Result<Vec<RelatedHit>, String> {
        self.cache
            .search(&self.snapshot, &self.embedding.query(query)?)
    }
}
