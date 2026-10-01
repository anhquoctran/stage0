use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use super::{
    docker::DockerSandboxAdapter, in_memory::InMemorySandboxAdapter,
    local_worktree::LocalWorktreeSandboxAdapter, SandboxAdapter, SandboxAdapterInfo,
    SandboxExecutionResult, SandboxInstanceInfo, SandboxType,
};
use crate::git::{ConflictFilePreview, ConflictReport, MrDiffPayload};

pub struct SandboxManager {
    in_memory: Arc<InMemorySandboxAdapter>,
    local_worktree: Arc<LocalWorktreeSandboxAdapter>,
    docker: Arc<DockerSandboxAdapter>,
    active_type: Mutex<SandboxType>,
    instances: Mutex<HashMap<String, SandboxInstanceInfo>>,
    creation_lock: Mutex<()>,
    guardrails: Arc<super::guardrails::GuardrailsEngine>,
}

const MAX_ACTIVE_SANDBOX_INSTANCES: usize = 8;

impl SandboxManager {
    pub fn new() -> Self {
        Self::with_local_worktree(LocalWorktreeSandboxAdapter::new())
    }

    pub fn new_with_worktree_dir(path: PathBuf) -> Self {
        Self::with_local_worktree(LocalWorktreeSandboxAdapter::with_custom_dir(path))
    }

    fn with_local_worktree(local_worktree: LocalWorktreeSandboxAdapter) -> Self {
        Self {
            in_memory: Arc::new(InMemorySandboxAdapter::new()),
            local_worktree: Arc::new(local_worktree),
            docker: Arc::new(DockerSandboxAdapter::new()),
            active_type: Mutex::new(SandboxType::InMemory),
            instances: Mutex::new(HashMap::new()),
            creation_lock: Mutex::new(()),
            guardrails: Arc::new(super::guardrails::GuardrailsEngine::new()),
        }
    }

