// Xóm Trọ Sinh Viên — máy chủ game cho TikTok LIVE Studio (nguồn Link)
//   node server.js              kết nối live TikTok theo config.json
//   node server.js @tenkenh     kết nối live của kênh khác
//   node server.js --demo       giả lập người xem để thử game
//   Trang quản trị: http://localhost:3002/admin (chỉ mở được trên máy chạy game)
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync, writeFileSync, renameSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config.json');
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
let savedUsername = config.tiktokUsername; // tên kênh ghi trong config.json (tham số @kenh chỉ dùng cho lần chạy này)
const DEMO = process.argv.includes('--demo');
const userArg = process.argv.find((a) => a.startsWith('@'));
if (userArg) config.tiktokUsername = userArg.slice(1);
const PORT = Number(process.env.PORT) || config.port || 3002;

const app = express();
app.get('/config.json', (_req, res) => res.json({ ...config, demo: DEMO }));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
// Nhạc nền: file ghi trong config ("fileNhac") nếu có, không thì lấy file nhạc đầu tiên trong public/nhac
app.get('/api/nhac', (_req, res) => {
  const dir = path.join(__dirname, 'public', 'nhac');
  let files = [];
  try { files = readdirSync(dir).filter((f) => /\.(mp3|m4a|ogg|wav|aac)$/i.test(f)).sort(); } catch (_) {}
  const file = files.includes(config.fileNhac) ? config.fileNhac : files[0];
  res.json({ url: file ? `nhac/${encodeURIComponent(file)}` : null, file: file || null });
});
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three', 'build')));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Giọng đọc bà chủ trọ (Microsoft Edge TTS, lỗi thì Google Translate) ----------
const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function edgeTts(text, rate) {
  const tts = new MsEdgeTTS();
  try {
    // giống Đi Chùa Online: giọng nam NamMinh, trầm hơn một chút (pitch -4%)
    await tts.setMetadata(config.giongDoc || 'vi-VN-NamMinhNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeXml(text), { rate: `${Math.round((rate - 1) * 100)}%`, pitch: config.caoGiong || '-4%' });
    const chunks = [];
    const read = (async () => {
      for await (const c of audioStream) chunks.push(c);
    })();
    await Promise.race([read, new Promise((_, rej) => setTimeout(() => rej(new Error('Edge TTS timeout')), 15000))]);
    if (!chunks.length) throw new Error('Edge TTS returned no audio');
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}
async function googleTts(text) {
  const parts = [];
  for (let i = 0; i < text.length; i += 180) {
    const chunk = text.slice(i, i + 180);
    const r = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(chunk)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://translate.google.com/' },
    });
    if (!r.ok) throw new Error(`Google TTS ${r.status}`);
    parts.push(Buffer.from(await r.arrayBuffer()));
  }
  return Buffer.concat(parts);
}
const ttsCache = new Map();
app.get('/api/tts', async (req, res) => {
  const text = String(req.query.text || '').trim().slice(0, 600);
  if (!text) return res.status(400).end();
  const rate = Math.min(1.4, Math.max(0.6, Number(req.query.rate) || config.tocDoDoc || 0.95));
  const key = `${rate}|${text}`;
  try {
    let audio = ttsCache.get(key);
    if (!audio) {
      try {
        audio = await edgeTts(text, rate);
      } catch (e) {
        console.warn('[giọng đọc] Edge TTS lỗi, dùng Google:', e?.message || e);
        audio = await googleTts(text);
      }
      ttsCache.set(key, audio);
      if (ttsCache.size > 150) ttsCache.delete(ttsCache.keys().next().value);
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(audio);
  } catch (e) {
    console.warn('[giọng đọc] không đọc được:', e?.message || e);
    res.status(502).end();
  }
});

const server = createServer(app);
const wss = new WebSocketServer({ server });
const send = (msg) => {
  const s = JSON.stringify(msg);
  for (const c of wss.clients) if (c.readyState === 1) c.send(s);
};
let trangThai = 'Đang khởi động…';
const setStatus = (t) => {
  trangThai = t;
  console.log('[trạng thái]', t);
  send({ type: 'status', text: t });
};
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'status', text: trangThai }));
  ws.on('message', (m) => {
    try {
      const j = JSON.parse(String(m).slice(0, 2000));
      if (j?.type === 'hello') ws.info = { w: +j.w || 0, h: +j.h || 0, dpr: +j.dpr || 1, render: +j.render || 1, xoay: +j.xoay || 0, obs: !!j.obs, ua: String(j.ua || '').slice(0, 160) };
    } catch (_) {}
  });
});

