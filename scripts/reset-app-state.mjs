import { execFileSync } from 'node:child_process';
import { lstat, mkdir, realpath, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const APP_ID = 'com.stage0.app';
const args = new Set(process.argv.slice(2).filter((arg) => arg !== '--'));
const allowedArgs = new Set(['--yes', '--dry-run', '--help']);
const unknownArgs = [...args].filter((arg) => !allowedArgs.has(arg));

if (unknownArgs.length) {
  throw new Error(`Unknown argument: ${unknownArgs.join(', ')}`);
}

if (args.has('--help')) {
  process.stdout.write(
    'Reset Stage0 local app state to first-launch defaults.\n\n' +
      'Usage: pnpm reset:app-state [--dry-run | --yes]\n\n' +
      'By default this prints the reset plan. Pass --yes to move the app data,\n' +
      'WebView storage, and native window preferences into a dated backup.\n' +
      'OS keychain credentials and external shell/system integrations are kept.\n',
  );
  process.exit(0);
}

if (args.has('--yes') && args.has('--dry-run')) {
  throw new Error('Choose either --yes or --dry-run.');
}

const home = await realpath(homedir());
const directories = getDirectories(home);
const targets = deduplicateTargets(directories.targets);

for (const target of targets) assertSafeTarget(target, home);

const existingTargets = [];
for (const target of targets) {
  try {
    const metadata = await lstat(target.path);
    if (metadata.isSymbolicLink()) {
      throw new Error(`Refusing to move symbolic link: ${target.path}`);
    }
    existingTargets.push(target);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

if (existingTargets.length === 0) {
  process.stdout.write('No Stage0 app state was found.\n');
  process.exit(0);
}

const backupRoot = directories.backupRoot;
assertSafeTarget({ path: backupRoot, parent: directories.backupParent, name: path.basename(backupRoot) }, home);
await assertNotSymlinkIfPresent(backupRoot);

const backupDirectory = path.join(backupRoot, createBackupName());
process.stdout.write('Stage0 reset plan:\n');
for (const target of existingTargets) {
  process.stdout.write(`  ${target.label}: ${target.path}\n`);
}
process.stdout.write(`Backup: ${backupDirectory}\n`);
process.stdout.write('\nThis resets SQLite data, preferences, WebView storage, and window state.\n');
process.stdout.write('OS keychain credentials and external shell/system integrations are kept.\n');

if (!args.has('--yes')) {
  process.stdout.write('\nDry run only. Re-run with --yes to perform the reset.\n');
  process.exit(0);
}

assertAppIsClosed();
await mkdir(backupRoot, { recursive: true });
await mkdir(backupDirectory, { recursive: false });

const moved = [];
try {
  for (const target of existingTargets) {
    const destination = path.join(backupDirectory, target.backupName);
    await rename(target.path, destination);
    moved.push({ source: target.path, destination });
  }
} catch (error) {
  const rollbackErrors = [];
  for (const item of moved.reverse()) {
    try {
      await rename(item.destination, item.source);
    } catch (rollbackError) {
      rollbackErrors.push(`${item.destination} -> ${item.source}: ${rollbackError.message}`);
    }
  }
  const rollbackSummary = rollbackErrors.length
    ? ` Rollback was incomplete: ${rollbackErrors.join('; ')}`
    : ' All moved data was restored.';
  throw new Error(`Reset failed: ${error.message}.${rollbackSummary}`, { cause: error });
}

process.stdout.write('\nReset complete. Stage0 will create fresh local state on its next launch.\n');
process.stdout.write(`Previous state is backed up at: ${backupDirectory}\n`);

function getDirectories(userHome) {
  if (process.platform === 'darwin') {
    const applicationSupport = path.join(userHome, 'Library', 'Application Support');
    return {
      backupParent: applicationSupport,
      backupRoot: path.join(applicationSupport, 'Stage0 Reset Backups'),
      targets: [
        {
          path: path.join(applicationSupport, APP_ID),
          parent: applicationSupport,
          name: APP_ID,
          backupName: 'application-data',
          label: 'Application data (database, preferences, local files)',
        },
        {
          path: path.join(userHome, 'Library', 'WebKit', APP_ID),
          parent: path.join(userHome, 'Library', 'WebKit'),
          name: APP_ID,
          backupName: 'webkit-storage',
          label: 'WebKit storage (localStorage and IndexedDB)',
        },
        {
          path: path.join(userHome, 'Library', 'Preferences', 'stage0.plist'),
          parent: path.join(userHome, 'Library', 'Preferences'),
          name: 'stage0.plist',
          backupName: 'macOS-preferences.plist',
          label: 'macOS window and app preferences',
        },
      ],
    };
  }

  if (process.platform === 'win32') {
    const roaming = requireAbsoluteEnv('APPDATA');
    const local = requireAbsoluteEnv('LOCALAPPDATA');
    return {
      backupParent: roaming,
      backupRoot: path.join(roaming, 'Stage0 Reset Backups'),
      targets: [
        {
          path: path.join(roaming, APP_ID),
          parent: roaming,
          name: APP_ID,
          backupName: 'application-data',
          label: 'Application data (database and preferences)',
        },
        {
          path: path.join(local, APP_ID),
          parent: local,
          name: APP_ID,
          backupName: 'webview-storage',
          label: 'WebView2 storage',
        },
      ],
    };
  }

  if (process.platform === 'linux') {
    const dataRoot = xdgDirectory('XDG_DATA_HOME', path.join(userHome, '.local', 'share'));
    const configRoot = xdgDirectory('XDG_CONFIG_HOME', path.join(userHome, '.config'));
    return {
      backupParent: dataRoot,
      backupRoot: path.join(dataRoot, 'Stage0 Reset Backups'),
      targets: [
        {
          path: path.join(dataRoot, APP_ID),
          parent: dataRoot,
          name: APP_ID,
          backupName: 'application-data-and-webview-storage',
          label: 'Application data and WebKit storage',
        },
        {
          path: path.join(configRoot, APP_ID),
          parent: configRoot,
          name: APP_ID,
          backupName: 'application-config',
          label: 'Application config',
        },
      ],
    };
  }

  throw new Error(`Unsupported operating system: ${process.platform}`);
}

function requireAbsoluteEnv(name) {
  const value = process.env[name];
  if (!value || !path.isAbsolute(value)) {
    throw new Error(`${name} must point to an absolute directory.`);
  }
  return path.resolve(value);
}

function xdgDirectory(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  if (!path.isAbsolute(value)) {
    throw new Error(`${name} must point to an absolute directory.`);
  }
  return path.resolve(value);
}

function deduplicateTargets(values) {
  const seen = new Set();
  return values.filter((target) => {
    const key = path.resolve(target.path);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function assertSafeTarget(target, userHome) {
  const resolvedPath = path.resolve(target.path);
  const resolvedParent = path.resolve(target.parent);
  if (path.dirname(resolvedPath) !== resolvedParent || path.basename(resolvedPath) !== target.name) {
    throw new Error(`Refusing unexpected reset path: ${target.path}`);
  }
  const relative = path.relative(userHome, resolvedPath);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Refusing reset path outside the user profile: ${target.path}`);
  }
}

async function assertNotSymlinkIfPresent(targetPath) {
  try {
    const metadata = await lstat(targetPath);
    if (metadata.isSymbolicLink()) {
      throw new Error(`Refusing to use symbolic-link backup directory: ${targetPath}`);
    }
    if (!metadata.isDirectory()) {
      throw new Error(`Backup path exists but is not a directory: ${targetPath}`);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function createBackupName() {
  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  return `reset-${timestamp}`;
}

function assertAppIsClosed() {
  let processList;
  if (process.platform === 'win32') {
    processList = execFileSync('tasklist', ['/FI', 'IMAGENAME eq stage0.exe', '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (processList.toLowerCase().includes('"stage0.exe"')) {
      throw new Error('Close Stage0 before resetting its local state.');
    }
    return;
  }

  processList = execFileSync('ps', ['-axo', 'comm='], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const isRunning = processList.split(/\r?\n/).some((command) => {
    const name = path.basename(command.trim()).toLowerCase().replace(/\.exe$/, '');
    return name === 'stage0';
  });
  if (isRunning) throw new Error('Close Stage0 before resetting its local state.');
}
