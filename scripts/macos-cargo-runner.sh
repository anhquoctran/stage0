#!/bin/sh
set -eu

# Tauri kills this process on Rust reload. Replace the shell with Cargo so the
# executable runner can detect Cargo's exit and close its own app process.
runner_dir="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
runner_command="$(node -e 'process.stdout.write(JSON.stringify([process.execPath, process.argv[1]]))' "$runner_dir/macos-app-runner.mjs")"

exec cargo \
  --config "target.aarch64-apple-darwin.runner = $runner_command" \
  --config "target.x86_64-apple-darwin.runner = $runner_command" \
  "$@"
