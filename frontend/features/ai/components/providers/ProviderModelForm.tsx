import { CustomSelect } from '../../../../common/components/CustomSelect';
import { MAX_TOKEN_OPTIONS } from '../../constants/aiMcpConstants';
import { AiModelExecutionOptions } from '../AiModelExecutionOptions';
import type { ProviderModelFormProps } from './ProviderModelFormProps';

export function ProviderModelForm({
  isFetchingDynamicModels,
  apiKeyDraft,
  onFetchDynamicModels,
  aiConfig,
  modelOptions,
  selectModel,
  dynamicModelError,
  selectedModelInfo,
  onUpdateAiConfig,
}: ProviderModelFormProps) {
  return (
    <div className="space-y-3 pt-3 border-t border-surface1/60">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-text">Model</label>
          <button
            type="button"
            disabled={isFetchingDynamicModels || !!apiKeyDraft.trim()}
            onClick={() => void onFetchDynamicModels(aiConfig)}
            className="text-[11px] text-subtext0 hover:text-text disabled:opacity-40 rounded-sm"
            title="Refresh models using saved API credentials. Apply key changes first."
          >
            {isFetchingDynamicModels ? 'Refreshing…' : 'Refresh models'}
          </button>
        </div>
        <CustomSelect
          value={aiConfig.model}
          options={modelOptions}
          onChange={selectModel}
          className="w-full"
          buttonClassName="w-full py-2 font-mono"
          dropdownWidth="w-full"
          align="left"
          aria-label="Model"
        />
        {dynamicModelError && (
          <p role="alert" className="mt-1 text-xs text-red">
            {dynamicModelError}
          </p>
        )}
        {selectedModelInfo?.recommendedFor && (
          <div className="text-[10px] text-subtext0 italic px-1 mt-1">
            Recommended: {selectedModelInfo.recommendedFor}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 pt-1">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text">
              Temperature: <span className="font-mono text-text">{aiConfig.temperature}</span>
            </label>
            <span className="text-[10px] text-subtext0 font-mono">
              {aiConfig.temperature <= 0.2 ? 'Deterministic' : 'Balanced'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={aiConfig.temperature}
            onChange={(e) => onUpdateAiConfig({ temperature: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-surface1 appearance-none cursor-pointer accent-text rounded-sm"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text">Max Output Tokens</label>
            <span className="text-[10px] text-subtext0 font-mono">{aiConfig.maxTokens} tokens</span>
          </div>
          <CustomSelect
            value={String(aiConfig.maxTokens)}
            options={MAX_TOKEN_OPTIONS}
            onChange={(tokens) => onUpdateAiConfig({ maxTokens: parseInt(tokens, 10) })}
            className="w-full"
            buttonClassName="w-full font-mono"
            dropdownWidth="w-full"
            align="left"
            aria-label="Max Output Tokens"
          />
        </div>
      </div>

      <div className="pt-2 border-t border-surface1/60">
        <AiModelExecutionOptions
          model={selectedModelInfo}
          reasoningEffort={aiConfig.reasoningEffort}
          fastMode={aiConfig.fastMode === true}
          onReasoningEffortChange={(reasoningEffort) => onUpdateAiConfig({ reasoningEffort })}
          onFastModeChange={(fastMode) => onUpdateAiConfig({ fastMode })}
          emptyMessage="Stage0 has no declared reasoning or Fast mode capabilities for this provider and model."
        />
      </div>
    </div>
  );
}
