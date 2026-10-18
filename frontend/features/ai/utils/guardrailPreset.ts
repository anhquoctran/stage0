import type { GuardrailMode } from '../types/GuardrailMode';
import type { GuardrailPolicy } from '../types/GuardrailPolicy';
import { DEFAULT_GUARDRAIL_POLICY } from '../types/guardrails';

// Pure draft defaults, matching the native GuardrailPolicy presets; never applies a policy.
export function guardrailPreset(mode: GuardrailMode): GuardrailPolicy {
  const policy = structuredClone(DEFAULT_GUARDRAIL_POLICY);
  if (mode === 'strict') return { ...policy, mode,
    allowed_commands: ['cargo check', 'cargo test', 'cargo clippy', 'npm test', 'npm run lint', 'pnpm test', 'yarn test', 'pytest', 'go test'],
    max_execution_timeout_secs: 15, max_file_read_lines: 1000, max_output_bytes: 32768, rate_limit_per_minute: 30,
    require_human_confirmation_for_commands: true, require_human_confirmation_for_writes: true };
  if (mode === 'permissive') return { ...policy, mode, allowed_commands: [...policy.allowed_commands, 'bash', 'sh'],
    max_execution_timeout_secs: 120, max_file_read_lines: 5000, max_output_bytes: 131072, rate_limit_per_minute: 120,
    require_human_confirmation_for_commands: false, require_human_confirmation_for_writes: false };
  return policy;
}
