use crate::core::db::Database;
use rusqlite::params;

impl Database {
    pub fn update_review_generated_description(
        &self,
        session_id: &str,
        description: &str,
        only_if_empty: bool,
    ) -> Result<(), String> {
        let changed = self.conn().execute(
            "UPDATE virtual_mr_sessions SET description=?2, updated_at=CURRENT_TIMESTAMP
             WHERE id=?1 AND (?3=0 OR description IS NULL OR trim(description, char(9)||char(10)||char(13)||' ')='')",
            params![session_id, description, only_if_empty],
        ).map_err(|error| {
            crate::common::messages::failure(
                "backend.review.updateDescriptionFailed",
                serde_json::json!({ "error": error.to_string() }),
                format!("Could not update the Virtual MR description: {error}"),
            )
        })?;
        if changed != 1 {
            return Err(crate::common::messages::code(if only_if_empty {
                "backend.review.descriptionChanged"
            } else {
                "backend.review.mrNoLongerExists"
            }));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn empty_description_retries_never_overwrite_a_concurrent_edit() {
        let repo = crate::features::review::test_repo::TestRepo::new();
        let (run, _) = repo.review();
        let db = crate::features::review::persistence::test_database(&run);
        db.update_review_generated_description(&run.session_id, "AI description", true)
            .unwrap();
        db.conn()
            .execute(
                "UPDATE virtual_mr_sessions SET description='User edit' WHERE id=?1",
                [&run.session_id],
            )
            .unwrap();
        assert!(db
            .update_review_generated_description(&run.session_id, "Replacement", true)
            .unwrap_err()
            .contains("descriptionChanged"));
        let saved: String = db
            .conn()
            .query_row(
                "SELECT description FROM virtual_mr_sessions WHERE id=?1",
                [&run.session_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(saved, "User edit");
        db.conn()
            .execute(
                "UPDATE virtual_mr_sessions SET description=?2 WHERE id=?1",
                rusqlite::params![run.session_id, " \t\n\r "],
            )
            .unwrap();
        assert!(db
            .update_review_generated_description(&run.session_id, "Retry", true)
            .is_ok());
    }
}
