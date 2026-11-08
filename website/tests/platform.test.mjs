import assert from 'node:assert/strict';
import test from 'node:test';
import { detectDevice, normalizeArchitecture } from '../src/lib/releases/platform.js';
import {
  stableRecommendation,
  recommendedKey,
  downloadFor,
} from '../src/lib/releases/recommendation.js';
import { sanitizeReleases } from '../src/lib/releases/catalog.js';

const archive = 'https://github.com/anhquoctran/stage0/releases';
const makeRelease = (tag, names) => ({
  tag_name: tag,
  assets: names.map((name) => ({
    name,
    browser_download_url: `${archive}/download/${tag}/${name}`,
    size: 104857600,
  })),
});
function platform({ hints, renderer, ...properties }) {
  const navigator = {
    ...properties,
    userAgentData: hints && { ...hints, getHighEntropyValues: async () => hints },
  };
  const document = {
    createElement: () => ({
      getContext: () =>
        renderer
          ? { getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1 }), getParameter: () => renderer }
          : null,
    }),
  };
  return detectDevice(navigator, document);
}
const macUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15';
const mac = makeRelease('v0.0.5', [
  'aarch64-apple-darwin-Stage0.dmg',
  'x86_64-apple-darwin-Stage0.dmg',
]);
const linux = makeRelease('v0.0.5', [
  'aarch64-unknown-linux-gnu-Stage0.deb',
  'x86_64-unknown-linux-gnu-Stage0.AppImage',
  'x86_64-unknown-linux-gnu-Stage0.deb',
  'x86_64-unknown-linux-gnu-Stage0.rpm',
]);
const windows = makeRelease('v0.0.5', ['x86_64-pc-windows-msvc-Stage0.exe']);
for (const [name, data, arch, key] of [
  [
    'macOS ARM client hints highlight Apple Silicon and route the hero to that build',
    { hints: { architecture: 'arm', bitness: '64', platform: 'macOS' } },
    'arm64',
    'macArm',
  ],
  [
    'macOS Intel client hints highlight Intel and route the hero to that build',
    { hints: { architecture: 'x86', bitness: '64', platform: 'macOS' } },
    'x64',
    'macIntel',
  ],
  [
    'Safari renderer detection recommends Apple Silicon on an M-series Mac',
    { renderer: 'Apple M1 Pro' },
    'arm64',
    'macArm',
  ],
  [
    'Safari renderer detection recommends Intel on an Intel Mac',
    { renderer: 'AMD Radeon Pro 5500M OpenGL Engine' },
    'x64',
    'macIntel',
  ],
  [
    'Mac platform and user-agent evidence wins over conflicting Windows client hints',
    { renderer: 'Apple M1 Pro', hints: { platform: 'Windows' } },
    'arm64',
    'macArm',
  ],
])
  test(name, async () => {
    const device = await platform({ platform: 'MacIntel', userAgent: macUA, ...data });
    assert.equal(device.os, 'macos');
    assert.equal(device.arch, arch);
    assert.equal(recommendedKey(device), key);
    assert.equal(stableRecommendation([mac], device).url, downloadFor(mac, key).url);
    assert.equal(stableRecommendation([mac], device).text, 'Download for macOS');
  });

test('Firefox Linux UA overrides the Mac host platform in responsive device emulation', async () => {
  const device = await platform({
    platform: 'MacIntel',
    userAgent: 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
  });
  assert.equal(device.os, 'linux');
  assert.equal(recommendedKey(device), 'linuxRpm');
  assert.match(stableRecommendation([linux], device).url, /\.rpm$/);
  assert.equal(stableRecommendation([linux], device).label, '(x64 .rpm · 100 MB)');
});

test('Windows and Linux recommend their exact primary download buttons', async () => {
  assert.equal(
    recommendedKey(await platform({ platform: 'Win32', userAgent: 'Windows Win64 x64' })),
    'windowsExe',
  );
  const device = await platform({ platform: 'Linux x86_64', userAgent: 'X11 Linux x86_64' });
  assert.equal(recommendedKey(device), 'linuxAppImage');
  assert.match(stableRecommendation([linux], device).url, /\.AppImage$/);
});

test('hero quick download stays on the newest stable release when another channel is selected', () => {
  const older = makeRelease('v0.0.4', ['x86_64-pc-windows-msvc-Stage0.exe']);
  const beta = makeRelease('v0.0.6-beta', ['x86_64-pc-windows-msvc-Stage0.exe']);
  assert.match(
    stableRecommendation([beta, windows, older], { os: 'windows', arch: 'x64' }).url,
    /\/v0\.0\.5\//,
  );
});

