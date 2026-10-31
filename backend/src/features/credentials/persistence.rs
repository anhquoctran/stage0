use crate::core::db::Database;
use crate::features::credentials::GitCredentialPreferenceRecord;
use rusqlite::params;

impl Database {
    /// Prepared references must reach durable SQLite storage before JSON can select them.
    pub(crate) fn stage_preference_secret_ref(
        &self,
        id: &str,
        reference: &str,
    ) -> Result<(), String> {
        let conn = self.conn();
        let previous: i64 = conn
            .query_row("PRAGMA synchronous", [], |row| row.get(0))
            .map_err(|_| {
                crate::common::messages::failure(
                    "backend.credentials.readDurabilityFailed",
                    serde_json::json!({}),
                    "Could not read credential durability mode".into(),
                )
            })?;
        conn.pragma_update(None, "synchronous", "FULL")
            .map_err(|_| {
                crate::common::messages::failure(
                    "backend.credentials.enableStagingFailed",
                    serde_json::json!({}),
                    "Could not enable durable credential staging".into(),
                )
            })?;
        let result = conn.execute(
            "INSERT INTO preference_secret_refs(id,keychain_ref) VALUES (?1,?2)",
            params![id, reference],
        );
        let _ = conn.pragma_update(None, "synchronous", previous);
        result.map(|_| ()).map_err(|_| {
            crate::common::messages::failure(
                "backend.credentials.stageMappingFailed",
                serde_json::json!({}),
                "Could not stage credential mapping".into(),
            )
        })
    }

