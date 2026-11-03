import * as THREE from 'three';

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
  phutGiuaCacLanTrom: 6, phutGiuaCacLanDo: 4, cauDo: [],
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
document.getElementById('title').textContent = CFG.tenXom;
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
const renderScale = () => (params.has('nethd') ? 1 : clamp(Math.max(2, fitScale() * (devicePixelRatio || 1)), 1, 2));
renderer.setPixelRatio(renderScale());
renderer.setSize(W, H, false);
addEventListener('resize', () => {
  const s = renderScale();
  if (Math.abs(s - renderer.getPixelRatio()) > 0.01) { renderer.setPixelRatio(s); renderer.setSize(W, H, false); }
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b1030');
scene.fog = new THREE.Fog('#0b1030', 40, 90);

const camera = new THREE.PerspectiveCamera(57, W / H, 0.1, 200);
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
const gateTex = canvasTex(256, 192, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.strokeStyle = '#1c2a33'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  g.lineWidth = 4; for (let x = 16; x < w; x += 14) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, 40); g.lineTo(w, 40); g.stroke();
});
const signTex = canvasTex(1024, 220, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d8352a'); gr.addColorStop(1, '#8e1a10');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ffd76a'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = '#ffe58a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 92px "Be Vietnam Pro", sans-serif'; g.fillText(CFG.tenXom.toUpperCase().replace('XÓM ', 'NHÀ '), w / 2, 92);
  g.font = '800 46px "Be Vietnam Pro", sans-serif'; g.fillStyle = '#fff'; g.fillText('CÒN PHÒNG · GIÁ RẺ · GẦN TRƯỜNG', w / 2, 170);
});
const glowTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
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

// ---------- Kích thước tòa nhà ----------
const GROUND_H = 3.6, FLOOR_H = 3.0, ROOM_W = 3.4;
const FLOORS = clamp(Math.round(CFG.soTang) || 5, 2, 8);
const COLS = clamp(Math.round(CFG.soPhongMoiTang) || 5, 2, 8);
const BW = COLS * ROOM_W + 1.2;
const CORR = 1.8;                               // hành lang nhô ra
const floorBase = (f) => GROUND_H + (f - 1) * FLOOR_H; // f = 1..FLOORS
const colX = (c) => (c - (COLS - 1) / 2) * ROOM_W;
const TOP = floorBase(FLOORS) + FLOOR_H;
const POLE_X = BW / 2 + 1.7, LAMP_X = -BW / 2 - 1.4, YARD_X = -BW / 2 + 1.7;
const BANHMI_X = -4.0, TRADA_X = 4.6; // hai quán hai bên cổng

// Máy quay tự lùi xa cho vừa cả tòa nhà: mái ở khoảng y=400px, sân ở khoảng y=1440px trên khung 1080x1920
{
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const needW = BW + 4.8, needH = TOP + 2.2; // cả tòa nhà, chủ trọ, đèn đường, cột điện và bến xe buýt
  const dW = needW / 2 / (tanV * camera.aspect);
  const dH = (needH * H) / (1040 * 2 * tanV);
  const d = Math.max(dW, dH);
  const ppu = H / (2 * d * tanV);
  const lookY = (needH - 1.0) - 380 / ppu; // mái nhà ở khoảng y≈580px (chủ kênh muốn xóm thấp xuống), xóm rộng thì sân lên cao hơn
  LOOK_HOME.set(0.2, lookY, 0);
  CAM_HOME.set(0.8, lookY + 1.8, d + 1.0);
  camera.position.copy(CAM_HOME);
  camera.lookAt(LOOK_HOME);
  camera.far = d + 160; camera.updateProjectionMatrix();
}

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
  const walk = box(BW + 10, 0.3, 4.2, M({ color: '#6d6a63' })); walk.position.set(0, 0.05, CORR + 0.3); scene.add(walk);
  for (let x = -30; x < 30; x += 4) { const l = box(2, 0.05, 0.25, M({ color: '#d8d0a8' })); l.position.set(x, 0.02, 12); scene.add(l); }
}

// nhà hàng xóm hai bên (tối, vài cửa sổ sáng)
const neighborWins = [];
function neighbor(x, w, h, color) {
  const g = new THREE.Group();
  const b = box(w, h, 10, M({ color })); b.position.set(0, h / 2, -3); g.add(b);
  for (let y = 2; y < h - 1; y += 2.8) for (let k = -w / 2 + 1.2; k < w / 2 - 0.6; k += 2.2) {
    const lit = Math.random() < 0.35;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ color: lit ? '#ffcf7a' : '#151a2e' }));
    win.position.set(k, y, 2.01); g.add(win); neighborWins.push(win);
  }
  g.position.x = x; scene.add(g);
}
neighbor(-BW / 2 - 4.2, 7, 21, '#2a2f45');
neighbor(BW / 2 + 4.6, 8, 13, '#30283e');
neighbor(-BW / 2 - 12, 9, 26, '#20253a');
neighbor(BW / 2 + 13, 9, 18, '#252036');

