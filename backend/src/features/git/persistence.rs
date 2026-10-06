use crate::core::db::Database;
use crate::features::git::RepoInfo;
use rusqlite::params;

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

impl Database {
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

    pub fn get_all_repository_paths(&self) -> Result<Vec<String>, rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn
            .prepare_cached("SELECT local_path FROM repositories ORDER BY last_opened_at DESC;")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        rows.collect()
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
}
