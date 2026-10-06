use crate::features::sandbox::{
    GuardrailAuditEvent, GuardrailEvaluationResult, GuardrailMode, GuardrailPolicy,
    SandboxAdapterInfo, SandboxExecutionResult, SandboxInstanceInfo, SandboxManager, SandboxType,
};
use tauri::{AppHandle, Manager};

// ---------------------------------------------------------------------------
// Sandbox Adapter Management Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_available_sandboxes(app: AppHandle) -> Result<Vec<SandboxAdapterInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<SandboxManager>();
        Ok(manager.list_available_adapters())
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn get_active_sandbox(app: AppHandle) -> Result<SandboxType, String> {
    let manager = app.state::<SandboxManager>();
    Ok(manager.get_active_type())
}

#[tauri::command]
pub async fn set_active_sandbox(
    app: AppHandle,
    adapter_type: SandboxType,
) -> Result<SandboxType, String> {
    let manager = app.state::<SandboxManager>();
    manager.set_active_type(adapter_type.clone());
    Ok(adapter_type)
}

#[tauri::command]
pub async fn create_sandbox_instance(
    app: AppHandle,
    repo_path: String,
    base: String,
    compare: String,
) -> Result<SandboxInstanceInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<SandboxManager>();
        manager.create_instance(&repo_path, &base, &compare)
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn destroy_sandbox_instance(app: AppHandle, instance_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<SandboxManager>();
        manager.destroy_instance(&instance_id)
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn list_sandbox_instances(app: AppHandle) -> Result<Vec<SandboxInstanceInfo>, String> {
    let manager = app.state::<SandboxManager>();
    Ok(manager.list_active_instances())
}

#[tauri::command]
pub async fn execute_sandbox_command(
    app: AppHandle,
    instance_id: String,
    command: String,
    args: Vec<String>,
) -> Result<SandboxExecutionResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<SandboxManager>();
        let instance = manager
            .get_instance(&instance_id)
            .ok_or_else(|| format!("Sandbox instance not found: {}", instance_id))?;
        let evaluation = manager
            .guardrails()
            .evaluate_command(&command, &args, &instance.adapter_type)
            .map_err(|violation| format!("🛡️ Guardrail Policy Blocked: {}", violation.message))?;
        if evaluation.requires_confirmation {
            manager.guardrails().record_policy_denial(
                "execute_terminal_cmd",
                &command,
                crate::features::sandbox::GuardrailViolation {
                    rule: "HUMAN_CONFIRMATION_REQUIRED".to_string(),
                    severity: crate::features::sandbox::GuardrailSeverity::High,
                    message: "The command requires human confirmation. Stage0 has no approval dialog for tool calls, so it was not executed.".to_string(),
                },
            );
            return Err(
                "Guardrail policy requires human confirmation; Stage0 has no approval dialog for tool calls, so the command was not executed."
                    .to_string(),
            );
        }

        let mut result = manager.execute_command(&instance_id, &command, &args)?;
        let (stdout, stdout_truncated) = manager
            .guardrails()
            .truncate_output_if_needed(&result.stdout);
        let (stderr, stderr_truncated) = manager
            .guardrails()
            .truncate_output_if_needed(&result.stderr);
        if stdout_truncated {
            result.stdout = stdout.into_owned();
        }
        if stderr_truncated {
            result.stderr = stderr.into_owned();
        }
        result.output_truncated |= stdout_truncated || stderr_truncated;
        Ok(result)
    })
    .await
    .map_err(|e| format!("Sandbox task join error: {}", e))?
}

#[tauri::command]
pub async fn sync_active_sandbox(
    app: AppHandle,
    instance_id: String,
    repo_path: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<SandboxManager>();
        manager.sync_instance(&instance_id, &repo_path)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn get_sandbox_tool_schemas(app: AppHandle) -> Result<serde_json::Value, String> {
    let manager = app.state::<SandboxManager>();
    let active_type = manager.get_active_type();
    Ok(crate::features::sandbox::get_tool_schemas(
        &active_type,
        &manager.get_guardrail_policy(),
    ))
}

#[tauri::command]
pub async fn dispatch_sandbox_tool(
    app: AppHandle,
    instance_id: String,
    tool_name: String,
    arguments: serde_json::Value,
) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<SandboxManager>();
        manager.dispatch_tool(&instance_id, &tool_name, arguments)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn get_guardrail_policy(app: AppHandle) -> Result<GuardrailPolicy, String> {
    let manager = app.state::<SandboxManager>();
    Ok(manager.get_guardrail_policy())
}

#[tauri::command]
pub async fn update_guardrail_policy(
    app: AppHandle,
    policy: GuardrailPolicy,
) -> Result<(), String> {
    let manager = app.state::<SandboxManager>();
    manager.update_guardrail_policy(policy);
    Ok(())
}

#[tauri::command]
pub async fn reset_guardrail_policy(
    app: AppHandle,
    mode: String,
) -> Result<GuardrailPolicy, String> {
    let manager = app.state::<SandboxManager>();
    let parsed_mode = match mode.to_lowercase().as_str() {
        "strict" => GuardrailMode::Strict,
        "permissive" => GuardrailMode::Permissive,
        _ => GuardrailMode::Balanced,
    };
    manager.reset_guardrail_policy(parsed_mode);
    Ok(manager.get_guardrail_policy())
}

#[tauri::command]
pub async fn get_guardrail_audit_log(
    app: AppHandle,
    limit: Option<usize>,
) -> Result<Vec<GuardrailAuditEvent>, String> {
    let manager = app.state::<SandboxManager>();
    Ok(manager.get_guardrail_audit_log(limit))
}

#[tauri::command]
pub async fn clear_guardrail_audit_log(app: AppHandle) -> Result<(), String> {
    let manager = app.state::<SandboxManager>();
    manager.clear_guardrail_audit_log();
    Ok(())
}

#[tauri::command]
pub async fn simulate_guardrail_check(
    app: AppHandle,
    tool_name: String,
    arguments: serde_json::Value,
) -> Result<GuardrailEvaluationResult, String> {
    let manager = app.state::<SandboxManager>();
    Ok(manager.simulate_guardrail_check(&tool_name, arguments))
}
