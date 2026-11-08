<script>
  import { getContext } from 'svelte';
  const demo = getContext('demo');
</script>

<div class="mockup-editor" id="mockup-view-ai" style:display={demo.view === 'ai' ? 'flex' : 'none'}>
  <div class="ai-fleet-header">
    <div class="fleet-title-row">
      <div class="fleet-title">
        <i class="fa-solid fa-robot text-brand"></i>
        <span>Autonomous Multi-Agent Review Fleet</span>
      </div>
      <span class="status-badge-clean">
        <i class="fa-solid fa-circle-check"></i>
        3 of 3 Reviews Approved &bull; Ready to Merge
      </span>
    </div>
    <p class="fleet-desc">
      Stage0 dispatches parallel autonomous reviewer agents directly to your in-memory Git tree.
    </p>
  </div>

  <div class="ai-agent-grid">
    <div class="agent-card">
      <div class="agent-card-top">
        <div class="agent-icon-wrap security">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <div class="agent-info">
          <h4>Security Sentinel</h4>
          <span class="agent-role">Secrets, OWASP &amp; Vaults</span>
        </div>
        <span class="agent-badge pass">Passed</span>
      </div>
      <p class="agent-finding">
        Migrated plaintext token to OS Keychain. Zeroization confirmed on <code>Drop</code>. Zero
        plaintext leakage in diff.
      </p>
      <div class="agent-metrics">
        <span
          ><i class="fa-solid fa-lock"></i>
          0 Leaked Secrets</span
        >
        <span
          ><i class="fa-solid fa-stopwatch"></i>
          1.8s</span
        >
      </div>
    </div>

    <div class="agent-card">
      <div class="agent-card-top">
        <div class="agent-icon-wrap arch">
          <i class="fa-solid fa-cubes-stacked"></i>
        </div>
        <div class="agent-info">
          <h4>Architecture Guardian</h4>
          <span class="agent-role">Coupling &amp; Boundaries</span>
        </div>
        <span class="agent-badge pass">Passed</span>
      </div>
      <p class="agent-finding">
        Single cohesive responsibility preserved. File size is 285 physical lines (under the
        400-line boundary).
      </p>
      <div class="agent-metrics">
        <span
          ><i class="fa-solid fa-diagram-precedence"></i>
          0 Circular Deps</span
        >
        <span
          ><i class="fa-solid fa-stopwatch"></i>
          2.1s</span
        >
      </div>
    </div>

    <div class="agent-card">
      <div class="agent-card-top">
        <div class="agent-icon-wrap perf">
          <i class="fa-solid fa-gauge-high"></i>
        </div>
        <div class="agent-info">
          <h4>Performance Auditor</h4>
          <span class="agent-role">Allocations &amp; Memory</span>
        </div>
        <span class="agent-badge pass">Passed</span>
      </div>
      <p class="agent-finding">
        In-memory 3-way AST simulation completed in 4.2ms. Zero unnecessary memory allocations in
        hot crypto path.
      </p>
      <div class="agent-metrics">
        <span
          ><i class="fa-solid fa-bolt"></i>
          4.2ms Tree Diff</span
        >
        <span
          ><i class="fa-solid fa-stopwatch"></i>
          1.4s</span
        >
      </div>
    </div>
  </div>

  <div class="thread-preview-card">
    <div class="thread-header">
      <i class="fa-solid fa-comments text-brand"></i>
      <span>Interactive Diff Conversation Thread</span>
    </div>
    <div class="thread-bubble user">
      <div class="bubble-avatar">
        <i class="fa-solid fa-user"></i>
      </div>
      <div class="bubble-body">
        <strong>You:</strong> "Can we handle the case where the keychain item is locked by OS?"
      </div>
    </div>
    <div class="thread-bubble bot">
      <div class="bubble-avatar bot">
        <i class="fa-solid fa-robot"></i>
      </div>
      <div class="bubble-body">
        <strong>Security Sentinel:</strong>
        "Applied in patch proposal #2: Added
        <code>with_keychain_retry()</code>
        with exponential backoff up to 500ms before requesting user PIN unlock."
      </div>
    </div>
  </div>
</div>
