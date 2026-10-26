use super::{
    context::{capture, ReviewContext},
    coordinator::ReviewCoordinator,
    provider, ReviewRequest, ReviewRun,
};
use crate::{
    core::db::Database,
    features::ai::acp::AcpAgentConfig,
    features::sandbox::{guardrails::GuardrailsEngine, SandboxManager},
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    sync::{Arc, Mutex},
    time::Instant,
};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn test_ai_review_provider(request: ReviewRequest) -> Result<Value, String> {
    let url = provider::endpoint(&request)?;
    let tools = super::schemas::tools()
        .into_iter()
        .filter(|tool| tool["name"] == "get_diff")
        .collect::<Vec<_>>();
    let mut history = provider::initial_history(&request.provider, "Connectivity check only. Call get_diff with empty arguments. No repository or source code is attached. Do not answer in plain text.");
    let body = provider::payload(&request, "Verify client-side function calling by calling the supplied get_diff tool. No tool will actually be executed.", &history, &tools, 512);
    let response = provider::request(&request, &url, &body).await?;
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
pub async fn start_ai_review(
    app: AppHandle,
    mut request: ReviewRequest,
) -> Result<ReviewRun, String> {
    if request
        .reviewer_id
        .as_deref()
        .is_some_and(|id| id.len() > 200)
        || request
            .reviewer_name
            .as_deref()
            .is_some_and(|name| name.len() > 200)
    {
        return Err("Reviewer identity exceeds the supported length".into());
    }
    if request
        .reviewer_role
        .as_deref()
        .is_some_and(|role| !super::runtime::is_supported_reviewer_role(role))
    {
        return Err("Unsupported reviewer role".into());
    }
    let (endpoint, run_provider, run_model) = match request.execution_mode.as_str() {
        "provider" => {
            if request.acp_agent.is_some() || request.acp_config_options.is_some() {
                return Err(
                    "A built-in provider review cannot include ACP agent configuration".into(),
                );
            }
            let endpoint = provider::endpoint(&request)?;
            if request.provider != "ollama"
                && !crate::features::credentials::ai_key_exists(&request.provider)?
            {
                return Err("Configure an API key in Preferences before starting a review".into());
            }
            (endpoint, request.provider.clone(), request.model.clone())
        }
        "acp" => {
            if let Some(options) = request.acp_config_options.as_ref() {
                crate::features::ai::acp::validate_review_config_overrides(options)?;
            }
            let requested_id = request
                .acp_agent
                .as_ref()
                .map(|agent| agent.id.as_str())
                .ok_or("Select an installed ACP agent for this reviewer")?;
            let agent = resolve_saved_review_agent(&app, requested_id)?;
            if !request.allow_remote {
                return Err("Explicit consent is required before sending the review snapshot to an ACP agent".into());
            }
            request.acp_agent = Some(agent.clone());
            (
                format!("acp://{}", agent.id),
                "acp".into(),
                agent.name.clone(),
            )
        }
        _ => return Err("Unsupported review execution mode".into()),
    };
    let session_id = request.session_id.clone();
    super::runtime::validate_request(&app.state::<Database>(), &request)?;
    let (repo, base, head) = {
        let db = app.state::<Database>();
        let conn = db.conn();
        conn.query_row("SELECT r.local_path,s.base_branch,s.compare_branch FROM virtual_mr_sessions s JOIN repositories r ON r.id=s.repo_id WHERE s.id=?1",[&session_id],|row|Ok((row.get::<_,String>(0)?,row.get::<_,String>(1)?,row.get::<_,String>(2)?))).map_err(|_|"Virtual MR or repository not found")?
    };
    let guards = Arc::new(
        app.state::<SandboxManager>()
            .guardrails()
            .fork_with_policy_snapshot(),
    );
    let policy = serde_json::to_string(&guards.get_policy())
        .map_err(|_| "Could not capture review policy")?;
    let policy_guards = Arc::clone(&guards);
    super::debug_log::log(format_args!(
        "event=snapshot_capture_started session={} mode={}",
        super::debug_log::safe_label(&session_id, 80),
        request.execution_mode
    ));
    let capture_started = Instant::now();
    let snapshot = match tauri::async_runtime::spawn_blocking(move || {
        capture(&repo, &base, &head, &policy_guards)
    })
    .await
    {
        Ok(Ok(snapshot)) => snapshot,
        Ok(Err(error)) => {
            super::debug_log::log(format_args!(
                "event=snapshot_capture_failed session={} elapsed_ms={} error_class={}",
                super::debug_log::safe_label(&session_id, 80),
                capture_started.elapsed().as_millis(),
                super::debug_log::error_class(&error)
            ));
            return Err(error);
        }
        Err(_) => {
            super::debug_log::log(format_args!(
                "event=snapshot_capture_failed session={} elapsed_ms={} error_class=worker_stopped",
                super::debug_log::safe_label(&session_id, 80),
                capture_started.elapsed().as_millis()
            ));
            return Err("Could not capture Git snapshot".into());
        }
    };
    super::debug_log::log(format_args!(
        "event=snapshot_capture_completed session={} elapsed_ms={} changed_files={} excluded_files={}",
        super::debug_log::safe_label(&session_id, 80),
        capture_started.elapsed().as_millis(),
        snapshot.changed_files.len(),
        snapshot.excluded_files.len()
    ));
    if snapshot.changed_files.len() > 5000 {
        return Err("More than 5,000 changed files; split the review into smaller changes".into());
    }
    let id = uuid::Uuid::new_v4().to_string();
    let cancellation = app.state::<ReviewCoordinator>().reserve(&session_id, &id)?;
    let run = ReviewRun {
        id: id.clone(),
        session_id: session_id.clone(),
        provider: run_provider,
        model: run_model,
        reviewer_id: request.reviewer_id.clone(),
        reviewer_name: request.reviewer_name.clone(),
        reply_discussion_id: request.reply_discussion_id.clone(),
        endpoint,
        snapshot: snapshot.clone(),
        status: "running".into(),
        summary: String::new(),
        decision: None,
        generated_description: None,
        error: None,
        retry: None,
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
            "review-v2:{:x}",
            Sha256::digest(
                format!(
                    "{}{}{}{}{}{:?}",
                    super::runtime::SYSTEM,
                    request.instructions,
                    policy,
                    request.execution_mode,
                    request
                        .acp_agent
                        .as_ref()
                        .map(|agent| format!(
                            "{}@{}",
                            agent.id,
                            agent.version.as_deref().unwrap_or_default()
                        ))
                        .unwrap_or_default(),
                    request.reply_discussion_id,
                )
                .as_bytes()
            )
        ),
    };
    if let Err(error) = app.state::<Database>().save_review_run(&run) {
        app.state::<ReviewCoordinator>().release(&session_id);
        return Err(error);
    }
    super::debug_log::log(format_args!(
        "event=review_queued run={} session={} mode={} provider={} model={} reviewer={} changed_files={} excluded_files={}",
        super::debug_log::safe_label(&id, 80),
        super::debug_log::safe_label(&session_id, 80),
        request.execution_mode,
        super::debug_log::safe_label(&run.provider, 40),
        super::debug_log::safe_label(&run.model, 100),
        super::debug_log::safe_label(
            request.reviewer_name.as_deref().or(request.reviewer_id.as_deref()).unwrap_or("default"),
            100
        ),
        run.snapshot.changed_files.len(),
        run.snapshot.excluded_files.len()
    ));
    let context = Arc::new(Mutex::new(ReviewContext::new(snapshot, guards)));
    let task_app = app.clone();
    let task_run = run.clone();
    tauri::async_runtime::spawn(async move {
        let worker_app = task_app.clone();
        let worker = tauri::async_runtime::spawn(super::runtime::run(
            worker_app,
            request,
            task_run,
            context,
            cancellation,
        ));
        if worker.await.is_err() {
            super::debug_log::log(format_args!(
                "event=review_worker_stopped run={} session={} error_class=worker_panicked",
                super::debug_log::safe_label(&id, 80),
                super::debug_log::safe_label(&session_id, 80)
            ));
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

/// Never launch a process from command/args supplied by the webview. Resolve
/// the selected ID against the committed preferences document, then validate
/// and use that saved configuration.
fn resolve_saved_review_agent(
    app: &AppHandle,
    requested_id: &str,
) -> Result<AcpAgentConfig, String> {
    let settings = app
        .state::<crate::features::preferences::PreferencesManager>()
        .read()?
        .settings
        .ok_or("Could not load saved ACP agent configuration")?;
    let agents = settings
        .pointer("/ai/externalAgents")
        .and_then(Value::as_array)
        .ok_or("No ACP agents are saved in Preferences")?;
    let saved = agents
        .iter()
        .find(|agent| agent.get("id").and_then(Value::as_str) == Some(requested_id))
        .cloned()
        .ok_or("The selected ACP agent is not installed in Preferences")?;
    let agent: AcpAgentConfig = serde_json::from_value(saved)
        .map_err(|_| "The saved ACP agent configuration is invalid")?;
    crate::features::ai::acp::validate_review_agent_config(&agent)?;
    Ok(agent)
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
        let guards = Arc::new(GuardrailsEngine::new());
        let context = super::context::ReviewContext::new(run.snapshot.clone(), guards);
        context.validate_findings(&run.findings)?;
        db.publish_review(&run)
    }).await.map_err(|_|"Could not publish review findings")?
}
