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
import { INK, COLOR, SKIN, BUTTON, BADGE, TOAST, PROGRESS, RADIUS, BORDER, SIZE, STROKE } from './theme.js';

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
// One fill per tone. Green keeps the plain name; Theme.ProgressFillSprite maps the others.
function progressFill(name, ramp) {
  ui(name, SIZE.track, BORDER.track, (g) => {
    const [w, h] = SIZE.track;
    roundRect(g, 2, 2, w - 4, h - 4, (h - 4) / 2);
    fill(g, gradient(g, 0, 0, 0, h, [[0, ramp[0]], [0.5, ramp[1]], [1, ramp[2]]]), STROKE.thin);
    gloss(g, 4, 4, w - 8, (h - 8) * 0.6, (h - 8) / 2, 0.5);
  });
}
progressFill('progress_fill', PROGRESS.green);
progressFill('progress_fill_blue', PROGRESS.blue);
progressFill('progress_fill_gold', PROGRESS.gold);
progressFill('progress_fill_red', PROGRESS.red);

// ---------- title plate: the window title sits across the top band on this ----------
ui('title_plate', [180, 64], [28, 22, 28, 22], (g) => {
  roundRect(g, 4, 8, 172, 48, RADIUS.md);
  fill(g, gradient(g, 0, 8, 0, 56, [[0, '#8c3b12'], [1, '#5d2409']]), STROKE.thick);
  roundRect(g, 10, 14, 160, 36, RADIUS.sm);
  g.lineWidth = STROKE.thin; g.strokeStyle = COLOR.goldDeep; g.stroke();
});

// ---------- row card, selected state ----------
ui('row_selected', SIZE.row, BORDER.row, (g) => {
  const [w, h] = SIZE.row;
  roundRect(g, 3, 5, w - 6, h - 8, RADIUS.sm);
  fill(g, gradient(g, 0, 0, 0, h, [[0, '#fff4c9'], [1, '#ffe08f']]), STROKE.base);
  roundRect(g, 8, 10, w - 16, h - 18, RADIUS.sm);
  g.lineWidth = 2; g.strokeStyle = COLOR.goldDeep; g.stroke();
});

// ---------- HUD chip: a dark navy capsule that holds an icon and a value ----------
ui('chip_navy', SIZE.chip, BORDER.chip, (g) => {
  const [w, h] = SIZE.chip;
  roundRect(g, 3, 3, w - 6, h - 6, (h - 6) / 2);
  fill(g, gradient(g, 0, 0, 0, h, [[0, '#35517f'], [0.5, COLOR.navy], [1, COLOR.navyDeep]]), STROKE.base);
  roundRect(g, 9, 8, w - 18, (h - 16) * 0.42, (h - 16) * 0.21);
  g.fillStyle = 'rgba(255,255,255,0.13)'; g.fill();
});

// ---------- bar: header strip and dock, navy with a lighter top edge ----------
ui('bar_navy', SIZE.bar, BORDER.bar, (g) => {
  const [w, h] = SIZE.bar;
  roundRect(g, 3, 3, w - 6, h - 6, RADIUS.md);
  fill(g, gradient(g, 0, 0, 0, h, [[0, '#2d4570'], [0.5, COLOR.navy], [1, COLOR.navyDeep]]), STROKE.base);
  roundRect(g, 7, 7, w - 14, h - 14, RADIUS.md - 3);
  g.lineWidth = 2; g.strokeStyle = gradient(g, 0, 7, 0, h * 0.6, [[0, COLOR.navyEdge], [1, 'rgba(93,127,181,0)']]); g.stroke();
});

// ---------- tabs: silver when off, gold when on ----------
function tabPlaque(name, ramp, rim) {
  ui(name, SIZE.tab, BORDER.tab, (g) => {
    const [w, h] = SIZE.tab;
    roundRect(g, 3, 4, w - 6, h - 7, RADIUS.md);
    fill(g, gradient(g, 0, 4, 0, h, ramp), STROKE.base);
    roundRect(g, 8, 9, w - 16, h - 17, RADIUS.sm);
    g.lineWidth = STROKE.thin; g.strokeStyle = rim; g.stroke();
    gloss(g, 6, 7, w - 12, (h - 12) * 0.9, RADIUS.sm, 0.4);
  });
}
tabPlaque('tab_off', [[0, COLOR.silverLight], [0.55, COLOR.silver], [1, COLOR.silverDark]], '#ffffff');
tabPlaque('tab_on', [[0, '#ffe38a'], [0.55, '#f4ad22'], [1, '#c97d0a']], '#fff8e2');

// ---------- badges: notification count capsules ----------
function badge(name, c) {
  ui(name, SIZE.badge, BORDER.badge, (g) => {
    const [w, h] = SIZE.badge;
    roundRect(g, 3, 3, w - 6, h - 6, (h - 6) / 2);
    fill(g, gradient(g, 0, 0, 0, h, [[0, c.top], [0.5, c.mid], [1, c.low]]), STROKE.base);
    gloss(g, 5, 5, w - 10, h - 10, (h - 10) / 2, 0.45);
  });
}
badge('badge_red', BADGE.red);
badge('badge_green', BADGE.green);
badge('badge_blue', BADGE.blue);

// ---------- tooltip: a white box, and a separate tail so the tail can follow its target ----------
ui('tooltip_body', SIZE.tooltip, BORDER.tooltip, (g) => {
  const [w, h] = SIZE.tooltip;
  roundRect(g, 3, 3, w - 6, h - 6, RADIUS.md);
  fill(g, gradient(g, 0, 0, 0, h, [[0, COLOR.white], [1, COLOR.whiteShade]]), STROKE.base);
});
// Pivot is the top centre. The top edge is drawn above the canvas, so only the two slanted sides
// carry an outline and the tail merges into the body.
add('tooltip_tail', SIZE.tooltipTail[0], SIZE.tooltipTail[1], (g) => {
  poly(g, [[4, -6], [32, -6], [18, 19]]);
  fill(g, COLOR.whiteShade, STROKE.base);
}, [0.5, 1]);

// ---------- toast plates, one per tone ----------
function toastPlate(name, c) {
  ui(name, SIZE.toast, BORDER.toast, (g) => {
    const [w, h] = SIZE.toast;
    roundRect(g, 3, 3, w - 6, h - 8, RADIUS.lg);
    fill(g, gradient(g, 0, 3, 0, h, [[0, c.top], [1, c.low]]), STROKE.base);
    roundRect(g, 8, 8, w - 16, h - 18, RADIUS.md);
    g.lineWidth = STROKE.thin; g.strokeStyle = c.rim; g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1;
  });
}
Object.entries(TOAST).forEach(([tone, c]) => toastPlate(`toast_${tone}`, c));

// ---------- list furniture ----------
ui('scroll_thumb', SIZE.thumb, BORDER.thumb, (g) => {
  const [w, h] = SIZE.thumb;
  roundRect(g, 2, 2, w - 4, h - 4, (w - 4) / 2);
  fill(g, gradient(g, 0, 0, w, 0, [[0, '#e0b46a'], [1, '#b9822f']]), STROKE.thin);
});
ui('divider', SIZE.divider, BORDER.divider, (g) => {
  const [w, h] = SIZE.divider;
  g.fillStyle = COLOR.creamLine; g.fillRect(0, 0, w, 3);
  g.fillStyle = '#ffffff'; g.fillRect(0, 3, w, 2);
});

// ---------- icons, 96 x 96, one sprite each ----------
// Pivot is the centre. A bare glyph (plus, check, arrow, close) is white with an ink outline so it
// reads on any coloured button; the rest are small coloured objects.
const icon = (name, draw) => ui(`icon_${name}`, SIZE.icon, null, draw);
function star(g, cx, cy, ro, ri) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? ri : ro;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  poly(g, pts);
}
// A stroke path drawn as an outlined white glyph
function glyph(g, d, width = 10) {
  stroke(g, d, INK, width + 7);
  stroke(g, d, '#ffffff', width);
}
function shine(g, d, width = 4) { stroke(g, d, 'rgba(255,255,255,0.7)', width); }

icon('coin', (g) => {
  ellipse(g, 48, 50, 38, 38);
  fill(g, gradient(g, 0, 12, 0, 88, [[0, '#ffe98a'], [0.55, '#ffc531'], [1, '#d98c0c']]), STROKE.thick);
  ellipse(g, 48, 50, 28, 28);
  g.lineWidth = 3; g.strokeStyle = COLOR.goldDeep; g.stroke();
  star(g, 48, 51, 17, 7.5);
  g.fillStyle = '#c47a0a'; g.fill();
  g.beginPath(); g.arc(48, 50, 33, Math.PI * 1.08, Math.PI * 1.42);
  g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineCap = 'round'; g.stroke();
});

icon('gem', (g) => {
  poly(g, [[28, 12], [68, 12], [90, 36], [48, 88], [6, 36]]);
  fill(g, gradient(g, 0, 12, 0, 88, [[0, '#9fe0ff'], [0.5, '#3f9be8'], [1, '#1f5fb0']]), STROKE.thick);
  const facets = 'M6 36H90M28 12L38 36L48 88M68 12L58 36L48 88M38 36L48 12L58 36';
  stroke(g, facets, 'rgba(255,255,255,0.55)', 2.5);
  poly(g, [[30, 17], [46, 17], [40, 31], [20, 31]]);
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill();
});

icon('energy', (g) => {
  poly(g, [[58, 6], [20, 54], [43, 54], [33, 90], [77, 38], [54, 38], [68, 6]]);
  fill(g, gradient(g, 0, 6, 0, 90, [[0, '#fff08a'], [0.5, '#ffc22e'], [1, '#f08a14']]), STROKE.thick);
  shine(g, 'M56 14L30 48');
});

icon('fame', (g) => {
  // two ribbon tails, then a rosette with a star
  poly(g, [[28, 56], [44, 56], [36, 92], [26, 80], [14, 84]]);
  fill(g, '#d94040', STROKE.base);
  poly(g, [[52, 56], [68, 56], [82, 84], [70, 80], [60, 92]]);
  fill(g, '#b92e2e', STROKE.base);
  ellipse(g, 48, 40, 33, 33);
  fill(g, gradient(g, 0, 7, 0, 73, [[0, '#d9a6ff'], [0.55, '#9a55ec'], [1, '#6a2dc0']]), STROKE.thick);
  ellipse(g, 48, 40, 24, 24);
  g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke();
  star(g, 48, 41, 15, 6.5);
  fill(g, '#ffe27a', 2.5);
});

icon('level_star', (g) => {
  star(g, 48, 52, 44, 20);
  fill(g, gradient(g, 0, 8, 0, 96, [[0, '#a8dcff'], [0.5, '#3f9be8'], [1, '#1f62b0']]), STROKE.thick);
  poly(g, [[48, 22], [54, 40], [44, 38]]);
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.fill();
});

icon('time', (g) => {
  ellipse(g, 48, 50, 38, 38);
  fill(g, gradient(g, 0, 12, 0, 88, [[0, '#8fcdff'], [1, '#2f7fd6']]), STROKE.thick);
  ellipse(g, 48, 50, 29, 29);
  fill(g, '#fffaf0', STROKE.thin);
  stroke(g, 'M48 50L48 30', INK, 6.5);
  stroke(g, 'M48 50L62 58', INK, 6.5);
  dot(g, 48, 50, 4.5, INK, 0);
});

icon('heart', (g) => {
  const d = 'M48 86C20 64 8 48 8 31C8 19 17 10 28 10C37 10 44 15 48 22C52 15 59 10 68 10C79 10 88 19 88 31C88 48 76 64 48 86Z';
  const p = new Path2D(d);
  g.fillStyle = gradient(g, 0, 10, 0, 86, [[0, '#ff9ab5'], [0.5, '#ec4f7c'], [1, '#c02a55']]); g.fill(p);
  g.lineWidth = STROKE.thick; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(p);
  shine(g, 'M20 30C20 24 24 20 30 20');
});

icon('lock', (g) => {
  const shackle = 'M30 46V32A18 18 0 0 1 66 32V46';
  stroke(g, shackle, INK, 16);
  stroke(g, shackle, '#d5dae2', 9);
  roundRect(g, 16, 44, 64, 44, 10);
  fill(g, gradient(g, 0, 44, 0, 88, [[0, '#ffe27a'], [0.55, '#f4ad22'], [1, '#c97d0a']]), STROKE.thick);
  dot(g, 48, 62, 6, INK, 0);
  poly(g, [[44, 64], [52, 64], [53, 76], [43, 76]]);
  g.fillStyle = INK; g.fill();
});

icon('check', (g) => glyph(g, 'M18 50L40 72L80 26'));
icon('plus', (g) => glyph(g, 'M48 16V80M16 48H80'));
icon('minus', (g) => glyph(g, 'M16 48H80'));
icon('arrow_left', (g) => glyph(g, 'M60 14L26 48L60 82'));
icon('close', (g) => glyph(g, 'M20 20L76 76M76 20L20 76'));

icon('warning', (g) => {
  poly(g, [[48, 10], [90, 82], [6, 82]]);
  g.lineJoin = 'round';
  fill(g, gradient(g, 0, 10, 0, 82, [[0, '#ffe27a'], [1, '#f0a91e']]), STROKE.thick);
  stroke(g, 'M48 36V58', INK, 9);
  dot(g, 48, 69, 5.5, INK, 0);
});

icon('info', (g) => {
  ellipse(g, 48, 50, 38, 38);
  fill(g, gradient(g, 0, 12, 0, 88, [[0, '#8fcdff'], [0.55, '#3f9be8'], [1, '#1f62b0']]), STROKE.thick);
  dot(g, 48, 31, 6.5, '#ffffff', 0);
  stroke(g, 'M48 45V71', '#ffffff', 10);
});

icon('stall', (g) => {
  // Awning
  poly(g, [[16, 42], [48, 16], [80, 42], [76, 50], [18, 50]]);
  fill(g, gradient(g, 0, 16, 0, 50, [[0, '#ff7675'], [1, '#d63031']]), STROKE.thick);
  // Stripes
  stroke(g, 'M32 28L36 50', '#ffffff', 7);
  stroke(g, 'M64 28L60 50', '#ffffff', 7);
  // Counter
  roundRect(g, 20, 50, 56, 32, 6);
  fill(g, gradient(g, 0, 50, 0, 82, [[0, '#fdcb6e'], [1, '#e17055']]), STROKE.thick);
  roundRect(g, 26, 56, 44, 20, 4);
  fill(g, '#ffeaa7', 2);
});

