use super::{epochs, state::MrSyncState, state_reads, tracked_mr::TrackedMr};
use crate::{core::db::Database, features::review::ReviewRun};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use std::collections::{HashMap, HashSet};

pub(super) fn tracked(db: &Database) -> Result<Vec<TrackedMr>, String> {
    let conn = db.conn();
    let mut stmt=conn.prepare("SELECT s.id,s.repo_id,r.local_path,s.base_branch,s.compare_branch,s.title,s.status FROM virtual_mr_sessions s JOIN repositories r ON r.id=s.repo_id WHERE s.status='open' OR (s.status='resolved' AND NOT EXISTS(SELECT 1 FROM virtual_mr_sessions n WHERE n.repo_id=s.repo_id AND n.base_branch=s.base_branch AND n.compare_branch=s.compare_branch AND (n.status='open' OR (n.status='resolved' AND n.rowid>s.rowid)))) ORDER BY r.local_path,s.rowid").map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(TrackedMr {
                id: r.get(0)?,
                repo_id: r.get(1)?,
                repo_path: r.get(2)?,
                base: r.get(3)?,
                head: r.get(4)?,
                title: r.get(5)?,
                status: r.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub(super) fn list(db: &Database, repo: &str) -> Result<Vec<MrSyncState>, String> {
    Ok(state_reads::repo(&db.conn(), repo)?
        .into_values()
        .filter(|s| s.session_status != "closed")
        .collect())
}

fn already_reviewed(
    conn: &Connection,
    id: &str,
    base: &Option<String>,
    head: &Option<String>,
) -> Result<bool, String> {
    let payload:Option<String>=conn.prepare_cached("SELECT payload FROM ai_review_runs WHERE session_id=?1 AND status='completed' AND json_extract(payload,'$.published')=1 AND json_extract(payload,'$.replyDiscussionId') IS NULL ORDER BY started_at DESC,rowid DESC LIMIT 1").map_err(|e|e.to_string())?.query_row([id],|r|r.get(0)).optional().map_err(|e|e.to_string())?;
    let run = payload.and_then(|p| serde_json::from_str::<ReviewRun>(&p).ok());
    Ok(run.is_some_and(|r| {
        r.published
            && r.status == "completed"
            && base.as_deref() == Some(&r.snapshot.base_sha)
            && head.as_deref() == Some(&r.snapshot.head_sha)
    }))
}

pub(super) fn apply(
    db: &Database,
    sessions: &[TrackedMr],
    refs: &HashMap<String, Option<String>>,
) -> Result<(Vec<MrSyncState>, HashMap<String, i64>), String> {
    let mut conn = db.conn();
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| e.to_string())?;
    let mut changed = Vec::new();
    let repos = sessions
        .iter()
        .map(|s| s.repo_id.clone())
        .collect::<HashSet<_>>();
    let mut before = HashMap::new();
    if sessions.len() == 1 {
        if let Some(state) = state_reads::one(&tx, &sessions[0].id)? {
            before.insert(state.session_id.clone(), state);
        }
    } else {
        for repo in &repos {
            before.extend(state_reads::repo(&tx, repo)?);
        }
    }

    for s in sessions {
        let valid:bool=tx.prepare_cached("SELECT EXISTS(SELECT 1 FROM virtual_mr_sessions s WHERE id=?1 AND repo_id=?2 AND base_branch=?3 AND compare_branch=?4 AND status!='closed' AND EXISTS(SELECT 1 FROM repositories r WHERE r.id=s.repo_id AND r.local_path=?5) AND NOT EXISTS(SELECT 1 FROM virtual_mr_sessions n WHERE n.repo_id=s.repo_id AND n.base_branch=s.base_branch AND n.compare_branch=s.compare_branch AND n.status='open' AND n.id!=s.id))").map_err(|e|e.to_string())?.query_row(params![s.id,s.repo_id,s.base,s.head,s.repo_path],|r|r.get(0)).map_err(|e|e.to_string())?;
        if !valid {
            continue;
        }
        let base = refs.get(&s.base).cloned().flatten();
        let head = refs.get(&s.head).cloned().flatten();
        let old = before.get(&s.id).cloned();
        let same = old.as_ref().is_some_and(|o| {
            o.base_branch == s.base
                && o.compare_branch == s.head
                && o.base_sha == base
                && o.head_sha == head
        });
        if !same {
            let needs = old.is_some()
                || base.is_none()
                || head.is_none()
                || !already_reviewed(&tx, &s.id, &base, &head)?;
            tx.prepare_cached("INSERT INTO virtual_mr_ref_state(session_id,base_branch,compare_branch,base_sha,head_sha,needs_review,ref_status) VALUES(?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(session_id) DO UPDATE SET base_branch=excluded.base_branch,compare_branch=excluded.compare_branch,base_sha=excluded.base_sha,head_sha=excluded.head_sha,needs_review=excluded.needs_review,ref_status=excluded.ref_status,revision=virtual_mr_ref_state.revision+1").map_err(|e|e.to_string())?.execute(params![s.id,s.base,s.head,base,head,needs,if base.is_some()&&head.is_some(){"ready"}else{"unavailable"}]).map_err(|e|e.to_string())?;
            if needs {
                tx.prepare_cached("UPDATE virtual_mr_session_reviewers SET review_status='pending' WHERE session_id=?1 AND NOT(review_status='reviewing' AND EXISTS(SELECT 1 FROM ai_review_runs a WHERE a.session_id=?1 AND a.status='running' AND json_extract(a.payload,'$.reviewerId')=virtual_mr_session_reviewers.agent_id AND json_extract(a.payload,'$.snapshot.baseSha')=?2 AND json_extract(a.payload,'$.snapshot.headSha')=?3))").map_err(|e|e.to_string())?.execute(params![s.id,base,head]).map_err(|e|e.to_string())?;
                tx.prepare_cached("UPDATE virtual_mr_sessions SET status='open',updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND status='resolved'").map_err(|e|e.to_string())?.execute([&s.id]).map_err(|e|e.to_string())?;
            }
        }
    }
    if sessions.len() == 1 {
        if let Some(state) = state_reads::one(&tx, &sessions[0].id)? {
            changed.push(state);
        }
    } else {
        for repo in &repos {
            changed.extend(state_reads::repo(&tx, repo)?.into_values());
        }
    }
    let ids = sessions
        .iter()
        .map(|s| s.id.as_str())
        .collect::<HashSet<_>>();
    changed.retain(|state| ids.contains(state.session_id.as_str()));
    for state in &mut changed {
        use sha2::{Digest, Sha256};
        let digest = format!(
            "{:x}",
            Sha256::digest(
                serde_json::to_vec(&(
                    &state.base_sha,
                    &state.head_sha,
                    &state.base_branch,
                    &state.compare_branch,
                    state.needs_review,
                    &state.ref_status,
                    &state.session_status,
                    &state.reviewers
                ))
                .map_err(|e| e.to_string())?
            )
        );
        let touched=tx.prepare_cached("UPDATE virtual_mr_ref_state SET view_digest=?2,revision=revision+CASE WHEN view_digest='' THEN 0 ELSE 1 END WHERE session_id=?1 AND view_digest!=?2").map_err(|e|e.to_string())?.execute(params![state.session_id,digest]).map_err(|e|e.to_string())?;
        if touched > 0 {
            state.revision = tx
                .query_row(
                    "SELECT revision FROM virtual_mr_ref_state WHERE session_id=?1",
                    [&state.session_id],
                    |r| r.get(0),
                )
                .map_err(|e| e.to_string())?;
        }
    }
    let epochs = epochs::read(&tx, sessions)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok((changed, epochs))
}
