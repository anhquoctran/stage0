import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { releaseChannel } from './release-channels.mjs';
import { incrementPatch } from './bump-version.mjs';

/** Legacy releases from other version lines do not undo the deliberate 0.0 reset. */
export function nextStableVersion(current, tags) {
  if (releaseChannel(current) !== 'stable') throw new Error('Select a branch with a stable package version');
  const [major, minor] = current.split('.');
  let version = current;
  for (const tag of tags) {
    if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) continue;
    const candidate = tag.slice(1).split('.');
    if (candidate[0] === major && candidate[1] === minor && BigInt(candidate[2]) >= BigInt(version.split('.')[2])) {
      version = incrementPatch(tag.slice(1));
    }
  }
  return version;
}

export function prepareManualRelease({ runId, sourceSha, root = process.cwd() }) {
  if (!/^\d+$/.test(runId) || !/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('Invalid Actions release identity');
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
  execFileSync(process.execPath, ['scripts/prepare-release.mjs', 'set', version], { cwd: root, stdio: 'pipe' });
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
  let result;
  if (process.env.RELEASE_EVENT === 'workflow_dispatch') {
    result = prepareManualRelease({ runId: process.env.RELEASE_RUN_ID, sourceSha: process.env.RELEASE_SOURCE_SHA });
  } else {
    const tag = process.env.RELEASE_INPUT_TAG;
    if (!tag?.startsWith('v') || releaseChannel(tag.slice(1)) === 'stable') throw new Error('Automatic releases require a nightly/beta tag');
    result = { tag, sha: execFileSync('git', ['rev-parse', '--verify', `${tag}^{commit}`], { encoding: 'utf8' }).trim() };
  }
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag=${result.tag}\nsha=${result.sha}\n`);
  console.log(`Release snapshot: ${result.tag} (${result.sha})`);
}
