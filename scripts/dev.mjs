#!/usr/bin/env node

/**
 * Stage0 - Cross-Platform Hot Reload Development Runner
 * Supports: Windows, macOS, Linux
 * Modes:
 *   --web (-w)  : Rapid frontend development in standard browser (Mock sandbox engine)
 *   --app (-a)  : Full native desktop app with Tauri v2 + Rust backend hot-reload
 */

import { spawn, execSync } from 'child_process';
import os from 'os';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { syncAllMetadata } from './generate-about-info.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Terminal ANSI styling
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

// Parse command line arguments
const args = process.argv.slice(2);
const isWebOnly = args.includes('--web') || args.includes('-w');
const isHelp = args.includes('--help') || args.includes('-h');
const portArgIndex = args.indexOf('--port');
const DESIRED_PORT = portArgIndex !== -1 ? Number(args[portArgIndex + 1]) : 1420;

if (isHelp) {
  console.log(`
${BOLD}${CYAN}Stage0 - Multi-Platform Dev Runner${RESET}

${BOLD}Usage:${RESET}
  node scripts/dev.mjs [options]
  npm run dev          ${DIM}(Runs web mode with hot reload)${RESET}
  npm run dev:app      ${DIM}(Runs desktop native app with hot reload)${RESET}

${BOLD}Options:${RESET}
  -w, --web            Launch Vite frontend in browser (Fast Mock sandbox mode)
  -a, --app            Launch full Tauri desktop window with native Rust backend
  --port <number>      Custom Vite port in web mode only (default: 1420; Tauri uses 1420)
  -h, --help           Show this help message

${BOLD}Supported Platforms:${RESET}
  • macOS (Apple Silicon arm64 & Intel x64)
  • Windows 10/11 (x64 & ARM64)
  • Linux (Ubuntu, Debian, Fedora, Arch)
`);
  process.exit(0);
}

if (!Number.isInteger(DESIRED_PORT) || DESIRED_PORT < 1 || DESIRED_PORT > 65535) {
  console.error(`${RED}Invalid port: expected an integer from 1 to 65535.${RESET}`);
  process.exit(2);
}

// OS Banner & Sync Metadata
const releaseInfo = syncAllMetadata({ arch: ARCH });

console.log(`\n${CYAN}======================================================${RESET}`);
console.log(`${BOLD}${MAGENTA}  ✦ Stage0 Virtual MR Sandbox - Dev Hot Reload${RESET}`);
console.log(`${CYAN}======================================================${RESET}`);
console.log(`${DIM}App Name    :${RESET} ${BOLD}${releaseInfo.name}${RESET}`);
console.log(`${DIM}Author      :${RESET} ${BOLD}${releaseInfo.author}${RESET}`);
console.log(`${DIM}Version     :${RESET} ${BOLD}${CYAN}${releaseInfo.version}${RESET}`);
console.log(`${DIM}Release Date:${RESET} ${BOLD}${YELLOW}${releaseInfo.releaseDate}${RESET}`);
console.log(`${DIM}Copyright   :${RESET} ${DIM}${releaseInfo.copyright}${RESET}`);
console.log(`${DIM}OS Platform :${RESET} ${BOLD}${PLATFORM}${RESET} (${ARCH})`);
console.log(`${DIM}Node Version:${RESET} ${process.version}`);
console.log(`${DIM}Workspace   :${RESET} ${ROOT_DIR}`);
console.log(`${DIM}Target Port :${RESET} ${isWebOnly ? DESIRED_PORT : 1420}${isWebOnly ? '' : ' (Tauri devUrl)'}`);
console.log(`${DIM}Active Mode :${RESET} ${isWebOnly ? `${GREEN}Web Browser (Mock Sandbox)${RESET}` : `${CYAN}Native Desktop App (Tauri 2)${RESET}`}`);
if (!isWebOnly && portArgIndex !== -1 && DESIRED_PORT !== 1420) {
  console.warn(`${YELLOW}⚠️  --port applies only to web mode; Tauri's devUrl remains on port 1420.${RESET}`);
}
console.log(`${CYAN}------------------------------------------------------${RESET}\n`);

