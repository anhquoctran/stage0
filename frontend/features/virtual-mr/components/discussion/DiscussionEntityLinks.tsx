import type { ReactNode } from 'react';
import { CommitDetailsModal } from '../../../git/components/CommitDetailsModal';
import { useDiscussionEntityNavigation } from '../../hooks/useDiscussionEntityNavigation';
import type { VirtualMrSession } from '../../types/VirtualMrSession';

/** Composer previews share the same scoped navigation as persisted discussions. */
export function DiscussionEntityLinks({
    session,
    children,
}: {
    session: VirtualMrSession;
    children: ReactNode;
}) {
    const navigation = useDiscussionEntityNavigation(session);
    return (
        <div className="contents" onClickCapture={navigation.openReference}>
            {children}
            {navigation.selectedCommit && navigation.repoPath && (
                <CommitDetailsModal
                    key={`${navigation.repoPath}:${navigation.selectedCommit}`}
                    repoPath={navigation.repoPath}
                    commitHash={navigation.selectedCommit}
                    onClose={navigation.closeCommit}
                />
            )}
        </div>
    );
}
