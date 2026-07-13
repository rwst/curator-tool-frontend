#!/usr/bin/env bash
# Creates tiny installable placeholder packages at the exact sibling paths package.json already
# references, so `npm install` resolves the file: deps without the real ngx-reactome-base repo.
# The app never compiles these node_modules packages — tsconfig.app.json `paths` redirects the
# imports to mock/stubs/* source instead. This keeps package.json / package-lock.json UNCHANGED.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BASE="$HERE/../../ngx-reactome-base/dist"   # == ../ngx-reactome-base/dist relative to the app dir

make_stub () {  # name  version
  local name="$1" ver="$2" dir tmp
  dir="$BASE/$name"; tmp="$(mktemp -d)"
  mkdir -p "$tmp/package" "$dir"
  printf '{"name":"%s","version":"%s","main":"index.js","types":"index.d.ts"}\n' "$name" "$ver" > "$tmp/package/package.json"
  : > "$tmp/package/index.js"
  : > "$tmp/package/index.d.ts"
  tar czf "$dir/$name-$ver.tgz" -C "$tmp" package
  rm -rf "$tmp"
  echo "  created $dir/$name-$ver.tgz"
}

echo "[build-stubs] writing placeholder tarballs under $BASE"
make_stub ngx-reactome-diagram 0.0.35
make_stub ngx-reactome-cytoscape-style 0.0.20

# Keep package-lock.json integrity in sync with these tarballs, else npm errors EINTEGRITY
# (the committed lock pins the hashes of the original real tarballs).
node "$HERE/patch-lock.js" \
  "ngx-reactome-diagram:$BASE/ngx-reactome-diagram/ngx-reactome-diagram-0.0.35.tgz" \
  "ngx-reactome-cytoscape-style:$BASE/ngx-reactome-cytoscape-style/ngx-reactome-cytoscape-style-0.0.20.tgz"

echo "[build-stubs] done. Now: npm install  (in the app dir), then bash mock/run.sh."
