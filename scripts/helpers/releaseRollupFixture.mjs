import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { releaseTargets } from '../release-promotion-github.mjs';

export function rollupFixture(t, { channel = 'nightly', conflict = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-rollup-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  git('remote', 'add', 'origin', root);
  fs.mkdirSync(path.join(root, '.github')); fs.writeFileSync(path.join(root, '.github/release-rollup.json'), '{"oldLedger":true}\n');
  fs.writeFileSync(path.join(root, 'README'), 'base'); git('add', '.'); git('commit', '-m', 'Base');
  const baseSha = git('rev-parse', 'HEAD'); git('branch', 'beta');
  const releases = [], candidates = new Map();
  const dates = channel === 'nightly' ? ['2026-10-28T00:00:00Z', '2026-11-05T00:00:00Z', '2026-11-26T23:59:59Z']
    : ['2026-10-27T00:00:00Z', '2026-11-27T00:00:00Z', '2026-12-27T00:00:00Z'];
  const publish = (number, publishedAt) => {
    const sourceSha = git('rev-parse', 'HEAD'), tag = `v0.0.${number}-${channel}`;
    const sha = git('commit-tree', 'HEAD^{tree}', '-p', sourceSha, '-m', `chore: prepare ${tag}`, '-m',
      `Stage0-Release-Channel: ${channel}\nStage0-Source-Commit: ${sourceSha}`);
    git('tag', tag, sha);
    const asset = name => ({ name, state: 'uploaded', size: 100, updated_at: publishedAt });
    const assets = [asset('latest.json'), asset('SHA256SUMS.txt')];
    for (const [target, extensions] of Object.entries(releaseTargets)) for (const ext of extensions) {
      const name = `${target}-stage0${ext}`; assets.push(asset(name));
      if (ext !== '.dmg') assets.push(asset(`${name}.sig`));
    }
    const release = { tag_name: tag, published_at: publishedAt, draft: false, prerelease: true, assets };
    const run = { id: number, run_number: number, run_attempt: 1, path: '.github/workflows/release.yml',
      head_branch: tag, head_sha: sha, conclusion: 'success', status: 'completed', updated_at: publishedAt };
    candidates.set(tag, { release, run, sourceSha, sha }); releases.push(release);
  };
  git('checkout', '-b', 'source');
  fs.writeFileSync(path.join(root, 'feature'), 'before fix'); git('add', '.'); git('commit', '-m', 'feat: introduce feature'); publish(2, dates[0]);
  fs.writeFileSync(path.join(root, 'feature'), 'fixed'); fs.writeFileSync(path.join(root, '.github/release-rollup.json'), '{"lowerLedger":1}\n');
  git('commit', '-am', 'fix: harden feature'); publish(3, dates[1]);
  git('checkout', '-b', 'independent-fix', baseSha);
  fs.writeFileSync(path.join(root, conflict ? 'feature' : 'independent-fix'), 'independent');
  fs.writeFileSync(path.join(root, '.github/release-rollup.json'), '{"lowerLedger":2}\n');
  git('add', '.'); git('commit', '-m', 'fix: independent stable fix'); publish(4, dates[2]);
  const api = endpoint => {
    if (endpoint === 'releases?per_page=100') return releases;
    if (endpoint.startsWith('releases/tags/')) return candidates.get(decodeURIComponent(endpoint.split('/').at(-1))).release;
    if (endpoint.startsWith('actions/workflows/')) {
      const sha = new URL(`https://fixture/${endpoint}`).searchParams.get('head_sha');
      return [{ workflow_runs: [...candidates.values()].filter(c => c.sha === sha).map(c => c.run) }];
    }
    if (endpoint.startsWith('actions/runs/')) return [{ jobs: ['validate', 'publish',
      ...Object.keys(releaseTargets).map(target => `build (os, ${target}, args)`)].map(name => ({ name, conclusion: 'success' })) }];
    throw new Error(`Unexpected fixture API: ${endpoint}`);
  };
  return { root, git, baseSha, releases, candidates, api };
}
