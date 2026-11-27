#!/usr/bin/env bash
#
# Builds the KMotionXCNC web GUI (camx library + ng2 Angular app).
#
# ng2 depends on the local "camx" library ("file:../camx" in ng2/package.json),
# which is not published to npm. camx must be built before ng2 can use it.
# npm ci in ng2 links ng2/node_modules/camx to ../camx.
#
# Usage: ./build-web.sh [dev|prod|serve|test|install|uninstall] [options]
#   dev    Development build into ng2/dist (default)
#   prod   Production build into ./kmx (served by kmxWeb)
#   serve  Start webpack-dev-server on http://localhost:8081/
#   test   Run frontend and installation tests (dependencies must be installed)
#   install/uninstall  Manage the existing prod bundle in PREFIX/share/kmx/web
#   Options: --prefix=DIR, --sharedir=DIR; DESTDIR stages installation.
#   install does not build. Run prod first. Machine files are never installed.
#

set -euo pipefail

MODE="${1:-dev}"
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

if [ "$MODE" = "test" ]; then
  npm --prefix "$ROOT/ng2" test
  python3 "$ROOT/scripts/test_install_web.py"
  exit 0
fi

step "[1/3] Installing and building camx"
cd "$ROOT/camx"
npm ci
npm run build

step "[2/3] Installing ng2 dependencies (links camx)"
cd "$ROOT/ng2"
npm ci
npm test
python3 "$ROOT/scripts/test_install_web.py"

step "[3/3] Building ng2 ($MODE)"
case "$MODE" in
  dev) npm run build:dev ;;
  prod) npm run build ;;
  serve) npm run dev ;;
esac

if [ "$MODE" != "serve" ]; then
  step "Done"
fi
