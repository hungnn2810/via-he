// UI kit, ink-and-wash style. Matches the painted outfit art in client/Assets/Resources/Sprites/outfits:
// a thin near-black ink line, soft watercolour washes with darker edges, gold trim and
// traditional motifs (clouds, lotus, plum blossom) on lacquer, silk and paper.
//
// Names, sizes and 9-slice borders are the contract with client/Assets/Scripts/Theme.cs —
// keep them when restyling. Motifs only go in the corners of a sliced sprite, never in the
// stretched edges or centre.
import { BORDER, SIZE } from './theme.js';

export const INK = '#211915';

// Palette: lacquer, gold, jade, indigo, silk, ash. Each ramp is [light, mid, dark].
export const WASH = {
  red: ['#d2574a', '#a8261f', '#5e100c'],
  gold: ['#f7df92', '#d9a842', '#8f5f17'],
  jade: ['#8cc2a3', '#3f8c69', '#1d4f3c'],
  indigo: ['#6878a8', '#33447a', '#172140'],
  silk: ['#fffaf0', '#f6ead2', '#dcc79e'],
  mist: ['#f7f8f6', '#e6ebeb', '#bcc8c9'],
  wood: ['#c98e57', '#9a5f2e', '#5a3417'],
  ash: ['#e2ded6', '#aaa49a', '#6c665d'],
  night: ['#4a3c45', '#231c22', '#0e0a0d'],
};
const GOLD_LINE = '#e3b552';
const GOLD_HI = '#fbe9ad';
const GOLD_DARK = '#6e4611';

// ---------- deterministic noise, so a re-export gives the same pixels ----------
let seed = 1;
const reseed = (name) => { seed = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) || 1; };
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---------- shapes: a Path2D plus its bounding box ----------
export function R(x, y, w, h, r) {
  const p = new Path2D(); r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath();
  return { p, b: [x, y, w, h] };
}
export function E(cx, cy, rx, ry = rx) { const p = new Path2D(); p.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); return { p, b: [cx - rx, cy - ry, rx * 2, ry * 2] }; }
export function P(pts) {
  const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath();
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  return { p, b: [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)] };
}
export const D = (d, b) => ({ p: new Path2D(d), b });

// ---------- painting ----------
export function ink(g, p, w = 2.4, color = INK) {
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = color; g.lineWidth = w; g.stroke(p.p ?? p); g.restore();
}
export function line(g, d, w = 2.4, color = INK) { ink(g, new Path2D(d), w, color); }

// Fill a shape with a watercolour wash: graded body, blotches, darker edge, soft bloom, grain, ink line.
// For 9-sliced sprites pass blotch: false so nothing smears when the middle stretches.
export function paint(g, s, ramp, o = {}) {
  const { line: lw = 2.4, edge = 0.45, bloom = 0.32, grain = 0.5, blotch = true, dir = 'd' } = o;
  const [x, y, w, h] = s.b, m = Math.min(w, h);
  g.save();
  const gr = dir === 'v' ? g.createLinearGradient(0, y, 0, y + h) : g.createLinearGradient(x, y, x + w * 0.6, y + h);
  gr.addColorStop(0, ramp[0]); gr.addColorStop(0.55, ramp[1]); gr.addColorStop(1, ramp[2]);
  g.fillStyle = gr; g.fill(s.p);
  g.clip(s.p);
  if (blotch) {
    g.filter = `blur(${Math.max(2, m * 0.12)}px)`;
    for (let i = 0; i < 5; i++) {
      g.globalAlpha = 0.16; g.fillStyle = rnd() < 0.55 ? ramp[2] : ramp[0];
      g.beginPath(); g.arc(x + rnd() * w, y + rnd() * h, m * (0.12 + rnd() * 0.2), 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }
  if (edge) {
    g.filter = `blur(${Math.max(1.5, m * 0.07)}px)`;
    g.lineWidth = Math.max(4, m * 0.16); g.strokeStyle = ramp[2]; g.globalAlpha = edge; g.stroke(s.p); g.globalAlpha = 1;
  }
  g.filter = 'none';
  if (bloom) {
    const rg = g.createRadialGradient(x + w * 0.3, y + h * 0.22, 0, x + w * 0.3, y + h * 0.22, Math.max(w, h) * 0.6);
    rg.addColorStop(0, `rgba(255,251,238,${bloom})`); rg.addColorStop(1, 'rgba(255,251,238,0)');
    g.fillStyle = rg; g.fillRect(x, y, w, h);
  }
  if (grain) {
    const n = Math.round((w * h) / 22 * grain);
    for (let i = 0; i < n; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(40,20,10,0.07)'; g.fillRect(x + rnd() * w, y + rnd() * h, 1, 1); }
  }
  g.restore();
  if (lw) ink(g, s, lw);
}

// Gold thread: dark under-line, gold body, pale highlight.
export function gold(g, s, w = 2) {
  const p = s.p ?? s;
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  g.lineWidth = w + 1.6; g.strokeStyle = GOLD_DARK; g.stroke(p);
  g.lineWidth = w; g.strokeStyle = GOLD_LINE; g.stroke(p);
  g.lineWidth = Math.max(0.6, w * 0.35); g.strokeStyle = GOLD_HI; g.globalAlpha = 0.8; g.stroke(p);
  g.restore();
}
const goldPath = (g, d, w) => gold(g, new Path2D(d), w);

// A soft lacquer sheen across the top of a shape
function sheen(g, s, k = 0.35) {
  const [x, y, w, h] = s.b;
  g.save(); g.clip(s.p);
  const gr = g.createLinearGradient(0, y, 0, y + h * 0.55);
  gr.addColorStop(0, `rgba(255,248,230,${k})`); gr.addColorStop(1, 'rgba(255,248,230,0)');
  g.fillStyle = gr; g.fillRect(x, y, w, h * 0.55);
  g.restore();
}

// ---------- motifs, drawn in gold ----------
// Auspicious cloud (tường vân): a lobed cloud with a curl, centred on x, y, about 24*s wide.
export function cloud(g, x, y, s = 1, fillC = GOLD_LINE, lineC = GOLD_DARK) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const p = new Path2D('M-12 4C-16 4 -16 -3 -10 -3C-10 -9 -1 -11 1 -5C4 -10 12 -8 11 -2C16 -2 16 4 12 4Z');
  g.fillStyle = fillC; g.fill(p);
  g.lineWidth = 1.3 / s; g.strokeStyle = lineC; g.lineJoin = 'round'; g.stroke(p);
  const c = new Path2D('M-5 2C-8 2 -8 -2 -5 -2C-3 -2 -3 0 -4.5 0.5M4 2C1 2 1 -3 4 -3C6 -3 6 -1 4.5 -0.5');
  g.lineWidth = 1.1 / s; g.lineCap = 'round'; g.stroke(c);
  g.restore();
}
// Plum blossom: five round petals and a dark heart.
export function blossom(g, x, y, r, fillC = GOLD_LINE, lineC = GOLD_DARK) {
  g.save(); g.lineWidth = Math.max(0.8, r * 0.18); g.strokeStyle = lineC; g.fillStyle = fillC;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    g.beginPath(); g.arc(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.48, 0, 7); g.fill(); g.stroke();
  }
  g.beginPath(); g.arc(x, y, r * 0.28, 0, 7); g.fillStyle = lineC; g.fill();
  g.restore();
}
// Lotus: three petals over a shallow base.
export function lotus(g, x, y, s = 1, fillC = GOLD_LINE, lineC = GOLD_DARK) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const petals = ['M0 -12C5 -7 5 0 0 3C-5 0 -5 -7 0 -12Z', 'M-2 3C-9 2 -12 -4 -11 -8C-6 -6 -3 -2 -2 3Z', 'M2 3C9 2 12 -4 11 -8C6 -6 3 -2 2 3Z'];
  g.fillStyle = fillC; g.strokeStyle = lineC; g.lineWidth = 1.2 / s; g.lineJoin = 'round';
  for (const d of petals) { const p = new Path2D(d); g.fill(p); g.stroke(p); }
  const base = new Path2D('M-9 4Q0 9 9 4'); g.lineWidth = 1.6 / s; g.lineCap = 'round'; g.stroke(base);
  g.restore();
}
function star(cx, cy, ro, ri, n = 5) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? ri : ro; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return P(pts);
}

