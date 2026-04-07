#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
APP_NAME="BiliTerminal"
APP_BUNDLE="${DIST_DIR}/${APP_NAME}.app"
CONTENTS_DIR="${APP_BUNDLE}/Contents"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"
PAYLOAD_DIR="${RESOURCES_DIR}/app"
RUNTIME_DIR="${RESOURCES_DIR}/runtime"
ZIP_PATH="${DIST_DIR}/${APP_NAME}-macOS.zip"

build_ts_payload() {
  if command -v pnpm >/dev/null 2>&1; then
    (cd "${ROOT_DIR}" && pnpm run build)
    return
  fi
  if command -v bun >/dev/null 2>&1; then
    (cd "${ROOT_DIR}" && bun run build)
    return
  fi
  if command -v npm >/dev/null 2>&1; then
    (cd "${ROOT_DIR}" && npm run build)
    return
  fi
  printf 'error: 未找到 pnpm / bun / npm，无法构建 TS 产物\n' >&2
  exit 1
}

if ! command -v osacompile >/dev/null 2>&1; then
  printf 'error: osacompile is required to build the macOS app bundle\n' >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  printf 'error: node 20+ is required to build the macOS app bundle\n' >&2
  exit 1
fi

build_ts_payload

if [ ! -f "${DIST_DIR}/index.js" ]; then
  printf 'error: missing dist/index.js after build\n' >&2
  exit 1
fi

rm -rf "${APP_BUNDLE}" "${ZIP_PATH}"
mkdir -p "${DIST_DIR}"

osacompile -o "${APP_BUNDLE}" "${ROOT_DIR}/bili_terminal/macos/BiliTerminal.applescript"

mkdir -p "${PAYLOAD_DIR}/dist" "${RUNTIME_DIR}/bin"
cp "${ROOT_DIR}/bili_terminal/macos/launch.command" "${RESOURCES_DIR}/launch.command"
chmod +x "${RESOURCES_DIR}/launch.command"

cp "${DIST_DIR}/index.js" "${PAYLOAD_DIR}/dist/index.js"
if [ -f "${DIST_DIR}/index.js.map" ]; then
  cp "${DIST_DIR}/index.js.map" "${PAYLOAD_DIR}/dist/index.js.map"
fi

NODE_BIN="$(command -v node || true)"

if [ -n "${NODE_BIN}" ] && [ -x "${NODE_BIN}" ]; then
  cp "${NODE_BIN}" "${RUNTIME_DIR}/bin/node"
  chmod +x "${RUNTIME_DIR}/bin/node"
fi

find "${APP_BUNDLE}" -name "__pycache__" -type d -prune -exec rm -rf {} +
find "${APP_BUNDLE}" -name "*.pyc" -delete

ditto -c -k --sequesterRsrc --keepParent "${APP_BUNDLE}" "${ZIP_PATH}"

printf 'Built %s\n' "${APP_BUNDLE}"
printf 'Packed %s\n' "${ZIP_PATH}"
