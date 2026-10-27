use super::storage::{acquire_database_lock, open_database, sqlite_sidecar_path};
use rusqlite::Connection;

#[test]
fn ordinary_sqlite_reopens_without_a_password_or_key_reference() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("stage0.db");
    let connection = open_database(&path).unwrap();
    connection
        .execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE data(value TEXT);")
        .unwrap();
    connection
        .execute("INSERT INTO data VALUES (?1)", ["retained"])
        .unwrap();
    drop(connection);
    assert_eq!(&std::fs::read(&path).unwrap()[..16], b"SQLite format 3\0");
    assert!(!directory.path().join("database-key.json").exists());
    let ordinary = Connection::open(&path).unwrap();
    assert_eq!(
        ordinary
            .query_row("SELECT value FROM data", [], |row| row.get::<_, String>(0))
            .unwrap(),
        "retained"
    );
    assert!(ordinary
        .query_row("PRAGMA cipher_version", [], |row| row.get::<_, String>(0))
        .is_err());
}

#[test]
fn unreadable_old_database_is_retained_with_a_reset_instruction() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("stage0.db");
    let original = vec![73; 4096];
    std::fs::write(&path, &original).unwrap();
    let error = open_database(&path).unwrap_err().to_string();
    assert!(error.contains("Reset local app state"));
    assert_eq!(std::fs::read(&path).unwrap(), original);
}

#[test]
fn database_lock_prevents_a_second_opener_until_the_first_closes() {
    let directory = tempfile::tempdir().unwrap();
    let first = acquire_database_lock(directory.path()).unwrap();
    assert!(acquire_database_lock(directory.path()).is_err());
    drop(first);
    assert!(acquire_database_lock(directory.path()).is_ok());
}

#[cfg(unix)]
#[test]
fn sqlite_and_all_sidecars_reject_symlinks_without_changing_the_target() {
    use std::os::unix::fs::symlink;
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("stage0.db");
    let other = directory.path().join("other.db");
    std::fs::write(&other, b"retained").unwrap();
    for suffix in ["", "-wal", "-shm", "-journal"] {
        let link = sqlite_sidecar_path(&path, suffix);
        symlink(&other, &link).unwrap();
        assert!(open_database(&path).is_err());
        assert_eq!(std::fs::read(&other).unwrap(), b"retained");
        std::fs::remove_file(link).unwrap();
    }
}

#[cfg(unix)]
#[test]
fn ordinary_sqlite_file_stays_private() {
    use std::os::unix::fs::PermissionsExt;
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("stage0.db");
    let _connection = open_database(&path).unwrap();
    assert_eq!(
        std::fs::metadata(path).unwrap().permissions().mode() & 0o777,
        0o600
    );
}
