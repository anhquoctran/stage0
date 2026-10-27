use super::encrypted_storage::{
    open_keyed_database, reject_database_symlinks, require_sqlcipher, verify_database,
};
use super::storage::{secure_database_file, sqlite_sidecar_path};
use rusqlite::{params, Connection, OpenFlags};
use std::fs::{File, OpenOptions};
use std::io;
use std::path::Path;
use std::time::Duration;

/// Export into a private encrypted file, verify it, and atomically replace the
/// original. No permanent plaintext backup is created by this migration.
pub(super) fn encrypt_plaintext_database(
    path: &Path,
    key: &[u8],
) -> Result<(), Box<dyn std::error::Error>> {
    reject_database_symlinks(path)?;
    let temporary = path.with_file_name(format!(".stage0-encrypt-{}.db", uuid::Uuid::new_v4()));
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options.open(&temporary)?;
    let result = export_and_replace(path, &temporary, key);
    if result.is_err() {
        // Only this attempt's encrypted scratch files are removed on failure.
        for suffix in ["", "-journal", "-wal", "-shm"] {
            let _ = std::fs::remove_file(sqlite_sidecar_path(&temporary, suffix));
        }
    }
    result
}

fn export_and_replace(
    path: &Path,
    temporary: &Path,
    key: &[u8],
) -> Result<(), Box<dyn std::error::Error>> {
    let source = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_WRITE)?;
    secure_database_file(path)?;
    require_sqlcipher(&source)?;
    source.busy_timeout(Duration::from_secs(5))?;
    source.execute_batch("PRAGMA cipher_memory_security = ON; PRAGMA temp_store = MEMORY; PRAGMA secure_delete = ON;")?;
    let (busy, _, _): (i64, i64, i64) =
        source.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?;
    if busy != 0 {
        return Err(io::Error::new(
            io::ErrorKind::WouldBlock,
            "Close other database connections before encrypting Stage0 data",
        )
        .into());
    }
    let mode: String = source.query_row("PRAGMA journal_mode = DELETE", [], |row| row.get(0))?;
    if !mode.eq_ignore_ascii_case("delete") {
        return Err(io::Error::other("Could not safely checkpoint the plaintext database").into());
    }
    source.execute_batch("BEGIN EXCLUSIVE")?;
    let user_version: i64 = source.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    let application_id: i64 = source.query_row("PRAGMA application_id", [], |row| row.get(0))?;
    let auto_vacuum: i64 = source.query_row("PRAGMA auto_vacuum", [], |row| row.get(0))?;
    let target = temporary
        .to_str()
        .ok_or_else(|| io::Error::other("Database path is not valid UTF-8"))?;
    // Bind the binary key; never interpolate secret material into SQL strings.
    source.execute(
        "ATTACH DATABASE ?1 AS encrypted KEY ?2",
        params![target, key],
    )?;
    source.execute_batch("PRAGMA encrypted.cipher_compatibility = 4;")?;
    source.pragma_update(Some("encrypted"), "auto_vacuum", auto_vacuum)?;
    source.query_row("SELECT sqlcipher_export('encrypted')", [], |_| Ok(()))?;
    source.pragma_update(Some("encrypted"), "user_version", user_version)?;
    source.pragma_update(Some("encrypted"), "application_id", application_id)?;
    source.execute_batch("COMMIT; DETACH DATABASE encrypted;")?;
    drop(source);

    let encrypted = open_keyed_database(temporary, key)?;
    verify_database(&encrypted)?;
    encrypted.close().map_err(|(_, error)| error)?;
    File::open(temporary)?.sync_all()?;
    replace_database(temporary, path)?;
    #[cfg(unix)]
    File::open(
        path.parent()
            .ok_or_else(|| io::Error::other("Database parent is unavailable"))?,
    )?
    .sync_all()?;
    Ok(())
}

#[cfg(not(windows))]
fn replace_database(temporary: &Path, original: &Path) -> io::Result<()> {
    std::fs::rename(temporary, original)
}

#[cfg(windows)]
fn replace_database(temporary: &Path, original: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::ReplaceFileW;
    let orig_wide: Vec<u16> = original.as_os_str().encode_wide().chain(Some(0)).collect();
    let temp_wide: Vec<u16> = temporary.as_os_str().encode_wide().chain(Some(0)).collect();
    // Both files are closed; no plaintext backup path is passed to ReplaceFileW.
    let result = unsafe {
        ReplaceFileW(
            orig_wide.as_ptr(),
            temp_wide.as_ptr(),
            std::ptr::null(),
            0,
            std::ptr::null(),
            std::ptr::null(),
        )
    };
    if result != 0 {
        Ok(())
    } else {
        std::fs::rename(temporary, original)
    }
}
