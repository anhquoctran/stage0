<script>
  import CopyButton from '#lib/components/CopyButton.svelte';
  let distro = $state('appimage');
</script>

<section id="install" class="section">
  <div class="container">
    <div class="section-header">
      <span class="section-tag">Setup in seconds</span>
      <h2 class="section-title">Quick Installation Instructions</h2>
      <p class="section-desc">
        Follow the simple steps below for your platform to install and get Stage0 ready to use.
      </p>
    </div>

    <div class="step-container">
      <div class="step-card">
        <div class="step-header">
          <div class="step-number">1</div>
          <h3 class="step-title">
            <i class="fa-brands fa-git-alt text-brand"></i>
            <span>Ensure Git is installed on your computer</span>
          </h3>
        </div>
        <div class="step-body">
          <p class="step-desc">
            Stage0 connects to your system Git binary to read commits, branches, and calculate merge
            trees. Git 2.38 or later is recommended.
          </p>
          <div class="code-box">
            <span id="code-git-version">git --version</span>
            <CopyButton target="code-git-version" />
          </div>
        </div>
      </div>

      <div class="step-card">
        <div class="step-header">
          <div class="step-number">2</div>
          <h3 class="step-title">
            <i class="fa-solid fa-desktop text-brand"></i>
            <span>Run the installer for your operating system</span>
          </h3>
        </div>
        <div class="step-body">
          <p class="step-desc">
            &bull; <strong>Windows:</strong> Double-click
            <code>stage0_setup.exe</code> and follow the setup wizard.<br />
            &bull; <strong>macOS:</strong> Open the downloaded <code>.dmg</code> file and drag
            Stage0 into your
            <code>Applications</code> folder.<br />
            &bull; <strong>Linux:</strong> Choose the package format matching your distribution:
          </p>

          <div class="distro-tabs-nav">
            <button
              class="distro-tab"
              data-distro-tab="appimage"
              data-umami-event="distro-tab-click"
              data-umami-event-distro="appimage"
              class:active={distro === 'appimage'}
              onclick={() => (distro = 'appimage')}
            >
              <i class="fa-brands fa-linux"></i> AppImage
            </button>
            <button
              class="distro-tab"
              data-distro-tab="deb"
              data-umami-event="distro-tab-click"
              data-umami-event-distro="deb"
              class:active={distro === 'deb'}
              onclick={() => (distro = 'deb')}
            >
              <i class="fa-brands fa-ubuntu"></i> Debian / Ubuntu (.deb)
            </button>
            <button
              class="distro-tab"
              data-distro-tab="rpm"
              data-umami-event="distro-tab-click"
              data-umami-event-distro="rpm"
              class:active={distro === 'rpm'}
              onclick={() => (distro = 'rpm')}
            >
              <i class="fa-brands fa-redhat"></i> Fedora / RHEL (.rpm)
            </button>
            <button
              class="distro-tab"
              data-distro-tab="tar"
              data-umami-event="distro-tab-click"
              data-umami-event-distro="tar"
              class:active={distro === 'tar'}
              onclick={() => (distro = 'tar')}
            >
              <i class="fa-solid fa-file-zipper"></i>
              Tarball (.tar.gz)
            </button>
          </div>

          <div
            class="code-box"
            data-distro-code="appimage"
            style:display={distro === 'appimage' ? 'flex' : 'none'}
          >
            <span id="code-linux-appimage"
              >chmod +x Stage0_*.AppImage &amp;&amp; ./Stage0_*.AppImage</span
            >
            <CopyButton target="code-linux-appimage" />
          </div>

          <div
            class="code-box"
            data-distro-code="deb"
            style:display={distro === 'deb' ? 'flex' : 'none'}
          >
            <span id="code-linux-deb"
              >sudo dpkg -i stage0_*_amd64.deb || sudo apt-get install -f</span
            >
            <CopyButton target="code-linux-deb" />
          </div>

          <div
            class="code-box"
            data-distro-code="rpm"
            style:display={distro === 'rpm' ? 'flex' : 'none'}
          >
            <span id="code-linux-rpm"
              >sudo rpm -i stage0-*.x86_64.rpm # or: sudo dnf install ./stage0-*.x86_64.rpm</span
            >
            <CopyButton target="code-linux-rpm" />
          </div>

          <div
            class="code-box"
            data-distro-code="tar"
            style:display={distro === 'tar' ? 'flex' : 'none'}
          >
            <span id="code-linux-tar">tar -xzf stage0-*.tar.gz &amp;&amp; ./stage0/stage0</span>
            <CopyButton target="code-linux-tar" />
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
