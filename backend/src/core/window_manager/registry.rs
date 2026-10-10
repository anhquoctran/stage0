use super::{RepoIdentity, WindowRecord};
use std::collections::HashMap;

#[derive(Default)]
pub(super) struct Registry {
    pub(super) windows: HashMap<String, WindowRecord>,
    pub(super) repo_to_window: HashMap<RepoIdentity, String>,
}