// ---------- the kit ----------
export function registerUiKit(add) {
  const ui = (name, [w, h], border, draw) => add(name, w, h, (g) => { reseed(name); draw(g, w, h); }, [0.5, 0.5], border);
  const flat = { blotch: false, grain: 0.25 };

  // Window frames. A lacquer band with gold trim and a cloud in each corner holds a silk board.
  function windowFrame(name, band, board) {
    ui(name, SIZE.panel, BORDER.panel, (g, w, h) => {
      const outer = R(3, 3, w - 6, h - 6, 16);
      paint(g, outer, band, { ...flat, line: 3, dir: 'v', bloom: 0.18 });
      sheen(g, outer, 0.22);
      gold(g, R(9, 9, w - 18, h - 18, 11), 1.6);
      const inner = R(22, 30, w - 44, h - 52, 6);
      paint(g, inner, board, { ...flat, line: 0, edge: 0.3, bloom: 0, dir: 'v' });
      gold(g, inner, 2.2);
      ink(g, R(20.5, 28.5, w - 41, h - 49, 7), 1.2);
      cloud(g, 15, 18, 0.42); cloud(g, w - 15, 18, 0.42);
      blossom(g, 14, h - 14, 4.2); blossom(g, w - 14, h - 14, 4.2);
    });
  }
  windowFrame('panel_amber', WASH.red, WASH.silk);
  windowFrame('panel_blue', WASH.indigo, WASH.mist);

  function board(name, ramp, trim) {
    ui(name, SIZE.board, BORDER.board, (g, w, h) => {
      const s = R(3, 3, w - 6, h - 6, 6);
      paint(g, s, ramp, { ...flat, line: 2.2, dir: 'v', bloom: 0.15 });
      ink(g, R(8, 8, w - 16, h - 16, 4), 1, trim);
    });
  }
  board('board_cream', WASH.silk, 'rgba(143,95,23,0.55)');
  board('board_blue', WASH.mist, 'rgba(51,68,122,0.45)');

  function row(name, ramp, goldTrim) {
    ui(name, SIZE.row, BORDER.row, (g, w, h) => {
      const s = R(3, 5, w - 6, h - 9, 6);
      paint(g, s, ramp, { ...flat, line: 2.2, dir: 'v', bloom: 0.2 });
      if (goldTrim) gold(g, R(8, 10, w - 16, h - 19, 4), 1.4);
      else ink(g, R(8, 10, w - 16, h - 19, 4), 1, 'rgba(143,95,23,0.4)');
    });
  }
  row('row_card', WASH.silk, false);
  row('row_selected', ['#fff3c4', '#f6d987', '#c99a3a'], true);

  // Buttons: a lacquer plaque sitting on its darker lip, with a gold inner thread.
  const BTN = { green: WASH.jade, blue: WASH.indigo, red: WASH.red, gold: WASH.gold, gray: WASH.ash };
  for (const [role, c] of Object.entries(BTN)) {
    const body = (g, w, h, ramp, dy, shine) => {
      const s = R(4, 5 + dy, w - 8, h - 14, 12);
      paint(g, s, ramp, { ...flat, line: 2.6, dir: 'v', bloom: shine ? 0.2 : 0 });
      if (shine) sheen(g, R(9, 8 + dy, w - 18, (h - 20) * 0.7, 9), 0.4);
      gold(g, R(9, 10 + dy, w - 18, h - 24, 7), 1.3);
    };
    const lip = (g, w, h, color) => { const s = R(4, 11, w - 8, h - 14, 12); g.fillStyle = color; g.fill(s.p); ink(g, s, 2.6); };
    ui(`btn_${role}_normal`, SIZE.button, BORDER.button, (g, w, h) => { lip(g, w, h, c[2]); body(g, w, h, c, 0, true); });
    ui(`btn_${role}_pressed`, SIZE.button, BORDER.button, (g, w, h) => { lip(g, w, h, c[2]); body(g, w, h, [c[1], c[1], c[2]], 4, false); });
    ui(`btn_${role}_disabled`, SIZE.button, BORDER.button, (g, w, h) => { lip(g, w, h, '#77726a'); body(g, w, h, ['#dedad3', '#bdb7ad', '#8f897f'], 0, false); });
  }

  // Close button: a round lacquer seal with a gold ring and a brushed cross.
  ui('btn_close', SIZE.close, null, (g, w, h) => {
    const lip = E(w / 2, h / 2 + 3, w / 2 - 5); g.fillStyle = WASH.red[2]; g.fill(lip.p); ink(g, lip, 2.6);
    const s = E(w / 2, h / 2, w / 2 - 5);
    paint(g, s, WASH.red, { line: 2.6, blotch: false, grain: 0.3 });
    gold(g, E(w / 2, h / 2, w / 2 - 10), 1.6);
    const k = 11, d = `M${w / 2 - k} ${h / 2 - k}L${w / 2 + k} ${h / 2 + k}M${w / 2 + k} ${h / 2 - k}L${w / 2 - k} ${h / 2 + k}`;
    line(g, d, 8.5); line(g, d, 5, '#fbf1dc');
  });

  // Item slot: a recessed wooden tray.
  ui('slot_item', SIZE.slot, BORDER.slot, (g, w, h) => {
    paint(g, R(3, 3, w - 6, h - 6, 8), WASH.wood, { ...flat, line: 2.4, dir: 'v', bloom: 0.15 });
    const inner = R(10, 10, w - 20, h - 20, 5);
    paint(g, inner, ['#e6d3ad', '#f1e4c6', '#f7eedb'], { ...flat, line: 1.6, dir: 'v', bloom: 0, edge: 0.5 });
  });

  // Progress: a dark lacquer groove and painted fills.
  ui('progress_track', SIZE.track, BORDER.track, (g, w, h) => {
    paint(g, R(3, 3, w - 6, h - 6, (h - 6) / 2), WASH.night, { ...flat, line: 2.2, dir: 'v', bloom: 0.08 });
    gold(g, R(6, 6, w - 12, h - 12, (h - 12) / 2), 1);
  });
  const FILL = { progress_fill: WASH.jade, progress_fill_blue: WASH.indigo, progress_fill_gold: WASH.gold, progress_fill_red: WASH.red };
  for (const [name, ramp] of Object.entries(FILL)) {
    ui(name, SIZE.track, BORDER.track, (g, w, h) => {
      const s = R(3, 3, w - 6, h - 6, (h - 6) / 2);
      paint(g, s, ramp, { ...flat, line: 1.8, dir: 'v', bloom: 0 });
      sheen(g, s, 0.45);
    });
  }

  // Title plate: red lacquer with a double gold thread and a cloud at each end.
  ui('title_plate', [180, 64], [28, 22, 28, 22], (g, w, h) => {
    const s = R(4, 8, w - 8, h - 16, 10);
    paint(g, s, WASH.red, { ...flat, line: 2.8, dir: 'v', bloom: 0.15 });
    sheen(g, s, 0.25);
    gold(g, R(9, 13, w - 18, h - 26, 6), 1.5);
    cloud(g, 18, h / 2, 0.38); cloud(g, w - 18, h / 2, 0.38);
  });

  // HUD chip and bar: black lacquer with a gold thread along the top edge.
  ui('chip_navy', SIZE.chip, BORDER.chip, (g, w, h) => {
    const s = R(3, 3, w - 6, h - 6, (h - 6) / 2);
    paint(g, s, WASH.night, { ...flat, line: 2.4, dir: 'v', bloom: 0.1 });
    sheen(g, R(8, 6, w - 16, h * 0.4, h * 0.2), 0.18);
    gold(g, R(7, 7, w - 14, h - 14, (h - 14) / 2), 1.1);
  });
  ui('bar_navy', SIZE.bar, BORDER.bar, (g, w, h) => {
    const s = R(3, 3, w - 6, h - 6, 12);
    paint(g, s, WASH.night, { ...flat, line: 2.4, dir: 'v', bloom: 0.1 });
    sheen(g, s, 0.14);
    goldPath(g, `M14 9H${w - 14}`, 1.4);
    goldPath(g, `M14 ${h - 9}H${w - 14}`, 1);
  });

  // Tabs: pale wood when off, gold brocade when on.
  function tab(name, ramp, on) {
    ui(name, SIZE.tab, BORDER.tab, (g, w, h) => {
      const s = R(3, 4, w - 6, h - 7, 10);
      paint(g, s, ramp, { ...flat, line: 2.4, dir: 'v', bloom: 0.2 });
      sheen(g, s, on ? 0.35 : 0.2);
      if (on) gold(g, R(8, 9, w - 16, h - 17, 6), 1.2);
      else ink(g, R(8, 9, w - 16, h - 17, 6), 1, 'rgba(90,52,23,0.45)');
    });
  }
  tab('tab_off', ['#efe2c8', '#d7c09a', '#a88a5e'], false);
  tab('tab_on', WASH.gold, true);

  for (const [name, ramp] of [['badge_red', WASH.red], ['badge_green', WASH.jade], ['badge_blue', WASH.indigo]]) {
    ui(name, SIZE.badge, BORDER.badge, (g, w, h) => {
      const s = R(3, 3, w - 6, h - 6, (h - 6) / 2);
      paint(g, s, ramp, { ...flat, line: 2.2, dir: 'v', bloom: 0.25 });
      sheen(g, s, 0.35);
    });
  }

  // Tooltip: a slip of rice paper, and a separate tail that merges into it.
  ui('tooltip_body', SIZE.tooltip, BORDER.tooltip, (g, w, h) => {
    paint(g, R(3, 3, w - 6, h - 6, 10), WASH.silk, { ...flat, line: 2.2, dir: 'v', bloom: 0.2 });
  });
  add('tooltip_tail', SIZE.tooltipTail[0], SIZE.tooltipTail[1], (g) => {
    const s = P([[4, -6], [32, -6], [18, 19]]);
    g.fillStyle = WASH.silk[1]; g.fill(s.p);
    line(g, 'M4 -6L18 19L32 -6', 2.2);
  }, [0.5, 1]);

  const TOAST = { toast_info: WASH.silk, toast_success: WASH.jade, toast_warning: WASH.gold, toast_error: WASH.red };
  for (const [name, ramp] of Object.entries(TOAST)) {
    ui(name, SIZE.toast, BORDER.toast, (g, w, h) => {
      const s = R(3, 3, w - 6, h - 8, 16);
      paint(g, s, ramp, { ...flat, line: 2.4, dir: 'v', bloom: 0.2 });
      gold(g, R(8, 8, w - 16, h - 18, 11), 1.2);
    });
  }

  // Scroll thumb: a short length of bamboo.
  ui('scroll_thumb', SIZE.thumb, BORDER.thumb, (g, w, h) => {
    paint(g, R(2, 2, w - 4, h - 4, (w - 4) / 2), ['#d9d48a', '#a8a24c', '#6a6a2a'], { ...flat, line: 1.6, dir: 'd', bloom: 0.2 });
  });
  ui('divider', SIZE.divider, BORDER.divider, (g, w) => {
    goldPath(g, `M2 3H${w - 2}`, 1.6);
  });

  ui('ui_avatar_frame', [108, 108], [0, 0, 0, 0], (g, w, h) => {
    const s = E(54, 54, 50);
    paint(g, s, WASH.gold, { line: 2.8, blotch: false, grain: 0.3 });
    sheen(g, s, 0.3);
    ink(g, E(54, 54, 41), 2);
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; blossom(g, 54 + Math.cos(a) * 45.5, 54 + Math.sin(a) * 45.5, 3.2, GOLD_HI, GOLD_DARK); }
  });

  ui('ui_ribbon', [320, 64], [40, 20, 40, 20], (g, w) => {
    const s = P([[0, 12], [24, 32], [0, 52], [w, 52], [w - 24, 32], [w, 12]]);
    paint(g, s, WASH.red, { ...flat, line: 2.6, dir: 'v', bloom: 0.15 });
    goldPath(g, `M26 17H${w - 26}M26 47H${w - 26}`, 1.6);
  });

  registerIcons(ui);
}

