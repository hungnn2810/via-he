import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const DIR = import.meta.dirname;
const OUT_DIR = path.join(DIR, '..', 'Assets', 'Resources', 'Sprites');

const server = http.createServer((req, res) => {
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
  if (u.pathname === '/done') {
    const count = u.searchParams.get('count') || '?';
    console.log(`SUCCESS: Exported ${count} sprites into ${OUT_DIR}`);
    res.end('ok');
    setTimeout(() => {
      if (chrome) chrome.kill();
      server.close();
      process.exit(0);
    }, 200);
    return;
  }
  const file = u.pathname === '/' ? 'export.html' : path.basename(u.pathname);
  try {
    res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
    res.end(readFileSync(path.join(DIR, file)));
  } catch { res.statusCode = 404; res.end(); }
});

let chrome;
server.listen(5181, '127.0.0.1', () => {
  console.log('Export server listening on 5181. Launching Chrome headless...');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:5181/?auto=true'
  ]);
  chrome.on('error', (err) => {
    console.error('Failed to spawn Chrome:', err);
    server.close();
    process.exit(1);
  });
  // Timeout safety
  setTimeout(() => {
    console.error('Timeout waiting for export.');
    if (chrome) chrome.kill();
    server.close();
    process.exit(1);
  }, 20000);
});

