import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Mock one external command inside an isolated Node child, on every host.
 * No shell shim, network access, native compiler or production override needed.
 * Other subprocesses (including real Git fixtures) retain their normal behavior.
 */
export function commandFixture(directory, command, handler) {
  const preload = path.join(directory, `mock-${command}.mjs`);
  fs.writeFileSync(preload, `import childProcess from 'node:child_process';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const original = childProcess.execFileSync;
childProcess.execFileSync = (command, args, options = {}) => {
  if (command !== ${JSON.stringify(command)}) return original(command, args, options);
  const output = (${handler.toString()})(args, options);
  return options.encoding ? output : Buffer.from(output);
};
syncBuiltinESMExports();
`);
  return ['--import', pathToFileURL(preload).href];
}