    #[inline]
    fn active_type_lock(&self) -> std::sync::MutexGuard<'_, SandboxType> {
        self.active_type.lock().unwrap_or_else(|p| p.into_inner())
    }

    #[inline]
    fn instances_lock(
        &self,
    ) -> std::sync::MutexGuard<'_, std::collections::HashMap<String, SandboxInstanceInfo>> {
        self.instances.lock().unwrap_or_else(|p| p.into_inner())
    }

    pub fn get_adapter(&self, adapter_type: &SandboxType) -> Arc<dyn SandboxAdapter> {
        match adapter_type {
            SandboxType::InMemory => self.in_memory.clone(),
            SandboxType::LocalWorktree => self.local_worktree.clone(),
            SandboxType::Docker => self.docker.clone(),
        }
    }

    pub fn get_active_adapter(&self) -> Arc<dyn SandboxAdapter> {
        let active = self.active_type_lock().clone();
        self.get_adapter(&active)
    }

    pub fn get_active_type(&self) -> SandboxType {
        self.active_type_lock().clone()
    }

    pub fn set_active_type(&self, adapter_type: SandboxType) {
        let mut active = self.active_type_lock();
        *active = adapter_type;
    }

    pub fn list_available_adapters(&self) -> Vec<SandboxAdapterInfo> {
        vec![
            self.in_memory.get_adapter_info(),
            self.local_worktree.get_adapter_info(),
            self.docker.get_adapter_info(),
        ]
    }

    pub fn get_mr_diff(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
    ) -> Result<MrDiffPayload, String> {
        self.get_active_adapter().get_diff(repo_path, base, compare)
    }

    pub fn check_conflicts(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
    ) -> Result<ConflictReport, String> {
        self.get_active_adapter()
            .check_conflicts(repo_path, base, compare)
    }

    pub fn get_conflict_preview(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
        file_path: &str,
    ) -> Result<ConflictFilePreview, String> {
        self.get_active_adapter()
            .get_conflict_preview(repo_path, base, compare, file_path)
    }

    pub fn create_instance(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
    ) -> Result<SandboxInstanceInfo, String> {
        let _creation_guard = self
            .creation_lock
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if self.instances_lock().len() >= MAX_ACTIVE_SANDBOX_INSTANCES {
            return Err(format!(
                "At most {} sandbox instances can be active at once",
                MAX_ACTIVE_SANDBOX_INSTANCES
            ));
        }
        let adapter = self.get_active_adapter();
        let instance = adapter.create_instance(repo_path, base, compare)?;

        let mut map = self.instances_lock();
        map.insert(instance.id.clone(), instance.clone());

        Ok(instance)
    }

    pub fn destroy_instance(&self, instance_id: &str) -> Result<(), String> {
        let instance = {
            let map = self.instances_lock();
            map.get(instance_id).cloned()
        };

        if let Some(inst) = instance {
            let adapter = self.get_adapter(&inst.adapter_type);
            adapter.destroy_instance(&inst)?;
            self.instances_lock().remove(instance_id);
        }
        Ok(())
    }

    pub fn list_active_instances(&self) -> Vec<SandboxInstanceInfo> {
        let map = self.instances_lock();
        map.values().cloned().collect()
    }

    pub fn execute_command(
        &self,
        instance_id: &str,
        command: &str,
        args: &[String],
    ) -> Result<SandboxExecutionResult, String> {
        let instance = {
            let map = self.instances_lock();
            map.get(instance_id)
                .cloned()
                .ok_or_else(|| format!("Sandbox instance not found: {}", instance_id))?
        };

        let adapter = self.get_adapter(&instance.adapter_type);
        let timeout_secs = self
            .guardrails
            .get_policy()
            .max_execution_timeout_secs
            .clamp(1, 120);
        adapter.execute_command(&instance, command, args, Duration::from_secs(timeout_secs))
    }

    pub fn get_instance(&self, instance_id: &str) -> Option<SandboxInstanceInfo> {
        let map = self.instances_lock();
        map.get(instance_id).cloned()
    }

    pub fn sync_instance(&self, instance_id: &str, repo_path: &str) -> Result<(), String> {
        let instance = self
            .get_instance(instance_id)
            .ok_or_else(|| format!("Sandbox instance not found: {}", instance_id))?;
        super::sync::sync_changes_to_sandbox(&instance, repo_path)
    }

    pub fn dispatch_tool(
        &self,
        instance_id: &str,
        tool_name: &str,
        arguments: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let instance = self
            .get_instance(instance_id)
            .ok_or_else(|| format!("Sandbox instance not found: {}", instance_id))?;
        super::tool_bridge::dispatch_tool_call(self, &instance, tool_name, arguments)
    }

    pub fn guardrails(&self) -> &Arc<super::guardrails::GuardrailsEngine> {
        &self.guardrails
    }

    pub fn get_guardrail_policy(&self) -> super::guardrails::GuardrailPolicy {
        self.guardrails.get_policy()
    }

    pub fn update_guardrail_policy(&self, policy: super::guardrails::GuardrailPolicy) {
        self.guardrails.update_policy(policy);
    }

    pub fn reset_guardrail_policy(&self, mode: super::guardrails::GuardrailMode) {
        self.guardrails.reset_policy(mode);
    }

    pub fn get_guardrail_audit_log(
        &self,
        limit: Option<usize>,
    ) -> Vec<super::guardrails::GuardrailAuditEvent> {
        self.guardrails.get_audit_log(limit)
    }

    pub fn clear_guardrail_audit_log(&self) {
        self.guardrails.clear_audit_log();
    }

    pub fn simulate_guardrail_check(
        &self,
        tool_name: &str,
        arguments: serde_json::Value,
    ) -> super::guardrails::GuardrailEvaluationResult {
        self.guardrails.simulate_check(tool_name, arguments)
    }

    pub fn cleanup_all(&self) -> Vec<String> {
        let instances = self.instances_lock().values().cloned().collect::<Vec<_>>();
        let mut errors = Vec::new();
        let outcomes = std::thread::scope(|scope| {
            instances
                .iter()
                .map(|instance| {
                    let adapter = self.get_adapter(&instance.adapter_type);
                    scope.spawn(move || (instance.id.clone(), adapter.destroy_instance(instance)))
                })
                .collect::<Vec<_>>()
                .into_iter()
                .map(|task| task.join())
                .collect::<Vec<_>>()
        });
        for outcome in outcomes {
            match outcome {
                Ok((id, Ok(()))) => {
                    self.instances_lock().remove(&id);
                }
                Ok((id, Err(error))) => {
                    errors.push(format!("Sandbox {} cleanup failed: {}", id, error))
                }
                Err(_) => {
                    errors.push("A sandbox cleanup task panicked during shutdown".to_string())
                }
            }
        }
        if let Err(error) = self.local_worktree.remove_empty_base_dir() {
            errors.push(error);
        }
        errors
    }
}

impl Default for SandboxManager {
    fn default() -> Self {
        Self::new()
    }
}