// ---------- TikTok LIVE (tiktok-live-connector 2.5, proto v3) ----------
const userOf = (d) => ({
  id: String(d?.user?.uniqueId || d?.user?.displayId || d?.uniqueId || d?.user?.userId || ''),
  name: d?.user?.nickname || d?.nickname || d?.user?.uniqueId || 'Bạn',
});

// số liệu cho trang quản trị
const live = { connected: false, username: '', roomId: '', viewers: 0, likes: 0, comments: 0, gifts: 0, coins: 0, startedAt: Date.now() };
let session = null; // lần kết nối hiện tại; ngắt kết nối thì bỏ session cũ để nó không tự thử lại

function ketNoiTikTok(username = config.tiktokUsername) {
  ngatTikTok();
  const me = { stopped: false, timer: null, conn: new TikTokLiveConnection(username, { enableExtendedGiftInfo: false }) };
  session = me;
  Object.assign(live, { connected: false, username, roomId: '', viewers: 0, likes: 0 });
  const conn = me.conn;
  conn.on(WebcastEvent.CHAT, (d) => {
    live.comments++;
    send({ type: 'chat', ...userOf(d), text: d?.content || d?.comment || '' });
  });
  const streak = new Map();
  conn.on(WebcastEvent.GIFT, (d) => {
    const u = userOf(d);
    const key = `${u.id}_${d?.giftId || 0}`;
    const total = d?.repeatCount || 1;
    const delta = total - (streak.get(key) || 0);
    const streakable = (d?.gift?.type ?? d?.giftDetails?.giftType ?? d?.giftType) === 1;
    if (streakable && !d?.repeatEnd) streak.set(key, total);
    else streak.delete(key);
    if (delta <= 0) return;
    const each = d?.gift?.diamondCount || d?.diamondCount || d?.giftDetails?.diamondCount || 1;
    live.gifts += delta;
    live.coins += each * delta;
    send({ type: 'gift', ...u, gift: d?.gift?.name || d?.giftDetails?.giftName || d?.giftName || 'quà', count: delta, coins: each * delta });
  });
  conn.on(WebcastEvent.LIKE, (d) => {
    const total = Number(d?.totalLikeCount ?? d?.total);
    live.likes = total > 0 ? total : live.likes + (d?.likeCount || 1);
    send({ type: 'like', ...userOf(d), count: d?.likeCount || 1 });
  });
  conn.on(WebcastEvent.ROOM_USER, (d) => {
    const n = Number(d?.viewerCount ?? d?.total ?? d?.totalUser);
    if (n >= 0) live.viewers = n;
  });
  conn.on(WebcastEvent.MEMBER, (d) => send({ type: 'join', ...userOf(d) }));
  conn.on(WebcastEvent.FOLLOW, (d) => send({ type: 'follow', ...userOf(d) }));
  conn.on(WebcastEvent.SHARE, (d) => send({ type: 'share', ...userOf(d) }));
  conn.on(WebcastEvent.STREAM_END, () => {
    if (me.stopped) return;
    live.connected = false;
    setStatus('Buổi live đã kết thúc');
    thuLai();
  });
  conn.on(ControlEvent.DISCONNECTED, () => {
    if (me.stopped) return;
    live.connected = false;
    setStatus('Mất kết nối, đang thử lại…');
    thuLai();
  });
  function thuLai() {
    if (me.stopped || me.timer) return;
    me.timer = setTimeout(() => {
      me.timer = null;
      ketNoi();
    }, 20000);
  }
  function ketNoi() {
    if (me.stopped) return;
    setStatus(`Đang kết nối live @${username}…`);
    conn
      .connect()
      .then((s) => {
        if (me.stopped) return conn.disconnect().catch(() => {});
        Object.assign(live, { connected: true, roomId: String(s?.roomId || '') });
        setStatus(`Đã kết nối live @${username} (room ${s.roomId})`);
      })
      .catch((e) => {
        if (me.stopped) return;
        setStatus(`Chưa vào được live @${username} (${e?.constructor?.name || e?.message || e}). Thử lại sau 20 giây…`);
        thuLai();
      });
  }
  ketNoi();
}
function ngatTikTok() {
  if (!session) return;
  const s = session;
  session = null;
  s.stopped = true;
  clearTimeout(s.timer);
  s.conn.disconnect().catch(() => {});
  live.connected = false;
}

