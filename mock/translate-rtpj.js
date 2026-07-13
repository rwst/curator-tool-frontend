#!/usr/bin/env node
/*
 * translate-rtpj.js  —  one-time converter: Reactome desktop .rtpj  ->  mock instance fixtures.
 *
 *   node mock/translate-rtpj.js [data/Lactose.rtpj] [fixtures/instances.json]
 *
 * Emits fixtures/instances.json : { "<dbId>": <Instance>, ... } where <Instance> matches what the
 * frontend expects from findByDbId (attributes as a plain object; instance-valued attrs are
 * shells {dbId, schemaClassName, displayName}; multi-valued -> arrays per schema cardinality).
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const rtpjPath = process.argv[2] || path.join(HERE, 'data', 'Lactose.rtpj');
const outPath  = process.argv[3] || path.join(HERE, 'fixtures', 'instances.json');
const schemaPath = path.join(HERE, 'data', 'reactome-schema.json');

// ---- XML entity decode (values use &gt; &amp; etc.) -----------------------------------------
function decode(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
          .replace(/&amp;/g, '&'); // amp last
}
function attr(tag, name) {
  const m = tag.match(new RegExp(name + '="([^"]*)"'));
  return m ? decode(m[1]) : undefined;
}

// ---- schema: per-class attribute cardinality ('1' | '+') -----------------------------------
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const cardinalityOf = {}; // class -> { attrName -> '1' | '+' }
for (const [cls, attrs] of Object.entries(schema.attrs || {})) {
  const m = {};
  for (const a of attrs || []) {
    const nm = a && (a.name || (a.properties && a.properties.name));
    const card = a && a.properties && a.properties.cardinality;
    if (nm) m[nm] = card || '1';
  }
  cardinalityOf[cls] = m;
}

// ---- parse the <reactome> block ------------------------------------------------------------
const xml = fs.readFileSync(rtpjPath, 'utf8');
const body = (xml.match(/<reactome>([\s\S]*?)<\/reactome>/) || [null, xml])[1];

const raw = {};            // dbId -> { dbId, schemaClassName, displayName, isShell, atts: [{name,value?,cls?,ref?}] }
let curClass = null, curInst = null;

for (const m of body.matchAll(/<[^>]+>/g)) {
  const tag = m[0];
  if (tag.startsWith('</')) {
    if (tag === '</instance>') curInst = null;
    else { const t = tag.slice(2, -1); if (t !== 'attribute') curClass = null; }
    continue;
  }
  if (tag.startsWith('<instance')) {
    const dbId = +attr(tag, 'DB_ID');
    curInst = { dbId, schemaClassName: curClass,
                displayName: attr(tag, 'displayName'),
                isShell: attr(tag, 'isShell') === 'true', atts: [] };
    raw[dbId] = curInst;
  } else if (tag.startsWith('<attribute')) {
    if (!curInst) continue;
    const name = attr(tag, 'name');
    const ref = attr(tag, 'referTo');
    if (ref !== undefined) curInst.atts.push({ name, cls: attr(tag, 'class'), ref: +ref });
    else curInst.atts.push({ name, value: attr(tag, 'value') });
  } else {
    // a class-group opening tag like <Reaction> / <Pathway> / <Person> ...
    const t = tag.replace(/[<>]/g, '').split(/\s/)[0];
    if (t && t !== 'attribute' && t !== 'instance') curClass = t;
  }
}

// ---- build final Instance objects ----------------------------------------------------------
const INTERNAL = new Set(['DB_ID']); // drop rtpj-internal / underscore-prefixed keys from attributes
const shellOf = (dbId, declaredCls) => {
  const t = raw[dbId];
  return { dbId, schemaClassName: (t && t.schemaClassName) || declaredCls, displayName: t && t.displayName };
};

const out = {};
for (const inst of Object.values(raw)) {
  const o = { dbId: inst.dbId, schemaClassName: inst.schemaClassName, displayName: inst.displayName };
  if (!inst.isShell) {
    const cards = cardinalityOf[inst.schemaClassName] || {};
    const grouped = {}; // name -> array of values
    for (const a of inst.atts) {
      if (a.name.startsWith('_') || INTERNAL.has(a.name)) continue;
      const v = a.ref !== undefined ? shellOf(a.ref, a.cls) : a.value;
      (grouped[a.name] = grouped[a.name] || []).push(v);
    }
    const attributes = {};
    for (const [name, vals] of Object.entries(grouped)) {
      attributes[name] = (vals.length > 1 || cards[name] === '+') ? vals : vals[0];
    }
    o.attributes = attributes;
  }
  out[inst.dbId] = o;
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out));
const all = Object.values(out);
console.log('wrote', all.length, 'instances ->', path.relative(HERE, outPath));
console.log('  full:', all.filter(i => i.attributes).length, '| shells:', all.filter(i => !i.attributes).length);
console.log('  classes:', [...new Set(all.map(i => i.schemaClassName))].length);
