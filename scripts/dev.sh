#!/usr/bin/env bash

# ==============================================================================
# Stage0 - Development Hot Reload Runner for macOS & Linux
# Supports:
#   macOS (Intel & Apple Silicon)
#   Linux (Ubuntu, Debian, Fedora, Arch, Alpine)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# ANSI Colors
BOLD="\033[1m"
RESET="\033[0m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
DIM="\033[2m"

OS_NAME="$(uname -s)"
ARCH_NAME="$(uname -m)"

MODE="app"
if [ "$1" == "--web" ] || [ "$1" == "-w" ]; then
  MODE="web"
fi

echo -e "\n${CYAN}======================================================${RESET}"
echo -e "${BOLD}${CYAN}  ✦ Stage0 Virtual MR Sandbox - Dev Runner (macOS/Linux)${RESET}"
echo -e "${CYAN}======================================================${RESET}"
echo -e "${DIM}Platform:${RESET} ${BOLD}${OS_NAME}${RESET} (${ARCH_NAME})"
echo -e "${DIM}Mode    :${RESET} ${BOLD}${MODE}${RESET}"
echo -e "${CYAN}------------------------------------------------------${RESET}\n"

# 1. Check Node.js and nvm
if [ -f ".nvmrc" ] && command -v nvm >/dev/null 2>&1; then
  echo -e "${CYAN}✦ Reading .nvmrc and switching Node version...${RESET}"
  nvm use >/dev/null 2>&1 || true
fi

if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}❌ Error: Node.js is not installed.${RESET}"
  echo "Please install Node.js >= 20 from https://nodejs.org or via nvm ('nvm install 24.18.0')."
  exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js detected:${RESET} ${NODE_VERSION}"

# Check pnpm
if ! command -v pnpm >/dev/null 2>&1; then
  echo -e "${RED}❌ Error: pnpm is required but not installed.${RESET}"
  echo "Stage0 enforces pnpm. Install via: corepack enable  OR  npm install -g pnpm"
  exit 1
fi
PNPM_VERSION=$(pnpm -v)
echo -e "${GREEN}✓ pnpm detected:${RESET} v${PNPM_VERSION}"

# 2. Check Rust/Cargo if running desktop app
if [ "$MODE" == "app" ]; then
  if ! command -v cargo >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Warning: Rust/Cargo is not installed or not in PATH.${RESET}"
    echo -e "   Install Rust with: ${CYAN}curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh${RESET}"
    echo -e "   Falling back to web browser mode (${BOLD}--web${RESET})...\n"
    MODE="web"
  else
    RUST_VERSION=$(rustc --version)
    echo -e "${GREEN}✓ Rust detected:${RESET} ${RUST_VERSION}"
  fi

  # Linux specific dependencies check
  if [ "$OS_NAME" == "Linux" ] && [ "$MODE" == "app" ]; then
    if ! command -v pkg-config >/dev/null 2>&1; then
      echo -e "${YELLOW}⚠️  Note: pkg-config is missing on Linux.${RESET}"
      echo -e "   Run: ${CYAN}sudo apt install -y build-essential pkg-config libwebkit2gtk-4.1-dev libssl-dev libsecret-1-dev${RESET}"
    fi
  fi
fi

# 3. Refresh pnpm dependencies on every dev launch. This also picks up lockfile
# changes after switching branches, even when node_modules already exists.
echo -e "\n${YELLOW}📦 Refreshing dependencies with pnpm...${RESET}"
pnpm install

# 4. Launch with Hot Reload
if [ "$MODE" == "app" ]; then
  echo -e "\n${GREEN}🚀 Starting Tauri Native Desktop App with Hot Reload...${RESET}"
  echo -e "${DIM}   Frontend: http://127.0.0.1:1420${RESET}"
  echo -e "${DIM}   Backend : Watching backend/src/ for Rust recompiles${RESET}\n"
  if [ "$OS_NAME" = "Darwin" ]; then
    pnpm tauri dev --runner "$SCRIPT_DIR/macos-cargo-runner.sh"
  else
    pnpm tauri dev
  fi
else
  echo -e "\n${GREEN}🌐 Starting Vite Web Server with Hot Reload...${RESET}"
  echo -e "${DIM}   URL: http://127.0.0.1:1420/?mock${RESET}\n"
  npx vite --host 127.0.0.1 --port 1420
fi
