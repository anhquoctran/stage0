import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { VirtualMrSession } from '../../types/VirtualMrSession';
import { VirtualMrCommitsTab } from './VirtualMrCommitsTab';

const f = vi.hoisted(() => ({
  currentRepo: { id: 'repo', local_path: '/repo' }, showToast: vi.fn(),
}));
vi.mock('../../../git/store/useGitStore', () => ({ useGitStore: (select: (state: typeof f) => unknown) => select(f) }));
vi.mock('../../../git/components/CommitDetailsModal', () => ({
  CommitDetailsModal: ({ commitHash }: { commitHash: string }) => <div role="dialog">{commitHash}</div>,
}));
const hash = 'abcdef0123456789abcdef0123456789abcdef01';
const session = { id: 'mr', repoId: 'repo', baseBranch: 'main', compareBranch: 'feature', commits: [{
  hash, shortHash: hash.slice(0, 7), subject: 'Fix pagination', authorName: 'Author', authorEmail: 'author@test',
  authoredDate: '2026-11-12T00:00:00Z',
}] } as VirtualMrSession;
const command = Object.getOwnPropertyDescriptor(document, 'execCommand');
beforeEach(() => { f.currentRepo = { id: 'repo', local_path: '/repo' }; });
afterEach(() => {
  if (command) Object.defineProperty(document, 'execCommand', command);
  else Reflect.deleteProperty(document, 'execCommand');
});

it('copies the full immutable SHA when the displayed digest is clicked without opening commit details', async () => {
  const user = userEvent.setup(), write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  render(<VirtualMrCommitsTab session={session} />);
  await user.click(screen.getByRole('button', { name: `Copy Commit Hash: ${hash}` }));
  expect(write).toHaveBeenCalledExactlyOnceWith(hash);
  expect(f.showToast).toHaveBeenCalledWith('Copied commit hash', 'success');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.querySelector('button button')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'View commit abcdef0: Fix pagination' }));
  expect(screen.getByRole('dialog')).toHaveTextContent(hash);
});

it('makes copying accessible through Tab and Enter even when the repository is no longer active', async () => {
  const user = userEvent.setup(), write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  f.currentRepo = { id: 'other-repo', local_path: '/other' };
  render(<VirtualMrCommitsTab session={session} />);
  expect(screen.getByRole('button', { name: /View commit/ })).toBeDisabled();
  await user.tab();
  expect(screen.getByRole('button', { name: `Copy Commit Hash: ${hash}` })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(write).toHaveBeenCalledExactlyOnceWith(hash);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('reports clipboard failure and lets the user retry without claiming success', async () => {
  const user = userEvent.setup(), write = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Denied'));
  Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn(() => false) });
  render(<VirtualMrCommitsTab session={session} />);
  const copy = screen.getByRole('button', { name: `Copy Commit Hash: ${hash}` });
  await user.click(copy);
  expect(f.showToast).toHaveBeenCalledExactlyOnceWith('Could not copy commit hash', 'error');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  write.mockResolvedValue(); await user.click(copy);
  expect(f.showToast).toHaveBeenLastCalledWith('Copied commit hash', 'success');
});
