import { execFileSync } from 'node:child_process';
import { releaseChannel, policy } from './release-channels.mjs';

export const RELEASE_REPOSITORY = 'anhquoctran/stage0';

export function releaseGit(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
}

/** Fail closed on API errors: unpublished tags/drafts must never consume changes. */
export function publishedReleases(root) {
  const pages = JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp',
    `repos/${RELEASE_REPOSITORY}/releases?per_page=100`], {
    cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  }));
  return pages.flat().filter(release => !release.draft && release.published_at);
}

export function previousChannelRelease(channel, releases, currentTag = '') {
  return releases.filter(release => {
    if (release.draft || !release.published_at || release.tag_name === currentTag) return false;
    try { return release.tag_name.startsWith('v') && releaseChannel(release.tag_name.slice(1)) === channel; }
    catch { return false; } // Ignore channel aliases and unrelated/legacy version formats.
  }).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0]?.tag_name || '';
}

function isReleasePreparation(message) {
  return /^chore: prepare v\d+\.\d+\.\d+(?:-(?:nightly|beta))?\n/.test(message)
    && /^Stage0-Release-(?:Channel|Run): /m.test(message);
}

/** Assembly bookkeeping is not a product change or a new source snapshot. */
export function isReleaseMetadata(message) {
  return isReleasePreparation(message) || (/^(?:Stage0 (?:rollup source|accumulate) v|chore\(release\): assemble (?:beta|stable) )/.test(message)
    && /^Stage0-Rollup-Metadata: true$/m.test(message));
}

/** Release snapshots are sibling commits; compare their source parents, not metadata. */
export function releaseSource(root, ref) {
  const sha = releaseGit(root, 'rev-parse', '--verify', `${ref}^{commit}`);
  const message = releaseGit(root, 'show', '-s', '--format=%B', sha);
  return isReleasePreparation(message) ? releaseGit(root, 'rev-parse', `${sha}^`) : sha;
}

export function sourceChanges(root, sourceSha, previousTag = '') {
  const source = releaseSource(root, sourceSha);
  const revisions = [source];
  if (previousTag) revisions.push(`^${releaseSource(root, previousTag)}`);
  const output = releaseGit(root, 'log', '-z', '--format=%H%x00%ct%x00%s%x00%B', ...revisions, '--');
  if (!output) return [];
  const fields = output.split('\0');
  const commits = [];
  for (let i = 0; i < fields.length - 3; i += 4) {
    const [sha, timestamp, subject, message] = fields.slice(i, i + 4);
    if (!isReleaseMetadata(message)) commits.push({ sha, timestamp: Number(timestamp) * 1000, subject });
  }
  return commits;
}

export function previewBuildDecision({ root, channel, sourceSha, releases, tag = '', now = new Date() }) {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid activity window time');
  const previousTag = previousChannelRelease(channel, releases, tag);
  if (channel === 'stable') return { shouldBuild: true, previousTag, reason: '' };
  if (releases.some(release => release.tag_name === tag && !release.draft && release.published_at)) {
    return { shouldBuild: false, previousTag, reason: `${tag} is already published` };
  }
  if (channel === 'beta') {
    const changed = sourceChanges(root, sourceSha, previousTag).length > 0;
    return { shouldBuild: changed, previousTag, reason: changed ? '' : 'No new source changes since the previous Beta' };
  }
  const cutoff = now.getTime() - policy.previewActivityHours * 60 * 60 * 1000;
  const recent = sourceChanges(root, sourceSha, previousTag)
    .some(commit => commit.timestamp >= cutoff && commit.timestamp <= now.getTime());
  return { shouldBuild: recent, previousTag, reason: recent ? ''
    : `No new source commits in the last ${policy.previewActivityHours} hours for ${channel}` };
}
