use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

static RUNNING_OPERATIONS: OnceLock<Mutex<HashSet<PathBuf>>> = OnceLock::new();

/// Serializes mutations of a physical repository across all Stage0 windows.
pub struct GitOperationLease {
    path: PathBuf,
}

impl GitOperationLease {
    pub fn acquire(path: &str) -> Result<Self, String> {
        let absolute = std::path::absolute(Path::new(path))
            .map_err(|error| format!("Invalid repository path: {error}"))?;
        let resolved = if absolute.exists() {
            dunce::canonicalize(&absolute)
        } else {
            let parent = absolute.parent().ok_or("Invalid repository path")?;
            let name = absolute.file_name().ok_or("Invalid repository path")?;
            dunce::canonicalize(parent).map(|parent| parent.join(name))
        }
        .map_err(|error| format!("Could not resolve repository path: {error}"))?;
        #[cfg(target_os = "windows")]
        let resolved = PathBuf::from(resolved.to_string_lossy().to_lowercase());
        let mut running = RUNNING_OPERATIONS
            .get_or_init(Default::default)
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if !running.insert(resolved.clone()) {
            return Err(
                "A Git operation is already running for this repository. Wait for it to finish."
                    .to_string(),
            );
        }
        Ok(Self { path: resolved })
    }
}

impl Drop for GitOperationLease {
    fn drop(&mut self) {
        if let Some(running) = RUNNING_OPERATIONS.get() {
            running
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .remove(&self.path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_duplicate_paths_and_releases_after_completion() {
        let target = std::env::temp_dir().join(format!("stage0-task-{}", uuid::Uuid::new_v4()));
        let path = target.to_str().unwrap();
        let lease = GitOperationLease::acquire(path).unwrap();
        assert!(GitOperationLease::acquire(path).is_err());
        drop(lease);
        assert!(GitOperationLease::acquire(path).is_ok());
    }
}
