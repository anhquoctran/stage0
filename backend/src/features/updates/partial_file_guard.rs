use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;

pub(super) struct PartialFileGuard(pub(super) Option<PathBuf>);

impl PartialFileGuard {
    pub(super) fn disarm(&mut self) {
        self.0 = None;
    }
}

impl Drop for PartialFileGuard {
    fn drop(&mut self) {
        let Some(path) = self.0.take() else { return };
        match fs::remove_file(path) {
            Ok(()) => {}
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(_) => {}
        }
    }
}
