#[derive(serde::Deserialize, serde::Serialize, Clone, Debug, Default)]
pub struct GitSyncOptions {
    pub remote: Option<String>,
    pub branch: Option<String>,
    pub rebase: Option<bool>,
    pub autostash: Option<bool>,
    pub ff_only: Option<bool>,
    pub no_commit: Option<bool>,
    pub prune: Option<bool>,
}
