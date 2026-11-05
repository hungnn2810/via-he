// The game's cartoon sprite set, drawn on canvas and exported as PNG into client/Assets/Resources/Sprites.
// Each sprite: name, w, h (px), pivot [0..1] from the bottom-left corner, border (9-slice: left, bottom, right, top) for UI.
// Scale: 200 px = 1 Unity unit. Characters and street scenery are cut from images by cut_street.py instead.
// Text painted onto sprites is player-facing, so it stays Vietnamese.
export const PPU = 200;
const OUTLINE = '#3b2414';

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

const sprites = [];
const add = (name, w, h, draw, pivot = [0.5, 0], border = null) => sprites.push({ name, w, h, draw, pivot, border });

// ---------- STALLS ----------
// Umbrella (behind the seller) and the counter in front. Frames 380 x 500 / 380 x 190.
const UMBRELLA_COLORS = { red: ['#e74c3c', '#fff'], green: ['#27ae60', '#fff'], blue: ['#2e86de', '#fff'], yellow: ['#f1c40f', '#e67e22'], purple: ['#9b59b6', '#fff'], orange: ['#e67e22', '#fff3d6'] };
Object.entries(UMBRELLA_COLORS).forEach(([name, [a, b]]) => add(`umbrella_${name}`, 380, 500, (g) => {
  roundRect(g, 186, 70, 9, 430, 4); fill(g, '#7f8c8d', 3);
  const segments = 8, left = 10, right = 370, bottom = 120;
  for (let i = 0; i < segments; i++) {
    const x0 = left + (i * (right - left)) / segments, x1 = left + ((i + 1) * (right - left)) / segments;
    g.beginPath(); g.moveTo(190, 18); g.lineTo(x0, bottom); g.quadraticCurveTo((x0 + x1) / 2, bottom + 18, x1, bottom); g.closePath();
    g.fillStyle = i % 2 ? b : a; g.fill();
  }
  g.beginPath(); g.moveTo(190, 18); g.lineTo(left, bottom); g.lineTo(right, bottom); g.closePath(); g.lineWidth = 4; g.strokeStyle = OUTLINE; g.stroke();
  for (let i = 0; i < segments; i++) { const x0 = left + (i * (right - left)) / segments, x1 = left + ((i + 1) * (right - left)) / segments; g.beginPath(); g.moveTo(x0, bottom); g.quadraticCurveTo((x0 + x1) / 2, bottom + 18, x1, bottom); g.stroke(); }
  ellipse(g, 190, 16, 9, 9); fill(g, b, 3);
}));

