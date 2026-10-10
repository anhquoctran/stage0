use super::RepoIdentity;
use crate::features::git::RepoInfo;

#[derive(Clone, Debug)]
pub struct RepositoryContext {
    pub identity: RepoIdentity,
    pub info: RepoInfo,
}
