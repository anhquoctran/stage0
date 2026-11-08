<script>
  import { getContext } from 'svelte';
  const demo = getContext('demo');
</script>

<div class="mockup-sidebar">
  <div class="mockup-sidebar-header">
    <span class="mockup-section-title">Changed Files (3)</span>
    <div class="mockup-sidebar-stats">
      <span class="stat-add">+48</span>
      <span class="stat-del">-12</span>
    </div>
  </div>

  <div class="mockup-search-box">
    <i class="fa-solid fa-magnifying-glass"></i>
    <input type="text" placeholder="Filter changed files... (Ctrl+P)" readonly />
  </div>

  <div class="mockup-file-tree">
    <div
      class="mockup-file-item"
      data-file-key="auth"
      role="button"
      tabindex="0"
      class:active={demo.file === 'auth'}
      onclick={() => demo.selectFile('auth')}
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          demo.selectFile('auth');
        }
      }}
    >
      <div class="file-item-left">
        <i class="fa-brands fa-rust text-peach"></i>
        <div class="file-name-group">
          <span class="file-dir">src/auth/</span>
          <span class="file-name">auth_service.rs</span>
        </div>
      </div>
      <div class="file-item-right">
        <span class="file-diff-stat">+2 -1</span>
        <span class="file-status-badge m">M</span>
      </div>
    </div>

    <div
      class="mockup-file-item"
      data-file-key="vault"
      role="button"
      tabindex="0"
      class:active={demo.file === 'vault'}
      onclick={() => demo.selectFile('vault')}
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          demo.selectFile('vault');
        }
      }}
    >
      <div class="file-item-left">
        <i class="fa-brands fa-rust text-peach"></i>
        <div class="file-name-group">
          <span class="file-dir">src/security/</span>
          <span class="file-name">token_vault.rs</span>
        </div>
      </div>
      <div class="file-item-right">
        <span class="file-diff-stat">+36</span>
        <span class="file-status-badge a">A</span>
      </div>
    </div>

    <div
      class="mockup-file-item"
      data-file-key="db"
      role="button"
      tabindex="0"
      class:active={demo.file === 'db'}
      onclick={() => demo.selectFile('db')}
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          demo.selectFile('db');
        }
      }}
    >
      <div class="file-item-left">
        <i class="fa-brands fa-rust text-peach"></i>
        <div class="file-name-group">
          <span class="file-dir">src/db/</span>
          <span class="file-name">migration.rs</span>
        </div>
      </div>
      <div class="file-item-right">
        <span class="file-diff-stat">+10 -11</span>
        <span class="file-status-badge m">M</span>
      </div>
    </div>
  </div>
</div>
