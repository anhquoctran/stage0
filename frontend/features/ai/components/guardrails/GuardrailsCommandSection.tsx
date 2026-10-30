import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from '../../../../common/components/icons/Plus';
import { X } from '../../../../common/components/icons/X';

export const GuardrailsCommandSection: React.FC<{
  allowedCommands: string[];
  newAllowedCmd: string;
  setNewAllowedCmd: (v: string) => void;
  onAddAllowedCmd: () => void;
  onRemoveAllowedCmd: (cmd: string) => void;
  blockedCommands: string[];
  newBlockedCmd: string;
  setNewBlockedCmd: (v: string) => void;
  onAddBlockedCmd: () => void;
  onRemoveBlockedCmd: (cmd: string) => void;
  blockedPatterns: string[];
  newBlockedPattern: string;
  setNewBlockedPattern: (v: string) => void;
  onAddBlockedPattern: () => void;
  onRemoveBlockedPattern: (pat: string) => void;
  maxTimeout: number;
  onUpdateTimeout: (sec: number) => void;
  maxOutputBytes: number;
  onUpdateOutputBytes: (bytes: number) => void;
  rateLimit: number;
  onUpdateRateLimit: (rate: number) => void;
}> = ({
  allowedCommands,
  newAllowedCmd,
  setNewAllowedCmd,
  onAddAllowedCmd,
  onRemoveAllowedCmd,
  blockedCommands,
  newBlockedCmd,
  setNewBlockedCmd,
  onAddBlockedCmd,
  onRemoveBlockedCmd,
  blockedPatterns,
  newBlockedPattern,
  setNewBlockedPattern,
  onAddBlockedPattern,
  onRemoveBlockedPattern,
  maxTimeout,
  onUpdateTimeout,
  maxOutputBytes,
  onUpdateOutputBytes,
  rateLimit,
  onUpdateRateLimit,
}) => {
  const { t } = useTranslation();
  return (
    <div className="p-4 bg-surface0/60 border border-surface1 space-y-4 rounded-sm">
      <h4 className="text-xs font-bold text-text">
        {t('ai.guardrails.commandTitle')}
      </h4>

      {/* Whitelisted Toolchains */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-subtext0">
          {t('ai.guardrails.whitelistedExecutables')}
        </label>
        <div className="flex flex-wrap gap-1.5 p-2.5 bg-base border border-surface1 min-h-[42px] items-center rounded-sm">
          {allowedCommands.map((cmd) => (
            <span
              key={cmd}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-emerald-600 text-white font-mono font-medium rounded-sm shadow-xs"
            >
              <span>{cmd}</span>
              <button
                type="button"
                onClick={() => onRemoveAllowedCmd(cmd)}
                className="text-white/80 hover:text-white cursor-pointer rounded-sm ms-0.5 transition-colors"
                title={t('ai.guardrails.remove')}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={t('ai.guardrails.allowedCommandPlaceholder')}
            value={newAllowedCmd}
            onChange={(e) => setNewAllowedCmd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddAllowedCmd())}
            className="flex-1 px-2.5 py-1 text-xs bg-base border border-surface1 text-text font-mono focus:outline-none focus:border-surface2 rounded-sm"
          />
          <button
            type="button"
            onClick={onAddAllowedCmd}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-surface1 text-text hover:bg-surface2 cursor-pointer transition rounded-sm"
          >
            <Plus className="w-3 h-3" />
            <span>{t('ai.guardrails.addCommand')}</span>
          </button>
        </div>
      </div>

      {/* Explicitly Blocked Commands */}
      <div className="space-y-2 pt-2 border-t border-surface1">
        <label className="text-[11px] font-medium text-red">
          {t('ai.guardrails.blockedCommandsTitle')}
        </label>
        <div className="flex flex-wrap gap-1.5 p-2.5 bg-base border border-surface1 min-h-[42px] items-center rounded-sm">
          {blockedCommands.map((cmd) => (
            <span
              key={cmd}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-red-600 text-white font-mono font-medium rounded-sm shadow-xs"
            >
              <span>{cmd}</span>
              <button
                type="button"
                onClick={() => onRemoveBlockedCmd(cmd)}
                className="text-white/80 hover:text-white cursor-pointer rounded-sm ms-0.5 transition-colors"
                title={t('ai.guardrails.remove')}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={t('ai.guardrails.blockedCommandPlaceholder')}
            value={newBlockedCmd}
            onChange={(e) => setNewBlockedCmd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddBlockedCmd())}
            className="flex-1 px-2.5 py-1 text-xs bg-base border border-surface1 text-text font-mono focus:outline-none focus:border-surface2 rounded-sm"
          />
          <button
            type="button"
            onClick={onAddBlockedCmd}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-surface1 text-text hover:bg-surface2 cursor-pointer transition rounded-sm"
          >
            <Plus className="w-3 h-3" />
            <span>{t('ai.guardrails.addBlockedCommand')}</span>
          </button>
        </div>
      </div>

      {/* Blocked Dangerous Shell Patterns */}
      <div className="space-y-2 pt-2 border-t border-surface1">
        <label className="text-[11px] font-medium text-yellow">
          {t('ai.guardrails.blockedPatternsTitle')}
        </label>
        <div className="flex flex-wrap gap-1.5 p-2.5 bg-base border border-surface1 min-h-[42px] items-center rounded-sm">
          {blockedPatterns.map((pat) => (
            <span
              key={pat}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-amber-600 text-white font-mono font-medium rounded-sm shadow-xs"
            >
              <span>{pat}</span>
              <button
                type="button"
                onClick={() => onRemoveBlockedPattern(pat)}
                className="text-white/80 hover:text-white cursor-pointer rounded-sm ms-0.5 transition-colors"
                title={t('ai.guardrails.remove')}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={t('ai.guardrails.blockedPatternPlaceholder')}
            value={newBlockedPattern}
            onChange={(e) => setNewBlockedPattern(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddBlockedPattern())}
            className="flex-1 px-2.5 py-1 text-xs bg-base border border-surface1 text-text font-mono focus:outline-none focus:border-surface2 rounded-sm"
          />
          <button
            type="button"
            onClick={onAddBlockedPattern}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-surface1 text-text hover:bg-surface2 cursor-pointer transition rounded-sm"
          >
            <Plus className="w-3 h-3" />
            <span>{t('ai.guardrails.addPattern')}</span>
          </button>
        </div>
      </div>

      {/* Numerical Execution Limits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-surface1 rounded-sm">
        <div>
          <label className="text-[11px] font-medium text-subtext0 block">
            {t('ai.guardrails.maxTimeout', { seconds: maxTimeout })}
          </label>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={maxTimeout}
            onChange={(e) => onUpdateTimeout(Number(e.target.value))}
            className="w-full mt-2 cursor-pointer rounded-sm accent-brand"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-subtext0 block">
            {t('ai.guardrails.maxOutputSize', { size: Math.round(maxOutputBytes / 1024) })}
          </label>
          <input
            type="range"
            min={16384}
            max={262144}
            step={16384}
            value={maxOutputBytes}
            onChange={(e) => onUpdateOutputBytes(Number(e.target.value))}
            className="w-full mt-2 cursor-pointer rounded-sm accent-brand"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-subtext0 block">
            {t('ai.guardrails.rateLimit', { count: rateLimit })}
          </label>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={rateLimit}
            onChange={(e) => onUpdateRateLimit(Number(e.target.value))}
            className="w-full mt-2 cursor-pointer rounded-sm accent-brand"
          />
        </div>
      </div>
    </div>
  );
};