test('Windows ARM uses the newest stable ARM64 installer and mobile or unknown devices fall back to Windows x64', async () => {
  const arm = makeRelease('v0.0.4', ['aarch64-pc-windows-msvc-Stage0.exe']);
  const beta = makeRelease('v0.0.6-beta', ['aarch64-pc-windows-msvc-Stage0.exe']);
  const device = await platform({
    platform: 'Win32',
    userAgent: 'Windows Win64 ARM64',
    hints: { platform: 'Windows', architecture: 'arm', bitness: '64' },
  });
  assert.match(stableRecommendation([beta, windows, arm], device).url, /v0\.0\.4.*aarch64/);
  assert.match(stableRecommendation([beta, windows, arm], device).label, /^\(ARM64 \.exe/);
  for (const properties of [
    { platform: 'iPhone', userAgent: 'iPhone CPU iPhone OS 18_0 like Mac OS X' },
    { platform: 'Linux armv8l', userAgent: 'Linux Android 15 Pixel' },
    { platform: '', userAgent: 'UnknownDevice' },
  ]) {
    const hero = stableRecommendation([beta, windows, arm], await platform(properties));
    assert.match(hero.url, /v0\.0\.5.*x86_64/);
    assert.equal(hero.text, 'Download for Windows');
    assert.match(hero.label, /^\(64-bit \.exe/);
  }
});

test('Linux ARM selects a matching stable ARM64 package', async () => {
  const device = await platform({
    platform: 'Linux aarch64',
    userAgent: 'X11 Ubuntu Linux aarch64',
  });
  assert.match(stableRecommendation([linux], device).url, /aarch64.*\.deb$/);
  assert.match(stableRecommendation([linux], device).label, /^\(ARM64 \.deb/);
});

test('an empty channel never leaves download buttons pointing at another channel', () => {
  assert.equal(downloadFor(null, 'windowsExe').url, archive);
});

test('Linux distro hints highlight the matching package and use AppImage when the package is unavailable', async () => {
  for (const [distro, extension, key] of [
    ['Ubuntu', '.deb', 'linuxDeb'],
    ['Fedora', '.rpm', 'linuxRpm'],
  ]) {
    const device = await platform({
      platform: 'Linux x86_64',
      userAgent: `X11 ${distro} Linux x86_64`,
    });
    assert.equal(recommendedKey(device), key);
    assert.ok(stableRecommendation([linux], device).url.endsWith(extension));
  }
  const device = await platform({ platform: 'Linux x86_64', userAgent: 'X11 Ubuntu Linux x86_64' });
  const appImage = makeRelease('v0.0.5', ['x86_64-unknown-linux-gnu-Stage0.AppImage']);
  assert.match(stableRecommendation([appImage], device).url, /\.AppImage$/);
});

test('ambiguous Mac user agents do not guess a chip, and iPad desktop mode is not macOS', async () => {
  const device = await platform({ platform: 'MacIntel', userAgent: macUA });
  assert.equal(device.arch, null);
  assert.equal(recommendedKey(device), null);
  assert.match(stableRecommendation([mac], device).label, /Choose Apple Silicon or Intel/);
  for (const userAgent of ['Macintosh Intel Mac OS X', 'iPad CPU OS 18_6 like Mac OS X']) {
    const ipad = await platform({ platform: 'MacIntel', maxTouchPoints: 5, userAgent });
    assert.equal(ipad.os, 'ios');
    assert.equal(stableRecommendation([mac, windows], ipad).text, 'Download for Windows');
  }
});

test('untrusted assets, drafts and unsupported architectures never become direct download links', () => {
  assert.equal(sanitizeReleases([{ ...windows, draft: true }]).length, 0);
  const unsafe = sanitizeReleases([
    {
      ...windows,
      assets: [
        {
          name: windows.assets[0].name,
          browser_download_url: 'https://evil.example/installer.exe',
        },
      ],
    },
  ]);
  assert.equal(unsafe[0].assets.length, 0);
  assert.equal(normalizeArchitecture('arm', '32'), null);
  assert.equal(normalizeArchitecture('x86', '32'), null);
  assert.equal(normalizeArchitecture('x86', '64'), 'x64');
});

test('standalone Linux tarballs retain their selected-version download and size', () => {
  const release = makeRelease('v0.0.5', ['x86_64-unknown-linux-gnu-Stage0.tar.gz']);
  assert.match(downloadFor(release, 'tarArchive').url, /v0\.0\.5.*\.tar\.gz$/);
  assert.equal(downloadFor(release, 'tarArchive').size, '100 MB');
});
