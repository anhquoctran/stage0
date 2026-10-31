import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import test from 'node:test';
import { componentHarness, loadWithMocks } from './helpers/componentHarness.mjs';

const frontend = fileURLToPath(new URL('../frontend/', import.meta.url));
const url = file => new URL(`../frontend/${file}`, import.meta.url);

function runtimeFixture() {
  const harness = componentHarness();
  const dependencies = { react: {
    ...harness.react,
    createContext: value => ({ _currentValue: value, Provider: 'provider' }),
    useContext: context => context._currentValue,
  } };
  const context = { cache: new Map(), mocks: new Map() };
  const load = file => loadWithMocks(url(file), dependencies, context);
  const { createTestPlatform } = load('common/services/ipc/adapters/testing/createTestPlatform.ts');
  const { createApplicationServices } = load('core/services/runtime/createApplicationServices.ts');
  const runtime = load('core/services/runtime/applicationRuntime.ts');
  return { load, runtime, createApplicationServices, createTestPlatform, harness };
}

test('one injected runtime is shared by Context, hook, non-React services and common services', async () => {
  const f = runtimeFixture(), calls = [], result = { fixture: 'metrics' };
  const unavailable = f.createTestPlatform();
  const platform = f.createTestPlatform({
    capabilities: { ...unavailable.capabilities, backend: true },
    commands: {
      executeCommand: (...args) => { calls.push(args); return Promise.resolve(result); },
      executeWithProgress: () => assert.fail('No progress allocation during composition'),
    },
  });
  const runtime = f.createApplicationServices(platform);
  assert.deepEqual(calls, []);
  f.runtime.installApplicationServices(runtime);
  assert.equal(f.runtime.getApplicationServices(), runtime);
  assert.equal(f.runtime.getApplicationServices(), runtime);
  const { useApplicationServices } = f.load('core/services/runtime/useApplicationServices.ts');
  const { ApplicationServicesProvider } = f.load('core/services/runtime/ApplicationServicesProvider.tsx');
  const provider = ApplicationServicesProvider({ children: 'application' });
  assert.equal(provider.props.value, runtime);
  assert.equal(ApplicationServicesProvider({ children: 'rerender' }).props.value, runtime);
  const { ApplicationServicesContext } = f.load('core/services/runtime/ApplicationServicesContext.ts');
  ApplicationServicesContext._currentValue = provider.props.value;
  assert.equal(useApplicationServices(), runtime);
  const { getPerformanceMetrics } = f.load('features/performance/services/performanceService.ts');
  assert.equal(await getPerformanceMetrics(), result);
  assert.deepEqual(calls, [['get_performance_metrics']]);
  const { getCommonServices } = f.load('common/services/getCommonServices.ts');
  assert.equal(getCommonServices().externalLinks, runtime.externalLinks);
  assert.equal(getCommonServices().attachments, runtime.attachments);
  assert.equal(f.load('common/services/ipc/platformServices.ts').getPlatformServices(), platform);
});

test('separate runtimes retain their own dependencies, capabilities and results', async () => {
  const f = runtimeFixture();
  const create = value => f.createApplicationServices(f.createTestPlatform({
    commands: { executeCommand: async () => value, executeWithProgress: async () => value },
  }));
  const first = create('first-window'), second = create('second-window');
  assert.notEqual(first, second);
  assert.notEqual(first.gitRepositories, second.gitRepositories);
  assert.notEqual(first.platform, second.platform);
  assert.equal(await first.gitRepositories.getRecentRepos(), 'first-window');
  assert.equal(await second.gitRepositories.getRecentRepos(), 'second-window');
  assert.equal(first.platform.capabilities.keychain, false);
  assert.equal(second.platform.capabilities.externalAgents, false);
});

test('test adapters leave omitted native APIs unsupported and permit exact fake path semantics', async () => {
  const f = runtimeFixture(), platform = f.createTestPlatform();
  await assert.rejects(platform.paths.homeDirectory(), error => error.code === 'UNSUPPORTED_CAPABILITY');
  await assert.rejects(platform.commands.executeCommand('save'), error => error.code === 'UNSUPPORTED_CAPABILITY');
  const calls = [], windows = f.createTestPlatform({ paths: {
    homeDirectory: async () => 'C:\\Users\\fixture',
    isAbsolute: async value => { calls.push(value); return value.startsWith('C:\\'); },
    join: async (...parts) => parts.join('\\'),
  } });
  assert.equal(await windows.paths.homeDirectory(), 'C:\\Users\\fixture');
  assert.equal(await windows.paths.isAbsolute('C:\\'), true);
  assert.equal(await windows.paths.join('C:\\Users\\fixture', 'repo'), 'C:\\Users\\fixture\\repo');
  assert.deepEqual(calls, ['C:\\']);
});

function transportFactories(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? transportFactories(file)
      : /\/services\/transport\/create[^/]+\.ts$/.test(file.split(path.sep).join('/')) ? [file] : [];
  });
}

