use crate::git::RepoInfo;
use rusqlite::{params, Connection};
use std::collections::HashMap;
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
        Self::migrate_discussions_fingerprint(&conn)?;

        Ok(Database(Mutex::new(conn)))
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

    #[inline]
    fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn upsert_repository(
        &self,
        id: &str,
        name: &str,
        local_path: &str,
    ) -> Result<RepoInfo, rusqlite::Error> {
        let conn = self.conn();
        let id = if id.is_empty() {
            uuid::Uuid::new_v4().to_string()
        } else {
            id.to_string()
        };
        conn.execute(
            "INSERT INTO repositories (id, name, local_path, last_opened_at)
             VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
             ON CONFLICT(local_path) DO UPDATE SET
                name = excluded.name,
                last_opened_at = CURRENT_TIMESTAMP;",
            params![id, name, local_path],
        )?;
        conn.query_row(
            "SELECT id, name, local_path FROM repositories WHERE local_path = ?1;",
            params![local_path],
            |row| {
                Ok(RepoInfo {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    local_path: row.get(2)?,
                })
            },
        )
    }

    pub fn get_recent_repositories(&self) -> Result<Vec<RepoInfo>, rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
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
        let conn = self.conn();
        let mut stmt = conn.prepare_cached("DELETE FROM repositories WHERE id = ?1;")?;
        stmt.execute(params![id])?;
        Ok(())
    }

    pub fn clear_all_repositories(&self) -> Result<(), rusqlite::Error> {
        let conn = self.conn();
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
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "INSERT INTO git_credentials (id, provider, server_url, account_name, token_ref, token_type, label, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
        )?;
        stmt.execute(params![
            id,
            provider,
            server_url,
            account_name,
            token_ref,
            token_type,
            label
        ])?;
        Ok(())
    }

    pub fn get_all_git_credentials(
        &self,
    ) -> Result<Vec<crate::credentials::GitCredentialMeta>, rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
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
        let mut conn = self.conn();
        let token_ref: Option<String> = match conn.query_row(
            "SELECT token_ref FROM git_credentials WHERE id = ?1;",
            params![id],
            |row| row.get(0),
        ) {
            Ok(token_ref) => Some(token_ref),
            Err(rusqlite::Error::QueryReturnedNoRows) => None,
            Err(error) => return Err(error),
        };

        if let Some(token_ref) = token_ref {
            let tx = conn.transaction()?;
            tx.execute("DELETE FROM git_credentials WHERE id = ?1;", params![id])?;
            tx.commit()?;
            Ok(Some(token_ref))
        } else {
            Ok(None)
        }
    }

    pub fn get_git_credential_token_ref(
        &self,
        id: &str,
    ) -> Result<Option<String>, rusqlite::Error> {
        let conn = self.conn();
        match conn.query_row(
            "SELECT token_ref FROM git_credentials WHERE id = ?1;",
            params![id],
            |row| row.get(0),
        ) {
            Ok(token_ref) => Ok(Some(token_ref)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error),
        }
    }

    // =======================================================================
    // Repo Settings & Labels
    // =======================================================================

    pub fn get_repo_settings(
        &self,
        repo_id: &str,
    ) -> Result<Option<RepoSettingsDb>, rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "SELECT repo_id, default_base_branch, inherit_global_agents, custom_agent_rules
             FROM repo_settings WHERE repo_id = ?1;",
        )?;

        let mut rows = stmt.query(params![repo_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(RepoSettingsDb {
                repo_id: row.get(0)?,
                default_base_branch: row.get(1)?,
                inherit_global_agents: row.get(2)?,
                custom_agent_rules: row.get(3)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn save_repo_settings(&self, s: &RepoSettingsDb) -> Result<(), rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "INSERT INTO repo_settings (repo_id, default_base_branch, inherit_global_agents, custom_agent_rules, updated_at)
             VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
             ON CONFLICT(repo_id) DO UPDATE SET
                default_base_branch = excluded.default_base_branch,
                inherit_global_agents = excluded.inherit_global_agents,
                custom_agent_rules = excluded.custom_agent_rules,
                updated_at = CURRENT_TIMESTAMP;",
        )?;
        stmt.execute(params![
            s.repo_id,
            s.default_base_branch,
            s.inherit_global_agents,
            s.custom_agent_rules
        ])?;
        Ok(())
    }

    pub fn list_repo_labels(&self, repo_id: &str) -> Result<Vec<RepoLabelDb>, rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "SELECT id, repo_id, name, color, description FROM repo_labels WHERE repo_id = ?1 ORDER BY name ASC;",
        )?;

        let rows = stmt.query_map(params![repo_id], |row| {
            Ok(RepoLabelDb {
                id: row.get(0)?,
                repo_id: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3)?,
                description: row.get(4)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn create_repo_label(&self, l: &RepoLabelDb) -> Result<(), rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "INSERT INTO repo_labels (id, repo_id, name, color, description, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
             ON CONFLICT(repo_id, name) DO UPDATE SET
                color = excluded.color,
                description = excluded.description;",
        )?;
        stmt.execute(params![l.id, l.repo_id, l.name, l.color, l.description])?;
        Ok(())
    }

    pub fn update_repo_label(&self, l: &RepoLabelDb) -> Result<(), rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "UPDATE repo_labels SET name = ?1, color = ?2, description = ?3 WHERE id = ?4;",
        )?;
        stmt.execute(params![l.name, l.color, l.description, l.id])?;
        Ok(())
    }

    pub fn delete_repo_label(&self, id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached("DELETE FROM repo_labels WHERE id = ?1;")?;
        stmt.execute(params![id])?;
        Ok(())
    }

    // =======================================================================
    // Virtual MR Sessions
    // =======================================================================

    pub fn list_virtual_mr_sessions(
        &self,
        repo_id: &str,
    ) -> Result<Vec<VirtualMrSessionDb>, rusqlite::Error> {
        let conn = self.conn();

        // 1. Single batch query for all attached label mappings of sessions in this repo (eliminates N+1)
        let mut label_map: HashMap<String, Vec<String>> = HashMap::new();
        {
            let mut label_stmt = conn.prepare_cached(
                "SELECT sl.session_id, sl.label_id
                 FROM virtual_mr_session_labels sl
                 JOIN virtual_mr_sessions s ON sl.session_id = s.id
                 WHERE s.repo_id = ?1;",
            )?;
            let l_rows = label_stmt.query_map(params![repo_id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?;
            for item in l_rows {
                let (sid, lid) = item?;
                label_map.entry(sid).or_default().push(lid);
            }
        }

        // 2. Fetch sessions in a single cached query
        let mut stmt = conn.prepare_cached(
            "SELECT id, repo_id, title, description, base_branch, compare_branch, status,
                    assignee_name, assignee_email, is_pinned, sandbox_adapter_type, sandbox_instance_id,
                    created_at, updated_at
             FROM virtual_mr_sessions WHERE repo_id = ?1 ORDER BY updated_at DESC;",
        )?;

        let session_rows = stmt.query_map(params![repo_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, bool>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, Option<String>>(11)?,
                row.get::<_, String>(12)?,
                row.get::<_, String>(13)?,
            ))
        })?;

        let mut sessions = Vec::new();
        for r in session_rows {
            let (
                id,
                repo_id,
                title,
                desc,
                base,
                comp,
                status,
                aname,
                aemail,
                pinned,
                s_type,
                s_inst,
                cat,
                uat,
            ) = r?;
            let label_ids = label_map.remove(&id).unwrap_or_default();

            sessions.push(VirtualMrSessionDb {
                id,
                repo_id,
                title,
                description: desc,
                base_branch: base,
                compare_branch: comp,
                status,
                assignee_name: aname,
                assignee_email: aemail,
                is_pinned: pinned,
                sandbox_adapter_type: s_type,
                sandbox_instance_id: s_inst,
                created_at: cat,
                updated_at: uat,
                label_ids,
            });
        }

        Ok(sessions)
    }

    pub fn save_virtual_mr_session(&self, s: &VirtualMrSessionDb) -> Result<(), rusqlite::Error> {
        let mut conn = self.conn();
        let tx = conn.transaction()?;

        // Atomic session upsert within transaction
        tx.execute(
            "INSERT INTO virtual_mr_sessions (
                id, repo_id, title, description, base_branch, compare_branch, status,
                assignee_name, assignee_email, is_pinned, sandbox_adapter_type, sandbox_instance_id,
                created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                base_branch = excluded.base_branch,
                compare_branch = excluded.compare_branch,
                status = excluded.status,
                assignee_name = excluded.assignee_name,
                assignee_email = excluded.assignee_email,
                is_pinned = excluded.is_pinned,
                sandbox_adapter_type = excluded.sandbox_adapter_type,
                sandbox_instance_id = excluded.sandbox_instance_id,
                updated_at = CURRENT_TIMESTAMP;",
            params![
                s.id, s.repo_id, s.title, s.description, s.base_branch, s.compare_branch, s.status,
                s.assignee_name, s.assignee_email, s.is_pinned, s.sandbox_adapter_type, s.sandbox_instance_id
            ],
        )?;

        // Update labels atomically
        tx.execute(
            "DELETE FROM virtual_mr_session_labels WHERE session_id = ?1;",
            params![s.id],
        )?;
        for lid in &s.label_ids {
            tx.execute(
                "INSERT OR IGNORE INTO virtual_mr_session_labels (session_id, label_id) VALUES (?1, ?2);",
                params![s.id, lid],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    pub fn delete_virtual_mr_session(&self, session_id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached("DELETE FROM virtual_mr_sessions WHERE id = ?1;")?;
        stmt.execute(params![session_id])?;
        Ok(())
    }

    // =======================================================================
    // Discussions & Comments
    // =======================================================================

    pub fn list_discussions(
        &self,
        session_id: &str,
    ) -> Result<Vec<VirtualMrDiscussionDb>, rusqlite::Error> {
        let conn = self.conn();

        // 1. Single batch query for all comments belonging to discussions in this session (eliminates N+1)
        let mut comments_map: HashMap<String, Vec<VirtualMrCommentDb>> = HashMap::new();
        {
            let mut c_stmt = conn.prepare_cached(
                "SELECT c.id, c.discussion_id, c.author_type, c.author_id, c.author_name, c.author_avatar,
                        c.body, c.review_action, c.created_at, c.updated_at
                 FROM virtual_mr_comments c
                 JOIN virtual_mr_discussions d ON c.discussion_id = d.id
                 WHERE d.session_id = ?1
                 ORDER BY c.created_at ASC;",
            )?;
            let c_rows = c_stmt.query_map(params![session_id], |crow| {
                Ok(VirtualMrCommentDb {
                    id: crow.get(0)?,
                    discussion_id: crow.get(1)?,
                    author_type: crow.get(2)?,
                    author_id: crow.get(3)?,
                    author_name: crow.get(4)?,
                    author_avatar: crow.get(5)?,
                    body: crow.get(6)?,
                    review_action: crow.get(7)?,
                    created_at: crow.get(8)?,
                    updated_at: crow.get(9)?,
                })
            })?;

            for c in c_rows {
                let comment = c?;
                comments_map
                    .entry(comment.discussion_id.clone())
                    .or_default()
                    .push(comment);
            }
        }

        // 2. Fetch discussions in a single cached query
        let mut stmt = conn.prepare_cached(
            "SELECT id, session_id, file_path, diff_side, line_number, commit_id,
                    content_hash, context_before, context_after,
                    is_resolved, resolve_type, resolved_by, resolved_at,
                    verification_status, verified_by_bot, verified_at, created_at
             FROM virtual_mr_discussions WHERE session_id = ?1 ORDER BY created_at ASC;",
        )?;

        let disc_rows = stmt.query_map(params![session_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<i64>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, bool>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, Option<String>>(11)?,
                row.get::<_, Option<String>>(12)?,
                row.get::<_, String>(13)?,
                row.get::<_, Option<String>>(14)?,
                row.get::<_, Option<String>>(15)?,
                row.get::<_, String>(16)?,
            ))
        })?;

        let mut discussions = Vec::new();
        for d in disc_rows {
            let (
                id,
                s_id,
                fpath,
                side,
                lnum,
                cid,
                chash,
                cbefore,
                cafter,
                resolved,
                rtype,
                rby,
                rat,
                vstatus,
                vbot,
                vat,
                cat,
            ) = d?;
            let comments = comments_map.remove(&id).unwrap_or_default();

            discussions.push(VirtualMrDiscussionDb {
                id,
                session_id: s_id,
                file_path: fpath,
                diff_side: side,
                line_number: lnum,
                commit_id: cid,
                content_hash: chash,
                context_before: cbefore,
                context_after: cafter,
                is_resolved: resolved,
                resolve_type: rtype,
                resolved_by: rby,
                resolved_at: rat,
                verification_status: vstatus,
                verified_by_bot: vbot,
                verified_at: vat,
                created_at: cat,
                comments,
            });
        }

        Ok(discussions)
    }

    pub fn get_repo_path_for_session(
        &self,
        session_id: &str,
    ) -> Result<Option<String>, rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "SELECT r.local_path
             FROM virtual_mr_sessions s
             JOIN repositories r ON s.repo_id = r.id
             WHERE s.id = ?1;",
        )?;
        let mut rows = stmt.query(params![session_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn update_discussion_anchors(
        &self,
        discussions: &[VirtualMrDiscussionDb],
    ) -> Result<(), rusqlite::Error> {
        if discussions.is_empty() {
            return Ok(());
        }
        let mut conn = self.conn();
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare_cached(
                "UPDATE virtual_mr_discussions
                 SET line_number = ?1, verification_status = ?2
                 WHERE id = ?3;",
            )?;
            for discussion in discussions {
                stmt.execute(params![
                    discussion.line_number,
                    discussion.verification_status,
                    discussion.id,
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn create_discussion(
        &self,
        d: &VirtualMrDiscussionDb,
        first_comment: &VirtualMrCommentDb,
    ) -> Result<(), rusqlite::Error> {
        let mut conn = self.conn();
        let tx = conn.transaction()?;

        tx.execute(
            "INSERT INTO virtual_mr_discussions (
                id, session_id, file_path, diff_side, line_number, commit_id,
                content_hash, context_before, context_after,
                is_resolved, resolve_type, resolved_by, resolved_at,
                verification_status, verified_by_bot, verified_at, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, CURRENT_TIMESTAMP);",
            params![
                d.id, d.session_id, d.file_path, d.diff_side, d.line_number, d.commit_id,
                d.content_hash, d.context_before, d.context_after,
                d.is_resolved, d.resolve_type, d.resolved_by, d.resolved_at,
                d.verification_status, d.verified_by_bot, d.verified_at
            ],
        )?;

        tx.execute(
            "INSERT INTO virtual_mr_comments (
                id, discussion_id, author_type, author_id, author_name, author_avatar, body, review_action, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
            params![
                first_comment.id, first_comment.discussion_id, first_comment.author_type,
                first_comment.author_id, first_comment.author_name, first_comment.author_avatar,
                first_comment.body, first_comment.review_action
            ],
        )?;

        tx.commit()?;
        Ok(())
    }

    pub fn add_comment(&self, c: &VirtualMrCommentDb) -> Result<(), rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "INSERT INTO virtual_mr_comments (
                id, discussion_id, author_type, author_id, author_name, author_avatar, body, review_action, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
        )?;
        stmt.execute(params![
            c.id,
            c.discussion_id,
            c.author_type,
            c.author_id,
            c.author_name,
            c.author_avatar,
            c.body,
            c.review_action
        ])?;
        Ok(())
    }

    pub fn resolve_discussion(
        &self,
        discussion_id: &str,
        is_resolved: bool,
        resolve_type: &str,
        resolved_by: Option<&str>,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.conn();
        if is_resolved {
            let mut stmt = conn.prepare_cached(
                "UPDATE virtual_mr_discussions SET is_resolved = 1, resolve_type = ?1, resolved_by = ?2, resolved_at = CURRENT_TIMESTAMP WHERE id = ?3;",
            )?;
            stmt.execute(params![resolve_type, resolved_by, discussion_id])?;
        } else {
            let mut stmt = conn.prepare_cached(
                "UPDATE virtual_mr_discussions SET is_resolved = 0, resolved_by = NULL, resolved_at = NULL WHERE id = ?1;",
            )?;
            stmt.execute(params![discussion_id])?;
        }
        Ok(())
    }

    pub fn verify_discussion(
        &self,
        discussion_id: &str,
        verification_status: &str,
        verified_by_bot: &str,
        pass: bool,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.conn();
        if pass {
            let mut stmt = conn.prepare_cached(
                "UPDATE virtual_mr_discussions SET
                    is_resolved = 1,
                    resolve_type = 'ai_verified',
                    resolved_by = ?1,
                    resolved_at = CURRENT_TIMESTAMP,
                    verification_status = ?2,
                    verified_by_bot = ?1,
                    verified_at = CURRENT_TIMESTAMP
                 WHERE id = ?3;",
            )?;
            stmt.execute(params![verified_by_bot, verification_status, discussion_id])?;
        } else {
            let mut stmt = conn.prepare_cached(
                "UPDATE virtual_mr_discussions SET
                    verification_status = ?1,
                    verified_by_bot = ?2,
                    verified_at = CURRENT_TIMESTAMP
                 WHERE id = ?3;",
            )?;
            stmt.execute(params![verification_status, verified_by_bot, discussion_id])?;
        }
        Ok(())
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

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RepoSettingsDb {
    pub repo_id: String,
    pub default_base_branch: String,
    pub inherit_global_agents: bool,
    pub custom_agent_rules: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RepoLabelDb {
    pub id: String,
    pub repo_id: String,
    pub name: String,
    pub color: String,
    pub description: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct VirtualMrSessionDb {
    pub id: String,
    pub repo_id: String,
    pub title: String,
    pub description: Option<String>,
    pub base_branch: String,
    pub compare_branch: String,
    pub status: String,
    pub assignee_name: Option<String>,
    pub assignee_email: Option<String>,
    pub is_pinned: bool,
    pub sandbox_adapter_type: String,
    pub sandbox_instance_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub label_ids: Vec<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct VirtualMrCommentDb {
    pub id: String,
    pub discussion_id: String,
    pub author_type: String,
    pub author_id: String,
    pub author_name: String,
    pub author_avatar: Option<String>,
    pub body: String,
    pub review_action: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct VirtualMrDiscussionDb {
    pub id: String,
    pub session_id: String,
    pub file_path: Option<String>,
    pub diff_side: Option<String>,
    pub line_number: Option<i64>,
    pub commit_id: Option<String>,
    #[serde(default)]
    pub content_hash: Option<String>,
    #[serde(default)]
    pub context_before: Option<String>,
    #[serde(default)]
    pub context_after: Option<String>,
    pub is_resolved: bool,
    pub resolve_type: String,
    pub resolved_by: Option<String>,
    pub resolved_at: Option<String>,
    pub verification_status: String,
    pub verified_by_bot: Option<String>,
    pub verified_at: Option<String>,
    pub created_at: String,
    #[serde(default)]
    pub comments: Vec<VirtualMrCommentDb>,
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
