<script>
  import { getContext } from 'svelte';
  import { ARCHIVE_URL } from './catalog.js';
  const releases = getContext('releases');
  let open = $state(false);
  let trigger;
</script>

<svelte:document
  onkeydown={(event) => {
    if (open && event.key === 'Escape') {
      open = false;
      trigger?.focus();
    }
  }}
  onclick={(event) => {
    if (!event.target.closest('#release-version-picker')) open = false;
  }}
/>
<div class="release-browser" id="release-browser">
  <div class="release-browser-heading">
    <div>
      <h3>Release channel</h3>
      <p>
        Choose a channel and version to update the downloads below. Releases are published at exact
        00:00 UTC.
      </p>
    </div>
    <div class="release-browser-links">
      <a
        id="selected-release-link"
        href={releases.selected?.html_url || ARCHIVE_URL}
        target="_blank"
        rel="noopener noreferrer"
        >Release notes &amp; all assets <i
          class="fa-solid fa-arrow-up-right-from-square"
          aria-hidden="true"
        ></i></a
      >
      <a id="release-schedule-link" href="#release-schedule"
        >Release schedule &amp; cadence <i class="fa-solid fa-calendar-days" aria-hidden="true"
        ></i></a
      >
      <a id="release-history-open" href="#release-history"
        >Browse previous releases <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"
        ></i></a
      >
    </div>
  </div>
  <div class="release-browser-controls">
    <div class="release-channel-picker" role="group" aria-label="Release channel">
      {#each ['stable', 'beta'] as channel}
        <button
          type="button"
          class="release-channel-button"
          class:is-active={releases.channel === channel}
          data-release-channel={channel}
          aria-pressed={releases.channel === channel}
          onclick={() => {
            releases.selectChannel(channel);
            open = false;
          }}>{channel[0].toUpperCase() + channel.slice(1)}</button
        >
      {/each}
    </div>
    <div class="release-version-control">
      <span>Version</span>
      <details
        class="release-version-picker"
        class:is-disabled={!releases.choices.length}
        id="release-version-picker"
        bind:open
      >
        <summary
          id="release-version-trigger"
          bind:this={trigger}
          aria-expanded={open}
          aria-disabled={!releases.choices.length}
          onclick={(event) => {
            if (!releases.choices.length) event.preventDefault();
          }}
        >
          <span id="release-version-label"
            >{releases.selected?.tag_name ||
              (releases.loading ? 'Loading releases…' : 'No releases available')}</span
          >
          <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
        </summary>
        <div class="release-version-options" id="release-version-options">
          {#each releases.choices as release (release.tag_name)}
            <button
              type="button"
              class="release-version-option"
              class:is-selected={release.tag_name === releases.selected?.tag_name}
              data-release-tag={release.tag_name}
              aria-pressed={release.tag_name === releases.selected?.tag_name}
              onclick={() => {
                releases.selectVersion(release.tag_name);
                open = false;
                trigger?.focus();
              }}>{release.tag_name}</button
            >
          {/each}
        </div>
      </details>
    </div>
    <p id="release-channel-status" class="release-channel-status" role="status" aria-live="polite">
      {releases.status}
    </p>
    {#if releases.error}<button
        type="button"
        class="release-history-retry"
        onclick={() => releases.load()}>Retry</button
      >{/if}
  </div>
</div>
