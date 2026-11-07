// Local static server that mimics GitHub Pages (directory index, no-cache for dev).
// usage: node tools/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || 8787);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    let file = path.join(root, p);
    if (!file.startsWith(root)) throw Object.assign(new Error('forbidden'), { code: 403 });
    let st = await fs.stat(file).catch(() => null);
    if (st && st.isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        res.writeHead(301, { Location: url.pathname + '/' + url.search });
        return res.end();
      }
      file = path.join(file, 'index.html');
      st = await fs.stat(file).catch(() => null);
    }
    if (!st) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404');
    }
    const body = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch (e) {
    res.writeHead(e.code === 403 ? 403 : 500);
    res.end(String(e.message || e));
  }
}).listen(port, '127.0.0.1', () => console.log(`pianxin dev server: http://127.0.0.1:${port}/`));