// ---------- icons, 96 x 96: painted objects with an ink line ----------
function registerIcons(ui) {
  const icon = (name, draw) => ui(`icon_${name}`, SIZE.icon, null, draw);
  const L = 3; // outer ink line
  const glyph = (d) => (g) => { line(g, d, 16); line(g, d, 10, '#fbf1dc'); };

  // Old Vietnamese cash coin: gold disc with a square hole.
  icon('coin', (g) => {
    const s = E(48, 50, 38);
    paint(g, s, WASH.gold, { line: L });
    ink(g, E(48, 50, 30), 1.6, GOLD_DARK);
    const hole = R(39, 41, 18, 18, 2); g.fillStyle = '#5e3c10'; g.fill(hole.p); ink(g, hole, 2);
    line(g, 'M48 22V30M48 70V78M20 50H28M68 50H76', 3, GOLD_DARK);
    line(g, 'M24 38C28 28 36 22 44 20', 3, 'rgba(255,248,220,0.8)');
  });

  icon('gem', (g) => {
    const s = P([[28, 14], [68, 14], [88, 38], [48, 86], [8, 38]]);
    paint(g, s, WASH.jade, { line: L });
    line(g, 'M8 38H88M28 14L38 38L48 86M68 14L58 38L48 86M38 38L48 14L58 38', 1.6, 'rgba(33,25,21,0.55)');
    const hi = P([[31, 19], [45, 19], [38, 33], [20, 33]]); g.fillStyle = 'rgba(255,255,240,0.45)'; g.fill(hi.p);
  });

  icon('energy', (g) => {
    paint(g, P([[58, 6], [20, 54], [43, 54], [33, 90], [77, 38], [54, 38], [68, 6]]), WASH.gold, { line: L });
  });

  icon('fame', (g) => {
    paint(g, P([[28, 54], [44, 54], [36, 92], [26, 80], [14, 84]]), WASH.red, { line: 2.4 });
    paint(g, P([[52, 54], [68, 54], [82, 84], [70, 80], [60, 92]]), WASH.red, { line: 2.4 });
    paint(g, E(48, 40, 32), WASH.gold, { line: L });
    ink(g, E(48, 40, 24), 1.4, GOLD_DARK);
    lotus(g, 48, 42, 1.5, WASH.red[1], INK);
  });

  icon('level_star', (g) => {
    paint(g, star(48, 52, 44, 20), WASH.gold, { line: L });
    blossom(g, 48, 52, 7, WASH.red[1], INK);
  });

  icon('time', (g) => {
    paint(g, E(48, 50, 38), WASH.red, { line: L });
    paint(g, E(48, 50, 29), WASH.silk, { line: 2, blotch: false });
    line(g, 'M48 50V30M48 50L62 58', 5);
    line(g, 'M48 26V29M48 71V74M24 50H27M69 50H72', 2.4, GOLD_DARK);
  });

  icon('heart', (g) => {
    paint(g, D('M48 86C20 64 8 48 8 31C8 19 17 10 28 10C37 10 44 15 48 22C52 15 59 10 68 10C79 10 88 19 88 31C88 48 76 64 48 86Z', [8, 10, 80, 76]), WASH.red, { line: L });
    blossom(g, 66, 30, 6, '#f6c7c0', WASH.red[2]);
  });

  icon('lock', (g) => {
    const sh = 'M30 46V32A18 18 0 0 1 66 32V46';
    line(g, sh, 15); line(g, sh, 9, '#c9c3b8');
    const s = R(16, 44, 64, 44, 10);
    paint(g, s, WASH.gold, { line: L });
    cloud(g, 30, 54, 0.4, GOLD_HI); cloud(g, 66, 78, 0.4, GOLD_HI);
    const key = D('M48 56A6 6 0 0 1 52 66L54 78H42L44 66A6 6 0 0 1 48 56Z', [42, 56, 12, 22]); g.fillStyle = INK; g.fill(key.p);
  });

  icon('check', glyph('M18 50L40 72L80 26'));
  icon('plus', glyph('M48 16V80M16 48H80'));
  icon('minus', glyph('M16 48H80'));
  icon('arrow_left', glyph('M60 14L26 48L60 82'));
  icon('close', glyph('M22 22L74 74M74 22L22 74'));

  icon('warning', (g) => {
    paint(g, P([[48, 10], [90, 82], [6, 82]]), WASH.gold, { line: L });
    line(g, 'M48 36V58', 8); g.fillStyle = INK; g.beginPath(); g.arc(48, 70, 5, 0, 7); g.fill();
  });

  icon('info', (g) => {
    paint(g, E(48, 50, 38), WASH.indigo, { line: L });
    g.fillStyle = '#fbf1dc'; g.beginPath(); g.arc(48, 31, 6, 0, 7); g.fill();
    line(g, 'M48 45V71', 9, '#fbf1dc');
  });

  // Street stall: striped awning over a wooden counter with bowls.
  icon('stall', (g) => {
    paint(g, R(18, 48, 60, 36, 4), WASH.wood, { line: L });
    line(g, 'M18 60H78', 1.6, 'rgba(33,25,21,0.5)');
    paint(g, E(36, 46, 8, 4), WASH.silk, { line: 1.8, blotch: false });
    paint(g, E(58, 46, 8, 4), WASH.silk, { line: 1.8, blotch: false });
    const aw = P([[10, 38], [20, 14], [76, 14], [86, 38]]);
    paint(g, aw, WASH.red, { line: L });
    g.save(); g.clip(aw.p); g.fillStyle = 'rgba(251,241,220,0.9)';
    for (const x of [30, 52, 74]) g.fill(P([[x - 6, 14], [x + 4, 14], [x + 7, 38], [x - 5, 38]]).p);
    g.restore(); ink(g, aw, L);
  });

  // Staff: a vendor in a conical hat and indigo shirt.
  icon('staff', (g) => {
    paint(g, D('M20 88C20 66 30 58 48 58C66 58 76 66 76 88Z', [20, 58, 56, 30]), WASH.indigo, { line: L });
    paint(g, E(48, 46, 13), ['#fde6cc', '#f2c79c', '#c98f62'], { line: 2.4, blotch: false });
    paint(g, P([[48, 8], [86, 38], [10, 38]]), ['#f8ecc6', '#e2c98a', '#a98846'], { line: L });
    line(g, 'M48 8L32 38M48 8L64 38', 1.2, 'rgba(110,70,17,0.6)');
  });

  // Wardrobe: an áo dài on a hanger.
  icon('wardrobe', (g) => {
    line(g, 'M48 14C48 8 56 8 56 13C56 17 48 17 48 22', 2.4);
    line(g, 'M20 30L48 22L76 30', 2.4);
    const s = D('M38 26L48 30L58 26L78 40L72 50L64 44L62 66L70 90H26L34 66L32 44L24 50L18 40Z', [18, 26, 60, 64]);
    paint(g, s, WASH.red, { line: L });
    line(g, 'M48 30V90', 1.4, 'rgba(33,25,21,0.45)');
    blossom(g, 42, 52, 4.5); blossom(g, 56, 72, 4.5); cloud(g, 40, 80, 0.35);
  });

  // Shop: a shopfront with a jade awning.
  icon('shop', (g) => {
    paint(g, R(18, 40, 60, 46, 3), WASH.silk, { line: L });
    paint(g, R(38, 56, 20, 30, 2), WASH.wood, { line: 2.2 });
    paint(g, R(22, 52, 12, 14, 2), WASH.mist, { line: 1.8, blotch: false });
    paint(g, R(62, 52, 12, 14, 2), WASH.mist, { line: 1.8, blotch: false });
    const aw = D('M12 22H84V36Q78 44 72 36Q66 44 60 36Q54 44 48 36Q42 44 36 36Q30 44 24 36Q18 44 12 36Z', [12, 22, 72, 22]);
    paint(g, aw, WASH.jade, { line: L });
  });

  // Log: a thread-bound book with an indigo cover.
  icon('log', (g) => {
    paint(g, R(20, 12, 58, 74, 4), WASH.indigo, { line: L });
    line(g, 'M30 12V86', 1.6, 'rgba(251,241,220,0.6)');
    for (const y of [22, 40, 58, 76]) line(g, `M24 ${y}H30`, 1.4, 'rgba(251,241,220,0.7)');
    paint(g, R(42, 22, 24, 40, 2), WASH.silk, { line: 1.8, blotch: false });
    line(g, 'M48 32H60M48 40H60M48 48H56', 1.6, 'rgba(33,25,21,0.6)');
  });

  // Bus: an old city bus, cream over green.
  icon('bus', (g) => {
    paint(g, R(10, 22, 76, 50, 12), WASH.jade, { line: L });
    paint(g, R(10, 22, 76, 24, 12), WASH.silk, { line: 0, blotch: false });
    ink(g, R(10, 22, 76, 50, 12), L);
    for (const x of [16, 36, 56]) paint(g, R(x, 28, 16, 14, 2), WASH.mist, { line: 1.8, blotch: false });
    line(g, 'M10 52H86', 2, GOLD_DARK);
    for (const x of [28, 68]) { paint(g, E(x, 74, 9), WASH.night, { line: 2.4, blotch: false }); g.fillStyle = '#c9c3b8'; g.beginPath(); g.arc(x, 74, 3, 0, 7); g.fill(); }
  });

  // Home: a tile-roofed house.
  icon('home', (g) => {
    paint(g, R(22, 44, 52, 42, 2), WASH.silk, { line: L });
    paint(g, R(40, 58, 16, 28, 2), WASH.wood, { line: 2.2 });
    const roof = D('M6 46Q20 40 30 26L48 12L66 26Q76 40 90 46Z', [6, 12, 84, 34]);
    paint(g, roof, WASH.red, { line: L });
    line(g, 'M22 36H74M14 42H82', 1.4, 'rgba(33,25,21,0.45)');
  });

  icon('more', (g) => {
    const tiles = [[18, 18, WASH.red], [52, 18, WASH.jade], [18, 52, WASH.gold], [52, 52, WASH.indigo]];
    for (const [x, y, c] of tiles) { const s = R(x, y, 26, 26, 6); paint(g, s, c, { line: 2.6, blotch: false }); sheen(g, s, 0.3); }
  });

  icon('banana', (g) => {
    paint(g, D('M18 62C26 78 50 84 70 70C82 60 86 42 82 22C76 24 70 32 66 40C58 54 42 62 22 58Z', [18, 22, 68, 62]), WASH.gold, { line: L });
    line(g, 'M28 66C46 72 66 62 76 38', 1.6, 'rgba(110,70,17,0.6)');
    line(g, 'M82 22L86 14', 4, '#4b5a22');
  });

  // Store: a wooden crate.
  icon('store', (g) => {
    paint(g, R(14, 20, 68, 62, 3), WASH.wood, { line: L });
    line(g, 'M14 41H82M14 61H82', 2, INK);
    line(g, 'M20 22L76 80', 2, 'rgba(33,25,21,0.6)');
    for (const [x, y] of [[20, 26], [76, 26], [20, 76], [76, 76]]) { g.fillStyle = INK; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
  });

  icon('map', (g) => {
    paint(g, P([[12, 26], [36, 18], [60, 26], [84, 18], [84, 72], [60, 80], [36, 72], [12, 80]]), WASH.silk, { line: L });
    line(g, 'M36 18V72M60 26V80', 1.4, 'rgba(33,25,21,0.4)');
    line(g, 'M20 66Q34 44 48 52T76 36', 2.6, WASH.indigo[1]);
    paint(g, D('M48 18C41 18 36 23 36 30C36 39 48 54 48 54C48 54 60 39 60 30C60 23 55 18 48 18Z', [36, 18, 24, 36]), WASH.red, { line: 2.4 });
    g.fillStyle = '#fbf1dc'; g.beginPath(); g.arc(48, 30, 4, 0, 7); g.fill();
  });

  // Wholesale market: a woven bamboo basket of fruit with a price tag.
  icon('market', (g) => {
    paint(g, E(36, 40, 12), WASH.red, { line: 2.4, blotch: false });
    paint(g, E(58, 40, 12), WASH.gold, { line: 2.4, blotch: false });
    paint(g, E(47, 34, 10), WASH.jade, { line: 2.4, blotch: false });
    const b = D('M12 46H84L74 84H22Z', [12, 46, 72, 38]);
    paint(g, b, ['#e8cf96', '#c9a35e', '#8a6631'], { line: L });
    g.save(); g.clip(b.p);
    for (let y = 52; y < 84; y += 7) line(g, `M10 ${y}H86`, 1.2, 'rgba(90,52,23,0.55)');
    for (let x = 14; x < 86; x += 9) line(g, `M${x} 46L${x + 4} 84`, 1, 'rgba(90,52,23,0.4)');
    g.restore();
    paint(g, R(34, 56, 28, 18, 3), WASH.silk, { line: 1.8, blotch: false });
    g.font = 'bold 13px "Times New Roman"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = WASH.red[1]; g.fillText('SỈ', 48, 66);
  });

  icon('neighbours', (g) => {
    paint(g, R(12, 40, 34, 46, 2), WASH.silk, { line: L });
    paint(g, P([[8, 42], [29, 22], [50, 42]]), WASH.indigo, { line: L });
    paint(g, R(48, 34, 38, 52, 2), WASH.silk, { line: L });
    paint(g, P([[44, 36], [67, 14], [90, 36]]), WASH.red, { line: L });
    paint(g, R(23, 64, 12, 22, 2), WASH.wood, { line: 2 });
    paint(g, R(61, 62, 12, 24, 2), WASH.wood, { line: 2 });
    paint(g, D('M48 22C46 18 42 16 39 18C35 20 36 24 40 28L48 35L56 28C60 24 61 20 57 18C54 16 50 18 48 22Z', [36, 16, 24, 19]), WASH.red, { line: 2, blotch: false });
  });

  // Orders: a parcel tied with string.
  icon('orders', (g) => {
    paint(g, P([[48, 14], [84, 30], [48, 46], [12, 30]]), ['#ecd3a0', '#d4b071', '#9b7a3c'], { line: L });
    paint(g, P([[12, 30], [48, 46], [48, 86], [12, 70]]), ['#d4b071', '#b88f4f', '#7d5a26'], { line: L });
    paint(g, P([[84, 30], [48, 46], [48, 86], [84, 70]]), ['#c49f60', '#a07a3d', '#6a4a1c'], { line: L });
    line(g, 'M30 22L66 38L66 78M30 38V78', 2.2, WASH.red[1]);
    blossom(g, 66, 38, 5, WASH.red[1], INK);
  });

  // Season: a gold trophy cup with a lotus.
  icon('season', (g) => {
    line(g, 'M24 26C10 26 12 46 26 48M72 26C86 26 84 46 70 48', 7); line(g, 'M24 26C10 26 12 46 26 48M72 26C86 26 84 46 70 48', 3.6, GOLD_LINE);
    paint(g, R(42, 54, 12, 18, 2), WASH.gold, { line: 2.4, blotch: false });
    paint(g, R(26, 70, 44, 16, 3), WASH.night, { line: L, blotch: false });
    paint(g, P([[22, 18], [74, 18], [66, 46], [48, 56], [30, 46]]), WASH.gold, { line: L });
    lotus(g, 48, 36, 1.1, WASH.red[1], INK);
  });

  // Fortune: a bamboo tube of fortune sticks.
  icon('fortune', (g) => {
    for (const [x0, x1, y] of [[36, 28, 10], [44, 44, 6], [52, 60, 8], [60, 72, 14]]) { line(g, `M${x0} 36L${x1} ${y}`, 6); line(g, `M${x0} 36L${x1} ${y}`, 3.4, '#ecd9a0'); g.fillStyle = WASH.red[1]; g.beginPath(); g.arc(x1, y, 3, 0, 7); g.fill(); }
    paint(g, R(28, 32, 40, 56, 6), WASH.red, { line: L });
    goldPath(g, 'M28 42H68M28 78H68', 2);
    cloud(g, 48, 60, 0.6);
  });

  // Activities: a feathered shuttlecock.
  icon('activities', (g) => {
    paint(g, P([[46, 40], [22, 10], [36, 38]]), WASH.red, { line: 2.2 });
    paint(g, P([[44, 38], [48, 6], [54, 38]]), WASH.gold, { line: 2.2 });
    paint(g, P([[50, 40], [74, 10], [60, 38]]), WASH.indigo, { line: 2.2 });
    paint(g, E(48, 58, 22, 8), WASH.silk, { line: 2.2, blotch: false });
    paint(g, E(48, 68, 24, 10), WASH.red, { line: L, blotch: false });
    paint(g, E(48, 78, 22, 8), WASH.night, { line: L, blotch: false });
  });

  // Café: a phin filter over a glass of milk coffee.
  icon('cafe', (g) => {
    paint(g, P([[26, 44], [70, 44], [64, 86], [32, 86]]), ['#8a5a36', '#5a3820', '#2c1a0e'], { line: L });
    const milk = P([[29, 70], [67, 70], [64, 86], [32, 86]]); g.fillStyle = 'rgba(246,234,210,0.9)'; g.fill(milk.p); ink(g, P([[26, 44], [70, 44], [64, 86], [32, 86]]), L);
    paint(g, R(18, 38, 60, 8, 3), WASH.ash, { line: 2.4, blotch: false });
    paint(g, R(30, 18, 36, 22, 3), WASH.ash, { line: 2.4, blotch: false });
    paint(g, R(28, 13, 40, 6, 2), WASH.ash, { line: 2, blotch: false });
    line(g, 'M44 10Q40 4 44 0M54 10Q58 4 54 0', 1.6, 'rgba(33,25,21,0.4)');
  });

  icon('barber', (g) => {
    paint(g, P([[24, 72], [70, 18], [76, 22], [30, 76]]), WASH.mist, { line: 2.4, blotch: false });
    paint(g, P([[72, 72], [26, 18], [20, 22], [66, 76]]), WASH.mist, { line: 2.4, blotch: false });
    for (const [x, c] of [[22, WASH.red], [74, WASH.indigo]]) { paint(g, E(x, 76, 11), c, { line: L, blotch: false }); g.fillStyle = '#fbf1dc'; g.beginPath(); g.arc(x, 76, 5, 0, 7); g.fill(); ink(g, E(x, 76, 5), 1.6); }
    paint(g, E(48, 47, 4.5), WASH.gold, { line: 1.8, blotch: false });
  });

  icon('crop', (g) => {
    paint(g, E(48, 74, 34, 13), ['#8a6040', '#5e3c22', '#33200f'], { line: L });
    line(g, 'M48 72Q46 54 48 40', 5); line(g, 'M48 72Q46 54 48 40', 2.6, WASH.jade[1]);
    paint(g, D('M48 46C38 46 22 40 18 24C32 22 44 30 48 46Z', [18, 22, 30, 24]), WASH.jade, { line: 2.4 });
    paint(g, D('M48 40C56 38 72 30 78 14C64 14 52 24 48 40Z', [48, 14, 30, 26]), WASH.jade, { line: 2.4 });
  });

  // Kitchen: a clay pot on a charcoal stove.
  icon('kitchen', (g) => {
    paint(g, R(26, 66, 44, 20, 4), ['#b77a4a', '#8a5030', '#4e2a14'], { line: L });
    g.fillStyle = '#f2a03a'; g.fill(R(38, 72, 20, 8, 3).p); ink(g, R(38, 72, 20, 8, 3), 1.6);
    paint(g, D('M20 44H76C76 60 66 68 48 68C30 68 20 60 20 44Z', [20, 44, 56, 24]), ['#7b6a5e', '#4d3f36', '#231b17'], { line: L });
    paint(g, E(48, 44, 30, 6), WASH.wood, { line: L, blotch: false });
    line(g, 'M36 34Q32 24 38 16M48 32Q52 22 46 14M60 34Q64 24 58 16', 2.2, 'rgba(33,25,21,0.35)');
  });

  // Decoration: a red silk lantern with gold tassel.
  icon('decoration', (g) => {
    line(g, 'M48 6V18', 2.4);
    paint(g, R(36, 16, 24, 7, 2), WASH.gold, { line: 2, blotch: false });
    paint(g, E(48, 46, 30, 24), WASH.red, { line: L });
    ink(g, E(48, 46, 15, 24), 1.4, 'rgba(33,25,21,0.45)');
    cloud(g, 48, 46, 0.7);
    paint(g, R(36, 68, 24, 7, 2), WASH.gold, { line: 2, blotch: false });
    for (const x of [42, 48, 54]) line(g, `M${x} 76V${x === 48 ? 92 : 88}`, 2.6, GOLD_LINE);
  });

  // Daily: a tear-off calendar block.
  icon('daily', (g) => {
    paint(g, R(18, 18, 60, 68, 4), WASH.silk, { line: L });
    paint(g, R(18, 18, 60, 20, 4), WASH.red, { line: L, blotch: false });
    for (const x of [32, 64]) { line(g, `M${x} 12V24`, 6); line(g, `M${x} 12V24`, 3, '#c9c3b8'); }
    line(g, 'M30 52L40 62L60 44', 5, WASH.jade[2]);
    line(g, 'M28 74H68', 1.6, 'rgba(33,25,21,0.45)');
  });

  // Profession: a carrying pole with two baskets.
  icon('profession', (g) => {
    line(g, 'M8 30Q48 20 88 30', 6); line(g, 'M8 30Q48 20 88 30', 3.2, '#d9c07a');
    for (const x of [22, 74]) {
      line(g, `M${x - 10} 54L${x} 30L${x + 10} 54`, 1.6);
      const b = D(`M${x - 16} 54H${x + 16}L${x + 12} 80H${x - 12}Z`, [x - 16, 54, 32, 26]);
      paint(g, b, ['#e8cf96', '#c9a35e', '#8a6631'], { line: L });
      line(g, `M${x - 14} 64H${x + 14}M${x - 13} 72H${x + 13}`, 1.2, 'rgba(90,52,23,0.55)');
    }
  });

  // Vehicle: a bicycle with a front basket.
  icon('vehicle', (g) => {
    for (const x of [24, 72]) { ink(g, E(x, 64, 17), 6); ink(g, E(x, 64, 17), 2.6, '#6c665d'); g.fillStyle = INK; g.beginPath(); g.arc(x, 64, 3, 0, 7); g.fill(); }
    line(g, 'M24 64L42 42H64L72 64M42 42L50 64L64 42M50 64H24M64 42L62 30H70', 5);
    line(g, 'M24 64L42 42H64L72 64M42 42L50 64L64 42M50 64H24M64 42L62 30H70', 2.6, WASH.jade[1]);
    paint(g, R(34, 34, 16, 5, 2), WASH.night, { line: 1.6, blotch: false });
    paint(g, D('M66 30H86L82 44H70Z', [66, 30, 20, 14]), ['#e8cf96', '#c9a35e', '#8a6631'], { line: 2.2 });
  });

  // Quest: an unrolled scroll with a red seal.
  icon('quest', (g) => {
    paint(g, R(22, 16, 52, 64, 3), WASH.silk, { line: L });
    paint(g, R(16, 10, 64, 10, 5), WASH.wood, { line: 2.4, blotch: false });
    paint(g, R(16, 76, 64, 10, 5), WASH.wood, { line: 2.4, blotch: false });
    line(g, 'M32 30H64M32 40H64M32 50H50', 2, 'rgba(33,25,21,0.55)');
    paint(g, R(52, 52, 18, 18, 3), WASH.red, { line: 2, blotch: false });
    g.font = 'bold 15px "Times New Roman"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fbf1dc'; g.fillText('!', 61, 62);
  });

  // Mail: an envelope closed with a red wax seal.
  icon('mail', (g) => {
    paint(g, R(12, 26, 72, 50, 4), WASH.silk, { line: L });
    line(g, 'M12 76L40 52M84 76L56 52', 1.6, 'rgba(33,25,21,0.45)');
    paint(g, P([[12, 28], [48, 56], [84, 28]]), ['#fbf3e2', '#efe0bf', '#d4bb8a'], { line: L, blotch: false });
    paint(g, E(48, 55, 8), WASH.red, { line: 2, blotch: false });
    blossom(g, 48, 55, 3.4, '#f0b0a6', WASH.red[2]);
  });

  icon('settings', (g) => {
    const pts = [];
    for (let i = 0; i < 16; i++) { const a0 = (i * Math.PI) / 8 - 0.17, a1 = (i * Math.PI) / 8 + 0.17, r = i % 2 ? 29 : 38; pts.push([48 + Math.cos(a0) * r, 48 + Math.sin(a0) * r], [48 + Math.cos(a1) * r, 48 + Math.sin(a1) * r]); }
    paint(g, P(pts), WASH.gold, { line: L });
    paint(g, E(48, 48, 13), WASH.night, { line: 2.4, blotch: false });
    g.fillStyle = '#fbf1dc'; g.beginPath(); g.arc(48, 48, 5, 0, 7); g.fill();
  });

  const speaker = (g, ramp) => paint(g, P([[14, 36], [32, 36], [50, 18], [50, 78], [32, 60], [14, 60]]), ramp, { line: L });
  icon('sound_on', (g) => {
    speaker(g, WASH.jade);
    for (const r of [14, 26]) { const p = new Path2D(); p.arc(52, 48, r, -0.95, 0.95); ink(g, p, 6.5); ink(g, p, 3, WASH.jade[0]); }
  });
  icon('sound_off', (g) => {
    speaker(g, WASH.ash);
    line(g, 'M60 36L82 58M82 36L60 58', 9); line(g, 'M60 36L82 58M82 36L60 58', 4.6, WASH.red[0]);
  });
}
