import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const encode = (code, params = {}, diagnostic) => `stage0-message:${JSON.stringify({ code, params, diagnostic })}`;
function fixture() {
  let language = 'en';
  const module = loadWithMocks(new URL('../frontend/common/services/ipc/backendMessages.ts', import.meta.url), {});
  module.configureBackendMessages((code, params) => `${language}:${code}:${params.path ?? ''}`);
  const { localizePlatformMessages } = loadWithMocks(new URL('../frontend/common/services/ipc/localizePlatformMessages.ts', import.meta.url), {
    './backendMessages': module,
    './BackendMessageError': loadWithMocks(new URL('../frontend/common/services/ipc/BackendMessageError.ts', import.meta.url), { './backendMessages': module }),
  });
  let value, failure, progress, event;
  const platform = {
    commands: {
      executeCommand: async () => { if (failure) throw failure; return value; },
      executeWithProgress: async (_, __, onProgress) => { onProgress(progress); if (failure) throw failure; return value; },
    },
    events: { subscribe: async (_, receive) => { event = receive; return () => { event = null; }; } },
    capabilities: {}, paths: {}, windows: {},
  };
  return { ...module, platform, localizePlatformMessages,
    localized: localizePlatformMessages(platform),
    language: (next) => { language = next; },
    value: (next) => { value = next; }, failure: (next) => { failure = next; },
    progress: (next) => { progress = next; }, event: (next) => event(next) };
}

test('coded IPC errors preserve diagnostics and resolve the active language on access', async () => {
  const f = fixture();
  f.failure(encode('backend.repository.missing', { path: '/repo' }, 'OS diagnostic'));
  let received;
  await assert.rejects(f.localized.commands.executeCommand('validate_repo'), (error) => {
    received = error;
    assert.equal(error.code, 'backend.repository.missing');
    assert.equal(error.message, 'en:backend.repository.missing:/repo');
    assert.equal(error.diagnostic, 'OS diagnostic');
    assert.ok(!error.message.includes('OS diagnostic'));
    return true;
  });
  f.language('vi');
  assert.equal(received.message, 'vi:backend.repository.missing:/repo');
  assert.match(String(received), /vi:backend.repository.missing/);
  f.failure('legacy provider diagnostic');
  await assert.rejects(f.localized.commands.executeCommand('fixture'), (error) => error === 'legacy provider diagnostic');
});

test('result, progress and app events decode message slots without changing user or model content', async () => {
  const f = fixture();
  const wire = encode('backend.errors.git');
  const result = {
    error: wire, nested: [{ validationError: wire }],
    content: wire, description: wire, generatedDescription: wire, summary: wire,
    settings: { error: wire }, commit: { message: wire }, codeSnippet: wire,
  };
  f.value(result);
  const decoded = await f.localized.commands.executeCommand('fixture');
  assert.equal(decoded.error, 'en:backend.errors.git:');
  assert.equal(decoded.nested[0].validationError, 'en:backend.errors.git:');
  for (const key of ['content', 'description', 'generatedDescription', 'summary', 'codeSnippet']) assert.equal(decoded[key], wire);
  assert.equal(decoded.settings.error, wire);
  assert.equal(decoded.commit.message, wire);
  assert.equal(result.error, wire, 'transport must not mutate the source snapshot');
  f.progress({ error: wire, phase: 'running', percent: 12 });
  let progress;
  await f.localized.commands.executeWithProgress('fixture', {}, (next) => { progress = next; });
  assert.equal(progress.error, 'en:backend.errors.git:');
  assert.equal(progress.percent, 12);
  let event;
  const unsubscribe = await f.localized.events.subscribe('software-update-state', (next) => { event = next; });
  f.language('vi');
  f.event({ message: wire, supported: true, currentVersion: '1.0', revision: 4 });
  assert.equal(event.message, 'vi:backend.errors.git:');
  assert.equal(event.revision, 4);
  unsubscribe();
});

test('malformed messages and binary values stay intact; transport wrapping is stable', () => {
  const f = fixture();
  assert.equal(f.parseBackendMessage('stage0-message:{broken'), null);
  assert.equal(f.parseBackendMessage(encode('not.backend', {})), null);
  assert.equal(f.parseBackendMessage(encode('backend.errors.git', { nested: {} })), null);
  const bytes = new Uint8Array([1, 2, 3]);
  assert.equal(f.localizeBackendPayload(bytes), bytes);
  assert.equal(f.localizePlatformMessages(f.platform), f.localized);
  assert.equal(f.localizePlatformMessages(f.localized), f.localized);
});
