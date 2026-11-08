<script>
  import { getContext } from 'svelte';
  const releases = getContext('releases');
</script>

<div class="download-card" id="card-windows" class:highlight={releases.device.os === 'windows'}>
  <div class="card-detected-badge">
    <i class="fa-solid fa-circle-check"></i>
    <span>Your OS</span>
  </div>
  <div class="download-header">
    <div class="download-icon-box windows">
      <i class="fa-brands fa-windows"></i>
    </div>
    <h3 class="download-title">Windows</h3>
    <p class="download-target">Windows 10 / 11 (64-bit)</p>
  </div>
  <ul class="download-specs">
    <li>
      <i class="fa-solid fa-check check-icon"></i>
      <span>Native NSIS Setup Installer (.exe)</span>
    </li>
    <li>
      <i class="fa-solid fa-check check-icon"></i>
      <span>Windows Credential Manager integration</span>
    </li>
    <li>
      <i class="fa-solid fa-check check-icon"></i>
      <span>Integrated WebView2 acceleration</span>
    </li>
    <li>
      <i class="fa-solid fa-check check-icon"></i>
      <span>VS Code one-click path resolve</span>
    </li>
  </ul>
  <div class="download-actions">
    <a
      href={releases.download('windowsExe').url}
      data-download-key="windowsExe"
      class="btn-pill-download"
      style="border-radius: 9999px"
      data-umami-event="download-windows"
      class:download-recommended={releases.recommended === 'windowsExe'}
    >
      <i class="fa-brands fa-windows"></i>
      <span>Download for Windows</span>
      <small class="download-asset-size" data-asset-size-for="windowsExe"
        >{releases.download('windowsExe').size
          ? '· ' + releases.download('windowsExe').size
          : ''}</small
      >
    </a>
  </div>
</div>
