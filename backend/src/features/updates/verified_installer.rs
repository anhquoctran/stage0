use std::path::PathBuf;

#[derive(Clone, Debug)]
pub(super) struct VerifiedInstaller {
    pub(super) path: PathBuf,
    pub(super) checksum: String,
}
