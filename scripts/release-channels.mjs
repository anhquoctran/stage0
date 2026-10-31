import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const policy = JSON.parse(fs.readFileSync(path.join(root, 'shared/release-channels.json'), 'utf8'));

export function releaseChannel(version) {
  const core = '(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)';
  if (new RegExp(`^${core}$`).test(version)) return 'stable';
  const match = new RegExp(`^${core}-(nightly|beta)\\.([1-9]\\d{7})\\.(0|[1-9]\\d*)$`).exec(version);
  if (!match) throw new Error('Release version must be stable MAJOR.MINOR.PATCH or a nightly/beta dated prerelease');
  const date = match[5];
  const parsed = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10).replaceAll('-', '') !== date) throw new Error('Invalid release date');
  return match[4];
}

export function scheduledVersion(channel, now = new Date(), build = '1') {
  if (!Object.hasOwn(policy.channels, channel)) throw new Error('Unknown release channel');
  if (!policy.channels[channel].cron) throw new Error('Stable releases require manual workflow dispatch');
  if (!/^(0|[1-9]\d*)$/.test(String(build))) throw new Error('Invalid build number');
  const epoch = new Date(policy.epoch);
  if (!Number.isFinite(now.getTime()) || now < epoch) throw new Error('Invalid release time');
  const quarter = date => date.getUTCFullYear() * 4 + Math.floor(date.getUTCMonth() / 3);
  const elapsed = quarter(now) - quarter(epoch);
  const [major, minor, patch] = policy.baseVersion.split('.');
  const base = `${major}.${minor}.${BigInt(patch) + BigInt(elapsed + 1)}`;
  return `${base}-${channel}.${now.toISOString().slice(0, 10).replaceAll('-', '')}.${build}`;
}
