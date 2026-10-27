// Stage0 Interactive Mockup Desktop Simulation
(function () {
  'use strict';

  function initMockupTabs() {
    const tabs = document.querySelectorAll('[data-mockup-tab]');
    const views = {
      diff: document.getElementById('mockup-view-diff'),
      ai: document.getElementById('mockup-view-ai'),
      conflict: document.getElementById('mockup-view-conflict'),
      commits: document.getElementById('mockup-view-commits')
    };

    // Switch subnav tabs
    function switchTab(target) {
      tabs.forEach(t => {
        if (t.getAttribute('data-mockup-tab') === target) {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });

      Object.keys(views).forEach(k => {
        if (views[k]) {
          views[k].style.display = (k === target) ? 'flex' : 'none';
        }
      });
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-mockup-tab');
        if (target) {
          switchTab(target);
          if (window.Stage0 && typeof window.Stage0.track === 'function') {
            window.Stage0.track('mockup-tab-click', { tab: target });
          } else if (window.umami && typeof window.umami.track === 'function') {
            window.umami.track('mockup-tab-click', { tab: target });
          }
        }
      });
    });

    // Sidebar File Item Click Switching
    const fileItems = document.querySelectorAll('.mockup-file-item');
    const fileNameDisplay = document.getElementById('mockup-file-name-display');

    const fileData = {
      auth: {
        name: 'auth_service.rs',
        crumb: 'auth',
        linesHtml: `
          <div class="diff-line diff-context">
            <span class="diff-num old">46</span><span class="diff-num new">46</span><span class="diff-sign">&nbsp;</span>
            <span class="diff-code"><span class="hl-cmt">/// Safely loads active token from persistent OS Keychain store</span></span>
          </div>
          <div class="diff-line diff-context">
            <span class="diff-num old">47</span><span class="diff-num new">47</span><span class="diff-sign">&nbsp;</span>
            <span class="diff-code"><span class="hl-cmt">/// Enforces zero-cost cryptographic zeroization upon Drop</span></span>
          </div>
          <div class="diff-line diff-context">
            <span class="diff-num old">48</span><span class="diff-num new">48</span><span class="diff-sign">&nbsp;</span>
            <span class="diff-code"><span class="hl-kw">pub fn</span> <span class="hl-fn">load_active_token</span>(vault: &amp;<span class="hl-type">TokenVault</span>) -&gt; <span class="hl-type">Result</span>&lt;<span class="hl-type">SecretToken</span>, <span class="hl-type">VaultError</span>&gt; {</span>
          </div>
          <div class="diff-line diff-del">
            <span class="diff-num old">49</span><span class="diff-num new">&nbsp;</span><span class="diff-sign">-</span>
            <span class="diff-code"><span class="hl-kw">let</span> raw_key = std::env::<span class="hl-fn">var</span>(<span class="hl-str">"APP_SECRET_TOKEN"</span>)?;</span>
          </div>
          <div class="diff-line diff-add">
            <span class="diff-num old">&nbsp;</span><span class="diff-num new">49</span><span class="diff-sign">+</span>
            <span class="diff-code"><span class="hl-kw">let</span> raw_key = vault.<span class="hl-fn">read_keychain_secret</span>(<span class="hl-str">"stage0_auth_token"</span>)?;</span>
          </div>
          <div class="diff-line diff-add">
            <span class="diff-num old">&nbsp;</span><span class="diff-num new">50</span><span class="diff-sign">+</span>
            <span class="diff-code"><span class="hl-kw">let</span> token = <span class="hl-type">SecretToken</span>::<span class="hl-fn">from_secure_bytes</span>(raw_key)?;</span>
          </div>
          <div class="diff-line diff-context">
            <span class="diff-num old">50</span><span class="diff-num new">51</span><span class="diff-sign">&nbsp;</span>
            <span class="diff-code"><span class="hl-type">Ok</span>(token)</span>
          </div>
          <div class="diff-line diff-context">
            <span class="diff-num old">51</span><span class="diff-num new">52</span><span class="diff-sign">&nbsp;</span>
            <span class="diff-code">}</span>
          </div>
        `,
        showAiCard: true
      },
      vault: {
        name: 'token_vault.rs',
        crumb: 'security',
        linesHtml: `
          <div class="diff-line diff-add">
            <span class="diff-num old">&nbsp;</span><span class="diff-num new">1</span><span class="diff-sign">+</span>
            <span class="diff-code"><span class="hl-cmt">//! Secure OS Native Keychain Store implementation for Stage0</span></span>
          </div>
          <div class="diff-line diff-add">
            <span class="diff-num old">&nbsp;</span><span class="diff-num new">2</span><span class="diff-sign">+</span>
            <span class="diff-code"><span class="hl-kw">pub struct</span> <span class="hl-type">TokenVault</span> { service_name: <span class="hl-type">String</span> }</span>
          </div>
          <div class="diff-line diff-add">
            <span class="diff-num old">&nbsp;</span><span class="diff-num new">3</span><span class="diff-sign">+</span>
            <span class="diff-code"><span class="hl-kw">impl</span> <span class="hl-type">TokenVault</span> {</span>
          </div>
          <div class="diff-line diff-add">
            <span class="diff-num old">&nbsp;</span><span class="diff-num new">4</span><span class="diff-sign">+</span>
            <span class="diff-code">    <span class="hl-kw">pub fn</span> <span class="hl-fn">read_keychain_secret</span>(&amp;self, key: &amp;<span class="hl-type">str</span>) -&gt; <span class="hl-type">Result</span>&lt;<span class="hl-type">Vec</span>&lt;<span class="hl-type">u8</span>&gt;, <span class="hl-type">VaultError</span>&gt; {</span>
          </div>
          <div class="diff-line diff-add">
            <span class="diff-num old">&nbsp;</span><span class="diff-num new">5</span><span class="diff-sign">+</span>
            <span class="diff-code">        <span class="hl-cmt">// Native Keychain retrieval with zero plaintext disk caching</span></span>
          </div>
          <div class="diff-line diff-add">
            <span class="diff-num old">&nbsp;</span><span class="diff-num new">6</span><span class="diff-sign">+</span>
            <span class="diff-code">        keyring::<span class="hl-type">Entry</span>::<span class="hl-fn">new</span>(&amp;self.service_name, key)?.<span class="hl-fn">get_secret</span>()</span>
          </div>
          <div class="diff-line diff-add">
            <span class="diff-num old">&nbsp;</span><span class="diff-num new">7</span><span class="diff-sign">+</span>
            <span class="diff-code">    }</span>
          </div>
          <div class="diff-line diff-add">
            <span class="diff-num old">&nbsp;</span><span class="diff-num new">8</span><span class="diff-sign">+</span>
            <span class="diff-code">}</span>
          </div>
        `,
        showAiCard: false
      },
      db: {
        name: 'migration.rs',
        crumb: 'db',
        linesHtml: `
          <div class="diff-line diff-context">
            <span class="diff-num old">14</span><span class="diff-num new">14</span><span class="diff-sign">&nbsp;</span>
            <span class="diff-code"><span class="hl-kw">pub fn</span> <span class="hl-fn">migrate_legacy_plaintext_tokens</span>(db: &amp;<span class="hl-type">Database</span>) -&gt; <span class="hl-type">Result</span>&lt;(), <span class="hl-type">DbError</span>&gt; {</span>
          </div>
          <div class="diff-line diff-del">
            <span class="diff-num old">15</span><span class="diff-num new">&nbsp;</span><span class="diff-sign">-</span>
            <span class="diff-code">    <span class="hl-cmt">// Remove unencrypted fallback column from SQLite cache</span></span>
          </div>
          <div class="diff-line diff-del">
            <span class="diff-num old">16</span><span class="diff-num new">&nbsp;</span><span class="diff-sign">-</span>
            <span class="diff-code">    db.<span class="hl-fn">execute</span>(<span class="hl-str">"ALTER TABLE auth_tokens DROP COLUMN plaintext_key;"</span>)?;</span>
          </div>
          <div class="diff-line diff-add">
            <span class="diff-num old">&nbsp;</span><span class="diff-num new">15</span><span class="diff-sign">+</span>
            <span class="diff-code">    <span class="hl-cmt">// Purge plaintext token column and verify OS vault pointer</span></span>
          </div>
          <div class="diff-line diff-add">
            <span class="diff-num old">&nbsp;</span><span class="diff-num new">16</span><span class="diff-sign">+</span>
            <span class="diff-code">    db.<span class="hl-fn">execute</span>(<span class="hl-str">"DROP TABLE IF EXISTS legacy_plaintext_tokens;"</span>)?;</span>
          </div>
          <div class="diff-line diff-context">
            <span class="diff-num old">17</span><span class="diff-num new">17</span><span class="diff-sign">&nbsp;</span>
            <span class="diff-code">    <span class="hl-type">Ok</span>(())</span>
          </div>
          <div class="diff-line diff-context">
            <span class="diff-num old">18</span><span class="diff-num new">18</span><span class="diff-sign">&nbsp;</span>
            <span class="diff-code">}</span>
          </div>
        `,
        showAiCard: false
      }
    };

    const diffLinesContainer = document.querySelector('.diff-lines-container');
    const aiReviewCard = document.querySelector('.ai-review-card');

    fileItems.forEach(item => {
      item.addEventListener('click', () => {
        fileItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const fileKey = item.getAttribute('data-file-key');
        const data = fileData[fileKey];

        if (window.Stage0 && typeof window.Stage0.track === 'function') {
          window.Stage0.track('mockup-file-select', { file: fileKey });
        } else if (window.umami && typeof window.umami.track === 'function') {
          window.umami.track('mockup-file-select', { file: fileKey });
        }

        if (data) {
          if (fileNameDisplay) fileNameDisplay.textContent = data.name;
          if (diffLinesContainer) diffLinesContainer.innerHTML = data.linesHtml.trim();
          if (aiReviewCard) {
            aiReviewCard.style.display = data.showAiCard ? 'block' : 'none';
          }
          // Switch to diff view if user clicked a file
          switchTab('diff');
        }
      });
    });

    // Action: Apply Suggested Patch
    const btnApply = document.getElementById('mockup-btn-apply');
    if (btnApply) {
      btnApply.addEventListener('click', () => {
        if (window.Stage0 && typeof window.Stage0.track === 'function') {
          window.Stage0.track('mockup-apply-patch');
        } else if (window.umami && typeof window.umami.track === 'function') {
          window.umami.track('mockup-apply-patch');
        }

        btnApply.innerHTML = '<i class="fa-solid fa-check"></i> Patch Applied in Sandbox!';
        btnApply.style.backgroundColor = '#059669';
        btnApply.style.color = '#ffffff';

        const resolvedBadge = document.querySelector('.badge-resolved');
        if (resolvedBadge) {
          resolvedBadge.innerHTML = '<i class="fa-solid fa-check-double"></i> Patch Applied to Working Tree';
        }

        setTimeout(() => {
          btnApply.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Apply Suggested Patch';
          btnApply.style.backgroundColor = '';
          btnApply.style.color = '';
        }, 4000);
      });
    }

    // Action: Discuss with Sentinel -> Switch to AI Fleet Tab
    const btnDiscuss = document.getElementById('mockup-btn-discuss');
    if (btnDiscuss) {
      btnDiscuss.addEventListener('click', () => {
        if (window.Stage0 && typeof window.Stage0.track === 'function') {
          window.Stage0.track('mockup-discuss-sentinel');
        } else if (window.umami && typeof window.umami.track === 'function') {
          window.umami.track('mockup-discuss-sentinel');
        }
        switchTab('ai');
      });
    }

    // Action: Refresh Diff (Spin animation & instant feedback)
    const btnRefresh = document.getElementById('mockup-btn-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        const icon = btnRefresh.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
        btnRefresh.disabled = true;

        setTimeout(() => {
          if (icon) icon.classList.remove('fa-spin');
          btnRefresh.disabled = false;
          btnRefresh.innerHTML = '<i class="fa-solid fa-check text-green"></i> Up to date (4.2ms)';
          setTimeout(() => {
            btnRefresh.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh';
          }, 2500);
        }, 600);
      });
    }

    // Copy Relative Path
    const btnCopyCrumb = document.querySelector('.btn-crumb-copy');
    if (btnCopyCrumb) {
      btnCopyCrumb.addEventListener('click', () => {
        const activeFile = fileNameDisplay ? fileNameDisplay.textContent : 'auth_service.rs';
        const fullRelPath = 'src/auth/' + activeFile;
        navigator.clipboard?.writeText(fullRelPath).then(() => {
          btnCopyCrumb.innerHTML = '<i class="fa-solid fa-check text-green"></i>';
          setTimeout(() => {
            btnCopyCrumb.innerHTML = '<i class="fa-regular fa-copy"></i>';
          }, 2000);
        });
      });
    }
  }

  // Register with Stage0 global registry
  const s0 = window.stage0 || window.Stage0;
  if (s0 && typeof s0.__defineModule === 'function') {
    s0.__defineModule('mockup', { initMockupTabs });
    s0.__defineFunction('initMockupTabs', initMockupTabs);
  } else {
    window.Stage0 = window.Stage0 || {};
    window.Stage0.mockup = { initMockupTabs };
    window.initMockupTabs = initMockupTabs;
  }
})();

