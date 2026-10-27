// Stage0 Landing Page - Main Application Orchestrator
(function () {
  'use strict';

  function bootstrap() {
    const s0 = window.stage0 || window.Stage0;
    if (!s0) return;

    // 1. Theme initialization (immediate to avoid flash of incorrect theme)
    if (s0.modules?.theme?.initTheme) {
      s0.modules.theme.initTheme();
    } else if (s0.theme?.initTheme) {
      s0.theme.initTheme();
    } else if (typeof s0.fns?.initTheme === 'function') {
      s0.fns.initTheme();
    } else if (typeof window.initTheme === 'function') {
      window.initTheme();
    }

    // 2. Release & OS Detection
    const rel = s0.modules?.releases || s0.releases;
    if (rel) {
      if (typeof rel.initCachedRelease === 'function') rel.initCachedRelease();
      if (typeof rel.initDynamicCreditYear === 'function') rel.initDynamicCreditYear();
      if (typeof rel.initOsDetection === 'function') rel.initOsDetection();
      if (typeof rel.fetchLatestReleaseAssets === 'function') rel.fetchLatestReleaseAssets();
    } else {
      if (typeof s0.fns?.initCachedRelease === 'function') s0.fns.initCachedRelease();
      if (typeof s0.fns?.initDynamicCreditYear === 'function') s0.fns.initDynamicCreditYear();
      if (typeof s0.fns?.initOsDetection === 'function') s0.fns.initOsDetection();
      if (typeof s0.fns?.fetchLatestReleaseAssets === 'function') s0.fns.fetchLatestReleaseAssets();
    }

    // 3. UI Components (Tabs, Copy Buttons, Drawer, Accordion, Filter)
    const comp = s0.modules?.components || s0.components;
    if (comp) {
      if (typeof comp.initMobileMenu === 'function') comp.initMobileMenu();
      if (typeof comp.initComparisonFilter === 'function') comp.initComparisonFilter();
      if (typeof comp.initDistroTabs === 'function') comp.initDistroTabs();
      if (typeof comp.initCopyButtons === 'function') comp.initCopyButtons();
      if (typeof comp.initFaqAccordion === 'function') comp.initFaqAccordion();
    } else {
      if (typeof s0.fns?.initMobileMenu === 'function') s0.fns.initMobileMenu();
      if (typeof s0.fns?.initComparisonFilter === 'function') s0.fns.initComparisonFilter();
      if (typeof s0.fns?.initDistroTabs === 'function') s0.fns.initDistroTabs();
      if (typeof s0.fns?.initCopyButtons === 'function') s0.fns.initCopyButtons();
      if (typeof s0.fns?.initFaqAccordion === 'function') s0.fns.initFaqAccordion();
    }

    // 4. Interactive Desktop Mockup Simulation
    const mock = s0.modules?.mockup || s0.mockup;
    if (mock?.initMockupTabs) {
      mock.initMockupTabs();
    } else if (typeof s0.fns?.initMockupTabs === 'function') {
      s0.fns.initMockupTabs();
    } else if (typeof window.initMockupTabs === 'function') {
      window.initMockupTabs();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