// ---------- Chế độ thử ----------
function cheDoThu() {
  setStatus('Chế độ thử: đang giả lập người xem');
  const ten = ['Lan Anh', 'Minh Tuấn', 'Thu Hà', 'Quốc Bảo', 'Ngọc Mai', 'Anh Khoa', 'Hồng Nhung', 'Văn Đức', 'Diệu Linh', 'Gia Huy',
    'Thanh Tâm', 'Kim Ngân', 'Đức Anh', 'Mỹ Linh', 'Hải Yến', 'Trọng Nghĩa', 'Khánh Vy', 'Tấn Phát', 'Bích Ngọc', 'Hoàng Nam'];
  const loi = ['Chào cả xóm 👋', 'Phòng ai nấu mì thơm thế', 'Ai cho mượn cái sạc với', 'Wifi chậm quá chú ơi', 'Mai thi rồi mà chưa học gì 😭',
    'Có ai đi ăn bún đậu không', 'Hát nhỏ thôi phòng bên ơi', 'Chú ơi tháng này tiền điện bao nhiêu', 'cất', 'Ngủ sớm đi mọi người',
    'Mình mới chuyển đến, chào mọi người', 'Ai chơi game không', 'Cho cô 1 bánh mì', 'xôi xéo cô ơi', 'Làm cốc trà đá đi', 'trà đá điếu cày không ae',
    'Hát karaoke đi', 'quẩy lên anh em ơi', 'dô 1 2 3 dô', 'gõ cửa 101', 'gõ 203', 'Học bài thôi', 'bắt trộm', 'bắt nó lại', 'nhảy đi'];
  const qua = [['Rose', 1], ['TikTok', 1], ['Finger Heart', 5], ['Doughnut', 30], ['Hand Hearts', 100], ['Galaxy', 1000]];
  const r = (a) => a[Math.floor(Math.random() * a.length)];
  const people = ten.map((name, i) => ({ id: `demo${i}`, name }));
  Object.assign(live, { connected: true, username: 'chế độ thử', viewers: people.length });
  setInterval(() => {
    live.comments++;
    send({ type: 'chat', ...r(people), text: r(loi) });
  }, 2600);
  setInterval(() => {
    const count = 2 + Math.floor(Math.random() * 12);
    live.likes += count;
    send({ type: 'like', ...r(people), count });
  }, 700);
  setInterval(() => {
    const [g, c] = Math.random() < 0.9 ? r(qua.slice(0, 4)) : r(qua.slice(4));
    live.gifts++;
    live.coins += c;
    send({ type: 'gift', ...r(people), gift: g, count: 1, coins: c });
  }, 11000);
  setInterval(() => send({ type: 'join', ...r(people) }), 4000);
  setInterval(() => send({ type: Math.random() < 0.5 ? 'follow' : 'share', ...r(people) }), 25000);
}

// ---------- Trang quản trị (/admin) ----------
// Chỉ nhận lệnh từ chính máy này: game nghe trên mọi địa chỉ mạng, người cùng wifi không được đổi cấu hình.
const isLocal = (req) => {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
};
const adminApi = express.Router();
adminApi.use((req, res, next) => (isLocal(req) ? next() : res.status(403).json({ ok: false, error: 'Chỉ mở được trang quản trị trên máy chạy game' })));
adminApi.use(express.json({ limit: '200kb' }));

