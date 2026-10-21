import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
export const MAX_BACKEND_FILE_LINES = 500;

export function countLines(text) {
  if (!text.length) return 0;
  const lines = text.split('\n').length;
  return text.endsWith('\n') ? lines - 1 : lines;
}

function rustFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return rustFiles(file);
    return entry.isFile() && entry.name.endsWith('.rs') ? [file] : [];
  });
}

export function checkBackendSize(root = projectRoot, maxLines = MAX_BACKEND_FILE_LINES) {
  const files = rustFiles(path.join(root, 'backend', 'src'));
  const buildScript = path.join(root, 'backend', 'build.rs');
  if (fs.existsSync(buildScript)) files.push(buildScript);
  const measurements = files.map((file) => ({
    file: path.relative(root, file).split(path.sep).join('/'),
    lines: countLines(fs.readFileSync(file, 'utf8')),
  })).sort((a, b) => a.file.localeCompare(b.file));
  return {
    files: measurements.length,
    maxLines,
    largest: Math.max(0, ...measurements.map(({ lines }) => lines)),
    violations: measurements.filter(({ lines }) => lines > maxLines),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = checkBackendSize();
  for (const { file, lines } of result.violations) {
    console.error(`${file}: ${lines} lines exceeds ${result.maxLines}; extract a cohesive module.`);
  }
  if (result.violations.length) process.exitCode = 1;
  else console.log(`Backend size OK: ${result.files} Rust files, largest ${result.largest}/${result.maxLines} lines.`);
}
