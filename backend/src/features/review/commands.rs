use super::{
    context::{capture, ReviewContext},
    coordinator::ReviewCoordinator,
    provider, ReviewRequest, ReviewRun,
};
use crate::{
    core::db::Database,
    features::sandbox::{guardrails::GuardrailsEngine, SandboxManager},
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn test_ai_review_provider(request: ReviewRequest) -> Result<Value, String> {
    let url = provider::endpoint(&request)?;
    let subscription_token = if request.auth_mode == "subscription_oauth" {
        Some(crate::features::ai::chatgpt_oauth::review_access_token().await?)
    } else {
        None
    };
    let tools = super::schemas::tools()
        .into_iter()
        .filter(|tool| tool["name"] == "get_diff")
        .collect::<Vec<_>>();
    let mut history = provider::initial_history(&request.provider, "Connectivity check only. Call get_diff with empty arguments. No repository or source code is attached. Do not answer in plain text.");
    let body = provider::payload(&request, "Verify client-side function calling by calling the supplied get_diff tool. No tool will actually be executed.", &history, &tools, 512);
    let response = provider::request(
        &request,
        &url,
        &body,
        subscription_token.as_ref().map(|token| token.as_str()),
    )
    .await?;
    let (calls, usage) = provider::decode(&request.provider, &response, &mut history)?;
    if calls.len() != 1
        || calls[0].name != "get_diff"
        || super::schemas::validate(&tools[0]["parameters"], &calls[0].arguments).is_err()
    {
        return Err(
            "The provider did not return a valid function call. Check model/tool support.".into(),
        );
    }
    Ok(
        json!({"success":true,"message":format!("Verified function calling for {} / {} ({} reported tokens). No repository source was sent.",request.provider,request.model,usage)}),
    )
}

#[tauri::command]
pub async fn start_ai_review(app: AppHandle, request: ReviewRequest) -> Result<ReviewRun, String> {
    if request.reviewer_id.as_deref().is_some_and(|id| id.len() > 200)
        || request.reviewer_name.as_deref().is_some_and(|name| name.len() > 200)
    {
        return Err("Reviewer identity exceeds the supported length".into());
    }
    let endpoint = provider::endpoint(&request)?;
    let subscription_token = if request.auth_mode == "subscription_oauth" {
        Some(crate::features::ai::chatgpt_oauth::review_access_token().await?)
    } else {
        None
    };
    if request.provider != "ollama"
        && request.auth_mode != "subscription_oauth"
        && !crate::features::credentials::ai_key_exists(&request.provider)?
    {
        return Err("Configure an API key in Preferences before starting a review".into());
    }
    let session_id = request.session_id.clone();
    let (repo, base, head) = {
        let db = app.state::<Database>();
        let conn = db.conn();
        conn.query_row("SELECT r.local_path,s.base_branch,s.compare_branch FROM virtual_mr_sessions s JOIN repositories r ON r.id=s.repo_id WHERE s.id=?1",[&session_id],|row|Ok((row.get::<_,String>(0)?,row.get::<_,String>(1)?,row.get::<_,String>(2)?))).map_err(|_|"Virtual MR or repository not found")?
    };
    let guards = Arc::new(GuardrailsEngine::new());
    guards.update_policy(app.state::<SandboxManager>().get_guardrail_policy());
    let policy = serde_json::to_string(&guards.get_policy())
        .map_err(|_| "Could not capture review policy")?;
    let policy_guards = Arc::clone(&guards);
    let snapshot =
        tauri::async_runtime::spawn_blocking(move || capture(&repo, &base, &head, &policy_guards))
            .await
            .map_err(|_| "Could not capture Git snapshot")??;
    if snapshot.changed_files.len() > 5000 {
        return Err("More than 5,000 changed files; split the review into smaller changes".into());
    }
    let id = uuid::Uuid::new_v4().to_string();
    let cancellation = app.state::<ReviewCoordinator>().reserve(&session_id, &id)?;
    let run = ReviewRun {
        id: id.clone(),
        session_id: session_id.clone(),
        provider: request.provider.clone(),
        model: request.model.clone(),
        reviewer_id: request.reviewer_id.clone(),
        reviewer_name: request.reviewer_name.clone(),
        endpoint,
        snapshot: snapshot.clone(),
        status: "running".into(),
        summary: String::new(),
        error: None,
        findings: vec![],
        inspected_files: vec![],
        turns: 0,
        tool_calls: 0,
        usage_tokens: 0,
        context_bytes: 0,
        started_at: chrono::Utc::now().to_rfc3339(),
        finished_at: None,
        published: false,
        prompt_version: format!(
            "review-v1:{:x}",
            Sha256::digest(
                format!(
                    "{}{}{}",
                    super::runtime::SYSTEM,
                    request.instructions,
                    policy
                )
                .as_bytes()
            )
        ),
    };
    if let Err(error) = app.state::<Database>().save_review_run(&run) {
        app.state::<ReviewCoordinator>().release(&session_id);
        return Err(error);
    }
    let context = Arc::new(Mutex::new(ReviewContext::new(snapshot, guards)));
    let task_app = app.clone();
    let task_run = run.clone();
    tauri::async_runtime::spawn(async move {
        let worker_app = task_app.clone();
    let worker = tauri::async_runtime::spawn(super::runtime::run(
            worker_app,
            request,
            subscription_token,
            task_run,
            context,
            cancellation,
        ));
        if worker.await.is_err() {
            if let Ok(mut failed) = task_app.state::<Database>().get_review_run(&id) {
                failed.status = "failed".into();
                failed.error =
                    Some("Review worker stopped unexpectedly; no approval was recorded".into());
                failed.finished_at = Some(chrono::Utc::now().to_rfc3339());
                let _ = task_app.state::<Database>().save_review_run(&failed);
            }
            task_app.state::<ReviewCoordinator>().release(&session_id);
        }
    });
    Ok(run)
}

#[tauri::command]
pub async fn get_ai_review(app: AppHandle, run_id: String) -> Result<Value, String> {
    let db = app.state::<Database>();
    Ok(json!({"run":db.get_review_run(&run_id)?,"events":db.review_events(&run_id)?}))
}

#[tauri::command]
pub async fn list_ai_reviews(app: AppHandle, session_id: String) -> Result<Vec<ReviewRun>, String> {
    app.state::<Database>().list_review_runs(&session_id)
}

#[tauri::command]
pub async fn cancel_ai_review(app: AppHandle, run_id: String) -> Result<(), String> {
    app.state::<ReviewCoordinator>().cancel(&run_id)
}

#[tauri::command]
pub async fn publish_ai_review(app: AppHandle, run_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move||{
        let db=app.state::<Database>();let run=db.get_review_run(&run_id)?;
        let (repo,base,head)={let conn=db.conn();conn.query_row("SELECT r.local_path,s.base_branch,s.compare_branch FROM virtual_mr_sessions s JOIN repositories r ON r.id=s.repo_id WHERE s.id=?1",[&run.session_id],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?))).map_err(|_|"Virtual MR no longer exists")?};
        if repo!=run.snapshot.repo_path||super::context::resolve_snapshot_ref(&repo,&base)?!=run.snapshot.base_sha||super::context::resolve_snapshot_ref(&repo,&head)?!=run.snapshot.head_sha{return Err("Review snapshot is stale. Start a new run before publishing findings.".into());}
        db.publish_review(&run)
    }).await.map_err(|_|"Could not publish review findings")?
}
