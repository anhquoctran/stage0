import path from 'node:path';

export function parseLcov(source, scope, root = process.cwd()) {
  const files = new Map();
  let current;
  const count = value => {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw Error('Invalid LCOV count');
    return Number(value);
  };
  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      if (current) throw Error('Unterminated LCOV record');
      const raw = line.slice(3).replaceAll('\\', '/');
      const name = path.isAbsolute(raw) ? path.relative(root, raw).replaceAll('\\', '/') : raw;
      if (!name.startsWith(scope) || name.split('/').includes('..') || files.has(name)) throw Error(`Invalid/duplicate coverage source: ${name}`);
      current = { name, lines: new Map(), functions: new Map(), branches: new Map() };
    } else if (/^(DA|FNDA|BRDA):/.test(line)) {
      if (!current) throw Error('Coverage counters outside a source record');
      const [kind, ...value] = line.split(':');
      const parts = value.join(':').split(',');
      let map, key, hits;
      if (kind === 'DA') { map = current.lines; key = count(parts[0]); hits = count(parts[1]); if (!key) throw Error('Invalid source line'); }
      if (kind === 'FNDA') { map = current.functions; hits = count(parts.shift()); key = parts.join(','); }
      if (kind === 'BRDA') { map = current.branches; key = parts.slice(0, 3).join(','); hits = parts[3] === '-' ? 0 : count(parts[3]); }
      if (!key || map.has(key)) throw Error('Missing/duplicate coverage counter');
      map.set(key, hits);
    } else if (line === 'end_of_record') {
      if (!current) throw Error('Unexpected LCOV record end');
      const metrics = {};
      for (const metric of ['lines', 'functions', 'branches']) {
        const values = [...current[metric].values()];
        const covered = values.filter(hits => hits > 0).length;
        metrics[metric] = { total: values.length, covered, percent: values.length ? covered / values.length * 100 : null };
      }
      files.set(current.name, metrics);
      current = null;
    }
  }
  if (current || !files.size) throw Error('Missing/unfinished coverage report');
  const total = {};
  for (const metric of ['lines', 'functions', 'branches']) {
    const values = [...files.values()].map(file => file[metric]);
    const size = values.reduce((sum, value) => sum + value.total, 0);
    const covered = values.reduce((sum, value) => sum + value.covered, 0);
    total[metric] = { total: size, covered, percent: size ? covered / size * 100 : null };
  }
  if (!total.lines.total || !total.functions.total) throw Error('Empty executable coverage report');
  return { total, files: Object.fromEntries(files) };
}

export function validateCoveragePolicy(policy, previous) {
  if (policy.version !== 1) throw Error('Unsupported coverage policy');
  for (const suite of ['react', 'rust']) {
    const config = policy[suite];
    if (!config || config.scope !== (suite === 'react' ? 'frontend/' : 'backend/src/')) throw Error('Invalid coverage scope');
    if (config.report !== `coverage/${suite}/lcov.info`) throw Error('Invalid coverage report path');
    for (const metric of ['lines', 'functions']) if (!(config.minimum?.[metric] > 0)) throw Error('Nonzero line/function floors required');
    for (const floors of [config.minimum, ...Object.values(config.protectedFiles || {})]) {
      if (!Object.keys(floors).length) throw Error('Empty coverage floor');
      for (const [metric, floor] of Object.entries(floors)) {
        if (!['lines', 'functions', 'branches'].includes(metric) || !Number.isFinite(floor) || floor <= 0 || floor > 100) throw Error('Invalid coverage floor');
      }
    }
    for (const name of Object.keys(config.protectedFiles || {})) if (!name.startsWith(config.scope) || name.includes('..')) throw Error('Invalid protected source');
    if (previous) {
      const before = previous[suite];
      if (config.scope !== before.scope || config.report !== before.report) throw Error('Coverage scope/report changed');
      for (const [name, floors] of Object.entries({ total: before.minimum, ...before.protectedFiles })) {
        const next = name === 'total' ? config.minimum : config.protectedFiles?.[name];
        if (!next || Object.entries(floors).some(([metric, floor]) => !(next[metric] >= floor))) throw Error(`Coverage floors cannot decrease: ${suite}/${name}`);
      }
    }
  }
}

export function enforceCoverage(report, config) {
  for (const [name, floors] of Object.entries({ total: config.minimum, ...config.protectedFiles })) {
    const measured = name === 'total' ? report.total : report.files[name];
    if (!measured) throw Error(`Protected coverage source missing: ${name}`);
    for (const [metric, floor] of Object.entries(floors)) {
      const actual = measured[metric]?.percent;
      if (actual === null || actual === undefined || actual < floor) throw Error(`${name} ${metric}: ${actual === null ? 'not measured' : actual?.toFixed(2) + '%'} < ${floor}%`);
    }
  }
}
