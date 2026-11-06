// Standalone: CI extracts this runner from the trusted baseline commit before
// executing candidate code. Do not add imports from the candidate checkout.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const CATALOG = 'shared/release-regressions.json';
const SUPPORT = new Set(['scripts/helpers/componentHarness.mjs', 'scripts/helpers/translationText.mjs', 'scripts/helpers/hookHarness.mjs', 'backend/src/features/updates/fixtures/', 'backend/test-data/']);
export const PINNED = ['scripts/release-regression-runner.mjs', '.github/workflows/regression.yml'];
function git(root, ...args) { return execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 }); }
function pathsAt(root, sha, prefix) {
  return git(root, 'ls-tree', '-r', '-z', '--name-only', sha, '--', prefix).toString().split('\0').filter(Boolean);
}
function bytesAt(root, sha, file) { return git(root, 'show', `${sha}:${file}`); }
function safeFile(root, file) {
  if (!file || file.includes('\\') || path.isAbsolute(file) || file.split('/').some(part => ['..', '.', '.git'].includes(part))) throw new Error('Unsafe regression path');
  let current = root;
  for (const part of file.split('/')) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Regression path cannot be a symlink: ${file}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return current;
}
export function validateCatalog(value) {
  if (value?.version !== 1 || !Array.isArray(value.cases) || !value.cases.length || !Array.isArray(value.support)) throw new Error('Invalid/nonempty regression catalog required');
  const ids = new Set();
  for (const item of value.cases) {
    if (!/^[a-z0-9-]+$/.test(item.id || '') || ids.has(item.id)) throw new Error('Invalid/duplicate regression case');
    ids.add(item.id);
    const pattern = item.runner === 'node' ? /^scripts\/[a-zA-Z0-9_/-]+\.test\.mjs$/
      : item.runner === 'rust' ? /^backend\/src\/[a-zA-Z0-9_/-]*(?:tests|test_contracts)\.rs$/ : null;
    if (!pattern?.test(item.path) || item.path.split('/').includes('..')) throw new Error(`Invalid test file: ${item.path}`);
    if (item.runner === 'rust' && (!Array.isArray(item.tests) || !item.tests.length || item.tests.some(name => !/^[a-zA-Z0-9_:]+$/.test(name)))) throw new Error('Rust cases require exact nonempty test names');
  }
  if (value.support.some(prefix => !SUPPORT.has(prefix))) throw new Error('Unsupported fixture/harness prefix');
  return value;
}
export function preservesFrozenInput(file, before, after) {
  if (after.subarray(0, before.length).equals(before)) return true;
  if (file.startsWith('backend/test-data/') && file.endsWith('.json')) {
    try {
      const oldRows = JSON.parse(before), newRows = JSON.parse(after);
      return Array.isArray(oldRows) && Array.isArray(newRows) && oldRows.every(row =>
        newRows.some(next => Object.keys(row).every(key => isDeepStrictEqual(row[key], next?.[key]))));
    } catch { return false; }
  }
  return false;
}
export function assertCatalogSuperset(baseline, candidate) {
  validateCatalog(baseline); validateCatalog(candidate);
  for (const item of baseline.cases) {
    const next = candidate.cases.find(next => next.id === item.id);
    if (!next || next.runner !== item.runner || next.path !== item.path || item.tests?.some(name => !next.tests?.includes(name))) throw new Error(`Cannot remove/weaken protected regression ${item.id}`);
  }
  if (baseline.support.some(prefix => !candidate.support.includes(prefix))) throw new Error('Cannot remove protected regression fixtures');
}
export function regressionPlan(root, baselineSha, { bootstrap = false } = {}) {
  if (!/^[a-f0-9]{40}$/.test(baselineSha || '')) throw new Error('Use an immutable baseline commit');
  const candidate = validateCatalog(JSON.parse(fs.readFileSync(safeFile(root, CATALOG), 'utf8')));
  const hasBaseline = pathsAt(root, baselineSha, CATALOG).length > 0;
  if (!hasBaseline && !bootstrap) throw new Error('Baseline regression catalog missing; roll out the control plane before release');
  const baseline = hasBaseline ? validateCatalog(JSON.parse(bytesAt(root, baselineSha, CATALOG))) : candidate;
  assertCatalogSuperset(baseline, candidate);
  const controlPlaneChanges = PINNED.filter(file => hasBaseline
    && !bytesAt(root, baselineSha, file).equals(fs.readFileSync(safeFile(root, file))));
  const files = new Map();
  const collect = file => {
    const present = pathsAt(root, baselineSha, file).includes(file);
    const source = present ? bytesAt(root, baselineSha, file) : bootstrap ? fs.readFileSync(safeFile(root, file)) : null;
    if (!source) throw new Error(`Regression file missing from baseline: ${file}`);
    const candidateFile = safeFile(root, file);
    if (!fs.existsSync(candidateFile)) throw new Error(`Protected regression file missing: ${file}`);
    const next = fs.readFileSync(candidateFile);
    if (file.startsWith('scripts/helpers/') && !next.equals(source)) {
      controlPlaneChanges.push(file); // Reviewed adapters may evolve; frozen assertions still execute.
    } else {
      if (present && !preservesFrozenInput(file, source, next)) throw new Error(`Protected regression file may only grow without weakening old cases: ${file}`);
      files.set(file, source);
    }
  };
  for (const item of baseline.cases) collect(item.path);
  for (const prefix of baseline.support) {
    const candidates = new Set(pathsAt(root, baselineSha, prefix));
    if (!hasBaseline && fs.existsSync(safeFile(root, prefix.replace(/\/$/, '')))) {
      if (fs.statSync(path.join(root, prefix)).isFile()) candidates.add(prefix);
      else for (const file of fs.readdirSync(path.join(root, prefix), { recursive: true })) {
        if (fs.statSync(path.join(root, prefix, file)).isFile()) candidates.add(prefix + file);
      }
    }
    for (const file of candidates) collect(file);
  }
  return { baseline, files, bootstrap: !hasBaseline, controlPlaneChanges };
}

