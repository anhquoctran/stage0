import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'yaml';

const RULESET_NAME = 'Stage0 integration Actions checks';
export const protectedTestBranches = ['develop', 'beta', 'main'];
export const regressionChecks = ['ubuntu-22.04', 'macos-latest', 'windows-latest'].map(os => ({ context: `Regression gate (${os})`, integration_id: 15368 }));

export function regressionRuleset(existing) {
  if (existing.name !== RULESET_NAME || existing.target !== 'branch') throw Error('Unexpected ruleset owner/target');
  if (existing.bypass_actors?.length || existing.conditions.ref_name.exclude?.length) throw Error('Review bypass/exclusions before requiring regression checks');
  const rules = structuredClone(existing.rules);
  let status = rules.find(rule => rule.type === 'required_status_checks');
  if (!status) { status = { type: 'required_status_checks', parameters: { required_status_checks: [] } }; rules.push(status); }
  for (const check of regressionChecks) {
    const previous = status.parameters.required_status_checks.find(item => item.context === check.context);
    if (previous && previous.integration_id !== check.integration_id) throw Error('Unexpected required-check integration');
    if (!previous) status.parameters.required_status_checks.push(check);
  }
  Object.assign(status.parameters, { strict_required_status_checks_policy: true, do_not_enforce_on_create: false });
  return { name: existing.name, target: 'branch', enforcement: 'active', bypass_actors: [],
    conditions: { ref_name: { include: [...new Set([...existing.conditions.ref_name.include.filter(ref => !ref.endsWith('/nightly')), ...protectedTestBranches.map(branch => `refs/heads/${branch}`)])], exclude: [] } }, rules };
}

export function configureRegressionChecks({ api, apply = false }) {
  // Validate that all contexts can actually run before activating them on Main.
  for (const branch of protectedTestBranches) {
    const remote = api(`contents/.github/workflows/regression.yml?ref=${branch}`);
    const workflow = parse(Buffer.from(remote.content, 'base64').toString());
    const job = workflow.jobs?.verify;
    if (!workflow.on?.pull_request?.branches?.includes(branch)
      || job?.name !== 'Regression gate (${{ matrix.os }})'
      || !regressionChecks.every(check => job.strategy?.matrix?.os?.includes(check.context.slice(17, -1)))
      || !job.steps?.some(step => step.run?.includes('pnpm test'))
      || !job.steps?.some(step => step.run?.includes('cargo test') && step.run.includes('--lib'))) throw Error(`${branch}: regression workflow is not ready`);
  }
  const listed = api('rulesets?per_page=100');
  const matches = listed.filter(rule => rule.name === RULESET_NAME);
  if (matches.length !== 1) throw Error('Expected exactly one owned integration ruleset');
  const existing = api(`rulesets/${matches[0].id}`);
  const body = regressionRuleset(existing);
  if (apply) {
    api(`rulesets/${existing.id}`, { method: 'PUT', body });
    for (const branch of protectedTestBranches) {
      const rules = api(`rules/branches/${branch}`);
      if (!regressionChecks.every(check => rules.some(rule => rule.type === 'required_status_checks'
        && rule.parameters.required_status_checks.some(item => item.context === check.context && item.integration_id === check.integration_id)))) throw Error(`${branch}: required checks did not become effective`);
    }
  }
  return { applied: apply, id: existing.id, ruleset: body };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some(arg => arg !== '--apply')) throw Error('Usage: configure-regression-checks.mjs [--apply]');
  const repo = execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], { encoding: 'utf8' }).trim();
  const api = (endpoint, { method = 'GET', body } = {}) => JSON.parse(execFileSync('gh', ['api', `repos/${repo}/${endpoint}`, '--method', method, ...(body ? ['--input', '-'] : [])], { encoding: 'utf8', ...(body ? { input: JSON.stringify(body) } : {}) }));
  console.log(JSON.stringify(configureRegressionChecks({ api, apply: process.argv.includes('--apply') }), null, 2));
}
