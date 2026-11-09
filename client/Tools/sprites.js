// The game's sprite set, drawn on canvas and exported as PNG into client/Assets/Resources/Sprites.
// Each sprite: name, w, h (px), pivot [0..1] from the bottom-left corner, border (9-slice: left, bottom, right, top) for UI.
// Scale: 200 px = 1 Unity unit.
// Text painted onto sprites is player-facing, so it stays Vietnamese.
//
// Every piece is drawn on its own — one button, one icon, one character layer, one prop per
// sprite. Never draw a whole screen or a composed layout as a single sprite; the layout is
// assembled in C# on the client. See docs/client-remaster-plan.md.
//
// The sprite set was emptied for the client remaster. Only the drawing helpers and the
// manifest mechanism are left. Add sprites back with `add(...)` / `layer(...)`, then run the
// export-sprites skill. Naming rules are in docs/client/sprite-names.md.
export const PPU = 200;
const OUTLINE = '#3b2414';
const INK = '#3a2416';

// ---------- drawing helpers ----------
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function fill(g, color, line = 4, outline = OUTLINE) { g.fillStyle = color; g.fill(); if (line) { g.lineWidth = line; g.strokeStyle = outline; g.lineJoin = 'round'; g.stroke(); } }
function ellipse(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
function gradient(g, x0, y0, x1, y1, stops) { const l = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => l.addColorStop(o, c)); return l; }
function shade(hex, k) { // k>0 lighter, k<0 darker
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)));
  return `rgb(${c.join(',')})`;
}
function drawText(g, t, x, y, size, color, outline = null, align = 'center') {
  g.font = `bold ${size}px Arial`; g.textAlign = align; g.textBaseline = 'middle';
  if (outline) { g.lineWidth = size / 5; g.strokeStyle = outline; g.lineJoin = 'round'; g.strokeText(t, x, y); }
  g.fillStyle = color; g.fillText(t, x, y);
}

// ---------- path helpers, used by the character layers ----------
function shape(g, d, color, line = 2.2) {
  const p = new Path2D(d);
  if (color) { g.fillStyle = color; g.fill(p); }
  if (line) { g.lineWidth = line; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(p); }
}
function stroke(g, d, color, width) {
  g.lineWidth = width; g.strokeStyle = color; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(new Path2D(d));
}
function limb(g, d, width) { stroke(g, d, INK, width + 4.4); stroke(g, d, '#e9b283', width); }
function dot(g, x, y, r, color, line = 2.2) { ellipse(g, x, y, r, r); g.fillStyle = color; g.fill(); if (line) { g.lineWidth = line; g.strokeStyle = INK; g.stroke(); } }
const skinFill = (g) => { const r = g.createRadialGradient(100, 96, 10, 100, 96, 150); r.addColorStop(0, '#fff0df'); r.addColorStop(0.6, '#f8c89b'); r.addColorStop(1, '#c67b45'); return r; };

// ---------- manifest ----------
const sprites = [];
const add = (name, w, h, draw, pivot = [0.5, 0], border = null) => sprites.push({ name, w, h, draw, pivot, border });

// Character layers share one 160 x 256 frame with the feet on the bottom edge, so they stack
// without offsets. Paths are authored on a 200 x 320 grid.
// Draw order: hairback, body, earrings, cheeks, brows, lips, hair, then the worn items.
const layer = (name, draw) => add(name, 160, 256, (g) => { g.scale(0.8, 0.8); g.translate(0, 6); draw(g); });

// Keep the helpers referenced until sprites are added back.
export const HELPERS = { roundRect, fill, ellipse, poly, gradient, shade, drawText, shape, stroke, limb, dot, skinFill, add, layer, OUTLINE, INK };

export const SPRITES = sprites;
