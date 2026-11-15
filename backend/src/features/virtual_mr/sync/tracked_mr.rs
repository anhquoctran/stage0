#[derive(Clone, Debug)]
pub(super) struct TrackedMr {
    pub id: String,
    pub repo_id: String,
    pub repo_path: String,
    pub base: String,
    pub head: String,
    pub title: String,
    pub status: String,
}
