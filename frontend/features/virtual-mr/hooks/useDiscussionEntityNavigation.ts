import { useEffect, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { parseMentionReference } from '../../../common/utils/mentions';
import { useGitStore } from '../../git/store/useGitStore';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import type { VirtualMrSession } from '../types/VirtualMrSession';

export function useDiscussionEntityNavigation(session: VirtualMrSession) {
    const { t } = useTranslation();
    const { currentRepo, showToast } = useGitStore();
    const {
        sessions = [],
        switchSession,
        setActiveMrTab,
    } = useVirtualMrStore();
    const repoPath =
        currentRepo && currentRepo.id === session.repoId
            ? currentRepo.local_path
            : null;
    const scope = `${repoPath}:${session.id}`;
    const [selected, setSelected] = useState<{
        scope: string;
        hash: string;
    } | null>(null);
    useEffect(() => setSelected(null), [repoPath, session.id]);
    const openReference = (event: MouseEvent<HTMLDivElement>) => {
        const link = (event.target as HTMLElement).closest?.('a');
        const ref = parseMentionReference(link?.getAttribute('href') ?? '');
        if (!ref || (ref.kind !== 'mr' && ref.kind !== 'commit')) return;
        event.preventDefault();
        event.stopPropagation();
        if (!repoPath) {
            showToast(
                t('virtualMr.discussion.referenceUnavailable'),
                'warning',
            );
            return;
        }
        if (ref.kind === 'commit') {
            setSelected({ scope, hash: ref.id });
            return;
        }
        const target = [session, ...sessions].find(
            (item) => item.id === ref.id && item.repoId === session.repoId,
        );
        if (!target) {
            showToast(
                t('virtualMr.discussion.referenceUnavailable'),
                'warning',
            );
            return;
        }
        switchSession(target.id);
        setActiveMrTab('overview');
    };
    return {
        openReference,
        repoPath,
        selectedCommit: selected?.scope === scope ? selected.hash : null,
        closeCommit: () => setSelected(null),
    };
}
