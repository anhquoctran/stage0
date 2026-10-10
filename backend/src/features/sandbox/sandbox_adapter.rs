use super::{
    SandboxAdapterInfo, SandboxCapabilities, SandboxExecutionResult, SandboxInstanceInfo,
    SandboxType,
};
use crate::features::git::{ConflictFilePreview, ConflictReport, MrDiffPayload};
use std::time::Duration;

pub trait SandboxAdapter: Send + Sync {
    fn adapter_type(&self) -> SandboxType;
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn capabilities(&self) -> SandboxCapabilities;
    fn get_adapter_info(&self) -> SandboxAdapterInfo;

    fn get_diff(&self, repo_path: &str, base: &str, compare: &str)
        -> Result<MrDiffPayload, String>;

    fn check_conflicts(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
    ) -> Result<ConflictReport, String>;

    fn get_conflict_preview(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
        file_path: &str,
    ) -> Result<ConflictFilePreview, String>;

    fn create_instance(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
    ) -> Result<SandboxInstanceInfo, String>;

    fn destroy_instance(&self, instance: &SandboxInstanceInfo) -> Result<(), String>;

    fn execute_command(
        &self,
        instance: &SandboxInstanceInfo,
        command: &str,
        args: &[String],
        timeout: Duration,
    ) -> Result<SandboxExecutionResult, String>;
}
