// Stamp every "<file>.js?v=…" / "<file>.css?v=…" cache-buster with a hash of the app's content.
// Run before committing: node tools/stamp.mjs   (use --dev to reset to ?v=dev)
// Only URLs ending in .js/.css are touched, and app/vendor is never modified
// (minified code is full of ternaries like `a?v=b`).
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RE = /(\.(?:js|css))\?v=[A-Za-z0-9]+/g;
const isVendor = (f) => f.split(path.sep).includes('vendor');

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const appFiles = (await walk(path.join(root, 'app'))).sort();
const pages = ['zhengwang/index.html', 'xiaoha/index.html'].map((p) => path.join(root, p));
const textual = [...appFiles.filter((f) => /\.(js|css)$/.test(f) && !isVendor(f)), ...pages];

const h = crypto.createHash('sha256');
for (const f of [...appFiles, ...pages]) {
  const buf = await fs.readFile(f);
  const norm = !isVendor(f) && /\.(js|css|html)$/.test(f) ? Buffer.from(buf.toString('utf8').replace(RE, '$1?v=dev')) : buf;
  h.update(path.relative(root, f).replace(/\\/g, '/'));
  h.update(norm);
}
const v = process.argv.includes('--dev') ? 'dev' : h.digest('hex').slice(0, 10);

let changed = 0;
for (const f of textual) {
  const s = await fs.readFile(f, 'utf8');
  const n = s.replace(RE, `$1?v=${v}`);
  if (n !== s) {
    await fs.writeFile(f, n);
    changed++;
  }
}
console.log(`stamped v=${v} (${changed} files changed)`);
