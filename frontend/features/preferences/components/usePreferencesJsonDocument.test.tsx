import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePreferencesJsonDocument } from './usePreferencesJsonDocument';
import type { JsonEditorDocument } from '../types/JsonEditorDocument';

const preferences = vi.hoisted(() => ({ load: vi.fn(), saveText: vi.fn(), reset: vi.fn() }));
vi.mock('../services/preferencesJsonService', () => ({ preferencesJsonService: preferences }));
const baseline: JsonEditorDocument = { path: '/repo/.stage0/repos.json', revision: 'one', content: '{"schemaVersion":1}' };
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('keeps invalid repository text open without writing global Preferences', async () => {
  const onClose = vi.fn();
  const adapter = { load: vi.fn().mockResolvedValue(baseline), saveText: vi.fn().mockRejectedValue(new Error('Invalid JSONC')) };
  const { result } = renderHook(() => usePreferencesJsonDocument({ adapter, onClose }));
  await act(async () => {});
  act(() => result.current.setDraft('{broken'));
  await act(async () => result.current.handleClose());
  expect(result.current.draft).toBe('{broken');
  expect(result.current.saveState).toBe('invalid');
  expect(onClose).not.toHaveBeenCalled();
  expect(preferences.saveText).not.toHaveBeenCalled();
});

it('waits for an in-flight autosave and commits newer text before returning to settings', async () => {
  let finish!: (doc: JsonEditorDocument) => void;
  const onClose = vi.fn();
  const adapter = { load: vi.fn().mockResolvedValue(baseline), saveText: vi.fn()
    .mockImplementationOnce(() => new Promise<JsonEditorDocument>((resolve) => { finish = resolve; }))
    .mockImplementationOnce(async (content: string) => ({ ...baseline, content, revision: 'three' })) };
  const { result } = renderHook(() => usePreferencesJsonDocument({ adapter, onClose }));
  await act(async () => {});
  act(() => result.current.setDraft('first edit'));
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(adapter.saveText).toHaveBeenCalledWith('first edit', 'one');
  act(() => result.current.setDraft('second edit'));
  let closing!: Promise<void>;
  act(() => { closing = result.current.handleClose(); });
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => result.current.handleClose()); // A rapid second close must not duplicate the in-flight operation.
  await act(async () => { finish({ ...baseline, content: 'first edit', revision: 'two' }); await closing; });
  expect(adapter.saveText).toHaveBeenLastCalledWith('second edit', 'two');
  expect(onClose).toHaveBeenCalledOnce();
});

it('preserves a conflicting draft and exposes Reload rather than overwriting the file', async () => {
  const onClose = vi.fn();
  const adapter = { load: vi.fn().mockResolvedValue(baseline), saveText: vi.fn().mockRejectedValue(new Error('Repository settings changed. Reload before saving.')) };
  const { result } = renderHook(() => usePreferencesJsonDocument({ adapter, onClose }));
  await act(async () => {});
  act(() => result.current.setDraft('unsaved draft'));
  await act(async () => result.current.handleClose());
  expect(result.current.saveState).toBe('conflict');
  expect(result.current.draft).toBe('unsaved draft');
  expect(onClose).not.toHaveBeenCalled();
});

it('retains the global Preferences persistence route when no repository adapter is supplied', async () => {
  const onClose = vi.fn();
  const global = { ...baseline, path: '/app/preferences.json' };
  preferences.load.mockResolvedValue(global);
  preferences.saveText.mockImplementation(async (content) => ({ ...global, content, revision: 'saved-global' }));
  const { result } = renderHook(() => usePreferencesJsonDocument({ onClose }));
  await act(async () => {});
  act(() => result.current.setDraft('global draft'));
  await act(async () => result.current.handleClose());
  expect(preferences.saveText).toHaveBeenCalledWith('global draft', 'one');
  expect(onClose).toHaveBeenCalledOnce();
});

it('does not silently rebase a draft when a newer publication supersedes its save acknowledgement', async () => {
  const onClose = vi.fn();
  const adapter = { load: vi.fn().mockResolvedValue(baseline),
    saveText: vi.fn().mockResolvedValue({ ...baseline, content: 'external newer text', revision: 'external' }) };
  const { result } = renderHook(() => usePreferencesJsonDocument({ adapter, onClose }));
  await act(async () => {});
  act(() => result.current.setDraft('my edit'));
  await act(async () => result.current.handleClose());
  expect(result.current.draft).toBe('my edit');
  expect(result.current.saveState).toBe('conflict');
  expect(onClose).not.toHaveBeenCalled();
  expect(result.current.document?.revision).toBe('one');
});