// Check if port is in use
function checkPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        reject(err);
      }
    });
    server.once('listening', () => {
      server.close((err) => (err ? reject(err) : resolve(true)));
    });
    server.listen(port, '127.0.0.1');
  });
}

// Check prerequisite tools
function checkTool(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Environmental Diagnostics
async function runDiagnostics() {
  const hasCargo = checkTool('cargo');
  const hasRustc = checkTool('rustc');

  if (!isWebOnly) {
    if (!hasCargo || !hasRustc) {
      console.warn(`${YELLOW}⚠️  Warning: Rust/Cargo is not detected in your PATH.${RESET}`);
      console.warn(`   To run native desktop app, please install Rust from ${CYAN}https://rustup.rs${RESET}`);
      console.warn(`   Falling back to ${BOLD}--web${RESET} browser mode for UI development.\n`);
      return false;
    }

    if (PLATFORM === 'linux') {
      // Check common Linux system libraries for Tauri
      try {
        execSync('pkg-config --version', { stdio: 'ignore' });
      } catch {
        console.warn(`${YELLOW}⚠️  Note for Linux: Ensure build-essential and pkg-config are installed:${RESET}`);
        console.warn(`   sudo apt install -y build-essential pkg-config libwebkit2gtk-4.1-dev libssl-dev libsecret-1-dev\n`);
      }
    }
  }

  const targetPort = isWebOnly || !hasCargo || !hasRustc ? DESIRED_PORT : 1420;
  const portFree = await checkPortAvailable(targetPort);
  if (!portFree) {
    if (!isWebOnly && hasCargo && hasRustc) {
      throw new Error(`Port ${targetPort} is required by Tauri's configured devUrl and is already in use. Stop that process or change backend/tauri.conf.json.`);
    }
    console.warn(`${YELLOW}⚠️  Port ${targetPort} is currently in use.${RESET}`);
    console.warn(`   Vite is configured with strictPort and will not select another port. Choose a free port with --port.\n`);
  }

  return true;
}

// Main execution
async function main() {
  const rustAvailable = await runDiagnostics();
  const launchApp = !isWebOnly && rustAvailable;

  const isWin = PLATFORM === 'win32';
  const npxCmd = isWin ? 'npx.cmd' : 'npx';
  const effectivePort = launchApp ? 1420 : DESIRED_PORT;

  let child;
  if (launchApp) {
    console.log(`${GREEN}🚀 Starting Tauri Native Desktop App with Hot Reload...${RESET}`);
    console.log(`${DIM}   Frontend: Vite HMR at http://127.0.0.1:${effectivePort}${RESET}`);
    console.log(`${DIM}   Backend : Cargo watch for backend/src/*.rs changes${RESET}\n`);

    child = spawn(npxCmd, ['tauri', 'dev'], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' },
      shell: isWin,
      detached: !isWin,
    });
  } else {
    console.log(`${GREEN}🌐 Starting Vite Web Server with Hot Reload...${RESET}`);
    console.log(`${DIM}   URL: http://127.0.0.1:${effectivePort}/?mock${RESET}\n`);

    child = spawn(npxCmd, ['vite', '--host', '127.0.0.1', '--port', String(DESIRED_PORT)], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' },
      shell: isWin,
      detached: !isWin,
    });
  }

  // Graceful shutdown handling
  let shuttingDown = false;
  const handleExit = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${YELLOW}[stage0-dev] Shutting down (${signal})...${RESET}`);
    if (child && !child.killed) {
      if (isWin) {
        try {
          execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
        } catch {}
      } else {
        try {
          process.kill(-child.pid, signal);
        } catch {
          child.kill(signal);
        }
        const forceStopTimer = setTimeout(() => {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {}
        }, 10000);
        forceStopTimer.unref();
      }
    }
  };

  process.on('SIGINT', () => handleExit('SIGINT'));
  process.on('SIGTERM', () => handleExit('SIGTERM'));

  child.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`\n${RED}[stage0-dev] Process exited with code ${code}${RESET}`);
    }
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error(`${RED}Fatal dev error:${RESET}`, err);
  process.exit(1);
});
