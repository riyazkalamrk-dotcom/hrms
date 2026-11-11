'use strict';
/* Orbit HR realtime + verification server. No dependencies: `node server.js`
   - serves the static app
   - /api/time     authoritative server clock
   - /api/verify   server-side attendance check (geofence, velocity, drift, jitter...) -> signed verdict
   - /api/check    verify a stored verdict signature (tamper evidence)
   - /api/chat     team chat (+ SSE push on /api/stream)
   - /api/track    live location sharing (+ SSE push)
   Demo-level trust: the caller's employee id is not authenticated. Add real auth before production. */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = +process.env.PORT || 5173, ROOT = __dirname, DATA = path.join(ROOT, 'data');
fs.mkdirSync(DATA, { recursive: true });
const secretFile = path.join(DATA, 'secret.txt'); let SECRET;
try { SECRET = fs.readFileSync(secretFile, 'utf8'); } catch { SECRET = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(secretFile, SECRET); }
const stateFile = path.join(DATA, 'state.json'); let ST = { chat: [], track: {}, last: {}, demo: false };
try { ST = Object.assign(ST, JSON.parse(fs.readFileSync(stateFile, 'utf8'))); } catch { }
let dirty = false; const persist = () => { dirty = true; };
setInterval(() => { if (dirty) { dirty = false; fs.writeFile(stateFile, JSON.stringify(ST), () => { }); } }, 3000).unref();
let webpush = null; try { webpush = require('web-push'); } catch { console.log('web-push not installed: background push disabled'); }
let VAPID = null;
if (webpush) { const vf = path.join(DATA, 'vapid.json'); try { VAPID = JSON.parse(fs.readFileSync(vf, 'utf8')); } catch { VAPID = webpush.generateVAPIDKeys(); fs.writeFileSync(vf, JSON.stringify(VAPID)); } }
const applyVapid = () => { if (webpush && VAPID) { try { webpush.setVapidDetails(CFGM.pushSubject(), VAPID.publicKey, VAPID.privateKey); } catch (e) { console.log('Bad push contact, using default:', e.message); webpush.setVapidDetails('mailto:hr@orbit.demo', VAPID.publicKey, VAPID.privateKey); } } };
ST.subs ||= {}; ST.pres ||= {}; ST.sent ||= {}; ST.plog ||= [];
/* admin-editable branding, company profile and integrations (see server_cfg.js) */
const CFGM = require('./server_cfg.js')({ DATA, json: (res, code, obj) => json(res, code, obj), getPush: () => ({ enabled: !!webpush }), onPush: () => applyVapid(),
  regenVapid: () => { if (!webpush) throw new Error('web-push is not installed'); VAPID = webpush.generateVAPIDKeys(); fs.writeFileSync(path.join(DATA, 'vapid.json'), JSON.stringify(VAPID)); ST.subs = {}; persist(); applyVapid(); return VAPID.publicKey; },
  subsInfo: () => ({ people: Object.keys(ST.subs).length, devices: Object.values(ST.subs).reduce((n, r) => n + r.list.length, 0) }) });
const BCTX = { json: (res, code, obj) => json(res, code, obj), ST, persist, verify: (b, ip) => verify(b, ip), getPush: () => ({ enabled: !!webpush }) };
const BOT = require('./server_bot.js')(CFGM.api, BCTX); CFGM.api.setAi(BCTX.aiAsk);
applyVapid(); console.log('Admin key for remote access: data/admin.key (requests from this machine are trusted unless ADMIN_STRICT=1)');
const clients = new Set();
const push = (ev, data) => { const s = `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`; for (const c of clients) c.write(s); };
setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 20000).unref();

