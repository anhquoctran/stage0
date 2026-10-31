import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../website/js/release-history.js', import.meta.url), 'utf8');

function makeClassList() {
  const values = new Set();
  return {
    toggle(name, force) {
      if (force === undefined ? !values.has(name) : force) values.add(name);
      else values.delete(name);
      return values.has(name);
    },
    contains(name) { return values.has(name); },
  };
}

class Element {
  constructor(attributes = {}) {
    this.attributes = { ...attributes };
    this.children = [];
    this.classList = makeClassList();
    this.listeners = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
  }

  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  click() { return this.listeners.click?.(); }
}

function makeRelease(version, assets) {
  return {
    tag_name: `v1.0.${version}`,
    html_url: `https://github.com/anhquoctran/stage0/releases/tag/v1.0.${version}`,
    published_at: '2026-10-31T00:00:00Z',
    assets: assets.map((name) => ({
      name,
      browser_download_url: `https://github.com/anhquoctran/stage0/releases/download/v1.0.${version}/${name}`,
      size: 10 * 1024 * 1024,
      digest: `sha256:${String(version).padStart(64, '0')}`,
    })),
  };
}

function fixture(responses) {
  const ids = [
    'release-history-open',
    'release-history-list',
    'release-history-status',
    'release-history-previous',
    'release-history-next',
    'release-history-page-label',
    'release-history-retry',
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  const osFilters = ['all', 'windows', 'macos', 'linux'].map((value) => new Element({ 'data-history-os': value }));
  const archFilters = ['all', 'x64', 'arm64'].map((value) => new Element({ 'data-history-arch': value }));
  const stage0 = {
    getConstant: (_name, fallback) => fallback,
    __defineModule(name, value) { this[name] = value; },
  };
  let requestIndex = 0;
  const requests = [];
  const clipboardWrites = [];
  const document = {
    getElementById: (id) => elements[id] ?? null,
    createElement: () => new Element(),
    querySelectorAll(selector) {
      if (selector === '[data-history-os]') return osFilters;
      if (selector === '[data-history-arch]') return archFilters;
      return [];
    },
  };
  const context = {
    window: { Stage0: stage0, location: { hash: '' } },
    document,
    localStorage: { getItem: () => null, setItem() {} },
    navigator: { clipboard: { writeText: async (value) => clipboardWrites.push(value) } },
    fetch: async (url) => {
      requests.push(url);
      const response = responses[requestIndex++];
      if (!response) throw new Error('No response fixture');
      return {
        ok: true,
        headers: { get: (name) => name.toLowerCase() === 'link' ? response.link || '' : null },
        json: async () => response.releases,
      };
    },
    console: { debug() {} },
    URL,
    Date,
  };

  vm.runInNewContext(source, context);
  stage0.releaseHistory.init();
  return { elements, osFilters, archFilters, requests, clipboardWrites };
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

test('release history loads automatically and filters artifacts by operating system and architecture', async () => {
  const view = fixture([{
    releases: [
      makeRelease(1, ['x86_64-pc-windows-msvc-Stage0-setup.exe']),
      makeRelease(2, ['aarch64-pc-windows-msvc-Stage0-arm64-setup.exe']),
      makeRelease(3, ['x86_64-apple-darwin-Stage0.dmg']),
      makeRelease(4, ['aarch64-apple-darwin-Stage0-arm64.dmg']),
      makeRelease(5, ['x86_64-unknown-linux-gnu-Stage0.AppImage']),
      makeRelease(6, ['aarch64-unknown-linux-gnu-Stage0_arm64.deb']),
    ],
  }]);

  await settle();
  assert.equal(view.requests.length, 1);
  assert.equal(view.elements['release-history-list'].children.length, 6);

  const linux = view.osFilters.find((button) => button.getAttribute('data-history-os') === 'linux');
  linux.click();
  assert.equal(linux.getAttribute('aria-pressed'), 'true');
  assert.equal(view.elements['release-history-list'].children.length, 2);

  const arm64 = view.archFilters.find((button) => button.getAttribute('data-history-arch') === 'arm64');
  arm64.click();
  const [linuxArmRelease] = view.elements['release-history-list'].children;
  assert.equal(view.elements['release-history-list'].children.length, 1);
  const assetRow = linuxArmRelease.children[1].children[0].children[0];
  assert.equal(assetRow.className, 'release-history-asset-row');
  assert.equal(assetRow.href, undefined, 'the full row is not a download link');
  assert.equal(assetRow.children[0].className, 'fa-brands fa-linux release-history-asset-logo');
  const details = assetRow.children[1];
  assert.equal(details.className, 'release-history-asset-details');
  assert.equal(details.children[0].textContent, 'Linux');
  assert.equal(details.children[1].textContent, 'ARM64');
  assert.equal(details.children[2].textContent, 'DEB');
  assert.equal(details.children[3].textContent, '10 MB');

  const digestButton = assetRow.children[2];
  const digest = `${'0'.repeat(63)}6`;
  assert.equal(digestButton.className, 'release-history-asset-digest');
  assert.equal(digestButton.children[0].textContent, 'SHA-256');
  assert.equal(digestButton.children[1].textContent, digest);
  await digestButton.click();
  await settle();
  assert.deepEqual(view.clipboardWrites, [digest]);

  const downloadButton = assetRow.children[3];
  assert.equal(downloadButton.className, 'release-history-download-button');
  assert.match(downloadButton.href, /Stage0_arm64\.deb$/);
  assert.equal(downloadButton.children[1].textContent, 'Download');
});

test('release assets sort by OS, architecture, and uppercase extension label', async () => {
  const view = fixture([{
    releases: [makeRelease(7, [
      'x86_64-pc-windows-msvc-Stage0-setup.exe',
      'x86_64-unknown-linux-gnu-Stage0.rpm',
      'x86_64-apple-darwin-Stage0.dmg',
      'aarch64-unknown-linux-gnu-Stage0.rpm',
      'x86_64-unknown-linux-gnu-Stage0.AppImage',
      'aarch64-pc-windows-msvc-Stage0-arm64-setup.exe',
      'aarch64-apple-darwin-Stage0-arm64.dmg',
      'aarch64-unknown-linux-gnu-Stage0.deb',
      'x86_64-unknown-linux-gnu-Stage0.deb',
    ])],
  }]);

  await settle();
  const assetList = view.elements['release-history-list'].children[0].children[1];
  const rows = assetList.children.map(item => item.children[0]);
  const sortedLabels = rows.map(row => row.children[1].children.slice(0, 3).map(value => value.textContent).join(' '));

  assert.deepEqual(sortedLabels, [
    'Linux ARM64 DEB',
    'Linux ARM64 RPM',
    'Linux AMD64 APPIMAGE',
    'Linux AMD64 DEB',
    'Linux AMD64 RPM',
    'macOS ARM64 DMG',
    'macOS AMD64 DMG',
    'Windows ARM64 EXE',
    'Windows AMD64 EXE',
  ]);
});

test('release history paginates loaded results, then fetches the next GitHub page on demand', async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => makeRelease(index, [
    'aarch64-pc-windows-msvc-Stage0-arm64-setup.exe',
  ]));
  const secondPage = [makeRelease(101, ['x86_64-pc-windows-msvc-Stage0-setup.exe'])];
  const view = fixture([
    { releases: firstPage, link: '<https://api.github.com/repos/anhquoctran/stage0/releases?page=2>; rel="next"' },
    { releases: secondPage },
  ]);

  await settle();
  assert.equal(view.elements['release-history-list'].children.length, 10);
  assert.equal(view.elements['release-history-next'].textContent, 'Next');

  await view.elements['release-history-next'].click();
  assert.equal(view.elements['release-history-page-label'].textContent, 'Page 2');
  assert.equal(view.elements['release-history-list'].children.length, 10);
  await view.elements['release-history-previous'].click();
  assert.equal(view.elements['release-history-page-label'].textContent, 'Page 1');

  view.archFilters.find((button) => button.getAttribute('data-history-arch') === 'x64').click();
  assert.equal(view.elements['release-history-list'].children.length, 0);
  await settle();
  assert.equal(view.elements['release-history-next'].textContent, 'Load older');
  assert.equal(view.requests.length, 1);

  await view.elements['release-history-next'].click();
  await settle();
  assert.equal(view.requests.length, 2);
  assert.equal(view.elements['release-history-list'].children.length, 1);
  assert.match(view.elements['release-history-list'].children[0].children[0].children[0].children[0].textContent, /v1\.0\.101/);
  assert.match(view.requests[0], /[?&]page=1/);
  assert.match(view.requests[1], /[?&]page=2/);
});
