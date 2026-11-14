//! Rebuildable local context cache. Cached data never authorizes publication.
mod cache_session;
mod cache_status;
mod commands;
mod embedding_runtime;
mod files;
mod index_job;
mod integration;
mod integrity;
pub(crate) use integration::attach;
mod model;
mod model_install;
mod related_hit;
mod repository_cache;
mod runtime;
pub(crate) use cache_session::CacheSession;
pub use cache_status::CacheStatus;
pub use commands::*;
pub use runtime::LocalContextRuntime;
#[cfg(test)]
mod storage_tests;

#[cfg(test)]
mod model_tests;
