import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseChannel } from './release-channels.mjs';
import { RELEASE_REPOSITORY, releaseSource, sourceChanges } from './release-history.mjs';

// Commit subjects are untrusted Markdown; keep them literal and on one line.
const markdownText = text => text.replace(/[\r\n\t]/g, ' ').replace(/&/g, '&amp;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}[\]()!|#]/g, '\\$&');

export function createReleaseChangelog({ root, version, sourceSha, previousTag = '' }) {
  const channel = releaseChannel(version);
  if (previousTag && releaseChannel(previousTag.slice(1)) !== channel) throw new Error('Changelog baseline must use the same channel');
  const source = releaseSource(root, sourceSha);
  const commits = sourceChanges(root, source, previousTag);
  const url = `https://github.com/${RELEASE_REPOSITORY}`;
  const lines = [`# Stage0 v${version} Release Notes`, '',
    `This document describes the current release (v${version}).`, '',
    previousTag ? `Changes since [${previousTag}](${url}/releases/tag/${previousTag}) (${channel}).`
      : `First ${channel} release: source history through [${source.slice(0, 7)}](${url}/commit/${source}).`,
    '', '## Changes', ''];
  if (commits.length) {
    for (const commit of commits) lines.push(`- ${markdownText(commit.subject)} ([${commit.sha.slice(0, 7)}](${url}/commit/${commit.sha}))`);
  } else lines.push('- No source changes since the previous release.');
  if (previousTag) lines.push('', `[Full comparison](${url}/compare/${previousTag}...${source})`);
  return `${lines.join('\n')}\n`;
}

export function writeReleaseChangelog(root, notes) {
  fs.writeFileSync(path.join(root, 'RELEASE_NOTES.md'), notes);
  const literal = notes.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
  const embedded = path.join(root, 'frontend/features/about/config/releaseNotes.ts');
  fs.mkdirSync(path.dirname(embedded), { recursive: true });
  fs.writeFileSync(embedded,
    `export const DEFAULT_RELEASE_NOTES = \`${literal}\`;\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [tag, sourceSha, previousTag = ''] = process.argv.slice(2);
  if (!tag?.startsWith('v')) throw new Error('Expected release tag');
  const root = process.cwd();
  writeReleaseChangelog(root, createReleaseChangelog({ root, version: tag.slice(1), sourceSha, previousTag }));
}
