<script>
  import ComparisonTable from '#lib/sections/ComparisonTable.svelte';
  import { asset, resolve } from '$app/paths';
  import { setContext } from 'svelte';
  const filter = $state({ value: 'all' });
  setContext('comparison', filter);
</script>

<section id="comparison" class="section">
  <div class="container">
    <div class="section-header">
      <span class="section-tag">Comparison</span>
      <h2 class="section-title">Why Stage0 Beats Traditional PRs &amp; In-Editor AI</h2>
      <p class="section-desc">
        Compare Stage0's zero-checkout in-memory review against late cloud PRs and
        working-tree-invasive in-editor AI agents.
      </p>
    </div>

    <div class="comparison-desktop">
      <ComparisonTable />
    </div>

    <div class="comparison-mobile">
      <div class="comp-filter-bar">
        <span class="comp-filter-label"><i class="fa-solid fa-sliders"></i> Compare with:</span>
        <div class="comp-filter-pills" role="tablist">
          <button
            type="button"
            class="comp-filter-btn"
            data-comp-filter="all"
            data-umami-event="comparison-filter-click"
            data-umami-event-filter="all"
            class:active={filter.value === 'all'}
            onclick={() => (filter.value = 'all')}
          >
            All
          </button>
          <button
            type="button"
            class="comp-filter-btn"
            data-comp-filter="pr"
            data-umami-event="comparison-filter-click"
            data-umami-event-filter="pr"
            class:active={filter.value === 'pr'}
            onclick={() => (filter.value = 'pr')}
          >
            Web PR
          </button>
          <button
            type="button"
            class="comp-filter-btn"
            data-comp-filter="ai"
            data-umami-event="comparison-filter-click"
            data-umami-event-filter="ai"
            class:active={filter.value === 'ai'}
            onclick={() => (filter.value = 'ai')}
          >
            In-Editor AI
          </button>
        </div>
      </div>

      <div class="comp-mobile-stack">
        <div class="comp-mobile-card">
          <div class="comp-card-header">
            <span class="comp-card-pill">Dimension 1</span>
            <h3 class="comp-card-title">Review Timing &amp; Flow</h3>
          </div>
          <div class="comp-stage0-box">
            <div class="comp-stage0-header">
              <div class="comp-stage0-tag">
                <img src={asset('assets/app-icon.svg')} alt="Stage0 Logo" class="comp-mini-logo" />
                <span>Stage0</span>
              </div>
              <span class="badge-win"
                ><i class="fa-solid fa-check"></i>
                Pre-Flight</span
              >
            </div>
            <p class="comp-stage0-text">
              Instant &amp; Pre-Flight on local branches before any git push
            </p>
          </div>
          <div class="comp-alts-list">
            <div
              class="comp-alt-row"
              data-comp-target="pr"
              style:display={filter.value === 'all' || filter.value === 'pr' ? undefined : 'none'}
            >
              <span class="comp-alt-source">Standard Web PR:</span>
              <span class="comp-alt-desc">Late (after push, waiting for CI / human reviewers)</span>
            </div>
            <div
              class="comp-alt-row"
              data-comp-target="ai"
              style:display={filter.value === 'all' || filter.value === 'ai' ? undefined : 'none'}
            >
              <span class="comp-alt-source">In-Editor AI:</span>
              <span class="comp-alt-desc text-danger"
                ><i class="fa-solid fa-triangle-exclamation"></i>
                Clutters editing tabs; interrupts active coding</span
              >
            </div>
          </div>
        </div>

        <div class="comp-mobile-card">
          <div class="comp-card-header">
            <span class="comp-card-pill">Dimension 2</span>
            <h3 class="comp-card-title">3-Way Git Merge Context</h3>
          </div>
          <div class="comp-stage0-box">
            <div class="comp-stage0-header">
              <div class="comp-stage0-tag">
                <img src={asset('assets/app-icon.svg')} alt="Stage0 Logo" class="comp-mini-logo" />
                <span>Stage0</span>
              </div>
              <span class="badge-win"
                ><i class="fa-solid fa-check"></i>
                Native Git</span
              >
            </div>
            <p class="comp-stage0-text">
              Full in-memory 3-way merge base &amp; pre-push conflict preview
            </p>
          </div>
          <div class="comp-alts-list">
            <div
              class="comp-alt-row"
              data-comp-target="pr"
              style:display={filter.value === 'all' || filter.value === 'pr' ? undefined : 'none'}
            >
              <span class="comp-alt-source">Standard Web PR:</span>
              <span class="comp-alt-desc">Evaluated remotely on cloud servers</span>
            </div>
            <div
              class="comp-alt-row"
              data-comp-target="ai"
              style:display={filter.value === 'all' || filter.value === 'ai' ? undefined : 'none'}
            >
              <span class="comp-alt-source">In-Editor AI:</span>
              <span class="comp-alt-desc text-danger"
                ><i class="fa-solid fa-xmark"></i> Zero 3-way merge base or conflict engine</span
              >
            </div>
          </div>
        </div>

        <div class="comp-mobile-card">
          <div class="comp-card-header">
            <span class="comp-card-pill">Dimension 3</span>
            <h3 class="comp-card-title">Working Tree Safety</h3>
          </div>
          <div class="comp-stage0-box">
            <div class="comp-stage0-header">
              <div class="comp-stage0-tag">
                <img src={asset('assets/app-icon.svg')} alt="Stage0 Logo" class="comp-mini-logo" />
                <span>Stage0</span>
              </div>
              <span class="badge-win"
                ><i class="fa-solid fa-check"></i>
                Zero-Risk</span
              >
            </div>
            <p class="comp-stage0-text">
              In-Memory sandbox, zero-checkout, never mutates active files
            </p>
          </div>
          <div class="comp-alts-list">
            <div
              class="comp-alt-row"
              data-comp-target="pr"
              style:display={filter.value === 'all' || filter.value === 'pr' ? undefined : 'none'}
            >
              <span class="comp-alt-source">Standard Web PR:</span>
              <span class="comp-alt-desc">Must push branch to remote before reviewing</span>
            </div>
            <div
              class="comp-alt-row"
              data-comp-target="ai"
              style:display={filter.value === 'all' || filter.value === 'ai' ? undefined : 'none'}
            >
              <span class="comp-alt-source">In-Editor AI:</span>
              <span class="comp-alt-desc text-danger"
                ><i class="fa-solid fa-xmark"></i>
                Mutates active files; requires branch checkout &amp; stash</span
              >
            </div>
          </div>
        </div>

        <div class="comp-mobile-card">
          <div class="comp-card-header">
            <span class="comp-card-pill">Dimension 4</span>
            <h3 class="comp-card-title">Specialized Review Personas</h3>
          </div>
          <div class="comp-stage0-box">
            <div class="comp-stage0-header">
              <div class="comp-stage0-tag">
                <img src={asset('assets/app-icon.svg')} alt="Stage0 Logo" class="comp-mini-logo" />
                <span>Stage0</span>
              </div>
              <span class="badge-win"
                ><i class="fa-solid fa-check"></i>
                Multi-Agent</span
              >
            </div>
            <p class="comp-stage0-text">
              Security Sentinel, Architecture Guardian, Perf &amp; Merge bots
            </p>
          </div>
          <div class="comp-alts-list">
            <div
              class="comp-alt-row"
              data-comp-target="pr"
              style:display={filter.value === 'all' || filter.value === 'pr' ? undefined : 'none'}
            >
              <span class="comp-alt-source">Standard Web PR:</span>
              <span class="comp-alt-desc">Expensive, fragmented third-party cloud bots</span>
            </div>
            <div
              class="comp-alt-row"
              data-comp-target="ai"
              style:display={filter.value === 'all' || filter.value === 'ai' ? undefined : 'none'}
            >
              <span class="comp-alt-source">In-Editor AI:</span>
              <span class="comp-alt-desc"
                >Single generalist chat prompt without specialized roles</span
              >
            </div>
          </div>
        </div>

        <div class="comp-mobile-card">
          <div class="comp-card-header">
            <span class="comp-card-pill">Dimension 5</span>
            <h3 class="comp-card-title">Confidentiality &amp; Privacy</h3>
          </div>
          <div class="comp-stage0-box">
            <div class="comp-stage0-header">
              <div class="comp-stage0-tag">
                <img src={asset('assets/app-icon.svg')} alt="Stage0 Logo" class="comp-mini-logo" />
                <span>Stage0</span>
              </div>
              <span class="badge-win"
                ><i class="fa-solid fa-check"></i>
                Local-First</span
              >
            </div>
            <p class="comp-stage0-text">
              100% Local-First, supports offline Ollama &amp; OS Keychain encryption
            </p>
          </div>
          <div class="comp-alts-list">
            <div
              class="comp-alt-row"
              data-comp-target="pr"
              style:display={filter.value === 'all' || filter.value === 'pr' ? undefined : 'none'}
            >
              <span class="comp-alt-source">Standard Web PR:</span>
              <span class="comp-alt-desc"
                >Source code stored and processed on public/private SaaS clouds</span
              >
            </div>
            <div
              class="comp-alt-row"
              data-comp-target="ai"
              style:display={filter.value === 'all' || filter.value === 'ai' ? undefined : 'none'}
            >
              <span class="comp-alt-source">In-Editor AI:</span>
              <span class="comp-alt-desc text-danger"
                ><i class="fa-solid fa-triangle-exclamation"></i>
                Cloud-dependent; proprietary code indexed offsite</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
