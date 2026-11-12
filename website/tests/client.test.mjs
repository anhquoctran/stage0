import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchReleases, readCache, writeCache } from '../src/lib/releases/client.js';
import {
  releaseChannelFromTag,
  matchingAssets,
  formatAssetSize,
  formatAssetDigest,
  isTrustedReleaseUrl,
  pageNumbers,
} from '../src/lib/releases/catalog.js';

test('channels accept supported historical tags and reject malformed tags', () => {
  for (const tag of ['v0.0.4', 'v1.2.3']) assert.equal(releaseChannelFromTag(tag), 'stable');
  for (const channel of ['beta'])
    for (const tag of [`v1.2.3-${channel}`, `v1.2.3-${channel}.20261108.1`])
      assert.equal(releaseChannelFromTag(tag), channel);
  for (const tag of [
    '1.2.3',
    'v01.2.3',
    'v1.2.3-rc',
    'v1.2.3-nightly+evil',
    'v1.2.3-nightly',
    'v1.2.3-nightly.20261108.1',
  ])
    assert.equal(releaseChannelFromTag(tag), null);
});

test('asset labels, SHA256 and release URLs are validated', () => {
  assert.equal(formatAssetSize(10485760), '10 MB');
  assert.equal(formatAssetSize(0), '');
  assert.equal(formatAssetSize(-1), '');
  assert.equal(formatAssetDigest('sha256:' + 'A'.repeat(64)), 'a'.repeat(64));
  assert.equal(formatAssetDigest('sha256:not-a-digest'), '');
  for (const url of [
    'javascript:alert(1)',
    'https://github.com.evil.org/anhquoctran/stage0/releases/foo',
    'https://github.com/evil/stage0/releases/foo',
  ])
    assert.equal(isTrustedReleaseUrl(url), false);
  assert.deepEqual(
    matchingAssets({
      assets: [
        {
          name: 'stage0.exe.sig',
          browser_download_url:
            'https://github.com/anhquoctran/stage0/releases/download/v1.0.1/stage0.exe.sig',
        },
      ],
    }),
    [],
  );
});

test('pagination bounds controls at start, middle and end of large archives', () => {
  for (let page = 1; page <= 100; page++) {
    const controls = pageNumbers(page, 100);
    assert.ok(controls.length <= 7);
    assert.ok(controls.includes(page));
    assert.equal(controls[0], 1);
    assert.equal(controls.at(-1), 100);
  }
});

test('cache validates age, keeps complete API pages and tolerates denied storage', () => {
  let raw;
  const storage = { getItem: () => raw, setItem: (_key, value) => (raw = value) };
  writeCache({ releases: [], apiPage: 2, hasMore: true }, storage);
  assert.equal(readCache(storage).apiPage, 2);
  assert.equal(readCache(storage, Date.now() + 600001), null);
  assert.equal(readCache(storage, 0), null);
  raw = '{';
  assert.equal(readCache(storage), null);
  raw = undefined;
  writeCache({ releases: Array(501).fill({}), apiPage: 6, hasMore: true }, storage);
  assert.equal(raw, undefined);
  const denied = {
    getItem: () => {
      throw Error('denied');
    },
    setItem: () => {
      throw Error('denied');
    },
  };
  assert.equal(readCache(denied), null);
  assert.doesNotThrow(() => writeCache({}, denied));
});

test('transient API errors retry once, permanent errors do not, cancellation propagates', async () => {
  let attempts = 0;
  const signal = new AbortController().signal;
  const result = await fetchReleases(2, signal, async (url) => {
    assert.match(url, /per_page=100&page=2/);
    attempts++;
    return attempts === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => [] };
  });
  assert.equal(attempts, 2);
  assert.equal(result.hasMore, false);
  attempts = 0;
  await assert.rejects(
    fetchReleases(1, signal, async () => {
      attempts++;
      return { ok: false, status: 403 };
    }),
    /rate limit/,
  );
  assert.equal(attempts, 1);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    fetchReleases(1, controller.signal, async (_url, { signal }) => signal.throwIfAborted()),
  );
});
