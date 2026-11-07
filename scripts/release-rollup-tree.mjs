import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { releaseGit, isReleaseMetadata } from './release-history.mjs';

export const ROLLUP_PATH = '.github/release-rollup.json';
const identity = { GIT_AUTHOR_NAME: 'github-actions[bot]', GIT_COMMITTER_NAME: 'github-actions[bot]',
  GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
  GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com' };

function plumbing(root, args, { input, env = {} } = {}) {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgSign=false', ...args], {
    cwd: root, encoding: 'utf8', input, env: { ...process.env, ...identity, ...env }, maxBuffer: 32 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

/** An index only, not a worktree/checkout. Candidate code is never executed. */
function ledgerTree(root, tree, blob) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-rollup-index-'));
  const env = { GIT_INDEX_FILE: path.join(dir, 'index') };
  try {
    plumbing(root, ['read-tree', tree], { env });
    plumbing(root, blob ? ['update-index', '--add', '--cacheinfo', '100644', blob, ROLLUP_PATH]
      : ['update-index', '--force-remove', ROLLUP_PATH], { env });
    return plumbing(root, ['write-tree'], { env });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function commitTree(root, tree, parents, message, date) {
  return plumbing(root, ['commit-tree', tree, ...parents.flatMap(sha => ['-p', sha])], {
    input: `${message}\nStage0-Rollup-Metadata: true\n`, env: { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  });
}

export function readRollup(root, ref) {
  if (!releaseGit(root, 'ls-tree', '-r', '--name-only', ref, '--', ROLLUP_PATH)) return null;
  return JSON.parse(releaseGit(root, 'show', `${ref}:${ROLLUP_PATH}`));
}

export function rollupCommits(root, baseSha, sources) {
  const output = releaseGit(root, 'log', '--reverse', '--topo-order', '-z', '--format=%H%x00%s%x00%B',
    ...sources.map(source => source.sourceSha), `^${baseSha}`, '--');
  if (!output) return [];
  const parts = output.split('\0'), commits = [];
  for (let i = 0; i + 2 < parts.length; i += 3) {
    if (!isReleaseMetadata(parts[i + 2])) commits.push({ sha: parts[i], subject: parts[i + 1] });
  }
  return commits;
}

/** Merge every eligible snapshot, retaining fix/revert order and original ancestry. */
export function composeRollup(root, manifest) {
  let current = manifest.baseSha;
  const ledger = releaseGit(root, 'ls-tree', manifest.baseSha, '--', ROLLUP_PATH).match(/^100644 blob ([a-f0-9]{40})\t/)?.[1];
  for (const source of manifest.sources) {
    // A lower channel has its own ledger. Treat only this reserved data path as
    // metadata; all application/source conflicts still fail rather than choosing ours.
    const sourceTree = ledgerTree(root, `${source.sourceSha}^{tree}`, ledger);
    const wrapped = commitTree(root, sourceTree, [source.sourceSha], `Stage0 rollup source ${source.tag}\n`, manifest.window.end);
    let tree;
    try { tree = releaseGit(root, 'merge-tree', '--write-tree', current, wrapped).split('\n')[0]; }
    catch { throw new Error(`Rollup conflict at ${source.tag}; fix/revert in the source channel and rebuild, never auto-resolve application code`); }
    current = commitTree(root, tree, [current, wrapped], `Stage0 accumulate ${source.tag}\n`, manifest.window.end);
  }
  const contentTree = releaseGit(root, 'rev-parse', `${current}^{tree}`);
  const changed = Boolean(releaseGit(root, 'diff', '--name-only', manifest.baseSha, current, '--', '.', `:(exclude)${ROLLUP_PATH}`));
  const blob = plumbing(root, ['hash-object', '-w', '--stdin'], { input: `${JSON.stringify(manifest, null, 2)}\n` });
  const tree = ledgerTree(root, contentTree, blob);
  const sha = commitTree(root, tree, [current], `chore(release): assemble ${manifest.channel} ${manifest.releaseDate}\n`, manifest.window.end);
  return { sha, tree, changed };
}
