import React from 'react';
import { CustomSelect } from '../../../common/components/CustomSelect';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import type { AiReasoningEffort } from '../types/AiReasoningEffort';
import type { AiModelPreset } from '../types/AiModelPreset';

export const AiModelExecutionOptions: React.FC<{
  model?: AiModelPreset;
  reasoningEffort?: AiReasoningEffort;
  fastMode: boolean;
  onReasoningEffortChange: (effort: AiReasoningEffort | undefined) => void;
  onFastModeChange: (enabled: boolean) => void;
  emptyMessage?: string;
}> = ({
  model,
  reasoningEffort,
  fastMode,
  onReasoningEffortChange,
  onFastModeChange,
  emptyMessage = 'Stage0 has no capability metadata for this model.',
}) => {
  const efforts = model?.reasoningEfforts || [];
  const supportsFastMode = model?.supportsFastMode === true;

  if (!efforts.length && !supportsFastMode) {
    return <p className="text-[10px] text-subtext0">{emptyMessage}</p>;
  }

  const effortOptions: CustomSelectOption<string>[] = [
    { value: 'provider_default', label: 'Provider default' },
    ...efforts.map((effort) => ({ value: effort, label: effort[0].toUpperCase() + effort.slice(1) })),
  ];

  return (
    <div className={`grid grid-cols-1 gap-3 ${efforts.length > 0 && supportsFastMode ? 'sm:grid-cols-2' : ''}`}>
      {efforts.length > 0 && (
        <div>
          <label className="block text-[10px] text-subtext0 mb-1">Reasoning effort</label>
          <CustomSelect
            value={reasoningEffort || 'provider_default'}
            options={effortOptions}
            onChange={(value) => onReasoningEffortChange(value === 'provider_default' ? undefined : value as AiReasoningEffort)}
            className="w-full"
            buttonClassName="w-full"
            dropdownWidth="w-full"
            align="left"
            aria-label="Reasoning effort"
          />
        </div>
      )}
      {supportsFastMode && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-text">Fast mode</p>
            <p className="text-[10px] text-subtext0">OpenAI API tier. May cost more.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Fast mode"
            aria-checked={fastMode}
            onClick={() => onFastModeChange(!fastMode)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-0 p-0.5 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
              fastMode ? 'bg-brand' : 'bg-surface1'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 shrink-0 transform rounded-full bg-base shadow-lg transition duration-200 ${
                fastMode ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}
    </div>
  );
};
