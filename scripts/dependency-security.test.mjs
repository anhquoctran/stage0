import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(path.join(root, file), 'utf8');

test('all locked source-map-js copies include the indexed source-map DoS fix', () => {
  const lock = read('pnpm-lock.yaml');
  const versions = [...lock.matchAll(/^\s+source-map-js@([\d.]+):/gm)].map((match) => match[1]);
  assert.ok(versions.length > 0);
  for (const version of versions) {
    const [major, minor, patch] = version.split('.').map(Number);
    assert.ok(major > 1 || (major === 1 && (minor > 2 || (minor === 2 && patch >= 2))), version);
  }
});

test('the bundler source-map consumer rejects malicious section offsets', () => {
  const require = createRequire(import.meta.url);
  const fromVite = createRequire(require.resolve('vite/package.json'));
  const fromPostcss = createRequire(fromVite.resolve('postcss'));
  const { SourceMapConsumer } = fromPostcss('source-map-js');
  const map = { version: 3, sources: ['input.js'], names: [], mappings: 'AAAA' };
  const indexed = (line) => ({ version: 3, sections: [{ offset: { line, column: 0 }, map }] });
  assert.throws(() => new SourceMapConsumer(indexed(10_000_001)), /Section offset line must not exceed/);
  assert.throws(() => new SourceMapConsumer(indexed(Infinity)), /non-negative integers/);
  assert.deepEqual(new SourceMapConsumer(indexed(0)).sources, ['input.js']);
});

test('the application resolves GTK3 glib to the local security backport', () => {
  const manifest = read('backend/Cargo.toml');
  assert.match(manifest, /\[patch\.crates-io\][^[]*glib\s*=\s*\{\s*path\s*=\s*"vendor\/glib"\s*\}/);
  const packages = read('backend/Cargo.lock').split('[[package]]')
    .filter((entry) => /^name = "glib"$/m.test(entry));
  assert.equal(packages.length, 1);
  assert.match(packages[0], /^version = "0\.18\.5"$/m);
  assert.doesNotMatch(packages[0], /^source = /m, 'Registry GLib would bypass the local backport');
});

test('vendored glib differs from its verified distribution only by the upstream two-line fix', () => {
  const directory = path.join(root, 'backend/vendor/glib');
  const provenance = JSON.parse(read('backend/vendor/glib/UPSTREAM-SHA256.json'));
  assert.equal(provenance.distributionSha256, '233daaf6e83ae6a12a52055f568f9d7cf4671dabb78ff9560ab6da230ce00ee5');
  assert.equal(Object.keys(provenance.files).length, 121);
  for (const [file, expectedHash] of Object.entries(provenance.files)) {
    let source = readFileSync(path.join(directory, file), 'utf8');
    if (file === 'src/variant_iter.rs') {
      assert.match(source, /let mut p: \*mut libc::c_char = std::ptr::null_mut\(\);/);
      assert.match(source, /ffi::g_variant_get_child\([\s\S]*?&mut p,/);
      source = source.replace('let mut p: *mut libc::c_char', 'let p: *mut libc::c_char')
        .replace('                &mut p,', '                &p,');
    }
    assert.equal(createHash('sha256').update(source).digest('hex'), expectedHash, file);
  }
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && entry.name === 'target') return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [path.relative(directory, file).replaceAll('\\', '/')];
  });
  const extras = walk(directory).filter((file) => !Object.hasOwn(provenance.files, file));
  assert.deepEqual(extras.sort(), ['PATCHES.md', 'UPSTREAM-SHA256.json']);
});