function table(g, wood = '#a0652e') {
  roundRect(g, 34, 150, 14, 40, 3); fill(g, shade(wood, -0.3), 3); roundRect(g, 332, 150, 14, 40, 3); fill(g, shade(wood, -0.3), 3);
  roundRect(g, 14, 76, 352, 80, 10); fill(g, gradient(g, 0, 76, 0, 156, [[0, shade(wood, 0.15)], [1, wood]]));
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3; [102, 128].forEach((y) => { g.beginPath(); g.moveTo(20, y); g.lineTo(360, y); g.stroke(); });
  roundRect(g, 6, 64, 368, 20, 8); fill(g, shade(wood, 0.3));
}
// Keyed by product id (server/src/data.ts PRODUCTS)
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
    [[70, 26], [150, 26], [230, 26], [300, 26]].forEach(([x, y]) => { roundRect(g, x - 30, y, 60, 46, 4); fill(g, '#3fa34d', 3); g.strokeStyle = '#d9c9a0'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 46); g.moveTo(x - 30, y + 23); g.lineTo(x + 30, y + 23); g.stroke(); });
    drawText(g, 'BÁNH CHƯNG', 190, 116, 28, '#fff', OUTLINE);
  },
  sugarcane_juice: (g) => {
    table(g, '#7cb342');
    [60, 120, 180, 240, 300].forEach((x) => { roundRect(g, x, 12, 40, 58, 8); fill(g, 'rgba(220,240,200,.9)', 3); g.fillStyle = '#b5c95a'; g.fillRect(x + 5, 28, 30, 38); });
    drawText(g, 'NƯỚC MÍA', 190, 116, 30, '#fff', OUTLINE);
  },
  moon_cake: (g) => {
    table(g, '#c0392b');
    [[80, 44], [160, 44], [240, 44], [310, 44]].forEach(([x, y]) => { ellipse(g, x, y, 32, 26); fill(g, gradient(g, 0, y - 26, 0, y + 26, [[0, '#e8b05a'], [1, '#b0701f']]), 3); ellipse(g, x, y, 15, 12); g.strokeStyle = '#8a5413'; g.lineWidth = 2; g.stroke(); });
    drawText(g, 'BÁNH NƯỚNG', 190, 116, 28, '#fff', OUTLINE);
  },
  banana: (g) => {
    table(g, '#e0a51f');
    [[60, 40], [140, 34], [220, 40], [300, 34]].forEach(([x, y]) => {
      [-16, 0, 16].forEach((d) => { g.save(); g.translate(x + d, y); g.rotate(d / 40); roundRect(g, -8, -30, 16, 58, 8); fill(g, gradient(g, 0, -30, 0, 28, [[0, '#ffe873'], [1, '#e0a51f']]), 3); g.restore(); });
      roundRect(g, x - 18, y - 36, 36, 10, 4); fill(g, '#7b5a2a', 3);
    });
    drawText(g, 'CHUỐI', 190, 116, 32, '#fff', OUTLINE);
  },
  iced_tea: (g) => {
    table(g, '#2e86de');
    roundRect(g, 40, 6, 70, 64, 14); fill(g, '#ecf0f1'); roundRect(g, 50, 18, 50, 44, 8); fill(g, '#d4a056', 3); roundRect(g, 64, 0, 22, 10, 4); fill(g, '#e74c3c', 3);
    [140, 186, 232, 278].forEach((x) => { roundRect(g, x, 22, 34, 44, 6); fill(g, 'rgba(220,240,255,.85)', 3); g.fillStyle = '#c8873d'; g.fillRect(x + 4, 40, 26, 22); g.fillStyle = '#fff'; g.fillRect(x + 8, 34, 8, 8); g.fillRect(x + 18, 30, 8, 8); });
  },
  banh_mi: (g) => {
    table(g, '#c0392b');
    roundRect(g, 30, -4 + 10, 320, 66, 8); fill(g, 'rgba(210,235,255,.55)'); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(40, 18, 16, 50);
    [[70, 42], [140, 36], [210, 42], [280, 36]].forEach(([x, y]) => { g.save(); g.translate(x, y); g.rotate(-0.15); ellipse(g, 0, 0, 34, 14); fill(g, gradient(g, 0, -14, 0, 14, [[0, '#f7c66b'], [1, '#c98a2c']]), 3); g.strokeStyle = '#9a5d14'; g.lineWidth = 2; [-14, 0, 14].forEach((d) => { g.beginPath(); g.moveTo(d - 6, -6); g.lineTo(d + 6, 4); g.stroke(); }); g.restore(); });
    drawText(g, 'BÁNH MÌ', 190, 116, 30, '#fff', OUTLINE);
  },
  sticky_rice: (g) => {
    table(g, '#8d5a2b');
    ellipse(g, 120, 50, 90, 26); fill(g, '#c8a165'); ellipse(g, 120, 40, 74, 22); fill(g, '#fdf6d8', 3); g.fillStyle = '#f1c40f'; ellipse(g, 104, 36, 20, 8); g.fill(); g.fillStyle = '#7a4a24'; [[136, 36], [146, 44], [120, 46]].forEach(([x, y]) => { ellipse(g, x, y, 6, 3); g.fill(); });
    ellipse(g, 270, 50, 70, 22); fill(g, '#2ecc71'); ellipse(g, 270, 42, 56, 16); fill(g, '#a5e3a0', 3);
    drawText(g, 'XÔI', 190, 116, 32, '#fff', OUTLINE);
  },
  sweet_soup: (g) => {
    table(g, '#16a085');
    [70, 130, 190, 250, 310].forEach((x, i) => { roundRect(g, x - 20, 14, 40, 54, 8); fill(g, 'rgba(230,245,255,.8)', 3); const c = ['#9b59b6', '#27ae60', '#e67e22', '#e84393', '#f1c40f'][i]; g.fillStyle = c; g.fillRect(x - 16, 36, 32, 28); g.fillStyle = '#fff'; g.fillRect(x - 16, 30, 32, 8); });
    drawText(g, 'CHÈ', 190, 116, 32, '#fff', OUTLINE);
  },
  popsicle: (g) => {
    roundRect(g, 30, 30, 320, 130, 16); fill(g, gradient(g, 0, 30, 0, 160, [[0, '#fff'], [1, '#d6e9ff']]));
    roundRect(g, 20, 20, 340, 26, 10); fill(g, '#2e86de');
    ellipse(g, 70, 170, 20, 20); fill(g, '#555'); ellipse(g, 310, 170, 20, 20); fill(g, '#555');
    [[120, 92, '#ff7aa2'], [190, 86, '#7bed9f'], [260, 92, '#ffeaa7']].forEach(([x, y, c]) => { poly(g, [[x - 18, y], [x + 18, y], [x, y + 46]]); fill(g, '#e0a35b', 3); ellipse(g, x, y - 6, 22, 20); fill(g, c, 3); });
    drawText(g, 'KEM', 70, 96, 30, '#e74c3c', '#fff');
  },
  rambutan: (g) => {
    table(g, '#8d5a2b');
    [[110, 46], [270, 46]].forEach(([cx, cy]) => { ellipse(g, cx, cy + 10, 80, 24); fill(g, '#b77b3b'); for (let i = 0; i < 14; i++) { const x = cx - 60 + (i % 7) * 20, y = cy - 4 - Math.floor(i / 7) * 16; ellipse(g, x, y, 13, 13); fill(g, '#d63031', 2.5); g.strokeStyle = '#2ecc71'; g.lineWidth = 2; for (let a = 0; a < 6; a++) { g.beginPath(); g.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); g.lineTo(x + Math.cos(a) * 17, y + Math.sin(a) * 17); g.stroke(); } } });
  },
  flowers: (g) => {
    table(g, '#6ab04c');
    [70, 150, 230, 310].forEach((x, i) => { roundRect(g, x - 26, 30, 52, 40, 6); fill(g, '#7f8c8d', 3); const c = ['#ff6b81', '#feca57', '#ff9ff3', '#ffffff'][i]; for (let k = 0; k < 6; k++) { const fx = x - 22 + (k % 3) * 22, fy = 6 + Math.floor(k / 3) * 16; g.strokeStyle = '#27ae60'; g.lineWidth = 3; g.beginPath(); g.moveTo(fx, fy); g.lineTo(x, 40); g.stroke(); ellipse(g, fx, fy, 11, 11); fill(g, c, 2.5); g.fillStyle = '#f1c40f'; ellipse(g, fx, fy, 4, 4); g.fill(); } });
  },
  tofu_noodles: (g) => {
    table(g, '#a0652e');
    [110, 270].forEach((x) => { roundRect(g, x - 70, 26, 140, 40, 8); fill(g, '#7bc96f'); g.fillStyle = '#f5f5f5'; for (let i = 0; i < 4; i++) { roundRect(g, x - 62 + i * 32, 30, 28, 18, 4); fill(g, '#f7f3e3', 2); } g.fillStyle = '#e1a95f'; for (let i = 0; i < 4; i++) { roundRect(g, x - 60 + i * 32, 48, 26, 14, 3); fill(g, '#e8b04a', 2); } });
    drawText(g, 'BÚN ĐẬU', 190, 116, 28, '#fff', OUTLINE);
  },
  fresh_milk: (g) => {
    table(g, '#3498db');
    for (let i = 0; i < 7; i++) { const x = 46 + i * 46; roundRect(g, x, 16, 30, 54, 8); fill(g, '#fff', 3); roundRect(g, x + 8, 4, 14, 14, 3); fill(g, i % 2 ? '#2e86de' : '#27ae60', 3); g.fillStyle = '#74b9ff'; g.fillRect(x + 4, 36, 22, 12); }
    drawText(g, 'SỮA TƯƠI', 190, 116, 28, '#fff', OUTLINE);
  },
};
Object.entries(COUNTERS).forEach(([id, draw]) => add(`counter_${id}`, 380, 190, draw));

