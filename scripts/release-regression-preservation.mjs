import { execFileSync } from 'node:child_process';
import { assertCatalogSuperset, preservesFrozenInput, PINNED } from './release-regression-runner.mjs';
import { releaseGit } from './release-history.mjs';

/** A clean merge may still explicitly undo an already-integrated target fix. */
export function assertNoTargetReverts(root, baseSha, sources) {
  const log = releaseGit(root, 'log', '-z', '--format=%H%x00%B',
    ...sources.map(source => source.sourceSha), `^${baseSha}`, '--');
  const fields = log.split('\0');
  for (let i = 0; i + 1 < fields.length; i += 2) {
    for (const match of fields[i + 1].matchAll(/\bThis reverts commit ([a-f0-9]{7,40})\b/gi)) {
      const reverted = releaseGit(root, 'rev-parse', '--verify', `${match[1]}^{commit}`);
      if (releaseGit(root, 'merge-base', baseSha, reverted) === reverted) {
        throw new Error(`Regression risk: ${fields[i]} reverts target commit ${reverted}; use a dedicated reviewed fix, not automatic accumulation`);
      }
    }
  }
}

function gitBytes(root, sha, file) {
  return execFileSync('git', ['show', `${sha}:${file}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
}

// Trusted promotion controllers read both commits as data, without checking out
// or executing the proposed code. The baseline suite remains append-only.
export function assertRegressionRefs(root, baselineSha, headSha) {
  const read = (sha, file) => releaseGit(root, 'show', `${sha}:${file}`);
  const catalogPath = 'shared/release-regressions.json';
  if (!releaseGit(root, 'ls-tree', '-r', '--name-only', baselineSha, '--', catalogPath)) throw new Error('Protected regression catalog missing from target baseline; deploy policy before promotion');
  const baseline = JSON.parse(read(baselineSha, catalogPath)), candidate = JSON.parse(read(headSha, catalogPath));
  assertCatalogSuperset(baseline, candidate);
  const files = new Set(baseline.cases.map(item => item.path));
  const changes = [];
  for (const prefix of baseline.support) {
    for (const file of releaseGit(root, 'ls-tree', '-r', '--name-only', baselineSha, '--', prefix).split('\n').filter(Boolean)) files.add(file);
  }
  for (const file of files) {
    // Git object bytes, not trimmed text: truncating assertions/fixtures is a failure.
    const before = gitBytes(root, baselineSha, file), after = gitBytes(root, headSha, file);
    if (file.startsWith('scripts/helpers/') && !after.equals(before)) changes.push(file);
    else if (!preservesFrozenInput(file, before, after)) throw new Error(`Cannot rewrite/remove protected regression assertions or fixtures: ${file}`);
  }
  return [...changes, ...PINNED.filter(file => read(baselineSha, file) !== read(headSha, file))];
}
