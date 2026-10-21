//! Review lifecycle and stable entry points. The bounded loop and tool actions live in child modules.
mod action_dispatch;
mod engine;
mod prompt;
mod review_actions;
mod submission;
mod tool_state;
mod tool_turn;

use super::{
    context::ReviewContext, native_model_adapter::NativeModelAdapter, ReviewRequest, ReviewRun,
};
use crate::core::db::Database;
use engine::execute_with_adapter;
pub use prompt::{is_supported_reviewer_role, SYSTEM};
use serde_json::{json, Value};
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

pub async fn run(
    app: AppHandle,
    config: ReviewRequest,
    mut run: ReviewRun,
    context: Arc<Mutex<ReviewContext>>,
    cancel: Arc<AtomicBool>,
) {
    let database = app.state::<Database>();
    let review_started = Instant::now();
    let run_id = run.id.clone();
    super::debug_log::log(format_args!(
        "event=review_started run={} session={} mode={} provider={} model={} reviewer={}",
        super::debug_log::safe_label(&run.id, 80),
        super::debug_log::safe_label(&run.session_id, 80),
        config.execution_mode,
        super::debug_log::safe_label(&run.provider, 40),
        super::debug_log::safe_label(&run.model, 100),
        super::debug_log::safe_label(
            config
                .reviewer_name
                .as_deref()
                .or(config.reviewer_id.as_deref())
                .unwrap_or("default"),
            100
        )
    ));
    let outcome = tokio::select! {
        result=execute(&database,&config,&mut run,&context)=>result,
        _=wait_cancel(cancel)=>{
            super::debug_log::log(format_args!("event=review_cancelled run={}", super::debug_log::safe_label(&run_id, 80)));
            Err("Review cancelled. An already-sent provider request may still be billed.".into())
        },
        _=tokio::time::sleep(Duration::from_secs(300))=>{
            super::debug_log::log(format_args!("event=review_deadline_exceeded run={} deadline_seconds=300", super::debug_log::safe_label(&run_id, 80)));
            Err("Review deadline exceeded; results are incomplete.".into())
        },
    };
    run.finish(outcome);
    super::debug_log::log(format_args!(
        "event=review_finished run={} status={} elapsed_ms={} turns={} tool_calls={} findings={} inspected_files={} context_bytes={} usage_tokens={} published={} error_class={}",
        super::debug_log::safe_label(&run.id, 80),
        run.status,
        review_started.elapsed().as_millis(),
        run.turns,
        run.tool_calls,
        run.findings.len(),
        run.inspected_files.len(),
        run.context_bytes,
        run.usage_tokens,
        run.published,
        run.error.as_deref().map(super::debug_log::error_class).unwrap_or("none")
    ));
    let db = app.state::<Database>();
    let _ = db.review_event(
        &run.id,
        "finished",
        json!({"status":run.status,"error":run.error}),
    );
    if let Err(error) = db.save_review_run(&run) {
        eprintln!("Could not persist final review state: {error}");
    }
    app.state::<super::coordinator::ReviewCoordinator>()
        .release(&run.session_id);
}

async fn wait_cancel(cancel: Arc<AtomicBool>) {
    while !cancel.load(Ordering::SeqCst) {
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

async fn execute(
    db: &Database,
    config: &ReviewRequest,
    run: &mut ReviewRun,
    context: &Arc<Mutex<ReviewContext>>,
) -> Result<(), String> {
    match config.execution_mode.as_str() {
        "provider" => {
            let adapter = NativeModelAdapter::new(config)?;
            execute_with_adapter(db, config, run, context, &adapter).await
        }
        "acp" => {
            let agent = config
                .acp_agent
                .clone()
                .ok_or("The selected ACP reviewer agent is unavailable")?;
            super::debug_log::log(format_args!(
                "event=acp_reviewer_selected run={} agent_id={} agent_name={} version={} config_overrides={}",
                super::debug_log::safe_label(&run.id, 80),
                super::debug_log::safe_label(&agent.id, 100),
                super::debug_log::safe_label(&agent.name, 100),
                agent.version.as_deref().map(|version| super::debug_log::safe_label(version, 80)).unwrap_or_else(|| "unknown".into()),
                config.acp_config_options.as_ref().and_then(Value::as_object).map_or(0, serde_json::Map::len)
            ));
            let adapter = super::acp_model_adapter::AcpModelAdapter::new(
                agent,
                config.acp_config_options.clone().unwrap_or_default(),
            );
            let result = execute_with_adapter(db, config, run, context, &adapter).await;
            adapter.close().await;
            result
        }
        _ => Err("Unsupported review execution mode".into()),
    }
}

#[cfg(test)]
mod tests;
