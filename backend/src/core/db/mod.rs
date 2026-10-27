//! SQLite connection facade. Storage, schema migration and setting queries are separate concerns.
mod migrations;
mod settings;
mod storage;

use rusqlite::Connection;
use std::{fs::File, path::PathBuf, sync::Mutex};
#[cfg(test)]
use storage::secure_database_file;
use storage::{
    acquire_database_lock, create_app_data_dir, fallback_app_data_dir, migrate_legacy_database,
    open_database, reject_symlink, secure_app_data_dir,
};
use tauri::{AppHandle, Manager};

pub struct Database {
    connection: Mutex<Connection>,
    _storage_lock: Option<File>,
}
const SCHEMA_SQL: &str = include_str!("schema.sql");
const DATABASE_FILE_NAME: &str = "stage0.db";
const LEGACY_DATABASE_FILE_NAME: &str = "local_mr.db";

impl Database {
    pub fn init(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let app_dir: PathBuf = match app.path().app_data_dir() {
            Ok(dir) => dir,
            Err(_) => fallback_app_data_dir(
                std::env::var_os("USERPROFILE").map(PathBuf::from),
                std::env::var_os("HOME").map(PathBuf::from),
            )?,
        };

        reject_symlink(&app_dir)?;
        create_app_data_dir(&app_dir)?;
        secure_app_data_dir(&app_dir)?;
        let storage_lock = acquire_database_lock(&app_dir)?;

        let db_path = app_dir.join(DATABASE_FILE_NAME);
        let legacy_db_path = app_dir.join(LEGACY_DATABASE_FILE_NAME);
        reject_symlink(&db_path)?;
        migrate_legacy_database(&legacy_db_path, &db_path)?;
        let conn = open_database(&db_path)?;

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
            PRAGMA mmap_size = 0;
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

        Ok(Database {
            connection: Mutex::new(conn),
            _storage_lock: Some(storage_lock),
        })
    }

    #[inline]
    pub(crate) fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.connection
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    #[cfg(test)]
    pub(crate) fn from_connection(connection: Connection) -> Self {
        Self {
            connection: Mutex::new(connection),
            _storage_lock: None,
        }
    }
}

#[cfg(test)]
mod storage_tests;
#[cfg(test)]
mod tests;
