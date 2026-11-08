<script>
  import { getContext } from 'svelte';
  import ReleaseBrowser from '#lib/releases/ReleaseBrowser.svelte';
  import DownloadWindows from './DownloadWindows.svelte';
  import DownloadMacOS from './DownloadMacOS.svelte';
  import DownloadLinux from './DownloadLinux.svelte';
  const releases = getContext('releases');
</script>

<section id="download" class="section" style="background-color: var(--bg-card)">
  <div class="container">
    <div class="section-header">
      <span class="section-tag">Get Started Today</span>
      <h2 class="section-title">Download Stage0 for your desktop</h2>
      <p class="section-desc">
        Choose a stable, beta, or nightly release for Windows, macOS, and Linux. Free and open
        source under the MIT License.
      </p>
    </div>

    <ReleaseBrowser />

    <div class="download-grid">
      <DownloadWindows />

      <DownloadMacOS />

      <DownloadLinux />
    </div>

    <div
      style="
                        text-align: center;
                        color: var(--ctp-subtext0);
                        font-size: 0.875rem;
                    "
    >
      Need build artifacts, checksums or older versions? Visit the
      <a
        href="https://github.com/anhquoctran/stage0/releases"
        target="_blank"
        rel="noopener noreferrer"
        style="
                            color: var(--ctp-brand);
                            text-decoration: underline;
                        "
        data-umami-event="download-github-releases"
        ><i class="fa-brands fa-github"></i> GitHub Releases page</a
      >.
    </div>
  </div>
</section>
