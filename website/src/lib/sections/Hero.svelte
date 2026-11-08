<script>
  import DesktopDemo from '#lib/mockup/DesktopDemo.svelte';
  import { getContext } from 'svelte';
  const releases = getContext('releases');
</script>

<section class="hero">
  <div class="container-fluid">
    <div class="hero-layout">
      <div class="hero-copy">
        <div class="hero-pill">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          <span>AI-Native Git Reviewer &amp; Sandbox</span>
        </div>

        <h1 class="hero-title">
          <span class="hero-typing-line">Autonomous AI Code Review.</span><br />
          <span class="hero-typing-line hero-typing-accent text-highlight">Before You Push.</span>
        </h1>

        <p class="hero-subtitle">
          Audit security flaws, enforce architectural boundaries, and predict merge conflicts
          in-memory — 100% private and local-first.
        </p>

        <div class="hero-cta">
          <a
            id="hero-download-btn"
            href={releases.hero.url}
            class="btn btn-primary hero-download-btn"
            style="border-radius: 9999px"
            data-umami-event="hero-download-click"
          >
            <i id="hero-os-icon" class={releases.hero.icon} style="font-size: 1.15rem"></i>
            <span class="hero-btn-content">
              <span id="hero-btn-text">{releases.hero.text}</span>
              <span id="hero-platform-label" class="hero-platform-label">{releases.hero.label}</span
              >
            </span>
          </a>

          <a
            href="#quickstart"
            class="btn btn-secondary hero-download-btn"
            style="border-radius: 9999px"
            data-umami-event="hero-quickstart-click"
          >
            <span>Quick Start Guide</span>
            <i class="fa-solid fa-arrow-right"></i>
          </a>
        </div>

        <div class="hero-alt-platforms">
          <span class="version-badge" data-latest-version>{releases.selected?.tag_name || '—'}</span
          >
          <span>&bull;</span>
          <span
            >Windows, macOS &amp; Linux &bull;
            <a
              href="#download"
              style="
                                        color: var(--ctp-mauve);
                                        text-decoration: underline;
                                    "
              data-umami-event="hero-all-downloads-click">All downloads &darr;</a
            ></span
          >
        </div>

        <div class="hero-stats">
          <div class="hero-stat-item">
            <i class="fa-solid fa-robot text-brand"></i>
            <span>Multi-Agent AI</span>
          </div>
          <div class="hero-stat-item">
            <i class="fa-solid fa-shield-halved text-brand"></i>
            <span>Security &amp; Arch Audits</span>
          </div>
          <div class="hero-stat-item">
            <i class="fa-solid fa-code-compare text-brand"></i>
            <span>In-Memory Conflict Engine</span>
          </div>
          <div class="hero-stat-item">
            <i class="fa-solid fa-lock text-brand"></i>
            <span>100% Local &amp; Private</span>
          </div>
        </div>
      </div>

      <div class="hero-visual">
        <DesktopDemo />
      </div>
    </div>
  </div>
</section>
