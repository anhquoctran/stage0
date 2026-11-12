import { useState } from 'react';
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { VirtualMrSession } from '../../types/VirtualMrSession';
import { DiscussionMarkdownEditor } from './DiscussionMarkdownEditor';
import { DiscussionEntityLinks } from './DiscussionEntityLinks';

const f = vi.hoisted(() => ({
    git: {
        currentRepo: { id: 'repo-a', local_path: '/repo-a' },
        showToast: vi.fn(),
    },
    mr: {
        sessions: [] as VirtualMrSession[],
        switchSession: vi.fn(),
        setActiveMrTab: vi.fn(),
    },
    graph: vi.fn(),
    resolveSha: vi.fn(),
    message: vi.fn(),
}));
vi.mock('../../../git/store/useGitStore', () => ({ useGitStore: () => f.git }));
vi.mock('../../store/useVirtualMrStore', () => ({
    useVirtualMrStore: () => f.mr,
}));
vi.mock('../../../../core/services/runtime/applicationRuntime', () => ({
    getApplicationServices: () => ({
        gitHistory: {
            getCurrentBranchGraph: f.graph,
            getGitRefSha: f.resolveSha,
            getGitCommitMessage: f.message,
        },
    }),
}));
vi.mock('../../../git/components/CommitDetailsModal', () => ({
    CommitDetailsModal: ({
        repoPath,
        commitHash,
        onClose,
    }: {
        repoPath: string;
        commitHash: string;
        onClose: () => void;
    }) => (
        <div role="dialog" aria-label="Commit details">
            {repoPath}:{commitHash}
            <button onClick={onClose}>Close commit</button>
        </div>
    ),
}));
const sha = 'a'.repeat(40),
    historySha = 'b'.repeat(40);
const session = {
    id: 'mr-a',
    repoId: 'repo-a',
    title: 'Current MR',
    assignee: { email: 'author@test', name: 'Author' },
    reviewers: [{ agentId: 'bot', agentName: 'Security Bot' }],
    commits: [
        { hash: sha, shortHash: sha.slice(0, 8), subject: 'fix: original' },
    ],
} as VirtualMrSession;
const related = { ...session, id: 'mr-b', title: 'Related safety fix' };

beforeEach(() => {
    f.git.currentRepo = { id: 'repo-a', local_path: '/repo-a' };
    f.mr.sessions = [
        session,
        related,
        {
            ...related,
            id: 'foreign',
            repoId: 'repo-b',
            title: 'Foreign secret',
        },
    ];
    f.graph.mockReset();
    f.graph.mockResolvedValue({
        commits: [{ hash: historySha, subject: 'fix: historical repair' }],
    });
    f.resolveSha.mockReset();
    f.resolveSha.mockRejectedValue(new Error('Unknown commit'));
    f.message.mockReset();
});
function Editor({ item = session }: { item?: VirtualMrSession }) {
    const [value, setValue] = useState('');
    return (
        <>
            <DiscussionMarkdownEditor
                session={item}
                value={value}
                onChange={setValue}
            />
            <output data-testid="source">{value}</output>
        </>
    );
}

it('uses the real keyboard picker to insert and preview a persisted MR link that opens the correct MR', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    expect(f.graph).not.toHaveBeenCalled();
    const input = screen.getByRole('combobox');
    await user.type(input, '@Related');
    expect(
        await screen.findByRole('option', { name: /Related safety fix/ }),
    ).toBeVisible();
    expect(
        screen.queryByRole('option', { name: /Foreign secret/ }),
    ).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('source')).toHaveTextContent(
        '[MR mr-b · Related safety fix](#mr-mention/mr/mr-b)',
    );
    expect(input).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await user.click(screen.getByRole('link', { name: /Related safety fix/ }));
    expect(f.mr.switchSession).toHaveBeenCalledWith('mr-b');
    expect(f.mr.setActiveMrTab).toHaveBeenCalledWith('overview');
    expect(f.graph).toHaveBeenCalledTimes(1);
});