add('slot_empty', 340, 210, (g) => { roundRect(g, 8, 8, 324, 194, 26); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(); g.setLineDash([16, 10]); g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,.95)'; g.stroke(); g.setLineDash([]); ellipse(g, 170, 92, 34, 34); fill(g, '#27ae60', 4, '#fff'); drawText(g, '+', 170, 90, 52, '#fff'); drawText(g, 'Dọn hàng', 170, 160, 28, '#fff', 'rgba(0,0,0,.45)'); });
add('slot_owner', 340, 210, (g) => { roundRect(g, 8, 8, 324, 194, 26); g.fillStyle = 'rgba(255,215,60,.35)'; g.fill(); g.setLineDash([16, 10]); g.lineWidth = 5; g.strokeStyle = '#ffd43b'; g.stroke(); g.setLineDash([]); ellipse(g, 170, 92, 34, 34); fill(g, '#f39c12', 4, '#fff'); drawText(g, '★', 170, 92, 40, '#fff'); drawText(g, 'Ô chủ phố', 170, 160, 28, '#fff', 'rgba(0,0,0,.45)'); });

// ---------- STREET ----------
add('bg_sky', 64, 512, (g) => { g.fillStyle = gradient(g, 0, 0, 0, 512, [[0, '#5ec2f2'], [0.7, '#bfe9ff'], [1, '#fff4d6']]); g.fillRect(0, 0, 64, 512); }, [0.5, 0]);
add('bg_city', 1200, 300, (g) => {
  const towers = [[0, 140, 90], [90, 200, 70], [160, 110, 110], [270, 240, 80], [350, 160, 100], [450, 210, 90], [540, 130, 120], [660, 260, 70], [730, 180, 110], [840, 220, 90], [930, 150, 120], [1050, 240, 80], [1130, 170, 70]];
  towers.forEach(([x, h, w], i) => { g.fillStyle = i % 2 ? '#a9cfe6' : '#94c1dd'; g.fillRect(x, 300 - h, w, h); g.fillStyle = 'rgba(255,255,255,.55)'; for (let y = 300 - h + 14; y < 290; y += 22) for (let c = x + 10; c < x + w - 14; c += 20) g.fillRect(c, y, 10, 12); });
}, [0.5, 0]);

const HOUSES = [
  { wall: '#f6b26b', sign: 'TẠP HÓA', signColor: '#c0392b' },
  { wall: '#a4d4ae', sign: 'CƠM BÌNH DÂN', signColor: '#2e86de' },
  { wall: '#f9e79f', sign: 'SỬA XE', signColor: '#27ae60' },
  { wall: '#d7bde2', sign: 'CẮT TÓC', signColor: '#8e44ad' },
  { wall: '#aed6f1', sign: 'PHỞ', signColor: '#d35400' },
];
HOUSES.forEach((house, i) => add(`house_${i}`, 640, 820, (g) => {
  // wall
  roundRect(g, 10, 30, 620, 790, 6); fill(g, house.wall);
  g.fillStyle = 'rgba(0,0,0,.06)'; for (let y = 60; y < 800; y += 40) g.fillRect(10, y, 620, 3);
  // roof
  roundRect(g, 0, 10, 640, 34, 6); fill(g, shade(house.wall, -0.35));
  // upper floors: windows + balcony + plants
  for (const y of [90, 300]) {
    roundRect(g, 80, y, 200, 150, 8); fill(g, '#5d8aa8'); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(96, y + 12, 40, 120);
    g.strokeStyle = OUTLINE; g.lineWidth = 4; g.beginPath(); g.moveTo(180, y); g.lineTo(180, y + 150); g.stroke();
    roundRect(g, 360, y, 200, 150, 8); fill(g, '#5d8aa8'); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(376, y + 12, 40, 120);
    g.beginPath(); g.moveTo(460, y); g.lineTo(460, y + 150); g.stroke();
    // balcony
    roundRect(g, 50, y + 150, 540, 18, 4); fill(g, '#7f8c8d'); for (let x = 60; x < 590; x += 22) { g.fillStyle = '#566573'; g.fillRect(x, y + 120, 5, 32); }
    g.fillStyle = '#566573'; g.fillRect(50, y + 116, 540, 6);
    // potted plants
    [[110, '#27ae60'], [520, '#2ecc71']].forEach(([x, c]) => { roundRect(g, x - 20, y + 104, 40, 26, 5); fill(g, '#c0392b', 3); ellipse(g, x, y + 92, 30, 24); fill(g, c, 3); });
  }
  // air conditioner unit
  roundRect(g, 560, 240, 60, 44, 4); fill(g, '#ecf0f1', 3); g.fillStyle = '#95a5a6'; ellipse(g, 590, 262, 14, 14); g.fill();
  // shop sign
  roundRect(g, 40, 500, 560, 78, 10); fill(g, house.signColor); drawText(g, house.sign, 320, 540, 52, '#fff', OUTLINE);
  // ground-floor roller shutter (half open)
  roundRect(g, 40, 600, 560, 220, 4); fill(g, '#4a3b30');
  g.fillStyle = '#bdc3c7'; g.fillRect(42, 602, 556, 70); g.fillStyle = '#95a5a6'; for (let y = 606; y < 672; y += 10) g.fillRect(42, y, 556, 3);
  g.fillStyle = '#f5d76e'; g.fillRect(60, 690, 120, 130); g.fillStyle = '#e67e22'; for (let k = 0; k < 4; k++) g.fillRect(70 + k * 28, 700, 20, 26); g.fillStyle = '#3498db'; for (let k = 0; k < 4; k++) g.fillRect(70 + k * 28, 740, 20, 26);
}));

add('power_pole', 120, 1100, (g) => {
  roundRect(g, 46, 40, 28, 1060, 6); fill(g, gradient(g, 46, 0, 74, 0, [[0, '#9aa5ab'], [1, '#6d7b83']]));
  [70, 110].forEach((y) => { roundRect(g, 6, y, 108, 12, 4); fill(g, '#5d6d7e', 3); });
  // tangled cable coil
  g.strokeStyle = '#2c3e50'; g.lineWidth = 4; for (let k = 0; k < 6; k++) { ellipse(g, 60 + Math.sin(k) * 10, 200 + k * 8, 46 - k * 4, 14); g.stroke(); }
  roundRect(g, 30, 300, 60, 70, 6); fill(g, '#7f8c8d'); roundRect(g, 40, 310, 40, 30, 4); fill(g, '#f1c40f', 3);
  g.fillStyle = '#ecf0f1'; roundRect(g, 36, 520, 48, 60, 4); g.fill(); g.fillStyle = '#e74c3c'; g.fillRect(40, 528, 40, 6); g.fillRect(40, 546, 30, 4); g.fillRect(40, 558, 34, 4);
}, [0.5, 0]);
add('power_lines', 800, 120, (g) => { g.strokeStyle = '#2c3e50'; g.lineWidth = 4; [[10, 40], [24, 60], [16, 74]].forEach(([a, b]) => { g.beginPath(); g.moveTo(0, a); g.quadraticCurveTo(400, a + b, 800, a); g.stroke(); }); }, [0, 1]);

add('tree', 420, 760, (g) => {
  roundRect(g, 190, 380, 40, 380, 12); fill(g, '#8e5a34');
  [[210, 230, 170, 150, '#2f9e44'], [120, 300, 110, 100, '#37b24d'], [300, 300, 110, 100, '#37b24d'], [210, 140, 130, 110, '#51cf66']].forEach(([x, y, rx, ry, c]) => { ellipse(g, x, y, rx, ry); fill(g, c); });
  g.fillStyle = 'rgba(255,255,255,.18)'; ellipse(g, 170, 110, 50, 30); g.fill();
}, [0.5, 0]);

add('sidewalk', 200, 200, (g) => {
  g.fillStyle = '#e3d6c4'; g.fillRect(0, 0, 200, 200);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { roundRect(g, x * 100 + 3, y * 100 + 3, 94, 94, 6); g.fillStyle = (x + y) % 2 ? '#d9c9b2' : '#eadfce'; g.fill(); g.strokeStyle = 'rgba(120,90,60,.18)'; g.lineWidth = 2; g.stroke(); g.strokeStyle = 'rgba(120,90,60,.12)'; ellipse(g, x * 100 + 50, y * 100 + 50, 26, 26); g.stroke(); }
}, [0, 0]);
add('curb', 200, 40, (g) => { g.fillStyle = '#b0b7bd'; g.fillRect(0, 0, 200, 40); g.fillStyle = '#d5dade'; g.fillRect(0, 0, 200, 12); for (let x = 0; x < 200; x += 100) { g.fillStyle = '#7f8c8d'; g.fillRect(x, 0, 3, 40); } }, [0, 0]);
add('road', 200, 200, (g) => { g.fillStyle = '#585e63'; g.fillRect(0, 0, 200, 200); g.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 0; i < 60; i++) g.fillRect((i * 37) % 200, (i * 53) % 200, 4, 4); g.fillStyle = '#f5f5f5'; g.fillRect(20, 112, 110, 12); }, [0, 0]);