// ---------- Tòa nhà trọ ----------
const building = new THREE.Group(); scene.add(building);
{
  // tường tầng trệt
  const gw = box(BW, GROUND_H, 0.4, M({ map: groundWallTex })); gw.position.set(0, GROUND_H / 2, -0.2); building.add(gw);
  // tường các tầng
  const uw = box(BW, FLOORS * FLOOR_H, 0.4, M({ map: wallTex })); uw.position.set(0, GROUND_H + (FLOORS * FLOOR_H) / 2, -0.2); building.add(uw);
  // khối nhà phía sau (để nhìn nghiêng có chiều sâu)
  const back = box(BW, TOP, 9, M({ color: '#9e8a52' })); back.position.set(0, TOP / 2, -4.9); building.add(back);
  // tường đầu hồi hai bên hành lang
  [-BW / 2 + 0.2, BW / 2 - 0.2].forEach((x) => { const s = box(0.4, TOP - GROUND_H, CORR, M({ map: wallTex })); s.position.set(x, GROUND_H + (TOP - GROUND_H) / 2, CORR / 2); building.add(s); });
  // mái, lan can mái, bồn nước inox, ăng-ten
  const parapet = box(BW + 0.4, 0.8, CORR + 9.4, M({ color: '#8f7b45' })); parapet.position.set(0, TOP + 0.4, -3.8); building.add(parapet);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3, 24), new THREE.MeshStandardMaterial({ color: '#d7dde3', metalness: 0.85, roughness: 0.25 }));
  tank.rotation.z = Math.PI / 2; tank.position.set(-4.5, TOP + 1.9, -1.2); building.add(tank);
  const tankLeg = box(3, 0.6, 1.4, M({ color: '#555' })); tankLeg.position.set(-4.5, TOP + 1.0, -1.2); building.add(tankLeg);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.5), M({ color: '#888' })); ant.position.set(5.5, TOP + 2.2, -1); building.add(ant);
  for (let k = 0; k < 4; k++) { const r = box(1.6 - k * 0.3, 0.05, 0.05, M({ color: '#999' })); r.position.set(5.5, TOP + 2.6 + k * 0.4, -1); building.add(r); }
  // biển hiệu
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.55), new THREE.MeshStandardMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.35 }));
  sign.position.set(0, GROUND_H - 0.95, CORR + 0.02); building.add(sign);
  [-3.3, 3.3].forEach((x) => { const h = box(0.06, 0.9, 0.06, M({ color: '#333' })); h.position.set(x, GROUND_H - 0.45, CORR); building.add(h); });
  // cổng sắt
  const gateBack = box(4.4, 2.5, 0.1, M({ color: '#5a4636', emissive: '#ff9a40', emissiveIntensity: 0.12 })); gateBack.position.set(0, 1.25, 0.02); building.add(gateBack);
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.5), new THREE.MeshStandardMaterial({ map: gateTex, transparent: true, metalness: 0.4, roughness: 0.5 }));
  gate.position.set(0, 1.25, 0.12); building.add(gate);
}

// sàn hành lang, lan can, cột
const railMat = M({ color: '#3a3f48', metalness: 0.4, roughness: 0.6 });
for (let f = 1; f <= FLOORS; f++) {
  const y = floorBase(f);
  const slab = box(BW, 0.25, CORR, M({ color: '#a9a296' })); slab.position.set(0, y - 0.12, CORR / 2); building.add(slab);
  const top = box(BW - 0.6, 0.08, 0.1, railMat); top.position.set(0, y + 0.85, CORR - 0.08); building.add(top);
  const mid = box(BW - 0.6, 0.05, 0.06, railMat); mid.position.set(0, y + 0.42, CORR - 0.08); building.add(mid);
  const NB = Math.round(BW * 3.2);
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.85, 0.04), railMat, NB);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < NB; i++) { m4.makeTranslation(-BW / 2 + 0.45 + i * ((BW - 0.9) / (NB - 1)), y + 0.42, CORR - 0.08); bars.setMatrixAt(i, m4); }
  building.add(bars);
}
// mái che tầng trên cùng
{ const roofSlab = box(BW, 0.25, CORR + 0.3, M({ color: '#8f8778' })); roofSlab.position.set(0, TOP, CORR / 2); building.add(roofSlab); }

// ---------- Phòng ----------
const rooms = [];
const floorLights = [];
for (let f = 1; f <= FLOORS; f++) {
  const l = new THREE.PointLight('#ffb45c', 0, BW * 0.9, 1.1); l.position.set(0, floorBase(f) + 2.1, 1.6); building.add(l); floorLights[f] = l;
}
for (let f = 1; f <= FLOORS; f++) for (let c = 0; c < COLS; c++) {
  const base = floorBase(f), cx = colX(c);
  const g = new THREE.Group(); g.position.set(cx, base, 0); building.add(g);
  const doorColor = pick(['#2f6f9e', '#7a4a2a', '#3d7a52', '#8c3b3b', '#5a5f6e']);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.15), new THREE.MeshStandardMaterial({ map: doorTex(doorColor), roughness: 0.7 }));
  door.position.set(-0.82, 1.08, 0.02); g.add(door);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.95), new THREE.MeshStandardMaterial({ color: '#10142a', emissive: '#ffb45c', emissiveIntensity: 0 }));
  glass.position.set(0.72, 1.65, 0.015); g.add(glass);
  const bars = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.05), new THREE.MeshBasicMaterial({ map: windowBarsTex, transparent: true }));
  bars.position.set(0.72, 1.65, 0.04); g.add(bars);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffb45c', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.set(0.72, 1.65, 0.5); glow.scale.set(3.0, 2.4, 1); g.add(glow);
  // cục nóng điều hoà (một số phòng)
  if ((f + c) % 3 === 0) { const ac = box(0.8, 0.5, 0.3, M({ color: '#e8e8e8' })); ac.position.set(0.72, 2.5, 0.2); g.add(ac); }
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
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), fairyMats[k % 4]);
    b.position.set(-1.55 + k * 0.24, 1.08 + Math.sin((k / 13) * Math.PI) * -0.12, CORR - 0.05); fairy.add(b);
  }
  // biển VIP
  const vip = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.52), new THREE.MeshBasicMaterial({ map: vipTex, transparent: true }));
  vip.position.set(0.72, 2.6, 0.06); vip.visible = false; g.add(vip);

  rooms.push({
    idx: rooms.length, floor: f, col: c, number: `${f}${String(c + 1).padStart(2, '0')}`, group: g, base, cx,
    door, glass, glow, clothes, clothMats, fairy, fairyMats, vip, tenant: null, steamAcc: 0,
  });
}

