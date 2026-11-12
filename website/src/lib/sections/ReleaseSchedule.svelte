<script>
  import { getContext } from 'svelte';
  const releases = getContext('releases');
</script>

<section id="release-schedule" class="section release-schedule-section">
  <div class="container">
    <div class="section-header">
      <span class="section-tag">Release Engineering</span>
      <h2 class="section-title">Automated Release Schedule &amp; Cadence</h2>
      <p class="section-desc">
        Beta gathers tested development changes monthly; Stable gathers approved Beta builds
        quarterly. Every release requires review, successful checks and signed packages.
      </p>
    </div>

    <div class="schedule-grid">
      <div class="schedule-card schedule-card-stable">
        <div class="schedule-card-header">
          <div class="schedule-channel-badge badge-stable">
            <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
            <span>Official Production</span>
          </div>
          <span class="schedule-risk-tag risk-low">Low Risk · Stable</span>
        </div>
        <h3 class="schedule-channel-name">Stable Channel</h3>
        <p class="schedule-channel-summary">
          Approved Beta builds from the previous quarter, reviewed for production use.
        </p>

        <div class="schedule-detail-list">
          <div class="schedule-detail-item">
            <span class="schedule-detail-label"
              ><i class="fa-regular fa-calendar-check" aria-hidden="true"></i>
              Release Cadence</span
            >
            <strong class="schedule-detail-value">Quarterly (UTC)</strong>
          </div>
          <div class="schedule-detail-item">
            <span class="schedule-detail-label"
              ><i class="fa-regular fa-clock" aria-hidden="true"></i>
              Release Timing</span
            >
            <span class="schedule-detail-value"
              >1st day of Q1, Q2, Q3, Q4 (01/01, 01/04, 01/07, 01/10)</span
            >
          </div>
          <div class="schedule-detail-item">
            <span class="schedule-detail-label"
              ><i class="fa-solid fa-code-branch" aria-hidden="true"></i>
              Source Branch</span
            >
            <code class="schedule-branch-name">origin/main</code>
          </div>
          <div class="schedule-detail-item">
            <span class="schedule-detail-label"
              ><i class="fa-solid fa-tag" aria-hidden="true"></i>
              Version Pattern</span
            >
            <code class="schedule-version-pattern">0.0.x</code>
          </div>
        </div>

        <div class="schedule-card-footer">
          <span class="schedule-status-indicator">
            <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
            GitHub
            <code class="inline-code">--latest</code>
            Release
          </span>
          <button
            type="button"
            class="btn-schedule-action"
            data-release-channel="stable"
            onclick={() => {
              releases.selectChannel('stable');
              document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Select Stable
          </button>
        </div>
      </div>

      <div class="schedule-card schedule-card-beta">
        <div class="schedule-card-header">
          <div class="schedule-channel-badge badge-beta">
            <i class="fa-solid fa-flask" aria-hidden="true"></i>
            <span>Monthly Preview</span>
          </div>
          <span class="schedule-risk-tag risk-medium">Medium Risk · Stabilizing</span>
        </div>
        <h3 class="schedule-channel-name">Beta Channel</h3>
        <p class="schedule-channel-summary">
          Tested development snapshots merged from the previous month’s 28th through this month’s
          26th.
        </p>

        <div class="schedule-detail-list">
          <div class="schedule-detail-item">
            <span class="schedule-detail-label"
              ><i class="fa-regular fa-calendar-check" aria-hidden="true"></i>
              Release Cadence</span
            >
            <strong class="schedule-detail-value">Monthly (UTC)</strong>
          </div>
          <div class="schedule-detail-item">
            <span class="schedule-detail-label"
              ><i class="fa-regular fa-clock" aria-hidden="true"></i>
              Release Timing</span
            >
            <span class="schedule-detail-value">27th of every month (UTC)</span>
          </div>
          <div class="schedule-detail-item">
            <span class="schedule-detail-label"
              ><i class="fa-solid fa-code-branch" aria-hidden="true"></i>
              Source Branch</span
            >
            <code class="schedule-branch-name">origin/beta</code>
          </div>
          <div class="schedule-detail-item">
            <span class="schedule-detail-label"
              ><i class="fa-solid fa-tag" aria-hidden="true"></i>
              Version Pattern</span
            >
            <code class="schedule-version-pattern">0.0.x-beta</code>
          </div>
        </div>

        <div class="schedule-card-footer">
          <span class="schedule-status-indicator">
            <i class="fa-solid fa-code-compare" aria-hidden="true"></i>
            Pre-release Validation
          </span>
          <button
            type="button"
            class="btn-schedule-action"
            data-release-channel="beta"
            onclick={() => {
              releases.selectChannel('beta');
              document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Select Beta
          </button>
        </div>
      </div>
    </div>

    <div class="schedule-policy-panel">
      <div class="schedule-policy-grid">
        <div class="schedule-policy-item">
          <div class="schedule-policy-icon">
            <i class="fa-solid fa-stopwatch" aria-hidden="true"></i>
          </div>
          <div class="schedule-policy-content">
            <h4>Reviewed Calendar Releases</h4>
            <p>
              Each period closes at <code>00:00 UTC</code> on its release day. Publication follows successful
              CI, human approval and signed builds on that UTC day. An empty or unchanged period does
              not produce a release.
            </p>
          </div>
        </div>

        <div class="schedule-policy-item">
          <div class="schedule-policy-icon">
            <i class="fa-solid fa-award" aria-hidden="true"></i>
          </div>
          <div class="schedule-policy-content">
            <h4>Production Stability Authority</h4>
            <p>
              <code>origin/main</code> is the authoritative production reference. While Beta
              advances patch numbers (<code>0.0.x-beta</code>), Stable remains the official
              <code>--latest</code> release on GitHub and in-app updaters never auto-upgrade Stable users
              to preview builds.
            </p>
          </div>
        </div>

        <div class="schedule-policy-item">
          <div class="schedule-policy-icon">
            <i class="fa-solid fa-diagram-project" aria-hidden="true"></i>
          </div>
          <div class="schedule-policy-content">
            <h4>Git Flow &amp; Downstream Hotfix Sync</h4>
            <p>
              Standard development branches off
              <code>origin/develop</code> and merges via PR. When an urgent hotfix is applied
              through a checked release PR (<code>main</code> or <code>beta</code>), it is
              synchronized through separate checked PRs back to <code>beta</code> and
              <code>develop</code> as applicable.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
