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
        Stage0 enforces an automated multi-channel release pipeline. Binaries are pre-built and
        cryptographically signed ahead of time to guarantee exact publication at
        <strong>00:00:00 UTC</strong>.
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
          The authoritative production build for all users and mission-critical workflows.
        </p>

        <div class="schedule-detail-list">
          <div class="schedule-detail-item">
            <span class="schedule-detail-label"
              ><i class="fa-regular fa-calendar-check" aria-hidden="true"></i>
              Release Cadence</span
            >
            <strong class="schedule-detail-value">Quarterly (00:00 UTC)</strong>
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
          Feature-complete stabilization builds for teams testing upcoming releases.
        </p>

        <div class="schedule-detail-list">
          <div class="schedule-detail-item">
            <span class="schedule-detail-label"
              ><i class="fa-regular fa-calendar-check" aria-hidden="true"></i>
              Release Cadence</span
            >
            <strong class="schedule-detail-value">Monthly (00:00 UTC)</strong>
          </div>
          <div class="schedule-detail-item">
            <span class="schedule-detail-label"
              ><i class="fa-regular fa-clock" aria-hidden="true"></i>
              Release Timing</span
            >
            <span class="schedule-detail-value">27th of every month at 00:00:00 UTC</span>
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

      <div class="schedule-card schedule-card-nightly">
        <div class="schedule-card-header">
          <div class="schedule-channel-badge badge-nightly">
            <i class="fa-solid fa-moon" aria-hidden="true"></i>
            <span>Daily Preview</span>
          </div>
          <span class="schedule-risk-tag risk-high">High Risk · Active Dev</span>
        </div>
        <h3 class="schedule-channel-name">Nightly Channel</h3>
        <p class="schedule-channel-summary">
          Daily builds reflecting the latest validated code from the development branch.
        </p>

        <div class="schedule-detail-list">
          <div class="schedule-detail-item">
            <span class="schedule-detail-label"
              ><i class="fa-regular fa-calendar-check" aria-hidden="true"></i>
              Release Cadence</span
            >
            <strong class="schedule-detail-value">Daily (00:00 UTC)</strong>
          </div>
          <div class="schedule-detail-item">
            <span class="schedule-detail-label"
              ><i class="fa-regular fa-clock" aria-hidden="true"></i>
              Release Timing</span
            >
            <span class="schedule-detail-value">Every day at 00:00:00 UTC</span>
          </div>
          <div class="schedule-detail-item">
            <span class="schedule-detail-label"
              ><i class="fa-solid fa-code-branch" aria-hidden="true"></i>
              Source Branch</span
            >
            <code class="schedule-branch-name">origin/nightly</code>
          </div>
          <div class="schedule-detail-item">
            <span class="schedule-detail-label"
              ><i class="fa-solid fa-tag" aria-hidden="true"></i>
              Version Pattern</span
            >
            <code class="schedule-version-pattern">0.0.x-nightly</code>
          </div>
        </div>

        <div class="schedule-card-footer">
          <span class="schedule-status-indicator">
            <i class="fa-solid fa-bolt" aria-hidden="true"></i>
            Bleeding-Edge Updates
          </span>
          <button
            type="button"
            class="btn-schedule-action"
            data-release-channel="nightly"
            onclick={() => {
              releases.selectChannel('nightly');
              document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Select Nightly
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
            <h4>00:00:00 UTC Release Guarantee</h4>
            <p>
              Building across 6 OS targets and 9 package formats takes 25–40 minutes. GitHub Actions
              runs a
              <strong>60-minute pre-build window</strong>
              starting at <code>23:00 UTC</code> to sign and stage drafts, releasing to the public
              precisely at <code>00:00:00 UTC</code>.
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
              <code>origin/main</code> is the authoritative production reference. While Nightly and
              Beta continuously advance patch numbers (<code>0.0.x-nightly</code>,
              <code>0.0.x-beta</code>), Stable remains the official <code>--latest</code> release on GitHub
              and in-app updaters never auto-upgrade Stable users to preview builds.
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
              directly to a release branch (<code>main</code>, <code>beta</code>, or
              <code>nightly</code>), it is automatically synchronized downstream (<code
                >main &rarr; beta &rarr; nightly &rarr; develop</code
              >) so no fix is ever lost.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
