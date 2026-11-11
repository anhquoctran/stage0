use super::schema::MAX_BYTES;
use crate::features::preferences::write_settings_snapshot;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub fn revision(content: &str) -> String {
    format!("{:x}", Sha256::digest(content.as_bytes()))
}

pub fn regular(path: &Path, directory: bool) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path).map_err(|e| format!("{}: {e}", path.display()))?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return Err("Settings reparse points are not allowed".into());
        }
    }
    if metadata.file_type().is_symlink()
        || (directory && !metadata.is_dir())
        || (!directory && !metadata.is_file())
    {
        return Err(format!(
            "{} must be a regular {}",
            path.display(),
            if directory { "directory" } else { "file" }
        ));
    }
    Ok(())
}

pub fn path(root: &Path) -> Result<PathBuf, String> {
    let directory = root.join(".stage0");
    match fs::create_dir(&directory) {
        Ok(()) => (),
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => (),
        Err(e) => return Err(format!("Cannot create .stage0: {e}")),
    }
    regular(&directory, true)?;
    Ok(directory.join("repos.jsonc"))
}

pub fn read(path: &Path) -> Result<String, String> {
    regular(path.parent().ok_or("Missing settings directory")?, true)?;
    regular(path, false)?;
    let mut bytes = Vec::new();
    // Bound the actual read, not only metadata (another process can grow a file).
    File::open(path)
        .map_err(|e| e.to_string())?
        .take((MAX_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    regular(path, false)?;
    if bytes.len() > MAX_BYTES {
        return Err("Repository settings exceed 1 MiB".into());
    }
    String::from_utf8(bytes).map_err(|_| "repos.jsonc must be UTF-8".into())
}

pub fn write(path: &Path, content: &str) -> Result<(), String> {
    regular(path.parent().ok_or("Missing settings directory")?, true)?;
    if path.try_exists().map_err(|e| e.to_string())? {
        regular(path, false)?;
    }
    #[cfg(test)]
    let fault = FAULT.with(|slot| {
        if slot
            .borrow()
            .as_ref()
            .is_some_and(|(target, _)| target == path)
        {
            slot.borrow_mut().take().map(|(_, after)| after)
        } else {
            None
        }
    });
    #[cfg(test)]
    if fault == Some(false) {
        return Err("Injected failure before replacement".into());
    }
    write_settings_snapshot(path, content.as_bytes())?;
    #[cfg(test)]
    if fault == Some(true) {
        return Err("Injected failure after replacement".into());
    }
    Ok(())
}

pub fn initialize(path: &Path, content: &str) -> Result<(), String> {
    let parent = path.parent().ok_or("Missing settings directory")?;
    regular(parent, true)?;
    let mut temp = tempfile::Builder::new()
        .prefix(".repos-")
        .suffix(".tmp")
        .tempfile_in(parent)
        .map_err(|e| e.to_string())?;
    temp.write_all(content.as_bytes())
        .and_then(|_| temp.as_file().sync_all())
        .map_err(|e| e.to_string())?;
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_WRITE_THROUGH};
        let from: Vec<u16> = temp
            .path()
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect();
        let to: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        // Deliberately omit REPLACE_EXISTING: initialization must never clobber.
        if unsafe { MoveFileExW(from.as_ptr(), to.as_ptr(), MOVEFILE_WRITE_THROUGH) } != 0 {
            return Ok(());
        }
        let error = std::io::Error::last_os_error();
        return if matches!(error.raw_os_error(), Some(80 | 183)) {
            Ok(())
        } else {
            Err(error.to_string())
        };
    }
    #[cfg(not(windows))]
    match temp.persist_noclobber(path) {
        Ok(_) => {
            #[cfg(unix)]
            File::open(parent)
                .and_then(|f| f.sync_all())
                .map_err(|e| e.to_string())?;
            Ok(())
        }
        Err(e) if e.error.kind() == std::io::ErrorKind::AlreadyExists => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
thread_local! {
    static FAULT: std::cell::RefCell<Option<(PathBuf, bool)>> = const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
pub(super) fn fail_next_write(path: PathBuf, after_replace: bool) {
    FAULT.with(|fault| *fault.borrow_mut() = Some((path, after_replace)));
}
