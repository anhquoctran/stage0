<script>
  import { getContext } from 'svelte';
  const demo = getContext('demo');
</script>

<div class="ai-review-card" style:display={demo.file === 'auth' ? 'block' : 'none'}>
  <div class="ai-card-glow-bar"></div>
  <div class="ai-card-header">
    <div class="ai-card-author">
      <div class="ai-bot-avatar">
        <i class="fa-solid fa-shield-halved"></i>
      </div>
      <div class="ai-bot-meta">
        <div class="ai-bot-name-row">
          <span class="ai-bot-name">Security Sentinel</span>
          <span class="ai-bot-tag">AI BOT REVIEWER</span>
        </div>
        <span class="ai-bot-model"
          >Anthropic Claude 3.7 Sonnet &bull; 2 min ago &bull; Lines 49-50</span
        >
      </div>
    </div>

    <div class="ai-card-status-badges">
      <span class="badge-resolved"
        >{#if demo.patched}<i class="fa-solid fa-check-double"></i> Patch Applied to Working Tree{:else}
          <i class="fa-solid fa-circle-check"></i>
          <span>Vulnerability Mitigated</span>
        {/if}</span
      >
      <span class="badge-zeroize">
        <i class="fa-solid fa-lock"></i>
        <span>Zeroization Verified</span>
      </span>
    </div>
  </div>

  <div class="ai-card-body">
    <p>
      <strong>Security Audit Passed:</strong>
      Plaintext environment variable
      <code>APP_SECRET_TOKEN</code>
      (susceptible to
      <code>/proc/environ</code> dumps and crash logs) was successfully replaced with OS native
      Credential Store (Apple Keychain / Windows DPAPI / Secret Service). Memory zeroization on
      <code>Drop</code> confirmed.
    </p>
    <div class="ai-suggested-patch">
      <div class="suggested-patch-header">
        <i class="fa-solid fa-lightbulb text-yellow"></i>
        <span>Actionable Hardening Suggestion: Add bounded retry on Keychain unlock timeout</span>
      </div>
      <pre class="suggested-patch-code"><code
          ><span class="hl-cmt">// Hardened OS Keychain timeout retry</span>
+ vault.with_keychain_retry(Duration::from_millis(500), 2)?;</code
        ></pre>
    </div>
  </div>

  <div class="ai-card-footer">
    <div class="ai-footer-info">
      <i class="fa-solid fa-shield-check text-brand"></i>
      <span>100% In-Memory Review &bull; Zero checkout overhead &bull; Zero code leaked</span>
    </div>
    <div class="ai-footer-actions">
      <button
        class="btn-card-action outline"
        id="mockup-btn-discuss"
        data-umami-event="mockup-btn-discuss"
        onclick={() => (demo.view = 'ai')}
      >
        <i class="fa-regular fa-comment-dots"></i>
        Discuss with Sentinel
      </button>
      <button
        class="btn-card-action primary btn-solid"
        id="mockup-btn-apply"
        data-umami-event="mockup-btn-apply"
        onclick={() => demo.applyPatch()}
        >{#if demo.patched}<i class="fa-solid fa-check"></i> Patch Applied in Sandbox!{:else}
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          Apply Suggested Patch
        {/if}</button
      >
    </div>
  </div>
</div>
