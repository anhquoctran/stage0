// Stage0 UI Components (Tabs, Copy Buttons, Accordions, Navigation Drawer, Filters)
(function () {
  'use strict';

  // 1. Linux Distro Installation Tabs
  function initDistroTabs() {
    const tabs = document.querySelectorAll('[data-distro-tab]');
    const codes = document.querySelectorAll('[data-distro-code]');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-distro-tab');
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        if (window.Stage0 && typeof window.Stage0.track === 'function') {
          window.Stage0.track('distro-tab-switch', { distro: target });
        } else if (window.umami && typeof window.umami.track === 'function') {
          window.umami.track('distro-tab-switch', { distro: target });
        }

        codes.forEach(c => {
          const isMatch = c.getAttribute('data-distro-code') === target;
          c.style.setProperty('display', isMatch ? 'flex' : 'none', 'important');
        });
      });
    });
  }

  // 2. Code Block Copy Buttons
  function initCopyButtons() {
    const copyBtns = document.querySelectorAll('.copy-btn');
    copyBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const codeTargetId = btn.getAttribute('data-copy-target');
        const targetEl = document.getElementById(codeTargetId);
        const textToCopy = targetEl ? targetEl.textContent.trim() : btn.getAttribute('data-copy-text');

        if (!textToCopy) return;

        try {
          await navigator.clipboard.writeText(textToCopy);
          if (window.Stage0 && typeof window.Stage0.track === 'function') {
            window.Stage0.track('copy-command', { target: codeTargetId || 'command' });
          } else if (window.umami && typeof window.umami.track === 'function') {
            window.umami.track('copy-command', { target: codeTargetId || 'command' });
          }
          const originalHtml = btn.innerHTML;
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
          btn.style.backgroundColor = '#16a34a';
          btn.style.color = '#ffffff';

          setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.style.backgroundColor = '';
            btn.style.color = '';
          }, 2000);
        } catch (err) {
          console.error('Failed to copy to clipboard', err);
        }
      });
    });
  }

  // 3. FAQ Accordion
  function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
      const questionBtn = item.querySelector('.faq-question');
      if (questionBtn) {
        questionBtn.addEventListener('click', () => {
          const isOpen = item.classList.contains('open');
          // Close others
          faqItems.forEach(other => other.classList.remove('open'));
          if (!isOpen) {
            item.classList.add('open');
            const questionText = questionBtn.querySelector('span')?.textContent?.trim() || 'faq';
            if (window.Stage0 && typeof window.Stage0.track === 'function') {
              window.Stage0.track('faq-expand', { question: questionText.slice(0, 50) });
            } else if (window.umami && typeof window.umami.track === 'function') {
              window.umami.track('faq-expand', { question: questionText.slice(0, 50) });
            }
          }
        });
      }
    });
  }

  // 4. Mobile Navigation Drawer
  function initMobileMenu() {
    const toggleBtn = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    if (!toggleBtn || !mobileMenu) return;

    const icon = toggleBtn.querySelector('i');

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mobileMenu.classList.toggle('open');
      if (icon) {
        icon.className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
      }
    });

    // Close when clicking any mobile link
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        if (icon) icon.className = 'fa-solid fa-bars';
      });
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (mobileMenu.classList.contains('open') && !mobileMenu.contains(e.target) && !toggleBtn.contains(e.target)) {
        mobileMenu.classList.remove('open');
        if (icon) icon.className = 'fa-solid fa-bars';
      }
    });
  }

  // 5. Mobile Comparison Dimension Filter
  function initComparisonFilter() {
    const filterBtns = document.querySelectorAll('[data-comp-filter]');
    const altRows = document.querySelectorAll('[data-comp-target]');
    if (!filterBtns.length || !altRows.length) return;

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-comp-filter');
        if (window.Stage0 && typeof window.Stage0.track === 'function') {
          window.Stage0.track('comparison-filter-click', { filter: filter });
        } else if (window.umami && typeof window.umami.track === 'function') {
          window.umami.track('comparison-filter-click', { filter: filter });
        }
        
        // Update active pill button
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Filter comparison rows
        altRows.forEach(row => {
          const target = row.getAttribute('data-comp-target');
          if (filter === 'all' || filter === target) {
            row.style.display = 'flex';
          } else {
            row.style.display = 'none';
          }
        });
      });
    });
  }

  // Register with Stage0 global registry
  const s0 = window.stage0 || window.Stage0;
  if (s0 && typeof s0.__defineModule === 'function') {
    s0.__defineModule('components', {
      initDistroTabs,
      initCopyButtons,
      initFaqAccordion,
      initMobileMenu,
      initComparisonFilter
    });
    s0.__defineFunction('initDistroTabs', initDistroTabs);
    s0.__defineFunction('initCopyButtons', initCopyButtons);
    s0.__defineFunction('initFaqAccordion', initFaqAccordion);
    s0.__defineFunction('initMobileMenu', initMobileMenu);
    s0.__defineFunction('initComparisonFilter', initComparisonFilter);
  } else {
    window.Stage0 = window.Stage0 || {};
    window.Stage0.components = {
      initDistroTabs,
      initCopyButtons,
      initFaqAccordion,
      initMobileMenu,
      initComparisonFilter
    };
    window.initDistroTabs = initDistroTabs;
    window.initCopyButtons = initCopyButtons;
    window.initFaqAccordion = initFaqAccordion;
    window.initMobileMenu = initMobileMenu;
    window.initComparisonFilter = initComparisonFilter;
  }
})();

