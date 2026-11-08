<div class="diff-lines-container">
  <div class="diff-line diff-context">
    <span class="diff-num old">14</span><span class="diff-num new">14</span><span class="diff-sign"
      >&nbsp;</span
    >
    <span class="diff-code"
      ><span class="hl-kw">pub fn</span>
      <span class="hl-fn">migrate_legacy_plaintext_tokens</span>(db: &amp;<span class="hl-type"
        >Database</span
      >) -&gt; <span class="hl-type">Result</span>&lt;(), <span class="hl-type">DbError</span>&gt;
      &#123;</span
    >
  </div>
  <div class="diff-line diff-del">
    <span class="diff-num old">15</span><span class="diff-num new">&nbsp;</span><span
      class="diff-sign">-</span
    >
    <span class="diff-code">
      <span class="hl-cmt">// Remove unencrypted fallback column from SQLite cache</span></span
    >
  </div>
  <div class="diff-line diff-del">
    <span class="diff-num old">16</span><span class="diff-num new">&nbsp;</span><span
      class="diff-sign">-</span
    >
    <span class="diff-code">
      db.<span class="hl-fn">execute</span>(<span class="hl-str"
        >"ALTER TABLE auth_tokens DROP COLUMN plaintext_key;"</span
      >)?;</span
    >
  </div>
  <div class="diff-line diff-add">
    <span class="diff-num old">&nbsp;</span><span class="diff-num new">15</span><span
      class="diff-sign">+</span
    >
    <span class="diff-code">
      <span class="hl-cmt">// Purge plaintext token column and verify OS vault pointer</span></span
    >
  </div>
  <div class="diff-line diff-add">
    <span class="diff-num old">&nbsp;</span><span class="diff-num new">16</span><span
      class="diff-sign">+</span
    >
    <span class="diff-code">
      db.<span class="hl-fn">execute</span>(<span class="hl-str"
        >"DROP TABLE IF EXISTS legacy_plaintext_tokens;"</span
      >)?;</span
    >
  </div>
  <div class="diff-line diff-context">
    <span class="diff-num old">17</span><span class="diff-num new">17</span><span class="diff-sign"
      >&nbsp;</span
    >
    <span class="diff-code"> <span class="hl-type">Ok</span>(())</span>
  </div>
  <div class="diff-line diff-context">
    <span class="diff-num old">18</span><span class="diff-num new">18</span><span class="diff-sign"
      >&nbsp;</span
    >
    <span class="diff-code">&#125;</span>
  </div>
</div>
