<script>
  import { getContext } from 'svelte';
  const demo = getContext('demo');
</script>

<div class="mockup-ribbon">
  <div class="mockup-repo-badge" title="d:/stage0/services/auth">
    <div class="mockup-repo-icon">
      <i class="fa-solid fa-folder-tree"></i>
    </div>
    <div class="mockup-repo-info">
      <div class="mockup-repo-title">
        <span>stage0-core</span>
        <span class="mockup-repo-git-tag">git</span>
      </div>
      <span class="mockup-repo-path">~/workspace/stage0-core</span>
    </div>
  </div>

  <div class="mockup-ribbon-center">
    <div class="branch-compare-pill">
      <span class="branch-pill-base"
        ><i class="fa-solid fa-code-branch"></i>
        main</span
      >
      <span class="branch-pill-arrow">&harr;</span>
      <span class="branch-pill-target"
        ><i class="fa-solid fa-code-fork"></i>
        feat/token-vault-migration</span
      >
    </div>

    <div class="mockup-ribbon-badges">
      <span class="status-badge-clean" title="Predicted using 3-way in-memory AST evaluation">
        <i class="fa-solid fa-circle-check"></i>
        <span class="badge-text-full">0 Conflicts Predicted</span>
        <span class="badge-text-short">0 Conflicts</span>
      </span>
      <span class="status-badge-ai" title="Security, Architecture & Performance reviewers active">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        <span class="badge-text-full">3 Bots Active &bull; 1 Resolved Finding</span>
        <span class="badge-text-short">3 Bots Active</span>
      </span>
    </div>
  </div>

  <div class="mockup-ribbon-actions">
    <button class="mockup-action-btn" title="Fast pull remote updates">
      <i class="fa-solid fa-arrow-down"></i>
      Pull
    </button>
    <button class="mockup-action-btn" title="Simulate 3-way merge in memory">
      <i class="fa-solid fa-code-merge"></i>
      Merge MR
    </button>
    <button
      class="mockup-action-btn primary"
      id="mockup-btn-refresh"
      title="Re-evaluate working tree and run review bots"
      disabled={demo.refreshing}
      onclick={() => demo.refresh()}
      >{#if demo.refreshed}<i class="fa-solid fa-check text-green"></i> Up to date (4.2ms){:else}<i
          class="fa-solid fa-rotate"
          class:fa-spin={demo.refreshing}
        ></i> Refresh{/if}</button
    >
  </div>
</div>
