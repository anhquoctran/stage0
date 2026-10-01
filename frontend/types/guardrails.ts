export type GuardrailMode = 'strict' | 'balanced' | 'permissive';

export type GuardrailSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface GuardrailViolation {
  rule: string;
  severity: GuardrailSeverity;
  message: string;
}

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

export interface GuardrailAuditEvent {
  id: string;
  timestamp: number;
  tool_name: string;
  action_summary: string;
  allowed: boolean;
  risk_score: number;
  violations: GuardrailViolation[];
}

export interface GuardrailEvaluationResult {
  allowed: boolean;
  risk_score: number;
  violations: GuardrailViolation[];
  requires_confirmation: boolean;
}

export const DEFAULT_GUARDRAIL_POLICY: GuardrailPolicy = {
  mode: 'balanced',
  allowed_commands: [
    'cargo',
    'rustc',
    'npm',
    'npx',
    'pnpm',
    'yarn',
    'node',
    'pytest',
    'python',
    'python3',
    'go',
    'dotnet',
    'make',
    'git',
  ],
  blocked_commands: [
    'rm',
    'del',
    'rmdir',
    'format',
    'mkfs',
    'dd',
    'fdisk',
    'shutdown',
    'reboot',
    'kill',
    'killall',
    'taskkill',
    'curl',
    'wget',
    'powershell',
    'cmd',
  ],
  blocked_patterns: [
    '| sh',
    '| bash',
    '|sh',
    '|bash',
    '> /dev/',
    '>/dev/',
    'sudo ',
    'chmod 777',
    ':(){ :|:& };:',
    '--force',
    '-f',
    'clean -xdf',
    'clean -fdx',
  ],
  sensitive_path_patterns: [
    '.env',
    '.env.',
    '.git/config',
    '.git/credentials',
    'id_rsa',
    'id_ed25519',
    '.pem',
    '.key',
    '.pkcs12',
    '.pfx',
    'token',
    'secret',
    'credentials.json',
    'service-account',
  ],
  max_execution_timeout_secs: 45,
  max_file_read_lines: 2500,
  max_output_bytes: 65536,
  rate_limit_per_minute: 60,
  require_human_confirmation_for_commands: false,
  require_human_confirmation_for_writes: true,
};
