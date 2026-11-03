import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { taoHoatCanh } from './hoatcanh.js';

// =====================================================================
//  Cấu hình
// =====================================================================
const W = 1080, H = 1920;
const params = new URLSearchParams(location.search);
if (params.has('debug')) document.body.classList.add('debug');
let CFG = {
  tenXom: 'XÓM TRỌ SINH VIÊN', tenChuTro: 'Chú chủ trọ', xungHo: 'chú', docGiong: true, tocDoDoc: 0.95,
  soTang: 5, soPhongMoiTang: 5, nhacNen: true, amLuongNhac: 0.35, fileNhac: 'nhac-nen.mp3',
  timDeCoDien: 300, phutGiuaCacLanMatDien: 7, phutGiuaCacLanMua: 5, phutNgayDem: 2, giayMoiThongBao: 150,
  amThanh: true, amLuong: 0.6, tiengXe: true, thongBaoChuTro: [], tuCam: [],
  phutGiuaCacLanTrom: 6, phutGiuaCacLanDo: 4, cauDo: [], quaySo: true, giayQuaySo: 60,
  bloom: true, tuDongGiamDoHoa: true, phutThiDua: 10,
};
try { CFG = { ...CFG, ...(await (await fetch('config.json')).json()) }; } catch (_) {}
try { await Promise.race([document.fonts.load('900 40px "Be Vietnam Pro"'), new Promise((r) => setTimeout(r, 2500))]); } catch (_) {}

const stage = document.getElementById('stage');
// ?xoay=90 hoặc ?xoay=-90: xoay cả khung để dùng nguồn Link nằm ngang 1920×1080, rồi xoay nguồn lại trong LIVE Studio.
// LIVE Studio không cho nguồn Link cao hơn màn hình máy tính, nên nguồn dọc 1080×1920 thực ra chỉ được 1080×1032 và bị mờ.
const XOAY = [90, -90].includes(Number(params.get('xoay'))) ? Number(params.get('xoay')) : 0;
const fitScale = () => (XOAY ? Math.min(innerWidth / H, innerHeight / W) : Math.min(innerWidth / W, innerHeight / H));
const fit = () => { stage.style.transform = `translate(-50%,-50%)${XOAY ? ` rotate(${XOAY}deg)` : ''} scale(${fitScale()})`; };
addEventListener('resize', fit); fit();
// tiêu đề lớn đã bỏ (chủ kênh yêu cầu); tenXom vẫn dùng cho lời chủ trọ
document.querySelector('#landlady .who').textContent = `🧔 ${CFG.tenChuTro}`;
let XH = CFG.xungHo || 'chú'; // chủ trọ tự xưng

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const plain = (s) => ` ${String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// =====================================================================
//  Lọc chữ
// =====================================================================
let BANNED = (CFG.tuCam || []).map((w) => plain(w).trim()).filter(Boolean);
const hasBanned = (s) => { const p = plain(s); return BANNED.some((w) => p.includes(` ${w} `)); };
const cleanName = (s) => {
  s = String(s || '').replace(/\s+/g, ' ').trim() || 'Bạn';
  if (hasBanned(s)) return 'Người thuê';
  return s.length > 14 ? s.slice(0, 13) + '…' : s;
};
const cleanText = (s) => {
  s = String(s || '').replace(/https?:\/\/\S+|www\.\S+/gi, '').replace(/(\+?84|0)[\d .-]{8,12}\d/g, '').replace(/\s+/g, ' ').trim();
  if (!s || hasBanned(s)) return '';
  return s.length > 70 ? s.slice(0, 68) + '…' : s;
};

// =====================================================================
//  Three.js: khung cảnh
// =====================================================================
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// Vẽ đúng số điểm ảnh thật trên màn hình: khung 1080×1920 được co/giãn theo cửa sổ, và Windows có thể đặt tỉ lệ 125–150%.
// Vẽ cố định 1080 rồi để trình duyệt phóng to thì hình 3D bị mờ. Tối đa gấp 2 để máy yếu không quá nặng (?nethd=1 khóa về 1).
// Mặc định vẽ gấp 2 rồi thu nhỏ (khử răng cưa kiểu siêu lấy mẫu) cho cạnh và chữ nét ở Full HD 1080×1920.
let qualityCap = 2; // tự giảm khi máy chạy chậm (xem autoQuality)
const renderScale = () => (params.has('nethd') ? 1 : clamp(Math.max(2, fitScale() * (devicePixelRatio || 1)), 1, qualityCap));
renderer.setPixelRatio(renderScale());
renderer.setSize(W, H, false);
addEventListener('resize', () => {
  const s = renderScale();
  if (Math.abs(s - renderer.getPixelRatio()) > 0.01) { renderer.setPixelRatio(s); renderer.setSize(W, H, false); if (composer) { composer.setPixelRatio(s); composer.setSize(W, H); } }
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b1030');
scene.fog = new THREE.Fog('#0b1030', 40, 90);

const camera = new THREE.PerspectiveCamera(57, W / H, 0.1, 200);

// ---------- Đèn tỏa sáng (bloom): cửa sổ, đèn nháy, pháo hoa, biển hiệu sáng lan ra như ảnh chụp đêm ----------
// Chỉ vật rất sáng mới tỏa (threshold cao). Tắt bằng bloom: false, ?nethd=1, hoặc tự tắt khi máy chậm.
let composer = null, bloomPass = null;
const bloomWanted = () => CFG.bloom !== false && !params.has('nethd') && !params.has('nobloom');
function setupBloom() {
  if (composer || !bloomWanted()) return;
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.4, 0.3, 1.4); // nửa độ phân giải cho nhẹ; chỉ chỗ rất sáng mới tỏa
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
}
function dropBloom() { if (!composer) return; composer.dispose(); composer = null; bloomPass = null; }
function draw() {
  if (composer && bloomWanted()) {
    // Ban ngày tường trắng dưới nắng đã vượt 1.1 nên bị cháy trắng: ngày gần như tắt, đêm tỏa nhiều hơn
    bloomPass.strength = 0.37 * (1 - dayS);
    bloomPass.threshold = 1.4 + 1.1 * dayS; // tường tòa B gần đèn tầng ~1.2 về đêm: ngưỡng 1.4 chỉ bắt cửa sổ sáng, đèn nháy, pháo hoa
    if (bloomPass.strength < 0.02) renderer.render(scene, camera); else composer.render();
  } else renderer.render(scene, camera);
}
// Tự giảm đồ họa: đo FPS mỗi 6 giây, chậm (< 38 fps) thì tắt bloom, rồi hạ độ nét 2× → 1.5× → 1×
const perf = { frames: 0, t0: performance.now(), level: 0 };
function autoQuality(now) {
  perf.frames++;
  if (now - perf.t0 < 6000) return;
  const fps = perf.frames * 1000 / (now - perf.t0);
  perf.frames = 0; perf.t0 = now;
  if (CFG.tuDongGiamDoHoa === false || params.has('dtmax') || document.hidden || fps >= 38) return;
  perf.level++;
  if (perf.level === 1 && composer) { dropBloom(); console.info('[xom] máy chậm, tắt bloom', fps.toFixed(1)); return; }
  const cap = qualityCap > 1.5 ? 1.5 : 1;
  if (cap === qualityCap) return;
  qualityCap = cap; renderer.setPixelRatio(renderScale()); renderer.setSize(W, H, false);
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H); }
  console.info('[xom] máy chậm, hạ độ nét xuống', cap, fps.toFixed(1));
}
const CAM_HOME = new THREE.Vector3();
const LOOK_HOME = new THREE.Vector3();

const ambient = new THREE.AmbientLight('#7d8cc4', 0.55);
const hemi = new THREE.HemisphereLight('#4a5aa8', '#2a1c12', 0.7);
const moon = new THREE.DirectionalLight('#a9b8ff', 0.9);
moon.position.set(-12, 30, 18);
scene.add(ambient, hemi, moon);

// ---------- Texture vẽ bằng canvas ----------
// Texture vẽ gấp TEX_Q lần (mặc định 2) để chữ, biển hiệu, cửa... nét hơn; code vẽ vẫn dùng kích thước gốc.
const TEX_Q = params.has('nethd') ? 1 : 2;
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w * TEX_Q; c.height = h * TEX_Q;
  const g = c.getContext('2d'); g.scale(TEX_Q, TEX_Q);
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const wallTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#d9c27a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rand(60, 120)},${rand(50, 90)},20,${rand(0.02, 0.08)})`; g.fillRect(rand(0, w), rand(0, h), rand(2, 10), rand(2, 10)); }
  for (let i = 0; i < 7; i++) { // vệt ố nước mưa
    const x = rand(0, w), gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(90,70,30,0.18)'); gr.addColorStop(1, 'rgba(90,70,30,0)');
    g.fillStyle = gr; g.fillRect(x, 0, rand(4, 14), rand(60, 200));
  }
}, [3, 2]);
const groundWallTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#b9b6ad'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(80,80,80,0.35)'; g.lineWidth = 2;
  for (let y = 0; y < h; y += 32) for (let x = (y / 32 % 2) * 32; x < w; x += 64) g.strokeRect(x, y, 64, 32);
}, [4, 1]);
const doorTex = (color) => canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = color; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 5;
  g.strokeRect(12, 14, w - 24, 100); g.strokeRect(12, 132, w - 24, 110);
  g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(16, 18, 10, 92);
  g.fillStyle = '#d8d0b0'; g.beginPath(); g.arc(w - 22, 135, 7, 0, Math.PI * 2); g.fill();
});
const windowBarsTex = canvasTex(128, 96, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.strokeStyle = '#2b2b2b'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  g.lineWidth = 3; for (let x = 18; x < w; x += 18) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
});
const glowTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
// bóng đổ mềm dưới chân người, xe (rẻ hơn shadow map rất nhiều): một đĩa mờ đen nằm sát đất
const blobTex = canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const BLOB_MAT = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
let BLOB_GEO = null;
function blob(parent, sx = 0.7, sz = sx, y = 0.02, x = 0, z = 0) {
  BLOB_GEO = BLOB_GEO || new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(BLOB_GEO, BLOB_MAT); m.scale.set(sx, 1, sz); m.position.set(x, y, z); m.renderOrder = 0.5; parent.add(m);
  return m;
}
const steamTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const emojiTex = (ch) => canvasTex(128, 128, (g, w, h) => {
  g.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, w / 2, h / 2 + 6);
});
const vipTex = canvasTex(256, 96, (g, w, h) => {
  g.fillStyle = 'rgba(30,10,40,0.85)'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ff5cd6'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
  g.font = '900 64px "Be Vietnam Pro", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#ff5cd6'; g.shadowBlur = 20; g.fillStyle = '#ffe6fb'; g.fillText('★ VIP ★', w / 2, h / 2 + 4);
});

const M = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...opts });
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

// ---------- Kích thước khu trọ: 3 tòa xếp chữ U quanh sân chung ----------
// Tòa B ở giữa phía sau, tòa A (trái) và tòa C (phải) xòe chéo về phía máy quay để vẫn nhìn rõ phòng.
// soPhongMoiTang là số phòng mỗi tầng của MỖI tòa (mặc định 3). Tầng trệt là cửa hàng (tạp hóa, hiệu thuốc...).
const GROUND_H = 3.6, FLOOR_H = 3.0, ROOM_W = 3.4;
const FLOORS = clamp(Math.round(CFG.soTang) || 5, 2, 8);
const COLS = clamp(Math.round(CFG.soPhongMoiTang) || 3, 2, 5);
// tòa trái (A) và phải (C) có thể nhiều phòng hơn tòa giữa: soPhongToaBen (mặc định = soPhongMoiTang + 2)
const SIDE_COLS = clamp(Math.round(CFG.soPhongToaBen) || COLS + 2, 2, 7), MID_COLS = COLS;
const CORR = 1.8;                               // hành lang nhô ra
const floorBase = (f) => GROUND_H + (f - 1) * FLOOR_H; // f = 1..FLOORS
const TOP = floorBase(FLOORS) + FLOOR_H;
const bwOf = (cols) => cols * ROOM_W + 1.2;     // chiều dài mặt tiền một tòa
const SL = bwOf(SIDE_COLS), BD = 4.5;             // tòa bên: dài mặt tiền, sâu khối nhà
const WING = 0.8;                               // góc xòe tòa bên (rad, π/2 = chữ U vuông)
const CW = bwOf(MID_COLS) + 5.0;                // bề ngang sân ở chân tòa giữa
const WING_FRONT_Z = -8.5;                      // đầu tòa bên phía cổng
const WING_BACK_Z = WING_FRONT_Z - SL * Math.sin(WING);
const MID_Z = WING_BACK_Z - CORR - 0.4;         // mặt tiền tòa giữa
const MID_W = CW + 2 * (BD * Math.sin(WING) + 0.6);
const BW = 2 * (CW / 2 + SL * Math.cos(WING) + BD * Math.sin(WING)); // bề ngang cả khu (cho đường phố, cột điện...)
const YARD_Z0 = MID_Z + CORR, YARD_Z1 = 0;      // sân chung từ chân tòa giữa tới hàng rào cổng
const POLE_X = BW / 2 + 1.7, LAMP_X = -BW / 2 - 1.4, YARD_X = Math.max(-BW / 2 + 1.7, -9.2);
const veSo = { group: null, guesses: new Map(), next: 0, rollUntil: 0, showUntil: 0, flick: 0 }; // đại lý vé số + quay số may mắn
const BANHMI_X = -8.5, TRADA_X = 8.0, STALL_SCALE = 2.0;
// mọi nhân vật cao bằng nhau ngoài đời (theo người thuê trọ); người ngồi trong quầy đã phóng to thì chia cho scale của quầy
const PERSON_SIZE = 1.45, TRADA_FRONT_SCALE = 1.5, QUANCOC_SCALE = 1.6; // bánh mì bên trái cổng; TRADA_X giờ là chỗ quán cóc (trà đá đã sang vỉa hè đối diện)
let FOG_NEAR = 40, FOG_FAR = 90; // đặt lại theo khoảng cách máy quay
const CURB_Y = clamp(Number(params.get('mepduong')) || Number(CFG.mepDuongY) || 1500, 1150, 1700); // mép đường phía máy quay nằm trên y này (px)

// trời, sao, trăng (giữ tham chiếu để đổi ngày/đêm)
let sky, starMat, moonS, moonD, sunS, sunD;
{
  sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#060a24') }, bottom: { value: new THREE.Color('#3b2a58') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.6+0.15,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0); }',
  }));
  scene.add(sky);
  const starGeo = new THREE.BufferGeometry(), pts = [];
  for (let i = 0; i < 400; i++) { const a = rand(-1.2, 1.2), e = rand(0.15, 1.2); pts.push(Math.sin(a) * 100, Math.sin(e) * 100, -Math.cos(a) * 100); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.35, fog: false, transparent: true });
  scene.add(new THREE.Points(starGeo, starMat));
  moonS = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff6d8', fog: false, depthWrite: false, transparent: true }));
  moonS.position.set(-14, 34, -40); moonS.scale.set(14, 14, 1); scene.add(moonS);
  moonD = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: '#fff4cf', fog: false, transparent: true }));
  moonD.position.set(-14, 34, -39.9); scene.add(moonD);
  // mặt trời: ẩn lúc đêm, mọc lên khi trời sáng
  sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff1b0', fog: false, depthWrite: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
  sunS.scale.set(22, 22, 1); scene.add(sunS);
  sunD = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), new THREE.MeshBasicMaterial({ color: '#fff8dc', fog: false, transparent: true, opacity: 0 }));
  scene.add(sunD);
}

// đường phố, vỉa hè
{
  const road = box(220, 0.2, 160, M({ color: '#2b2d33' })); road.position.set(0, -0.1, 50); scene.add(road); // đường kéo dài tới tận máy quay
  const walk = box(BW + 10, 0.3, 4.2, M({ color: '#6d6a63' })); walk.position.set(0, 0.05, 2.1); scene.add(walk);
  for (let x = -40; x < 40; x += 4) { const l = box(2, 0.05, 0.25, M({ color: '#d8d0a8' })); l.position.set(x, 0.02, 12); scene.add(l); }
}

// nhà hàng xóm xung quanh (tối, vài cửa sổ sáng)
const neighborWins = [];
function neighbor(x, w, h, color, z = 0) {
  const g = new THREE.Group();
  const b = box(w, h, 10, M({ color })); b.position.set(0, h / 2, -3); g.add(b);
  for (let y = 2; y < h - 1; y += 2.8) for (let k = -w / 2 + 1.2; k < w / 2 - 0.6; k += 2.2) {
    const lit = Math.random() < 0.35;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ color: lit ? '#ffcf7a' : '#151a2e' }));
    win.position.set(k, y, 2.01); g.add(win); neighborWins.push(win);
  }
  g.position.set(x, 0, z); scene.add(g);
}
neighbor(-BW / 2 - 4.2, 7, 21, '#2a2f45', -4);
neighbor(BW / 2 + 4.6, 8, 13, '#30283e', -4);
neighbor(-BW / 2 - 12, 9, 26, '#20253a', -8);
neighbor(BW / 2 + 13, 9, 18, '#252036', -8);
neighbor(-MID_W / 2 + 2, 10, TOP + 9, '#232842', MID_Z - BD - 6);
neighbor(MID_W / 2 - 3, 9, TOP + 5, '#2b2440', MID_Z - BD - 5);
neighbor(-MID_W / 2 - 7, 8, TOP + 2, '#262b40', MID_Z - BD - 2);
neighbor(MID_W / 2 + 6, 8, TOP + 7, '#20233a', MID_Z - BD - 3);

// ---------- 3 tòa nhà trọ ----------
// Mỗi tòa dựng theo hệ toạ độ riêng: mặt tiền ở z=0, hành lang nhô ra phía +z, phòng đứng ở x = cx.
// Phòng lưu toạ độ trong tòa (cx, base); muốn toạ độ thế giới thì dùng roomPt().
const building = new THREE.Group(); scene.add(building);
const railMat = M({ color: '#3a3f48', metalness: 0.4, roughness: 0.6 });
const blockTex = (letter) => canvasTex(256, 96, (g, w, h) => {
  g.fillStyle = '#1f3b63'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ffd76a'; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 58px "Be Vietnam Pro", sans-serif'; g.fillText(`TÒA ${letter}`, w / 2, h / 2 + 3);
});
// ---- cửa hàng tầng trệt ----
const SHOP_DEFS = {
  taphoa: { name: 'TẠP HÓA', sub: 'Mì tôm · Nước ngọt · Dầu gội', bg: '#d62828', fg: '#ffffff', emoji: '🛒', goods: ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#f78c6b', '#ffffff'], awn: ['#d62828', '#ffffff'] },
  thuoc: { name: 'HIỆU THUỐC', sub: 'Nhà thuốc sinh viên', bg: '#1b8a4b', fg: '#ffffff', emoji: '💊', goods: ['#ffffff', '#e9f5ee', '#7bd389', '#4cc9f0', '#ffffff', '#ff8fab'], awn: ['#1b8a4b', '#ffffff'], cross: true },
  giatla: { name: 'GIẶT LÀ', sub: '15k/kg · Lấy trong ngày', bg: '#1d6fb8', fg: '#ffffff', emoji: '🧺', goods: ['#e0e6ee', '#cfd8e3', '#4cc9f0', '#ffffff', '#a0c4ff', '#ffffff'], awn: ['#1d6fb8', '#ffffff'], washer: true },
  photo: { name: 'PHOTO - IN', sub: 'In tài liệu · Đóng gáy', bg: '#ffb703', fg: '#3a2a00', emoji: '🖨️', goods: ['#ffffff', '#f1f1f1', '#ffd166', '#ffffff', '#e0e0e0', '#8ecae6'], awn: ['#ffb703', '#ffffff'] },
  com: { name: 'CƠM SINH VIÊN', sub: 'Cơm rang · Cơm suất 25k', bg: '#f77f00', fg: '#ffffff', emoji: '🍛', goods: ['#ffd166', '#f4a261', '#e76f51', '#2a9d8f', '#ffffff', '#e9c46a'], awn: ['#f77f00', '#ffffff'] },
  suaxe: { name: 'SỬA XE', sub: 'Vá săm · Thay dầu', bg: '#3d405b', fg: '#ffd166', emoji: '🔧', goods: ['#222222', '#555555', '#e63946', '#ffd166', '#888888', '#222222'], awn: ['#3d405b', '#ffd166'] },
};
const SHOPS = {}; // key → { anchor, def, n, bg, x, letter }
const SHOP_FZ = 1.0; // mặt tiền cửa hàng nhô ra dưới hành lang (z trong tòa)
function makeShop(bg, key, x, w, letter) {
  const d = SHOP_DEFS[key], fz = SHOP_FZ;
  const g = new THREE.Group(); g.position.set(x, 0, fz); bg.add(g);
  // hai vách bên nối mặt tiền nhô ra với tường tòa nhà
  const sideM = M({ color: '#cbb98a' });
  [-w / 2, w / 2].forEach((sx) => { const sw = box(0.16, GROUND_H - 0.12, fz + 0.2, sideM); sw.position.set(sx, (GROUND_H - 0.12) / 2, -fz / 2 - 0.1); g.add(sw); });
  // bên trong cửa hàng: kệ hàng sáng đèn
  const inside = canvasTex(256, 192, (c, W2, H2) => {
    c.fillStyle = '#fff4dc'; c.fillRect(0, 0, W2, H2);
    for (let row = 0; row < 4; row++) {
      const y = 22 + row * 42;
      c.fillStyle = '#8a6a48'; c.fillRect(8, y + 30, W2 - 16, 6);
      for (let k = 0; k < 14; k++) { c.fillStyle = d.goods[(k + row * 3) % d.goods.length]; const bw2 = 10 + Math.random() * 6, bh = 14 + Math.random() * 14; c.fillRect(12 + k * 17, y + 30 - bh, bw2, bh); }
    }
    if (d.washer) { c.fillStyle = '#e8e8e8'; c.fillRect(20, 120, 210, 70); for (let k = 0; k < 3; k++) { c.fillStyle = '#5a6b80'; c.beginPath(); c.arc(55 + k * 70, 155, 24, 0, Math.PI * 2); c.fill(); c.fillStyle = '#8ecae6'; c.beginPath(); c.arc(55 + k * 70, 155, 17, 0, Math.PI * 2); c.fill(); } }
    c.fillStyle = 'rgba(80,50,20,.85)'; c.fillRect(W2 * 0.3, H2 - 34, W2 * 0.4, 34); // quầy thu ngân
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, 2.5), new THREE.MeshStandardMaterial({ map: inside, emissive: '#ffffff', emissiveMap: inside, emissiveIntensity: 0.55, roughness: 0.4 }));
  glass.position.set(0, 1.3, 0.03); g.add(glass);
  // khung cửa cuốn (kéo lên)
  const frameM = M({ color: '#4a4f5a', metalness: 0.5, roughness: 0.5 });
  [-w / 2, w / 2].forEach((fx) => { const p = box(0.14, 2.7, 0.14, frameM); p.position.set(fx, 1.35, 0.08); g.add(p); });
  const shutter = box(w + 0.1, 0.32, 0.25, M({ color: '#9aa3ad', metalness: 0.6, roughness: 0.4 })); shutter.position.set(0, 2.66, 0.12); g.add(shutter);
  // biển hiệu
  const signT = canvasTex(512, 140, (c, W2, H2) => {
    c.fillStyle = d.bg; c.fillRect(0, 0, W2, H2);
    c.strokeStyle = d.fg; c.lineWidth = 6; c.strokeRect(5, 5, W2 - 10, H2 - 10);
    c.fillStyle = d.fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '900 64px "Be Vietnam Pro", sans-serif'; c.fillText(`${d.name}`, W2 / 2, 56);
    c.font = '700 28px "Be Vietnam Pro", sans-serif'; c.fillText(d.sub, W2 / 2, 110);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.2, Math.min(0.95, (w + 0.2) * 140 / 512)), new THREE.MeshStandardMaterial({ map: signT, emissive: '#ffffff', emissiveMap: signT, emissiveIntensity: 0.45 }));
  sign.position.set(0, 3.05, 0.12); g.add(sign);
  // mái hiên sọc
  const awnT = canvasTex(128, 32, (c, W2, H2) => { for (let k = 0; k < 8; k++) { c.fillStyle = d.awn[k % 2]; c.fillRect(k * W2 / 8, 0, W2 / 8, H2); } });
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.3, 1.0), M({ map: awnT, side: THREE.DoubleSide }));
  awn.position.set(0, 2.45, 0.45); awn.rotation.x = -1.05; g.add(awn);
  // hiệu thuốc: biển chữ thập xanh nhô ra
  if (d.cross) {
    const crossT = canvasTex(128, 128, (c, W2, H2) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W2, H2); c.fillStyle = '#16a34a'; c.fillRect(44, 14, 40, 100); c.fillRect(14, 44, 100, 40); });
    const cr = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.8), new THREE.MeshStandardMaterial({ map: crossT, emissive: '#ffffff', emissiveMap: crossT, emissiveIntensity: 0.7 }));
    cr.position.set(w / 2 + 0.1, 3.0, 0.55); g.add(cr);
  }
  // hàng bày trước cửa (thùng, két nước)
  if (!d.washer) for (let k = 0; k < 3; k++) { const crate = box(0.5, 0.35, 0.4, M({ color: pick(d.goods.concat(['#c0392b', '#2a9d8f'])) })); crate.position.set(-w / 2 + 0.45 + k * 0.55, 0.18, 0.4); g.add(crate); }
  const anchor = new THREE.Object3D(); anchor.position.set(0, 0, 0.6); g.add(anchor);
  SHOPS[key] = { anchor, def: d, n: 0, bg, x, letter };
}
function makeBlock({ cols, width, corrW, letter, roof = true, shops = [] }) {
  const bg = new THREE.Group(); building.add(bg);
  const bw = bwOf(cols);
  // tường tầng trệt, tường các tầng, khối nhà phía sau
  const gw = box(width, GROUND_H, 0.4, M({ map: groundWallTex })); gw.position.set(0, GROUND_H / 2, -0.2); bg.add(gw);
  const wallM = M({ map: wallTex }); WALL_MATS.push(wallM);
  const uw = box(width, FLOORS * FLOOR_H, 0.4, wallM); uw.position.set(0, GROUND_H + (FLOORS * FLOOR_H) / 2, -0.2); bg.add(uw);
  const back = box(width, TOP, BD - 0.4, M({ color: '#9e8a52' })); back.position.set(0, TOP / 2, -0.4 - (BD - 0.4) / 2); bg.add(back);
  // hai đầu hồi hành lang
  [-corrW / 2 + 0.2, corrW / 2 - 0.2].forEach((x) => { const s = box(0.4, TOP - GROUND_H, CORR, wallM); s.position.set(x, GROUND_H + (TOP - GROUND_H) / 2, CORR / 2); bg.add(s); });
  // lan can mái
  if (roof) { const pm = M({ color: '#8f7b45' }); PARAPET_MATS.push(pm); const parapet = box(width + 0.4, 0.8, BD + CORR + 0.4, pm); parapet.position.set(0, TOP + 0.4, (CORR - BD) / 2); bg.add(parapet); }
  // sàn hành lang, lan can, song sắt
  for (let f = 1; f <= FLOORS; f++) {
    const y = floorBase(f);
    const slab = box(corrW, 0.25, CORR, M({ color: '#a9a296' })); slab.position.set(0, y - 0.12, CORR / 2); bg.add(slab);
    const top = box(corrW - 0.6, 0.08, 0.1, railMat); top.position.set(0, y + 0.85, CORR - 0.08); bg.add(top);
    const mid = box(corrW - 0.6, 0.05, 0.06, railMat); mid.position.set(0, y + 0.42, CORR - 0.08); bg.add(mid);
    const NB = Math.round(corrW * 3.2);
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.85, 0.04), railMat, NB);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < NB; i++) { m4.makeTranslation(-corrW / 2 + 0.45 + i * ((corrW - 0.9) / (NB - 1)), y + 0.42, CORR - 0.08); bars.setMatrixAt(i, m4); }
    bg.add(bars);
  }
  const roofSlab = box(corrW, 0.25, CORR + 0.3, M({ color: '#8f8778' })); roofSlab.position.set(0, TOP, CORR / 2); bg.add(roofSlab);
  // biển tên tòa + cửa cầu thang tầng trệt
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshStandardMaterial({ map: blockTex(letter), emissive: '#ffffff', emissiveMap: blockTex(letter), emissiveIntensity: 0.4 }));
  sign.position.set(0, GROUND_H - 0.85, CORR + 0.02); bg.add(sign);
  const stairDoor = box(1.8, 2.4, 0.1, M({ color: '#3b3127', emissive: '#ff9a40', emissiveIntensity: 0.15 })); stairDoor.position.set(0, 1.2, 0.05); bg.add(stairDoor);
  // cửa hàng to: chiếm gần hết nửa mặt tiền hai bên cửa cầu thang
  const sw = Math.min(5.2, bw / 2 - 1.6);
  shops.forEach((k, i) => makeShop(bg, k, (i ? 1 : -1) * (1.1 + sw / 2), sw, letter));
  return { bg, bw, corrW, letter, sign };
}
const WALL_MATS = [], PARAPET_MATS = [];
// tòa giữa (B): thẳng mặt máy quay
const blockB = makeBlock({ cols: MID_COLS, width: MID_W, corrW: CW, letter: 'B', shops: ['com', 'suaxe'] });
blockB.bg.position.set(0, 0, MID_Z);
// tòa trái (A) và phải (C): đầu trong nối góc tòa giữa, đầu ngoài xòe về phía cổng
const wingDir = (s) => new THREE.Vector3(s * Math.cos(WING), 0, Math.sin(WING)); // hướng dọc mặt tiền từ góc trong ra cổng
const blockA = makeBlock({ cols: SIDE_COLS, width: SL, corrW: SL, letter: 'A', shops: ['taphoa', 'giatla'] });
blockA.bg.position.set(-CW / 2, 0, WING_BACK_Z).addScaledVector(wingDir(-1), SL / 2); blockA.bg.rotation.y = WING;
const blockC = makeBlock({ cols: SIDE_COLS, width: SL, corrW: SL, letter: 'C', shops: ['photo', 'thuoc'] });
blockC.bg.position.set(CW / 2, 0, WING_BACK_Z).addScaledVector(wingDir(1), SL / 2); blockC.bg.rotation.y = -WING;
// bồn nước inox, ăng-ten trên mái tòa giữa
{
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3, 24), new THREE.MeshStandardMaterial({ color: '#d7dde3', metalness: 0.85, roughness: 0.25 }));
  tank.rotation.z = Math.PI / 2; tank.position.set(-MID_W / 2 + 3, TOP + 1.9, -1.2); blockB.bg.add(tank);
  const tankLeg = box(3, 0.6, 1.4, M({ color: '#555' })); tankLeg.position.set(-MID_W / 2 + 3, TOP + 1.0, -1.2); blockB.bg.add(tankLeg);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.5), M({ color: '#888' })); ant.position.set(MID_W / 2 - 3, TOP + 2.2, -1); blockB.bg.add(ant);
  for (let k = 0; k < 4; k++) { const r = box(1.6 - k * 0.3, 0.05, 0.05, M({ color: '#999' })); r.position.set(MID_W / 2 - 3, TOP + 2.6 + k * 0.4, -1); blockB.bg.add(r); }
  [blockA, blockC].forEach(({ bg }) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 20), new THREE.MeshStandardMaterial({ color: '#d7dde3', metalness: 0.85, roughness: 0.25 })); t.position.set(0, TOP + 1.6, -2.5); bg.add(t); });
}

// ---------- Hàng rào (không có cổng, chừa lối vào ở giữa) ----------
{
  const wallM = M({ color: '#d9cdb0' }), capM = M({ color: '#8f7b45' });
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const w = box(len, 1.1, 0.3, wallM); w.position.set((x0 + x1) / 2, 0.55, (z0 + z1) / 2); w.rotation.y = -Math.atan2(z1 - z0, x1 - x0); scene.add(w);
    const c = box(len + 0.1, 0.12, 0.42, capM); c.position.copy(w.position).setY(1.16); c.rotation.y = w.rotation.y; scene.add(c);
  };
  const FX = BW / 2 - 0.4;
  fence(-FX, 0, -2.6, 0); fence(2.6, 0, FX, 0);
  // hai bên: từ hàng rào trước tới góc sau của đầu tòa bên
  [-1, 1].forEach((s) => {
    const front = new THREE.Vector3(s * CW / 2, 0, WING_BACK_Z).addScaledVector(wingDir(s), SL);
    const backCorner = front.clone().add(new THREE.Vector3(-s * Math.sin(WING), 0, -Math.cos(WING)).multiplyScalar(BD));
    fence(s * FX, 0, backCorner.x, backCorner.z);
  });
  // không có cổng: chừa lối vào trống giữa hàng rào
}

