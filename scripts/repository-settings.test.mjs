import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks, componentHarness, repositorySettingsFixture } from './helpers/componentHarness.mjs';

const documentsUrl = new URL('../frontend/features/virtual-mr/services/repositorySettingsDocuments.ts', import.meta.url);
function fixture() {
  let current = repositorySettingsFixture('repo');
  let rejected = false;
  const calls = [];
  const documents = loadWithMocks(documentsUrl, {
    '../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => ({ repositorySettings: {
      getDocument: async () => structuredClone(current),
      commitDocument: async ({ expectedRevision, patch }) => {
        calls.push({ expectedRevision, patch });
        if (rejected || expectedRevision !== current.revision) throw new Error('revision conflict');
        await new Promise((resolve) => setTimeout(resolve, 2));
        current = { ...current, revision: `revision-${calls.length}`, publicationSequence: current.publicationSequence + 1,
          settings: { ...current.settings, ...patch } };
        return structuredClone(current);
      },
    } }) },
  });
  return { ...documents, calls, reject: () => { rejected = true; }, current: () => current };
}

test('failed repo settings writes never publish phantom UI state or report success', async () => {
  const f = fixture();
  const publications = [];
  f.subscribeRepositorySettings((_, doc) => publications.push(doc));
  await f.loadRepositorySettings('repo');
  f.reject();
  await assert.rejects(f.commitRepositorySettings('repo', () => ({ customAgentRules: 'unsaved' })), /conflict/);
  assert.equal(publications.length, 1);
  assert.equal(publications[0].settings.customAgentRules, '');
});

test('queued label/reviewer edits use the acknowledged revision and retain both mutations', async () => {
  const f = fixture();
  await f.loadRepositorySettings('repo');
  await Promise.all([
    f.commitRepositorySettings('repo', () => ({ activeAgentIds: ['reviewer-a'] })),
    f.commitRepositorySettings('repo', (config) => ({ activeAgentIds: [...config.activeAgentIds, 'reviewer-b'] })),
  ]);
  assert.deepEqual(f.current().settings.activeAgentIds, ['reviewer-a', 'reviewer-b']);
  assert.equal(f.calls[1].expectedRevision, 'revision-1');
  await assert.rejects(f.commitRepositorySettings('repo', () => ({ customAgentRules: 'stale' }), 'fixture-repo'), /conflict/);
  assert.equal(f.current().settings.customAgentRules, '');
});

test('late document reads cannot replace a newer committed snapshot', async () => {
  let release;
  const old = repositorySettingsFixture('repo');
  let reads = 0;
  const f = loadWithMocks(documentsUrl, {
    '../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => ({ repositorySettings: {
      getDocument: () => ++reads === 1 ? new Promise((resolve) => { release = resolve; }) : Promise.resolve({ ...old, revision: 'new', publicationSequence: 2 }),
    } }) },
  });
  const late = f.loadRepositorySettings('repo');
  await f.loadRepositorySettings('repo');
  release(old);
  assert.equal((await late).revision, 'new');
});

test('repository config cannot carry ACP consent and local consent is bound to exact reviewer configuration', () => {
  const harness = componentHarness();
  const storage = new Map();
  const prior = globalThis.localStorage;
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
  try {
    const consent = loadWithMocks(new URL('../frontend/features/ai/services/repoReviewerConsent.ts', import.meta.url), {});
    const bot = { id: 'reviewer', acpAgentId: 'agent', customInstructions: 'Inspect changes', enabled: true, allowAcpSourceTransfer: true };
    assert.equal('allowAcpSourceTransfer' in consent.portableReviewer(bot), false);
    assert.equal(consent.withRepoReviewerConsent('repo', bot).allowAcpSourceTransfer, false);
    consent.saveRepoReviewerConsent('repo', bot);
    assert.equal(consent.withRepoReviewerConsent('repo', bot).allowAcpSourceTransfer, true);
    assert.equal(consent.withRepoReviewerConsent('other-clone', bot).allowAcpSourceTransfer, false);
    assert.equal(consent.withRepoReviewerConsent('repo', { ...bot, acpAgentId: 'other-agent' }).allowAcpSourceTransfer, false);
    assert.equal(consent.withRepoReviewerConsent('repo', { ...bot, customInstructions: 'Changed' }).allowAcpSourceTransfer, false);
  } finally {
    globalThis.localStorage = prior;
    harness.cleanup();
  }
});
