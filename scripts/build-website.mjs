import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const websiteRoot = path.join(projectRoot, 'website');
const outputRoot = path.join(projectRoot, 'dist', 'website');
const outputAssets = path.join(outputRoot, 'assets');
const javascriptSources = [
  'js/stage0.js',
  'js/theme.js',
  'js/releases.js',
  'js/release-history.js',
  'js/components.js',
  'js/mockup.js',
  'app.js',
];

function digest(contents) {
  return createHash('sha256').update(contents).digest('hex').slice(0, 12);
}

function replaceExactlyOnce(source, pattern, replacement, description) {
  const matches = source.match(pattern);
  if (!matches || matches.length !== 1) {
    throw new Error(`Expected exactly one ${description} reference in website/index.html`);
  }
  return source.replace(pattern, replacement);
}

async function bundleAssets() {
  const javascriptEntry = javascriptSources
    .map(source => `import ${JSON.stringify(`./${source}`)};`)
    .join('\n');

  await build({
    absWorkingDir: websiteRoot,
    stdin: {
      contents: javascriptEntry,
      resolveDir: websiteRoot,
      sourcefile: 'stage0-site-entry.js',
      loader: 'js',
    },
    outfile: path.join(outputAssets, 'stage0-site.min.js'),
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    legalComments: 'none',
  });

  await build({
    absWorkingDir: websiteRoot,
    stdin: {
      contents: '@import "./styles.css";\n@import "./mockup.css";',
      resolveDir: websiteRoot,
      sourcefile: 'stage0-site-entry.css',
      loader: 'css',
    },
    outfile: path.join(outputAssets, 'stage0-site.min.css'),
    bundle: true,
    minify: true,
    legalComments: 'none',
  });
}

function rewriteHtml(html, javascriptVersion, cssVersion) {
  const scriptBlockPattern = /<!-- Core Stage0 Registry & Global Object -->[\s\S]*?<script defer src="\.\/app\.js[^"]*"><\/script>/;
  const scriptBlock = html.match(scriptBlockPattern)?.[0];
  if (!scriptBlock) throw new Error('Could not find the website local-script block');

  const scriptPaths = [...scriptBlock.matchAll(/<script\b[^>]*\bsrc="\.\/([^"]+)"[^>]*><\/script>/g)]
    .map(([, source]) => source.split('?')[0]);
  if (scriptPaths.length !== javascriptSources.length
      || javascriptSources.some(source => scriptPaths.filter(pathname => pathname === source).length !== 1)) {
    throw new Error('Website script order or source list changed; update the bundle entry list');
  }

  let output = html.replace(
    scriptBlockPattern,
    `<!-- Bundled website runtime -->\n        <script defer src="./assets/stage0-site.min.js?v=${javascriptVersion}"></script>`,
  );
  output = replaceExactlyOnce(
    output,
    /<link rel="stylesheet" href="\.\/styles\.css\?v=[^"]+"\s*\/>/,
    `<link rel="stylesheet" href="./assets/stage0-site.min.css?v=${cssVersion}" />`,
    'main stylesheet',
  );
  output = replaceExactlyOnce(
    output,
    /\s*<link rel="stylesheet" href="\.\/mockup\.css\?v=[^"]+"\s*\/>/,
    '',
    'mockup stylesheet',
  );
  return output;
}

async function main() {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(path.dirname(outputRoot), { recursive: true });
  await cp(websiteRoot, outputRoot, { recursive: true });
  await rm(path.join(outputRoot, 'js'), { recursive: true, force: true });
  await Promise.all([
    rm(path.join(outputRoot, 'app.js'), { force: true }),
    rm(path.join(outputRoot, 'styles.css'), { force: true }),
    rm(path.join(outputRoot, 'mockup.css'), { force: true }),
  ]);
  await mkdir(outputAssets, { recursive: true });
  await bundleAssets();

  const javascriptPath = path.join(outputAssets, 'stage0-site.min.js');
  const cssPath = path.join(outputAssets, 'stage0-site.min.css');
  const [javascript, css, html] = await Promise.all([
    readFile(javascriptPath),
    readFile(cssPath),
    readFile(path.join(outputRoot, 'index.html'), 'utf8'),
  ]);
  const rewrittenHtml = rewriteHtml(html, digest(javascript), digest(css));
  await writeFile(path.join(outputRoot, 'index.html'), rewrittenHtml);

  const [javascriptInfo, cssInfo] = await Promise.all([stat(javascriptPath), stat(cssPath)]);
  console.log(`Bundled GitHub Pages website to ${path.relative(projectRoot, outputRoot)}`);
  console.log(`JavaScript ${(javascriptInfo.size / 1024).toFixed(1)} KB · CSS ${(cssInfo.size / 1024).toFixed(1)} KB`);
}

await main();
