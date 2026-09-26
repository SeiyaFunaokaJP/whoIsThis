#!/usr/bin/env sh
# Build WhoIsThis for this OS (macOS / Linux). Output goes to ./dist
# Extra arguments are passed to `tauri build` (e.g. ./build.sh --debug).
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js was not found. Install it from https://nodejs.org/" >&2; exit 1
fi
if ! command -v cargo >/dev/null 2>&1; then
  echo "[ERROR] Rust was not found. Install it from https://rustup.rs/" >&2
  echo "        Also see the OS prerequisites: https://v2.tauri.app/start/prerequisites/" >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing npm packages..."
  npm ci
fi

npm run build -- "$@"
echo
echo "Build finished. The files are in: $(pwd)/dist"
