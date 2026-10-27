use rusqlite::Connection;
use std::{
    io,
    path::{Path, PathBuf},
    time::Duration,
};

pub(super) fn open_database(path: &Path) -> Result<Connection, Box<dyn std::error::Error>> {
    reject_symlink(path)?;
    for suffix in ["-wal", "-shm", "-journal"] {
        reject_symlink(&sqlite_sidecar_path(path, suffix))?;
    }
    let connection = Connection::open(path)?;
    secure_database_file(path)?;
    connection
        .query_row("SELECT count(*) FROM sqlite_master", [], |row| row.get::<_, i64>(0))
        .map_err(|_| io::Error::other(
            "Cannot read the Stage0 SQLite database. It may be encrypted or damaged. Reset local app state to start fresh, or restore it with a compatible build. The existing file was retained",
        ))?;
    Ok(connection)
}

pub(super) fn create_app_data_dir(path: &Path) -> io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;

        std::fs::DirBuilder::new()
            .recursive(true)
            .mode(0o700)
            .create(path)?;
    }

    #[cfg(not(unix))]
    std::fs::create_dir_all(path)?;

    Ok(())
}

pub(super) fn secure_app_data_dir(path: &Path) -> io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))?;
    }

    #[cfg(not(unix))]
    let _ = path; // App data inherits the current user's ACL on Windows.

    Ok(())
}

pub(super) fn reject_symlink(path: &Path) -> io::Result<()> {
    match std::fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "SQLite data paths must not be symbolic links",
        )),
        Ok(_) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}

pub(super) fn secure_database_file(path: &Path) -> io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))?;
    }

    #[cfg(not(unix))]
    let _ = path;

    Ok(())
}

pub(super) fn acquire_database_lock(directory: &Path) -> io::Result<std::fs::File> {
    use fs2::FileExt;
    let path = directory.join(".database.lock");
    reject_symlink(&path)?;
    let mut options = std::fs::OpenOptions::new();
    options.read(true).write(true).create(true).truncate(false);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let file = options.open(&path)?;
    secure_database_file(&path)?;
    file.try_lock_exclusive().map_err(|_| {
        io::Error::new(
            io::ErrorKind::WouldBlock,
            "The Stage0 database is already open in another process",
        )
    })?;
    Ok(file)
}

pub(super) fn sqlite_sidecar_path(database_path: &Path, suffix: &str) -> PathBuf {
    let mut path = database_path.as_os_str().to_os_string();
    path.push(suffix);
    PathBuf::from(path)
}

pub(super) fn migrate_legacy_database(
    legacy_path: &Path,
    database_path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    reject_symlink(database_path)?;
    reject_symlink(legacy_path)?;

    if database_path.exists() || !legacy_path.exists() {
        return Ok(());
    }

    let wal_path = sqlite_sidecar_path(legacy_path, "-wal");
    let shm_path = sqlite_sidecar_path(legacy_path, "-shm");
    let journal_path = sqlite_sidecar_path(legacy_path, "-journal");
    for sidecar in [&wal_path, &shm_path, &journal_path] {
        reject_symlink(sidecar)?;
    }

    // Checkpoint before moving the database so committed WAL contents are
    // incorporated into the main file. If another process still holds a
    // conflicting SQLite lock, fail safely and leave the legacy DB untouched.
    let connection = Connection::open(legacy_path)?;
    connection.busy_timeout(Duration::from_secs(5))?;
    let (busy, _, _): (i64, i64, i64) =
        connection.query_row("PRAGMA wal_checkpoint(TRUNCATE);", [], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?;
    if busy != 0 {
        return Err(io::Error::new(
            io::ErrorKind::WouldBlock,
            "Cannot rename the Stage0 database while another process is using it",
        )
        .into());
    }
    drop(connection);

    // SQLite sidecars are transient. A non-empty WAL or journal after a
    // successful checkpoint/close is unexpected; do not risk discarding it.
    if wal_path.exists() && std::fs::metadata(&wal_path)?.len() != 0 {
        return Err(io::Error::new(
            io::ErrorKind::WouldBlock,
            "Cannot safely rename the Stage0 database while its WAL still contains data",
        )
        .into());
    }
    if journal_path.exists() && std::fs::metadata(&journal_path)?.len() != 0 {
        return Err(io::Error::new(
            io::ErrorKind::WouldBlock,
            "Cannot safely rename the Stage0 database while its journal is still present",
        )
        .into());
    }

    for sidecar in [&wal_path, &shm_path, &journal_path] {
        match std::fs::remove_file(sidecar) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }

    std::fs::rename(legacy_path, database_path)?;
    secure_database_file(database_path)?;
    Ok(())
}

pub(super) fn fallback_app_data_dir(
    user_profile: Option<PathBuf>,
    home: Option<PathBuf>,
) -> io::Result<PathBuf> {
    let user_dir = user_profile
        .filter(|path| path.is_absolute())
        .or_else(|| home.filter(|path| path.is_absolute()))
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::NotFound,
                "Unable to locate an absolute per-user data directory for the application database",
            )
        })?;
    Ok(user_dir.join(".local-virtual-mr"))
}
