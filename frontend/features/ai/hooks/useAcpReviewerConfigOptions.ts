import { useEffect, useRef, useState } from 'react';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import type { AcpAgentConfig } from '../types/AcpAgentConfig';
import type { AcpReviewConfigOverrides } from '../types/AcpReviewConfigOverrides';
import type { AcpSessionConfigOption } from '../types/AcpSessionConfigOption';

export function useAcpReviewerConfigOptions(
  active: boolean,
  agent: AcpAgentConfig | undefined,
  value: AcpReviewConfigOverrides,
  onChange: (value: AcpReviewConfigOverrides) => void,
) {
  const appServices = useApplicationServices();
  const [retryKey, setRetryKey] = useState(0);
  const requestKey = JSON.stringify([active, agent, retryKey]);
  const [result, setResult] = useState<{
    key: string | null;
    options: AcpSessionConfigOption[];
    loading: boolean;
    error: string | null;
  }>({ key: null, options: [], loading: false, error: null });
  const requestVersion = useRef(0);
  const pending = useRef(true);
  const valueRef = useRef(value);
  valueRef.current = value;
  const validAgent = !!agent?.command?.trim();
  const current = result.key === requestKey;
  const options = current ? result.options : [];
  const loading = active && validAgent && (!current || result.loading);
  const error = current ? result.error : null;
  const invalidOverride = Object.entries(value).some(([id, saved]) => {
    const option = options.find((candidate) => candidate.id === id);
    return !option || (option.type === 'boolean'
      ? typeof saved !== 'boolean'
      : typeof saved !== 'string' || !option.options?.some((choice) => choice.value === saved));
  });
  const validationError = current && !loading && !error && invalidOverride
    ? 'Some saved ACP options are no longer available. Choose valid options or reset to agent defaults.'
    : null;
  const ready = active && validAgent && current && !loading && !error && !invalidOverride;

  const load = async (initial: boolean, overrides: AcpReviewConfigOverrides = {}) => {
    if (!active || !agent?.command?.trim()) return;
    const version = ++requestVersion.current;
    pending.current = true;
    setResult({ key: requestKey, options: initial ? [] : options, loading: true, error: null });
    try {
      let discovered = await appServices.externalAgents.acpAgentReviewConfigOptions({
        config: agent,
        ...(initial ? {} : { configOverrides: overrides }),
      });
      if (requestVersion.current !== version) return;
      if (initial) {
        const savedModels = Object.fromEntries(discovered.flatMap((option) => {
          const saved = valueRef.current[option.id];
          return option.reviewKind === 'model' && typeof saved === 'string' ? [[option.id, saved]] : [];
        }));
        if (Object.keys(savedModels).length > 0) {
          discovered = await appServices.externalAgents.acpAgentReviewConfigOptions({ config: agent, configOverrides: savedModels });
          if (requestVersion.current !== version) return;
        }
      }
      setResult({ key: requestKey, options: discovered, loading: false, error: null });
    } catch (loadError: unknown) {
      if (requestVersion.current !== version) return;
      setResult({ key: requestKey, options: [], loading: false, error: loadError instanceof Error ? loadError.message : String(loadError) });
    } finally {
      if (requestVersion.current === version) pending.current = false;
    }
  };

  useEffect(() => {
    if (active && validAgent) void load(true);
    else setResult({ key: null, options: [], loading: false, error: null });
    return () => { requestVersion.current += 1; pending.current = true; };
  }, [requestKey]);

  const retry = () => {
    pending.current = true;
    requestVersion.current += 1;
    setRetryKey((key) => key + 1);
  };
  const updateOption = (option: AcpSessionConfigOption, next: string | boolean | undefined) => {
    const updated = option.reviewKind === 'model'
      ? Object.fromEntries(Object.entries(value).filter(([id]) => options.some((candidate) => candidate.id === id && candidate.reviewKind === 'model')))
      : { ...value };
    if (next === undefined) delete updated[option.id];
    else updated[option.id] = next;
    onChange(updated);
    if (option.reviewKind === 'model') void load(false, updated);
  };

  return {
    options, loading, error, validationError, retry, updateOption,
    reset: () => { onChange({}); retry(); },
    ready: ready && !pending.current,
    // The ref also blocks a submit in the same event that starts a model load/retry.
    isReady: () => ready && !pending.current,
  };
}
