<script>
  import AuthDiff from '#lib/mockup/AuthDiff.svelte';
  import ReviewCard from '#lib/mockup/ReviewCard.svelte';
  import CopyButton from '#lib/components/CopyButton.svelte';
  import { getContext } from 'svelte';
  const demo = getContext('demo');
</script>

<div
  class="mockup-editor"
  id="mockup-view-diff"
  style:display={demo.view === 'diff' ? 'flex' : 'none'}
>
  <div class="diff-file-toolbar">
    <div class="diff-breadcrumb">
      <i class="fa-brands fa-rust text-peach"></i>
      <span class="diff-crumb-prefix-desktop">
        <span class="diff-crumb-segment">stage0-core</span>
        <span class="diff-crumb-sep">/</span>
        <span class="diff-crumb-segment">src</span>
        <span class="diff-crumb-sep">/</span>
      </span>
      <span class="diff-crumb-prefix-mobile">... / </span>
      <span class="diff-crumb-segment">auth</span>
      <span class="diff-crumb-sep">/</span>
      <span class="diff-crumb-active" id="mockup-file-name-display">{demo.fileName}</span>
      <CopyButton
        className="btn-crumb-copy"
        text={'src/' + demo.directory + '/' + demo.fileName}
        compact
      />
    </div>

    <div class="diff-toolbar-actions">
      <span class="diff-hunk-summary">2 hunks &bull; 3 modified lines</span>
      <div class="diff-mode-toggle">
        <span class="toggle-option active">Unified</span>
        <span class="toggle-option">Split</span>
      </div>
    </div>
  </div>

  <AuthDiff />

  <ReviewCard />
</div>