icon('staff', (g) => {
  // Conical hat / nón lá
  poly(g, [[48, 12], [82, 38], [14, 38]]);
  fill(g, gradient(g, 0, 12, 0, 38, [[0, '#ffeaa7'], [1, '#fdcb6e']]), STROKE.thick);
  // Head
  ellipse(g, 48, 44, 15, 15);
  fill(g, '#ffdcb4', STROKE.thick);
  // Body / Shirt
  roundRect(g, 22, 58, 52, 28, 8);
  fill(g, gradient(g, 0, 58, 0, 86, [[0, '#74b9ff'], [1, '#0984e3']]), STROKE.thick);
  // Apron tie
  stroke(g, 'M36 58V86M60 58V86', '#ffffff', 4);
});

icon('wardrobe', (g) => {
  // Hanger hook
  g.beginPath(); g.arc(48, 22, 9, Math.PI * 0.2, Math.PI * 1.8, true);
  g.lineWidth = STROKE.base; g.strokeStyle = INK; g.stroke();
  // T-shirt
  poly(g, [[32, 30], [48, 36], [64, 30], [84, 46], [74, 58], [66, 52], [66, 84], [30, 84], [30, 52], [22, 58], [12, 46]]);
  fill(g, gradient(g, 0, 30, 0, 84, [[0, '#a29bfe'], [0.5, '#6c5ce7'], [1, '#4834d4']]), STROKE.thick);
  // Collar
  g.beginPath(); g.arc(48, 33, 10, 0, Math.PI);
  g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke();
  shine(g, 'M34 50V78');
});

icon('shop', (g) => {
  // Store awning
  roundRect(g, 14, 20, 68, 26, 6);
  fill(g, gradient(g, 0, 20, 0, 46, [[0, '#55efc4'], [1, '#00b894']]), STROKE.thick);
  stroke(g, 'M32 20V46M50 20V46M66 20V46', '#ffffff', 5);
  // Building body
  roundRect(g, 20, 44, 56, 40, 6);
  fill(g, gradient(g, 0, 44, 0, 84, [[0, '#ffeaa7'], [1, '#fdcb6e']]), STROKE.thick);
  // Door / window
  roundRect(g, 34, 56, 28, 28, 4);
  fill(g, '#74b9ff', STROKE.base);
  stroke(g, 'M48 56V84M34 70H62', '#ffffff', 2.5);
});

icon('log', (g) => {
  // Diary book
  roundRect(g, 18, 16, 60, 68, 8);
  fill(g, gradient(g, 0, 16, 0, 84, [[0, '#81ecec'], [1, '#00cec9']]), STROKE.thick);
  // Inner spine & pages
  roundRect(g, 28, 22, 44, 56, 4);
  fill(g, '#ffffff', STROKE.base);
  // Lines
  stroke(g, 'M36 34H64M36 46H64M36 58H56', '#b2bec3', 3.5);
  // Ribbon bookmark
  poly(g, [[48, 16], [54, 16], [54, 38], [51, 33], [48, 38]]);
  fill(g, '#ff7675', 0);
});

icon('bus', (g) => {
  // Bus body
  roundRect(g, 14, 24, 68, 48, 12);
  fill(g, gradient(g, 0, 24, 0, 72, [[0, '#00b894'], [0.6, '#00a381'], [1, '#00796b']]), STROKE.thick);
  // Windshield & windows
  roundRect(g, 20, 30, 56, 18, 4);
  fill(g, '#dff9fb', STROKE.base);
  stroke(g, 'M36 30V48M58 30V48', INK, 2.5);
  // Headlights
  dot(g, 22, 58, 4.5, '#feca57', STROKE.base);
  dot(g, 74, 58, 4.5, '#feca57', STROKE.base);
  // Bumper
  roundRect(g, 28, 60, 40, 8, 3);
  fill(g, '#dfe6e9', STROKE.base);
  // Wheels
  ellipse(g, 28, 76, 8, 8); fill(g, '#2d3436', STROKE.base);
  ellipse(g, 68, 76, 8, 8); fill(g, '#2d3436', STROKE.base);
});

icon('home', (g) => {
  // Roof
  poly(g, [[48, 12], [84, 44], [12, 44]]);
  fill(g, gradient(g, 0, 12, 0, 44, [[0, '#ff7675'], [1, '#d63031']]), STROKE.thick);
  // Walls
  roundRect(g, 22, 42, 52, 42, 6);
  fill(g, gradient(g, 0, 42, 0, 84, [[0, '#fff4e6'], [1, '#ffeaa7']]), STROKE.thick);
  // Door
  roundRect(g, 36, 54, 24, 30, 4);
  fill(g, gradient(g, 0, 54, 0, 84, [[0, '#e17055'], [1, '#d63031']]), STROKE.base);
  dot(g, 54, 70, 2.5, '#feca57', 0);
});

icon('more', (g) => {
  // 4 tiles grid
  const tiles = [[20, 20], [52, 20], [20, 52], [52, 52]];
  const colors = [
    ['#74b9ff', '#0984e3'],
    ['#55efc4', '#00b894'],
    ['#ffeaa7', '#fdcb6e'],
    ['#ff7675', '#d63031']
  ];
  tiles.forEach(([x, y], i) => {
    roundRect(g, x, y, 24, 24, 6);
    fill(g, gradient(g, x, y, x, y + 24, [[0, colors[i][0]], [1, colors[i][1]]]), STROKE.base);
    gloss(g, x + 2, y + 2, 20, 10, 4, 0.4);
  });
});

icon('banana', (g) => {
  // Curving ripe yellow banana
  const d = 'M22 68C26 78 44 84 66 72C80 62 86 42 84 22C80 22 72 28 66 38C58 50 42 62 26 62L22 68Z';
  const p = new Path2D(d);
  g.fillStyle = gradient(g, 20, 20, 80, 80, [[0, '#ffeaa7'], [0.5, '#f1c40f'], [1, '#f39c12']]);
  g.fill(p);
  g.lineWidth = STROKE.thick; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(p);
  // Stem tip
  stroke(g, 'M84 22L88 16', '#27ae60', 5);
  // Highlight curve
  shine(g, 'M32 70C50 72 70 60 78 38');
});

icon('store', (g) => {
  // Wooden crate
  roundRect(g, 16, 20, 64, 60, 6);
  fill(g, gradient(g, 0, 20, 0, 80, [[0, '#e58e26'], [1, '#b71540']]), STROKE.thick);
  stroke(g, 'M22 20V80M74 20V80M16 26H80M16 74H80M22 26L74 74M74 26L22 74', INK, 2.5);
  shine(g, 'M20 23H76');
});

icon('map', (g) => {
  // Folded paper map with 3 panels
  poly(g, [[14, 26], [38, 18], [60, 26], [82, 18], [82, 70], [60, 78], [38, 70], [14, 78]]);
  fill(g, gradient(g, 14, 18, 82, 78, [[0, '#fff4db'], [0.5, '#fae5be'], [1, '#eed3a2']]), STROKE.thick);
  stroke(g, 'M38 18V70M60 26V78', 'rgba(43,29,18,0.25)', 3);
  stroke(g, 'M22 62Q34 40 48 48T74 34', '#e67e22', 4);
  const pin = 'M48 20C41 20 36 25 36 32C36 41 48 56 48 56C48 56 60 41 60 32C60 25 55 20 48 20Z';
  const p = new Path2D(pin);
  g.fillStyle = gradient(g, 36, 20, 60, 56, [[0, '#ff7675'], [1, '#d63031']]);
  g.fill(p);
  g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke(p);
  dot(g, 48, 32, 4, '#ffffff', 0);
});

icon('market', (g) => {
  // Green wholesale shopping basket / crate with fresh fruit
  roundRect(g, 16, 36, 64, 46, 8);
  fill(g, gradient(g, 0, 36, 0, 82, [[0, '#2ecc71'], [0.6, '#27ae60'], [1, '#1b7a37']]), STROKE.thick);
  g.beginPath(); g.arc(48, 36, 22, Math.PI, 0);
  g.lineWidth = STROKE.thick; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.arc(48, 36, 22, Math.PI, 0);
  g.lineWidth = 4; g.strokeStyle = '#f1c40f'; g.stroke();
  ellipse(g, 38, 32, 12, 12); fill(g, '#ff7675', STROKE.base);
  ellipse(g, 58, 34, 11, 11); fill(g, '#f39c12', STROKE.base);
  stroke(g, 'M22 50H74M22 64H74', INK, 2.5);
  roundRect(g, 32, 54, 32, 16, 4);
  fill(g, '#ffffff', 2);
  drawText(g, 'SỈ', 48, 62, 12, '#27ae60', null);
});

icon('neighbours', (g) => {
  // Two small friendly houses side by side with a heart
  poly(g, [[14, 44], [34, 24], [54, 44]]);
  fill(g, gradient(g, 0, 24, 0, 44, [[0, '#74b9ff'], [1, '#0984e3']]), STROKE.thick);
  roundRect(g, 20, 44, 28, 38, 4);
  fill(g, '#fff4e6', STROKE.thick);
  roundRect(g, 28, 56, 12, 26, 3);
  fill(g, '#e17055', STROKE.base);
  poly(g, [[42, 38], [66, 16], [90, 38]]);
  fill(g, gradient(g, 0, 16, 0, 38, [[0, '#ff7675'], [1, '#d63031']]), STROKE.thick);
  roundRect(g, 48, 38, 36, 44, 4);
  fill(g, '#ffeaa7', STROKE.thick);
  roundRect(g, 60, 52, 14, 30, 3);
  fill(g, '#0984e3', STROKE.base);
  const heart = 'M48 24C46 20 42 18 39 20C35 22 36 26 40 30L48 37L56 30C60 26 61 22 57 20C54 18 50 20 48 24Z';
  const hp = new Path2D(heart);
  g.fillStyle = '#ff4757'; g.fill(hp);
  g.lineWidth = 2; g.strokeStyle = INK; g.stroke(hp);
});

icon('orders', (g) => {
  // Cardboard parcel box with packing tape & shipping label
  poly(g, [[48, 14], [82, 32], [48, 50], [14, 32]]);
  fill(g, gradient(g, 0, 14, 0, 50, [[0, '#ffeaa7'], [1, '#fdcb6e']]), STROKE.thick);
  poly(g, [[14, 32], [48, 50], [48, 84], [14, 66]]);
  fill(g, gradient(g, 0, 32, 0, 84, [[0, '#f0a91e'], [1, '#d89216']]), STROKE.thick);
  poly(g, [[82, 32], [48, 50], [48, 84], [82, 66]]);
  fill(g, gradient(g, 0, 32, 0, 84, [[0, '#d89216'], [1, '#b57608']]), STROKE.thick);
  poly(g, [[42, 18], [54, 24], [54, 53], [42, 47]]);
  fill(g, 'rgba(255,255,255,0.6)', 0);
  roundRect(g, 54, 48, 20, 16, 2);
  fill(g, '#ffffff', 1.5);
  stroke(g, 'M58 53H70M58 58H66', INK, 1.5);
  stroke(g, 'M10 20L20 20M6 26L16 26', '#e67e22', 3);
});

icon('season', (g) => {
  // Golden championship trophy cup
  roundRect(g, 26, 70, 44, 16, 4);
  fill(g, gradient(g, 0, 70, 0, 86, [[0, '#2d4570'], [1, '#111c31']]), STROKE.thick);
  roundRect(g, 42, 54, 12, 18, 2);
  fill(g, '#f4ad22', STROKE.thick);
  stroke(g, 'M24 24C12 24 12 44 24 48M72 24C84 24 84 44 72 48', INK, 8);
  stroke(g, 'M24 24C12 24 12 44 24 48M72 24C84 24 84 44 72 48', '#ffcc3d', 4.5);
  poly(g, [[22, 18], [74, 18], [66, 46], [48, 56], [30, 46]]);
  fill(g, gradient(g, 0, 18, 0, 56, [[0, '#fff2a8'], [0.5, '#f4ad22'], [1, '#c97d0a']]), STROKE.thick);
  star(g, 48, 34, 10, 4.5);
  fill(g, '#ffffff', 1.5);
  gloss(g, 26, 20, 44, 16, 6, 0.45);
});

icon('fortune', (g) => {
  // Divination bamboo tube with fortune sticks (ống quẻ xăm)
  stroke(g, 'M34 34L26 12M44 32L44 8M54 32L62 10M62 36L74 16', INK, 6);
  stroke(g, 'M34 34L26 12M44 32L44 8M54 32L62 10M62 36L74 16', '#ffeaa7', 3.5);
  dot(g, 26, 12, 3, '#d63031', 0);
  dot(g, 44, 8, 3, '#d63031', 0);
  dot(g, 62, 10, 3, '#d63031', 0);
  dot(g, 74, 16, 3, '#d63031', 0);
  roundRect(g, 28, 30, 40, 56, 8);
  fill(g, gradient(g, 0, 30, 0, 86, [[0, '#d35400'], [0.5, '#e67e22'], [1, '#a04000']]), STROKE.thick);
  stroke(g, 'M28 42H68M28 74H68', '#f1c40f', 4);
  poly(g, [[48, 48], [58, 58], [48, 68], [38, 58]]);
  fill(g, '#d63031', STROKE.base);
  dot(g, 48, 58, 3.5, '#f1c40f', 0);
});

icon('activities', (g) => {
  // Vietnamese feathered shuttlecock (quả cầu đá)
  poly(g, [[48, 36], [28, 8], [38, 32]]);
  fill(g, gradient(g, 0, 8, 0, 36, [[0, '#ff7675'], [1, '#d63031']]), STROKE.base);
  poly(g, [[44, 34], [48, 6], [52, 34]]);
  fill(g, gradient(g, 0, 6, 0, 34, [[0, '#ffeaa7'], [1, '#fdcb6e']]), STROKE.base);
  poly(g, [[48, 36], [68, 8], [58, 32]]);
  fill(g, gradient(g, 0, 8, 0, 36, [[0, '#74b9ff'], [1, '#0984e3']]), STROKE.base);
  roundRect(g, 42, 36, 12, 16, 3);
  fill(g, '#ffffff', STROKE.base);
  ellipse(g, 48, 58, 22, 9);
  fill(g, '#fdcb6e', STROKE.base);
  ellipse(g, 48, 68, 24, 10);
  fill(g, gradient(g, 0, 62, 0, 78, [[0, '#ff7675'], [1, '#c0392b']]), STROKE.thick);
  ellipse(g, 48, 78, 22, 9);
  fill(g, '#2d3436', STROKE.thick);
});

