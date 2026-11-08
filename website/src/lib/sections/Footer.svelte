<script>
  import { asset, resolve } from '$app/paths';
</script>

<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <div class="brand-link" style="margin-bottom: 0.75rem">
          <img src={asset('assets/app-icon.svg')} alt="Stage0 Logo" class="brand-logo" />
          <span>Stage0</span>
        </div>
        <p
          style="
                                line-height: 1.6;
                                max-width: 320px;
                                color: var(--ctp-subtext0);
                                margin-bottom: 1rem;
                            "
        >
          AI-Native Git Code Reviewer &amp; Virtual MR Sandbox for auditing changes, predicting
          merge conflicts, and refining code before pushing.
        </p>
        <p
          style="
                                font-size: 0.8125rem;
                                color: var(--ctp-overlay1);
                            "
        >
          Created by <strong>Anh Quoc Tran</strong>.
        </p>
      </div>

      <div>
        <h4 class="footer-col-title">Navigation</h4>
        <ul class="footer-links">
          <li>
            <a href="#ai-reviewers"><i class="fa-solid fa-angle-right"></i> AI Reviewers</a>
          </li>
          <li>
            <a href="#features"
              ><i class="fa-solid fa-angle-right"></i>
              Capabilities</a
            >
          </li>
          <li>
            <a href="#comparison"><i class="fa-solid fa-angle-right"></i> Why Stage0</a>
          </li>
          <li>
            <a href="#download"
              ><i class="fa-solid fa-angle-right"></i>
              Downloads</a
            >
          </li>
          <li>
            <a href="#release-schedule"
              ><i class="fa-solid fa-angle-right"></i>
              Release Schedule</a
            >
          </li>
          <li>
            <a href="#quickstart"
              ><i class="fa-solid fa-angle-right"></i>
              Quick Start</a
            >
          </li>
        </ul>
      </div>

      <div>
        <h4 class="footer-col-title">Platforms</h4>
        <ul class="footer-links">
          <li>
            <a href="#download"
              ><i class="fa-brands fa-windows"></i>
              Windows</a
            >
          </li>
          <li>
            <a href="#download"><i class="fa-brands fa-apple"></i> macOS</a>
          </li>
          <li>
            <a href="#download"><i class="fa-brands fa-linux"></i> Linux</a>
          </li>
        </ul>
      </div>

      <div>
        <h4 class="footer-col-title">Open Source</h4>
        <ul class="footer-links">
          <li>
            <a
              href="https://github.com/anhquoctran/stage0"
              target="_blank"
              rel="noopener noreferrer"
              data-umami-event="footer-link-click"
              data-umami-event-name="github-repo"
              ><i class="fa-brands fa-github"></i> GitHub Repository</a
            >
          </li>
          <li>
            <a
              href="https://github.com/anhquoctran/stage0/releases"
              target="_blank"
              rel="noopener noreferrer"
              data-umami-event="footer-link-click"
              data-umami-event-name="releases"
              ><i class="fa-solid fa-tag"></i> Releases &amp; Changelog</a
            >
          </li>
          <li>
            <a
              href="https://github.com/anhquoctran/stage0/issues"
              target="_blank"
              rel="noopener noreferrer"
              data-umami-event="footer-link-click"
              data-umami-event-name="issues"
              ><i class="fa-solid fa-circle-exclamation"></i>
              Report an Issue</a
            >
          </li>
          <li>
            <a
              href="https://github.com/anhquoctran/stage0/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              data-umami-event="footer-link-click"
              data-umami-event-name="license"
              ><i class="fa-solid fa-scale-balanced"></i>
              MIT License</a
            >
          </li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <div>
        &copy; <span id="credit-year">{new Date().getFullYear()}</span> Anh Quoc Tran. Licensed under
        the MIT License.
      </div>
      <div style="display: flex; gap: 1rem; align-items: center">
        <span
          style="
                                font-size: 0.8125rem;
                                color: var(--ctp-overlay1);
                            ">Designed with Catppuccin Mocha &amp; Latte</span
        >
      </div>
    </div>
  </div>
</footer>
