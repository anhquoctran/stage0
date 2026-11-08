<script>
  import { getContext } from 'svelte';
  const demo = getContext('demo');
</script>

<div
  class="mockup-editor"
  id="mockup-view-conflict"
  style:display={demo.view === 'conflict' ? 'flex' : 'none'}
>
  <div class="conflict-map-wrapper">
    <div class="conflict-header-row">
      <div class="conflict-header-title">
        <i class="fa-solid fa-diagram-project text-green"></i>
        <span>In-Memory 3-Way Conflict Prediction Graph</span>
      </div>
      <span class="status-badge-clean">
        <i class="fa-solid fa-circle-check"></i>
        0 Conflicts &bull; 100% Mergeable
      </span>
    </div>

    <div class="conflict-diagram">
      <div class="branch-node base">
        <div class="node-badge">MERGE BASE</div>
        <div class="node-commit">commit 91e402</div>
        <div class="node-title">main~3 (common ancestor)</div>
      </div>
      <div class="branch-arrow-down">
        <i class="fa-solid fa-arrow-down"></i>
      </div>
      <div class="branch-fork-grid">
        <div class="branch-col">
          <div class="branch-node branch-left">
            <div class="node-badge blue">TARGET</div>
            <div class="node-commit">commit a8f12c</div>
            <div class="node-title">origin/main</div>
          </div>
        </div>
        <div class="branch-col">
          <div class="branch-node branch-right">
            <div class="node-badge brand">FEATURE</div>
            <div class="node-commit">commit 4e99b0</div>
            <div class="node-title">feat/token-vault-migration</div>
          </div>
        </div>
      </div>
      <div class="branch-arrow-merge">
        <i class="fa-solid fa-arrow-down"></i>
      </div>
      <div class="branch-merge-result">
        <div class="merge-result-icon">
          <i class="fa-solid fa-circle-check text-green"></i>
        </div>
        <div class="merge-result-info">
          <strong>Predicted Result: Fast-Forward / Clean 3-Way Auto-Merge</strong>
          <span
            >All 3 inspected files contain non-overlapping AST changes. Safe to merge or rebase
            immediately.</span
          >
        </div>
      </div>
    </div>
  </div>
</div>
