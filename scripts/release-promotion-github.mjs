import { execFileSync } from 'node:child_process';
import { RELEASE_REPOSITORY } from './release-history.mjs';

/** Fixed canonical repository; callers pass data, never executable PR content. */
export function promotionApi(endpoint, { method = 'GET', body, paginated = false } = {}) {
  const args = ['api', `repos/${RELEASE_REPOSITORY}/${endpoint}`];
  if (paginated) args.push('--paginate', '--slurp');
  if (method !== 'GET') args.push('--method', method);
  if (body) args.push('--input', '-');
  const output = execFileSync('gh', args, {
    encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], input: body ? JSON.stringify(body) : undefined, maxBuffer: 32 * 1024 * 1024,
  }).trim();
  const value = output ? JSON.parse(output) : null;
  return paginated ? value.flat() : value;
}

export const releaseTargets = {
  'x86_64-unknown-linux-gnu': ['.AppImage', '.deb', '.rpm'],
  'aarch64-unknown-linux-gnu': ['.deb', '.rpm'],
  'x86_64-pc-windows-msvc': ['.exe'],
  'aarch64-pc-windows-msvc': ['.exe'],
  'aarch64-apple-darwin': ['.dmg', '.app.tar.gz'],
  'x86_64-apple-darwin': ['.dmg', '.app.tar.gz'],
};

export function assertCandidateBuild({ release, tagSha, runs, jobsForRun }) {
  if (release.draft || !release.prerelease || !release.published_at) throw new Error('Candidate must be a published preview release');
  const run = runs.filter(run => run.head_sha === tagSha && run.head_branch === release.tag_name
    && run.path === '.github/workflows/release.yml')
    .sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0];
  if (!run || run.conclusion !== 'success' || run.status !== 'completed') {
    throw new Error('Latest Release Stage0 run for the exact candidate tag/SHA must complete successfully');
  }
  const jobs = jobsForRun(run);
  const success = name => jobs.some(job => job.name.split(' / ').at(-1) === name && job.conclusion === 'success');
  if (!success('validate') || !success('publish')) throw new Error('Candidate validation/publication did not succeed');
  for (const target of Object.keys(releaseTargets)) {
    if (!jobs.some(job => job.name.split(' / ').at(-1).startsWith('build (')
      && job.name.includes(target) && job.conclusion === 'success')) throw new Error(`Candidate build missing: ${target}`);
  }
  const assets = release.assets || [];
  if (new Set(assets.map(asset => asset.name)).size !== assets.length) throw new Error('Duplicate candidate assets');
  const requireAsset = name => {
    const asset = assets.find(asset => asset.name === name);
    if (!asset || asset.state !== 'uploaded' || !(asset.size > 0)
      || !Number.isFinite(Date.parse(asset.updated_at)) || Date.parse(asset.updated_at) > Date.parse(run.updated_at)) {
      throw new Error(`Missing, incomplete or replaced candidate asset: ${name}`);
    }
    return asset;
  };
  requireAsset('latest.json');
  requireAsset('SHA256SUMS.txt');
  for (const [target, extensions] of Object.entries(releaseTargets)) {
    for (const extension of extensions) {
      const matches = assets.filter(asset => asset.name.startsWith(`${target}-`) && asset.name.endsWith(extension));
      if (matches.length !== 1) throw new Error(`Candidate package missing/ambiguous: ${target} ${extension}`);
      requireAsset(matches[0].name);
      // Tauri signs updater archives; DMGs are covered by published checksums.
      if (extension !== '.dmg') requireAsset(`${matches[0].name}.sig`);
    }
  }
  return { run, readySince: Math.max(Date.parse(release.published_at), Date.parse(run.updated_at)) };
}

export function candidateEvidence(tag, tagSha, api = promotionApi) {
  const release = api(`releases/tags/${encodeURIComponent(tag)}`);
  const pages = api(`actions/workflows/release.yml/runs?head_sha=${tagSha}&per_page=100`, { paginated: true });
  const runs = pages.flatMap(page => page.workflow_runs);
  const result = assertCandidateBuild({ release, tagSha, runs,
    jobsForRun: run => api(`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`, { paginated: true })
      .flatMap(page => page.jobs),
  });
  return { release, ...result };
}

export function assertPromotionSecurity(pr, api = promotionApi, { merged = false } = {}) {
  const ref = encodeURIComponent(merged ? `refs/heads/${pr.base.ref}` : `refs/pull/${pr.number}/head`);
  const sha = merged ? pr.merge_commit_sha : pr.head.sha;
  const analyses = api(`code-scanning/analyses?ref=${ref}&tool_name=CodeQL&per_page=100`, { paginated: true });
  for (const language of ['actions', 'javascript-typescript', 'rust']) {
    const analysis = analyses.find(item => item.category === `/language:${language}`);
    if (!analysis || analysis.commit_sha !== sha || analysis.error || analysis.tool?.name !== 'CodeQL') {
      throw new Error(`Successful current CodeQL ${language} analysis required for this exact promotion commit`);
    }
  }
  const alerts = api(`code-scanning/alerts?state=open&ref=${ref}&per_page=100`, { paginated: true });
  const blocking = alerts.filter(alert => ['critical', 'high'].includes(alert.rule?.security_severity_level));
  if (blocking.length) throw new Error(`Resolve ${blocking.length} High/Critical CodeQL alerts on this candidate before promotion`);
}
