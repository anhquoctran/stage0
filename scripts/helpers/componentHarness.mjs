import fs from 'node:fs';
import ts from 'typescript';

const english = JSON.parse(fs.readFileSync(new URL('../../frontend/features/i18n/locales/en.json', import.meta.url), 'utf8'));
const translate = (key, options = {}) => {
  const value = key.split('.').reduce((node, part) => node?.[part], english);
  return typeof value === 'string'
    ? value.replace(/\{\{(\w+)\}\}/g, (token, name) => String(options[name] ?? token))
    : key;
};

export function loadWithMocks(url, dependencies, context) {
  if (!context) {
    const originalDependencies = dependencies;
    dependencies = new Proxy({ ...dependencies }, {
      get: (target, key) => Object.hasOwn(target, key) ? target[key] : originalDependencies[key],
    });
    if (!Object.hasOwn(dependencies, 'react-i18next')) {
      dependencies['react-i18next'] = { useTranslation: () => ({ t: translate, i18n: { language: 'en' } }) };
    }
    // Legacy workflow fixtures exercise the native adapter. Explicit browser
    // fixtures retain isTauri: false; missing SDK pieces remain unavailable.
    if (Object.keys(dependencies).some((id) => id.startsWith('@tauri-apps/'))) {
      dependencies['@tauri-apps/api/core'] = { isTauri: () => true, ...dependencies['@tauri-apps/api/core'] };
    }
    if (dependencies.react) {
      const react = dependencies.react;
      dependencies.react = {
        createContext: (value) => ({ _currentValue: value }),
        useContext: (context) => context._currentValue,
        ...react,
      };
    }
  }
  if (url.pathname.endsWith('.json')) return { default: JSON.parse(fs.readFileSync(url, 'utf8')) };
  context ??= {
    mocks: new Map(Object.entries(dependencies).filter(([id]) => id.startsWith('.') || id.startsWith('@/'))
      .map(([id, value]) => [resolveModule(id, url), value])),
    cache: new Map(),
  };
  if (context.cache.has(url.href)) return context.cache.get(url.href);
  const { outputText } = ts.transpileModule(fs.readFileSync(url, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  context.cache.set(url.href, exports);
  new Function('require', 'exports', outputText)((id) => {
    if (id === 'react/jsx-runtime' && dependencies.react) {
      const react = dependencies.react.default ?? dependencies.react;
      const element = (type, props, key) => {
        const { children, ...attributes } = props ?? {};
        return react.createElement(type, { ...attributes, ...(key === undefined ? {} : { key }) },
          ...(Array.isArray(children) ? children : children === undefined ? [] : [children]));
      };
      return { jsx: element, jsxs: element, Fragment: react.Fragment };
    }
    if (id.startsWith('.') || id.startsWith('@/')) {
      const mock = resolveModule(id, url);
      if (context.mocks.has(mock)) return context.mocks.get(mock);
    } else if (Object.hasOwn(dependencies, id)) return dependencies[id];
    if (id === 'zustand') {
      return {
        create: (initializer) => {
          let state = {};
          const set = (updater) => { state = typeof updater === 'function' ? updater(state) : { ...state, ...updater }; };
          const get = () => state;
          const store = (selector) => (selector ? selector(state) : state);
          store.getState = get;
          store.setState = set;
          store.subscribe = () => () => {};
          try { if (typeof initializer === 'function') state = initializer(set, get, store) ?? {}; } catch {}
          return store;
        },
      };
    }
    if ((id.startsWith('.') || id.startsWith('@/')) && !id.endsWith('/preferencesJsonService') && !id.endsWith('/listSecretMcpEnv')) {
      for (const ext of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
        try {
          const candidate = id.startsWith('@/')
            ? new URL(`../../frontend/${id.slice(2)}${ext}`, import.meta.url)
            : new URL(id + ext, url);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return loadWithMocks(candidate, dependencies, context);
          }
        } catch {}
      }
    }
    if (id.endsWith('/listSecretMcpEnv')) {
      const isSecretMcpEnvName = (name) => /(token|secret|password|credential|api[_-]?key)/i.test(name);
      const isLikelySecretMcpEnvValue = (value) => /^(sk-|ghp_|github_pat_|glpat-|xox[bp]-)/i.test(value.trim());
      const listSecretMcpEnv = (servers) => servers.flatMap((server) => {
        return Object.entries(server.env ?? {})
          .filter(([name, value]) => value.trim() && (isSecretMcpEnvName(name) || isLikelySecretMcpEnvValue(value)))
          .map(([name]) => `${server.name}.${name}`);
      });
      const publicMcpEnv = (env, secretEnvKeys = []) => {
        const secretNames = new Set(secretEnvKeys);
        return Object.fromEntries(Object.entries(env).filter(([name, value]) =>
          !secretNames.has(name) && !isSecretMcpEnvName(name) && !isLikelySecretMcpEnvValue(value)
        ));
      };
      return { listSecretMcpEnv, publicMcpEnv, isSecretMcpEnvName, isLikelySecretMcpEnvValue };
    }
    if (id.endsWith('/preferencesJsonService')) {
      let settings = globalThis.window?.__STAGE0_PREFERENCES__ ?? {};
      let revision = 'fixture-0';
      const document = () => ({ content: JSON.stringify(settings), revision, path: 'fixture', migrated: false, settings });
      const merge = (target, patch) => {
        const output = { ...target };
        for (const [key, value] of Object.entries(patch)) {
          output[key] = value && typeof value === 'object' && !Array.isArray(value) && output[key] && typeof output[key] === 'object' && !Array.isArray(output[key])
            ? merge(output[key], value)
            : value;
        }
        return output;
      };
      return { preferencesJsonService: {
        load: async () => document(),
        patch: async (patch) => {
          settings = merge(settings, patch);
          revision = `fixture-${Date.now()}`;
          if (globalThis.window) globalThis.window.__STAGE0_PREFERENCES__ = settings;
          return document();
        },
        saveText: async (content) => {
          settings = JSON.parse(content);
          revision = `fixture-${Date.now()}`;
          if (globalThis.window) globalThis.window.__STAGE0_PREFERENCES__ = settings;
          return document();
        },
        reset: async () => {
          settings = {};
          revision = `fixture-${Date.now()}`;
          if (globalThis.window) globalThis.window.__STAGE0_PREFERENCES__ = settings;
          return document();
        },
      } };
    }
    return dependencies[id];
  }, exports);
  return exports;
}

function resolveModule(id, url) {
  return (id.startsWith('@/')
    ? new URL(`../../frontend/${id.slice(2)}`, import.meta.url)
    : new URL(id, url)).href.replace(/\.(tsx?|m?js)$/, '').replace(/\/index$/, '');
}

export function componentHarness() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    Fragment: 'fragment',
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, (next) => {
        slots[index].value = typeof next === 'function' ? next(slots[index].value) : next;
      }];
    },
    useRef(initial) { return react.useState(() => ({ current: initial }))[0]; },
    useId() { return react.useState(() => `test-${cursor}`)[0]; },
    useCallback: (callback) => callback,
    useMemo: (callback) => callback(),
    useEffect(callback, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !dependencies || dependencies.some((value, i) => value !== previous.dependencies[i])) {
        previous?.cleanup?.();
        slots[index] = { dependencies };
        effects.push(() => { slots[index].cleanup = callback(); });
      }
    },
  };
  return {
    react: { ...react, default: react },
    async render(component, props = {}) {
      let tree;
      for (let iteration = 0; iteration < 6; iteration++) {
        cursor = 0;
        tree = component(props);
        const pending = effects;
        effects = [];
        pending.forEach((effect) => effect());
        await new Promise((resolve) => setImmediate(resolve));
      }
      return tree;
    },
    cleanup: () => slots.forEach((slot) => slot?.cleanup?.()),
  };
}

export function componentNodes(node) {
  if (!node || typeof node !== 'object') return [];
  const children = [node.props?.children].flat(Infinity).flatMap(componentNodes);
  if (typeof node.type === 'function') {
    try {
      const rendered = node.type(node.props ?? {});
      if (rendered) return [node, ...componentNodes(rendered), ...children];
    } catch {}
  }
  return [node, ...children];
}
