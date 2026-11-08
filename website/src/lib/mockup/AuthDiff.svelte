<script>
  import { getContext } from 'svelte';
  const demo = getContext('demo');
  import VaultDiff from './VaultDiff.svelte';
  import DatabaseDiff from './DatabaseDiff.svelte';
</script>

{#if demo.file === 'auth'}
  <div class="diff-lines-container">
    <div class="diff-line diff-context">
      <span class="diff-num old">46</span>
      <span class="diff-num new">46</span>
      <span class="diff-sign">&nbsp;</span>
      <span class="diff-code"
        ><span class="hl-cmt">/// Safely loads active token from persistent OS Keychain store</span
        ></span
      >
    </div>
    <div class="diff-line diff-context">
      <span class="diff-num old">47</span>
      <span class="diff-num new">47</span>
      <span class="diff-sign">&nbsp;</span>
      <span class="diff-code"
        ><span class="hl-cmt">/// Enforces zero-cost cryptographic zeroization upon Drop</span
        ></span
      >
    </div>
    <div class="diff-line diff-context">
      <span class="diff-num old">48</span>
      <span class="diff-num new">48</span>
      <span class="diff-sign">&nbsp;</span>
      <span class="diff-code"
        ><span class="hl-kw">pub fn</span>
        <span class="hl-fn">load_active_token</span>(vault: &amp;<span class="hl-type"
          >TokenVault</span
        >) -&gt;
        <span class="hl-type">Result</span>&lt;<span class="hl-type">SecretToken</span>,
        <span class="hl-type">VaultError</span>&gt; &#123;</span
      >
    </div>
    <div class="diff-line diff-del">
      <span class="diff-num old">49</span>
      <span class="diff-num new">&nbsp;</span>
      <span class="diff-sign">-</span>
      <span class="diff-code"
        ><span class="hl-kw">let</span>
        raw_key = std::env::<span class="hl-fn">var</span>(<span class="hl-str"
          >"APP_SECRET_TOKEN"</span
        >)?;</span
      >
    </div>
    <div class="diff-line diff-add">
      <span class="diff-num old">&nbsp;</span>
      <span class="diff-num new">49</span>
      <span class="diff-sign">+</span>
      <span class="diff-code"
        ><span class="hl-kw">let</span>
        raw_key = vault.<span class="hl-fn">read_keychain_secret</span>(<span class="hl-str"
          >"stage0_auth_token"</span
        >)?;</span
      >
    </div>
    <div class="diff-line diff-add">
      <span class="diff-num old">&nbsp;</span>
      <span class="diff-num new">50</span>
      <span class="diff-sign">+</span>
      <span class="diff-code"
        ><span class="hl-kw">let</span>
        token =
        <span class="hl-type">SecretToken</span>::<span class="hl-fn">from_secure_bytes</span
        >(raw_key)?;</span
      >
    </div>
    <div class="diff-line diff-context">
      <span class="diff-num old">50</span>
      <span class="diff-num new">51</span>
      <span class="diff-sign">&nbsp;</span>
      <span class="diff-code"><span class="hl-type">Ok</span>(token)</span>
    </div>
    <div class="diff-line diff-context">
      <span class="diff-num old">51</span>
      <span class="diff-num new">52</span>
      <span class="diff-sign">&nbsp;</span>
      <span class="diff-code">&#125;</span>
    </div>
  </div>
{:else if demo.file === 'vault'}<VaultDiff />{:else}<DatabaseDiff />{/if}
