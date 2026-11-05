// Small server for previewing and exporting the sprite set:  node client/Tools/export-server.mjs
// Open http://localhost:5181/ to see every sprite, then run exportSprites() in the browser console to write PNGs into Assets/Resources/Sprites.
import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const DIR = import.meta.dirname;
const OUT_DIR = path.join(DIR, '..', 'Assets', 'Resources', 'Sprites');

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/save' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      mkdirSync(OUT_DIR, { recursive: true });
      const name = path.basename(u.searchParams.get('name') || 'x').replace(/[^a-z0-9_.-]/gi, '');
      writeFileSync(path.join(OUT_DIR, name), name.endsWith('.png') ? Buffer.from(body.split(',')[1], 'base64') : body);
      res.end('ok');
    });
    return;
  }
  const file = u.pathname === '/' ? 'export.html' : path.basename(u.pathname);
  try {
    res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
    res.end(readFileSync(path.join(DIR, file)));
  } catch { res.statusCode = 404; res.end(); }
}).listen(5181, '127.0.0.1', () => console.log('Sprites: http://localhost:5181/  (run exportSprites() in the console to write PNGs)'));
