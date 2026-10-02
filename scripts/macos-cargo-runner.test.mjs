import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function fixture(t) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-cargo-runner-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bin = path.join(directory, 'tools with spaces');
  fs.mkdirSync(bin);
  for (const script of ['macos-cargo-runner.sh', 'macos-app-runner.mjs']) {
    fs.copyFileSync(fileURLToPath(new URL(script, import.meta.url)), path.join(bin, script));
  }
  fs.writeFileSync(path.join(bin, 'cargo'), `#!/usr/bin/env node
console.log(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), pid: process.pid }));
process.exit(Number(process.env.STAGE0_TEST_CARGO_EXIT ?? '0'));
`, { mode: 0o755 });
  return {
    directory,
    bin,
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
  };
}

test('Tauri Cargo arguments reach Cargo; only the executable uses the app runner', {
  skip: process.platform === 'win32',
}, (t) => {
  const context = fixture(t);
  const cargoArgs = ['run', '--no-default-features', '--color', 'always', '--', 'app argument'];
  const result = spawnSync('/bin/sh', [path.join(context.bin, 'macos-cargo-runner.sh'), ...cargoArgs], {
    cwd: context.directory,
    env: context.env,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const invocation = JSON.parse(result.stdout);
  assert.equal(invocation.cwd, context.directory);
  assert.equal(invocation.pid, result.pid, 'the wrapper must exec Cargo so Tauri stops the right process');
  assert.deepEqual(invocation.args.slice(4), cargoArgs);
  for (const [index, target] of [[0, 'aarch64-apple-darwin'], [2, 'x86_64-apple-darwin']]) {
    assert.equal(invocation.args[index], '--config');
    const [key, command] = invocation.args[index + 1].split(' = ');
    assert.equal(key, `target.${target}.runner`);
    assert.deepEqual(JSON.parse(command), [process.execPath, path.join(context.bin, 'macos-app-runner.mjs')]);
  }
  assert.equal(fs.existsSync(path.join(context.directory, 'Stage0-dev.app')), false);
});

test('the Cargo wrapper preserves Cargo failure exit codes', { skip: process.platform === 'win32' }, (t) => {
  const context = fixture(t);
  const result = spawnSync('/bin/sh', [path.join(context.bin, 'macos-cargo-runner.sh'), 'run'], {
    cwd: context.directory,
    env: { ...context.env, STAGE0_TEST_CARGO_EXIT: '17' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 17, result.stderr);
});

test('passing a Cargo subcommand to the executable runner fails before creating a bundle', (t) => {
  const context = fixture(t);
  const result = spawnSync(process.execPath, [path.join(context.bin, 'macos-app-runner.mjs'), 'run'], {
    cwd: context.directory,
    encoding: 'utf8',
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /expected a compiled executable/);
  assert.equal(fs.existsSync(path.join(context.directory, 'Stage0-dev.app')), false);
});

test('the dev bundle has a valid app signing identity without modifying the Cargo binary', {
  skip: process.platform !== 'darwin',
}, (t) => {
  const context = fixture(t);
  const source = path.join(context.directory, 'probe.c');
  const executable = path.join(context.directory, 'probe with spaces');
  fs.writeFileSync(source, '#include <stdio.h>\nint main(int argc, char **argv) { if (argc != 2) return 19; puts(argv[1]); return 7; }\n');
  const build = spawnSync('/usr/bin/clang', [source, '-o', executable], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  const original = fs.readFileSync(executable);

  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('./macos-app-runner.mjs', import.meta.url)),
    executable,
    'app argument with spaces',
  ], { cwd: context.directory, encoding: 'utf8' });
  assert.equal(result.status, 7, result.stderr);
  assert.equal(result.stdout.trim(), 'app argument with spaces');
  assert.deepEqual(fs.readFileSync(executable), original, 'signing must not change Cargo output');

  const bundle = path.join(context.directory, 'Stage0-dev.app');
  const bundleExecutable = path.join(bundle, 'Contents', 'MacOS', path.basename(executable));
  assert.notEqual(fs.statSync(executable).ino, fs.statSync(bundleExecutable).ino);
  const verify = spawnSync('/usr/bin/codesign', ['--verify', '--strict', bundle], { encoding: 'utf8' });
  assert.equal(verify.status, 0, verify.stderr);
  const signature = spawnSync('/usr/bin/codesign', ['-dv', '--verbose=2', bundle], { encoding: 'utf8' });
  assert.equal(signature.status, 0, signature.stderr);
  assert.match(signature.stderr, /Identifier=com\.stage0\.app\n/);
  assert.doesNotMatch(signature.stderr, /Info\.plist=not bound/);
});

test('the executable runner closes its app when Tauri kills Cargo during reload', {
  skip: process.platform !== 'darwin',
  timeout: 10_000,
}, async (t) => {
  const context = fixture(t);
  const source = path.join(context.directory, 'waiting.c');
  const executable = path.join(context.directory, 'waiting');
  fs.writeFileSync(source, '#include <stdio.h>\n#include <unistd.h>\nint main(void) { printf("APP %d\\n", getpid()); fflush(stdout); for (;;) pause(); }\n');
  const build = spawnSync('/usr/bin/clang', [source, '-o', executable], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);

  const owner = spawn(process.execPath, ['--input-type=module', '-e',
    'import { spawn } from "node:child_process"; spawn(process.execPath, process.argv.slice(1), { stdio: "inherit" });',
    fileURLToPath(new URL('./macos-app-runner.mjs', import.meta.url)), executable,
  ], { cwd: context.directory, stdio: ['ignore', 'pipe', 'pipe'] });
  let appPid;
  let stderr = '';
  owner.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  t.after(() => {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill('SIGKILL');
    if (appPid) {
      try { process.kill(appPid, 'SIGTERM'); } catch {}
    }
    owner.stdout.destroy();
    owner.stderr.destroy();
  });
  appPid = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`App did not start: ${stderr}`)), 5_000);
    let stdout = '';
    owner.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      const match = stdout.match(/APP (\d+)/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    owner.once('error', (error) => { clearTimeout(timer); reject(error); });
    owner.once('exit', () => { clearTimeout(timer); reject(new Error(`Cargo owner exited before app started: ${stderr}`)); });
  });
  const ownerExit = new Promise((resolve) => owner.once('exit', resolve));
  owner.kill('SIGKILL');
  await ownerExit;

  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    try { process.kill(appPid, 0); }
    catch (error) {
      if (error.code !== 'ESRCH') throw error;
      appPid = undefined;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail('An orphan app would block the replacement through single-instance');
});
