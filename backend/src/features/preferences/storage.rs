use super::MAX_PREFERENCES_BYTES;
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::Path;

pub(super) fn revision(text: &str) -> String {
    format!("{:x}", Sha256::digest(text.as_bytes()))
}

pub(super) fn read_limited(path: &Path) -> Result<String, String> {
    reject_symlink(path)?;
    let metadata =
        fs::metadata(path).map_err(|_| "Preferences file could not be read".to_string())?;
    if metadata.len() as usize > MAX_PREFERENCES_BYTES {
        return Err("Preferences file is too large (maximum 2 MiB)".into());
    }
    fs::read_to_string(path).map_err(|_| "Preferences file is not readable UTF-8 text".to_string())
}

pub(super) fn reject_symlink(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            Err("Preferences paths cannot be symbolic links".into())
        }
        Ok(_) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("Preferences path could not be inspected".into()),
    }
}

pub(super) fn secure_directory(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .map_err(|_| "Preferences directory permissions could not be secured".to_string())?;
    }
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

pub(super) fn secure_file(path: &Path) -> io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    #[cfg(not(unix))]
    let _ = path; // Windows inherits the private ACL from the per-user app-data directory.
    Ok(())
}

pub(super) fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Invalid preferences path".to_string())?;
    reject_symlink(parent)?;
    reject_symlink(path)?;
    let temp = parent.join(format!(".preferences-{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&temp)
            .map_err(|_| "Could not create a temporary preferences file".to_string())?;
        file.write_all(content)
            .map_err(|_| "Could not write preferences to disk".to_string())?;
        file.sync_all()
            .map_err(|_| "Could not flush preferences to disk".to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&temp, fs::Permissions::from_mode(0o600))
                .map_err(|_| "Preferences file permissions could not be secured".to_string())?;
        }
        #[cfg(windows)]
        {
            use std::os::windows::ffi::OsStrExt;
            use windows_sys::Win32::Storage::FileSystem::{
                MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
            };
            let from: Vec<u16> = temp.as_os_str().encode_wide().chain(Some(0)).collect();
            let to: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
            let moved = unsafe {
                MoveFileExW(
                    from.as_ptr(),
                    to.as_ptr(),
                    MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
                )
            };
            if moved == 0 {
                return Err("Could not atomically replace preferences.json".to_string());
            }
        }
        #[cfg(not(windows))]
        fs::rename(&temp, path)
            .map_err(|_| "Could not atomically replace preferences.json".to_string())?;
        #[cfg(unix)]
        OpenOptions::new()
            .read(true)
            .open(parent)
            .and_then(|directory| directory.sync_all())
            .map_err(|_| "Preferences replacement could not be durably flushed".to_string())?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}