/** Same checkout, frozen tests only; restore bytes/modes even when a test fails. */
export function runFrozenRegressions({ root = process.cwd(), baselineSha, mode = 'node', bootstrap = false,
  execute = (command, args) => execFileSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }) }) {
  if (!['node', 'rust'].includes(mode)) throw new Error('Mode must be node or rust');
  const plan = regressionPlan(root, baselineSha, { bootstrap }), backups = [];
  const cases = plan.baseline.cases.filter(item => item.runner === mode);
  if (!cases.length) throw new Error(`No ${mode} regressions registered`);
  try {
    for (const [file, bytes] of plan.files) {
      if (file.startsWith('backend/src/') && !cases.some(item => item.path === file) && !file.includes('/fixtures/')) continue;
      if (file.endsWith('.test.mjs') && !cases.some(item => item.path === file)) continue;
      const location = safeFile(root, file);
      backups.push({ location, bytes: fs.readFileSync(location), mode: fs.statSync(location).mode });
      fs.writeFileSync(location, bytes);
    }
    if (mode === 'node') {
      const output = execute(process.execPath, ['--test', '--test-reporter=tap', ...new Set(cases.map(item => item.path))]);
      const tests = Number(output.match(/^# tests (\d+)$/m)?.[1]), failures = Number(output.match(/^# fail (\d+)$/m)?.[1]);
      if (!(tests > 0) || failures !== 0 || !/^# skipped 0$/m.test(output) || !/^# todo 0$/m.test(output)) throw new Error('Frozen Node suite must pass without skipped/todo tests');
      console.log(output);
    } else {
      const expected = [...new Set(cases.flatMap(item => item.tests))];
      const listing = execute('cargo', ['test', '--locked', '--manifest-path', 'backend/Cargo.toml', '--lib', '--', '--list']);
      const listed = new Set(listing.split(/\r?\n/).filter(line => line.endsWith(': test')).map(line => line.slice(0, -6)));
      for (const name of expected) if (!listed.has(name)) throw new Error(`Protected Rust test is no longer registered: ${name}`);
      for (const name of expected) {
        const output = execute('cargo', ['test', '--locked', '--manifest-path', 'backend/Cargo.toml', '--lib', '--', '--exact', name, '--include-ignored']);
        if (!/test result: ok\. 1 passed; 0 failed; 0 ignored;/.test(output)) throw new Error(`Protected Rust test did not run successfully: ${name}`);
        console.log(`Protected Rust regression passed: ${name}`);
      }
    }
    return { cases: cases.length, bootstrap: plan.bootstrap };
  } finally {
    for (const backup of backups.reverse()) { fs.writeFileSync(backup.location, backup.bytes); fs.chmodSync(backup.location, backup.mode); }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [baselineSha, mode] = process.argv.slice(2);
  console.log(JSON.stringify(runFrozenRegressions({ baselineSha, mode, bootstrap: process.env.REGRESSION_BOOTSTRAP === 'true' })));
}
