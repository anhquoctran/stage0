use super::repository_cache::RepositoryCache;

pub(super) struct IndexJob {
    pub cache: RepositoryCache,
    pub snapshot: String,
    pub path: String,
    pub side: String,
    pub source: String,
}
