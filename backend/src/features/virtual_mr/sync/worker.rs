use super::{
    epochs, git_refs, persistence, scan_result::ScanResult, state::MrSyncState,
    tracked_mr::TrackedMr,
};
use crate::core::db::Database;
use std::collections::{HashMap, HashSet};

pub(super) fn groups(db: &Database) -> Result<HashMap<String, Vec<TrackedMr>>, String> {
    let mut groups = HashMap::<String, Vec<TrackedMr>>::new();
    let mut roots = HashMap::<String, String>::new();
    for s in persistence::tracked(db)? {
        let root = roots.entry(s.repo_path.clone()).or_insert_with(|| {
            dunce::canonicalize(&s.repo_path)
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or_else(|_| s.repo_path.clone())
        });
        groups.entry(root.clone()).or_default().push(s);
    }
    Ok(groups)
}

pub(super) fn scan(
    db: &Database,
    root: &str,
    sessions: &[TrackedMr],
    locate: bool,
    cached: Option<(&[MrSyncState], &HashMap<String, i64>)>,
) -> Result<ScanResult, String> {
    let _activity = crate::common::activity::OperationLease::acquire()?;
    let names = sessions
        .iter()
        .flat_map(|s| [s.base.clone(), s.head.clone()])
        .collect::<HashSet<_>>();
    let refs = match git_refs::inventory(root, &names) {
        Ok(refs) => refs,
        Err(_) => {
            let unavailable = names.into_iter().map(|n| (n, None)).collect();
            let (states, epochs) = persistence::apply(db, sessions, &unavailable)?;
            return Ok(ScanResult {
                states,
                epochs,
                paths: Vec::new(),
                healthy: false,
            });
        }
    };
    let current_epochs = epochs::read(&db.conn(), sessions)?;
    let paths = if locate {
        git_refs::watch_paths(root).unwrap_or_default()
    } else {
        Vec::new()
    };
    if let Some((states, old_epochs)) = cached {
        let by_id = states
            .iter()
            .map(|s| (s.session_id.as_str(), s))
            .collect::<HashMap<_, _>>();
        if old_epochs == &current_epochs
            && states.len() == sessions.len()
            && sessions.iter().all(|s| {
                by_id.get(s.id.as_str()).is_some_and(|old| {
                    old.base_branch == s.base
                        && old.compare_branch == s.head
                        && old.base_sha == refs[&s.base]
                        && old.head_sha == refs[&s.head]
                })
            })
        {
            return Ok(ScanResult {
                states: states.to_vec(),
                paths,
                healthy: true,
                epochs: current_epochs,
            });
        }
    }
    // New data must settle before publishing a revision; unchanged cached data
    // needs no second Git read and no SQLite write transaction.
    if refs != git_refs::inventory(root, &names)? {
        return Err("Git refs changed during synchronization".into());
    }
    let (states, epochs) = persistence::apply(db, sessions, &refs)?;
    Ok(ScanResult {
        states,
        epochs,
        paths,
        healthy: true,
    })
}

pub(crate) fn verify_review(
    db: &Database,
    run: &crate::features::review::ReviewRun,
) -> Result<(), String> {
    let session=db.conn().query_row("SELECT s.id,s.repo_id,r.local_path,s.base_branch,s.compare_branch,s.title,s.status FROM virtual_mr_sessions s JOIN repositories r ON r.id=s.repo_id WHERE s.id=?1 AND s.status!='closed'",[&run.session_id],|r|Ok(TrackedMr{id:r.get(0)?,repo_id:r.get(1)?,repo_path:r.get(2)?,base:r.get(3)?,head:r.get(4)?,title:r.get(5)?,status:r.get(6)?})).map_err(|_|crate::common::messages::code("backend.review.snapshotStale"))?;
    if session.repo_path != run.snapshot.repo_path {
        return Err(crate::common::messages::code(
            "backend.review.snapshotStale",
        ));
    }
    check_refs(
        &session.repo_path,
        &session.base,
        &session.head,
        &run.snapshot.base_sha,
        &run.snapshot.head_sha,
    )?;
    observe_review(db, run, &session.base, &session.head)
}

pub(crate) fn check_refs(
    root: &str,
    base: &str,
    head: &str,
    base_sha: &str,
    head_sha: &str,
) -> Result<(), String> {
    let refs = git_refs::inventory(root, &HashSet::from([base.to_owned(), head.to_owned()]))?;
    if refs[base].as_deref() != Some(base_sha) || refs[head].as_deref() != Some(head_sha) {
        return Err(crate::common::messages::code(
            "backend.review.snapshotStale",
        ));
    }
    Ok(())
}

pub(crate) fn observe_review(
    db: &Database,
    run: &crate::features::review::ReviewRun,
    base: &str,
    head: &str,
) -> Result<(), String> {
    let session=db.conn().query_row("SELECT s.id,s.repo_id,r.local_path,s.base_branch,s.compare_branch,s.title,s.status FROM virtual_mr_sessions s JOIN repositories r ON r.id=s.repo_id WHERE s.id=?1 AND s.status!='closed'",[&run.session_id],|r|Ok(TrackedMr{id:r.get(0)?,repo_id:r.get(1)?,repo_path:r.get(2)?,base:r.get(3)?,head:r.get(4)?,title:r.get(5)?,status:r.get(6)?})).map_err(|_|crate::common::messages::code("backend.review.snapshotStale"))?;
    if session.repo_path != run.snapshot.repo_path || session.base != base || session.head != head {
        return Err(crate::common::messages::code(
            "backend.review.snapshotStale",
        ));
    }
    if run.reply_discussion_id.is_some() {
        return Ok(());
    }
    let refs = HashMap::from([
        (session.base.clone(), Some(run.snapshot.base_sha.clone())),
        (session.head.clone(), Some(run.snapshot.head_sha.clone())),
    ]);
    persistence::apply(db, &[session], &refs)?;
    Ok(())
}