// ---------- Sân chung ----------
// Sân bóng đá nằm ngang ở giữa (sát tòa B), sân bóng chuyền chạy chéo sát tòa A, bể bơi chạy chéo sát tòa C,
// phía trước là bãi cỏ có xích đu, đu quay, cầu trượt.
const yardFx = { swings: [], water: null, ring: null, poolGlow: null, lampGlows: [], football: null, volley: null, carousel: null };
const FIELD_L = 12, FIELD_W = 6.2;                     // sân bóng đá: dài theo trục x
const FIELD_Z = YARD_Z0 + 0.9 + FIELD_W / 2;
const LAWN_Z0 = FIELD_Z + FIELD_W / 2 + 0.6, LAWN_Z1 = -0.6; // bãi cỏ: từ mép sân bóng tới hàng rào
const LAWN_Z = (LAWN_Z0 + LAWN_Z1) / 2;
// điểm trên sân sát tòa bên: t = khoảng cách dọc mặt tiền tính từ góc trong, off = khoảng cách ra sân tính từ mặt tiền
const wingNormal = (s) => new THREE.Vector3(-s * Math.sin(WING), 0, Math.cos(WING));
const besideWing = (s, t, off) => new THREE.Vector3(s * CW / 2, 0, WING_BACK_Z).addScaledVector(wingDir(s), t).addScaledVector(wingNormal(s), off);
const VW = 3.8, VL = 6.6, PW = 3.8, PD = 6.6;          // sân bóng chuyền, bể bơi (rộng × dài)
const VOLLEY_POS = besideWing(-1, SL * 0.68, CORR + 0.5 + VW / 2);
const POOL_POS = besideWing(1, SL * 0.68, CORR + 0.7 + PW / 2);
{
  // nền gạch sân
  const tileTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8e8a7e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
  }, [BW / 3, (YARD_Z1 - MID_Z) / 3]);
  const floor = box(BW, 0.1, YARD_Z1 - MID_Z, M({ map: tileTex })); floor.position.set(0, 0.05, (MID_Z + YARD_Z1) / 2); scene.add(floor);
  const flat = (w, d, mat, x, z, y = 0.12, parent = scene) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); parent.add(m); return m; };
  const white = M({ color: '#ffffff' });

  // ---- bãi cỏ (dưới cùng, sân bóng chuyền và bể bơi nằm đè lên mép cỏ) ----
  const lawnW = BW - 3, lawnD = LAWN_Z1 - LAWN_Z0;
  const grassTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#5bb04f'; g.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${rand(20, 60)},${rand(90, 140)},${rand(20, 50)},${rand(0.25, 0.6)})`; g.fillRect(rand(0, w), rand(0, h), 1.5, rand(2, 5)); } }, [lawnW / 3, lawnD / 3]);
  flat(lawnW, lawnD, M({ map: grassTex, roughness: 1 }), 0, LAWN_Z, 0.112);
  flat(2.0, lawnD, M({ color: '#cfc6b0', roughness: 0.9 }), 0, LAWN_Z, 0.118); // lối đi lát đá từ cổng vào sân bóng

  // ---- sân bóng đá mini nằm ngang ----
  const fieldTex = canvasTex(384, 200, (g, w, h) => {
    for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? '#3f9d4a' : '#48ad54'; g.fillRect(k * w / 10, 0, w / 10, h); }
    g.strokeStyle = '#ffffff'; g.lineWidth = 4;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.beginPath(); g.moveTo(w / 2, 10); g.lineTo(w / 2, h - 10); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 30, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w / 2, h / 2, 4, 0, Math.PI * 2); g.fill();
    [10, w - 10].forEach((x, i) => { g.strokeRect(i ? x - 46 : x, h / 2 - 54, 46, 108); g.strokeRect(i ? x - 18 : x, h / 2 - 26, 18, 52); });
  });
  flat(FIELD_L + 0.6, FIELD_W + 0.6, M({ color: '#2f7d3a', roughness: 1 }), 0, FIELD_Z, 0.12);
  flat(FIELD_L, FIELD_W, M({ map: fieldTex, roughness: 1 }), 0, FIELD_Z, 0.13);
  const netTex = canvasTex(64, 64, (g, w, h) => { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; for (let i = 0; i <= w; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } }, [4, 2]);
  const netM = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  [-1, 1].forEach((s) => { // khung thành hai đầu trái/phải
    const x = s * (FIELD_L / 2 - 0.1);
    [-1, 1].forEach((k) => { const p = box(0.1, 1.2, 0.1, white); p.position.set(x, 0.72, FIELD_Z + k * 1.2); scene.add(p); });
    const bar = box(0.1, 0.1, 2.5, white); bar.position.set(x, 1.32, FIELD_Z); scene.add(bar);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), netM); back.rotation.y = Math.PI / 2; back.position.set(x + s * 0.7, 0.72, FIELD_Z); scene.add(back);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.4), netM); top.rotation.x = -Math.PI / 2; top.position.set(x + s * 0.35, 1.32, FIELD_Z); scene.add(top);
  });
  const fbTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc((k % 3) * 24 + 8, Math.floor(k / 3) * 32 + 16, 7, 0, Math.PI * 2); g.fill(); } });
  const fb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), M({ map: fbTex, roughness: 0.5 })); fb.position.set(0, 0.33, FIELD_Z); scene.add(fb); yardFx.football = fb;

  // ---- sân bóng chuyền chạy chéo sát tòa A (trục dài song song mặt tiền) ----
  {
    const g = new THREE.Group(); g.position.copy(VOLLEY_POS); g.rotation.y = WING; scene.add(g);
    const volTex = canvasTex(320, 192, (c, w, h) => {
      c.fillStyle = '#e8b86a'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(120,80,30,${rand(0.05, 0.15)})`; c.fillRect(rand(0, w), rand(0, h), 2, 2); }
      c.strokeStyle = '#1d4ed8'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16);
      c.beginPath(); c.moveTo(w / 2, 8); c.lineTo(w / 2, h - 8); c.stroke();
      [w / 2 - 50, w / 2 + 50].forEach((x) => { c.beginPath(); c.moveTo(x, 8); c.lineTo(x, h - 8); c.stroke(); });
    });
    flat(VL + 0.5, VW + 0.5, M({ color: '#2f6f9e', roughness: 1 }), 0, 0, 0.125, g);
    flat(VL, VW, M({ map: volTex, roughness: 1 }), 0, 0, 0.135, g);
    [-1, 1].forEach((k) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5), M({ color: '#444' })); p.position.set(0, 1.25, k * (VW / 2 + 0.25)); g.add(p); });
    const vnetTex = canvasTex(128, 32, (c, w, h) => { c.strokeStyle = 'rgba(20,20,20,.9)'; c.lineWidth = 2; for (let i = 0; i <= w; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); } for (let i = 0; i <= h; i += 8) { c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, 5); });
    const vnet = new THREE.Mesh(new THREE.PlaneGeometry(VW + 0.4, 0.8), new THREE.MeshBasicMaterial({ map: vnetTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    vnet.rotation.y = Math.PI / 2; vnet.position.set(0, 2.0, 0); g.add(vnet);
    const vb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), M({ color: '#ffd166', roughness: 0.5 })); vb.position.set(0, 2.6, 0); g.add(vb); yardFx.volley = vb;
  }

  // ---- bể bơi chạy chéo sát tòa C ----
  {
    const g = new THREE.Group(); g.position.copy(POOL_POS); g.rotation.y = -WING; scene.add(g);
    const rim = box(PD + 0.8, 0.3, PW + 0.8, M({ color: '#e8eef2', roughness: 0.5 })); rim.position.y = 0.15; g.add(rim);
    const waterTex = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#1aa0d8'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3;
      for (let i = 0; i < 26; i++) { c.beginPath(); const x = Math.random() * w, y = Math.random() * h, r = 10 + Math.random() * 26; c.ellipse(x, y, r, r * 0.45, Math.random() * 3, 0, Math.PI * 1.3); c.stroke(); }
    }, [PD / 2.5, PW / 2.5]);
    yardFx.water = flat(PD, PW, new THREE.MeshStandardMaterial({ map: waterTex, color: '#7fd6ff', emissive: '#1580c0', emissiveIntensity: 0.45, roughness: 0.15, metalness: 0.1 }), 0, 0, 0.31, g);
    for (let k = 1; k < 3; k++) { const l = box(PD - 0.2, 0.02, 0.06, M({ color: '#ff5a5a' })); l.position.set(0, 0.33, -PW / 2 + k * PW / 3); g.add(l); }
    [-0.25, 0.25].forEach((dz) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 6, 16, Math.PI), M({ color: '#d7dde3', metalness: 0.8, roughness: 0.3 })); r.rotation.y = Math.PI / 2; r.position.set(PD / 2 + 0.05, 0.32, dz); g.add(r); });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.11, 8, 20), M({ color: '#ff6b6b', roughness: 0.5 })); ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.36, 0.5); g.add(ring); yardFx.ring = ring;
    const poolGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#4cc9f0', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    poolGlow.position.set(0, 0.8, 0); poolGlow.scale.set(PD * 1.3, PW * 1.4, 1); g.add(poolGlow); yardFx.poolGlow = poolGlow;
    // ghế nằm + ô dù phía sân (mép trong bể)
    [-1.6, 1.6].forEach((dx, i) => {
      const z = PW / 2 + 1.0;
      const bed = box(1.5, 0.12, 0.6, M({ color: '#ffffff' })); bed.position.set(dx, 0.42, z); g.add(bed);
      const um = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.42, 12), M({ color: i ? '#ffd166' : '#ff7aa2', side: THREE.DoubleSide })); um.position.set(dx - 0.5, 2.1, z + 0.2); g.add(um);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2), M({ color: '#ddd' })); st.position.set(dx - 0.5, 1.0, z + 0.2); g.add(st);
    });
  }

  // ---- bãi cỏ: xích đu (trái), đu quay (giữa-phải lối đi), cầu trượt (phải) ----
  const PLAY_Z = LAWN_Z + 0.6;
  {
    const g = new THREE.Group(); g.position.set(-4.6, 0, PLAY_Z); scene.add(g);
    const frameM = M({ color: '#3a86ff' });
    [-1.6, 1.6].forEach((x) => [-0.55, 0.55].forEach((z) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6), frameM); l.position.set(x, 1.25, z * 0.5); l.rotation.x = z * 0.45; g.add(l); }));
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4), frameM); bar.rotation.z = Math.PI / 2; bar.position.set(0, 2.45, 0); g.add(bar);
    [-0.75, 0.75].forEach((x, i) => {
      const pv = new THREE.Group(); pv.position.set(x, 2.45, 0); g.add(pv);
      [-0.22, 0.22].forEach((dx) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.8), M({ color: '#bbb', metalness: 0.6 })); c.position.set(dx, -0.9, 0); pv.add(c); });
      const seat = box(0.55, 0.06, 0.25, M({ color: i ? '#ef476f' : '#ffd166' })); seat.position.y = -1.8; pv.add(seat);
      yardFx.swings.push({ pv, ph: i * 1.7 });
    });
  }
  {
    const g = new THREE.Group(); g.position.set(3.0, 0, PLAY_Z); scene.add(g);
    const spin = new THREE.Group(); g.add(spin); yardFx.carousel = spin;
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.12, 24), M({ color: '#ffd166', roughness: 0.6 })); plate.position.y = 0.3; spin.add(plate);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.05, 6, 32), M({ color: '#ef476f' })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.36; spin.add(rim);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6), M({ color: '#cccccc', metalness: 0.6 })); mast.position.y = 1.1; spin.add(mast);
    const cols = ['#ef476f', '#06d6a0', '#118ab2', '#ffd166', '#f78c6b', '#8d5bd6'];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.15), M({ color: cols[k] })); bar.rotation.z = Math.PI / 2; bar.rotation.y = -a; bar.position.set(Math.cos(a) * 0.6, 1.35, Math.sin(a) * 0.6); spin.add(bar);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0), M({ color: cols[k] })); post.position.set(Math.cos(a) * 1.15, 0.85, Math.sin(a) * 1.15); spin.add(post);
      const seat = box(0.35, 0.08, 0.35, M({ color: cols[k] })); seat.position.set(Math.cos(a + 0.5) * 0.85, 0.45, Math.sin(a + 0.5) * 0.85); spin.add(seat);
    }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.55, 6), M({ color: '#ef476f', roughness: 0.6 })); cap.position.y = 2.15; spin.add(cap);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.25, 12), M({ color: '#666' })); base.position.y = 0.13; g.add(base);
  }
  {
    const g = new THREE.Group(); g.position.set(7.2, 0, PLAY_Z); scene.add(g);
    const plat = box(1.1, 0.12, 1.1, M({ color: '#ffd166' })); plat.position.set(-1.0, 1.9, 0); g.add(plat);
    [[-1.5, -0.5], [-0.5, -0.5], [-1.5, 0.5], [-0.5, 0.5]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6), M({ color: '#ef476f' })); l.position.set(x, 1.3, z); g.add(l); });
    const roofC = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.7, 4), M({ color: '#ef476f' })); roofC.position.set(-1.0, 2.95, 0); roofC.rotation.y = Math.PI / 4; g.add(roofC);
    const slide = box(2.4, 0.08, 0.7, M({ color: '#06d6a0', roughness: 0.4 })); slide.position.set(0.55, 1.0, 0); slide.rotation.z = -0.68; g.add(slide);
    [-0.36, 0.36].forEach((z) => { const rail = box(2.4, 0.18, 0.05, M({ color: '#05b088' })); rail.position.set(0.55, 1.08, z); rail.rotation.z = -0.68; g.add(rail); });
    for (let k = 0; k < 6; k++) { const st = box(0.6, 0.05, 0.12, M({ color: '#ddd' })); st.position.set(-1.0, 0.3 + k * 0.3, -0.75); g.add(st); }
  }

  // cây xanh, bụi hoa, đèn sân, ghế đá
  const tree = (x, z, s = 1) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 1.6 * s), M({ color: '#6b4a2b' })); t.position.set(x, 0.8 * s, z); scene.add(t);
    const leafM = M({ color: pick(['#2d6a4f', '#40916c', '#52b788']) });
    [[0, 2.0, 0, 0.9], [0.35, 1.7, 0.2, 0.65], [-0.35, 1.75, -0.1, 0.7]].forEach(([dx, dy, dz, r]) => { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 0), leafM); l.position.set(x + dx * s, dy * s, z + dz * s); scene.add(l); });
  };
  const edge = CW / 2 + SL * Math.cos(WING) - 0.6;
  tree(-edge, -1.4, 1.15); tree(edge, -1.4, 1.15); tree(-edge + 2.6, -4.0, 0.95); tree(edge - 2.6, -4.0, 0.95);
  tree(-1.7, LAWN_Z1 - 1.2, 0.6); tree(1.7, LAWN_Z1 - 1.2, 0.6);
  [[-8.2, LAWN_Z1 - 1.0], [9.8, LAWN_Z1 - 1.0], [-1.6, LAWN_Z0 + 0.7], [1.6, LAWN_Z0 + 0.7]].forEach(([x, z]) => {
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), M({ color: '#2d6a4f' })); bush.position.set(x, 0.4, z); bush.scale.y = 0.7; scene.add(bush);
    for (let k = 0; k < 4; k++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: pick(['#ff7aa2', '#ffd166', '#ffffff', '#ef476f']) })); fl.position.set(x + rand(-0.35, 0.35), 0.62, z + rand(-0.3, 0.3)); scene.add(fl); }
  });
  [[-FIELD_L / 2 - 1.0, FIELD_Z - FIELD_W / 2], [FIELD_L / 2 + 1.0, FIELD_Z - FIELD_W / 2], [-1.5, LAWN_Z0 + 0.3], [1.5, LAWN_Z0 + 0.3]].forEach(([x, z]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.6), M({ color: '#333' })); p.position.set(x, 1.8, z); scene.add(p);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff3c4' })); head.position.set(x, 3.7, z); scene.add(head);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffd38a', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    gl.position.set(x, 3.7, z); gl.scale.set(2.6, 2.6, 1); scene.add(gl); yardFx.lampGlows.push(gl);
  });
  [[-2.4, LAWN_Z0 + 1.6], [2.4, LAWN_Z0 + 1.6]].forEach(([x, z]) => { const b = box(1.6, 0.12, 0.45, M({ color: '#b8b2a6' })); b.position.set(x, 0.48, z); scene.add(b); [-0.6, 0.6].forEach((dx) => { const l = box(0.12, 0.42, 0.4, M({ color: '#9a948a' })); l.position.set(x + dx, 0.21, z); scene.add(l); }); });
}
// đèn sân ban đêm: một đèn ấm treo giữa sân, một đèn xanh trên bể bơi
const yardLight = new THREE.PointLight('#ffd9a0', 34, 30, 1.4); yardLight.position.set(0, 6.5, FIELD_Z + 3); scene.add(yardLight);
function updateYard(dt, now) {
  const t = now / 1000;
  yardFx.water.material.map.offset.set(t * 0.025, Math.sin(t * 0.3) * 0.06);
  yardFx.ring.position.x = Math.sin(t * 0.25) * 2.2; yardFx.ring.rotation.z = Math.sin(t * 0.7) * 0.3;
  yardFx.swings.forEach((s) => (s.pv.rotation.x = Math.sin(t * 1.6 + s.ph) * 0.5));
  yardFx.carousel.rotation.y += dt * 1.1;
  // bóng đá lăn qua lại giữa hai khung thành
  const fb = yardFx.football;
  fb.position.x = Math.sin(t * 0.45) * (FIELD_L / 2 - 1.2); fb.position.z = FIELD_Z + Math.sin(t * 0.9) * 1.6;
  fb.rotation.z = -fb.position.x * 3; fb.rotation.x = fb.position.z * 3;
  // bóng chuyền bay qua lưới (toạ độ trong sân bóng chuyền)
  const vb = yardFx.volley, ph = (t * 0.55) % 2, k = ph < 1 ? ph : 2 - ph;
  vb.position.x = (k - 0.5) * 4.4; vb.position.y = 1.4 + Math.sin(k * Math.PI) * 2.2;
  const night = 1 - dayS;
  yardFx.poolGlow.material.opacity = 0.15 + 0.55 * night;
  yardFx.water.material.emissiveIntensity = 0.15 + 0.4 * night;
  yardFx.lampGlows.forEach((g) => (g.material.opacity = 0.85 * night));
  yardLight.intensity = (power ? 34 : 0) * night;
}

// ---------- Phòng ----------
// Đánh số theo tầng rồi lần lượt tòa A → B → C (ví dụ tầng 2: 201, 202 ở tòa A, 203, 204 ở tòa B...).
const rooms = [];
const floorLights = [];
// một đèn ấm cho mỗi 2 tầng (máy yếu: mỗi PointLight làm mọi điểm ảnh tính thêm một lần), treo giữa sân chiếu vào cả ba dãy hành lang
const lightOf = (f) => Math.floor((f - 1) / 2);
for (let i = 0; i * 2 < FLOORS; i++) {
  const f = i * 2 + 1, two = f + 1 <= FLOORS;
  const l = new THREE.PointLight('#ffb45c', 0, BW * 1.1, 1.1); l.position.set(0, floorBase(f) + 2.1 + (two ? FLOOR_H / 2 : 0), (WING_BACK_Z + WING_FRONT_Z) / 2); scene.add(l); floorLights[i] = l; // giữa sân: không chói một điểm trên tòa B
}
const roomPt = (r, x, y, z, out = new THREE.Vector3()) => r.bg.localToWorld(out.set(r.cx + x, r.base + y, z));
building.updateMatrixWorld(true);
const BLOCKS = [{ b: blockA, cols: SIDE_COLS, letter: 'A' }, { b: blockB, cols: MID_COLS, letter: 'B' }, { b: blockC, cols: SIDE_COLS, letter: 'C' }];
for (let f = 1; f <= FLOORS; f++) {
  let num = 0;
  for (const { b, cols, letter } of BLOCKS) for (let c = 0; c < cols; c++) {
  num++;
  const base = floorBase(f), cx = (c - (cols - 1) / 2) * ROOM_W;
  const g = new THREE.Group(); g.position.set(cx, base, 0); b.bg.add(g);
  const doorColor = pick(['#2f6f9e', '#7a4a2a', '#3d7a52', '#8c3b3b', '#5a5f6e']);
  const decorG = new THREE.Group(); g.add(decorG); // đồ trang trí người thuê tự đặt (cây, cờ, đèn lồng)
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.15), new THREE.MeshStandardMaterial({ map: doorTex(doorColor), roughness: 0.7 }));
  door.position.set(-0.82, 1.08, 0.02); g.add(door);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.95), new THREE.MeshStandardMaterial({ color: '#10142a', emissive: '#ffb45c', emissiveIntensity: 0 }));
  glass.position.set(0.72, 1.65, 0.015); g.add(glass);
  const bars = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.05), new THREE.MeshBasicMaterial({ map: windowBarsTex, transparent: true }));
  bars.position.set(0.72, 1.65, 0.04); g.add(bars);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffb45c', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.set(0.72, 1.65, 0.5); glow.scale.set(3.0, 2.4, 1); g.add(glow);
  // cục nóng điều hoà (một số phòng)
  if ((f + num) % 3 === 0) { const ac = box(0.8, 0.5, 0.3, M({ color: '#e8e8e8' })); ac.position.set(0.72, 2.5, 0.2); g.add(ac); }
  // dây phơi quần áo
  const clothes = new THREE.Group(); clothes.position.set(0, 0, 0); g.add(clothes);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.8), M({ color: '#ddd' })); line.rotation.z = Math.PI / 2; line.position.set(0.1, 2.35, 1.35); clothes.add(line);
  const clothMats = [];
  for (let k = 0; k < 2; k++) {
    const mat = M({ color: pick(['#e24a4a', '#f2c14e', '#4aa3e2', '#ffffff', '#7bd389', '#c77dff', '#ff8fab']), side: THREE.DoubleSide });
    clothMats.push(mat);
    const shirt = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.62), mat);
    shirt.position.set(-0.55 + k * 1.1, 2.1, 1.35); clothes.add(shirt);
    const arms = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.18), mat); arms.position.set(-0.55 + k * 1.1, 2.32, 1.35); clothes.add(arms);
  }
  clothes.visible = Math.random() < 0.6;
  // dây đèn nháy (mở khi đóng tiền điện)
  const fairy = new THREE.Group(); fairy.visible = false; g.add(fairy);
  const fairyMats = ['#ff4d6d', '#ffd60a', '#4cc9f0', '#80ff72'].map((col) => new THREE.MeshBasicMaterial({ color: col }));
  for (let k = 0; k < 14; k++) {
    const bl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), fairyMats[k % 4]);
    bl.position.set(-1.55 + k * 0.24, 1.08 + Math.sin((k / 13) * Math.PI) * -0.12, CORR - 0.05); fairy.add(bl);
  }
  // biển VIP
  const vip = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.52), new THREE.MeshBasicMaterial({ map: vipTex, transparent: true }));
  vip.position.set(0.72, 2.6, 0.06); vip.visible = false; g.add(vip);

  rooms.push({
    idx: rooms.length, floor: f, col: num - 1, block: letter, bg: b.bg, number: `${f}${String(num).padStart(2, '0')}`, group: g, base, cx,
    door, doorColor, decorG, glass, glow, clothes, clothMats, fairy, fairyMats, vip, tenant: null, steamAcc: 0,
  });
  }
}
const ROOMS_PER_FLOOR = 2 * SIDE_COLS + MID_COLS;

// Máy quay nhìn chính diện (hơi chúc xuống ~8°): thấy cả 3 tòa, sân giữa và đường phố trước cổng.
// Tự lùi xa cho vừa bề ngang, mái tòa giữa ở khoảng y≈490px, đường phố ở dưới (chat TikTok che, không sao).
// ?pitch=36 để quay lại góc nhìn từ trên cao.
{
  const PITCH = THREE.MathUtils.degToRad(params.has('pitch') ? Number(params.get('pitch')) || 0 : 22);
  const dir = new THREE.Vector3(0, -Math.sin(PITCH), -Math.cos(PITCH));
  const pts = [];
  scene.updateMatrixWorld(true);
  [blockA, blockB, blockC].forEach(({ bg }) => {
    const bb = new THREE.Box3().setFromObject(bg);
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) pts.push(new THREE.Vector3(x, y, z));
  });
  [-1, 1].forEach((s) => { pts.push(new THREE.Vector3(s * (BW / 2 + 2.4), 0, 4.5), new THREE.Vector3(s * (BW / 2 + 2.4), 8, 4)); });
  const v = new THREE.Vector3();
  const TOP_NDC = 1 - 2 * 490 / H, BOT_NDC = 1 - 2 * 1560 / H;
  const place = (d, ty) => {
    const target = new THREE.Vector3(0, ty, (MID_Z + 2) / 2);
    camera.position.copy(target).addScaledVector(dir, -d); camera.lookAt(target); camera.updateMatrixWorld(true);
    let top = -9, bot = 9, side = 0;
    for (const p of pts) { v.copy(p).project(camera); top = Math.max(top, v.y); bot = Math.min(bot, v.y); side = Math.max(side, Math.abs(v.x)); }
    return { target, top, bot, side };
  };
  const fitTop = (d) => { // dời máy quay lên/xuống cho mái ở đúng TOP_NDC
    let lo = -200, hi = 200, r;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; r = place(d, m); if (r.top > TOP_NDC) lo = m; else hi = m; }
    return r;
  };
  let lo = 10, hi = 200, best = null;
  for (let i = 0; i < 30; i++) {
    const d = (lo + hi) / 2, r = fitTop(d);
    if (r.side <= 0.97 && r.bot >= BOT_NDC) { hi = d; best = { d, r }; } else lo = d;
  }
  if (!best) best = { d: hi, r: fitTop(hi) };
  // đẩy máy quay lại gần (cắt bớt mép ngoài hai tòa bên, cột điện/đèn đường) cho xóm to hơn; ?zoom=1 = vừa khít bề ngang
  const ZOOM = clamp(params.has('zoom') ? Number(params.get('zoom')) || 1 : (Number(CFG.zoomMayQuay) || 1.6), 0.6, 2);
  if (ZOOM !== 1) { const d = best.d / ZOOM; best = { d, r: fitTop(d) }; }
  // chừa chỗ cho vỉa hè tiền cảnh: mép đường phía máy quay (z=14.6) phải nằm trên y≈1300px, nếu không thì lùi máy ra
  // ?mepduong=N: vị trí mép đường tối đa (px); lớn hơn = máy quay được lại gần hơn, vỉa hè tiền cảnh hẹp lại
  const CURB_NDC = 1 - 2 * CURB_Y / H, curbV = new THREE.Vector3();
  best = { d: best.d, r: fitTop(best.d) }; // đặt lại máy quay đúng vị trí best trước khi đo
  for (let i = 0; i < 60; i++) {
    curbV.set(0, 0, 14.6).project(camera);
    if (curbV.y >= CURB_NDC) break;
    const d = best.d * 1.03; best = { d, r: fitTop(d) };
  }
  LOOK_HOME.copy(best.r.target);
  CAM_HOME.copy(best.r.target).addScaledVector(dir, -best.d);
  camera.position.copy(CAM_HOME); camera.lookAt(LOOK_HOME);
  camera.far = best.d + 160; camera.updateProjectionMatrix();
  FOG_NEAR = best.d + 10; FOG_FAR = best.d + 70;
  scene.fog.near = FOG_NEAR; scene.fog.far = FOG_FAR;
}

// ---------- Xe máy, cột điện, đèn đường, dây điện ----------
function scooter(x, z, color, rot) {
  const g = new THREE.Group();
  const body = box(1.5, 0.45, 0.42, M({ color, roughness: 0.4, metalness: 0.3 })); body.position.y = 0.55; g.add(body);
  const seat = box(0.75, 0.14, 0.38, M({ color: '#1b1b1b' })); seat.position.set(-0.2, 0.84, 0); g.add(seat);
  const front = box(0.2, 0.75, 0.4, M({ color, roughness: 0.4, metalness: 0.3 })); front.position.set(0.68, 0.85, 0); front.rotation.z = -0.25; g.add(front);
  const bar = box(0.08, 0.08, 0.7, M({ color: '#222' })); bar.position.set(0.8, 1.25, 0); g.add(bar);
  [-0.55, 0.62].forEach((wx) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.08, 8, 16), M({ color: '#151515' })); w.position.set(wx, 0.28, 0); g.add(w); });
  blob(g, 2.0, 0.75, -0.17);
  g.position.set(x, 0.2, z); g.rotation.y = rot; scene.add(g);
  return g;
}
scooter(BW / 2 + 0.5, 2.0, '#c0392b', 0.25); // nhường chỗ cho bến xe buýt

const pole = new THREE.Group(); scene.add(pole);
{
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 19, 10), M({ color: '#8b8b85' })); p.position.set(POLE_X, 9.5, 4); pole.add(p);
  [16.5, 15.2].forEach((y) => { const arm = box(3.2, 0.14, 0.14, M({ color: '#555' })); arm.position.set(POLE_X, y, 4); pole.add(arm); });
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 12), M({ color: '#6b6b6b' })); tr.position.set(POLE_X + 0.55, 12.4, 4); pole.add(tr);
}
// dây điện chằng chịt
{
  const wireMat = new THREE.LineBasicMaterial({ color: '#0d0d10' });
  const addWire = (a, b, sag) => {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag; pts.push(p); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
  };
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  for (let k = 0; k < 9; k++) addWire(P(POLE_X - 1.6 + k * 0.4, 16.5 - (k % 2) * 1.3, 4), P(-BW / 2 - rand(0, 6), rand(10, 16), rand(1, 3)), rand(0.6, 2.2));
  for (let k = 0; k < 6; k++) addWire(P(POLE_X, rand(13, 16.5), 4), new THREE.Vector3(CW / 2, rand(5, 14), WING_BACK_Z).addScaledVector(wingDir(1), SL - 0.3), rand(0.3, 1.2));
  for (let k = 0; k < 5; k++) addWire(P(POLE_X + 1.6, 16.5 - (k % 2) * 1.3, 4), P(30, rand(12, 17), rand(2, 8)), rand(0.8, 1.6));
  // cuộn dây rối trên cột
  for (let k = 0; k < 4; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5 + k * 0.08, 0.04, 6, 20), M({ color: '#111' })); ring.position.set(POLE_X, 13.6 + k * 0.15, 4); ring.rotation.x = Math.PI / 2 + rand(-0.3, 0.3); pole.add(ring); }
}
// đèn đường
const streetLamp = new THREE.PointLight('#ffb35c', 60, 22, 1.8);
const streetGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffc271', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
{
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 8, 8), M({ color: '#444' })); p.position.set(LAMP_X - 1.4, 4, 4); scene.add(p);
  const arm = box(1.6, 0.1, 0.1, M({ color: '#444' })); arm.position.set(LAMP_X - 0.7, 7.95, 4); scene.add(arm);
  const head = box(0.7, 0.2, 0.4, M({ color: '#333' })); head.position.set(LAMP_X, 7.85, 4); scene.add(head);
  streetLamp.position.set(LAMP_X, 7.4, 4.4); scene.add(streetLamp);
  streetGlow.position.set(LAMP_X, 7.55, 4.3); streetGlow.scale.set(4, 4, 1); scene.add(streetGlow);
}

// ---------- Nhân vật ----------
const SKIN = ['#f1c69a', '#e8b48a', '#d9a173', '#f6d2ae'];
const SHIRTS = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#e9c46a', '#8d5bd6', '#ff7aa2', '#3a86ff', '#ffffff', '#06d6a0'];
const HAIR_COLORS = ['#16100c', '#16100c', '#22160f', '#2e1d13', '#3d2617', '#5c3a22', '#7a4a2a', '#b07a45', '#d8b26e', '#4a2a4f'];
const PANTS_COLORS = ['#1f2a44', '#2b2b2b', '#4a4f5a', '#3b4d61', '#3d5a80', '#2f4f6f', '#b08d57', '#6b705c'];
const SHOE_COLORS = ['#f5f5f5', '#f5f5f5', '#222222', '#e63946', '#3a86ff', '#2e86de', '#ffb703'];
// hình khối dùng chung cho mọi nhân vật (đỡ tốn bộ nhớ khi xóm đông)
const GEO = new Map();
const geo = (key, make) => { let g = GEO.get(key); if (!g) { g = make(); GEO.set(key, g); } return g; };
const HEAD_R = 0.3;
const onHead = (x, y, lift = 0) => Math.sqrt(Math.max(0, HEAD_R * HEAD_R - x * x - y * y)) + lift; // z trên mặt cầu đầu

// ---- kiểu sticker: tô phẳng 3 nấc (toon) + viền trắng/đen quanh cả dáng người
const TOON_GRAD = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const T = (color, glow = 0.22) => new THREE.MeshToonMaterial({ color, gradientMap: TOON_GRAD, emissive: new THREE.Color(color).multiplyScalar(glow) });
// viền = vỏ phình theo pháp tuyến, mặt sau, không ghi depth và vẽ TRƯỚC người (renderOrder) → chỉ lộ ra ngoài bóng dáng, như sticker cắt viền
const hullMat = (color, w, key) => {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, depthWrite: false });
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  transformed += normal * ${w.toFixed(3)};`); };
  m.customProgramCacheKey = () => key;
  return m;
};
const HULL_WHITE = hullMat('#ffffff', 0.085, 'hullW');
const HULL_INK = hullMat('#1a1414', 0.03, 'hullK');
const PERSON_RO = 3;
const PHONE_MAT = new THREE.MeshBasicMaterial({ color: '#9fd8ff' });

