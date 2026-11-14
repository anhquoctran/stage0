import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promotionApi } from './release-promotion-github.mjs';

const name = 'Stage0 retired Nightly tags';
export const retiredTagRules = {
  name, target: 'tag', enforcement: 'active', bypass_actors: [],
  conditions: { ref_name: { include: ['refs/tags/*-nightly*'], exclude: [] } },
  rules: [{ type: 'creation' }, { type: 'update' }],
};

/** Stop the live scheduler and prevent future retired tags without deleting history. */
export function retireNightly({ api = promotionApi, apply = false } = {}) {
  const matches = api('rulesets?per_page=100', { paginated: true }).filter(item => item.name === name);
  if (matches.length > 1) throw new Error('Duplicate retired-channel rulesets; inspect before mutation');
  const existing = matches[0] && api(`rulesets/${matches[0].id}`);
  if (existing && existing.target !== 'tag') throw new Error('Unexpected retired-channel ruleset target');
  if (!apply) return { applied: false, ruleset: retiredTagRules, workflow: 'scheduled-release.yml' };
  const before = api('actions/workflows/scheduled-release.yml');
  if (!['active', 'disabled_manually'].includes(before.state)) throw new Error('Inspect the retired workflow state before mutation');
  api(existing ? `rulesets/${existing.id}` : 'rulesets', {
    method: existing ? 'PUT' : 'POST', body: retiredTagRules,
  });
  if (before.state === 'active') api('actions/workflows/scheduled-release.yml/disable', { method: 'PUT' });
  const workflow = api('actions/workflows/scheduled-release.yml');
  const stored = api('rulesets?per_page=100', { paginated: true }).find(item => item.name === name);
  const effective = stored && api(`rulesets/${stored.id}`);
  if (workflow.state !== 'disabled_manually' || !effective || effective.enforcement !== 'active'
    || effective.target !== 'tag' || effective.bypass_actors?.length
    || JSON.stringify(effective.conditions?.ref_name?.include) !== JSON.stringify(retiredTagRules.conditions.ref_name.include)
    || effective.conditions?.ref_name?.exclude?.length !== 0
    || !['creation', 'update'].every(type => effective.rules.some(rule => rule.type === type))) {
    throw new Error('Nightly retirement could not be verified; inspect GitHub configuration');
  }
  return { applied: true, rulesetId: stored.id, workflow: workflow.state };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some(arg => arg !== '--apply')) throw new Error('Usage: retire-nightly-release.mjs [--apply]');
  console.log(JSON.stringify(retireNightly({ apply: process.argv.includes('--apply') }), null, 2));
}