const rad = d => d * Math.PI / 180;
const dist = (a, b) => { const R = 6371000, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng), x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const sign = p => crypto.createHmac('sha256', SECRET).update(JSON.stringify([p.emp, p.serverTs, p.lat, p.lng, p.risk, p.ok])).digest('hex');
const decimals = n => { const s = String(n); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };
const ipCache = new Map();
const isPrivate = ip => !ip || /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd|fe80)/i.test(ip.replace('::ffff:', ''));
async function ipLocate(ip) {
  ip = (ip || '').replace('::ffff:', ''); if (isPrivate(ip)) return null; const c = ipCache.get(ip); if (c && Date.now() - c.t < 6e5) return c.v;
  try { const v = await CFGM.ipLookup(ip); ipCache.set(ip, { t: Date.now(), v }); return v; } catch { return null; }
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

/* Attendance verification. "hard" flags block the punch; others raise the risk score. */
async function verify(b, ip) {
  const rcv = Date.now(), flags = [], hard = []; let risk = 0, serverTs = rcv, off = false;
  const add = (f, pts, isHard) => { flags.push(f); risk += pts; if (isHard) hard.push(f); };
  if (b.offlineAt) { const t = +b.offlineAt; if (t > rcv - 72 * 3600e3 && t <= rcv + 120000) { serverTs = t; off = true; add('offline_punch', 10, false); } else add('offline_time_out_of_range', 50, true); }
  const fixes = Array.isArray(b.fixes) ? b.fixes.filter(f => Number.isFinite(f.lat) && Number.isFinite(f.lng)).slice(0, 10) : [];
  const out = { serverTs };
  if (b.webdriver) add('automation_detected', 50, true);
  if (!off && Math.abs(serverTs - +b.clientTs) > 120000) add('device_clock_drift', 40, false);
  if (fixes.length) {
    const f = fixes[fixes.length - 1]; out.lat = f.lat; out.lng = f.lng; out.acc = f.acc;
    if (fixes.some(x => x.mock)) add('mock_location_app', 60, true);
    if (serverTs - f.ts > 30000 || f.ts - serverTs > 30000) add('stale_or_future_gps_timestamp', 30, false);
    const acc = median(fixes.map(x => +x.acc || 0));
    if (!acc) add('zero_accuracy', 30, false); else if (acc > 100) add('low_gps_accuracy', 15, false);
    if (fixes.length >= 3 && fixes.every(x => x.lat === fixes[0].lat && x.lng === fixes[0].lng)) add('no_gps_jitter', 30, false);
    if (decimals(f.lat) <= 4 && decimals(f.lng) <= 4) add('rounded_coordinates', 20, false);
    const spread = Math.max(...fixes.map(x => dist(x, fixes[0])));
    if (spread > 500) add('unstable_fix', 40, true);
    const prev = ST.last[b.emp];
    if (prev) { const dt = (serverTs - prev.ts) / 1000, d = dist(prev, f); if (dt > 0 && d > 2000 && d / dt > 70) add('impossible_travel', 60, true); out.prev = { km: +(d / 1000).toFixed(1), mins: +(dt / 60).toFixed(1) }; }
    const sites = (Array.isArray(b.sites) ? b.sites : b.branch ? [b.branch] : []).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng));
    if (sites.length) {
      const near = sites.map(x => ({ x, d: dist(f, x) })).sort((p, q) => p.d - q.d)[0], r = +near.x.radius || 200; out.dist = Math.round(near.d); out.site = near.x.name || null; out.siteId = near.x.id || null;
      if (near.d > r + Math.min(acc, 100)) add(b.needGeo ? 'outside_geofence' : 'away_from_office', b.needGeo ? 0 : 5, !!b.needGeo);
    }
    const g = off ? null : await ipLocate(ip); if (g) { out.ipCity = g.city; const dd = dist(g, f); if (dd > CFGM.ipKm() * 1000) add('ip_location_mismatch', 35, false); }
  } else if (b.needGeo) add('no_location', 0, true);
  if (b.faceRequired) { if (!b.face || !b.face.matched) add('face_mismatch', 0, true); else if (!b.face.live) add('no_liveness', 0, true); }
  risk = Math.min(100, risk); const ok = hard.length === 0 && risk < (+b.maxRisk || 70);
  Object.assign(out, { flags, hard, risk, ok }); out.sig = sign({ emp: b.emp, serverTs, lat: out.lat, lng: out.lng, risk, ok });
  out.offline = off; out.receivedAt = rcv;
  if (fixes.length && ok && (!ST.last[b.emp] || serverTs >= ST.last[b.emp].ts)) { ST.last[b.emp] = { lat: out.lat, lng: out.lng, ts: serverTs }; persist(); }
  return out;
}

