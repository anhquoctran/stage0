import assert from 'node:assert/strict';
import test from 'node:test';
import { computeAboutInfo, renderFrontendAbout } from './generate-about-info.mjs';
import { frontendOwners } from './check-source-ownership.mjs';

test('generated metadata imports its canonical type rather than recreating it', () => {
  const source = renderFrontendAbout(computeAboutInfo());
  assert.deepEqual(frontendOwners(source, 'about.ts'), []);
  assert.match(source, /import type \{ SoftwareAboutInfo \} from '\.\.\/types\/SoftwareAboutInfo'/);
  assert.match(source, /export const SOFTWARE_ABOUT: SoftwareAboutInfo/);
});

test('computeAboutInfo includes only OS and architecture in version build metadata', () => {
  const info = computeAboutInfo();

  // Pattern: <major>.<minor>.<patch>+<os>.<arch>
  const versionParts = info.version.split('+');
  assert.equal(versionParts.length, 2, 'Version should contain build metadata starting with +');

  const [packageVersion, buildMeta] = versionParts;
  assert.equal(packageVersion, info.packageVersion);

  const metaParts = buildMeta.split('.');
  assert.equal(metaParts.length, 2, 'Build metadata should be formatted as <os>.<arch>');
  assert.equal(metaParts[0], info.os, 'First part should be OS name');
  assert.equal(metaParts[1], info.arch, 'Second part should be architecture name');
  assert.equal('gitCommit' in info, false, 'About metadata must not expose a commit digest');
});

test('GIT_COMMIT cannot change or reappear in generated version information', () => {
  const previousCommit = process.env.GIT_COMMIT;
  process.env.GIT_COMMIT = 'deadbeef';

  try {
    const info = computeAboutInfo({ os: 'windows', arch: 'x64' });
    assert.equal(info.version, `${info.packageVersion}+windows.amd64`);
    assert.equal(JSON.stringify(info).includes('deadbeef'), false);
    assert.equal(Object.hasOwn(info, 'gitCommit'), false);
  } finally {
    if (previousCommit === undefined) delete process.env.GIT_COMMIT;
    else process.env.GIT_COMMIT = previousCommit;
  }
});

test('normalizes 64-bit architectures to amd64 and aarch64', () => {
  // 64-bit x86: amd64 / x64 / x86_64 -> amd64
  for (const raw of ['x64', 'amd64', 'x86_64', 'x86-64']) {
    const info = computeAboutInfo({ os: 'linux', arch: raw });
    assert.equal(info.arch, 'amd64', `Expected ${raw} to normalize to amd64`);
    assert.equal(
      info.version,
      `${info.packageVersion}+linux.amd64`
    );
  }

  // 64-bit ARM: arm64 / aarch64 -> aarch64
  for (const raw of ['arm64', 'aarch64']) {
    const info = computeAboutInfo({ os: 'macos', arch: raw });
    assert.equal(info.arch, 'aarch64', `Expected ${raw} to normalize to aarch64`);
    assert.equal(
      info.version,
      `${info.packageVersion}+macos.aarch64`
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
      `${info.packageVersion}+windows.i386`
    );
  }

  // 32-bit ARM: arm / armhf / armv7l -> arm
  for (const raw of ['arm', 'armhf', 'armv7l']) {
    const info = computeAboutInfo({ os: 'linux', arch: raw });
    assert.equal(info.arch, 'arm', `Expected ${raw} to normalize to arm`);
    assert.equal(
      info.version,
      `${info.packageVersion}+linux.arm`
    );
  }
});
