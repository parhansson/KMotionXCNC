#!/usr/bin/env bash
#
# Builds, tests, and installs the KMXCNC web application (apps/web/dist)
# for local same-origin serving by kmxWeb.
#
# Usage: ./build-web.sh [prod|dev|serve|test|install|uninstall] [options]
#   prod       Production build into apps/web/dist (default)
#   dev        Same as prod
#   serve      Start Vite dev server
#   test       Run TypeScript typecheck, Vitest unit tests, and installer tests
#   install/uninstall  Manage the existing prod bundle in PREFIX/share/kmx/web
#   Options: --prefix=DIR, --sharedir=DIR; DESTDIR stages installation.
#   install does not build. Run prod first. Machine files are never installed.
#

set -euo pipefail

MODE="${1:-prod}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$#" -gt 0 ]; then shift; fi

case "$MODE" in
  dev | prod | serve | test) ;;
  install | uninstall)
    exec python3 "$ROOT/scripts/install-web.py" "$MODE" "$@"
    ;;
  -h | --help)
    sed -n '2,/^$/p' "$ROOT/build-web.sh" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *)
    echo "Unknown mode '$MODE'. Run $0 --help." >&2
    exit 1
    ;;
esac

if [ "$#" -gt 0 ]; then
  echo "Options are only supported for install/uninstall" >&2
  exit 1
fi

if ! command -v npm > /dev/null 2>&1; then
  echo "npm not found. Install NodeJS first." >&2
  exit 1
fi

step() { printf '\n==> %s\n' "$*"; }

case "$MODE" in
  test)
    step "Running typecheck, unit tests, and install tests"
    npm --prefix "$ROOT" run typecheck
    npm --prefix "$ROOT" test
    python3 "$ROOT/scripts/test_install_web.py"
    ;;
  dev | prod)
    if [ ! -d "$ROOT/node_modules" ]; then
      step "Installing locked npm dependencies"
      npm --prefix "$ROOT" ci --no-audit --no-fund
    fi
    step "Building KMXCNC production bundle (apps/web/dist)"
    npm --prefix "$ROOT" run build
    step "Done. Install with: ./build-web.sh install"
    ;;
  serve)
    npm --prefix "$ROOT" run dev
    ;;
esac