// ---- mặt meme vẽ bằng canvas, dán lên mặt cầu đầu. Mặt = kiểu mắt + kiểu miệng (+ kính), cache theo khoá
const FACE_W = 240, FACE_H = 200;
const faceGeo = () => geo('face', () => new THREE.SphereGeometry(0.304, 28, 18, Math.PI / 2 - 0.8, 1.6, Math.PI / 2 - 0.6, 1.35));
const FACE_TEX = new Map();
const INK = '#1a1414';
function drawFace(g, eyes, mouth, glasses) {
  const L = [70, 90], R = [170, 90], MY = 150;
  g.translate(120, 108); g.scale(1.16, 1.16); g.translate(-120, -108); // nét to hơn cho dễ nhìn trên live
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INK; g.fillStyle = INK;
  const circ = (x, y, r, fill, stroke = 6) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = stroke; g.strokeStyle = INK; g.stroke(); } };
  const line = (pts, w = 7, col = INK) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.lineWidth = w; g.strokeStyle = col; g.stroke(); };
  const eyeball = ([x, y], r, px, py, pr) => { circ(x, y, r, '#ffffff'); circ(x + px, y + py, pr, INK, 0); circ(x + px - pr * 0.35, y + py - pr * 0.4, pr * 0.38, '#ffffff', 0); };
  const tear = (x, y, len) => { g.fillStyle = '#5ec8ff'; g.strokeStyle = '#1b6fa8'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 9, y); g.quadraticCurveTo(x - 12, y + len, x, y + len + 6); g.quadraticCurveTo(x + 12, y + len, x + 9, y); g.closePath(); g.fill(); g.stroke(); };
  const heart = (x, y, s) => { g.beginPath(); g.moveTo(x, y + s * 0.9); g.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.7, y - s * 1.3, x, y - s * 0.45); g.bezierCurveTo(x + s * 0.7, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9); g.fillStyle = '#ff2e63'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke(); circ(x - s * 0.45, y - s * 0.45, s * 0.18, '#ffffff', 0); };
  const blush = () => { g.fillStyle = 'rgba(255,105,120,0.45)'; [[34, 128], [206, 128]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 20, 11, 0, 0, Math.PI * 2); g.fill(); }); };

  // ---- mắt
  if (['round', 'squint', 'lol', 'heart', 'closed'].includes(eyes)) blush();
  if (eyes === 'round') { eyeball(L, 25, 3, 3, 13); eyeball(R, 25, -3, 3, 13); }
  else if (eyes === 'shock') { eyeball(L, 29, 0, 0, 5); eyeball(R, 29, 0, 0, 5); line([[48, 50], [88, 58]], 6); line([[192, 50], [152, 58]], 6); }
  else if (eyes === 'derp') { eyeball([66, 86], 29, -10, -9, 12); eyeball([172, 96], 17, 7, 7, 8); }
  else if (eyes === 'smug' || eyes === 'sus') {
    const ry = eyes === 'sus' ? 13 : 20, px = eyes === 'sus' ? 13 : 4;
    [L, R].forEach(([x, y]) => {
      g.save(); g.beginPath(); g.ellipse(x, y + 4, 26, ry, 0, 0, Math.PI); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.clip();
      circ(x + px, y + 10, 12, INK, 0); g.restore();
      g.beginPath(); g.ellipse(x, y + 4, 26, ry, 0, 0, Math.PI); g.closePath(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
      line([[x - 30, y + 3], [x + 30, y + 3]], 8);
    });
    if (eyes === 'smug') { line([[44, 64], [96, 58]], 7); line([[146, 46], [196, 60]], 7); } // nhướn một bên mày
    else { line([[44, 62], [96, 72]], 7); line([[144, 72], [196, 62]], 7); }
  } else if (eyes === 'cool') { // kính đen pixel "deal with it"
    const P = 10, row = (y, x0, n) => { for (let i = 0; i < n; i++) g.fillRect(x0 + i * P, y, P, P); };
    g.fillStyle = '#0d0d0d';
    row(68, 18, 21); // gọng ngang
    [[28, 8], [128, 8]].forEach(([x0, n]) => { row(78, x0, n); row(88, x0 + 10, n - 2); row(98, x0 + 20, n - 4); });
    g.fillStyle = '#ffffff'; g.fillRect(48, 78, P, P); g.fillRect(58, 88, P, P); g.fillRect(148, 78, P, P); g.fillRect(158, 88, P, P);
  } else if (eyes === 'squint' || eyes === 'lol') {
    line([[50, 72], [86, 90], [50, 106]], 9); line([[190, 72], [154, 90], [190, 106]], 9);
    if (eyes === 'lol') { tear(30, 98, 40); tear(210, 98, 40); }
  } else if (eyes === 'closed') {
    [L, R].forEach(([x, y]) => { g.beginPath(); g.arc(x, y - 6, 22, 0.15 * Math.PI, 0.85 * Math.PI); g.lineWidth = 8; g.strokeStyle = INK; g.stroke(); });
  } else if (eyes === 'cry') {
    [L, R].forEach(([x, y]) => { g.beginPath(); g.arc(x, y + 16, 22, 1.15 * Math.PI, 1.85 * Math.PI); g.lineWidth = 8; g.strokeStyle = INK; g.stroke(); });
    g.fillStyle = 'rgba(94,200,255,0.85)'; g.fillRect(58, 96, 22, 104); g.fillRect(160, 96, 22, 104);
  } else if (eyes === 'heart') { heart(L[0], L[1], 24); heart(R[0], R[1], 24); }
  else if (eyes === 'nerd') {
    eyeball(L, 17, 0, 2, 9); eyeball(R, 17, 0, 2, 9);
    circ(L[0], L[1], 31, null, 9); circ(R[0], R[1], 31, null, 9); line([[100, 86], [140, 86]], 8);
  }
  if (glasses && !['cool', 'nerd'].includes(eyes)) { circ(L[0], L[1], 30, null, 6); circ(R[0], R[1], 30, null, 6); line([[100, 88], [140, 88]], 6); }

  // ---- miệng
  const dark = '#5a1620', tongue = '#ff6f91';
  if (mouth === 'smile') { g.beginPath(); g.arc(120, MY - 22, 30, 0.2 * Math.PI, 0.8 * Math.PI); g.lineWidth = 8; g.strokeStyle = INK; g.stroke(); }
  else if (mouth === 'smirk') { g.beginPath(); g.moveTo(92, MY + 2); g.quadraticCurveTo(128, MY + 10, 152, MY - 10); g.lineWidth = 8; g.strokeStyle = INK; g.stroke(); }
  else if (mouth === 'flat') line([[98, MY + 2], [142, MY]], 8);
  else if (mouth === 'wobble') line([[88, MY + 4], [100, MY - 4], [112, MY + 4], [124, MY - 4], [136, MY + 4], [148, MY - 4]], 6);
  else if (mouth === 'o') circ(120, MY + 2, 10, dark, 6);
  else if (mouth === 'open') {
    g.beginPath(); g.ellipse(120, MY + 2, 22, 18, 0, 0, Math.PI * 2); g.fillStyle = dark; g.fill();
    g.save(); g.clip(); g.fillStyle = tongue; g.beginPath(); g.ellipse(120, MY + 18, 16, 10, 0, 0, Math.PI * 2); g.fill(); g.restore();
    g.beginPath(); g.ellipse(120, MY + 2, 22, 18, 0, 0, Math.PI * 2); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  } else if (mouth === 'bigD') {
    const dPath = () => { g.beginPath(); g.moveTo(78, MY - 14); g.lineTo(162, MY - 14); g.quadraticCurveTo(160, MY + 40, 120, MY + 40); g.quadraticCurveTo(80, MY + 40, 78, MY - 14); g.closePath(); };
    dPath(); g.fillStyle = dark; g.fill(); g.save(); g.clip();
    g.fillStyle = '#ffffff'; g.fillRect(70, MY - 16, 100, 13);
    g.fillStyle = tongue; g.beginPath(); g.ellipse(120, MY + 36, 26, 16, 0, 0, Math.PI * 2); g.fill(); g.restore();
    dPath(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
  } else if (mouth === 'tongue') {
    g.fillStyle = tongue; g.beginPath(); g.ellipse(132, MY + 14, 13, 18, 0.2, 0, Math.PI * 2); g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
    line([[133, MY + 4], [135, MY + 20]], 3, '#c2425f');
    line([[92, MY], [106, MY + 6], [120, MY], [134, MY + 2], [150, MY - 6]], 7);
  } else if (mouth === 'teeth') {
    g.beginPath(); g.arc(120, MY - 22, 30, 0.2 * Math.PI, 0.8 * Math.PI); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
    g.fillStyle = '#ffffff'; g.lineWidth = 4; [109, 120].forEach((x) => { g.fillRect(x, MY + 4, 11, 15); g.strokeRect(x, MY + 4, 11, 15); });
  }
}
function faceTex(eyes, mouth, glasses) {
  const key = `${eyes}|${mouth}|${glasses ? 1 : 0}`;
  let t = FACE_TEX.get(key);
  if (!t) { t = canvasTex(FACE_W, FACE_H, (g) => drawFace(g, eyes, mouth, glasses)); FACE_TEX.set(key, t); }
  return t;
}
// mood = mặt thường ngày của mỗi người
const MOODS = {
  vui: ['round', 'smile'], dieu: ['smug', 'smirk'], ngao: ['derp', 'tongue'], ngau: ['cool', 'smirk'],
  nghi: ['sus', 'flat'], mot: ['nerd', 'teeth'], soc: ['shock', 'o'], khoc: ['cry', 'wobble'],
};
const pickMood = () => { const r = Math.random(); return r < 0.32 ? 'vui' : r < 0.52 ? 'dieu' : r < 0.67 ? 'ngao' : r < 0.82 ? 'ngau' : r < 0.92 ? 'nghi' : 'mot'; };
function setFace(p, eyes, mouth) {
  const key = eyes + mouth;
  if (p.faceKey === key) return;
  p.faceKey = key; p.faceMat.map = faceTex(eyes, mouth, p.glasses);
}
// mặt theo trạng thái: nói thì miệng mấp máy, nhảy/quẩy cười ra nước mắt, ngủ nhắm mắt...
function faceFor(p, now, { talking = false, jumping = false, dancing = false, sleeping = false, studying = false } = {}) {
  const [e, m] = MOODS[p.mood] || MOODS.vui;
  if (sleeping) return setFace(p, 'closed', 'o');
  if (dancing) return setFace(p, p.partyFace, 'bigD');
  if (jumping) return setFace(p, 'lol', 'bigD');
  if (studying) return setFace(p, 'nerd', Math.floor(now / 260) % 2 ? 'flat' : 'teeth');
  if (talking) return setFace(p, e, Math.floor(now / 140) % 2 ? 'open' : m);
  // thỉnh thoảng chớp mắt
  if (['round', 'derp', 'shock', 'nerd'].includes(e) && (now + p.phase * 1000) % 4200 < 140) return setFace(p, 'closed', m);
  return setFace(p, e, m);
}

// ngoại hình ngẫu nhiên, lưu lại được (người thuê quay lại xóm buổi sau vẫn y như cũ)
function randomLook() {
  const longHair = Math.random() < 0.45;
  return {
    shirt: pick(SHIRTS), skin: pick(SKIN), glasses: Math.random() < 0.3, hairColor: pick(HAIR_COLORS),
    hair: longHair ? pick(['long', 'long', 'ponytail', 'bun']) : pick(['short', 'short', 'spiky', 'side']),
    top: pick(['tee', 'tee', 'stripe', 'print', 'hoodie']), shorts: Math.random() < 0.3, mood: pickMood(),
    pants: pick(PANTS_COLORS), shoe: pick(SHOE_COLORS), print: pick(['#ffd166', '#ffffff', '#ef476f', '#06d6a0', '#118ab2']),
  };
}
function makePerson({
  shirt = pick(SHIRTS), skin = pick(SKIN), longHair = Math.random() < 0.45, scale = PERSON_SIZE, glasses = Math.random() < 0.3,
  hair = null, hairColor = pick(HAIR_COLORS), top = pick(['tee', 'tee', 'stripe', 'print', 'hoodie']), shorts = Math.random() < 0.3,
  mood = pickMood(), pants = pick(PANTS_COLORS), shoe = pick(SHOE_COLORS), print = null, shadow = true,
} = {}) {
  const g = new THREE.Group();
  const style = hair || (longHair ? pick(['long', 'long', 'ponytail', 'bun']) : pick(['short', 'short', 'spiky', 'side']));
  const pantsM = T(pants);
  const shirtM = T(shirt);
  const skinM = T(skin, 0.28);
  const hairM = T(hairColor, 0.15);
  const shoeM = T(shoe);
  const accent = new THREE.Color(shirt).getHSL({ h: 0, s: 0, l: 0 }).l > 0.6 ? '#2b2d42' : '#ffffff';
  const accentM = T(accent);
  const outlined = []; // các khối tạo nên bóng dáng → có viền sticker
  const add = (parent, mesh, outline = true) => { parent.add(mesh); if (outline) outlined.push(mesh); return mesh; };

  // ---- chân: quần (dài hoặc đùi) + giày; tâm nhóm giữ ở y 0.31 để các tư thế ngồi/đi cũ vẫn đúng
  const legs = [];
  [-0.11, 0.11].forEach((x) => {
    const l = new THREE.Group(); l.position.set(x, 0.31, 0); g.add(l);
    if (shorts) {
      add(l, new THREE.Mesh(geo('legUp', () => new THREE.CapsuleGeometry(0.1, 0.16, 4, 10)), pantsM)).position.y = 0.14;
      add(l, new THREE.Mesh(geo('legLow', () => new THREE.CapsuleGeometry(0.075, 0.3, 4, 10)), skinM)).position.y = -0.1;
    } else {
      add(l, new THREE.Mesh(geo('leg', () => new THREE.CapsuleGeometry(0.095, 0.44, 4, 10)), pantsM)).position.y = 0.02;
    }
    const shoe = add(l, new THREE.Mesh(geo('shoe', () => new THREE.SphereGeometry(0.1, 12, 8)), shoeM));
    shoe.scale.set(1.1, 0.7, 1.6); shoe.position.set(0, -0.28, 0.05);
    legs.push(l);
  });
  const hip = add(g, new THREE.Mesh(geo('hip', () => new THREE.CapsuleGeometry(0.19, 0.04, 4, 14)), pantsM)); hip.position.y = 0.6; hip.scale.z = 0.75;

  // ---- thân áo (các chi tiết gắn vào body nên nhún theo body)
  const body = add(g, new THREE.Mesh(geo('body', () => new THREE.CapsuleGeometry(0.25, 0.3, 6, 16)), shirtM)); body.position.y = 0.92; body.scale.z = 0.7;
  const collar = new THREE.Mesh(geo('collar', () => new THREE.TorusGeometry(0.11, 0.028, 8, 18)), top === 'hoodie' ? shirtM : accentM);
  collar.rotation.x = Math.PI / 2; collar.position.y = 0.38; body.add(collar);
  if (top === 'stripe') {
    [0.12, -0.04].forEach((y) => { const s = new THREE.Mesh(geo('stripe', () => new THREE.CylinderGeometry(0.256, 0.256, 0.06, 20, 1, true)), accentM); s.position.y = y; body.add(s); });
  } else if (top === 'print') {
    const pr = new THREE.Mesh(geo('print', () => new THREE.CircleGeometry(0.085, 18)), T(print || pick(['#ffd166', '#ffffff', '#ef476f', '#06d6a0', '#118ab2']))); pr.position.set(0, 0.06, 0.252); body.add(pr);
    const star = new THREE.Mesh(geo('printDot', () => new THREE.CircleGeometry(0.035, 5)), accentM); star.position.set(0, 0.06, 0.254); body.add(star);
  } else if (top === 'hoodie') {
    const hood = new THREE.Mesh(geo('hood', () => new THREE.TorusGeometry(0.17, 0.065, 8, 20)), shirtM); hood.rotation.x = Math.PI / 2 - 0.5; hood.position.set(0, 0.34, -0.08); body.add(hood);
    [-0.05, 0.05].forEach((x) => { const s = new THREE.Mesh(geo('string', () => new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6)), accentM); s.position.set(x, 0.22, 0.255); body.add(s); });
    const pocket = new THREE.Mesh(geo('pocket', () => new THREE.PlaneGeometry(0.26, 0.1)), T(new THREE.Color(shirt).multiplyScalar(0.8))); pocket.position.set(0, -0.12, 0.253); body.add(pocket);
  }

  // ---- tay: tay áo + cẳng tay da (áo hoodie thì tay dài) + bàn tay
  const arms = [];
  [-1, 1].forEach((s) => {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.3, 1.1, 0); g.add(pivot);
    add(pivot, new THREE.Mesh(geo('sleeve', () => new THREE.CapsuleGeometry(0.085, 0.14, 4, 10)), shirtM)).position.y = -0.1;
    add(pivot, new THREE.Mesh(geo('fore', () => new THREE.CapsuleGeometry(0.065, 0.22, 4, 10)), top === 'hoodie' ? shirtM : skinM)).position.y = -0.3;
    add(pivot, new THREE.Mesh(geo('hand', () => new THREE.SphereGeometry(0.09, 12, 8)), skinM)).position.y = -0.48;
    pivot.rotation.z = s * 0.12; arms.push(pivot);
  });

  // ---- đầu to kiểu chibi (cả nhóm đầu phóng 1.3, mũ/nón gắn sau cũng to theo)
  const headG = new THREE.Group(); headG.position.y = 1.56; headG.scale.setScalar(1.3); g.add(headG);
  add(headG, new THREE.Mesh(geo('head', () => new THREE.SphereGeometry(HEAD_R, 24, 18)), skinM));
  [-1, 1].forEach((s) => { const e = add(headG, new THREE.Mesh(geo('ear', () => new THREE.SphereGeometry(0.06, 10, 8)), skinM)); e.scale.set(0.55, 1, 0.8); e.position.set(s * 0.29, -0.02, 0.02); });

  // tóc: mái đầu + gáy luôn có; kiểu tóc thêm phần riêng. hairTop = phần nhô lên đỉnh (ẩn khi đội mũ)
  const hairTop = new THREE.Group(); headG.add(hairTop);
  const cap = add(headG, new THREE.Mesh(geo('hairCap', () => new THREE.SphereGeometry(0.312, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42)), hairM), false);
  cap.position.set(0, 0.015, -0.01); cap.rotation.x = -0.22;
  add(headG, new THREE.Mesh(geo('hairBack', () => new THREE.SphereGeometry(0.3, 20, 14)), hairM)).position.set(0, 0.03, -0.045);
  const fringe = style === 'side' ? [[-0.15, 0.17, 0.1], [-0.07, 0.19, 0.11], [0.01, 0.2, 0.1], [0.09, 0.2, 0.09]]
    : style === 'spiky' ? [[-0.12, 0.2, 0.08], [0, 0.22, 0.08], [0.12, 0.2, 0.08]]
      : [[-0.17, 0.15, 0.09], [-0.085, 0.18, 0.1], [0, 0.185, 0.1], [0.085, 0.18, 0.1], [0.17, 0.15, 0.09]];
  fringe.forEach(([x, y, r]) => {
    const b = add(headG, new THREE.Mesh(geo('fringe', () => new THREE.SphereGeometry(1, 10, 8)), hairM), false);
    b.scale.set(r, r * 0.7, r * 0.75); b.position.set(x, y, onHead(x, y, -0.04));
  });
  if (style === 'long' || style === 'ponytail' || style === 'bun') {
    const longLock = style === 'long';
    [-1, 1].forEach((s) => { const lock = add(headG, new THREE.Mesh(geo(longLock ? 'lockL' : 'lockS', () => new THREE.CapsuleGeometry(0.065, longLock ? 0.3 : 0.12, 4, 8)), hairM)); lock.position.set(s * 0.25, longLock ? -0.13 : -0.04, 0.08); lock.rotation.z = s * 0.08; });
  }
  if (style === 'long') {
    const back = add(headG, new THREE.Mesh(geo('longBack', () => new THREE.CapsuleGeometry(0.2, 0.32, 6, 14)), hairM));
    back.scale.set(1.35, 1, 0.6); back.position.set(0, -0.2, -0.14);
  } else if (style === 'ponytail') {
    add(headG, new THREE.Mesh(geo('tie', () => new THREE.SphereGeometry(0.06, 10, 8)), T(pick(['#ef476f', '#ffd166', '#06d6a0', '#ffffff']))), false).position.set(0, 0.08, -0.31);
    const tail = add(headG, new THREE.Mesh(geo('tail', () => new THREE.CapsuleGeometry(0.085, 0.3, 4, 10)), hairM)); tail.position.set(0, -0.12, -0.36); tail.rotation.x = 0.35;
  } else if (style === 'bun') {
    add(hairTop, new THREE.Mesh(geo('bun', () => new THREE.SphereGeometry(0.13, 14, 10)), hairM)).position.set(0, 0.29, -0.1);
  } else if (style === 'spiky') {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const sp = add(hairTop, new THREE.Mesh(geo('spike', () => new THREE.ConeGeometry(0.075, 0.2, 8)), hairM));
      sp.position.set(Math.cos(a) * 0.14, 0.28, Math.sin(a) * 0.12 - 0.03); sp.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    }
  } else if (style === 'side') {
    const sw = add(hairTop, new THREE.Mesh(geo('swoop', () => new THREE.SphereGeometry(0.16, 14, 10)), hairM)); sw.scale.set(1.3, 0.55, 1); sw.position.set(-0.08, 0.27, 0.04); sw.rotation.z = 0.25;
  }

  // ---- mặt meme (1 mảnh dán, đổi texture theo biểu cảm)
  const faceMat = new THREE.MeshToonMaterial({ map: faceTex('round', 'smile', false), gradientMap: TOON_GRAD, transparent: true, depthWrite: false, emissive: '#ffffff', emissiveIntensity: 0.18 });
  const face = new THREE.Mesh(faceGeo(), faceMat); headG.add(face);

  // ---- viền sticker
  g.traverse((o) => { if (o.isMesh) o.renderOrder = PERSON_RO; });
  outlined.forEach((m) => {
    const w = new THREE.Mesh(m.geometry, HULL_WHITE); w.renderOrder = 1; m.add(w);
    if (!params.has('nethd')) { const k = new THREE.Mesh(m.geometry, HULL_INK); k.renderOrder = 2; m.add(k); }
  });

  // điện thoại (ẩn), cầm lên lúc rảnh lướt TikTok
  const phone = new THREE.Mesh(geo('phone', () => new THREE.BoxGeometry(0.1, 0.17, 0.02)), PHONE_MAT); phone.position.set(0, -0.56, 0.08); phone.visible = false; arms[1].add(phone);
  const shadowM = shadow ? blob(g, 0.75, 0.6, 0.015) : null;
  g.scale.setScalar(scale);
  const p = { group: g, arms, legs, headG, body, hairTop, face, faceMat, glasses, mood, phone, shadow: shadowM, partyFace: pick(['lol', 'heart', 'squint']), talkUntil: 0, jumpUntil: 0, phase: rand(0, 6), idle: null, nextIdle: performance.now() + rand(4000, 15000) };
  faceFor(p, 0);
  return p;
}

