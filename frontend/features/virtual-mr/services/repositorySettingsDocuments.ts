import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';
import type { RepositorySettingsDocument } from '../types/RepositorySettingsDocument';
import type { RepositorySettingsConfig } from '../types/RepositorySettingsConfig';

const documents = new Map<string, RepositorySettingsDocument>();
const queues = new Map<string, Promise<unknown>>();
const listeners = new Set<(repoId: string, doc: RepositorySettingsDocument) => void>();

function freezeSnapshot(value: unknown): void {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.values(value).forEach(freezeSnapshot);
  Object.freeze(value);
}

function publish(repoId: string, doc: RepositorySettingsDocument) {
  const prior = documents.get(repoId);
  if (prior && prior.publicationSequence > doc.publicationSequence) return prior;
  freezeSnapshot(doc);
  documents.set(repoId, doc);
  listeners.forEach((listener) => listener(repoId, doc));
  return doc;
}

export function subscribeRepositorySettings(listener: (repoId: string, doc: RepositorySettingsDocument) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function loadRepositorySettings(repoId: string) {
  const doc = await getApplicationServices().repositorySettings.getDocument({ repoId });
  return publish(repoId, doc);
}

export function commitRepositorySettings(
  repoId: string,
  mutate: (current: RepositorySettingsConfig, doc: RepositorySettingsDocument) => Partial<RepositorySettingsConfig>,
  expectedRevision?: string,
): Promise<RepositorySettingsDocument> {
  const previous = queues.get(repoId) || Promise.resolve();
  const pending = previous.catch(() => {}).then(async () => {
    const before = documents.get(repoId) || await loadRepositorySettings(repoId);
    if (before.validationError) throw new Error(before.validationError);
    const doc = await getApplicationServices().repositorySettings.commitDocument({
      repoId,
      expectedRevision: expectedRevision ?? before.revision,
      patch: mutate(before.settings, before),
    });
    return publish(repoId, doc);
  });
  queues.set(repoId, pending);
  void pending.finally(() => { if (queues.get(repoId) === pending) queues.delete(repoId); }).catch(() => {});
  return pending;
}

export function getRepositorySettingsSnapshot(repoId: string) {
  return documents.get(repoId);
}
