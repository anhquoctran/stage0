import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { computeAboutInfo, readDevelopmentAboutInfo, renderFrontendAbout, syncAllMetadata } from './generate-about-info.mjs';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const savedDate = '2001-05-12';
const metadata = ['package.json', 'backend/about.json', 'frontend/features/about/config/about.ts',
  'backend/hooks.nsh', 'backend/Info.plist', 'backend/tauri.conf.json', 'backend/Cargo.toml', 'LICENSE'];

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-dev-metadata-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'backend'));
  fs.mkdirSync(path.join(root, 'frontend/features/about/config'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{"version":"0.0.1","type":"module"}\n');
  const info = computeAboutInfo({ root, releaseDate: savedDate });
  fs.writeFileSync(path.join(root, 'backend/about.json'), JSON.stringify(info));
  fs.writeFileSync(path.join(root, 'frontend/features/about/config/about.ts'), renderFrontendAbout(info));
  fs.writeFileSync(path.join(root, 'backend/hooks.nsh'), '; saved installer metadata\n');
  fs.writeFileSync(path.join(root, 'backend/Info.plist'), '<plist/>\n');
  fs.writeFileSync(path.join(root, 'backend/tauri.conf.json'), '{"version":"0.0.1"}\n');
  fs.writeFileSync(path.join(root, 'backend/Cargo.toml'), '[package]\nversion = "0.0.1"\n');
  fs.writeFileSync(path.join(root, 'LICENSE'), 'Saved copyright\n');
  return root;
}
function snapshot(root) {
  return metadata.map(file => ({ file, bytes: fs.readFileSync(path.join(root, file)),
    modified: fs.statSync(path.join(root, file), { bigint: true }).mtimeNs }));
}

test('dev banner preserves the saved build date even when a release-date override is present', t => {
  const root = fixture(t), before = snapshot(root), previous = process.env.STAGE0_RELEASE_DATE;
  process.env.STAGE0_RELEASE_DATE = '2099-12-31';
  try {
    const info = readDevelopmentAboutInfo({ root, os: 'windows', arch: 'x64' });
    assert.equal(info.releaseDate, savedDate); assert.equal(info.currentYear, '2001');
    assert.equal(info.version, '0.0.1+windows.amd64');
    assert.deepEqual(snapshot(root), before);
  } finally {
    if (previous === undefined) delete process.env.STAGE0_RELEASE_DATE;
    else process.env.STAGE0_RELEASE_DATE = previous;
  }
});

test('importing Vite config, dev serving and preview never rewrite tracked metadata; actual builds still generate it', t => {
  const root = fixture(t), before = snapshot(root), previousDir = globalThis.__dirname;
  const previousDate = process.env.STAGE0_RELEASE_DATE;
  globalThis.__dirname = root;
  process.env.STAGE0_RELEASE_DATE = '2099-12-31';
  let writes = 0;
  try {
    const config = loadWithMocks(new URL('../vite.config.ts', import.meta.url), {
      vite: { defineConfig: value => value },
      '@vitejs/plugin-react': { default: () => ({ name: 'react-fixture' }) },
      '@tailwindcss/vite': { default: () => ({ name: 'tailwind-fixture' }) },
      path: { default: path },
      './scripts/generate-about-info.mjs': { syncAllMetadata: () => { writes++; return syncAllMetadata({ root }); } },
    }).default;
    assert.equal(writes, 0, 'Importing config is read-only');
    for (const mode of ['development', 'production']) for (const isPreview of [false, true]) {
      const options = config({ command: 'serve', mode, isPreview });
      assert.equal(options.server.port, 1420);
      assert.equal(writes, 0); assert.deepEqual(snapshot(root), before);
    }
    config({ command: 'build', mode: 'production', isPreview: false });
    assert.equal(writes, 1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'backend/about.json'))).releaseDate, '2099-12-31');
    assert.match(fs.readFileSync(path.join(root, 'frontend/features/about/config/about.ts'), 'utf8'), /2099-12-31/);
  } finally {
    if (previousDir === undefined) delete globalThis.__dirname; else globalThis.__dirname = previousDir;
    if (previousDate === undefined) delete process.env.STAGE0_RELEASE_DATE;
    else process.env.STAGE0_RELEASE_DATE = previousDate;
  }
});

for (const mode of ['--web', '--app']) test(`actual ${mode} runner preserves metadata and reports the saved date`, t => {
  const root = fixture(t), dir = path.join(root, 'scripts'); fs.mkdirSync(dir);
  for (const file of ['dev.mjs', 'generate-about-info.mjs']) fs.copyFileSync(new URL(file, import.meta.url), path.join(dir, file));
  const preload = path.join(root, 'mock-dev-processes.mjs');
  fs.writeFileSync(preload, `import cp from 'node:child_process';
import net from 'node:net';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
cp.execSync = () => Buffer.from('fixture');
cp.spawn = (_command, args) => {
  console.log('DEV_CHILD:' + args.join(' '));
  const child = new EventEmitter();
  setImmediate(() => child.emit('close', 0));
  return child;
};
net.createServer = () => {
  const server = new EventEmitter();
  server.close = callback => callback();
  server.listen = () => { setImmediate(() => server.emit('listening')); return server; };
  return server;
};
syncBuiltinESMExports();\n`);
  const before = snapshot(root);
  const output = execFileSync(process.execPath, ['--import', pathToFileURL(preload).href, path.join(dir, 'dev.mjs'), mode], {
    cwd: root, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, STAGE0_RELEASE_DATE: '2099-12-31' },
  });
  assert.match(output, /2001-05-12/); assert.doesNotMatch(output, /2099-12-31/);
  assert.match(output, mode === '--web' ? /DEV_CHILD:vite / : /DEV_CHILD:tauri dev/);
  assert.deepEqual(snapshot(root), before);
});

test('invalid saved development dates fail read-only rather than inventing a new build date', t => {
  const root = fixture(t);
  for (const releaseDate of ['', '2099-02-30', null]) {
    fs.writeFileSync(path.join(root, 'backend/about.json'), JSON.stringify({ releaseDate }));
    const before = snapshot(root);
    assert.throws(() => readDevelopmentAboutInfo({ root }), /valid release date/);
    assert.deepEqual(snapshot(root), before);
  }
});
