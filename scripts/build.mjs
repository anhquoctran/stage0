#!/usr/bin/env node

/**
 * Stage0 - Cross-Platform Optimized Production Builder
 * Supports: Windows (NSIS .exe, .msi), macOS (.dmg, .app), Linux (.AppImage, .deb)
 *
 * Optimizations Applied:
 *   1. Full TypeScript verification (tsc --noEmit)
 *   2. Vite minification, tree-shaking & dynamic chunking
 *   3. Rust LTO (Link-Time Optimization) & codegen-units = 1
 *   4. Binary stripping (removes debug symbols, -40% binary size)
 *   5. Panic=abort (eliminates unwinding tables, smaller footprint & faster load)
 *   6. Automated SHA-256 checksums & integrity generation
 */

import { spawnSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { fileURLToPath } from 'url';
import { syncAllMetadata } from './generate-about-info.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.resolve(ROOT_DIR, 'backend');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');

// Terminal ANSI Colors
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const DIM = '\x1b[2m';

const PLATFORM = os.platform(); // 'win32' | 'darwin' | 'linux'
const ARCH = os.arch();         // 'x64' | 'arm64'
const isWin = PLATFORM === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

const args = process.argv.slice(2);
const isWebOnly = args.includes('--web-only') || args.includes('-w');
const skipTypeCheck = args.includes('--skip-typecheck');
const isHelp = args.includes('--help') || args.includes('-h');

if (isHelp) {
  console.log(`
${BOLD}${CYAN}Stage0 - Multi-Platform Production Builder${RESET}

${BOLD}Usage:${RESET}
  node scripts/build.mjs [options]
  npm run build:prod   ${DIM}(Builds optimized production desktop installer)${RESET}
  npm run build:web    ${DIM}(Builds frontend web dist only)${RESET}

${BOLD}Options:${RESET}
  -w, --web-only       Build web production assets only (skips native desktop installer)
  --skip-typecheck     Skip TypeScript verification step
  -h, --help           Show this help message

${BOLD}Output Artifacts:${RESET}
  • Windows: .exe (NSIS Installer) & .msi in backend/target/release/bundle/
  • macOS  : .dmg & .app in backend/target/release/bundle/
  • Linux  : .AppImage & .deb in backend/target/release/bundle/
`);
  process.exit(0);
}

const releaseInfo = syncAllMetadata({ arch: ARCH });

console.log(`\n${CYAN}======================================================${RESET}`);
console.log(`${BOLD}${MAGENTA}  ✦ Stage0 Virtual MR Sandbox - Production Build${RESET}`);
console.log(`${CYAN}======================================================${RESET}`);
console.log(`${DIM}App Name    :${RESET} ${BOLD}${releaseInfo.name}${RESET}`);
console.log(`${DIM}Author      :${RESET} ${BOLD}${releaseInfo.author}${RESET}`);
console.log(`${DIM}Version     :${RESET} ${BOLD}${CYAN}${releaseInfo.version}${RESET}`);
console.log(`${DIM}Release Date:${RESET} ${BOLD}${YELLOW}${releaseInfo.releaseDate}${RESET}`);
console.log(`${DIM}Copyright   :${RESET} ${DIM}${releaseInfo.copyright}${RESET}`);
console.log(`${DIM}Target OS   :${RESET} ${BOLD}${PLATFORM}${RESET} (${ARCH})`);
console.log(`${DIM}Node Version:${RESET} ${process.version}`);
console.log(`${DIM}Build Mode  :${RESET} ${isWebOnly ? `${GREEN}Web Static Distribution${RESET}` : `${CYAN}Full Desktop Native Release${RESET}`}`);
console.log(`${CYAN}------------------------------------------------------${RESET}\n`);

// Helper to format file size
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Compute SHA-256 Checksum
function computeSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const fileDescriptor = fs.openSync(filePath, 'r');
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(fileDescriptor, chunk, 0, chunk.length, null);
      if (bytesRead > 0) hash.update(chunk.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fileDescriptor);
  }
  return hash.digest('hex');
}

// Recursive file scanner for bundle directory
function findBundleFiles(dir, extensions = ['.exe', '.msi', '.dmg', '.app', '.AppImage', '.deb']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.endsWith('.app')) {
        results.push(fullPath);
      } else {
        results = results.concat(findBundleFiles(fullPath, extensions));
      }
    } else {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext) || entry.name.endsWith('.AppImage')) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// Step 1: Type Checking
