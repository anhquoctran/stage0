import fs from 'node:fs';
import path from 'node:path';
import { releasePeriod } from './release-period.mjs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const policy = JSON.parse(fs.readFileSync(path.join(root, 'shared/release-channels.json'), 'utf8'));
export const CHANNEL_PRIORITY = ['beta', 'stable'];

const CORE_PATTERN = '(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)';
// Low-level reservation also understands historical tags supplied by the caller.
const TAG_LINE_RE = new RegExp(`^v${CORE_PATTERN}(?:-(nightly|beta)(?:\\.[1-9]\\d{7}\\.(?:0|[1-9]\\d*))?)?$`);

export function releaseChannel(version) {
  if (new RegExp(`^${CORE_PATTERN}$`).test(version)) return 'stable';
  const match = new RegExp(`^${CORE_PATTERN}-(beta)$`).exec(version);
  if (!match) throw new Error('Release version must be stable MAJOR.MINOR.PATCH or a -beta prerelease');
  return match[4];
}

export function formatChannelVersion(coreVersion, channel) {
  if (!new RegExp(`^${CORE_PATTERN}$`).test(coreVersion)) throw new Error('Invalid core version');
  if (!Object.hasOwn(policy.channels, channel)) throw new Error('Unknown release channel');
  return channel === 'stable' ? coreVersion : `${coreVersion}-${channel}`;
}

export function compareSemver(left, right) {
  const parse = value => {
    const channel = releaseChannel(value);
    const core = channel === 'stable' ? value : value.slice(0, -(channel.length + 1));
    const [major, minor, patch] = core.split('.').map(BigInt);
    return { major, minor, patch, channel };
  };
  const a = parse(left);
  const b = parse(right);
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  if (a.channel === b.channel) return 0;
  if (a.channel === 'stable') return 1;
  if (b.channel === 'stable') return -1;
  return a.channel < b.channel ? -1 : 1;
}

export function channelCrons(channel) {
  if (!Object.hasOwn(policy.channels, channel)) throw new Error('Unknown release channel');
  const config = policy.channels[channel];
  return config.crons ?? (config.cron ? [config.cron] : []);
}

export function resolveScheduledChannel(scheduleOrChannel) {
  if (Object.hasOwn(policy.channels, scheduleOrChannel)) return scheduleOrChannel;
  const channel = Object.keys(policy.channels).find(key => channelCrons(key).includes(scheduleOrChannel));
  if (!channel) throw new Error('Unknown release schedule');
  return channel;
}

export function targetReleaseTime(now = new Date(), leadMinutes = policy.leadMinutes) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid release time');
  const currentMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const nextMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return new Date(nextMidnight - now.getTime() <= leadMinutes * 60_000 ? nextMidnight : currentMidnight);
}

export function dueReleaseChannels(now = new Date(), leadMinutes = policy.leadMinutes) {
  const releaseTime = targetReleaseTime(now, leadMinutes);
  const epoch = new Date(policy.epoch);
  if (releaseTime < epoch) throw new Error('Invalid release time');
  const due = [];
  if (releaseTime.getUTCDate() === policy.channels.beta.releaseDayOfMonth) {
    due.push('beta');
  }
  if (releaseTime.getUTCDate() === policy.channels.stable.releaseDayOfQuarter && releaseTime.getUTCMonth() % 3 === 0) {
    due.push('stable');
  }
  return due;
}

export function nextReleaseVersion(channel, tags = [], baseVersion = policy.baseVersion) {
  if (!Object.hasOwn(policy.channels, channel)) throw new Error('Unknown release channel');
  if (releaseChannel(baseVersion) !== 'stable') throw new Error('Base version must be a stable MAJOR.MINOR.PATCH');
  if (!Array.isArray(tags)) throw new Error('Release tags must be an array');
  const [major, minor, basePatch] = baseVersion.split('.');
  let nextPatch = channel === 'stable' ? BigInt(basePatch) : BigInt(basePatch) + 1n;
  for (const tag of tags) {
    const match = TAG_LINE_RE.exec(tag);
    if (!match) continue;
    if (match[1] === major && match[2] === minor && BigInt(match[3]) >= nextPatch) {
      nextPatch = BigInt(match[3]) + 1n;
    }
  }
  return formatChannelVersion(`${major}.${minor}.${nextPatch}`, channel);
}

/** Allocate the next build from the current baseline and enabled channels only. */
export function nextBuildVersion(channel, tags = [], currentVersion = policy.baseVersion) {
  if (!Object.hasOwn(policy.channels, channel)) throw new Error('Unknown release channel');
  if (releaseChannel(currentVersion) !== 'stable') throw new Error('Build baseline must be a stable MAJOR.MINOR.PATCH');
  if (!Array.isArray(tags)) throw new Error('Release tags must be an array');
  const [major, minor, patch] = currentVersion.split('.');
  const floor = `${major}.${minor}.${BigInt(patch) + 1n}`;
  const activeTags = tags.filter(tag => {
    const match = TAG_LINE_RE.exec(tag);
    return match && (!match[4] || Object.hasOwn(policy.channels, match[4]));
  });
  return formatChannelVersion(nextReleaseVersion('stable', activeTags, floor), channel);
}

