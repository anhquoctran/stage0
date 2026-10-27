// Stage0 Theme Manager (Catppuccin Mocha & Latte)
(function () {
  'use strict';

  function getInitialTheme() {
    return localStorage.getItem('stage0_theme') || 
      (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: light)').matches ? 'latte' : 'mocha');
  }

  // Instant theme apply before DOM render to prevent theme flashing
  try {
    const savedTheme = getInitialTheme();
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  } catch (e) {}

  function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = getInitialTheme();
    
    applyTheme(savedTheme);

    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'mocha';
        const nextTheme = current === 'mocha' || current === 'dark' ? 'latte' : 'mocha';
        applyTheme(nextTheme);
        localStorage.setItem('stage0_theme', nextTheme);
        
        if (window.Stage0 && typeof window.Stage0.track === 'function') {
          window.Stage0.track('theme-toggle', { theme: nextTheme });
        } else if (window.umami && typeof window.umami.track === 'function') {
          window.umami.track('theme-toggle', { theme: nextTheme });
        }
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
      if (theme === 'latte' || theme === 'light') {
        themeIcon.className = 'fa-solid fa-sun';
      } else {
        themeIcon.className = 'fa-solid fa-moon';
      }
    }
  }

  // Register with Stage0 global registry
  const s0 = window.stage0 || window.Stage0;
  if (s0 && typeof s0.__defineModule === 'function') {
    s0.__defineModule('theme', { initTheme, applyTheme });
    s0.__defineFunction('initTheme', initTheme);
    s0.__defineFunction('applyTheme', applyTheme);
  } else {
    window.Stage0 = window.Stage0 || {};
    window.Stage0.theme = { initTheme, applyTheme };
    window.initTheme = initTheme;
    window.applyTheme = applyTheme;
  }
})();
