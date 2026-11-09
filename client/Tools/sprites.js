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
import { INK, COLOR, SKIN, BUTTON, RADIUS, BORDER, SIZE, STROKE } from './theme.js';

export const PPU = 200;
const OUTLINE = INK;

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

// ---------- UI kit ----------
// Interface furniture, drawn from the tokens in theme.js. Every sprite here is 9-sliced
// except the close button, so one frame stretches to any window size.
// Pivot is the centre for UI, unlike the scene sprites which stand on their bottom edge.

const ui = (name, [w, h], border, draw) => add(name, w, h, draw, [0.5, 0.5], border);

// A soft top-to-bottom gloss over the upper half of a rounded shape
function gloss(g, x, y, w, h, r, strength = 0.38) {
  g.save();
  roundRect(g, x, y, w, h, r); g.clip();
  roundRect(g, x + 2, y + 2, w - 4, h * 0.52, r);
  g.fillStyle = gradient(g, 0, y, 0, y + h * 0.54, [[0, `rgba(255,255,255,${strength})`], [1, 'rgba(255,255,255,0)']]);
  g.fill();
  g.restore();
}

// ---------- window frames, one per skin ----------
// The frame is a thick coloured band with a bright keyline inside it, holding a board.
// The top band is deeper than the others so a title plate can sit across it.
function windowFrame(skinName) {
  const s = SKIN[skinName];
  const [w, h] = SIZE.panel;
  ui(`panel_${skinName}`, SIZE.panel, BORDER.panel, (g) => {
    roundRect(g, 3, 3, w - 6, h - 6, RADIUS.lg);
    fill(g, gradient(g, 0, 0, 0, h, [[0, s.frameLight], [0.55, s.frame], [1, s.frameDark]]), STROKE.thick);
    gloss(g, 6, 6, w - 12, h - 12, RADIUS.lg, 0.3);
    // bright keyline just inside the band
    roundRect(g, 13, 13, w - 26, h - 26, RADIUS.md);
    g.lineWidth = STROKE.thin; g.strokeStyle = s.keyline; g.stroke();
    // recessed board
    roundRect(g, 24, 32, w - 48, h - 56, RADIUS.sm);
    fill(g, s.board, STROKE.base, s.frameDark);
    roundRect(g, 29, 37, w - 58, h - 66, RADIUS.sm);
    g.lineWidth = 1.5; g.strokeStyle = s.boardLine; g.stroke();
  });
}
['amber', 'blue'].forEach(windowFrame);

// ---------- inner boards, for sub-panels inside a window ----------
function board(name, fillColor, lineColor, edgeColor) {
  const [w, h] = SIZE.board;
  ui(name, SIZE.board, BORDER.board, (g) => {
    roundRect(g, 3, 3, w - 6, h - 6, RADIUS.sm);
    fill(g, fillColor, STROKE.base, edgeColor);
    roundRect(g, 8, 8, w - 16, h - 16, RADIUS.sm);
    g.lineWidth = 1.5; g.strokeStyle = lineColor; g.stroke();
  });
}
board('board_cream', COLOR.cream, COLOR.creamLine, SKIN.amber.frameDark);
board('board_blue', SKIN.blue.board, SKIN.blue.boardLine, SKIN.blue.frameDark);

// ---------- row card, one entry in a list ----------
ui('row_card', SIZE.row, BORDER.row, (g) => {
  const [w, h] = SIZE.row;
  roundRect(g, 3, 5, w - 6, h - 8, RADIUS.sm);
  fill(g, gradient(g, 0, 0, 0, h, [[0, '#fffaf0'], [1, COLOR.creamShade]]), STROKE.base);
  roundRect(g, 8, 10, w - 16, h - 18, RADIUS.sm);
  g.lineWidth = 1.5; g.strokeStyle = COLOR.creamLine; g.stroke();
});

