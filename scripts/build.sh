#!/usr/bin/env bash

# ==============================================================================
# Stage0 - Optimized Production Builder for macOS & Linux
# Generates:
#   macOS : .dmg, .app
#   Linux : .AppImage, .deb
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

echo -e "\n${CYAN}======================================================${RESET}"
echo -e "${BOLD}${CYAN}  ✦ Stage0 Virtual MR Sandbox - Production Build (macOS/Linux)${RESET}"
echo -e "${CYAN}======================================================${RESET}"
echo -e "${DIM}Platform:${RESET} ${BOLD}${OS_NAME}${RESET} (${ARCH_NAME})"
echo -e "${CYAN}------------------------------------------------------${RESET}\n"

# 0. Synchronize software about metadata
echo -e "${BOLD}[0/4] Synchronizing software about and release metadata...${RESET}"
node scripts/generate-about-info.mjs
echo -e ""

# 1. Strict TypeScript verification
echo -e "${BOLD}[1/4] Running TypeScript verification (tsc --noEmit)...${RESET}"
npx tsc --noEmit
echo -e "${GREEN}✓ TypeScript verification passed.${RESET}\n"

# 2. Clean previous artifacts
echo -e "${BOLD}[2/4] Cleaning previous build artifacts...${RESET}"
rm -rf dist
echo -e "${GREEN}✓ Cleaned dist/ directory.${RESET}\n"

# 3. Build optimized frontend with Vite
echo -e "${BOLD}[3/4] Compiling frontend bundle with Vite...${RESET}"
npx vite build
echo -e "${GREEN}✓ Frontend production bundle created.${RESET}\n"

# Check if web-only flag was passed
if [ "$1" == "--web-only" ] || [ "$1" == "-w" ]; then
  echo -e "${BOLD}${GREEN}🎉 Web production build finished at dist/${RESET}\n"
  exit 0
fi

# 4. Build native desktop installer with Tauri
echo -e "${BOLD}[4/4] Building optimized native desktop application with Tauri v2...${RESET}"
echo -e "${DIM}   Optimizations: LTO=true, Opt-level=3, Codegen-units=1, Strip=true${RESET}\n"

if [ -z "$RUSTFLAGS" ]; then
  export RUSTFLAGS=""
fi
npx tauri build

# 5. Summary and Checksums
echo -e "\n${CYAN}======================================================${RESET}"
echo -e "${BOLD}${GREEN}  ✓ Production Build Succeeded!${RESET}"
echo -e "${CYAN}======================================================${RESET}"

BUNDLE_DIR="backend/target/release/bundle"

if [ -d "$BUNDLE_DIR" ]; then
  echo -e "\n${BOLD}Generated Packages:${RESET}"
  find "$BUNDLE_DIR" -type f \( -name "*.dmg" -o -name "*.AppImage" -o -name "*.deb" \) 2>/dev/null | while read -r file; do
    FNAME=$(basename "$file")
    FSIZE=$(du -h "$file" | cut -f1)
    if command -v shasum >/dev/null 2>&1; then
      FHASH=$(shasum -a 256 "$file" | cut -d' ' -f1)
    else
      FHASH=$(sha256sum "$file" | cut -d' ' -f1)
    fi
    echo -e "  • ${BOLD}${FNAME}${RESET} (${FSIZE}) - SHA256: ${FHASH}..."
    echo -e "    ${DIM}Path: ${file}${RESET}"
  done
fi

echo -e "\n${GREEN}✦ Ready for release distribution.${RESET}\n"
