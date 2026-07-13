/* Re-capture the schema (only needed if Reactome's data model changes).
 *
 * curl is Cloudflare-blocked, so capture from the browser: open the live curator tool
 * (curator.reactome.org), logged in, DevTools -> Console, paste the block below. It downloads
 * reactome-schema.json — move it to mock/data/reactome-schema.json and restart the mock server.
 */
(async () => {
  const API = location.origin + '/api/curation';
  const H = { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') };
  const j = u => fetch(u, { headers: H }).then(r => r.ok ? r.json() : Promise.reject(r.status));
  const tree = await j(`${API}/getSchemaClassTree/`);
  const names = new Set();
  (function w(n){ if (n && n.name){ names.add(n.name); (n.children||[]).forEach(w); } })(tree);
  const attrs = {};
  for (const c of names) { try { attrs[c] = await j(`${API}/getAttributes/${encodeURIComponent(c)}`); }
                           catch(e){ console.warn('skip', c, e); } }
  const b = new Blob([JSON.stringify({ schemaTree: tree, attrs })], { type: 'application/json' });
  Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: 'reactome-schema.json' }).click();
  console.log('captured', Object.keys(attrs).length, 'of', names.size, 'classes');
})();
