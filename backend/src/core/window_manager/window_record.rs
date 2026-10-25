use super::RepositoryContext;

#[derive(Clone, Debug)]
pub(super) struct WindowRecord {
    pub(super) repo: Option<RepositoryContext>,
    pub(super) restore_recent: bool,
    pub(super) opening: bool,
    /// Some while the compact startup window is visible; bool is the final maximize intent.
    pub(super) startup_maximized: Option<bool>,
}