add('bus_stop', 160, 520, (g) => { roundRect(g, 72, 120, 14, 400, 4); fill(g, '#7f8c8d', 3); roundRect(g, 10, 10, 140, 130, 14); fill(g, '#2e86de'); roundRect(g, 34, 34, 92, 56, 10); fill(g, '#fff', 3); roundRect(g, 44, 44, 72, 30, 6); fill(g, '#74b9ff', 3); ellipse(g, 56, 92, 8, 8); fill(g, '#2c3e50', 2); ellipse(g, 104, 92, 8, 8); fill(g, '#2c3e50', 2); drawText(g, 'XE BUÝT', 80, 118, 22, '#fff'); }, [0.5, 0]);

add('motorbike', 300, 200, (g) => {
  ellipse(g, 60, 160, 34, 34); fill(g, '#2c3e50'); ellipse(g, 60, 160, 14, 14); fill(g, '#bdc3c7', 3);
  ellipse(g, 240, 160, 34, 34); fill(g, '#2c3e50'); ellipse(g, 240, 160, 14, 14); fill(g, '#bdc3c7', 3);
  g.beginPath(); g.moveTo(40, 130); g.quadraticCurveTo(80, 90, 150, 104); g.lineTo(230, 104); g.quadraticCurveTo(262, 110, 262, 140); g.lineTo(80, 150); g.closePath(); fill(g, '#e74c3c');
  roundRect(g, 120, 86, 90, 22, 10); fill(g, '#2c3e50'); roundRect(g, 236, 60, 12, 60, 4); fill(g, '#7f8c8d', 3); roundRect(g, 226, 52, 40, 12, 5); fill(g, '#2c3e50', 3);
  ellipse(g, 268, 112, 10, 8); fill(g, '#ffeaa7', 3);
  // rider
  roundRect(g, 150, 30, 46, 64, 14); fill(g, '#3498db'); ellipse(g, 182, 18, 22, 22); fill(g, '#f6d2b0'); g.beginPath(); g.moveTo(160, 18); g.bezierCurveTo(158, -10, 206, -10, 204, 18); g.closePath(); fill(g, '#f1c40f');
  roundRect(g, 186, 52, 54, 12, 6); fill(g, '#f6d2b0', 3); roundRect(g, 150, 88, 70, 18, 8); fill(g, '#2c3e50', 3);
}, [0.5, 0]);

