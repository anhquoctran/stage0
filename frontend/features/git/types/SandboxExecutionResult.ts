export interface SandboxExecutionResult {
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
  output_truncated: boolean;
}
