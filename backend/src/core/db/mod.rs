use rusqlite::{params, Connection};
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager};

pub struct Database(pub Mutex<Connection>);

const SCHEMA_SQL: &str = include_str!("schema.sql");
const DATABASE_FILE_NAME: &str = "stage0.db";
const LEGACY_DATABASE_FILE_NAME: &str = "local_mr.db";

fn create_app_data_dir(path: &Path) -> io::Result<()> {
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

fn secure_app_data_dir(path: &Path) -> io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))?;
    }

    #[cfg(not(unix))]
    let _ = path; // App data inherits the current user's ACL on Windows.

    Ok(())
}

fn reject_symlink(path: &Path) -> io::Result<()> {
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

fn secure_database_file(path: &Path) -> io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))?;
    }

    #[cfg(not(unix))]
    let _ = path;

    Ok(())
}

fn sqlite_sidecar_path(database_path: &Path, suffix: &str) -> PathBuf {
    let mut path = database_path.as_os_str().to_os_string();
    path.push(suffix);
    PathBuf::from(path)
}

fn migrate_legacy_database(
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

fn fallback_app_data_dir(
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

impl Database {
    pub fn init(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let app_dir: PathBuf = match app.path().app_data_dir() {
            Ok(dir) => dir,
            Err(_) => fallback_app_data_dir(
                std::env::var_os("USERPROFILE").map(PathBuf::from),
                std::env::var_os("HOME").map(PathBuf::from),
            )?,
        };

        create_app_data_dir(&app_dir)?;
        reject_symlink(&app_dir)?;
        secure_app_data_dir(&app_dir)?;

        let db_path = app_dir.join(DATABASE_FILE_NAME);
        let legacy_db_path = app_dir.join(LEGACY_DATABASE_FILE_NAME);
        reject_symlink(&db_path)?;
        migrate_legacy_database(&legacy_db_path, &db_path)?;
        let conn = Connection::open(&db_path)?;
        secure_database_file(&db_path)?;

        // High Performance SQLite Pragmas
        conn.execute_batch(
            "
            PRAGMA trusted_schema = OFF;
            PRAGMA secure_delete = ON;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;
            PRAGMA busy_timeout = 5000;
            PRAGMA cache_size = -64000;
            PRAGMA temp_store = MEMORY;
            PRAGMA mmap_size = 268435456;
        ",
        )?;

        conn.execute_batch(SCHEMA_SQL)?;
        // Legacy 'approved' was a display-only status and carried no reviewer verdict.
        // Reopen those rows so they can satisfy the explicit Resolved rules.
        conn.execute(
            "UPDATE virtual_mr_sessions SET status='open' WHERE status='approved'",
            [],
        )?;
        let closed_duplicate_open_mrs = Self::migrate_unique_open_virtual_mr_pairs(&conn)?;
        if closed_duplicate_open_mrs > 0 {
            eprintln!(
                "Closed {closed_duplicate_open_mrs} duplicate open Virtual MR record(s) while preserving their data."
            );
        }
        conn.execute(
            "UPDATE virtual_mr_session_reviewers SET review_status='pending' WHERE review_status='reviewing'",
            [],
        )?;
        // Durable runs survive application restarts, but their in-flight model
        // calls cannot be resumed safely without an explicit replay policy.
        conn.execute(
            "UPDATE ai_review_runs SET status='interrupted' WHERE status='running'",
            [],
        )?;
        Self::migrate_discussions_fingerprint(&conn)?;
        Self::migrate_git_credentials(&conn)?;

        Ok(Database(Mutex::new(conn)))
    }

    fn migrate_unique_open_virtual_mr_pairs(conn: &Connection) -> Result<usize, rusqlite::Error> {
        let closed = conn.execute(
            "UPDATE virtual_mr_sessions
             SET status = 'closed', updated_at = CURRENT_TIMESTAMP
             WHERE status = 'open' AND rowid IN (
                 SELECT duplicate.rowid
                 FROM virtual_mr_sessions duplicate
                 WHERE duplicate.status = 'open' AND EXISTS (
                     SELECT 1 FROM virtual_mr_sessions earlier
                     WHERE earlier.status = 'open'
                       AND earlier.repo_id = duplicate.repo_id
                       AND earlier.compare_branch = duplicate.compare_branch
                       AND earlier.base_branch = duplicate.base_branch
                       AND earlier.rowid < duplicate.rowid
                 )
             );",
            [],
        )?;
        conn.execute_batch(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_vmr_unique_open_source_target
             ON virtual_mr_sessions(repo_id, compare_branch, base_branch)
             WHERE status = 'open';",
        )?;
        Ok(closed)
    }

    fn migrate_discussions_fingerprint(conn: &Connection) -> Result<(), rusqlite::Error> {
        let mut stmt = conn.prepare("PRAGMA table_info(virtual_mr_discussions);")?;
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<_, _>>()?;
        drop(stmt);

        if !columns.iter().any(|c| c == "content_hash") {
            conn.execute(
                "ALTER TABLE virtual_mr_discussions ADD COLUMN content_hash TEXT;",
                [],
            )?;
        }
        if !columns.iter().any(|c| c == "context_before") {
            conn.execute(
                "ALTER TABLE virtual_mr_discussions ADD COLUMN context_before TEXT;",
                [],
            )?;
        }
        if !columns.iter().any(|c| c == "context_after") {
            conn.execute(
                "ALTER TABLE virtual_mr_discussions ADD COLUMN context_after TEXT;",
                [],
            )?;
        }
        Ok(())
    }

    fn migrate_git_credentials(conn: &Connection) -> Result<(), rusqlite::Error> {
        let mut stmt = conn.prepare("PRAGMA table_info(git_credentials);")?;
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<_, _>>()?;
        drop(stmt);

        if !columns.iter().any(|column| column == "provider") {
            return Ok(());
        }

        for (name, definition) in [
            ("server_url", "TEXT NOT NULL DEFAULT ''"),
            ("account_name", "TEXT NOT NULL DEFAULT ''"),
            ("token_type", "TEXT NOT NULL DEFAULT ''"),
            ("label", "TEXT"),
            ("source", "TEXT NOT NULL DEFAULT 'stage0'"),
            ("helper_name", "TEXT"),
            ("created_at", "TEXT NOT NULL DEFAULT ''"),
            ("updated_at", "TEXT NOT NULL DEFAULT ''"),
        ] {
            if !columns.iter().any(|column| column == name) {
                conn.execute(
                    &format!("ALTER TABLE git_credentials ADD COLUMN {name} {definition};"),
                    [],
                )?;
            }
        }

        // Older builds kept credential metadata in this table. Copy it to the
        // dedicated SQLite metadata table before the reference table is compacted.
        conn.execute(
            "INSERT OR IGNORE INTO git_credential_metadata
                (id, provider, server_url, account_name, token_type, label, source, helper_name, created_at, updated_at)
             SELECT id, provider, server_url, account_name, token_type, label, source, helper_name, created_at, updated_at
             FROM git_credentials WHERE provider IS NOT NULL AND provider <> '';",
            [],
        )?;
        Ok(())
    }

    pub fn compact_git_credentials_metadata(&self) -> Result<(), rusqlite::Error> {
        let mut conn = self.conn();
        let mut stmt = conn.prepare("PRAGMA table_info(git_credentials);")?;
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get(1))?
            .collect::<Result<_, _>>()?;
        drop(stmt);
        if !columns.iter().any(|column| column == "provider") {
            return Ok(());
        }
        let tx = conn.transaction()?;
        tx.execute_batch(
            "CREATE TABLE git_credentials_refs_new (id TEXT PRIMARY KEY, token_ref TEXT NOT NULL UNIQUE);
             INSERT OR REPLACE INTO git_credentials_refs_new (id, token_ref) SELECT id, token_ref FROM git_credentials;
             DROP TABLE git_credentials;
             ALTER TABLE git_credentials_refs_new RENAME TO git_credentials;
             CREATE INDEX IF NOT EXISTS idx_git_credentials_token_ref ON git_credentials(token_ref);",
        )?;
        tx.commit()
    }

    #[inline]
    pub(crate) fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached("SELECT value FROM app_settings WHERE key = ?1;")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn();
        conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn delete_settings(&self, keys: &[&str]) -> Result<(), rusqlite::Error> {
        let mut conn = self.conn();
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare_cached("DELETE FROM app_settings WHERE key = ?1;")?;
            for key in keys {
                stmt.execute(params![key])?;
            }
        }
        tx.commit()
    }

    pub fn set_settings_atomic(&self, values: &[(&str, &str)]) -> Result<(), rusqlite::Error> {
        let mut conn = self.conn();
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare_cached(
                "INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;",
            )?;
            for (key, value) in values {
                stmt.execute(params![key, value])?;
            }
        }
        tx.commit()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sql_injection_payloads_are_stored_as_values() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA_SQL).unwrap();
        let db = Database(Mutex::new(conn));
        let payload = "x'); DROP TABLE repositories; --";

        db.upsert_repository("safe-id", payload, "/tmp/safe-repo")
            .unwrap();
        db.upsert_repository(payload, "attacker-controlled id", "/tmp/attacker-repo")
            .unwrap();

        // A SQL-shaped ID is an ordinary lookup value and cannot broaden DELETE.
        db.delete_repository("' OR 1=1 --").unwrap();
        let repos = db.get_recent_repositories().unwrap();
        assert_eq!(repos.len(), 2);
        assert!(repos.iter().any(|repo| repo.name == payload));

        // The same applies to key/value storage; the schema remains intact.
        db.set_setting(payload, payload).unwrap();
        assert_eq!(db.get_setting(payload).unwrap().as_deref(), Some(payload));
    }

    #[test]
    fn preference_secret_mapping_persists_only_opaque_keychain_references() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA_SQL).unwrap();
        let db = Database(Mutex::new(conn));
        db.upsert_preference_secret_ref("mcp_server/git-context", "st0_pref_random-ref")
            .unwrap();
        assert_eq!(
            db.get_preference_secret_ref("mcp_server/git-context")
                .unwrap()
                .as_deref(),
            Some("st0_pref_random-ref")
        );
        db.upsert_preference_secret_ref("mcp_server/git-context", "st0_pref_replaced-ref")
            .unwrap();
        assert_eq!(
            db.delete_preference_secret_ref("mcp_server/git-context")
                .unwrap()
                .as_deref(),
            Some("st0_pref_replaced-ref")
        );
        assert_eq!(
            db.get_preference_secret_ref("mcp_server/git-context")
                .unwrap(),
            None
        );
    }

    #[test]
    fn discussion_fingerprint_migration_adds_missing_columns() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE virtual_mr_discussions (id TEXT PRIMARY KEY);")
            .unwrap();
        Database::migrate_discussions_fingerprint(&conn).unwrap();

        let mut stmt = conn
            .prepare("PRAGMA table_info(virtual_mr_discussions);")
            .unwrap();
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get(1))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert!(columns.iter().any(|column| column == "content_hash"));
        assert!(columns.iter().any(|column| column == "context_before"));
        assert!(columns.iter().any(|column| column == "context_after"));
    }

    #[test]
    fn open_virtual_mr_pair_migration_preserves_rows_and_closes_older_duplicates() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA_SQL).unwrap();
        conn.execute_batch(
            "INSERT INTO repositories(id, name, local_path) VALUES ('repo', 'Repo', '/fixture/repo');
             INSERT INTO virtual_mr_sessions(id, repo_id, title, base_branch, compare_branch, status)
                 VALUES ('first', 'repo', 'Original', 'main', 'feature', 'open'),
                        ('second', 'repo', 'Duplicate', 'main', 'feature', 'open');",
        ).unwrap();

        assert_eq!(
            Database::migrate_unique_open_virtual_mr_pairs(&conn).unwrap(),
            1
        );
        let statuses = conn
            .prepare("SELECT id, status FROM virtual_mr_sessions ORDER BY rowid")
            .unwrap()
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(
            statuses,
            vec![
                ("first".into(), "open".into()),
                ("second".into(), "closed".into())
            ]
        );

        let insert_duplicate = conn.execute(
            "INSERT INTO virtual_mr_sessions(id, repo_id, title, base_branch, compare_branch, status)
             VALUES ('third', 'repo', 'Duplicate', 'main', 'feature', 'open');",
            [],
        );
        assert!(insert_duplicate.is_err());
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM virtual_mr_sessions", [], |row| row
                .get::<_, i64>(0))
                .unwrap(),
            2
        );
    }

    #[test]
    fn legacy_git_credential_metadata_is_migrated_to_sqlite_before_refs_are_compacted() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE git_credential_metadata (
                id TEXT PRIMARY KEY, provider TEXT NOT NULL, server_url TEXT NOT NULL,
                account_name TEXT NOT NULL, token_type TEXT NOT NULL, label TEXT,
                source TEXT NOT NULL, helper_name TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            );
            CREATE TABLE git_credentials (
                id TEXT PRIMARY KEY, token_ref TEXT NOT NULL UNIQUE, provider TEXT NOT NULL,
                server_url TEXT NOT NULL, account_name TEXT NOT NULL, token_type TEXT NOT NULL,
                label TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            );
            INSERT INTO git_credentials (id, token_ref, provider, server_url, account_name, token_type, created_at, updated_at)
            VALUES ('credential-id', 'keychain-ref', 'github', 'https://github.com', 'alice', 'pat', 'created', 'updated');",
        ).unwrap();

        Database::migrate_git_credentials(&conn).unwrap();
        let migrated_source: String = conn
            .query_row(
                "SELECT source FROM git_credentials WHERE id = 'credential-id'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(migrated_source, "stage0");

        let db = Database(Mutex::new(conn));
        db.compact_git_credentials_metadata().unwrap();
        db.compact_git_credentials_metadata().unwrap();
        let (provider, account_name): (String, String) = db
            .conn()
            .query_row(
                "SELECT provider, account_name FROM git_credential_metadata WHERE id = 'credential-id'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(
            (provider.as_str(), account_name.as_str()),
            ("github", "alice")
        );
        let (id, token_ref): (String, String) = db
            .conn()
            .query_row("SELECT id, token_ref FROM git_credentials", [], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .unwrap();
        assert_eq!(
            (id.as_str(), token_ref.as_str()),
            ("credential-id", "keychain-ref")
        );
        let columns: Vec<String> = db
            .conn()
            .prepare("PRAGMA table_info(git_credentials)")
            .unwrap()
            .query_map([], |row| row.get(1))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(columns, vec!["id", "token_ref"]);
    }

    #[test]
    fn failed_git_credential_compaction_keeps_legacy_table_and_row() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE git_credentials (
                id TEXT PRIMARY KEY, token_ref TEXT NOT NULL UNIQUE, provider TEXT NOT NULL
            );
            INSERT INTO git_credentials VALUES ('credential-id', 'keychain-ref', 'github');
            CREATE TABLE git_credentials_refs_new (id TEXT PRIMARY KEY, token_ref TEXT NOT NULL UNIQUE);",
        ).unwrap();
        let db = Database(Mutex::new(conn));

        assert!(db.compact_git_credentials_metadata().is_err());
        let (provider, token_ref): (String, String) = db
            .conn()
            .query_row(
                "SELECT provider, token_ref FROM git_credentials WHERE id = 'credential-id'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(
            (provider.as_str(), token_ref.as_str()),
            ("github", "keychain-ref")
        );
    }

    #[test]
    fn atomic_settings_writes_roll_back_together_on_failure() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA_SQL).unwrap();
        conn.execute_batch(
            "CREATE TRIGGER reject_setting BEFORE INSERT ON app_settings
             WHEN NEW.key = 'fail' BEGIN SELECT RAISE(ABORT, 'test failure'); END;",
        )
        .unwrap();
        let db = Database(Mutex::new(conn));

        assert!(db
            .set_settings_atomic(&[("first", "1"), ("fail", "2")])
            .is_err());
        assert_eq!(db.get_setting("first").unwrap(), None);
    }

    #[test]
    fn legacy_preferences_can_be_removed_without_touching_other_settings() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA_SQL).unwrap();
        let db = Database(Mutex::new(conn));
        db.set_setting("git_binary_id", "custom").unwrap();
        db.set_setting("git_binary_path", "/tools/git").unwrap();
        db.set_setting("unrelated_runtime_value", "keep").unwrap();

        db.delete_settings(&["git_binary_id", "git_binary_path"])
            .unwrap();
        assert_eq!(db.get_setting("git_binary_id").unwrap(), None);
        assert_eq!(db.get_setting("git_binary_path").unwrap(), None);
        assert_eq!(
            db.get_setting("unrelated_runtime_value")
                .unwrap()
                .as_deref(),
            Some("keep")
        );
    }

    #[test]
    fn repository_upsert_returns_the_persisted_id_for_an_existing_path() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA_SQL).unwrap();
        let db = Database(Mutex::new(conn));

        let first = db
            .upsert_repository("", "First name", "/tmp/stable-repository")
            .unwrap();
        let second = db
            .upsert_repository("", "Updated name", "/tmp/stable-repository")
            .unwrap();

        assert_eq!(first.id, second.id);
        assert_eq!(second.name, "Updated name");
        assert_eq!(second.local_path, "/tmp/stable-repository");
    }

    #[cfg(unix)]
    #[test]
    fn app_database_storage_permissions_are_private() {
        use std::os::unix::fs::PermissionsExt;

        let dir =
            std::env::temp_dir().join(format!("stage0_db_permissions_{}", uuid::Uuid::new_v4()));
        create_app_data_dir(&dir).unwrap();
        secure_app_data_dir(&dir).unwrap();

        let db_path = dir.join(DATABASE_FILE_NAME);
        std::fs::write(&db_path, b"").unwrap();
        secure_database_file(&db_path).unwrap();

        assert_eq!(
            std::fs::metadata(&dir).unwrap().permissions().mode() & 0o777,
            0o700
        );
        assert_eq!(
            std::fs::metadata(&db_path).unwrap().permissions().mode() & 0o777,
            0o600
        );

        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn legacy_database_is_renamed_to_stage0_without_losing_settings() {
        let dir = std::env::temp_dir().join(format!("stage0_db_rename_{}", uuid::Uuid::new_v4()));
        create_app_data_dir(&dir).unwrap();
        let legacy_path = dir.join(LEGACY_DATABASE_FILE_NAME);
        let database_path = dir.join(DATABASE_FILE_NAME);

        let legacy = Connection::open(&legacy_path).unwrap();
        legacy.execute_batch(SCHEMA_SQL).unwrap();
        legacy
            .execute(
                "INSERT INTO app_settings (key, value) VALUES (?1, ?2);",
                params!["theme", "mocha"],
            )
            .unwrap();
        drop(legacy);

        migrate_legacy_database(&legacy_path, &database_path).unwrap();

        assert!(!legacy_path.exists());
        assert!(database_path.is_file());
        let migrated = Connection::open(&database_path).unwrap();
        let value: String = migrated
            .query_row(
                "SELECT value FROM app_settings WHERE key = ?1;",
                params!["theme"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(value, "mocha");

        drop(migrated);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn existing_stage0_database_is_never_overwritten_by_legacy_database() {
        let dir = std::env::temp_dir().join(format!(
            "stage0_db_rename_existing_{}",
            uuid::Uuid::new_v4()
        ));
        create_app_data_dir(&dir).unwrap();
        let legacy_path = dir.join(LEGACY_DATABASE_FILE_NAME);
        let database_path = dir.join(DATABASE_FILE_NAME);

        for (path, value) in [(&legacy_path, "legacy"), (&database_path, "current")] {
            let connection = Connection::open(path).unwrap();
            connection.execute_batch(SCHEMA_SQL).unwrap();
            connection
                .execute(
                    "INSERT INTO app_settings (key, value) VALUES (?1, ?2);",
                    params!["source", value],
                )
                .unwrap();
        }

        migrate_legacy_database(&legacy_path, &database_path).unwrap();
        assert!(legacy_path.is_file());
        let current = Connection::open(&database_path).unwrap();
        let value: String = current
            .query_row(
                "SELECT value FROM app_settings WHERE key = ?1;",
                params!["source"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(value, "current");

        drop(current);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn database_fallback_requires_an_absolute_user_directory() {
        assert!(fallback_app_data_dir(Some(PathBuf::new()), None).is_err());
        assert_eq!(
            fallback_app_data_dir(
                Some(PathBuf::from("relative-user")),
                Some(PathBuf::from("/users/stage0")),
            )
            .unwrap(),
            PathBuf::from("/users/stage0/.local-virtual-mr")
        );
    }
}
