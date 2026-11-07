import { releaseChannel } from './release-channels.mjs';
import { releaseGit, releaseSource } from './release-history.mjs';
import { promotionApi, candidateEvidence, InvalidReleaseCandidate } from './release-promotion-github.mjs';

/** Fetch objects only. Never checkout or execute a candidate's scripts/workflow. */
export function fetchPromotionSource(root, tag, api = promotionApi, evidenceOptions) {
  if (typeof tag !== 'string') throw new InvalidReleaseCandidate('Select a published candidate tag');
  releaseChannel(tag.slice(1));
  if (!/^v\d+\.\d+\.\d+-(nightly|beta)$/.test(tag)) throw new InvalidReleaseCandidate('Invalid preview candidate tag');
  releaseGit(root, 'fetch', 'origin', `refs/tags/${tag}`);
  const sha = releaseGit(root, 'rev-parse', 'FETCH_HEAD^{commit}');
  const sourceSha = releaseSource(root, sha);
  const parents = releaseGit(root, 'show', '-s', '--format=%P', sha).split(' ');
  if (parents.length !== 1 || parents[0] !== sourceSha) throw new InvalidReleaseCandidate('Release snapshot must have exactly one source parent');
  const metadata = new Set(['package.json', 'backend/Cargo.toml', 'backend/Cargo.lock', 'backend/tauri.conf.json',
    'backend/about.json', 'backend/Info.plist', 'backend/hooks.nsh', 'frontend/features/about/config/about.ts',
    'frontend/features/about/config/releaseNotes.ts', 'website/index.html', 'RELEASE_NOTES.md', 'LICENSE']);
  const changed = releaseGit(root, 'diff', '--name-only', sourceSha, sha, '--').split('\n').filter(Boolean);
  if (changed.some(file => !metadata.has(file))) throw new InvalidReleaseCandidate('Release snapshot contains source changes outside generated metadata');
  const message = releaseGit(root, 'show', '-s', '--format=%B', sha);
  if (sourceSha === sha || !message.split('\n').includes(`Stage0-Source-Commit: ${sourceSha}`)) {
    throw new InvalidReleaseCandidate('Candidate requires an immutable release snapshot with explicit source provenance');
  }
  const evidence = candidateEvidence(tag, sha, api, evidenceOptions);
  return { tag, sha, sourceSha, ...evidence };
}

