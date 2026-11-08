<script>
  import { getContext } from 'svelte';
  import { ARCHIVE_URL } from '#lib/releases/catalog.js';
  const releases = getContext('releases');
</script>

<div class="download-card" id="card-linux" class:highlight={releases.device.os === 'linux'}>
  <div class="card-detected-badge">
    <i class="fa-solid fa-circle-check"></i>
    <span>Your OS</span>
  </div>
  <div class="download-header">
    <div class="download-icon-box linux">
      <i class="fa-brands fa-linux"></i>
    </div>
    <h3 class="download-title">Linux</h3>
    <p class="download-target">Ubuntu, Debian, Fedora, Arch, RHEL &amp; more</p>
  </div>
  <ul class="download-specs">
    <li>
      <i class="fa-solid fa-check check-icon"></i>
      <span><strong>.AppImage:</strong> Portable &amp; automatic in-app updates</span>
    </li>
    <li>
      <i class="fa-solid fa-check check-icon"></i>
      <span><strong>.deb:</strong> Debian, Ubuntu, Linux Mint</span>
    </li>
    <li>
      <i class="fa-solid fa-check check-icon"></i>
      <span><strong>.rpm:</strong> Fedora, RHEL, openSUSE</span>
    </li>
    <li>
      <i class="fa-solid fa-check check-icon"></i>
      <span><strong>.tar.gz:</strong> Standalone binary archive</span>
    </li>
    <li>
      <i class="fa-solid fa-check check-icon"></i>
      <span>Secret Service / Libsecret credential storage</span>
    </li>
  </ul>
  <div class="download-actions">
    <a
      href={releases.download('linuxAppImage').url}
      data-download-key="linuxAppImage"
      class="btn-pill-download"
      style="border-radius: 9999px"
      data-umami-event="download-linux-appimage"
      class:download-recommended={releases.recommended === 'linuxAppImage'}
    >
      <i class="fa-brands fa-linux"></i>
      <span>Download AppImage</span>
      <small class="download-asset-size" data-asset-size-for="linuxAppImage"
        >{releases.download('linuxAppImage').size
          ? '· ' + releases.download('linuxAppImage').size
          : ''}</small
      >
    </a>
    <div class="format-buttons-grid">
      <a
        href={releases.download('linuxDeb').url}
        data-download-key="linuxDeb"
        class="btn-format"
        title="Debian / Ubuntu Package"
        data-umami-event="download-linux-deb"
        class:download-recommended={releases.recommended === 'linuxDeb'}
      >
        <i class="fa-brands fa-ubuntu"></i>
        <span>.deb</span>
        <small class="download-asset-size" data-asset-size-for="linuxDeb"
          >{releases.download('linuxDeb').size
            ? '· ' + releases.download('linuxDeb').size
            : ''}</small
        >
      </a>
      <a
        href={releases.download('linuxRpm').url}
        data-download-key="linuxRpm"
        class="btn-format"
        title="Fedora / RHEL Package"
        data-umami-event="download-linux-rpm"
        class:download-recommended={releases.recommended === 'linuxRpm'}
      >
        <i class="fa-brands fa-redhat"></i>
        <span>.rpm</span>
        <small class="download-asset-size" data-asset-size-for="linuxRpm"
          >{releases.download('linuxRpm').size
            ? '· ' + releases.download('linuxRpm').size
            : ''}</small
        >
      </a>
      <a
        href={releases.download('tarArchive').url}
        data-download-key="tarArchive"
        class="btn-format"
        title="Standalone Tarball Archive"
        data-umami-event="download-linux-targz"
        class:download-recommended={releases.recommended === 'tarArchive'}
      >
        <i class="fa-solid fa-file-zipper"></i>
        <span>.tar.gz</span>
        <small class="download-asset-size" data-asset-size-for="tarArchive"
          >{releases.download('tarArchive').size
            ? '· ' + releases.download('tarArchive').size
            : ''}</small
        >
      </a>
      <a
        href={releases.selected?.html_url || ARCHIVE_URL}
        data-release-page-link
        class="btn-format"
        target="_blank"
        rel="noopener noreferrer"
        title="All Release Assets"
        data-umami-event="download-all-assets"
      >
        <i class="fa-solid fa-list-ul"></i>
        <span>All Assets</span>
      </a>
    </div>
  </div>
</div>
