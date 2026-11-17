import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useFileDiffEncoding } from './useFileDiffEncoding';
import { useFileEncodingStore } from '../store/useFileEncodingStore';
import type { FileTextDiff } from '../types/FileTextDiff';

const service = vi.hoisted(() => ({ getFileTextDiff: vi.fn<(...args: unknown[]) => Promise<FileTextDiff>>() }));
vi.mock('../../../core/services/runtime/useApplicationServices', () => ({ useApplicationServices: () => ({ gitFiles: service }) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const data: FileTextDiff = { raw_diff: '+decoded', old_encoding: 'UTF-8', new_encoding: 'Windows-1258', additions: 1, deletions: 0 };

beforeEach(() => {
  useFileEncodingStore.setState({ selections: {} });
  service.getFileTextDiff.mockReset();
});

it('loads manually selected encoding with correct immutable refs, paths and real Zustand updates', async () => {
  service.getFileTextDiff.mockResolvedValue(data);
  const { result } = renderHook(() => useFileDiffEncoding('/repo', 'base', 'head', 'new.txt', 'old.txt'));
  expect(result.current.manual).toBe(false);
  expect(service.getFileTextDiff).not.toHaveBeenCalled();
  act(() => result.current.setEncoding('Windows-1258'));
  await waitFor(() => expect(result.current.data).toEqual(data));
  expect(service.getFileTextDiff).toHaveBeenCalledWith({ repoPath: '/repo', oldRef: 'base', newRef: 'head', filePath: 'new.txt', oldPath: 'old.txt', encoding: 'Windows-1258' });
  expect(result.current.loading).toBe(false);
  act(() => result.current.setEncoding(null));
  expect(result.current.data).toBeNull();
  expect(result.current.loading).toBe(false);
});

it('rejects stale encoding results after another selection and keeps preferences per repository/file', async () => {
  const first = deferred<FileTextDiff>();
  const second = deferred<FileTextDiff>();
  service.getFileTextDiff.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const { result, rerender } = renderHook(({ repo, file }) => useFileDiffEncoding(repo, null, 'head', file), { initialProps: { repo: '/a', file: 'one.txt' } });
  act(() => result.current.setEncoding('UTF-16 LE'));
  expect(result.current.loading).toBe(true);
  act(() => result.current.setEncoding('Windows-1258'));
  await act(async () => second.resolve(data));
  expect(result.current.data).toEqual(data);
  await act(async () => first.resolve({ ...data, raw_diff: '+stale' }));
  expect(result.current.data?.raw_diff).toBe('+decoded');
  rerender({ repo: '/b', file: 'one.txt' });
  expect(result.current.encoding).toBeNull();
  expect(result.current.data).toBeNull();
  rerender({ repo: '/a', file: 'two.txt' });
  expect(result.current.encoding).toBeNull();
  service.getFileTextDiff.mockResolvedValue(data);
  rerender({ repo: '/a', file: 'one.txt' });
  expect(result.current.encoding).toBe('Windows-1258');
  await waitFor(() => expect(result.current.loading).toBe(false));
});

it('displays rejected decode errors, retries on selection and ignores a response after unmount', async () => {
  service.getFileTextDiff.mockRejectedValueOnce(new Error('Invalid byte sequence'));
  const { result, unmount } = renderHook(() => useFileDiffEncoding('/repo', null, 'head', 'file.txt'));
  act(() => result.current.setEncoding('UTF-8'));
  await waitFor(() => expect(result.current.error).toBe('Invalid byte sequence'));
  expect(result.current.data).toBeNull();
  expect(result.current.loading).toBe(false);
  const pending = deferred<FileTextDiff>();
  service.getFileTextDiff.mockReturnValueOnce(pending.promise);
  act(() => result.current.setEncoding('Windows-1258'));
  expect(result.current.error).toBeNull();
  expect(result.current.loading).toBe(true);
  unmount();
  await act(async () => pending.resolve(data));
});