test('every named feature operation preserves its command, input, progress callback, result and failure', async () => {
  const files = transportFactories(frontend);
  const operations = new Set();
  assert.equal(files.length, 26);
  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const expected = new Map();
    function visit(node) {
      if (ts.isPropertyAssignment(node) && ts.isArrowFunction(node.initializer) &&
        ts.isCallExpression(node.initializer.body)) {
        const call = node.initializer.body;
        expected.set(node.name.getText(source), { command: call.arguments[0].text,
          progress: call.expression.name.text === 'executeWithProgress' });
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    const exported = loadWithMocks(pathToFileURL(file), {});
    const factory = Object.values(exported)[0];
    const calls = [], result = { original: true };
    let response = Promise.resolve(result);
    const record = (...args) => { calls.push(args); return response; };
    const service = factory({ executeCommand: record, executeWithProgress: record });
    assert.deepEqual(calls, [], file);
    for (const [method, specification] of expected) {
      const { command, progress } = specification;
      operations.add(command);
      const onProgress = () => {}, input = { fixture: command, onProgress };
      const promise = service[method](input);
      assert.equal(promise, response, `${method} retains promise identity`);
      assert.equal(await promise, result);
      const call = calls.at(-1);
      assert.equal(call[0], command);
      if (progress) {
        assert.deepEqual(call[1], { fixture: command });
        assert.equal(call[2], onProgress);
      } else if (call.length > 1) assert.equal(call[1], input);
      const failure = { operation: command, code: 'original-native-failure' };
      response = Promise.reject(failure);
      await assert.rejects(service[method](input), error => error === failure);
      response = Promise.resolve(result);
    }
    assert.equal(Object.keys(service).length, expected.size);
  }
  assert.equal(operations.size, 145); // Includes native fullscreen, the singleton Preferences window operations, and atomic Preferences commit.
});


test('default runtime selects the environment once and allocates no native resources on construction', () => {
  let detections = 0;
  const { getApplicationServices } = loadWithMocks(url('core/services/runtime/applicationRuntime.ts'), {
    '@tauri-apps/api/core': { isTauri: () => { detections++; return true; },
      invoke: () => assert.fail('No native requests during composition'),
      Channel: class { constructor() { assert.fail('No native channels during composition'); } },
    },
    '@tauri-apps/api/window': { getCurrentWindow: () => assert.fail('No window handles during composition') },
    '@tauri-apps/api/event': { listen: () => assert.fail('No subscriptions during composition') },
  });
  assert.equal(detections, 0, 'importing the runtime is inert');
  const first = getApplicationServices();
  assert.equal(first.platform.capabilities.backend, true);
  assert.equal(first.platform.capabilities.keychain, true);
  assert.equal(getApplicationServices(), first);
  assert.equal(detections, 1);
});

test('runtime installation cannot split a mounted Context from non-React workflows', () => {
  const f = runtimeFixture();
  const first = f.createApplicationServices(f.createTestPlatform());
  f.runtime.installApplicationServices(first);
  assert.equal(f.runtime.getApplicationServices(), first);
  f.runtime.installApplicationServices(first);
  const second = f.createApplicationServices(f.createTestPlatform());
  assert.throws(() => f.runtime.installApplicationServices(second), /before startup/);
  const registry = f.load('common/services/ipc/platformServices.ts');
  assert.throws(() => registry.installPlatformServices(second.platform), /before startup/);
  assert.equal(f.runtime.getApplicationServices(), first);
  assert.equal(registry.getPlatformServices(), first.platform);
});

test('preferences keeps queued writes and raw failures when using an injected transport', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  globalThis.window = { dispatchEvent() {}, __STAGE0_PREFERENCES__: {}, __STAGE0_PREFERENCES_REVISION__: 'initial' };
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window; });
  const f = runtimeFixture(), calls = [], browser = f.createTestPlatform();
  let rejectFirst;
  const pending = new Promise((_, reject) => { rejectFirst = reject; });
  const document = { content: '{}', revision: 'saved', path: '/fixture/preferences.json', migrated: false };
  f.runtime.installApplicationServices(f.createApplicationServices(f.createTestPlatform({
    capabilities: { ...browser.capabilities, preferencesFile: true },
    commands: {
      executeCommand: (command, input) => { calls.push([command, input]); return calls.length === 1 ? pending : Promise.resolve(document); },
      executeWithProgress: () => assert.fail('Preferences has no progress channels'),
    },
  })));
  const { PreferencesJsonService } = f.load('features/preferences/services/preferencesJsonService.ts');
  const preferences = new PreferencesJsonService();
  const first = preferences.saveText('{"first":true}', 'initial');
  const second = preferences.saveText('{}', 'initial');
  await Promise.resolve();
  assert.deepEqual(calls, [['save_preferences_json', { content: '{"first":true}', expectedRevision: 'initial' }]]);
  const failure = { code: 'write-denied', original: true };
  rejectFirst(failure);
  await assert.rejects(first, error => error === failure);
  assert.equal(await second, document);
  assert.equal(calls.length, 2, 'a failed write releases the queue for the next operation');
  assert.equal(globalThis.window.__STAGE0_PREFERENCES_REVISION__, 'saved');
  assert.equal(globalThis.window.__STAGE0_PREFERENCES_PATH__, document.path);
});

test('a transaction with a captured revision rejects an asynchronous conflict without rebasing or overwriting', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  globalThis.window = { dispatchEvent() {}, __STAGE0_PREFERENCES__: {}, __STAGE0_PREFERENCES_REVISION__: 'newer' };
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window; });
  const f = runtimeFixture(), calls = [], browser = f.createTestPlatform();
  f.runtime.installApplicationServices(f.createApplicationServices(f.createTestPlatform({
    capabilities: { ...browser.capabilities, preferencesFile: true },
    commands: {
      executeCommand: async (command, input) => { calls.push([command, input]); throw new Error('Preferences changed outside Stage0'); },
      executeWithProgress: () => assert.fail('Unexpected progress channel'),
    },
  })));
  const { PreferencesJsonService } = f.load('features/preferences/services/preferencesJsonService.ts');
  const service = new PreferencesJsonService();
  await assert.rejects(service.patch({ general: { showInlineBlame: false } }, 'captured'), /changed outside/);
  assert.deepEqual(calls, [['patch_preferences', { patch: { general: { showInlineBlame: false } }, expectedRevision: 'captured' }]]);
  assert.equal(globalThis.window.__STAGE0_PREFERENCES_REVISION__, 'newer');
});
