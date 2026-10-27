import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = readFileSync(new URL('./reset-app-state.mjs', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const home = '/fixture/user';
const activePaths = [
  'Application Support/com.stage0.app',
  'WebKit/com.stage0.app', 'WebKit/stage0',
  'Caches/com.stage0.app', 'Caches/stage0',
  'HTTPStorages/com.stage0.app', 'HTTPStorages/stage0',
  'Preferences/com.stage0.app.plist', 'Preferences/stage0.plist',
  'Saved Application State/com.stage0.app.savedState',
  'Saved Application State/stage0.savedState',
].map(value => `${home}/Library/${value}`);

async function executeReset({ args = [], running = false, symlink, failMoveAt } = {}) {
  const files = new Map(activePaths.map(value => [value, { value }]));
  if (symlink) files.get(symlink).symlink = true;
  const moves = [];
  let output = '';
  let error;
  const missing = () => Object.assign(new Error('not found'), { code: 'ENOENT' });
  const run = new AsyncFunction('execFileSync', 'lstat', 'mkdir', 'realpath', 'rename', 'homedir', 'path', 'process', source);
  try {
    await run(
      () => running ? '/Applications/Stage0.app/Contents/MacOS/stage0\n' : '',
      async target => {
        const file = files.get(target);
        if (!file) throw missing();
        return { isSymbolicLink: () => !!file.symlink, isDirectory: () => true };
      },
      async target => { files.set(target, { directory: true }); },
      async target => target,
      async (from, to) => {
        if (failMoveAt && moves.length === failMoveAt) {
          failMoveAt = undefined;
          throw new Error('fixture move failed');
        }
        if (!files.has(from)) throw missing();
        files.set(to, files.get(from));
        files.delete(from);
        moves.push({ from, to });
      },
      () => home,
      path.posix,
      { platform: 'darwin', argv: ['node', 'reset-app-state.mjs', ...args], env: {},
        stdout: { write: value => { output += value; } },
        exit: code => { throw Object.assign(new Error('exit'), { exitCode: code }); } },
    );
  } catch (caught) {
    if (caught.exitCode !== 0) error = caught;
  }
  return { files, moves, output, error };
}

test('reset dry run includes current and legacy macOS state without modifying it', async () => {
  const result = await executeReset();
  assert.equal(result.error, undefined);
  assert.equal(result.moves.length, 0);
  for (const target of activePaths) {
    assert.ok(result.files.has(target));
    assert.ok(result.output.includes(target));
  }
  assert.match(result.output, /Dry run only/);
});

test('confirmed reset archives all active DB, settings, WebView, cache and window state', async () => {
  const result = await executeReset({ args: ['--yes'] });
  assert.equal(result.error, undefined);
  assert.equal(result.moves.length, activePaths.length);
  for (const target of activePaths) assert.equal(result.files.has(target), false);
  const destinations = new Set(result.moves.map(move => move.to));
  assert.equal(destinations.size, activePaths.length);
  for (const { from, to } of result.moves) {
    assert.ok(to.startsWith(`${home}/Library/Application Support/Stage0 Reset Backups/reset-`));
    assert.equal(result.files.get(to).value, from);
  }
  assert.match(result.output, /Reset complete/);
});

test('reset refuses running apps and symlinked state', async () => {
  for (const options of [{ running: true }, { symlink: activePaths[0] }]) {
    const result = await executeReset({ args: ['--yes'], ...options });
    assert.ok(result.error);
    assert.equal(result.moves.length, 0);
    for (const target of activePaths) assert.ok(result.files.has(target));
  }
});

test('failed reset restores all state already moved into the backup', async () => {
  const result = await executeReset({ args: ['--yes'], failMoveAt: 3 });
  assert.match(result.error.message, /All moved data was restored/);
  for (const target of activePaths) assert.equal(result.files.get(target).value, target);
});
