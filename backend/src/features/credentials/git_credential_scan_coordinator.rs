use super::GitCredentialScanState;
use std::sync::Mutex;

#[derive(Default)]
pub struct GitCredentialScanCoordinator(pub(super) Mutex<GitCredentialScanState>);
