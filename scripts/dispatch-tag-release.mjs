import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseChannel } from './release-channels.mjs';

/** The main-ref controller dispatches data; only the tag-ref run executes release code. */
export async function dispatchTagRelease(env = process.env, request = fetch) {
  if (env.GITHUB_REPOSITORY !== 'anhquoctran/stage0' || env.GITHUB_REF !== 'refs/heads/main'
    || env.GITHUB_REF_TYPE !== 'branch') throw new Error('Release controller must run on main');
  const tag = env.RELEASE_TAG;
  if (!tag?.startsWith('v')) throw new Error('Invalid release tag');
  releaseChannel(tag.slice(1));
  const sha = env.RELEASE_SNAPSHOT_SHA;
  if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('Invalid immutable release SHA');
  const publishAt = env.RELEASE_PUBLISH_AT || '';
  if (publishAt && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(publishAt)
    || !Number.isFinite(Date.parse(publishAt)))) throw new Error('Invalid UTC publication time');
  if (!env.GH_TOKEN) throw new Error('Release dispatch token is unavailable');
  const response = await request('https://api.github.com/repos/anhquoctran/stage0/actions/workflows/release.yml/dispatches', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ ref: tag, inputs: { publish_at: publishAt, source_sha: sha } }),
  });
  if (!response.ok) throw new Error(`Tag release dispatch failed (HTTP ${response.status})`);
  const url = `https://github.com/anhquoctran/stage0/actions/workflows/release.yml?query=${encodeURIComponent(`branch:${tag}`)}`;
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY,
    `\nRelease build requested for **${tag}** at \`${sha}\`. [Follow the tag-scoped run](${url}).\n`);
  return { tag, sha, url };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await dispatchTagRelease();
  console.log(`Release build requested: ${result.tag} (${result.sha})`);
}