icon('cafe', (g) => {
  // Vietnamese coffee phin over glass of iced milk coffee
  poly(g, [[26, 42], [70, 42], [64, 84], [32, 84]]);
  fill(g, gradient(g, 0, 42, 0, 84, [[0, '#593a20'], [0.65, '#7b5333'], [0.75, '#fff6e2'], [1, '#fde6b8']]), STROKE.thick);
  roundRect(g, 34, 48, 12, 12, 2); fill(g, 'rgba(255,255,255,0.4)', 1.5, '#ffffff');
  roundRect(g, 50, 52, 11, 11, 2); fill(g, 'rgba(255,255,255,0.4)', 1.5, '#ffffff');
  roundRect(g, 18, 38, 60, 8, 3);
  fill(g, gradient(g, 0, 38, 0, 46, [[0, '#eef2f5'], [1, '#8d99a4']]), STROKE.thick);
  roundRect(g, 28, 18, 40, 22, 4);
  fill(g, gradient(g, 0, 18, 0, 40, [[0, '#c3ccd3'], [1, '#7f8c8d']]), STROKE.thick);
  roundRect(g, 26, 14, 44, 6, 2);
  fill(g, '#eef2f5', STROKE.base);
  dot(g, 48, 12, 3, '#7f8c8d', STROKE.thin);
});

icon('barber', (g) => {
  // Crossed barber scissors & comb
  poly(g, [[22, 74], [48, 48], [72, 18], [66, 16], [44, 44], [18, 70]]);
  fill(g, '#dff9fb', STROKE.base);
  poly(g, [[74, 74], [48, 48], [24, 18], [30, 16], [52, 44], [78, 70]]);
  fill(g, '#c7ecee', STROKE.base);
  ellipse(g, 22, 74, 10, 10);
  fill(g, '#74b9ff', STROKE.thick);
  ellipse(g, 22, 74, 5, 5); fill(g, '#ffffff', 0);
  ellipse(g, 74, 74, 10, 10);
  fill(g, '#ff7675', STROKE.thick);
  ellipse(g, 74, 74, 5, 5); fill(g, '#ffffff', 0);
  dot(g, 48, 48, 4, '#f1c40f', STROKE.thin);
});

icon('crop', (g) => {
  // Sprouting green seedling from rich soil
  ellipse(g, 48, 74, 34, 14);
  fill(g, gradient(g, 0, 60, 0, 88, [[0, '#795548'], [1, '#4e342e']]), STROKE.thick);
  stroke(g, 'M48 72Q48 50 48 40', '#27ae60', 6);
  poly(g, [[48, 44], [22, 38], [18, 22], [36, 24], [48, 44]]);
  fill(g, gradient(g, 18, 22, 48, 44, [[0, '#a8e063'], [1, '#56ab2f']]), STROKE.thick);
  poly(g, [[48, 40], [68, 30], [78, 14], [76, 32], [48, 40]]);
  fill(g, gradient(g, 48, 14, 78, 40, [[0, '#a8e063'], [1, '#2ecc71']]), STROKE.thick);
  dot(g, 30, 26, 2.5, '#ffffff', 0);
});

icon('kitchen', (g) => {
  // Sizzling cooking pot / wok with flame
  poly(g, [[32, 80], [40, 70], [48, 84], [56, 70], [64, 80]]);
  fill(g, gradient(g, 0, 70, 0, 84, [[0, '#f1c40f'], [1, '#e74c3c']]), STROKE.base);
  poly(g, [[16, 42], [80, 42], [70, 72], [26, 72]]);
  fill(g, gradient(g, 0, 42, 0, 72, [[0, '#636e72'], [1, '#2d3436']]), STROKE.thick);
  stroke(g, 'M16 48C8 48 8 58 16 58M80 48C88 48 88 58 80 58', INK, 5);
  ellipse(g, 48, 44, 28, 8);
  fill(g, gradient(g, 0, 36, 0, 52, [[0, '#f39c12'], [1, '#d35400']]), STROKE.base);
  stroke(g, 'M36 34Q32 24 38 16M48 32Q52 22 46 14M60 34Q64 24 58 16', '#b2bec3', 3.5);
});

icon('decoration', (g) => {
  // Traditional Vietnamese red lantern with gold tassels
  stroke(g, 'M48 10V18', INK, 3);
  roundRect(g, 36, 18, 24, 6, 2);
  fill(g, '#f1c40f', STROKE.base);
  ellipse(g, 48, 46, 28, 24);
  fill(g, gradient(g, 0, 22, 0, 70, [[0, '#ff7675'], [0.5, '#d63031'], [1, '#961e1e']]), STROKE.thick);
  ellipse(g, 48, 46, 16, 24);
  g.lineWidth = 2.5; g.strokeStyle = '#f1c40f'; g.stroke();
  stroke(g, 'M48 22V70', '#f1c40f', 2.5);
  roundRect(g, 36, 68, 24, 6, 2);
  fill(g, '#f1c40f', STROKE.base);
  poly(g, [[44, 74], [40, 90], [48, 86], [56, 90], [52, 74]]);
  fill(g, '#f1c40f', STROKE.base);
});

icon('daily', (g) => {
  // Daily checklist clipboard with green ticks
  roundRect(g, 18, 14, 60, 72, 8);
  fill(g, gradient(g, 0, 14, 0, 86, [[0, '#d35400'], [1, '#a04000']]), STROKE.thick);
  roundRect(g, 24, 22, 48, 58, 4);
  fill(g, '#fffaf0', STROKE.base);
  roundRect(g, 36, 10, 24, 10, 3);
  fill(g, '#bdc3c7', STROKE.base);
  roundRect(g, 28, 30, 10, 10, 2); fill(g, '#2ecc71', 1.5);
  stroke(g, 'M30 35L33 38L37 32', '#ffffff', 2);
  stroke(g, 'M42 35H64', '#7f8c8d', 3);
  roundRect(g, 28, 46, 10, 10, 2); fill(g, '#2ecc71', 1.5);
  stroke(g, 'M30 51L33 54L37 48', '#ffffff', 2);
  stroke(g, 'M42 51H64', '#7f8c8d', 3);
  roundRect(g, 28, 62, 10, 10, 2); fill(g, '#dfe6e9', 1.5);
  stroke(g, 'M42 67H58', '#7f8c8d', 3);
});

icon('profession', (g) => {
  // Graduation mortarboard cap & diploma scroll
  poly(g, [[48, 18], [84, 32], [48, 46], [12, 32]]);
  fill(g, gradient(g, 0, 18, 0, 46, [[0, '#34495e'], [1, '#2c3e50']]), STROKE.thick);
  poly(g, [[28, 38], [68, 38], [62, 58], [34, 58]]);
  fill(g, '#1a252f', STROKE.thick);
  dot(g, 48, 32, 4, '#f1c40f', 0);
  stroke(g, 'M48 32Q70 38 72 54', '#f1c40f', 3);
  roundRect(g, 70, 52, 6, 12, 2); fill(g, '#f1c40f', 0);
  roundRect(g, 22, 66, 52, 18, 5);
  fill(g, '#fff9e6', STROKE.thick);
  roundRect(g, 44, 66, 8, 18, 2);
  fill(g, '#e74c3c', STROKE.base);
});

icon('vehicle', (g) => {
  // Front-facing cute Vietnamese motorbike / scooter
  stroke(g, 'M26 30L34 38M70 30L62 38', INK, 4);
  ellipse(g, 24, 28, 6, 6); fill(g, '#74b9ff', STROKE.base);
  ellipse(g, 72, 28, 6, 6); fill(g, '#74b9ff', STROKE.base);
  roundRect(g, 24, 36, 48, 8, 4);
  fill(g, '#34495e', STROKE.thick);
  ellipse(g, 48, 40, 11, 11);
  fill(g, gradient(g, 0, 29, 0, 51, [[0, '#ffffff'], [1, '#ffeaa7']]), STROKE.thick);
  roundRect(g, 30, 48, 36, 26, 8);
  fill(g, gradient(g, 0, 48, 0, 74, [[0, '#2ecc71'], [1, '#27ae60']]), STROKE.thick);
  roundRect(g, 42, 70, 12, 18, 5);
  fill(g, '#2d3436', STROKE.thick);
  roundRect(g, 38, 66, 20, 8, 4);
  fill(g, '#27ae60', STROKE.base);
});

icon('quest', (g) => {
  // Ancient quest parchment scroll with golden '!' badge
  roundRect(g, 22, 16, 52, 64, 6);
  fill(g, gradient(g, 0, 16, 0, 80, [[0, '#fff4db'], [1, '#eed3a2']]), STROKE.thick);
  roundRect(g, 16, 12, 64, 10, 4); fill(g, '#e0a96d', STROKE.base);
  roundRect(g, 16, 74, 64, 10, 4); fill(g, '#e0a96d', STROKE.base);
  stroke(g, 'M32 30H64M32 40H64M32 50H54', '#8c7a63', 3);
  ellipse(g, 62, 60, 15, 15);
  fill(g, gradient(g, 0, 45, 0, 75, [[0, '#ff7675'], [1, '#d63031']]), STROKE.thick);
  drawText(g, '!', 62, 60, 18, '#ffffff', null);
});

icon('mail', (g) => {
  // Envelope with a letter peeking out
  roundRect(g, 16, 26, 64, 48, 6);
  fill(g, gradient(g, 0, 26, 0, 74, [[0, '#ecf0f1'], [1, '#bdc3c7']]), STROKE.thick);
  roundRect(g, 24, 16, 48, 32, 4);
  fill(g, '#ffffff', STROKE.base);
  stroke(g, 'M30 24H58M30 32H50', '#74b9ff', 2.5);
  poly(g, [[16, 74], [48, 48], [80, 74]]);
  fill(g, gradient(g, 0, 48, 0, 74, [[0, '#ffffff'], [1, '#ecf0f1']]), STROKE.thick);
  poly(g, [[16, 28], [48, 54], [80, 28], [80, 74], [16, 74]]);
  fill(g, gradient(g, 0, 28, 0, 74, [[0, '#ffffff'], [1, '#dfe6e9']]), STROKE.thick);
  dot(g, 48, 54, 5, '#e74c3c', STROKE.thin);
});

icon('settings', (g) => {
  // Mechanical 6-spoke gear
  const cx = 48, cy = 48, rOut = 38, rIn = 28, teeth = 6;
  const pts = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i * Math.PI) / teeth - 0.2;
    const a1 = (i * Math.PI) / teeth + 0.2;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push([cx + Math.cos(a0) * r, cy + Math.sin(a0) * r]);
    pts.push([cx + Math.cos(a1) * r, cy + Math.sin(a1) * r]);
  }
  poly(g, pts);
  fill(g, gradient(g, 0, 10, 0, 86, [[0, '#74b9ff'], [0.5, '#2e86de'], [1, '#1b5b9e']]), STROKE.thick);
  ellipse(g, cx, cy, 14, 14);
  fill(g, '#ffffff', STROKE.thick);
  ellipse(g, cx, cy, 7, 7);
  fill(g, '#1b5b9e', 0);
});

icon('sound_on', (g) => {
  // Speaker cone with sound waves
  poly(g, [[16, 36], [32, 36], [50, 20], [50, 76], [32, 60], [16, 60]]);
  fill(g, gradient(g, 0, 20, 0, 76, [[0, '#2ecc71'], [1, '#27ae60']]), STROKE.thick);
  g.beginPath(); g.arc(52, 48, 14, -Math.PI * 0.3, Math.PI * 0.3);
  g.lineWidth = STROKE.thick; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.arc(52, 48, 14, -Math.PI * 0.3, Math.PI * 0.3);
  g.lineWidth = 3; g.strokeStyle = '#2ecc71'; g.stroke();

  g.beginPath(); g.arc(52, 48, 26, -Math.PI * 0.32, Math.PI * 0.32);
  g.lineWidth = STROKE.thick; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.arc(52, 48, 26, -Math.PI * 0.32, Math.PI * 0.32);
  g.lineWidth = 3; g.strokeStyle = '#2ecc71'; g.stroke();
});

icon('sound_off', (g) => {
  // Speaker cone with red mute cross
  poly(g, [[16, 36], [32, 36], [50, 20], [50, 76], [32, 60], [16, 60]]);
  fill(g, gradient(g, 0, 20, 0, 76, [[0, '#b2bec3'], [1, '#636e72']]), STROKE.thick);
  stroke(g, 'M60 36L82 58M82 36L60 58', INK, 8);
  stroke(g, 'M60 36L82 58M82 36L60 58', '#e74c3c', 4.5);
});

// ---------- UI Frame Sprites ----------
ui('ui_avatar_frame', [108, 108], [0, 0, 0, 0], (g) => {
  // Outer gold rim
  ellipse(g, 54, 54, 50, 50);
  fill(g, gradient(g, 0, 4, 0, 104, [[0, '#ffe38a'], [0.5, '#f4ad22'], [1, '#c97d0a']]), STROKE.thick);
  // Inner inset rim
  ellipse(g, 54, 54, 40, 40);
  g.lineWidth = STROKE.base; g.strokeStyle = '#8c3b12'; g.stroke();
  gloss(g, 14, 10, 80, 40, 40, 0.4);
});

ui('ui_ribbon', [320, 64], [40, 20, 40, 20], (g) => {
  // Red celebration ribbon with swallowtail cutouts
  const w = 320, h = 64;
  poly(g, [
    [0, 12], [24, 32], [0, 52],
    [32, 52], [w - 32, 52], [w, 52], [w - 24, 32], [w, 12],
    [w - 32, 12], [32, 12]
  ]);
  fill(g, gradient(g, 0, 12, 0, 52, [[0, '#ff4757'], [0.6, '#ee5253'], [1, '#c0392b']]), STROKE.thick);
  // Gold borders
  stroke(g, 'M24 16H296M24 48H296', COLOR.gold, 2.5);
});

