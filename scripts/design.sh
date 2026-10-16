#!/usr/bin/env bash
set -euo pipefail

PORT=3101
EXPORT_PORT=3102
LOG=/tmp/faz-openpencil.log

cd "$(dirname "$0")/.."

export FONTCONFIG_FILE="$PWD/design/fonts/fonts.conf"

pid_on() {
  ss -ltnpH "sport = :$1" | grep -oP 'pid=\K[0-9]+' | head -1 || true
}

wait_up() {
  for _ in $(seq 1 50); do
    op --port "$1" status 2>/dev/null | grep -q '"running":true' && return 0
    sleep 0.2
  done
  echo "OpenPencil did not start on port $1 (see $LOG)" >&2
  exit 1
}

start_headless() {
  setsid -f openpencil-desktop --mcp-http "$1" "$2" >>"$LOG" 2>&1 </dev/null
  wait_up "$1"
}

design_file() {
  local file=${1:-design/faz.op}
  if [ ! -f "$file" ]; then
    echo "No such design file: $file" >&2
    exit 1
  fi
  echo "$file"
}

export_file() {
  local file=$1 out=$2 work pages
  work=$(mktemp -d)
  cp "$file" "$work/doc.op"
  start_headless "$EXPORT_PORT" "$work/doc.op"
  pages=$(op --port $EXPORT_PORT page list | grep -oP '"pageCount":\K[0-9]+')
  for theme in light dark; do
    op --port $EXPORT_PORT set_active_axis_value axis=theme value=$theme >/dev/null
    for ((i = 0; i < pages; i++)); do
      op --port $EXPORT_PORT set_active_page index=$i >/dev/null
      op --port $EXPORT_PORT export-frames --output-dir "$out/$theme/page$i" >/dev/null
    done
  done
  kill "$(pid_on $EXPORT_PORT)"
  rm -rf "$work"
  echo "Exported $file: $pages pages (light and dark) to $out"
}

case "${1:-}" in
  start)
    file=$(design_file "${2:-}")
    if [ -n "$(pid_on $PORT)" ]; then
      echo "OpenPencil already running on port $PORT"
      exit 0
    fi
    start_headless "$PORT" "$PWD/$file"
    echo "OpenPencil (headless) on port $PORT editing $file"
    ;;
  gui)
    file=$(design_file "${2:-}")
    if pgrep -f -- '--live-mcp' >/dev/null; then
      echo 'An OpenPencil window is already open; only one can exist per desktop.' >&2
      echo 'Close it first (save its work), or use: bun run design' >&2
      exit 1
    fi
    if [ -n "$(pid_on $PORT)" ]; then
      echo "Port $PORT is busy; run: bun run design:stop" >&2
      exit 1
    fi
    setsid -f openpencil-desktop --live-mcp "$PORT" "$PWD/$file" >>"$LOG" 2>&1 </dev/null
    wait_up "$PORT"
    echo "OpenPencil window on port $PORT editing $file (save before closing)"
    ;;
  stop)
    p=$(pid_on $PORT)
    if [ -z "$p" ]; then
      echo "OpenPencil is not running on port $PORT"
      exit 0
    fi
    kill "$p"
    echo "Stopped OpenPencil on port $PORT"
    ;;
  wrap)
    if [ -z "$(pid_on $PORT)" ]; then
      echo "OpenPencil is not running on port $PORT" >&2
      exit 1
    fi
    python3 design/tools/opwrap.py --port "$PORT" --fonts "$FONTCONFIG_FILE"
    ;;
  export)
    out=${2:-/tmp/faz-design}
    if [ -n "$(pid_on $EXPORT_PORT)" ]; then
      echo "Port $EXPORT_PORT is busy" >&2
      exit 1
    fi
    trap 'p=$(pid_on $EXPORT_PORT); [ -z "$p" ] || kill "$p"' EXIT
    rm -rf "$out"
    for file in design/*.op; do
      export_file "$file" "$out/$(basename "$file" .op)"
    done
    ;;
  *)
    echo "usage: scripts/design.sh start|gui [file] | stop | wrap | export [out-dir]" >&2
    exit 1
    ;;
esac