    pub(crate) fn staged_preference_secret_refs(&self) -> Result<Vec<(String, String)>, String> {
        let conn = self.conn();
        let mut statement = conn
            .prepare("SELECT id,keychain_ref FROM preference_secret_refs WHERE id LIKE 'txn/%'")
            .map_err(|_| {
                crate::common::messages::failure(
                    "backend.credentials.inspectMappingsFailed",
                    serde_json::json!({}),
                    "Could not inspect prepared credential mappings".into(),
                )
            })?;
        let rows = statement
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|_| {
                crate::common::messages::failure(
                    "backend.credentials.inspectMappingsFailed",
                    serde_json::json!({}),
                    "Could not inspect prepared credential mappings".into(),
                )
            })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|_| {
            crate::common::messages::failure(
                "backend.credentials.inspectMappingsFailed",
                serde_json::json!({}),
                "Could not inspect prepared credential mappings".into(),
            )
        })
    }
    /// Stores no secret value: only the stable preference secret ID and its OS-keychain reference.
    pub fn get_preference_secret_ref(&self, id: &str) -> Result<Option<String>, rusqlite::Error> {
        match self.conn().query_row(
            "SELECT keychain_ref FROM preference_secret_refs WHERE id = ?1",
            params![id],
            |row| row.get(0),
        ) {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error),
        }
    }

    pub fn upsert_preference_secret_ref(
        &self,
        id: &str,
        keychain_ref: &str,
    ) -> Result<(), rusqlite::Error> {
        self.conn().execute(
            "INSERT INTO preference_secret_refs (id, keychain_ref) VALUES (?1, ?2)
             ON CONFLICT(id) DO UPDATE SET keychain_ref = excluded.keychain_ref;",
            params![id, keychain_ref],
        )?;
        Ok(())
    }

    pub fn delete_preference_secret_ref(
        &self,
        id: &str,
    ) -> Result<Option<String>, rusqlite::Error> {
        let mut conn = self.conn();
        let reference = match conn.query_row(
            "SELECT keychain_ref FROM preference_secret_refs WHERE id = ?1",
            params![id],
            |row| row.get(0),
        ) {
            Ok(value) => Some(value),
            Err(rusqlite::Error::QueryReturnedNoRows) => None,
            Err(error) => return Err(error),
        };
        if reference.is_some() {
            let tx = conn.transaction()?;
            tx.execute(
                "DELETE FROM preference_secret_refs WHERE id = ?1",
                params![id],
            )?;
            tx.commit()?;
        }
        Ok(reference)
    }

    pub fn list_git_credential_metadata(
        &self,
    ) -> Result<Vec<GitCredentialPreferenceRecord>, rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "SELECT id, provider, server_url, account_name, token_type, label, source, helper_name, created_at, updated_at
             FROM git_credential_metadata ORDER BY created_at DESC, id;",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(GitCredentialPreferenceRecord {
                id: row.get(0)?,
                provider: row.get(1)?,
                server_url: row.get(2)?,
                account_name: row.get(3)?,
                token_type: row.get(4)?,
                label: row.get(5)?,
                source: row.get(6)?,
                helper_name: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;
        rows.collect()
    }

    pub fn get_git_credential_metadata(
        &self,
        id: &str,
    ) -> Result<Option<GitCredentialPreferenceRecord>, rusqlite::Error> {
        let conn = self.conn();
        match conn.query_row(
            "SELECT id, provider, server_url, account_name, token_type, label, source, helper_name, created_at, updated_at
             FROM git_credential_metadata WHERE id = ?1",
            params![id],
            |row| {
                Ok(GitCredentialPreferenceRecord {
                    id: row.get(0)?,
                    provider: row.get(1)?,
                    server_url: row.get(2)?,
                    account_name: row.get(3)?,
                    token_type: row.get(4)?,
                    label: row.get(5)?,
                    source: row.get(6)?,
                    helper_name: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            },
        ) {
            Ok(record) => Ok(Some(record)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error),
        }
    }

    pub fn upsert_git_credential_metadata(
        &self,
        record: &GitCredentialPreferenceRecord,
    ) -> Result<(), rusqlite::Error> {
        self.conn().execute(
            "INSERT INTO git_credential_metadata
                (id, provider, server_url, account_name, token_type, label, source, helper_name, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
                provider = excluded.provider, server_url = excluded.server_url,
                account_name = excluded.account_name, token_type = excluded.token_type,
                label = excluded.label, source = excluded.source, helper_name = excluded.helper_name,
                created_at = excluded.created_at, updated_at = excluded.updated_at;",
            params![
                record.id,
                record.provider,
                record.server_url,
                record.account_name,
                record.token_type,
                record.label,
                record.source,
                record.helper_name,
                record.created_at,
                record.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn upsert_git_credential(
        &self,
        record: &GitCredentialPreferenceRecord,
        token_ref: &str,
    ) -> Result<(), rusqlite::Error> {
        let mut conn = self.conn();
        let tx = conn.transaction()?;
        tx.execute(
            "INSERT INTO git_credentials (id, token_ref) VALUES (?1, ?2)
             ON CONFLICT(id) DO UPDATE SET token_ref = excluded.token_ref;",
            params![record.id, token_ref],
        )?;
        tx.execute(
            "INSERT INTO git_credential_metadata
                (id, provider, server_url, account_name, token_type, label, source, helper_name, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
                provider = excluded.provider, server_url = excluded.server_url,
                account_name = excluded.account_name, token_type = excluded.token_type,
                label = excluded.label, source = excluded.source, helper_name = excluded.helper_name,
                created_at = excluded.created_at, updated_at = excluded.updated_at;",
            params![
                record.id,
                record.provider,
                record.server_url,
                record.account_name,
                record.token_type,
                record.label,
                record.source,
                record.helper_name,
                record.created_at,
                record.updated_at,
            ],
        )?;
        tx.commit()
    }

    pub fn delete_git_credential(&self, id: &str) -> Result<Option<String>, rusqlite::Error> {
        let mut conn = self.conn();
        let token_ref = match conn.query_row(
            "SELECT token_ref FROM git_credentials WHERE id = ?1",
            params![id],
            |row| row.get(0),
        ) {
            Ok(value) => Some(value),
            Err(rusqlite::Error::QueryReturnedNoRows) => None,
            Err(error) => return Err(error),
        };
        let tx = conn.transaction()?;
        tx.execute(
            "DELETE FROM git_credential_metadata WHERE id = ?1",
            params![id],
        )?;
        tx.execute("DELETE FROM git_credentials WHERE id = ?1", params![id])?;
        tx.commit()?;
        Ok(token_ref)
    }

    pub fn delete_git_credentials_by_source(&self, source: &str) -> Result<(), rusqlite::Error> {
        let mut conn = self.conn();
        let tx = conn.transaction()?;
        let ids = {
            let mut stmt =
                tx.prepare_cached("SELECT id FROM git_credential_metadata WHERE source = ?1")?;
            let rows = stmt.query_map(params![source], |row| row.get::<_, String>(0))?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        for id in ids {
            tx.execute("DELETE FROM git_credentials WHERE id = ?1", params![id])?;
        }
        tx.execute(
            "DELETE FROM git_credential_metadata WHERE source = ?1",
            params![source],
        )?;
        tx.commit()
    }

    pub fn get_git_credential_token_ref(
        &self,
        id: &str,
    ) -> Result<Option<String>, rusqlite::Error> {
        match self.conn().query_row(
            "SELECT token_ref FROM git_credentials WHERE id = ?1",
            params![id],
            |row| row.get(0),
        ) {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error),
        }
    }
}
