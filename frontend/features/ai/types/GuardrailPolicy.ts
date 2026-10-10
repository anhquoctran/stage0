import type { GuardrailMode } from './GuardrailMode';

export interface GuardrailPolicy {
  mode: GuardrailMode;
  allowed_commands: string[];
  blocked_commands: string[];
  blocked_patterns: string[];
  sensitive_path_patterns: string[];
  max_execution_timeout_secs: number;
  max_file_read_lines: number;
  max_output_bytes: number;
  rate_limit_per_minute: number;
  require_human_confirmation_for_commands: boolean;
  require_human_confirmation_for_writes: boolean;
}
