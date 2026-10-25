use super::storage::{reject_symlink, secure_database_file};
use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::Path;

const FILE_NAME: &str = "database-key.json";

/// Public key reference only. The database password and machine ID never go here.
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(super) struct KeyManifest {
    pub version: u32,
    pub installation_id: String,
}

impl KeyManifest {
    pub fn new() -> Self {
        Self {
            version: 1,
            installation_id: uuid::Uuid::new_v4().to_string(),
        }
    }

    pub fn read(directory: &Path) -> io::Result<Option<Self>> {
        let path = directory.join(FILE_NAME);
        reject_symlink(&path)?;
        let file = match File::open(&path) {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error),
        };
        let mut bytes = Vec::new();
        file.take(4097).read_to_end(&mut bytes)?;
        let manifest: Self = serde_json::from_slice(&bytes).map_err(|_| {
            io::Error::other("The database key reference is invalid; it was retained")
        })?;
        if bytes.len() > 4096
            || manifest.version != 1
            || uuid::Uuid::parse_str(&manifest.installation_id).map_or(true, |id| {
                id.is_nil() || id.to_string() != manifest.installation_id
            })
        {
            return Err(io::Error::other(
                "The database key reference is unsupported; it was retained",
            ));
        }
        secure_database_file(&path)?;
        Ok(Some(manifest))
    }

    pub fn save_new(&self, directory: &Path) -> io::Result<()> {
        let path = directory.join(FILE_NAME);
        reject_symlink(&path)?;
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&path)?;
        let bytes = serde_json::to_vec_pretty(self).map_err(io::Error::other)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        #[cfg(unix)]
        File::open(directory)?.sync_all()?;
        Ok(())
    }
}
