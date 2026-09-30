use std::collections::HashMap;
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

        // High Performance SQLite Pragmas
        conn.execute_batch("
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;
            PRAGMA busy_timeout = 5000;
            PRAGMA cache_size = -64000;
            PRAGMA temp_store = MEMORY;
            PRAGMA mmap_size = 268435456;
        ")?;

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
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare_cached("DELETE FROM repositories WHERE id = ?1;")?;
        stmt.execute(params![id])?;
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
        let mut stmt = conn.prepare_cached(
            "INSERT INTO git_credentials (id, provider, server_url, account_name, token_ref, token_type, label, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
        )?;
        stmt.execute(params![id, provider, server_url, account_name, token_ref, token_type, label])?;
        Ok(())
    }

    pub fn get_all_git_credentials(&self) -> Result<Vec<crate::credentials::GitCredentialMeta>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
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
        let conn = self.0.lock().unwrap();
        let token_ref: Option<String> = conn
            .query_row(
                "SELECT token_ref FROM git_credentials WHERE id = ?1;",
                params![id],
                |row| row.get(0),
            )
            .ok();

        if token_ref.is_some() {
            let mut stmt = conn.prepare_cached("DELETE FROM git_credentials WHERE id = ?1;")?;
            stmt.execute(params![id])?;
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

    // =======================================================================
    // Repo Settings & Labels
    // =======================================================================

    pub fn get_repo_settings(&self, repo_id: &str) -> Result<Option<RepoSettingsDb>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
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
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare_cached(
            "INSERT INTO repo_settings (repo_id, default_base_branch, inherit_global_agents, custom_agent_rules, updated_at)
             VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
             ON CONFLICT(repo_id) DO UPDATE SET
                default_base_branch = excluded.default_base_branch,
                inherit_global_agents = excluded.inherit_global_agents,
                custom_agent_rules = excluded.custom_agent_rules,
                updated_at = CURRENT_TIMESTAMP;",
        )?;
        stmt.execute(params![s.repo_id, s.default_base_branch, s.inherit_global_agents, s.custom_agent_rules])?;
        Ok(())
    }

    pub fn list_repo_labels(&self, repo_id: &str) -> Result<Vec<RepoLabelDb>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();
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
        let conn = self.0.lock().unwrap();
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
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare_cached(
            "UPDATE repo_labels SET name = ?1, color = ?2, description = ?3 WHERE id = ?4;",
        )?;
        stmt.execute(params![l.name, l.color, l.description, l.id])?;
        Ok(())
    }

    pub fn delete_repo_label(&self, id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare_cached("DELETE FROM repo_labels WHERE id = ?1;")?;
        stmt.execute(params![id])?;
        Ok(())
    }

    // =======================================================================
    // Virtual MR Sessions
    // =======================================================================

    pub fn list_virtual_mr_sessions(&self, repo_id: &str) -> Result<Vec<VirtualMrSessionDb>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();

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
            let (id, repo_id, title, desc, base, comp, status, aname, aemail, pinned, s_type, s_inst, cat, uat) = r?;
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
        let mut conn = self.0.lock().unwrap();
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
        tx.execute("DELETE FROM virtual_mr_session_labels WHERE session_id = ?1;", params![s.id])?;
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
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare_cached("DELETE FROM virtual_mr_sessions WHERE id = ?1;")?;
        stmt.execute(params![session_id])?;
        Ok(())
    }

    // =======================================================================
    // Discussions & Comments
    // =======================================================================

    pub fn list_discussions(&self, session_id: &str) -> Result<Vec<VirtualMrDiscussionDb>, rusqlite::Error> {
        let conn = self.0.lock().unwrap();

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
                comments_map.entry(comment.discussion_id.clone()).or_default().push(comment);
            }
        }

        // 2. Fetch discussions in a single cached query
        let mut stmt = conn.prepare_cached(
            "SELECT id, session_id, file_path, diff_side, line_number, commit_id, is_resolved,
                    resolve_type, resolved_by, resolved_at, verification_status, verified_by_bot, verified_at, created_at
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
                row.get::<_, bool>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, Option<String>>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, Option<String>>(11)?,
                row.get::<_, Option<String>>(12)?,
                row.get::<_, String>(13)?,
            ))
        })?;

        let mut discussions = Vec::new();
        for d in disc_rows {
            let (id, s_id, fpath, side, lnum, cid, resolved, rtype, rby, rat, vstatus, vbot, vat, cat) = d?;
            let comments = comments_map.remove(&id).unwrap_or_default();

            discussions.push(VirtualMrDiscussionDb {
                id,
                session_id: s_id,
                file_path: fpath,
                diff_side: side,
                line_number: lnum,
                commit_id: cid,
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

    pub fn create_discussion(
        &self,
        d: &VirtualMrDiscussionDb,
        first_comment: &VirtualMrCommentDb,
    ) -> Result<(), rusqlite::Error> {
        let mut conn = self.0.lock().unwrap();
        let tx = conn.transaction()?;

        tx.execute(
            "INSERT INTO virtual_mr_discussions (
                id, session_id, file_path, diff_side, line_number, commit_id, is_resolved,
                resolve_type, resolved_by, resolved_at, verification_status, verified_by_bot, verified_at, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, CURRENT_TIMESTAMP);",
            params![
                d.id, d.session_id, d.file_path, d.diff_side, d.line_number, d.commit_id, d.is_resolved,
                d.resolve_type, d.resolved_by, d.resolved_at, d.verification_status, d.verified_by_bot, d.verified_at
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
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare_cached(
            "INSERT INTO virtual_mr_comments (
                id, discussion_id, author_type, author_id, author_name, author_avatar, body, review_action, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
        )?;
        stmt.execute(params![
            c.id, c.discussion_id, c.author_type, c.author_id, c.author_name, c.author_avatar,
            c.body, c.review_action
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
        let conn = self.0.lock().unwrap();
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
        let conn = self.0.lock().unwrap();
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
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare_cached("SELECT value FROM app_settings WHERE key = ?1;")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), rusqlite::Error> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;",
            params![key, value],
        )?;
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
    pub is_resolved: bool,
    pub resolve_type: String,
    pub resolved_by: Option<String>,
    pub resolved_at: Option<String>,
    pub verification_status: String,
    pub verified_by_bot: Option<String>,
    pub verified_at: Option<String>,
    pub created_at: String,
    pub comments: Vec<VirtualMrCommentDb>,
}

