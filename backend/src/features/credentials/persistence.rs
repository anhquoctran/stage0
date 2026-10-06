use crate::core::db::Database;
use rusqlite::params;

pub struct GitCredentialRecord {
    pub server_url: String,
    pub account_name: String,
    pub token_ref: String,
    pub token_type: String,
    pub source: String,
}

impl Database {
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
    ) -> Result<Vec<crate::features::credentials::GitCredentialMeta>, rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "SELECT id, provider, server_url, account_name, token_ref, token_type, label, source, helper_name, created_at, updated_at
             FROM git_credentials
             ORDER BY created_at DESC;",
        )?;

        let rows = stmt.query_map([], |row| {
            let token_ref: String = row.get(4)?;
            let source: String = row.get(7)?;
            let is_in_keyring = source == "system_global"
                || crate::features::credentials::exists_in_keyring(&token_ref);
            Ok(crate::features::credentials::GitCredentialMeta {
                id: row.get(0)?,
                provider: row.get(1)?,
                server_url: row.get(2)?,
                account_name: row.get(3)?,
                token_ref,
                token_type: row.get(5)?,
                label: row.get(6)?,
                source,
                helper_name: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
                is_in_keyring,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn get_git_credential_for_clone(
        &self,
        id: &str,
    ) -> Result<Option<GitCredentialRecord>, rusqlite::Error> {
        let conn = self.conn();
        match conn.query_row(
            "SELECT server_url, account_name, token_ref, token_type, source
             FROM git_credentials WHERE id = ?1;",
            params![id],
            |row| {
                Ok(GitCredentialRecord {
                    server_url: row.get(0)?,
                    account_name: row.get(1)?,
                    token_ref: row.get(2)?,
                    token_type: row.get(3)?,
                    source: row.get(4)?,
                })
            },
        ) {
            Ok(credential) => Ok(Some(credential)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error),
        }
    }

    pub fn sync_system_git_credentials(
        &self,
        credentials: &[crate::features::credentials::GitCredentialMeta],
        scan_complete: bool,
    ) -> Result<(), rusqlite::Error> {
        let mut conn = self.conn();
        let tx = conn.transaction()?;
        if scan_complete {
            tx.execute(
                "DELETE FROM git_credentials WHERE source = 'system_global';",
                [],
            )?;
        }
        for credential in credentials {
            tx.execute(
                "INSERT INTO git_credentials (id, provider, server_url, account_name, token_ref, token_type, label, source, helper_name, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'system_global', ?8, ?9, ?10)
                 ON CONFLICT(id) DO UPDATE SET
                    provider = excluded.provider,
                    server_url = excluded.server_url,
                    account_name = excluded.account_name,
                    token_ref = excluded.token_ref,
                    token_type = excluded.token_type,
                    label = excluded.label,
                    source = excluded.source,
                    helper_name = excluded.helper_name,
                    updated_at = excluded.updated_at;",
                params![
                    credential.id,
                    credential.provider,
                    credential.server_url,
                    credential.account_name,
                    credential.token_ref,
                    credential.token_type,
                    credential.label,
                    credential.helper_name,
                    credential.created_at,
                    credential.updated_at,
                ],
            )?;
        }
        tx.commit()
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

    pub fn get_git_credential_source(&self, id: &str) -> Result<Option<String>, rusqlite::Error> {
        let conn = self.conn();
        match conn.query_row(
            "SELECT source FROM git_credentials WHERE id = ?1;",
            params![id],
            |row| row.get(0),
        ) {
            Ok(source) => Ok(Some(source)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error),
        }
    }
}
