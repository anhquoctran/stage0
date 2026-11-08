import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { prepareTagMetadata } from './prepare-tag-metadata.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-tag-metadata-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'backend'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.0.10-nightly' }));
  const legacy = { name: 'Stage0', packageVersion: '0.0.10-nightly', gitCommit: 'ed02755',
    version: '0.0.10-nightly+ed02755.linux.amd64', releaseDate: '2025-12-31', os: 'linux', arch: 'amd64' };
  fs.writeFileSync(path.join(root, 'backend/about.json'), JSON.stringify(legacy));
  return { root, legacy };
}

function errors(file) {
  const program = ts.createProgram([file], { noEmit: true, skipLibCheck: true, types: [], target: ts.ScriptTarget.ES2022 });
  return ts.getPreEmitDiagnostics(program).filter(item => item.category === ts.DiagnosticCategory.Error);
}

test('an older preloaded controller payload is regenerated to the tag type before compilation', t => {
  const { root, legacy } = fixture(t);
  const base = path.join(root, 'frontend/features/about');
  fs.mkdirSync(path.join(base, 'types'), { recursive: true });
  fs.mkdirSync(path.join(base, 'config'));
  fs.copyFileSync(new URL('../frontend/features/about/types/SoftwareAboutInfo.ts', import.meta.url), path.join(base, 'types/SoftwareAboutInfo.ts'));
  const generated = path.join(base, 'config/about.ts');
  fs.writeFileSync(generated, `import type { SoftwareAboutInfo } from '../types/SoftwareAboutInfo';\nexport const SOFTWARE_ABOUT: SoftwareAboutInfo = ${JSON.stringify(legacy)};`);
  assert.ok(errors(generated).some(item => item.code === 2353), 'legacy gitCommit reproduces the release failure');
  const info = prepareTagMetadata({ root });
  assert.deepEqual(errors(generated), []);
  assert.equal(info.version, '0.0.10-nightly+linux.amd64');
  assert.equal(info.releaseDate, legacy.releaseDate);
  assert.equal(Object.hasOwn(info, 'gitCommit'), false);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'backend/about.json'), 'utf8'), /gitCommit|ed02755/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'backend/hooks.nsh'), 'utf8'), /ed02755/);
});

test('matrix builds use their own target without changing the frozen release date', t => {
  for (const [platform, arch, suffix] of [['linux', 'x64', 'linux.amd64'], ['windows', 'arm64', 'windows.aarch64'], ['macos', 'x64', 'macos.amd64']]) {
    const { root } = fixture(t);
    const info = prepareTagMetadata({ root, os: platform, arch });
    assert.equal(info.version, `0.0.10-nightly+${suffix}`);
    assert.equal(info.releaseDate, '2025-12-31');
  }
});

test('invalid snapshot version or calendar date fails before writing generated files', t => {
  for (const patch of [{ packageVersion: '0.0.9-nightly' }, { releaseDate: '2026-02-30' }, { releaseDate: '' }]) {
    const { root, legacy } = fixture(t);
    const snapshot = JSON.stringify({ ...legacy, ...patch });
    fs.writeFileSync(path.join(root, 'backend/about.json'), snapshot);
    assert.throws(() => prepareTagMetadata({ root }), /mismatch|frozen release date/);
    assert.equal(fs.readFileSync(path.join(root, 'backend/about.json'), 'utf8'), snapshot);
    assert.equal(fs.existsSync(path.join(root, 'frontend')), false);
  }
});

test('tag validation regenerates before typecheck and packaging uses the same preparation', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  const validate = workflow.slice(workflow.indexOf('  validate:'), workflow.indexOf('  build:'));
  assert.ok(validate.indexOf('scripts/prepare-tag-metadata.mjs') > validate.indexOf('scripts/release-artifacts.mjs version'));
  assert.ok(validate.indexOf('scripts/prepare-tag-metadata.mjs') < validate.indexOf('pnpm typecheck'));
  const build = workflow.slice(workflow.indexOf('  build:'), workflow.indexOf('  publish:'));
  assert.ok(build.indexOf('scripts/prepare-tag-metadata.mjs') < build.indexOf('pnpm exec tauri build'));
});
