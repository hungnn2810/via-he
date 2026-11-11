// Small server for previewing and exporting the sprite set:  node client/Tools/export-server.mjs
// Open http://localhost:5181/ to see every sprite, then run exportSprites() in the browser console to write PNGs into Assets/Resources/Sprites.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { saveSprite } from './sprite-paths.mjs';

const DIR = import.meta.dirname;
const OUT_DIR = path.join(DIR, '..', 'Assets', 'Resources', 'Sprites');

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/save' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const name = path.basename(u.searchParams.get('name') || 'x').replace(/[^a-z0-9_.-]/gi, '');
      saveSprite(OUT_DIR, name, body); // PNGs go into the folder their prefix says, see sprite-folders.json
      res.end('ok');
    });
    return;
  }
  if (u.pathname === '/done') {
    const count = u.searchParams.get('count') || '?';
    console.log(`Exported ${count} sprites successfully into Assets/Resources/Sprites.`);
    res.end('ok');
    setTimeout(() => process.exit(0), 100);
    return;
  }
  const file = u.pathname === '/' ? 'export.html' : path.basename(u.pathname);
  try {
    res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
    res.end(readFileSync(path.join(DIR, file)));
  } catch { res.statusCode = 404; res.end(); }
}).listen(5181, '127.0.0.1', () => console.log('Sprites: http://localhost:5181/  (run exportSprites() in the console to write PNGs)'));
