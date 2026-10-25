import type { GuardrailAuditEvent } from '../../types/GuardrailAuditEvent';
import type { GuardrailEvaluationResult } from '../../types/GuardrailEvaluationResult';
import type { GuardrailMode } from '../../types/GuardrailMode';
import type { GuardrailPolicy } from '../../types/GuardrailPolicy';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface GuardrailService {
  clearGuardrailAuditLog(): Promise<unknown>;
  getGuardrailAuditLog(input: {
    limit: number;
  }): Promise<GuardrailAuditEvent[]>;
  getGuardrailPolicy(): Promise<GuardrailPolicy>;
  resetGuardrailPolicy(input: {
    mode: GuardrailMode;
  }): Promise<GuardrailPolicy>;
  simulateGuardrailCheck(input: {
    toolName: string;
    arguments: Record<string, unknown>;
  }): Promise<GuardrailEvaluationResult>;
  updateGuardrailPolicy(input: {
    policy: GuardrailPolicy;
  }): Promise<unknown>;
}