// ---------- Scene Sprites ----------
// STALLS: Umbrella and counter
const UMBRELLA_COLORS = {
  red: ['#e74c3c', '#fff'],
  green: ['#27ae60', '#fff'],
  blue: ['#2e86de', '#fff'],
  yellow: ['#f1c40f', '#e67e22'],
  purple: ['#9b59b6', '#fff'],
  orange: ['#e67e22', '#fff3d6']
};
Object.entries(UMBRELLA_COLORS).forEach(([name, [a, b]]) => add(`umbrella_${name}`, 380, 500, (g) => {
  roundRect(g, 186, 70, 9, 430, 4); fill(g, '#7f8c8d', 3);
  const segments = 8, left = 10, right = 370, bottom = 120;
  for (let i = 0; i < segments; i++) {
    const x0 = left + (i * (right - left)) / segments, x1 = left + ((i + 1) * (right - left)) / segments;
    g.beginPath(); g.moveTo(190, 18); g.lineTo(x0, bottom); g.quadraticCurveTo((x0 + x1) / 2, bottom + 18, x1, bottom); g.closePath();
    g.fillStyle = i % 2 ? b : a; g.fill();
  }
  g.beginPath(); g.moveTo(190, 18); g.lineTo(left, bottom); g.lineTo(right, bottom); g.closePath(); g.lineWidth = 4; g.strokeStyle = OUTLINE; g.stroke();
  for (let i = 0; i < segments; i++) {
    const x0 = left + (i * (right - left)) / segments, x1 = left + ((i + 1) * (right - left)) / segments;
    g.beginPath(); g.moveTo(x0, bottom); g.quadraticCurveTo((x0 + x1) / 2, bottom + 18, x1, bottom); g.stroke();
  }
  ellipse(g, 190, 16, 9, 9); fill(g, b, 3);
}));

function table(g, wood = '#a0652e') {
  roundRect(g, 34, 150, 14, 40, 3); fill(g, shade(wood, -0.3), 3);
  roundRect(g, 332, 150, 14, 40, 3); fill(g, shade(wood, -0.3), 3);
  roundRect(g, 14, 76, 352, 80, 10); fill(g, gradient(g, 0, 76, 0, 156, [[0, shade(wood, 0.15)], [1, wood]]));
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3;
  [102, 128].forEach((y) => { g.beginPath(); g.moveTo(20, y); g.lineTo(360, y); g.stroke(); });
  roundRect(g, 6, 64, 368, 20, 8); fill(g, shade(wood, 0.3));
}

const COUNTERS = {
  fried_banana: (g) => {
    table(g, '#e67e22');
    [70, 150, 230, 310].forEach((x) => { ellipse(g, x, 46, 32, 18); fill(g, gradient(g, 0, 28, 0, 64, [[0, '#f2b84b'], [1, '#b8741a']]), 3); });
    drawText(g, 'CHUỐI CHIÊN', 190, 116, 28, '#fff', OUTLINE);
  },
  banana_soup: (g) => {
    table(g, '#9b59b6');
    [70, 150, 230, 310].forEach((x) => { roundRect(g, x - 26, 24, 52, 44, 8); fill(g, '#fff', 3); g.fillStyle = '#e9d8a6'; g.fillRect(x - 21, 36, 42, 26); ellipse(g, x, 42, 10, 6); fill(g, '#f7d23e', 2); });
    drawText(g, 'CHÈ CHUỐI', 190, 116, 30, '#fff', OUTLINE);
  },
  fresh_cane: (g) => {
    table(g, '#27ae60');
    [60, 120, 180, 240, 300].forEach((x) => { roundRect(g, x, 12, 40, 58, 8); fill(g, 'rgba(220,240,200,.9)', 3); g.fillStyle = '#c3d36b'; g.fillRect(x + 5, 26, 30, 40); });
    drawText(g, 'NƯỚC MÍA TƯƠI', 190, 116, 26, '#fff', OUTLINE);
  },
  banana_cake: (g) => {
    table(g, '#a0652e');
    [80, 190, 300].forEach((x) => { roundRect(g, x - 44, 28, 88, 40, 8); fill(g, gradient(g, 0, 28, 0, 68, [[0, '#d99a44'], [1, '#8a5413']]), 3); });
    drawText(g, 'BÁNH CHUỐI', 190, 116, 28, '#fff', OUTLINE);
  },
  grandma_soup: (g) => {
    table(g, '#c0392b');
    [100, 190, 280].forEach((x) => { ellipse(g, x, 44, 40, 24); fill(g, '#fff', 3); ellipse(g, x, 42, 30, 15); fill(g, '#d9b65a', 2); });
    drawText(g, 'CHÈ GIA TRUYỀN', 190, 116, 26, '#fff', OUTLINE);
  },
  banh_chung: (g) => {
    table(g, '#2f9e44');
    [[70, 26], [150, 26], [230, 26], [300, 26]].forEach(([x, y]) => {
      roundRect(g, x - 30, y, 60, 46, 4); fill(g, '#3fa34d', 3);
      g.strokeStyle = '#d9c9a0'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 46); g.moveTo(x - 30, y + 23); g.lineTo(x + 30, y + 23); g.stroke();
    });
    drawText(g, 'BÁNH CHƯNG', 190, 116, 28, '#fff', OUTLINE);
  },
  sugarcane_juice: (g) => {
    table(g, '#7cb342');
    [60, 120, 180, 240, 300].forEach((x) => { roundRect(g, x, 12, 40, 58, 8); fill(g, 'rgba(220,240,200,.9)', 3); g.fillStyle = '#b5c95a'; g.fillRect(x + 5, 28, 30, 38); });
    drawText(g, 'NƯỚC MÍA', 190, 116, 30, '#fff', OUTLINE);
  },
  moon_cake: (g) => {
    table(g, '#c0392b');
    [[80, 44], [160, 44], [240, 44], [310, 44]].forEach(([x, y]) => {
      ellipse(g, x, y, 32, 26); fill(g, gradient(g, 0, y - 26, 0, y + 26, [[0, '#e8b05a'], [1, '#b0701f']]), 3);
      ellipse(g, x, y, 15, 12); g.strokeStyle = '#8a5413'; g.lineWidth = 2; g.stroke();
    });
    drawText(g, 'BÁNH NƯỚNG', 190, 116, 28, '#fff', OUTLINE);
  },
  banana: (g) => {
    table(g, '#e0a51f');
    [[60, 40], [140, 34], [220, 40], [300, 34]].forEach(([x, y]) => {
      [-16, 0, 16].forEach((d) => {
        g.save(); g.translate(x + d, y); g.rotate(d / 40);
        roundRect(g, -8, -30, 16, 58, 8); fill(g, gradient(g, 0, -30, 0, 28, [[0, '#ffe873'], [1, '#e0a51f']]), 3);
        g.restore();
      });
      roundRect(g, x - 18, y - 36, 36, 10, 4); fill(g, '#7b5a2a', 3);
    });
    drawText(g, 'CHUỐI', 190, 116, 32, '#fff', OUTLINE);
  },
  iced_tea: (g) => {
    table(g, '#2e86de');
    roundRect(g, 40, 6, 70, 64, 14); fill(g, '#ecf0f1');
    roundRect(g, 50, 18, 50, 44, 8); fill(g, '#d4a056', 3);
    roundRect(g, 64, 0, 22, 10, 4); fill(g, '#e74c3c', 3);
    [140, 186, 232, 278].forEach((x) => {
      roundRect(g, x, 22, 34, 44, 6); fill(g, 'rgba(220,240,255,.85)', 3);
      g.fillStyle = '#c8873d'; g.fillRect(x + 4, 40, 26, 22);
      g.fillStyle = '#fff'; g.fillRect(x + 8, 34, 8, 8); g.fillRect(x + 18, 30, 8, 8);
    });
    drawText(g, 'TRÀ ĐÁ', 190, 116, 30, '#fff', OUTLINE);
  },
  banh_mi: (g) => {
    table(g, '#c0392b');
    roundRect(g, 30, 6, 320, 66, 8); fill(g, 'rgba(210,235,255,.55)');
    g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(40, 18, 16, 50);
    [[70, 42], [140, 36], [210, 42], [280, 36]].forEach(([x, y]) => {
      g.save(); g.translate(x, y); g.rotate(-0.15);
      ellipse(g, 0, 0, 34, 14); fill(g, gradient(g, 0, -14, 0, 14, [[0, '#f7c66b'], [1, '#c98a2c']]), 3);
      g.strokeStyle = '#9a5d14'; g.lineWidth = 2;
      [-14, 0, 14].forEach((d) => { g.beginPath(); g.moveTo(d - 6, -6); g.lineTo(d + 6, 4); g.stroke(); });
      g.restore();
    });
    drawText(g, 'BÁNH MÌ', 190, 116, 30, '#fff', OUTLINE);
  },
  sticky_rice: (g) => {
    table(g, '#8d5a2b');
    ellipse(g, 120, 50, 90, 26); fill(g, '#c8a165');
    ellipse(g, 120, 40, 74, 22); fill(g, '#fdf6d8', 3);
    g.fillStyle = '#f1c40f'; ellipse(g, 104, 36, 20, 8); g.fill();
    g.fillStyle = '#7a4a24'; [[136, 36], [146, 44], [120, 46]].forEach(([x, y]) => { ellipse(g, x, y, 6, 3); g.fill(); });
    ellipse(g, 270, 50, 70, 22); fill(g, '#2ecc71');
    ellipse(g, 270, 42, 56, 16); fill(g, '#a5e3a0', 3);
    drawText(g, 'XÔI', 190, 116, 32, '#fff', OUTLINE);
  },
  sweet_soup: (g) => {
    table(g, '#16a085');
    [70, 130, 190, 250, 310].forEach((x, i) => {
      roundRect(g, x - 20, 14, 40, 54, 8); fill(g, 'rgba(230,245,255,.8)', 3);
      const c = ['#9b59b6', '#27ae60', '#e67e22', '#e84393', '#f1c40f'][i];
      g.fillStyle = c; g.fillRect(x - 16, 36, 32, 28);
      g.fillStyle = '#fff'; g.fillRect(x - 16, 30, 32, 8);
    });
    drawText(g, 'CHÈ', 190, 116, 32, '#fff', OUTLINE);
  },
  popsicle: (g) => {
    roundRect(g, 30, 30, 320, 130, 16); fill(g, gradient(g, 0, 30, 0, 160, [[0, '#fff'], [1, '#d6e9ff']]));
    roundRect(g, 20, 20, 340, 26, 10); fill(g, '#2e86de');
    ellipse(g, 70, 170, 20, 20); fill(g, '#555'); ellipse(g, 310, 170, 20, 20); fill(g, '#555');
    [[120, 92, '#ff7aa2'], [190, 86, '#7bed9f'], [260, 92, '#ffeaa7']].forEach(([x, y, c]) => {
      poly(g, [[x - 18, y], [x + 18, y], [x, y + 46]]); fill(g, '#e0a35b', 3);
      ellipse(g, x, y - 6, 22, 20); fill(g, c, 3);
    });
    drawText(g, 'KEM', 70, 96, 30, '#e74c3c', '#fff');
  },
  rambutan: (g) => {
    table(g, '#8d5a2b');
    [[110, 46], [270, 46]].forEach(([cx, cy]) => {
      ellipse(g, cx, cy + 10, 80, 24); fill(g, '#b77b3b');
      for (let i = 0; i < 14; i++) {
        const x = cx - 60 + (i % 7) * 20, y = cy - 4 - Math.floor(i / 7) * 16;
        ellipse(g, x, y, 13, 13); fill(g, '#d63031', 2.5);
        g.strokeStyle = '#2ecc71'; g.lineWidth = 2;
        for (let a = 0; a < 6; a++) {
          g.beginPath(); g.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); g.lineTo(x + Math.cos(a) * 17, y + Math.sin(a) * 17); g.stroke();
        }
      }
    });
    drawText(g, 'CHÔM CHÔM', 190, 116, 26, '#fff', OUTLINE);
  },
  flowers: (g) => {
    table(g, '#6ab04c');
    [70, 150, 230, 310].forEach((x, i) => {
      roundRect(g, x - 26, 30, 52, 40, 6); fill(g, '#7f8c8d', 3);
      const c = ['#ff6b81', '#feca57', '#ff9ff3', '#ffffff'][i];
      for (let k = 0; k < 6; k++) {
        const fx = x - 22 + (k % 3) * 22, fy = 6 + Math.floor(k / 3) * 16;
        g.strokeStyle = '#27ae60'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(fx, fy); g.lineTo(x, 40); g.stroke();
        ellipse(g, fx, fy, 11, 11); fill(g, c, 2.5);
        g.fillStyle = '#f1c40f'; ellipse(g, fx, fy, 4, 4); g.fill();
      }
    });
    drawText(g, 'HOA TƯƠI', 190, 116, 28, '#fff', OUTLINE);
  },
  tofu_noodles: (g) => {
    table(g, '#a0652e');
    [110, 270].forEach((x) => {
      roundRect(g, x - 70, 26, 140, 40, 8); fill(g, '#7bc96f');
      g.fillStyle = '#f5f5f5'; for (let i = 0; i < 4; i++) { roundRect(g, x - 62 + i * 32, 30, 28, 18, 4); fill(g, '#f7f3e3', 2); }
      g.fillStyle = '#e1a95f'; for (let i = 0; i < 4; i++) { roundRect(g, x - 60 + i * 32, 48, 26, 14, 3); fill(g, '#e8b04a', 2); }
    });
    drawText(g, 'BÚN ĐẬU', 190, 116, 28, '#fff', OUTLINE);
  },
  fresh_milk: (g) => {
    table(g, '#3498db');
    for (let i = 0; i < 7; i++) {
      const x = 46 + i * 46;
      roundRect(g, x, 16, 30, 54, 8); fill(g, '#fff', 3);
      roundRect(g, x + 8, 4, 14, 14, 3); fill(g, i % 2 ? '#2e86de' : '#27ae60', 3);
      g.fillStyle = '#74b9ff'; g.fillRect(x + 4, 36, 22, 12);
    }
    drawText(g, 'SỮA TƯƠI', 190, 116, 28, '#fff', OUTLINE);
  },
  soap_bubbles: (g) => {
    table(g, '#00cec9');
    [80, 150, 230, 300].forEach((x) => {
      ellipse(g, x, 40, 18, 18); fill(g, 'rgba(129,236,236,0.6)', 2, '#fff');
      ellipse(g, x + 16, 24, 10, 10); fill(g, 'rgba(129,236,236,0.6)', 1.5, '#fff');
    });
    drawText(g, 'BÓNG BỌT', 190, 116, 28, '#fff', OUTLINE);
  },
  pinwheel: (g) => {
    table(g, '#fdcb6e');
    [80, 150, 230, 300].forEach((x) => {
      stroke(g, `M${x} 56V26`, '#e17055', 4);
      poly(g, [[x, 26], [x - 14, 12], [x, 18], [x + 14, 12]]); fill(g, '#d63031', 2);
    });
    drawText(g, 'CHONG CHÓNG', 190, 116, 24, '#fff', OUTLINE);
  },
  plastic_sandals: (g) => {
    table(g, '#0984e3');
    [90, 170, 240, 300].forEach((x) => {
      roundRect(g, x - 18, 30, 36, 20, 6); fill(g, '#ffeaa7', 2);
    });
    drawText(g, 'DÉP NHỰA', 190, 116, 28, '#fff', OUTLINE);
  },
  t_shirt: (g) => {
    table(g, '#6c5ce7');
    [90, 170, 250].forEach((x, i) => {
      poly(g, [[x - 24, 20], [x - 14, 12], [x + 14, 12], [x + 24, 20], [x + 16, 52], [x - 16, 52]]);
      fill(g, ['#ff7675', '#74b9ff', '#55efc4'][i], 2);
    });
    drawText(g, 'ÁO THUN', 190, 116, 28, '#fff', OUTLINE);
  },
};
Object.entries(COUNTERS).forEach(([id, draw]) => add(`counter_${id}`, 380, 190, draw));

