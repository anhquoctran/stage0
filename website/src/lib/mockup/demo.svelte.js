export function createDemo() {
  let view = $state('diff');
  let file = $state('auth');
  let patched = $state(false);
  let refreshing = $state(false);
  let refreshed = $state(false);
  const timers = new Set();
  const later = (callback, delay) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };
  return {
    get view() {
      return view;
    },
    set view(value) {
      view = value;
    },
    get file() {
      return file;
    },
    get fileName() {
      return { auth: 'auth_service.rs', vault: 'token_vault.rs', db: 'migration.rs' }[file];
    },
    get directory() {
      return { auth: 'auth', vault: 'security', db: 'db' }[file];
    },
    get patched() {
      return patched;
    },
    get refreshing() {
      return refreshing;
    },
    get refreshed() {
      return refreshed;
    },
    selectFile(value) {
      file = value;
      view = 'diff';
    },
    applyPatch() {
      patched = true;
      later(() => (patched = false), 4000);
    },
    refresh() {
      refreshing = true;
      later(() => {
        refreshing = false;
        refreshed = true;
        later(() => (refreshed = false), 2500);
      }, 600);
    },
    destroy() {
      timers.forEach(clearTimeout);
      timers.clear();
    },
  };
}
