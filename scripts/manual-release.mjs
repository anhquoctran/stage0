import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nextReleaseVersion, releaseChannel } from './release-channels.mjs';
import { setReleaseVersion } from './prepare-release.mjs';
import { publishedReleases, previewBuildDecision, releaseSource } from './release-history.mjs';
import { assertPublishedPromotion } from './release-promotion.mjs';
import { createReleaseChangelog } from './release-changelog.mjs';

/** Legacy releases from other version lines do not undo the deliberate 0.0 reset. */
export function nextStableVersion(current, tags) {
  if (releaseChannel(current) !== 'stable') throw new Error('Select a branch with a stable package version');
  return nextReleaseVersion('stable', tags, current);
}

export function prepareManualRelease({ runId, sourceSha, root = process.cwd(), releases = publishedReleases(root), promotionGuard = assertPublishedPromotion }) {
  if (!/^\d+$/.test(runId) || !/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('Invalid Actions release identity');
  promotionGuard({ root, channel: 'stable', sourceSha });
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const tags = git('tag', '--list', 'v*').split('\n').filter(Boolean);
  // A rerun of the same Actions run must rebuild the same immutable snapshot.
  for (const tag of tags.filter(tag => /^v\d+\.\d+\.\d+$/.test(tag))) {
    const message = git('show', '-s', '--format=%B', `${tag}^{commit}`);
    if (message.split('\n').includes(`Stage0-Release-Run: ${runId}`)) {
      if (!message.split('\n').includes(`Stage0-Source-Commit: ${sourceSha}`)) throw new Error('Release retry source mismatch');
      return { tag, sha: git('rev-parse', `${tag}^{commit}`) };
    }
  }
  git('checkout', '--detach', sourceSha);
  const current = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const version = nextStableVersion(current, tags);
  const { previousTag } = previewBuildDecision({ root, channel: 'stable', sourceSha, releases });
  const notes = createReleaseChangelog({ root, version, sourceSha, previousTag });
  setReleaseVersion(version, undefined, root, notes);
  git('config', 'user.name', 'github-actions[bot]');
  git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
  git('add', 'package.json', 'backend/Cargo.toml', 'backend/Cargo.lock', 'backend/tauri.conf.json',
    'backend/about.json', 'backend/Info.plist', 'backend/hooks.nsh', 'frontend/features/about/config/about.ts',
    'frontend/features/about/config/releaseNotes.ts', 'website/index.html', 'RELEASE_NOTES.md', 'LICENSE');
  git('commit', '--allow-empty', '-m', `chore: prepare v${version}`, '-m',
    `Stage0-Release-Run: ${runId}\nStage0-Source-Commit: ${sourceSha}`);
  const tag = `v${version}`;
  git('tag', tag);
  git('push', 'origin', `refs/tags/${tag}`);
  return { tag, sha: git('rev-parse', 'HEAD') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const releases = publishedReleases(root);
  let result;
  if (process.env.RELEASE_EVENT === 'workflow_dispatch' && process.env.RELEASE_REF_TYPE !== 'tag') {
    result = prepareManualRelease({ runId: process.env.RELEASE_RUN_ID, sourceSha: process.env.RELEASE_SOURCE_SHA, releases });
  } else {
    const tag = process.env.RELEASE_INPUT_TAG;
    if (!tag?.startsWith('v')) throw new Error('Release tag must start with v');
    const channel = releaseChannel(tag.slice(1));
    if (process.env.RELEASE_EVENT === 'push' && channel === 'stable') {
      throw new Error('Stable tag pushes require scheduled or manual workflow execution');
    }
    result = { tag, sha: execFileSync('git', ['rev-parse', '--verify', `${tag}^{commit}`], { encoding: 'utf8' }).trim() };
  }
  const channel = releaseChannel(result.tag.slice(1));
  const sourceSha = releaseSource(root, result.sha);
  assertPublishedPromotion({ root, channel, sourceSha });
  const decision = previewBuildDecision({ root, channel, sourceSha, releases, tag: result.tag });
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag=${result.tag}\nsha=${result.sha}\nchannel=${channel}\nshould_build=${decision.shouldBuild}\nprevious_tag=${decision.previousTag}\nsource_sha=${sourceSha}\n`);
  }
  if (!decision.shouldBuild && process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\nSkipped ${channel}: ${decision.reason}.\n`);
  }
  console.log(`Release snapshot: ${result.tag} (${result.sha})`);
}
