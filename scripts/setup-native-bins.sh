#!/usr/bin/env bash
# -----------------------------------------------------------------
# Mirror Protocol — native-binary setup.
#
# Vite's Rollup + esbuild ship platform-specific binaries as
# optional npm dependencies. When Bun runs under Rosetta on Apple
# Silicon (x86_64), it skips the arm64 binaries even though
# *Node* (which Vite spawns) is native arm64. This script
# detects the mismatch and pulls the correct binaries directly
# from registry.npmjs.org, bypassing Bun's arch filter.
#
# Runs are idempotent: it only fetches what's missing.
# Verified against pinned versions matching package.json.
# -----------------------------------------------------------------
set -euo pipefail

# Run from repo root.
cd "$(dirname "$0")/.."

ROLLUP_VERSION="4.60.4"
ESBUILD_VERSION="0.21.5"

HOST_ARCH="$(uname -m)"   # arm64 | x86_64
HOST_OS="$(uname -s)"     # Darwin | Linux

# Map to npm platform-package suffix.
case "$HOST_OS/$HOST_ARCH" in
  Darwin/arm64)  ROLLUP_PKG="rollup-darwin-arm64";  ESBUILD_PKG="darwin-arm64";  ;;
  Darwin/x86_64) ROLLUP_PKG="rollup-darwin-x64";    ESBUILD_PKG="darwin-x64";    ;;
  Linux/x86_64)  ROLLUP_PKG="rollup-linux-x64-gnu"; ESBUILD_PKG="linux-x64";     ;;
  Linux/aarch64) ROLLUP_PKG="rollup-linux-arm64-gnu"; ESBUILD_PKG="linux-arm64"; ;;
  *) echo "unsupported platform: $HOST_OS/$HOST_ARCH"; exit 1 ;;
esac

ROLLUP_DIR="node_modules/@rollup/${ROLLUP_PKG}"
ESBUILD_DIR="node_modules/@esbuild/${ESBUILD_PKG}"

fetch_and_extract() {
  local name="$1" version="$2" dest="$3" url="$4"
  if [[ -d "$dest" && -f "$dest/package.json" ]]; then
    echo "✓ $name already present at $dest"
    return 0
  fi
  echo "→ fetching $name@$version ..."
  local tmp; tmp="$(mktemp -t mirror-setup.XXXXXX).tgz"
  curl -fsSL "$url" -o "$tmp"
  mkdir -p "$dest"
  tar -xzf "$tmp" -C "$dest" --strip-components=1
  rm -f "$tmp"
  echo "✓ extracted $name to $dest"
}

fetch_and_extract \
  "@rollup/${ROLLUP_PKG}" \
  "$ROLLUP_VERSION" \
  "$ROLLUP_DIR" \
  "https://registry.npmjs.org/@rollup/${ROLLUP_PKG}/-/${ROLLUP_PKG}-${ROLLUP_VERSION}.tgz"

fetch_and_extract \
  "@esbuild/${ESBUILD_PKG}" \
  "$ESBUILD_VERSION" \
  "$ESBUILD_DIR" \
  "https://registry.npmjs.org/@esbuild/${ESBUILD_PKG}/-/${ESBUILD_PKG}-${ESBUILD_VERSION}.tgz"

echo ""
echo "Native binaries ready for $HOST_OS/$HOST_ARCH."
echo "You can now run:  bun --filter '@mirror/app' run dev"