add('shadow', 160, 40, (g) => { ellipse(g, 80, 20, 70, 16); g.fillStyle = 'rgba(0,0,0,.22)'; g.fill(); }, [0.5, 0.5]);
add('coin', 64, 64, (g) => { ellipse(g, 32, 32, 28, 28); fill(g, gradient(g, 0, 4, 0, 60, [[0, '#ffe066'], [1, '#f08c00']]), 4, '#a65b00'); drawText(g, 'đ', 32, 31, 32, '#a65b00'); }, [0.5, 0.5]);

// ---------- UI ----------
function button(name, top, bottom) {
  add(name, 96, 96, (g) => {
    roundRect(g, 3, 8, 90, 85, 22); g.fillStyle = shade(bottom, -0.35); g.fill();
    roundRect(g, 3, 3, 90, 82, 22); g.fillStyle = gradient(g, 0, 3, 0, 85, [[0, top], [1, bottom]]); g.fill(); g.lineWidth = 4; g.strokeStyle = shade(bottom, -0.45); g.stroke();
    roundRect(g, 12, 9, 72, 22, 11); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
  }, [0.5, 0.5], [32, 32, 32, 32]);
}
button('ui_button_orange', '#ffc94d', '#f08c00');
button('ui_button_green', '#8ce99a', '#2f9e44');
button('ui_button_blue', '#74c0fc', '#1c7ed6');
button('ui_button_red', '#ff8787', '#e03131');
button('ui_button_gray', '#adb5bd', '#5c677d');

add('ui_panel', 128, 128, (g) => { roundRect(g, 4, 4, 120, 120, 26); g.fillStyle = '#1c5fa8'; g.fill(); roundRect(g, 9, 9, 110, 110, 22); g.fillStyle = '#ffffff'; g.fill(); roundRect(g, 14, 14, 100, 100, 18); g.fillStyle = gradient(g, 0, 14, 0, 114, [[0, '#d7f0ff'], [1, '#a5d8ff']]); g.fill(); }, [0.5, 0.5], [40, 40, 40, 40]);
add('ui_row', 64, 64, (g) => { roundRect(g, 2, 2, 60, 60, 14); g.fillStyle = '#f4fbff'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#74c0fc'; g.stroke(); }, [0.5, 0.5], [20, 20, 20, 20]);
add('ui_ribbon', 256, 80, (g) => {
  poly(g, [[0, 20], [40, 20], [40, 70], [20, 60], [0, 70]]); g.fillStyle = '#a61e1e'; g.fill();
  poly(g, [[256, 20], [216, 20], [216, 70], [236, 60], [256, 70]]); g.fill();
  roundRect(g, 24, 6, 208, 56, 10); g.fillStyle = gradient(g, 0, 6, 0, 62, [[0, '#ff6b6b'], [1, '#c92a2a']]); g.fill(); g.lineWidth = 4; g.strokeStyle = '#7a1414'; g.stroke();
}, [0.5, 0.5], [60, 20, 60, 20]);
add('ui_tag', 128, 64, (g) => { roundRect(g, 4, 4, 120, 56, 28); g.fillStyle = 'rgba(30,20,10,.62)'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke(); }, [0.5, 0.5], [30, 30, 30, 30]);
add('ui_bar', 64, 24, (g) => { roundRect(g, 2, 2, 60, 20, 10); g.fillStyle = 'rgba(0,0,0,.45)'; g.fill(); }, [0.5, 0.5], [12, 10, 12, 10]);
add('ui_bar_fill', 64, 24, (g) => { roundRect(g, 2, 2, 60, 20, 10); g.fillStyle = '#ffffff'; g.fill(); roundRect(g, 6, 4, 52, 6, 3); g.fillStyle = 'rgba(255,255,255,.6)'; g.fill(); }, [0.5, 0.5], [12, 10, 12, 10]);
add('ui_avatar_frame', 160, 160, (g) => { ellipse(g, 80, 80, 74, 74); g.fillStyle = gradient(g, 0, 6, 0, 154, [[0, '#ffe066'], [1, '#f08c00']]); g.fill(); g.lineWidth = 5; g.strokeStyle = '#7a4b25'; g.stroke(); ellipse(g, 80, 80, 60, 60); g.fillStyle = '#9fd8f5'; g.fill(); }, [0.5, 0.5]);
add('ui_level_star', 96, 96, (g) => { poly(g, Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 20 : 44, a = -Math.PI / 2 + (i * Math.PI) / 5; return [48 + Math.cos(a) * r, 50 + Math.sin(a) * r]; })); fill(g, gradient(g, 0, 6, 0, 94, [[0, '#ffd43b'], [1, '#f59f00']]), 4, '#7a4b25'); }, [0.5, 0.5]);
add('ui_bolt', 64, 64, (g) => { poly(g, [[38, 4], [12, 36], [30, 36], [24, 60], [52, 24], [34, 24]]); fill(g, '#ffd43b', 4, '#a65b00'); }, [0.5, 0.5]);
add('ui_speech_bubble', 96, 80, (g) => { roundRect(g, 4, 4, 88, 58, 20); g.fillStyle = '#fff'; g.fill(); poly(g, [[38, 60], [58, 60], [44, 76]]); g.fill(); roundRect(g, 4, 4, 88, 58, 20); g.lineWidth = 3; g.strokeStyle = OUTLINE; g.stroke(); g.beginPath(); g.moveTo(38, 62); g.lineTo(44, 76); g.lineTo(58, 62); g.stroke(); }, [0.5, 0], [30, 30, 30, 24]);

