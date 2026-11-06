import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { regressionPlan, runFrozenRegressions } from './release-regression-runner.mjs';
import { assertNoTargetReverts, assertRegressionRefs } from './release-regression-preservation.mjs';
import { seedRegressionFixture } from './helpers/regressionFixture.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-regression-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main'); git('config', 'commit.gpgSign', 'false'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  const catalog = seedRegressionFixture(root); git('add', '.'); git('commit', '-m', 'fix: preserve old safety contract');
  return { root, git, catalog, base: git('rev-parse', 'HEAD'), file: name => path.join(root, name) };
}

test('frozen old assertions detect a real reintroduced bug and always restore the candidate files', t => {
  const f = fixture(t);
  fs.appendFileSync(f.file('scripts/fixture.test.mjs'), "test('new coverage', () => assert.ok(true));\n");
  const candidate = fs.readFileSync(f.file('scripts/fixture.test.mjs'));
  assert.equal(runFrozenRegressions({ root: f.root, baselineSha: f.base }).cases, 1);
  assert.deepEqual(fs.readFileSync(f.file('scripts/fixture.test.mjs')), candidate);
  fs.writeFileSync(f.file('src/regression-fixture.mjs'), 'export const safe = false;\n');
  assert.throws(() => runFrozenRegressions({ root: f.root, baselineSha: f.base }), /Command failed/);
  assert.deepEqual(fs.readFileSync(f.file('scripts/fixture.test.mjs')), candidate);
  assert.equal(fs.readFileSync(f.file('src/regression-fixture.mjs'), 'utf8'), 'export const safe = false;\n');
});

test('weakening/removing tests, deleting case IDs or changing Rust filters cannot make old failures green', async t => {
  for (const mutation of ['assertion', 'file', 'case', 'filter']) await t.test(mutation, t => {
    const f = fixture(t);
    if (mutation === 'assertion') fs.writeFileSync(f.file('scripts/fixture.test.mjs'), "import test from 'node:test'; test('noop',()=>{});\n");
    if (mutation === 'file') fs.unlinkSync(f.file('scripts/fixture.test.mjs'));
    if (mutation === 'case') f.catalog.cases.shift();
    if (mutation === 'filter') f.catalog.cases[1].tests = [];
    fs.writeFileSync(f.file('shared/release-regressions.json'), JSON.stringify(f.catalog));
    assert.throws(() => regressionPlan(f.root, f.base));
  });
});

test('unregistered or silently skipped Rust contracts are failures, not successful empty test runs', t => {
  const f = fixture(t);
  assert.throws(() => runFrozenRegressions({ root: f.root, baselineSha: f.base, mode: 'rust', execute: () => '' }), /no longer registered/);
  let n = 0;
  assert.throws(() => runFrozenRegressions({ root: f.root, baselineSha: f.base, mode: 'rust', execute: () =>
    ++n === 1 ? 'fixture_tests::holds: test\n' : 'test result: ok. 0 passed; 0 failed; 1 ignored;\n' }), /did not run/);
});

test('Node skip/todo/zero-test reports fail and unsupported/symlink paths are refused', t => {
  const f = fixture(t);
  assert.throws(() => runFrozenRegressions({ root: f.root, baselineSha: f.base, execute: () => '# tests 0\n# fail 0\n# skipped 0\n# todo 0\n' }), /must pass/);
  fs.unlinkSync(f.file('scripts/fixture.test.mjs'));
  if (process.platform === 'win32') {
    fs.renameSync(f.file('scripts'), f.file('scripts-kept'));
    fs.symlinkSync(f.file('scripts-kept'), f.file('scripts'), 'junction');
  } else fs.symlinkSync(f.file('missing-outside'), f.file('scripts/fixture.test.mjs'));
  assert.throws(() => regressionPlan(f.root, f.base), /symlink/);
});

test('release data checks reject test tampering without executing proposed code; policy changes need separate acknowledgement', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file('.github/workflows/regression.yml'), '# changed control plane\n');
  f.git('add', '.'); f.git('commit', '-m', 'Update CI');
  assert.deepEqual(assertRegressionRefs(f.root, f.base, f.git('rev-parse', 'HEAD')), ['.github/workflows/regression.yml']);
  fs.writeFileSync(f.file('scripts/fixture.test.mjs'), '// removed assertion\n'); f.git('commit', '-am', 'Weaken test');
  assert.throws(() => assertRegressionRefs(f.root, f.base, f.git('rev-parse', 'HEAD')), /Cannot rewrite/);
});

test('an explicit revert of a target commit is blocked even though Git would merge it cleanly', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file('safety'), 'old fix'); f.git('add', '.'); f.git('commit', '-m', 'fix: critical existing behavior');
  const target = f.git('rev-parse', 'HEAD'); f.git('checkout', '-b', 'source');
  f.git('revert', '--no-edit', target);
  assert.throws(() => assertNoTargetReverts(f.root, target, [{ sourceSha: f.git('rev-parse', 'HEAD') }]), /reverts target commit/);
  assert.doesNotThrow(() => assertNoTargetReverts(f.root, f.base, [{ sourceSha: f.git('rev-parse', 'HEAD') }]), 'New unstable work may be reverted within its own period');
});

test('newly registered cases run immediately; additive reference inputs cannot replace an old fixture', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file('scripts/new-case.test.mjs'), "import test from 'node:test'; import assert from 'node:assert/strict'; test('new regression', () => assert.fail('new contract fails'));\n");
  f.catalog.cases.push({ id: 'new-case', runner: 'node', path: 'scripts/new-case.test.mjs' });
  fs.writeFileSync(f.file('shared/release-regressions.json'), JSON.stringify(f.catalog));
  assert.throws(() => runFrozenRegressions({ root: f.root, baselineSha: f.base }), /Command failed/);
});

test('native test summaries remain strict with Windows line endings and release color output', t => {
  const f = fixture(t);
  let calls = 0;
  assert.doesNotThrow(() => runFrozenRegressions({ root: f.root, baselineSha: f.base, mode: 'rust', execute: (_command, args) => {
    calls++;
    return args.includes('--list') ? '\x1b[32mfixture_tests::holds: test\x1b[0m\r\n'
      : '\x1b[32mtest result: ok. 1 passed; 0 failed; 0 ignored;\x1b[0m\r\n';
  } }));
  assert.equal(calls, 4, 'Both frozen and current native contracts must execute');
  assert.doesNotThrow(() => runFrozenRegressions({ root: f.root, baselineSha: f.base,
    execute: () => '# tests 1\r\n# fail 0\r\n# skipped 0\r\n# todo 0\r\n' }));
});
