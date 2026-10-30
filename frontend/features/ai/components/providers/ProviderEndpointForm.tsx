import { useTranslation } from 'react-i18next';
import { resolveAiModelPreset } from '../../utils/resolveAiModelPreset';
import type { ProviderEndpointFormProps } from './ProviderEndpointFormProps';

export function ProviderEndpointForm({
  aiConfig,
  activeProviderPreset,
  onUpdateAiConfig,
  dynamicModels,
}: ProviderEndpointFormProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 pt-3 border-t border-surface1/60">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-text">{t('ai.providerFields.baseUrl')}</label>
          {aiConfig.baseUrl !== activeProviderPreset.defaultBaseUrl && (
            <button
              type="button"
              onClick={() =>
                onUpdateAiConfig({
                  baseUrl: activeProviderPreset.defaultBaseUrl,
                })
              }
              className="text-[10px] text-subtext0 hover:text-text underline cursor-pointer rounded-sm"
            >
              {t('ai.providerFields.resetDefault', { value: activeProviderPreset.defaultBaseUrl })}
            </button>
          )}
        </div>
        <input
          type="text"
          value={aiConfig.baseUrl}
          onChange={(e) => {
            const baseUrl = e.target.value;
            const nextModel = resolveAiModelPreset(
              aiConfig.provider,
              aiConfig.model,
              baseUrl,
              dynamicModels[aiConfig.provider]
            );
            onUpdateAiConfig({
              baseUrl,
              reasoningEffort: undefined,
              fastMode: nextModel?.supportsFastMode ? aiConfig.fastMode : false,
            });
          }}
          placeholder="https://api.openai.com/v1"
          className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
        />
      </div>

      <div className="flex items-center justify-between gap-6 pt-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-text select-none">
          <input
            type="checkbox"
            checked={aiConfig.streamResponse}
            onChange={(e) => onUpdateAiConfig({ streamResponse: e.target.checked })}
            className="w-4 h-4 accent-text cursor-pointer"
          />
          <span>{t('ai.providerFields.streamResponses')}</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-xs text-text select-none">
          <input
            type="checkbox"
            checked={aiConfig.enableCodeReviewAssist}
            onChange={(e) => onUpdateAiConfig({ enableCodeReviewAssist: e.target.checked })}
            className="w-4 h-4 accent-text cursor-pointer"
          />
          <span>{t('ai.providerFields.summarizeCommitsDiffs')}</span>
        </label>
      </div>
    </div>
  );
}
