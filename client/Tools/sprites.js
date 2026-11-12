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

add('shadow', 160, 40, (g) => { ellipse(g, 80, 20, 70, 16); g.fillStyle = 'rgba(0,0,0,.22)'; g.fill(); }, [0.5, 0.5]);
add('coin', 64, 64, (g) => { ellipse(g, 32, 32, 28, 28); fill(g, gradient(g, 0, 4, 0, 60, [[0, '#ffe066'], [1, '#f08c00']]), 4, '#a65b00'); drawText(g, 'đ', 32, 31, 32, '#a65b00'); }, [0.5, 0.5]);

// ---------- DECORATIONS ----------
add('deco_peach_tree', 200, 300, (g) => {
  shape(g, 'M70 300H130L120 256H80Z', '#b5533c');
  stroke(g, 'M100 258Q96 200 76 160M98 214Q120 180 142 150M92 190Q70 170 50 150', '#5b3a22', 8);
  [[76, 150], [142, 142], [50, 140], [100, 110], [120, 170], [66, 106], [136, 100], [100, 66], [160, 120], [36, 110]].forEach(([x, y]) => {
    dot(g, x, y, 13, '#ff9fb2', 1.6); dot(g, x, y, 4, '#ffe066', 0);
  });
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
// Authentic Hàng Rong (Flash 2012) style: Big chubby head (ratio ~1:2), wide cheeks,
// small cheeky cartoon eyes, 2-tone cell-shading, iconic tank top and honeycomb sandals.
function maleFace(g) {
  // Ears
  ellipse(g, 32, 114, 9, 13); g.fillStyle = skinFill(g); g.fill(); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
  stroke(g, 'M30 108Q35 114 32 120', '#a9683c', 1.6);
  ellipse(g, 168, 114, 9, 13); g.fillStyle = skinFill(g); g.fill(); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
  stroke(g, 'M170 108Q165 114 168 120', '#a9683c', 1.6);

  // Big chubby caricature head contour (wide cheeks, short round chin)
  shape(g, 'M100 24C152 24 174 54 172 106C170 144 146 166 116 166H84C54 166 30 144 28 106C26 54 48 24 100 24Z', skinFill(g), 2.5);

  // Crisp chin / jawline cast shadow (Flash 2-tone cell shade)
  shape(g, 'M54 136C70 160 130 160 146 136C134 156 66 156 54 136Z', 'rgba(180,83,9,0.22)', 0);

  // Authentic Hàng Rong eyes (mắt hạt mè tấu hài / lém lỉnh, single crisp shine)
  // Left eye
  ellipse(g, 72, 112, 8.5, 9.5); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke();
  dot(g, 74, 112, 4.8, '#180e09', 0);
  dot(g, 76, 110, 1.3, '#ffffff', 0);
  stroke(g, 'M62 108Q72 100 82 109', '#140c08', 3.0);
  stroke(g, 'M67 121Q73 124 79 121', 'rgba(168,104,63,0.45)', 1.4);

  // Right eye
  ellipse(g, 128, 112, 8.5, 9.5); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke();
  dot(g, 130, 112, 4.8, '#180e09', 0);
  dot(g, 132, 110, 1.3, '#ffffff', 0);
  stroke(g, 'M118 109Q128 100 138 108', '#140c08', 3.0);
  stroke(g, 'M121 121Q127 124 133 121', 'rgba(168,104,63,0.45)', 1.4);

  // Characteristic street vendor hook nose
  stroke(g, 'M98 118Q105 127 97 131', '#9a532a', 2.4);
}

function femaleFace(g) {
  // Ears
  ellipse(g, 34, 114, 8.5, 12.5); g.fillStyle = skinFill(g); g.fill(); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
  stroke(g, 'M32 108Q37 114 34 120', '#a9683c', 1.6);
  ellipse(g, 166, 114, 8.5, 12.5); g.fillStyle = skinFill(g); g.fill(); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
  stroke(g, 'M168 108Q163 114 166 120', '#a9683c', 1.6);

  // Chubby rounded cute caricature head
  shape(g, 'M100 26C150 26 172 56 170 106C168 142 144 164 116 164H84C56 164 32 142 30 106C28 56 50 26 100 26Z', skinFill(g), 2.5);

  // Soft chin shadow
  shape(g, 'M56 136C72 158 128 158 144 136C132 154 68 154 56 136Z', 'rgba(180,83,9,0.20)', 0);

  // Big expressive eyes with cute Flash corner lashes
  ellipse(g, 72, 112, 9, 10); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke();
  dot(g, 74, 112, 5.0, '#180e09', 0);
  dot(g, 76, 110, 1.5, '#ffffff', 0);
  stroke(g, 'M61 108Q72 99 83 108M83 104L87 100', '#140c08', 3.0);

  ellipse(g, 128, 112, 9, 10); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke();
  dot(g, 130, 112, 5.0, '#180e09', 0);
  dot(g, 132, 110, 1.5, '#ffffff', 0);
  stroke(g, 'M117 108Q128 99 139 108M139 104L143 100', '#140c08', 3.0);

  // Cute peach blush dots
  dot(g, 54, 128, 7, 'rgba(251,113,133,0.35)', 0);
  dot(g, 146, 128, 7, 'rgba(251,113,133,0.35)', 0);

  // Button nose
  stroke(g, 'M98 120Q104 127 98 130', '#a9683c', 2.2);
}

function maleBody(g, step) {
  const a = step === 1 ? -8 : step === 2 ? 8 : 0;
  const backArmX = step === 1 ? 142 : step === 2 ? 128 : 138;
  const backArmY = step === 1 ? 236 : step === 2 ? 248 : 242;
  limb(g, `M128 194Q142 214 ${backArmX} ${backArmY}`, 9);
  dot(g, backArmX, backArmY, 7.5, '#efb684');
  shape(g, `M${108 - a} 272L${109 - a} 306H${120 - a}L120 - a 272Z`, '#e9b283');
  // Back honeycomb sandal (dép tổ ong)
  shape(g, `M${104 - a} 306Q${118 - a} 298 ${130 - a} 306L130 - a 314H${104 - a}Z`, gradient(g, 0, 304, 0, 314, [[0, '#fef08a'], [1, '#eab308']]), 2);
  [110, 116, 122].forEach((hx) => { g.fillStyle = '#78350f'; g.beginPath(); g.arc(hx - a, 310, 1.4, 0, Math.PI * 2); g.fill(); });

  shape(g, `M${80 + a} 272L${78 + a} 306H${89 + a}L92 + a 272Z`, '#e9b283');
  // Front honeycomb sandal (dép tổ ong)
  shape(g, `M${72 + a} 306Q${84 + a} 298 ${96 + a} 306L96 + a 314H${72 + a}Z`, gradient(g, 0, 304, 0, 314, [[0, '#fef08a'], [1, '#eab308']]), 2);
  [78, 84, 90].forEach((hx) => { g.fillStyle = '#78350f'; g.beginPath(); g.arc(hx + a, 310, 1.4, 0, Math.PI * 2); g.fill(); });

  // Blue street shorts with white side stripe and drawstring
  shape(g, 'M68 242Q100 248 132 242L136 278L108 280L100 262L92 280L64 278Z', gradient(g, 0, 242, 0, 280, [[0, '#3b82f6'], [1, '#1d4ed8']]), 2.4);
  stroke(g, 'M128 244L132 278', '#ffffff', 3.0);
  dot(g, 100, 248, 2.4, '#ffffff', 0);
  stroke(g, 'M97 250Q91 258 95 264M103 250Q109 258 105 264', '#ffffff', 2.0);

  // Neck
  shape(g, 'M88 160H112V188H88Z', '#e9b283');
  stroke(g, 'M86 186Q100 194 114 186', '#c67b45', 1.8);

  // White ribbed tank top (Áo ba lỗ dân dã)
  shape(g, 'M74 184L64 212Q62 232 66 244Q100 252 134 244Q138 232 136 212L126 184L114 184Q100 198 86 184Z', gradient(g, 64, 184, 136, 246, [[0, '#ffffff'], [0.7, '#f1f5f9'], [1, '#cbd5e1']]), 2.4);
  stroke(g, 'M86 218Q100 226 114 218M88 230Q100 236 112 230', '#94a3b8', 1.6);

  // Front arm & hand (mitt hand with thumb)
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
  // Cute pink honeycomb sandal
  shape(g, `M${102 - a} 306Q${114 - a} 298 ${126 - a} 306L126 - a 313H${102 - a}Z`, gradient(g, 0, 306, 0, 313, [[0, '#f472b6'], [1, '#db2777']]), 2);
  [108, 114, 120].forEach((hx) => { g.fillStyle = '#831843'; g.beginPath(); g.arc(hx - a, 309, 1.3, 0, Math.PI * 2); g.fill(); });

  shape(g, `M${82 + a} 270L${80 + a} 306H${90 + a}L92 + a 270Z`, '#e9b283');
  shape(g, `M${74 + a} 306Q${86 + a} 298 ${96 + a} 306L96 + a 313H${74 + a}Z`, gradient(g, 0, 306, 0, 313, [[0, '#f472b6'], [1, '#db2777']]), 2);
  [80, 86, 92].forEach((hx) => { g.fillStyle = '#831843'; g.beginPath(); g.arc(hx + a, 309, 1.3, 0, Math.PI * 2); g.fill(); });

  // Neck & Bare midriff waist
  shape(g, 'M88 160H112V188H88Z', '#e9b283');
  shape(g, 'M82 210Q78 226 80 244H120Q122 226 118 210Z', '#e9b283');
  dot(g, 100, 228, 1.5, '#a9683c', 0);

  // Denim shorts with yellow stitching and copper rivet
  shape(g, 'M74 240Q100 246 126 240L130 272L108 274L100 256L92 274L70 272Z', gradient(g, 0, 240, 0, 274, [[0, '#60a5fa'], [1, '#2563eb']]), 2.4);
  stroke(g, 'M76 250H124M100 242V256', '#1e3a8a', 1.6);
  dot(g, 100, 246, 1.6, '#eab308', 0);

  // Coral peach crop top with cap sleeves
  shape(g, 'M76 186L66 214Q100 224 134 214L124 186L112 186Q100 198 88 186Z', gradient(g, 66, 186, 134, 224, [[0, '#fb7185'], [1, '#e11d48']]), 2.4);
  stroke(g, 'M74 206Q100 214 126 206', '#ffe4e6', 2.4);

  // Front arm & hand (mitt hand)
  const frontArmX = step === 1 ? 58 : step === 2 ? 72 : 66;
  const frontArmY = step === 1 ? 236 : step === 2 ? 248 : 242;
  limb(g, `M74 194Q60 214 ${frontArmX} ${frontArmY}`, 8.5);
  shape(g, `M${frontArmX - 5} ${frontArmY - 5}C${frontArmX - 10} ${frontArmY - 3} ${frontArmX - 8} ${frontArmY + 7} ${frontArmX - 1} ${frontArmY + 9}C${frontArmX + 5} ${frontArmY + 10} ${frontArmX + 8} ${frontArmY + 3} ${frontArmX + 5} ${frontArmY - 3}Z`, '#efb684', 1.6);

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
  // 0: Classic slanted comic eyebrows (lông mày xếch lém lỉnh)
  (g) => {
    shape(g, 'M60 104L86 97L86 102L62 108Z', '#20140e', 1);
    shape(g, 'M114 97L140 104L138 108L114 102Z', '#20140e', 1);
  },
  // 1: Thick expressive arched brows (lông mày rậm tấu hài)
  (g) => stroke(g, 'M60 103Q73 94 86 101M114 101Q127 94 140 103', '#20140e', 3.4),
  // 2: Asymmetrical raised brow (nhướn mày cà khịa)
  (g) => {
    stroke(g, 'M60 95Q73 87 86 96', '#20140e', 3.2);
    stroke(g, 'M114 105L140 101', '#20140e', 3.4);
  },
  // 3: Thin mischievous brows (mày láu cá)
  (g) => stroke(g, 'M62 103Q73 99 84 103M116 103Q127 99 138 103', '#3a2015', 2.2),
];
BROWS.forEach((draw, i) => layer(`brows_${i}`, draw));

const LIPS = [
  // 0: Signature Hàng Rong wry smirk (nhếch mép đểu lộ răng sún)
  (g) => {
    shape(g, 'M86 146Q100 156 118 141Q114 157 98 156Q88 154 86 146Z', '#7a221a');
    stroke(g, 'M86 146Q100 156 118 141', '#2c140e', 2.4);
    stroke(g, 'M115 137Q120 142 118 146', '#2c140e', 1.8);
    shape(g, 'M92 148L100 148L99 153L91 152Z', '#ffffff', 0);
  },
  // 1: Wide open grin with tooth row (cười toe toét)
  (g) => {
    shape(g, 'M84 145Q100 160 116 145Q112 163 100 163Q88 163 84 145Z', '#8b2f2f');
    stroke(g, 'M84 145Q100 160 116 145', '#2c140e', 2.0);
    shape(g, 'M87 147Q100 155 113 147L111 151Q100 157 89 151Z', '#ffffff', 0);
  },
  // 2: Whistling / cheeky tooth-pick smirk (miệng huýt sáo / ngậm tăm)
  (g) => {
    ellipse(g, 106, 148, 5, 6); g.fillStyle = '#7a221a'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke();
    stroke(g, 'M106 148L124 142', '#fbbf24', 2.2);
  },
  // 3: Comical wide shout / banter mouth (miệng la ó / cãi lộn)
  (g) => {
    shape(g, 'M88 146Q100 141 112 146Q114 159 100 159Q86 159 88 146Z', '#c9374f', 1.6);
    shape(g, 'M92 153Q100 156 108 153Q100 159 92 153Z', '#fb7185', 0);
  },
];
LIPS.forEach((draw, i) => layer(`lips_${i}`, draw));

layer('cheeks_1', (g) => {
  [[62, 128, 8], [138, 128, 8]].forEach(([x, y, r]) => dot(g, x, y, r, 'rgba(244,114,182,.38)', 0));
});
layer('cheeks_2', (g) => {
  // Iconic street criss-cross bandage patch on left cheek
  g.save(); g.translate(58, 132); g.rotate(0.2);
  roundRect(g, -12, -7, 24, 14, 3); g.fillStyle = '#fef3c7'; g.fill();
  g.lineWidth = 1.6; g.strokeStyle = '#b45309'; g.stroke();
  roundRect(g, -5, -4, 10, 8, 2); g.fillStyle = '#ffffff'; g.fill();
  g.lineWidth = 1.0; g.strokeStyle = '#d97706'; g.stroke();
  dot(g, -8, 0, 0.8, '#b45309', 0); dot(g, 8, 0, 0.8, '#b45309', 0);
  g.restore();
});
layer('earrings_1', (g) => { ellipse(g, 30, 126, 6, 6); g.lineWidth = 2.4; g.strokeStyle = '#e0ab3a'; g.stroke(); });
layer('earrings_2', (g) => dot(g, 30, 122, 3.5, '#f1f3f5', 1.4));
layer('earrings_3', (g) => { stroke(g, 'M30 120V130', '#e0ab3a', 1.8); shape(g, 'M30 130L35 137L30 144L25 137Z', '#e0ab3a', 1.4); });

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
wearLayer('sunglasses', (g) => {
  shape(g, 'M58 105Q72 100 86 105Q86 123 72 123Q58 121 58 105Z', '#1c1c20');
  shape(g, 'M114 105Q128 100 142 105Q142 123 128 123Q114 121 114 105Z', '#1c1c20');
  stroke(g, 'M86 107H114', INK, 2.4);
  stroke(g, 'M58 107L32 113M142 107L168 113', INK, 2.0);
  // Lens shine
  stroke(g, 'M64 108L72 120M120 108L128 120', 'rgba(255,255,255,0.4)', 1.5);
});
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