it('searches recent history by subject and opens the full SHA from a preview; escaping the popup leaves text intact', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const input = screen.getByRole('combobox');
    await user.type(input, '@historical');
    await screen.findByRole('option', { name: /historical repair/ });
    await user.keyboard('{Tab}');
    expect(screen.getByTestId('source')).toHaveTextContent(
        `(#mr-mention/commit/${historySha})`,
    );
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await user.click(
        screen.getByRole('link', { name: historySha.slice(0, 8) }),
    );
    expect(screen.getByRole('dialog')).toHaveTextContent(
        `/repo-a:${historySha}`,
    );
    await user.click(screen.getByRole('button', { name: 'Close commit' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Write' }));
    await user.type(screen.getByRole('combobox'), '@MR');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByTestId('source')).toHaveTextContent('@MR');
});

it('gives feedback for deleted/foreign MRs, intercepts entity links without invoking an outer discussion handler', async () => {
    const user = userEvent.setup(),
        outer = vi.fn();
    render(
        <div onClick={outer}>
            <DiscussionEntityLinks session={session}>
                <a href="#mr-mention/mr/deleted">Deleted</a>
                <a href="#mr-mention/mr/foreign">Foreign</a>
                <a href={`#mr-mention/commit/${sha}`}>Existing commit</a>
            </DiscussionEntityLinks>
        </div>,
    );
    await user.click(screen.getByText('Deleted'));
    await user.click(screen.getByText('Foreign'));
    expect(f.git.showToast).toHaveBeenCalledTimes(2);
    expect(f.mr.switchSession).not.toHaveBeenCalled();
    await user.click(screen.getByText('Existing commit'));
    expect(screen.getByRole('dialog')).toHaveTextContent(sha);
    expect(outer).not.toHaveBeenCalled();
});

it('discards a late history response after changing repository and prevents an old commit dialog crossing repositories', async () => {
    let finish!: (value: {
        commits: { hash: string; subject: string }[];
    }) => void;
    f.graph.mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    const user = userEvent.setup(),
        view = render(<Editor />);
    await user.type(screen.getByRole('combobox'), '@');
    await waitFor(() => expect(f.graph).toHaveBeenCalledTimes(1));
    f.git.currentRepo = { id: 'repo-b', local_path: '/repo-b' };
    const next = { ...session, repoId: 'repo-b', id: 'next', commits: [] };
    view.rerender(<Editor item={next} />);
    await act(async () => {
        finish({ commits: [{ hash: historySha, subject: 'stale secret' }] });
    });
    expect(
        screen.queryByRole('option', { name: /stale secret/ }),
    ).not.toBeInTheDocument();
    view.unmount();
    f.git.currentRepo = { id: 'repo-a', local_path: '/repo-a' };
    const link = <a href={`#mr-mention/commit/${sha}`}>Commit</a>;
    const links = render(
        <DiscussionEntityLinks session={session}>{link}</DiscussionEntityLinks>,
    );
    await user.click(screen.getByText('Commit'));
    expect(screen.getByRole('dialog')).toBeVisible();
    f.git.currentRepo = { id: 'repo-b', local_path: '/repo-b' };
    links.rerender(
        <DiscussionEntityLinks session={next}>{link}</DiscussionEntityLinks>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps known references usable when history fails and provides an explicit retry', async () => {
    f.graph.mockRejectedValueOnce(new Error('Unavailable'));
    const user = userEvent.setup();
    render(<Editor />);
    fireEvent.change(screen.getByRole('combobox'), {
        target: { value: '@', selectionStart: 1 },
    });
    expect(
        await screen.findByText(/Commit history could not be loaded/),
    ).toBeVisible();
    expect(
        screen.getByRole('option', { name: /Related safety fix/ }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(f.graph).toHaveBeenCalledTimes(2));
    await waitFor(() =>
        expect(
            screen.queryByText(/Commit history could not be loaded/),
        ).not.toBeInTheDocument(),
    );
});

it('resolves an unambiguous SHA outside the recent history window and persists its full immutable identity', async () => {
    const old = 'c'.repeat(40);
    f.resolveSha.mockResolvedValue(old);
    f.message.mockResolvedValue('fix: older security repair\n\nDetails');
    const user = userEvent.setup();
    render(<Editor />);
    await user.type(screen.getByRole('combobox'), '@ccccccc');
    await screen.findByRole('option', { name: /older security repair/ });
    expect(f.resolveSha).toHaveBeenCalledWith({
        repoPath: '/repo-a',
        reference: 'ccccccc',
    });
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('source')).toHaveTextContent(
        `(#mr-mention/commit/${old})`,
    );
});

it('cannot publish a late SHA lookup into another repository or query', async () => {
    let finish!: (hash: string) => void;
    f.resolveSha.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const user = userEvent.setup();
    const view = render(<Editor />);
    await user.type(screen.getByRole('combobox'), '@ddddddd');
    await waitFor(() => expect(f.resolveSha).toHaveBeenCalledTimes(1));
    f.git.currentRepo = { id: 'repo-b', local_path: '/repo-b' };
    view.rerender(<Editor item={{ ...session, id: 'next', repoId: 'repo-b', commits: [] }} />);
    await user.clear(screen.getByRole('combobox'));
    await act(async () => { finish('d'.repeat(40)); });
    expect(f.message).not.toHaveBeenCalled();
    expect(screen.queryByRole('option', { name: /dddddddd/ })).not.toBeInTheDocument();
});
