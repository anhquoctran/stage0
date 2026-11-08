<script>
  import { asset, resolve } from '$app/paths';
  import { onMount } from 'svelte';
  let menuOpen = $state(false);
  let theme = $state('mocha');
  onMount(() => {
    theme = document.documentElement.dataset.theme || 'mocha';
  });
  function toggleTheme() {
    theme = theme === 'mocha' ? 'latte' : 'mocha';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('stage0_theme', theme);
    } catch {}
  }
</script>

<svelte:document
  onclick={(event) => {
    if (!event.target.closest('.header')) menuOpen = false;
  }}
  onkeydown={(event) => {
    if (event.key === 'Escape') menuOpen = false;
  }}
/>
<header class="header">
  <div class="container-fluid nav-row">
    <a id="brand-logo" class="brand-link" href={resolve('/')}>
      <img src={asset('assets/app-icon.svg')} alt="Stage0 Logo" class="brand-logo" />
      <span>Stage0</span>
    </a>

    <ul class="nav-links">
      <li>
        <a href="#ai-reviewers" class="nav-link">AI Reviewers</a>
      </li>
      <li>
        <a href="#features" class="nav-link">Capabilities</a>
      </li>
      <li>
        <a href="#comparison" class="nav-link">Why Stage0</a>
      </li>
      <li><a href="#download" class="nav-link">Download</a></li>
      <li>
        <a href="#release-schedule" class="nav-link">Release Schedule</a>
      </li>
      <li>
        <a href="#quickstart" class="nav-link">Quick Start</a>
      </li>
      <li><a href="#faq" class="nav-link">FAQ</a></li>
    </ul>

    <div class="nav-actions">
      <button
        id="theme-toggle"
        class="btn btn-icon"
        title="Toggle theme (Catppuccin Mocha / Latte)"
        aria-label="Toggle theme"
        style="border-radius: 9999px"
        data-umami-event="header-theme-toggle"
        onclick={toggleTheme}
      >
        <i class={theme === 'latte' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'} id="theme-icon"></i>
      </button>

      <a
        href="https://github.com/anhquoctran/stage0"
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-secondary btn-github-desktop"
        style="border-radius: 9999px"
        data-umami-event="header-github-click"
      >
        <i class="fa-brands fa-github"></i>
        <span>GitHub</span>
      </a>

      <button
        id="mobile-menu-toggle"
        class="btn btn-icon mobile-menu-btn"
        title="Toggle menu"
        aria-label="Toggle menu"
        style="border-radius: 9999px"
        data-umami-event="mobile-menu-toggle"
        onclick={() => (menuOpen = !menuOpen)}
        aria-expanded={menuOpen}
        aria-controls="mobile-menu"
        ><i class={menuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'}></i></button
      >
    </div>
  </div>

  <div id="mobile-menu" class="mobile-menu" class:open={menuOpen}>
    <ul class="mobile-nav-links">
      <li>
        <a
          href="#ai-reviewers"
          class="mobile-nav-link"
          data-umami-event="mobile-nav-click"
          data-umami-event-nav="ai-reviewers"
          onclick={() => (menuOpen = false)}>AI Reviewers</a
        >
      </li>
      <li>
        <a
          href="#features"
          class="mobile-nav-link"
          data-umami-event="mobile-nav-click"
          data-umami-event-nav="capabilities"
          onclick={() => (menuOpen = false)}>Capabilities</a
        >
      </li>
      <li>
        <a
          href="#comparison"
          class="mobile-nav-link"
          data-umami-event="mobile-nav-click"
          data-umami-event-nav="why-stage0"
          onclick={() => (menuOpen = false)}>Why Stage0</a
        >
      </li>
      <li>
        <a
          href="#download"
          class="mobile-nav-link"
          data-umami-event="mobile-nav-click"
          data-umami-event-nav="download"
          onclick={() => (menuOpen = false)}>Download</a
        >
      </li>
      <li>
        <a
          href="#release-schedule"
          class="mobile-nav-link"
          data-umami-event="mobile-nav-click"
          data-umami-event-nav="release-schedule"
          onclick={() => (menuOpen = false)}>Release Schedule</a
        >
      </li>
      <li>
        <a
          href="#quickstart"
          class="mobile-nav-link"
          data-umami-event="mobile-nav-click"
          data-umami-event-nav="quickstart"
          onclick={() => (menuOpen = false)}>Quick Start</a
        >
      </li>
      <li>
        <a
          href="#faq"
          class="mobile-nav-link"
          data-umami-event="mobile-nav-click"
          data-umami-event-nav="faq"
          onclick={() => (menuOpen = false)}>FAQ</a
        >
      </li>
    </ul>
    <div class="mobile-menu-actions">
      <a
        href="https://github.com/anhquoctran/stage0"
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-secondary"
        style="border-radius: 9999px; width: 100%"
        data-umami-event="mobile-github-click"
      >
        <i class="fa-brands fa-github"></i>
        <span>View on GitHub</span>
      </a>
    </div>
  </div>
</header>
