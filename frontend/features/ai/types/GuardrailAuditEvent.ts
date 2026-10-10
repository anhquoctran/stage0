import type { GuardrailViolation } from './GuardrailViolation';

export interface GuardrailAuditEvent {
  id: string;
  timestamp: number;
  tool_name: string;
  action_summary: string;
  allowed: boolean;
  risk_score: number;
  violations: GuardrailViolation[];
}
