use crate::core::db::Database;
use crate::features::review::{context::ReviewContext, ReviewFinding, ReviewRun};
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
        .map_err(|_| {
            crate::common::messages::failure(
                "backend.review.contextUnavailable",
                serde_json::json!({}),
                "Review context unavailable".into(),
            )
        })?
        .snapshot
        .clone();
    let (repo_path, base_branch, source_branch) = {
        let conn = db.conn();
        conn.query_row(
            "SELECT r.local_path,s.base_branch,s.compare_branch FROM virtual_mr_sessions s JOIN repositories r ON r.id=s.repo_id WHERE s.id=?1",
            [&run.session_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
        ).map_err(|_| crate::common::messages::failure("backend.review.virtualMrOrRepoNoLongerExists", serde_json::json!({}), "Virtual MR or repository no longer exists".into()))?
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
    .map_err(|_| {
        crate::common::messages::failure(
            "backend.review.verifySnapshotFailed",
            serde_json::json!({}),
            "Could not verify the current Virtual MR snapshot".into(),
        )
    })??;
    if actual_base != expected_base || actual_head != expected_head {
        return Err(crate::common::messages::code(
            "backend.review.branchesChanged",
        ));
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
            .map_err(|_| {
                crate::common::messages::failure(
                    "backend.review.contextUnavailable",
                    serde_json::json!({}),
                    "Review context unavailable".into(),
                )
            })?
            .validate_findings(&findings)
    })
    .await
    .map_err(|_| {
        crate::common::messages::failure(
            "backend.review.findingValidationTaskFailed",
            serde_json::json!({}),
            "Finding validation task failed".into(),
        )
    })?
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
            .map_err(|_| {
                crate::common::messages::failure(
                    "backend.review.contextUnavailable",
                    serde_json::json!({}),
                    "Review context unavailable".into(),
                )
            })?
            .validate_reverted_finding(&finding, &original_commit_id, &original_side)
    })
    .await
    .map_err(|_| {
        crate::common::messages::failure(
            "backend.review.revertVerificationTaskFailed",
            serde_json::json!({}),
            "Revert verification task failed".into(),
        )
    })?
}

pub(super) async fn validate_resolution_change(
    context: &Arc<Mutex<ReviewContext>>,
    path: &str,
    original_sha: &str,
) -> Result<(), String> {
    let context = Arc::clone(context);
    let path = path.to_owned();
    let original_sha = original_sha.to_owned();
    tauri::async_runtime::spawn_blocking(move || {
        context
            .lock()
            .map_err(|_| {
                crate::common::messages::failure(
                    "backend.review.contextUnavailable",
                    serde_json::json!({}),
                    "Review context unavailable".into(),
                )
            })?
            .validate_resolution_change(&path, &original_sha)
    })
    .await
    .map_err(|_| {
        crate::common::messages::failure(
            "backend.review.fixVerificationTaskFailed",
            serde_json::json!({}),
            "Fix verification task failed".into(),
        )
    })?
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
