import React, { useState, useEffect } from 'react';
import { useAiMcpStore } from '../store/useAiMcpStore';
import { type GuardrailMode } from '../types/GuardrailMode';
import { type GuardrailEvaluationResult } from '../types/GuardrailEvaluationResult';
import { DEFAULT_GUARDRAIL_POLICY } from '../types/guardrails';
import { GuardrailsHeader } from './guardrails/GuardrailsHeader';
import { GuardrailsCommandSection } from './guardrails/GuardrailsCommandSection';
import { GuardrailsFilesSection } from './guardrails/GuardrailsFilesSection';
import { GuardrailsSimulatorSection } from './guardrails/GuardrailsSimulatorSection';
import { GuardrailsAuditLogSection } from './guardrails/GuardrailsAuditLogSection';
import type { AiSettingsTabProps } from '../types/AiSettingsTabProps';

export const GuardrailsTab: React.FC<AiSettingsTabProps> = ({ draftSettings, isPendingCommit = false } = {}) => {
  const {
    guardrailPolicy,
    guardrailAuditLog,
    isGuardrailLoading,
    updateGuardrailPolicy,
    resetGuardrailPolicy,
    loadGuardrailAuditLog,
    clearGuardrailAuditLog,
    simulateGuardrailCheck,
  } = { ...useAiMcpStore(), ...draftSettings };

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
    if (isPendingCommit) return;
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
      <GuardrailsHeader
        activeMode={activeMode}
        isDraft={Boolean(draftSettings)}
        isGuardrailLoading={Boolean(isGuardrailLoading)}
        onRefreshAuditLog={() => void loadGuardrailAuditLog(30)}
        onSelectPreset={handlePresetSelect}
      />

      <GuardrailsCommandSection
        allowedCommands={allowedCommands}
        newAllowedCmd={newAllowedCmd}
        setNewAllowedCmd={setNewAllowedCmd}
        onAddAllowedCmd={handleAddAllowedCmd}
        onRemoveAllowedCmd={handleRemoveAllowedCmd}
        blockedCommands={blockedCommands}
        newBlockedCmd={newBlockedCmd}
        setNewBlockedCmd={setNewBlockedCmd}
        onAddBlockedCmd={handleAddBlockedCmd}
        onRemoveBlockedCmd={handleRemoveBlockedCmd}
        blockedPatterns={blockedPatterns}
        newBlockedPattern={newBlockedPattern}
        setNewBlockedPattern={setNewBlockedPattern}
        onAddBlockedPattern={handleAddBlockedPattern}
        onRemoveBlockedPattern={handleRemoveBlockedPattern}
        maxTimeout={policy.max_execution_timeout_secs || 45}
        onUpdateTimeout={(sec) => void updateGuardrailPolicy({ max_execution_timeout_secs: sec })}
        maxOutputBytes={policy.max_output_bytes || 65536}
        onUpdateOutputBytes={(bytes) => void updateGuardrailPolicy({ max_output_bytes: bytes })}
        rateLimit={policy.rate_limit_per_minute || 60}
        onUpdateRateLimit={(rate) => void updateGuardrailPolicy({ rate_limit_per_minute: rate })}
      />

      <GuardrailsFilesSection
        sensitivePatterns={sensitivePatterns}
        newSensitivePattern={newSensitivePattern}
        setNewSensitivePattern={setNewSensitivePattern}
        onAddSensitivePattern={handleAddSensitivePattern}
        onRemoveSensitivePattern={handleRemoveSensitivePattern}
        maxFileReadLines={policy.max_file_read_lines || 2500}
        onUpdateMaxFileReadLines={(lines) => void updateGuardrailPolicy({ max_file_read_lines: lines })}
        requireConfirmationCommands={Boolean(policy.require_human_confirmation_for_commands)}
        onToggleConfirmationCommands={(val) => void updateGuardrailPolicy({ require_human_confirmation_for_commands: val })}
        requireConfirmationWrites={Boolean(policy.require_human_confirmation_for_writes)}
        onToggleConfirmationWrites={(val) => void updateGuardrailPolicy({ require_human_confirmation_for_writes: val })}
      />

      <GuardrailsSimulatorSection
        simTool={simTool}
        setSimTool={setSimTool}
        simArgsText={simArgsText}
        setSimArgsText={setSimArgsText}
        simResult={simResult}
        isSimulating={isSimulating}
        simError={simError}
        isPendingCommit={isPendingCommit}
        onRunSimulation={runSimulation}
        onSetScenario={setSampleScenario}
      />

      <GuardrailsAuditLogSection
        auditLogs={auditLogs}
        onClearAuditLog={() => void clearGuardrailAuditLog()}
      />
    </div>
  );
};