/* Demo field team (clearly flagged sim:true) */
const DEMO = [['E013', 'Rahul Desai', 12.9716, 77.5946], ['E014', 'Pooja Menon', 12.9352, 77.6245], ['E015', 'Aditya Kulkarni', 13.0358, 77.597]];
function tickDemo() {
  if (!ST.demo) return;
  DEMO.forEach(([id, name, la, ln], i) => {
    const t = ST.track[id] ||= { name, sim: true, trail: [] }; const p = t.trail.at(-1) || { lat: la, lng: ln };
    const np = { lat: p.lat + (Math.random() - .45) * .0018, lng: p.lng + (Math.random() - .45) * .0018, acc: 12, ts: Date.now() };
    t.last = np; t.trail.push(np); if (t.trail.length > 150) t.trail.shift(); push('track', { emp: id, ...t });
  }); persist();
}
setInterval(tickDemo, 4000).unref();

/* ---------- reminders + web push ---------- */
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hmm = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; };
async function sendPush(emps, payload, reason) {
  let delivered = 0; const body = JSON.stringify(payload);
  if (webpush) for (const id of emps) { const rec = ST.subs[id]; if (!rec) continue; for (const sub of [...rec.list]) { try { await webpush.sendNotification(sub, body, { TTL: CFGM.pushTtl(), urgency: 'high' }); delivered++; } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) rec.list = rec.list.filter(x => x.endpoint !== sub.endpoint); } } }
  try { delivered += await BOT.sendNative(emps, payload); } catch { }
  ST.plog.unshift({ ts: Date.now(), to: emps.join(','), title: payload.title, reason, delivered }); ST.plog.length = Math.min(ST.plog.length, 120); persist(); return delivered;
}
const hrIds = () => [...new Set([...Object.entries(ST.subs), ...Object.entries(ST.devices || {})].filter(([, r]) => ['hr', 'admin'].includes(r.role)).map(([id]) => id))];
async function toEmp(p, title, text, tag) { push('alert', { to: p.emp, title, body: text, tag }); if (webpush || BOT.nativeOn()) await sendPush([p.emp], { title, body: text, tag, url: '/#/alerts' }, 'employee'); else { ST.plog.unshift({ ts: Date.now(), to: p.emp, title, reason: 'employee (push disabled)', delivered: 0 }); } }
async function toHR(p, title, text, tag) { push('alert', { toRoles: ['hr', 'admin'], toEmp: p.mgr, title, body: text, tag }); if (webpush || BOT.nativeOn()) await sendPush([...new Set([...hrIds(), ...(p.mgr ? [p.mgr] : [])])].filter(x => x !== p.emp), { title, body: text, tag, url: '/#/alerts' }, 'hr'); else { ST.plog.unshift({ ts: Date.now(), to: 'HR', title, reason: 'hr (push disabled)', delivered: 0 }); } }
function once(p, key, fn) { const k = p.emp + ':' + p.date + ':' + key; if (ST.sent[k]) return; ST.sent[k] = 1; persist(); fn(); }
function schedulerTick(now = new Date()) {
  const date = ymd(now), nm = now.getHours() * 60 + now.getMinutes(); for (const k of Object.keys(ST.sent)) if (!k.includes(date)) delete ST.sent[k];
  for (const p of Object.values(ST.pres)) {
    if (p.date !== date || p.off || p.status === 'Exited') continue; const s = hmm(p.start), e = hmm(p.end), before = +p.before || 15;
    if (!p.inTime) {
      if (nm >= s - before && nm < s) once(p, 'pre', () => toEmp(p, '⏰ Duty starts at ' + p.start, 'Starts in ' + (s - nm) + ' min — check in when you arrive.', 'pre-' + p.emp));
      if (nm >= s && nm < s + 15) once(p, 'start', () => toEmp(p, '🟢 Your duty has started', 'Please check in now.', 'start-' + p.emp));
      if (nm >= s + 15) { const n = Math.floor((nm - s - 15) / 10); once(p, 'late' + n, () => { toEmp(p, '⚠ You have not checked in', 'Duty began at ' + p.start + ' — you are ' + (nm - s) + ' min late.', 'late-' + p.emp); if (n === 0) toHR(p, '⚠ ' + p.name + ' has not checked in', 'Shift started ' + p.start + ' (' + (nm - s) + ' min ago).', 'hrlate-' + p.emp); }); }
    } else if (!p.outTime) {
      if (nm >= e) { const n = Math.floor((nm - e) / 15); if (n < 6) once(p, 'out' + n, () => toEmp(p, '🔔 Remember to check out', 'Duty ended at ' + p.end + (nm > e ? ' (' + (nm - e) + ' min ago)' : '') + '.', 'out-' + p.emp)); }
      if (nm >= e + 120) once(p, 'missed', () => toHR(p, '🕒 ' + p.name + ' missed check-out', 'Shift ended ' + p.end + ' and no check-out is recorded.', 'hrmiss-' + p.emp));
    }
  }
}
setInterval(schedulerTick, 30000).unref();

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise(r => { let s = ''; req.on('data', c => { s += c; if (s.length > 2e5) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(s || '{}')); } catch { r({}); } }); });
const str = (v, n) => String(v ?? '').slice(0, n);

