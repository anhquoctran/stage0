use super::encrypted_storage::{
    has_plaintext_header, needs_existing_key, open_database, open_keyed_database, verify_database,
};
use super::storage::sqlite_sidecar_path;
use rusqlite::{params, Connection};

const KEY: [u8; 32] = [73; 32];
const SECRET: &str = "stage0-private-database-payload-0123456789";

fn contains_plaintext(bytes: &[u8]) -> bool {
    bytes
        .windows(SECRET.len())
        .any(|window| window == SECRET.as_bytes())
}

#[test]
fn encrypted_database_and_wal_require_the_correct_key() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("stage0.db");
    let connection = open_database(&path, &KEY).unwrap();
    connection
        .execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE private_data(value TEXT);")
        .unwrap();
    connection
        .execute("INSERT INTO private_data VALUES (?1)", [SECRET])
        .unwrap();
    assert!(needs_existing_key(&path).unwrap());
    assert!(!has_plaintext_header(&path).unwrap());
    assert!(!contains_plaintext(&std::fs::read(&path).unwrap()));
    assert!(!contains_plaintext(
        &std::fs::read(sqlite_sidecar_path(&path, "-wal")).unwrap()
    ));
    verify_database(&connection).unwrap();
    drop(connection);

    let plain = Connection::open(&path).unwrap();
    assert!(plain
        .query_row("SELECT value FROM private_data", [], |row| row
            .get::<_, String>(0))
        .is_err());
    drop(plain);
    let original = std::fs::read(&path).unwrap();
    assert!(open_database(&path, &[74; 32]).is_err());
    assert_eq!(std::fs::read(&path).unwrap(), original);
    let reopened = open_database(&path, &KEY).unwrap();
    let payload: String = reopened
        .query_row("SELECT value FROM private_data", [], |row| row.get(0))
        .unwrap();
    assert_eq!(payload, SECRET);
}

#[test]
fn plaintext_migration_preserves_committed_wal_schema_blobs_and_metadata() {
    let source_directory = tempfile::tempdir().unwrap();
    let source_path = source_directory.path().join("source.db");
    let source = Connection::open(&source_path).unwrap();
    source.execute_batch(
        "PRAGMA auto_vacuum=1; PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;
         PRAGMA user_version=17; PRAGMA application_id=1398032176;
         CREATE TABLE private_data(id INTEGER PRIMARY KEY, value TEXT, payload BLOB);
         CREATE TABLE audit(value TEXT);
         CREATE INDEX private_value_idx ON private_data(value);
         CREATE VIEW private_view AS SELECT value FROM private_data;
         CREATE TRIGGER private_update AFTER UPDATE ON private_data BEGIN INSERT INTO audit VALUES(new.value); END;",
    ).unwrap();
    source
        .execute(
            "INSERT INTO private_data VALUES (7, ?1, ?2)",
            params![SECRET, vec![0u8, 255, 7, 0]],
        )
        .unwrap();
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("stage0.db");
    // Take a stable fixture snapshot after commit while the source is idle. The
    // table and row are still in its WAL, exercising checkpoint-before-export.
    for suffix in ["", "-wal", "-shm"] {
        std::fs::copy(
            sqlite_sidecar_path(&source_path, suffix),
            sqlite_sidecar_path(&path, suffix),
        )
        .unwrap();
    }
    assert!(has_plaintext_header(&path).unwrap());
    let migrated = open_database(&path, &KEY).unwrap();
    let (id, value, blob): (i64, String, Vec<u8>) = migrated
        .query_row("SELECT id, value, payload FROM private_data", [], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .unwrap();
    assert_eq!((id, value, blob), (7, SECRET.into(), vec![0, 255, 7, 0]));
    for (name, expected) in [
        ("user_version", 17),
        ("application_id", 1398032176),
        ("auto_vacuum", 1),
    ] {
        assert_eq!(
            migrated
                .pragma_query_value(None, name, |row| row.get::<_, i64>(0))
                .unwrap(),
            expected
        );
    }
    let index: String = migrated
        .query_row(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='private_value_idx'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(index, "private_value_idx");
    migrated
        .execute("UPDATE private_data SET value='changed' WHERE id=7", [])
        .unwrap();
    assert_eq!(
        migrated
            .query_row("SELECT value FROM audit", [], |row| row.get::<_, String>(0))
            .unwrap(),
        "changed"
    );
    assert_eq!(
        migrated
            .query_row("SELECT value FROM private_view", [], |row| row
                .get::<_, String>(0))
            .unwrap(),
        "changed"
    );
    verify_database(&migrated).unwrap();
    drop(migrated);
    assert!(!has_plaintext_header(&path).unwrap());
    assert!(!contains_plaintext(&std::fs::read(&path).unwrap()));
    assert!(!sqlite_sidecar_path(&path, "-wal").exists());
    assert!(!sqlite_sidecar_path(&path, "-journal").exists());
    assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
}

#[test]
fn active_plaintext_writer_prevents_replacement_without_losing_its_data() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("stage0.db");
    let writer = Connection::open(&path).unwrap();
    writer
        .execute_batch("CREATE TABLE private_data(value TEXT);")
        .unwrap();
    writer
        .execute("INSERT INTO private_data VALUES (?1)", [SECRET])
        .unwrap();
    writer.execute_batch("BEGIN EXCLUSIVE").unwrap();
    let original = std::fs::read(&path).unwrap();
    assert!(open_database(&path, &KEY).is_err());
    assert_eq!(std::fs::read(&path).unwrap(), original);
    writer.execute_batch("ROLLBACK").unwrap();
    assert_eq!(
        writer
            .query_row("SELECT value FROM private_data", [], |row| row
                .get::<_, String>(0))
            .unwrap(),
        SECRET
    );
    assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
}

#[test]
fn corrupt_encrypted_pages_fail_integrity_checks_without_resetting_data() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("stage0.db");
    let connection = open_database(&path, &KEY).unwrap();
    connection
        .execute_batch("CREATE TABLE private_data(value TEXT);")
        .unwrap();
    connection
        .execute("INSERT INTO private_data VALUES (?1)", [SECRET])
        .unwrap();
    drop(connection);
    let mut bytes = std::fs::read(&path).unwrap();
    assert!(bytes.len() >= 8192);
    bytes[4096 + 80] ^= 0x55;
    std::fs::write(&path, &bytes).unwrap();
    match open_keyed_database(&path, &KEY) {
        Ok(connection) => assert!(verify_database(&connection).is_err()),
        Err(_) => {}
    }
    assert_eq!(std::fs::read(&path).unwrap(), bytes);
}

#[cfg(unix)]
#[test]
fn encryption_refuses_database_or_wal_symlinks() {
    use std::os::unix::fs::symlink;
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("stage0.db");
    let other = directory.path().join("other.db");
    std::fs::write(&other, b"retained").unwrap();
    symlink(&other, &path).unwrap();
    assert!(open_database(&path, &KEY).is_err());
    std::fs::remove_file(&path).unwrap();
    symlink(&other, sqlite_sidecar_path(&path, "-wal")).unwrap();
    assert!(open_database(&path, &KEY).is_err());
    assert_eq!(std::fs::read(other).unwrap(), b"retained");
}
