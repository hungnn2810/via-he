// =====================================================================
//  Hoạt cảnh 3D thêm cho xóm trọ
//  shipper giao đồ, đá cầu và karaoke trên sân thượng, xe kem chè, ba gác chuyển trọ (follow),
//  mèo Mướp (share), chủ trọ đi thu tiền, cúp nước, gió to, mùa thi, lẩu sân thượng (quà 100+),
//  xe hoa (quà 500+), trang trí Tết / Trung thu / Noel.
//  game.js gọi taoHoatCanh(X) với các hàm/biến dùng chung rồi gọi các hook trả về.
// =====================================================================
export function taoHoatCanh(X) {
  const PS = X.PERSON_SIZE || 1.45; // cỡ người chung, trùng game.js
  const { THREE, scene, M, box, rand, pick, clamp, sfx } = X;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const cfg = () => X.cfg();
  const XH = () => X.xh();
  const esc = X.esc;
  // Khu trọ có 3 tòa chữ U: A (trái), B (giữa, phía sau), C (phải). Đồ trên sân thượng gắn vào nhóm của từng tòa
  // (toạ độ trong tòa: x dọc mặt tiền, z = 0 là mặt tiền, +z ra hành lang), nên tòa xoay thế nào cũng đúng.
  // Tòa A: đầu gần cổng ở phía -x; tòa C: đầu gần cổng ở phía +x.
  const RA = X.blocks.A.bg, RB = X.blocks.B.bg, RC = X.blocks.C.bg;
  const SL = X.blocks.A.corrW, MW = X.MID_W;
  const rp = (parent, x, y, z) => parent.localToWorld(V3(x, y, z));
  const ROOF_Y = X.TOP + 0.8;   // mặt sân thượng
  const STOP_Z = 4.75;          // xe máy, xe đạp tạt vào lề ở đây (không lấn làn xe buýt)
  const SWZ = X.SIDEWALK_Z;
  const GATE = X.GATE;
  const RAIL_Z = X.CORR - 0.08;
  const alive = (t) => !!t && X.tenants.get(t.id) === t;
  const free = (t) => alive(t) && !t.awayBy && !t.outing && !!t.room.person; // outing: đang ra quầy hàng (game.js)
  const mins = (k, d) => (Number(cfg()[k]) || d) * 60000;
  let T = performance.now(); // giờ của khung hình đang vẽ

  // ---------- chữ HTML bám theo vật 3D ----------
  const tags = [];
  function tag(obj, html, dy = 2.3, cls = 'plate small') {
    const el = document.createElement('div'); el.className = cls; el.innerHTML = html; X.labelsEl.appendChild(el);
    const t = { el, obj, dy }; tags.push(t); return t;
  }
  function untag(t) { if (!t) return; t.el.remove(); const i = tags.indexOf(t); if (i >= 0) tags.splice(i, 1); }
  const _v = V3();
  function placeTags() {
    for (const t of tags) {
      t.obj.getWorldPosition(_v); _v.y += t.dy;
      const s = X.toScreen(_v);
      t.el.style.left = `${s.x}px`; t.el.style.top = `${s.y}px`;
      t.el.style.display = s.on && t.obj.visible !== false ? '' : 'none';
    }
  }
  function floatAt(v, ch) {
    const s = X.toScreen(v);
    const el = document.createElement('div'); el.className = 'float'; el.textContent = ch;
    el.style.left = `${s.x}px`; el.style.top = `${s.y}px`; X.labelsEl.appendChild(el); setTimeout(() => el.remove(), 2300);
  }
  const roomTop = (r) => X.roomPt(r, 0.05, 2.4, 1.0);

  // ---------- người thuê "đi vắng": người trong phòng ẩn đi khi đang ở hoạt cảnh khác ----------
  function away(t, by) {
    if (!alive(t)) return;
    t.awayBy = by;
    if (t.room.person) t.room.person.group.visible = !by;
  }
  // bản sao đúng hình dáng người thuê (áo, tóc, kính) để đi xuống đường hay lên sân thượng
  function copyOf(t, scale = PS) {
    const src = t && t.room.person;
    if (!src) return X.makePerson({ ...(t?.look || {}), scale });
    const g = src.group.clone(true), c = g.children, at = (o) => c[src.group.children.indexOf(o)];
    g.visible = true; g.scale.setScalar(scale); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
    const p = { group: g, legs: src.legs.map(at), body: at(src.body), arms: src.arms.map(at), headG: at(src.headG), phase: rand(0, 6) };
    p.arms[0].rotation.set(0, 0, -0.12); p.arms[1].rotation.set(0, 0, 0.12);
    p.headG.rotation.set(0, 0, 0); p.body.position.y = 0.92;
    return p;
  }
  function walkerOf(t, label, from, path, onDone) {
    const w = X.makeWalker(label, from, path, onDone);
    if (t && t.room.person) { scene.remove(w.p.group); const p = copyOf(t); p.group.position.copy(from); scene.add(p.group); w.p = p; }
    return w;
  }

  // ---------- xe chạy theo các điểm (x, z) ----------
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  function drive(veh, dt) {
    const g = veh.g;
    g.position.y = 0.2 + (veh.v > 0.3 ? Math.abs(Math.sin(T / 90)) * 0.02 : 0);
    if (!veh.path.length) { veh.v = 0; return; }
    const tg = veh.path[0];
    const dx = tg.x - g.position.x, dz = tg.z - g.position.z, d = Math.hypot(dx, dz);
    const brake = tg.stop ? clamp(d / 4, 0.2, 1) : 1;
    veh.v = Math.min(veh.vmax * brake, (veh.v || 0) + veh.acc * dt);
    if (d <= Math.max(0.05, veh.v * dt)) {
      g.position.x = tg.x; g.position.z = tg.z; veh.path.shift();
      if (tg.stop) veh.v = 0;
      if (tg.done) tg.done();
      return;
    }
    g.position.x += (dx / d) * veh.v * dt; g.position.z += (dz / d) * veh.v * dt;
    g.rotation.y += angDiff(Math.atan2(-dz, dx), g.rotation.y) * Math.min(1, dt * 5);
  }
  function vehSound(veh) {
    if (!veh.snd) return;
    const x = veh.g.position.x;
    veh.snd.set(1 / (1 + (x / 9) ** 2) * (veh.v > 0.2 ? 1 : 0.45), 0.8 + 0.35 * (veh.v / veh.vmax));
  }
  function dropVeh(veh) { scene.remove(veh.g); if (veh.snd) veh.snd.stop(); untag(veh.tag); }
  function riderOn(g, shirt, helmetColor, x = -0.15, gs = 1) {
    const r = X.makePerson({ scale: PS / gs, shirt });
    r.legs.forEach((l) => { l.rotation.x = -1.3; l.position.z = 0.25; l.position.y = 0.35; });
    r.arms.forEach((a) => { a.rotation.x = -1.2; });
    r.group.position.set(x, 0.55, 0); r.group.rotation.y = Math.PI / 2; g.add(r.group);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M({ color: helmetColor, roughness: 0.4 }));
    helmet.position.y = 0.06; r.headG.add(helmet);
    return r;
  }
  const wheel = (r, x, z, parent) => { const w = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.3, 8, 16), M({ color: '#151515' })); w.position.set(x, r, z); parent.add(w); return w; };

  // ---------- âm thanh thêm ----------
  const S = {
    bell: () => { sfx.tone(2400, 0.22, 'sine', 0.1); sfx.tone(2400, 0.22, 'sine', 0.1, 0, 0.16); sfx.tone(2900, 0.35, 'sine', 0.07, 0, 0.32); },
    meow: () => { sfx.tone(560, 0.18, 'triangle', 0.1, 1.6); sfx.tone(900, 0.42, 'triangle', 0.09, 0.55, 0.17); },
    kick: () => sfx.noise(0.05, 0.3, 900),
    clink: () => { sfx.tone(2600, 0.15, 'sine', 0.06); sfx.tone(3300, 0.2, 'sine', 0.05, 0, 0.05); },
    drum: (hi) => { if (hi) sfx.noise(0.06, 0.18, 2500); else { sfx.tone(85, 0.28, 'sine', 0.35, 0.6); sfx.noise(0.06, 0.15, 260); } },
    cymbal: () => sfx.noise(0.35, 0.1, 6500),
    water: () => sfx.noise(0.8, 0.12, 1200),
    tune: (notes, gap = 0.16, type = 'square', vol = 0.05) => notes.forEach((f, i) => sfx.tone(f, gap * 1.4, type, vol, 0, i * gap)),
  };

  const noteTexs = ['🎵', '🎶'].map(X.emojiTex);
  const leafTex = X.emojiTex('🍃'), petalTex = X.emojiTex('🌸'), dropTex = X.emojiTex('💧'), zzzTex = X.emojiTex('💤');

  // =====================================================================
  //  1. Shipper giao đồ ăn: comment "đặt cơm", "trà sữa", "ship"...
  // =====================================================================
  const FOODS = [
    { re: / tra sua /, ten: 'trà sữa', e: '🧋' },
    { re: / dat com | com tam | com ga | goi com | com rang | com hop /, ten: 'cơm hộp', e: '🍱' },
    { re: / ga ran | pizza | burger | hamburger /, ten: 'gà rán', e: '🍗' },
    { re: / pho bo | pho ga | an pho | dat pho | bun bo | bun cha | bun dau /, ten: 'bún phở', e: '🍜' },
    { re: / ship | shipper | dat do | goi do | dat do an | order /, ten: 'đồ ăn', e: '🛍️' },
  ];
  const ship = { q: [], cur: null, last: new Map() };
  function datDo(t, f) {
    if (T - (ship.last.get(t.id) || -1e9) < 60000) return;
    if (ship.q.length >= 4 || ship.q.some((o) => o.t === t) || ship.cur?.o.t === t) return;
    ship.last.set(t.id, T);
    ship.q.push({ t, f });
    X.toast(`📱 ${t.name} vừa đặt ${f.ten}, shipper đang tới`);
  }
  function startShip(o) {
    const g = X.scooter(-38, 9, '#2bb24c', 0);
    riderOn(g, '#2bb24c', '#2bb24c');
    const bx = box(0.62, 0.55, 0.62, M({ color: '#2bb24c', roughness: 0.5 })); bx.position.set(-0.78, 1.28, 0); g.add(bx);
    const lid = box(0.64, 0.06, 0.64, M({ color: '#f1faee' })); lid.position.set(-0.78, 1.58, 0); g.add(lid);
    const veh = { g, v: 9, vmax: 9, acc: 5, path: [], snd: sfx.engine(115, 0.07) };
    const SX = -1.8;
    veh.path = [{ x: -9, z: 9 }, { x: -4.5, z: STOP_Z }, { x: SX, z: STOP_Z, stop: true, done: () => shipArrived(o, veh, SX) }];
    veh.tag = tag(g, `🛵 ${o.f.e} đơn của <b>${esc(o.t.name)}</b>`, 2.7);
    ship.cur = { o, veh };
  }
  function shipArrived(o, veh, SX) {
    sfx.honk(); setTimeout(() => sfx.honk(), 450);
    const t = o.t;
    const leave = () => { veh.path = [{ x: SX + 4, z: 7.2 }, { x: 40, z: 9 }]; veh.leaving = true; };
    if (!free(t)) {
      setTimeout(() => {
        floatAt(V3(SX, 2.6, STOP_Z), o.f.e);
        X.toast(`🛵 ${XH()} chủ trọ nhận hộ ${o.f.ten} cho ${t.name}`);
        setTimeout(leave, 1200);
      }, 1500);
      return;
    }
    if (X.voiceFree()) X.speak(`${t.name} ơi, có shipper giao ${o.f.ten} ở cổng kìa!`);
    away(t, 'ship');
    const spot = V3(SX + 0.55, 0.2, 4.05);
    walkerOf(t, `🛍️ ${t.name}`, GATE, [V3(0.8, 0.2, SWZ - 0.3), spot], (w) => {
      w.p.group.rotation.y = 0;
      setTimeout(() => {
        floatAt(V3(spot.x, 2.7, spot.z), o.f.e); sfx.coin();
        X.toast(`${o.f.e} ${t.name} đã nhận ${o.f.ten}`);
        leave();
        w.path = [V3(0.8, 0.2, SWZ - 0.3), GATE.clone()];
        w.onDone = (w2) => { w2.fade = 0.5; setTimeout(() => away(t, null), 500); };
      }, 1300);
    });
  }
  function updShip(dt) {
    if (!ship.cur && ship.q.length) { const o = ship.q.shift(); if (alive(o.t)) startShip(o); }
    const c = ship.cur; if (!c) return;
    drive(c.veh, dt); vehSound(c.veh);
    if (c.veh.leaving && c.veh.g.position.x > 38) { dropVeh(c.veh); ship.cur = null; }
  }

  // =====================================================================
  //  2. Xe đạp bán kem, chè: đi qua định kỳ, comment "kem" / "chè" để mua (không có xe thì gọi xe tới)
  // =====================================================================
  const rongSign = X.signTexOf('KEM · CHÈ', '#e63946', '#ffffff', 'MÁT LẠNH · 10K');
  const rong = { cur: null, next: performance.now() + 100000, lastCall: -1e9, sold: 0 };
  const RX = -5.0;
  function makeBike() {
    const g = new THREE.Group();
    const frameM = M({ color: '#1d5fa8', metalness: 0.3, roughness: 0.5 });
    wheel(0.34, -0.62, 0, g); wheel(0.34, 0.62, 0, g);
    const bar1 = box(1.25, 0.05, 0.05, frameM); bar1.position.set(0, 0.62, 0); bar1.rotation.z = 0.15; g.add(bar1);
    const fork = box(0.05, 0.6, 0.05, frameM); fork.position.set(0.6, 0.62, 0); fork.rotation.z = -0.2; g.add(fork);
    const hb = box(0.06, 0.06, 0.6, M({ color: '#222' })); hb.position.set(0.66, 0.95, 0); g.add(hb);
    const post = box(0.05, 0.4, 0.05, frameM); post.position.set(-0.25, 0.75, 0); g.add(post);
    const seat = box(0.3, 0.07, 0.18, M({ color: '#222' })); seat.position.set(-0.25, 0.96, 0); g.add(seat);
    const cooler = box(0.7, 0.55, 0.62, M({ color: '#f1f6fb', roughness: 0.4 })); cooler.position.set(-0.78, 1.0, 0); g.add(cooler);
    const stripe = box(0.72, 0.1, 0.64, M({ color: '#e63946' })); stripe.position.set(-0.78, 1.15, 0); g.add(stripe);
    [1, -1].forEach((s) => {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.26), new THREE.MeshStandardMaterial({ map: rongSign, emissive: '#ffffff', emissiveMap: rongSign, emissiveIntensity: 0.25 }));
      sign.position.set(-0.78, 1.45, 0.32 * s); if (s < 0) sign.rotation.y = Math.PI; g.add(sign);
    });
    const umb = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.3, 12, 1, true), M({ color: '#ffd166', side: THREE.DoubleSide })); umb.position.set(-0.78, 2.05, 0); g.add(umb);
    const umbPole = box(0.03, 0.75, 0.03, M({ color: '#777' })); umbPole.position.set(-0.78, 1.65, 0); g.add(umbPole);
    const v = X.makePerson({ shirt: '#f4a261', longHair: true, glasses: false, scale: PS / 1.2 }); X.nonLa(v);
    v.legs.forEach((l) => { l.rotation.x = -1.2; l.position.z = 0.2; l.position.y = 0.38; });
    v.arms.forEach((a) => { a.rotation.x = -1.1; });
    v.group.position.set(-0.22, 0.3, 0); v.group.rotation.y = Math.PI / 2; g.add(v.group);
    g.scale.setScalar(1.2);
    return { g, vendor: v };
  }
  function callRong() {
    if (rong.cur) return false;
    const b = makeBike(); b.g.position.set(38, 0.2, 11.4); b.g.rotation.y = Math.PI; scene.add(b.g);
    const veh = { g: b.g, v: 3.2, vmax: 3.2, acc: 2, path: [{ x: RX + 5, z: 7.0 }, { x: RX, z: STOP_Z, stop: true, done: rongArrive }] };
    veh.tag = tag(b.g, '🍦 Xe kem · chè', 2.9);
    rong.cur = { ...b, veh, buyers: [], state: 'come', until: 0, pending: 0, arrivedAt: 0 };
    rong.next = T + mins('phutGiuaCacLanHangRong', 4);
    S.bell();
    return true;
  }
  function rongArrive() {
    const c = rong.cur; if (!c) return;
    c.state = 'stop'; c.arrivedAt = T; c.until = T + 12000;
    c.veh.tag.el.innerHTML = '📣 Ai kem chè đâyyy!';
    S.bell();
    X.toast('🍦 Xe kem chè dừng trước cổng, comment "kem" hoặc "chè" để mua');
    c.buyers.splice(0).forEach(([t, it]) => serveRong(t, it));
  }
  function buyRong(t, it) {
    const c = rong.cur;
    if (!c) {
      if (T - rong.lastCall < 30000) return;
      rong.lastCall = T; callRong(); rong.cur.buyers.push([t, it]);
      X.toast(`📣 ${t.name} gọi xe ${it.ten.replace(/^(cây|cốc) /, '')} vào xóm`);
      return;
    }
    if (c.state === 'come') { if (c.buyers.length < 6 && !c.buyers.some(([x]) => x === t)) c.buyers.push([t, it]); return; }
    if (c.state === 'stop') serveRong(t, it);
  }
  function serveRong(t, it) {
    const c = rong.cur; if (!c || !alive(t)) return;
    c.until = Math.min(c.arrivedAt + 32000, Math.max(c.until, T + 6000));
    const done = () => {
      rong.sold++; sfx.coin(); c.sellUntil = T + 1500;
      X.toast(`${it.e} ${t.name} mua ${it.ten}`);
    };
    if (!free(t)) { floatAt(V3(RX, 2.8, STOP_Z), it.e); floatAt(roomTop(t.room), it.e); done(); return; }
    c.pending++;
    away(t, 'rong');
    const spot = V3(RX + 0.95 + rand(-0.2, 0.2), 0.2, 4.0);
    walkerOf(t, `${it.e} ${t.name}`, GATE, [V3(0.6, 0.2, SWZ - 0.25), spot], (w) => {
      w.p.group.rotation.y = -0.3;
      setTimeout(() => {
        floatAt(V3(spot.x, 2.7, spot.z), it.e); done();
        w.path = [V3(0.6, 0.2, SWZ - 0.25), GATE.clone()];
        w.onDone = (w2) => { w2.fade = 0.5; setTimeout(() => away(t, null), 500); c.pending--; };
      }, 1200);
    });
  }
  function updRong(dt) {
    if (!rong.cur && T > rong.next && X.tenants.size) callRong();
    const c = rong.cur; if (!c) return;
    drive(c.veh, dt);
    const moving = c.veh.v > 0.2;
    const ped = moving ? Math.sin(T / 140) * 0.6 : 0;
    c.vendor.legs[0].rotation.x = -1.2 + ped; c.vendor.legs[1].rotation.x = -1.2 - ped;
    c.vendor.arms[1].rotation.z = T < (c.sellUntil || 0) ? -1.8 + Math.sin(T / 120) * 0.4 : 0.12;
    c.vendor.headG.rotation.y = moving ? 0 : Math.sin(T / 700) * 0.5;
    if (c.state === 'stop') {
      if (Math.random() < dt / 5) S.bell();
      if (T > c.until && c.pending <= 0) {
        c.state = 'leave'; c.veh.tag.el.innerHTML = '🍦 Xe kem · chè';
        c.veh.path = [{ x: RX - 4, z: 7.0 }, { x: -12, z: 11.4 }, { x: -40, z: 11.4 }];
      }
    }
    if (c.state === 'leave' && c.veh.g.position.x < -38) { dropVeh(c.veh); rong.cur = null; }
  }

  // =====================================================================
  //  3. Ba gác chuyển trọ: người follow kênh dọn đồ vào xóm
  // =====================================================================
  const move = { q: [], cur: null };
  function makeBaGac() {
    const g = new THREE.Group();
    const red = M({ color: '#b5442c', roughness: 0.5, metalness: 0.2 });
    const body = box(0.9, 0.45, 0.42, red); body.position.set(1.1, 0.6, 0); g.add(body);
    const front = box(0.2, 0.75, 0.4, red); front.position.set(1.55, 0.88, 0); front.rotation.z = -0.25; g.add(front);
    const bar = box(0.08, 0.08, 0.75, M({ color: '#222' })); bar.position.set(1.66, 1.28, 0); g.add(bar);
    const seat = box(0.55, 0.12, 0.36, M({ color: '#1b1b1b' })); seat.position.set(0.95, 0.88, 0); g.add(seat);
    wheel(0.26, 1.55, 0, g); wheel(0.3, -1.0, 0.62, g); wheel(0.3, -1.0, -0.62, g);
    const wood = M({ color: '#9c6b3c', roughness: 0.9 });
    const bed = box(2.1, 0.1, 1.35, wood); bed.position.set(-0.55, 0.62, 0); g.add(bed);
    [0.65, -0.65].forEach((z) => { const s = box(2.1, 0.3, 0.06, wood); s.position.set(-0.55, 0.8, z); g.add(s); });
    const back = box(0.06, 0.3, 1.35, wood); back.position.set(-1.6, 0.8, 0); g.add(back);
    const cardM = M({ color: '#c79a5b', roughness: 0.9 }), tapeM = M({ color: '#e9d8a6' });
    const cardboard = (x, z) => { const c = new THREE.Group(); const b = box(0.5, 0.42, 0.45, cardM); c.add(b); const tp = box(0.52, 0.06, 0.1, tapeM); tp.position.y = 0.2; c.add(tp); c.position.set(x, 0.88, z); g.add(c); return c; };
    const box1 = cardboard(-0.15, 0.27), box2 = cardboard(-0.15, -0.27);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.36, 12), M({ color: '#2a9df4' })); bucket.position.set(-1.3, 0.85, 0.35); g.add(bucket);
    const fan = new THREE.Group(); fan.position.set(-1.3, 0.67, -0.35); g.add(fan);
    const fst = box(0.04, 0.6, 0.04, M({ color: '#ddd' })); fst.position.y = 0.3; fan.add(fst);
    const fcage = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 18), M({ color: '#ddd' })); fcage.position.y = 0.65; fan.add(fcage);
    const fbl = new THREE.Mesh(new THREE.CircleGeometry(0.18, 3), M({ color: '#88c5ff', side: THREE.DoubleSide })); fbl.position.y = 0.65; fan.add(fbl);
    const mattress = box(1.0, 0.22, 0.95, M({ color: '#f4a6c0', roughness: 0.9 })); mattress.position.set(-0.9, 0.79, 0); g.add(mattress);
    // thứ tự khiêng vào: thùng, thùng, xô, quạt, nệm
    const cargo = [box1, box2, bucket, fan, mattress];
    riderOn(g, '#495057', '#ffd166', 0.95, 1.15);
    g.scale.setScalar(1.15);
    return { g, cargo };
  }
  function onFollow(ev) {
    const t = X.getTenant(ev);
    if (move.q.some((m) => m.t === t) || move.cur?.t === t || move.q.length >= 3) return;
    move.q.push({ t });
  }
  function startMove(m) {
    const t = m.t;
    const { g, cargo } = makeBaGac();
    g.position.set(-38, 0.2, 9); scene.add(g);
    const MX = 1.8;
    const veh = { g, v: 7, vmax: 7, acc: 4, path: [{ x: -5, z: 9 }, { x: -0.6, z: 6.6 }, { x: MX, z: STOP_Z, stop: true, done: () => unload() }], snd: sfx.engine(90, 0.08) };
    veh.tag = tag(g, `🚚 <b>${esc(t.name)}</b> chuyển đến xóm`, 2.6);
    away(t, 'move');
    move.cur = { t, veh, cargo };
    const unload = () => {
      sfx.honk();
      const items = cargo.slice();
      let left = items.length;
      items.forEach((item, k) => setTimeout(() => {
        const mine = k % 2 === 0;
        const from = V3(MX - 1.6 + rand(-0.15, 0.15), 0.2, 4.05);
        const label = mine ? `📦 ${t.name}` : `🙋 bạn của ${t.name}`;
        const w = mine && alive(t) ? walkerOf(t, label, from, [V3(0.6, 0.2, 3.0), GATE.clone()], null) : X.makeWalker(label, from, [V3(0.6, 0.2, 3.0), GATE.clone()], null);
        item.removeFromParent(); w.p.group.add(item);
        item.position.set(0, item === cargo[4] ? 1.95 : 1.85, 0); item.rotation.set(0, item === cargo[4] ? Math.PI / 2 : 0, 0);
        w.p.arms[0].rotation.z = 2.9; w.p.arms[1].rotation.z = -2.9;
        w.speed = 2.0;
        w.onDone = (w2) => {
          w2.fade = 0.5;
          if (--left === 0) setTimeout(() => {
            away(t, null);
            if (alive(t)) { floatAt(roomTop(t.room), '🏠'); X.toast(`🏠 ${t.name} đã dọn vào phòng mới`); sfx.knock(); }
            veh.path = [{ x: 6, z: 7.3 }, { x: 40, z: 9 }]; veh.leaving = true; sfx.honk();
          }, 600);
        };
      }, 300 + k * 1500));
    };
  }
  function updMove(dt) {
    if (!move.cur && move.q.length && X.bus.state === 'idle') { const m = move.q.shift(); if (alive(m.t)) startMove(m); }
    const c = move.cur; if (!c) return;
    drive(c.veh, dt); vehSound(c.veh);
    if (c.veh.leaving && c.veh.g.position.x > 38) { dropVeh(c.veh); move.cur = null; }
  }

  // =====================================================================
  //  4. Mèo Mướp: có người share thì chạy sang phòng người đó nằm ngủ
  // =====================================================================
  const meo = (() => {
    const g = new THREE.Group();
    const fur = M({ color: '#e8913a', roughness: 0.9 }), white = M({ color: '#fff4e6' }), dark = new THREE.MeshBasicMaterial({ color: '#111' });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.32, 4, 10), fur); body.rotation.z = Math.PI / 2; body.position.y = 0.27; g.add(body);
    for (let k = 0; k < 3; k++) { const s = box(0.04, 0.03, 0.27, M({ color: '#b5651d' })); s.position.set(-0.12 + k * 0.1, 0.4, 0); g.add(s); }
    const head = new THREE.Group(); head.position.set(0.27, 0.4, 0); g.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), fur));
    [-0.065, 0.065].forEach((z) => { const e = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.11, 4), fur); e.position.set(0, 0.13, z); head.add(e); });
    [-0.05, 0.05].forEach((z) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), dark); e.position.set(0.11, 0.03, z); head.add(e); });
    const muz = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), white); muz.position.set(0.1, -0.04, 0); muz.scale.set(0.6, 0.6, 1); head.add(muz);
    const legs = [];
    [[0.15, 0.07], [0.15, -0.07], [-0.15, 0.07], [-0.15, -0.07]].forEach(([x, z]) => {
      const p = new THREE.Group(); p.position.set(x, 0.2, z); g.add(p);
      const l = box(0.05, 0.2, 0.05, x > 0 ? white : fur); l.position.y = -0.1; p.add(l); legs.push(p);
    });
    const tail = new THREE.Group(); tail.position.set(-0.25, 0.32, 0); g.add(tail);
    const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.34, 6), fur); tl.position.y = 0.17; tail.add(tl);
    tail.rotation.z = 0.7;
    g.scale.setScalar(1.7);
    RC.add(g);
    return { g, body, head, legs, tail, state: 'sleep', floor: 1, bg: RC, tx: 0, pop: 1, nextWander: performance.now() + 90000, nextZ: 0, tag: null };
  })();
  const railY = (f) => X.floorBase(f) + 0.89;
  const halfOf = (bg) => (bg === RB ? X.blocks.B.corrW : SL) / 2 - 0.7; // mèo đi trong khoảng này trên lan can tòa đó
  meo.g.position.set(halfOf(RC) - 0.6, railY(1), RAIL_Z);
  // floor = 0: xuống bàn trà của chủ trọ; bg = tòa có phòng cần tới
  function meoGo(floor, x, onArrive, bg = meo.bg) {
    meo.onArrive = onArrive;
    if (floor === meo.floor && floor > 0 && bg === meo.bg) { meo.state = 'walk'; meo.tx = x; return; }
    meo.state = 'hop'; meo.hopTo = { floor, x, bg }; meo.pop = 1;
  }
  function onShare(ev) {
    const t = X.getTenant(ev, false);
    const occ = X.rooms.filter((r) => r.tenant);
    const r = alive(t) ? t.room : occ.length ? pick(occ) : null;
    S.meow();
    if (!r) { meoGo(0, 0); X.toast('🐱 Mèo Mướp chạy ra bàn trà nằm cạnh chủ trọ'); return; }
    meoGo(r.floor, r.cx + 0.75, () => {
      S.meow(); const v = V3(); meo.g.getWorldPosition(v); v.y += 1.2; floatAt(v, '😻');
      X.toast(`🐱 Mèo Mướp sang nằm ngủ trước phòng${alive(t) ? ` của ${t.name}` : ''}`);
    }, r.bg);
    meo.tag = meo.tag || tag(meo.g, '🐱 Mướp', 1.0);
  }
  function updMeo(dt) {
    const g = meo.g, walking = meo.state === 'walk';
    if (meo.state === 'hop') {
      meo.pop -= dt * 2.5;
      if (meo.pop <= 0) {
        const { floor, x, bg } = meo.hopTo;
        meo.floor = floor;
        if (floor > 0) { bg.add(g); meo.bg = bg; const h = halfOf(bg); g.position.set(x > 0 ? h : -h, railY(floor), RAIL_Z); meo.tx = clamp(x, -h, h); meo.state = 'walk'; }
        else { scene.add(g); meo.bg = scene; g.position.set(X.yard.position.x - 4.0, 0.73, 1.5); meo.tx = g.position.x; meo.state = 'walk'; }
        meo.pop = 0.01; meo.grow = true;
      }
    }
    if (meo.grow) { meo.pop = Math.min(1, meo.pop + dt * 2.5); if (meo.pop >= 1) meo.grow = false; }
    g.scale.setScalar(1.7 * Math.max(0.01, meo.pop));
    if (walking) {
      const d = meo.tx - g.position.x;
      if (Math.abs(d) < 0.05) {
        meo.state = 'sleep'; untag(meo.tag); meo.tag = null;
        if (meo.onArrive) { meo.onArrive(); meo.onArrive = null; }
      } else {
        g.position.x += Math.sign(d) * Math.min(Math.abs(d), 2.6 * dt);
        g.rotation.y = d > 0 ? 0 : Math.PI;
      }
    }
    const sleeping = meo.state === 'sleep';
    meo.legs.forEach((l, k) => { l.visible = !sleeping; l.rotation.z = walking ? Math.sin(T / 90 + (k % 2 ? Math.PI : 0) + (k > 1 ? 1 : 0)) * 0.6 : 0; });
    meo.body.position.y = sleeping ? 0.14 : 0.27 + (walking ? Math.abs(Math.sin(T / 90)) * 0.02 : 0);
    meo.head.position.y = sleeping ? 0.2 : 0.4;
    meo.head.rotation.z = sleeping ? -0.35 : Math.sin(T / 600) * 0.1;
    meo.tail.rotation.z = sleeping ? 1.45 : 0.7 + Math.sin(T / 250) * 0.35;
    if (sleeping && T > meo.nextZ) {
      meo.nextZ = T + 5000;
      const v = V3(); g.getWorldPosition(v); v.y += 0.9; v.x += 0.4;
      X.spawnSprite(zzzTex, v, { vel: V3(0.15, 0.4, 0), life: 2.2, size: 0.45, grow: 0.15 });
    }
    // lâu lâu vươn vai đi dạo vài bước trên lan can rồi nằm tiếp
    if (sleeping && meo.floor > 0 && T > meo.nextWander) {
      meo.nextWander = T + rand(70000, 140000);
      const h = halfOf(meo.bg); meo.tx = clamp(g.position.x + rand(-2, 2), -h, h); meo.state = 'walk';
    }
  }

  // =====================================================================
  //  5. Chủ trọ đi thu tiền phòng (định kỳ): ai comment gần đây thì "đã đóng"
  // =====================================================================
  const rent = { on: false, next: performance.now() + 6 * 60000 };
  function startRent() {
    const occ = X.rooms.filter((r) => r.tenant);
    if (rent.on || !occ.length) return false;
    const p = X.makePerson({ shirt: '#f2f2f2', skin: '#d9a173', longHair: false, glasses: false, scale: PS });
    const book = box(0.24, 0.3, 0.04, M({ color: '#2d6a4f' })); book.position.set(0, -0.56, 0.08); p.arms[1].add(book);
    p.arms[1].rotation.x = -0.8;
    p.group.visible = false; scene.add(p.group);
    // đi từng dãy hành lang có người: tầng thấp trước, trong tầng đi lần lượt tòa A, B, C
    const legs = [];
    for (const r of occ) { let l = legs.find((x) => x.f === r.floor && x.bg === r.bg); if (!l) legs.push(l = { f: r.floor, bg: r.bg, ord: 'ABC'.indexOf(r.block) }); }
    legs.sort((a, b) => a.f - b.f || a.ord - b.ord);
    Object.assign(rent, { on: true, floors: legs, fi: -1, p, state: 'next', paid: 0, late: 0, pop: 0 });
    rent.tag = tag(p.group, '🧔 Thu tiền phòng 📒', 2.75);
    X.landlady.group.visible = false;
    X.speak(`Cuối tháng rồi, ${XH()} đi thu tiền phòng đây! Ai đang ở phòng thì comment một câu cho ${XH()} biết nhé!`, true);
    return true;
  }
  function endRent() {
    rent.p.group.removeFromParent(); untag(rent.tag);
    rent.on = false; rent.next = T + mins('phutGiuaCacLanThuTien', 15);
    X.landlady.group.visible = true;
    const msg = rent.late
      ? `Thu xong rồi! ${rent.paid} phòng có mặt đóng tiền, ${rent.late} phòng vắng nhà thì ${XH()} ghi sổ, hôm khác thu nhé!`
      : `Thu xong rồi! Phòng nào cũng có mặt, cả xóm gương mẫu quá!`;
    X.speak(msg, true);
    X.toast(`📒 Thu tiền phòng xong: ${rent.paid} phòng đã đóng`);
  }
  function updRent(dt) {
    if (!rent.on) { if (T > rent.next && X.tenants.size >= 2 && !X.ev.get()) { if (!startRent()) rent.next = T + 60000; } return; }
    const p = rent.p, g = p.group;
    if (rent.pop < 1 && rent.state !== 'out') { rent.pop = Math.min(1, rent.pop + dt * 3); }
    if (rent.state === 'next') {
      rent.fi++;
      if (rent.fi >= rent.floors.length) { endRent(); return; }
      const leg = rent.floors[rent.fi];
      rent.stops = X.rooms.filter((r) => r.floor === leg.f && r.bg === leg.bg && r.tenant).sort((a, b) => a.cx - b.cx);
      rent.si = 0; rent.y = X.floorBase(leg.f) + 0.02; rent.half = (leg.bg === RB ? X.blocks.B.corrW : SL) / 2 - 0.7;
      leg.bg.add(g); g.position.set(-rent.half, rent.y, 1.42); g.visible = true; rent.pop = 0;
      rent.state = 'walk';
    } else if (rent.state === 'walk') {
      const r = rent.stops[rent.si];
      const tx = r ? r.cx - 0.82 : rent.half;
      const d = tx - g.position.x;
      g.rotation.y = Math.PI / 2;
      if (Math.abs(d) < 0.05) {
        if (r) { rent.state = 'knock'; rent.wait = 0.9; g.rotation.y = Math.PI; sfx.knock(); }
        else { rent.state = 'out'; }
      } else g.position.x += Math.sign(d) * Math.min(Math.abs(d), 4.5 * dt);
      const sw = Math.sin(T / 110) * 0.6;
      p.legs[0].rotation.x = sw; p.legs[1].rotation.x = -sw; p.arms[0].rotation.x = -sw * 0.8;
    } else if (rent.state === 'knock') {
      p.legs.forEach((l) => (l.rotation.x = 0));
      p.arms[0].rotation.x = -1.4 + Math.sin(T / 70) * 0.3;
      rent.wait -= dt;
      if (rent.wait <= 0) {
        const r = rent.stops[rent.si], t = r.tenant;
        if (t) {
          const here = T - t.last < 3 * 60000 && !t.awayBy;
          if (here) { rent.paid++; floatAt(roomTop(r), '✅'); sfx.tone(1500, 0.12, 'square', 0.06); }
          else { rent.late++; floatAt(roomTop(r), '📝'); }
        }
        p.arms[0].rotation.x = 0;
        rent.si++; rent.state = 'walk';
      }
    } else if (rent.state === 'out') {
      rent.pop -= dt * 3;
      if (rent.pop <= 0) { g.visible = false; rent.state = 'next'; }
    }
    g.scale.setScalar(PS * Math.max(0.01, rent.pop));
    g.position.y = rent.y;
  }

  // =====================================================================
  //  6. Karaoke loa kẹo kéo trên sân thượng (bên phải): comment "hát" / "karaoke"
  // =====================================================================
  const KX = SL / 2 - 2.4; // sân thượng tòa C, đầu gần cổng
  const kara = { q: [], cur: null, last: new Map(), led: null, spk: null };
  {
    const g = new THREE.Group(); g.position.set(KX, ROOF_Y, 0.7); RC.add(g);
    const spk = box(0.75, 1.35, 0.55, M({ color: '#1a1a1f', roughness: 0.6 })); spk.position.y = 0.72; g.add(spk);
    const wf = new THREE.Mesh(new THREE.CircleGeometry(0.26, 24), M({ color: '#3a3a42', roughness: 0.4 })); wf.position.set(0, 0.55, 0.28); g.add(wf);
    const tw = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), M({ color: '#3a3a42' })); tw.position.set(0, 1.08, 0.28); g.add(tw);
    kara.led = new THREE.MeshBasicMaterial({ color: '#222' });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 28), kara.led); ring.position.set(0, 0.55, 0.285); g.add(ring);
    const handle = box(0.06, 0.6, 0.06, M({ color: '#888' })); handle.position.set(0, 1.65, -0.2); g.add(handle);
    const hb = box(0.4, 0.06, 0.06, M({ color: '#888' })); hb.position.set(0, 1.95, -0.2); g.add(hb);
    kara.spk = g; kara.wf = wf;
  }
  function karaoke(t) {
    if (T - (kara.last.get(t.id) || -1e9) < 60000) return;
    if (kara.cur?.t === t || kara.q.includes(t)) return;
    kara.last.set(t.id, T);
    if (kara.cur) { if (kara.q.length < 3) { kara.q.push(t); X.toast(`🎤 ${t.name} xếp hàng chờ hát karaoke`); } return; }
    startSing(t);
  }
  function startSing(t) {
    if (!free(t)) return;
    away(t, 'karaoke');
    const p = copyOf(t);
    p.group.position.set(KX - 1.25, ROOF_Y, 1.0); p.group.rotation.y = -0.25; RC.add(p.group);
    const mic = new THREE.Group(); mic.position.set(0, -0.62, 0.02); p.arms[1].add(mic);
    const mb = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.24, 8), M({ color: '#111' })); mic.add(mb);
    const mh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), M({ color: '#aaa', metalness: 0.6, roughness: 0.3 })); mh.position.y = -0.14; mic.add(mh);
    kara.cur = { t, p, start: T, until: T + 18000, nextNote: 0, nextTone: 0, step: 0 };
    kara.cur.tag = tag(p.group, `🎤 <b>${esc(t.name)}</b> đang hát`, 2.75);
    X.toast(`🎤 ${t.name} lên sân thượng hát karaoke`);
  }
  function lyric(t, text) {
    const c = kara.cur; if (!c || c.t !== t || !text) return;
    c.tag.el.innerHTML = `🎤 <b>${esc(t.name)}</b>: “${esc(text.length > 32 ? text.slice(0, 31) + '…' : text)}”`;
    c.until = Math.max(c.until, Math.min(T + 10000, c.start + 30000));
  }
  const PENTA = [523, 587, 659, 784, 880, 1047];
  function updKara() {
    const c = kara.cur;
    if (!c) { kara.led.color.set('#222'); kara.spk.scale.setScalar(1); if (kara.q.length) { const t = kara.q.shift(); if (free(t)) startSing(t); } return; }
    if (!alive(c.t) || T > c.until) {
      c.p.group.removeFromParent(); untag(c.tag); away(c.t, null);
      if (alive(c.t)) {
        X.toast(`👏 ${c.t.name} hát xong, cả xóm vỗ tay!`);
        X.rooms.filter((r) => r.tenant).slice(0, 4).forEach((r, i) => setTimeout(() => floatAt(roomTop(r), '👏'), i * 200));
        if (Math.random() < 0.3 && X.voiceFree()) X.speak(`Hát hay đấy ${c.t.name}, nhưng nhỏ nhỏ thôi kẻo hàng xóm sang kêu!`);
      }
      kara.cur = null; return;
    }
    const p = c.p, beat = T / 1000 * 2.4;
    p.arms[1].rotation.set(-2.2, 0, -0.35);
    p.arms[0].rotation.z = -0.3 - Math.max(0, Math.sin(beat * 0.5)) * 1.6;
    p.group.rotation.z = Math.sin(beat * Math.PI * 0.5) * 0.06;
    p.headG.rotation.z = Math.sin(beat * Math.PI) * 0.12;
    kara.led.color.setHSL((T / 1500) % 1, 1, 0.55);
    kara.spk.scale.setScalar(1 + Math.max(0, Math.sin(beat * Math.PI)) * 0.04);
    if (T > c.nextNote) {
      c.nextNote = T + 380;
      const v = V3(); p.group.getWorldPosition(v);
      X.spawnSprite(pick(noteTexs), v.add(V3(rand(-0.6, 0.8), 2.6, 0.3)), { vel: V3(rand(-0.3, 0.3), 0.9, 0), life: 2, size: 0.55, grow: 0.1, color: pick(['#ffffff', '#ffd6f5', '#d6f1ff', '#fff3b0']) });
    }
    if (T > c.nextTone) { // giai điệu ngũ cung nhẹ nhàng
      c.nextTone = T + 300; c.step++;
      if (c.step % 8 !== 7) sfx.tone(pick(PENTA), 0.28, 'triangle', 0.035);
      if (c.step % 4 === 0) sfx.tone(130, 0.2, 'sine', 0.08, 0.6);
    }
  }

  // =====================================================================
  //  7. Đá cầu trên sân thượng (bên trái): comment "đá cầu"
  // =====================================================================
  const CAU_X = [-SL / 2 + 1.3, -SL / 2 + 2.7, -SL / 2 + 4.1, -SL / 2 + 5.5]; // sân thượng tòa A, đầu gần cổng
  const cau = { players: [], on: false, best: 0 };
  const shuttle = new THREE.Group();
  {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M({ color: '#d62828' })); shuttle.add(tip);
    const fe = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 10, 1, true), M({ color: '#ffffff', side: THREE.DoubleSide })); fe.position.y = 0.11; fe.rotation.x = Math.PI; shuttle.add(fe);
    shuttle.visible = false; RA.add(shuttle);
  }
  const cauMark = new THREE.Object3D(); cauMark.position.set((CAU_X[0] + CAU_X[3]) / 2, ROOF_Y, 1.0); RA.add(cauMark);
  function daCau(t) {
    if (cau.on) {
      if (cau.players.some((p) => p.t === t) || cau.players.length >= 4 || !free(t)) return;
      addCauPlayer(t); cau.until = Math.min(cau.start + 50000, cau.until + 10000);
      X.toast(`🏸 ${t.name} vào đá cầu cùng`);
      return;
    }
    if (!free(t)) return;
    Object.assign(cau, { on: true, players: [], start: T, until: T + 30000, streak: 0, best: 0, fly: null, wait: 1 });
    addCauPlayer(t);
    const other = [...X.tenants.values()].filter((x) => x !== t && free(x)).sort((a, b) => b.last - a.last)[0];
    if (other) addCauPlayer(other);
    cau.tag = tag(cauMark, '🏸 Đá cầu', 3.1);
    X.toast(`🏸 ${t.name} rủ cả xóm lên sân thượng đá cầu`);
  }
  function addCauPlayer(t) {
    away(t, 'dacau');
    const p = copyOf(t);
    const i = cau.players.length;
    p.group.position.set(CAU_X[i], ROOF_Y, 1.0); RA.add(p.group);
    cau.players.push({ t, p, kickT: 0 });
    const n = cau.players.length, mid = (CAU_X[0] + CAU_X[n - 1]) / 2;
    cau.players.forEach((q, k) => { q.p.group.position.x = n === 1 ? CAU_X[1] : mid + (k - (n - 1) / 2) * 1.5; q.p.group.rotation.y = n === 1 ? 0 : (q.p.group.position.x < mid ? 1 : -1) * Math.PI * 0.32; });
  }
  function endCau() {
    cau.players.forEach((q) => { q.p.group.removeFromParent(); away(q.t, null); });
    shuttle.visible = false; untag(cau.tag);
    X.toast(`🏸 Đá cầu xong, chuỗi dài nhất ${cau.best} quả liên tiếp`);
    cau.on = false; cau.players = [];
  }
  function kickFrom(i) {
    const n = cau.players.length; if (!n) return;
    let j = n === 1 ? i : (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    const a = cau.players[i], b = cau.players[j];
    a.kickT = 0.35; S.kick();
    const miss = Math.random() < 0.12;
    const from = V3(a.p.group.position.x, ROOF_Y + 0.55, 1.15), to = V3(b.p.group.position.x, ROOF_Y + (miss ? 0.05 : 0.55), 1.15);
    if (miss) to.x += rand(-0.6, 0.6);
    cau.fly = { from, to, s: 0, dur: n === 1 ? 0.8 : 1.05, to_i: j, miss, h: n === 1 ? 1.6 : 2.4 };
  }
  function updCau(dt) {
    if (!cau.on) return;
    cau.players = cau.players.filter((q) => { if (alive(q.t)) return true; q.p.group.removeFromParent(); return false; });
    if (!cau.players.length || T > cau.until) { endCau(); return; }
    cau.players.forEach((q) => {
      q.kickT = Math.max(0, q.kickT - dt);
      q.p.legs[1].rotation.x = q.kickT > 0 ? -1.3 * Math.sin((q.kickT / 0.35) * Math.PI) : 0;
      q.p.arms[0].rotation.z = -0.5; q.p.arms[1].rotation.z = 0.5; // dang tay giữ thăng bằng
    });
    if (!cau.fly) {
      cau.wait -= dt;
      if (cau.wait <= 0) { shuttle.visible = true; kickFrom(Math.floor(Math.random() * cau.players.length)); }
    } else {
      const f = cau.fly;
      f.s += dt / f.dur;
      const s = Math.min(1, f.s);
      shuttle.position.lerpVectors(f.from, f.to, s); shuttle.position.y += Math.sin(s * Math.PI) * f.h;
      shuttle.rotation.z = (s - 0.5) * 2;
      if (f.s >= 1) {
        if (f.miss || f.to_i >= cau.players.length) {
          floatAt(rp(RA, f.to.x, ROOF_Y + 2.4, 1.0), '😅'); cau.streak = 0; cau.fly = null; cau.wait = 1.4; sfx.noise(0.08, 0.15, 500);
        } else {
          cau.streak++; cau.best = Math.max(cau.best, cau.streak);
          if (cau.streak % 10 === 0) floatAt(rp(RA, f.to.x, ROOF_Y + 2.6, 1.0), '🔥');
          kickFrom(f.to_i);
        }
        cau.tag.el.innerHTML = `🏸 Đá cầu · chuỗi <b>${cau.streak}</b> quả`;
      }
    }
  }

  // =====================================================================
  //  8. Lẩu sân thượng (quà 100–499 xu): người tặng và cả xóm ngồi quây nồi lẩu
  // =====================================================================
  const LX = 0.6;
  const lau = { on: false, guests: [], group: new THREE.Group(), bulbs: [] };
  {
    const g = lau.group; g.position.set(LX, ROOF_Y, 0); g.visible = false; RB.add(g); // sân thượng tòa giữa
    const blue = M({ color: '#3a86ff', roughness: 0.5 });
    const top = box(2.3, 0.06, 0.95, blue); top.position.set(0, 0.62, 0.6); g.add(top);
    [[-1.05, 0.2], [1.05, 0.2], [-1.05, 1.0], [1.05, 1.0]].forEach(([x, z]) => { const l = box(0.06, 0.62, 0.06, blue); l.position.set(x, 0.31, z); g.add(l); });
    const stove = box(0.45, 0.12, 0.38, M({ color: '#2b2b2b' })); stove.position.set(0, 0.71, 0.6); g.add(stove);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.26, 20), M({ color: '#c7c9cc', metalness: 0.7, roughness: 0.3 })); pot.position.set(0, 0.9, 0.6); g.add(pot);
    const broth = new THREE.Mesh(new THREE.CircleGeometry(0.31, 20), M({ color: '#d9480f', emissive: '#7a2000', emissiveIntensity: 0.4 })); broth.rotation.x = -Math.PI / 2; broth.position.set(0, 1.02, 0.6); g.add(broth);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.glowTex, color: '#4cc9f0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); flame.position.set(0, 0.78, 0.6); flame.scale.setScalar(0.5); g.add(flame);
    for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.07, 12), M({ color: '#f8f9fa' })); b.position.set(-0.85 + k * 0.34, 0.68, k % 2 ? 0.95 : 0.25); g.add(b); }
    // dây đèn bóng tròn căng ngang sân thượng
    [-1.9, 2.1].forEach((x) => { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), M({ color: '#666' })); pole.position.set(x, 1.15, 0.1); g.add(pole); });
    for (let k = 0; k <= 12; k++) {
      const s = k / 12, x = -1.9 + s * 4.0, y = 2.25 - Math.sin(s * Math.PI) * 0.35;
      const m = new THREE.MeshBasicMaterial({ color: '#ffd166' });
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), m); b.position.set(x, y, 0.1); g.add(b); lau.bulbs.push(m);
    }
    lau.steamAt = rp(RB, LX, ROOF_Y + 1.1, 0.6);
    lau.stoolM = M({ color: '#d62828', roughness: 0.5 });
  }
  const LAU_SEATS = [[-0.75, 0.0, 0], [-0.25, 0.0, 0], [0.25, 0.0, 0], [0.75, 0.0, 0], [-1.45, 0.6, Math.PI / 2], [1.45, 0.6, -Math.PI / 2]];
  function lauAdd(t) {
    if (!free(t) || lau.guests.length >= LAU_SEATS.length || lau.guests.some((q) => q.t === t)) return;
    const [sx, sz, ry] = LAU_SEATS[lau.guests.length];
    away(t, 'lau');
    const p = copyOf(t); X.sitPose(p);
    p.group.position.set(LX + sx, ROOF_Y + 0.18, sz); p.group.rotation.y = ry; RB.add(p.group);
    const st = box(0.3, 0.3, 0.3, lau.stoolM); st.position.set(sx, 0.15, sz); lau.group.add(st);
    lau.guests.push({ t, p, st, ph: rand(0, 6) });
  }
  function startLau(t) {
    if (lau.on) {
      lau.until = Math.min(lau.until + 30000, T + 90000); lauAdd(t);
      X.toast(`🍲 ${t.name} góp thêm nồi lẩu, tiệc kéo dài thêm`);
      return;
    }
    Object.assign(lau, { on: true, until: T + 60000, guests: [], nextCheer: T + 5000, host: t });
    lau.group.visible = true;
    lauAdd(t);
    [...X.tenants.values()].filter((x) => x !== t && free(x)).sort((a, b) => b.last - a.last).slice(0, 5).forEach(lauAdd);
    lau.tag = tag(lau.group, `🍲 Lẩu của <b>${esc(t.name)}</b>`, 2.75);
  }
  function endLau() {
    lau.guests.forEach((q) => { q.p.group.removeFromParent(); lau.group.remove(q.st); away(q.t, null); });
    lau.guests = []; lau.on = false; lau.group.visible = false; untag(lau.tag);
    X.toast('🍲 Tiệc lẩu tàn, cả xóm về phòng rửa bát!');
  }
  function updLau(dt) {
    if (!lau.on) return;
    if (T > lau.until) { endLau(); return; }
    lau.guests = lau.guests.filter((q) => { if (alive(q.t)) return true; q.p.group.removeFromParent(); lau.group.remove(q.st); return false; });
    const cheer = T < (lau.cheerUntil || 0);
    lau.guests.forEach((q) => {
      q.p.arms[1].rotation.x = cheer ? 0 : -1.1 + Math.max(0, Math.sin(T / 400 + q.ph)) * 0.6;
      q.p.arms[1].rotation.z = cheer ? -2.6 : 0.12;
      q.p.headG.rotation.z = Math.sin(T / 700 + q.ph) * 0.08;
    });
    lau.bulbs.forEach((m, k) => m.color.setHSL(((T / 3000) + k * 0.08) % 1, 0.9, X.dayK() > 0.5 ? 0.45 : 0.62));
    if (Math.random() < dt * 4) X.spawnSprite(X.steamTex, lau.steamAt.clone().add(V3(rand(-0.15, 0.15), 0, 0)), { vel: V3(rand(-0.1, 0.1), 0.7, 0), life: 1.8, size: 0.35, grow: 0.8, opacity: 0.5 });
    if (T > lau.nextCheer && lau.guests.length > 1) {
      lau.nextCheer = T + rand(7000, 11000); lau.cheerUntil = T + 1200; S.clink();
      floatAt(rp(RB, LX, ROOF_Y + 2.7, 0.4), pick(['🥤', '🥢', '😋']));
    }
  }

  // =====================================================================
  //  9. Xe hoa (quà 500+): chạy chậm qua trước cổng mừng phòng VIP
  // =====================================================================
  const hoa = { q: [], cur: null };
  function makeXeHoa(num, name) {
    const g = new THREE.Group();
    const white = M({ color: '#f8f9fa', roughness: 0.35, metalness: 0.3 });
    const body = box(3.8, 0.6, 1.6, white); body.position.y = 0.6; g.add(body);
    const cab = box(2.0, 0.6, 1.45, M({ color: '#9fc5e8', roughness: 0.15, metalness: 0.6 })); cab.position.set(-0.25, 1.2, 0); g.add(cab);
    const roof = box(1.9, 0.06, 1.45, white); roof.position.set(-0.25, 1.52, 0); g.add(roof);
    [[1.25, 0.8], [1.25, -0.8], [-1.25, 0.8], [-1.25, -0.8]].forEach(([x, z]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 16), M({ color: '#111' })); w.rotation.x = Math.PI / 2; w.position.set(x, 0.33, z); g.add(w); });
    // trái tim kết hoa hồng dựng trên nắp capô
    const roses = [M({ color: '#e5383b' }), M({ color: '#ff8fab' }), M({ color: '#ffffff' })];
    for (let k = 0; k < 44; k++) {
      const a = (k / 44) * Math.PI * 2;
      const hx = 16 * Math.sin(a) ** 3, hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
      const r = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), roses[k % 3]); r.position.set(1.2, 1.35 + hy * 0.024, hx * 0.024); g.add(r);
    }
    const heartIn = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), M({ color: '#ff4d6d', side: THREE.DoubleSide })); heartIn.rotation.y = Math.PI / 2; heartIn.position.set(1.2, 1.38, 0); g.add(heartIn);
    // ruy băng hồng từ đầu xe lên nóc
    [0.6, -0.6].forEach((z) => { const rb = box(1.7, 0.03, 0.1, M({ color: '#ff8fab' })); rb.position.set(0.55, 1.2, z); rb.rotation.z = 0.32; g.add(rb); });
    // biển bên hông
    const sideTex = X.signTexOf(`♥ VIP ♥`, '#ffffff', '#d6336c', name);
    [1, -1].forEach((s) => { const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.46), new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.5 })); pl.position.set(-0.2, 0.62, 0.81 * s); if (s < 0) pl.rotation.y = Math.PI; g.add(pl); });
    // bóng bay buộc đuôi xe
    ['#ff4d6d', '#ffd166', '#4cc9f0'].forEach((c, k) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), M({ color: c, roughness: 0.3 })); b.scale.y = 1.2; b.position.set(-1.9 - k * 0.15, 2.3 + k * 0.25, (k - 1) * 0.35); g.add(b);
      const str = box(0.01, 1.3 + k * 0.25, 0.01, M({ color: '#ddd' })); str.position.set(-1.85 - k * 0.07, 1.45 + k * 0.12, (k - 1) * 0.18); g.add(str);
    });
    return g;
  }
  function xeHoa(t) {
    if (hoa.q.length < 2) hoa.q.push({ num: t.room.number, name: t.name });
  }
  function updHoa(dt) {
    if (!hoa.cur && hoa.q.length) {
      const o = hoa.q.shift();
      const g = makeXeHoa(o.num, o.name); g.position.set(-42, 0.2, 7.9); scene.add(g);
      const veh = { g, v: 6, vmax: 6, acc: 3, path: [{ x: -7, z: 7.9 }], snd: sfx.engine(70, 0.06) };
      veh.tag = tag(g, `💐 Xe hoa mừng <b>${esc(o.name)}</b> lên phòng VIP`, 2.8);
      hoa.cur = { veh, phase: 0 };
    }
    const c = hoa.cur; if (!c) return;
    const veh = c.veh, x = veh.g.position.x;
    if (!veh.path.length) {
      if (c.phase === 0) { c.phase = 1; veh.vmax = 2.2; veh.path = [{ x: 7, z: 7.9 }]; S.tune([523, 659, 784, 1047, 784, 1047], 0.17); }
      else if (c.phase === 1) { c.phase = 2; veh.vmax = 7; veh.path = [{ x: 44, z: 7.9 }]; S.tune([784, 659, 784], 0.15); }
      else { dropVeh(veh); hoa.cur = null; return; }
    }
    drive(veh, dt); vehSound(veh);
    if (Math.abs(x) < 20 && Math.random() < dt * 8) X.spawnSprite(petalTex, V3(x - 2, rand(1.2, 2.4), 7.9 + rand(-0.6, 0.6)), { vel: V3(rand(-1.2, -0.4), rand(0.2, 0.8), rand(-0.3, 0.3)), life: 2.2, size: 0.4, grow: 0, gravity: 0.6 });
  }

  // =====================================================================
  //  Sự kiện có thanh tiến độ: cúp nước, gió to, mùa thi
  // =====================================================================
  const next = {
    cupnuoc: performance.now() + 8 * 60000,
    gio: performance.now() + 10.5 * 60000,
    muathi: performance.now() + 13 * 60000,
  };
  const evGet = () => X.ev.get();
  function finishEvent(kind) {
    X.ev.set(null); X.eventEl.classList.remove('show'); X.afterEvent();
    next[kind] = T + mins({ cupnuoc: 'phutGiuaCacLanCupNuoc', gio: 'phutGiuaCacLanGio', muathi: 'phutGiuaCacLanMuaThi' }[kind], { cupnuoc: 11, gio: 9, muathi: 13 }[kind]);
  }
  const occupiedRooms = () => X.rooms.filter((r) => r.tenant && r.person);

  // ---------- cúp nước: tim gọi xe bồn, vòi bơm nước lên bồn inox trên mái ----------
  const buckets = new Map(); // room → mesh
  const truck = { cur: null };
  function startCupNuoc() {
    if (evGet() || !X.tenants.size) return false;
    const need = Math.round(clamp(X.tenants.size * 20, 50, Number(cfg().timDeCoNuoc) || 200));
    X.ev.set({ kind: 'cupnuoc', need, have: 0, until: T + 100000 });
    X.showEvent('🚱 CÚP NƯỚC RỒI! 🚱', 'Cả xóm thả tim để gọi xe bồn chở nước tới!');
    X.speak(`Ối, cúp nước rồi cả xóm ơi! Thả tim để ${XH()} gọi xe bồn chở nước tới nhé, cần ${need} tim!`, true);
    sfx.tone(300, 0.5, 'sine', 0.15, 0.4);
    return true;
  }
  function addBuckets(on) {
    if (!on) { buckets.forEach((m) => m.removeFromParent()); buckets.clear(); return; }
    for (const r of occupiedRooms()) {
      if (buckets.get(r)?.parent && buckets.get(r).userData.pid === r.person.group.uuid) continue;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.24, 12), M({ color: '#2a9df4', roughness: 0.5 }));
      m.position.set(0, -0.68, 0.04); m.userData.pid = r.person.group.uuid; r.person.arms[0].add(m); // chỉ lưu id: userData bị sao chép khi clone người buckets.set(r, m);
    }
  }
  function makeTruck() {
    const g = new THREE.Group();
    const chassis = box(5.2, 0.3, 1.8, M({ color: '#333' })); chassis.position.y = 0.6; g.add(chassis);
    const cab = box(1.4, 1.4, 1.9, M({ color: '#e9ecef', roughness: 0.4 })); cab.position.set(2.0, 1.4, 0); g.add(cab);
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), M({ color: '#1b2a3a', roughness: 0.2 })); ws.position.set(2.71, 1.7, 0); ws.rotation.y = Math.PI / 2; g.add(ws);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 3.4, 20), M({ color: '#2a7de1', roughness: 0.35, metalness: 0.3 })); tank.rotation.z = Math.PI / 2; tank.position.set(-0.55, 1.6, 0); g.add(tank);
    const tex = X.signTexOf('NƯỚC SẠCH', '#ffffff', '#1d6fd1');
    [1, -1].forEach((s) => { const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.62), new THREE.MeshStandardMaterial({ map: tex })); pl.position.set(-0.55, 1.6, 0.87 * s); if (s < 0) pl.rotation.y = Math.PI; g.add(pl); });
    [[1.9, 0.9], [1.9, -0.9], [-1.0, 0.9], [-1.0, -0.9], [-2.0, 0.9], [-2.0, -0.9]].forEach(([x, z]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16), M({ color: '#111' })); w.rotation.x = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w); });
    g.scale.setScalar(0.9);
    return g;
  }
  function callTruck(byPlayers) {
    const e = evGet(); if (!e || e.truck) return;
    e.truck = true; e.byPlayers = byPlayers;
    X.showEvent('🚚 XE BỒN ĐANG TỚI! 🚚', byPlayers ? 'Cả xóm giỏi quá, xe bồn đang chở nước tới!' : `${XH()} chủ trọ gọi được xe nước rồi, chờ chút nhé!`);
    if (byPlayers) X.speak('Đủ tim rồi! Xe bồn chở nước đang tới, cả xóm chuẩn bị xô chậu nhé!', true);
    else X.speak(`Thôi được rồi, ${XH()} gọi được xe nước rồi. Chờ chút nhé cả xóm!`, true);
  }
  function updTruck(dt) {
    const e = evGet();
    if (!truck.cur && e?.kind === 'cupnuoc' && e.truck && X.bus.state === 'idle') {
      const g = makeTruck(); g.position.set(-46, 0.2, X.BUS_Z); scene.add(g);
      const TXp = -3.0;
      const veh = { g, v: 8, vmax: 8, acc: 3, path: [{ x: TXp, z: X.BUS_Z, stop: true, done: () => { sfx.hiss(); truck.cur.state = 'hose'; truck.cur.k = 0; } }], snd: sfx.engine(55, 0.11) };
      veh.tag = tag(g, '🚚 Xe bồn nước sạch', 3.0);
      // vòi nước từ bồn xe lên bồn inox trên mái
      // vòi nước vắt qua sân, lên bồn inox trên mái tòa giữa
      const A = V3(TXp - 0.8, 2.6, X.BUS_Z), B = rp(RB, -MW / 2 + 3, X.TOP + 2.0, -0.4);
      const mid = (k, y) => V3(A.x + (B.x - A.x) * k, y, A.z + (B.z - A.z) * k);
      const curve = new THREE.CatmullRomCurve3([A, V3(TXp - 1.2, 6, X.BUS_Z - 0.8), mid(0.35, X.TOP * 0.75), mid(0.75, X.TOP + 3.5), B]);
      const hose = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.09, 6), M({ color: '#ffb703', roughness: 0.6 }));
      hose.geometry.setDrawRange(0, 0); hose.visible = false; scene.add(hose);
      truck.cur = { veh, hose, curve, state: 'come', k: 0, flowT: 0 };
    }
    const c = truck.cur; if (!c) return;
    drive(c.veh, dt); vehSound(c.veh);
    const total = c.hose.geometry.index.count;
    if (c.state === 'hose') {
      c.hose.visible = true; c.k = Math.min(1, c.k + dt / 2);
      c.hose.geometry.setDrawRange(0, Math.floor((total * c.k) / 6) * 6);
      if (c.k >= 1) { c.state = 'flow'; c.flowT = 6; S.water(); }
    } else if (c.state === 'flow') {
      c.flowT -= dt;
      for (let i = 0; i < 3; i++) {
        const u = ((T / 1500) + i / 3 + Math.random() * 0.05) % 1;
        X.spawnSprite(X.glowTex, c.curve.getPointAt(u), { life: 0.4, size: 0.35, grow: -0.2, color: '#8fd3ff', additive: true });
      }
      if (Math.random() < dt * 1.5) S.water();
      if (c.flowT <= 0) { c.state = 'reel'; endCupNuoc(); }
    } else if (c.state === 'reel') {
      c.k = Math.max(0, c.k - dt / 1.2);
      c.hose.geometry.setDrawRange(0, Math.floor((total * c.k) / 6) * 6);
      if (c.k <= 0) { scene.remove(c.hose); c.hose.geometry.dispose(); c.state = 'leave'; c.veh.path = [{ x: 46, z: X.BUS_Z }]; X.sfx.honk(); }
    } else if (c.state === 'leave' && c.veh.g.position.x > 44) { dropVeh(c.veh); truck.cur = null; }
  }
  function endCupNuoc() {
    const e = evGet(); if (e?.kind !== 'cupnuoc') return;
    addBuckets(false);
    occupiedRooms().forEach((r, i) => setTimeout(() => floatAt(roomTop(r), '💦'), i * 60));
    X.banner('🚰 Có nước rồi!', e.byPlayers ? 'Cả xóm thả tim gọi xe bồn thành công!' : 'Xe bồn đã bơm đầy bồn nước', 3200);
    X.speak(e.byPlayers ? 'Có nước rồi! Cảm ơn cả xóm, đi tắm giặt thôi!' : 'Có nước rồi nhé cả xóm, dùng tiết kiệm thôi!', true);
    if (e.byPlayers) for (let i = 0; i < 3; i++) setTimeout(X.firework, i * 300);
    finishEvent('cupnuoc');
  }

  // ---------- gió to: quần áo bay xuống đường, comment "nhặt" ----------
  const cloths = [];
  let windSnd = null;
  function startGio() {
    if (evGet() || !X.tenants.size) return false;
    const dur = 40;
    const rs = occupiedRooms();
    X.ev.set({ kind: 'gio', until: T + dur * 1000, dur, total: rs.length, picked: 0 });
    rs.forEach((r) => {
      r.clothes.visible = false;
      r.tenant.pickedClothes = false;
      for (let k = 0; k < 2; k++) {
        const mat = r.clothMats[k];
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.62), mat));
        const arms = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.18), mat); arms.position.y = 0.22; g.add(arms);
        const from = X.roomPt(r, -0.55 + k * 1.1, 2.1, 1.35);
        const to = V3(clamp(from.x + rand(-3, 3), -X.BW / 2 + 1, X.BW / 2 - 1), 0.28 + rand(0, 0.05), rand(3.2, 7.5));
        g.position.copy(from); scene.add(g);
        cloths.push({ g, r, t: r.tenant, from, to, t0: T + rand(0, 3500), dur: 2.5 + from.y / 6, back: null, ph: rand(0, 6) });
      }
    });
    X.showEvent('🌬️ GIÓ TO QUÁ! 🌬️', 'Quần áo bay hết xuống đường! Comment "nhặt" để nhặt đồ về!');
    X.speak('Gió to quá cả xóm ơi! Quần áo bay hết xuống đường rồi, comment nhặt để chạy xuống nhặt về nhé!', true);
    windSnd = sfx.loop ? sfx.loop(500, 0.16) : null;
    return true;
  }
  function pickClothes(t) {
    const e = evGet(); if (e?.kind !== 'gio' || t.pickedClothes) return;
    const mine = cloths.filter((c) => c.t === t && !c.back);
    if (!mine.length) return;
    t.pickedClothes = true; e.picked++;
    mine.forEach((c) => { c.back = { s: 0, start: c.g.position.clone(), rot: c.g.rotation.clone() }; });
    floatAt(roomTop(t.room), '👕');
    X.toast(`👕 ${t.name} chạy xuống nhặt quần áo về phòng`);
  }
  function updGio(dt) {
    for (let i = cloths.length - 1; i >= 0; i--) {
      const c = cloths[i], g = c.g;
      if (c.back) {
        c.back.s = Math.min(1, c.back.s + dt / 1.4);
        const s = c.back.s;
        g.position.lerpVectors(c.back.start, c.from, s); g.position.y += Math.sin(s * Math.PI) * 1.2;
        g.rotation.set(c.back.rot.x * (1 - s), 0, c.back.rot.z * (1 - s));
        if (s >= 1) { scene.remove(g); cloths.splice(i, 1); if (alive(c.t) && c.t.room === c.r) c.r.clothes.visible = true; }
        continue;
      }
      if (T < c.t0) { g.rotation.z = Math.sin(T / 90 + c.ph) * 0.4; continue; }
      const s = Math.min(1, (T - c.t0) / 1000 / c.dur);
      g.position.lerpVectors(c.from, c.to, s);
      g.position.x += Math.sin(T / 300 + c.ph) * 1.1 * (1 - s);
      g.position.y += Math.sin(s * Math.PI) * 1.4;
      g.rotation.z = Math.sin(T / 120 + c.ph) * 0.9 * (1 - s);
      g.rotation.x = -Math.PI / 2 * s * s;
    }
    const e = evGet(); if (e?.kind !== 'gio') return;
    if (Math.random() < dt * 7) X.spawnSprite(leafTex, V3(-X.BW / 2 - 4, rand(1, X.TOP), rand(X.MID_Z, 9)), { vel: V3(rand(8, 12), rand(-0.8, 0.8), 0), life: 3.6, size: rand(0.35, 0.6), grow: 0 });
    X.clouds.forEach((cl) => { cl.s.position.x += cl.v * dt * 6; });
    if (windSnd) windSnd.f.frequency.setTargetAtTime(380 + Math.sin(T / 900) * 200 + Math.sin(T / 330) * 90, windSnd.a.currentTime, 0.2);
    if (T > e.until) endGio();
  }
  function endGio() {
    const e = evGet(); if (e?.kind !== 'gio') return;
    if (windSnd) { windSnd.stop(); windSnd = null; }
    const lost = [...new Set(cloths.filter((c) => !c.back).map((c) => c.t))].filter(alive);
    cloths.filter((c) => !c.back).forEach((c) => { scene.remove(c.g); cloths.splice(cloths.indexOf(c), 1); });
    if (lost.length) {
      const names = lost.slice(0, 3).map((t) => t.name).join(', ');
      X.speak(`Hết gió rồi. ${names}${lost.length > 3 ? ' với mấy đứa nữa' : ''} chưa nhặt đồ, ${XH()} gom để ở cổng rồi đấy nhé!`, true);
    } else X.speak('Hết gió rồi! Cả xóm nhanh tay nhặt đồ về hết, giỏi quá!', true);
    setTimeout(() => lost.forEach((t) => alive(t) && (t.room.clothes.visible = Math.random() < 0.7)), 20000);
    finishEvent('gio');
  }

  // ---------- mùa thi: tim để cả xóm thức ôn bài ----------
  const lamps = new Map();
  function startMuaThi() {
    if (evGet() || !X.tenants.size) return false;
    const need = Math.round(clamp(X.tenants.size * 20, 60, Number(cfg().timDeOnThi) || 250));
    X.ev.set({ kind: 'muathi', need, have: 0, until: T + 90000 });
    X.showEvent('📚 MÙA THI ĐẾN RỒI! 📚', 'Thả tim để cả xóm thức đêm ôn bài! Comment "học bài" để cổ vũ!');
    X.speak(`Sắp thi rồi đấy cả xóm! Thả tim để cả xóm ôn bài nào, cần ${need} tim. Đứa nào chưa học thì comment học bài đi!`, true);
    return true;
  }
  function setLamps(on) {
    if (!on) { lamps.forEach((s) => s.removeFromParent()); lamps.clear(); return; }
    for (const r of occupiedRooms()) {
      if (lamps.has(r)) continue;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.glowTex, color: '#d8ecff', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.position.set(0.72, 1.55, 0.3); s.scale.setScalar(1.3); r.group.add(s); lamps.set(r, s);
    }
    lamps.forEach((s, r) => { if (!r.tenant) { s.removeFromParent(); lamps.delete(r); } });
  }
  function endMuaThi(byPlayers) {
    setLamps(false);
    if (byPlayers) {
      X.banner('📚 Cả xóm ôn bài xong!', 'Đi ngủ sớm, mai còn đi thi!', 3500);
      X.speak('Giỏi quá, cả xóm ôn bài xong hết rồi! Giờ đi ngủ sớm, mai đi thi cho tỉnh táo nhé!', true);
      for (let i = 0; i < 3; i++) setTimeout(X.firework, i * 300);
    } else X.speak(`Muộn rồi, thôi đi ngủ đi, mai dậy sớm ôn tiếp nhé cả xóm!`, true);
    finishEvent('muathi');
  }
  function updMuaThi(dt) {
    const e = evGet();
    if (e?.kind === 'cupnuoc') {
      if (!e.truck) addBuckets(true);
      if (!e.truck && Math.random() < dt * 0.8) { const rs = occupiedRooms(); if (rs.length) floatAt(roomTop(pick(rs)), pick(['🪣', '😩', '🚱'])); }
      if (!e.truck && T > e.until) callTruck(false);
    }
    if (e?.kind !== 'muathi') return;
    setLamps(true);
    if (Math.random() < dt * 0.9) { const rs = occupiedRooms(); if (rs.length) floatAt(roomTop(pick(rs)), pick(['📚', '✏️', '☕', '😵', '📖'])); }
    if (T > e.until) endMuaThi(false);
  }
  function meter(e, n, t) {
    e.have += n;
    if (e.kind === 'cupnuoc' && !e.truck) {
      if (Math.random() < 0.5 && t) { const v = V3(); t.room.glass.getWorldPosition(v); X.spawnSprite(dropTex, v.add(V3(0, 0.5, 1)), { vel: V3(0, 1.2, 0), life: 1.2, size: 0.5 }); }
      if (e.have >= e.need) callTruck(true);
    } else if (e.kind === 'muathi') {
      if (Math.random() < 0.3 && t) floatAt(roomTop(t.room), '✏️');
      if (e.have >= e.need) endMuaThi(true);
    }
  }

  // =====================================================================
  //  Trang trí ngày lễ: Tết, Trung thu, Noel (tự bật theo lịch, hoặc config trangTriLe)
  // =====================================================================
  const TET = ['2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03', '2031-01-23', '2032-02-11'];
  const TRUNG_THU = ['2026-09-25', '2027-09-15', '2028-10-03', '2029-09-22', '2030-09-12', '2031-10-01', '2032-09-19'];
  function leHomNay() {
    const mode = X.params.get('le') || cfg().trangTriLe || 'tu-dong';
    if (mode === 'khong') return null;
    if (['tet', 'trungthu', 'noel'].includes(mode)) return mode;
    const d = new Date(), day = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const near = (list, before, after) => list.some((s) => { const x = Date.parse(`${s}T00:00:00Z`); return day >= x - before * 864e5 && day <= x + after * 864e5; });
    if (near(TET, 10, 7)) return 'tet';
    if (near(TRUNG_THU, 7, 1)) return 'trungthu';
    if (d.getMonth() === 11 && d.getDate() >= 18 && d.getDate() <= 26) return 'noel';
    return null;
  }
  const bannerTex = (text, bg = '#c1121f', fg = '#ffe066') => X.canvasTex(1024, 96, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 60px "Be Vietnam Pro", sans-serif'; g.fillText(text, w / 2, h / 2 + 3);
  });
  function roofBanner(text, parent, bg, fg) {
    const tex = bannerTex(text, bg, fg);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 0.72), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35 }));
    m.position.copy(rp(RB, 0, X.TOP + 0.42, X.CORR + 0.24)); parent.add(m); // mặt trước lan can mái tòa giữa
  }
  // vị trí treo đèn giữa các phòng, dưới trần hành lang
  function hangSpots() {
    const out = [];
    for (const b of [X.blocks.A, X.blocks.B, X.blocks.C]) {
      const cols = Math.round((b.bw - 1.2) / X.ROOM_W);
      for (let f = 1; f <= X.FLOORS; f++) for (let c = 0; c < cols - 1; c += 2) out.push(rp(b.bg, (c + 1 - cols / 2) * X.ROOM_W, X.floorBase(f) + X.FLOOR_H - 0.5, 1.5));
    }
    return out;
  }
  const deco = { cur: undefined, sets: {} };
  function buildTet() {
    const g = new THREE.Group(), swing = [];
    const redM = new THREE.MeshStandardMaterial({ color: '#d00000', emissive: '#ff2a00', emissiveIntensity: 0.55, roughness: 0.6 });
    const goldM = M({ color: '#ffc300', metalness: 0.5, roughness: 0.4 });
    hangSpots().forEach((p, i) => {
      const L = new THREE.Group(); L.position.copy(p); g.add(L);
      const str = box(0.015, 0.35, 0.015, goldM); str.position.y = 0.2; L.add(str);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), redM); ball.scale.y = 0.82; L.add(ball);
      [0.19, -0.19].forEach((y) => { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), goldM); cap.position.y = y; L.add(cap); });
      const tas = box(0.04, 0.22, 0.04, goldM); tas.position.y = -0.33; L.add(tas);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.glowTex, color: '#ff5a3c', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(1.0); L.add(gl);
      swing.push([L, i]);
    });
    // hai chậu mai vàng trước cổng
    const blossom = M({ color: '#ffd60a', emissive: '#ffb703', emissiveIntensity: 0.35 });
    [-2.35, 2.35].forEach((x) => {
      const tr = new THREE.Group(); tr.position.set(x, 0.2, 3.3); g.add(tr);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.45, 14), M({ color: '#8c2f1b' })); pot.position.y = 0.22; tr.add(pot);
      const wood = M({ color: '#5a3d1a' });
      [[0, 0.75, 0, 0], [0.2, 1.15, 0.5, 0], [-0.2, 1.2, -0.55, 0.2]].forEach(([bx, by, rz, rx]) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.75, 6), wood); b.position.set(bx, by, 0); b.rotation.set(rx, 0, rz); tr.add(b); });
      const N = 130, inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 6, 4), blossom, N), m4 = new THREE.Matrix4();
      for (let k = 0; k < N; k++) { const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()); m4.makeTranslation(Math.cos(a) * r * 0.7, 1.45 + rand(-0.35, 0.35), Math.sin(a) * r * 0.4); inst.setMatrixAt(k, m4); }
      tr.add(inst);
    });
    // câu đối hai bên cổng
    const caudoi = (a, b) => X.canvasTex(96, 320, (c, w, h) => {
      c.fillStyle = '#c1121f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffd60a'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8);
      c.fillStyle = '#ffd60a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 30px "Be Vietnam Pro", sans-serif';
      [...a.split(' '), ...b.split(' ')].forEach((wd, i) => c.fillText(wd, w / 2, 40 + i * 60));
    });
    [[-2.75, 'XUÂN AN', 'KHANG'], [2.75, 'TẾT SUM', 'VẦY']].forEach(([x, a, b]) => { const tex = caudoi(a, b); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.4), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.2 })); m.position.set(x, 1.05, 0.03); g.add(m); });
    roofBanner('CHÚC MỪNG NĂM MỚI', g);
    let nextFw = 0;
    return {
      g, update(dt) {
        swing.forEach(([L, i]) => { L.rotation.z = Math.sin(T / 900 + i) * 0.08; });
        if (X.dayK() < 0.3 && T > nextFw) { nextFw = T + rand(60000, 100000); if (nextFw && !evGet()) for (let i = 0; i < 3; i++) setTimeout(X.firework, i * 350); }
      },
    };
  }
  function lionGroup() {
    const g = new THREE.Group();
    const red = M({ color: '#d00000', roughness: 0.5 }), yel = M({ color: '#ffc300', roughness: 0.5 }), wht = M({ color: '#ffffff' }), blk = new THREE.MeshBasicMaterial({ color: '#111' });
    const head = new THREE.Group(); head.position.set(0.75, 1.25, 0); g.add(head);
    const skull = box(0.7, 0.55, 0.62, red); head.add(skull);
    const face = box(0.05, 0.4, 0.5, yel); face.position.set(0.36, 0, 0); head.add(face);
    [0.15, -0.15].forEach((z) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), wht); e.position.set(0.37, 0.12, z); head.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), blk); p.position.set(0.44, 0.12, z); head.add(p); });
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 8), yel); horn.position.set(0.15, 0.38, 0); head.add(horn);
    const jaw = box(0.45, 0.1, 0.5, red); jaw.position.set(0.18, -0.32, 0); head.add(jaw);
    for (let k = 0; k < 8; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), k % 2 ? wht : yel); const a = (k / 8) * Math.PI * 2; f.position.set(0.0, Math.cos(a) * 0.33, Math.sin(a) * 0.36); head.add(f); }
    const clothTex = X.canvasTex(256, 64, (c, w, h) => { for (let x = 0; x < w; x += 32) { c.fillStyle = (x / 32) % 2 ? '#ffc300' : '#d00000'; c.fillRect(x, 0, 32, h); } c.fillStyle = '#ffffff'; c.fillRect(0, h - 10, w, 10); });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.62), new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.8 })); body.position.set(-0.35, 1.05, 0); body.rotation.z = -0.08; g.add(body);
    const legs = [];
    const pants = M({ color: '#1d3557' });
    [[0.6, 0.12], [0.6, -0.12], [-0.8, 0.12], [-0.8, -0.12]].forEach(([x, z]) => { const p = new THREE.Group(); p.position.set(x, 0.75, z); g.add(p); const l = box(0.16, 0.72, 0.16, pants); l.position.y = -0.36; p.add(l); legs.push(p); });
    g.scale.setScalar(1.05);
    return { g, head, jaw, legs };
  }
  function starShape(R = 0.28, r = 0.12) {
    const s = new THREE.Shape();
    for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r : R; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (k) s.lineTo(x, y); else s.moveTo(x, y); }
    s.closePath(); return s;
  }
  function buildTrungThu() {
    const g = new THREE.Group(), stars = [];
    const geo = new THREE.ExtrudeGeometry(starShape(), { depth: 0.08, bevelEnabled: false });
    hangSpots().forEach((p, i) => {
      const L = new THREE.Group(); L.position.copy(p); g.add(L);
      const str = box(0.015, 0.3, 0.015, M({ color: '#ddd' })); str.position.y = 0.42; L.add(str);
      const col = i % 2 ? '#ffc300' : '#e63946';
      const st = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.65, roughness: 0.5 })); st.position.z = -0.04; L.add(st);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.glowTex, color: col, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(1.1); L.add(gl);
      stars.push([L, i]);
    });
    roofBanner('VUI TẾT TRUNG THU', g, '#7b2cbf', '#ffe066');
    const lion = lionGroup(); lion.g.visible = false; g.add(lion.g);
    let nextShow = T + 20000, show = null;
    return {
      g,
      on() { X.moonD.scale.setScalar(1.6); X.moonS.scale.set(22, 22, 1); },
      off() { X.moonD.scale.setScalar(1); X.moonS.scale.set(14, 14, 1); lion.g.visible = false; show = null; },
      update(dt) {
        stars.forEach(([L, i]) => { L.rotation.y = Math.sin(T / 1200 + i) * 0.5; L.rotation.z = Math.sin(T / 900 + i) * 0.06; });
        // múa lân trước cổng: cứ ~80 giây múa ~16 giây, có trống tùng tùng cắc
        if (!show && T > nextShow) { show = { t0: T, beat: 0 }; lion.g.visible = true; X.toast('🦁 Đoàn lân về múa trước cổng xóm!'); }
        if (show) {
          const s = (T - show.t0) / 16000;
          if (s >= 1) { show = null; lion.g.visible = false; nextShow = T + rand(70000, 95000); return; }
          const x = -7 + s * 14 + Math.sin(s * Math.PI * 6) * 0.8;
          lion.g.position.set(x, 0.2 + Math.abs(Math.sin(T / 180)) * 0.12, 4.1);
          lion.g.rotation.y = -0.6 + Math.sin(T / 700) * 0.5;
          lion.head.rotation.z = Math.sin(T / 160) * 0.25; lion.head.rotation.y = Math.sin(T / 400) * 0.4;
          lion.jaw.position.y = -0.32 - Math.max(0, Math.sin(T / 120)) * 0.08;
          lion.legs.forEach((l, k) => { l.rotation.z = Math.sin(T / 130 + (k % 2) * Math.PI + (k > 1 ? 1 : 0)) * 0.5; });
          lion.g.scale.setScalar(1.05 * Math.min(1, s * 12, (1 - s) * 12));
          const b = Math.floor((T - show.t0) / 250);
          if (b !== show.beat) { show.beat = b; const k = b % 4; if (k === 0 || k === 1) S.drum(false); else if (k === 2) S.drum(true); if (b % 8 === 0) S.cymbal(); }
        }
      },
    };
  }
  function buildNoel() {
    const g = new THREE.Group();
    // tuyết
    const N = 1100, pos = new Float32Array(N * 3), drift = [];
    const SX = X.BW / 2 + 4;
    for (let i = 0; i < N; i++) { pos.set([rand(-SX, SX), rand(0, X.TOP + 8), rand(X.MID_Z - 4, 14)], i * 3); drift.push(rand(0, 6)); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const snow = new THREE.Points(sg, new THREE.PointsMaterial({ map: X.glowTex, color: '#ffffff', size: 0.28, transparent: true, depthWrite: false, opacity: 0.9 })); g.add(snow);
    // cây thông trước cổng
    const tree = new THREE.Group(); tree.position.set(2.35, 0.2, 3.3); g.add(tree);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8), M({ color: '#5a3d1a' })); trunk.position.y = 0.2; tree.add(trunk);
    const green = M({ color: '#1b7a3a', roughness: 0.8 });
    [[0.75, 0.75, 0.75], [0.58, 0.7, 1.25], [0.4, 0.6, 1.7]].forEach(([r, h, y]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 14), green); c.position.y = y; tree.add(c); });
    const lights = [];
    for (let k = 0; k < 16; k++) { const a = k * 2.4, y = 0.55 + (k / 16) * 1.3, r = 0.7 * (1 - (y - 0.4) / 1.7) + 0.05; const m = new THREE.MeshBasicMaterial({ color: pick(['#ff4d6d', '#ffd60a', '#4cc9f0', '#80ff72']) }); const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), m); b.position.set(Math.cos(a) * r, y, Math.sin(a) * r); tree.add(b); lights.push(m); }
    const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(0.16, 0.07), { depth: 0.04, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: '#ffd60a' })); star.position.y = 2.1; tree.add(star);
    roofBanner('GIÁNG SINH AN LÀNH', g, '#1b7a3a', '#ffffff');
    // mũ Noel cho chủ trọ
    const hat = new THREE.Group(); hat.position.y = 0.22; hat.rotation.z = -0.25;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.5, 14), M({ color: '#d00000' })); cone.position.y = 0.25; hat.add(cone);
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.06, 6, 18), M({ color: '#ffffff' })); brim.rotation.x = Math.PI / 2; hat.add(brim);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M({ color: '#ffffff' })); pom.position.y = 0.52; hat.add(pom);
    return {
      g,
      on() { X.landlady.headG.add(hat); },
      off() { hat.removeFromParent(); },
      update(dt) {
        for (let i = 0; i < N; i++) {
          let y = pos[i * 3 + 1] - dt * 1.1; let x = pos[i * 3] + Math.sin(T / 1000 + drift[i]) * dt * 0.4;
          if (y < 0.2) { y = X.TOP + 8; x = rand(-SX, SX); }
          pos[i * 3] = x; pos[i * 3 + 1] = y;
        }
        sg.attributes.position.needsUpdate = true;
        lights.forEach((m, k) => m.color.setHSL(((T / 2000) + k * 0.13) % 1, 1, Math.sin(T / 300 + k) > 0 ? 0.6 : 0.3));
      },
    };
  }
  function applyLe() {
    const le = leHomNay();
    if (le === deco.cur) return;
    const old = deco.sets[deco.cur];
    if (old) { scene.remove(old.g); old.off?.(); }
    deco.cur = le;
    if (!le) return;
    const set = deco.sets[le] || (deco.sets[le] = { tet: buildTet, trungthu: buildTrungThu, noel: buildNoel }[le]());
    scene.add(set.g); set.on?.();
  }
  applyLe();
  setInterval(applyLe, 10 * 60000); // qua nửa đêm sang ngày lễ thì tự bật

  // =====================================================================
  //  Hook cho game.js
  // =====================================================================
  function onChat(t, pl, text) {
    const food = FOODS.find((f) => f.re.test(pl));
    if (food) datDo(t, food);
    if (/ da cau | choi cau | dacau /.test(pl)) daCau(t);
    if (/ hat | karaoke | hat karaoke /.test(pl) && !/ hat nho /.test(pl)) karaoke(t);
    if (/ kem /.test(pl)) buyRong(t, { ten: 'cây kem', e: '🍦' });
    else if (/ che /.test(pl)) buyRong(t, { ten: 'cốc chè', e: '🍧' });
    if (kara.cur?.t === t) lyric(t, text);
    const e = evGet();
    if (e?.kind === 'gio' && / nhat | lum | luom | nhat do /.test(pl)) pickClothes(t);
    if (e?.kind === 'muathi' && / hoc | on bai | on thi | hoc bai /.test(pl)) { meter(e, 5, t); floatAt(roomTop(t.room), '📖'); }
  }
  function onLike(t, n) {
    const e = evGet();
    if (e && (e.kind === 'cupnuoc' || e.kind === 'muathi')) { meter(e, n, t); return true; }
    return false;
  }
  function onGift(t, coins) {
    const e = evGet();
    if (e && (e.kind === 'cupnuoc' || e.kind === 'muathi')) meter(e, coins * 8, null);
  }
  function eventBar(e, fill, num) {
    if (e.kind === 'cupnuoc') {
      fill.style.width = `${e.truck ? 100 : clamp(e.have / e.need, 0, 1) * 100}%`;
      num.textContent = e.truck ? '🚚 Xe bồn đang bơm nước lên bồn…' : `❤️ ${Math.floor(e.have)} / ${e.need} tim`;
      return true;
    }
    if (e.kind === 'muathi') {
      fill.style.width = `${clamp(e.have / e.need, 0, 1) * 100}%`;
      num.textContent = `✏️ ${Math.floor(e.have)} / ${e.need} tim · còn ${Math.max(0, Math.ceil((e.until - performance.now()) / 1000))} giây`;
      return true;
    }
    if (e.kind === 'gio') {
      const left = Math.max(0, (e.until - performance.now()) / 1000);
      fill.style.width = `${(left / e.dur) * 100}%`;
      num.textContent = `🌬️ còn ${Math.ceil(left)} giây · ${e.picked}/${e.total} phòng đã nhặt đồ`;
      return true;
    }
    return false;
  }
  function endEvent() {
    const e = evGet(); if (!e) return;
    if (e.kind === 'cupnuoc') { if (!e.truck) callTruck(false); }
    else if (e.kind === 'gio') endGio();
    else if (e.kind === 'muathi') endMuaThi(false);
  }
  const anyTenant = () => [...X.tenants.values()].filter(free).sort((a, b) => b.last - a.last)[0] || [...X.tenants.values()][0];
  // lệnh từ trang quản trị / thử trên console; trả về false nếu không phải lệnh của hoạt cảnh
  function control(action) {
    const need = (fn) => { if (!X.tenants.size) { X.toast('Chưa có ai thuê phòng'); return true; } fn(anyTenant()); return true; };
    switch (action) {
      case 'cupnuoc': case 'gio': case 'muathi':
        if (evGet()) { X.toast('Đang có sự kiện khác, đợi xong đã nhé'); return true; }
        if (!X.tenants.size) { X.toast('Chưa có ai thuê phòng, chưa bắt đầu sự kiện được'); return true; }
        ({ cupnuoc: startCupNuoc, gio: startGio, muathi: startMuaThi })[action]();
        return true;
      case 'thuTien': if (!startRent()) X.toast(rent.on ? 'Chủ trọ đang đi thu tiền rồi' : 'Chưa có ai thuê phòng'); return true;
      case 'hangRong': if (!callRong()) X.toast('Xe kem chè đang ở trong xóm rồi'); return true;
      case 'meo': onShare({ id: '', name: '' }); return true;
      case 'shipper': return need((t) => { ship.last.delete(t.id); datDo(t, pick(FOODS)); });
      case 'daCau': return need((t) => daCau(t));
      case 'karaoke': return need((t) => { kara.last.delete(t.id); karaoke(t); });
      case 'lau': return need((t) => startLau(t));
      case 'xeHoa': return need((t) => xeHoa(t));
      case 'chuyenTro': return need((t) => { if (!move.q.length && !move.cur) move.q.push({ t }); });
    }
    return false;
  }
  return {
    update(dt, now, eventFree) {
      T = now;
      if (eventFree) {
        if (now > next.cupnuoc) { if (!startCupNuoc()) next.cupnuoc = now + 60000; }
        else if (now > next.gio) { if (!startGio()) next.gio = now + 60000; }
        else if (now > next.muathi) { if (!startMuaThi()) next.muathi = now + 60000; }
      }
      updShip(dt); updRong(dt); updMove(dt); updMeo(dt); updRent(dt);
      updKara(); updCau(dt); updLau(dt); updHoa(dt);
      updTruck(dt); updGio(dt); updMuaThi(dt);
      const set = deco.sets[deco.cur]; if (set) set.update(dt);
      placeTags();
    },
    onChat, onLike, onGift, onFollow, onShare, eventBar, endEvent, control,
    lau: startLau, xeHoa,
    busLaneBusy: () => !!move.cur || !!truck.cur || move.q.length > 0 || !!evGet()?.truck,
    applyConfig: applyLe,
    state: () => ({ ship: !!ship.cur, rong: rong.cur?.state, move: !!move.cur, meo: meo.state, rent: rent.on, kara: kara.cur?.t.name, cau: cau.on, lau: lau.on, hoa: !!hoa.cur, truck: truck.cur?.state, le: deco.cur }),
  };
}