// ---------- Xe máy, cột điện, đèn đường, dây điện ----------
function scooter(x, z, color, rot) {
  const g = new THREE.Group();
  const body = box(1.5, 0.45, 0.42, M({ color, roughness: 0.4, metalness: 0.3 })); body.position.y = 0.55; g.add(body);
  const seat = box(0.75, 0.14, 0.38, M({ color: '#1b1b1b' })); seat.position.set(-0.2, 0.84, 0); g.add(seat);
  const front = box(0.2, 0.75, 0.4, M({ color, roughness: 0.4, metalness: 0.3 })); front.position.set(0.68, 0.85, 0); front.rotation.z = -0.25; g.add(front);
  const bar = box(0.08, 0.08, 0.7, M({ color: '#222' })); bar.position.set(0.8, 1.25, 0); g.add(bar);
  [-0.55, 0.62].forEach((wx) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.08, 8, 16), M({ color: '#151515' })); w.position.set(wx, 0.28, 0); g.add(w); });
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
  for (let k = 0; k < 6; k++) addWire(P(POLE_X, rand(13, 16.5), 4), P(BW / 2 - 0.2, rand(5, 14), CORR), rand(0.3, 1.2));
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
function makePerson({ shirt = pick(SHIRTS), skin = pick(SKIN), longHair = Math.random() < 0.45, scale = 1.45, glasses = Math.random() < 0.3 } = {}) {
  const g = new THREE.Group();
  const pants = M({ color: pick(['#1f2a44', '#2b2b2b', '#4a4f5a', '#3b4d61']) });
  const shirtM = M({ color: shirt }), skinM = M({ color: skin }), hairM = M({ color: '#141010' });
  const legs = [];
  [-0.11, 0.11].forEach((x) => { const l = box(0.17, 0.62, 0.18, pants); l.position.set(x, 0.31, 0); g.add(l); legs.push(l); });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.32, 4, 10), shirtM); body.position.y = 0.92; body.scale.z = 0.7; g.add(body);
  const arms = [];
  [-1, 1].forEach((s) => {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.3, 1.12, 0); g.add(pivot);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), shirtM); a.position.y = -0.24; pivot.add(a);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skinM); h.position.y = -0.5; pivot.add(h);
    pivot.rotation.z = s * 0.12; arms.push(pivot);
  });
  const headG = new THREE.Group(); headG.position.y = 1.47; g.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 12), skinM); headG.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.305, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM); hair.position.y = 0.02; hair.rotation.x = -0.25; headG.add(hair);
  if (longHair) { const lh = box(0.54, 0.5, 0.16, hairM); lh.position.set(0, -0.14, -0.17); headG.add(lh); }
  const eyeM = new THREE.MeshBasicMaterial({ color: '#111' });
  [-0.1, 0.1].forEach((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeM); e.position.set(x, 0.0, 0.27); headG.add(e); });
  if (glasses) { const gm = new THREE.MeshBasicMaterial({ color: '#222' }); [-0.1, 0.1].forEach((x) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 14), gm); r.position.set(x, 0.0, 0.28); headG.add(r); }); }
  const blushM = new THREE.MeshBasicMaterial({ color: '#ff8a8a', transparent: true, opacity: 0.55 });
  [-0.17, 0.17].forEach((x) => { const b = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), blushM); b.position.set(x, -0.07, 0.255); b.rotation.y = x * 2; headG.add(b); });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI), eyeM); mouth.position.set(0, -0.11, 0.27); mouth.rotation.z = Math.PI; headG.add(mouth);
  g.scale.setScalar(scale);
  return { group: g, arms, legs, headG, body, talkUntil: 0, jumpUntil: 0, phase: rand(0, 6) };
}

// chủ trọ ngồi ở cổng, có ghế nhựa, bàn trà và quạt (cả cụm dời theo bề rộng tòa nhà)
const yard = new THREE.Group(); yard.position.x = YARD_X + 5.6; scene.add(yard);
const landlady = makePerson({ shirt: '#f2f2f2', skin: '#d9a173', longHair: false, glasses: false, scale: 1.3 });
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
  hat.position.y = 0.33; p.headG.add(hat);
}
const stallLights = [];

// ---- xe bánh mì – xôi ----
const banhMi = { group: new THREE.Group(), sold: 0 };
{
  const g = banhMi.group; g.position.set(BANHMI_X, 0.2, 2.75); g.rotation.y = 0.12; g.scale.setScalar(1.3); scene.add(g);
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
  const lamp = new THREE.PointLight('#ffcf70', 7, 4.5, 1.6); lamp.position.set(0, 2.1, 0.6); g.add(lamp); stallLights.push(lamp);
  // cô bán hàng đội nón lá
  const vendor = makePerson({ shirt: '#e76f51', skin: '#e8b48a', longHair: true, glasses: false, scale: 1.25 });
  nonLa(vendor);
  vendor.group.position.set(0.1, -0.2, -0.75); g.add(vendor.group);
  banhMi.vendor = vendor;
}

// ---- quán trà đá vỉa hè ----
const traDa = { group: new THREE.Group(), cups: 0, seats: [] };
{
  const g = traDa.group; g.position.set(TRADA_X, 0.2, 2.75); g.scale.setScalar(1.3); scene.add(g);
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
  const vendor = makePerson({ shirt: '#6a994e', skin: '#d9a173', longHair: true, glasses: false, scale: 1.2 });
  sitPose(vendor); vendor.group.position.set(-0.25, -0.05, -0.75); g.add(vendor.group);
  const vstool = box(0.34, 0.3, 0.34, stoolM); vstool.position.set(-0.25, 0.15, -0.8); g.add(vstool);
  const lamp = new THREE.PointLight('#ffd08a', 6, 4, 1.6); lamp.position.set(0, 1.6, 0.4); g.add(lamp); stallLights.push(lamp);
  const bulb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffd08a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  bulb.position.set(0, 1.7, 0.2); bulb.scale.setScalar(1.2); g.add(bulb); traDa.bulb = bulb;
  traDa.vendor = vendor;
}