// chủ trọ ngồi ở cổng, có ghế nhựa, bàn trà và quạt (cả cụm dời theo bề rộng tòa nhà)
const yard = new THREE.Group(); yard.position.x = YARD_X + 5.6; scene.add(yard);
const landlady = makePerson({ shirt: '#f2f2f2', skin: '#d9a173', longHair: false, glasses: false, scale: PERSON_SIZE, hair: 'short', hairColor: '#4a4644', top: 'tee', shorts: false, mood: 'dieu' });
{ // ria mép của chú chủ trọ
  const must = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.1, 2, 8), new THREE.MeshBasicMaterial({ color: '#3a3532' }));
  must.rotation.z = Math.PI / 2; must.position.set(0, -0.085, onHead(0, -0.085, 0.006)); landlady.headG.add(must);
}
{
  const g = landlady.group;
  g.position.set(-5.6, 0.62, 1.3); g.rotation.y = 0.25;
  landlady.legs.forEach((l) => { l.rotation.x = -1.4; l.position.z = 0.2; l.position.y = 0.4; });
  yard.add(g);
  const chairM = M({ color: '#d62828', roughness: 0.5 });
  const seat = box(0.75, 0.08, 0.7, chairM); seat.position.set(-5.6, 0.62, 1.2); yard.add(seat);
  [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.3], [0.3, 0.3]].forEach(([dx, dz]) => { const l = box(0.07, 0.62, 0.07, chairM); l.position.set(-5.6 + dx, 0.31, 1.2 + dz); yard.add(l); });
  const table = box(1.1, 0.06, 0.8, M({ color: '#3a86ff' })); table.position.set(-4.3, 0.7, 1.5); yard.add(table);
  [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]].forEach(([dx, dz]) => { const l = box(0.06, 0.7, 0.06, M({ color: '#3a86ff' })); l.position.set(-4.3 + dx, 0.35, 1.5 + dz); yard.add(l); });
  const teapot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), M({ color: '#f1faee' })); teapot.position.set(-4.5, 0.86, 1.5); yard.add(teapot);
  [-4.1, -3.95].forEach((x) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 10), M({ color: '#ffe8b0', transparent: true, opacity: 0.85 })); c.position.set(x, 0.79, 1.6); yard.add(c); });
  // sổ thu tiền
  const book = box(0.3, 0.03, 0.22, M({ color: '#2d6a4f' })); book.position.set(-4.0, 0.75, 1.35); yard.add(book);
  // quạt cây
  const fan = new THREE.Group(); fan.position.set(-7.1, 0, 1.3); yard.add(fan);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1), M({ color: '#ddd' })); st.position.y = 0.55; fan.add(st);
  const cage = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.02, 6, 24), M({ color: '#ddd' })); cage.position.y = 1.2; cage.rotation.y = 0.6; fan.add(cage);
  landlady.fanBlades = new THREE.Mesh(new THREE.CircleGeometry(0.3, 3), M({ color: '#88c5ff', transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  landlady.fanBlades.position.y = 1.2; landlady.fanBlades.rotation.y = 0.6; fan.add(landlady.fanBlades);
}


// =====================================================================
//  Hai quán trước cổng: xe bánh mì – xôi (trái) và quán trà đá (phải)
// =====================================================================
const signTexOf = (text, bg, fg, sub) => canvasTex(512, 160, (g, w, h) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${sub ? 62 : 76}px "Be Vietnam Pro", sans-serif`; g.fillText(text, w / 2, sub ? 62 : h / 2 + 4);
  if (sub) { g.font = '800 34px "Be Vietnam Pro", sans-serif'; g.fillText(sub, w / 2, 122); }
});
function sitPose(p) {
  p.legs.forEach((l) => { l.rotation.x = -1.4; l.position.z = 0.2; l.position.y = 0.4; });
}
function nonLa(p) { // nón lá
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.42, 20, 1, true), M({ color: '#e9d8a6', side: THREE.DoubleSide, roughness: 0.9 }));
  hat.position.y = 0.33; p.headG.add(hat); p.hairTop.visible = false;
}
// đèn quầy hàng: quầng sáng (sprite) thay cho PointLight để máy yếu đỡ nặng; mất điện thì tắt
const stallLights = [];
function stallGlow(parent, x, y, z, color = '#ffd08a', size = 2.2, base = 0.75) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: base }));
  s.position.set(x, y, z); s.scale.setScalar(size); s.userData.base = base; parent.add(s); stallLights.push(s);
  return s;
}

// ---- xe bánh mì – xôi ----
const banhMi = { group: new THREE.Group(), sold: 0 };
{
  const g = banhMi.group; g.position.set(BANHMI_X, 0.2, 2.75); g.rotation.y = 0.12; g.scale.setScalar(STALL_SCALE); scene.add(g);
  const blue = M({ color: '#1f6fb2', roughness: 0.5 });
  const body = box(1.9, 0.75, 0.85, blue); body.position.y = 0.75; g.add(body);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshStandardMaterial({ map: signTexOf('BÁNH MÌ', '#ffd23f', '#b3261e'), roughness: 0.6 }));
  front.position.set(0, 0.75, 0.43); g.add(front);
  // tủ kính có đèn vàng
  const glassBox = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 0.75), new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.25, roughness: 0.1, metalness: 0.1, emissive: '#ffcf70', emissiveIntensity: 0.25 }));
  glassBox.position.y = 1.45; g.add(glassBox);
  const frame = box(1.84, 0.05, 0.79, blue); frame.position.y = 1.8; g.add(frame);
  // ổ bánh mì vàng giòn
  const breadM = M({ color: '#d9963b', roughness: 0.6 });
  for (let k = 0; k < 7; k++) {
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), breadM);
    b.rotation.z = Math.PI / 2; b.position.set(-0.6 + (k % 4) * 0.36, 1.2 + Math.floor(k / 4) * 0.13, -0.1 + (k % 2) * 0.18); g.add(b);
  }
  // nồi xôi có nắp
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.42, 18), M({ color: '#c7c9cc', metalness: 0.7, roughness: 0.3 }));
  pot.position.set(0.62, 1.34, 0.05); g.add(pot);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.04, 18), M({ color: '#d8dadc', metalness: 0.7, roughness: 0.3 }));
  lid.position.set(0.62, 1.57, 0.05); g.add(lid);
  banhMi.potTop = new THREE.Vector3(0.62, 1.7, 0.05);
  // mái che và biển
  const roof = box(2.3, 0.06, 1.3, M({ color: '#d62828' })); roof.position.set(0, 2.45, 0); roof.rotation.x = 0.12; g.add(roof);
  [-0.9, 0.9].forEach((x) => { const pole = box(0.05, 0.65, 0.05, blue); pole.position.set(x, 2.13, 0.35); g.add(pole); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.62), new THREE.MeshStandardMaterial({ map: signTexOf('BÁNH MÌ · XÔI', '#b3261e', '#ffe58a', 'NÓNG GIÒN · 15K'), emissive: '#ffffff', emissiveMap: null, emissiveIntensity: 0 }));
  sign.material.emissiveMap = sign.material.map; sign.material.emissiveIntensity = 0.35;
  sign.position.set(0, 2.82, 0.52); g.add(sign);
  [-0.65, 0.7].forEach((x) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 8, 14), M({ color: '#222' })); w.position.set(x, 0.2, 0.44); g.add(w); });
  stallGlow(g, 0, 2.2, 0.6, '#ffcf70', 1.6, 0.7);
  // cô bán hàng đội nón lá
  const vendor = makePerson({ shirt: '#e76f51', skin: '#e8b48a', longHair: true, glasses: false, scale: PERSON_SIZE / STALL_SCALE });
  nonLa(vendor);
  vendor.group.position.set(0.1, -0.2, -0.75); g.add(vendor.group);
  banhMi.vendor = vendor;
}

// ---- quán trà đá vỉa hè ----
const traDa = { group: new THREE.Group(), cups: 0, seats: [] };
{
  const g = traDa.group; g.position.set(TRADA_X, 0.2, 2.75); g.scale.setScalar(STALL_SCALE); scene.add(g);
  const tableM = M({ color: '#2a7de1', roughness: 0.5 });
  const table = box(1.0, 0.05, 0.65, tableM); table.position.y = 0.48; g.add(table);
  [[-0.42, -0.25], [0.42, -0.25], [-0.42, 0.25], [0.42, 0.25]].forEach(([x, z]) => { const l = box(0.05, 0.48, 0.05, tableM); l.position.set(x, 0.24, z); g.add(l); });
  // cốc trà đá, đĩa hướng dương
  const teaM = new THREE.MeshStandardMaterial({ color: '#c47a22', transparent: true, opacity: 0.85, roughness: 0.2 });
  [[-0.25, 0.1], [0.05, -0.12], [0.3, 0.12]].forEach(([x, z]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.16, 12), teaM); c.position.set(x, 0.59, z); g.add(c); });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.03, 16), M({ color: '#f1faee' })); plate.position.set(-0.05, 0.52, 0.18); g.add(plate);
  const seeds = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M({ color: '#3b3b3b' })); seeds.position.set(-0.05, 0.53, 0.18); seeds.scale.y = 0.4; g.add(seeds);
  // bình trà to và ấm
  const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.6, 16), M({ color: '#e63946', roughness: 0.4 })); jug.position.set(-0.75, 0.5, -0.65); g.add(jug);
  const jugLid = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 16), M({ color: '#f1faee' })); jugLid.position.set(-0.75, 0.84, -0.65); g.add(jugLid);
  const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), M({ color: '#9aa0a6', metalness: 0.7, roughness: 0.3 })); kettle.position.set(-0.35, 0.66, -0.15); g.add(kettle);
  traDa.steamAt = new THREE.Vector3(-0.35, 0.85, -0.15);
  // điếu cày dựng cạnh bàn
  if (CFG.hienDieuCay !== false) {
    const dc = new THREE.Group(); dc.position.set(0.72, 0, -0.55); dc.rotation.z = -0.12; g.add(dc);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 1.15, 12), M({ color: '#c9a66b', roughness: 0.7 })); tube.position.y = 0.58; dc.add(tube);
    [0.2, 0.55, 0.9].forEach((y) => { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 14), M({ color: '#8a6a35' })); ring.rotation.x = Math.PI / 2; ring.position.y = y; dc.add(ring); });
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), M({ color: '#7a5a2a' })); pipe.position.set(0.1, 0.32, 0); pipe.rotation.z = -0.9; dc.add(pipe);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.06, 8), M({ color: '#5a3d1a' })); bowl.position.set(0.21, 0.4, 0); dc.add(bowl);
  }
  // biển "TRÀ ĐÁ" dựng trên ghế
  const signStool = box(0.36, 0.32, 0.36, M({ color: '#d62828' })); signStool.position.set(1.15, 0.16, 0.5); g.add(signStool);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ map: signTexOf('TRÀ ĐÁ', '#ffffff', '#1d3557', '3K · HƯỚNG DƯƠNG'), roughness: 0.6 }));
  sign.position.set(1.15, 0.58, 0.68); sign.rotation.y = -0.25; g.add(sign);
  // ghế nhựa đỏ cho khách
  const stoolM = M({ color: '#d62828', roughness: 0.5 });
  [[-0.95, 0.15, Math.PI / 2], [0.0, 0.75, Math.PI], [0.95, 0.05, -Math.PI / 2], [0.5, 0.78, Math.PI]].forEach(([x, z, ry]) => {
    const st = box(0.34, 0.3, 0.34, stoolM); st.position.set(x, 0.15, z); g.add(st);
    traDa.seats.push({ x, z, ry, who: null });
  });
  // bà bán trà đá ngồi ghế thấp
  const vendor = makePerson({ shirt: '#6a994e', skin: '#d9a173', longHair: true, glasses: false, scale: PERSON_SIZE / TRADA_FRONT_SCALE });
  sitPose(vendor); vendor.group.position.set(-0.25, -0.05, -0.75); g.add(vendor.group);
  const vstool = box(0.34, 0.3, 0.34, stoolM); vstool.position.set(-0.25, 0.15, -0.8); g.add(vstool);
  const bulb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffd08a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  bulb.position.set(0, 1.7, 0.2); bulb.scale.setScalar(1.2); g.add(bulb); traDa.bulb = bulb;
  traDa.vendor = vendor;
}

// =====================================================================
//  Vỉa hè bên kia đường (tiền cảnh, sát máy quay): lấp khoảng đường trống phía dưới màn hình.
//  Quán cóc ô xanh, xe nước mía, gánh hàng rong đi qua lại, hàng xe máy đỗ, cây bàng hai đầu.
//  Mọi thứ thấp (≤ 2.6) để không che khu trọ phía sau.
// =====================================================================
// Vùng khung chat TikTok che (màn hình 1080×1920): góc dưới bên trái. Quầy hàng chỉ đặt ở cột phải (x > CHAT_ZONE.w).
// ?vungchat hiện khung đỏ mờ để canh chỉnh.
const CHAT_ZONE = { x: 0, y: 1150, w: 700, h: 770 };
if (params.has('vungchat')) {
  const z = document.createElement('div');
  Object.assign(z.style, { position: 'absolute', left: CHAT_ZONE.x + 'px', top: CHAT_ZONE.y + 'px', width: CHAT_ZONE.w + 'px', height: CHAT_ZONE.h + 'px',
    background: 'rgba(255,0,0,.22)', border: '3px dashed #f33', zIndex: 50, pointerEvents: 'none' });
  (document.getElementById('stage') || document.body).appendChild(z);
}
const front = { walkers: [], sitters: [] };
{
  // điểm mặt đất ứng với pixel (px, py) trên màn hình 1080×1920: đặt đồ theo vị trí trên màn hình cho chắc
  const rc = new THREE.Raycaster(), GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const at = (px, py) => {
    rc.setFromCamera(new THREE.Vector2(px / W * 2 - 1, 1 - py / H * 2), camera);
    const v = new THREE.Vector3(); return rc.ray.intersectPlane(GROUND, v) ? v : new THREE.Vector3(0, 0, 30);
  };
  const zAt = (py) => at(W / 2, py).z;
  const Z0 = Math.max(14.6, zAt(CURB_Y));   // mép vỉa hè
  const Z1 = zAt(H) + 6;                    // vỉa hè kéo quá mép dưới màn hình
  front.z0 = Z0;
  const tiles = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8f877a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? '#a39a8b' : '#958c7e'; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
      g.fillStyle = 'rgba(0,0,0,.06)'; for (let k = 0; k < 6; k++) g.fillRect(x * 64 + rand(4, 56), y * 64 + rand(4, 56), 3, 3);
    }
  }, [60, (Z1 - Z0) / 4]);
  const walk = new THREE.Mesh(new THREE.BoxGeometry(240, 0.3, Z1 - Z0), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.9 }));
  walk.position.set(0, 0.05, (Z0 + Z1) / 2); scene.add(walk);
  const curb = box(240, 0.34, 0.35, M({ color: '#c9c3b5' })); curb.position.set(0, 0.07, Z0 + 0.1); scene.add(curb);

  // mép vỉa hè trên màn hình; các quầy xếp theo hàng tính từ mép này (không phụ thuộc cấu hình số phòng)
  const yC = new THREE.Vector3(0, 0, Z0).project(camera), CY = Math.round((1 - yC.y) / 2 * H);
  const R = (dy) => Math.min(CY + dy, 1600);
  front.hw = Math.abs(at(0, R(150)).x); front.at = (px, dy) => at(px, R(dy)); front.cy = CY;
  const place = (obj, px, py) => { const p = at(px, py); obj.position.x = p.x; obj.position.z = p.z; return p; };

  // cây bàng hai đầu (tán dẹt tầng tầng)
  const leafM = M({ color: '#3f8f3a', flatShading: true }), leaf2 = M({ color: '#57a84a', flatShading: true });
  [-1].forEach((s) => { // chỉ bên trái (bên phải dành cho quầy hàng)
    const t = new THREE.Group(); t.position.y = 0.2; place(t, 60, R(100)); t.scale.setScalar(1.5); scene.add(t);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.4, 8), M({ color: '#6b4b32' })); trunk.position.y = 1.2; t.add(trunk);
    [[2.3, 1.9, leafM], [2.9, 1.4, leaf2], [3.4, 0.9, leafM]].forEach(([y, r, m]) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, 0.55, 7), m); c.position.y = y; c.rotation.y = rand(0, 1); t.add(c);
    });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 12), M({ color: '#5a4636' })); ring.position.y = 0.2; t.add(ring);
  });

  // quán trà đá dời sang vỉa hè đối diện (cột phải, ngoài vùng chat); khách, khói, nhãn đều tính theo traDa.group nên đi theo
  { const p = at(790, R(75)); traDa.group.position.set(p.x, 0.2, p.z); traDa.group.scale.setScalar(TRADA_FRONT_SCALE); }

  // quán cóc: ô xanh, bàn thấp, ghế nhựa đỏ, khách ngồi quay lưng nhìn sang xóm trọ
  {
    const g = new THREE.Group(); g.position.set(TRADA_X + 0.5, 0.2, 2.9); g.scale.setScalar(QUANCOC_SCALE); scene.add(g); // vỉa hè trước cổng, chỗ cũ của trà đá
    const umb = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.6, 8, 1, true), M({ color: '#2a7de1', side: THREE.DoubleSide }));
    umb.position.set(0, 2.5, -0.7); umb.rotation.x = -0.35; g.add(umb);
    const umb2 = new THREE.Mesh(new THREE.ConeGeometry(1.72, 0.6, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, wireframe: true }));
    umb2.position.copy(umb.position); umb2.rotation.x = umb.rotation.x; g.add(umb2);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.5), M({ color: '#ddd' })); stick.position.set(0, 1.25, -0.75); stick.rotation.x = -0.35 * 0.3; g.add(stick);
    const tableM = M({ color: '#f1c40f', roughness: 0.5 });
    const table = box(1.1, 0.05, 0.7, tableM); table.position.y = 0.45; g.add(table);
    [[-0.45, -0.28], [0.45, -0.28], [-0.45, 0.28], [0.45, 0.28]].forEach(([x, z]) => { const l = box(0.05, 0.45, 0.05, tableM); l.position.set(x, 0.22, z); g.add(l); });
    const cupM = new THREE.MeshStandardMaterial({ color: '#7a4a1e', transparent: true, opacity: 0.85 });
    [[-0.3, 0], [0.1, 0.1], [0.35, -0.1]].forEach(([x, z]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.16, 10), cupM); c.position.set(x, 0.55, z); g.add(c); });
    const stoolM = M({ color: '#d62828', roughness: 0.5 });
    [[-0.55, -0.7], [0.55, -0.7], [-1.05, 0.1], [1.05, 0.1]].forEach(([x, z], k) => {
      const st = box(0.34, 0.3, 0.34, stoolM); st.position.set(x, 0.15, z); g.add(st);
      if (k > 2) return;
      const p = makePerson({ scale: PERSON_SIZE / QUANCOC_SCALE });
      sitPose(p); p.group.position.set(x, -0.05, z + (k < 2 ? 0.05 : 0)); p.group.rotation.y = k < 2 ? Math.PI : (k === 2 ? Math.PI / 2 : -Math.PI / 2);
      g.add(p.group); front.sitters.push(p);
    });
    stallGlow(g, 0, 2.0, 0, '#ffd08a', 1.4, 0.6);
  }

  // xe nước mía: thùng xanh lá, bó mía dựng, máy ép, biển quay về máy quay
  {
    const g = new THREE.Group(); g.position.set(4.4, 0.2, 2.9); g.scale.setScalar(1.25); scene.add(g);
    const green = M({ color: '#2d9b4e', roughness: 0.5 });
    const body = box(1.9, 0.8, 0.9, green); body.position.y = 0.8; g.add(body);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.62), new THREE.MeshStandardMaterial({ map: signTexOf('NƯỚC MÍA', '#ffe066', '#1b5e20', 'SẦU RIÊNG · TẮC · 10K'), roughness: 0.6 }));
    sign.position.set(0, 0.8, 0.46); g.add(sign);
    const press = box(0.5, 0.45, 0.5, M({ color: '#c7c9cc', metalness: 0.7, roughness: 0.3 })); press.position.set(0.55, 1.42, 0); g.add(press);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), M({ color: '#e63946' })); wheel.rotation.x = Math.PI / 2; wheel.position.set(0.55, 1.45, 0.29); g.add(wheel); front.wheel = wheel;
    const caneM = M({ color: '#7cb342', roughness: 0.7 }), caneD = M({ color: '#4e7d2a' });
    for (let k = 0; k < 9; k++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.7, 6), k % 3 ? caneM : caneD);
      c.position.set(-0.75 + (k % 3) * 0.1, 2.0, -0.2 + Math.floor(k / 3) * 0.1); c.rotation.z = (k % 3 - 1) * 0.08; g.add(c);
    }
    const glassM = new THREE.MeshStandardMaterial({ color: '#d4e157', transparent: true, opacity: 0.8 });
    [-0.15, 0.1].forEach((x) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.2, 10), glassM); c.position.set(x, 1.3, 0.2); g.add(c); });
    [-0.65, 0.7].forEach((x) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 8, 14), M({ color: '#222' })); w.position.set(x, 0.2, 0.47); g.add(w); });
    const vendor = makePerson({ shirt: '#f4a261', longHair: false, scale: PERSON_SIZE / 1.25 });
    vendor.group.position.set(0.1, -0.2, -0.8); g.add(vendor.group); front.sitters.push(vendor);
  }

  // hàng xe máy đỗ sát mép vỉa hè
  const colors = ['#c0392b', '#2c3e50', '#ecf0f1', '#f39c12', '#16a085', '#8e44ad', '#34495e'];
  for (let k = 0; k < 5; k++) { const p = at(260 + k * 62, R(50)); scooter(p.x, p.z, pick(colors), 0.55 + rand(-0.1, 0.1)).scale.setScalar(1.25); }

  // thùng rác, tủ điện
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.8, 12), M({ color: '#2e7d32' })); bin.position.y = 0.6; place(bin, 190, R(60)); scene.add(bin);

  // hàng chậu hoa sát máy quay, làm khung dưới cùng
  const potM = M({ color: '#b5651d' }), flowerMs = ['#ff4d6d', '#ffd60a', '#ff8fab', '#ffffff'].map((c) => M({ color: c, flatShading: true }));
  for (let k = 0; k < 6; k++) {
    const g = new THREE.Group(); g.position.y = 0.2; place(g, 90 + k * 180, 1840); g.scale.setScalar(1.4); scene.add(g);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.32, 0.6, 10), potM); pot.position.y = 0.3; g.add(pot);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), leaf2); bush.position.y = 0.85; bush.scale.y = 0.75; g.add(bush);
    for (let j = 0; j < 5; j++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), pick(flowerMs)); f.position.set(rand(-0.4, 0.4), rand(0.95, 1.2), rand(-0.3, 0.4)); g.add(f); }
  }

  // vạch kẻ qua đường từ cổng xóm sang vỉa hè này
  const zebraM = M({ color: '#e8e4d8', roughness: 0.8 });
  for (let x = -2.4; x <= 2.41; x += 0.8) { const s = box(0.45, 0.03, Z0 - 4.6, zebraM); s.position.set(x, 0.015, (Z0 + 4.4) / 2); scene.add(s); }

  // sạp trái cây: bàn gỗ, mái bạt cam, từng đống quả nhiều màu
  {
    const g = new THREE.Group(); g.position.set(-4.6, 0.2, 2.9); g.scale.setScalar(1.25); scene.add(g);
    const woodM = M({ color: '#a47148' });
    const top = box(1.8, 0.08, 0.9, woodM); top.position.y = 0.7; g.add(top);
    [[-0.8, -0.38], [0.8, -0.38], [-0.8, 0.38], [0.8, 0.38]].forEach(([x, z]) => { const l = box(0.06, 0.7, 0.06, woodM); l.position.set(x, 0.35, z); g.add(l); });
    [-0.85, 0.85].forEach((x) => { const pl = box(0.05, 1.5, 0.05, woodM); pl.position.set(x, 1.45, -0.42); g.add(pl); });
    const tarp = box(2.1, 0.05, 1.2, M({ color: '#f77f00' })); tarp.position.set(0, 2.2, -0.05); tarp.rotation.x = 0.22; g.add(tarp);
    const piles = [['#ffb703', 0.09], ['#e63946', 0.1], ['#90be6d', 0.12], ['#7b2cbf', 0.07], ['#f4d35e', 0.08]];
    piles.forEach(([col, r], i) => {
      const m = M({ color: col, roughness: 0.5 });
      for (let j = 0; j < 9; j++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), m);
        const row = j < 5 ? 0 : 1; f.position.set(-0.68 + i * 0.34 + rand(-0.07, 0.07), 0.78 + row * r * 1.4, rand(-0.25, 0.25) * (row ? 0.5 : 1)); g.add(f);
      }
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.36), new THREE.MeshStandardMaterial({ map: signTexOf('TRÁI CÂY', '#ffffff', '#d62828'), roughness: 0.6 }));
    sign.position.set(0, 0.45, 0.47); g.add(sign);
    const seller = makePerson({ longHair: true, shirt: '#ff7aa2', scale: PERSON_SIZE / 1.25 });
    nonLa(seller); sitPose(seller); seller.group.position.set(0.3, -0.05, -0.8); g.add(seller.group); front.sitters.push(seller);
    const st = box(0.34, 0.3, 0.34, M({ color: '#3a86ff' })); st.position.set(0.3, 0.15, -0.85); g.add(st);
  }

  // đại lý vé số kiến thiết miền Bắc: nơi quay số may mắn miễn phí mỗi phút (xem quaySo)
  {
    const g = new THREE.Group(); g.position.set(-13.0, 0.2, 2.9); g.scale.setScalar(1.8); scene.add(g); veSo.group = g;
    const red = M({ color: '#c1121f', roughness: 0.5 });
    const base = box(1.5, 0.9, 0.7, red); base.position.y = 0.45; g.add(base);
    const glassBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.7), new THREE.MeshStandardMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.35, roughness: 0.1 }));
    glassBox.position.y = 1.18; g.add(glassBox);
    const ticketCols = ['#ffd6e0', '#fff3b0', '#cdeac0', '#bde0fe', '#ffc8a2'];
    for (let k = 0; k < 10; k++) { // xấp vé xếp hàng trong tủ kính
      const tk = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.32), M({ color: ticketCols[k % 5], side: THREE.DoubleSide }));
      tk.position.set(-0.6 + (k % 5) * 0.3, 1.18, -0.1 + Math.floor(k / 5) * 0.22); tk.rotation.x = -0.5; g.add(tk);
    }
    const front2 = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.62), new THREE.MeshStandardMaterial({ map: signTexOf('VÉ SỐ', '#ffd60a', '#c1121f', 'XSKT MIỀN BẮC'), roughness: 0.6 }));
    front2.position.set(0, 0.47, 0.36); g.add(front2);
    const umb = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.45, 8, 1, true), M({ color: '#e63946', side: THREE.DoubleSide }));
    umb.position.set(0, 2.25, -0.55); umb.rotation.x = -0.35; g.add(umb);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2), M({ color: '#ddd' })); stick.position.set(0, 1.1, -0.6); g.add(stick);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshStandardMaterial({ map: canvasTex(256, 180, (c, w, h) => {
      c.fillStyle = '#1d3557'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffd60a'; c.lineWidth = 6; c.strokeRect(4, 4, w - 8, h - 8);
      c.fillStyle = '#ffd60a'; c.textAlign = 'center'; c.font = '900 30px "Be Vietnam Pro", sans-serif'; c.fillText('XỔ SỐ', w / 2, 52);
      c.fillText('KIẾN THIẾT', w / 2, 92); c.fillStyle = '#ffffff'; c.font = '800 24px "Be Vietnam Pro", sans-serif'; c.fillText('MIỀN BẮC · 10.000đ', w / 2, 138);
    }), roughness: 0.6 }));
    board.position.set(-1.05, 0.75, 0.2); board.rotation.y = 0.35; g.add(board);
    const stand = box(0.05, 0.75, 0.05, M({ color: '#333' })); stand.position.set(-1.05, 0.38, 0.15); g.add(stand);
    const seller = makePerson({ shirt: '#457b9d', longHair: false, scale: PERSON_SIZE / 1.3 });
    sitPose(seller); seller.group.position.set(0.2, -0.05, -0.75); g.add(seller.group); front.sitters.push(seller);
    const st = box(0.34, 0.3, 0.34, M({ color: '#d62828' })); st.position.set(0.2, 0.15, -0.8); g.add(st);
  }

  // gánh hàng rong và người đi bộ đi dọc vỉa hè
  const fruitM = [M({ color: '#ffb703' }), M({ color: '#e63946' }), M({ color: '#90be6d' })];
  for (let k = 0; k < 2; k++) {
    const p = makePerson({ scale: PERSON_SIZE, longHair: k === 0, shirt: k === 0 ? '#e9c46a' : pick(SHIRTS) });
    if (k === 0) {
      nonLa(p);
      const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8), M({ color: '#a47148' }));
      yoke.rotation.x = Math.PI / 2; yoke.position.set(0.18, 1.32, 0); p.group.add(yoke);
      [-0.85, 0.85].forEach((z) => {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.75), M({ color: '#ddd' })); rope.position.set(0.18, 0.95, z); p.group.add(rope);
        const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.26, 12), M({ color: '#c9a66b' })); basket.position.set(0.18, 0.5, z); p.group.add(basket);
        for (let j = 0; j < 5; j++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), fruitM[j % 3]); f.position.set(0.18 + rand(-0.15, 0.15), 0.68, z + rand(-0.15, 0.15)); p.group.add(f); }
      });
    }
    scene.add(p.group);
    front.walkers.push({ p, x: k === 0 ? -front.hw : front.hw * 0.3, dir: k === 0 ? 1 : -1, speed: k === 0 ? 0.9 : 1.3, z: zAt(k === 0 ? R(120) : Math.max(R(300), 1680)) });
  }
}
function updateFront(dt, now) {
  const t = now / 1000;
  for (const w of front.walkers) {
    w.x += w.dir * w.speed * dt;
    if (w.x > front.hw + 2 || w.x < -front.hw - 2) { w.dir *= -1; }
    const g = w.p.group; g.position.set(w.x, 0.2 + Math.abs(Math.sin(t * 6 * w.speed)) * 0.04, w.z);
    g.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    w.p.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 6 * w.speed + i * Math.PI) * 0.5));
  }
  front.sitters.forEach((p, i) => { p.headG.rotation.y = Math.sin(t * 0.5 + i * 1.7) * 0.35; });
  if (front.wheel) front.wheel.rotation.y += dt * 2;
}

// khách ngồi trà đá: người comment "trà đá" xuống quán ngồi một lúc
function sitTea(t) {
  const now = performance.now();
  let seat = traDa.seats.find((s) => s.who && s.who.t === t);
  if (seat) { seat.who.until = now + 45000; return seat; }
  seat = traDa.seats.find((s) => !s.who) || traDa.seats.slice().sort((a, b) => a.who.until - b.who.until)[0];
  if (seat.who) leaveTea(seat);
  const p = makePerson({ scale: PERSON_SIZE / TRADA_FRONT_SCALE });
  sitPose(p);
  p.group.position.set(seat.x, 0.18, seat.z); p.group.rotation.y = seat.ry;
  traDa.group.add(p.group);
  const el = document.createElement('div'); el.className = 'plate small'; el.textContent = `🍵 ${t.name}`; labelsEl.appendChild(el);
  seat.who = { t, p, el, until: now + 45000 };
  return seat;
}
function leaveTea(seat) {
  if (!seat.who) return;
  const { t, p } = seat.who;
  if (t.outing === 'tea') { // đứng dậy, qua đường về phòng
    if (tenants.get(t.id) === t && walkers.length < MAX_WALKERS) {
      const from = p.group.getWorldPosition(new THREE.Vector3()); from.y = 0.2;
      walkHome(stallWalker(t, '🍵', from, []), t, teaPath().reverse());
    } else { t.outing = null; roomShow(t, true); }
  }
  traDa.group.remove(p.group); seat.who.el.remove(); seat.who = null;
}
function updateStalls(dt, now) {
  const t = now / 1000;
  banhMi.vendor.arms[1].rotation.z = now < (banhMi.busyUntil || 0) ? -1.6 + Math.sin(now / 120) * 0.5 : 0.12 + Math.sin(t * 1.2) * 0.05;
  banhMi.vendor.headG.rotation.y = Math.sin(t * 0.7) * 0.35;
  traDa.vendor.arms[1].rotation.z = now < (traDa.busyUntil || 0) ? -1.3 + Math.sin(now / 140) * 0.4 : -0.3;
  const nightK = 0.25 + 0.75 * (1 - dayS);
  stallLights.forEach((l) => (l.material.opacity = power ? l.userData.base * nightK : 0));
  traDa.bulb.material.opacity = power ? 0.9 + Math.sin(t * 9) * 0.05 : 0;
  // hơi nóng từ nồi xôi và ấm trà
  if (Math.random() < dt * 3) spawnSprite(steamTex, banhMi.group.localToWorld(banhMi.potTop.clone()), { vel: new THREE.Vector3(rand(-0.1, 0.1), 0.6, 0), life: 1.6, size: 0.3, grow: 0.6, opacity: 0.45 });
  if (Math.random() < dt * 1.5) spawnSprite(steamTex, traDa.group.localToWorld(traDa.steamAt.clone()), { vel: new THREE.Vector3(0, 0.5, 0), life: 1.3, size: 0.2, grow: 0.4, opacity: 0.35 });
  // thỉnh thoảng có khách đang ngồi quán rít một hơi điếu cày (trung bình ~40 giây một lần)
  if (CFG.hienDieuCay !== false && Math.random() < dt / 40) {
    const busy = traDa.seats.filter((s) => s.who);
    if (busy.length) hutDieuCay(pick(busy));
  }
  const v = new THREE.Vector3();
  traDa.seats.forEach((s) => {
    if (!s.who) return;
    if (now > s.who.until || !tenants.has(s.who.t.id)) { leaveTea(s); return; }
    const p = s.who.p;
    p.arms[0].rotation.x = -0.9 + Math.sin(t * 1.5 + s.x) * 0.25; // nâng cốc
    p.headG.rotation.z = Math.sin(t * 1.3 + s.z) * 0.08;
    p.group.getWorldPosition(v); v.y += 2.05;
    const sc = toScreen(v); s.who.el.style.left = `${sc.x}px`; s.who.el.style.top = `${sc.y}px`;
  });
}
const STALL_FLOAT = (group, ch, y) => {
  const v = new THREE.Vector3(0, y, 0); group.localToWorld(v);
  const sc = toScreen(v);
  const el = document.createElement('div'); el.className = 'float'; el.textContent = ch;
  el.style.left = `${sc.x}px`; el.style.top = `${sc.y}px`; labelsEl.appendChild(el); setTimeout(() => el.remove(), 2300);
};
const SHOP_LINES = {
  taphoa: () => pick(['mua thùng mì tôm', 'mua chai nước ngọt', 'mua gói dầu gội', 'mua bịch bim bim']),
  thuoc: () => pick(['mua vỉ thuốc cảm', 'mua miếng dán hạ sốt', 'mua lọ dầu gió', 'mua hộp khẩu trang']),
  giatla: () => pick(['mang đồ đi giặt', 'gửi 3 cân quần áo', 'lấy đồ giặt sấy thơm phức']),
  photo: () => pick(['in đề cương ôn thi', 'photo giáo trình', 'đóng gáy đồ án']),
  com: () => pick(['ăn suất cơm rang', 'mua hộp cơm sườn', 'ăn cơm bình dân']),
  suaxe: () => pick(['vá săm xe đạp', 'bơm lốp xe máy', 'thay dầu xe']),
};
function visitShop(t, key) {
  const sh = SHOPS[key]; if (!sh) return;
  sh.n++;
  STALL_FLOAT(sh.anchor, sh.def.emoji, 3.4);
  floatEmoji(t.room, sh.def.emoji);
  toast(`${sh.def.emoji} ${t.name} ${SHOP_LINES[key]()} ở ${sh.def.name.toLowerCase()}`);
  sfx.coin();
}
function buyBanhMi(t, what) {
  banhMi.sold++; banhMi.busyUntil = performance.now() + 1500;
  STALL_FLOAT(banhMi.group, what === 'xoi' ? '🍙' : '🥖', 2.2);
  floatEmoji(t.room, what === 'xoi' ? '🍙' : '🥖');
  toast(`${what === 'xoi' ? '🍙' : '🥖'} ${t.name} mua ${what === 'xoi' ? 'gói xôi' : 'ổ bánh mì'}`);
  sfx.coin();
}
function drinkTea(t, hut = false) {
  traDa.cups++; traDa.busyUntil = performance.now() + 1500;
  const seat = sitTea(t);
  STALL_FLOAT(traDa.group, '🍵', 1.6);
  hut = hut && CFG.hienDieuCay !== false;
  toast(hut ? `🍵 ${t.name} xuống quán rít một hơi điếu cày` : `🍵 ${t.name} xuống quán làm cốc trà đá`);
  sfx.knock();
  if (hut) hutDieuCay(seat);
}
// khách ngồi quán rít điếu cày: tiếng ùng ục rồi nhả khói
function hutDieuCay(seat) {
  setTimeout(() => {
    if (!seat.who) return;
    sfx.dieuCay();
    setTimeout(() => {
      if (!seat.who) return;
      const v = new THREE.Vector3(seat.x, 1.55, seat.z); traDa.group.localToWorld(v);
      for (let i = 0; i < 5; i++) setTimeout(() => spawnSprite(steamTex, v.clone(), { vel: new THREE.Vector3(rand(-0.25, 0.25), 0.45, rand(-0.1, 0.1)), life: 2.4, size: 0.3, grow: 0.9, opacity: 0.4 }), i * 120);
    }, 1900);
  }, 600);
}


// =====================================================================
//  Bến xe buýt trước cổng: người vào live xuống xe, người rời xóm lên xe
// =====================================================================
const STOP_X = 14.0, BUS_Z = 6.1, SIDEWALK_Z = 4.35, GATE = new THREE.Vector3(0.5, 0.2, 1.3);
const BUS_LEN = 9, BUS_TOUR = CFG.tuyenBuyt || '32';
// nhà chờ (dùng cho cả bến trước cổng và bến ở vỉa hè đối diện)
function busShelter(signBack) {
  const g = new THREE.Group();
  const metal = M({ color: '#5c6b7a', metalness: 0.5, roughness: 0.5 });
  [[-1.3, -0.45], [1.3, -0.45], [-1.3, 0.35], [1.3, 0.35]].forEach(([x, z]) => { const p = box(0.07, 2.4, 0.07, metal); p.position.set(x, 1.2, z); g.add(p); });
  const roof = box(2.9, 0.08, 1.15, new THREE.MeshStandardMaterial({ color: '#2a9df4', transparent: true, opacity: 0.6, roughness: 0.2 })); roof.position.set(0, 2.42, -0.05); g.add(roof);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), new THREE.MeshStandardMaterial({ map: signTexOf('BẾN XE BUÝT', '#0b5394', '#ffffff', `TUYẾN ${BUS_TOUR} · XÓM TRỌ ⇄ ĐẠI HỌC`), roughness: 0.6 }));
  back.position.set(0, 1.45, -0.46); g.add(back);
  const bench = box(2.2, 0.08, 0.4, M({ color: '#8d5524' })); bench.position.set(0, 0.48, -0.2); g.add(bench);
  [-0.9, 0.9].forEach((x) => { const l = box(0.06, 0.48, 0.3, metal); l.position.set(x, 0.24, -0.2); g.add(l); });
  // cột biển tròn
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 8), metal); pole.position.set(1.75, 1.4, 0.45); g.add(pole);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#0b5394'; c.beginPath(); c.arc(w / 2, h / 2, 62, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 7; c.stroke();
    c.font = '64px "Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🚌', w / 2, h / 2 + 4);
  }) }));
  disc.position.set(1.75, 2.7, 0.5); g.add(disc);
  if (signBack) { const b2 = back.clone(); b2.rotation.y = Math.PI; b2.position.z = -0.48; g.add(b2); } // biển đọc được từ phía sau
  stallGlow(g, 0, 2.3, 0.1, '#bfe3ff', 1.6, 0.55);
  return g;
}
{ const g = busShelter(false); g.position.set(STOP_X - 0.6, 0.2, 3.6); g.scale.setScalar(1.5); scene.add(g); }
{ // bến ở vỉa hè đối diện (tiền cảnh): quay mặt ra đường, biển đọc từ phía máy quay
  const g = busShelter(true); g.position.y = 0.2; const p = front.at(975, 70); g.position.x = p.x; g.position.z = p.z;
  g.rotation.y = Math.PI; g.scale.setScalar(1.25); scene.add(g);
}

// xe buýt
const busSideTex = canvasTex(1024, 256, (g, w, h) => {
  g.fillStyle = '#1f8a4c'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f2c14e'; g.fillRect(0, h - 70, w, 18);
  g.fillStyle = '#ffffff'; g.fillRect(0, 22, w, 8);
  for (let x = 150; x < w - 40; x += 112) { // cửa sổ có đèn vàng
    g.fillStyle = '#ffe2a8'; g.fillRect(x, 40, 96, 92);
    g.fillStyle = 'rgba(40,30,20,0.55)'; g.beginPath(); g.arc(x + 48, 108, 20, Math.PI, 0); g.fill(); g.fillRect(x + 28, 108, 40, 24); // bóng người ngồi
    g.strokeStyle = '#123'; g.lineWidth = 5; g.strokeRect(x, 40, 96, 92);
  }
  g.fillStyle = '#163d5c'; g.fillRect(20, 40, 110, 150); // cửa
  g.fillStyle = '#fff'; g.font = '900 46px "Be Vietnam Pro", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(`${BUS_TOUR}`, 40, 220);
  g.font = '800 34px "Be Vietnam Pro", sans-serif'; g.fillText('XÓM TRỌ ⇄ ĐẠI HỌC', 150, 222);
});
const busFrontTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#1f8a4c'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1b2a3a'; g.fillRect(18, 60, w - 36, 110);
  g.fillStyle = '#111'; g.fillRect(30, 12, w - 60, 40);
  g.fillStyle = '#ffb000'; g.font = '900 32px "Be Vietnam Pro", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${BUS_TOUR} · ĐẠI HỌC`, w / 2, 33);
});
const bus = { group: new THREE.Group(), state: 'idle', x: -60, wait: 0, unload: [], nextIdleTrip: performance.now() + 50000 };
{
  const g = bus.group;
  const sideM = new THREE.MeshStandardMaterial({ map: busSideTex, emissive: '#ffffff', emissiveMap: busSideTex, emissiveIntensity: 0.18, roughness: 0.5 });
  const frontM = new THREE.MeshStandardMaterial({ map: busFrontTex, roughness: 0.4 });
  const plainM = M({ color: '#1f8a4c', roughness: 0.5 }), topM = M({ color: '#e8e8e8' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(BUS_LEN, 2.5, 2.3), [frontM, plainM, topM, plainM, sideM, sideM]);
  body.position.y = 1.55; g.add(body);
  [-3.1, 3.1].forEach((x) => [-1.16, 1.16].forEach((z) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 18), M({ color: '#111' })); w.rotation.x = Math.PI / 2; w.position.set(x, 0.45, z); g.add(w);
  }));
  const hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff3c4', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  hl.position.set(BUS_LEN / 2 + 0.1, 0.8, 0.8); hl.scale.setScalar(2.6); g.add(hl);
  const hl2 = hl.clone(); hl2.material = hl.material; hl2.position.z = -0.8; g.add(hl2);
  const tl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff3030', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  tl.position.set(-BUS_LEN / 2 - 0.05, 0.9, 0.9); tl.scale.setScalar(1.1); g.add(tl);
  bus.brake = tl;
  blob(g, BUS_LEN * 1.05, 3.0, -0.17);
  g.scale.setScalar(0.82); g.position.set(bus.x, 0.2, BUS_Z); g.visible = false; scene.add(g);
}

