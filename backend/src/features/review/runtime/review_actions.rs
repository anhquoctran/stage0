use crate::core::db::Database;
use crate::features::review::{context::ReviewContext, ReviewFinding, ReviewRun};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::sync::{Arc, Mutex};

pub(super) async fn update_mr_description(
    db: &Database,
    run: &ReviewRun,
    context: &Arc<Mutex<ReviewContext>>,
    description: &str,
) -> Result<(), String> {
    let snapshot = context
        .lock()
        .map_err(|_| "Review context unavailable")?
        .snapshot
        .clone();
    let (repo_path, base_branch, source_branch) = {
        let conn = db.conn();
        conn.query_row(
            "SELECT r.local_path,s.base_branch,s.compare_branch FROM virtual_mr_sessions s JOIN repositories r ON r.id=s.repo_id WHERE s.id=?1",
            [&run.session_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
        ).map_err(|_| "Virtual MR or repository no longer exists")?
    };
    if repo_path != snapshot.repo_path {
        return Err(
            "The repository changed during review; the description was not updated.".into(),
        );
    }

    let expected_base = snapshot.base_sha.clone();
    let expected_head = snapshot.head_sha.clone();
    let (actual_base, actual_head) = tauri::async_runtime::spawn_blocking(move || {
        Ok::<_, String>((
            super::super::context::resolve_snapshot_ref(&repo_path, &base_branch)?,
            super::super::context::resolve_snapshot_ref(&repo_path, &source_branch)?,
        ))
    })
    .await
    .map_err(|_| "Could not verify the current Virtual MR snapshot")??;
    if actual_base != expected_base || actual_head != expected_head {
        return Err("The Virtual MR branches changed during review. Start a new review before updating its description.".into());
    }

    db.update_review_generated_description(&run.session_id, description)
}

pub(super) async fn validate_findings(
    context: &Arc<Mutex<ReviewContext>>,
    findings: Vec<ReviewFinding>,
) -> Result<(), String> {
    let context = Arc::clone(context);
    tauri::async_runtime::spawn_blocking(move || {
        context
            .lock()
            .map_err(|_| "Review context unavailable".to_string())?
            .validate_findings(&findings)
    })
    .await
    .map_err(|_| "Finding validation task failed")?
}

pub(super) async fn validate_reverted_finding(
    context: &Arc<Mutex<ReviewContext>>,
    finding: ReviewFinding,
    original_commit_id: String,
    original_side: String,
) -> Result<(), String> {
    let context = Arc::clone(context);
    tauri::async_runtime::spawn_blocking(move || {
        context
            .lock()
            .map_err(|_| "Review context unavailable".to_string())?
            .validate_reverted_finding(&finding, &original_commit_id, &original_side)
    })
    .await
    .map_err(|_| "Revert verification task failed")?
}

pub(super) fn list_open_discussions(
    db: &Database,
    session_id: &str,
    offset: usize,
    queued_resolutions: &HashSet<String>,
    reviewer_id: Option<&str>,
) -> Result<Value, String> {
    const PAGE_SIZE: usize = 10;
    let discussions = db
        .list_discussions(session_id)
        .map_err(|error| error.to_string())?;
    let open = discussions
        .into_iter()
        .filter(|discussion| {
            !discussion.is_resolved && !queued_resolutions.contains(&discussion.id)
        })
        .collect::<Vec<_>>();
    let total = open.len();
    let start = offset.min(total);
    let end = start.saturating_add(PAGE_SIZE).min(total);
    let threads = open[start..end]
        .iter()
        .map(|discussion| {
            let can_reply = discussion.comments.last().is_some_and(|comment| super::super::mentions::can_reply_to_comment(
                &db.conn(), session_id, reviewer_id, &comment.author_type, &comment.author_id, &comment.body,
            ));
            let comments = discussion
                .comments
                .iter()
                .rev()
                .take(5)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .map(|comment| {
                    json!({
                        "id": comment.id,
                        "authorId": comment.author_id,
                        "authorType": comment.author_type,
                        "authorName": comment.author_name,
                        "body": super::super::security::redact(&comment.body).chars().take(1200).collect::<String>(),
                        "createdAt": comment.created_at,
                    })
                })
                .collect::<Vec<_>>();
            json!({
                "id": discussion.id,
                "filePath": discussion.file_path,
                "side": discussion.diff_side,
                "lineNumber": discussion.line_number,
                "commitId": discussion.commit_id,
                "canReply": can_reply,
                "comments": comments,
            })
        })
        .collect::<Vec<_>>();
    Ok(json!({
        "threads": threads,
        "totalOpen": total,
        "nextOffset": if end < total { Some(end) } else { None },
    }))
}

pub(super) fn deduplicate(findings: Vec<ReviewFinding>) -> Vec<ReviewFinding> {
    let mut seen = HashSet::new();
    findings
        .into_iter()
        .filter(|f| {
            seen.insert((
                f.file_path.clone(),
                f.side.clone(),
                f.start_line,
                f.title.clone(),
            ))
        })
        .map(|mut f| {
            f.title = super::super::security::redact(&f.title);
            f.body = super::super::security::redact(&f.body);
            f
        })
        .collect()
}
