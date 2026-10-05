#!/usr/bin/env node

// Enforce pnpm package manager
const userAgent = process.env.npm_config_user_agent || '';

if (!userAgent.startsWith('pnpm')) {
  console.error('\n\x1b[31m%s\x1b[0m', '═══════════════════════════════════════════════════════════════════════════');
  console.error('\x1b[1m\x1b[31m%s\x1b[0m', ' [ERROR] Stage0 enforces pnpm as the required package manager.');
  console.error('\x1b[33m%s\x1b[0m', ' Please use "pnpm install" instead of npm or yarn.');
  console.error('\x1b[36m%s\x1b[0m', ' If pnpm is not installed, install it via:');
  console.error('\x1b[36m%s\x1b[0m', '   corepack enable  (or: npm install -g pnpm)');
  console.error('\x1b[31m%s\x1b[0m\n', '═══════════════════════════════════════════════════════════════════════════');
  process.exit(1);
}
