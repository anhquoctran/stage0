<script>
  import { getContext } from 'svelte';
  import { matchingAssets, pageNumbers, releaseChannelFromTag } from './catalog.js';
  import ArchiveCard from './ArchiveCard.svelte';
  const releases = getContext('releases');
  let os = $state('all');
  let arch = $state('all');
  let stableOnly = $state(true);
  let requestedPage = $state(1);
  let message = $state('');
  const filtered = $derived(
    releases.catalog.filter(
      (release) =>
        (!stableOnly || releaseChannelFromTag(release.tag_name) === 'stable') &&
        matchingAssets(release, os, arch).length,
    ),
  );
  const total = $derived(Math.max(1, Math.ceil(filtered.length / 10)));
  const page = $derived(Math.min(requestedPage, total));
  const visible = $derived(filtered.slice((page - 1) * 10, page * 10));
  const status = $derived(
    message ||
      releases.error ||
      (releases.loading
        ? 'Loading releases…'
        : filtered.length
          ? `Showing ${(page - 1) * 10 + 1}–${Math.min(page * 10, filtered.length)} of ${filtered.length} matching releases`
          : 'No releases match these filters.'),
  );
  function reset() {
    requestedPage = 1;
    message = '';
  }
</script>

<section id="release-history" class="section release-history">
  <div class="container">
    <div class="section-header release-history-header">
      <span class="section-tag">Release archive</span>
      <h2 class="section-title">Previous releases</h2>
      <p class="section-desc">Browse builds by operating system and processor architecture.</p>
    </div>
    <div class="release-history-panel">
      <div class="release-history-filters">
        <fieldset class="release-history-filter">
          <legend>Operating system</legend>
          <div class="release-filter-options" role="group" aria-label="Filter by operating system">
            {#each [['all', 'All OS'], ['windows', 'Windows'], ['macos', 'macOS'], ['linux', 'Linux']] as [value, label]}
              <button
                type="button"
                class="release-filter-button"
                class:is-active={os === value}
                data-history-os={value}
                aria-pressed={os === value}
                onclick={() => {
                  os = value;
                  reset();
                }}>{label}</button
              >
            {/each}
          </div>
        </fieldset>
        <fieldset class="release-history-filter">
          <legend>Architecture</legend>
          <div class="release-filter-options" role="group" aria-label="Filter by architecture">
            {#each [['all', 'All'], ['x64', 'AMD64'], ['arm64', 'ARM64']] as [value, label]}
              <button
                type="button"
                class="release-filter-button"
                class:is-active={arch === value}
                data-history-arch={value}
                aria-pressed={arch === value}
                onclick={() => {
                  arch = value;
                  reset();
                }}>{label}</button
              >
            {/each}
          </div>
        </fieldset>
        <fieldset class="release-history-filter">
          <legend>Release channel</legend><label class="release-history-stable-toggle"
            ><input
              type="checkbox"
              id="release-history-stable-only"
              bind:checked={stableOnly}
              onchange={reset}
            /><span>Stable only</span></label
          >
        </fieldset>
      </div>
      <p
        id="release-history-status"
        class="release-history-status"
        role="status"
        aria-live="polite"
      >
        {status}
      </p>
      <div id="release-history-list" class="release-history-list">
        {#each visible as release (release.tag_name)}<ArchiveCard
            {release}
            {os}
            {arch}
            onstatus={(value) => (message = value)}
          />{/each}
      </div>
      <nav class="release-history-pagination" aria-label="Release history pages">
        <button
          type="button"
          id="release-history-previous"
          aria-label="Previous page"
          class="release-history-page-button"
          disabled={page <= 1 || releases.loading}
          onclick={() => {
            requestedPage = page - 1;
            message = '';
          }}>‹</button
        >
        <span id="release-history-page-label" class="release-history-page-numbers">
          {#each pageNumbers(page, total) as number (number)}
            {#if typeof number === 'number'}<button
                type="button"
                class="release-history-page-button"
                class:is-active={page === number}
                aria-label={`Go to page ${number}`}
                aria-current={page === number ? 'page' : undefined}
                disabled={releases.loading}
                onclick={() => {
                  requestedPage = number;
                  message = '';
                }}>{number}</button
              >
            {:else}<span class="release-history-page-gap" aria-hidden="true">…</span>{/if}
          {/each}
        </span>
        <button
          type="button"
          id="release-history-next"
          aria-label="Next page"
          class="release-history-page-button"
          disabled={page >= total || releases.loading}
          onclick={() => {
            requestedPage = page + 1;
            message = '';
          }}>›</button
        >
        {#if releases.hasMore}<button
            type="button"
            id="release-history-load-more"
            class="release-history-retry"
            disabled={releases.loading}
            onclick={() => {
              message = '';
              releases.load(true);
            }}>Load older releases</button
          >{/if}
        {#if releases.error}<button
            type="button"
            id="release-history-retry"
            class="release-history-retry"
            onclick={() => releases.load(releases.loaded)}>Retry</button
          >{/if}
      </nav>
    </div>
  </div>
</section>
