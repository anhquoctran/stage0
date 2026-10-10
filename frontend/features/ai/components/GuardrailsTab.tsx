import React, { useState, useEffect } from 'react';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { Check } from '../../../common/components/icons/Check';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { Trash2 } from '../../../common/components/icons/Trash2';
import { Plus } from '../../../common/components/icons/Plus';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { X } from '../../../common/components/icons/X';
import { formatTime } from '@/common/utils/dateTime';
import { useAiMcpStore } from '../store/useAiMcpStore';
import { type GuardrailMode } from '../types/GuardrailMode';
import { type GuardrailEvaluationResult } from '../types/GuardrailEvaluationResult';
import { DEFAULT_GUARDRAIL_POLICY } from '../types/guardrails';

export const GuardrailsTab: React.FC = () => {
  const {
    guardrailPolicy,
    guardrailAuditLog,
    isGuardrailLoading,
    updateGuardrailPolicy,
    resetGuardrailPolicy,
    loadGuardrailAuditLog,
    clearGuardrailAuditLog,
    simulateGuardrailCheck,
  } = useAiMcpStore();

  const policy = guardrailPolicy || DEFAULT_GUARDRAIL_POLICY;
  const allowedCommands = Array.isArray(policy.allowed_commands) ? policy.allowed_commands : DEFAULT_GUARDRAIL_POLICY.allowed_commands;
  const blockedCommands = Array.isArray(policy.blocked_commands) ? policy.blocked_commands : DEFAULT_GUARDRAIL_POLICY.blocked_commands;
  const blockedPatterns = Array.isArray(policy.blocked_patterns) ? policy.blocked_patterns : DEFAULT_GUARDRAIL_POLICY.blocked_patterns;
  const sensitivePatterns = Array.isArray(policy.sensitive_path_patterns) ? policy.sensitive_path_patterns : DEFAULT_GUARDRAIL_POLICY.sensitive_path_patterns;
  const auditLogs = Array.isArray(guardrailAuditLog) ? guardrailAuditLog : [];
  const activeMode = policy.mode || 'balanced';

  const [newAllowedCmd, setNewAllowedCmd] = useState('');
  const [newBlockedCmd, setNewBlockedCmd] = useState('');
  const [newSensitivePattern, setNewSensitivePattern] = useState('');
  const [newBlockedPattern, setNewBlockedPattern] = useState('');

  // Simulator State
  const [simTool, setSimTool] = useState<'execute_terminal_cmd' | 'read_file_range' | 'get_diff'>('execute_terminal_cmd');
  const [simArgsText, setSimArgsText] = useState('{\n  "command": "cargo",\n  "args": ["test"]\n}');
  const [simResult, setSimResult] = useState<GuardrailEvaluationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  useEffect(() => {
    void loadGuardrailAuditLog(30);
  }, [loadGuardrailAuditLog]);

  const handleAddAllowedCmd = () => {
    const val = newAllowedCmd.trim().toLowerCase();
    if (val && !allowedCommands.includes(val)) {
      void updateGuardrailPolicy({
        allowed_commands: [...allowedCommands, val],
      });
      setNewAllowedCmd('');
    }
  };

  const handleRemoveAllowedCmd = (cmd: string) => {
    void updateGuardrailPolicy({
      allowed_commands: allowedCommands.filter((c) => c !== cmd),
    });
  };

  const handleAddBlockedCmd = () => {
    const val = newBlockedCmd.trim().toLowerCase();
    if (val && !blockedCommands.includes(val)) {
      void updateGuardrailPolicy({
        blocked_commands: [...blockedCommands, val],
      });
      setNewBlockedCmd('');
    }
  };

  const handleRemoveBlockedCmd = (cmd: string) => {
    void updateGuardrailPolicy({
      blocked_commands: blockedCommands.filter((c) => c !== cmd),
    });
  };

  const handleAddSensitivePattern = () => {
    const val = newSensitivePattern.trim().toLowerCase();
    if (val && !sensitivePatterns.includes(val)) {
      void updateGuardrailPolicy({
        sensitive_path_patterns: [...sensitivePatterns, val],
      });
      setNewSensitivePattern('');
    }
  };

  const handleRemoveSensitivePattern = (pattern: string) => {
    void updateGuardrailPolicy({
      sensitive_path_patterns: sensitivePatterns.filter((p) => p !== pattern),
    });
  };

  const handleAddBlockedPattern = () => {
    const val = newBlockedPattern.trim().toLowerCase();
    if (val && !blockedPatterns.includes(val)) {
      void updateGuardrailPolicy({
        blocked_patterns: [...blockedPatterns, val],
      });
      setNewBlockedPattern('');
    }
  };

  const handleRemoveBlockedPattern = (pattern: string) => {
    void updateGuardrailPolicy({
      blocked_patterns: blockedPatterns.filter((p) => p !== pattern),
    });
  };

  const handlePresetSelect = (mode: GuardrailMode) => {
    void resetGuardrailPolicy(mode);
  };

  const runSimulation = async () => {
    setSimError(null);
    setIsSimulating(true);
    try {
      const parsedArgs = JSON.parse(simArgsText);
      const res = await simulateGuardrailCheck(simTool, parsedArgs);
      setSimResult(res);
      void loadGuardrailAuditLog(30);
    } catch (e: unknown) {
      setSimError(e instanceof Error ? e.message : 'Invalid JSON arguments');
    } finally {
      setIsSimulating(false);
    }
  };

  const setSampleScenario = (scenario: 'safe_test' | 'dangerous_rm' | 'sensitive_env' | 'pipe_injection' | 'large_read') => {
    switch (scenario) {
      case 'safe_test':
        setSimTool('execute_terminal_cmd');
        setSimArgsText(JSON.stringify({ command: 'cargo', args: ['test'] }, null, 2));
        break;
      case 'dangerous_rm':
        setSimTool('execute_terminal_cmd');
        setSimArgsText(JSON.stringify({ command: 'rm', args: ['-rf', '/workspace'] }, null, 2));
        break;
      case 'sensitive_env':
        setSimTool('read_file_range');
        setSimArgsText(JSON.stringify({ file_path: '.env.production', start_line: 1, end_line: 25 }, null, 2));
        break;
      case 'pipe_injection':
        setSimTool('execute_terminal_cmd');
        setSimArgsText(JSON.stringify({ command: 'npm', args: ['test', '| sh'] }, null, 2));
        break;
      case 'large_read':
        setSimTool('read_file_range');
        setSimArgsText(JSON.stringify({ file_path: 'src/main.rs', start_line: 1, end_line: 8000 }, null, 2));
        break;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Policy Presets Selector */}
      <div className="p-4 bg-surface0/60 border border-surface1 rounded-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div>
              <h4 className="text-sm font-bold text-text">AI Security Guardrails & Policy Enforcement</h4>
              <span
                className={`inline-block mt-1 text-[10px] font-mono px-2 py-0.5 font-semibold border rounded uppercase ${
                  activeMode === 'balanced'
                    ? 'bg-green/10 text-green border-green/30'
                    : activeMode === 'strict'
                    ? 'bg-red/10 text-red border-red/30'
                    : 'bg-yellow/10 text-yellow border-yellow/30'
                }`}
              >
                Active: {activeMode.toUpperCase()}
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
              onClick={() => void loadGuardrailAuditLog(30)}
              disabled={isGuardrailLoading}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-surface1 border border-surface2 text-text hover:bg-surface2 transition cursor-pointer rounded"
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
            onClick={() => handlePresetSelect('strict')}
            className={`p-3 text-left rounded-md transition-all cursor-pointer flex flex-col justify-between ${
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
            onClick={() => handlePresetSelect('balanced')}
            className={`p-3 text-left rounded-md transition-all cursor-pointer flex flex-col justify-between ${
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
            onClick={() => handlePresetSelect('permissive')}
            className={`p-3 text-left rounded-md transition-all cursor-pointer flex flex-col justify-between ${
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

      {/* 2. Command Safety Policies & Whitelists */}
      <div className="p-4 bg-surface0/60 border border-surface1 rounded-md space-y-4">
        <h4 className="text-xs font-bold text-text">
          Terminal Command Execution Guardrails
        </h4>

        {/* Whitelisted Toolchains */}
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-subtext0">
            Whitelisted Toolchain Executables
          </label>
          <div className="flex flex-wrap gap-1.5 p-2.5 bg-base border border-surface1 rounded-md min-h-[42px] items-center">
            {allowedCommands.map((cmd) => (
              <span
                key={cmd}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-green/10 text-green border border-green/30 rounded font-mono font-medium"
              >
                <span>{cmd}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAllowedCmd(cmd)}
                  className="opacity-70 hover:opacity-100 cursor-pointer"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. dotnet, make, go"
              value={newAllowedCmd}
              onChange={(e) => setNewAllowedCmd(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAllowedCmd())}
              className="flex-1 px-2.5 py-1 text-xs bg-base border border-surface1 rounded text-text font-mono focus:outline-none focus:border-surface2"
            />
            <button
              type="button"
              onClick={handleAddAllowedCmd}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-surface1 border border-surface2 text-text hover:bg-surface2 rounded cursor-pointer transition"
            >
              <Plus className="w-3 h-3" />
              <span>Add Command</span>
            </button>
          </div>
        </div>

        {/* Explicitly Blocked Commands */}
        <div className="space-y-2 pt-2 border-t border-surface1">
          <label className="text-[11px] font-medium text-red">
            Explicitly Blocked Destructive Commands (Hard Deny)
          </label>
          <div className="flex flex-wrap gap-1.5 p-2.5 bg-base border border-surface1 rounded-md min-h-[42px] items-center">
            {blockedCommands.map((cmd) => (
              <span
                key={cmd}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-red/10 text-red border border-red/30 rounded font-mono font-medium"
              >
                <span>{cmd}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveBlockedCmd(cmd)}
                  className="opacity-70 hover:opacity-100 cursor-pointer"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. format, fdisk"
              value={newBlockedCmd}
              onChange={(e) => setNewBlockedCmd(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBlockedCmd())}
              className="flex-1 px-2.5 py-1 text-xs bg-base border border-surface1 rounded text-text font-mono focus:outline-none focus:border-surface2"
            />
            <button
              type="button"
              onClick={handleAddBlockedCmd}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-surface1 border border-surface2 text-text hover:bg-surface2 rounded cursor-pointer transition"
            >
              <Plus className="w-3 h-3" />
              <span>Add Blocked</span>
            </button>
          </div>
        </div>

        {/* Blocked Dangerous Shell Patterns */}
        <div className="space-y-2 pt-2 border-t border-surface1">
          <label className="text-[11px] font-medium text-yellow">
            Blocked Shell Injection & Malicious Patterns
          </label>
          <div className="flex flex-wrap gap-1.5 p-2.5 bg-base border border-surface1 rounded-md min-h-[42px] items-center">
            {blockedPatterns.map((pat) => (
              <span
                key={pat}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-yellow/10 text-yellow border border-yellow/30 rounded font-mono font-medium"
              >
                <span>{pat}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveBlockedPattern(pat)}
                  className="opacity-70 hover:opacity-100 cursor-pointer"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. | bash, >/dev/"
              value={newBlockedPattern}
              onChange={(e) => setNewBlockedPattern(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBlockedPattern())}
              className="flex-1 px-2.5 py-1 text-xs bg-base border border-surface1 rounded text-text font-mono focus:outline-none focus:border-surface2"
            />
            <button
              type="button"
              onClick={handleAddBlockedPattern}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-surface1 border border-surface2 text-text hover:bg-surface2 rounded cursor-pointer transition"
            >
              <Plus className="w-3 h-3" />
              <span>Add Pattern</span>
            </button>
          </div>
        </div>

        {/* Numerical Execution Limits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-surface1">
          <div>
            <label className="text-[11px] font-medium text-subtext0 block">
              Max Execution Timeout: <span className="text-text font-mono font-bold">{policy.max_execution_timeout_secs || 45}s</span>
            </label>
            <input
              type="range"
              min={10}
              max={120}
              step={5}
              value={policy.max_execution_timeout_secs || 45}
              onChange={(e) => void updateGuardrailPolicy({ max_execution_timeout_secs: Number(e.target.value) })}
              className="w-full mt-2 cursor-pointer"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-subtext0 block">
              Max Output Truncation: <span className="text-text font-mono font-bold">{Math.round((policy.max_output_bytes || 65536) / 1024)} KB</span>
            </label>
            <input
              type="range"
              min={16384}
              max={262144}
              step={16384}
              value={policy.max_output_bytes || 65536}
              onChange={(e) => void updateGuardrailPolicy({ max_output_bytes: Number(e.target.value) })}
              className="w-full mt-2 cursor-pointer"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-subtext0 block">
              Rate Limit: <span className="text-text font-mono font-bold">{policy.rate_limit_per_minute || 60} calls/min</span>
            </label>
            <input
              type="range"
              min={10}
              max={120}
              step={5}
              value={policy.rate_limit_per_minute || 60}
              onChange={(e) => void updateGuardrailPolicy({ rate_limit_per_minute: Number(e.target.value) })}
              className="w-full mt-2 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 3. Sensitive Data & File Reading Protection */}
      <div className="p-4 bg-surface0/60 border border-surface1 rounded-md space-y-4">
        <h4 className="text-xs font-bold text-text">
          Workspace & Sensitive File Shield
        </h4>

        <div className="space-y-2">
          <label className="text-[11px] font-medium text-subtext0">
            Protected Sensitive File Patterns (Access Blocked)
          </label>
          <div className="flex flex-wrap gap-1.5 p-2.5 bg-base border border-surface1 rounded-md min-h-[42px] items-center">
            {sensitivePatterns.map((pat) => (
              <span
                key={pat}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-mauve/10 text-mauve border border-mauve/30 rounded font-mono font-medium"
              >
                <span>{pat}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSensitivePattern(pat)}
                  className="opacity-70 hover:opacity-100 cursor-pointer"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. *.key, secrets.yaml"
              value={newSensitivePattern}
              onChange={(e) => setNewSensitivePattern(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSensitivePattern())}
              className="flex-1 px-2.5 py-1 text-xs bg-base border border-surface1 rounded text-text font-mono focus:outline-none focus:border-surface2"
            />
            <button
              type="button"
              onClick={handleAddSensitivePattern}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-surface1 border border-surface2 text-text hover:bg-surface2 rounded cursor-pointer transition"
            >
              <Plus className="w-3 h-3" />
              <span>Add Sensitive Pattern</span>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-surface1 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <label className="text-[11px] font-medium text-subtext0 block">
              Max File Read Line Range: <span className="text-text font-mono font-bold">{policy.max_file_read_lines || 2500} lines</span>
            </label>
            <input
              type="range"
              min={500}
              max={5000}
              step={250}
              value={policy.max_file_read_lines || 2500}
              onChange={(e) => void updateGuardrailPolicy({ max_file_read_lines: Number(e.target.value) })}
              className="w-full mt-2 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="confirm-commands-chk"
              checked={!!policy.require_human_confirmation_for_commands}
              onChange={(e) => void updateGuardrailPolicy({ require_human_confirmation_for_commands: e.target.checked })}
              className="rounded border-surface2 text-green focus:ring-0 cursor-pointer"
            />
            <label htmlFor="confirm-commands-chk" className="text-xs text-text cursor-pointer select-none">
              Require confirmation for all terminal commands
            </label>
          </div>
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="confirm-writes-chk"
              checked={!!policy.require_human_confirmation_for_writes}
              onChange={(e) => void updateGuardrailPolicy({ require_human_confirmation_for_writes: e.target.checked })}
              className="mt-0.5 rounded border-surface2 text-green focus:ring-0 cursor-pointer"
            />
            <div>
              <label htmlFor="confirm-writes-chk" className="text-xs text-text cursor-pointer select-none">
                Require confirmation for terminal tools that may write files
              </label>
              <p className="mt-1 text-[10px] text-subtext0">
                No approval dialog is available yet, so commands requiring confirmation are blocked rather than paused.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Live Policy Simulator */}
      <div className="p-4 bg-surface0/60 border border-surface1 rounded-md space-y-4">
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
            onClick={() => setSampleScenario('safe_test')}
            className="px-2.5 py-1 text-[11px] bg-green/10 hover:bg-green/20 text-green border border-green/30 rounded cursor-pointer transition font-mono font-medium"
          >
            Safe: `cargo test`
          </button>
          <button
            type="button"
            onClick={() => setSampleScenario('dangerous_rm')}
            className="px-2.5 py-1 text-[11px] bg-red/10 hover:bg-red/20 text-red border border-red/30 rounded cursor-pointer transition font-mono font-medium"
          >
            Dangerous: `rm -rf /`
          </button>
          <button
            type="button"
            onClick={() => setSampleScenario('sensitive_env')}
            className="px-2.5 py-1 text-[11px] bg-mauve/10 hover:bg-mauve/20 text-mauve border border-mauve/30 rounded cursor-pointer transition font-mono font-medium"
          >
            Sensitive: `.env.production`
          </button>
          <button
            type="button"
            onClick={() => setSampleScenario('pipe_injection')}
            className="px-2.5 py-1 text-[11px] bg-yellow/10 hover:bg-yellow/20 text-yellow border border-yellow/30 rounded cursor-pointer transition font-mono font-medium"
          >
            Injection: `npm test | sh`
          </button>
          <button
            type="button"
            onClick={() => setSampleScenario('large_read')}
            className="px-2.5 py-1 text-[11px] bg-surface0 hover:bg-surface1 text-text border border-surface1 rounded cursor-pointer transition font-mono font-medium"
          >
            Exceeded: 8,000 Lines
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-subtext0 font-medium">Tool:</label>
              <select
                value={simTool}
                onChange={(e) => setSimTool(e.target.value as any)}
                className="px-2 py-0.5 text-xs bg-base border border-surface1 rounded text-text font-mono focus:outline-none"
              >
                <option value="execute_terminal_cmd">execute_terminal_cmd</option>
                <option value="read_file_range">read_file_range</option>
                <option value="get_diff">get_diff</option>
              </select>
            </div>

            <textarea
              rows={4}
              value={simArgsText}
              onChange={(e) => setSimArgsText(e.target.value)}
              placeholder="Tool arguments JSON"
              className="w-full p-2.5 bg-base border border-surface1 rounded font-mono text-xs text-text focus:outline-none focus:border-surface2"
            />

            {simError && (
              <p className="text-[11px] text-red font-mono">{simError}</p>
            )}

            <button
              type="button"
              onClick={runSimulation}
              disabled={isSimulating}
              className="px-3.5 py-1.5 text-xs font-semibold bg-green/15 hover:bg-green/25 text-green border border-green/30 rounded cursor-pointer transition shadow-sm"
            >
              <span>{isSimulating ? 'Evaluating...' : 'Simulate Policy Check'}</span>
            </button>
          </div>

          {/* Verdict Card */}
          <div className="p-3 bg-base border border-surface1 rounded flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold text-subtext0 uppercase tracking-wider mb-2">
                Simulation Verdict
              </div>

              {simResult ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {simResult.allowed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold bg-green/10 text-green border border-green/30 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          ALLOWED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold bg-red/10 text-red border border-red/30 rounded">
                          <AlertCircle className="w-3.5 h-3.5" />
                          BLOCKED
                        </span>
                      )}

                      {simResult.requires_confirmation && (
                        <span className="px-2 py-0.5 text-[10px] bg-yellow/10 text-yellow border border-yellow/30 rounded font-semibold">
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
                          className="p-2 text-[11px] bg-surface0 border border-surface1 rounded space-y-0.5"
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

      {/* 5. Real-Time Audit Log Trail */}
      <div className="p-4 bg-surface0/60 border border-surface1 rounded-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-text">Guardrails Audit Trail (Recent Activity)</h4>
            <span className="text-[10px] font-mono text-subtext0">({auditLogs.length} events)</span>
          </div>

          {auditLogs.length > 0 && (
            <button
              type="button"
              onClick={() => void clearGuardrailAuditLog()}
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
          <div className="border border-surface1 rounded overflow-hidden">
            <div className="max-h-60 overflow-y-auto divide-y divide-surface1">
              {auditLogs.map((event) => (
                <div key={event.id} className="p-2.5 hover:bg-surface1/30 transition flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-start md:items-center gap-2.5">
                    {event.allowed ? (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green/10 text-green border border-green/30 rounded font-mono">
                        PASS
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red/10 text-red border border-red/30 rounded font-mono">
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
    </div>
  );
};
