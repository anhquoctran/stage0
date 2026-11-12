import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';
import { useGitStore } from '../../git/store/useGitStore';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import type { VirtualMrCommit } from '../types/VirtualMrCommit';
import { getDiscussionEntityOptions } from '../utils/discussionEntityMentions';

export function useDiscussionEntityOptions(session: VirtualMrSession) {
    const { currentRepo } = useGitStore();
    const { sessions = [] } = useVirtualMrStore();
    const repoPath =
        currentRepo && currentRepo.id === session.repoId
            ? currentRepo.local_path
            : null;
    const scope = `${session.repoId}:${repoPath}:${session.id}`;
    const [requested, setRequested] = useState<string | null>(null);
    const [history, setHistory] = useState<{
        scope: string;
        commits: Pick<VirtualMrCommit, 'hash' | 'subject'>[];
    } | null>(null);
    const [failed, setFailed] = useState<string | null>(null);
    const [search, setSearch] = useState<string | null>(null);
    const [resolved, setResolved] = useState<{
        scope: string;
        hash: string;
        subject: string;
    } | null>(null);
    const requestHistory = useCallback(
        (query: string | null) => {
            setSearch(query);
            if (query !== null) setRequested(scope);
        },
        [scope],
    );
    useEffect(() => {
        if (!repoPath || requested !== scope || history?.scope === scope)
            return;
        let active = true;
        setFailed(null);
        getApplicationServices()
            .gitHistory.getCurrentBranchGraph({ repoPath })
            .then(
                (graph) => {
                    if (active) setHistory({ scope, commits: graph.commits });
                },
                () => {
                    if (active) {
                        setFailed(scope);
                        setRequested(null);
                    }
                },
            );
        return () => {
            active = false;
        };
    }, [repoPath, requested, scope, history?.scope]);
    useEffect(() => {
        if (!repoPath || !search || !/^[a-f0-9]{7,64}$/i.test(search)) return;
        let active = true;
        const timer = setTimeout(() => {
            const { gitHistory } = getApplicationServices();
            gitHistory
                .getGitRefSha({ repoPath, reference: search })
                .then(async (hash) => {
                    if (
                        !active ||
                        !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(hash) ||
                        !hash.toLowerCase().startsWith(search.toLowerCase())
                    )
                        return;
                    const message = await gitHistory.getGitCommitMessage({
                        repoPath,
                        commitHash: hash,
                    });
                    if (active)
                        setResolved({
                            scope,
                            hash,
                            subject: message.split(/\r?\n/)[0],
                        });
                })
                .catch(() => {
                    /* Unknown or ambiguous hashes are ordinary search misses. */
                });
        }, 200);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [repoPath, scope, search]);
    const options = useMemo(
        () =>
            getDiscussionEntityOptions(session, sessions, [
                ...(history?.scope === scope ? history.commits : []),
                ...(resolved?.scope === scope ? [resolved] : []),
            ]),
        [session, sessions, history, resolved, scope],
    );
    return {
        options,
        requestHistory,
        historyUnavailable: failed === scope,
        retryHistory: () => {
            setFailed(null);
            setRequested(scope);
        },
    };
}
