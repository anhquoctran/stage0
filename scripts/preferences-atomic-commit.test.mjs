import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const url = (file) => new URL(`../frontend/features/preferences/${file}`, import.meta.url);
const document = (sequence) => ({ content: '{}', revision: `rev-${sequence}`, path: 'fixture', migrated: false,
  publicationSequence: sequence, settings: { appearance: { language: sequence === 3 ? 'vi' : 'en' } } });
const request = { patch: { appearance: { language: 'vi' } }, expectedRevision: 'rev-1',
  apiKeys: { openai: 'fixture-private' }, apiKeyRemovals: [], mcpEnvSecrets: {}, mcpEnvRemovals: {} };

function fixture(t, preferences) {
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  const events = [];
  globalThis.window = { dispatchEvent: (event) => events.push(event.detail) };
  globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
  t.after(() => { globalThis.window = previousWindow; globalThis.CustomEvent = previousCustomEvent; });
  const { PreferencesJsonService } = loadWithMocks(url('services/preferencesJsonService.ts'), {
    '../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => ({
      platform: { capabilities: { preferencesFile: true } }, preferences,
    }) },
  });
  return { service: new PreferencesJsonService(), events };
}

test('a late commit response cannot overwrite a more recently published snapshot', async (t) => {
  let complete;
  let next = document(1);
  const calls = [];
  const f = fixture(t, {
    loadPreferencesJson: async () => next,
    commitPreferencesTransaction: (input) => { calls.push(input); return new Promise((resolve) => { complete = resolve; }); },
  });
  await f.service.load();
  const pending = f.service.commit(request);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(window.__STAGE0_PREFERENCES_REVISION__, 'rev-1');
  next = document(3);
  await f.service.load();
  complete({ document: document(2), configured: { openai: true } });
  const result = await pending;
  assert.equal(f.service.isCurrent(result.document), false);
  assert.equal(window.__STAGE0_PREFERENCES_REVISION__, 'rev-3');
  assert.equal(window.__STAGE0_PREFERENCES__.appearance.language, 'vi');
  assert.equal(f.events.length, 2);
  assert.doesNotMatch(JSON.stringify(f.events), /fixture-private/);
});

test('native failure retains the accepted document without a frontend rollback call', async (t) => {
  const calls = [];
  const f = fixture(t, {
    loadPreferencesJson: async () => document(1),
    commitPreferencesTransaction: async (input) => { calls.push(input); throw Error('injected preparation failure'); },
    savePreferencesJson: () => assert.fail('Frontend must never compensate a native commit'),
    patchPreferences: () => assert.fail('Frontend must not split a commit into separate writes'),
  });
  await f.service.load();
  await assert.rejects(f.service.commit(request), /preparation failure/);
  assert.equal(window.__STAGE0_PREFERENCES_REVISION__, 'rev-1');
  assert.equal(f.events.length, 1);
  assert.equal(calls.length, 1);
});

test('out-of-order reloads also return the newest document to runtime consumers', async (t) => {
  let finishFirst;
  let calls = 0;
  const f = fixture(t, {
    loadPreferencesJson: () => ++calls === 1
      ? new Promise((resolve) => { finishFirst = resolve; })
      : Promise.resolve(document(3)),
  });
  const first = f.service.load();
  await f.service.load();
  finishFirst(document(2));
  assert.equal((await first).revision, 'rev-3');
  assert.equal(f.events.length, 1);
});

test('the preferences transport sends JSON and credential changes in one native command', async () => {
  const { createPreferencesDocumentService } = loadWithMocks(url('services/transport/createPreferencesDocumentService.ts'), {});
  const calls = [];
  const service = createPreferencesDocumentService({ executeCommand: async (...args) => { calls.push(args); return {}; } });
  await service.commitPreferencesTransaction({ request });
  assert.deepEqual(calls, [['commit_preferences_transaction', { request }]]);
});
