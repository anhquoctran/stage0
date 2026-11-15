use super::state::MrSyncState;
use rusqlite::Connection;
use std::collections::{BTreeMap, HashMap};

fn read(
    conn: &Connection,
    field: &str,
    value: &str,
) -> Result<HashMap<String, MrSyncState>, String> {
    // field is one of two internal SQL identifiers, never an IPC argument.
    let sql=format!("SELECT s.id,s.repo_id,f.base_branch,f.compare_branch,f.base_sha,f.head_sha,f.revision,f.needs_review,f.ref_status,s.status,r.agent_id,r.review_status FROM virtual_mr_ref_state f JOIN virtual_mr_sessions s ON s.id=f.session_id LEFT JOIN virtual_mr_session_reviewers r ON r.session_id=s.id WHERE {field}=?1");
    let mut q = conn.prepare_cached(&sql).map_err(|e| e.to_string())?;
    let rows = q
        .query_map([value], |r| {
            Ok((
                MrSyncState {
                    session_id: r.get(0)?,
                    repo_id: r.get(1)?,
                    base_branch: r.get(2)?,
                    compare_branch: r.get(3)?,
                    base_sha: r.get(4)?,
                    head_sha: r.get(5)?,
                    revision: r.get(6)?,
                    needs_review: r.get(7)?,
                    ref_status: r.get(8)?,
                    session_status: r.get(9)?,
                    reviewers: BTreeMap::new(),
                },
                r.get::<_, Option<String>>(10)?,
                r.get::<_, Option<String>>(11)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut states = HashMap::new();
    for row in rows {
        let (state, id, status) = row.map_err(|e| e.to_string())?;
        let state = states.entry(state.session_id.clone()).or_insert(state);
        if let (Some(id), Some(status)) = (id, status) {
            state.reviewers.insert(id, status);
        }
    }
    Ok(states)
}
pub(super) fn one(conn: &Connection, id: &str) -> Result<Option<MrSyncState>, String> {
    Ok(read(conn, "s.id", id)?.remove(id))
}
pub(super) fn repo(conn: &Connection, id: &str) -> Result<HashMap<String, MrSyncState>, String> {
    read(conn, "s.repo_id", id)
}