// ---------- buttons: three drawn states each, never a runtime tint ----------
function button(role) {
  const c = BUTTON[role];
  const [w, h] = SIZE.button;
  const body = (g, ramp, dy, withGloss) => {
    roundRect(g, 4, 6 + dy, w - 8, h - 14, RADIUS.md);
    fill(g, gradient(g, 0, 6 + dy, 0, h - 8 + dy, ramp), STROKE.thick);
    roundRect(g, 9, 11 + dy, w - 18, h - 24, RADIUS.sm);
    g.lineWidth = STROKE.thin; g.strokeStyle = c.rim; g.stroke();
    if (withGloss) gloss(g, 8, 9 + dy, w - 16, (h - 20) * 0.9, RADIUS.sm, 0.45);
  };
  ui(`btn_${role}_normal`, SIZE.button, BORDER.button, (g) => {
    // the dark lip the button sits on gives it its thickness
    roundRect(g, 4, 11, w - 8, h - 14, RADIUS.md);
    fill(g, c.low, STROKE.thick);
    body(g, [[0, c.top], [0.5, c.mid], [1, shade(c.mid, -0.18)]], 0, true);
  });
  ui(`btn_${role}_pressed`, SIZE.button, BORDER.button, (g) => {
    roundRect(g, 4, 11, w - 8, h - 14, RADIUS.md);
    fill(g, shade(c.low, -0.25), STROKE.thick);
    body(g, [[0, shade(c.mid, -0.1)], [1, shade(c.low, 0.05)]], 4, false);
  });
  ui(`btn_${role}_disabled`, SIZE.button, BORDER.button, (g) => {
    roundRect(g, 4, 11, w - 8, h - 14, RADIUS.md);
    fill(g, '#8e8e8e', STROKE.thick);
    body(g, [[0, '#cfcfcf'], [1, '#a2a2a2']], 0, false);
  });
}
['green', 'blue', 'red', 'gold', 'gray'].forEach(button);

// ---------- close button: a round badge that sits on the window corner ----------
ui('btn_close', SIZE.close, null, (g) => {
  const [w, h] = SIZE.close;
  const c = BUTTON.blue;
  ellipse(g, w / 2, h / 2 + 3, w / 2 - 5, h / 2 - 5); fill(g, c.low, STROKE.thick);
  ellipse(g, w / 2, h / 2, w / 2 - 5, h / 2 - 5);
  fill(g, gradient(g, 0, 6, 0, h - 6, [[0, c.top], [1, c.mid]]), STROKE.thick);
  ellipse(g, w / 2, h / 2 - 6, w / 2 - 13, h / 2 - 17);
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill();
  const k = 13;
  stroke(g, `M${w / 2 - k} ${h / 2 - k}L${w / 2 + k} ${h / 2 + k}M${w / 2 + k} ${h / 2 - k}L${w / 2 - k} ${h / 2 + k}`, INK, 9);
  stroke(g, `M${w / 2 - k} ${h / 2 - k}L${w / 2 + k} ${h / 2 + k}M${w / 2 + k} ${h / 2 - k}L${w / 2 - k} ${h / 2 + k}`, '#ffffff', 5.5);
});

// ---------- item slot: a recessed cell for an icon ----------
ui('slot_item', SIZE.slot, BORDER.slot, (g) => {
  const [w, h] = SIZE.slot;
  roundRect(g, 3, 3, w - 6, h - 6, RADIUS.sm);
  fill(g, gradient(g, 0, 0, 0, h, [[0, '#d8c49a'], [1, '#f3e6c8']]), STROKE.base);
  roundRect(g, 9, 9, w - 18, h - 18, RADIUS.sm);
  fill(g, gradient(g, 0, 9, 0, h - 9, [[0, '#8e7a52'], [1, '#bfa87a']]), 0);
});

// ---------- progress bar ----------
ui('progress_track', SIZE.track, BORDER.track, (g) => {
  const [w, h] = SIZE.track;
  roundRect(g, 3, 3, w - 6, h - 6, (h - 6) / 2);
  fill(g, '#6b5436', STROKE.base);
  roundRect(g, 7, 7, w - 14, h - 14, (h - 14) / 2);
  g.fillStyle = '#4a3a22'; g.fill();
});
ui('progress_fill', SIZE.track, BORDER.track, (g) => {
  const [w, h] = SIZE.track;
  roundRect(g, 2, 2, w - 4, h - 4, (h - 4) / 2);
  fill(g, gradient(g, 0, 0, 0, h, [[0, '#8ee36a'], [0.5, '#49b63a'], [1, '#2f8a29']]), STROKE.thin);
  gloss(g, 4, 4, w - 8, (h - 8) * 0.6, (h - 8) / 2, 0.5);
});

// ---------- title plate: the window title sits across the top band on this ----------
ui('title_plate', [180, 64], [28, 22, 28, 22], (g) => {
  roundRect(g, 4, 8, 172, 48, RADIUS.md);
  fill(g, gradient(g, 0, 8, 0, 56, [[0, '#8c3b12'], [1, '#5d2409']]), STROKE.thick);
  roundRect(g, 10, 14, 160, 36, RADIUS.sm);
  g.lineWidth = STROKE.thin; g.strokeStyle = COLOR.goldDeep; g.stroke();
});

export const HELPERS = { roundRect, fill, ellipse, poly, gradient, shade, drawText, shape, stroke, limb, dot, skinFill, add, layer, ui, gloss, OUTLINE, INK };

export const SPRITES = sprites;