// ---- người đi bộ (xuống xe vào cổng, hoặc ra bến chờ xe) ----
const walkers = [];
function makeWalker(name, from, path, onDone, look) {
  const p = makePerson(look ? { ...look } : undefined);
  p.group.position.copy(from); scene.add(p.group);
  const el = document.createElement('div'); el.className = 'plate small walker'; el.textContent = name; labelsEl.appendChild(el);
  const w = { p, el, path: path.map((v) => v.clone()), onDone, speed: rand(2.2, 2.8), waiting: false, fade: 0 };
  walkers.push(w); return w;
}
function removeWalker(w) {
  scene.remove(w.p.group); w.el.remove();
  const i = walkers.indexOf(w); if (i >= 0) walkers.splice(i, 1);
}
function updateWalkers(dt, now) {
  const v = new THREE.Vector3();
  for (const w of walkers.slice()) {
    const g = w.p.group;
    if (w.path.length) {
      const target = w.path[0];
      v.subVectors(target, g.position); v.y = 0;
      const d = v.length();
      if (d < 0.08) { w.path.shift(); if (!w.path.length && w.onDone) w.onDone(w); }
      else {
        v.normalize();
        g.position.addScaledVector(v, Math.min(d, w.speed * dt));
        g.rotation.y = Math.atan2(v.x, v.z);
        const sw = Math.sin(now / 110) * 0.6;
        w.p.legs[0].rotation.x = sw; w.p.legs[1].rotation.x = -sw;
        w.p.arms[0].rotation.x = -sw * 0.8; w.p.arms[1].rotation.x = sw * 0.8;
      }
    } else {
      w.p.legs.forEach((l) => (l.rotation.x = 0)); w.p.arms.forEach((a) => (a.rotation.x = 0));
      if (w.face != null) g.rotation.y = w.face; // đứng mua hàng, quay vào quầy
      else if (w.waiting) g.rotation.y = Math.PI * 0.05; // đứng chờ, nhìn ra đường
    }
    if (w.fade) { // đi vào cổng / lên xe: nhỏ dần rồi biến mất
      w.fade -= dt;
      g.scale.setScalar(PERSON_SIZE * Math.max(0.01, w.fade / 0.5));
      if (w.fade <= 0) { removeWalker(w); continue; }
    }
    g.getWorldPosition(v); v.y += 2.05;
    const sc = toScreen(v); w.el.style.left = `${sc.x}px`; w.el.style.top = `${sc.y}px`;
  }
}

// ---- xuống quán: người comment bánh mì / xôi / trà đá / vé số rời phòng, đi bộ ra quán rồi về phòng ----
// t.outing: 'go' đang đi ra quán · 'tea' đang ngồi trà đá · 'home' đang đi về. Lúc đi vắng, nhân vật trong phòng ẩn đi.
const MAX_WALKERS = 24;
function roomShow(t, on) { if (t.room.tenant === t && t.room.person) t.room.person.group.visible = on; }
function stallWalker(t, emoji, from, path, onDone) {
  const w = makeWalker(`${emoji} ${t.name}`, from, path, onDone, t.look); // giống hệt nhân vật trong phòng
  w.stall = true; // không bắt xe buýt chờ
  return w;
}
function walkHome(w, t, path) {
  t.outing = 'home'; w.face = null;
  w.path = [...path.map((v) => v.clone()), GATE.clone()];
  w.onDone = (wk) => {
    wk.fade = 0.5;
    setTimeout(() => { if (t.outing === 'home') { t.outing = null; roomShow(t, true); } }, 500);
  };
}
// đi từ cổng theo path tới điểm cuối, quay mặt về face, mua xong đứng stayMs rồi đi ngược đường về
function goOut(t, emoji, path, face, onArrive, stayMs = 3500) {
  if (t.outing || t.awayBy || walkers.length >= MAX_WALKERS) { onArrive(); return; } // awayBy: đang trong cảnh hoatcanh
  t.outing = 'go'; roomShow(t, false);
  stallWalker(t, emoji, GATE, path, (wk) => {
    wk.face = face;
    onArrive();
    setTimeout(() => walkHome(wk, t, path.slice(0, -1).reverse()), stayMs);
  });
}
// quán ở vỉa hè bên xóm (bánh mì, vé số): đi dọc vỉa hè tới quầy
function goToStall(t, emoji, spot, onArrive, stayMs) {
  const lane = [new THREE.Vector3(GATE.x, 0.2, SIDEWALK_Z), new THREE.Vector3(spot.x, 0.2, SIDEWALK_Z)];
  goOut(t, emoji, [...lane, spot], Math.PI, onArrive, stayMs);
}
// cửa hàng tầng trệt: vào sân, men theo hành lang tầng trệt tới trước cửa hàng
function shopPath(sh) {
  const L = (x, z) => sh.bg.localToWorld(new THREE.Vector3(x, 0, z)).setY(0.2);
  const walkZ = SHOP_FZ + 0.55, x = sh.x + rand(-0.8, 0.8);
  const path = [new THREE.Vector3(GATE.x, 0.2, -1.2)];
  if (sh.letter === 'B') { // vòng qua mép sân bóng
    const ax = Math.sign(sh.x) * (FIELD_L / 2 + 0.45);
    path.push(new THREE.Vector3(ax, 0.2, LAWN_Z0 - 0.2), new THREE.Vector3(ax, 0.2, YARD_Z0 + 0.35));
  } else { // vào đầu hồi phía cổng của tòa bên rồi đi dọc hành lang (sau sân bóng chuyền / bể bơi)
    const ends = [-1, 1].map((k) => L(k * (bwOf(SIDE_COLS) / 2 - 0.6), walkZ));
    path.push(ends[0].z > ends[1].z ? ends[0] : ends[1]);
  }
  path.push(L(x, walkZ), L(x, SHOP_FZ + 0.35));
  return path;
}
function goToShop(t, key) {
  const sh = SHOPS[key]; if (!sh) return;
  goOut(t, sh.def.emoji, shopPath(sh), sh.bg.rotation.y + Math.PI, () => visitShop(t, key), 4000);
}
// quán trà đá ở vỉa hè đối diện: qua vạch kẻ đường rồi vào ghế
const teaPath = () => {
  const gp = traDa.group.position, cx = 1.2;
  return [new THREE.Vector3(cx, 0.2, SIDEWALK_Z), new THREE.Vector3(cx, 0.2, front.z0 + 0.6), new THREE.Vector3(gp.x + 2.0, 0.2, gp.z + 0.3)];
};
function goToTea(t, hut) {
  const seated = traDa.seats.some((s) => s.who && s.who.t === t);
  if (seated || t.outing || t.awayBy || walkers.length >= MAX_WALKERS) { drinkTea(t, hut); return; }
  t.outing = 'go'; roomShow(t, false);
  stallWalker(t, '🍵', GATE, teaPath(), (wk) => { removeWalker(wk); t.outing = 'tea'; drinkTea(t, hut); });
}

// ---- hàng đợi ----
const arriving = [];          // người mới vào live, chờ xe chở tới
const waitingAtStop = [];     // người đang đứng ở bến chờ xe đón
const seenJoin = new Map();   // id → lần cuối xuống xe (không chở một người nhiều lần liên tiếp)
function onJoin(ev) {
  const id = ev.id || ev.name, now = performance.now();
  if (now - (seenJoin.get(id) || -1e9) < 10 * 60000) return;
  if (arriving.some((a) => a.id === id)) return;
  seenJoin.set(id, now);
  arriving.push({ id, name: cleanName(ev.name) });
  if (arriving.length > 30) arriving.shift();
}
// người rời xóm: đi từ cổng ra bến đứng chờ
function sendToBusStop(name) {
  const slot = waitingAtStop.length;
  const spot = new THREE.Vector3(STOP_X - 1.6 + (slot % 4) * 0.55, 0.2, SIDEWALK_Z - 0.35 - Math.floor(slot / 4) * 0.4);
  const w = makeWalker(`🧳 ${name}`, GATE, [new THREE.Vector3(1.4, 0.2, SIDEWALK_Z), new THREE.Vector3(spot.x, 0.2, SIDEWALK_Z), spot], (wk) => { wk.waiting = true; });
  waitingAtStop.push(w);
}
function busAnnounce(names) {
  if (!names.length) return;
  const list = names.slice(0, 3).join(', ') + (names.length > 3 ? ` và ${names.length - 3} bạn nữa` : '');
  speak(pick([`Xe buýt ${BUS_TOUR} về đến xóm rồi! Chào ${list} xuống xe nhé!`, `Ơ, ${list} vừa xuống xe buýt kìa. Vào xóm chơi đi!`]));
}
function updateBus(dt, now) {
  const g = bus.group;
  if (bus.state === 'idle') {
    const due = (arriving.length || waitingAtStop.some((w) => w.waiting) || now > bus.nextIdleTrip) && !hc?.busLaneBusy();
    if (due) { bus.state = 'arriving'; bus.x = -60; g.visible = true; bus.passengers = arriving.splice(0, 6); sfx.honk(); }
  } else if (bus.state === 'arriving') {
    const d = STOP_X - bus.x;
    bus.x = Math.min(STOP_X, bus.x + Math.max(1.2, Math.min(16, d * 1.4)) * dt);
    bus.brake.scale.setScalar(d < 10 ? 1.6 : 1.1);
    if (d < 0.05) {
      bus.x = STOP_X; bus.state = 'stopped'; bus.wait = 0; bus.unloadT = 0; bus.boarded = []; sfx.hiss(); sfx.knock();
      // có người lên xuống thì máy quay lia lại gần bến xe
      if (bus.passengers.length || waitingAtStop.length) focusAt(new THREE.Vector3(STOP_X * 0.45, 4.2, 18), new THREE.Vector3(STOP_X - 2.2, 1.6, 3.5), 5500);
    }
  } else if (bus.state === 'stopped') {
    bus.wait += dt; bus.unloadT -= dt;
    // người mới xuống xe, đi vào cổng
    if (bus.passengers.length && bus.unloadT <= 0) {
      const p = bus.passengers.shift(); bus.unloadT = 0.55;
      const door = new THREE.Vector3(STOP_X - 2.7 + rand(-0.2, 0.2), 0.2, BUS_Z - 1.2);
      makeWalker(`👋 ${p.name}`, door, [new THREE.Vector3(door.x, 0.2, SIDEWALK_Z), new THREE.Vector3(1.4, 0.2, SIDEWALK_Z), GATE], (wk) => { wk.fade = 0.5; });
      (bus.dropped = bus.dropped || []).push(p.name);
    }
    // người chờ ở bến lên xe
    for (const w of waitingAtStop.slice()) {
      if (!w.waiting) continue;
      w.waiting = false; w.path = [new THREE.Vector3(STOP_X - 2.7, 0.2, BUS_Z - 1.15)];
      w.onDone = (wk) => { wk.fade = 0.5; };
      waitingAtStop.splice(waitingAtStop.indexOf(w), 1);
      bus.boarded.push(w.el.textContent.replace('🧳 ', ''));
    }
    const busyWalking = walkers.some((w) => !w.stall && w.path.length && w.path[w.path.length - 1].z > SIDEWALK_Z + 0.5);
    if (bus.wait > 3.5 && !bus.passengers.length && !busyWalking) {
      bus.state = 'leaving'; bus.speed = 0;
      if (bus.dropped && bus.dropped.length) busAnnounce(bus.dropped);
      if (bus.boarded.length) {
        const n = bus.boarded.slice(0, 3).join(', ');
        toast(`🚌 ${n}${bus.boarded.length > 3 ? '…' : ''} đã lên xe rời xóm`);
        speak(`Tạm biệt ${n}, nhớ quay lại xóm chơi nhé!`);
      }
      bus.dropped = [];
      sfx.honk();
    }
  } else if (bus.state === 'leaving') {
    bus.speed = Math.min(14, bus.speed + 6 * dt);
    bus.x += bus.speed * dt;
    bus.brake.scale.setScalar(1.1);
    if (bus.x > 60) { bus.state = 'idle'; g.visible = false; bus.nextIdleTrip = now + rand(70000, 110000); }
  }
  g.position.x = bus.x;
  g.position.y = 0.2 + (bus.state === 'stopped' ? 0 : Math.abs(Math.sin(now / 160)) * 0.025);
  // tiếng máy xe buýt: chạy thì gầm, đỗ bến thì nổ không tải, đi rồi thì tắt
  if (bus.state === 'idle') { if (bus.snd) { bus.snd.stop(); bus.snd = null; } return; }
  if (!bus.snd) bus.snd = sfx.engine(52, 0.12);
  if (bus.snd) {
    const near = 1 / (1 + (bus.x / 14) ** 2);
    if (bus.state === 'stopped') bus.snd.set(near * 0.55, 0.75);
    else if (bus.state === 'leaving') bus.snd.set(near, 0.8 + bus.speed / 28);
    else bus.snd.set(near, 0.85 + Math.min(0.25, (STOP_X - bus.x) / 120));
  }
}
// người im lặng quá lâu (coi như đã thoát live) dọn đồ ra bến chờ xe
const LEAVE_MS = (Number(params.get('roi')) || CFG.phutRoiXom || 8) * 60000;
setInterval(() => {
  const now = performance.now();
  for (const t of [...tenants.values()]) {
    if (t.vip || now - t.last < LEAVE_MS) continue;
    const r = t.room;
    tenants.delete(t.id);
    removePerson(r);
    sendToBusStop(t.name);
    updateCounts();
  }
}, 5000);

// =====================================================================
//  Hạt hiệu ứng (khói mì, pháo hoa, trà sữa)
// =====================================================================
const sprites = [];
function spawnSprite(tex, pos, { vel = new THREE.Vector3(), life = 2, size = 0.6, grow = 0.5, color = '#ffffff', additive = false, gravity = 0, opacity = 1 } = {}) {
  if (sprites.length > 380) return;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  s.position.copy(pos); s.scale.setScalar(size); scene.add(s);
  sprites.push({ s, vel, life, max: life, size, grow, gravity, opacity });
}
function updateSprites(dt) {
  for (let i = sprites.length - 1; i >= 0; i--) {
    const p = sprites[i];
    p.life -= dt;
    if (p.life <= 0) { scene.remove(p.s); p.s.material.dispose(); sprites.splice(i, 1); continue; }
    p.vel.y -= p.gravity * dt;
    p.s.position.addScaledVector(p.vel, dt);
    const k = p.life / p.max;
    p.s.material.opacity = p.opacity * Math.min(1, k * 1.6);
    p.s.scale.setScalar(p.size + (1 - k) * p.grow);
  }
}
const noodleTex = emojiTex('🍜'), teaTex = emojiTex('🧋'), heartTex = emojiTex('❤️'), coinTex = emojiTex('💡');
function steam(room, n = 3) {
  const wp = new THREE.Vector3(); room.glass.getWorldPosition(wp);
  for (let i = 0; i < n; i++) spawnSprite(steamTex, wp.clone().add(new THREE.Vector3(rand(-0.4, 0.4), 0.6, 0.4)), { vel: new THREE.Vector3(rand(-0.15, 0.15), rand(0.7, 1.1), 0.1), life: rand(1.6, 2.4), size: 0.45, grow: 1.1, opacity: 0.55 });
  if (Math.random() < 0.35) spawnSprite(noodleTex, wp.clone().add(new THREE.Vector3(0, 0.3, 0.6)), { vel: new THREE.Vector3(0, 0.9, 0), life: 1.4, size: 0.7, grow: 0.1 });
}
function firework(at = null, spread = 1) { // at: tâm nổ (mặc định trên nóc xóm); spread < 1 cho chùm nhỏ hơn khi nổ gần camera
  const c = at ? at.clone() : new THREE.Vector3(rand(-9, 9), rand(19, 25), rand(-6, 0));
  const col = pick(['#ffd166', '#ff6b6b', '#4cc9f0', '#c77dff', '#80ff72']);
  for (let i = 0; i < 46; i++) {
    const a = rand(0, Math.PI * 2), e = rand(-1, 1), v = rand(3, 6) * spread;
    spawnSprite(glowTex, c.clone(), { vel: new THREE.Vector3(Math.cos(a) * Math.sqrt(1 - e * e) * v, e * v, Math.sin(a) * Math.sqrt(1 - e * e) * v * 0.4), life: rand(1.2, 1.9), size: 0.5, grow: -0.3, color: col, additive: true, gravity: 2.2 });
  }
  sfx.pop();
}

// mưa
const RAIN_N = 1400;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN_N * 6);
const rainDrops = [];
for (let i = 0; i < RAIN_N; i++) rainDrops.push({ x: rand(-20, 20), y: rand(-2, 30), z: rand(-4, 20), v: rand(22, 30) });
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#9fb6ff', transparent: true, opacity: 0.45 }));
rain.visible = false; scene.add(rain);
function updateRain(dt) {
  for (let i = 0; i < RAIN_N; i++) {
    const d = rainDrops[i];
    d.y -= d.v * dt; d.x -= 2 * dt;
    if (d.y < 0) { d.y = rand(26, 32); d.x = rand(-20, 22); }
    rainPos.set([d.x, d.y, d.z, d.x + 0.12, d.y + 0.9, d.z], i * 6);
  }
  rainGeo.attributes.position.needsUpdate = true;
}


// =====================================================================
//  Nền động: mây trôi, sao nhấp nháy, sao băng, máy bay, xe chạy ngoài đường
// =====================================================================
const cloudTex = canvasTex(256, 128, (g, w, h) => {
  for (let i = 0; i < 9; i++) {
    const x = rand(50, w - 50), y = rand(50, h - 35), r = rand(26, 52);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
});
const clouds = [];
for (let i = 0; i < 8; i++) {
  const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: '#8d93c7', transparent: true, opacity: rand(0.18, 0.32), depthWrite: false, fog: false }));
  c.position.set(rand(-60, 60), rand(TOP + 6, TOP + 24), rand(-70, -50)); c.scale.set(rand(22, 34), rand(9, 13), 1);
  scene.add(c); clouds.push({ s: c, v: rand(0.5, 1.2), op: c.material.opacity });
}

// =====================================================================
//  Ngày / đêm: cứ CFG.phutNgayDem phút (mặc định 2) lại đổi, chuyển dần ~15 giây (có ráng chiều/bình minh)
// =====================================================================
let dayK = params.get('ngay') === '1' ? 1 : 0; // 0 = đêm, 1 = ngày
let dayS = dayK; // dayK đã làm mượt
let dayTarget = dayK, nextDaySwitch = performance.now() + (CFG.phutNgayDem || 2) * 60000;
const DN = {
  skyTop: [new THREE.Color('#060a24'), new THREE.Color('#3f8fe0')],
  skyBot: [new THREE.Color('#3b2a58'), new THREE.Color('#cfe6ff')],
  dusk: new THREE.Color('#ff8a4c'),
  bg: [new THREE.Color('#0b1030'), new THREE.Color('#8cc2f0')],
  bgDark: new THREE.Color('#03040c'),
  fog: [new THREE.Color('#0b1030'), new THREE.Color('#a9cdee')],
  fogRain: [new THREE.Color('#1a2140'), new THREE.Color('#7f8b9c')],
  amb: [new THREE.Color('#7d8cc4'), new THREE.Color('#ffffff')],
  hemiSky: [new THREE.Color('#4a5aa8'), new THREE.Color('#bfe0ff')],
  hemiGround: [new THREE.Color('#2a1c12'), new THREE.Color('#6b5a40')],
  sunCol: [new THREE.Color('#a9b8ff'), new THREE.Color('#fff1d6')],
  cloud: [new THREE.Color('#8d93c7'), new THREE.Color('#ffffff')],
};
const _c = new THREE.Color();
const mixC = (out, pair, s) => out.copy(pair[0]).lerp(pair[1], s);
function setDay(day, say = true) {
  if (dayTarget === (day ? 1 : 0)) return;
  dayTarget = day ? 1 : 0;
  nextDaySwitch = performance.now() + (CFG.phutNgayDem || 2) * 60000;
  if (!say || !tenants.size) return;
  speak(day
    ? pick(['Trời sáng rồi cả xóm ơi! Dậy đánh răng rửa mặt rồi đi học thôi!', `Sáng rồi! Ai dậy rồi thì comment chào buổi sáng ${XH} cái nào!`, 'Gà gáy rồi đấy, dậy đi các cháu, muộn học bây giờ!'])
    : pick(['Trời tối rồi, cả xóm về phòng nghỉ ngơi nhé!', `Tối rồi, ai đói thì comment bánh mì, ${XH} gọi cô bán hàng cho.`, 'Đêm rồi, học bài thì học, đừng thức khuya quá nhé!']));
}
function updateDayNight(dt, now) {
  if (now > nextDaySwitch) setDay(!dayTarget);
  const T = 15; // giây chuyển
  dayK += clamp(dayTarget - dayK, -dt / T, dt / T);
  dayS = dayK * dayK * (3 - 2 * dayK);
  const s = dayS, dusk = Math.sin(Math.PI * dayK) * 0.85; // ráng đỏ giữa lúc chuyển
  const u = sky.material.uniforms;
  mixC(u.top.value, DN.skyTop, s);
  mixC(u.bottom.value, DN.skyBot, s).lerp(DN.dusk, dusk);
  if (power) mixC(scene.background, DN.bg, s); else scene.background.copy(DN.bgDark).lerp(DN.bg[1], s);
  mixC(scene.fog.color, rain.visible ? DN.fogRain : DN.fog, s).lerp(DN.dusk, dusk * 0.35);
  const wet = rain.visible ? 0.65 : 1; // mưa thì trời u ám hơn
  mixC(ambient.color, DN.amb, s); ambient.intensity = 0.55 + 0.45 * s * wet;
  mixC(hemi.color, DN.hemiSky, s); mixC(hemi.groundColor, DN.hemiGround, s); hemi.intensity = 0.7 + 0.5 * s * wet;
  mixC(moon.color, DN.sunCol, s).lerp(DN.dusk, dusk * 0.6); moon.intensity = 0.9 + 1.4 * s * wet;
  moon.position.set(-12 + 30 * s, 30, 18);
  starMat.opacity = 1 - s;
  moonS.material.opacity = moonD.material.opacity = 1 - s;
  // mặt trời mọc từ chân trời lên
  const sunY = TOP - 6 + 20 * s;
  sunS.position.set(18, sunY, -40); sunD.position.set(18, sunY, -39.9);
  sunS.material.opacity = sunD.material.opacity = s * wet;
  sunS.material.color.copy(DN.dusk).lerp(_c.set('#fff1b0'), s);
  clouds.forEach((c) => { mixC(c.s.material.color, DN.cloud, s); c.s.material.opacity = c.op * (1 + 1.4 * s); });
  // đèn đường tắt ban ngày
  const lampK = power ? 1 - s : 0;
  streetLamp.intensity = 60 * lampK; streetGlow.material.opacity = lampK;
}
// sao nhấp nháy (lớp thứ hai, sáng tối theo nhịp)
const twinkleMats = [];
for (let k = 0; k < 3; k++) {
  const geo = new THREE.BufferGeometry(), pts = [];
  for (let i = 0; i < 70; i++) { const a = rand(-1.1, 1.1), e = rand(0.2, 1.1); pts.push(Math.sin(a) * 100, Math.sin(e) * 100, -Math.cos(a) * 100); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const m = new THREE.PointsMaterial({ color: '#fff7d6', size: 0.7, transparent: true, fog: false });
  scene.add(new THREE.Points(geo, m)); twinkleMats.push(m);
}
// máy bay đêm: đèn đỏ trắng nhấp nháy bay ngang trời
const plane = new THREE.Group(); plane.visible = false; scene.add(plane);
const planeRed = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff4040', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
const planeWhite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
planeRed.scale.setScalar(1.6); planeWhite.scale.setScalar(1.3); planeWhite.position.x = -0.9; plane.add(planeRed, planeWhite);
let planeUntil = 0, nextPlane = performance.now() + 20000;
// sao băng
let nextShoot = performance.now() + 8000, shoot = null;
// xe máy chạy ngoài đường
const traffic = [];
let nextCar = performance.now() + 1500;
function spawnRider() {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const z = dir > 0 ? 9.0 : 11.4; // làn sát vỉa hè dành cho xe buýt
  const g = scooter(0, 0, pick(['#c0392b', '#2c3e50', '#ecf0f1', '#f39c12', '#16a085', '#8e44ad']), dir > 0 ? 0 : Math.PI);
  const rider = makePerson({ shadow: false });
  rider.legs.forEach((l) => { l.rotation.x = -1.3; l.position.z = 0.25; l.position.y = 0.35; });
  rider.arms.forEach((a) => { a.rotation.x = -1.2; });
  rider.group.position.set(-0.15, 0.55, 0); rider.group.rotation.y = Math.PI / 2; g.add(rider.group);
  // mũ bảo hiểm
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M({ color: pick(['#e63946', '#ffffff', '#ffd166', '#118ab2']), roughness: 0.4 }));
  helmet.position.y = 0.06; rider.headG.add(helmet); rider.hairTop.visible = false;
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff4c2', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  head.position.set(0.9, 1.0, 0); head.scale.setScalar(2.2); g.add(head);
  const tail = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff3030', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  tail.position.set(-0.85, 0.75, 0); tail.scale.setScalar(0.9); g.add(tail);
  g.position.set(dir > 0 ? -38 : 38, 0.2, z);
  traffic.push({ g, dir, v: rand(7, 11), honked: false, snd: sfx.engine(rand(85, 125), 0.07) });
}
function updateBackground(dt, now) {
  const t = now / 1000;
  clouds.forEach((c) => { c.s.position.x += c.v * dt; if (c.s.position.x > 70) c.s.position.x = -70; });
  twinkleMats.forEach((m, k) => (m.opacity = (0.25 + 0.75 * Math.max(0, Math.sin(t * (1.3 + k * 0.7) + k * 2))) * (1 - dayS)));
  // cửa sổ nhà hàng xóm thỉnh thoảng bật tắt đèn
  if (Math.random() < dt * 0.6 && neighborWins.length) {
    const w = pick(neighborWins);
    w.material.color.set(w.material.color.getHex() === 0x151a2e ? pick(['#ffcf7a', '#bfe3ff', '#ffe0b0']) : '#151a2e');
  }
  // máy bay (chỉ ban đêm mới thấy đèn nháy)
  if (!plane.visible && now > nextPlane && dayK < 0.3) { plane.visible = true; plane.position.set(-70, TOP + rand(16, 22), -60); planeUntil = now; }
  if (plane.visible) {
    plane.position.x += 4.5 * dt;
    const blink = Math.floor(t * 2) % 2 === 0;
    planeRed.material.opacity = blink ? 1 : 0.15; planeWhite.material.opacity = blink ? 0.2 : 1;
    if (plane.position.x > 70) { plane.visible = false; nextPlane = now + rand(50000, 90000); }
  }
  // sao băng
  if (!shoot && now > nextShoot && dayK < 0.2) shoot = { p: new THREE.Vector3(rand(-10, 40), TOP + rand(16, 26), -60), v: new THREE.Vector3(-rand(38, 48), -rand(14, 20), 0), life: 1.1 };
  if (shoot) {
    shoot.life -= dt; shoot.p.addScaledVector(shoot.v, dt);
    spawnSprite(glowTex, shoot.p.clone(), { life: 0.45, size: 1.1, grow: -0.8, color: '#e6f0ff', additive: true });
    if (shoot.life <= 0) { shoot = null; nextShoot = now + rand(12000, 26000); }
  }
  // xe chạy
  if (now > nextCar && traffic.length < 4) { spawnRider(); nextCar = now + rand(2500, 7000); }
  for (let i = traffic.length - 1; i >= 0; i--) {
    const c = traffic[i];
    c.g.position.x += c.dir * c.v * dt;
    c.g.position.y = 0.2 + Math.abs(Math.sin(now / 90 + i)) * 0.02;
    if (!c.honked && Math.abs(c.g.position.x) < 4 && Math.random() < 0.3) { c.honked = true; sfx.honk(); }
    // gần giữa màn hình thì to, xe lại gần thì tiếng cao hơn, đi xa thì trầm xuống
    if (c.snd) { const x = c.g.position.x; c.snd.set(1 / (1 + (x / 9) ** 2), 1 - 0.07 * Math.tanh((x * c.dir) / 6)); }
    if (Math.abs(c.g.position.x) > 40) { scene.remove(c.g); if (c.snd) c.snd.stop(); traffic.splice(i, 1); }
  }
}

// =====================================================================
//  Lớp chữ HTML (biển phòng, bong bóng)
// =====================================================================
const labelsEl = document.getElementById('labels');
const tmpV = new THREE.Vector3();
function toScreen(v) {
  tmpV.copy(v).project(camera);
  return { x: (tmpV.x + 1) / 2 * W, y: (1 - tmpV.y) / 2 * H, on: tmpV.z < 1 };
}
rooms.forEach((r) => {
  r.plateEl = document.createElement('div'); r.plateEl.className = 'plate empty'; labelsEl.appendChild(r.plateEl);
  r.bubbleEl = null;
});
const llBubble = document.getElementById('landlady');

// chỉ ghi lại vị trí chữ khi nó thật sự dời (máy quay gần như đứng yên → đỡ hàng trăm lần ghi style mỗi khung hình)
function placeEl(el, x, y) {
  x = Math.round(x * 2) / 2; y = Math.round(y * 2) / 2;
  if (el._x === x && el._y === y) return;
  el._x = x; el._y = y; el.style.left = `${x}px`; el.style.top = `${y}px`;
}
const _lv = new THREE.Vector3();
function placeLabels() {
  for (const r of rooms) {
    if (r.tenant) { const s = toScreen(roomPt(r, -0.85, 0.86, CORR, _lv)); placeEl(r.plateEl, s.x, s.y); } // biển tên treo trên lan can của chính phòng đó
    if (r.bubbleEl && r.tenant) {
      const b = toScreen(roomPt(r, 0.05, 2.75, 1.0, _lv));
      placeEl(r.bubbleEl, clamp(b.x, 170, W - 170), b.y); // không để bong bóng tràn mép
    }
  }
}
function floatEmoji(room, ch) {
  const v = roomPt(room, 0.05, 2.3, 1.0);
  const s = toScreen(v);
  const el = document.createElement('div'); el.className = 'float'; el.textContent = ch;
  el.style.left = `${s.x}px`; el.style.top = `${s.y}px`;
  labelsEl.appendChild(el); setTimeout(() => el.remove(), 2300);
}

// =====================================================================
//  Người thuê & phòng
// =====================================================================
const tenants = new Map(); // id → tenant
let noodles = 0, totalLikes = 0;

