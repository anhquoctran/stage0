import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MrSyncNotice } from './MrSyncNotice';
import type { MrSyncState } from '../types/MrSyncState';
import type { ReviewSnapshot } from '../../review/types/ReviewSnapshot';

const sync: MrSyncState = { sessionId: 'mr', repoId: 'repo', baseBranch: 'main', compareBranch: 'feature',
  baseSha: 'base', headSha: 'current', revision: 2, needsReview: true, refStatus: 'ready', sessionStatus: 'open', reviewers: {} };
it('shows a new committed revision needs review without rewriting historical output', () => {
  const { rerender } = render(<MrSyncNotice sync={sync} />);
  expect(screen.getByRole('status')).toHaveTextContent('Changes need review');
  rerender(<MrSyncNotice sync={sync} reviewed={{ baseSha: 'base', headSha: 'previous' } as ReviewSnapshot} />);
  expect(screen.getByRole('status')).toHaveTextContent('earlier revision');
  rerender(<MrSyncNotice sync={sync} reviewed={{ baseSha: 'base', headSha: 'current' } as ReviewSnapshot} />);
  expect(screen.queryByRole('status')).toBeNull();
});
it('reports missing local refs and hides the notice once current code has been reviewed', () => {
  const { rerender } = render(<MrSyncNotice sync={{ ...sync, headSha: null, refStatus: 'unavailable' }} />);
  expect(screen.getByRole('status')).toHaveTextContent('branch is unavailable locally');
  rerender(<MrSyncNotice sync={{ ...sync, needsReview: false }} />);
  expect(screen.queryByRole('status')).toBeNull();
});
