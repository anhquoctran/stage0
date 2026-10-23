import { Eye } from '../../../../common/components/icons/Eye';
import { EyeOff } from '../../../../common/components/icons/EyeOff';
import { ShieldCheck } from '../../../../common/components/icons/ShieldCheck';
import type { ProviderApiKeyFormProps } from './ProviderApiKeyFormProps';

export function ProviderApiKeyForm({
  activeProviderPreset,
  apiKeyDraft,
  hasDraftSettings,
  hasSavedApiKey,
  apiKeysConfigured,
  aiConfig,
  showApiKey,
  setApiKeyDraft,
  onUpdateAiConfig,
  setShowApiKey,
  isCheckingApiKey,
  onLoadApiKey,
  apiKeyCheckError,
}: ProviderApiKeyFormProps) {
  return (
    <div className="space-y-2.5">
      {activeProviderPreset.requiresApiKey ? (
        <div className="p-3 bg-base/60 border border-surface1 rounded-sm">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-text">
              API Secret Key <span className="text-red">*</span>
            </label>
            <span className="text-[10px] text-green/90 font-mono">
              {apiKeyDraft.trim() && hasDraftSettings
                ? 'Pending key change · Apply or OK to save'
                : hasSavedApiKey
                  ? '✓ Stored securely in OS Keyring'
                  : apiKeysConfigured[aiConfig.provider] === false
                    ? 'No saved key found'
                    : 'Saved key not checked'}
            </span>
          </div>
          <div className="relative flex items-center">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKeyDraft}
              onChange={(event) => {
                const value = event.target.value;
                setApiKeyDraft(value);
                onUpdateAiConfig({ apiKey: value });
              }}
              placeholder={
                hasSavedApiKey
                  ? 'Key saved securely. Enter a new key to replace it.'
                  : 'Paste your provider API key'
              }
              className="w-full px-3 pr-10 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2.5 p-1 text-subtext0 hover:text-text cursor-pointer rounded-sm"
              title={showApiKey ? 'Hide secret key' : 'Show secret key'}
            >
              {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button
            type="button"
            disabled={isCheckingApiKey}
            onClick={() => void onLoadApiKey(aiConfig.provider)}
            className="mt-2 border border-surface1 px-2.5 py-1 text-[11px] disabled:opacity-40 rounded-sm"
            title="Checks only whether a key is saved in the OS keyring."
          >
            {isCheckingApiKey ? 'Checking…' : 'Check saved API key'}
          </button>
          {apiKeyCheckError && (
            <p role="alert" className="mt-2 text-red">
              {apiKeyCheckError}
            </p>
          )}
        </div>
      ) : (
        <div className="p-3 bg-base/60 border border-surface1 flex items-center gap-2.5 text-xs text-subtext0 rounded-sm">
          <ShieldCheck className="w-4 h-4 text-green shrink-0" />
          <span>
            Ollama runs locally on this machine (http://localhost:11434) and does not need an API
            key.
          </span>
        </div>
      )}
    </div>
  );
}
