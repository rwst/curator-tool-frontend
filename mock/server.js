#!/usr/bin/env node
/*
 * Mock backend for the Reactome Curator Tool frontend.  Zero dependencies (Node http + fs only).
 *
 *   node mock/server.js            # listens on :9090, serves /api/curation/* and /api/auth/*
 *
 * Stateless + canned-success: GETs replay fixtures; commit/persist/delete return canned OK.
 * Data: mock/data/reactome-schema.json (schema) + mock/fixtures/instances.json (from translate-rtpj.js).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9090;
const HERE = __dirname;
const schema = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'reactome-schema.json'), 'utf8'));
const instances = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'instances.json'), 'utf8'));

// ---- indexes ------------------------------------------------------------------------------
// class -> Set(descendant class names incl. self), from the schema tree
const descendants = {};
(function walk(node, ancestors) {
  if (!node || !node.name) return;
  const chain = [...ancestors, node.name];
  for (const c of chain) (descendants[c] = descendants[c] || new Set()).add(node.name);
  (node.children || []).forEach(ch => walk(ch, chain));
})(schema.schemaTree, []);
const inClass = (cls, name) => descendants[cls] && descendants[cls].has(name);

const all = Object.values(instances);
const full = all.filter(i => i.attributes);

// referrers back-index: targetDbId -> [{attributeName, referrer}]
const referrers = {};
const eachInstValue = (v, fn) => { (Array.isArray(v) ? v : [v]).forEach(x => { if (x && typeof x === 'object' && 'dbId' in x) fn(x); }); };
for (const inst of full) {
  for (const [attrName, v] of Object.entries(inst.attributes)) {
    eachInstValue(v, ref => {
      (referrers[ref.dbId] = referrers[ref.dbId] || []).push({ attributeName: attrName, referrer: inst });
    });
  }
}

// event-tree roots: Pathways not referenced as anyone's hasEvent child
const referencedAsEvent = new Set();
for (const inst of full) eachInstValue(inst.attributes.hasEvent, r => referencedAsEvent.add(r.dbId));
const eventRoots = full.filter(i => inClass('Pathway', i.schemaClassName) && !referencedAsEvent.has(i.dbId));

console.log(`[mock] loaded ${all.length} instances (${full.length} full), ${Object.keys(schema.attrs).length} schema classes`);
console.log(`[mock] event-tree roots: ${eventRoots.map(r => r.displayName).join(', ') || '(none)'}`);

// ---- fake JWT (HS512, sub=ralf, far-future exp; signature unverified client-side) ---------
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOKEN = `${b64({ alg: 'HS512' })}.${b64({ sub: 'ralf', iat: 1700000000, exp: 4102444800 })}.mock-signature`;

const thinShell = id => ({ dbId: +id, schemaClassName: 'DatabaseObject', displayName: `(unknown ${id})` });
const byId = id => instances[id] || thinShell(id);

// ---- routes: [method, RegExp, handler(match, {query, body})] -> value (or undefined => 404) -
const R = [];
const get  = (re, fn) => R.push(['GET', re, fn]);
const post = (re, fn) => R.push(['POST', re, fn]);
const del  = (re, fn) => R.push(['DELETE', re, fn]);
const page = (arr, skip, limit) => ({ instances: arr.slice(+skip || 0, (+skip || 0) + (+limit || arr.length)), totalCount: arr.length });

// --- schema ---
get(/^\/api\/curation\/getSchemaClassTree\/?$/,        () => schema.schemaTree);
get(/^\/api\/curation\/getAttributes\/([^/]+)$/,       m => schema.attrs[decodeURIComponent(m[1])] || []);
// --- instances ---
get(/^\/api\/curation\/findByDbId\/(\d+)$/,            m => byId(m[1]));
post(/^\/api\/curation\/findByDbIds\/?$/,              (m, c) => (c.body || []).map(byId));
get(/^\/api\/curation\/getReferrers\/(\d+)$/,          m => {
  const groups = {};
  for (const r of referrers[m[1]] || []) (groups[r.attributeName] = groups[r.attributeName] || []).push(r.referrer);
  return Object.entries(groups).map(([attributeName, refs]) => ({ attributeName, referrers: refs }));
});
// --- lists / search / tree ---
get(/^\/api\/curation\/listInstances\/([^/]+)\/(\d+)\/(\d+)$/, (m, c) => {
  const cls = decodeURIComponent(m[1]); const q = (c.query.get('query') || '').toLowerCase();
  let arr = all.filter(i => inClass(cls, i.schemaClassName));
  if (q) arr = arr.filter(i => (i.displayName || '').toLowerCase().includes(q));
  return page(arr, m[2], m[3]);
});
get(/^\/api\/curation\/searchInstances\/([^/]+)\/(\d+)\/(\d+)$/, (m, c) => {
  const cls = decodeURIComponent(m[1]);
  const keys = (c.query.get('searchKeys') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  let arr = all.filter(i => inClass(cls, i.schemaClassName));
  if (keys.length) arr = arr.filter(i => keys.some(k => (i.displayName || '').toLowerCase().includes(k)));
  return page(arr, m[2], m[3]);
});
get(/^\/api\/curation\/findByDisplayName$/, (m, c) => {
  const dn = (c.query.get('displayName') || '').toLowerCase();
  const clsNames = (c.query.get('classNames') || '').split(',').map(s => s.trim()).filter(Boolean);
  return all.find(i => (i.displayName || '').toLowerCase() === dn &&
                       (!clsNames.length || clsNames.some(cn => inClass(cn, i.schemaClassName)))) || null;
});
get(/^\/api\/curation\/getEventTree\/(.+)$/, () => eventRoots);
// --- edits: canned success ---
post(/^\/api\/curation\/commit\/?$/, (m, c) => {
  const inst = c.body || {};
  if (typeof inst.dbId === 'number' && inst.dbId < 0) inst.dbId = 9000000 + Math.abs(inst.dbId);
  return inst;
});
post(/^\/api\/curation\/delete\/?$/,          () => true);
post(/^\/api\/curation\/deleteByDeleted\/?$/, () => true);
post(/^\/api\/curation\/persistInstances\/[^/]+$/, () => ({}));
del(/^\/api\/curation\/deletePersistedInstances\/[^/]+$/, () => ({}));
get(/^\/api\/curation\/loadInstances\/[^/]+$/, () => ({ newInstances: [], updatedInstances: [], deletedInstances: [], bookmarks: [] }));
// --- fillers / match / qa: echo or empty ---
post(/^\/api\/curation\/fill(Reference|ChEBI|ExternalOntology|RefSequence)\/?$/, (m, c) => c.body || {});
post(/^\/api\/curation\/matchInstances\/?$/,   () => []);
post(/^\/api\/curation\/qaReport\/?$/,          (m, c) => ({ instance: c.body || {}, qaResults: [] }));
get(/^\/api\/curation\/getTestQACheckReport\/(\d+)$/, () => []);
get(/^\/api\/curation\/exportEventDocx\/(\d+)$/, () => ({ __blob: 'mock docx' }));
// --- diagram: benign defaults (component is stubbed, so normally uncalled) ---
get(/^\/api\/curation\/hasDiagram\/(\d+)$/,        () => false);
get(/^\/api\/curation\/hasCyNetwork\/(\d+)$/,      () => false);
get(/^\/api\/curation\/hasDiagramLocked\/(\d+)$/,  () => null);
get(/^\/api\/curation\/lockDiagram\/(\d+)$/,       () => null);
get(/^\/api\/curation\/getDiagramLocks\/?$/,       () => []);
get(/^\/api\/curation\/fetchPathwayDiagramForPathway\/(\d+)$/, () => null);
get(/^\/api\/curation\/(getCyNetwork|loadBackupCyNetwork)\/(\d+)$/, () => ({ elements: [] }));
post(/^\/api\/curation\/(unlockDiagram|backupCyNetwork|uploadCyNetwork)\b.*$/, () => true);
// --- auth ---
post(/^\/api\/auth\/login\/?$/,   () => TOKEN);
post(/^\/api\/auth\/refresh\/?$/, () => TOKEN);

// ---- server -------------------------------------------------------------------------------
function cors(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

http.createServer((req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const u = new URL(req.url, 'http://localhost');
  const chunks = [];
  req.on('data', d => chunks.push(d));
  req.on('end', () => {
    let body;
    if (chunks.length) { try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { body = undefined; } }
    for (const [method, re, fn] of R) {
      if (method !== req.method) continue;
      const mm = u.pathname.match(re);
      if (!mm) continue;
      let value;
      try { value = fn(mm, { query: u.searchParams, body }); }
      catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: String(e) })); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(value === undefined ? null : value));
    }
    console.warn(`[mock] UNHANDLED  ${req.method} ${u.pathname}${u.search}  — add a route in mock/server.js`);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(null));
  });
}).listen(PORT, () => console.log(`[mock] listening on http://localhost:${PORT}  (Ctrl-C to stop)`));
