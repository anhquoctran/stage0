import { checkSourceOwnership } from './check-source-ownership.mjs';
import { checkBackendSize } from './check-backend-size.mjs';
import { checkFrontendSize } from './check-frontend-size.mjs';

const ownership = checkSourceOwnership();
const size = checkBackendSize();
const frontendSize = checkFrontendSize();
for (const { file, owners } of ownership.violations) {
  console.error(`${file}: multiple source owners: ${owners.join(', ')}`);
}
for (const { file, lines } of size.violations) {
  console.error(`${file}: ${lines}/${size.maxLines} lines; extract a cohesive module.`);
}
for (const { file, lines } of frontendSize.violations) {
  console.error(`${file}: ${lines}/${frontendSize.maxLines} lines; extract a cohesive module.`);
}
if (ownership.violations.length || size.violations.length || frontendSize.violations.length) process.exitCode = 1;
else console.log(`Architecture OK: ${ownership.frontendFiles} FE files (largest ${frontendSize.largest}/${frontendSize.maxLines}), ${size.files} Rust files (largest ${size.largest}/${size.maxLines}).`);
