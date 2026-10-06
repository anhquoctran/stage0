// Keep the startup bootstrap in a same-origin asset so production CSP does
// not depend on WebView support for inline-script hashes.
window.$RefreshReg$ = window.$RefreshReg$ || function () {};
window.$RefreshSig$ = window.$RefreshSig$ || function () {
  return function (type) {
    return type;
  };
};
window.__stage0_has_error__ = false;

// Resolve the persisted theme before the inline splash styles are parsed. This
// prevents a dark first frame when the application is configured for light or
// system-light mode. Keep these storage keys in sync with useThemeStore.ts.
(function applyStartupTheme() {
  var mode = 'dark';
  try {
    var savedMode = window.localStorage.getItem('stage0_catppuccin_theme_mode');
    if (savedMode === 'system' || savedMode === 'dark' || savedMode === 'light') {
      mode = savedMode;
    } else {
      var legacyTheme = window.localStorage.getItem('stage0_catppuccin_theme');
      if (legacyTheme === 'mocha-light') mode = 'light';
      if (legacyTheme === 'mocha') mode = 'dark';
    }
  } catch (_) {
    // Storage can be unavailable in a restricted WebView; dark is the safe fallback.
  }

  var prefersDark = !window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches;
  var isLight = mode === 'light' || (mode === 'system' && !prefersDark);
  var theme = isLight ? 'mocha-light' : 'mocha';
  var root = document.documentElement;

  root.setAttribute('data-theme', theme);
  root.classList.remove('mocha', 'mocha-light', 'latte', 'light', 'dark');
  root.classList.add(isLight ? 'light' : 'dark');
  root.classList.add(isLight ? 'mocha-light' : 'mocha');
  if (isLight) root.classList.add('latte');
  root.style.colorScheme = isLight ? 'light' : 'dark';
})();

window.addEventListener('error', function () {
  window.__stage0_has_error__ = true;
  var statusElement = document.querySelector('#startup-splash .splash-status');
  if (statusElement) {
    statusElement.style.color = 'var(--splash-error)';
    statusElement.style.fontWeight = 'bold';
    statusElement.textContent = 'Startup failed. Open DevTools for details.';
  }
});

window.addEventListener('securitypolicyviolation', function (event) {
  // Do not echo a potentially sensitive blocked URL into logs.
  console.warn('[CSP Blocked]', event.violatedDirective);
});

document.addEventListener('DOMContentLoaded', function () {
  var fontStylesheet = document.getElementById('viewer-font-stylesheet');
  if (!fontStylesheet) return;

  var enableFontStylesheet = function () {
    fontStylesheet.media = 'all';
  };

  if (fontStylesheet.sheet) {
    enableFontStylesheet();
  } else {
    fontStylesheet.addEventListener('load', enableFontStylesheet, { once: true });
    fontStylesheet.addEventListener('error', enableFontStylesheet, { once: true });
  }
});

// Defensive failsafe: only dismiss the splash automatically after React has
// mounted. App.tsx removes it once application initialization is complete.
window.setTimeout(function () {
  var splash = document.getElementById('startup-splash');
  if (!splash) return;

  var root = document.getElementById('root');
  var hasContent = root && root.children && root.children.length > 0;
  if (hasContent && !window.__stage0_has_error__) {
    splash.classList.add('is-hidden');
    window.setTimeout(function () {
      if (splash.parentNode) splash.parentNode.removeChild(splash);
    }, 350);
  } else if (!hasContent && !window.__stage0_has_error__) {
    var statusElement = document.querySelector('#startup-splash .splash-status');
    if (statusElement) {
      statusElement.style.color = 'var(--splash-warning)';
      statusElement.textContent = 'Connecting to Stage0 runtime...';
    }
  }
}, 3500);
