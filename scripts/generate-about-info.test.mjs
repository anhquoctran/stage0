import assert from 'node:assert/strict';
import test from 'node:test';
import { computeAboutInfo } from './generate-about-info.mjs';

test('computeAboutInfo places OS name immediately before arch name in version text', () => {
  const info = computeAboutInfo();

  // Pattern: <major>.<minor>.<patch>+<commit>.<os>.<arch>
  const versionParts = info.version.split('+');
  assert.equal(versionParts.length, 2, 'Version should contain build metadata starting with +');

  const [packageVersion, buildMeta] = versionParts;
  assert.equal(packageVersion, info.packageVersion);

  const metaParts = buildMeta.split('.');
  assert.equal(metaParts.length, 3, 'Build metadata should be formatted as <commit>.<os>.<arch>');
  assert.equal(metaParts[0], info.gitCommit, 'First part should be git commit');
  assert.equal(metaParts[1], info.os, 'Second part should be OS name');
  assert.equal(metaParts[2], info.arch, 'Third part should be architecture name');
});

test('normalizes 64-bit architectures to amd64 and aarch64', () => {
  // 64-bit x86: amd64 / x64 / x86_64 -> amd64
  for (const raw of ['x64', 'amd64', 'x86_64', 'x86-64']) {
    const info = computeAboutInfo({ os: 'linux', arch: raw });
    assert.equal(info.arch, 'amd64', `Expected ${raw} to normalize to amd64`);
    assert.equal(
      info.version,
      `${info.packageVersion}+${info.gitCommit}.linux.amd64`
    );
  }

  // 64-bit ARM: arm64 / aarch64 -> aarch64
  for (const raw of ['arm64', 'aarch64']) {
    const info = computeAboutInfo({ os: 'macos', arch: raw });
    assert.equal(info.arch, 'aarch64', `Expected ${raw} to normalize to aarch64`);
    assert.equal(
      info.version,
      `${info.packageVersion}+${info.gitCommit}.macos.aarch64`
    );
  }
});

test('normalizes 32-bit architectures to i386 and arm', () => {
  // 32-bit x86: x86 / ia32 / i386 / i686 -> i386
  for (const raw of ['x86', 'ia32', 'i386', 'i686']) {
    const info = computeAboutInfo({ os: 'windows', arch: raw });
    assert.equal(info.arch, 'i386', `Expected ${raw} to normalize to i386`);
    assert.equal(
      info.version,
      `${info.packageVersion}+${info.gitCommit}.windows.i386`
    );
  }

  // 32-bit ARM: arm / armhf / armv7l -> arm
  for (const raw of ['arm', 'armhf', 'armv7l']) {
    const info = computeAboutInfo({ os: 'linux', arch: raw });
    assert.equal(info.arch, 'arm', `Expected ${raw} to normalize to arm`);
    assert.equal(
      info.version,
      `${info.packageVersion}+${info.gitCommit}.linux.arm`
    );
  }
});
