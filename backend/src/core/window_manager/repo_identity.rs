use std::path::PathBuf;

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub enum RepoIdentity {
    File { volume: u64, file_index: u64 },
    Path(PathBuf),
}
