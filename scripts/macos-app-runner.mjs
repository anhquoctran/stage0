#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cargoPid = process.ppid;
const executable = process.argv[2];
if (!executable) {
  console.error('Cargo did not provide the Stage0 executable path to the macOS app runner.');
  process.exit(2);
}

const executablePath = path.resolve(executable);
if (!fs.existsSync(executablePath) || !fs.statSync(executablePath).isFile()) {
  console.error(`The macOS app runner expected a compiled executable, received: ${executable}`);
  process.exit(2);
}

const configPath = fileURLToPath(new URL('../backend/tauri.conf.json', import.meta.url));
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const bundlePath = path.join(path.dirname(executablePath), 'Stage0-dev.app');
const contentsPath = path.join(bundlePath, 'Contents');
const executableDirectory = path.join(contentsPath, 'MacOS');
const resourcesDirectory = path.join(contentsPath, 'Resources');
const bundleExecutable = path.join(executableDirectory, path.basename(executablePath));
const appIcon = path.join(resourcesDirectory, 'AppIcon.icns');

function escapePlistValue(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function writeBundleInfo() {
  const iconSource = fileURLToPath(new URL('../backend/icons/icon.icns', import.meta.url));
  fs.mkdirSync(executableDirectory, { recursive: true });
  fs.mkdirSync(resourcesDirectory, { recursive: true });

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleExecutable</key><string>${escapePlistValue(path.basename(executablePath))}</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundleIdentifier</key><string>${escapePlistValue(config.identifier)}</string>
  <key>CFBundleName</key><string>${escapePlistValue(config.productName)}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${escapePlistValue(config.version)}</string>
  <key>CFBundleVersion</key><string>${escapePlistValue(config.version)}</string>
</dict>
</plist>
`;

  fs.writeFileSync(path.join(contentsPath, 'Info.plist'), plist);
  fs.copyFileSync(iconSource, appIcon);

  // Signing modifies the executable. Remove any old hard link before copying
  // so codesign cannot change Cargo's original binary. APFS clones keep this
  // independent copy inexpensive; other filesystems fall back to a normal copy.
  try {
    fs.unlinkSync(bundleExecutable);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  fs.copyFileSync(executablePath, bundleExecutable, fs.constants.COPYFILE_FICLONE);
  fs.chmodSync(bundleExecutable, 0o755);

  // The linker's ad-hoc signature has a different identifier and does not bind
  // Info.plist/resources. UserNotifications rejects that signing identity.
  // Sign the completed local dev bundle with the same ID as CFBundleIdentifier.
  for (const args of [
    ['--force', '--sign', '-', '--identifier', config.identifier, '--timestamp=none', bundlePath],
    ['--verify', '--strict', bundlePath],
  ]) {
    const result = spawnSync('/usr/bin/codesign', args, { encoding: 'utf8', timeout: 30_000 });
    if (result.error || result.status !== 0) {
      console.error(`Could not sign or verify the Stage0 dev app: ${result.error?.message || result.stderr.trim()}`);
      process.exit(1);
    }
  }
}

writeBundleInfo();
if (process.ppid !== cargoPid) process.exit(143);

// Executing from Contents/MacOS gives NSBundle the real .app identity while
// retaining Cargo's console output, environment, and child-process lifecycle.
const app = spawn(bundleExecutable, process.argv.slice(3), {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

// Tauri reload kills Cargo directly, which cannot forward that signal. Close
// this runner's app when it is reparented; otherwise single-instance keeps the
// old app alive and rejects every rebuilt replacement.
const parentMonitor = setInterval(() => {
  if (process.ppid !== cargoPid) app.kill('SIGTERM');
}, 100);
parentMonitor.unref();

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, () => app.kill(signal));
}

app.once('error', (error) => {
  clearInterval(parentMonitor);
  console.error(`Could not launch Stage0 from its development app bundle: ${error.message}`);
  process.exitCode = 1;
});

app.once('exit', (code, signal) => {
  clearInterval(parentMonitor);
  if (signal) {
    const signalNumber = os.constants.signals[signal] ?? 1;
    process.exitCode = 128 + signalNumber;
  } else {
    process.exitCode = code ?? 1;
  }
});