// khách ngồi trà đá: người comment "trà đá" xuống quán ngồi một lúc
function sitTea(t) {
  const now = performance.now();
  let seat = traDa.seats.find((s) => s.who && s.who.t === t);
  if (seat) { seat.who.until = now + 45000; return seat; }
  seat = traDa.seats.find((s) => !s.who) || traDa.seats.slice().sort((a, b) => a.who.until - b.who.until)[0];
  if (seat.who) leaveTea(seat);
  const p = makePerson({ scale: 0.95 });
  sitPose(p);
  p.group.position.set(seat.x, 0.18, seat.z); p.group.rotation.y = seat.ry;
  traDa.group.add(p.group);
  const el = document.createElement('div'); el.className = 'plate small'; el.textContent = `🍵 ${t.name}`; labelsEl.appendChild(el);
  seat.who = { t, p, el, until: now + 45000 };
  return seat;
}
function leaveTea(seat) {
  if (!seat.who) return;
  traDa.group.remove(seat.who.p.group); seat.who.el.remove(); seat.who = null;
}
function stallLabelHtml() {
  banhMi.labelEl.innerHTML = `🥖 Đã bán <b>${banhMi.sold}</b> phần`;
  traDa.labelEl.innerHTML = `🍵 Đã rót <b>${traDa.cups}</b> cốc`;
}
function updateStalls(dt, now) {
  const t = now / 1000;
  banhMi.vendor.arms[1].rotation.z = now < (banhMi.busyUntil || 0) ? -1.6 + Math.sin(now / 120) * 0.5 : 0.12 + Math.sin(t * 1.2) * 0.05;
  banhMi.vendor.headG.rotation.y = Math.sin(t * 0.7) * 0.35;
  traDa.vendor.arms[1].rotation.z = now < (traDa.busyUntil || 0) ? -1.3 + Math.sin(now / 140) * 0.4 : -0.3;
  stallLights.forEach((l) => (l.intensity = power ? (l === stallLights[0] ? 7 : 6) : 0));
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
  // biển hướng dẫn trên hai quán
  v.set(BANHMI_X, -0.1, 4.3); let sc = toScreen(v); banhMi.labelEl.style.left = `${sc.x}px`; banhMi.labelEl.style.top = `${sc.y}px`;
  v.set(TRADA_X, -0.1, 4.3); sc = toScreen(v); traDa.labelEl.style.left = `${sc.x}px`; traDa.labelEl.style.top = `${sc.y}px`;
}
const STALL_FLOAT = (group, ch, y) => {
  const v = new THREE.Vector3(0, y, 0); group.localToWorld(v);
  const sc = toScreen(v);
  const el = document.createElement('div'); el.className = 'float'; el.textContent = ch;
  el.style.left = `${sc.x}px`; el.style.top = `${sc.y}px`; labelsEl.appendChild(el); setTimeout(() => el.remove(), 2300);
};
function buyBanhMi(t, what) {
  banhMi.sold++; banhMi.busyUntil = performance.now() + 1500;
  STALL_FLOAT(banhMi.group, what === 'xoi' ? '🍙' : '🥖', 2.2);
  floatEmoji(t.room, what === 'xoi' ? '🍙' : '🥖');
  toast(`${what === 'xoi' ? '🍙' : '🥖'} ${t.name} (P.${t.room.number}) mua ${what === 'xoi' ? 'gói xôi' : 'ổ bánh mì'}`);
  sfx.coin(); stallLabelHtml();
}
function drinkTea(t, hut = false) {
  traDa.cups++; traDa.busyUntil = performance.now() + 1500;
  const seat = sitTea(t);
  STALL_FLOAT(traDa.group, '🍵', 1.6);
  hut = hut && CFG.hienDieuCay !== false;
  toast(hut ? `🍵 ${t.name} xuống quán rít một hơi điếu cày` : `🍵 ${t.name} xuống quán làm cốc trà đá`);
  sfx.knock(); stallLabelHtml();
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
const STOP_X = 7.6, BUS_Z = 6.1, SIDEWALK_Z = 4.35, GATE = new THREE.Vector3(0.5, 0.2, 1.3);
const BUS_LEN = 9, BUS_TOUR = CFG.tuyenBuyt || '32';
// nhà chờ
{
  const g = new THREE.Group(); g.position.set(STOP_X - 0.6, 0.2, 3.75); scene.add(g);
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
  const light = new THREE.PointLight('#bfe3ff', 4, 4, 1.6); light.position.set(0, 2.2, 0.2); g.add(light); stallLights.push(light);
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
  g.scale.setScalar(0.82); g.position.set(bus.x, 0.2, BUS_Z); g.visible = false; scene.add(g);
}

// ---- người đi bộ (xuống xe vào cổng, hoặc ra bến chờ xe) ----
const walkers = [];
function makeWalker(name, from, path, onDone) {
  const p = makePerson({ scale: 1.2 });
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
      if (w.waiting) g.rotation.y = Math.PI * 0.05; // đứng chờ, nhìn ra đường
    }
    if (w.fade) { // đi vào cổng / lên xe: nhỏ dần rồi biến mất
      w.fade -= dt;
      g.scale.setScalar(1.2 * Math.max(0.01, w.fade / 0.5));
      if (w.fade <= 0) { removeWalker(w); continue; }
    }
    g.getWorldPosition(v); v.y += 2.05;
    const sc = toScreen(v); w.el.style.left = `${sc.x}px`; w.el.style.top = `${sc.y}px`;
  }
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
    const due = arriving.length || waitingAtStop.some((w) => w.waiting) || now > bus.nextIdleTrip;
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
    const busyWalking = walkers.some((w) => w.path.length && w.path[w.path.length - 1].z > SIDEWALK_Z + 0.5);
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
function firework() {
  const c = new THREE.Vector3(rand(-9, 9), rand(19, 25), rand(-6, 0));
  const col = pick(['#ffd166', '#ff6b6b', '#4cc9f0', '#c77dff', '#80ff72']);
  for (let i = 0; i < 46; i++) {
    const a = rand(0, Math.PI * 2), e = rand(-1, 1), v = rand(3, 6);
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
  const rider = makePerson({ scale: 1.25 });
  rider.legs.forEach((l) => { l.rotation.x = -1.3; l.position.z = 0.25; l.position.y = 0.35; });
  rider.arms.forEach((a) => { a.rotation.x = -1.2; });
  rider.group.position.set(-0.15, 0.55, 0); rider.group.rotation.y = Math.PI / 2; g.add(rider.group);
  // mũ bảo hiểm
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M({ color: pick(['#e63946', '#ffffff', '#ffd166', '#118ab2']), roughness: 0.4 }));
  helmet.position.y = 0.06; rider.headG.add(helmet);
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
banhMi.labelEl = document.createElement('div'); banhMi.labelEl.className = 'stall'; labelsEl.appendChild(banhMi.labelEl);
traDa.labelEl = document.createElement('div'); traDa.labelEl.className = 'stall'; labelsEl.appendChild(traDa.labelEl);
stallLabelHtml();
rooms.forEach((r) => {
  r.plateEl = document.createElement('div'); r.plateEl.className = 'plate empty'; labelsEl.appendChild(r.plateEl);
  r.bubbleEl = null;
});
const llBubble = document.getElementById('landlady');

function placeLabels() {
  const v = new THREE.Vector3();
  for (const r of rooms) {
    v.set(r.cx - 0.85, r.base + 0.86, CORR); // biển tên treo trên lan can của chính phòng đó
    const s = toScreen(v);
    r.plateEl.style.left = `${s.x}px`; r.plateEl.style.top = `${s.y}px`;
    if (r.bubbleEl && r.tenant) {
      v.set(r.cx + 0.05, r.base + 2.75, 1.0);
      const b = toScreen(v);
      r.bubbleEl.style.left = `${clamp(b.x, 170, W - 170)}px`; r.bubbleEl.style.top = `${b.y}px`; // không để bong bóng tràn mép
    }
  }
}
function floatEmoji(room, ch) {
  const v = new THREE.Vector3(room.cx + 0.05, room.base + 2.3, 1.0);
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
  if (!r.tenant) { el.className = 'plate empty'; el.innerHTML = `<span class="no">${r.number}</span>${COLS >= 7 ? '' : 'Còn phòng'}`; return; }
  el.className = 'plate' + (r.tenant.vip ? ' vip' : '');
  el.innerHTML = `<span class="no">${r.number}</span>${esc(r.tenant.name)}${r.tenant.vip ? ' 👑' : ''}`;
}
rooms.forEach(renderPlate);
updateCounts(); // tổng số phòng theo config ngay từ đầu (HTML ghi sẵn 25)
if (COLS >= 7) document.body.classList.add('compact'); // nhiều phòng mỗi tầng: biển tên nhỏ lại cho khỏi đè nhau

function setRoomLight(r, on) {
  const k = on && power && !(r.tenant && r.tenant.sleeping) ? 1 : 0; // phòng đang ngủ thì tắt đèn
  r.glass.material.emissiveIntensity = 1.6 * k;
  r.glow.material.opacity = 0.55 * k;
  const litOnFloor = rooms.filter((x) => x.floor === r.floor && x.glass.material.emissiveIntensity > 0).length;
  floorLights[r.floor].intensity = power ? 4 + litOnFloor * 7 : 0;
}

const pendingWelcome = [];
function getTenant(ev, create = true) {
  const id = ev.id || ev.name;
  let t = tenants.get(id);
  if (t) { t.name = cleanName(ev.name) || t.name; t.last = performance.now(); return t; }
  if (!create) return null;
  let free = rooms.filter((r) => !r.tenant);
  let r;
  if (free.length) r = pick(free);
  else {
    // xóm đầy: người im lặng lâu nhất (không phải phòng VIP) chuyển trọ
    const cand = rooms.filter((x) => !x.tenant.vip).sort((a, b) => a.tenant.last - b.tenant.last);
    r = cand[0] || rooms.slice().sort((a, b) => a.tenant.last - b.tenant.last)[0];
    const old = r.tenant;
    tenants.delete(old.id);
    removePerson(r);
    sendToBusStop(old.name);
    toast(`📦 ${old.name} chuyển trọ, nhường phòng ${r.number}`);
  }
  t = { id, name: cleanName(ev.name), room: r, last: performance.now(), comments: 0, coins: 0, vip: false, lights: false, savedClothes: false };
  tenants.set(id, t);
  r.tenant = t;
  const p = makePerson();
  p.group.position.set(r.cx + 0.05, r.base + 0.02, 1.0);
  p.group.rotation.y = p.baseRotY = rand(-0.25, 0.25);
  p.enterT = 0;
  building.add(p.group);
  r.person = p;
  r.clothes.visible = Math.random() < 0.55;
  r.fairy.visible = false; r.vip.visible = false;
  setRoomLight(r, true);
  renderPlate(r);
  pendingWelcome.push(t);
  sfx.knock();
  updateCounts();
  return t;
}
function removePerson(r) {
  if (r.person) { building.remove(r.person.group); r.person = null; }
  if (r.bubbleEl) { r.bubbleEl.remove(); r.bubbleEl = null; }
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
  const list = batch.map((t) => `${t.name} phòng ${t.room.number}`);
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
function renderBoard() {
  const all = [...tenants.values()];
  const rich = all.filter((t) => t.coins > 0).sort((a, b) => b.coins - a.coins).slice(0, 4);
  const loud = all.filter((t) => t.comments > 0).sort((a, b) => b.comments - a.comments).slice(0, 3);
  const row = (t, i, v) => `<div class="row"><span class="n">${i + 1}</span><span class="r">P.${t.room.number}</span><span class="name">${esc(t.name)}</span><span class="v">${v}</span></div>`;
  boardEl.innerHTML =
    `<h3>🏅 PHÒNG GƯƠNG MẪU</h3>` + (rich.length ? rich.map((t, i) => row(t, i, `${t.coins}💡`)).join('') : `<div class="empty">Tặng quà để đóng tiền điện!</div>`) +
    `<div class="sep"></div><h3>📢 PHÒNG ỒN NHẤT</h3>` + (loud.length ? loud.map((t, i) => row(t, i, `${t.comments}💬`)).join('') : `<div class="empty">Comment để chém gió!</div>`);
}
renderBoard();
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
  nextPowerCut = performance.now() + CFG.phutGiuaCacLanMatDien * 60000; calmUntil = performance.now() + 20000;
  if (byPlayers) { for (let i = 0; i < 4; i++) setTimeout(firework, i * 300); speak('Có điện rồi! Giỏi quá, cảm ơn cả xóm nhé!', true); }
  else speak(`Thôi được rồi, ${XH} tự sửa cầu dao xong rồi. Có điện rồi nhé cả xóm!`, true);
}
function startRain() {
  if (event || !tenants.size) return;
  const dur = 45;
  event = { kind: 'mua', until: performance.now() + dur * 1000, dur };
  tenants.forEach((t) => { t.savedClothes = !t.room.clothes.visible; });
  rain.visible = true; sfx.rain(true);
  scene.fog.color.set('#1a2140'); scene.fog.near = 25; scene.fog.far = 70;
  showEvent('🌧️ MƯA TO RỒI! 🌧️', 'Comment "cất" để cất quần áo vào phòng!');
  updateEventBar();
  speak('Mưa to rồi! Đứa nào phơi quần áo ngoài hành lang thì comment cất đồ ngay!', true);
}
function endRain() {
  rain.visible = false; sfx.rain(false);
  scene.fog.color.set('#0b1030'); scene.fog.near = 40; scene.fog.far = 90;
  eventEl.classList.remove('show');
  const wet = [...tenants.values()].filter((t) => !t.savedClothes && t.room.clothes.visible);
  wet.forEach((t) => t.room.clothMats.forEach((m) => m.color.multiplyScalar(0.6)));
  event = null;
  nextRain = performance.now() + CFG.phutGiuaCacLanMua * 60000; calmUntil = performance.now() + 20000;
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
const roomTop = (r) => new THREE.Vector3(r.cx + 0.05, r.base + 2.4, 1.1);
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
  if (!quiet) toast(`☀️ ${t.name} (P.${t.room.number}) bị đánh thức`);
}
function doSleep(t) {
  t.sleeping = true; t.sleepUntil = performance.now() + 120000;
  setRoomLight(t.room, true); // tắt đèn (setRoomLight biết phòng đang ngủ)
  floatEmoji(t.room, '💤');
  toast(`💤 ${t.name} (P.${t.room.number}) tắt đèn đi ngủ`);
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
  } else toast(`🎤 ${t.name} (P.${t.room.number}) đang hát karaoke`);
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
  } else toast(`💃 ${t.name} (P.${t.room.number}) quẩy lên`);
}
function doStudy(t) {
  const p = t.room.person; if (!p) return;
  p.studyUntil = performance.now() + 30000;
  floatEmoji(t.room, '📚');
  toast(`📚 ${t.name} (P.${t.room.number}) ngồi học bài`);
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
  if (!r.tenant) return toast(`🚪 ${t.name} gõ cửa phòng ${number}… phòng trống, không ai ở`);
  const other = r.tenant;
  if (other.sleeping) wake(other, false);
  if (r.person) { r.person.jumpUntil = performance.now() + 1200; r.person.talkUntil = performance.now() + 1500; }
  toast(`🚪 ${t.name} (P.${t.room.number}) gõ cửa gọi ${other.name} (P.${number})`);
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
  const p = makePerson({ shirt: '#1d1d1d', skin: '#d9a173', longHair: false, glasses: false, scale: 1.3 });
  const black = M({ color: '#0d0d0d' });
  const mask = box(0.62, 0.13, 0.12, black); mask.position.set(0, 0.02, 0.22); p.headG.add(mask);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), black); cap.position.y = 0.04; p.headG.add(cap);
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
  nextThief = performance.now() + (CFG.phutGiuaCacLanTrom || 6) * 60000;
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
    if (k < 3) { moving = false; p.arms[0].rotation.z = 2.8; p.arms[1].rotation.z = -2.8; g.rotation.y = 0; } // giơ tay đầu hàng
    else { g.rotation.y = -Math.PI / 2; g.position.x -= dt * 6; g.scale.setScalar(1.3 * Math.max(0.01, 1 - (k - 3) / 1.5)); }
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
  nextQuiz = performance.now() + (CFG.phutGiuaCacLanDo || 4) * 60000;
  if (!ev) return;
  const ans = ev.a[0];
  eventEl.querySelector('.fill').style.width = '100%';
  if (t) {
    t.quiz = (t.quiz || 0) + 1;
    eventEl.querySelector('.num').textContent = `✅ ${t.name} (P.${t.room.number}) trả lời đúng: ${ans}`;
    banner(`🧠 ${t.name} trả lời đúng!`, `Đáp án: ${ans}`, 3800);
    if (t.room.person) t.room.person.jumpUntil = performance.now() + 1800;
    floatEmoji(t.room, '🧠'); sfx.big(); for (let i = 0; i < 2; i++) setTimeout(firework, i * 350);
    speak(`Chính xác! ${t.name} phòng ${t.room.number} giỏi quá. Đáp án là ${ans}.`, true);
  } else {
    eventEl.querySelector('.num').textContent = `⌛ Hết giờ! Đáp án: ${ans}`;
    speak(`Hết giờ! Không ai đoán ra à? Đáp án là ${ans} nhé.`, true);
  }
  quizHideTimer = setTimeout(() => { if (!event) eventEl.classList.remove('show'); }, 5000);
}
let calmUntil = 0;
let nextThief = performance.now() + 4.5 * 60000;
let nextQuiz = performance.now() + 2 * 60000;

