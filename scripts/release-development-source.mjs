import { releaseGit, RELEASE_REPOSITORY } from './release-history.mjs';
import { InvalidReleaseCandidate } from './release-promotion-github.mjs';

const workflows = {
  'regression.yml': ['Regression gate (ubuntu-22.04)', 'Regression gate (macos-latest)', 'Regression gate (windows-latest)'],
  'policy-tests.yml': ['Release policy tests'],
};
const validSha = value => /^[a-f0-9]{40}$/.test(value || '');

/** Inventory uses server-side merge timestamps, never forgeable commit dates. */
export function developmentInventory(root, period, api) {
  releaseGit(root, 'fetch', 'origin', 'refs/heads/develop');
  const head = releaseGit(root, 'rev-parse', 'FETCH_HEAD^{commit}');
  const history = new Set(releaseGit(root, 'rev-list', '--first-parent', head).split('\n'));
  return api('pulls?state=closed&base=develop&sort=updated&direction=asc&per_page=100', { paginated: true })
    .filter(pr => pr.merged_at && Date.parse(pr.merged_at) >= Date.parse(period.start)
      && Date.parse(pr.merged_at) < Date.parse(period.end))
    .map(pr => {
      if (!Number.isSafeInteger(pr.number) || !validSha(pr.merge_commit_sha) || !history.has(pr.merge_commit_sha)) {
        throw new Error('Development merge inventory is invalid or no longer on develop; inspect history before promotion');
      }
      return { tag_name: `develop/pr-${pr.number}/${pr.merge_commit_sha}`, published_at: pr.merged_at,
        number: pr.number, sha: pr.merge_commit_sha };
    }).sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at) || a.number - b.number);
}

/** PR tests run on HEAD. Only an identical merged tree can inherit that evidence. */
export function fetchDevelopmentSource(root, _tag, api, { release, period }) {
  const pr = api(`pulls/${release.number}`);
  if (!pr.merged || pr.state !== 'closed' || pr.base?.ref !== 'develop'
    || pr.base.repo?.full_name !== RELEASE_REPOSITORY || pr.merge_commit_sha !== release.sha
    || pr.merged_at !== release.published_at || !validSha(pr.head?.sha)) {
    throw new InvalidReleaseCandidate('Source must be an immutable merged develop PR');
  }
  releaseGit(root, 'fetch', 'origin', release.sha, pr.head.sha);
  if (releaseGit(root, 'rev-parse', `${release.sha}^{tree}`) !== releaseGit(root, 'rev-parse', `${pr.head.sha}^{tree}`)) {
    throw new InvalidReleaseCandidate('Merged source differs from the tested PR tree; test a fresh synchronized PR');
  }
  const evidence = [];
  for (const [workflow, required] of Object.entries(workflows)) {
    const runs = api(`actions/workflows/${workflow}/runs?head_sha=${pr.head.sha}&per_page=100`, { paginated: true })
      .flatMap(page => page.workflow_runs);
    const run = runs.filter(run => run.head_sha === pr.head.sha && run.event === 'pull_request'
      && run.path === `.github/workflows/${workflow}` && run.head_branch === pr.head.ref)
      .sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0];
    // GitHub clears workflow_runs.pull_requests after the PR closes. A frozen
    // run-name records the original PR/base/head from GitHub event context.
    const title = `${workflow === 'regression.yml' ? 'Regression checks' : 'Release policy tests'} · PR #${pr.number} · develop · ${pr.head.sha}`;
    if (!run || run.status !== 'completed' || run.conclusion !== 'success'
      || run.display_title !== title
      || !Number.isFinite(Date.parse(run.updated_at)) || Date.parse(run.updated_at) >= Date.parse(period.end)
      || !Number.isSafeInteger(run.id) || !Number.isSafeInteger(run.run_attempt)) {
      throw new InvalidReleaseCandidate(`Latest exact-head ${workflow} must succeed before the period cutoff`);
    }
    const jobs = api(`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`, { paginated: true })
      .flatMap(page => page.jobs);
    if (!required.every(name => jobs.some(job => job.name === name && job.conclusion === 'success'))
      || jobs.some(job => job.conclusion !== 'success')) {
      throw new InvalidReleaseCandidate(`Incomplete or unsuccessful source checks: ${workflow}`);
    }
    evidence.push({ workflow, runId: run.id, runAttempt: run.run_attempt, completedAt: run.updated_at });
  }
  return { tag: release.tag_name, sha: release.sha, sourceSha: release.sha, release,
    run: { id: evidence[0].runId, run_attempt: evidence[0].runAttempt, updated_at: evidence[0].completedAt },
    readySince: Math.max(Date.parse(pr.merged_at), ...evidence.map(item => Date.parse(item.completedAt))),
    evidence: { pullRequest: pr.number, testedHead: pr.head.sha, workflows: evidence } };
}

export function fetchDevelopmentCandidate(root, ref, api, now = new Date()) {
  const match = /^develop\/pr-([1-9]\d*)\/([a-f0-9]{40})$/.exec(ref || '');
  if (!match) throw new InvalidReleaseCandidate('Select an immutable develop/pr-N/SHA candidate');
  const pr = api(`pulls/${match[1]}`);
  releaseGit(root, 'fetch', 'origin', 'refs/heads/develop');
  const history = releaseGit(root, 'rev-list', '--first-parent', 'FETCH_HEAD^{commit}').split('\n');
  if (!history.includes(match[2])) throw new InvalidReleaseCandidate('Candidate is no longer on develop');
  return fetchDevelopmentSource(root, ref, api, { release: { tag_name: ref, number: Number(match[1]),
    sha: match[2], published_at: pr.merged_at }, period: { end: now.toISOString() } });
}
