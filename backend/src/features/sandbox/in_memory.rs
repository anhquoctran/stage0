use super::{
    SandboxAdapter, SandboxAdapterInfo, SandboxCapabilities, SandboxExecutionResult,
    SandboxInstanceInfo, SandboxType,
};
use crate::features::git::{
    conflict::{check_conflicts, get_conflicted_file_preview},
    diff::get_mr_diff,
    ConflictFilePreview, ConflictReport, MrDiffPayload,
};

pub struct InMemorySandboxAdapter;

impl InMemorySandboxAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl Default for InMemorySandboxAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl SandboxAdapter for InMemorySandboxAdapter {
    fn adapter_type(&self) -> SandboxType {
        SandboxType::InMemory
    }

    fn name(&self) -> &str {
        "In-Memory Virtual Sandbox (Default)"
    }

    fn description(&self) -> &str {
        "Evaluates diffs and merge conflicts without checking out branches or changing the working tree or index. Git may write result objects to the repository object database; terminal commands are disabled."
    }

    fn capabilities(&self) -> SandboxCapabilities {
        SandboxCapabilities {
            can_run_commands: false,
            can_write_files: false,
            isolation_level: "in_memory".to_string(),
            requires_daemon: false,
            supports_networking: false,
        }
    }

    fn get_adapter_info(&self) -> SandboxAdapterInfo {
        SandboxAdapterInfo {
            adapter_type: self.adapter_type(),
            name: self.name().to_string(),
            description: self.description().to_string(),
            is_available: true,
            version_info: Some("Git In-Memory Tree Engine (Native)".to_string()),
            status_message: "Active & Ready (Default Sandbox)".to_string(),
            capabilities: self.capabilities(),
        }
    }

    fn get_diff(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
    ) -> Result<MrDiffPayload, String> {
        get_mr_diff(repo_path, base, compare)
    }

    fn check_conflicts(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
    ) -> Result<ConflictReport, String> {
        check_conflicts(repo_path, base, compare)
    }

    fn get_conflict_preview(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
        file_path: &str,
    ) -> Result<ConflictFilePreview, String> {
        get_conflicted_file_preview(repo_path, base, compare, file_path)
    }

    fn create_instance(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
    ) -> Result<SandboxInstanceInfo, String> {
        let instance_id = format!("mem-{}", uuid::Uuid::new_v4());
        Ok(SandboxInstanceInfo {
            id: instance_id,
            adapter_type: SandboxType::InMemory,
            repo_path: repo_path.to_string(),
            base_branch: base.to_string(),
            compare_branch: compare.to_string(),
            worktree_path: None,
            container_id: None,
            created_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    fn destroy_instance(&self, _instance: &SandboxInstanceInfo) -> Result<(), String> {
        // In-memory instances require no physical cleanup
        Ok(())
    }

    fn execute_command(
        &self,
        _instance: &SandboxInstanceInfo,
        _command: &str,
        _args: &[String],
        _timeout: std::time::Duration,
    ) -> Result<SandboxExecutionResult, String> {
        Err(
            "The In-Memory sandbox does not execute system commands. Git may still write tree or blob objects while evaluating conflicts. Switch to Local Worktree or Docker to run commands."
                .to_string(),
        )
    }
}
