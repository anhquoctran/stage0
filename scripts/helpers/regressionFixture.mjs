import fs from 'node:fs';
import path from 'node:path';

export function seedRegressionFixture(root) {
  const files = {
    'src/regression-fixture.mjs': 'export const safe = true;\n',
    'scripts/fixture.test.mjs': "import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { safe } from '../src/regression-fixture.mjs';\ntest('old safety contract', () => assert.equal(safe, true));\n",
    'backend/src/fixture_tests.rs': '#[test]\nfn holds() { assert!(true); }\n',
    'scripts/release-regression-runner.mjs': '// baseline controller\n',
    '.github/workflows/regression.yml': '# baseline workflow\n',
    '.github/workflows/release.yml': '# baseline release workflow\n',
    'scripts/release-regression-preservation.mjs': '// baseline policy\n',
  };
  const catalog = { version: 1, support: [], cases: [
    { id: 'fixture-safety', runner: 'node', path: 'scripts/fixture.test.mjs' },
    { id: 'fixture-rust', runner: 'rust', path: 'backend/src/fixture_tests.rs', tests: ['fixture_tests::holds'] },
  ] };
  files['shared/release-regressions.json'] = `${JSON.stringify(catalog)}\n`;
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return catalog;
}
