//! SQLite label rows are a rebuildable projection; MR relations retain local IDs.
use crate::core::db::Database;
use crate::features::git::persistence::RepoLabelDb;
use rusqlite::{params, OptionalExtension};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashSet;

impl Database {
    pub(crate) fn repository_settings_path(&self, repo_id: &str) -> Result<String, String> {
        self.conn()
            .query_row(
                "SELECT local_path FROM repositories WHERE id=?1",
                [repo_id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())
    }

    pub(crate) fn project_repository_labels(
        &self,
        repo_id: &str,
        labels: &[Value],
    ) -> Result<Vec<RepoLabelDb>, String> {
        let mut conn = self.conn();
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        let mut projected = Vec::new();
        for label in labels {
            let file_id = label["id"].as_str().ok_or("Invalid label ID")?;
            let owner: Option<String> = tx
                .query_row(
                    "SELECT repo_id FROM repo_labels WHERE id=?1",
                    [file_id],
                    |r| r.get(0),
                )
                .optional()
                .map_err(|e| e.to_string())?;
            // Preserve old MR label references on the original installation.
            // Other clones get repo-scoped IDs instead of colliding globally.
            let id = if owner.as_deref() == Some(repo_id) {
                file_id.into()
            } else {
                format!(
                    "repo-label-{:x}",
                    Sha256::digest(format!("{repo_id}\0{file_id}").as_bytes())
                )
            };
            projected.push(RepoLabelDb {
                id,
                repo_id: repo_id.into(),
                name: label["name"].as_str().unwrap().into(),
                color: label["color"].as_str().unwrap().into(),
                description: label["description"].as_str().map(str::to_string),
            });
        }
        let keep: HashSet<_> = projected.iter().map(|l| l.id.as_str()).collect();
        let previous = {
            let mut stmt = tx
                .prepare("SELECT id FROM repo_labels WHERE repo_id=?1")
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([repo_id], |r| r.get::<_, String>(0))
                .map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?
        };
        for id in previous {
            if !keep.contains(id.as_str()) {
                // A checkout can temporarily omit labels. Never cascade-delete
                // historical MR relations merely because a config hides one.
                tx.execute(
                    "DELETE FROM repo_labels WHERE id=?1 AND repo_id=?2 AND NOT EXISTS
                     (SELECT 1 FROM virtual_mr_session_labels WHERE label_id=?1)",
                    params![id, repo_id],
                )
                .map_err(|e| e.to_string())?;
            }
            // Retire hidden names, and allow rename swaps without losing links.
            tx.execute(
                "UPDATE repo_labels SET name=?1 WHERE id=?2 AND repo_id=?3",
                params![
                    format!("__stage0_projection_{}", uuid::Uuid::new_v4()),
                    id,
                    repo_id
                ],
            )
            .map_err(|e| e.to_string())?;
        }
        for label in &projected {
            tx.execute("INSERT INTO repo_labels(id,repo_id,name,color,description) VALUES(?1,?2,?3,?4,?5)
                ON CONFLICT(id) DO UPDATE SET name=excluded.name,color=excluded.color,description=excluded.description WHERE repo_labels.repo_id=excluded.repo_id",
                params![label.id, repo_id, label.name, label.color, label.description]).map_err(|e| e.to_string())?;
        }
        tx.commit().map_err(|e| e.to_string())?;
        Ok(projected)
    }
}
