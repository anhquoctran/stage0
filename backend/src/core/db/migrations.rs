use super::Database;
use rusqlite::Connection;

impl Database {
    pub(super) fn migrate_unique_open_virtual_mr_pairs(
        conn: &Connection,
    ) -> Result<usize, rusqlite::Error> {
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

    pub(super) fn migrate_discussions_fingerprint(
        conn: &Connection,
    ) -> Result<(), rusqlite::Error> {
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
        if !columns.iter().any(|c| c == "code_snippet") {
            conn.execute(
                "ALTER TABLE virtual_mr_discussions ADD COLUMN code_snippet TEXT;",
                [],
            )?;
        }
        Ok(())
    }

    pub(super) fn migrate_git_credentials(conn: &Connection) -> Result<(), rusqlite::Error> {
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
}
