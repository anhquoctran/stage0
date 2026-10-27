import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Vendored OpenSSL (pulled in by rusqlite SQLCipher) requires Perl with
 * Locale::Maketext::Simple when compiling openssl-sys on Windows.
 *
 * NOTE: Perl directory must be APPENDED to PATH (not prepended) so that MSYS2
 * POSIX tools (like /usr/bin/gcc, windres) do not shadow native Windows toolchains
 * (e.g. UCRT64, MINGW64, MSVC).
 */
export function ensureWindowsPerlInPath(env = process.env) {
  if (os.platform() !== 'win32') return env;
  try {
    execSync('perl -MLocale::Maketext::Simple -e "exit 0"', { env, stdio: 'ignore' });
    return env;
  } catch {
    // Search common Windows Perl locations that include Locale::Maketext::Simple
  }
  const candidates = [
    'C:\\Strawberry\\perl\\bin',
    'C:\\msys64\\usr\\bin',
    'C:\\msys64\\mingw64\\bin',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'usr', 'bin'),
    'C:\\Program Files\\Git\\usr\\bin',
  ];
  for (const dir of candidates) {
    const perlExe = path.join(dir, 'perl.exe');
    if (fs.existsSync(perlExe)) {
      const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
      const existingPath = env[pathKey] || '';
      const nextEnv = {
        ...env,
        [pathKey]: existingPath ? `${existingPath}${path.delimiter}${dir}` : dir,
      };
      try {
        execSync(`"${perlExe}" -MLocale::Maketext::Simple -e "exit 0"`, {
          env: nextEnv,
          stdio: 'ignore',
        });
        return nextEnv;
      } catch {
        // Continue checking next candidate
      }
    }
  }
  return env;
}