export function scheduledVersion(channel, now = new Date(), tags = []) {
  if (!Object.hasOwn(policy.channels, channel)) throw new Error('Unknown release channel');
  if (!channelCrons(channel).length) throw new Error('Channel does not have a release schedule');
  if (!Array.isArray(tags)) throw new Error('Release tags must be an array');
  const due = dueReleaseChannels(now);
  const sequence = due.includes(channel) ? due : [channel];
  const simulatedTags = [...tags];
  let assigned;
  for (const currentChannel of sequence) {
    const version = nextBuildVersion(currentChannel, simulatedTags);
    simulatedTags.push(`v${version}`);
    if (currentChannel === channel) assigned = version;
  }
  return assigned;
}

export function scheduledReleasePlan(scheduleOrChannel, now = new Date(), tags = []) {
  const channel = resolveScheduledChannel(scheduleOrChannel);
  const releaseTime = targetReleaseTime(now);
  const version = scheduledVersion(channel, now, tags);
  return {
    channel,
    branch: policy.channels[channel].branch,
    developmentBranch: policy.developmentBranch,
    version,
    tag: `v${version}`,
    publishAt: releaseTime.toISOString(),
    releaseDate: releaseTime.toISOString().slice(0, 10),
  };
}

export async function waitForReleaseWindow(publishAt, now = Date.now(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  if (!publishAt) return 0;
  const targetMs = new Date(publishAt).getTime();
  if (!Number.isFinite(targetMs)) throw new Error('Invalid release publish time');
  const delayMs = Math.max(0, targetMs - now);
  if (delayMs > policy.leadMinutes * 2 * 60_000) throw new Error('Release publish time exceeds maximum lead window');
  if (delayMs > 0) await sleep(delayMs);
  return delayMs;
}

export function branchRiskProfile(branchName) {
  const normalized = String(branchName || '').trim().replace(/^(?:refs\/heads\/|origin\/)/, '');
  if (!normalized) throw new Error('Branch name is required');
  if (Object.hasOwn(policy.gitFlow.riskLevels, normalized)) {
    return policy.gitFlow.riskLevels[normalized];
  }
  if (/^promotion\/(beta|stable)\/\d{4}-\d\d-\d\d$/.test(normalized)) return policy.gitFlow.riskLevels.work;
  if (normalized.startsWith(policy.gitFlow.hotfixPrefix)) {
    const target = normalized.slice(policy.gitFlow.hotfixPrefix.length).split('/')[0];
    return policy.gitFlow.riskLevels[target] ?? policy.gitFlow.riskLevels.work;
  }
  if (policy.gitFlow.workBranchPrefixes.some(prefix => normalized.startsWith(prefix))) {
    return policy.gitFlow.riskLevels.work;
  }
  throw new Error(`Unknown branch risk profile for '${normalized}'`);
}

export function validateGitFlowBranch({ headBranch, baseBranch = policy.gitFlow.defaultBaseBranch }) {
  const head = String(headBranch || '').trim().replace(/^(?:refs\/heads\/|origin\/)/, '');
  const base = String(baseBranch || '').trim().replace(/^(?:refs\/heads\/|origin\/)/, '');
  if (!head) throw new Error('Working branch name is required');
  if (policy.gitFlow.protectedBranches.includes(head)) {
    throw new Error(`Direct commits or pushes to protected branch '${head}' are forbidden`);
  }
  if (head.startsWith('promotion/')) {
    const match = /^promotion\/(beta|stable)\/(\d{4}-\d\d-\d\d)$/.exec(head);
    const route = policy.promotion.routes[match?.[1]];
    if (!route || base !== route.branch) throw new Error('Promotion branches must identify a complete calendar period and target its configured branch');
    releasePeriod(match[1], match[2]);
    return { kind: 'promotion', headBranch: head, baseBranch: base, prTarget: base,
      riskProfile: policy.gitFlow.riskLevels.work, syncBranches: [] };
  }
  if (head.startsWith(policy.gitFlow.hotfixPrefix)) {
    const slug = head.slice(policy.gitFlow.hotfixPrefix.length);
    if (!slug || !/^[a-z0-9][a-z0-9._/-]*$/i.test(slug)) throw new Error('Invalid hotfix branch name');
    if (!Object.hasOwn(policy.gitFlow.syncTargets, base)) {
      throw new Error('Hotfix branches must branch off and target main or beta');
    }
    return {
      kind: 'hotfix',
      headBranch: head,
      baseBranch: base,
      prTarget: base,
      riskProfile: policy.gitFlow.riskLevels[base],
      syncBranches: [...policy.gitFlow.syncTargets[base]],
    };
  }
  const hasWorkPrefix = policy.gitFlow.workBranchPrefixes.some(
    prefix => head.startsWith(prefix) && /^[a-z0-9][a-z0-9._/-]*$/i.test(head.slice(prefix.length)),
  );
  if (!hasWorkPrefix) {
    throw new Error('Branch name must use feat/, fix/, refactor/, perf/, docs/, test/, chore/ or hotfix/');
  }
  if (base !== policy.gitFlow.defaultBaseBranch) {
    throw new Error('Standard work branches must branch off and target develop');
  }
  return {
    kind: 'standard',
    headBranch: head,
    baseBranch: policy.gitFlow.defaultBaseBranch,
    prTarget: policy.gitFlow.defaultBaseBranch,
    riskProfile: policy.gitFlow.riskLevels.work,
    syncBranches: [],
  };
}
