import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { CustomSelect } from '../../../common/components/CustomSelect';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import type { AcpSessionConfigOption } from '../types/AcpSessionConfigOption';
import type { AcpReviewerConfigOptionsProps } from '../types/AcpReviewerConfigOptionsProps';

const DEFAULT_OPTION = '__stage0_agent_default__';
const KIND_LABELS: Record<AcpSessionConfigOption['reviewKind'], string> = {
  model: 'Model',
  reasoning: 'Reasoning level',
  fastMode: 'Fast mode',
};

export const AcpReviewerConfigOptions: React.FC<AcpReviewerConfigOptionsProps> = ({ agent, value = {}, onChange }) => {
  const appServices = useApplicationServices();
  const [options, setOptions] = useState<AcpSessionConfigOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const requestVersion = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    let current = true;
    const version = ++requestVersion.current;
    setOptions([]);
    setError(null);
    if (!agent) return () => { current = false; };

    setLoading(true);
    void appServices.externalAgents.acpAgentReviewConfigOptions({ config: agent })
      .then(async (result) => {
        if (!current || requestVersion.current !== version) return;
        setOptions(result);
        const modelOverrides = Object.fromEntries(result.flatMap((option) => {
          const saved = valueRef.current[option.id];
          return option.reviewKind === 'model' && typeof saved === 'string' ? [[option.id, saved]] : [];
        }));
        if (Object.keys(modelOverrides).length > 0) {
          const modelSpecificOptions = await appServices.externalAgents.acpAgentReviewConfigOptions({
            config: agent,
            configOverrides: modelOverrides,
          });
          if (current && requestVersion.current === version) setOptions(modelSpecificOptions);
        }
      })
      .catch((loadError: unknown) => {
        if (current && requestVersion.current === version) setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => { if (current && requestVersion.current === version) setLoading(false); });
    return () => { current = false; requestVersion.current += 1; };
  }, [agent, retryKey]);

  const updateOption = (option: AcpSessionConfigOption, next: string | boolean | undefined) => {
    const updated = option.reviewKind === 'model'
      ? Object.fromEntries(Object.entries(value).filter(([id]) => options.some((candidate) => candidate.id === id && candidate.reviewKind === 'model')))
      : { ...value };
    if (next === undefined) delete updated[option.id];
    else updated[option.id] = next;
    onChange(updated);

    if (option.reviewKind !== 'model') return;
    const modelOverrides = Object.fromEntries(Object.entries(updated).filter(([id]) => {
      return id === option.id || options.some((candidate) => candidate.id === id && candidate.reviewKind === 'model');
    }));
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    void appServices.externalAgents.acpAgentReviewConfigOptions({
      config: agent,
      configOverrides: modelOverrides,
    })
      .then((result) => {
        if (requestVersion.current !== version) return;
        setOptions(result);
      })
      .catch((loadError: unknown) => {
        if (requestVersion.current === version) setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => { if (requestVersion.current === version) setLoading(false); });
  };

  const visibleKinds = useMemo(() => new Set(options.map((option) => option.reviewKind)), [options]);

  if (!agent) return null;
  return (
    <div className="space-y-2 border border-surface0 bg-crust/40 p-3 rounded-sm">
      <div>
        <h4 className="text-[11px] font-semibold text-text">Agent model &amp; execution options</h4>
        <p className="mt-0.5 text-[10px] text-subtext0">Loaded from this agent’s ACP session. “Agent default” leaves that setting under the agent’s control.</p>
      </div>
      {loading && <p className="text-[10px] text-subtext0" role="status">Loading options from {agent.name}…</p>}
      {error && <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]" role="status">
        <p className="text-red">Could not load ACP options: {error} The agent’s own defaults can still be used.</p>
        <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="shrink-0 border border-surface1 px-2 py-1 text-subtext0 hover:text-text rounded-sm">Retry</button>
      </div>}
      {!loading && !error && options.length === 0 && <p className="text-[10px] text-subtext0">This agent does not expose model, reasoning, or Fast mode options through ACP. It will use its configured defaults.</p>}
      {options.map((option) => {
        const current = value[option.id];
        const label = KIND_LABELS[option.reviewKind] || option.name;
        if (option.type === 'boolean') {
          const currentBoolean = typeof option.currentValue === 'boolean' ? option.currentValue : false;
          const selected = typeof current === 'boolean' ? String(current) : DEFAULT_OPTION;
          const choices: CustomSelectOption<string>[] = [
            { value: DEFAULT_OPTION, label: `Agent default (${currentBoolean ? 'On' : 'Off'})` },
            { value: 'true', label: 'Enabled' },
            { value: 'false', label: 'Disabled' },
          ];
          return (
            <div key={option.id}>
              <label className="mb-1 block text-[10px] text-subtext0">{label}</label>
              <CustomSelect
                value={selected}
                options={choices}
                onChange={(next) => updateOption(option, next === DEFAULT_OPTION ? undefined : next === 'true')}
                className="w-full"
                buttonClassName="w-full"
                dropdownWidth="w-full"
                align="left"
                aria-label={`${label} for ${agent.name}`}
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
          { value: DEFAULT_OPTION, label: `Agent default${currentOption ? ` (${currentOption.label})` : ''}` },
          ...discoveredOptions,
        ];
        const selected = typeof current === 'string' ? current : DEFAULT_OPTION;
        if (selected !== DEFAULT_OPTION && !choices.some((item) => item.value === selected)) {
          choices.splice(1, 0, { value: selected, label: `${selected} (saved; no longer advertised)` });
        }
        return (
          <div key={option.id}>
            <label className="mb-1 block text-[10px] text-subtext0">{label}</label>
            <CustomSelect
              value={selected}
              options={choices}
              onChange={(next) => updateOption(option, next === DEFAULT_OPTION ? undefined : next)}
              searchable={choices.length > 8}
              searchPlaceholder={`Search ${label.toLowerCase()}…`}
              className="w-full"
              buttonClassName="w-full"
              dropdownWidth="w-full"
              align="left"
              aria-label={`${label} for ${agent.name}`}
            />
            {option.description && <p className="mt-1 text-[10px] text-subtext0">{option.description}</p>}
          </div>
        );
      })}
      {!loading && options.length > 0 && !visibleKinds.has('fastMode') && <p className="text-[10px] text-subtext0">Fast mode is not advertised by this agent/model.</p>}
    </div>
  );
};
