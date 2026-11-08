<script>
  import { getContext } from 'svelte';
  const releases = getContext('releases');
</script>

<div class="download-card" id="card-macos" class:highlight={releases.device.os === 'macos'}>
  <div class="card-detected-badge">
    <i class="fa-solid fa-circle-check"></i>
    <span>{releases.device.arch ? 'Your OS' : 'Choose your chip'}</span>
  </div>
  <div class="download-header">
    <div class="download-icon-box macos">
      <i class="fa-brands fa-apple"></i>
    </div>
    <h3 class="download-title">macOS</h3>
    <p class="download-target">macOS 11+ (Apple Silicon &amp; Intel)</p>
  </div>
  <ul class="download-specs">
    <li>
      <i class="fa-solid fa-check check-icon"></i>
      <span><strong>Apple Silicon</strong></span>
    </li>
    <li>
      <i class="fa-solid fa-check check-icon"></i>
      <span><strong>Intel Chipset</strong></span>
    </li>
    <li>
      <i class="fa-solid fa-check check-icon"></i>
      <span>Apple Keychain native encryption</span>
    </li>
    <li>
      <i class="fa-solid fa-check check-icon"></i>
      <span>macOS traffic lights window chrome</span>
    </li>
  </ul>
  <div class="download-actions">
    <a
      href={releases.download('macArm').url}
      data-download-key="macArm"
      class="btn-pill-download"
      style="border-radius: 9999px"
      data-umami-event="download-mac-arm"
      class:download-recommended={releases.recommended === 'macArm'}
    >
      <i class="fa-brands fa-apple"></i>
      <span>Download Apple Silicon</span>
      <small class="download-asset-size" data-asset-size-for="macArm"
        >{releases.download('macArm').size ? '· ' + releases.download('macArm').size : ''}</small
      >
    </a>
    <div class="format-buttons-grid">
      <a
        href={releases.download('macIntel').url}
        data-download-key="macIntel"
        class="btn-format"
        style="
                                        grid-column: span 2;
                                        border-radius: 9999px;
                                    "
        data-umami-event="download-mac-intel"
        class:download-recommended={releases.recommended === 'macIntel'}
      >
        <i class="fa-brands fa-apple"></i>
        <span>Download Intel Chipset</span>
        <small class="download-asset-size" data-asset-size-for="macIntel"
          >{releases.download('macIntel').size
            ? '· ' + releases.download('macIntel').size
            : ''}</small
        >
      </a>
    </div>
  </div>
</div>
