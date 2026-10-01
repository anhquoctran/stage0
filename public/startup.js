// Keep the startup bootstrap in a same-origin asset so production CSP does
// not depend on WebView support for inline-script hashes.
window.$RefreshReg$ = window.$RefreshReg$ || function () {};
window.$RefreshSig$ = window.$RefreshSig$ || function () {
  return function (type) {
    return type;
  };
};
window.__stage0_has_error__ = false;

window.addEventListener('error', function () {
  window.__stage0_has_error__ = true;
  var statusElement = document.querySelector('#startup-splash .splash-status');
  if (statusElement) {
    statusElement.style.color = '#f38ba8';
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
      statusElement.style.color = '#fab387';
      statusElement.textContent = 'Connecting to Stage0 runtime...';
    }
  }
}, 3500);
