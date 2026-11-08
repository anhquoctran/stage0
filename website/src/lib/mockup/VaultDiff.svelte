<div class="diff-lines-container">
  <div class="diff-line diff-add">
    <span class="diff-num old">&nbsp;</span><span class="diff-num new">1</span><span
      class="diff-sign">+</span
    >
    <span class="diff-code"
      ><span class="hl-cmt">//! Secure OS Native Keychain Store implementation for Stage0</span
      ></span
    >
  </div>
  <div class="diff-line diff-add">
    <span class="diff-num old">&nbsp;</span><span class="diff-num new">2</span><span
      class="diff-sign">+</span
    >
    <span class="diff-code"
      ><span class="hl-kw">pub struct</span> <span class="hl-type">TokenVault</span> &#123;
      service_name: <span class="hl-type">String</span> &#125;</span
    >
  </div>
  <div class="diff-line diff-add">
    <span class="diff-num old">&nbsp;</span><span class="diff-num new">3</span><span
      class="diff-sign">+</span
    >
    <span class="diff-code"
      ><span class="hl-kw">impl</span> <span class="hl-type">TokenVault</span> &#123;</span
    >
  </div>
  <div class="diff-line diff-add">
    <span class="diff-num old">&nbsp;</span><span class="diff-num new">4</span><span
      class="diff-sign">+</span
    >
    <span class="diff-code">
      <span class="hl-kw">pub fn</span> <span class="hl-fn">read_keychain_secret</span>(&amp;self,
      key: &amp;<span class="hl-type">str</span>) -&gt; <span class="hl-type">Result</span>&lt;<span
        class="hl-type">Vec</span
      >&lt;<span class="hl-type">u8</span>&gt;, <span class="hl-type">VaultError</span>&gt; &#123;</span
    >
  </div>
  <div class="diff-line diff-add">
    <span class="diff-num old">&nbsp;</span><span class="diff-num new">5</span><span
      class="diff-sign">+</span
    >
    <span class="diff-code">
      <span class="hl-cmt">// Native Keychain retrieval with zero plaintext disk caching</span
      ></span
    >
  </div>
  <div class="diff-line diff-add">
    <span class="diff-num old">&nbsp;</span><span class="diff-num new">6</span><span
      class="diff-sign">+</span
    >
    <span class="diff-code">
      keyring::<span class="hl-type">Entry</span>::<span class="hl-fn">new</span
      >(&amp;self.service_name, key)?.<span class="hl-fn">get_secret</span>()</span
    >
  </div>
  <div class="diff-line diff-add">
    <span class="diff-num old">&nbsp;</span><span class="diff-num new">7</span><span
      class="diff-sign">+</span
    >
    <span class="diff-code"> &#125;</span>
  </div>
  <div class="diff-line diff-add">
    <span class="diff-num old">&nbsp;</span><span class="diff-num new">8</span><span
      class="diff-sign">+</span
    >
    <span class="diff-code">&#125;</span>
  </div>
</div>