add('slot_empty', 260, 70, (g) => {
  roundRect(g, 4, 4, 252, 62, 8); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill();
  g.setLineDash([8, 6]); g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,0.45)'; g.stroke(); g.setLineDash([]);
  const cr = 10;
  g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(4, 4 + cr); g.lineTo(4, 4); g.lineTo(4 + cr, 4); g.stroke();
  g.beginPath(); g.moveTo(256 - cr, 4); g.lineTo(256, 4); g.lineTo(256, 4 + cr); g.stroke();
  g.beginPath(); g.moveTo(4, 66 - cr); g.lineTo(4, 66); g.lineTo(4 + cr, 66); g.stroke();
  g.beginPath(); g.moveTo(256 - cr, 66); g.lineTo(256, 66); g.lineTo(256, 66 - cr); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(130 - 8, 35); g.lineTo(130 + 8, 35); g.moveTo(130, 35 - 8); g.lineTo(130, 35 + 8); g.stroke();
});
add('slot_owner', 260, 70, (g) => {
  roundRect(g, 4, 4, 252, 62, 8); g.fillStyle = 'rgba(241,196,15,0.12)'; g.fill();
  g.setLineDash([8, 6]); g.lineWidth = 2.5; g.strokeStyle = 'rgba(243,156,18,0.55)'; g.stroke(); g.setLineDash([]);
  const cr = 10;
  g.strokeStyle = 'rgba(243,156,18,0.75)'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(4, 4 + cr); g.lineTo(4, 4); g.lineTo(4 + cr, 4); g.stroke();
  g.beginPath(); g.moveTo(256 - cr, 4); g.lineTo(256, 4); g.lineTo(256, 4 + cr); g.stroke();
  g.beginPath(); g.moveTo(4, 66 - cr); g.lineTo(4, 66); g.lineTo(4 + cr, 66); g.stroke();
  g.beginPath(); g.moveTo(256 - cr, 66); g.lineTo(256, 66); g.lineTo(256, 66 - cr); g.stroke();
  drawText(g, '★', 130, 37, 20, 'rgba(243,156,18,0.75)');
});

// ---------- STREET BACKGROUND & ENVIRONMENT ----------
add('bg_sky', 64, 512, (g) => {
  g.fillStyle = gradient(g, 0, 0, 0, 512, [[0, '#5ec2f2'], [0.7, '#bfe9ff'], [1, '#fff4d6']]);
  g.fillRect(0, 0, 64, 512);
}, [0.5, 0]);

add('bg_city', 1200, 300, (g) => {
  const towers = [[0, 140, 90], [90, 200, 70], [160, 110, 110], [270, 240, 80], [350, 160, 100], [450, 210, 90], [540, 130, 120], [660, 260, 70], [730, 180, 110], [840, 220, 90], [930, 150, 120], [1050, 240, 80], [1130, 170, 70]];
  towers.forEach(([x, h, w], i) => {
    g.fillStyle = i % 2 ? '#a9cfe6' : '#94c1dd';
    g.fillRect(x, 300 - h, w, h);
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (let y = 300 - h + 14; y < 290; y += 22)
      for (let c = x + 10; c < x + w - 14; c += 20)
        g.fillRect(c, y, 10, 12);
  });
}, [0.5, 0]);

const HOUSES = [
  { wall: '#f6b26b', sign: 'TẠP HÓA', signColor: '#c0392b' },
  { wall: '#a4d4ae', sign: 'CƠM BÌNH DÂN', signColor: '#2e86de' },
  { wall: '#f9e79f', sign: 'SỬA XE', signColor: '#27ae60' },
  { wall: '#d7bde2', sign: 'CẮT TÓC', signColor: '#8e44ad' },
  { wall: '#aed6f1', sign: 'PHỞ', signColor: '#d35400' },
];
HOUSES.forEach((house, i) => add(`house_${i}`, 640, 820, (g) => {
  roundRect(g, 10, 30, 620, 790, 6); fill(g, house.wall);
  g.fillStyle = 'rgba(0,0,0,.06)'; for (let y = 60; y < 800; y += 40) g.fillRect(10, y, 620, 3);
  roundRect(g, 0, 10, 640, 34, 6); fill(g, shade(house.wall, -0.35));
  for (const y of [90, 300]) {
    roundRect(g, 80, y, 200, 150, 8); fill(g, '#5d8aa8'); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(96, y + 12, 40, 120);
    g.strokeStyle = OUTLINE; g.lineWidth = 4; g.beginPath(); g.moveTo(180, y); g.lineTo(180, y + 150); g.stroke();
    roundRect(g, 360, y, 200, 150, 8); fill(g, '#5d8aa8'); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(376, y + 12, 40, 120);
    g.beginPath(); g.moveTo(460, y); g.lineTo(460, y + 150); g.stroke();
    roundRect(g, 50, y + 150, 540, 18, 4); fill(g, '#7f8c8d'); for (let x = 60; x < 590; x += 22) { g.fillStyle = '#566573'; g.fillRect(x, y + 120, 5, 32); }
    g.fillStyle = '#566573'; g.fillRect(50, y + 116, 540, 6);
    [[110, '#27ae60'], [520, '#2ecc71']].forEach(([x, c]) => { roundRect(g, x - 20, y + 104, 40, 26, 5); fill(g, '#c0392b', 3); ellipse(g, x, y + 92, 30, 24); fill(g, c, 3); });
  }
  roundRect(g, 560, 240, 60, 44, 4); fill(g, '#ecf0f1', 3); g.fillStyle = '#95a5a6'; ellipse(g, 590, 262, 14, 14); g.fill();
  roundRect(g, 40, 500, 560, 78, 10); fill(g, house.signColor); drawText(g, house.sign, 320, 540, 52, '#fff', OUTLINE);
  roundRect(g, 40, 600, 560, 220, 4); fill(g, '#4a3b30');
  g.fillStyle = '#bdc3c7'; g.fillRect(42, 602, 556, 70); g.fillStyle = '#95a5a6'; for (let y = 606; y < 672; y += 10) g.fillRect(42, y, 556, 3);
  g.fillStyle = '#f5d76e'; g.fillRect(60, 690, 120, 130); g.fillStyle = '#e67e22'; for (let k = 0; k < 4; k++) g.fillRect(70 + k * 28, 700, 20, 26); g.fillStyle = '#3498db'; for (let k = 0; k < 4; k++) g.fillRect(70 + k * 28, 740, 20, 26);
}));

add('power_pole', 120, 1100, (g) => {
  roundRect(g, 46, 40, 28, 1060, 6); fill(g, gradient(g, 46, 0, 74, 0, [[0, '#9aa5ab'], [1, '#6d7b83']]));
  [70, 110].forEach((y) => { roundRect(g, 6, y, 108, 12, 4); fill(g, '#5d6d7e', 3); });
  g.strokeStyle = '#2c3e50'; g.lineWidth = 4; for (let k = 0; k < 6; k++) { ellipse(g, 60 + Math.sin(k) * 10, 200 + k * 8, 46 - k * 4, 14); g.stroke(); }
  roundRect(g, 30, 300, 60, 70, 6); fill(g, '#7f8c8d'); roundRect(g, 40, 310, 40, 30, 4); fill(g, '#f1c40f', 3);
  g.fillStyle = '#ecf0f1'; roundRect(g, 36, 520, 48, 60, 4); g.fill(); g.fillStyle = '#e74c3c'; g.fillRect(40, 528, 40, 6); g.fillRect(40, 546, 30, 4); g.fillRect(40, 558, 34, 4);
}, [0.5, 0]);

add('power_lines', 800, 120, (g) => {
  g.strokeStyle = '#2c3e50'; g.lineWidth = 4;
  [[10, 40], [24, 60], [16, 74]].forEach(([a, b]) => { g.beginPath(); g.moveTo(0, a); g.quadraticCurveTo(400, a + b, 800, a); g.stroke(); });
}, [0, 1]);

add('tree', 420, 760, (g) => {
  roundRect(g, 190, 380, 40, 380, 12); fill(g, '#8e5a34');
  [[210, 230, 170, 150, '#2f9e44'], [120, 300, 110, 100, '#37b24d'], [300, 300, 110, 100, '#37b24d'], [210, 140, 130, 110, '#51cf66']].forEach(([x, y, rx, ry, c]) => { ellipse(g, x, y, rx, ry); fill(g, c); });
  g.fillStyle = 'rgba(255,255,255,.18)'; ellipse(g, 170, 110, 50, 30); g.fill();
}, [0.5, 0]);

add('sidewalk', 200, 200, (g) => {
  g.fillStyle = '#e3d6c4'; g.fillRect(0, 0, 200, 200);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    roundRect(g, x * 100 + 3, y * 100 + 3, 94, 94, 6); g.fillStyle = (x + y) % 2 ? '#d9c9b2' : '#eadfce'; g.fill();
    g.strokeStyle = 'rgba(120,90,60,.18)'; g.lineWidth = 2; g.stroke();
    g.strokeStyle = 'rgba(120,90,60,.12)'; ellipse(g, x * 100 + 50, y * 100 + 50, 26, 26); g.stroke();
  }
}, [0, 0]);

add('curb', 200, 40, (g) => {
  g.fillStyle = '#b0b7bd'; g.fillRect(0, 0, 200, 40);
  g.fillStyle = '#d5dade'; g.fillRect(0, 0, 200, 12);
  for (let x = 0; x < 200; x += 100) { g.fillStyle = '#7f8c8d'; g.fillRect(x, 0, 3, 40); }
}, [0, 0]);

add('road', 200, 200, (g) => {
  g.fillStyle = '#585e63'; g.fillRect(0, 0, 200, 200);
  g.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 0; i < 60; i++) g.fillRect((i * 37) % 200, (i * 53) % 200, 4, 4);
  g.fillStyle = '#f5f5f5'; g.fillRect(20, 112, 110, 12);
}, [0, 0]);

add('bus_stop', 160, 520, (g) => {
  roundRect(g, 72, 120, 14, 400, 4); fill(g, '#7f8c8d', 3);
  roundRect(g, 10, 10, 140, 130, 14); fill(g, '#2e86de');
  roundRect(g, 34, 34, 92, 56, 10); fill(g, '#fff', 3);
  roundRect(g, 44, 44, 72, 30, 6); fill(g, '#74b9ff', 3);
  ellipse(g, 56, 92, 8, 8); fill(g, '#2c3e50', 2);
  ellipse(g, 104, 92, 8, 8); fill(g, '#2c3e50', 2);
  drawText(g, 'XE BUÝT', 80, 118, 22, '#fff');
}, [0.5, 0]);

add('motorbike', 300, 200, (g) => {
  ellipse(g, 60, 160, 34, 34); fill(g, '#2c3e50'); ellipse(g, 60, 160, 14, 14); fill(g, '#bdc3c7', 3);
  ellipse(g, 240, 160, 34, 34); fill(g, '#2c3e50'); ellipse(g, 240, 160, 14, 14); fill(g, '#bdc3c7', 3);
  g.beginPath(); g.moveTo(40, 130); g.quadraticCurveTo(80, 90, 150, 104); g.lineTo(230, 104); g.quadraticCurveTo(262, 110, 262, 140); g.lineTo(80, 150); g.closePath(); fill(g, '#e74c3c');
  roundRect(g, 120, 86, 90, 22, 10); fill(g, '#2c3e50');
  roundRect(g, 236, 60, 12, 60, 4); fill(g, '#7f8c8d', 3);
  roundRect(g, 226, 52, 40, 12, 5); fill(g, '#2c3e50', 3);
  ellipse(g, 268, 112, 10, 8); fill(g, '#ffeaa7', 3);
  roundRect(g, 150, 30, 46, 64, 14); fill(g, '#3498db');
  ellipse(g, 182, 18, 22, 22); fill(g, '#f6d2b0');
  g.beginPath(); g.moveTo(160, 18); g.bezierCurveTo(158, -10, 206, -10, 204, 18); g.closePath(); fill(g, '#f1c40f');
  roundRect(g, 186, 52, 54, 12, 6); fill(g, '#f6d2b0', 3);
  roundRect(g, 150, 88, 70, 18, 8); fill(g, '#2c3e50', 3);
}, [0.5, 0]);

add('shadow', 160, 40, (g) => { ellipse(g, 80, 20, 70, 16); g.fillStyle = 'rgba(0,0,0,.22)'; g.fill(); }, [0.5, 0.5]);
add('coin', 64, 64, (g) => { ellipse(g, 32, 32, 28, 28); fill(g, gradient(g, 0, 4, 0, 60, [[0, '#ffe066'], [1, '#f08c00']]), 4, '#a65b00'); drawText(g, 'đ', 32, 31, 32, '#a65b00'); }, [0.5, 0.5]);

