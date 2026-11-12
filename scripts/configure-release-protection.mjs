import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { policy } from './release-channels.mjs';
import { validateCatalog } from './release-regression-runner.mjs';
import { promotionApi } from './release-promotion-github.mjs';

export const enforcementFiles = [
  '.github/workflows/regression.yml', 'scripts/release-regression-runner.mjs',
  'scripts/release-regression-preservation.mjs',
  'backend/build.rs', 'backend/test-windows.manifest.xml',
  '.github/workflows/promotion-policy.yml', '.github/workflows/promote-release.yml',
  '.github/workflows/publish-rollup.yml',
  '.github/workflows/release.yml', '.github/workflows/policy-tests.yml',
  'scripts/release-promotion.mjs', 'scripts/release-promotion-github.mjs',
  'scripts/release-promotion-source.mjs', 'scripts/release-development-source.mjs', 'scripts/release-period.mjs',
  'scripts/release-rollup.mjs', 'scripts/release-rollup-tree.mjs',
  'scripts/release-rollup-controller.mjs', 'scripts/release-rollup-publish.mjs',
  'scripts/dispatch-tag-release.mjs', 'scripts/release-promotion-cli.mjs', 'scripts/manual-release.mjs',
  'scripts/prepare-release.mjs', 'scripts/release-channels.mjs',
  'scripts/release-history.mjs', 'shared/release-channels.json',
];

export function releaseProtectionRules() {
  const common = [{ type: 'deletion' }, { type: 'non_fast_forward' }];
  const regressions = ['ubuntu-22.04', 'macos-latest', 'windows-latest'].map(os => ({ context: `Regression gate (${os})`, integration_id: 15368 }));
  const pr = approvals => ({ type: 'pull_request', parameters: {
    required_approving_review_count: approvals, dismiss_stale_reviews_on_push: true,
    require_code_owner_review: false, require_last_push_approval: approvals > 0,
    required_review_thread_resolution: true, allowed_merge_methods: approvals > 0 ? ['merge'] : ['merge', 'squash', 'rebase'],
  } });
  const ruleset = (name, branches, rules) => ({ name, target: 'branch', enforcement: 'active',
    bypass_actors: [], conditions: { ref_name: { include: branches.map(branch => `refs/heads/${branch}`), exclude: [] } }, rules,
  });
  return [
    ruleset('Stage0 protected channel branches', policy.gitFlow.protectedBranches, [...common, pr(0), { type: 'required_status_checks', parameters: {
      strict_required_status_checks_policy: true, do_not_enforce_on_create: false, required_status_checks: regressions,
    } }]),
    ruleset('Stage0 adjacent release promotion', ['beta', 'main'], [pr(1), { type: 'required_status_checks', parameters: {
      strict_required_status_checks_policy: true, do_not_enforce_on_create: false,
      required_status_checks: [{ context: policy.promotion.requiredCheck, integration_id: 15368 }],
    } }, { type: 'code_scanning', parameters: { code_scanning_tools: [
      { tool: 'CodeQL', security_alerts_threshold: 'high_or_higher', alerts_threshold: 'errors' },
    ] } }]),
  ];
}

/** Preflight everything before any mutation, so absent workflows cannot deadlock releases. */
export function configureReleaseProtection({ apply = false, api = promotionApi } = {}) {
  const expected = {};
  const issues = [];
  for (const file of enforcementFiles) {
    // Local files and GitHub Contents both identify exact Git blob bytes.
    expected[file] = fs.readFileSync(new URL(`../${file}`, import.meta.url));
  }
  for (const branch of policy.gitFlow.protectedBranches) {
    for (const [file, bytes] of Object.entries(expected)) {
      try {
        const remote = api(`contents/${file}?ref=${branch}`);
        if (remote.encoding !== 'base64' || !Buffer.from(remote.content, 'base64').equals(bytes)) issues.push(`${branch}: deploy ${file}`);
      } catch { issues.push(`${branch}: unavailable ${file}`); }
    }
  }
  for (const branch of policy.gitFlow.protectedBranches) {
    try {
      const remote = api(`contents/shared/release-regressions.json?ref=${branch}`);
      const catalog = validateCatalog(JSON.parse(Buffer.from(remote.content, 'base64')));
      for (const item of catalog.cases) api(`contents/${item.path}?ref=${branch}`);
      const expectedCatalog = validateCatalog(JSON.parse(fs.readFileSync(new URL('../shared/release-regressions.json', import.meta.url))));
      for (const expected of expectedCatalog.cases) {
        if (expected.requires) {
          try { api(`contents/${expected.requires}?ref=${branch}`); }
          catch (error) {
            if (String(error.stderr || error.message).includes('404')) continue;
            throw error;
          }
        }
        if (!catalog.cases.some(item => item.id === expected.id)) throw new Error(`Missing known regression ${expected.id}`);
      }
    } catch { issues.push(`${branch}: deploy a valid feature-appropriate protected regression catalog`); }
  }
  const workflowPermissions = api('actions/permissions/workflow');
  if (!workflowPermissions.can_approve_pull_request_reviews) issues.push('Enable Actions → General → Allow GitHub Actions to create and approve pull requests (the controller never approves).');
  const rulesets = releaseProtectionRules();
  if (apply) {
    if (issues.length) throw new Error(`Protection not activated; complete rollout first:\n${issues.join('\n')}`);
    const existing = api('rulesets?per_page=100', { paginated: true });
    for (const body of rulesets) {
      const previous = existing.find(rule => rule.name === body.name);
      api(previous ? `rulesets/${previous.id}` : 'rulesets', { method: previous ? 'PUT' : 'POST', body });
    }
  }
  return { ready: issues.length === 0, applied: apply, issues, rulesets };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some(arg => arg !== '--apply')) throw new Error('Usage: configure-release-protection.mjs [--apply]');
  console.log(JSON.stringify(configureReleaseProtection({ apply: process.argv.includes('--apply') }), null, 2));
}