if (!skipTypeCheck) {
  console.log(`${BOLD}[1/4] Running TypeScript strict type checking...${RESET}`);
  const tscResult = spawnSync(npxCmd, ['tsc', '--noEmit'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    shell: isWin,
  });

  if (tscResult.status !== 0) {
    console.error(`\n${RED}❌ TypeScript check failed. Please resolve type errors before building production.${RESET}`);
    process.exit(1);
  }
  console.log(`${GREEN}✓ TypeScript verification passed cleanly.${RESET}\n`);
} else {
  console.log(`${DIM}[1/4] Skipped TypeScript verification (--skip-typecheck)${RESET}\n`);
}

// Step 2: Clean old distribution files
console.log(`${BOLD}[2/4] Cleaning previous build artifacts...${RESET}`);
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
console.log(`${GREEN}✓ Cleaned ${DIST_DIR}${RESET}\n`);

// Step 3: Frontend Production Bundle
console.log(`${BOLD}[3/4] Building optimized frontend bundle with Vite...${RESET}`);
const viteResult = spawnSync(npxCmd, ['vite', 'build'], {
  cwd: ROOT_DIR,
  stdio: 'inherit',
  shell: isWin,
});

if (viteResult.status !== 0) {
  console.error(`\n${RED}❌ Vite build failed.${RESET}`);
  process.exit(1);
}
console.log(`${GREEN}✓ Frontend bundle compiled successfully to dist/${RESET}\n`);

if (isWebOnly) {
  console.log(`${BOLD}${GREEN}🎉 Web production build completed successfully!${RESET}`);
  console.log(`   Output directory: ${CYAN}${DIST_DIR}${RESET}\n`);
  process.exit(0);
}

// Step 4: Tauri Native Release Compilation & Packaging
console.log(`${BOLD}[4/4] Building optimized native desktop binary & installers...${RESET}`);
console.log(`${DIM}   Compiler Profile: LTO=true, Opt-Level=3, Strip=true, Panic=abort${RESET}\n`);

const tauriBuildResult = spawnSync(npxCmd, ['tauri', 'build'], {
  cwd: ROOT_DIR,
  stdio: 'inherit',
  shell: isWin,
});

if (tauriBuildResult.status !== 0) {
  console.error(`\n${RED}❌ Tauri build failed.${RESET}`);
  process.exit(1);
}

// Step 5: Summary Report & Checksums
console.log(`\n${CYAN}======================================================${RESET}`);
console.log(`${BOLD}${GREEN}  ✓ Production Build Succeeded!${RESET}`);
console.log(`${CYAN}======================================================${RESET}`);

const BUNDLE_DIR = path.resolve(BACKEND_DIR, 'target', 'release', 'bundle');
const generatedInstallers = findBundleFiles(BUNDLE_DIR);

if (generatedInstallers.length > 0) {
  console.log(`\n${BOLD}Generated Packages & Checksums:${RESET}\n`);
  console.log(`${DIM}--------------------------------------------------------------------------------${RESET}`);
  console.log(`${BOLD}${'Package File'.padEnd(35)} ${'Size'.padStart(10)}   ${'SHA-256 Checksum'.padEnd(64)}${RESET}`);
  console.log(`${DIM}--------------------------------------------------------------------------------${RESET}`);

  for (const item of generatedInstallers) {
    const fileName = path.basename(item);
    const stats = fs.statSync(item);
    let sizeStr = '';
    let hashStr = '';

    if (stats.isDirectory()) {
      sizeStr = '[Directory]';
      hashStr = 'N/A (App Bundle)';
    } else {
      sizeStr = formatBytes(stats.size);
      hashStr = computeSha256(item);
    }

    console.log(`${fileName.padEnd(35)} ${sizeStr.padStart(10)}   ${hashStr}`);
    console.log(`  ${DIM}Path: ${item}${RESET}`);
  }

  console.log(`${DIM}--------------------------------------------------------------------------------${RESET}`);
} else {
  console.log(`\nBinary created at: ${CYAN}${path.resolve(BACKEND_DIR, 'target', 'release')}${RESET}`);
}

console.log(`\n${GREEN}✦ Ready for deployment & distribution.${RESET}\n`);
