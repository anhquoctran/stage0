import React from 'react';
import { Trash2 } from '../../../../common/components/icons/Trash2';
import { formatTime } from '@/common/utils/dateTime';
import type { GuardrailAuditEvent } from '../../types/GuardrailAuditEvent';

export const GuardrailsAuditLogSection: React.FC<{
  auditLogs: GuardrailAuditEvent[];
  onClearAuditLog: () => void;
}> = ({ auditLogs, onClearAuditLog }) => {
  return (
    <div className="p-4 bg-surface0/60 border border-surface1 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-bold text-text">Guardrails Audit Trail (Recent Activity)</h4>
          <span className="text-[10px] font-mono text-subtext0">({auditLogs.length} events)</span>
        </div>

        {auditLogs.length > 0 && (
          <button
            type="button"
            onClick={onClearAuditLog}
            className="text-xs text-subtext0 hover:text-red flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear Log</span>
          </button>
        )}
      </div>

      {auditLogs.length === 0 ? (
        <div className="py-6 text-center text-xs text-subtext0/60 italic">
          No tool execution attempts recorded yet.
        </div>
      ) : (
        <div className="border border-surface1 overflow-hidden">
          <div className="max-h-60 overflow-y-auto divide-y divide-surface1">
            {auditLogs.map((event) => (
              <div key={event.id} className="p-2.5 hover:bg-surface1/30 transition flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-start md:items-center gap-2.5">
                  {event.allowed ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green/10 text-green border border-green/30 font-mono">
                      PASS
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red/10 text-red border border-red/30 font-mono">
                      BLOCK
                    </span>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-text">{event.tool_name}</span>
                      <span className="text-[10px] text-subtext0 font-mono truncate max-w-xs">{event.action_summary}</span>
                    </div>
                    {event.violations.length > 0 && (
                      <div className="text-[11px] text-red font-mono mt-0.5">
                        {event.violations.map((v) => `${v.rule}: ${v.message}`).join(' | ')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <span className="text-[10px] font-mono text-subtext0">
                    Risk: <span className={event.risk_score > 50 ? 'text-red font-bold' : 'text-green'}>{event.risk_score}</span>
                  </span>
                  <span className="text-[10px] font-mono text-subtext0">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

