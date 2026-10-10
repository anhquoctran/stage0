use crate::features::git::RepoInfo;
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct WindowStartupContext {
    pub repo: Option<RepoInfo>,
    pub restore_recent: bool,
}