function renderPlate(r) {
  const el = r.plateEl;
  // không hiện số phòng; phòng trống không có biển, phòng có người chỉ ghi tên
  if (!r.tenant) { el.className = 'plate empty'; el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = '';
  el.className = 'plate' + (r.tenant.vip ? ' vip' : '');
  el.innerHTML = `${esc(r.tenant.name)}${r.tenant.vip ? ' 👑' : ''}`;
}
rooms.forEach(renderPlate);
updateCounts(); // tổng số phòng theo config ngay từ đầu (HTML ghi sẵn 25)
if (ROOMS_PER_FLOOR >= 6) document.body.classList.add('compact'); // nhiều phòng mỗi tầng: biển tên nhỏ lại cho khỏi đè nhau

function setRoomLight(r, on) {
  const k = on && power && !(r.tenant && r.tenant.sleeping) ? 1 : 0; // phòng đang ngủ thì tắt đèn
  r.glass.material.emissiveIntensity = 1.6 * k;
  r.glow.material.opacity = 0.55 * k;
  const i = lightOf(r.floor);
  const lit = rooms.filter((x) => lightOf(x.floor) === i && x.glass.material.emissiveIntensity > 0).length;
  floorLights[i].intensity = power ? 6 + Math.min(lit, 20) * 3.5 : 0; // 1 đèn cho 2 tầng: mỗi phòng sáng cộng ít hơn trước
}

const pendingWelcome = [], pendingBack = [];
// ---------- Người thuê cũ: lưu qua các buổi live (server ghi du-lieu-xom.json) ----------
let SAVED = {};
try { SAVED = await (await fetch('/api/du-lieu')).json() || {}; } catch (_) {}
const known = new Map(Object.entries(SAVED.tenants || {}));
let xomPoints = Number(SAVED.xom?.points) || 0, saveDirty = false;
function remember(t) {
  known.set(t.id, { name: t.name, look: t.look, vip: t.vip, lights: t.lights, decor: t.decor, room: t.room.number,
    total: (t.total || 0) + (t.coins || 0) - (t.savedCoins || 0), visits: t.visits || 1, seen: Date.now() });
  t.total = (t.total || 0) + (t.coins || 0) - (t.savedCoins || 0); t.savedCoins = t.coins || 0;
  saveDirty = true;
}
function addPoints(n) { xomPoints += n; saveDirty = true; checkLevel(); }
function saveNow(beacon = false) {
  tenants.forEach(remember);
  const list = [...known.entries()].sort((x, y) => (y[1].seen || 0) - (x[1].seen || 0)).slice(0, 3000);
  let wk = null; try { wk = week; } catch (_) {}
  const body = JSON.stringify({ tenants: Object.fromEntries(list), xom: { points: xomPoints }, week: wk });
  saveDirty = false;
  if (beacon) navigator.sendBeacon?.('/api/du-lieu', new Blob([body], { type: 'application/json' }));
  else fetch('/api/du-lieu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
}
setInterval(() => { if (saveDirty || tenants.size) saveNow(); }, 30000);
addEventListener('beforeunload', () => saveNow(true));
setInterval(() => { // chào người thuê cũ quay lại xóm
  if (!pendingBack.length || voice.q.length > 2) return;
  const b = pendingBack.splice(0, 3).filter((t) => tenants.get(t.id) === t);
  if (b.length) speak(`Ồ, ${b.map((t) => t.name).join(', ')} về xóm rồi! Phòng cũ vẫn để dành cho đấy!`);
}, 8000);
function getTenant(ev, create = true) {
  const id = ev.id || ev.name;
  let t = tenants.get(id);
  if (t) { t.name = cleanName(ev.name) || t.name; t.last = performance.now(); return t; }
  if (!create) return null;
  const rec = known.get(id); // người thuê cũ của các buổi live trước
  let free = rooms.filter((r) => !r.tenant);
  let r;
  if (free.length) r = (rec && free.find((x) => x.number === rec.room)) || pick(free);
  else {
    // xóm đầy: người im lặng lâu nhất (không phải phòng VIP) chuyển trọ
    const cand = rooms.filter((x) => !x.tenant.vip).sort((a, b) => a.tenant.last - b.tenant.last);
    r = cand[0] || rooms.slice().sort((a, b) => a.tenant.last - b.tenant.last)[0];
    const old = r.tenant;
    tenants.delete(old.id);
    removePerson(r);
    sendToBusStop(old.name);
    toast(`📦 ${old.name} chuyển trọ, nhường phòng`);
  }
  t = { id, name: cleanName(ev.name), room: r, last: performance.now(), comments: 0, coins: 0, vip: !!rec?.vip, lights: !!rec?.lights, savedClothes: false,
    look: rec?.look || randomLook(), decor: { ...(rec?.decor || {}) }, total: rec?.total || 0, visits: (rec?.visits || 0) + 1, returning: !!rec,
    catches: 0, quiz: 0, lucky: 0, likes: 0 };
  tenants.set(id, t);
  r.tenant = t;
  const p = makePerson({ ...t.look });
  p.group.position.set(r.cx + 0.05, r.base + 0.02, 1.0);
  p.group.rotation.y = p.baseRotY = rand(-0.25, 0.25);
  p.enterT = 0;
  r.bg.add(p.group);
  r.person = p;
  r.clothes.visible = Math.random() < 0.55;
  r.fairy.visible = t.lights; r.vip.visible = t.vip;
  if (t.vip) { r.door.material.map = doorTex('#c9a227'); r.door.material.needsUpdate = true; r.doorPainted = true; }
  applyDecor(t);
  setRoomLight(r, true);
  renderPlate(r);
  (t.returning ? pendingBack : pendingWelcome).push(t);
  addPoints(5);
  sfx.knock();
  updateCounts();
  return t;
}
function removePerson(r) {
  if (r.tenant) remember(r.tenant);
  if (r.person) { r.bg.remove(r.person.group); r.person = null; }
  if (r.bubbleEl) { r.bubbleEl.remove(); r.bubbleEl = null; }
  r.decorG.clear(); r.fairy.visible = false; r.vip.visible = false;
  if (r.doorPainted) { r.door.material.map = doorTex(r.doorColor); r.door.material.needsUpdate = true; r.doorPainted = false; }
  r.tenant = null; setRoomLight(r, false); renderPlate(r);
}
function updateCounts() {
  document.getElementById('tenantCount').textContent = tenants.size;
  document.getElementById('roomTotal').textContent = rooms.length;
  document.getElementById('noodleCount').textContent = noodles.toLocaleString('vi-VN');
}

function say(r, text) {
  if (!r.tenant) return;
  if (r.bubbleEl) r.bubbleEl.remove();
  const el = document.createElement('div'); el.className = 'bubble';
  el.innerHTML = `<span class="who">${esc(r.tenant.name)}</span>${esc(text)}`;
  labelsEl.appendChild(el); r.bubbleEl = el;
  const mine = el;
  setTimeout(() => { if (r.bubbleEl === mine) { mine.remove(); r.bubbleEl = null; } }, 5500);
  if (r.person) r.person.talkUntil = performance.now() + 2200;
  placeLabels();
}

// =====================================================================
//  Giọng bà chủ trọ
// =====================================================================
const voice = { q: [], busy: false, lastEnd: performance.now() };
function speak(text, priority = false) {
  if (priority) voice.q.unshift(text); else voice.q.push(text);
  if (voice.q.length > 6) voice.q.splice(priority ? 6 : 5, voice.q.length);
  nextVoice();
}
function showLandlady(text) {
  llBubble.querySelector('.say').textContent = text;
  llBubble.classList.add('show');
  landlady.talkUntil = performance.now() + 3000;
}
function nextVoice() {
  if (voice.busy || !voice.q.length) return;
  const text = voice.q.shift();
  voice.busy = true;
  showLandlady(text);
  const done = () => {
    voice.busy = false; voice.lastEnd = performance.now();
    setTimeout(() => { if (!voice.busy) llBubble.classList.remove('show'); }, 1800);
    setTimeout(nextVoice, 400);
  };
  if (!CFG.docGiong) { setTimeout(done, 1500 + text.length * 55); return; }
  const a = new Audio(`/api/tts?rate=${CFG.tocDoDoc}&text=${encodeURIComponent(text)}`);
  a.volume = 1;
  sfx.duck(true);
  a.onended = () => { sfx.duck(false); done(); };
  a.onerror = () => { sfx.duck(false); setTimeout(done, 1500 + text.length * 50); };
  a.play().catch(() => { sfx.duck(false); setTimeout(done, 1500 + text.length * 50); });
  landlady.talkUntil = performance.now() + 60000;
}

// chào người mới, gộp 3 người một câu
setInterval(() => {
  if (!pendingWelcome.length || voice.q.length > 2) return;
  const batch = pendingWelcome.splice(0, 3).filter((t) => tenants.get(t.id) === t);
  if (!batch.length) return;
  const list = batch.map((t) => t.name);
  const joined = list.length > 1 ? `${list.slice(0, -1).join(', ')} với ${list[list.length - 1]}` : list[0];
  speak(pick([`Ơ, xóm có người mới. Chào ${joined}, vào ở cho vui nhé!`, `Chào ${joined}. Ở xóm này nhớ giữ trật tự đấy nhé!`, `Phòng mới có người rồi. Chào ${joined}!`]));
}, 7000);

// =====================================================================
//  Âm thanh hiệu ứng (tổng hợp)
// =====================================================================
const sfx = (() => {
  let ac = null, master = null, rainNode = null, musicBus = null, musicOn = false, ducked = false;
  const ensure = () => {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = CFG.amLuong; master.connect(ac.destination);
      musicBus = ac.createGain(); musicBus.gain.value = CFG.amLuongNhac; musicBus.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac.state === 'running' ? ac : null;
  };
  const ready = () => (CFG.amThanh ? ensure() : null);
  const tone = (f, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) => {
    const a = ready(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  };
  const noiseBuf = (a, dur) => { const b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
  const noise = (dur, vol, freq, delay = 0) => {
    const a = ready(); if (!a) return;
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + delay;
    s.buffer = noiseBuf(a, dur); f.type = 'bandpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  };
  // ---------- Nhạc nền: file nhac/nhac-nen.mp3 nếu có, không thì tự chơi nhạc lofi ----------
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function lofi(a) {
    const bpm = 74, step = 60 / bpm / 4; // nốt móc kép
    const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]; // Fmaj7 Em7 Dm7 Cmaj7
    const scale = [72, 74, 76, 79, 81, 84];
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(musicBus);
    const note = (m, t, dur, vol, type = 'sine') => {
      const o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = mtof(m); o2.type = 'triangle'; o2.frequency.value = mtof(m) * 2.002;
      const g2 = a.createGain(); g2.gain.value = 0.18;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    };
    const drum = (t, kind, vol) => {
      if (kind === 'kick') {
        const o = a.createOscillator(), g = a.createGain();
        o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.32); return;
      }
      const sN = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      sN.buffer = noiseBuf(a, kind === 'snare' ? 0.18 : 0.05);
      f.type = kind === 'snare' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 'snare' ? 1700 : 7000;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'snare' ? 0.17 : 0.045));
      sN.connect(f); f.connect(g); g.connect(musicBus); sN.start(t);
    };
    let i = 0, next = a.currentTime + 0.2;
    lofiTimer = setInterval(() => {
      while (next < a.currentTime + 0.3) {
        const s16 = i % 16, bar = Math.floor(i / 16), ch = chords[bar % 4];
        const swing = s16 % 2 ? step * 0.18 : 0, t = next + swing;
        if (s16 === 0) { ch.forEach((m, k) => note(m, t + k * 0.012, step * 15, 0.07)); note(ch[0] - 12, t, step * 9, 0.16); }
        if (s16 === 10) note(ch[0] - 12, t, step * 5, 0.12);
        if (s16 === 0 || s16 === 7 || s16 === 10) drum(t, 'kick', 0.5);
        if (s16 === 4 || s16 === 12) drum(t, 'snare', 0.16);
        if (s16 % 2 === 0) drum(t, 'hat', 0.035 + Math.random() * 0.025);
        if (s16 % 2 === 0 && Math.random() < 0.22) note(pick(scale), t, step * 3, 0.05);
        if (Math.random() < 0.25) drum(t + Math.random() * step, 'hat', 0.008); // tiếng rè đĩa than
        next += step; i++;
      }
    }, 60);
  }
  let lofiTimer = null, musicEl = null, musicFile = null;
  function stopMusic() {
    if (lofiTimer) { clearInterval(lofiTimer); lofiTimer = null; }
    if (musicEl) { musicEl.pause(); musicEl.removeAttribute('src'); musicEl.load(); musicEl = null; }
    musicOn = false;
  }
  function startMusic() {
    if (musicOn || !CFG.nhacNen) return;
    const a = ensure(); if (!a) return;
    musicOn = true;
    musicFile = CFG.fileNhac || 'nhac-nen.mp3';
    const url = `nhac/${encodeURIComponent(musicFile)}`;
    fetch(url, { method: 'HEAD' }).then((r) => {
      if (!r.ok) return lofi(a);
      const el = new Audio(url); el.loop = true; musicEl = el;
      a.createMediaElementSource(el).connect(musicBus);
      el.play().catch(() => lofi(a));
    }).catch(() => lofi(a));
  }
  // trang quản trị đổi file nhạc thì chuyển bài ngay, không cần tải lại màn hình
  function changeMusic() {
    if (musicOn && (CFG.fileNhac || 'nhac-nen.mp3') !== musicFile) { stopMusic(); startMusic(); }
  }
  return {
    unlock: () => { const r = ensure(); startMusic(); return r; },
    tone, noise,
    // tiếng gió/ồn liên tục: trả về { a, f, stop } để chỉnh tần số lọc
    loop: (freq, vol) => {
      const a = ready(); if (!a) return null;
      const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      s.buffer = noiseBuf(a, 2); s.loop = true; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.7;
      g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.exponentialRampToValueAtTime(vol, a.currentTime + 1);
      s.connect(f); f.connect(g); g.connect(master); s.start();
      return { a, f, stop: () => { g.gain.setTargetAtTime(0.0001, a.currentTime, 0.4); setTimeout(() => s.stop(), 1600); } };
    },
    startMusic, changeMusic,
    honk: () => { tone(440, 0.12, 'square', 0.07); tone(440, 0.16, 'square', 0.07, 0, 0.18); },
    knock: () => { noise(0.07, 0.5, 600); noise(0.07, 0.5, 600, 0.16); },
    coin: () => { tone(1320, 0.12, 'square', 0.12); tone(1760, 0.25, 'square', 0.12, 0, 0.09); },
    big: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.22, 0, i * 0.1)); },
    pop: () => noise(0.25, 0.4, 1800),
    off: () => { tone(220, 0.8, 'sawtooth', 0.15, 0.3); noise(0.3, 0.3, 300); },
    on: () => { tone(300, 0.5, 'sine', 0.2, 2.5); tone(600, 0.4, 'sine', 0.15, 2, 0.15); },
    slurp: () => noise(0.18, 0.12, 2400),
    // hát karaoke: vài nốt ngẫu nhiên
    sing: () => { const b = pick([67, 69, 72]); [0, 2, 4, 7, 4, 2].slice(0, 3 + Math.floor(Math.random() * 3)).forEach((d, i) => tone(mtof(b + d), 0.24, 'triangle', 0.07, 0, i * 0.22)); },
    // cụng ly
    clink: () => { tone(2300, 0.18, 'sine', 0.1); tone(3100, 0.22, 'sine', 0.06, 0, 0.03); },
    // còi bắt trộm
    whistle: () => { for (let i = 0; i < 3; i++) tone(2600, 0.22, 'square', 0.05, 1.04, i * 0.3); },
    // chuông đố vui
    ding: () => { tone(880, 0.35, 'sine', 0.2); tone(660, 0.5, 'sine', 0.2, 0, 0.3); },
    // phanh hơi xe buýt
    hiss: () => noise(0.7, 0.18, 4200),
    // rít điếu cày: hút gió, nước sủi ùng ục, rồi thở khói ra
    dieuCay: () => {
      const a = ready(); if (!a) return;
      const air = (dur, peak, freq, delay) => {
        const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + delay;
        s.buffer = noiseBuf(a, dur); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(master); s.start(t);
      };
      air(1.4, 0.05, 1100, 0);
      let d = 0.12;
      for (let i = 0; i < 26; i++) { tone(rand(150, 360), 0.05, 'sine', rand(0.07, 0.15), 1.9, d); d += rand(0.03, 0.06); }
      air(1.1, 0.07, 500, d + 0.35);
    },
    // tiếng máy xe ngoài đường; trả về núm chỉnh to nhỏ / cao thấp theo vị trí xe
    engine: (base, vol) => {
      const a = CFG.tiengXe !== false ? ready() : null; if (!a) return null;
      const o = a.createOscillator(), sub = a.createOscillator(), subG = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
      const f = a.createBiquadFilter(), am = a.createGain(), g = a.createGain();
      o.type = 'sawtooth'; sub.type = 'square'; subG.gain.value = 0.5;
      f.type = 'lowpass'; f.frequency.value = base * 6; f.Q.value = 1.5;
      am.gain.value = 0.65; lg.gain.value = 0.35; lfo.connect(lg); lg.connect(am.gain); // tiếng nổ phành phạch
      g.gain.value = 0;
      o.connect(f); sub.connect(subG); subG.connect(f); f.connect(am); am.connect(g); g.connect(master);
      const setF = (p, t) => { o.frequency.setTargetAtTime(base * p, t, 0.1); sub.frequency.setTargetAtTime(base * p / 2, t, 0.1); lfo.frequency.setTargetAtTime(base * p / 5, t, 0.1); };
      setF(1, a.currentTime); [o, sub, lfo].forEach((x) => x.start());
      let dead = false;
      return {
        set(level, pitch = 1) {
          if (dead) return;
          const t = a.currentTime;
          g.gain.setTargetAtTime(CFG.tiengXe === false ? 0 : level * vol, t, 0.08); setF(pitch, t);
        },
        stop() {
          if (dead) return; dead = true;
          g.gain.setTargetAtTime(0, a.currentTime, 0.1);
          setTimeout(() => [o, sub, lfo].forEach((x) => x.stop()), 800);
        },
      };
    },
    rain: (on) => {
      const a = ready(); if (!a) return;
      if (on && !rainNode) {
        const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
        s.buffer = noiseBuf(a, 2); s.loop = true; f.type = 'lowpass'; f.frequency.value = 1400; g.gain.value = 0.18;
        s.connect(f); f.connect(g); g.connect(master); s.start(); rainNode = { s, g };
      } else if (!on && rainNode) { rainNode.g.gain.setTargetAtTime(0, a.currentTime, 0.4); const n = rainNode; setTimeout(() => n.s.stop(), 1500); rainNode = null; }
    },
    // giọng chủ trọ nói thì nhạc nền nhỏ lại
    duck: (d) => { ducked = d; if (musicBus && ac) musicBus.gain.setTargetAtTime((CFG.nhacNen ? CFG.amLuongNhac : 0) * (d ? 0.3 : 1), ac.currentTime, 0.25); },
    // trang quản trị đổi âm lượng / tắt nhạc
    applyVolumes: () => {
      if (!ac) return;
      master.gain.setTargetAtTime(CFG.amThanh ? CFG.amLuong : 0, ac.currentTime, 0.1);
      musicBus.gain.setTargetAtTime((CFG.nhacNen ? CFG.amLuongNhac : 0) * (ducked ? 0.3 : 1), ac.currentTime, 0.2);
    },
  };
})();
setTimeout(() => { if (!sfx.unlock() && (CFG.amThanh || CFG.nhacNen) && !window.obsstudio) document.getElementById('batTieng').hidden = false; }, 1200);
setInterval(() => sfx.startMusic(), 3000); // trình duyệt chặn tiếng lúc đầu thì thử lại
document.getElementById('batTieng').onclick = (e) => { sfx.unlock(); e.target.hidden = true; sfx.knock(); };
addEventListener('click', () => sfx.unlock());

// =====================================================================
//  Thông báo trên màn hình
// =====================================================================
const toastsEl = document.getElementById('toasts');
function toast(text) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = text;
  toastsEl.appendChild(el);
  while (toastsEl.children.length > 2) toastsEl.firstChild.remove();
  setTimeout(() => el.remove(), 4200);
}
const bannerEl = document.getElementById('banner');
const bannerQ = [];
let bannerBusy = false;
function banner(a, b, ms = 3200) {
  bannerQ.push({ a, b, ms }); if (bannerQ.length > 5) bannerQ.splice(1, 1);
  if (!bannerBusy) nextBanner();
}
function nextBanner() {
  const it = bannerQ.shift();
  if (!it) { bannerBusy = false; bannerEl.classList.remove('show'); return; }
  bannerBusy = true;
  bannerEl.querySelector('.a').textContent = it.a; bannerEl.querySelector('.b').textContent = it.b;
  bannerEl.classList.remove('show'); void bannerEl.offsetWidth; bannerEl.classList.add('show');
  setTimeout(nextBanner, it.ms * (bannerQ.length > 2 ? 0.6 : 1));
}

const boardEl = document.getElementById('board');
let boardTick = 0;
const bottomStackEl = document.getElementById('bottomStack');
function renderBoard() {
  boardTick++;
  const all = [...tenants.values()];
  const row = (n, i, v) => `<div class="row"><span class="n">${i + 1}</span><span class="name">${esc(n)}</span><span class="v">${v}</span></div>`;
  const rich = all.filter((t) => t.coins > 0).sort((a, b) => b.coins - a.coins).slice(0, 3);
  // mục thứ hai đổi lần lượt mỗi ~9 giây, chỉ hiện mục đã có người
  const top = (f, ic) => all.filter((t) => f(t) > 0).sort((a, b) => f(b) - f(a)).slice(0, 3).map((t) => [t.name, `${f(t)}${ic}`]);
  const wk = Object.values(week.coins).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => [n, `${c}💡`]);
  const cats = [
    { h: '📢 PHÒNG ỒN NHẤT', rows: top((t) => t.comments, '💬') },
    { h: '🩴 VUA BẮT TRỘM', rows: top((t) => t.catches || 0, '🩴') },
    { h: '🧠 THÁNH ĐỐ', rows: top((t) => t.quiz || 0, '🧠') },
    { h: '🔢 TAY QUAY SỐ', rows: top((t) => t.lucky || 0, '🎯') },
    { h: '📅 GƯƠNG MẪU TUẦN', rows: wk },
  ].filter((c) => c.rows.length);
  const sec = cats.length ? cats[Math.floor(boardTick / 6) % cats.length] : null;
  const pts = team.pts, mx = Math.max(1, pts.A, pts.B, pts.C), lead = Object.entries(pts).sort((a, b) => b[1] - a[1])[0];
  const left = Math.max(0, Math.ceil((team.until - performance.now()) / 1000));
  const teamRow = (k) => `<div class="team${lead[1] > 0 && lead[0] === k ? ' lead' : ''}"><span class="k">${team.champ === k ? '👑' : k}</span><span class="tb"><i style="width:${(pts[k] / mx) * 100}%"></i></span><span class="v">${Math.round(pts[k]).toLocaleString('vi-VN')}</span></div>`;
  boardEl.innerHTML =
    `<h3>🏅 PHÒNG GƯƠNG MẪU</h3>` + (rich.length ? rich.map((t, i) => row(t.name, i, `${t.coins}💡`)).join('') : `<div class="empty">Tặng quà để đóng tiền điện!</div>`) +
    `<div class="sep"></div>` + (sec ? `<h3>${sec.h}</h3>` + sec.rows.map(([n, v], i) => row(n, i, v)).join('') : `<h3>📢 PHÒNG ỒN NHẤT</h3><div class="empty">Comment để chém gió!</div>`) +
    `<div class="sep"></div><h3>🏆 THI ĐUA TÒA</h3>` + ['A', 'B', 'C'].map(teamRow).join('') +
    `<div class="sub">còn ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · ❤️ 💬 🎁 đều tính điểm</div>`;
  if (bottomStackEl) bottomStackEl.style.bottom = `${boardEl.offsetHeight + 34}px`;
}
setTimeout(renderBoard, 0);
setInterval(renderBoard, 1500);

// =====================================================================
//  Sự kiện: mất điện, trời mưa
// =====================================================================
let power = true;
let event = null; // {kind:'matdien'|'mua', until, need, have}
const eventEl = document.getElementById('event');
function showEvent(title, text) {
  eventEl.querySelector('h2').textContent = title; eventEl.querySelector('p').textContent = text;
  eventEl.classList.add('show');
}
function updateEventBar() {
  if (!event) return;
  const fill = eventEl.querySelector('.fill'), num = eventEl.querySelector('.num');
  if (event.kind === 'matdien') {
    fill.style.width = `${clamp(event.have / event.need, 0, 1) * 100}%`;
    num.textContent = `❤️ ${Math.floor(event.have)} / ${event.need} tim`;
  } else if (event.kind === 'trom') {
    const left = Math.max(0, (event.until - performance.now()) / 1000);
    fill.style.width = `${clamp(event.have / event.need, 0, 1) * 100}%`;
    num.textContent = `🩴 ${Math.floor(event.have)} / ${event.need} lượt ném dép · còn ${Math.ceil(left)} giây`;
  } else if (event.kind === 'do') {
    const left = Math.max(0, (event.until - performance.now()) / 1000);
    fill.style.width = `${(left / event.dur) * 100}%`;
    num.textContent = `⏳ còn ${Math.ceil(left)} giây · comment đáp án`;
  } else if (hc?.eventBar(event, fill, num)) {
    // cúp nước, gió to, mùa thi (hoatcanh.js)
  } else {
    const left = Math.max(0, (event.until - performance.now()) / 1000);
    fill.style.width = `${(left / event.dur) * 100}%`;
    const saved = [...tenants.values()].filter((t) => t.savedClothes).length;
    num.textContent = `☔ còn ${Math.ceil(left)} giây · ${saved} phòng đã cất đồ`;
  }
}

function startPowerCut() {
  if (event || !tenants.size) return;
  const need = Math.round(clamp(tenants.size * 25, 60, CFG.timDeCoDien));
  event = { kind: 'matdien', need, have: 0, until: performance.now() + 100000 };
  power = false;
  rooms.forEach((r) => setRoomLight(r, !!r.tenant));
  streetLamp.intensity = 0; streetGlow.material.opacity = 0;
  scene.background.set('#03040c');
  sfx.off();
  showEvent('⚡ MẤT ĐIỆN RỒI! ⚡', `Cả xóm thả tim để ${XH} chủ trọ chạy máy phát điện!`);
  updateEventBar();
  speak(`Thôi chết, mất điện rồi cả xóm ơi! Thả tim cho ${XH} chạy máy phát nào, cần ${need} tim nhé!`, true);
}
function endPowerCut(byPlayers) {
  power = true;
  rooms.forEach((r, i) => setTimeout(() => setRoomLight(r, !!r.tenant), i * 70));
  streetLamp.intensity = 60; streetGlow.material.opacity = 1;
  scene.background.set('#0b1030');
  sfx.on();
  eventEl.classList.remove('show');
  event = null;
  nextPowerCut = performance.now() + CFG.phutGiuaCacLanMatDien * 60000 * jitter(); calmUntil = performance.now() + 20000;
  if (byPlayers) { for (let i = 0; i < 4; i++) setTimeout(firework, i * 300); speak('Có điện rồi! Giỏi quá, cảm ơn cả xóm nhé!', true); }
  else speak(`Thôi được rồi, ${XH} tự sửa cầu dao xong rồi. Có điện rồi nhé cả xóm!`, true);
}
function startRain() {
  if (event || !tenants.size) return;
  const dur = 45;
  event = { kind: 'mua', until: performance.now() + dur * 1000, dur };
  tenants.forEach((t) => { t.savedClothes = !t.room.clothes.visible; });
  rain.visible = true; sfx.rain(true);
  scene.fog.color.set('#1a2140'); scene.fog.near = FOG_NEAR - 15; scene.fog.far = FOG_FAR - 20;
  showEvent('🌧️ MƯA TO RỒI! 🌧️', 'Comment "cất" để cất quần áo vào phòng!');
  updateEventBar();
  speak('Mưa to rồi! Đứa nào phơi quần áo ngoài hành lang thì comment cất đồ ngay!', true);
}
function endRain() {
  rain.visible = false; sfx.rain(false);
  scene.fog.color.set('#0b1030'); scene.fog.near = FOG_NEAR; scene.fog.far = FOG_FAR;
  eventEl.classList.remove('show');
  const wet = [...tenants.values()].filter((t) => !t.savedClothes && t.room.clothes.visible);
  wet.forEach((t) => t.room.clothMats.forEach((m) => m.color.multiplyScalar(0.6)));
  event = null;
  nextRain = performance.now() + CFG.phutGiuaCacLanMua * 60000 * jitter(); calmUntil = performance.now() + 20000;
  if (wet.length) {
    const names = wet.slice(0, 3).map((t) => t.name).join(', ');
    speak(`Tạnh mưa rồi. ${names}${wet.length > 3 ? ' với mấy đứa nữa' : ''} không cất đồ, ướt hết rồi nhé!`, true);
  } else speak('Tạnh mưa rồi. Cả xóm nhanh tay ghê, không ai bị ướt đồ!', true);
  setTimeout(() => tenants.forEach((t) => { t.room.clothes.visible = Math.random() < 0.7; t.room.clothMats.forEach((m) => m.color.set(pick(['#e24a4a', '#f2c14e', '#4aa3e2', '#ffffff', '#7bd389', '#c77dff', '#ff8fab']))); }), 20000);
}
let nextPowerCut = performance.now() + 3 * 60000;
let nextRain = performance.now() + 5.5 * 60000;
let nextNotice = performance.now() + 60000;

