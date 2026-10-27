use super::*;
use rusqlite::params;

#[test]
fn sql_injection_payloads_are_stored_as_values() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(SCHEMA_SQL).unwrap();
    let db = Database::from_connection(conn);
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
    let db = Database::from_connection(conn);
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
    assert!(columns.iter().any(|column| column == "code_snippet"));
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
    )
    .unwrap();

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

    let db = Database::from_connection(conn);
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
    let db = Database::from_connection(conn);

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
    let db = Database::from_connection(conn);

    assert!(db
        .set_settings_atomic(&[("first", "1"), ("fail", "2")])
        .is_err());
    assert_eq!(db.get_setting("first").unwrap(), None);
}

#[test]
fn settings_are_consumed_once_only_for_the_expected_value() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(SCHEMA_SQL).unwrap();
    let db = Database::from_connection(conn);
    db.set_setting("pending_release_notes_version", "0.1.13")
        .unwrap();

    assert!(!db
        .consume_setting_if_value("pending_release_notes_version", "0.1.12")
        .unwrap());
    assert_eq!(
        db.get_setting("pending_release_notes_version")
            .unwrap()
            .as_deref(),
        Some("0.1.13")
    );
    assert!(db
        .consume_setting_if_value("pending_release_notes_version", "0.1.13")
        .unwrap());
    assert!(!db
        .consume_setting_if_value("pending_release_notes_version", "0.1.13")
        .unwrap());
}

#[test]
fn legacy_preferences_can_be_removed_without_touching_other_settings() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(SCHEMA_SQL).unwrap();
    let db = Database::from_connection(conn);
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
    let db = Database::from_connection(conn);

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

    let dir = std::env::temp_dir().join(format!("stage0_db_permissions_{}", uuid::Uuid::new_v4()));
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
