import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { RepoSettings } from '../../../virtual-mr/types/RepoSettings';
import { useRepositorySettingsDraft } from './useRepositorySettingsDraft';

const original: RepoSettings = { repoId: 'repo', revision: 'first', defaultBaseBranch: 'main',
  inheritGlobalAgents: true, customAgentRules: '', activeAgentIds: [] };

it('preserves an unsaved draft after an external scalar edit and requires an explicit reload', () => {
  const { result, rerender } = renderHook(({ settings }) => useRepositorySettingsDraft(true, 'repo', settings),
    { initialProps: { settings: original } });
  act(() => result.current.setCustomRules('unsaved instructions'));
  const external = { ...original, defaultBaseBranch: 'develop', revision: 'external' };
  rerender({ settings: external });
  expect(result.current.conflict).toBe(true);
  expect(result.current.baselineRevision).toBe('first');
  expect(result.current.customRules).toBe('unsaved instructions');
  act(() => result.current.resetDraft(external));
  expect(result.current.conflict).toBe(false);
  expect(result.current.defaultBaseBranch).toBe('develop');
  expect(result.current.baselineRevision).toBe('external');
});

it('retains scalar drafts across label/reviewer commits while Cancel discards them', () => {
  const { result, rerender } = renderHook(({ open, settings }) => useRepositorySettingsDraft(open, 'repo', settings),
    { initialProps: { open: true, settings: original } });
  act(() => result.current.setCustomRules('draft'));
  const updated = { ...original, revision: 'labels-committed' };
  rerender({ open: true, settings: updated });
  expect(result.current.customRules).toBe('draft');
  expect(result.current.baselineRevision).toBe('labels-committed');
  expect(result.current.conflict).toBe(false);
  rerender({ open: false, settings: updated });
  rerender({ open: true, settings: updated });
  expect(result.current.customRules).toBe('');
});

it('hydrates an untouched form after saving through the source editor', () => {
  const { result, rerender } = renderHook(({ settings }) => useRepositorySettingsDraft(true, 'repo', settings),
    { initialProps: { settings: original } });
  rerender({ settings: { ...original, revision: 'editor', customAgentRules: 'saved in JSONC' } });
  expect(result.current.customRules).toBe('saved in JSONC');
  expect(result.current.baselineRevision).toBe('editor');
  expect(result.current.conflict).toBe(false);
});
