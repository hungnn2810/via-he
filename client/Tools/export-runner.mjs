import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveSprite } from './sprite-paths.mjs';

// import.meta.dirname needs Node 20.11+; this works from Node 16 up.
const DIR = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(DIR, '..', 'Assets', 'Resources', 'Sprites');

const server = http.createServer((req, res) => {
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

// Any Chromium will do. Set CHROME_PATH to override.
function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

let chrome;
server.listen(5181, '127.0.0.1', () => {
  const chromePath = findBrowser();
  if (!chromePath) {
    console.error('No Chromium browser found. Install Chrome or set CHROME_PATH.');
    server.close();
    process.exit(1);
  }
  console.log(`Export server listening on 5181. Launching headless ${path.basename(chromePath)}...`);
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

