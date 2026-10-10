use super::RepositoryContext;

#[derive(Clone, Debug)]
pub(super) struct WindowRecord {
    pub(super) repo: Option<RepositoryContext>,
    pub(super) restore_recent: bool,
    pub(super) opening: bool,
}