// Bottom bar icons
function icon(name, draw) { add(name, 96, 96, draw, [0.5, 0.5]); }
icon('icon_stall', (g) => { poly(g, [[48, 8], [90, 38], [6, 38]]); fill(g, '#e74c3c', 4, '#fff'); roundRect(g, 16, 46, 64, 38, 6); fill(g, '#a0652e', 4, '#fff'); ellipse(g, 48, 52, 16, 8); fill(g, '#ffd43b', 3); });
icon('icon_staff', (g) => { ellipse(g, 34, 34, 16, 16); fill(g, '#f6d2b0', 4, '#fff'); roundRect(g, 14, 52, 40, 36, 16); fill(g, '#4dabf7', 4, '#fff'); ellipse(g, 64, 30, 16, 16); fill(g, '#f6d2b0', 4, '#fff'); roundRect(g, 44, 48, 42, 40, 16); fill(g, '#69db7c', 4, '#fff'); });
icon('icon_wardrobe', (g) => { poly(g, [[30, 12], [66, 12], [90, 30], [78, 46], [70, 40], [70, 88], [26, 88], [26, 40], [18, 46], [6, 30]]); fill(g, '#ff922b', 4, '#fff'); });
icon('icon_shop', (g) => { roundRect(g, 14, 30, 68, 58, 10); fill(g, '#da77f2', 4, '#fff'); g.beginPath(); g.arc(48, 32, 18, Math.PI, 0); g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke(); });
icon('icon_log', (g) => { roundRect(g, 16, 10, 64, 78, 8); fill(g, '#a0652e', 4, '#fff'); roundRect(g, 28, 22, 42, 52, 4); fill(g, '#fff8e7', 0); g.fillStyle = '#a0652e'; [32, 44, 56].forEach((y) => g.fillRect(34, y, 30, 4)); });
icon('icon_bus', (g) => { roundRect(g, 8, 18, 80, 56, 12); fill(g, '#2f9e44', 4, '#fff'); roundRect(g, 16, 26, 64, 22, 4); fill(g, '#a5d8ff', 0); ellipse(g, 28, 78, 9, 9); fill(g, '#333', 3, '#fff'); ellipse(g, 68, 78, 9, 9); fill(g, '#333', 3, '#fff'); });
icon('icon_home', (g) => { poly(g, [[48, 8], [90, 44], [76, 44], [76, 88], [20, 88], [20, 44], [6, 44]]); fill(g, '#4dabf7', 4, '#fff'); roundRect(g, 40, 58, 18, 30, 3); fill(g, '#fff', 0); });

// ---------- Player characters ----------
// Every layer shares one 160 x 256 frame with the feet on the bottom edge, so layers stack without offsets.
// Paths are authored on a 200 x 320 grid. Draw order: hairback, body, earrings, cheeks, brows, lips, hair.
const INK = '#3a2416';
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
const layer = (name, draw) => add(name, 160, 256, (g) => { g.scale(0.8, 0.8); g.translate(0, 6); draw(g); });
const skinFill = (g) => { const r = g.createRadialGradient(124, 96, 10, 124, 96, 165); r.addColorStop(0, '#ffe0bd'); r.addColorStop(0.55, '#efb684'); r.addColorStop(1, '#b8723f'); return r; };

function face(g, head, earX) {
  ellipse(g, earX, 116, 13, 17); g.fillStyle = skinFill(g); g.fill(); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
  shape(g, head, skinFill(g));
  ellipse(g, 118, 125, 10, 12); g.fillStyle = '#fbf7ef'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
  ellipse(g, 157, 123, 8, 11); g.fillStyle = '#fbf7ef'; g.fill(); g.stroke();
  dot(g, 122, 126, 5, '#2a1810', 0); dot(g, 160, 124, 4.4, '#2a1810', 0);
  dot(g, 124, 123, 1.5, '#fff', 0); dot(g, 162, 121, 1.3, '#fff', 0);
  stroke(g, 'M107 119Q118 112 129 119M149 117Q157 112 166 118', '#20140e', 3);
  stroke(g, 'M142 130Q149 139 141 143', '#a9683c', 2);
}
const MALE_HEAD = 'M104 26C154 26 182 64 180 108C179 136 162 160 136 172C120 179 100 180 84 174C50 164 28 136 28 100C28 56 58 26 104 26Z';
const FEMALE_HEAD = 'M104 30C150 30 176 66 174 108C173 134 158 156 134 168C120 175 102 176 88 170C56 160 36 134 36 102C36 60 62 30 104 30Z';

