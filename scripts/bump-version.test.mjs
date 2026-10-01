import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { bumpProjectPatchVersion, incrementPatch } from './bump-version.mjs';

test('increments only the SemVer PATCH component', () => {
  assert.equal(incrementPatch('0.1.0'), '0.1.1');
  assert.equal(incrementPatch('1.9.12+build.4'), '1.9.13');
  assert.equal(incrementPatch('2.3.4-rc.1+build.7'), '2.3.5');
  assert.throws(() => incrementPatch('v1.2.3'), /not valid SemVer/);
});

test('synchronizes each project manifest once per build invocation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-version-test-'));
  const backend = path.join(root, 'backend');
  fs.mkdirSync(backend);

  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.1.0' }));
  fs.writeFileSync(
    path.join(root, 'package-lock.json'),
    JSON.stringify({ version: '0.1.0', packages: { '': { version: '0.1.0' } } }),
  );
  fs.writeFileSync(path.join(backend, 'Cargo.toml'), '[package]\nname = "stage0"\nversion = "0.1.0"\n');
  fs.writeFileSync(
    path.join(backend, 'Cargo.lock'),
    'version = 4\n\n[[package]]\nname = "stage0"\nversion = "0.1.0"\n',
  );
  fs.writeFileSync(path.join(backend, 'tauri.conf.json'), JSON.stringify({ version: '0.1.0' }));

  try {
    assert.deepEqual(bumpProjectPatchVersion(root), {
      previousVersion: '0.1.0',
      version: '0.1.1',
    });
    assert.deepEqual(bumpProjectPatchVersion(root), {
      previousVersion: '0.1.1',
      version: '0.1.2',
    });

    const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const tauriConfig = JSON.parse(fs.readFileSync(path.join(backend, 'tauri.conf.json'), 'utf8'));
    const cargoToml = fs.readFileSync(path.join(backend, 'Cargo.toml'), 'utf8');
    const cargoLock = fs.readFileSync(path.join(backend, 'Cargo.lock'), 'utf8');

    assert.equal(packageJson.version, '0.1.2');
    assert.equal(packageLock.version, '0.1.2');
    assert.equal(packageLock.packages[''].version, '0.1.2');
    assert.equal(tauriConfig.version, '0.1.2');
    assert.match(cargoToml, /^version = "0\.1\.2"$/m);
    assert.match(cargoLock, /^name = "stage0"\nversion = "0\.1\.2"$/m);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
