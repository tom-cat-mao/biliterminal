#!/usr/bin/env bash
set -euo pipefail

APP_RESOURCES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_DIR="${APP_RESOURCES_DIR}/app"
DIST_DIR="${PAYLOAD_DIR}/dist"
RUNTIME_DIR="${APP_RESOURCES_DIR}/runtime"
LOG_HOME="${BILITERMINAL_HOME:-${HOME}/.biliterminal}"
LOG_FILE="${BILITERMINAL_LOG_FILE:-${LOG_HOME}/launcher.log}"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
export BILITERMINAL_HOME="${LOG_HOME}"

mkdir -p "${LOG_HOME}" "$(dirname "${LOG_FILE}")"
printf '[%s] launch.command invoked\n' "$(date '+%Y-%m-%d %H:%M:%S')" >> "${LOG_FILE}"

NODE_BIN=""
for candidate in \
  "${BILITERMINAL_NODE:-}" \
  "${RUNTIME_DIR}/bin/node" \
  "${RUNTIME_DIR}/node" \
  node \
  /opt/homebrew/bin/node \
  /usr/local/bin/node
do
  if [ -n "${candidate}" ] && command -v "${candidate}" >/dev/null 2>&1; then
    NODE_BIN="$(command -v "${candidate}")"
    break
  fi
  if [ -x "${candidate}" ]; then
    NODE_BIN="${candidate}"
    break
  fi
done

if [ -z "${NODE_BIN}" ]; then
  printf '[%s] node not found\n' "$(date '+%Y-%m-%d %H:%M:%S')" >> "${LOG_FILE}"
  /usr/bin/osascript -e 'display dialog "未找到 Node.js，请先安装 Node 20+ 后再运行 BiliTerminal。" buttons {"好"} default button 1 with icon stop'
  exit 1
fi

if [ ! -f "${DIST_DIR}/index.js" ]; then
  printf '[%s] missing dist payload: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${DIST_DIR}/index.js" >> "${LOG_FILE}"
  /usr/bin/osascript -e 'display dialog "应用包内缺少 dist/index.js，请重新构建 BiliTerminal.app。" buttons {"好"} default button 1 with icon stop'
  exit 1
fi

printf '[%s] using node: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${NODE_BIN}" >> "${LOG_FILE}"

cd "${PAYLOAD_DIR}"
clear
printf 'BiliTerminal 正在启动...\n\n'
"${NODE_BIN}" "${DIST_DIR}/index.js" tui
STATUS=$?
printf '[%s] tui exited with status: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${STATUS}" >> "${LOG_FILE}"
exit "${STATUS}"