// ---------- DISTRICT LAND STRIPS ----------
function landStrip(name, ground, draw) {
  add(name, 1000, 300, (g) => {
    g.fillStyle = gradient(g, 0, 0, 0, 300, ground); g.fillRect(0, 0, 1000, 300);
    draw(g);
  }, [0, 0]);
}
landStrip('bg_land_0', [[0, '#c9b078'], [1, '#a98a54']], (g) => {
  [[120, 90], [420, 150], [760, 70], [900, 190], [260, 230]].forEach(([x, y]) => stroke(g, `M${x} ${y}q10 -24 20 0M${x + 14} ${y}q10 -30 20 0`, '#6f8f38', 4));
  stroke(g, 'M0 40H1000', '#8d6e4f', 5);
  [60, 220, 380, 540, 700, 860].forEach((x) => stroke(g, `M${x} 0V60`, '#8d6e4f', 7));
});
landStrip('bg_land_1', [[0, '#8fc7d8'], [0.45, '#6fb1c7'], [0.46, '#b7c98a'], [1, '#90a964']], (g) => {
  [60, 300, 620, 860].forEach((x) => stroke(g, `M${x} 60q30 -12 60 0t60 0`, '#d6eef5', 4));
  [[180, 150], [520, 170], [800, 150]].forEach(([x, y]) => { stroke(g, `M${x} ${y + 60}V${y}`, '#6a4a2c', 9); dot(g, x, y - 18, 34, '#4f9e58'); });
});
landStrip('bg_land_2', [[0, '#d8cdb7'], [1, '#b8a98d']], (g) => {
  for (let i = 0; i < 6; i++) {
    const x = 30 + i * 165; roundRect(g, x, 60, 130, 100, 6); fill(g, ['#e8a87c', '#c9d6a3', '#f2cf7e'][i % 3], 3);
    poly(g, [[x - 8, 60], [x + 138, 60], [x + 124, 30], [x + 6, 30]]); fill(g, i % 2 ? '#d63a3a' : '#2e86de', 3);
  }
});
landStrip('bg_land_3', [[0, '#e5d8b8'], [1, '#c6b58d']], (g) => {
  for (let i = 0; i < 5; i++) {
    const x = 20 + i * 200; shape(g, `M${x} 150V50H${x + 160}V150Z`, '#e8c766', 3);
    shape(g, `M${x - 12} 50L${x + 80} 8L${x + 172} 50Z`, '#8f4a32', 3);
    roundRect(g, x + 60, 88, 40, 62, 18); fill(g, '#5b4636', 3);
  }
});

// ---------- LOTS & CROPS ----------
add('lot_soil', 900, 200, (g) => {
  g.fillStyle = gradient(g, 0, 0, 0, 200, [[0, '#94673f'], [1, '#6b4528']]); g.fillRect(0, 0, 900, 200);
  for (let x = 75; x < 900; x += 75) stroke(g, `M${x} 14V186`, '#4a2f1a', 3.2);
  [[150, 60], [380, 140], [610, 70], [790, 150], [260, 160]].forEach(([x, y]) => dot(g, x, y, 5, '#b08a60', 1.4));
  g.lineWidth = 4; g.strokeStyle = INK; g.strokeRect(2, 2, 896, 196);
}, [0.5, 0.5]);

add('lot_empty', 220, 200, (g) => {
  stroke(g, 'M110 200V90', '#8d6e4f', 14);
  roundRect(g, 14, 14, 192, 88, 10); fill(g, '#fff7e0', 4);
  drawText(g, 'LÔ ĐẤT', 110, 44, 30, '#8a3b12');
  drawText(g, 'Chạm để xây', 110, 78, 22, '#8a3b12');
});

function bananaLeaf(g, x, y, angle, length) {
  g.save(); g.translate(x, y); g.rotate((angle * Math.PI) / 180);
  const k = length / 90;
  shape(g, `M0 0C${26 * k} ${-30 * k} ${64 * k} ${-30 * k} ${90 * k} 0C${64 * k} ${14 * k} ${26 * k} ${14 * k} 0 0Z`, gradient(g, 0, -24 * k, 0, 12 * k, [[0, '#8ad66f'], [1, '#23803d']]));
  stroke(g, `M0 0L${88 * k} 0`, '#1d6a33', 1.5);
  g.restore();
}
const trunkFill = (g, x0, x1) => gradient(g, x0, 0, x1, 0, [[0, '#6f8f38'], [0.55, '#b6cf6a'], [1, '#7c9a3f']]);

add('garden_bed', 220, 70, (g) => {
  ellipse(g, 110, 40, 102, 26); fill(g, gradient(g, 0, 14, 0, 66, [[0, '#94673f'], [1, '#553620']]));
  stroke(g, 'M40 36Q60 30 80 36M100 44Q120 38 140 44M150 32Q168 28 184 34', '#3f2715', 2.4);
}, [0.5, 0.35]);

add('banana_stage_1', 190, 300, (g) => {
  shape(g, 'M90 292L92 262H98L100 292Z', trunkFill(g, 90, 100));
  bananaLeaf(g, 95, 268, -135, 50); bananaLeaf(g, 95, 262, -48, 50);
});
add('banana_stage_2', 190, 300, (g) => {
  shape(g, 'M85 292L89 186H101L105 292Z', trunkFill(g, 85, 105));
  [[-156, 76], [-106, 70], [-62, 70], [-20, 70]].forEach(([a, l]) => bananaLeaf(g, 95, 188, a, l));
});
add('banana_stage_3', 190, 300, (g) => {
  shape(g, 'M79 292L85 104H105L111 292Z', trunkFill(g, 79, 111));
  [[-170, 90], [-132, 92], [-92, 90], [-52, 92], [-14, 60]].forEach(([a, l]) => bananaLeaf(g, 95, 106, a, l));
  stroke(g, 'M103 114Q133 114 137 142V232', '#6e8f3a', 5);
  const yellow = gradient(g, 0, 140, 0, 214, [[0, '#ffe873'], [1, '#e0a51f']]);
  [142, 166, 190].forEach((y) => {
    shape(g, `M135 ${y}Q115 ${y + 2} 111 ${y + 26}Q125 ${y + 22} 137 ${y + 12}Z`, yellow);
    shape(g, `M139 ${y}Q159 ${y + 2} 163 ${y + 26}Q149 ${y + 22} 137 ${y + 12}Z`, yellow);
  });
  shape(g, 'M137 228Q125 246 137 268Q149 246 137 228Z', '#7d3c98');
});

function lowPlant(g, stem, leaves) {
  shape(g, stem, trunkFill(g, 80, 110));
  leaves.forEach(([x, y, a, l]) => bananaLeaf(g, x, y, a, l));
}
add('crop_mung_bean_1', 190, 300, (g) => lowPlant(g, 'M92 292V270H98V292Z', [[95, 272, -135, 34], [95, 272, -48, 34]]));
add('crop_mung_bean_2', 190, 300, (g) => lowPlant(g, 'M91 292L92 222H98L99 292Z', [[95, 250, -160, 46], [95, 236, -120, 46], [95, 236, -60, 46], [95, 250, -20, 46]]));
add('crop_mung_bean_3', 190, 300, (g) => {
  lowPlant(g, 'M90 292L92 196H98L100 292Z', [[95, 240, -165, 56], [95, 216, -130, 56], [95, 200, -90, 50], [95, 216, -50, 56], [95, 240, -15, 56]]);
  [[62, 248], [128, 248], [74, 216], [116, 216]].forEach(([x, y]) => shape(g, `M${x} ${y}q10 26 0 44q-12 -20 0 -44Z`, '#7cb342', 1.8));
});

function caneStalks(g, top, count) {
  for (let i = 0; i < count; i++) {
    const x = 60 + i * 26;
    shape(g, `M${x} 292V${top}H${x + 12}V292Z`, gradient(g, x, 0, x + 12, 0, [[0, '#7d3c98'], [1, '#b56ccf']]));
    for (let y = top + 30; y < 288; y += 34) stroke(g, `M${x} ${y}H${x + 12}`, '#532a68', 2);
    bananaLeaf(g, x + 6, top + 4, -130, 44); bananaLeaf(g, x + 6, top + 4, -50, 44);
  }
}
add('crop_sugarcane_1', 190, 300, (g) => caneStalks(g, 240, 2));
add('crop_sugarcane_2', 190, 300, (g) => caneStalks(g, 170, 3));
add('crop_sugarcane_3', 190, 300, (g) => caneStalks(g, 90, 4));

// ---------- BUILDINGS ON LOTS ----------
function shopFront(name, wall, awning, sign, draw) {
  add(name, 360, 420, (g) => {
    shape(g, 'M20 90H340V420H20Z', gradient(g, 0, 90, 0, 420, [[0, shade(wall, 0.15)], [1, shade(wall, -0.12)]]), 4);
    shape(g, 'M10 96L180 30L350 96Z', '#b5533c', 4);
    roundRect(g, 40, 112, 280, 62, 8); fill(g, '#fff7e0', 4); drawText(g, sign, 180, 144, 34, '#8a3b12');
    for (let i = 0; i < 8; i++) { poly(g, [[20 + i * 40, 190], [60 + i * 40, 190], [60 + i * 40, 226], [20 + i * 40, 226]]); fill(g, i % 2 ? '#fff' : awning, 3); }
    roundRect(g, 60, 246, 240, 174, 8); fill(g, '#5b4636', 4);
    draw(g);
  });
}
shopFront('building_tea_shop', '#7fc8a9', '#2e86de', 'QUÁN TRÀ ĐÁ', (g) => {
  [[100, 330], [180, 330], [260, 330]].forEach(([x, y]) => { roundRect(g, x - 18, y, 36, 50, 6); fill(g, 'rgba(220,240,255,.85)', 3); g.fillStyle = '#c8873d'; g.fillRect(x - 13, y + 18, 26, 28); });
});
shopFront('building_store', '#c9b18d', '#8d6e4f', 'KHO HÀNG', (g) => {
  [[110, 320], [200, 340], [150, 370]].forEach(([x, y]) => { roundRect(g, x - 34, y, 68, 48, 4); fill(g, '#c79a5b', 3); stroke(g, `M${x} ${y}V${y + 48}`, '#8a6432', 2); });
});
shopFront('building_grocery', '#f2c572', '#e74c3c', 'TẠP HÓA', (g) => {
  [270, 330].forEach((y) => { g.fillStyle = '#8a6a4f'; g.fillRect(70, y + 46, 220, 6); [90, 140, 190, 240].forEach((x, i) => { roundRect(g, x, y, 34, 46, 5); fill(g, ['#e84393', '#27ae60', '#2e86de', '#f39c12'][i], 3); }); });
});
shopFront('building_barber', '#a8d0e6', '#d63031', 'CẮT TÓC', (g) => {
  roundRect(g, 150, 270, 60, 100, 30); fill(g, '#dff3ff', 4); roundRect(g, 310, 240, 26, 110, 10); fill(g, '#fff', 3);
  [260, 290, 320].forEach((y) => { g.fillStyle = '#d63031'; g.fillRect(314, y, 18, 12); });
});
shopFront('building_kitchen', '#f0d9a8', '#e67e22', 'BẾP NHÀ', (g) => {
  roundRect(g, 120, 320, 120, 90, 8); fill(g, '#6d7680', 4);
  ellipse(g, 180, 322, 46, 18); fill(g, '#adb5bd', 3);
  stroke(g, 'M150 300q10 -18 0 -36M180 300q10 -18 0 -36M210 300q10 -18 0 -36', '#ffffff', 5);
});
shopFront('building_cafe', '#c59b6d', '#8a4b2a', 'CÀ PHÊ PHỐ', (g) => {
  roundRect(g, 110, 310, 140, 80, 8); fill(g, '#6d4c3d', 4);
  ellipse(g, 150, 315, 24, 12); fill(g, '#fff', 2);
  ellipse(g, 210, 315, 24, 12); fill(g, '#fff', 2);
  stroke(g, 'M150 300q6 -12 0 -24M210 300q6 -12 0 -24', '#ffffff', 4);
});
add('building_stage', 360, 420, (g) => {
  shape(g, 'M30 300H330V420H30Z', gradient(g, 0, 300, 0, 420, [[0, '#a0652e'], [1, '#6a3f1b']]), 4);
  shape(g, 'M40 80H320V300H40Z', '#7a1f2b', 4);
  shape(g, 'M40 80Q110 170 60 300H40Z', '#c0392b', 3); shape(g, 'M320 80Q250 170 300 300H320Z', '#c0392b', 3);
  roundRect(g, 50, 30, 260, 60, 10); fill(g, '#ffd43b', 4); drawText(g, 'SÂN KHẤU XÓM', 180, 60, 28, '#7a1f2b');
  [90, 150, 210, 270].forEach((x) => dot(g, x, 104, 8, '#ffe066'));
});
add('building_scaffold', 360, 420, (g) => {
  ['M50 420V110M180 420V90M310 420V110', 'M40 180H320M40 280H320M40 370H320', 'M50 280L180 180L310 280'].forEach((d) => stroke(g, d, '#8d6e4f', 12));
  roundRect(g, 90, 300, 180, 54, 8); fill(g, '#ffd43b', 4); drawText(g, 'ĐANG XÂY', 180, 327, 28, '#5c3a12');
});

// ---------- DECORATIONS ----------
add('deco_peach_tree', 200, 300, (g) => {
  shape(g, 'M70 300H130L120 256H80Z', '#b5533c');
  stroke(g, 'M100 258Q96 200 76 160M98 214Q120 180 142 150M92 190Q70 170 50 150', '#5b3a22', 8);
  [[76, 150], [142, 142], [50, 140], [100, 110], [120, 170], [66, 106], [136, 100], [100, 66], [160, 120], [36, 110]].forEach(([x, y]) => {
    dot(g, x, y, 13, '#ff9fb2', 1.6); dot(g, x, y, 4, '#ffe066', 0);
  });
});
add('deco_star_lantern', 200, 300, (g) => {
  stroke(g, 'M100 300V150', '#7b5a2a', 8);
  poly(g, Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 34 : 80, a = -Math.PI / 2 + (i * Math.PI) / 5; return [100 + Math.cos(a) * r, 100 + Math.sin(a) * r]; }));
  fill(g, gradient(g, 0, 20, 0, 180, [[0, '#ffd43b'], [1, '#e03131']]), 4, INK);
});
add('deco_xmas_tree', 200, 300, (g) => {
  shape(g, 'M84 300H116V262H84Z', '#6a3f1b');
  ['M100 150L176 270H24Z', 'M100 90L160 190H40Z', 'M100 30L142 120H58Z'].forEach((d) => shape(g, d, gradient(g, 0, 30, 0, 270, [[0, '#3fa34d'], [1, '#1d6a33']])));
  [[80, 150, '#e03131'], [122, 176, '#ffd43b'], [72, 226, '#4dabf7'], [132, 240, '#e03131'], [100, 104, '#ffd43b']].forEach(([x, y, c]) => dot(g, x, y, 7, c, 1.6));
});
add('deco_flower_basket', 200, 300, (g) => {
  stroke(g, 'M60 230Q100 70 140 230', '#8a6432', 7);
  [[66, 190], [100, 170], [134, 190], [84, 212], [118, 212]].forEach(([x, y], i) => dot(g, x, y, 17, ['#ff8fa3', '#ffd43b', '#da77f2', '#ff6b6b', '#74c0fc'][i], 1.6));
  shape(g, 'M50 226H150L134 300H66Z', gradient(g, 0, 226, 0, 300, [[0, '#c79a5b'], [1, '#8a6432']]));
});
add('deco_summer_fair', 200, 300, (g) => {
  stroke(g, 'M30 300V60M170 300V60', '#7b5a2a', 8); stroke(g, 'M30 70Q100 120 170 70', '#7b5a2a', 3);
  [[54, 86, '#e03131'], [84, 100, '#ffd43b'], [116, 100, '#2f9e44'], [146, 86, '#1c7ed6']].forEach(([x, y, c]) => { poly(g, [[x - 13, y], [x + 13, y], [x, y + 32]]); fill(g, c, 2.2, INK); });
});
add('deco_trophy', 200, 300, (g) => {
  shape(g, 'M70 300H130V274H70Z', '#6a3f1b'); shape(g, 'M90 274H110V220H90Z', '#d9a42e');
  stroke(g, 'M58 130Q24 130 34 170Q44 196 74 196M142 130Q176 130 166 170Q156 196 126 196', '#d9a42e', 8);
  shape(g, 'M56 110H144Q144 214 100 224Q56 214 56 110Z', gradient(g, 56, 110, 144, 224, [[0, '#ffe873'], [1, '#d9a42e']]));
});