// gợi ý lệnh ở đầu màn hình, đổi dòng mỗi 7 giây
{
  const el = document.getElementById('shops');
  const lines = [
    '🥖 Comment <b>"bánh mì"</b> hoặc <b>"xôi"</b> để mua · 🍵 <b>"trà đá"</b> để xuống quán ngồi',
    '🎤 <b>"hát"</b> · 💃 <b>"quẩy"</b> · 📚 <b>"học"</b> · 💤 <b>"ngủ"</b> · 👋 <b>"chào"</b>',
    '🚪 <b>"gõ 203"</b> gõ cửa phòng bạn · 🍻 <b>"dô"</b> cả xóm cụng ly',
  ];
  let i = 0;
  el.style.transition = 'opacity .4s';
  setInterval(() => {
    el.style.opacity = 0;
    setTimeout(() => { i = (i + 1) % lines.length; el.innerHTML = lines[i]; el.style.opacity = 1; }, 420);
  }, 7000);
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
  if (/ banh mi | bm /.test(pl)) buyBanhMi(t, 'banhmi');
  else if (/ xoi /.test(pl)) buyBanhMi(t, 'xoi');
  const hut = / dieu cay | dieucay | thuoc lao | thuoclao /.test(pl);
  if (hut || / tra da | trada /.test(pl)) drinkTea(t, hut);
  roomAction(t, ev.text, pl);
  if (event && event.kind === 'trom' && / bat | trom | cuop | nem dep | bat no /.test(pl) && cooled(t, 'bat', 1200)) { throwSlipper(t); hitThief(t, 1); }
  checkQuiz(t, pl);
  if (event && event.kind === 'mua' && / cat /.test(plain(ev.text)) && !t.savedClothes) {
    t.savedClothes = true;
    t.room.clothes.visible = false;
    floatEmoji(t.room, '👕');
    toast(`👕 ${t.name} đã cất đồ vào phòng ${t.room.number}`);
  }
}
function onLike(ev) {
  const t = getTenant(ev);
  const n = ev.count || 1;
  wake(t);
  hitThief(t, n * 0.05); // tim cũng góp sức bắt trộm, nhưng comment "bắt" mạnh hơn
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
    banner(`👑 ${t.name} tặng ${gname}`, `Phòng ${r.number} lên đời PHÒNG VIP!`, 4500);
    speak(`Trời ơi! ${t.name} phòng ${r.number} lên đời phòng VIP rồi! Cả xóm vỗ tay đi!`, true);
    sfx.big(); for (let i = 0; i < 8; i++) setTimeout(firework, i * 280);
    tenants.forEach((x) => x.room.person && setTimeout(() => spawnSprite(teaTex, x.room.person.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 2.95, 0)), { vel: new THREE.Vector3(0, 0.25, 0), life: 6, size: 0.75, grow: 0 }), rand(0, 800)));
  } else if (coins >= 100) {
    t.lights = true; r.fairy.visible = true;
    banner(`🧋 ${t.name} tặng ${gname}`, 'Bao cả xóm trà sữa!', 4000);
    speak(`Ối giời, ${t.name} phòng ${r.number} bao cả xóm trà sữa! Cả xóm cảm ơn đi nào!`, true);
    sfx.big(); for (let i = 0; i < 4; i++) setTimeout(firework, i * 320);
    tenants.forEach((x) => x.room.person && setTimeout(() => spawnSprite(teaTex, x.room.person.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 2.95, 0)), { vel: new THREE.Vector3(0, 0.25, 0), life: 6, size: 0.75, grow: 0 }), rand(0, 800)));
  } else if (coins >= 10) {
    t.lights = true; r.fairy.visible = true;
    banner(`💡 ${t.name} tặng ${gname}`, `Phòng ${r.number} đóng tiền điện, treo đèn nháy!`);
    speak(`Cảm ơn ${t.name} phòng ${r.number} đã đóng tiền điện nhé. Gương mẫu quá!`, true);
  } else {
    banner(`💧 ${t.name} tặng ${gname}`, `Phòng ${r.number} đóng tiền nước`, 2600);
    if (!t.thanked || performance.now() - t.thanked > 30000) { t.thanked = performance.now(); speak(`Cảm ơn ${t.name} phòng ${r.number} nhé!`, true); }
  }
}
function onFollow(ev) { toast(`💛 ${cleanName(ev.name)} đã theo dõi kênh`); }
function onShare(ev) { const n = cleanName(ev.name); toast(`🔁 ${n} đã chia sẻ live`); if (Math.random() < 0.5) speak(`Cảm ơn ${n} đã rủ thêm bạn vào xóm!`); }

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
  document.getElementById('title').textContent = CFG.tenXom;
  document.querySelector('#landlady .who').textContent = `🧔 ${CFG.tenChuTro}`;
  sfx.applyVolumes();
  sfx.changeMusic();
  if ('cauDo' in c) quizBag = []; // câu đố mới áp dụng từ câu kế tiếp
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
      return;
    case 'phaoHoa': for (let i = 0; i < 5; i++) setTimeout(firework, i * 280); sfx.big(); return;
    case 'ngayDem': return setDay(!dayTarget);
    case 'reload': location.reload();
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
  event: (k) => (k === 'mua' ? startRain() : k === 'trom' ? startThief() : k === 'do' ? startQuiz() : startPowerCut()),
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
function focusRoom(r, ms) {
  if (!CFG.liaMayQuay) return;
  const now = performance.now();
  if ((focus && now < focus.until - 800) || now - lastFocus < 9000) return;
  lastFocus = now;
  const look = new THREE.Vector3(r.cx + 0.2, r.base + 1.4, 1);
  const pos = new THREE.Vector3(r.cx * 0.75 + 1.5, r.base + 2.2, 12);
  focus = { pos, look, until: performance.now() + ms };
}
const curLook = LOOK_HOME.clone();