// =====================================================================
//  Hành động trong phòng (comment lệnh) và hai sự kiện mới: bắt trộm, đố vui
// =====================================================================
const noteTex = emojiTex('🎵'), note2Tex = emojiTex('🎶'), zzzTex = emojiTex('💤'), beerTex = emojiTex('🍻'), depTex = emojiTex('🩴');
const lowText = (s) => ` ${String(s || '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
const roomTop = (r) => roomPt(r, 0.05, 2.4, 1.1);
// mỗi người mỗi lệnh 4 giây mới tính lại một lần, tránh spam
function cooled(t, kind, ms = 4000) {
  const now = performance.now(); t.cd = t.cd || {};
  if (now - (t.cd[kind] || -1e9) < ms) return false;
  t.cd[kind] = now; return true;
}
// nhiều phòng cùng làm một việc trong thời gian ngắn → cả xóm cùng làm
const combo = {}, comboCool = {};
function comboHit(kind, id, need, winMs, coolMs) {
  const now = performance.now();
  const arr = (combo[kind] = (combo[kind] || []).filter((x) => now - x.t < winMs));
  if (!arr.some((x) => x.id === id)) arr.push({ id, t: now });
  if (arr.length < need || now < (comboCool[kind] || 0)) return 0;
  combo[kind] = []; comboCool[kind] = now + coolMs;
  return arr.length;
}
const people = () => rooms.filter((r) => r.person && r.tenant);

function wake(t, quiet = true) {
  if (!t.sleeping) return;
  t.sleeping = false; setRoomLight(t.room, true);
  if (!quiet) toast(`☀️ ${t.name} bị đánh thức`);
}
function doSleep(t) {
  t.sleeping = true; t.sleepUntil = performance.now() + 120000;
  setRoomLight(t.room, true); // tắt đèn (setRoomLight biết phòng đang ngủ)
  floatEmoji(t.room, '💤');
  toast(`💤 ${t.name} tắt đèn đi ngủ`);
}
function doSing(t) {
  const p = t.room.person; if (!p) return;
  p.singUntil = performance.now() + 6000; p.talkUntil = p.singUntil;
  floatEmoji(t.room, '🎤'); sfx.sing();
  const n = comboHit('hat', t.id, 3, 25000, 90000);
  if (n) {
    banner('🎤 KARAOKE CẢ XÓM!', `${n} phòng cùng hát, hàng xóm sang kêu kìa!`, 3800);
    people().forEach((r, i) => setTimeout(() => { if (r.person) { r.person.singUntil = performance.now() + 7000; r.person.talkUntil = r.person.singUntil; } }, i * 90));
    speak(pick(['Hát nhỏ nhỏ thôi các cháu ơi, hàng xóm sang kêu bây giờ!', 'Cả xóm mở karaoke à? Thôi được, hát thêm một bài rồi đi ngủ nhé!']), true);
    for (let i = 0; i < 2; i++) setTimeout(firework, i * 400);
  } else toast(`🎤 ${t.name} đang hát karaoke`);
}
function doDance(t) {
  const p = t.room.person; if (!p) return;
  p.danceUntil = performance.now() + 6000;
  floatEmoji(t.room, '💃');
  const n = comboHit('quay', t.id, 4, 20000, 60000);
  if (n) {
    banner('💃 CẢ XÓM QUẨY!', `${n} phòng quẩy cùng lúc, sàn rung hết rồi!`, 3800);
    people().forEach((r) => (r.person.danceUntil = performance.now() + 8000));
    sfx.big(); for (let i = 0; i < 3; i++) setTimeout(firework, i * 350);
    speak(pick(['Ối giời, cả xóm quẩy tung nóc nhà rồi!', `Quẩy nhẹ thôi, sập cái lan can của ${XH} bây giờ!`]), true);
  } else toast(`💃 ${t.name} quẩy lên`);
}
function doStudy(t) {
  const p = t.room.person; if (!p) return;
  p.studyUntil = performance.now() + 30000;
  floatEmoji(t.room, '📚');
  toast(`📚 ${t.name} ngồi học bài`);
}
function doCheers(t) {
  floatEmoji(t.room, '🍻'); sfx.clink();
  if (t.room.person) t.room.person.jumpUntil = performance.now() + 700;
  const n = comboHit('do', t.id, 4, 15000, 60000);
  if (!n) return;
  banner('🍻 MỘT, HAI, BA… DÔ!', `${n} phòng cùng cụng ly`, 3200);
  people().forEach((r, i) => setTimeout(() => {
    if (!r.person) return;
    r.person.jumpUntil = performance.now() + 900;
    spawnSprite(beerTex, roomTop(r), { vel: new THREE.Vector3(0, 0.5, 0), life: 2.2, size: 0.7, grow: 0.1 });
  }, i * 60));
  for (let i = 0; i < 4; i++) setTimeout(sfx.clink, i * 140);
}
function doWave(t) {
  floatEmoji(t.room, '👋');
  const p = t.room.person; if (p) p.talkUntil = performance.now() + 1800;
  // hàng xóm cùng tầng vẫy tay chào lại
  rooms.filter((r) => r !== t.room && r.floor === t.room.floor && r.person && r.tenant && !r.tenant.sleeping)
    .forEach((r, i) => setTimeout(() => { if (r.person) r.person.talkUntil = performance.now() + 1500; }, 300 + i * 150));
}
function knockRoom(t, number) {
  const r = rooms.find((x) => x.number === number);
  if (!r || r === t.room) return;
  sfx.knock(); setTimeout(sfx.knock, 350);
  floatEmoji(r, '🚪');
  if (!r.tenant) return toast(`🚪 ${t.name} gõ cửa… phòng trống, không ai ở`);
  const other = r.tenant;
  if (other.sleeping) wake(other, false);
  if (r.person) { r.person.jumpUntil = performance.now() + 1200; r.person.talkUntil = performance.now() + 1500; }
  toast(`🚪 ${t.name} gõ cửa gọi ${other.name}`);
}
// đọc comment: trả về true nếu là một lệnh hành động
function roomAction(t, raw, pl) {
  const low = lowText(raw);
  const knock = pl.match(/ go (?:cua )?(?:phong )?(\d{3}) /);
  if (knock) { if (cooled(t, 'go', 5000)) knockRoom(t, knock[1]); return; }
  if (/ ngủ | đi ngủ | zzz | gn | good night | ngủ ngon /.test(low)) { if (!t.sleeping) doSleep(t); return; }
  wake(t);
  if (/ quẩy | nhảy | dance | quay đi /.test(low)) { if (cooled(t, 'quay')) doDance(t); return; }
  if (/ hát | karaoke | sing /.test(low)) { if (cooled(t, 'hat')) doSing(t); return; }
  if (/ học | ôn thi | ôn bài | làm bài /.test(low)) { if (cooled(t, 'hoc', 10000)) doStudy(t); return; }
  if (/ dô | zô | dzô | yo | cheers | chúc mừng /.test(low)) { if (cooled(t, 'do')) doCheers(t); return; }
  if (/ chào | hi | hello | helo | alo | xin chào /.test(low)) { if (cooled(t, 'chao', 8000)) doWave(t); }
}

// cập nhật nhân vật trong phòng: ngủ thì 💤, hát thì nốt nhạc bay
function updateRoomActions(dt, now) {
  for (const r of rooms) {
    const t = r.tenant, p = r.person; if (!t || !p) continue;
    if (t.sleeping) {
      if (now > t.sleepUntil) { wake(t); continue; }
      if (Math.random() < dt * 0.6) spawnSprite(zzzTex, roomTop(r), { vel: new THREE.Vector3(rand(0.1, 0.3), 0.45, 0), life: 2.2, size: 0.45, grow: 0.3 });
    }
    if (now < (p.singUntil || 0) && Math.random() < dt * 2.5) {
      spawnSprite(Math.random() < 0.5 ? noteTex : note2Tex, roomTop(r).add(new THREE.Vector3(rand(-0.4, 0.4), 0, 0)), { vel: new THREE.Vector3(rand(-0.3, 0.3), 0.8, 0), life: 1.6, size: 0.5, grow: 0.1 });
    }
  }
}

// ---------------- Sự kiện: có trộm ----------------
let thief = null;
function startThief() {
  if (event || !tenants.size) return;
  if (thief) { scene.remove(thief.p.group); thief.el.remove(); thief = null; }
  const dur = 42, need = Math.round(clamp(tenants.size * 2, 8, 40));
  event = { kind: 'trom', need, have: 0, until: performance.now() + dur * 1000, dur, by: new Map() };
  const p = makePerson({ shirt: '#1d1d1d', skin: '#d9a173', longHair: false, glasses: false, scale: PERSON_SIZE, hair: 'short', top: 'tee', shorts: false, mood: 'nghi' });
  const black = M({ color: '#0d0d0d' });
  const mask = box(0.62, 0.13, 0.12, black); mask.position.set(0, 0.02, 0.22); p.headG.add(mask);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), black); cap.position.y = 0.04; p.headG.add(cap); p.hairTop.visible = false;
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), M({ color: '#a47c48' })); sack.position.set(0, 1.05, -0.36); sack.scale.y = 1.2; p.group.add(sack);
  const x0 = -BW / 2 - 5, x1 = BW / 2 + 5;
  p.group.position.set(x0, 0.2, 4.7); p.group.rotation.y = Math.PI / 2; scene.add(p.group);
  const el = document.createElement('div'); el.className = 'plate small'; el.textContent = '🦹 KẺ TRỘM'; labelsEl.appendChild(el);
  thief = { p, el, x0, x1, state: 'sneak', t0: performance.now(), dur: dur * 1000, caughtAt: 0 };
  showEvent('🦹 CÓ TRỘM VÀO XÓM! 🦹', 'Comment "bắt" để ném dép bắt trộm!');
  updateEventBar(); sfx.whistle();
  speak(`Ối làng nước ơi, có trộm! Cả xóm comment bắt, ném dép vào nó cho ${XH}!`, true);
}
function hitThief(t, amount) {
  if (!event || event.kind !== 'trom' || !thief) return;
  event.have += amount;
  if (t) event.by.set(t.id, (event.by.get(t.id) || 0) + amount);
  if (t && amount === 1) t.catches = (t.catches || 0) + 1;
  updateEventBar();
  if (event.have >= event.need) endThief(true);
}
function throwSlipper(t) {
  if (!thief) return;
  const from = roomTop(t.room), to = thief.p.group.position.clone().add(new THREE.Vector3(0, 2.0, 0));
  const T = 1.0, g = 9;
  const vel = to.clone().sub(from).divideScalar(T); vel.y += 0.5 * g * T;
  spawnSprite(depTex, from, { vel, life: T, size: 0.55, grow: 0, gravity: g });
  if (t.room.person) t.room.person.jumpUntil = performance.now() + 600;
  setTimeout(() => { if (thief && thief.state === 'sneak') { thief.p.jumpUntil = performance.now() + 300; sfx.knock(); } }, T * 1000);
}
function endThief(caught) {
  const ev = event; event = null; calmUntil = performance.now() + 20000;
  nextThief = performance.now() + (CFG.phutGiuaCacLanTrom || 6) * 60000 * jitter();
  eventEl.classList.remove('show');
  if (thief) { thief.state = caught ? 'caught' : 'gone'; thief.caughtAt = performance.now(); }
  if (caught) {
    const top = [...(ev?.by || new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => tenants.get(id)?.name).filter(Boolean);
    banner('👮 BẮT ĐƯỢC TRỘM RỒI!', top.length ? `Công lớn nhất: ${top[0]}` : 'Cả xóm giỏi quá!', 4200);
    sfx.big(); for (let i = 0; i < 4; i++) setTimeout(firework, i * 300);
    speak(top.length ? `Bắt được trộm rồi! Cảm ơn ${top.join(', ')} ném dép trúng quá. Cả xóm giỏi lắm!` : 'Bắt được trộm rồi! Cả xóm giỏi lắm!', true);
  } else {
    speak(pick([`Trộm chạy mất rồi, nó lấy luôn đôi dép tổ ong của ${XH}! Lần sau nhanh tay lên nhé!`, 'Thôi xong, nó chạy mất rồi. Cả xóm nhớ khóa cửa cẩn thận nhé!']), true);
  }
}
function updateThief(dt, now) {
  if (!thief) return;
  const p = thief.p, g = p.group;
  let moving = true;
  if (thief.state === 'sneak') {
    g.position.x = thief.x0 + (thief.x1 - thief.x0) * clamp((now - thief.t0) / thief.dur, 0, 1);
  } else if (thief.state === 'caught') {
    const k = (now - thief.caughtAt) / 1000;
    if (k < 3) { moving = false; p.arms[0].rotation.z = 2.8; p.arms[1].rotation.z = -2.8; g.rotation.y = 0; setFace(p, 'shock', 'o'); } // giơ tay đầu hàng
    else { g.rotation.y = -Math.PI / 2; g.position.x -= dt * 6; g.scale.setScalar(PERSON_SIZE * Math.max(0.01, 1 - (k - 3) / 1.5)); }
    if (k > 4.5) thief.state = 'done';
  } else if (thief.state === 'gone') {
    g.rotation.y = Math.PI / 2; g.position.x += dt * 7;
    if (now - thief.caughtAt > 2500) thief.state = 'done';
  }
  if (thief.state === 'done') { scene.remove(g); thief.el.remove(); thief = null; return; }
  if (moving) {
    const sw = Math.sin(now / (thief.state === 'sneak' ? 200 : 90)) * 0.6;
    p.legs[0].rotation.x = sw; p.legs[1].rotation.x = -sw;
    p.arms[0].rotation.x = -sw * 0.8; p.arms[1].rotation.x = sw * 0.8;
  }
  g.position.y = 0.2 + (now < p.jumpUntil ? 0.25 : 0);
  const v = g.position.clone(); v.y += 2.7;
  const sc = toScreen(v); thief.el.style.left = `${sc.x}px`; thief.el.style.top = `${sc.y}px`;
}

// ---------------- Sự kiện: đố vui ----------------
const CAU_DO_MAC_DINH = [
  'Con gì càng to càng nhỏ? | con cua | cua',
  'Con gì đập thì sống, không đập thì chết? | trái tim | quả tim | tim',
  'Cái gì của mình mà người khác dùng nhiều hơn mình? | cái tên | tên',
  'Bệnh gì bác sĩ bó tay? | gãy tay',
  'Tháng nào có 28 ngày? | tất cả | tháng nào cũng có | cả 12 tháng',
  'Cái gì luôn đi tới mà không bao giờ tới? | ngày mai',
  'Quần rộng nhất là quần gì? | quần đảo',
  'Xã nào đông dân nhất? | xã hội',
  'Con gì đầu dê mình ốc? | con dốc | dốc',
  'Cái gì có cổ mà không có miệng? | cái áo | áo',
  'Hai cộng hai nhân hai bằng mấy? | 6 | sáu',
  'Một đàn chim đậu trên cành, người thợ săn bắn cái rằm. Hỏi chết mấy con? | 15 | mười lăm',
  'Con gì ăn lửa với nước than? | tàu hỏa | tàu hoả',
  'Đồng gì mà ai cũng thích? | đồng tiền | tiền',
  'Thủ đô của Việt Nam là thành phố nào? | hà nội',
];
let quizBag = [];
const parseQuiz = () => ((CFG.cauDo && CFG.cauDo.length) ? CFG.cauDo : CAU_DO_MAC_DINH)
  .map((l) => String(l).split('|').map((s) => s.trim()).filter(Boolean)).filter((a) => a.length >= 2)
  .map(([q, ...a]) => ({ q, a, keys: a.map((x) => plain(x).trim()).filter(Boolean) }));
let quizHideTimer = null;
function startQuiz() {
  if (event || !tenants.size) return;
  if (!quizBag.length) quizBag = parseQuiz().sort(() => Math.random() - 0.5);
  const qz = quizBag.pop(); if (!qz) return;
  const dur = 35;
  event = { kind: 'do', ...qz, until: performance.now() + dur * 1000, dur };
  clearTimeout(quizHideTimer);
  showEvent('🧠 ĐỐ VUI XÓM TRỌ', qz.q);
  updateEventBar(); sfx.ding();
  speak(`Đố cả xóm: ${qz.q} Ai trả lời đúng đầu tiên thì comment nhé!`, true);
}
function checkQuiz(t, pl) {
  if (!event || event.kind !== 'do') return;
  if (event.keys.some((k) => pl.includes(` ${k} `))) endQuiz(t);
}
function endQuiz(t) {
  const ev = event; event = null; calmUntil = performance.now() + 20000;
  nextQuiz = performance.now() + (CFG.phutGiuaCacLanDo || 4) * 60000 * jitter();
  if (!ev) return;
  const ans = ev.a[0];
  eventEl.querySelector('.fill').style.width = '100%';
  if (t) {
    t.quiz = (t.quiz || 0) + 1;
    eventEl.querySelector('.num').textContent = `✅ ${t.name} trả lời đúng: ${ans}`;
    banner(`🧠 ${t.name} trả lời đúng!`, `Đáp án: ${ans}`, 3800);
    if (t.room.person) t.room.person.jumpUntil = performance.now() + 1800;
    floatEmoji(t.room, '🧠'); sfx.big(); for (let i = 0; i < 2; i++) setTimeout(firework, i * 350);
    speak(`Chính xác! ${t.name} giỏi quá. Đáp án là ${ans}.`, true);
  } else {
    eventEl.querySelector('.num').textContent = `⌛ Hết giờ! Đáp án: ${ans}`;
    speak(`Hết giờ! Không ai đoán ra à? Đáp án là ${ans} nhé.`, true);
  }
  quizHideTimer = setTimeout(() => { if (!event) eventEl.classList.remove('show'); }, 5000);
}
// ---------------- Quay số may mắn (miễn phí, chỉ để vui) ----------------
// Cứ giayQuaySo giây (mặc định 60) đại lý vé số quay một số 00–99. Người xem comment một con số, ai đoán gần nhất được xướng tên.
// Không dính tới quà: tặng quà không tăng cơ hội, phần thưởng chỉ là được khen trên live. Tắt bằng quaySo: false.
const quaySoEl = document.createElement('div'); quaySoEl.className = 'stall quayso'; labelsEl.appendChild(quaySoEl);
const QS_ROLL = 3500;
const pad2 = (n) => String(n).padStart(2, '0');
const quaySoMs = () => clamp(Number(CFG.giayQuaySo) || 60, 20, 600) * 1000;
veSo.next = performance.now() + quaySoMs();
function guessQuaySo(t, pl) {
  if (CFG.quaySo === false || veSo.rollUntil) return;
  const m = pl.trim().match(/^(?:so may man |chon so |so |)(\d{1,2})$/); // comment chỉ có con số (hoặc "số 27")
  if (!m) return;
  const first = !veSo.guesses.has(t.id);
  veSo.guesses.set(t.id, { t, n: Number(m[1]), at: performance.now() });
  if (first) {
    floatEmoji(t.room, '🔢');
    if (veSo.group) goToStall(t, '🔢', veSoSpot(), () => STALL_FLOAT(veSo.group, `🔢${pad2(Number(m[1]))}`, 2.6));
  }
}
const veSoSpot = () => new THREE.Vector3(veSo.group.position.x + rand(-0.6, 0.6), 0.2, 4.05);
function updateQuaySo(now) {
  if (CFG.quaySo === false) { quaySoEl.style.display = 'none'; veSo.guesses.clear(); veSo.rollUntil = 0; veSo.next = now + quaySoMs(); return; }
  quaySoEl.style.display = '';
  if (veSo.rollUntil) {
    if (now >= veSo.rollUntil) drawQuaySo(now);
    else if (now - veSo.flick > 70) { veSo.flick = now; quaySoEl.innerHTML = `🔢 Đang quay… <b class="big">${pad2(Math.floor(Math.random() * 100))}</b>`; }
  } else if (now >= veSo.showUntil) {
    const left = Math.max(0, Math.ceil((veSo.next - now) / 1000));
    quaySoEl.innerHTML = `🔢 Quay số sau <b>${left}s</b> · comment <b>số 00–99</b>${veSo.guesses.size ? ` · <b>${veSo.guesses.size}</b> người đoán` : ''}`;
    if (now >= veSo.next) {
      if (veSo.guesses.size) { veSo.rollUntil = now + QS_ROLL; sfx.ding(); }
      else veSo.next = now + quaySoMs();
    }
  }
  if (veSo.group) {
    const v = veSo.group.position.clone(); v.y += 4.9;
    const sc = toScreen(v); quaySoEl.style.left = `${clamp(sc.x, 190, W - 190)}px`; quaySoEl.style.top = `${sc.y}px`;
  }
}
function drawQuaySo(now) {
  veSo.rollUntil = 0;
  const win = Math.floor(Math.random() * 100), ws = pad2(win);
  let best = null;
  for (const g of veSo.guesses.values()) {
    if (!tenants.has(g.t.id)) continue;
    const d = Math.abs(g.n - win);
    if (!best || d < best.d || (d === best.d && g.at < best.at)) best = { ...g, d };
  }
  veSo.guesses.clear(); veSo.next = now + quaySoMs(); veSo.showUntil = now + 6000;
  if (!best) { quaySoEl.innerHTML = `🔢 Số may mắn: <b class="big">${ws}</b>`; return; }
  const t = best.t, exact = best.d === 0;
  t.lucky = (t.lucky || 0) + 1;
  quaySoEl.innerHTML = `🔢 Số may mắn: <b class="big">${ws}</b> · ${exact ? '🎯' : '👏'} ${esc(t.name)} (${pad2(best.n)})`;
  banner(exact ? `🎯 ${t.name} đoán trúng ${ws}!` : `🔢 Số may mắn: ${ws}`, exact ? 'Cả xóm vỗ tay!' : `${t.name} đoán ${pad2(best.n)}, gần nhất xóm!`, 3800);
  if (t.room.person) t.room.person.jumpUntil = now + 1800;
  floatEmoji(t.room, exact ? '🎯' : '👏'); sfx.big();
  focusRoom(t.room, exact ? 6000 : 4500, true); // zoom vào phòng người trúng
  for (let i = 0; i < (exact ? 7 : 4); i++) setTimeout(() => firework(roomPt(t.room, rand(-2.2, 2.2), rand(2.4, 4.2), 1.2), 0.45), 400 + i * 380);
  for (let i = 0; i < 2; i++) setTimeout(firework, (exact ? 6200 : 4700) + i * 400); // thêm pháo hoa trên nóc khi camera lùi ra
  speak(exact ? `Số may mắn là ${win}! ${t.name} đoán trúng phóc, giỏi quá!` : `Số may mắn là ${win}. ${t.name} đoán ${best.n}, gần nhất xóm!`);
}

let calmUntil = 0;
let nextThief = performance.now() + 4.5 * 60000;
let nextQuiz = performance.now() + 2 * 60000;

let hc = null; // hoạt cảnh thêm (hoatcanh.js), gắn ở cuối file
// =====================================================================
//  Cấp xóm (mục tiêu chung, cộng dồn qua các buổi live), thi đua 3 tòa, trang trí phòng
// =====================================================================
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const xomFx = { bulbs: null, wifiLed: null, neon: null, lanterns: [], nightFw: false, nextFw: 0, legend: false };
// điểm xóm: ❤️ 1 tim = 1, 💬 1 comment = 2, 🎁 1 xu = 10, người mới vào xóm = 5
const LEVELS = [
  { at: 0, icon: '🏠', ten: 'Xóm mới' },
  { at: 300, icon: '💡', ten: 'Dây đèn hành lang', say: 'treo dây đèn dọc hành lang' },
  { at: 1500, icon: '🎨', ten: 'Sơn lại tường', say: 'sơn lại tường mới tinh cho cả xóm' },
  { at: 4000, icon: '🌿', ten: 'Cây xanh lan can', say: 'đặt cây xanh lên lan can' },
  { at: 9000, icon: '📶', ten: 'Wifi miễn phí', say: 'lắp wifi miễn phí cho cả xóm' },
  { at: 18000, icon: '✨', ten: 'Biển neon trên mái', say: 'dựng biển neon trên mái' },
  { at: 35000, icon: '🏮', ten: 'Đèn lồng giăng sân', say: 'giăng đèn lồng khắp sân' },
  { at: 60000, icon: '🎆', ten: 'Pháo hoa mỗi đêm', say: 'đêm nào cũng bắn pháo hoa' },
  { at: 100000, icon: '👑', ten: 'Xóm huyền thoại', say: 'phong xóm mình là xóm huyền thoại' },
];
const levelOf = (p) => { let l = 0; while (l + 1 < LEVELS.length && p >= LEVELS[l + 1].at) l++; return l; };
let xomLevel = levelOf(xomPoints);
const UPG = [], upgDone = new Set();
const ALL_BLOCKS = () => BLOCKS.map(({ b, cols }) => ({ ...b, cols }));
UPG[1] = () => { // dây đèn nhiều màu dưới mép trần hành lang, cả 3 tòa
  const mats = ['#ff4d6d', '#ffd60a', '#4cc9f0', '#80ff72'].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const g = new THREE.SphereGeometry(0.06, 6, 4), m4 = new THREE.Matrix4();
  for (const b of ALL_BLOCKS()) {
    const per = Math.max(8, Math.floor((b.corrW - 0.8) / 0.42));
    const meshes = mats.map((m) => new THREE.InstancedMesh(g, m, Math.ceil(per / 4) * FLOORS)), cnt = [0, 0, 0, 0];
    for (let f = 1; f <= FLOORS; f++) for (let i = 0; i < per; i++) {
      const x = -b.corrW / 2 + 0.4 + i * ((b.corrW - 0.8) / (per - 1)), sag = Math.sin(((i % 7) / 6) * Math.PI) * 0.12;
      m4.makeTranslation(x, floorBase(f) + FLOOR_H - 0.3 - sag, CORR - 0.12); const k = i % 4; meshes[k].setMatrixAt(cnt[k]++, m4);
    }
    meshes.forEach((m, k) => { m.count = cnt[k]; b.bg.add(m); });
  }
  xomFx.bulbs = mats;
};
UPG[2] = () => { // sơn lại tường: màu kem sạch sẽ, không còn vệt ố
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f4dfae'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${rand(0.03, 0.08)})`; g.fillRect(rand(0, w), rand(0, h), rand(2, 8), rand(2, 8)); }
    g.fillStyle = 'rgba(230,120,90,.55)'; g.fillRect(0, h - 14, w, 8); // đường chỉ trang trí
  }, [3, 2]);
  WALL_MATS.forEach((m) => { m.map = t; m.needsUpdate = true; });
};
UPG[3] = () => { // chậu cây trên lan can, giữa các phòng
  const potM = M({ color: '#c0603a' }), leafM = M({ color: '#3f9d4a', flatShading: true });
  const potG = new THREE.CylinderGeometry(0.13, 0.1, 0.2, 10), leafG = new THREE.IcosahedronGeometry(0.2, 0), m4 = new THREE.Matrix4();
  for (const b of ALL_BLOCKS()) {
    const n = (b.cols + 1) * FLOORS, pots = new THREE.InstancedMesh(potG, potM, n), leaves = new THREE.InstancedMesh(leafG, leafM, n);
    let k = 0;
    for (let f = 1; f <= FLOORS; f++) for (let c = 0; c <= b.cols; c++) {
      const x = clamp((c - b.cols / 2) * ROOM_W, -b.corrW / 2 + 0.6, b.corrW / 2 - 0.6), y = floorBase(f) + 0.99;
      m4.makeTranslation(x, y, CORR - 0.08); pots.setMatrixAt(k, m4);
      m4.makeTranslation(x, y + 0.2, CORR - 0.08); leaves.setMatrixAt(k++, m4);
    }
    b.bg.add(pots, leaves);
  }
};
UPG[4] = () => { // biển wifi + cục phát trên mái tòa giữa
  const tex = signTexOf('📶 WIFI FREE', '#0b5394', '#ffffff', 'XÓM TRỌ · MẬT KHẨU: HOCDI');
  const g = new THREE.Group(); g.position.set(MID_W / 2 - 4.2, TOP + 0.8, -0.2); blockB.bg.add(g);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.82), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.6 }));
  sign.position.set(0, 1.35, 0); g.add(sign);
  [-1.1, 1.1].forEach((x) => { const p = box(0.06, 0.95, 0.06, M({ color: '#555' })); p.position.set(x, 0.47, -0.02); g.add(p); });
  const router = box(0.5, 0.12, 0.32, M({ color: '#f1f1f1' })); router.position.set(1.7, 0.06, 0.3); g.add(router);
  [-0.15, 0.15].forEach((x) => { const a = box(0.03, 0.4, 0.03, M({ color: '#222' })); a.position.set(1.7 + x, 0.32, 0.2); g.add(a); });
  xomFx.wifiLed = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#80ff72', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  xomFx.wifiLed.position.set(1.7, 0.2, 0.5); xomFx.wifiLed.scale.setScalar(0.45); g.add(xomFx.wifiLed);
};
UPG[5] = () => { // biển neon tên xóm phía sau mái tòa giữa (bloom làm chữ tỏa sáng)
  const tex = canvasTex(1024, 180, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    let fs = 108; g.font = `900 ${fs}px "Be Vietnam Pro", sans-serif`;
    while (fs > 40 && g.measureText(CFG.tenXom).width > w - 80) { fs -= 4; g.font = `900 ${fs}px "Be Vietnam Pro", sans-serif`; } // tên dài thì chữ nhỏ lại
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff4fd8'; g.shadowBlur = 26; g.lineWidth = 7; g.strokeStyle = '#ff4fd8'; g.strokeText(CFG.tenXom, w / 2, h / 2 + 6);
    g.shadowBlur = 10; g.fillStyle = '#fff0fb'; g.fillText(CFG.tenXom, w / 2, h / 2 + 6);
  });
  const wdt = Math.min(MID_W - 3, 14);
  const g = new THREE.Group(); g.position.set(0, TOP + 0.8, -2.6); blockB.bg.add(g);
  const frameM = M({ color: '#333' });
  [-wdt / 2 + 0.6, wdt / 2 - 0.6].forEach((x) => { const p = box(0.1, 1.2, 0.1, frameM); p.position.set(x, 0.6, 0); g.add(p); });
  const bar = box(wdt, 0.08, 0.08, frameM); bar.position.set(0, 1.15, 0); g.add(bar);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wdt, wdt * 180 / 1024), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: '#ffffff' }));
  m.position.set(0, 1.25 + wdt * 90 / 1024, 0.06); g.add(m); xomFx.neon = m;
};
UPG[6] = () => { // dây đèn lồng đỏ giăng ngang sân
  const redM = new THREE.MeshStandardMaterial({ color: '#d00000', emissive: '#ff2a00', emissiveIntensity: 0.9, roughness: 0.6 });
  const gold = M({ color: '#ffc300', metalness: 0.5, roughness: 0.4 }), wire = new THREE.LineBasicMaterial({ color: '#222' });
  const ballG = new THREE.SphereGeometry(0.24, 12, 8);
  [LAWN_Z + 0.6, FIELD_Z + 1.2].forEach((z) => {
    const x0 = -CW / 2 - 1.5, x1 = CW / 2 + 1.5, y0 = 5.2, sag = 0.9, N = 11, pts = [];
    for (let i = 0; i <= 24; i++) { const s = i / 24; pts.push(V3(x0 + (x1 - x0) * s, y0 - Math.sin(s * Math.PI) * sag, z)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire));
    for (let k = 1; k < N; k++) {
      const s = k / N, L = new THREE.Group(); L.position.set(x0 + (x1 - x0) * s, y0 - Math.sin(s * Math.PI) * sag - 0.32, z); scene.add(L);
      const b = new THREE.Mesh(ballG, redM); b.scale.y = 0.82; L.add(b);
      [0.2, -0.2].forEach((y) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10), gold); c.position.y = y; L.add(c); });
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff5a3c', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(1.1); L.add(gl);
      xomFx.lanterns.push({ L, gl, ph: rand(0, 6) });
    }
  });
};
UPG[7] = () => { xomFx.nightFw = true; xomFx.nextFw = performance.now() + 60000; };
UPG[8] = () => { // xóm huyền thoại: mái viền vàng
  PARAPET_MATS.forEach((m) => { m.color.set('#d4a017'); m.metalness = 0.6; m.roughness = 0.35; m.emissive = new THREE.Color('#5a3d00'); m.emissiveIntensity = 0.4; m.needsUpdate = true; });
  xomFx.legend = true;
};
function applyUpgrades() { for (let i = 1; i <= xomLevel; i++) if (!upgDone.has(i)) { upgDone.add(i); try { UPG[i]?.(); } catch (e) { console.error(e); } } }
applyUpgrades();
const levelEl = document.getElementById('level');
function renderLevel() {
  if (!levelEl) return;
  const L = LEVELS[xomLevel], N = LEVELS[xomLevel + 1];
  levelEl.querySelector('.lv').textContent = `🏘️ Xóm cấp ${xomLevel + 1}`;
  levelEl.querySelector('.lb i').style.width = `${N ? clamp((xomPoints - L.at) / (N.at - L.at), 0, 1) * 100 : 100}%`;
  levelEl.querySelector('.nx').textContent = N ? `còn ${Math.ceil(N.at - xomPoints).toLocaleString('vi-VN')} điểm → ${N.icon} ${N.ten}` : '👑 Xóm huyền thoại';
}
function checkLevel() {
  const l = levelOf(xomPoints);
  if (l > xomLevel) {
    xomLevel = l; applyUpgrades();
    const L = LEVELS[l];
    banner(`🏘️ XÓM LÊN CẤP ${l + 1}!`, `${L.icon} Mở khóa: ${L.ten}`, 4800);
    speak(`Cả xóm giỏi quá! Xóm mình lên cấp ${l + 1} rồi, ${XH} ${L.say}!`, true);
    sfx.big(); for (let i = 0; i < 5; i++) setTimeout(firework, i * 300);
    saveNow();
  }
}
setInterval(renderLevel, 700); renderLevel();

// ---------- Thi đua 3 tòa: mỗi vòng (mặc định 10 phút) tòa nhiều điểm nhất được đội vương miện ----------
const teamMs = () => clamp(Number(CFG.phutThiDua) || 10, 3, 60) * 60000;
const team = { pts: { A: 0, B: 0, C: 0 }, by: new Map(), until: performance.now() + teamMs(), wins: { A: 0, B: 0, C: 0 }, champ: null, crowns: {} };
for (const { b, letter } of BLOCKS) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex('👑'), transparent: true, depthWrite: false }));
  s.position.set(0, TOP + 2.6, 0.4); s.scale.setScalar(2.2); s.visible = false; b.bg.add(s);
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffd76a', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  gl.scale.setScalar(3.6); s.add(gl); gl.scale.setScalar(1.6);
  team.crowns[letter] = s;
}
function teamAdd(t, n) {
  const k = t?.room?.block; if (!k || !(k in team.pts)) return;
  team.pts[k] += n; team.by.set(t.id, (team.by.get(t.id) || 0) + n);
}
function endTeamRound() {
  team.until = performance.now() + teamMs();
  const e = Object.entries(team.pts).sort((a, b) => b[1] - a[1]);
  const [win, pts] = e[0];
  const contrib = [...team.by.entries()].map(([id, n]) => [tenants.get(id), n]).filter(([t]) => t && t.room.block === win).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t.name);
  team.pts = { A: 0, B: 0, C: 0 }; team.by.clear();
  if (pts <= 0) return;
  team.wins[win]++; team.champ = win;
  Object.entries(team.crowns).forEach(([k, s]) => (s.visible = k === win));
  banner(`🏆 TÒA ${win} THẮNG VÒNG THI ĐUA!`, `${Math.round(pts).toLocaleString('vi-VN')} điểm${contrib.length ? ` · công lớn: ${contrib.join(', ')}` : ''}`, 5000);
  speak(`Hết vòng thi đua! Tòa ${win} thắng với ${Math.round(pts)} điểm${contrib.length ? `, cảm ơn ${contrib.join(', ')}` : ''}. Vương miện về tòa ${win} nhé!`, true);
  sfx.big();
  const bg = BLOCKS.find((x) => x.letter === win).b.bg;
  for (let i = 0; i < 5; i++) setTimeout(() => firework(bg.localToWorld(V3(rand(-3, 3), TOP + rand(4, 7), 0)), 0.8), i * 320);
  rooms.filter((r) => r.block === win && r.person).forEach((r, i) => setTimeout(() => { if (r.person) r.person.jumpUntil = performance.now() + 1500; }, i * 60));
}

