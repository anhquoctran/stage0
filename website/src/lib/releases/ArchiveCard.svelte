<script>
  import { releaseChannelFromTag, matchingAssets } from './catalog.js';
  let { release, os = 'all', arch = 'all', onstatus } = $props();
  const channel = $derived(releaseChannelFromTag(release.tag_name));
  const assets = $derived(matchingAssets(release, os, arch));
  const groups = $derived(
    ['linux', 'macos', 'windows']
      .map((os) => assets.filter((asset) => asset.os === os))
      .filter((group) => group.length),
  );
  const date = $derived(new Date(release.published_at));
  async function copy(digest) {
    try {
      await navigator.clipboard.writeText(digest);
      onstatus('SHA-256 digest copied to clipboard.');
    } catch {
      onstatus('Could not copy SHA-256 digest.');
    }
  }
</script>

<article class="release-history-card">
  <div class="release-history-card-header">
    <div class="release-history-title-row">
      <h3>{release.tag_name}</h3>
      <span class="release-channel-tag {channel}">{channel}</span>
    </div>
    <div class="release-history-meta">
      <time datetime={Number.isNaN(date.getTime()) ? undefined : date.toISOString()}
        >{Number.isNaN(date.getTime())
          ? 'Date unavailable'
          : date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            })}</time
      >
      <a
        class="release-history-notes-link"
        href={release.html_url}
        target="_blank"
        rel="noopener noreferrer">Release notes</a
      >
    </div>
  </div>
  <div class="release-history-platforms">
    {#each groups as group (group[0].os)}
      <section class="release-history-platform">
        <h4>
          <i class="{group[0].iconClass} release-history-asset-logo" aria-hidden="true"></i><span
            >{group[0].osLabel}</span
          >
        </h4>
        <ul class="release-history-assets">
          {#each group as asset (asset.url)}
            <li class="release-history-asset-item">
              <div class="release-history-asset-row">
                <div class="release-history-asset-details">
                  <span class="release-history-asset-arch">{asset.archLabel}</span><span
                    class="release-history-asset-format">{asset.formatLabel}</span
                  ><small class="release-history-asset-size" class:is-unavailable={!asset.size}
                    >{asset.size || 'Size unavailable'}</small
                  >
                </div>
                <button
                  type="button"
                  class="release-history-asset-digest"
                  class:is-unavailable={!asset.digest}
                  disabled={!asset.digest}
                  aria-label={asset.digest
                    ? `Copy SHA-256 digest ${asset.digest}`
                    : 'SHA-256 digest unavailable'}
                  title={asset.digest
                    ? `Copy SHA-256 digest ${asset.digest}`
                    : 'SHA-256 digest unavailable'}
                  onclick={() => copy(asset.digest)}
                  ><span>SHA-256</span><code
                    >{asset.digest
                      ? `${asset.digest.slice(0, 6)}…${asset.digest.slice(-6)}`
                      : 'unavailable'}</code
                  ></button
                >
                <a
                  class="release-history-download-button"
                  href={asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Download ${asset.label}${asset.size ? ` (${asset.size})` : ''}`}
                  ><i class="fa-solid fa-arrow-down-to-line" aria-hidden="true"></i><span
                    >Download</span
                  ></a
                >
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
</article>
