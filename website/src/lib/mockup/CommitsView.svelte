<script>
  import { getContext } from 'svelte';
  const demo = getContext('demo');
</script>

<div
  class="mockup-editor"
  id="mockup-view-commits"
  style:display={demo.view === 'commits' ? 'flex' : 'none'}
>
  <div class="commits-list-wrapper">
    <div class="commits-header-row">
      <span class="font-bold text-xs text-text"
        ><i class="fa-solid fa-clock-rotate-left text-brand"></i>
        Commits in Branch (2)</span
      >
      <span class="text-subtext0 text-xs font-mono">Ahead 2 &bull; Behind 0</span>
    </div>
    <div class="commits-list">
      <div class="commit-row">
        <span class="commit-hash">4e99b0d</span>
        <div class="commit-details">
          <span class="commit-msg"
            >refactor(auth): migrate token storage to native OS keychain vault</span
          >
          <span class="commit-meta"
            >Anh Quoc Tran &bull; 14 minutes ago &bull; 3 files changed (+48, -12)</span
          >
        </div>
        <span class="commit-status-clean"
          ><i class="fa-solid fa-check"></i>
          Verified</span
        >
      </div>
      <div class="commit-row">
        <span class="commit-hash">1a88c3f</span>
        <div class="commit-details">
          <span class="commit-msg">feat(vault): add memory zeroization on Drop for SecretToken</span
          >
          <span class="commit-meta"
            >Anh Quoc Tran &bull; 32 minutes ago &bull; 1 file changed (+36, -0)</span
          >
        </div>
        <span class="commit-status-clean"
          ><i class="fa-solid fa-check"></i>
          Verified</span
        >
      </div>
    </div>
  </div>
</div>
