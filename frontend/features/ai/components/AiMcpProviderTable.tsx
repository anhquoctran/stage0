import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from '../../../common/components/icons/Plus';
import { Trash2 } from '../../../common/components/icons/Trash2';
import { AI_PROVIDERS } from '../constants/aiPresets';
import { type AiConfig } from '../types/AiConfig';
import { type AiProviderId } from '../types/AiProviderId';
import { providerSettingsFor } from '../utils/aiProviderSettings';
import { getProviderIcon } from '../utils/getProviderIcon';
import { getProviderDisplayName } from '../utils/getProviderDisplayName';

export const AiMcpProviderTable: React.FC<{
  configuredProviders: string[];
  activeProviderId: string;
  availableProviderList: typeof AI_PROVIDERS;
  aiConfig: AiConfig;
  onOpenAddProvider: () => void;
  onOpenProviderDetails: (id: AiProviderId) => void;
  onSelectProvider: (id: AiProviderId) => void;
  onRequestDeleteProvider: (id: AiProviderId) => void;
  isProviderConfigured: (id: string) => boolean;
}> = ({
  configuredProviders,
  activeProviderId,
  availableProviderList,
  aiConfig,
  onOpenAddProvider,
  onOpenProviderDetails,
  onSelectProvider,
  onRequestDeleteProvider,
  isProviderConfigured,
}) => {
  const { t } = useTranslation();
  return (
    <div className="overflow-hidden border border-surface1 bg-base/60">
      <div className="flex items-center justify-between gap-3 px-3.5 py-3 border-b border-surface1 rounded-sm">
        <div>
          <h4 className="text-xs font-bold text-text">{t('ai.providers.title')}</h4>
          <p className="text-[10px] text-subtext0 mt-0.5">
            {t('ai.providers.tableDescription')}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAddProvider}
          disabled={availableProviderList.length === 0}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-brand text-base text-[11px] font-semibold hover:brightness-110 transition cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('ai.providers.addProvider')}</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-155 text-start">
          <thead>
            <tr className="border-b border-surface1 bg-surface0/40 text-[9px] uppercase tracking-wider text-subtext0">
              <th className="px-3.5 py-2 font-semibold">{t('ai.providers.provider')}</th>
              <th className="px-3.5 py-2 font-semibold">{t('ai.providers.endpointModel')}</th>
              <th className="px-3.5 py-2 font-semibold">{t('ai.providers.connection')}</th>
              <th className="px-3.5 py-2 text-end font-semibold">{t('ai.providers.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {AI_PROVIDERS.filter((provider) => configuredProviders.includes(provider.id)).map((provider) => {
              const isActive = activeProviderId === provider.id;
              const settings = providerSettingsFor(aiConfig, provider.id);
              const configured = isProviderConfigured(provider.id);
              const ProviderIcon = getProviderIcon(provider.id);
              return (
                <tr
                  key={provider.id}
                  className={`border-b border-surface1/70 last:border-0 ${
                    isActive ? 'bg-surface0/70' : 'hover:bg-surface0/35'
                  }`}
                >
                  <td className="px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 border border-surface2 bg-surface0 flex items-center justify-center shrink-0 ${
                          isActive ? 'text-brand' : 'text-subtext0'
                        }`}
                      >
                        <ProviderIcon className="w-3.5 h-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold text-text truncate">
                          {getProviderDisplayName(provider.id, aiConfig.customProviderName)}
                        </span>
                        <span className="block text-[9px] text-subtext0 truncate">
                          {provider.descriptionTranslationKey
                            ? t(provider.descriptionTranslationKey)
                            : provider.description}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3.5 py-2.5 max-w-0">
                    <code className="block text-[10px] text-subtext0 truncate" title={settings.baseUrl}>
                      {settings.baseUrl}
                    </code>
                    <span className="block text-[10px] text-text/80 mt-0.5 truncate" title={settings.model}>
                      {settings.model}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] ${
                        isActive ? 'text-brand' : configured ? 'text-green' : 'text-subtext0'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 ${
                          isActive ? 'bg-brand' : configured ? 'bg-green' : 'bg-surface2'
                        }`}
                      />
                      {isActive ? t('ai.providers.active') : configured ? t('ai.providers.ready') : t('ai.providers.needsSignIn')}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-end whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenProviderDetails(provider.id)}
                        className="px-2.5 py-1 border border-surface2 text-[10px] font-semibold text-text hover:bg-surface1 transition cursor-pointer rounded-sm"
                      >
                        {t('ai.providers.configure')}
                      </button>
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => onSelectProvider(provider.id)}
                          className="px-2.5 py-1 border border-surface2 text-[10px] font-semibold text-text hover:bg-surface1 transition cursor-pointer rounded-sm"
                        >
                          {t('ai.providers.use')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRequestDeleteProvider(provider.id)}
                        aria-label={t('ai.providers.removeProvider', { name: getProviderDisplayName(provider.id, aiConfig.customProviderName) })}
                        title={t('ai.providers.removeDescription')}
                        className="inline-flex items-center justify-center w-7 h-7 border border-surface2 text-subtext0 hover:border-red/50 hover:text-red transition cursor-pointer rounded-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {configuredProviders.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-9 text-center text-[11px] text-subtext0">
                  {t('ai.providers.emptyState')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

