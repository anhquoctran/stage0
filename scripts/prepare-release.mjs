import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  policy,
  CHANNEL_PRIORITY,
  resolveScheduledChannel,
  targetReleaseTime,
  dueReleaseChannels,
  nextReleaseVersion,
  scheduledReleasePlan,
  releaseChannel,
  waitForReleaseWindow,
} from './release-channels.mjs';
import { setProjectVersion } from './bump-version.mjs';
import { syncAllMetadata } from './generate-about-info.mjs';

export function prepareScheduledBranch({ schedule, now = new Date(), root = process.cwd() }) {
  const channel = resolveScheduledChannel(schedule);
  const releaseTime = targetReleaseTime(now);
  const publishAt = releaseTime.toISOString();
  const releaseDate = publishAt.slice(0, 10);
  const due = dueReleaseChannels(now);
  const orderedChannels = CHANNEL_PRIORITY.filter(ch => due.includes(ch) || ch === channel);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

  try {
    git('fetch', 'origin', '--tags');
  } catch {
    // Allow offline local repositories without fetched remote tags.
  }
  const tags = git('tag', '--list', 'v*').split('\n').filter(Boolean);

  const findWindowTag = ch => {
    for (const tag of tags) {
      const lines = git('show', '-s', '--format=%B', `${tag}^{commit}`).split(/\r?\n/);
      if (lines.includes(`Stage0-Release-Channel: ${ch}`) && lines.includes(`Stage0-Release-Date: ${releaseDate}`)) {
        return {
          channel: ch,
          branch: policy.channels[ch].branch,
          developmentBranch: policy.developmentBranch,
          version: tag.slice(1),
          tag,
          publishAt,
          releaseDate,
          sha: git('rev-parse', `${tag}^{commit}`),
          reused: true,
        };
      }
    }
    return null;
  };

  let targetResult = null;
  for (const ch of orderedChannels) {
    let prepared = findWindowTag(ch);
    if (!prepared) {
      const branch = policy.channels[ch].branch;
      const remoteBranch = branch.replace(/^origin\//, '');
      git('fetch', 'origin', `${remoteBranch}:refs/remotes/${branch}`);
      git('checkout', '--detach', branch);
      const version = nextReleaseVersion(ch, tags);
      const tag = `v${version}`;
      // Use controller code loaded before checkout, never execute a script
      // supplied by the selected channel revision in the main cache scope.
      setReleaseVersion(version, releaseDate, root);
      git('config', 'user.name', 'github-actions[bot]');
      git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
      git('add', 'package.json', 'backend/Cargo.toml', 'backend/Cargo.lock', 'backend/tauri.conf.json',
        'backend/about.json', 'backend/Info.plist', 'backend/hooks.nsh', 'frontend/features/about/config/about.ts',
        'frontend/features/about/config/releaseNotes.ts', 'website/index.html', 'RELEASE_NOTES.md', 'LICENSE');
      git('commit', '--allow-empty', '-m', `chore: prepare ${tag}`, '-m',
        `Stage0-Release-Channel: ${ch}\nStage0-Release-Date: ${releaseDate}\nStage0-Source-Branch: ${branch}`);
      git('tag', tag);
      git('push', 'origin', `refs/tags/${tag}`);
      tags.push(tag);
      prepared = {
        channel: ch,
        branch,
        developmentBranch: policy.developmentBranch,
        version,
        tag,
        publishAt,
        releaseDate,
        sha: git('rev-parse', 'HEAD'),
        reused: false,
      };
    }
    if (ch === channel) targetResult = prepared;
  }
  return targetResult;
}

export function setReleaseVersion(value, releaseDate, root = process.cwd()) {
  releaseChannel(value);
  const { previousVersion } = setProjectVersion(value, root);
  const notesPath = path.join(root, 'RELEASE_NOTES.md');
  const notes = fs.readFileSync(notesPath, 'utf8')
    .replace(/^# Stage0 v[^ ]+ Release Notes/m, `# Stage0 v${value} Release Notes`)
    .replace(/This document describes the current release \(v[^)]+\)\./, `This document describes the current release (v${value}).`);
  fs.writeFileSync(notesPath, notes);
  syncAllMetadata({ root, ...(releaseDate ? { releaseDate } : {}) });
  const literal = notes.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
  fs.writeFileSync(path.join(root, 'frontend/features/about/config/releaseNotes.ts'), `export const DEFAULT_RELEASE_NOTES = \`${literal}\`;\n`);
  const website = path.join(root, 'website/index.html');
  if (fs.existsSync(website)) fs.writeFileSync(website, fs.readFileSync(website, 'utf8').replaceAll(previousVersion, value));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, value] = process.argv.slice(2);
  if (mode === 'prepare' || mode === 'schedule') {
    const plan = mode === 'prepare'
      ? prepareScheduledBranch({ schedule: value })
      : scheduledReleasePlan(value, new Date());
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `channel=${plan.channel}\nbranch=${plan.branch}\ntag=${plan.tag}\npublish_at=${plan.publishAt}\nrelease_date=${plan.releaseDate}\n`,
      );
    }
    console.log(plan.tag);
  } else if (mode === 'set') {
    setReleaseVersion(value, process.argv[4] || process.env.STAGE0_RELEASE_DATE);
  } else if (mode === 'wait') {
    await waitForReleaseWindow(value);
  } else throw new Error('Usage: prepare-release.mjs prepare|schedule CHANNEL_OR_CRON | set VERSION [RELEASE_DATE] | wait [PUBLISH_AT]');
}