// ---------- WORLD-SPACE UI TAGS & BUBBLES ----------
add('ui_tag', 128, 64, (g) => {
  roundRect(g, 4, 4, 120, 56, 28); g.fillStyle = 'rgba(30,20,10,.62)'; g.fill();
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke();
}, [0.5, 0.5], [30, 30, 30, 30]);

add('ui_speech_bubble', 96, 80, (g) => {
  roundRect(g, 4, 4, 88, 58, 20); g.fillStyle = '#fff'; g.fill();
  poly(g, [[38, 60], [58, 60], [44, 76]]); g.fill();
  roundRect(g, 4, 4, 88, 58, 20); g.lineWidth = 3; g.strokeStyle = OUTLINE; g.stroke();
  g.beginPath(); g.moveTo(38, 62); g.lineTo(44, 76); g.lineTo(58, 62); g.stroke();
}, [0.5, 0], [30, 30, 30, 24]);

// ---------- CHARACTER LAYER SYSTEM ----------
function maleFace(g) {
  ellipse(g, 46, 116, 11, 15); g.fillStyle = skinFill(g); g.fill(); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
  stroke(g, 'M44 110Q50 116 46 124', '#a9683c', 1.8);
  ellipse(g, 152, 114, 8, 12); g.fillStyle = skinFill(g); g.fill(); g.lineWidth = 2.0; g.strokeStyle = INK; g.stroke();
  shape(g, 'M100 32C140 32 154 64 152 108C151 138 140 156 122 165C110 170 90 170 78 165C60 156 48 138 48 108C46 64 60 32 100 32Z', skinFill(g), 2.4);
  const sh = new Path2D('M54 122C60 144 78 162 100 166C76 168 56 150 48 128Z');
  g.fillStyle = 'rgba(168,104,63,0.3)'; g.fill(sh);
  ellipse(g, 78, 120, 13, 15); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 2.0; g.strokeStyle = INK; g.stroke();
  ellipse(g, 122, 118, 11, 14); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 2.0; g.strokeStyle = INK; g.stroke();
  dot(g, 80, 121, 8.2, '#140c08', 0); dot(g, 124, 119, 7.2, '#140c08', 0);
  dot(g, 83, 117, 3.0, '#ffffff', 0); dot(g, 126, 115, 2.6, '#ffffff', 0);
  dot(g, 76, 125, 1.5, '#ffffff', 0); dot(g, 120, 123, 1.3, '#ffffff', 0);
  stroke(g, 'M64 112Q78 100 92 112', '#140c08', 3.6); stroke(g, 'M110 110Q122 100 134 110', '#140c08', 3.6);
  stroke(g, 'M98 125Q104 134 98 138', '#a9683c', 2.2);
}

function femaleFace(g) {
  ellipse(g, 48, 118, 10, 14); g.fillStyle = skinFill(g); g.fill(); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
  stroke(g, 'M46 112Q51 118 48 124', '#a9683c', 1.6);
  ellipse(g, 150, 116, 7, 11); g.fillStyle = skinFill(g); g.fill(); g.lineWidth = 2.0; g.strokeStyle = INK; g.stroke();
  shape(g, 'M100 34C138 34 152 64 150 106C149 134 138 154 120 164C110 168 90 168 80 164C62 154 50 134 50 106C48 64 62 34 100 34Z', skinFill(g), 2.4);
  const sh = new Path2D('M56 122C62 142 80 160 100 164C78 166 60 148 52 128Z');
  g.fillStyle = 'rgba(168,104,63,0.3)'; g.fill(sh);
  ellipse(g, 78, 120, 13, 15); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 2.0; g.strokeStyle = INK; g.stroke();
  ellipse(g, 122, 118, 11, 14); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 2.0; g.strokeStyle = INK; g.stroke();
  dot(g, 80, 121, 8.4, '#1c100a', 0); dot(g, 124, 119, 7.4, '#1c100a', 0);
  dot(g, 83, 117, 3.2, '#ffffff', 0); dot(g, 126, 115, 2.7, '#ffffff', 0);
  dot(g, 76, 125, 1.6, '#ffffff', 0); dot(g, 120, 123, 1.4, '#ffffff', 0);
  stroke(g, 'M64 113Q77 101 92 111L96 107M88 107L93 103', '#140c08', 3.6);
  stroke(g, 'M110 111Q121 101 134 110L138 106M130 106L135 102', '#140c08', 3.6);
  stroke(g, 'M99 127Q103 133 99 136', '#a9683c', 2.0);
}

function maleBody(g, step) {
  const a = step === 1 ? -8 : step === 2 ? 8 : 0;
  const backArmX = step === 1 ? 142 : step === 2 ? 128 : 138;
  const backArmY = step === 1 ? 236 : step === 2 ? 248 : 242;
  limb(g, `M128 194Q142 214 ${backArmX} ${backArmY}`, 9);
  dot(g, backArmX, backArmY, 7.5, '#efb684');
  shape(g, `M${108 - a} 272L${109 - a} 306H${120 - a}L120 - a 272Z`, '#e9b283');
  shape(g, `M${104 - a} 306Q${118 - a} 298 ${130 - a} 306L130 - a 314H${104 - a}Z`, gradient(g, 0, 304, 0, 314, [[0, '#fbbf24'], [1, '#d97706']]));
  [110, 116, 122].forEach((hx) => { g.fillStyle = '#92400e'; g.beginPath(); g.arc(hx - a, 310, 1.3, 0, Math.PI * 2); g.fill(); });
  shape(g, `M${80 + a} 272L${78 + a} 306H${89 + a}L92 + a 272Z`, '#e9b283');
  shape(g, `M${72 + a} 306Q${84 + a} 298 ${96 + a} 306L96 + a 314H${72 + a}Z`, gradient(g, 0, 304, 0, 314, [[0, '#fbbf24'], [1, '#d97706']]));
  [78, 84, 90].forEach((hx) => { g.fillStyle = '#92400e'; g.beginPath(); g.arc(hx + a, 310, 1.3, 0, Math.PI * 2); g.fill(); });
  shape(g, 'M68 242Q100 248 132 242L136 278L108 280L100 262L92 280L64 278Z', gradient(g, 0, 242, 0, 280, [[0, '#3b82f6'], [1, '#1d4ed8']]), 2.4);
  stroke(g, 'M128 244L132 278', '#ffffff', 3.0);
  dot(g, 100, 248, 2.4, '#ffffff', 0);
  stroke(g, 'M97 250Q91 258 95 264M103 250Q109 258 105 264', '#ffffff', 2.0);
  shape(g, 'M90 164H110V190H90Z', '#e9b283');
  stroke(g, 'M88 188Q100 196 112 188', '#c67b45', 1.8);
  shape(g, 'M74 186L64 212Q62 232 66 244Q100 252 134 244Q138 232 136 212L126 186L114 186Q100 200 86 186Z', gradient(g, 64, 186, 136, 246, [[0, '#ffffff'], [0.7, '#edf2f7'], [1, '#cbd5e1']]), 2.4);
  stroke(g, 'M86 218Q100 226 114 218M88 230Q100 236 112 230', '#94a3b8', 1.8);
  const frontArmX = step === 1 ? 52 : step === 2 ? 68 : 60;
  const frontArmY = step === 1 ? 236 : step === 2 ? 248 : 242;
  limb(g, `M72 194Q56 214 ${frontArmX} ${frontArmY}`, 9.5);
  shape(g, `M${frontArmX - 6} ${frontArmY - 6}C${frontArmX - 12} ${frontArmY - 4} ${frontArmX - 10} ${frontArmY + 8} ${frontArmX - 2} ${frontArmY + 10}C${frontArmX + 6} ${frontArmY + 12} ${frontArmX + 10} ${frontArmY + 4} ${frontArmX + 6} ${frontArmY - 4}Z`, '#efb684', 1.8);
  maleFace(g);
}

function femaleBody(g, step) {
  const a = step === 1 ? -8 : step === 2 ? 8 : 0;
  const backArmX = step === 1 ? 138 : step === 2 ? 126 : 134;
  const backArmY = step === 1 ? 236 : step === 2 ? 248 : 242;
  limb(g, `M126 194Q138 214 ${backArmX} ${backArmY}`, 8.5);
  dot(g, backArmX, backArmY, 6.8, '#efb684');
  shape(g, `M${106 - a} 270L${108 - a} 306H${118 - a}L118 - a 270Z`, '#e9b283');
  shape(g, `M${102 - a} 306Q${114 - a} 298 ${126 - a} 306L126 - a 313H${102 - a}Z`, gradient(g, 0, 306, 0, 313, [[0, '#f472b6'], [1, '#db2777']]));
  stroke(g, `M${110 - a} 304L${115 - a} 309M${119 - a} 304L${115 - a} 309`, '#ffffff', 1.8);
  shape(g, `M${82 + a} 270L${80 + a} 306H${90 + a}L92 + a 270Z`, '#e9b283');
  shape(g, `M${74 + a} 306Q${86 + a} 298 ${96 + a} 306L96 + a 313H${74 + a}Z`, gradient(g, 0, 306, 0, 313, [[0, '#f472b6'], [1, '#db2777']]));
  stroke(g, `M${82 + a} 304L${87 + a} 309M${91 + a} 304L${87 + a} 309`, '#ffffff', 1.8);
  shape(g, 'M91 164H109V190H91Z', '#e9b283');
  shape(g, 'M82 210Q78 226 80 244H120Q122 226 118 210Z', '#e9b283');
  dot(g, 100, 228, 1.5, '#a9683c', 0);
  shape(g, 'M74 240Q100 246 126 240L130 272L108 274L100 256L92 274L70 272Z', gradient(g, 0, 240, 0, 274, [[0, '#60a5fa'], [1, '#2563eb']]), 2.4);
  stroke(g, 'M76 250H124M100 242V256', '#1e3a8a', 1.6);
  dot(g, 100, 246, 1.6, '#eab308', 0);
  shape(g, 'M76 186L66 214Q100 224 134 214L124 186L112 186Q100 198 88 186Z', gradient(g, 66, 186, 134, 224, [[0, '#fb7185'], [1, '#e11d48']]), 2.4);
  stroke(g, 'M74 206Q100 214 126 206', '#ffe4e6', 2.4);
  const frontArmX = step === 1 ? 58 : step === 2 ? 72 : 66;
  const frontArmY = step === 1 ? 236 : step === 2 ? 248 : 242;
  limb(g, `M74 194Q60 214 ${frontArmX} ${frontArmY}`, 8.5);
  dot(g, frontArmX, frontArmY, 6.8, '#efb684');
  femaleFace(g);
}

[0, 1, 2].forEach((step) => {
  const suffix = step ? `_step${step}` : '';
  layer(`body_male${suffix}`, (g) => maleBody(g, step));
  layer(`body_female${suffix}`, (g) => femaleBody(g, step));
});

const darkHair = (g) => gradient(g, 0, 16, 0, 120, [[0, '#5a4638'], [1, '#17110e']]);
const brownHair = (g) => gradient(g, 30, 20, 180, 170, [[0, '#7b4a2c'], [1, '#2a140c']]);

const HAIR_MALE = [
  'M26 114C12 56 54 14 106 15C156 16 192 56 183 102C178 94 172 88 166 86C162 74 150 70 138 72C126 62 108 68 94 66C84 76 70 80 62 92C58 102 56 112 50 116C44 106 34 104 26 114Z',
  'M28 112C14 50 60 14 110 16C160 18 192 58 182 100C170 84 150 66 120 58C112 72 84 82 62 88C58 100 56 110 50 114C44 104 34 104 28 112Z',
  'M28 110L20 74L38 76L34 44L54 52L58 18L78 36L96 10L110 34L132 12L140 38L164 26L164 54L186 54L176 84L182 104C170 88 150 78 130 78C104 80 76 84 60 92C56 102 54 110 50 114C44 104 34 104 28 110Z',
  'M32 100C32 54 62 24 106 24C150 24 178 58 178 96C164 72 136 60 104 60C76 60 58 72 50 96C46 92 38 92 32 100Z',
];
HAIR_MALE.forEach((d, i) => layer(`hair_male_${i}`, (g) => {
  shape(g, d, darkHair(g));
  stroke(g, 'M60 58Q76 34 104 30M84 62Q100 42 130 42', 'rgba(156,131,112,.6)', 2.4);
}));

