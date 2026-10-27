use super::{context::ReviewContext, ReviewRun};
use crate::core::db::Database;
use crate::features::sandbox::guardrails::GuardrailsEngine;
use crate::features::virtual_mr::persistence::VirtualMrDiscussionDb;
use rusqlite::params;
use std::{collections::HashMap, sync::Arc, time::Instant};

/// Recover and cache display excerpts for published AI findings, including older
/// discussions created before snippet persistence. Never change their anchors.
pub(crate) fn list_with_code_context(
    db: &Database,
    session_id: &str,
    guards: Arc<GuardrailsEngine>,
) -> Result<Vec<VirtualMrDiscussionDb>, String> {
    let mut discussions = db
        .list_discussions(session_id)
        .map_err(|error| error.to_string())?;
    let Some(repo) = db
        .get_repo_path_for_session(session_id)
        .map_err(|error| error.to_string())?
    else {
        return Ok(discussions);
    };
    let mut runs: HashMap<String, Option<(ReviewRun, ReviewContext)>> = HashMap::new();
    let started = Instant::now();
    let mut attempts = 0;
    for discussion in &mut discussions {
        if discussion.code_snippet.is_some()
            || !discussion
                .comments
                .first()
                .is_some_and(|comment| comment.author_type == "ai_agent")
        {
            continue;
        }
        // Bound legacy recovery work; successfully cached excerpts need no Git reads again.
        if attempts >= 50 || started.elapsed().as_secs() >= 3 {
            break;
        }
        let Some((run_id, index)) = discussion
            .id
            .strip_prefix("review-")
            .and_then(|id| id.rsplit_once('-'))
        else {
            continue;
        };
        let (Ok(_), Ok(index)) = (uuid::Uuid::parse_str(run_id), index.parse::<usize>()) else {
            continue;
        };
        attempts += 1;
        let entry = runs.entry(run_id.to_owned()).or_insert_with(|| {
            let run = db.get_review_run(run_id).ok()?;
            if run.session_id != session_id || run.snapshot.repo_path != repo || !run.published {
                return None;
            }
            for sha in [&run.snapshot.merge_base_sha, &run.snapshot.head_sha] {
                if ![40, 64].contains(&sha.len())
                    || !sha.bytes().all(|byte| byte.is_ascii_hexdigit())
                {
                    return None;
                }
            }
            let context = ReviewContext::new(run.snapshot.clone(), Arc::clone(&guards));
            Some((run, context))
        });
        let Some((run, context)) = entry else {
            continue;
        };
        let Some(finding) = run.findings.get(index) else {
            continue;
        };
        let (side, sha) = match finding.side.as_str() {
            "base" => ("left", &run.snapshot.merge_base_sha),
            "head" => ("right", &run.snapshot.head_sha),
            _ => continue,
        };
        if discussion.file_path.as_deref() != Some(finding.file_path.as_str())
            || discussion.diff_side.as_deref() != Some(side)
            || discussion.commit_id.as_deref() != Some(sha.as_str())
            || discussion.line_number != Some(finding.start_line as i64)
        {
            continue;
        }
        let Ok(snippet) = context.discussion_code_snippet(finding) else {
            continue;
        };
        let payload = serde_json::to_string(&snippet).map_err(|error| error.to_string())?;
        // Git reads occur outside the DB lock. Recheck the anchor when caching.
        let updated = db.conn().execute(
            "UPDATE virtual_mr_discussions SET code_snippet=?2 WHERE id=?1 AND session_id=?3 AND code_snippet IS NULL AND file_path=?4 AND diff_side=?5 AND commit_id=?6 AND line_number=?7",
            params![discussion.id, payload, session_id, finding.file_path, side, sha, finding.start_line as i64],
        ).map_err(|error| error.to_string())?;
        if updated == 1 {
            discussion.code_snippet = Some(snippet);
        }
    }
    Ok(discussions)
}

#[cfg(test)]
mod tests;
