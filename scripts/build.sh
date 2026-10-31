#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

if [[ -f .nvmrc ]] && command -v nvm >/dev/null 2>&1; then
  nvm use >/dev/null 2>&1 || true
fi

exec node "$SCRIPT_DIR/build.mjs" "$@"
