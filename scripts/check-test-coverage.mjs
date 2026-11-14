import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { enforceCoverage, parseLcov, validateCoveragePolicy } from './test-coverage-report.mjs';

export function checkTestCoverage({ root = fileURLToPath(new URL('..', import.meta.url)), baseline } = {}) {
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'shared/test-coverage.json')));
  let previous;
  if (baseline) {
    if (!/^[a-f0-9]{40}$/.test(baseline)) throw Error('Coverage baseline must be an immutable commit');
    const files = execFileSync('git', ['ls-tree', '--name-only', baseline, '--', 'shared/test-coverage.json'], { cwd: root, encoding: 'utf8' });
    if (files.trim()) previous = JSON.parse(execFileSync('git', ['show', `${baseline}:shared/test-coverage.json`], { cwd: root, encoding: 'utf8' }));
  }
  validateCoveragePolicy(policy, previous);
  const reports = {};
  const rows = ['| Suite | Lines | Functions | Branches |', '| --- | --- | --- | --- |'];
  const failures = [];
  for (const suite of ['react', 'rust']) {
    const report = parseLcov(fs.readFileSync(path.join(root, policy[suite].report), 'utf8'), policy[suite].scope, root);
    if (suite === 'react') {
      const inventory = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? inventory(file) : /\.tsx?$/.test(entry.name) && !/\.(test|d)\.tsx?$/.test(entry.name) ? [path.relative(root, file).replaceAll('\\', '/')] : [];
      });
      const missing = inventory(path.join(root, 'frontend')).filter(file => !Object.hasOwn(report.files, file));
      if (missing.length) throw Error(`Frontend files excluded from coverage: ${missing.join(', ')}`);
    }
    reports[suite] = { files: Object.keys(report.files).length, ...report.total };
    rows.push(`| ${suite} | ${['lines', 'functions', 'branches'].map(metric => {
      const value = report.total[metric];
      return value.percent === null ? 'Not measured' : `${value.percent.toFixed(2)}% (${value.covered}/${value.total})`;
    }).join(' | ')} |`);
    try { enforceCoverage(report, policy[suite]); } catch (error) { failures.push(`${suite}: ${error.message}`); }
  }
  const markdown = `### Application test coverage\n\n${rows.join('\n')}\n\nFrontend includes untested TS/TSX. Legacy Node/harness tests remain a separate regression gate and are not counted in V8 coverage. Rust branch coverage is not collected on stable Rust; platform coverage comes from the three native regression jobs.\n${failures.length ? '\nFailures:\n' + failures.map(value => `- ${value}`).join('\n') + '\n' : ''}`;
  fs.mkdirSync(path.join(root, 'coverage'), { recursive: true });
  fs.writeFileSync(path.join(root, 'coverage/summary.md'), markdown);
  fs.writeFileSync(path.join(root, 'coverage/summary.json'), JSON.stringify(reports, null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  console.log(markdown);
  if (failures.length) throw Error(failures.join('\n'));
  return reports;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--baseline-ref')) throw Error('Usage: check-test-coverage.mjs [--baseline-ref SHA]');
  checkTestCoverage({ baseline: args[1] });
}
