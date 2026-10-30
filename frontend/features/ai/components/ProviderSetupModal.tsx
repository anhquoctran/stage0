import { useTranslation as useUiTextTranslation } from 'react-i18next';
import React from 'react';
import { Sparkles } from '../../../common/components/icons/Sparkles';
import { X } from '../../../common/components/icons/X';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { Check } from '../../../common/components/icons/Check';
import { CustomSelect } from '../../../common/components/CustomSelect';
import type { AiProviderId } from '../types/AiProviderId';

export const ProviderSetupModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  setupProviderId: AiProviderId;
  setupProviderName: string;
  setSetupProviderName: (name: string) => void;
  setupApiKey: string;
  setSetupApiKey: (key: string) => void;
  setupBaseUrl: string;
  setSetupBaseUrl: (url: string) => void;
  setupModel: string;
  setSetupModel: (model: string) => void;
  providerSetupError: string | null;
  loadProviderSetup: (id: AiProviderId) => void;
  handleSaveProviderSetup: (e: React.FormEvent<HTMLFormElement>) => void;
  availableProviderList: Array<{ id: AiProviderId; name: string }>;
  getProviderDisplayName: (id: AiProviderId) => string;
  hasProviderApiKey: (id: AiProviderId) => boolean;
}> = ({
  isOpen,
  onClose,
  setupProviderId,
  setupProviderName,
  setSetupProviderName,
  setupApiKey,
  setSetupApiKey,
  setupBaseUrl,
  setSetupBaseUrl,
  setupModel,
  setSetupModel,
  providerSetupError,
  loadProviderSetup,
  handleSaveProviderSetup,
  availableProviderList,
  getProviderDisplayName,
  hasProviderApiKey,
}) => {
  const { t: translateUiText } = useUiTextTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-8.5 z-60 bg-[var(--backdrop-modal)] backdrop-blur-xs flex items-center justify-center p-4 rounded-sm">
      <form onSubmit={handleSaveProviderSetup} className="bg-mantle border border-surface0 w-full max-w-xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
        <div data-tauri-drag-region className="flex items-center justify-between pb-2 border-b border-surface0 cursor-default">
          <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
            <Sparkles className="w-4 h-4 text-brand" />
            <span>
              <h4 className="text-sm font-bold text-text">{translateUiText('ai.providerSetup.title')}</h4>
              <span className="block text-[10px] text-subtext0 mt-0.5">{translateUiText('ai.providerSetup.description')}</span>
            </span>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-subtext0 hover:text-text cursor-pointer rounded-sm" aria-label={translateUiText('common.close')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="llm-provider-select" className="block text-[11px] font-semibold text-subtext0 mb-1">{translateUiText('ai.providers.provider')}</label>
            <CustomSelect<AiProviderId>
              id="llm-provider-select"
              value={setupProviderId}
              onChange={loadProviderSetup}
              options={availableProviderList.map((provider) => ({
                value: provider.id,
                label: getProviderDisplayName(provider.id),
              }))}
              className="w-full"
              buttonClassName="w-full px-3 py-2"
              dropdownWidth="w-full"
              align="left"
              aria-label={translateUiText('ai.providers.provider')}
            />
          </div>

          {setupProviderId === 'custom' && (
            <div>
              <label htmlFor="llm-provider-name" className="block text-[11px] font-semibold text-subtext0 mb-1">{translateUiText('ai.providers.displayName')}</label>
              <input
                id="llm-provider-name"
                value={setupProviderName}
                onChange={(event) => setSetupProviderName(event.target.value)}
                placeholder={translateUiText('ai.providers.displayNamePlaceholder')}
                className="w-full px-3 py-2 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
              />
            </div>
          )}

          {setupProviderId !== 'ollama' && (
            <div>
              <label htmlFor="llm-provider-api-key" className="block text-[11px] font-semibold text-subtext0 mb-1">{translateUiText('ai.providers.apiKey')}</label>
              <input
                id="llm-provider-api-key"
                type="password"
                autoComplete="new-password"
                value={setupApiKey}
                onChange={(event) => setSetupApiKey(event.target.value)}
                placeholder={hasProviderApiKey(setupProviderId) ? translateUiText('ai.providerSetup.savedKeyPlaceholder') : translateUiText('ai.providerSetup.apiKeyPlaceholder')}
                className="w-full px-3 py-2 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
              />
              <p className="text-[9px] text-subtext0 mt-1">{translateUiText('ai.providerSetup.apiKeySecurityNotice')}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="llm-provider-base-url" className="block text-[11px] font-semibold text-subtext0 mb-1">{translateUiText('ai.providerSetup.baseUrl')}</label>
              <input
                id="llm-provider-base-url"
                type="url"
                value={setupBaseUrl}
                onChange={(event) => setSetupBaseUrl(event.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full px-3 py-2 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
              />
            </div>
            <div>
              <label htmlFor="llm-provider-model" className="block text-[11px] font-semibold text-subtext0 mb-1">{translateUiText('ai.providerSetup.modelId')}</label>
              <input
                id="llm-provider-model"
                value={setupModel}
                onChange={(event) => setSetupModel(event.target.value)}
                placeholder="model-name"
                className="w-full px-3 py-2 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
              />
            </div>
          </div>
        </div>

        {providerSetupError && (
          <div role="alert" className="flex items-center gap-2 p-2.5 bg-red/10 border border-red/30 text-red text-[11px] rounded-sm">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{providerSetupError}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-surface0 rounded-sm">
          <button type="button" onClick={onClose} className="px-3 py-1.5 border border-surface1 text-subtext0 hover:text-text hover:bg-surface0 text-xs transition cursor-pointer rounded-sm">
            {translateUiText('common.cancel')}
          </button>
          <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-brand text-base text-xs font-semibold hover:brightness-110 transition cursor-pointer rounded-sm">
            <Check className="w-3.5 h-3.5" />
            <span>{translateUiText('ai.providerSetup.saveProvider')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