// ---------- Trang trí phòng bằng comment (miễn phí, lưu lại cho buổi sau) ----------
const DOOR_COLORS = { hong: '#ff7aa2', do: '#c0392b', 'xanh la': '#3d7a52', xanh: '#2f6f9e', vang: '#e9c46a', tim: '#8d5bd6', trang: '#e8e8e8', den: '#2b2b2b', cam: '#f4a261', nau: '#7a4a2a' };
const DOOR_TEX = new Map();
const doorTexOf = (c) => { let t = DOOR_TEX.get(c); if (!t) { t = doorTex(c); DOOR_TEX.set(c, t); } return t; };
const DECOR = {
  potM: M({ color: '#c0603a' }), leafM: M({ color: '#3f9d4a', flatShading: true }), poleM: M({ color: '#b0b0b0', metalness: 0.5 }),
  flagTex: null, lanternM: new THREE.MeshStandardMaterial({ color: '#d00000', emissive: '#ff2a00', emissiveIntensity: 0.8 }), goldM: M({ color: '#ffc300', metalness: 0.5 }),
};
function applyDecor(t) {
  const r = t.room, d = t.decor || {}; r.decorG.clear();
  if (d.cay) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.24, 10), DECOR.potM); pot.position.set(1.35, 1.01, CORR - 0.08); r.decorG.add(pot);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), DECOR.leafM); bush.position.set(1.35, 1.28, CORR - 0.08); r.decorG.add(bush);
    ['#ff4d6d', '#ffd60a', '#ffffff'].forEach((c, k) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: c })); f.position.set(1.25 + k * 0.1, 1.42, CORR + 0.05); r.decorG.add(f); });
  }
  if (d.co) {
    DECOR.flagTex = DECOR.flagTex || canvasTex(96, 64, (g, w, h) => {
      g.fillStyle = '#da251d'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffde00'; g.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? 9 : 22; g.lineTo(w / 2 + Math.cos(a) * rr, h / 2 + 2 + Math.sin(a) * rr); }
      g.closePath(); g.fill();
    });
    const fg = new THREE.Group(); fg.position.set(-1.55, 0.9, CORR - 0.05); fg.rotation.x = 0.55; r.decorG.add(fg);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.3, 6), DECOR.poleM); pole.position.y = 0.65; fg.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), new THREE.MeshStandardMaterial({ map: DECOR.flagTex, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: DECOR.flagTex, emissiveIntensity: 0.25 }));
    flag.position.set(0.31, 1.08, 0); fg.add(flag); r.flag = flag;
  } else r.flag = null;
  if (d.long) {
    const L = new THREE.Group(); L.position.set(0.2, FLOOR_H - 0.75, CORR - 0.35); r.decorG.add(L);
    const str = box(0.015, 0.3, 0.015, DECOR.goldM); str.position.y = 0.38; L.add(str);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), DECOR.lanternM); b.scale.y = 0.85; L.add(b);
    [0.17, -0.17].forEach((y) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 10), DECOR.goldM); c.position.y = y; L.add(c); });
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff5a3c', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(0.9); L.add(gl);
    r.lantern = L;
  } else r.lantern = null;
  if (d.cua && !t.vip) { r.door.material.map = doorTexOf(d.cua); r.door.material.needsUpdate = true; r.doorPainted = true; }
}
function decorAction(t, pl) {
  const d = t.decor || (t.decor = {});
  let what = null;
  if (/ trong cay | cay canh | trong hoa | chau cay /.test(pl)) { if (d.cay) return; d.cay = true; what = ['🌿', 'đặt chậu cây trước phòng']; }
  else if (/ treo co | co do sao vang | cam co /.test(pl)) { if (d.co) return; d.co = true; what = ['🚩', 'treo cờ trước phòng']; }
  else if (/ den long | treo den /.test(pl)) { if (d.long) return; d.long = true; what = ['🏮', 'treo đèn lồng trước cửa']; }
  else {
    const m = pl.match(/ son (?:lai )?(?:cua |cua phong )?(hong|do|xanh la|xanh|vang|tim|trang|den|cam|nau) /);
    if (m) { if (!cooled(t, 'son', 20000)) return; d.cua = DOOR_COLORS[m[1]]; what = ['🎨', `sơn cửa màu ${m[1].replace('xanh la', 'xanh lá').replace(/^do$/, 'đỏ').replace('vang', 'vàng').replace('tim', 'tím').replace('trang', 'trắng').replace('den', 'đen').replace('nau', 'nâu').replace('hong', 'hồng')}`]; }
    else if (/ don phong | go trang tri | bo trang tri /.test(pl)) { if (!Object.keys(d).length) return; t.decor = {}; what = ['🧹', 'dọn sạch đồ trang trí']; if (t.room.doorPainted && !t.vip) { t.room.door.material.map = doorTexOf(t.room.doorColor); t.room.door.material.needsUpdate = true; t.room.doorPainted = false; } }
  }
  if (!what) return;
  applyDecor(t); floatEmoji(t.room, what[0]); toast(`${what[0]} ${t.name} ${what[1]}`); sfx.knock(); saveDirty = true;
  return true;
}

// ---------- Bảng tuần ----------
const weekKey = () => { const d = new Date(), j = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = j.getUTCDay() || 7; j.setUTCDate(j.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(j.getUTCFullYear(), 0, 1)); return `${j.getUTCFullYear()}-W${Math.ceil(((j - y0) / 864e5 + 1) / 7)}`; };
const week = SAVED.week?.key === weekKey() ? { key: SAVED.week.key, coins: { ...SAVED.week.coins } } : { key: weekKey(), coins: {} };
function weekAdd(t, coins) { if (week.key !== weekKey()) { week.key = weekKey(); week.coins = {}; } const c = week.coins[t.id]; week.coins[t.id] = [t.name, (c ? c[1] : 0) + coins]; saveDirty = true; }

// ---------- Gợi ý lệnh theo lúc: đang có sự kiện thì chỉ nhắc lệnh của sự kiện ----------
const EVENT_HINT = {
  matdien: '❤️ <b>Thả tim</b> để chạy máy phát điện · 🎁 quà góp nhiều hơn',
  mua: '☔ Comment <b>"cất"</b> để cất quần áo vào phòng',
  trom: '🩴 Comment <b>"bắt"</b> để ném dép · ❤️ tim cũng góp sức',
  do: '🧠 Comment <b>đáp án</b> · ai đúng đầu tiên thắng',
  cupnuoc: '❤️ <b>Thả tim</b> để gọi xe bồn chở nước tới',
  gio: '👕 Comment <b>"nhặt"</b> để chạy xuống nhặt quần áo',
  muathi: '❤️ <b>Thả tim</b> · comment <b>"học bài"</b> để cả xóm ôn thi',
};
const HINT_LINES = [
  '🥖 Comment <b>"bánh mì"</b> hoặc <b>"xôi"</b> để mua · 🍵 <b>"trà đá"</b> để xuống quán ngồi',
  '🎤 <b>"hát"</b> · 💃 <b>"quẩy"</b> · 📚 <b>"học"</b> · 💤 <b>"ngủ"</b> · 👋 <b>"chào"</b> · 🍻 <b>"dô"</b>',
  '🌿 <b>"trồng cây"</b> · 🚩 <b>"treo cờ"</b> · 🏮 <b>"đèn lồng"</b> · 🎨 <b>"sơn cửa hồng"</b> trang trí phòng',
  '🛵 <b>"trà sữa"</b> · <b>"đặt cơm"</b> gọi shipper · 🏸 <b>"đá cầu"</b> · 🍦 <b>"kem"</b> · <b>"chè"</b>',
  '🏆 Thi đua 3 tòa: ❤️ tim, 💬 comment, 🎁 quà đều cộng điểm cho tòa của bạn',
  '🔢 Comment <b>một con số 00–99</b> · mỗi phút đại lý vé số quay số may mắn, ai gần nhất được khen',
  '🛒 <b>"tạp hóa"</b> · 💊 <b>"mua thuốc"</b> · 🧺 <b>"giặt đồ"</b> · 🖨️ <b>"photo"</b> · 🍛 <b>"cơm"</b> · 🔧 <b>"sửa xe"</b>',
];
const HOW_TO = [
  'Ai mới vào xóm thì comment trồng cây, treo cờ hoặc đèn lồng để trang trí phòng mình nhé!',
  'Thả tim, comment hay tặng quà đều cộng điểm cho tòa của mình. Tòa nào nhiều điểm nhất được đội vương miện!',
  'Cả xóm cùng thả tim để xóm lên cấp, lên cấp là có đồ mới cho cả xóm đấy!',
  'Đói thì comment trà sữa hay đặt cơm, shipper mang tới tận cổng.',
];
{
  const el = document.getElementById('shops');
  let i = 0, shown = '';
  el.style.transition = 'opacity .4s';
  const show = (html) => { if (html === shown) return; shown = html; el.style.opacity = 0; setTimeout(() => { el.innerHTML = html; el.style.opacity = 1; }, 420); };
  let tick = 0;
  setInterval(() => { // kiểm tra mỗi giây; dòng thường đổi mỗi 7 giây
    tick++;
    if (event && EVENT_HINT[event.kind]) return show(EVENT_HINT[event.kind]);
    if (hc?.state?.().rong === 'stop') return show('🍦 Xe kem chè đang đỗ trước cổng · comment <b>"kem"</b> hoặc <b>"chè"</b> để mua');
    if (tick % 7 && HINT_LINES.includes(shown)) return;
    i = (i + 1) % HINT_LINES.length; show(HINT_LINES[i]);
  }, 1000);
}

// ---------- Lịch sự kiện: chọn theo độ đông, có chút ngẫu nhiên ----------
const jitter = () => rand(0.8, 1.25);
const activeTenants = (ms = 180000) => { const now = performance.now(); let n = 0; tenants.forEach((t) => { if (now - t.last < ms) n++; }); return n; };
let eventCheckAt = 0;
// trả về true nếu đang rảnh (cho hoạt cảnh trong hoatcanh.js bắt đầu sự kiện của nó)
function scheduleEvents(now) {
  if (event || now < calmUntil) return false;
  if (now < eventCheckAt) return false;
  eventCheckAt = now + 1000;
  const due = [['matdien', nextPowerCut], ['mua', nextRain], ['trom', nextThief], ['do', nextQuiz]].filter(([, t]) => now > t).map(([k]) => k);
  if (!due.length) return true;
  const crowd = activeTenants();
  const BIG = ['matdien', 'trom']; // cần nhiều người góp tim / ném dép
  const ok = crowd >= 3 ? due : due.filter((k) => !BIG.includes(k));
  if (!ok.length) { if (due.includes('matdien')) nextPowerCut = now + 60000; if (due.includes('trom')) nextThief = now + 60000; return false; }
  const wt = (k) => (crowd >= 6 ? { matdien: 3, trom: 3, mua: 2, do: 1 } : { matdien: 1, trom: 1, mua: 2, do: 3 })[k];
  let r = Math.random() * ok.reduce((a, k) => a + wt(k), 0), kind = ok[0];
  for (const k of ok) { r -= wt(k); if (r <= 0) { kind = k; break; } }
  ({ matdien: startPowerCut, mua: startRain, trom: startThief, do: startQuiz })[kind]();
  return false;
}

// ---------- cập nhật mỗi khung hình ----------
function updateXom(dt, now) {
  const t = now / 1000, night = 1 - dayS;
  if (xomFx.bulbs) xomFx.bulbs.forEach((m, k) => m.color.setHSL((t * 0.08 + k * 0.25) % 1, 1, !power ? 0.04 : (Math.sin(t * 2.2 + k * 1.6) > -0.2 ? 0.55 : 0.3) * (0.45 + 0.55 * night)));
  if (xomFx.wifiLed) xomFx.wifiLed.material.opacity = power && Math.floor(t * 3) % 3 ? 0.9 : 0.15;
  if (xomFx.neon) xomFx.neon.material.opacity = !power ? 0.08 : (Math.random() < 0.004 ? 0.25 : 0.55 + 0.45 * night);
  xomFx.lanterns.forEach((l) => { l.L.rotation.z = Math.sin(t * 0.9 + l.ph) * 0.08; l.gl.material.opacity = power ? 0.15 + 0.5 * night : 0; });
  if (xomFx.nightFw && !event && dayS < 0.3 && now > xomFx.nextFw) { xomFx.nextFw = now + rand(180000, 260000); for (let i = 0; i < 3; i++) setTimeout(firework, i * 400); }
  const crowns = team.crowns; for (const k in crowns) if (crowns[k].visible) crowns[k].position.y = TOP + 2.6 + Math.sin(t * 2) * 0.15;
  for (const r of rooms) if (r.flag) r.flag.rotation.y = Math.sin(t * 3 + r.idx) * 0.25;
  if (now > team.until) endTeamRound();
}

// =====================================================================
//  Xử lý sự kiện TikTok
// =====================================================================
function onChat(ev) {
  const text = cleanText(ev.text);
  const t = getTenant(ev);
  t.comments++;
  if (text) say(t.room, text);
  const pl = plain(ev.text);
  const banhMiSpot = () => new THREE.Vector3(BANHMI_X + rand(-0.8, 0.8), 0.2, 4.05);
  if (/ banh mi | bm /.test(pl)) goToStall(t, '🥖', banhMiSpot(), () => buyBanhMi(t, 'banhmi'));
  else if (/ xoi /.test(pl)) goToStall(t, '🍙', banhMiSpot(), () => buyBanhMi(t, 'xoi'));
  const hut = / dieu cay | dieucay | thuoc lao | thuoclao /.test(pl);
  if (hut || / tra da | trada /.test(pl)) goToTea(t, hut);
  if (veSo.group && / ve so | xo so | xoso | veso | do so /.test(pl)) goToStall(t, '🎫', veSoSpot(), () => {
    STALL_FLOAT(veSo.group, '🎫', 2.6);
    toast(`🎫 ${t.name} ra đại lý xem bảng kết quả xổ số`);
  });
  const shop = / tap hoa | mi tom | nuoc ngot | bim bim / .test(pl) ? 'taphoa'
    : !hut && / hieu thuoc | nha thuoc | mua thuoc | thuoc cam | om | sot | dau dau / .test(pl) ? 'thuoc'
      : / giat la | giat do | giat / .test(pl) ? 'giatla'
        : / photo | in tai lieu | de cuong / .test(pl) ? 'photo'
          : / com | com rang | com binh dan / .test(pl) ? 'com'
            : / sua xe | va sam | bom lop / .test(pl) ? 'suaxe' : null;
  if (shop && cooled(t, 'shop', 5000)) goToShop(t, shop);
  roomAction(t, ev.text, pl);
  if (event && event.kind === 'trom' && / bat | trom | cuop | nem dep | bat no /.test(pl) && cooled(t, 'bat', 1200)) { throwSlipper(t); hitThief(t, 1); }
  checkQuiz(t, pl);
  guessQuaySo(t, pl);
  if (event && event.kind === 'mua' && / cat /.test(plain(ev.text)) && !t.savedClothes) {
    t.savedClothes = true;
    t.room.clothes.visible = false;
    floatEmoji(t.room, '👕');
    toast(`👕 ${t.name} đã cất đồ vào phòng`);
  }
  decorAction(t, pl);
  if (cooled(t, 'pt', 3000)) { addPoints(2); teamAdd(t, 3); }
  hc?.onChat(t, pl, text);
}
function onLike(ev) {
  const t = getTenant(ev);
  const n = ev.count || 1;
  wake(t);
  hitThief(t, n * 0.05); // tim cũng góp sức bắt trộm, nhưng comment "bắt" mạnh hơn
  t.likes = (t.likes || 0) + n; addPoints(n); teamAdd(t, n);
  if (hc?.onLike(t, n)) { totalLikes += n; return; }
  totalLikes += n;
  const before = Math.floor((totalLikes - n) / 5);
  noodles = Math.floor(totalLikes / 5);
  if (noodles !== before) updateCounts();
  if (power) { t.room.steamAcc += n; if (t.room.steamAcc >= 3) { steam(t.room, Math.min(4, Math.floor(t.room.steamAcc / 3))); t.room.steamAcc = 0; if (Math.random() < 0.3) sfx.slurp(); } }
  if (event && event.kind === 'matdien') {
    event.have += n;
    if (Math.random() < 0.5) { const v = new THREE.Vector3(); t.room.glass.getWorldPosition(v); spawnSprite(heartTex, v.add(new THREE.Vector3(0, 0.5, 1)), { vel: new THREE.Vector3(0, 1.2, 0), life: 1.2, size: 0.5 }); }
    updateEventBar();
    if (event.have >= event.need) endPowerCut(true);
  }
}
function onGift(ev) {
  const t = getTenant(ev);
  const coins = Math.max(1, ev.coins || 1);
  t.coins += coins;
  addPoints(coins * 10); teamAdd(t, coins * 10); weekAdd(t, coins);
  hc?.onGift(t, coins);
  const r = t.room;
  const gname = cleanName(ev.gift);
  wake(t);
  hitThief(t, coins * 5);
  if (event && event.kind === 'matdien') { event.have += coins * 8; updateEventBar(); if (event.have >= event.need) setTimeout(() => event && endPowerCut(true), 300); }
  if (r.person) r.person.jumpUntil = performance.now() + 1500;
  floatEmoji(r, '💡');
  sfx.coin();
  if (coins >= 10) focusRoom(r, coins >= 100 ? 4500 : 3000);
  if (coins >= 500) {
    t.vip = true; r.vip.visible = true; r.fairy.visible = true; t.lights = true;
    r.door.material.map = doorTex('#c9a227'); r.door.material.needsUpdate = true;
    renderPlate(r);
    banner(`👑 ${t.name} tặng ${gname}`, `Lên đời PHÒNG VIP!`, 4500);
    speak(`Trời ơi! ${t.name} lên đời phòng VIP rồi! Cả xóm vỗ tay đi!`, true);
    sfx.big(); for (let i = 0; i < 8; i++) setTimeout(firework, i * 280);
    // màn riêng của phòng VIP: máy quay lia vào, mưa kim tuyến vàng quanh phòng, xe hoa chạy qua cổng
    focusRoom(r, 5500, true);
    for (let i = 0; i < 40; i++) setTimeout(() => spawnSprite(glowTex, roomPt(r, rand(-1.8, 1.8), rand(2.6, 4.2), rand(1.0, 2.2)), { vel: V3(rand(-0.3, 0.3), rand(-0.9, -0.3), 0), life: rand(1.4, 2.2), size: rand(0.2, 0.4), grow: -0.1, color: pick(['#ffd76a', '#fff3b0', '#ffb703']), additive: true }), i * 60);
    hc?.xeHoa(t);
    tenants.forEach((x) => x.room.person && setTimeout(() => spawnSprite(teaTex, x.room.person.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 2.95, 0)), { vel: new THREE.Vector3(0, 0.25, 0), life: 6, size: 0.75, grow: 0 }), rand(0, 800)));
  } else if (coins >= 100) {
    t.lights = true; r.fairy.visible = true;
    banner(`🧋 ${t.name} tặng ${gname}`, 'Bao cả xóm trà sữa! Lên sân thượng ăn lẩu!', 4000);
    hc?.lau(t);
    speak(`Ối giời, ${t.name} bao cả xóm trà sữa! Cả xóm cảm ơn đi nào!`, true);
    sfx.big(); for (let i = 0; i < 4; i++) setTimeout(firework, i * 320);
    tenants.forEach((x) => x.room.person && setTimeout(() => spawnSprite(teaTex, x.room.person.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 2.95, 0)), { vel: new THREE.Vector3(0, 0.25, 0), life: 6, size: 0.75, grow: 0 }), rand(0, 800)));
  } else if (coins >= 10) {
    t.lights = true; r.fairy.visible = true;
    banner(`💡 ${t.name} tặng ${gname}`, `Đóng tiền điện, treo đèn nháy!`);
    speak(`Cảm ơn ${t.name} đã đóng tiền điện nhé. Gương mẫu quá!`, true);
  } else {
    banner(`💧 ${t.name} tặng ${gname}`, `Đóng tiền nước`, 2600);
    if (!t.thanked || performance.now() - t.thanked > 30000) { t.thanked = performance.now(); speak(`Cảm ơn ${t.name} nhé!`, true); }
  }
}
function onFollow(ev) { toast(`💛 ${cleanName(ev.name)} đã theo dõi kênh`); addPoints(20); hc?.onFollow(ev); }
function onShare(ev) { const n = cleanName(ev.name); toast(`🔁 ${n} đã chia sẻ live`); addPoints(20); if (Math.random() < 0.5) speak(`Cảm ơn ${n} đã rủ thêm bạn vào xóm!`); hc?.onShare(ev); }

function handle(ev) {
  switch (ev.type) {
    case 'chat': return onChat(ev);
    case 'like': return onLike(ev);
    case 'gift': return onGift(ev);
    case 'follow': return onFollow(ev);
    case 'share': return onShare(ev);
    case 'join': return onJoin(ev);
    case 'status': document.getElementById('status').textContent = ev.text; return;
    case 'config': return applyConfig(ev.config);
    case 'control': return onControl(ev);
  }
}

// =====================================================================
//  Lệnh từ trang quản trị (/admin)
// =====================================================================
function applyConfig(c) {
  if (!c) return;
  CFG = { ...CFG, ...c };
  XH = CFG.xungHo || 'chú';
  BANNED = (CFG.tuCam || []).map((w) => plain(w).trim()).filter(Boolean);
  // (tiêu đề đã bỏ)
  document.querySelector('#landlady .who').textContent = `🧔 ${CFG.tenChuTro}`;
  sfx.applyVolumes();
  sfx.changeMusic();
  if ('cauDo' in c) quizBag = []; // câu đố mới áp dụng từ câu kế tiếp
  if ('bloom' in c) { if (bloomWanted()) setupBloom(); else dropBloom(); }
  if ('trangTriLe' in c) hc?.applyConfig();
}
function onControl(ev) {
  switch (ev.action) {
    case 'speak': return speak(ev.text, true);
    case 'thongBao': if ((CFG.thongBaoChuTro || []).length) speak(pick(CFG.thongBaoChuTro), true); return;
    case 'matdien':
    case 'mua':
    case 'trom':
    case 'do':
      if (event) return toast('Đang có sự kiện khác, đợi xong đã nhé');
      if (!tenants.size) return toast('Chưa có ai thuê phòng, chưa bắt đầu sự kiện được');
      return window.__xt.event(ev.action);
    case 'ketThucSuKien':
      if (event?.kind === 'matdien') endPowerCut(false);
      else if (event?.kind === 'mua') endRain();
      else if (event?.kind === 'trom') endThief(false);
      else if (event?.kind === 'do') endQuiz(null);
      else hc?.endEvent();
      return;
    case 'thiDua': return endTeamRound();
    case 'xoaDuLieu':
      known.clear(); xomPoints = 0; week.coins = {}; tenants.forEach((t) => { t.decor = {}; t.vip = false; t.lights = false; t.total = 0; });
      saveNow(); toast('🗑 Đã xóa dữ liệu xóm (cấp xóm, người thuê cũ, bảng tuần). Tải lại để về cấp 1.'); return;
    case 'phaoHoa': for (let i = 0; i < 5; i++) setTimeout(firework, i * 280); sfx.big(); return;
    case 'ngayDem': return setDay(!dayTarget);
    case 'reload': location.reload(); return;
    default: if (hc?.control(ev.action)) return;
  }
}
let liveWs = null;
function sendHello() {
  if (liveWs?.readyState !== 1) return;
  liveWs.send(JSON.stringify({ type: 'hello', w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1, render: renderer.getPixelRatio(), xoay: XOAY, obs: !!window.obsstudio, ua: navigator.userAgent.slice(0, 160) }));
}
addEventListener('resize', () => setTimeout(sendHello, 300));
function connect() {
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  // báo kích thước khung cho trang quản trị (để biết LIVE Studio có vẽ nguồn đúng 1080×1920 không)
  liveWs = ws;
  ws.onopen = sendHello;
  ws.onmessage = (m) => { try { handle(JSON.parse(m.data)); } catch (e) { console.error(e); } };
  ws.onclose = () => setTimeout(connect, 3000);
}
connect();
// thử nhanh: window.__xt.gift('Tên', 100) · __xt.event('matdien' | 'mua')
window.__xt = {
  chat: (name, text) => handle({ type: 'chat', id: name, name, text }),
  like: (name, count = 10) => handle({ type: 'like', id: name, name, count }),
  gift: (name, coins = 1, gift = 'Rose') => handle({ type: 'gift', id: name, name, gift, count: 1, coins }),
  event: (k) => (k === 'mua' ? startRain() : k === 'trom' ? startThief() : k === 'do' ? startQuiz() : k === 'matdien' ? startPowerCut() : hc?.control(k)),
  focus: (name, ms = 8000) => { const t = [...tenants.values()].find((x) => x.name === name); if (t) focusRoom(t.room, ms, true); return !!t; },
  hc: (a) => hc?.control(a), hcState: () => hc?.state(), points: (n = 1000) => addPoints(n), thiDua: () => endTeamRound(),
  rooms, camera,
  join: (name) => handle({ type: 'join', id: name, name }),
  leave: (name) => { const t = [...tenants.values()].find((x) => x.name === name); if (t) t.last = -1e12; },
  rider: () => { spawnRider(); traffic[traffic.length - 1].g.position.x = 4; },
  day: (on) => setDay(on === undefined ? !dayTarget : !!on),
  state: () => ({ event, tenants: tenants.size, power, traffic: traffic.map((c) => Math.round(c.g.position.x)), plane: plane.visible, bus: [bus.state, Math.round(bus.x * 10) / 10, bus.group.visible], walkers: walkers.length, arriving: arriving.length, waiting: waitingAtStop.length }),
};

// =====================================================================
//  Máy quay: lia lại gần phòng vừa tặng quà
// =====================================================================
let focus = null; // {pos, look, until}
let lastFocus = -1e9;
function focusAt(pos, look, ms) {
  if (!CFG.liaMayQuay) return; // mặc định giữ toàn cảnh xóm trọ
  const now = performance.now();
  if ((focus && now < focus.until - 800) || now - lastFocus < 6000) return;
  lastFocus = now; focus = { pos, look, until: now + ms };
}
function focusRoom(r, ms, force = false) { // force: luôn zoom (người trúng quay số), bỏ qua liaMayQuay và thời gian chờ
  if (!force && !CFG.liaMayQuay) return;
  const now = performance.now();
  if (!force && ((focus && now < focus.until - 800) || now - lastFocus < 9000)) return;
  lastFocus = now;
  const look = roomPt(r, 0.2, 1.4, 1);
  const pos = roomPt(r, 0.6, 2.2, 11); pos.z = Math.max(pos.z, look.z + 6);
  focus = { pos, look, until: performance.now() + ms };
}
const curLook = LOOK_HOME.clone();

// =====================================================================
//  Vòng lặp
// =====================================================================
// =====================================================================
//  Hoạt cảnh thêm (hoatcanh.js): shipper, karaoke & đá cầu & lẩu trên sân thượng, xe kem chè, ba gác (follow),
//  mèo Mướp (share), chủ trọ thu tiền, cúp nước, gió to, mùa thi, xe hoa (quà 500+), trang trí ngày lễ
// =====================================================================
try {
  hc = taoHoatCanh({
    THREE, scene, M, box, rand, pick, clamp, sfx, esc, params,
    cfg: () => CFG, xh: () => XH, dayK: () => dayS,
    PERSON_SIZE, FLOORS, COLS, ROOM_W, FLOOR_H, CORR, TOP, BW, MID_W, MID_Z, SIDEWALK_Z, GATE, BUS_Z, floorBase,
    blocks: { A: blockA, B: blockB, C: blockC }, roomPt,
    rooms, tenants, getTenant, makePerson, makeWalker, scooter, nonLa, sitPose, signTexOf, canvasTex, emojiTex, glowTex, steamTex,
    spawnSprite, firework, speak, toast, banner, showEvent, eventEl, labelsEl, toScreen, landlady, yard, bus, clouds, moonD, moonS,
    voiceFree: () => !voice.busy && !voice.q.length,
    ev: { get: () => event, set: (e) => { event = e; } },
    afterEvent: () => { calmUntil = performance.now() + 20000; },
  });
} catch (e) { console.error('[hoatcanh] không khởi tạo được', e); hc = null; }

const _camWant = new THREE.Vector3();
const DT_MAX = Number(params.get('dtmax')) || 0.1; // ?dtmax=1 chỉ dùng khi thử trên máy chậm
let last = performance.now();
function frame(now) {
  const dt = Math.min(DT_MAX, (now - last) / 1000); last = now;
  const tsec = now / 1000;

  // sự kiện theo giờ
  const eventFree = scheduleEvents(now) && activeTenants() >= 2; // nghỉ 20 giây giữa hai sự kiện
  if (event && event.kind === 'matdien' && now > event.until) endPowerCut(false);
  if (event && event.kind === 'mua' && now > event.until) endRain();
  if (event && event.kind === 'trom' && now > event.until) endThief(false);
  if (event && event.kind === 'do' && now > event.until) endQuiz(null);
  if (event) updateEventBar();
  if (!event && now > nextNotice && !voice.busy && !voice.q.length && now - voice.lastEnd > 20000) {
    nextNotice = now + CFG.giayMoiThongBao * 1000;
    const list = CFG.thongBaoChuTro || [];
    speak(!list.length || Math.random() < 0.3 ? pick(HOW_TO) : pick(list)); // thỉnh thoảng nhắc cách chơi
  }

  // máy quay
  const wantPos = focus && now < focus.until ? focus.pos : _camWant.set(Math.sin(tsec * 0.15) * 0.35, Math.sin(tsec * 0.11) * 0.15, 0).add(CAM_HOME);
  const wantLook = focus && now < focus.until ? focus.look : LOOK_HOME;
  if (focus && now >= focus.until) focus = null;
  camera.position.lerp(wantPos, 1 - Math.exp(-dt * 2.2));
  curLook.lerp(wantLook, 1 - Math.exp(-dt * 2.6));
  camera.lookAt(curLook);

  // nhân vật
  for (const r of rooms) {
    const p = r.person; if (!p) continue;
    p.enterT = Math.min(1, p.enterT + dt * 2);
    const talking = now < p.talkUntil, jumping = now < p.jumpUntil;
    const dancing = now < (p.danceUntil || 0), studying = now < (p.studyUntil || 0), sleeping = !!(r.tenant && r.tenant.sleeping);
    p.group.scale.setScalar(PERSON_SIZE * (0.4 + 0.6 * p.enterT));
    const hop = jumping ? Math.abs(Math.sin(now / 130)) * 0.45 : dancing ? Math.abs(Math.sin(now / 190)) * 0.22 : 0;
    p.group.position.y = r.base + 0.02 + hop;
    if (p.shadow) p.shadow.position.y = 0.015 - hop / PERSON_SIZE; // bóng nằm yên dưới đất khi nhảy
    // lúc rảnh: lướt điện thoại, vươn vai, ngó nghiêng
    const busy = talking || jumping || dancing || studying || sleeping || now < (p.singUntil || 0);
    if (busy) p.idle = null;
    else if (!p.idle && now > p.nextIdle) { p.idle = { kind: pick(['phone', 'phone', 'stretch', 'look']), until: now + rand(3500, 8000) }; p.nextIdle = p.idle.until + rand(6000, 18000); }
    if (p.idle && now > p.idle.until) p.idle = null;
    const idle = p.idle?.kind;
    p.phone.visible = idle === 'phone';
    p.arms[1].rotation.x = idle === 'phone' ? -1.15 : 0;
    p.headG.rotation.y = idle === 'look' ? Math.sin(now / 600 + p.phase) * 0.7 : 0;
    p.group.rotation.y = (p.baseRotY || 0) + (dancing ? Math.sin(now / 260 + p.phase) * 0.9 : 0);
    p.body.position.y = 0.92 + Math.sin(tsec * (sleeping ? 0.8 : 2) + p.phase) * 0.015;
    p.headG.rotation.z = sleeping ? 0.45 : Math.sin(tsec * 1.3 + p.phase) * 0.06;
    p.headG.rotation.x = studying ? 0.4 : sleeping ? 0.25 : idle === 'phone' ? 0.32 : 0;
    faceFor(p, now, { talking, jumping, dancing, sleeping, studying });
    if (dancing) {
      p.arms[1].rotation.z = -2.5 + Math.sin(now / 150) * 0.6;
      p.arms[0].rotation.z = 2.5 + Math.sin(now / 150 + 1.6) * 0.6;
    } else {
      const st = idle === 'stretch' ? Math.min(1, Math.sin(((p.idle.until - now) / 1500) * Math.PI) * 1.4) : 0;
      p.arms[1].rotation.z = talking || jumping ? -2.4 + Math.sin(now / 110) * 0.5 : studying ? -0.6 + Math.sin(now / 90) * 0.15 : idle === 'phone' ? 0.25 : 0.12 - st * 2.8;
      p.arms[0].rotation.z = jumping ? 2.4 - Math.sin(now / 110) * 0.5 : -0.12 + st * 2.8;
    }
    if (r.tenant && r.tenant.lights && r.fairy.visible) r.fairyMats.forEach((m, k) => (m.color.setHSL(((tsec * 0.3 + k * 0.25) % 1), 1, (Math.sin(tsec * 6 + k * 1.7) > 0 ? 0.6 : 0.25))));
  }
  // bà chủ trọ quạt và nói
  const llTalk = now < landlady.talkUntil;
  faceFor(landlady, now, { talking: llTalk });
  landlady.arms[1].rotation.z = llTalk ? -1.2 + Math.sin(now / 160) * 0.5 : -0.4 + Math.sin(tsec * 3) * 0.15;
  landlady.headG.rotation.y = Math.sin(tsec * 0.6) * 0.3;
  landlady.fanBlades.rotation.z += dt * 18;
  updateStalls(dt, now);
  updateQuaySo(now);
  updateYard(dt, now);
  updateFront(dt, now);
  updateRoomActions(dt, now);
  updateThief(dt, now);
  updateBus(dt, now);
  updateWalkers(dt, now);

  // đèn pin điện thoại khi mất điện
  if (!power && Math.random() < 0.08) {
    const occ = rooms.filter((r) => r.person);
    if (occ.length) { const r = pick(occ); spawnSprite(glowTex, roomPt(r, 0.35, 1.0, 1.25), { life: 0.9, size: 0.6, grow: 0.2, color: '#e8f4ff', additive: true }); }
  }

  updateDayNight(dt, now);
  updateBackground(dt, now);
  if (rain.visible) updateRain(dt);
  updateXom(dt, now);
  if (hc) { try { hc.update(dt, now, eventFree); } catch (e) { console.error('[hoatcanh]', e); } }
  updateSprites(dt);
  draw();
  placeLabels();
  autoQuality(now);
  requestAnimationFrame(frame);
}
setupBloom();
requestAnimationFrame(frame);

// ?event=matdien hoặc ?event=mua: bật sự kiện ngay khi xóm có người (để thử)
if (params.get('event')) {
  const tryEvent = () => (tenants.size ? window.__xt.event(params.get('event')) : setTimeout(tryEvent, 500));
  setTimeout(tryEvent, 1500);
}