// các mục được sửa từ trang quản trị và kiểu của chúng
const SUA_DUOC = {
  tenXom: 'text', tenChuTro: 'text', xungHo: 'text', tuyenBuyt: 'text', giongDoc: 'text', caoGiong: 'text', fileNhac: 'text',
  soTang: [2, 8], soPhongMoiTang: [2, 8], phutRoiXom: [1, 60], tocDoDoc: [0.6, 1.4], amLuongNhac: [0, 1], amLuong: [0, 1],
  timDeCoDien: [20, 5000], phutGiuaCacLanMatDien: [1, 120], phutGiuaCacLanMua: [1, 120], phutGiuaCacLanTrom: [1, 120], phutGiuaCacLanDo: [1, 120], phutNgayDem: [1, 60], giayMoiThongBao: [20, 3600],
  hienDieuCay: 'bool', docGiong: 'bool', nhacNen: 'bool', amThanh: 'bool', tiengXe: 'bool',
  thongBaoChuTro: 'list', tuCam: 'list', cauDo: 'list',
};
const CAN_TAI_LAI = ['tenXom', 'soTang', 'soPhongMoiTang', 'tuyenBuyt', 'hienDieuCay']; // dựng lúc mở trang, đổi xong phải tải lại màn hình live
function luuConfig() {
  const tmp = `${CONFIG_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify({ ...config, tiktokUsername: savedUsername }, null, 2) + '\n', 'utf8');
  renameSync(tmp, CONFIG_PATH);
}

adminApi.get('/state', (_req, res) => {
  res.json({ ok: true, demo: DEMO, status: trangThai, live, screens: wss.clients.size, screenInfo: [...wss.clients].map((c) => c.info).filter(Boolean), config: { ...config, tiktokUsername: savedUsername }, liveUser: config.tiktokUsername, canTaiLai: CAN_TAI_LAI });
});

adminApi.post('/config', (req, res) => {
  const body = req.body || {};
  const changed = {};
  for (const [k, kind] of Object.entries(SUA_DUOC)) {
    if (!(k in body)) continue;
    let v = body[k];
    if (kind === 'text') v = String(v ?? '').trim().slice(0, k === 'fileNhac' ? 200 : 80);
    else if (kind === 'bool') v = !!v;
    else if (kind === 'list') v = (Array.isArray(v) ? v : String(v).split('\n')).map((s) => String(s).trim().slice(0, 300)).filter(Boolean).slice(0, 200);
    else {
      v = Number(v);
      if (!Number.isFinite(v)) return res.status(400).json({ ok: false, error: `Giá trị "${k}" không hợp lệ` });
      v = Math.min(kind[1], Math.max(kind[0], v));
    }
    if (kind === 'text' && !v && ['tenXom', 'tenChuTro', 'xungHo', 'giongDoc'].includes(k)) continue; // không để trống
    if (JSON.stringify(config[k]) !== JSON.stringify(v)) changed[k] = config[k] = v;
  }
  if (!Object.keys(changed).length) return res.json({ ok: true, changed: [] });
  if ('giongDoc' in changed || 'caoGiong' in changed) ttsCache.clear();
  try {
    luuConfig();
  } catch (e) {
    return res.status(500).json({ ok: false, error: `Không ghi được config.json: ${e?.message || e}` });
  }
  send({ type: 'config', config: { ...config, demo: DEMO } });
  const reload = Object.keys(changed).filter((k) => CAN_TAI_LAI.includes(k));
  res.json({ ok: true, changed: Object.keys(changed), reload });
});

// lệnh gửi thẳng tới màn hình live (nguồn Link trong TikTok LIVE Studio)
adminApi.post('/control', (req, res) => {
  const { action, text } = req.body || {};
  const ok = ['speak', 'matdien', 'mua', 'trom', 'do', 'ketThucSuKien', 'thongBao', 'phaoHoa', 'ngayDem', 'reload'];
  if (!ok.includes(action)) return res.status(400).json({ ok: false, error: 'Lệnh không hợp lệ' });
  const t = String(text || '').trim().slice(0, 300);
  if (action === 'speak' && !t) return res.status(400).json({ ok: false, error: 'Chưa nhập câu cần đọc' });
  if (!wss.clients.size) return res.json({ ok: false, error: 'Chưa có màn hình live nào mở (TikTok LIVE Studio hoặc tab trình duyệt)' });
  send({ type: 'control', action, text: t });
  res.json({ ok: true, screens: wss.clients.size });
});

// đổi kênh / kết nối lại / ngắt
adminApi.post('/tiktok', (req, res) => {
  if (DEMO) return res.json({ ok: false, error: 'Đang chạy chế độ thử (CHAY-THU.bat). Chạy BAT-LIVE.bat để kết nối live thật.' });
  const { action, username, luu } = req.body || {};
  if (action === 'disconnect') {
    ngatTikTok();
    setStatus('Đã ngắt kết nối live (bấm Kết nối trong trang quản trị để nối lại)');
    return res.json({ ok: true });
  }
  const u = String(username || config.tiktokUsername || '').replace(/^@/, '').trim();
  if (!/^[\w.]{2,40}$/.test(u)) return res.status(400).json({ ok: false, error: 'Tên kênh TikTok không hợp lệ' });
  config.tiktokUsername = u;
  if (luu && u !== savedUsername) {
    savedUsername = u;
    try {
      luuConfig();
    } catch (e) {
      return res.status(500).json({ ok: false, error: `Không ghi được config.json: ${e?.message || e}` });
    }
  }
  ketNoiTikTok(u);
  res.json({ ok: true });
});
app.use('/api/admin', adminApi);

server.listen(PORT, () => {
  console.log(`\n  Game Xóm Trọ Sinh Viên đang chạy tại:  http://localhost:${PORT}`);
  console.log(`  Trang quản trị:                        http://localhost:${PORT}/admin`);
  console.log(`  Link cho TikTok LIVE Studio:            http://lvh.me:${PORT}/`);
  console.log('  Kích thước 1080 x 1920. Giữ cửa sổ này mở suốt buổi live.\n');
  if (DEMO) cheDoThu();
  else ketNoiTikTok();
});
