use super::Database;
use rusqlite::params;

impl Database {
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

    pub fn delete_settings(&self, keys: &[&str]) -> Result<(), rusqlite::Error> {
        let mut conn = self.conn();
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare_cached("DELETE FROM app_settings WHERE key = ?1;")?;
            for key in keys {
                stmt.execute(params![key])?;
            }
        }
        tx.commit()
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