const HAIR_FEMALE = [
  'M34 112C26 58 62 22 106 22C150 24 182 60 176 106C172 92 164 82 152 76C142 70 130 68 120 74C100 90 78 94 62 92C60 100 58 106 54 108C48 100 40 102 34 112Z',
  'M34 118C24 58 62 20 106 20C152 22 186 60 178 118C172 96 160 78 140 72C118 86 88 84 66 78C58 90 54 106 52 116C46 108 40 110 34 118Z',
  'M34 112C26 58 62 22 106 22C150 24 182 60 176 110C170 84 148 68 112 66C92 66 74 74 62 90C58 100 56 108 52 110C46 104 40 104 34 112Z',
  'M36 104C30 58 64 24 108 24C150 26 180 60 174 100L160 84L150 92L138 76L122 88L106 74L88 86L74 80L60 96C58 102 56 106 52 108C46 100 40 100 36 104Z',
];
const HAIR_BACK = [
  'M34 108C22 46 64 14 108 16C156 18 190 58 182 112C180 124 176 134 170 142L44 148C22 158 16 180 26 198C32 208 44 206 46 194C50 176 54 158 64 146Z',
  'M30 104C20 44 62 12 108 14C158 16 192 56 184 112C182 142 176 160 168 176C154 184 140 176 134 164L60 164C50 180 34 178 28 160Z',
  'M30 104C20 44 62 12 108 14C158 16 192 56 184 112C186 160 182 200 170 226C150 232 134 214 134 170L60 170C60 214 44 232 26 226C22 190 26 150 30 104Z',
  null,
];
HAIR_FEMALE.forEach((d, i) => {
  if (HAIR_BACK[i]) layer(`hairback_female_${i}`, (g) => shape(g, HAIR_BACK[i], brownHair(g)));
  layer(`hair_female_${i}`, (g) => {
    shape(g, d, brownHair(g));
    stroke(g, 'M62 62Q84 36 118 36M90 74Q112 52 146 58', 'rgba(192,138,96,.6)', 2.4);
    if (i === 0) {
      const cx = 68, cy = 84;
      [[0, -4.5], [4.5, 0], [0, 4.5], [-4.5, 0]].forEach(([dx, dy]) => {
        dot(g, cx + dx, cy + dy, 3.4, '#22c55e', 1.4);
      });
      dot(g, cx, cy, 1.6, '#fef08a', 0);
    }
  });
});

const BROWS = [
  (g) => { shape(g, 'M98 106L130 101L130 107L100 114Z', '#20140e', 1); shape(g, 'M148 101L172 103L172 108L150 107Z', '#20140e', 1); },
  (g) => stroke(g, 'M104 106Q118 97 132 106M150 104Q160 98 170 106', '#3a2015', 3.2),
  (g) => stroke(g, 'M102 98L132 110M172 98L148 110', '#20140e', 5),
  (g) => stroke(g, 'M106 104Q118 100 130 104M152 102Q160 99 168 103', '#3a2015', 2),
];
BROWS.forEach((draw, i) => layer(`brows_${i}`, draw));

const LIPS = [
  (g) => {
    shape(g, 'M126 154Q142 163 158 151Q152 165 138 165Q128 165 126 154Z', '#7a221a');
    stroke(g, 'M126 154Q142 163 158 151', '#2c140e', 2.4);
    stroke(g, 'M153 148Q160 152 158 156', '#2c140e', 1.8);
    stroke(g, 'M130 156Q142 160 154 153', '#ffffff', 2.6);
  },
  (g) => { shape(g, 'M124 150Q142 160 160 148Q154 168 140 168Q128 168 124 150Z', '#8b2f2f'); shape(g, 'M129 153Q142 158 156 151L153 156Q142 161 131 158Z', '#fff', 1); },
  (g) => { ellipse(g, 142, 154, 6, 7); g.fillStyle = '#8b2f2f'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke(); },
  (g) => shape(g, 'M130 153Q140 150 144 152Q148 150 154 152Q146 162 140 161Q134 160 130 153Z', '#c9374f', 1.5),
];
LIPS.forEach((draw, i) => layer(`lips_${i}`, draw));

layer('cheeks_1', (g) => { [[100, 146, 11], [150, 141, 7]].forEach(([x, y, r]) => dot(g, x, y, r, 'rgba(240,119,111,.35)', 0)); });
layer('cheeks_2', (g) => {
  g.save(); g.translate(96, 144); g.rotate(-0.16);
  roundRect(g, -13, -8, 26, 16, 4); g.fillStyle = '#fef3c7'; g.fill();
  g.lineWidth = 1.8; g.strokeStyle = '#b45309'; g.stroke();
  roundRect(g, -5, -5, 10, 10, 2); g.fillStyle = '#ffffff'; g.fill();
  g.lineWidth = 1.0; g.strokeStyle = '#d97706'; g.stroke();
  dot(g, -9, 0, 0.8, '#b45309', 0); dot(g, 9, 0, 0.8, '#b45309', 0);
  g.restore();
});
layer('earrings_1', (g) => { ellipse(g, 46, 142, 7, 7); g.lineWidth = 3; g.strokeStyle = '#e0ab3a'; g.stroke(); });
layer('earrings_2', (g) => dot(g, 44, 134, 4, '#f1f3f5', 1.6));
layer('earrings_3', (g) => { stroke(g, 'M44 132V144', '#e0ab3a', 2); shape(g, 'M44 144L50 152L44 160L38 152Z', '#e0ab3a', 1.6); });

const wearLayer = (id, draw) => layer(`wear_${id}`, draw);
wearLayer('conical', (g) => { shape(g, 'M14 78L104 2L192 78Q104 100 14 78Z', gradient(g, 0, 0, 0, 90, [[0, '#f6e2a8'], [1, '#c9a24f']])); stroke(g, 'M60 42Q104 54 150 42', '#a8843c', 1.6); });
wearLayer('helmet', (g) => { shape(g, 'M26 84C26 30 62 8 106 8C150 8 184 34 184 84Q106 66 26 84Z', gradient(g, 0, 8, 0, 84, [[0, '#57c7a6'], [1, '#1f7f64']])); shape(g, 'M178 76L198 92L176 90Z', '#1f7f64'); });
wearLayer('cap', (g) => { shape(g, 'M30 76C32 30 66 14 106 14C146 14 176 36 178 72Q104 56 30 76Z', gradient(g, 0, 14, 0, 76, [[0, '#e8574b'], [1, '#a92b23']])); shape(g, 'M150 62Q190 64 200 82Q170 80 142 74Z', '#7f1d17'); });
wearLayer('tank_top', (g) => { shape(g, 'M76 190L70 216Q68 232 70 242Q93 250 116 242Q118 230 116 214L110 190L101 190Q93 206 85 190Z', '#f2c94c'); });
wearLayer('floral', (g) => {
  shape(g, 'M72 190L66 244Q93 252 120 244L114 190Q94 200 72 190Z', gradient(g, 66, 190, 120, 248, [[0, '#4fb3bf'], [1, '#1f7a87']]));
  [[82, 208], [100, 216], [88, 232], [106, 234]].forEach(([x, y]) => { dot(g, x, y, 5, '#ff8fa3', 1); dot(g, x, y, 1.6, '#ffe066', 0); });
});
wearLayer('ao_dai', (g) => {
  shape(g, 'M74 188L66 240L60 300H128L122 240L114 188Q94 198 74 188Z', gradient(g, 60, 188, 128, 300, [[0, '#f4f0ff'], [1, '#b9a6e8']]));
  stroke(g, 'M94 196V300', '#8f79c9', 1.6);
});
wearLayer('jeans', (g) => { shape(g, 'M70 238Q92 246 116 238L118 306H102L94 262L88 306H72Z', gradient(g, 0, 238, 0, 306, [[0, '#5c7fb0'], [1, '#2c4a78']])); });
wearLayer('khaki', (g) => { shape(g, 'M70 238Q92 246 116 238L118 306H102L94 262L88 306H72Z', gradient(g, 0, 238, 0, 306, [[0, '#d6bb8a'], [1, '#a2845a']])); });
wearLayer('sunglasses', (g) => { shape(g, 'M104 116Q118 112 132 116Q132 134 116 134Q104 132 104 116Z', '#1c1c20'); shape(g, 'M146 114Q158 110 170 114Q170 130 158 130Q146 128 146 114Z', '#1c1c20'); stroke(g, 'M132 118H146', INK, 2.4); });
wearLayer('speaker', (g) => { shape(g, 'M134 254H170V298H134Z', '#2f3640'); dot(g, 152, 268, 8, '#596275', 1.6); dot(g, 152, 288, 5, '#596275', 1.6); stroke(g, 'M152 254Q152 240 136 244', INK, 2.4); });

// ---------- VEHICLES ----------
function wheel(g, x, y, r) { dot(g, x, y, r, '#2c2f33'); dot(g, x, y, r * 0.45, '#ced4da', 1.6); }
layer('vehicle_bicycle', (g) => { wheel(g, 40, 288, 26); wheel(g, 160, 288, 26); stroke(g, 'M40 288L84 216H136L160 288M84 216L108 288L136 216M84 216L76 200M136 216L142 190H164', '#d63031', 6); });
layer('vehicle_motorbike', (g) => {
  wheel(g, 38, 286, 28); wheel(g, 166, 286, 28);
  shape(g, 'M40 262Q44 220 84 214H124L146 188H168L176 200L154 214L168 262Q110 280 40 262Z', gradient(g, 0, 188, 0, 276, [[0, '#4dabf7'], [1, '#1c5fa8']]));
  shape(g, 'M60 214H122V230H60Z', '#2c2f33');
});
layer('vehicle_cargo_trike', (g) => {
  wheel(g, 30, 288, 24); wheel(g, 96, 288, 24); wheel(g, 170, 288, 24);
  shape(g, 'M6 210H112V268H6Z', gradient(g, 0, 210, 0, 268, [[0, '#a0652e'], [1, '#6a3f1b']]));
  stroke(g, 'M112 262H166L170 288M150 262L146 214H170', '#2f9e44', 7);
});

// ---------- NPC PORTRAITS & LEADERS ----------
add('npc_leader', 200, 200, (g) => {
  shape(g, 'M30 200Q40 150 100 146Q160 150 170 200Z', gradient(g, 0, 146, 0, 200, [[0, '#7fa36b'], [1, '#4d7040']]));
  shape(g, 'M38 170L70 160L74 180L44 192Z', '#d63a3a');
  ellipse(g, 44, 90, 12, 16); g.fillStyle = skinFill(g); g.fill(); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
  shape(g, 'M100 26C142 26 164 58 162 94C160 128 134 152 100 152C66 152 42 128 40 92C40 56 60 26 100 26Z', skinFill(g));
  shape(g, 'M42 88C34 46 64 16 102 16C140 16 170 46 160 88C154 64 134 52 112 54C84 56 62 64 54 88Z', gradient(g, 0, 16, 0, 88, [[0, '#f1f3f5'], [1, '#adb5bd']]));
  stroke(g, 'M72 84Q86 76 100 84M118 84Q130 76 144 84', '#868e96', 6);
  ellipse(g, 86, 100, 9, 10); g.fillStyle = '#fbf7ef'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
  ellipse(g, 130, 100, 9, 10); g.fillStyle = '#fbf7ef'; g.fill(); g.stroke();
  dot(g, 90, 101, 4.4, '#2a1810', 0); dot(g, 134, 101, 4.4, '#2a1810', 0);
  stroke(g, 'M110 104Q118 118 106 122', '#a9683c', 2.4);
  stroke(g, 'M84 130Q106 142 134 128', '#6d2b23', 3);
  stroke(g, 'M78 124Q106 112 138 124', '#ced4da', 7);
});

function portrait(name, skin, hair, body, draw) {
  add(name, 200, 200, (g) => {
    shape(g, 'M30 200Q40 150 100 146Q160 150 170 200Z', body);
    ellipse(g, 44, 92, 12, 16); g.fillStyle = skin; g.fill(); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
    shape(g, 'M100 26C142 26 164 58 162 94C160 128 134 152 100 152C66 152 42 128 40 92C40 56 60 26 100 26Z', skin);
    shape(g, hair, '#2a1d18');
    ellipse(g, 86, 100, 9, 10); g.fillStyle = '#fbf7ef'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
    ellipse(g, 130, 100, 9, 10); g.fillStyle = '#fbf7ef'; g.fill(); g.stroke();
    dot(g, 90, 101, 4.4, '#2a1810', 0); dot(g, 134, 101, 4.4, '#2a1810', 0);
    stroke(g, 'M110 104Q118 118 106 122', '#a9683c', 2.4);
    draw(g);
  });
}
portrait('npc_tea_seller', '#e8b98a', 'M42 92C34 48 64 18 102 18C140 18 170 48 160 92C150 66 120 60 100 62C78 60 54 68 42 92Z', '#8d6e9f', (g) => {
  ellipse(g, 100, 18, 26, 16); g.fillStyle = '#ced4da'; g.fill(); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
  stroke(g, 'M72 86Q86 80 100 86M118 86Q130 80 144 86', '#868e96', 4);
  stroke(g, 'M84 132Q108 146 134 130', '#7a2e2e', 3);
  stroke(g, 'M70 74L60 66M150 74L158 66', '#b97f55', 2);
});
portrait('npc_driver', '#d9a273', 'M42 86C40 44 66 22 102 22C138 22 164 44 160 86Q100 64 42 86Z', '#3f6d9f', (g) => {
  shape(g, 'M36 76C38 34 66 12 102 12C140 12 166 36 166 76Q100 60 36 76Z', '#2f9e44');
  shape(g, 'M160 66L194 78L160 84Z', '#1f7a35');
  stroke(g, 'M72 88L100 84M118 84L144 88', '#2a1d18', 5);
  stroke(g, 'M80 128Q106 148 138 126', '#6d2b23', 3);
  stroke(g, 'M84 118Q106 108 132 118', '#2a1d18', 5);
});
portrait('npc_grocer', '#f0c49b', 'M38 120C22 56 60 16 104 18C150 20 180 62 162 122C160 84 136 64 104 66C76 66 52 84 38 120Z', '#d9823b', (g) => {
  stroke(g, 'M76 88Q88 80 100 88M118 88Q130 80 142 88', '#2a1d18', 3.4);
  stroke(g, 'M86 132Q106 146 130 130', '#c9374f', 4);
  [[76, 100], [124, 100]].forEach(([x, y]) => { ellipse(g, x + 10, y, 18, 14); g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke(); });
});
portrait('npc_shipper', '#e3ad80', 'M42 80C42 40 68 20 104 20C140 22 162 44 160 80C146 66 124 58 102 60C78 60 56 66 42 80Z', '#e03131', (g) => {
  shape(g, 'M30 76C34 28 64 8 104 8C146 8 170 34 172 76Q100 52 30 76Z', '#f2c94c');
  stroke(g, 'M36 76Q100 54 168 76', '#a07a10', 3);
  stroke(g, 'M74 88L98 86M120 86L144 88', '#2a1d18', 4);
  stroke(g, 'M90 132Q112 140 134 128', '#6d2b23', 3);
});

export const HELPERS = { roundRect, fill, ellipse, poly, gradient, shade, drawText, shape, stroke, limb, dot, skinFill, add, layer, ui, gloss, OUTLINE, INK };

export const SPRITES = sprites;
