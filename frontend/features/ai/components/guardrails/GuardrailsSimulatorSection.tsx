import React from 'react';
import { AlertCircle } from '../../../../common/components/icons/AlertCircle';
import { CheckCircle2 } from '../../../../common/components/icons/CheckCircle2';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import { SIMULATOR_TOOL_OPTIONS } from '../../constants/guardrailConstants';
import type { GuardrailEvaluationResult } from '../../types/GuardrailEvaluationResult';

export const GuardrailsSimulatorSection: React.FC<{
  simTool: 'execute_terminal_cmd' | 'read_file_range' | 'get_diff';
  setSimTool: (t: 'execute_terminal_cmd' | 'read_file_range' | 'get_diff') => void;
  simArgsText: string;
  setSimArgsText: (t: string) => void;
  simResult: GuardrailEvaluationResult | null;
  isSimulating: boolean;
  simError: string | null;
  isPendingCommit: boolean;
  onRunSimulation: () => void;
  onSetScenario: (s: 'safe_test' | 'dangerous_rm' | 'sensitive_env' | 'pipe_injection' | 'large_read') => void;
}> = ({
  simTool,
  setSimTool,
  simArgsText,
  setSimArgsText,
  simResult,
  isSimulating,
  simError,
  isPendingCommit,
  onRunSimulation,
  onSetScenario,
}) => {
  return (
    <div className="p-4 bg-surface0/60 border border-surface1 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-text">Live Policy Simulator & Dry-Run</h4>
        </div>
        <span className="text-[10px] text-subtext0">Test tool arguments against current guardrails</span>
      </div>

      {/* Quick Test Scenarios */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSetScenario('safe_test')}
          className="px-2.5 py-1 text-[11px] bg-green/10 hover:bg-green/20 text-green border border-green/30 cursor-pointer transition font-mono font-medium"
        >
          Safe: `cargo test`
        </button>
        <button
          type="button"
          onClick={() => onSetScenario('dangerous_rm')}
          className="px-2.5 py-1 text-[11px] bg-red/10 hover:bg-red/20 text-red border border-red/30 cursor-pointer transition font-mono font-medium"
        >
          Dangerous: `rm -rf /`
        </button>
        <button
          type="button"
          onClick={() => onSetScenario('sensitive_env')}
          className="px-2.5 py-1 text-[11px] bg-mauve/10 hover:bg-mauve/20 text-mauve border border-mauve/30 cursor-pointer transition font-mono font-medium"
        >
          Sensitive: `.env.production`
        </button>
        <button
          type="button"
          onClick={() => onSetScenario('pipe_injection')}
          className="px-2.5 py-1 text-[11px] bg-yellow/10 hover:bg-yellow/20 text-yellow border border-yellow/30 cursor-pointer transition font-mono font-medium"
        >
          Injection: `npm test | sh`
        </button>
        <button
          type="button"
          onClick={() => onSetScenario('large_read')}
          className="px-2.5 py-1 text-[11px] bg-surface0 hover:bg-surface1 text-text border border-surface1 cursor-pointer transition font-mono font-medium"
        >
          Exceeded: 8,000 Lines
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-subtext0 font-medium">Tool:</label>
            <CustomSelect
              value={simTool}
              options={SIMULATOR_TOOL_OPTIONS}
              onChange={setSimTool}
              buttonClassName="font-mono"
              dropdownWidth="w-64"
              align="left"
              aria-label="Simulator tool"
            />
          </div>

          <textarea
            rows={4}
            value={simArgsText}
            onChange={(e) => setSimArgsText(e.target.value)}
            placeholder="Tool arguments JSON"
            className="w-full p-2.5 bg-base border border-surface1 font-mono text-xs text-text focus:outline-none focus:border-surface2"
          />

          {simError && (
            <p className="text-[11px] text-red font-mono">{simError}</p>
          )}

          <button
            type="button"
            onClick={onRunSimulation}
            disabled={isSimulating || isPendingCommit}
            title={isPendingCommit ? 'Apply or OK to save policy changes before testing the active policy' : 'Tests the committed policy; audit actions take effect immediately'}
            className="px-3.5 py-1.5 text-xs font-semibold bg-green/15 hover:bg-green/25 text-green border border-green/30 cursor-pointer transition shadow-sm"
          >
            <span>{isSimulating ? 'Evaluating...' : 'Simulate Policy Check'}</span>
          </button>
        </div>

        {/* Verdict Card */}
        <div className="p-3 bg-base border border-surface1 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-subtext0 uppercase tracking-wider mb-2">
              Simulation Verdict
            </div>

            {simResult ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {simResult.allowed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold bg-green/10 text-green border border-green/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ALLOWED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold bg-red/10 text-red border border-red/30">
                        <AlertCircle className="w-3.5 h-3.5" />
                        BLOCKED
                      </span>
                    )}

                    {simResult.requires_confirmation && (
                      <span className="px-2 py-0.5 text-[10px] bg-yellow/10 text-yellow border border-yellow/30 font-semibold">
                        CONFIRMATION REQUIRED
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-mono">
                    Risk Score: <span className={simResult.risk_score > 50 ? 'text-red font-bold' : 'text-green'}>{simResult.risk_score}/100</span>
                  </div>
                </div>

                {simResult.violations.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-text">Triggered Rules:</div>
                    {simResult.violations.map((v, i) => (
                      <div
                        key={i}
                        className="p-2 text-[11px] bg-surface0 border border-surface1 space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-red">{v.rule}</span>
                          <span className="text-[10px] uppercase font-mono text-subtext0">{v.severity}</span>
                        </div>
                        <div className="text-subtext0">{v.message}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-green/90 font-mono">
                    ✓ No policy violations detected. Execution safe within sandbox.
                  </p>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-subtext0/60 italic py-6">
                Select a scenario above or enter arguments to simulate verdict
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

