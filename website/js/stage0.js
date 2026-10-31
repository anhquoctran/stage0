(() => {
  'use strict';

  // Stage0 is a global readonly/frozen/sealed registry to store all functions and constants for the website.
  // Enforces complete runtime immutability for fns, constants, and modules.

  let isInternalDefining = false;

  // Internal storage targets
  const fnsTarget = Object.create(null);
  const constantsTarget = Object.create(null);
  const modulesTarget = Object.create(null);

  /**
   * Helper to deeply freeze objects and arrays for immutable constants
   */
  function deepFreeze(obj) {
    if (!obj || typeof obj !== 'object' || Object.isFrozen(obj)) {
      return obj;
    }
    Object.freeze(obj);
    for (const key of Object.getOwnPropertyNames(obj)) {
      const val = obj[key];
      if (val && (typeof val === 'object' || typeof val === 'function')) {
        deepFreeze(val);
      }
    }
    return obj;
  }

  /**
   * Proxy factory to strictly prevent direct additions, mutations, or deletions at runtime
   */
  function createProtectedProxy(target, typeName, defineMethodName) {
    return new Proxy(target, {
      get(t, prop, receiver) {
        return Reflect.get(t, prop, receiver);
      },
      set(t, prop) {
        throw new TypeError(
          `[Stage0] Direct assignment to '${typeName}.${String(prop)}' is forbidden. ` +
          `Use stage0.${defineMethodName}('${String(prop)}', value) to register it safely.`
        );
      },
      deleteProperty(t, prop) {
        throw new TypeError(`[Stage0] Deleting property '${typeName}.${String(prop)}' is strictly forbidden.`);
      },
      defineProperty(t, prop, descriptor) {
        if (!isInternalDefining) {
          throw new TypeError(
            `[Stage0] Direct property definition on '${typeName}.${String(prop)}' is forbidden. ` +
            `Use stage0.${defineMethodName}() instead.`
          );
        }
        return Reflect.defineProperty(t, prop, descriptor);
      },
      setPrototypeOf() {
        throw new TypeError(`[Stage0] Modifying prototype of '${typeName}' is forbidden.`);
      },
      preventExtensions() {
        return Reflect.preventExtensions(t);
      }
    });
  }

  // Create runtime-protected proxies
  const fns = createProtectedProxy(fnsTarget, 'fns', '__defineFunction');
  const constants = createProtectedProxy(constantsTarget, 'constants', '__defineConstant');
  const modules = createProtectedProxy(modulesTarget, 'modules', '__defineModule');

  /**
   * Define an executable function in the Stage0 registry.
   * Throws if function name already exists, preventing runtime overwrite.
   */
  function defineFunction(name, fn) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new TypeError('[Stage0] Function name must be a non-empty string');
    }
    if (typeof fn !== 'function') {
      throw new TypeError(`[Stage0] Function for '${name}' must be a function, received: ${typeof fn}`);
    }
    if (name in fnsTarget) {
      throw new Error(`[Stage0] Function '${name}' is already defined and cannot be overwritten at runtime.`);
    }

    isInternalDefining = true;
    try {
      const frozenFn = Object.freeze(fn);
      Object.defineProperty(fnsTarget, name, {
        value: frozenFn,
        configurable: false,
        enumerable: true,
        writable: false
      });
      return frozenFn;
    } finally {
      isInternalDefining = false;
    }
  }

  /**
   * Define an immutable constant in the Stage0 registry.
   * Throws if constant name already exists, preventing runtime overwrite.
   */
  function defineConstant(name, value) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new TypeError('[Stage0] Constant name must be a non-empty string');
    }
    if (name in constantsTarget) {
      throw new Error(`[Stage0] Constant '${name}' is already defined and cannot be overwritten at runtime.`);
    }

    const frozenValue = deepFreeze(value);

    isInternalDefining = true;
    try {
      Object.defineProperty(constantsTarget, name, {
        value: frozenValue,
        configurable: false,
        enumerable: true,
        writable: false
      });
      return frozenValue;
    } finally {
      isInternalDefining = false;
    }
  }

  /**
   * Define a submodule (e.g. theme, releases, mockup, components).
   * Throws if module name already exists, preventing runtime overwrite.
   */
  function defineModule(name, mod) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new TypeError('[Stage0] Module name must be a non-empty string');
    }
    if (!mod || typeof mod !== 'object') {
      throw new TypeError(`[Stage0] Module '${name}' must be an object`);
    }
    if (name in modulesTarget) {
      throw new Error(`[Stage0] Module '${name}' is already defined and cannot be overwritten at runtime.`);
    }

    const frozenMod = Object.freeze(mod);

    isInternalDefining = true;
    try {
      Object.defineProperty(modulesTarget, name, {
        value: frozenMod,
        configurable: false,
        enumerable: true,
        writable: false
      });
      return frozenMod;
    } finally {
      isInternalDefining = false;
    }
  }

  /**
   * Safely invoke a registered function with error boundary
   */
  function invoke(name, ...args) {
    const fn = fnsTarget[name];
    if (typeof fn !== 'function') {
      console.warn(`[Stage0] Function '${name}' is not registered`);
      return undefined;
    }
    try {
      return fn(...args);
    } catch (err) {
      console.error(`[Stage0] Error executing function '${name}':`, err);
      return undefined;
    }
  }

  /**
   * Bridge to Umami Analytics event tracking
   */
  function track(eventName, eventData) {
    if (typeof window !== 'undefined' && window.umami && typeof window.umami.track === 'function') {
      window.umami.track(eventName, eventData);
    }
  }

  /**
   * Common Fetch Wrapper with timeout, error handling and retry support
   * @param {string} url - Request target URL
   * @param {Object} [options] - Options (timeout, retries, retryDelay, headers, etc.)
   * @returns {Promise<Response>}
   */
  async function httpFetch(url, options = {}) {
    if (typeof fetch !== 'function') {
      throw new Error('[Stage0.http] Global fetch API is not available in this environment');
    }

    const {
      timeout = 10000,
      retries = 0,
      retryDelay = 500,
      headers = {},
      ...fetchOptions
    } = options;

    let controller;
    let timeoutId;

    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeout);
      if (fetchOptions.signal) {
        fetchOptions.signal.addEventListener('abort', () => controller.abort());
      }
      fetchOptions.signal = controller.signal;
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          ...headers
        }
      });
      return response;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`[Stage0.http] Request timed out after ${timeout}ms for URL: ${url}`);
      }
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return httpFetch(url, { ...options, retries: retries - 1 });
      }
      throw err;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Convenience helper to fetch and parse JSON with automatic response.ok verification
   * @param {string} url - Target URL
   * @param {Object} [options] - Request options
   * @returns {Promise<any>}
   */
  async function getJson(url, options = {}) {
    const res = await httpFetch(url, {
      ...options,
      headers: {
        Accept: 'application/json, application/vnd.github.v3+json, text/plain, */*',
        ...(options.headers || {})
      }
    });

    if (!res.ok) {
      const error = new Error(`[Stage0.http] HTTP ${res.status} ${res.statusText} for URL: ${url}`);
      error.status = res.status;
      error.response = res;
      throw error;
    }

    return res.json();
  }

  /**
   * Convenience helper for HEAD requests (e.g. server headers inspection)
   * @param {string} url - Target URL
   * @param {Object} [options] - Request options
   * @returns {Promise<Response>}
   */
  async function head(url, options = {}) {
    return httpFetch(url, {
      ...options,
      method: 'HEAD'
    });
  }

  /**
   * REST API & HTTP Suite for Stage0
   */
  const restApi = Object.freeze({
    fetch: httpFetch,
    get: (url, options) => httpFetch(url, { ...options, method: 'GET' }),
    getJson,
    head,
    post: (url, body, options = {}) => httpFetch(url, {
      ...options,
      method: 'POST',
      body: typeof body === 'object' && !(body instanceof FormData) ? JSON.stringify(body) : body,
      headers: {
        ...(typeof body === 'object' && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    }),
    postJson: (url, data, options = {}) => httpFetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {})
      },
      body: JSON.stringify(data)
    })
  });

  // Pre-configured Website Core Constants & Release Config
  const GITHUB_REPO = 'anhquoctran/stage0';
  const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;
  const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
  const RELEASES_LIST_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=100`;
  const CACHE_KEY = 'stage0_latest_release_cache';
  const RELEASES_LIST_CACHE_KEY = 'stage0_release_list_cache';
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache to stay well within GitHub API rate limits (60 req/hr)

  const defaultAssets = {
    windowsExe: RELEASES_PAGE_URL,
    macArm: RELEASES_PAGE_URL,
    macIntel: RELEASES_PAGE_URL,
    linuxAppImage: RELEASES_PAGE_URL,
    linuxDeb: RELEASES_PAGE_URL,
    linuxRpm: RELEASES_PAGE_URL,
    tarArchive: RELEASES_PAGE_URL
  };

  // Register in constants (immutable, deep-frozen, cannot be overwritten at runtime)
  defineConstant('GITHUB_REPO', GITHUB_REPO);
  defineConstant('RELEASES_API_URL', RELEASES_API_URL);
  defineConstant('RELEASES_LIST_API_URL', RELEASES_LIST_API_URL);
  defineConstant('RELEASES_PAGE_URL', RELEASES_PAGE_URL);
  defineConstant('CACHE_KEY', CACHE_KEY);
  defineConstant('RELEASES_LIST_CACHE_KEY', RELEASES_LIST_CACHE_KEY);
  defineConstant('CACHE_TTL_MS', CACHE_TTL_MS);
  defineConstant('DEFAULT_ASSETS', defaultAssets);

  // Runtime dynamic asset URLs map (initialized from default fallback URLs)
  const latestAssets = { ...defaultAssets };

  // Pre-register core HTTP methods in functions registry and modules
  defineFunction('fetch', httpFetch);
  defineFunction('getJson', getJson);
  defineFunction('head', head);
  defineModule('restApi', restApi);

  // Construct the Stage0 core registry object
  const stage0 = {
    // Registries (proxied against direct modification/overwrites)
    fns,
    fn: fns,
    constants,
    constant: constants,
    modules,
    module: modules,

    // REST API Suite
    restApi,
    api: restApi,
    http: restApi,

    // Common Shortcuts
    fetch: httpFetch,
    getJson,
    head,

    // Runtime Dynamic Release Assets
    latestAssets,
    assets: latestAssets,

    // Registration APIs
    __defineFunction: defineFunction,
    defineFunction,
    __defineConstant: defineConstant,
    defineConstant,
    __defineModule: defineModule,
    defineModule,

    // Utility Helpers
    hasFunction: (name) => typeof fnsTarget[name] === 'function',
    hasConstant: (name) => Object.prototype.hasOwnProperty.call(constantsTarget, name),
    getConstant: (name, fallback) => (name in constantsTarget ? constantsTarget[name] : fallback),
    invoke,
    track
  };

  // Seal and freeze the Stage0 object itself so properties cannot be added, changed, or deleted
  Object.freeze(stage0);

  // Expose as readonly, non-configurable, non-writable properties on window
  // Supports both lowercase window.stage0 and PascalCase window.Stage0
  Object.defineProperty(window, 'stage0', {
    value: stage0,
    configurable: false,
    enumerable: false,
    writable: false
  });

  Object.defineProperty(window, 'Stage0', {
    value: stage0,
    configurable: false,
    enumerable: false,
    writable: false
  });
})();
