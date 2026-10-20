use crate::core::db::Database;
use rusqlite::params;

impl Database {
    /// Stores no secret value: only the stable preference secret ID and its OS-keychain reference.
    pub fn get_preference_secret_ref(
        &self,
        id: &str,
    ) -> Result<Option<String>, rusqlite::Error> {
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
            tx.execute("DELETE FROM preference_secret_refs WHERE id = ?1", params![id])?;
            tx.commit()?;
        }
        Ok(reference)
    }

    /// Reads old metadata only during the one-time migration into preferences.json.
    pub fn get_legacy_git_credentials(
        &self,
    ) -> Result<Vec<crate::features::credentials::GitCredentialMeta>, rusqlite::Error> {
        let conn = self.conn();
        let mut columns = conn.prepare("PRAGMA table_info(git_credentials);")?;
        let names: Vec<String> = columns
            .query_map([], |row| row.get(1))?
            .collect::<Result<_, _>>()?;
        drop(columns);
        if !names.iter().any(|column| column == "provider") {
            return Ok(Vec::new());
        }

        let mut stmt = conn.prepare_cached(
            "SELECT id, provider, server_url, account_name, token_ref, token_type, label, source, helper_name, created_at, updated_at
             FROM git_credentials ORDER BY created_at DESC;",
        )?;
        let rows = stmt.query_map([], |row| {
            let token_ref: String = row.get(4)?;
            let source: String = row.get(7)?;
            Ok(crate::features::credentials::GitCredentialMeta {
                id: row.get(0)?,
                provider: row.get(1)?,
                server_url: row.get(2)?,
                account_name: row.get(3)?,
                // Migration only needs public metadata and must not trigger one keychain prompt per record.
                token_ref,
                token_type: row.get(5)?,
                label: row.get(6)?,
                source: source.clone(),
                helper_name: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
                is_in_keyring: source == "system_global",
            })
        })?;
        rows.collect()
    }

    /// SQLite stores only this non-secret ID-to-keychain-reference mapping.
    pub fn insert_git_credential_ref(
        &self,
        id: &str,
        token_ref: &str,
    ) -> Result<(), rusqlite::Error> {
        self.conn().execute(
            "INSERT INTO git_credentials (id, token_ref) VALUES (?1, ?2);",
            params![id, token_ref],
        )?;
        Ok(())
    }

    pub fn upsert_git_credential_ref(
        &self,
        id: &str,
        token_ref: &str,
    ) -> Result<(), rusqlite::Error> {
        self.conn().execute(
            "INSERT INTO git_credentials (id, token_ref) VALUES (?1, ?2)
             ON CONFLICT(id) DO UPDATE SET token_ref = excluded.token_ref;",
            params![id, token_ref],
        )?;
        Ok(())
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
        if token_ref.is_some() {
            let tx = conn.transaction()?;
            tx.execute("DELETE FROM git_credentials WHERE id = ?1", params![id])?;
            tx.commit()?;
        }
        Ok(token_ref)
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
