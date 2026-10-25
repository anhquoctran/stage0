use super::plaintext_migration::encrypt_plaintext_database;
use super::storage::{reject_symlink, secure_database_file, sqlite_sidecar_path};
use rusqlite::{ffi, Connection};
use std::fs::File;
use std::io::{self, Read};
use std::path::Path;

pub(super) fn has_plaintext_header(path: &Path) -> io::Result<bool> {
    reject_symlink(path)?;
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error),
    };
    let mut header = [0u8; 16];
    match file.read_exact(&mut header) {
        Ok(()) => Ok(&header == b"SQLite format 3\0"),
        Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => Ok(false),
        Err(error) => Err(error),
    }
}

pub(super) fn needs_existing_key(path: &Path) -> io::Result<bool> {
    reject_symlink(path)?;
    match std::fs::metadata(path) {
        Ok(metadata) => Ok(metadata.len() != 0 && !has_plaintext_header(path)?),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error),
    }
}

pub(super) fn open_database(
    path: &Path,
    key: &[u8],
) -> Result<Connection, Box<dyn std::error::Error>> {
    reject_database_symlinks(path)?;
    if has_plaintext_header(path)? {
        encrypt_plaintext_database(path, key)?;
    }
    open_keyed_database(path, key)
}

pub(super) fn open_keyed_database(
    path: &Path,
    key: &[u8],
) -> Result<Connection, Box<dyn std::error::Error>> {
    reject_database_symlinks(path)?;
    if key.len() != 32 {
        return Err(io::Error::other("The database key must contain 256 bits").into());
    }
    let connection = Connection::open(path)?;
    secure_database_file(path)?;
    // The C API avoids putting the password in SQL text, trace logs, or errors.
    // The connection is live and the borrowed buffer remains valid for this call.
    let result =
        unsafe { ffi::sqlite3_key(connection.handle(), key.as_ptr().cast(), key.len() as i32) };
    if result != ffi::SQLITE_OK {
        return Err(io::Error::other("Could not set the database encryption key").into());
    }
    require_sqlcipher(&connection)?;
    connection
        .execute_batch("PRAGMA cipher_compatibility = 4; PRAGMA cipher_memory_security = ON;")?;
    connection.query_row("SELECT count(*) FROM sqlite_master", [], |row| row.get::<_, i64>(0))
        .map_err(|_| io::Error::other("Cannot decrypt the database: its key is unavailable, incorrect, or the file is damaged. The database was retained"))?;
    Ok(connection)
}

pub(super) fn require_sqlcipher(connection: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    let version: String = connection
        .query_row("PRAGMA cipher_version", [], |row| row.get(0))
        .map_err(|_| {
            io::Error::other(
                "This build does not include SQLCipher; refusing to open an unencrypted database",
            )
        })?;
    if version.trim().is_empty() {
        return Err(io::Error::other("SQLCipher encryption is unavailable").into());
    }
    Ok(())
}

pub(super) fn reject_database_symlinks(path: &Path) -> io::Result<()> {
    reject_symlink(path)?;
    for suffix in ["-wal", "-shm", "-journal"] {
        reject_symlink(&sqlite_sidecar_path(path, suffix))?;
    }
    Ok(())
}

pub(super) fn verify_database(connection: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    let result: String = connection.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if result != "ok" {
        return Err(io::Error::other("Database integrity verification failed").into());
    }
    let mut statement = connection.prepare("PRAGMA cipher_integrity_check")?;
    if statement.query([])?.next()?.is_some() {
        return Err(io::Error::other("Database encryption integrity verification failed").into());
    }
    Ok(())
}
