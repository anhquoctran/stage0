// Keep the startup bootstrap in a same-origin asset so production CSP does
// not depend on WebView support for inline-script hashes.
window.$RefreshReg$ = window.$RefreshReg$ || function () {};
window.$RefreshSig$ = window.$RefreshSig$ || function () {
  return function (type) {
    return type;
  };
};
window.__stage0_has_error__ = false;

// Match the compact splash edge to Stage0's undecorated macOS window before
// index.html paints. Browser previews and other platforms keep square edges.
(function identifyMacOSWindowFrame() {
  if (!window.__TAURI_INTERNALS__) return;
  var navigator = window.navigator || {};
  var platform = String(navigator.platform || '');
  var userAgent = String(navigator.userAgent || '');
  if (/Mac|iPod|iPhone|iPad/.test(platform) || /Macintosh|Mac OS X/.test(userAgent)) {
    document.documentElement.setAttribute('data-platform', 'macos');
  }
})();

// Resolve the persisted theme before the inline splash styles are parsed. This
// prevents a dark first frame when the application is configured for light or
// system-light mode. Keep these storage keys in sync with useThemeStore.ts.
(function applyStartupTheme() {
  var mode = 'system';
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
    // Without saved preferences, follow the OS color scheme.
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
  if (isLight) {
    root.style.setProperty('--splash-bg', '#dce0e8');
    root.style.setProperty('--splash-text', '#3b3e53');
  } else {
    root.style.setProperty('--splash-bg', '#11111b');
    root.style.setProperty('--splash-text', '#cdd6f4');
  }
})();

// One weighted plan owns progress before and after the React bundle loads.
// Percentages represent completed startup work, never elapsed time or byte counts.
(function createStartupProgress() {
  var phases = [
    { id: 'runtime', label: 'Starting Stage0', weight: 10 },
    { id: 'preferences', label: 'Loading preferences', weight: 20 },
    { id: 'interface', label: 'Loading interface', weight: 20 },
    { id: 'window', label: 'Preparing window', weight: 10 },
    { id: 'repositories', label: 'Loading repositories and sandboxes', weight: 15 },
    { id: 'workspace', label: 'Preparing workspace', weight: 20 },
    { id: 'ready', label: 'Opening main screen', weight: 5 },
  ];
  var fractions = phases.map(function () { return 0; });
  var current = 0;
  var status = 'loading';
  var cancelDismissal;

  function snapshot() {
    var percent = Math.round(phases.reduce(function (sum, phase, index) {
      return sum + phase.weight * fractions[index];
    }, 0));
    return {
      phase: phases[current].id,
      label: status === 'error' ? 'Startup could not finish' : status === 'ready' || status === 'dismissed' ? 'Ready' : phases[current].label,
      percent: percent,
      step: current + 1,
      total: phases.length,
      status: status,
    };
  }

  function render() {
    var splash = document.getElementById('startup-splash');
    if (!splash) return;
    var state = snapshot();
    splash.setAttribute('data-state', status);
    var bar = document.getElementById('startup-progress');
    var fill = document.getElementById('startup-progress-fill');
    var label = document.getElementById('splash-status');
    var percentage = document.getElementById('splash-percentage');
    var detail = document.getElementById('splash-detail');
    var reload = document.getElementById('splash-reload');
    if (bar) {
      bar.setAttribute('aria-valuenow', String(state.percent));
      bar.setAttribute('aria-valuetext', state.label + ' · ' + state.percent + '%');
    }
    if (fill) fill.style.width = state.percent + '%';
    if (label) label.textContent = state.label;
    if (percentage) percentage.textContent = state.percent + '%';
    if (detail) detail.textContent = status === 'error'
      ? phases[current].label + ' did not finish. Reload Stage0 to try again.'
      : status === 'ready' ? 'Your workspace is ready.' : 'Step ' + state.step + ' of ' + state.total;
    if (reload) reload.hidden = status !== 'error';
  }

  function phaseIndex(id) {
    return phases.findIndex(function (phase) { return phase.id === id; });
  }

  var api = {
    begin: function (id) {
      var index = phaseIndex(id);
      if (status !== 'loading' || index < current || index < 0) return;
      current = index;
      render();
    },
    update: function (id, fraction) {
      var index = phaseIndex(id);
      if (status !== 'loading' || index < 0 || !Number.isFinite(fraction)) return;
      fractions[index] = Math.max(fractions[index], Math.min(1, Math.max(0, fraction)));
      render();
    },
    complete: function (id) { api.update(id, 1); },
    fail: function () {
      if (status === 'dismissed' || status === 'error') return;
      if (cancelDismissal) cancelDismissal();
      status = 'error';
      window.__stage0_has_error__ = true;
      render();
    },
    finish: function (handoff) {
      // An early React mount or a repeated effect cannot skip unfinished work.
      if (status === 'error' || status === 'dismissed' || fractions.slice(0, -1).some(function (value) { return value < 1; })) {
        return function () {};
      }
      if (cancelDismissal) cancelDismissal();
      current = phases.length - 1;
      fractions[current] = 1;
      status = 'ready';
      render();
      var cancelled = false;
      var fadeTimer;
      var removeTimer;
      var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var duration = reducedMotion ? 0 : 180;
      function cancel() {
        cancelled = true;
        window.clearTimeout(fadeTimer);
        window.clearTimeout(removeTimer);
        if (cancelDismissal === cancel) {
          cancelDismissal = undefined;
          var splash = document.getElementById('startup-splash');
          if (splash && status !== 'dismissed') {
            splash.classList.remove('is-hidden');
            splash.style.visibility = '';
          }
        }
      }
      cancelDismissal = cancel;
      // Give the determinate fill its final transition, then reveal the painted UI.
      fadeTimer = window.setTimeout(function () {
        if (cancelled || status !== 'ready') return;
        var splash = document.getElementById('startup-splash');
        if (handoff) {
          // Resize while hidden so the compact splash never grows to fill the
          // main workspace. Do not wait for animation frames in a hidden WebView.
          Promise.resolve().then(function () { return handoff.prepare(); }).then(function () {
            if (!cancelled && status === 'ready' && splash) splash.style.visibility = 'hidden';
            return handoff.reveal();
          }).then(function () {
            if (cancelled || status !== 'ready') return;
            if (splash) splash.remove();
            status = 'dismissed';
            cancelDismissal = undefined;
          }).catch(function () {
            if (!cancelled) {
              if (splash) splash.style.visibility = '';
              api.fail();
            }
            // Preparation rolls back on failure; a reveal failure gets one
            // best-effort attempt to make the error surface visible again.
            return handoff.reveal().catch(function () {});
          });
          return;
        }
        if (splash) splash.classList.add('is-hidden');
        removeTimer = window.setTimeout(function () {
          if (cancelled || status !== 'ready') return;
          if (splash) splash.remove();
          status = 'dismissed';
          cancelDismissal = undefined;
        }, duration);
      }, duration);
      return cancel;
    },
  };
  Object.defineProperty(api, 'snapshot', { get: snapshot });
  window.__STAGE0_STARTUP__ = api;

  document.addEventListener('DOMContentLoaded', function () {
    render();
    var reload = document.getElementById('splash-reload');
    if (reload) reload.addEventListener('click', function () { window.location.reload(); });
  });
})();

function markStartupError(event) {
  // Optional images/stylesheets do not decide whether the application can boot.
  if (event && event.type === 'error' && event.target && event.target !== window && event.target.tagName !== 'SCRIPT') return;
  window.__STAGE0_STARTUP__.fail();
}
window.addEventListener('error', markStartupError, true);
window.addEventListener('unhandledrejection', markStartupError);

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
