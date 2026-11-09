import fs from 'node:fs';

/** Follow local CSS imports so source contracts survive moves without dropping assertions. */
export function readStylesheet(file, visited = new Set()) {
  const url = file instanceof URL ? file : new URL(file, new URL('../../', import.meta.url));
  if (visited.has(url.href)) return '';
  visited.add(url.href);
  const source = fs.readFileSync(url, 'utf8');
  return source.replace(/@import\s+["']([^"']+)["'];/g, (statement, imported) =>
    imported.startsWith('.') ? readStylesheet(new URL(imported, url), visited) : statement);
}
