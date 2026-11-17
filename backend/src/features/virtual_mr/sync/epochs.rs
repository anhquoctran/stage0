use super::tracked_mr::TrackedMr;
use rusqlite::Connection;
use std::collections::{HashMap, HashSet};

pub(super) fn read(
    conn: &Connection,
    sessions: &[TrackedMr],
) -> Result<HashMap<String, i64>, String> {
    let repos = sessions
        .iter()
        .map(|s| s.repo_id.as_str())
        .collect::<HashSet<_>>();
    let mut q = conn
        .prepare_cached(
            "SELECT COALESCE((SELECT revision FROM virtual_mr_sync_epochs WHERE repo_id=?1),0)",
        )
        .map_err(|e| e.to_string())?;
    repos
        .into_iter()
        .map(|id| {
            q.query_row([id], |r| r.get(0))
                .map(|revision| (id.to_owned(), revision))
                .map_err(|e| e.to_string())
        })
        .collect()
}
