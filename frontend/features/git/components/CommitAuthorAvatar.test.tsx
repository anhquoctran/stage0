import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { CommitAuthorAvatar } from './CommitAuthorAvatar';

afterEach(() => vi.unstubAllGlobals());

it('offers native density candidates without increasing the logical avatar size or repeating identity hashing', async () => {
  const digest = vi.fn(async () => new Uint8Array(32).fill(1).buffer);
  vi.stubGlobal('crypto', { subtle: { digest } });
  const { container, rerender } = render(<CommitAuthorAvatar name="Author" email="author@example.com" size={64} />);
  await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
  const avatar = container.querySelector('img')!;
  expect(avatar.parentElement).toHaveStyle({ width: '64px', height: '64px' });
  expect(avatar).toHaveAttribute('width', '64');
  expect(avatar.getAttribute('srcset')!.split(', ').map(value => value.match(/s=(\d+)&d=404 (.+)x/)!.slice(1)))
    .toEqual([['64', '1'], ['96', '1.5'], ['128', '2'], ['192', '3'], ['256', '4'], ['512', '8']]);
  rerender(<CommitAuthorAvatar name="Author" email="author@example.com" size={24} />);
  expect(avatar.parentElement).toHaveStyle({ width: '24px', height: '24px' });
  expect(avatar.getAttribute('srcset')).toContain('s=192&d=404 8x');
  expect(digest).toHaveBeenCalledTimes(1);
  fireEvent.error(avatar);
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('svg')).not.toBeNull();
});
