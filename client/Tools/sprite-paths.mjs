// Where a sprite lives under Assets/Resources/Sprites, from the prefix rules in sprite-folders.json.
// Shared by export-server.mjs and export-runner.mjs.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(path.join(DIR, 'sprite-folders.json'), 'utf8')).rules;

/** Folder for a sprite id ('' = Sprites root). */
export function spriteFolder(name) {
  const rule = RULES.find(([prefix]) => name.startsWith(prefix));
  return rule ? rule[1] : '';
}

/** Manifest id for a sprite: 'npc/npc_worker'. */
export function spriteId(name) {
  const folder = spriteFolder(name);
  return folder ? `${folder}/${name}` : name;
}

/** Writes one exported file. PNGs go into their folder; sprites.txt rows get the folder in front of the sprite name. */
export function saveSprite(outDir, fileName, body) {
  if (fileName.endsWith('.png')) {
    const dir = path.join(outDir, spriteFolder(fileName.slice(0, -4)));
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, fileName), Buffer.from(body.split(',')[1], 'base64'));
    return;
  }
  mkdirSync(outDir, { recursive: true });
  const text = fileName === 'sprites.txt'
    ? body.split('\n').map((line) => (line.startsWith('ppu,') || !line.includes(',') ? line : spriteId(line.split(',')[0]) + line.slice(line.indexOf(',')))).join('\n')
    : body;
  writeFileSync(path.join(outDir, fileName), text);
}