/* origins the Android / iOS apps run from (+ any in CORS_ORIGINS, comma separated) */
const APP_ORIGINS = new Set(['capacitor://localhost', 'ionic://localhost', 'https://localhost', 'http://localhost', ...(process.env.CORS_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean)]);
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname;
  { const o = req.headers.origin; if (o && APP_ORIGINS.has(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS'); if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); } } }
  try {
    if (p.startsWith('/api/') && await CFGM.handle(req, res, u, p)) return;
    if ((p.startsWith('/api/') || p === '/manifest.webmanifest' || p.startsWith('/pwa/')) && await BOT.handle(req, res, u, p)) return;
    /* app download page + the Android APK (only this one file from mobile/dist is public) */
    if (p === '/downloads/OrbitHRMS.apk') { const f = path.join(ROOT, 'mobile', 'dist', 'OrbitHRMS-debug.apk'); if (!fs.existsSync(f)) { res.writeHead(404); return res.end('APK not built yet'); } res.writeHead(200, { 'Content-Type': 'application/vnd.android.package-archive', 'Content-Disposition': 'attachment; filename="OrbitHRMS.apk"', 'Content-Length': fs.statSync(f).size, 'Cache-Control': 'no-cache' }); return fs.createReadStream(f).pipe(res); }
    if (p === '/app') { const b = CFGM.api.brand(), has = fs.existsSync(path.join(ROOT, 'mobile', 'dist', 'OrbitHRMS-debug.apk')), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); return res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Get the ${esc(b.name)} app</title><meta name="theme-color" content="${b.primary}"><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:linear-gradient(160deg,${b.sidebar},${b.primary});color:#0f1b2d}.c{width:min(440px,100%);background:#fff;border-radius:26px;padding:28px 24px;text-align:center;box-shadow:0 30px 80px -30px #000a}img.i{width:84px;height:84px;border-radius:20px;box-shadow:0 10px 26px -10px #0006}h1{margin:14px 0 4px;font-size:22px}p{color:#667085;margin:4px 0 16px;font-size:14px}a.b{display:block;padding:15px;border-radius:14px;background:${b.primary};color:#fff;font-weight:700;text-decoration:none;margin:10px 0}a.g{background:#f1f3f7;color:#0f1b2d}small{display:block;color:#667085;line-height:1.5;margin-top:12px;text-align:left}ol{text-align:left;color:#475467;font-size:13px;padding-left:20px;line-height:1.7}#qr{display:flex;justify-content:center;margin:14px 0}</style></head><body><div class="c"><img class="i" src="/pwa/icon-192.png" alt=""><h1>${esc(b.name)} ${esc(b.product)}</h1><p>Attendance, leave, payslips and alerts on your phone</p>${has ? '<a class="b" href="/downloads/OrbitHRMS.apk">⬇ Download for Android (APK)</a>' : '<p>The Android app has not been built yet.</p>'}<a class="b g" href="/">📱 Open in browser / iPhone</a><div id="qr"></div><ol><li>Tap <b>Download</b>, then open the file.</li><li>If Android asks, allow <b>“Install from this source”</b>.</li><li>Open the app and sign in.</li></ol><small><b>iPhone:</b> open this site in Safari → Share → <b>Add to Home Screen</b>. It then works like an app.<br><b>Note:</b> this is a test build — Android may show a “not from Play Store” warning.</small></div><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script><script>try{new QRCode(document.getElementById('qr'),{text:location.href,width:150,height:150})}catch(e){}</script></body></html>`); }
    if (p === '/api/push/key') return json(res, 200, { enabled: !!webpush, key: VAPID?.publicKey || null });
    if (p === '/api/push/subscribe' && req.method === 'POST') { const b = await body(req); if (!b.emp || !b.sub?.endpoint) return json(res, 400, { error: 'bad subscription' }); const rec = ST.subs[b.emp] ||= { role: 'employee', list: [] }; rec.role = str(b.role, 12); rec.list = rec.list.filter(x => x.endpoint !== b.sub.endpoint); rec.list.push(b.sub); persist(); return json(res, 200, { ok: true, devices: rec.list.length }); }
    if (p === '/api/push/unsubscribe' && req.method === 'POST') { const b = await body(req); const rec = ST.subs[b.emp]; if (rec) rec.list = b.endpoint ? rec.list.filter(x => x.endpoint !== b.endpoint) : []; persist(); return json(res, 200, { ok: true }); }
    if (p === '/api/push/send' && req.method === 'POST') { const b = await body(req); const to = b.to === 'HR' ? hrIds() : [str(b.to, 20)]; const payload = { title: str(b.title, 90), body: str(b.body, 240), tag: str(b.tag, 60) || 'msg', url: '/#/alerts' }; push('alert', { to: b.to === 'HR' ? undefined : b.to, toRoles: b.to === 'HR' ? ['hr', 'admin'] : undefined, ...payload }); const n = webpush ? await sendPush(to, payload, 'manual') : 0; return json(res, 200, { ok: true, delivered: n }); }
    if (p === '/api/presence' && req.method === 'POST') { const b = await body(req); const list = Array.isArray(b.list) ? b.list : [b]; for (const x of list.slice(0, 500)) { if (!x.emp || !x.date) continue; ST.pres[x.emp] = { emp: str(x.emp, 20), name: str(x.name, 80), role: str(x.role, 12), mgr: str(x.mgr, 20), date: str(x.date, 10), start: str(x.start, 5), end: str(x.end, 5), inTime: x.inTime ? str(x.inTime, 5) : '', outTime: x.outTime ? str(x.outTime, 5) : '', off: !!x.off, before: +x.before || 15, status: str(x.status, 20) }; } persist(); schedulerTick(); return json(res, 200, { ok: true, n: list.length }); }
    if (p === '/api/alerts/debug') return json(res, 200, { push: !!webpush, subs: Object.fromEntries(Object.entries(ST.subs).map(([k, v]) => [k, { role: v.role, devices: v.list.length }])), presences: Object.keys(ST.pres).length, log: ST.plog.slice(0, 40) });
    if (p === '/api/alerts/tick' && req.method === 'POST') { const b = await body(req); const d = new Date(); if (b.hm) { const [h, m] = b.hm.split(':').map(Number); d.setHours(h, m, 0, 0); } schedulerTick(d); return json(res, 200, { ok: true, log: ST.plog.slice(0, 10) }); }
    if (p === '/api/time') return json(res, 200, { now: Date.now() });
    if (p === '/api/stream') { res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); res.write('retry: 3000\n\n'); clients.add(res); req.on('close', () => clients.delete(res)); return; }
    if (p === '/api/verify' && req.method === 'POST') { const b = await body(req); return json(res, 200, await verify(b, req.socket.remoteAddress)); }
    if (p === '/api/check' && req.method === 'POST') { const b = await body(req); const good = sign(b), a = Buffer.from(good), c = Buffer.from(String(b.sig || '')); return json(res, 200, { valid: a.length === c.length && crypto.timingSafeEqual(a, c) }); }
    if (p === '/api/chat' && req.method === 'GET') { const since = +u.searchParams.get('since') || 0, ch = u.searchParams.get('ch'); return json(res, 200, ST.chat.filter(m => m.ts > since && (!ch || m.ch === ch)).slice(-500)); }
    if (p === '/api/chat' && req.method === 'POST') { const b = await body(req), text = str(b.text, 2000).trim(); if (!text || !b.ch || !b.from) return json(res, 400, { error: 'bad message' }); const m = { id: crypto.randomUUID(), ch: str(b.ch, 60), from: str(b.from, 20), fromName: str(b.fromName, 80), text, ts: Date.now() }; ST.chat.push(m); if (ST.chat.length > 3000) ST.chat.shift(); persist(); push('chat', m); return json(res, 200, m); }
    if (p === '/api/track' && req.method === 'GET') return json(res, 200, ST.track);
    if (p === '/api/track' && req.method === 'POST') { const b = await body(req); if (!b.emp || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return json(res, 400, { error: 'bad fix' }); const t = ST.track[b.emp] ||= { name: str(b.name, 80), trail: [] }; const pt = { lat: b.lat, lng: b.lng, acc: +b.acc || 0, ts: Date.now() }; t.name = str(b.name, 80) || t.name; t.sim = false; t.last = pt; t.trail.push(pt); if (t.trail.length > 300) t.trail.shift(); persist(); push('track', { emp: b.emp, ...t }); return json(res, 200, { ok: true, ts: pt.ts }); }
    if (p === '/api/track' && req.method === 'DELETE') { const id = u.searchParams.get('emp'); if (id === 'ALL-SIM') { for (const k of Object.keys(ST.track)) if (ST.track[k].sim) delete ST.track[k]; ST.demo = false; } else delete ST.track[id]; persist(); push('track-clear', { emp: id }); return json(res, 200, { ok: true }); }
    if (p === '/api/track/demo' && req.method === 'POST') { const b = await body(req); ST.demo = !!b.on; persist(); if (ST.demo) tickDemo(); return json(res, 200, { demo: ST.demo }); }
    if (p.startsWith('/api/')) return json(res, 404, { error: 'not found' });
    // static
    let f = path.normalize(path.join(ROOT, p === '/' ? 'index.html' : decodeURIComponent(p)));
    if (!f.startsWith(ROOT) || f.startsWith(DATA) || f.startsWith(path.join(ROOT, 'mobile')) || f.startsWith(path.join(ROOT, 'node_modules')) || ['server.js', 'server_cfg.js', 'server_bot.js'].includes(path.basename(f))) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(d); });
  } catch (e) { json(res, 500, { error: String(e.message) }); }
}).listen(PORT, () => console.log('Orbit HR server on http://localhost:' + PORT));
