import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { configureRegressionChecks, regressionRuleset, regressionChecks, protectedTestBranches } from './configure-regression-checks.mjs';

const existing = () => ({ id: 42, name: 'Stage0 integration Actions checks', target: 'branch', enforcement: 'active', bypass_actors: [],
  conditions: { ref_name: { include: ['refs/heads/develop', 'refs/heads/nightly', 'refs/heads/beta'], exclude: [] } },
  rules: [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'Existing check', integration_id: 99 }], strict_required_status_checks_policy: true } }, { type: 'non_fast_forward' }] });

function fixture(brokenBranch) {
  const writes = [];
  const api = (endpoint, options = {}) => {
    if (options.method === 'PUT') { writes.push({ endpoint, body: options.body }); return options.body; }
    if (endpoint.startsWith('contents/')) return { content: Buffer.from(endpoint.endsWith(`ref=${brokenBranch}`) ? 'jobs: {}' : fs.readFileSync(new URL('../.github/workflows/regression.yml', import.meta.url))).toString('base64') };
    if (endpoint.startsWith('rulesets?')) return [{ id: 42, name: existing().name }];
    if (endpoint === 'rulesets/42') return existing();
    if (endpoint.startsWith('rules/branches/')) return [{ type: 'required_status_checks', parameters: { required_status_checks: regressionChecks } }];
    throw Error(endpoint);
  };
  return { api, writes };
}

test('Main gets all native regression gates while existing checks/protections are preserved', () => {
  const before = existing(); const result = regressionRuleset(before);
  assert.deepEqual(result.conditions.ref_name.include, protectedTestBranches.map(branch => `refs/heads/${branch}`));
  assert.deepEqual(result.rules[0].parameters.required_status_checks, [{ context: 'Existing check', integration_id: 99 }, ...regressionChecks]);
  assert.equal(result.rules[0].parameters.strict_required_status_checks_policy, true);
  assert.deepEqual(result.rules[1], { type: 'non_fast_forward' });
  assert.equal(before.rules[0].parameters.required_status_checks.length, 1);
  assert.throws(() => regressionRuleset({ ...existing(), bypass_actors: [{ actor_id: 1 }] }), /bypass/);
});

test('preflight refuses missing workflows before writes; dry-run never mutates GitHub', () => {
  const broken = fixture('main');
  assert.throws(() => configureRegressionChecks({ api: broken.api, apply: true }), /main: regression workflow/);
  assert.equal(broken.writes.length, 0);
  const ready = fixture();
  assert.equal(configureRegressionChecks({ api: ready.api }).applied, false);
  assert.equal(ready.writes.length, 0);
  configureRegressionChecks({ api: ready.api, apply: true });
  assert.deepEqual(ready.writes.map(write => write.endpoint), ['rulesets/42']);
});