function maleBody(g, step) {
  const a = step === 1 ? -7 : step === 2 ? 7 : 0;
  limb(g, 'M112 200Q128 214 128 246', 8); dot(g, 128, 252, 7, '#efb684');
  shape(g, `M${80 + a} 270L${77 + a} 306H${88 + a}L92 270Z`, '#e9b283');
  shape(g, `M100 270L${102 - a} 306H${113 - a}L112 270Z`, '#e9b283');
  shape(g, `M${66 + a} 306Q${78 + a} 300 ${90 + a} 306L${90 + a} 313H${66 + a}Z`, '#d9a42e');
  shape(g, `M${98 - a} 306Q${112 - a} 300 ${124 - a} 306L${124 - a} 313H${98 - a}Z`, '#d9a42e');
  shape(g, 'M70 238Q92 246 116 238L120 274L98 276L93 258L88 276L66 274Z', gradient(g, 0, 238, 0, 276, [[0, '#58b2f5'], [1, '#155aa8']]));
  stroke(g, 'M112 240L116 274', '#fff', 3);
  shape(g, 'M85 172H104V194H85Z', '#e9b283');
  shape(g, 'M76 190L70 216Q68 232 70 242Q93 250 116 242Q118 230 116 214L110 190L101 190Q93 206 85 190Z', gradient(g, 70, 190, 116, 248, [[0, '#ffffff'], [1, '#bfc8d2']]));
  stroke(g, 'M84 226Q92 232 102 224M88 236Q98 240 108 232', '#9aa3ae', 1.5);
  limb(g, 'M75 198Q56 214 60 250', 9); dot(g, 60, 255, 7, '#efb684');
  face(g, MALE_HEAD, 42);
}
function femaleBody(g, step) {
  const a = step === 1 ? -7 : step === 2 ? 7 : 0;
  limb(g, 'M112 200Q128 214 126 244', 8); dot(g, 126, 250, 7, '#efb684');
  shape(g, `M${84 + a} 268L${80 + a} 306H${91 + a}L96 268Z`, '#e9b283');
  shape(g, `M102 268L${104 - a} 306H${115 - a}L114 268Z`, '#e9b283');
  shape(g, `M${70 + a} 306Q${82 + a} 300 ${92 + a} 306L${92 + a} 313H${70 + a}Z`, '#c8456f');
  shape(g, `M${100 - a} 306Q${114 - a} 300 ${124 - a} 306L${124 - a} 313H${100 - a}Z`, '#c8456f');
  shape(g, 'M87 172H105V194H87Z', '#e9b283');
  shape(g, 'M80 212Q76 228 78 244H114Q116 228 112 212Z', '#e9b283');
  shape(g, 'M74 240Q96 248 118 240L122 270L102 272L97 256L92 272L70 270Z', gradient(g, 0, 240, 0, 272, [[0, '#8fb6dc'], [1, '#3f6d9f']]));
  stroke(g, 'M76 250H118M92 243V256', '#2f5680', 1.5);
  shape(g, 'M80 188L72 218Q96 228 120 218L112 188L103 188Q96 202 89 188Z', gradient(g, 72, 188, 120, 228, [[0, '#ffa184'], [1, '#d94f35']]));
  stroke(g, 'M76 208Q96 216 116 208', '#ffe3c8', 2.6);
  limb(g, 'M78 198Q60 214 62 248', 9); dot(g, 62, 253, 7, '#efb684');
  face(g, FEMALE_HEAD, 48);
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
  });
});

const BROWS = [
  (g) => { shape(g, 'M100 106L132 100L132 106L102 114Z', '#20140e', 1); shape(g, 'M148 100L172 102L172 107L150 106Z', '#20140e', 1); },
  (g) => stroke(g, 'M104 106Q118 97 132 106M150 104Q160 98 170 106', '#3a2015', 3.2),
  (g) => stroke(g, 'M102 98L132 110M172 98L148 110', '#20140e', 5),
  (g) => stroke(g, 'M106 104Q118 100 130 104M152 102Q160 99 168 103', '#3a2015', 2),
];
BROWS.forEach((draw, i) => layer(`brows_${i}`, draw));

const LIPS = [
  (g) => { stroke(g, 'M128 157Q142 162 156 152', '#6d2b23', 3); stroke(g, 'M152 149Q158 152 157 156', '#6d2b23', 1.8); },
  (g) => { shape(g, 'M124 150Q142 160 160 148Q154 168 140 168Q128 168 124 150Z', '#8b2f2f'); shape(g, 'M129 153Q142 158 156 151L153 156Q142 161 131 158Z', '#fff', 1); },
  (g) => { ellipse(g, 142, 154, 6, 7); g.fillStyle = '#8b2f2f'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke(); },
  (g) => shape(g, 'M130 153Q140 150 144 152Q148 150 154 152Q146 162 140 161Q134 160 130 153Z', '#c9374f', 1.5),
];
LIPS.forEach((draw, i) => layer(`lips_${i}`, draw));

// Index 0 of cheeks and earrings means none, so it has no sprite
layer('cheeks_1', (g) => { [[100, 146, 11], [150, 141, 7]].forEach(([x, y, r]) => dot(g, x, y, r, 'rgba(240,119,111,.35)', 0)); });
layer('cheeks_2', (g) => { [[94, 140], [102, 146], [108, 139], [146, 138], [152, 143]].forEach(([x, y]) => dot(g, x, y, 1.8, '#a06a44', 0)); });
layer('earrings_1', (g) => { ellipse(g, 44, 142, 7, 7); g.lineWidth = 3; g.strokeStyle = '#e0ab3a'; g.stroke(); });
layer('earrings_2', (g) => dot(g, 44, 134, 4, '#f1f3f5', 1.6));
layer('earrings_3', (g) => { stroke(g, 'M44 132V144', '#e0ab3a', 2); shape(g, 'M44 144L50 152L44 160L38 152Z', '#e0ab3a', 1.6); });

