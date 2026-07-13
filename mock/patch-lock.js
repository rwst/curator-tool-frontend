#!/usr/bin/env node
/* Sync package-lock.json integrity with the current stub tarballs (called by build-stubs.sh).
 * Args: "<pkgName>:<tarballPath>" ...  Minimal text replacement — only the integrity of each
 * file: dep's lock entry changes. */
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const lockPath = path.join(__dirname, '..', 'package-lock.json');
let txt = fs.readFileSync(lockPath, 'utf8');
for (const arg of process.argv.slice(2)) {
  const i = arg.indexOf(':'); const name = arg.slice(0, i), tgz = arg.slice(i + 1);
  const integ = 'sha512-' + crypto.createHash('sha512').update(fs.readFileSync(tgz)).digest('base64');
  const base = path.basename(tgz).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('("resolved": "file:[^"\\n]*' + base + '",\\s*"integrity": ")[^"]*(")');
  if (re.test(txt)) { txt = txt.replace(re, '$1' + integ + '$2'); console.log('  lock integrity patched:', name); }
  else console.warn('  WARN: no package-lock entry found for', name);
}
fs.writeFileSync(lockPath, txt);
