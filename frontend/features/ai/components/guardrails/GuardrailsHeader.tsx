import React from 'react';
import { RefreshCw } from '../../../../common/components/icons/RefreshCw';
import { Check } from '../../../../common/components/icons/Check';
import type { GuardrailMode } from '../../types/GuardrailMode';

export const GuardrailsHeader: React.FC<{
  activeMode: GuardrailMode;
  isDraft: boolean;
  isGuardrailLoading: boolean;
  onRefreshAuditLog: () => void;
  onSelectPreset: (mode: GuardrailMode) => void;
}> = ({
  activeMode,
  isDraft,
  isGuardrailLoading,
  onRefreshAuditLog,
  onSelectPreset,
}) => {
  return (
    <div className="p-4 bg-surface0/60 border border-surface1 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div>
            <h4 className="text-sm font-bold text-text">AI Security Guardrails & Policy Enforcement</h4>
            <span
              className={`inline-block mt-1 text-[10px] font-mono px-2 py-0.5 font-semibold border uppercase ${
                activeMode === 'balanced'
                  ? 'bg-green/10 text-green border-green/30'
                  : activeMode === 'strict'
                  ? 'bg-red/10 text-red border-red/30'
                  : 'bg-yellow/10 text-yellow border-yellow/30'
              }`}
            >
              {isDraft ? 'Draft' : 'Active'}: {activeMode.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-subtext0 mt-1">
            Active defense boundary for integrated AI models and tool executions.
            Protects host filesystem, isolates command execution, and prevents credential leakage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefreshAuditLog}
            disabled={isGuardrailLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-surface1 border border-surface2 text-text hover:bg-surface2 transition cursor-pointer"
            title="Refresh audit log"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGuardrailLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Preset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
        {/* Strict */}
        <button
          type="button"
          onClick={() => onSelectPreset('strict')}
          className={`p-3 text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeMode === 'strict'
              ? 'bg-red/10 border border-red/40 text-text shadow-sm'
              : 'bg-surface0 border border-surface1 hover:border-surface2 text-text'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text">
                Strict (Zero Trust)
              </span>
              {activeMode === 'strict' && (
                <Check className="w-3.5 h-3.5 text-red" />
              )}
            </div>
            <p className="text-[11px] mt-1.5 leading-relaxed text-subtext0">
              Requires human approval for all terminal operations. Strictly limits file reads to 1,000 lines. Max timeout 15s.
            </p>
          </div>
          <div className="mt-3 text-[10px] font-mono text-subtext0">
            High-security repositories
          </div>
        </button>

        {/* Balanced */}
        <button
          type="button"
          onClick={() => onSelectPreset('balanced')}
          className={`p-3 text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeMode === 'balanced'
              ? 'bg-green/10 border border-green/40 text-text shadow-sm'
              : 'bg-surface0 border border-surface1 hover:border-surface2 text-text'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text">
                Balanced (Standard)
              </span>
              {activeMode === 'balanced' && (
                <Check className="w-3.5 h-3.5 text-green" />
              )}
            </div>
            <p className="text-[11px] mt-1.5 leading-relaxed text-subtext0">
              Auto-executes safe toolchains (cargo, npm, pytest). Blocks destructive commands and credential leakage.
            </p>
          </div>
          <div className="mt-3 text-[10px] font-mono text-subtext0">
            Recommended for development
          </div>
        </button>

        {/* Permissive */}
        <button
          type="button"
          onClick={() => onSelectPreset('permissive')}
          className={`p-3 text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeMode === 'permissive'
              ? 'bg-yellow/10 border border-yellow/40 text-text shadow-sm'
              : 'bg-surface0 border border-surface1 hover:border-surface2 text-text'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text">
                Autonomous (Sandbox)
              </span>
              {activeMode === 'permissive' && (
                <Check className="w-3.5 h-3.5 text-yellow" />
              )}
            </div>
            <p className="text-[11px] mt-1.5 leading-relaxed text-subtext0">
              Permits broader shell toolchain in Docker/Worktree containers with basic boundary and credential shields.
            </p>
          </div>
          <div className="mt-3 text-[10px] font-mono text-subtext0">
            Automated CI/CD agents
          </div>
        </button>
      </div>
    </div>
  );
};

