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
    <div className="grid grid-cols-2 gap-3">
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
        <div className="flex flex-col justify-center">
          <label className="flex items-center gap-2 text-[11px] text-text cursor-pointer">
            <input
              type="checkbox"
              checked={fastMode}
              onChange={(event) => onFastModeChange(event.target.checked)}
              className="accent-brand"
              aria-label="Fast mode"
            />
            <span>Fast mode</span>
          </label>
          <span className="text-[10px] text-subtext0 ml-5">OpenAI API tier. Off follows the project setting; Fast may cost more.</span>
        </div>
      )}
    </div>
  );
};
