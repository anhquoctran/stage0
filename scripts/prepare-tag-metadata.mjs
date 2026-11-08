import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncAllMetadata } from './generate-about-info.mjs';

// Run only inside the isolated tag job. The main controller deliberately loads
// trusted tooling before checkout and may still use an older metadata schema.
export function prepareTagMetadata({ root = process.cwd(), os, arch } = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'backend/about.json'), 'utf8'));
  if (snapshot.packageVersion !== pkg.version) throw new Error('Tag metadata package version mismatch');
  const date = snapshot.releaseDate;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error('Tag metadata requires a valid frozen release date');
  }
  return syncAllMetadata({ root, releaseDate: date,
    os: os || process.env.TARGET_OS || snapshot.os,
    arch: arch || process.env.TARGET_ARCH || snapshot.arch });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const info = prepareTagMetadata();
  console.log(`Prepared tag metadata: ${info.version} (${info.releaseDate})`);
}
