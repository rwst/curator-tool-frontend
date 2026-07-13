#!/usr/bin/env bash
# Start the mock backend (:9090) and the Angular dev server (:4200) together.
# Ctrl-C stops both.  Then click the "Curator mock login" bookmark (mock/bookmarklet.txt).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$(cd "$HERE/.." && pwd)"

node "$HERE/server.js" &
MOCK_PID=$!
trap 'kill $MOCK_PID 2>/dev/null || true' EXIT INT TERM

cd "$APP"
npm start
