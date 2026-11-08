<script>
  import { onDestroy } from 'svelte';
  let { target = '', text = '', className = 'copy-btn', compact = false } = $props();
  let copied = $state(false);
  let failed = $state(false);
  let timer;
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        text || document.getElementById(target)?.textContent.trim() || '',
      );
      copied = true;
      failed = false;
      clearTimeout(timer);
      timer = setTimeout(() => (copied = false), 2000);
    } catch {
      failed = true;
    }
  }
  onDestroy(() => clearTimeout(timer));
</script>

<button
  type="button"
  class={className}
  class:copied
  onclick={copy}
  aria-label={failed ? 'Copy failed. Try again.' : copied ? 'Copied' : 'Copy'}
  title={failed ? 'Could not copy. Please try again.' : 'Copy to clipboard'}
>
  <i class={copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'} aria-hidden="true"></i>
  {#if !compact}{copied ? 'Copied!' : failed ? 'Try again' : 'Copy'}{/if}
</button>
