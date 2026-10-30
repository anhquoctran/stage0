import React from 'react';
import { useTranslation } from 'react-i18next';

import { CustomSelect } from '../../../common/components/CustomSelect';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import type { AcpReviewerConfigOptionsProps } from '../types/AcpReviewerConfigOptionsProps';

const DEFAULT_OPTION = '__stage0_agent_default__';
export const AcpReviewerConfigOptions: React.FC<AcpReviewerConfigOptionsProps> = ({ agent, value = {}, state }) => {
  const { t } = useTranslation();
  const { options, loading, error, validationError, retry, reset, updateOption } = state;

  if (!agent) return null;
  return (
    <div className="space-y-2 border border-surface0 bg-crust/40 p-3 rounded-sm">
      <div>
        <h4 className="text-[11px] font-semibold text-text">{t('ai.acp.optionsTitle')}</h4>
        <p className="mt-0.5 text-[10px] text-subtext0">{t('ai.acp.optionsDescription')}</p>
      </div>
      {loading && <p className="text-[10px] text-subtext0" role="status">{t('ai.acp.loadingOptions', { name: agent.name })}</p>}
      {error && <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]" role="status">
        <p className="text-red">{t('ai.acp.loadError', { error })}</p>
        <button type="button" onClick={retry} className="shrink-0 border border-surface1 px-2 py-1 text-subtext0 hover:text-text rounded-sm">{t('common.retry')}</button>
      </div>}
      {(validationError || (error && Object.keys(value).length > 0)) && <div className="space-y-2 text-[10px]" role="alert">
        {validationError && <p className="text-red">{validationError}</p>}
        <button type="button" onClick={reset} className="border border-surface1 px-2 py-1 text-subtext0 hover:text-text rounded-sm">{t('ai.acp.resetDefaults')}</button>
      </div>}
      {!loading && !error && options.length === 0 && <p className="text-[10px] text-subtext0">{t('ai.acp.noOptions')}</p>}
      {options.map((option) => {
        if (option.reviewKind === 'fastMode' && (loading || error)) return null;
        const current = value[option.id];
        const label = option.reviewKind === 'model'
          ? t('ai.execution.model')
          : option.reviewKind === 'reasoning'
            ? t('ai.execution.reasoningEffort')
            : option.reviewKind === 'fastMode' ? t('ai.execution.fastMode') : option.name;
        const fastChoices = option.reviewKind === 'fastMode' && option.type === 'select'
          ? (option.options || []).reduce<{ on?: string; off?: string }>((found, choice) => {
              const key = choice.value.toLowerCase();
              if (['true', 'on', 'enabled', 'enable', '1'].includes(key)) found.on = choice.value;
              if (['false', 'off', 'disabled', 'disable', '0'].includes(key)) found.off = choice.value;
              return found;
            }, {})
          : undefined;
        if (option.reviewKind === 'fastMode' && (option.type === 'boolean' || (
          option.options?.length === 2 && fastChoices?.on && fastChoices.off &&
          (option.currentValue === fastChoices.on || option.currentValue === fastChoices.off)
        ))) {
            const currentBoolean = option.type === 'boolean'
              ? option.currentValue === true : option.currentValue === fastChoices?.on;
            const isOverridden = current !== undefined;
            const enabled = isOverridden
              ? option.type === 'boolean' ? current === true : current === fastChoices?.on
              : currentBoolean;
            return (
              <div key={option.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] text-text">{t('ai.execution.fastMode')}</p>
                  <p className="text-[10px] text-subtext0">
                    {isOverridden ? t('ai.acp.customSetting') : t('ai.acp.agentDefaultBoolean', { status: t(currentBoolean ? 'ai.acp.on' : 'ai.acp.off') })}
                  </p>
                  {option.description && <p className="mt-1 text-[10px] text-subtext0">{option.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isOverridden && (
                    <button
                      type="button"
                      disabled={loading || !!error}
                      onClick={() => updateOption(option, undefined)}
                      className="border-0 bg-transparent px-1 py-1 text-[10px] text-subtext0 hover:text-text disabled:opacity-50 rounded-sm"
                    >
                      {t('ai.acp.useDefault')}
                    </button>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-label={t('ai.acp.fastModeFor', { name: agent.name })}
                    aria-checked={enabled}
                    disabled={loading || !!error}
                    onClick={() => updateOption(option, option.type === 'boolean'
                      ? !enabled : enabled ? fastChoices?.off : fastChoices?.on)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-0 p-0.5 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                      enabled ? 'bg-brand' : 'bg-surface1'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 shrink-0 transform rounded-full bg-base shadow-lg transition duration-200 ${
                        enabled ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
        }
        // A Fast mode control must have a complete, advertised on/off pair.
        // Do not expose a disabled switch or a substitute Fast mode dropdown.
        if (option.reviewKind === 'fastMode') return null;
        if (option.type === 'boolean') {
          const currentBoolean = typeof option.currentValue === 'boolean' ? option.currentValue : false;
          const selected = typeof current === 'boolean' ? String(current) : DEFAULT_OPTION;
          const choices: CustomSelectOption<string>[] = [
            { value: DEFAULT_OPTION, label: t('ai.acp.agentDefaultBoolean', { status: t(currentBoolean ? 'ai.acp.on' : 'ai.acp.off') }) },
            { value: 'true', label: t('common.enabled') },
            { value: 'false', label: t('common.disabled') },
          ];
          return (
            <div key={option.id}>
              <label className="mb-1 block text-[10px] text-subtext0">{label}</label>
              <CustomSelect
                disabled={loading || !!error}
                value={selected}
                options={choices}
                onChange={(next) => updateOption(option, next === DEFAULT_OPTION ? undefined : next === 'true')}
                className="w-full"
                buttonClassName="w-full"
                dropdownWidth="w-full"
                align="left"
                aria-label={t('ai.acp.labelForAgent', { label, name: agent.name })}
              />
              {option.description && <p className="mt-1 text-[10px] text-subtext0">{option.description}</p>}
            </div>
          );
        }

        const currentValue = typeof option.currentValue === 'string' ? option.currentValue : '';
        const discoveredOptions = (option.options || []).map((item) => ({
          value: item.value,
          label: item.name,
          description: item.description,
        }));
        const currentOption = discoveredOptions.find((item) => item.value === currentValue);
        const choices: CustomSelectOption<string>[] = [
          { value: DEFAULT_OPTION, label: currentOption
            ? t('ai.acp.agentDefaultValue', { value: currentOption.label })
            : t('ai.acp.agentDefault') },
          ...discoveredOptions,
        ];
        const selected = typeof current === 'string' ? current : DEFAULT_OPTION;
        if (selected !== DEFAULT_OPTION && !choices.some((item) => item.value === selected)) {
          choices.splice(1, 0, { value: selected, label: t('ai.acp.savedNotAdvertised', { value: selected }) });
        }
        return (
          <div key={option.id}>
            <label className="mb-1 block text-[10px] text-subtext0">{label}</label>
            <CustomSelect
              disabled={loading || !!error}
              value={selected}
              options={choices}
              onChange={(next) => updateOption(option, next === DEFAULT_OPTION ? undefined : next)}
              searchable={choices.length > 8}
              searchPlaceholder={t('ai.acp.searchOptions', { label: label.toLocaleLowerCase() })}
              className="w-full"
              buttonClassName="w-full"
              dropdownWidth="w-full"
              align="left"
              aria-label={t('ai.acp.labelForAgent', { label, name: agent.name })}
            />
            {option.description && <p className="mt-1 text-[10px] text-subtext0">{option.description}</p>}
          </div>
        );
      })}
    </div>
  );
};
