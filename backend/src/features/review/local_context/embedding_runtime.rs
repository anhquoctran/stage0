use super::{files, index_job::IndexJob, model::LocalEmbedder, model_install};
use std::{
    path::PathBuf,
    sync::{
        mpsc::{sync_channel, SyncSender},
        Arc, Mutex,
    },
};

pub(crate) struct EmbeddingRuntime {
    root: PathBuf,
    model: Mutex<Option<LocalEmbedder>>,
    jobs: SyncSender<IndexJob>,
}

impl EmbeddingRuntime {
    pub fn new(root: PathBuf) -> Arc<Self> {
        let (jobs, queue) = sync_channel::<IndexJob>(8);
        let runtime = Arc::new(Self {
            root,
            model: Mutex::new(None),
            jobs,
        });
        let weak = Arc::downgrade(&runtime);
        std::thread::spawn(move || {
            while let Ok(job) = queue.recv() {
                let Some(runtime) = weak.upgrade() else {
                    break;
                };
                let Ok(_activity) = crate::common::activity::OperationLease::acquire() else {
                    continue;
                };
                let key = job.cache.key(
                    "indexed",
                    &serde_json::json!([
                        job.snapshot,
                        job.path,
                        job.side,
                        files::digest(job.source.as_bytes()),
                        super::model::IDENTITY
                    ]),
                );
                if job.cache.get(&key).is_some() {
                    continue;
                }
                let _ = runtime.with_model(|model| {
                    if job
                        .cache
                        .epoch
                        .read()
                        .is_ok_and(|e| *e != job.cache.generation)
                    {
                        return Ok(());
                    }
                    let mut chunks = Vec::new();
                    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(3);
                    for (first, last, text) in model.chunks(&job.source) {
                        if std::time::Instant::now() > deadline
                            || job
                                .cache
                                .epoch
                                .read()
                                .is_ok_and(|e| *e != job.cache.generation)
                        {
                            break;
                        }
                        let hash = files::digest(text.as_bytes());
                        let vector = match job.cache.embedding(&hash) {
                            Some(vector) => vector,
                            None => model.embed(&text, false)?,
                        };
                        chunks.push((first, last, hash, vector));
                    }
                    job.cache
                        .insert_vectors(&job.snapshot, &job.path, &job.side, &chunks)?;
                    let key = job.cache.key(
                        "indexed",
                        &serde_json::json!([
                            job.snapshot,
                            job.path,
                            job.side,
                            files::digest(job.source.as_bytes()),
                            super::model::IDENTITY
                        ]),
                    );
                    if !chunks.is_empty() {
                        job.cache.put(&key, &serde_json::json!(true));
                    }
                    Ok(())
                });
            }
        });
        runtime
    }

    pub fn ready(&self) -> bool {
        model_install::ready(&self.root)
    }

    fn with_model<T>(
        &self,
        work: impl FnOnce(&LocalEmbedder) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut guard = self
            .model
            .try_lock()
            .map_err(|_| "Local embedding worker is busy")?;
        if guard.is_none() {
            *guard = Some(LocalEmbedder::load(&self.root)?);
        }
        work(guard.as_ref().unwrap())
    }

    pub(super) fn observe(&self, job: IndexJob) {
        if self.ready() {
            let _ = self.jobs.try_send(job);
        }
    }

    pub fn query(&self, text: &str) -> Result<Vec<f32>, String> {
        self.with_model(|model| model.embed(text, true))
    }
}
