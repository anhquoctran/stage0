import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkFrontendIpcBoundary, formatIpcBoundaryViolation } from './check-frontend-ipc-boundary.mjs';

function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-ipc-boundary-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'frontend'), { recursive: true });
  for (const [file, contents] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
  return root;
}

test('IPC boundary detects every supported dependency syntax and reports its location', (t) => {
  const forms = [
    "import { invoke } from '@tauri-apps/api/core';",
    "import '@tauri-apps/plugin-dialog';",
    "import type { UnlistenFn } from '@tauri-apps/api/event';",
    "import { type Window } from '@tauri-apps/api/window';",
    "export { listen } from '@tauri-apps/api/event';",
    "export type { Window } from '@tauri-apps/api/window';",
    "export * from '@tauri-apps/plugin-fs';",
    "export * as core from '@tauri-apps/api/core';",
    "import core = require('@tauri-apps/api/core');",
    "type Channel = import('@tauri-apps/api/core').Channel;",
    "type Core = typeof import('@tauri-apps/api/core');",
    "void import('@tauri-apps/plugin-dialog');",
    "void import(`@tauri-apps/plugin-fs`);",
    "const core = require('@tauri-apps/api/core');",
    "const core = (require)('@tauri-apps/api/core');",
    "const core = (require as (id: string) => unknown)('@tauri-apps/api/core');",
    "const core = (<(id: string) => unknown>require)('@tauri-apps/api/core');",
    "const core = (require satisfies Function)('@tauri-apps/api/core');",
    "const core = require!('@tauri-apps/api/core');",
    "const core = require(('@tauri-apps/api/core' as const));",
    "void import(('@tauri-apps/plugin-fs'));",
  ];
  const root = fixture(t, Object.fromEntries(forms.map((source, i) =>
    [`frontend/features/git/syntax-${i}.ts`, `// dependency\n${source}\n`])));
  const result = checkFrontendIpcBoundary(root);
  assert.equal(result.files, forms.length);
  assert.equal(result.violations.length, forms.length);
  for (const violation of result.violations) {
    assert.equal(violation.line, 2);
    assert.ok(violation.column > 0);
    assert.match(violation.specifier, /^@tauri-apps\//);
    assert.match(formatIpcBoundaryViolation(violation), /^frontend\/features\/git\/syntax-\d+\.ts:2:\d+: @tauri-apps\//);
  }
});

test('IPC boundary allows adapter dependencies, ordinary imports and nondependency mentions', (t) => {
  const root = fixture(t, {
    'frontend/common/services/ipc/adapters/tauri/commands.ts': "export { invoke } from '@tauri-apps/api/core';",
    'frontend/common/services/ipc/adapters/tauri/plugin.ts': "import(('@tauri-apps/plugin-fs')); (require)('@tauri-apps/api/core');",
    'frontend/common/services/ipc/adapters/tauri/types.ts': "export type { UnlistenFn } from '@tauri-apps/api/event';",
    'frontend/features/git/component.tsx': `
      import { getApplicationServices } from '@/core/services/runtime/applicationRuntime';
      import type { WindowHandle } from '../../common/services/ipc/contracts/WindowHandle';
      export type { EventService } from '../../common/services/ipc/contracts/EventService';
      import React from 'react';
      void import('./component');
      require('ordinary-package');
      (require)('ordinary-package');
      (require as Function)(('ordinary-package' as const));
      // import { invoke } from '@tauri-apps/api/core';
      /* require('@tauri-apps/plugin-fs'); */
      const message = '@tauri-apps/api/core';
      const example = "import('@tauri-apps/plugin-fs')";
      const content = <div>{message}</div>;
    `,
  });
  assert.deepEqual(checkFrontendIpcBoundary(root), { files: 4, violations: [] });
});

test('IPC boundary includes untracked TSX/declarations and rejects facade-prefix lookalikes', (t) => {
  const files = [
    'frontend/common/services/ipc-extra/client.ts',
    'frontend/common/services/ipc.ts',
    'frontend/features/ai/tests/untracked.tsx',
    'frontend/features/ai/types.d.ts',
  ];
  const root = fixture(t, Object.fromEntries(files.map((file) =>
    [file, "import type { InvokeArgs } from '@tauri-apps/api/core';"])));
  assert.equal(fs.existsSync(path.join(root, '.git')), false);
  const result = checkFrontendIpcBoundary(path.join(root, 'frontend', '..'));
  assert.equal(result.files, 4);
  assert.deepEqual(result.violations.map((v) => v.file).sort(), files.sort());
});

test('IPC boundary rejects computed imports and require calls even inside the facade', (t) => {
  const forms = [
    'void import(moduleName);',
    "void import('@tauri-apps/' + name);",
    'void import(`@tauri-apps/${name}`);',
    'require(moduleName);',
    "require('@tauri-apps/' + name);",
    'require();',
    '(require)(moduleName);',
    '(require as Function)(moduleName);',
    'import((moduleName as string));',
  ];
  const root = fixture(t, Object.fromEntries(forms.map((source, i) =>
    [`frontend/common/services/ipc/computed-${i}.ts`, source])));
  const { violations } = checkFrontendIpcBoundary(root);
  assert.equal(violations.length, forms.length);
  for (const violation of violations) {
    assert.match(violation.reason, /computed module specifier/);
    assert.equal(violation.line, 1);
  }
});

test('architecture command fails on an IPC violation and passes once it uses the facade', (t) => {
  const root = fixture(t, {
    'frontend/new-consumer.ts': "import { invoke } from '@tauri-apps/api/core';",
  });
  fs.mkdirSync(path.join(root, 'backend', 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'));
  for (const script of ['check-architecture.mjs', 'check-source-ownership.mjs',
    'check-backend-size.mjs', 'check-frontend-size.mjs', 'check-frontend-ipc-boundary.mjs']) {
    fs.copyFileSync(new URL(script, import.meta.url), path.join(root, 'scripts', script));
  }
  fs.symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), path.join(root, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir');
  const command = path.join(root, 'scripts', 'check-architecture.mjs');
  const failed = spawnSync(process.execPath, [command], { encoding: 'utf8' });
  assert.equal(failed.status, 1, failed.stderr);
  assert.match(failed.stderr, /frontend\/new-consumer\.ts:1:\d+: @tauri-apps\/api\/core/);
  fs.writeFileSync(path.join(root, 'frontend', 'new-consumer.ts'),
    "import { getApplicationServices } from './core/services/runtime/applicationRuntime';");
  const passed = spawnSync(process.execPath, [command], { encoding: 'utf8' });
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /Architecture OK/);
});


test('platform contracts cannot leak native types or adapter factories', (t) => {
  const root = fixture(t, {
    'frontend/common/services/ipc/contracts/WindowHandle.ts': "export type { Window } from '@tauri-apps/api/window';",
    'frontend/common/services/ipc/index.ts': "export { createTauriCommands } from './adapters/tauri/commands';",
    'frontend/features/git/view.ts': "import { createTauriCommands } from '@/common/services/ipc/adapters/tauri/commands';",
    'frontend/features/git/old.ts': "import { invoke } from '@/common/services/ipc/ipcClient';",
    'frontend/features/git/direct.ts': "runtime.platform.commands.executeCommand('clone_repository');",
  });
  const { violations } = checkFrontendIpcBoundary(root);
  assert.equal(violations.length, 5);
  assert.ok(violations.some(v => /native types|SDK dependency/.test(v.reason)));
  assert.ok(violations.some(v => /private/.test(v.reason)));
  assert.ok(violations.some(v => /replaced/.test(v.reason)));
  assert.ok(violations.some(v => /services\/transport/.test(v.reason)));
});


test('transport ownership rejects runtime cycles, bridge internals and destructured command execution', t => {
  const root = fixture(t, {
    'frontend/features/git/services/transport/invalid.ts': "import { useGitStore } from '../../store/useGitStore';",
    'frontend/features/git/services/transport/cycle.ts': "import { getApplicationServices } from '@/core/services/runtime/applicationRuntime';",
    'frontend/features/git/view.ts': "window.__TAURI_INTERNALS__.invoke('command');",
    'frontend/features/git/indexed.ts': "window['__TAURI_INTERNALS__'];",
    'frontend/features/git/presence.ts': "'__TAURI_INTERNALS__' in window;",
    'frontend/features/git/reflect.ts': "Object.hasOwn(window, '__TAURI_INTERNALS__');",
    'frontend/features/git/native-binding.ts': "const { __TAURI_INTERNALS__ } = window;",
    'frontend/features/git/template.ts': "runtime.platform.commands[`executeCommand`]('command');",
    'frontend/features/git/destructured.ts': "const { executeCommand: request } = runtime.platform.commands;",
    'frontend/common/services/ipc/platformServices.ts': "export { createTauriPlatform } from './adapters/tauri/createTauriPlatform';",
  });
  assert.equal(checkFrontendIpcBoundary(root).violations.length, 10);
});
