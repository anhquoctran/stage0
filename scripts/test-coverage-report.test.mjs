import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertReactTestResults } from './strict-react-test-reporter.mjs';
import { checkTestCoverage } from './check-test-coverage.mjs';
import { enforceCoverage, parseLcov, validateCoveragePolicy } from './test-coverage-report.mjs';

const record = (name = 'frontend/a.ts', hit = 1) => `SF:${name}\nFN:1,run\nFNDA:${hit},run\nDA:1,${hit}\nDA:2,0\nBRDA:1,0,0,${hit}\nBRDA:1,0,1,-\nend_of_record\n`;
const policy = JSON.parse(fs.readFileSync(new URL('../shared/test-coverage.json', import.meta.url)));

test('LCOV percentages include uncovered files, zero-hit branches and unsupported branch metrics honestly', () => {
  const report = parseLcov(record() + record('frontend/untested.ts', 0), 'frontend/');
  assert.deepEqual(report.total.lines, { covered: 1, total: 4, percent: 25 });
  assert.deepEqual(report.total.functions, { covered: 1, total: 2, percent: 50 });
  assert.deepEqual(report.total.branches, { covered: 1, total: 4, percent: 25 });
  const rust = parseLcov(record('backend/src/a.rs').replace(/^BRDA:.*\n/gm, ''), 'backend/src/');
  assert.equal(rust.total.branches.percent, null);
});

test('empty, malformed, duplicate and out-of-scope coverage cannot make the gate green', () => {
  for (const value of ['', 'SF:frontend/a.ts\nend_of_record\n', record().replace('DA:1,1', 'DA:1,NaN'), record().replace('DA:1,1', 'DA:1,-1'), record() + record(), record('../frontend/a.ts'), record('scripts/a.ts'), record().replace('end_of_record', '')]) {
    assert.throws(() => parseLcov(value, 'frontend/'));
  }
  const report = parseLcov(record(), 'frontend/');
  assert.throws(() => enforceCoverage(report, { minimum: { lines: 51 }, protectedFiles: {} }), /50.00%/);
  assert.throws(() => enforceCoverage(report, { minimum: { lines: 10 }, protectedFiles: { 'frontend/missing.ts': { lines: 1 } } }), /missing/);
});

test('thresholds cannot be lowered or removed relative to the trusted PR base', () => {
  validateCoveragePolicy(policy);
  validateCoveragePolicy(policy, policy);
  for (const mutate of [
    value => value.react.minimum.lines = 0,
    value => value.react.minimum.branches = policy.react.minimum.branches - 0.1,
    value => delete value.rust.minimum.functions,
    value => delete value.react.protectedFiles['frontend/common/components/CustomSelect.tsx'],
    value => value.react.scope = 'frontend/common/',
    value => value.rust.report = 'coverage/other/lcov.info',
  ]) {
    const candidate = structuredClone(policy); mutate(candidate);
    assert.throws(() => validateCoveragePolicy(candidate, policy));
  }
  const raised = structuredClone(policy); raised.rust.minimum.lines += 1;
  assert.doesNotThrow(() => validateCoveragePolicy(raised, policy));
});

test('the gate rejects omitting even an unprotected frontend source from its denominator', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-coverage-contract-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ['frontend', 'shared', 'coverage/react']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.writeFileSync(path.join(root, 'frontend/a.ts'), 'export const tested = 1;');
  fs.writeFileSync(path.join(root, 'frontend/untested.ts'), 'export const missing = 2;');
  fs.writeFileSync(path.join(root, 'shared/test-coverage.json'), JSON.stringify(policy));
  fs.writeFileSync(path.join(root, 'coverage/react/lcov.info'), record());
  assert.throws(() => checkTestCoverage({ root }), /Frontend files excluded from coverage: frontend\/untested.ts/);
});

test('real React test suites cannot pass through skipped/todo/empty runs or hidden retries', () => {
  const module = results => ({ children: { *allTests() { for (const result of results) yield { result: () => result }; } } });
  for (const state of ['skipped', 'pending', 'failed']) assert.throws(() => assertReactTestResults([module([{ state }])], []), /without failures/);
  assert.throws(() => assertReactTestResults([], []));
  assert.throws(() => assertReactTestResults([module([{ state: 'passed', errors: [new Error('retried')] }])], []));
  assert.throws(() => assertReactTestResults([module([{ state: 'passed' }])], [new Error('unhandled')]));
  assert.doesNotThrow(() => assertReactTestResults([module([{ state: 'passed' }])], []));
});
