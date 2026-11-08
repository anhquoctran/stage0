<script>
  import { setContext, onMount } from 'svelte';
  import { createReleases } from '#lib/releases/releases.svelte.js';
  import Header from '#lib/sections/Header.svelte';
  import Hero from '#lib/sections/Hero.svelte';
  import AiReviewers from '#lib/sections/AiReviewers.svelte';
  import Features from '#lib/sections/Features.svelte';
  import Comparison from '#lib/sections/Comparison.svelte';
  import Download from '#lib/sections/Download.svelte';
  import ReleaseSchedule from '#lib/sections/ReleaseSchedule.svelte';
  import ReleaseHistory from '#lib/releases/ReleaseHistory.svelte';
  import Install from '#lib/sections/Install.svelte';
  import QuickStart from '#lib/sections/QuickStart.svelte';
  import Faq from '#lib/sections/Faq.svelte';
  import Footer from '#lib/sections/Footer.svelte';
  const releases = createReleases();
  setContext('releases', releases);
  onMount(() => {
    void releases.load();
    return releases.destroy;
  });
</script>

<Header />
<main>
  <Hero />
  <AiReviewers />
  <Features />
  <Comparison />
  <Download />
  <ReleaseSchedule />
  <ReleaseHistory />
  <Install />
  <QuickStart />
  <Faq />
</main>
<Footer />
