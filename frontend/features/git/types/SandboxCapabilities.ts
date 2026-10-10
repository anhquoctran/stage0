export interface SandboxCapabilities {
  can_run_commands: boolean;
  can_write_files: boolean;
  isolation_level: string;
  requires_daemon: boolean;
  supports_networking: boolean;
}