// ---------- Banana garden ----------
function bananaLeaf(g, x, y, angle, length) {
  g.save(); g.translate(x, y); g.rotate((angle * Math.PI) / 180);
  const k = length / 90;
  shape(g, `M0 0C${26 * k} ${-30 * k} ${64 * k} ${-30 * k} ${90 * k} 0C${64 * k} ${14 * k} ${26 * k} ${14 * k} 0 0Z`, gradient(g, 0, -24 * k, 0, 12 * k, [[0, '#8ad66f'], [1, '#23803d']]));
  stroke(g, `M0 0L${88 * k} 0`, '#1d6a33', 1.5);
  g.restore();
}
const trunkFill = (g, x0, x1) => gradient(g, x0, 0, x1, 0, [[0, '#6f8f38'], [0.55, '#b6cf6a'], [1, '#7c9a3f']]);
add('garden_bed', 220, 70, (g) => {
  ellipse(g, 110, 40, 102, 26); g.fillStyle = gradient(g, 0, 14, 0, 66, [[0, '#94673f'], [1, '#553620']]); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
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
icon('icon_banana', (g) => {
  const yellow = gradient(g, 0, 10, 0, 90, [[0, '#ffe873'], [1, '#e0a51f']]);
  shape(g, 'M40 12Q24 48 42 84Q60 88 66 78Q46 56 54 14Z', yellow, 4);
  shape(g, 'M50 12Q50 48 76 74Q88 72 90 62Q68 46 62 14Z', yellow, 4);
  shape(g, 'M42 6H60V18H42Z', '#7b5a2a', 4);
});

// Neighbourhood leader who guides new players: a fictional retired man with grey hair and a red armband
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

// ---------- Clothes shown on characters ----------
// Same frame as the body layers. Sprite name = wear_<wearable id>.
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

// ---------- Buildings on the street lots ----------
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
  roundRect(g, 150, 270, 60, 100, 30); fill(g, '#dff3ff', 4);
  roundRect(g, 310, 240, 26, 110, 10); fill(g, '#fff', 3);
  [260, 290, 320].forEach((y) => { g.fillStyle = '#d63031'; g.fillRect(314, y, 18, 12); });
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
add('lot_empty', 220, 200, (g) => {
  stroke(g, 'M110 200V90', '#8d6e4f', 14);
  roundRect(g, 14, 14, 192, 88, 10); fill(g, '#fff7e0', 4);
  drawText(g, 'LÔ ĐẤT', 110, 44, 30, '#8a3b12'); drawText(g, 'Chạm để xây', 110, 78, 22, '#8a3b12');
});
icon('icon_more', (g) => { [24, 48, 72].forEach((x) => dot(g, x, 48, 11, '#fff', 3)); });
icon('icon_fame', (g) => { poly(g, Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 18 : 42, a = -Math.PI / 2 + (i * Math.PI) / 5; return [48 + Math.cos(a) * r, 50 + Math.sin(a) * r]; })); fill(g, '#ffd43b', 4, '#a65b00'); });

// ---------- Seasonal decorations ----------
// Placed between the lots. Sprite name = deco_<decoration id>; deco_trophy stands for any season reward.
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
  stroke(g, 'M30 300V60M170 300V60', '#7b5a2a', 8);
  stroke(g, 'M30 70Q100 120 170 70', '#7b5a2a', 3);
  [[54, 86, '#e03131'], [84, 100, '#ffd43b'], [116, 100, '#2f9e44'], [146, 86, '#1c7ed6']].forEach(([x, y, c]) => { poly(g, [[x - 13, y], [x + 13, y], [x, y + 32]]); fill(g, c, 2.2, INK); });
});
add('deco_trophy', 200, 300, (g) => {
  shape(g, 'M70 300H130V274H70Z', '#6a3f1b');
  shape(g, 'M90 274H110V220H90Z', '#d9a42e');
  stroke(g, 'M58 130Q24 130 34 170Q44 196 74 196M142 130Q176 130 166 170Q156 196 126 196', '#d9a42e', 8);
  shape(g, 'M56 110H144Q144 214 100 224Q56 214 56 110Z', gradient(g, 56, 110, 144, 224, [[0, '#ffe873'], [1, '#d9a42e']]));
});

// ---------- Districts: land strip behind the sidewalk, one look per district ----------
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
  for (let i = 0; i < 6; i++) { const x = 30 + i * 165; roundRect(g, x, 60, 130, 100, 6); fill(g, ['#e8a87c', '#c9d6a3', '#f2cf7e'][i % 3], 3); poly(g, [[x - 8, 60], [x + 138, 60], [x + 124, 30], [x + 6, 30]]); fill(g, i % 2 ? '#d63a3a' : '#2e86de', 3); }
});
landStrip('bg_land_3', [[0, '#e5d8b8'], [1, '#c6b58d']], (g) => {
  for (let i = 0; i < 5; i++) { const x = 20 + i * 200; shape(g, `M${x} 150V50H${x + 160}V150Z`, '#e8c766', 3); shape(g, `M${x - 12} 50L${x + 80} 8L${x + 172} 50Z`, '#8f4a32', 3); roundRect(g, x + 60, 88, 40, 62, 18); fill(g, '#5b4636', 3); }
});
add('lot_soil', 420, 140, (g) => {
  ellipse(g, 210, 76, 200, 58); g.fillStyle = gradient(g, 0, 18, 0, 134, [[0, '#94673f'], [1, '#553620']]); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  stroke(g, 'M80 70Q130 58 180 70M230 88Q280 76 330 88M120 104Q170 94 220 104', '#3f2715', 2.6);
}, [0.5, 0.35]);

// ---------- Crops ----------
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

// ---------- Kitchen ----------
shopFront('building_kitchen', '#f0d9a8', '#e67e22', 'BẾP NHÀ', (g) => {
  roundRect(g, 120, 320, 120, 90, 8); fill(g, '#6d7680', 4);
  ellipse(g, 180, 322, 46, 18); fill(g, '#adb5bd', 3);
  stroke(g, 'M150 300q10 -18 0 -36M180 300q10 -18 0 -36M210 300q10 -18 0 -36', '#ffffff', 5);
});

// ---------- Neighbour portraits: fictional people ----------
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

// ---------- Vehicles: sit under the character layers, wheels on the bottom edge ----------
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

export const SPRITES = sprites;
