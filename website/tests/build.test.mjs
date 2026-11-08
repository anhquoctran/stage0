import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import test from 'node:test';

const output = new URL('../../dist/website/', import.meta.url);

test('GitHub Pages contains prerendered HTML, hashed bundles, metadata and static assets', () => {
  const html = readFileSync(new URL('index.html', output), 'utf8');
  const assets = readdirSync(new URL('_app/immutable/assets/', output));
  const nodes = readdirSync(new URL('_app/immutable/nodes/', output));
  assert.ok(assets.some((name) => /\.[\w-]+\.css$/.test(name)));
  assert.ok(nodes.some((name) => /\.[\w-]+\.js$/.test(name)));
  for (const name of assets)
    assert.ok(statSync(new URL('_app/immutable/assets/' + name, output)).size > 0);
  assert.doesNotMatch(html, /(?:href|src)="\.\/(?:styles\.css|mockup\.css|app\.js|js\/)/);
  assert.ok(existsSync(new URL('assets/app-icon.svg', output)));
  for (const path of ['src', 'js', 'node_modules', 'package.json', 'pnpm-lock.yaml'])
    assert.equal(existsSync(new URL(path, output)), false);
  assert.match(html, /id="release-schedule"/);
  for (const text of [
    'Quarterly (00:00 UTC)',
    '27th of every month at 00:00:00 UTC',
    'Every day at 00:00:00 UTC',
    '00:00:00 UTC Release Guarantee',
  ])
    assert.ok(html.includes(text));
  assert.match(html, /Autonomous AI Code Review\./);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /rel="canonical" href="https:\/\/anhquoctran.github.io\/stage0\/"/);
  assert.match(html, /id="release-history-stable-only" checked/);
});
