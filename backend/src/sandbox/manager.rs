use std::collections::HashMap;
use std::sync::{Arc, Mutex};

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
}

impl SandboxManager {
    pub fn new() -> Self {
        Self {
            in_memory: Arc::new(InMemorySandboxAdapter::new()),
            local_worktree: Arc::new(LocalWorktreeSandboxAdapter::new()),
            docker: Arc::new(DockerSandboxAdapter::new()),
            active_type: Mutex::new(SandboxType::InMemory),
            instances: Mutex::new(HashMap::new()),
        }
    }

    #[inline]
    fn active_type_lock(&self) -> std::sync::MutexGuard<'_, SandboxType> {
        self.active_type.lock().unwrap_or_else(|p| p.into_inner())
    }

    #[inline]
    fn instances_lock(&self) -> std::sync::MutexGuard<'_, std::collections::HashMap<String, SandboxInstanceInfo>> {
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
        self.get_active_adapter().check_conflicts(repo_path, base, compare)
    }

    pub fn get_conflict_preview(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
        file_path: &str,
    ) -> Result<ConflictFilePreview, String> {
        self.get_active_adapter().get_conflict_preview(repo_path, base, compare, file_path)
    }

    pub fn create_instance(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
    ) -> Result<SandboxInstanceInfo, String> {
        let adapter = self.get_active_adapter();
        let instance = adapter.create_instance(repo_path, base, compare)?;

        let mut map = self.instances_lock();
        map.insert(instance.id.clone(), instance.clone());

        Ok(instance)
    }

    pub fn destroy_instance(&self, instance_id: &str) -> Result<(), String> {
        let instance = {
            let mut map = self.instances_lock();
            map.remove(instance_id)
        };

        if let Some(inst) = instance {
            let adapter = self.get_adapter(&inst.adapter_type);
            adapter.destroy_instance(&inst)?;
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
        adapter.execute_command(&instance, command, args)
    }

    pub fn cleanup_all(&self) {
        let mut map = self.instances_lock();
        for (_, instance) in map.drain() {
            let adapter = self.get_adapter(&instance.adapter_type);
            let _ = adapter.destroy_instance(&instance);
        }
    }
}

impl Default for SandboxManager {
    fn default() -> Self {
        Self::new()
    }
}
