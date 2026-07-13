# Mock backend for the Curator Tool frontend

Run and test the UI with **no Neo4j, no Spring Boot backend, no diagram library** — everything
below lives under `mock/` (git-excluded) plus two stub tarballs outside the repo, so the tracked
tree stays clean and your feature PRs carry nothing from here.

## What's here

| File | Purpose |
|------|---------|
| `server.js` | Zero-dependency Node mock of `/api/curation/*` + `/api/auth/*` on `:9090` |
| `data/reactome-schema.json` | Captured schema (class tree + per-class attributes), served verbatim |
| `data/Lactose.rtpj` | Your example instances (Lactose synthesis pathway) |
| `fixtures/instances.json` | Instances translated from the `.rtpj` (generated) |
| `translate-rtpj.js` | One-time `.rtpj` → `fixtures/instances.json` converter |
| `stubs/` | Inert TS stubs for the two `ngx-reactome-*` packages **and `cytoscape`** (a peer dep the app imports for types only) |
| `build-stubs.sh` | Writes placeholder tarballs **and syncs `package-lock.json` integrity** (`patch-lock.js`) so `npm install` resolves the diagram deps |
| `run.sh` | Starts the mock server **and** `ng serve` together |
| `bookmarklet.txt` | One-click login (seeds a long-lived token) |
| `capture-schema.js` | Browser-console snippet to re-capture the schema if the model changes |

## One-time setup

```bash
bash mock/build-stubs.sh     # 1. placeholder diagram tarballs at ../ngx-reactome-base/dist/*
npm install                  # 2. now succeeds (in the app dir)
node mock/translate-rtpj.js  # 3. (re)generate fixtures/instances.json  [already done]
```

This all lives on the `mock` branch — commit it there:

```bash
git add mock/ tsconfig.app.json package-lock.json
git commit -m "Add local mock backend"
```

> Beyond `mock/`, only two tracked files change: a `paths` block in `tsconfig.app.json`
> (redirecting the `ngx-reactome-*` specifiers to `mock/stubs/*`) and two `integrity` values in
> `package-lock.json` (for the stub tarballs). `package.json` is **untouched**.
>
> The `../ngx-reactome-base/dist/*` stub tarballs live **outside** the repo, so they're never
> committed — on a fresh clone of this branch, run `bash mock/build-stubs.sh` then `npm install`.
>
> **Keeping upstream PRs clean:** cut feature branches from `reactome/main` (not from `mock`) so
> they don't carry `mock/` or the `tsconfig`/`lock` edits; do the mock work by merging `mock` in
> locally to test, then PR the feature branch.

## Every session

```bash
bash mock/run.sh     # mock :9090  +  ng serve :4200
```

Then click the **Curator mock login** bookmark (from `bookmarklet.txt`) → app opens as user `ralf`.
The token never expires and `/refresh` always succeeds, so you won't see the login screen.

## What is / isn't mocked

- **Full:** schema (any class renders), instance browse/search/referrers, the event tree
  (Lactose synthesis → 3 reactions), the instance editor, and all edit/commit/delete flows
  (canned success — edits stage client-side in NgRx; commits return OK but aren't persisted).
- **Inert:** the pathway diagram (stub placeholder). The `.rtpj` includes a `PathwayDiagram`,
  but the widget itself is stubbed out.
- **Not served:** the LLM tools (gene2path / paper2path). `llmOn` stays `false`.

An unhandled endpoint logs `[mock] UNHANDLED <method> <path>` in the server console — add a route
in `server.js` (a few lines) if you hit one while working on a new area.

## Refreshing data

- **New/updated instances:** replace `data/Lactose.rtpj` (or pass another file:
  `node mock/translate-rtpj.js path/to/other.rtpj`) and restart the server.
- **Schema changed:** re-run `capture-schema.js` in the browser, drop the downloaded file at
  `data/reactome-schema.json`, restart.
