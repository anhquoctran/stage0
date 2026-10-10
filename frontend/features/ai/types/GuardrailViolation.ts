import type { GuardrailSeverity } from './GuardrailSeverity';

export interface GuardrailViolation {
  rule: string;
  severity: GuardrailSeverity;
  message: string;
}
