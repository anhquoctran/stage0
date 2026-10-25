import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { GuardrailService } from './GuardrailService';

export function createGuardrailService(transport: CommandTransport): GuardrailService {
  return {
    clearGuardrailAuditLog: () => transport.executeCommand('clear_guardrail_audit_log'),
    getGuardrailAuditLog: (input) => transport.executeCommand('get_guardrail_audit_log', input),
    getGuardrailPolicy: () => transport.executeCommand('get_guardrail_policy'),
    resetGuardrailPolicy: (input) => transport.executeCommand('reset_guardrail_policy', input),
    simulateGuardrailCheck: (input) => transport.executeCommand('simulate_guardrail_check', input),
    updateGuardrailPolicy: (input) => transport.executeCommand('update_guardrail_policy', input),
  };
}
