import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { countLines } from './check-backend-size.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
export const MAX_FRONTEND_FILE_LINES = 450;

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [file] : [];
  });
}

export function checkFrontendSize(root = projectRoot, maxLines = MAX_FRONTEND_FILE_LINES) {
  const measurements = sourceFiles(path.join(root, 'frontend')).map((file) => ({
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
  const result = checkFrontendSize();
  for (const { file, lines } of result.violations) {
    console.error(`${file}: ${lines}/${result.maxLines} lines; extract a cohesive module.`);
  }
  if (result.violations.length) process.exitCode = 1;
  else console.log(`Frontend size OK: ${result.files} files, largest ${result.largest}/${result.maxLines} lines.`);
}
