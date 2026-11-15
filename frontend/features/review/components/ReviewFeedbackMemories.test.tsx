import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ReviewFeedbackMemories } from './ReviewFeedbackMemories';
import type { ReviewFeedbackMemory } from '../types/ReviewFeedbackMemory';

const fixture = vi.hoisted(() => ({ list: vi.fn(), forget: vi.fn() }));
vi.mock('../../../core/services/runtime/useApplicationServices', () => {
  const services = { reviews: {
    listReviewFeedbackMemories: fixture.list, forgetReviewFeedback: fixture.forget,
  } };
  return { useApplicationServices: () => services };
});
const memory: ReviewFeedbackMemory = { id: 'm1', filePath: 'src/api.ts', reason: 'Keep public API compatibility',
  finding: 'Rename public method', feedback: 'No: existing clients rely on this name.',
  discussionId: 'd1', commentId: 'c1', updatedAt: '2026-11-14T00:00:00Z' };

beforeEach(() => {
  fixture.list.mockReset().mockResolvedValue([memory]);
  fixture.forget.mockReset().mockResolvedValue(undefined);
});

it('shows human provenance and forgets immediately using this repository only', async () => {
  const user = userEvent.setup();
  render(<ReviewFeedbackMemories repoId="repo-a" />);
  expect(await screen.findByText(/src\/api.ts: Keep public API compatibility/)).toBeVisible();
  expect(fixture.list).toHaveBeenCalledWith({ repoId: 'repo-a' });
  await user.click(screen.getByText(/src\/api.ts: Keep public API compatibility/));
  expect(screen.getByText(memory.feedback)).toBeVisible();
  const forget = screen.getByRole('button', { name: 'Forget this feedback' });
  expect(forget).toHaveClass('border-0');
  await user.click(forget);
  expect(fixture.forget).toHaveBeenCalledWith({ repoId: 'repo-a', memoryId: 'm1' });
  expect(await screen.findByText('No remembered feedback yet.')).toBeVisible();
});

it('keeps a memory visible when forgetting fails', async () => {
  fixture.forget.mockRejectedValue(new Error('fixture failure'));
  const user = userEvent.setup();
  render(<ReviewFeedbackMemories repoId="repo-a" />);
  await user.click(await screen.findByRole('button', { name: 'Forget this feedback' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load or update review memory.');
  expect(screen.getByText(/Keep public API compatibility/)).toBeVisible();
});

it('ignores stale loads after the repository changes', async () => {
  let finish: (value: ReviewFeedbackMemory[]) => void = () => undefined;
  fixture.list.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  fixture.list.mockResolvedValueOnce([]);
  const { rerender } = render(<ReviewFeedbackMemories repoId="repo-a" />);
  await waitFor(() => expect(fixture.list).toHaveBeenCalledWith({ repoId: 'repo-a' }));
  rerender(<ReviewFeedbackMemories repoId="repo-b" />);
  expect(await screen.findByText('No remembered feedback yet.')).toBeVisible();
  await act(async () => { finish([memory]); });
  expect(within(screen.getByRole('region', { name: 'Review memory' })).queryByText(/Keep public API/)).toBeNull();
});

it('exposes a load failure without pretending there are no memories', async () => {
  fixture.list.mockRejectedValue(new Error('fixture failure'));
  render(<ReviewFeedbackMemories repoId="repo-a" />);
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.queryByText('No remembered feedback yet.')).toBeNull();
});
