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
import { registerUiKit } from './ui-kit.js';

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
const skinFill = (g) => gradient(g, 0, 24, 0, 166, [[0, '#fff3e0'], [0.2, '#fed7aa'], [1, '#fbc58d']]);

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

// The UI kit (window frames, buttons, bars, badges, toasts, icons) lives in ui-kit.js, drawn in
// the ink-and-wash style of the outfit art. Names and 9-slice borders the layout code expects are
// in client/Assets/Scripts/Theme.cs.
registerUiKit(add);

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

// ---------- MISC ----------
add('coin', 64, 64, (g) => { ellipse(g, 32, 32, 28, 28); fill(g, gradient(g, 0, 4, 0, 60, [[0, '#ffe066'], [1, '#f08c00']]), 4, '#a65b00'); drawText(g, 'đ', 32, 31, 32, '#a65b00'); }, [0.5, 0.5]);

// ---------- NPC PORTRAITS ----------
// Neighbour portrait frame (200 x 200): add one with portrait('npc_<id>', skin, hairPath, shirt, (g) => { ... }).
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

export const HELPERS = { roundRect, fill, ellipse, poly, gradient, shade, drawText, shape, stroke, limb, dot, skinFill, add, layer, ui, gloss, portrait, OUTLINE, INK };

export const SPRITES = sprites;
