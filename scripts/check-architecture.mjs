import { checkSourceOwnership } from './check-source-ownership.mjs';
import { checkBackendSize } from './check-backend-size.mjs';

const ownership = checkSourceOwnership();
const size = checkBackendSize();
for (const { file, owners } of ownership.violations) {
  console.error(`${file}: multiple source owners: ${owners.join(', ')}`);
}
for (const { file, lines } of size.violations) {
  console.error(`${file}: ${lines}/${size.maxLines} lines; extract a cohesive module.`);
}
if (ownership.violations.length || size.violations.length) process.exitCode = 1;
else console.log(`Architecture OK: ${ownership.frontendFiles} FE files, ${size.files} Rust files; largest Rust file ${size.largest}/${size.maxLines} lines.`);
