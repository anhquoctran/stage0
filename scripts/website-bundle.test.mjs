import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const websiteOutput = path.join(projectRoot, 'dist', 'website');

test('GitHub Pages builder emits bundled CSS and JS and rewrites the deploy page', () => {
  execFileSync(process.execPath, ['scripts/build-website.mjs'], { cwd: projectRoot });

  const html = readFileSync(path.join(websiteOutput, 'index.html'), 'utf8');
  const javascript = path.join(websiteOutput, 'assets', 'stage0-site.min.js');
  const stylesheet = path.join(websiteOutput, 'assets', 'stage0-site.min.css');

  assert.match(html, /href="\.\/assets\/stage0-site\.min\.css\?v=[a-f\d]{12}"/);
  assert.match(html, /src="\.\/assets\/stage0-site\.min\.js\?v=[a-f\d]{12}"/);
  assert.doesNotMatch(html, /(?:href|src)="\.\/(?:styles\.css|mockup\.css|app\.js|js\/)/);
  assert.ok(statSync(javascript).size > 0);
  assert.ok(statSync(stylesheet).size > 0);
  assert.ok(existsSync(path.join(websiteOutput, 'assets', 'app-icon.svg')));
  assert.equal(existsSync(path.join(websiteOutput, 'js')), false);
});
