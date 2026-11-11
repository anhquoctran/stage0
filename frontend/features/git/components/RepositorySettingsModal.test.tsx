import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { RepositorySettingsModal } from './RepositorySettingsModal';

const fixture = vi.hoisted(() => ({
  repo: { id: 'repo-a', name: 'Fixture', local_path: '/repo-a' },
  doc: { revision: 'first', publicationSequence: 1, content: '{"schemaVersion":1}', validationError: null,
    labels: [], settings: { schemaVersion: 1, defaultBaseBranch: 'main', inheritGlobalAgents: true,
      customAgentRules: '', activeAgentIds: null, customReviewers: [], labels: [] } },
  save: vi.fn(), refresh: vi.fn().mockResolvedValue(undefined), toast: vi.fn(),
}));
vi.mock('../store/useGitStore', () => ({ useGitStore: () => ({ currentRepo: fixture.repo, showToast: fixture.toast }) }));
vi.mock('../../virtual-mr/store/useVirtualMrStore', () => ({ useVirtualMrStore: Object.assign(() => ({
  repoSettings: { repoId: 'repo-a', revision: 'first', defaultBaseBranch: 'main', inheritGlobalAgents: true,
    customAgentRules: '', activeAgentIds: [] }, saveRepoSettings: vi.fn(),
}), { getState: () => ({ refreshRepoMetadata: fixture.refresh }) }) }));
vi.mock('../../virtual-mr/services/repositorySettingsDocuments', () => ({
  loadRepositorySettings: async () => fixture.doc, saveRepositorySettingsSource: fixture.save,
}));
vi.mock('../../ai/services/importLegacyRepoReviewers', () => ({ hasLegacyRepoReviewers: () => false }));
vi.mock('../../preferences/store/usePreferencesStore', () => ({ usePreferencesStore: () => ({ fontSize: 14, lineSpacing: 1.5 }) }));
vi.mock('./repository-settings/RepositoryRemotesTab', () => ({ RepositoryRemotesTab: () => null }));
vi.mock('./repository-settings/RepositoryBranchesTab', () => ({ RepositoryBranchesTab: () => null }));
vi.mock('./repository-settings/RepositoryLabelsTab', () => ({ RepositoryLabelsTab: () => null }));
vi.mock('./repository-settings/RepositoryAgentsTab', () => ({ RepositoryAgentsTab: () => null }));

it('opens the repository JSONC file internally and saves it before returning to the still-open settings dialog', async () => {
  const onClose = vi.fn();
  const user = userEvent.setup();
  fixture.save.mockImplementation(async (_repoId, content) => ({ ...fixture.doc, content, revision: 'second' }));
  render(<RepositorySettingsModal isOpen onClose={onClose} />);
  await user.click(screen.getByRole('button', { name: 'Edit repos.jsonc' }));
  const source = await screen.findByRole('textbox', { name: '/repo-a/.stage0/repos.jsonc' });
  await waitFor(() => expect(source).toHaveValue(fixture.doc.content));
  const edited = '// user comment\n{"schemaVersion":1}';
  fireEvent.change(source, { target: { value: edited } });
  await user.click(screen.getByRole('button', { name: 'Repository Settings' }));
  await waitFor(() => expect(fixture.save).toHaveBeenCalledWith('repo-a', edited, 'first'));
  await waitFor(() => expect(screen.queryByRole('textbox', { name: '/repo-a/.stage0/repos.jsonc' })).not.toBeInTheDocument());
  expect(screen.getByRole('heading', { name: 'Repository Settings' })).toBeVisible();
  expect(onClose).not.toHaveBeenCalled();
});
