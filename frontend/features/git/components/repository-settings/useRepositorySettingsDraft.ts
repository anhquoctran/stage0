import { useEffect, useRef, useState } from 'react';
import type { RepoSettings } from '../../../virtual-mr/types/RepoSettings';

export function useRepositorySettingsDraft(open: boolean, repoId: string | undefined, settings: RepoSettings | null) {
  const baseline = useRef<RepoSettings | null>(null);
  const owner = useRef<string | undefined>(undefined);
  const [customRules, setCustomRules] = useState('');
  const [inheritAgents, setInheritAgents] = useState(true);
  const [defaultBaseBranch, setDefaultBaseBranch] = useState('HEAD');
  const [baselineRevision, setBaselineRevision] = useState<string>();
  const [conflict, setConflict] = useState(false);
  useEffect(() => {
    if (!open || owner.current !== repoId) {
      baseline.current = null; owner.current = repoId; setConflict(false);
    }
    if (!open || !settings || settings.repoId !== repoId) return;
    const prior = baseline.current;
    if (!prior) {
      baseline.current = settings;
      setCustomRules(settings.customAgentRules || '');
      setInheritAgents(settings.inheritGlobalAgents);
      setDefaultBaseBranch(settings.defaultBaseBranch);
      setBaselineRevision(settings.revision);
    } else if (prior.defaultBaseBranch === settings.defaultBaseBranch
      && prior.inheritGlobalAgents === settings.inheritGlobalAgents
      && prior.customAgentRules === settings.customAgentRules) {
      // Labels/reviewer transactions do not invalidate the untouched scalar baseline.
      setBaselineRevision(settings.revision);
      setConflict(false);
    } else {
      const dirty = customRules !== (prior.customAgentRules || '') || inheritAgents !== prior.inheritGlobalAgents
        || defaultBaseBranch !== prior.defaultBaseBranch;
      if (dirty) setConflict(true);
      else {
        // An editor save should immediately hydrate an untouched settings form.
        baseline.current = settings;
        setCustomRules(settings.customAgentRules || '');
        setInheritAgents(settings.inheritGlobalAgents);
        setDefaultBaseBranch(settings.defaultBaseBranch);
        setBaselineRevision(settings.revision);
        setConflict(false);
      }
    }
  }, [open, repoId, settings, customRules, inheritAgents, defaultBaseBranch]);
  const resetDraft = (next: RepoSettings) => {
    baseline.current = next;
    setCustomRules(next.customAgentRules || '');
    setInheritAgents(next.inheritGlobalAgents);
    setDefaultBaseBranch(next.defaultBaseBranch);
    setBaselineRevision(next.revision);
    setConflict(false);
  };
  return { resetDraft, customRules, setCustomRules, inheritAgents, setInheritAgents,
    defaultBaseBranch, setDefaultBaseBranch, baselineRevision, conflict };
}
