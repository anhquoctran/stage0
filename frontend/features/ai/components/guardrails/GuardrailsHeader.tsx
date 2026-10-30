import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <div className="p-4 bg-surface0/60 border border-surface1 space-y-4 rounded-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div>
            <h4 className="text-sm font-bold text-text">{t('ai.guardrails.title')}</h4>
            <span
              className={`inline-block mt-1 text-[10px] font-mono px-2 py-0.5 font-semibold uppercase rounded-sm shadow-xs ${
                activeMode === 'balanced'
                  ? 'bg-emerald-600 text-white'
                  : activeMode === 'strict'
                  ? 'bg-red-600 text-white'
                  : 'bg-amber-600 text-white'
              }`}
            >
              {isDraft ? t('ai.guardrails.draft') : t('ai.guardrails.active')}: {activeMode.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-subtext0 mt-1">
            {t('ai.guardrails.description')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefreshAuditLog}
            disabled={isGuardrailLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-surface1 text-text hover:bg-surface2 transition cursor-pointer rounded-sm"
            title={t('ai.guardrails.refreshAuditLog')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGuardrailLoading ? 'animate-spin' : ''}`} />
            <span>{t('ai.guardrails.refresh')}</span>
          </button>
        </div>
      </div>

      {/* Preset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
        {/* Strict */}
        <button
          type="button"
          onClick={() => onSelectPreset('strict')}
          className={`p-3 text-start transition-all cursor-pointer flex flex-col justify-between rounded-sm ${
            activeMode === 'strict'
              ? 'bg-red/10 border border-red/40 text-text shadow-sm'
              : 'bg-surface0 border border-surface1 hover:border-surface2 text-text'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text">
                {t('ai.guardrails.strictPreset')}
              </span>
              {activeMode === 'strict' && (
                <Check className="w-3.5 h-3.5 text-red" />
              )}
            </div>
            <p className="text-[11px] mt-1.5 leading-relaxed text-subtext0">
              {t('ai.guardrails.strictDescription')}
            </p>
          </div>
          <div className="mt-3 text-[10px] font-mono text-subtext0">
            {t('ai.guardrails.highSecurityUse')}
          </div>
        </button>

        {/* Balanced */}
        <button
          type="button"
          onClick={() => onSelectPreset('balanced')}
          className={`p-3 text-start transition-all cursor-pointer flex flex-col justify-between rounded-sm ${
            activeMode === 'balanced'
              ? 'bg-green/10 border border-green/40 text-text shadow-sm'
              : 'bg-surface0 border border-surface1 hover:border-surface2 text-text'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text">
                {t('ai.guardrails.balancedPreset')}
              </span>
              {activeMode === 'balanced' && (
                <Check className="w-3.5 h-3.5 text-green" />
              )}
            </div>
            <p className="text-[11px] mt-1.5 leading-relaxed text-subtext0">
              {t('ai.guardrails.balancedDescription')}
            </p>
          </div>
          <div className="mt-3 text-[10px] font-mono text-subtext0">
            {t('ai.guardrails.developmentUse')}
          </div>
        </button>

        {/* Permissive */}
        <button
          type="button"
          onClick={() => onSelectPreset('permissive')}
          className={`p-3 text-start transition-all cursor-pointer flex flex-col justify-between rounded-sm ${
            activeMode === 'permissive'
              ? 'bg-yellow/10 border border-yellow/40 text-text shadow-sm'
              : 'bg-surface0 border border-surface1 hover:border-surface2 text-text'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text">
                {t('ai.guardrails.autonomousPreset')}
              </span>
              {activeMode === 'permissive' && (
                <Check className="w-3.5 h-3.5 text-yellow" />
              )}
            </div>
            <p className="text-[11px] mt-1.5 leading-relaxed text-subtext0">
              {t('ai.guardrails.autonomousDescription')}
            </p>
          </div>
          <div className="mt-3 text-[10px] font-mono text-subtext0">
            {t('ai.guardrails.automationUse')}
          </div>
        </button>
      </div>
    </div>
  );
};

