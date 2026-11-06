import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { configureReleaseProtection, releaseProtectionRules, enforcementFiles } from './configure-release-protection.mjs';

function fakeApi({ missing = false, allowed = true, existing = [] } = {}) {
  const writes = [];
  const api = (endpoint, options = {}) => {
    if (options.method && options.method !== 'GET') { writes.push({ endpoint, ...options }); return {}; }
    if (endpoint.startsWith('contents/')) {
      if (missing) throw new Error('404');
      const file = endpoint.slice('contents/'.length).split('?')[0];
      return { encoding: 'base64', content: fs.readFileSync(new URL(`../${file}`, import.meta.url)).toString('base64') };
    }
    if (endpoint === 'actions/permissions/workflow') return { can_approve_pull_request_reviews: allowed };
    if (endpoint.startsWith('rulesets?')) return existing;
    throw new Error(`Unexpected API: ${endpoint}`);
  };
  return { api, writes };
}

test('rules protect all channels without bypass and require reviewed, current, adjacent promotions on beta/main', () => {
  const [base, promotion] = releaseProtectionRules();
  assert.equal(base.conditions.ref_name.include.length, 4);
  assert.deepEqual(base.rules.find(rule => rule.type === 'pull_request').parameters.allowed_merge_methods, ['merge', 'squash', 'rebase']);
  for (const ruleset of [base, promotion]) assert.deepEqual(ruleset.bypass_actors, []);
  assert.deepEqual(promotion.conditions.ref_name.include, ['refs/heads/beta', 'refs/heads/main']);
  const review = promotion.rules.find(rule => rule.type === 'pull_request').parameters;
  assert.equal(review.required_approving_review_count, 1);
  assert.equal(review.dismiss_stale_reviews_on_push, true);
  assert.equal(review.require_last_push_approval, true);
  assert.deepEqual(review.allowed_merge_methods, ['merge']);
  const status = promotion.rules.find(rule => rule.type === 'required_status_checks').parameters;
  assert.equal(status.strict_required_status_checks_policy, true);
  assert.deepEqual(status.required_status_checks, [{ context: 'Release promotion policy', integration_id: 15368 }]);
});

test('dry run never writes and missing rollout/PR permissions fail before any server mutation', () => {
  const missing = fakeApi({ missing: true });
  const report = configureReleaseProtection({ api: missing.api });
  assert.equal(report.ready, false); assert.equal(report.issues.length, (enforcementFiles.length + 1) * 4);
  assert.equal(missing.writes.length, 0);
  assert.throws(() => configureReleaseProtection({ api: missing.api, apply: true }), /complete rollout/);
  assert.equal(missing.writes.length, 0);
  const forbidden = fakeApi({ allowed: false });
  assert.throws(() => configureReleaseProtection({ api: forbidden.api, apply: true }), /Allow GitHub Actions/);
  assert.equal(forbidden.writes.length, 0);
});

test('activation updates only owned rulesets after all files match on every protected branch', () => {
  const f = fakeApi({ existing: [{ id: 10, name: 'Stage0 protected channel branches' }, { id: 99, name: 'main' }] });
  assert.equal(configureReleaseProtection({ api: f.api, apply: true }).applied, true);
  assert.equal(f.writes.length, 2);
  assert.equal(f.writes[0].endpoint, 'rulesets/10'); assert.equal(f.writes[0].method, 'PUT');
  assert.equal(f.writes[1].endpoint, 'rulesets'); assert.equal(f.writes[1].method, 'POST');
  assert.ok(f.writes.every(write => write.endpoint !== 'rulesets/99'));
});
