import fs from 'node:fs';
import ts from 'typescript';

export function loadWithMocks(url, dependencies) {
  const { outputText } = ts.transpileModule(fs.readFileSync(url, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  });
  const exports = {};
  new Function('require', 'exports', outputText)((id) => {
    if (Object.hasOwn(dependencies, id)) return dependencies[id];
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
  return [node, ...[node.props?.children].flat(Infinity).flatMap(componentNodes)];
}
