export interface RepoSettingsRecord {
  repo_id: string;
  default_base_branch: string;
  inherit_global_agents: boolean;
  custom_agent_rules: string | null;
}
