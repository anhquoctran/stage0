import type { MentionOption } from '../../../common/types/MentionOption';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import type { VirtualMrCommit } from '../types/VirtualMrCommit';

/** Reference identity is immutable; titles and short hashes are presentation only. */
export function getDiscussionEntityOptions(
    session: VirtualMrSession,
    sessions: VirtualMrSession[],
    history: Pick<VirtualMrCommit, 'hash' | 'subject'>[] = [],
): MentionOption[] {
    const repositorySessions = [session, ...sessions]
        .filter(
            (item) =>
                item.repoId === session.repoId &&
                item.id &&
                item.id.length <= 128 &&
                !/[\s/\\#?\x00-\x1f]/.test(item.id),
        )
        .filter(
            (item, index, all) =>
                all.findIndex((other) => other.id === item.id) === index,
        );
    const options: MentionOption[] = repositorySessions.map((item) => ({
        kind: 'mr',
        id: item.id,
        label: `MR ${item.id.slice(0, 8)} · ${item.title}`,
    }));
    const seen = new Set<string>();
    for (const commit of [
        ...repositorySessions.flatMap((item) => item.commits ?? []),
        ...history,
    ]) {
        const hash = commit.hash.toLowerCase();
        if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(hash) || seen.has(hash))
            continue;
        seen.add(hash);
        options.push({
            kind: 'commit',
            id: hash,
            label: hash.slice(0, 8),
            description: commit.subject,
        });
    }
    return options;
}
