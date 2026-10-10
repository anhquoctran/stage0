import type { GuardrailViolation } from './GuardrailViolation';

export interface GuardrailEvaluationResult {
  allowed: boolean;
  risk_score: number;
  violations: GuardrailViolation[];
  requires_confirmation: boolean;
}