// =====================================================================
//  Vòng lặp
// =====================================================================
const DT_MAX = Number(params.get('dtmax')) || 0.1; // ?dtmax=1 chỉ dùng khi thử trên máy chậm
let last = performance.now();
function frame(now) {
  const dt = Math.min(DT_MAX, (now - last) / 1000); last = now;
  const tsec = now / 1000;

  // sự kiện theo giờ
  if (!event && now > calmUntil) { // nghỉ 20 giây giữa hai sự kiện
    if (now > nextPowerCut) startPowerCut();
    else if (now > nextRain) startRain();
    else if (now > nextThief) startThief();
    else if (now > nextQuiz) startQuiz();
  }
  if (event && event.kind === 'matdien' && now > event.until) endPowerCut(false);
  if (event && event.kind === 'mua' && now > event.until) endRain();
  if (event && event.kind === 'trom' && now > event.until) endThief(false);
  if (event && event.kind === 'do' && now > event.until) endQuiz(null);
  if (event) updateEventBar();
  if (!event && now > nextNotice && !voice.busy && !voice.q.length && now - voice.lastEnd > 20000 && (CFG.thongBaoChuTro || []).length) {
    nextNotice = now + CFG.giayMoiThongBao * 1000;
    speak(pick(CFG.thongBaoChuTro));
  }

  // máy quay
  const wantPos = focus && now < focus.until ? focus.pos : CAM_HOME.clone().add(new THREE.Vector3(Math.sin(tsec * 0.15) * 0.35, Math.sin(tsec * 0.11) * 0.15, 0));
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
    p.group.scale.setScalar(1.45 * (0.4 + 0.6 * p.enterT));
    p.group.position.y = r.base + 0.02 + (jumping ? Math.abs(Math.sin(now / 130)) * 0.45 : dancing ? Math.abs(Math.sin(now / 190)) * 0.22 : 0);
    p.group.rotation.y = (p.baseRotY || 0) + (dancing ? Math.sin(now / 260 + p.phase) * 0.9 : 0);
    p.body.position.y = 0.92 + Math.sin(tsec * (sleeping ? 0.8 : 2) + p.phase) * 0.015;
    p.headG.rotation.z = sleeping ? 0.45 : Math.sin(tsec * 1.3 + p.phase) * 0.06;
    p.headG.rotation.x = studying ? 0.4 : sleeping ? 0.25 : 0;
    if (dancing) {
      p.arms[1].rotation.z = -2.5 + Math.sin(now / 150) * 0.6;
      p.arms[0].rotation.z = 2.5 + Math.sin(now / 150 + 1.6) * 0.6;
    } else {
      p.arms[1].rotation.z = talking || jumping ? -2.4 + Math.sin(now / 110) * 0.5 : studying ? -0.6 + Math.sin(now / 90) * 0.15 : 0.12;
      p.arms[0].rotation.z = jumping ? 2.4 - Math.sin(now / 110) * 0.5 : -0.12;
    }
    if (r.tenant && r.tenant.lights && r.fairy.visible) r.fairyMats.forEach((m, k) => (m.color.setHSL(((tsec * 0.3 + k * 0.25) % 1), 1, (Math.sin(tsec * 6 + k * 1.7) > 0 ? 0.6 : 0.25))));
  }
  // bà chủ trọ quạt và nói
  const llTalk = now < landlady.talkUntil;
  landlady.arms[1].rotation.z = llTalk ? -1.2 + Math.sin(now / 160) * 0.5 : -0.4 + Math.sin(tsec * 3) * 0.15;
  landlady.headG.rotation.y = Math.sin(tsec * 0.6) * 0.3;
  landlady.fanBlades.rotation.z += dt * 18;
  updateStalls(dt, now);
  updateRoomActions(dt, now);
  updateThief(dt, now);
  updateBus(dt, now);
  updateWalkers(dt, now);

  // đèn pin điện thoại khi mất điện
  if (!power && Math.random() < 0.08) {
    const occ = rooms.filter((r) => r.person);
    if (occ.length) { const r = pick(occ); spawnSprite(glowTex, new THREE.Vector3(r.cx + 0.35, r.base + 1.0, 1.25), { life: 0.9, size: 0.6, grow: 0.2, color: '#e8f4ff', additive: true }); }
  }

  updateDayNight(dt, now);
  updateBackground(dt, now);
  if (rain.visible) updateRain(dt);
  updateSprites(dt);
  renderer.render(scene, camera);
  placeLabels();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ?event=matdien hoặc ?event=mua: bật sự kiện ngay khi xóm có người (để thử)
if (params.get('event')) {
  const tryEvent = () => (tenants.size ? window.__xt.event(params.get('event')) : setTimeout(tryEvent, 500));
  setTimeout(tryEvent, 1500);
}
