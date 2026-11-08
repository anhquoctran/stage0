<script>
  import { getContext } from 'svelte';
  const demo = getContext('demo');
</script>

<div class="mockup-tabbar">
  <div class="mockup-tabbar-left hidden-mobile">
    <button class="mockup-mr-list-btn" title="List all active virtual MR sessions">
      <i class="fa-solid fa-list-check"></i>
      <span>All MRs</span>
    </button>
    <div class="mockup-session-tab active">
      <i class="fa-solid fa-code-pull-request text-brand"></i>
      <span class="session-tab-title">!42: feat/token-vault-migration</span>
      <span class="session-tab-close" title="Close Session">&times;</span>
    </div>
    <button class="mockup-new-tab-btn" title="Open new branch comparison session">
      <i class="fa-solid fa-plus"></i>
    </button>
  </div>

  <div class="mockup-tabbar-subnav">
    <button
      class="mockup-subtab-btn"
      data-mockup-tab="diff"
      data-umami-event="mockup-tab-click"
      data-umami-event-tab="diff"
      class:active={demo.view === 'diff'}
      aria-pressed={demo.view === 'diff'}
      onclick={() => (demo.view = 'diff')}
    >
      <i class="fa-solid fa-code"></i>
      <span>Changes</span>
      <span class="subtab-counter">3</span>
    </button>
    <button
      class="mockup-subtab-btn"
      data-mockup-tab="ai"
      data-umami-event="mockup-tab-click"
      data-umami-event-tab="ai"
      class:active={demo.view === 'ai'}
      aria-pressed={demo.view === 'ai'}
      onclick={() => (demo.view = 'ai')}
    >
      <i class="fa-solid fa-robot"></i>
      <span>Multi-Agent Review</span>
      <span class="subtab-counter brand">3</span>
    </button>
    <button
      class="mockup-subtab-btn"
      data-mockup-tab="conflict"
      data-umami-event="mockup-tab-click"
      data-umami-event-tab="conflict"
      class:active={demo.view === 'conflict'}
      aria-pressed={demo.view === 'conflict'}
      onclick={() => (demo.view = 'conflict')}
    >
      <i class="fa-solid fa-diagram-project"></i>
      <span>Conflict Map</span>
    </button>
    <button
      class="mockup-subtab-btn"
      data-mockup-tab="commits"
      class:active={demo.view === 'commits'}
      aria-pressed={demo.view === 'commits'}
      onclick={() => (demo.view = 'commits')}
    >
      <i class="fa-solid fa-clock-rotate-left"></i>
      <span>Commits</span>
      <span class="subtab-counter">2</span>
    </button>
  </div>
</div>
