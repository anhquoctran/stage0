use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::{params, Connection};
use tauri::{AppHandle, Manager};
use crate::git::RepoInfo;

pub struct Database(pub Mutex<Connection>);

const SCHEMA_SQL: &str = include_str!("schema.sql");

impl Database {
    pub fn init(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let app_dir: PathBuf = match app.path().app_data_dir() {
            Ok(dir) => dir,
            Err(_) => {
                let user_dir = std::env::var("USERPROFILE")
                    .or_else(|_| std::env::var("HOME"))
                    .unwrap_or_else(|_| ".".to_string());
                PathBuf::from(user_dir).join(".local-virtual-mr")
            }
        };

        if !app_dir.exists() {
            std::fs::create_dir_all(&app_dir)?;
        }

        let db_path = app_dir.join("local_mr.db");
        let conn = Connection::open(&db_path)?;

        conn.execute_batch(SCHEMA_SQL)?;

        Ok(Database(Mutex::new(conn)))
    }

    pub fn upsert_repository(
        &self,
        id: &str,
        name: &str,
        local_path: &str,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO repositories (id, name, local_path, last_opened_at)
             VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
             ON CONFLICT(local_path) DO UPDATE SET
                name = excluded.name,
                last_opened_at = CURRENT_TIMESTAMP;",
            params![id, name, local_path],
        )?;
        Ok(())
    }

    pub fn get_recent_repositories(&self) -> Result<Vec<RepoInfo>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, local_path FROM repositories ORDER BY last_opened_at DESC LIMIT 20;",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(RepoInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                local_path: row.get(2)?,
            })
        })?;

        let mut repos = Vec::new();
        for row in rows {
            repos.push(row?);
        }

        Ok(repos)
    }

    pub fn delete_repository(&self, id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute("DELETE FROM repositories WHERE id = ?1;", params![id])?;
        Ok(())
    }

    pub fn clear_all_repositories(&self) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute("DELETE FROM repositories;", [])?;
        Ok(())
    }

    pub fn insert_git_credential(
        &self,
        id: &str,
        provider: &str,
        server_url: &str,
        account_name: &str,
        token_ref: &str,
        token_type: &str,
        label: Option<&str>,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO git_credentials (id, provider, server_url, account_name, token_ref, token_type, label, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
            params![id, provider, server_url, account_name, token_ref, token_type, label],
        )?;
        Ok(())
    }

    pub fn get_all_git_credentials(&self) -> Result<Vec<crate::credentials::GitCredentialMeta>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, provider, server_url, account_name, token_ref, token_type, label, created_at, updated_at
             FROM git_credentials
             ORDER BY created_at DESC;",
        )?;

        let rows = stmt.query_map([], |row| {
            let token_ref: String = row.get(4)?;
            let is_in_keyring = crate::credentials::exists_in_keyring(&token_ref);
            Ok(crate::credentials::GitCredentialMeta {
                id: row.get(0)?,
                provider: row.get(1)?,
                server_url: row.get(2)?,
                account_name: row.get(3)?,
                token_ref,
                token_type: row.get(5)?,
                label: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                is_in_keyring,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn delete_git_credential(&self, id: &str) -> Result<Option<String>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let token_ref: Option<String> = conn
            .query_row(
                "SELECT token_ref FROM git_credentials WHERE id = ?1;",
                params![id],
                |row| row.get(0),
            )
            .ok();

        if token_ref.is_some() {
            conn.execute("DELETE FROM git_credentials WHERE id = ?1;", params![id])?;
        }
        Ok(token_ref)
    }

    pub fn get_git_credential_token_ref(&self, id: &str) -> Result<Option<String>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let token_ref: Option<String> = conn
            .query_row(
                "SELECT token_ref FROM git_credentials WHERE id = ?1;",
                params![id],
                |row| row.get(0),
            )
            .ok();
        Ok(token_ref)
    }
}

