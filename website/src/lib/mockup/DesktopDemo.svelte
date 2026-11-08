<script>
  import DemoTitlebar from '#lib/mockup/DemoTitlebar.svelte';
  import DemoRibbon from '#lib/mockup/DemoRibbon.svelte';
  import DemoTabs from '#lib/mockup/DemoTabs.svelte';
  import DemoFiles from '#lib/mockup/DemoFiles.svelte';
  import DemoStatus from '#lib/mockup/DemoStatus.svelte';
  import DiffView from '#lib/mockup/DiffView.svelte';
  import AgentsView from '#lib/mockup/AgentsView.svelte';
  import ConflictView from '#lib/mockup/ConflictView.svelte';
  import CommitsView from '#lib/mockup/CommitsView.svelte';
  import { setContext, onDestroy } from 'svelte';
  import { createDemo } from '#lib/mockup/demo.svelte.js';
  const demo = createDemo();
  setContext('demo', demo);
  onDestroy(demo.destroy);
</script>

<div class="mockup-wrapper">
  <DemoTitlebar />

  <DemoRibbon />

  <DemoTabs />

  <div class="mockup-body">
    <DemoFiles />

    <DiffView />

    <AgentsView />

    <ConflictView />

    <CommitsView />
  </div>

  <DemoStatus />
</div>
