#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

log() {
  printf '\n[%s] %s\n' "validate" "$1"
}

pick_flutter_bin() {
  if [[ -x "/Users/aedenteka/development/flutter/bin/flutter" ]]; then
    echo "/Users/aedenteka/development/flutter/bin/flutter"
    return
  fi
  if command -v flutter >/dev/null 2>&1; then
    command -v flutter
    return
  fi
  echo ""
}

FLUTTER_BIN="$(pick_flutter_bin)"
if [[ -z "$FLUTTER_BIN" ]]; then
  echo "Flutter SDK not found. Install Flutter or update validate_all.sh."
  exit 1
fi

log "Flutter analyze"
(cd "$ROOT_DIR/Flutter" && "$FLUTTER_BIN" analyze)

log "Flutter tests"
(cd "$ROOT_DIR/Flutter" && "$FLUTTER_BIN" test)

log "Backend JS syntax check"
(
  cd "$ROOT_DIR/backend"
  while IFS= read -r file; do
    node --check "$file"
  done < <(rg --files -g '*.js')
)

log "Frontend lint + build"
(
  cd "$ROOT_DIR/frontend"
  npm run lint
  npm run build
)

log "Python compile + import smoke check"
(
  cd "$ROOT_DIR/python"
  PYTHONPYCACHEPREFIX=/tmp/python-pycache python3 -m compileall -q app config.py run.py
  ./venv/bin/python -W ignore -c "import app.main"
)

log "All checks passed"
