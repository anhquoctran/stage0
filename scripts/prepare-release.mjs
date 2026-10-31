import fs from 'node:fs';
import { policy, scheduledVersion, releaseChannel } from './release-channels.mjs';
import { setProjectVersion } from './bump-version.mjs';
import { syncAllMetadata } from './generate-about-info.mjs';

const [mode, value, build = '1'] = process.argv.slice(2);
if (mode === 'schedule') {
  const channel = Object.keys(policy.channels).find(key => policy.channels[key].cron === value) || value;
  const version = scheduledVersion(channel, new Date(), build);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag=v${version}\n`);
  console.log(`v${version}`);
} else if (mode === 'set') {
  releaseChannel(value);
  const { previousVersion } = setProjectVersion(value);
  const notes = fs.readFileSync('RELEASE_NOTES.md', 'utf8')
    .replace(/^# Stage0 v[^ ]+ Release Notes/m, `# Stage0 v${value} Release Notes`)
    .replace(/This document describes the current release \(v[^)]+\)\./, `This document describes the current release (v${value}).`);
  fs.writeFileSync('RELEASE_NOTES.md', notes);
  syncAllMetadata();
  const literal = notes.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
  fs.writeFileSync('frontend/features/about/config/releaseNotes.ts', `export const DEFAULT_RELEASE_NOTES = \`${literal}\`;\n`);
  if (fs.existsSync('website/index.html')) {
    fs.writeFileSync('website/index.html', fs.readFileSync('website/index.html', 'utf8').replaceAll(previousVersion, value));
  }
} else throw new Error('Usage: prepare-release.mjs schedule CHANNEL_OR_CRON BUILD | set VERSION');
