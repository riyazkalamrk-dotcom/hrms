'use strict';
/* ============ Orbit HR — secure attendance, encrypted vault, team chat, live tracking ============ */
Object.assign(ICONS, {
  msg: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', map: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4', camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8', copy: 'M9 9h11v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'
});
{ const i = PAGES.findIndex(p => p[0] === 'meetings'); PAGES.splice(i, 0, ['teamchat', 'Team chat', 'msg'], ['tracking', 'Live tracking', 'map'], ['vault', 'Credentials', 'lock']); }

const API = {
  ok: null,
  async get(u) { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return r.json(); },
  async post(u, b) { const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return r.json(); },
  async del(u) { const r = await fetch(u, { method: 'DELETE' }); return r.json(); }
};
const _scripts = {};
const loadScript = src => _scripts[src] ??= new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete _scripts[src]; rej(new Error('Could not load ' + src)); }; document.head.appendChild(s); });
const loadCss = href => { if (![...document.styleSheets].some(s => s.href === href)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); } };
const needServer = () => `<div class="card empty">The Orbit realtime server is not running, so this feature is unavailable.<br>Start it with <code>node server.js</code>.</div>`;
const hmFromTs = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const haversine = (a, b) => { const R = 6371000, r = x => x * Math.PI / 180, dl = r(b.lat - a.lat), dg = r(b.lng - a.lng), x = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

/* ---------- boot wrapper: migrations + realtime ---------- */
const BR_DEFAULT = { B1: [12.9716, 77.5946], B2: [12.9698, 77.7500], B3: [12.8996, 77.7019] };
function migrate2() {
  rows('branches').forEach(b => { if (b.lat === undefined) { const d = BR_DEFAULT[b.id] || [0, 0]; b.lat = d[0]; b.lng = d[1]; } });
  DB.faces ??= {}; rows('punchlog'); save();
}
const _boot = boot;
boot = function () { load(); migrate2(); _boot(); if (SESSION) { probe().then(startRealtime); } };
async function probe() { try { await API.get('/api/time'); API.ok = true; } catch { API.ok = false; } }
const _logout = logout;
logout = function () { ES?.close(); ES = null; stopSharing(); TC.loaded = false; TC.msgs = []; lockVault(true); _logout(); };

/* ================= SECURE ATTENDANCE: face + location + anti-spoofing ================= */
Object.assign(ENT.branches, { acts: [{ l: 'Use my location', if: () => isHR(), f: 'geo' }] });
ENT.branches.cols.splice(2, 0, ['lat', 'Latitude'], ['lng', 'Longitude']);
ENT.branches.fields.push(['lat', 'Latitude', 'number'], ['lng', 'Longitude', 'number'], ['radius', 'Geo-fence radius (m)', 'number']);
ENT.branches.hint = 'Coordinates define the geo-fence used by secure check-in (radius is set under Attendance rules).';
const _entAct = ACT.ent_act;
ACT.ent_act = async el => {
  const k = el.dataset.key, a = ENT[k].acts[+el.dataset.i];
  if (a.f === 'geo') { try { const [f] = await getFixes(1, 10000); const r = rows(k).find(x => x.id === el.dataset.id); r.lat = +f.lat.toFixed(6); r.lng = +f.lng.toFixed(6); save(); render(); toast(`Branch set to your location (±${Math.round(f.acc)}m)`); } catch (e) { toast('Location unavailable: ' + (e.message || 'permission denied'), 'err'); } return; }
  return _entAct(el);
};
function getFixes(n = 3, timeout = 12000) {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Geolocation is not supported on this device'));
    const out = []; let done = false; const fin = (ok, v) => { if (done) return; done = true; navigator.geolocation.clearWatch(id); clearTimeout(t1); clearTimeout(t2); ok ? res(v) : rej(v); };
    const id = navigator.geolocation.watchPosition(p => { out.push({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, alt: p.coords.altitude, spd: p.coords.speed, ts: p.timestamp }); if (out.length >= n) fin(true, out); }, e => fin(false, new Error(e.code === 1 ? 'Location permission was denied' : e.code === 3 ? 'Location request timed out' : 'Location is unavailable')), { enableHighAccuracy: true, maximumAge: 0, timeout });
    const t1 = setTimeout(() => out.length && fin(true, out), Math.min(7000, timeout)); const t2 = setTimeout(() => fin(false, new Error('Location request timed out')), timeout + 2000);
  });
}
const FACE_JS = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js', FACE_MODELS = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';
let faceReady = null;
function loadFace() { return faceReady ??= (async () => { await loadScript(CFGv().face.js); const n = faceapi.nets, M = CFGv().face.models; await Promise.all([n.tinyFaceDetector.loadFromUri(M), n.faceLandmark68Net.loadFromUri(M), n.faceRecognitionNet.loadFromUri(M)]); })().catch(e => { faceReady = null; throw e; }); }
const ear = eye => { const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y); return (d(eye[1], eye[5]) + d(eye[2], eye[4])) / (2 * d(eye[0], eye[3])); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function openCam(video) { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 360 }, audio: false }); video.srcObject = s; await video.play(); return s; }
const camBox = `<div style="position:relative;border-radius:14px;overflow:hidden;background:#000;aspect-ratio:4/3;max-width:420px;margin:0 auto"><video id="cam" playsinline muted style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video><div id="camfx" style="position:absolute;inset:14%;border:3px dashed #2dd4bf;border-radius:50%;opacity:.8;pointer-events:none"></div></div><div id="camst" class="tc" style="margin-top:10px;font-weight:600">Starting camera…</div>`;
const detOpts = () => new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: .5 });
/* Enrol: capture 3 face descriptors (numbers only — no photo is stored) */
async function captureEnrol(video, say, alive) {
  const descs = []; const t0 = Date.now();
  while (descs.length < 3 && Date.now() - t0 < 30000 && alive()) {
    const all = await faceapi.detectAllFaces(video, detOpts()).withFaceLandmarks().withFaceDescriptors();
    if (all.length > 1) say('Only one person in frame, please'); else if (all.length === 1 && all[0].detection.score > .7) { descs.push(Array.from(all[0].descriptor)); say(`Captured ${descs.length}/3 — slightly turn your head`); await sleep(900); } else say('Look at the camera in good light');
    await sleep(120);
  }
  return descs;
}
/* Verify: must blink (liveness) AND match the enrolled face */
async function verifyFace(video, enrolled, say, alive) {
  const t0 = Date.now(); let open = false, blinked = false, best = 9, samples = 0;
  while (Date.now() - t0 < 25000 && alive()) {
    const d = await faceapi.detectSingleFace(video, detOpts()).withFaceLandmarks();
    if (!d) { say('Look at the camera'); await sleep(100); continue; }
    const e = (ear(d.landmarks.getLeftEye()) + ear(d.landmarks.getRightEye())) / 2;
    if (!blinked) { say(open ? '👁 Now blink once' : 'Keep your eyes open, then blink'); if (e > .26) open = true; if (open && e < .21) blinked = true; }
    else {
      say('Checking your face…'); const r = await faceapi.detectSingleFace(video, detOpts()).withFaceLandmarks().withFaceDescriptor();
      if (r) { samples++; best = Math.min(best, ...enrolled.map(x => faceapi.euclideanDistance(r.descriptor, x))); }
      if (samples >= 3) break;
    }
    await sleep(60);
  }
  return { live: blinked, matched: blinked && best < (CFGv().face.threshold || .5), dist: +best.toFixed(3) };
}
ACT.face_enroll = () => {
  const m = modal('Enrol your face', `<p class="muted" style="margin-top:0">Face check-in compares a live camera frame to a numeric template of your face (128 numbers). <b>No photo is saved.</b> The template stays in this browser. You can delete it at any time.</p><label class="row" style="cursor:pointer;margin-bottom:12px"><input type="checkbox" id="fcons"> <span>I consent to face-template processing for attendance.</span></label><div id="fbox"></div><button type="button" class="btn primary" id="fgo" style="margin-top:12px" data-act="face_go">Start camera</button>`, null);
};
ACT.face_go = async el => {
  const m = el.closest('.modal-bg'); if (!$('#fcons', m).checked) return toast('Please tick the consent box first', 'err');
  el.disabled = true; $('#fbox', m).innerHTML = camBox; const say = t => { const s = $('#camst', m); if (s) s.textContent = t; }; let stream;
  try {
    say('Loading face models (first time takes a few seconds)…'); await loadFace(); const v = $('#cam', m); stream = await openCam(v);
    const descs = await captureEnrol(v, say, () => document.body.contains(v));
    if (descs.length === 3) { DB.faces[me().id] = { d: descs, ts: Date.now() }; log('Enrolled face template'); save(); say('✅ Face enrolled'); toast('Face enrolled'); setTimeout(() => { m.remove(); render(); }, 900); }
    else say('Could not capture enough frames. Try again with better light.');
  } catch (e) { say('⚠ ' + (e.name === 'NotAllowedError' ? 'Camera permission was denied' : e.message)); }
  finally { stream?.getTracks().forEach(t => t.stop()); el.disabled = false; el.textContent = 'Try again'; }
};
ACT.face_del = () => confirmBox('Delete your face template? You will need to enrol again to use face check-in.', () => { delete DB.faces[me().id]; log('Deleted face template'); save(); render(); });

async function secureCheckin(opts) {
  const R = DB.settings.rules ??= {}, u = me(), T = TODAY();
  if (dayStatus(u.id, T).s !== 'notin') return toast('You are already marked for today', 'err');
  const W = punchWhere(), pol = opts || punchPlan(u, W), wfh = W.mode === 'WFH', needGeo = !!pol.geo, needFace = !!pol.face, enrolled = DB.faces[u.id]?.d;
  if (needFace && !enrolled) { toast('Enrol your face first (Attendance → Secure check-in)', 'err'); S.tab.att = 'secure'; location.hash = '#/attendance'; return render(); }
  const m = modal('Secure check-in', `<div id="sc" class="col" style="gap:8px"></div><div id="scv" style="margin-top:14px"></div>`, null); const sc = $('#sc', m);
  const row = (id, t) => sc.insertAdjacentHTML('beforeend', `<div class="row" id="st-${id}"><span class="badge">…</span><span>${t}</span></div>`);
  const mark = (id, st, t) => { const r = $('#st-' + id, m); if (r) r.innerHTML = `<span class="badge ${st === 1 ? 'ok' : st === 0 ? 'bad' : 'warn'}">${st === 1 ? '✓' : st === 0 ? '✕' : '!'}</span><span>${t}</span>`; };
  const alive = () => document.body.contains(m); const b = rows('branches').find(x => x.id === branchOf(u)); let fixes = [], face = null, stream;
  const block = (why, flags = []) => { rows('punchlog').unshift({ id: uid('p'), emp: u.id, ts: Date.now(), ok: false, risk: 100, flags: flags.length ? flags : ['blocked'], why }); log('Blocked check-in: ' + why); save(); $('#scv', m).innerHTML = `<div class="card flat" style="border-color:var(--red)"><b style="color:var(--red)">Check-in blocked</b><p style="margin:6px 0 0">${esc(why)}</p>${pol.fallback ? `<button type="button" class="btn sm" style="margin-top:10px" data-act="verify_fallback" data-why="${esc(why)}">Can’t verify? Check in and ask HR to review</button>` : ''}</div>`; };
  try {
    row('geo', 'Reading your location (3 high-accuracy fixes)…');
    try { fixes = await getFixes(3, 12000); mark('geo', 1, `Location read · accuracy ±${Math.round(fixes.at(-1).acc)} m`); }
    catch (e) { if (needGeo) { mark('geo', 0, e.message); return block(e.message, ['no_location']); } mark('geo', 2, e.message + ' (not required)'); }
    row('ver', 'Server verification (time, geo-fence, anti-spoofing)…'); let v;
    try {
      v = await API.post('/api/verify', { emp: u.id, clientTs: Date.now(), webdriver: !!navigator.webdriver, needGeo: needGeo && !['Field', 'WFH'].includes(W.mode), faceRequired: false, maxRisk: pol.maxRisk, fixes, sites: ['Field', 'WFH'].includes(W.mode) ? [] : siteGeo(W, R) });
    } catch {
      const f = fixes.at(-1); v = { serverTs: Date.now(), risk: 30, flags: ['no_server_verification'], hard: [], ok: true, client: true, lat: f?.lat, lng: f?.lng, acc: f?.acc };
      if (f && b?.lat && !['Field', 'WFH'].includes(W.mode)) { v.dist = Math.round(haversine(f, b)); if (needGeo && v.dist > (+R.radius || 200)) { v.ok = false; v.hard = ['outside_geofence']; v.flags.push('outside_geofence'); } }
    }
    if (!v.ok) { mark('ver', 0, `Rejected · risk ${v.risk}/100 · ${v.flags.map(flagText).join(', ')}`); return block(v.hard.length ? v.hard.map(flagText).join('; ') : 'Location looks unreliable (risk score ' + v.risk + ')', v.flags); }
    mark('ver', v.flags.length ? 2 : 1, v.flags.length ? `Accepted with notes · risk ${v.risk}/100 · ${v.flags.map(flagText).join(', ')}` : `Verified · ${v.dist != null ? v.dist + ' m from ' + esc(v.site || b?.name || 'site') + ' · ' : ''}risk ${v.risk}/100`);
    if (needFace) {
      row('face', 'Face + liveness check…'); $('#scv', m).innerHTML = camBox; const say = t => { const s = $('#camst', m); if (s) s.textContent = t; };
      say('Loading face models…'); await loadFace(); const video = $('#cam', m); stream = await openCam(video); face = await verifyFace(video, enrolled, say, alive); stream.getTracks().forEach(t => t.stop()); $('#scv', m).innerHTML = '';
      if (!face.live) { mark('face', 0, 'No blink detected — liveness failed'); return block('Liveness check failed (no blink detected). A photo or screen cannot pass.', ['no_liveness']); }
      if (!face.matched) { mark('face', 0, `Face did not match (distance ${face.dist})`); return block('Face does not match the enrolled employee.', ['face_mismatch']); }
      mark('face', 1, `Face matched (distance ${face.dist}) · blink confirmed`);
    }
    const rec = { in: hmFromTs(v.serverTs), out: null, mode: wfh ? 'WFH' : W.mode === 'Field' ? 'Field' : (v.siteId ? siteMode(v.siteId) : W.mode), site: wfh || W.mode === 'Field' ? '' : (v.siteId || W.site || ''), methods: [...(needGeo ? ['location'] : []), ...(needFace ? ['face'] : [])], v: { ts: v.serverTs, risk: v.risk, flags: v.flags, lat: v.lat, lng: v.lng, acc: v.acc, dist: v.dist, site: v.site, sig: v.sig, client: !!v.client }, face: face ? { dist: face.dist, live: true } : null };
    DB.att[u.id] ||= {}; DB.att[u.id][T] = rec; rows('punchlog').unshift({ id: uid('p'), emp: u.id, ts: v.serverTs, ok: true, risk: v.risk, flags: v.flags }); log('Secure check-in'); save();
    $('#scv', m).innerHTML = `<div class="card flat" style="border-color:var(--green)"><b style="color:var(--green)">Checked in at ${rec.in}</b><div class="muted small">Timestamp issued by the server and signed to detect tampering.</div></div>`; toast('Secure check-in complete'); setTimeout(() => { m.remove(); render(); }, 1500);
  } catch (e) { stream?.getTracks().forEach(t => t.stop()); $('#scv', m).innerHTML = `<div class="card flat" style="border-color:var(--red)">${esc(e.name === 'NotAllowedError' ? 'Camera permission was denied.' : e.message)}</div>`; }
}
const FLAG_TEXT = { automation_detected: 'automated browser', device_clock_drift: 'device clock differs from server', stale_or_future_gps_timestamp: 'GPS timestamp out of sync', zero_accuracy: 'GPS reports impossible accuracy', low_gps_accuracy: 'weak GPS signal', no_gps_jitter: 'GPS never moves (typical of mock apps)', rounded_coordinates: 'coordinates too round', unstable_fix: 'GPS jumps around', impossible_travel: 'impossible travel since last check-in', outside_geofence: 'outside the office geo-fence', away_from_office: 'away from office', no_location: 'no location', face_mismatch: 'face mismatch', no_liveness: 'no liveness', no_server_verification: 'server unreachable', ip_location_mismatch: 'network location differs from GPS (VPN / fake GPS?)', blocked: 'blocked' };
const flagText = f => FLAG_TEXT[f] || f;
const plainCheckin = ACT.checkin;
ACT.checkin = () => attemptCheckin();
ACT.secure_go = () => secureCheckin();
ACT.sig_check = async el => { const [e, d] = [el.dataset.e, el.dataset.d]; const r = DB.att[e]?.[d]; if (!r?.v) return; try { const x = await API.post('/api/check', { emp: e, serverTs: r.v.ts, lat: r.v.lng === undefined ? undefined : r.v.lat, lng: r.v.lng, risk: r.v.risk, ok: true, sig: r.v.sig }); toast(x.valid ? '✓ Signature valid — record untouched' : '✕ Signature INVALID — record was altered', x.valid ? 'ok' : 'err'); } catch { toast('Server unreachable', 'err'); } };
TABX.att.secure = () => {
  const R = DB.settings.rules || {}, u = me(), f = DB.faces?.[u.id], b = rows('branches').find(x => x.id === branchOf(u)); const T = TODAY();
  const recs = []; scope().forEach(e => { for (let k = 0; k < 30; k++) { const d = addDays(T, -k), r = DB.att[e.id]?.[d]; if (r?.v) recs.push({ e, d, r }); } }); recs.sort((a, b) => a.d < b.d ? 1 : -1);
  const blocked = rows('punchlog').filter(p => !p.ok && (isHR() || p.emp === u.id)).slice(0, 8);
  return `<div class="grid g2" style="margin-bottom:16px"><div class="card"><header><h3>${ic('camera')} Face recognition</h3>${f ? '<span class="badge ok">Enrolled</span>' : '<span class="badge warn">Not enrolled</span>'}</header><p class="muted">${f ? `Template saved ${new Date(f.ts).toLocaleDateString('en-IN')}. Check-in needs a live blink plus a face match.` : 'Enrol once; check-in then needs a live blink and a face match — a photo of you will not work.'}</p><div class="row wrap"><button class="btn primary" data-act="face_enroll">${f ? 'Re-enrol' : 'Enrol my face'}</button>${f ? '<button class="btn danger" data-act="face_del">Delete template</button>' : ''}</div></div>
  <div class="card"><header><h3>${ic('map')} Location & anti-spoofing</h3></header><div class="list small"><div>Branch: <b>${esc(b?.name || '—')}</b> (${b?.lat ? (+b.lat).toFixed(4) + ', ' + (+b.lng).toFixed(4) : 'no coordinates'})</div>${policySummary(me())}<div class="muted">Each punch uses the server clock, three GPS fixes, and checks for fake GPS, travel speed, clock changes and automation. Admins and HR choose the method under Attendance policy.</div></div><div style="margin-top:12px"><button class="btn primary" data-act="secure_go">${ic('shield')} Secure check-in now</button></div></div></div>
  ${blocked.length ? `<div class="card" style="margin-bottom:16px"><header><h3>Blocked attempts</h3></header>${blocked.map(p => `<div class="row" style="padding:5px 0">${avatar(emp(p.emp), 'sm')}<span style="flex:1"><b>${esc(empName(p.emp))}</b> · ${esc(p.why || '')}</span><span class="muted small">${new Date(p.ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>`).join('')}</div>` : ''}
  <div class="card pad0 tablewrap"><table><thead><tr><th>Employee</th><th>Date</th><th>Time (server)</th><th>Risk</th><th>Distance</th><th>Face</th><th>Notes</th><th></th></tr></thead><tbody>${recs.map(({ e, d, r }) => `<tr><td>${person(e)}</td><td>${fmtShort(d)}</td><td>${r.in}</td><td><span class="badge ${r.v.risk >= 40 ? 'bad' : r.v.risk > 0 ? 'warn' : 'ok'}">${r.v.risk}/100</span></td><td>${r.v.dist != null ? r.v.dist + ' m' : '—'}</td><td>${r.face ? '✓ ' + r.face.dist : '—'}</td><td class="small">${esc((r.v.flags || []).map(flagText).join(', ') || '—')}</td><td><button class="btn sm" data-act="sig_check" data-e="${e.id}" data-d="${d}">Verify signature</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">No secure punches yet.</td></tr>'}</tbody></table></div>`;
};

/* ================= TEAM CHAT ================= */
const TC = { msgs: [], ch: 'general', loaded: false, q: '' };
let ES = null;
const dmId = (a, b) => 'dm:' + [a, b].sort().join(':');
const chVisible = (m, id) => m.ch === 'general' || m.ch === 'dept:' + emp(id)?.dept || (m.ch.startsWith('dm:') && m.ch.split(':').slice(1).includes(id));
const readKey = () => 'orbit_tc_read_' + SESSION.id;
const readMap = () => { try { return JSON.parse(localStorage.getItem(readKey()) || '{}'); } catch { return {}; } };
const markRead = ch => { const r = readMap(); r[ch] = Date.now(); localStorage.setItem(readKey(), JSON.stringify(r)); };
const unreadOf = ch => { const r = readMap()[ch] || 0; return TC.msgs.filter(m => m.ch === ch && m.from !== me().id && m.ts > r).length; };
const unreadAll = () => sum([...new Set(TC.msgs.map(m => m.ch))], unreadOf);
const chTitle = ch => ch === 'general' ? '# General' : ch.startsWith('dept:') ? '# ' + ch.slice(5) : empName(ch.split(':').slice(1).find(x => x !== me().id) || me().id);
function setBadge() { const a = $('.side a[href="#/teamchat"]'); if (!a) return; let b = $('.badge-n', a); const n = unreadAll(); if (!n) return b?.remove(); if (!b) { b = document.createElement('span'); b.className = 'badge-n'; a.appendChild(b); } b.textContent = n; }
async function loadChat() { if (TC.loaded || API.ok === false) return; try { const all = await API.get('/api/chat?since=0'); TC.msgs = all.filter(m => chVisible(m, me().id)); TC.loaded = true; setBadge(); if (location.hash.startsWith('#/teamchat')) render(); } catch { API.ok = false; } }
function onChat(m) {
  if (!SESSION || !chVisible(m, me().id) || TC.msgs.some(x => x.id === m.id)) return; TC.msgs.push(m);
  const onPage = location.hash.startsWith('#/teamchat');
  if (onPage && TC.ch === m.ch) { markRead(m.ch); drawMsgs(); drawChanList(); } else { if (m.from !== me().id) { toast(`💬 ${m.fromName}: ${m.text.slice(0, 60)}`); } onPage ? drawChanList() : setBadge(); }
}
function chanList() {
  const me_ = me(), chs = [{ id: 'general' }, { id: 'dept:' + me_.dept }];
  const dms = [...new Set(TC.msgs.filter(m => m.ch.startsWith('dm:')).map(m => m.ch))]; dms.forEach(c => chs.push({ id: c }));
  if (TC.ch.startsWith('dm:') && !dms.includes(TC.ch)) chs.push({ id: TC.ch });
  return chs.map(c => { const last = TC.msgs.filter(m => m.ch === c.id).at(-1), n = unreadOf(c.id); return { ...c, last, n }; });
}
function drawChanList() { const el = $('#clist'); if (el) el.innerHTML = chanListHtml(); setBadge(); }
const chanListHtml = () => chanList().map(c => `<div class="chan ${c.id === TC.ch ? 'on' : ''}" data-act="chan" data-ch="${c.id}"><div style="min-width:0;flex:1"><b>${esc(chTitle(c.id))}</b><div class="muted small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.last ? esc(c.last.text) : 'No messages yet'}</div></div>${c.n ? `<span class="badge-n" style="background:var(--accent);color:var(--accent-ink);border-radius:99px;padding:0 7px;font-size:11px;font-weight:700">${c.n}</span>` : ''}</div>`).join('');
function drawMsgs() {
  const box = $('#cmsgs'); if (!box) return; const list = TC.msgs.filter(m => m.ch === TC.ch); let last = '';
  box.innerHTML = list.map(m => { const mine = m.from === me().id, day = new Date(m.ts).toDateString(), sep = day !== last ? `<div class="tc muted small" style="margin:8px 0">${new Date(m.ts).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</div>` : ''; last = day; return sep + `<div class="cm ${mine ? 'me' : ''}">${mine ? '' : `<div class="small muted">${esc(m.fromName)}</div>`}<div class="cb">${esc(m.text)}</div><div class="small muted ct">${hmFromTs(m.ts)}</div></div>`; }).join('') || '<div class="empty">Say hello 👋</div>';
  box.scrollTop = box.scrollHeight;
}
PAGE_FN.teamchat = () => {
  if (API.ok === false) return head('Team chat') + needServer(); loadChat(); markRead(TC.ch);
  const others = activeEmps().filter(e => e.id !== me().id);
  return head('Team chat', 'Realtime messages across the company') + `<div class="chatwrap card pad0"><aside><div style="padding:10px"><select class="select" data-chg="newdm"><option value="">＋ New direct message…</option>${others.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></div><div id="clist">${chanListHtml()}</div></aside><section><div class="row" style="padding:12px 16px;border-bottom:1px solid var(--line)"><b>${esc(chTitle(TC.ch))}</b><span class="muted small">${TC.ch === 'general' ? 'Everyone' : TC.ch.startsWith('dept:') ? 'Your department' : 'Direct message'}</span></div><div id="cmsgs"></div><form id="cform" class="row" style="padding:12px;border-top:1px solid var(--line)"><input class="input" id="cin" placeholder="Write a message…" autocomplete="off" maxlength="2000"><button class="btn primary">${ic('send')}</button></form></section></div><p class="small muted">Demo build: identities are not authenticated on the server, so treat chat as non-confidential.</p>`;
};
ACT.chan = el => { TC.ch = el.dataset.ch; markRead(TC.ch); render(); };
CHG.newdm = el => { if (el.value) { TC.ch = dmId(me().id, el.value); markRead(TC.ch); render(); } };
document.addEventListener('submit', async e => { if (e.target.id !== 'cform') return; e.preventDefault(); const i = $('#cin'), text = i.value.trim(); if (!text) return; i.value = ''; try { const m = await API.post('/api/chat', { ch: TC.ch, from: me().id, fromName: me().name, text }); if (m.id) onChat(m); } catch { toast('Message failed — is the server running?', 'err'); i.value = text; } });

/* ================= LIVE TRACKING ================= */
const TR = { data: {}, map: null, layer: null, sharing: false, watch: null, lastSent: 0, tick: null };
function trackScope() { if (isHR()) return () => true; const ids = new Set([me().id, ...reportsOf(me().id).map(e => e.id)]); return id => ids.has(id); }
async function loadTracks() { try { TR.data = await API.get('/api/track'); } catch { API.ok = false; } }
function onTrack(t) { TR.data[t.emp] = t; if (location.hash.startsWith('#/tracking')) { drawMap(); drawTrackList(); } }
const ago = ts => { const s = Math.round((Date.now() - ts) / 1000); return s < 60 ? s + 's ago' : s < 3600 ? Math.round(s / 60) + 'm ago' : Math.round(s / 3600) + 'h ago'; };
function drawTrackList() {
  const el = $('#tlist'); if (!el) return; const ok = trackScope(); const ids = Object.keys(TR.data).filter(ok);
  el.innerHTML = ids.map(id => { const t = TR.data[id]; return `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">${emp(id) ? avatar(emp(id), 'sm') : ''}<div style="flex:1"><b>${esc(t.name || empName(id))}</b>${t.sim ? ' <span class="badge">simulated</span>' : ''}<div class="muted small">${ago(t.last.ts)} · ±${Math.round(t.last.acc || 0)} m · ${t.trail.length} pts</div></div><button class="btn sm" data-act="trk_focus" data-id="${id}">Locate</button></div>`; }).join('') || '<div class="muted">Nobody is sharing location right now.</div>';
}
async function drawMap() {
  const box = $('#map'); if (!box) return;
  try { loadCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'); await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'); } catch { box.innerHTML = '<div class="empty">Could not load the map library (offline?).</div>'; return; }
  if (!TR.map || TR.map._container !== box) { TR.map?.remove(); TR.map = L.map(box).setView([12.9716, 77.5946], 11); orbitTiles().addTo(TR.map); TR.layer = L.layerGroup().addTo(TR.map); TR.fit = true; }
  TR.layer.clearLayers(); const ok = trackScope(), pts = [];
  rows('branches').forEach(b => { if (b.lat) { L.circle([b.lat, b.lng], { radius: +(DB.settings.rules?.radius) || 200, color: '#0f766e', weight: 1, fillOpacity: .08 }).addTo(TR.layer).bindTooltip(b.name); } });
  Object.entries(TR.data).filter(([id]) => ok(id)).forEach(([id, t]) => { const ll = [t.last.lat, t.last.lng]; pts.push(ll); L.polyline(t.trail.map(p => [p.lat, p.lng]), { color: emp(id)?.color || '#2563eb', weight: 3, opacity: .6 }).addTo(TR.layer); L.circleMarker(ll, { radius: 9, color: '#fff', weight: 2, fillColor: emp(id)?.color || '#2563eb', fillOpacity: 1 }).addTo(TR.layer).bindPopup(`<b>${esc(t.name || id)}</b><br>${ago(t.last.ts)}${t.sim ? '<br><i>simulated</i>' : ''}`); });
  if (pts.length && TR.fit) { TR.map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 }); TR.fit = false; }
  setTimeout(() => TR.map?.invalidateSize(), 50);
}
PAGE_FN.tracking = () => {
  if (API.ok === false) return head('Live tracking') + needServer(); if (!Object.keys(TR.data).length) loadTracks().then(() => { drawTrackList(); drawMap(); });
  const sharing = TR.sharing, canView = isHR() || isMgr();
  return head('Live tracking', 'Opt-in location sharing for field duty') + `<div class="card" style="margin-bottom:16px"><div class="row wrap"><div style="flex:1;min-width:240px"><b>${sharing ? '🟢 You are sharing your live location' : 'Share my live location'}</b><div class="muted small">Only while this tab stays open. Visible to HR${me().mgr ? ' and your manager' : ''}. You can stop at any time.</div></div>${sharing ? '<button class="btn danger" data-act="trk_stop">Stop sharing</button>' : '<button class="btn primary" data-act="trk_start">Start sharing</button>'}</div></div>
  ${canView ? `<div class="grid g-main"><div class="card pad0"><div id="map" style="height:460px"></div></div><div class="card"><header><h3>Field team</h3></header><div id="tlist"></div>${isHR() ? `<div class="row wrap" style="margin-top:14px"><button class="btn sm" data-act="trk_demo" data-on="1">Add simulated team</button><button class="btn sm danger" data-act="trk_demo" data-on="0">Clear simulated</button></div><div class="small muted" style="margin-top:6px">Simulated points are demo data, not real people.</div>` : ''}</div></div>` : '<p class="muted">Managers and HR can see the live map for their teams.</p>'}`;
};
ACT.trk_start = () => modal('Share live location?', `<p style="margin-top:0">Your position will be sent to the Orbit server every ~10 seconds and shown to HR${me().mgr ? ' and ' + esc(empName(me().mgr)) : ''}. It stops when you press <b>Stop</b> or close this tab.</p><label class="row"><input type="checkbox" name="ok" required> I agree to share my location during duty hours.</label>`, () => {
  if (!navigator.geolocation) return toast('Geolocation not supported', 'err') || false; TR.sharing = true;
  TR.watch = navigator.geolocation.watchPosition(p => { if (Date.now() - TR.lastSent < 9000) return; TR.lastSent = Date.now(); API.post('/api/track', { emp: me().id, name: me().name, lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }).catch(() => { }); }, e => { toast('Location error: ' + e.message, 'err'); stopSharing(); render(); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  log('Started live location sharing'); render(); toast('Sharing started');
}, 'Start sharing');
function stopSharing() { if (TR.watch != null) navigator.geolocation.clearWatch(TR.watch); TR.watch = null; if (TR.sharing && SESSION) API.del('/api/track?emp=' + me().id).catch(() => { }); TR.sharing = false; }
ACT.trk_stop = () => { stopSharing(); delete TR.data[me().id]; render(); toast('Stopped sharing'); };
ACT.trk_demo = async el => { if (el.dataset.on === '1') await API.post('/api/track/demo', { on: true }); else { await API.del('/api/track?emp=ALL-SIM'); Object.keys(TR.data).forEach(k => TR.data[k].sim && delete TR.data[k]); } await loadTracks(); TR.fit = true; drawTrackList(); drawMap(); };
ACT.trk_focus = el => { const t = TR.data[el.dataset.id]; if (t && TR.map) TR.map.setView([t.last.lat, t.last.lng], 16); };

/* ================= ENCRYPTED CREDENTIALS VAULT ================= */
const V = { key: null, data: null, timer: null, q: '', g: '', err: '' };
const vkey = () => 'orbit_vault_' + SESSION.id, VITER = 310000;
const te = new TextEncoder(), td = new TextDecoder();
const b64 = u => { let s = ''; new Uint8Array(u).forEach(c => s += String.fromCharCode(c)); return btoa(s); }, unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function vDerive(pass, salt, iter) { const km = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
async function vEnc(key, obj) { const iv = crypto.getRandomValues(new Uint8Array(12)); return { iv: b64(iv), ct: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)))) }; }
async function vDec(key, o) { return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, key, unb64(o.ct)))); }
async function vSave() { const st = JSON.parse(localStorage.getItem(vkey())); st.blob = await vEnc(V.key, V.data); localStorage.setItem(vkey(), JSON.stringify(st)); }
function lockVault(silent) { clearTimeout(V.timer); V.key = null; V.data = null; V.q = ''; V.err = ''; if (!silent) { render(); toast('Vault locked'); } }
const touch = () => { clearTimeout(V.timer); if (V.key) V.timer = setTimeout(() => lockVault(), 5 * 60 * 1000); };
document.addEventListener('visibilitychange', () => { if (document.hidden && V.key) { clearTimeout(V.timer); V.timer = setTimeout(() => lockVault(), 60 * 1000); } else touch(); });
const strength = p => { let s = 0; if (p.length >= 12) s++; if (p.length >= 16) s++; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++; return Math.min(4, s); };
const strengthBar = p => { const s = strength(p), l = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][s], c = ['var(--red)', 'var(--red)', 'var(--amber)', 'var(--green)', 'var(--green)'][s]; return `<div class="progress" style="margin-top:6px"><i style="width:${(s + 1) * 20}%;background:${c}"></i></div><div class="small muted">${l}</div>`; };
function genPass(n = 20, sym = true) { const set = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' + (sym ? '!@#$%^&*-_=+?' : ''), a = crypto.getRandomValues(new Uint32Array(n)); return [...a].map(x => set[x % set.length]).join(''); }
const VGROUPS = ['Email', 'Social', 'Dev tools', 'Design', 'Finance', 'Other'];
PAGE_FN.vault = () => {
  if (!window.crypto?.subtle) return head('Credentials') + '<div class="card empty">The vault needs a secure context (https or localhost).</div>';
  const has = !!localStorage.getItem(vkey()); const intro = `<p class="muted">A personal password vault. Everything is encrypted in your browser with AES-256-GCM using a key derived from your master passphrase (PBKDF2, 310,000 rounds). The passphrase is never stored and cannot be recovered.</p>`;
  if (!has) return head('Credentials', 'Encrypted team password manager') + `<form class="card" id="vsetup" style="max-width:520px">${intro}<label class="f">Master passphrase (12+ characters)<input class="input" id="vp1" type="password" minlength="12" required autocomplete="new-password"></label><div id="vmeter"></div><label class="f" style="margin-top:12px">Confirm passphrase<input class="input" id="vp2" type="password" required autocomplete="new-password"></label><div id="verr" class="small" style="color:var(--red);min-height:20px">${V.err}</div><button class="btn primary">Create vault</button></form>`;
  if (!V.key) return head('Credentials', 'Encrypted team password manager') + `<form class="card" id="vunlock" style="max-width:520px">${intro}<label class="f">Master passphrase<input class="input" id="vp1" type="password" required autocomplete="current-password"></label><div id="verr" class="small" style="color:var(--red);min-height:20px">${V.err}</div><div class="row"><button class="btn primary">${ic('lock')} Unlock</button><button type="button" class="btn danger right" data-act="v_reset">Forgot / erase vault</button></div></form>`;
  touch(); const items = V.data.items.filter(i => (!V.g || i.group === V.g) && (!V.q || (i.title + i.user + i.url).toLowerCase().includes(V.q.toLowerCase())));
  return head('Credentials', `${V.data.items.length} saved · auto-locks after 5 minutes idle`, `<button class="btn" data-act="v_export">${ic('download')} Encrypted backup</button><button class="btn" data-act="v_lock">${ic('lock')} Lock</button><button class="btn primary" data-act="v_new">${ic('plus')} Add credential</button>`) +
    `<div class="toolbar"><input class="input" id="vq" data-inp="vq" placeholder="Search…" value="${esc(V.q)}" style="min-width:240px"><div class="pill-toggle"><button class="${!V.g ? 'on' : ''}" data-act="v_group" data-g="">All</button>${VGROUPS.map(g => `<button class="${V.g === g ? 'on' : ''}" data-act="v_group" data-g="${g}">${g}</button>`).join('')}</div></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${items.map(i => `<div class="card"><div class="row"><b style="flex:1">${esc(i.title)}</b><span class="badge acc">${esc(i.group)}</span></div><div class="small muted" style="margin:6px 0">${/^https?:\/\//.test(i.url) ? `<a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">${esc(i.url)}</a>` : esc(i.url)}</div><div class="row" style="padding:4px 0"><span class="muted small" style="width:70px">User</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(i.user)}</span><button class="icon-btn" title="Copy" data-act="v_copy" data-id="${i.id}" data-f="user">${ic('copy')}</button></div><div class="row" style="padding:4px 0"><span class="muted small" style="width:70px">Password</span><span style="flex:1;font-family:ui-monospace,monospace" id="pw-${i.id}">••••••••••</span><button class="icon-btn" title="Show" data-act="v_show" data-id="${i.id}">${ic('eye')}</button><button class="icon-btn" title="Copy (clears in 20s)" data-act="v_copy" data-id="${i.id}" data-f="pass">${ic('copy')}</button></div>${i.notes ? `<div class="small muted" style="margin-top:6px">${esc(i.notes)}</div>` : ''}<div class="row" style="margin-top:8px"><button class="btn sm" data-act="v_edit" data-id="${i.id}">Edit</button><button class="btn sm danger" data-act="v_del" data-id="${i.id}">Delete</button></div></div>`).join('') || '<div class="card empty" style="grid-column:1/-1">No credentials yet.</div>'}</div>`;
};
INP.vq = el => { V.q = el.value; render(); }; ACT.v_group = el => { V.g = el.dataset.g; render(); }; ACT.v_lock = () => lockVault();
ACT.v_reset = () => confirmBox('Erase your vault permanently? All saved credentials are lost — there is no recovery.', () => { localStorage.removeItem(vkey()); lockVault(true); render(); });
document.addEventListener('input', e => { if (e.target.id === 'vp1' && $('#vmeter')) $('#vmeter').innerHTML = strengthBar(e.target.value); });
document.addEventListener('submit', async e => {
  if (e.target.id === 'vsetup') { e.preventDefault(); const p1 = $('#vp1').value, p2 = $('#vp2').value; if (p1 !== p2) { V.err = 'Passphrases do not match'; return render(); } if (strength(p1) < 3) { V.err = 'Choose a stronger passphrase (mix upper/lower case, numbers, symbols)'; return render(); }
    const salt = crypto.getRandomValues(new Uint8Array(16)); V.key = await vDerive(p1, salt, VITER); V.data = { items: [] }; localStorage.setItem(vkey(), JSON.stringify({ v: 1, salt: b64(salt), iter: VITER })); await vSave(); V.err = ''; log('Created credentials vault'); save(); render(); toast('Vault created'); }
  if (e.target.id === 'vunlock') { e.preventDefault(); const st = JSON.parse(localStorage.getItem(vkey())); try { const k = await vDerive($('#vp1').value, unb64(st.salt), st.iter); V.data = await vDec(k, st.blob); V.key = k; V.err = ''; render(); } catch { V.err = 'Incorrect passphrase'; render(); } }
});
function vForm(i = {}) { return `<div class="form-grid">${fld('Title', 'title', i.title, 'text', 'required', 'full')}${sel('Group', 'group', VGROUPS, i.group)}${fld('Website', 'url', i.url, 'text')}${fld('Username / email', 'user', i.user, 'text', 'required autocomplete="off"')}<label class="f">Password<span class="row" style="gap:6px"><input class="input" name="pass" id="vpass" type="password" value="${esc(i.pass || '')}" required autocomplete="new-password"><button type="button" class="btn sm" data-act="v_gen">Generate</button></span></label><div class="full" id="vpm">${strengthBar(i.pass || '')}</div><label class="f full">Notes<textarea class="input" name="notes" rows="2">${esc(i.notes || '')}</textarea></label></div>`; }
document.addEventListener('input', e => { if (e.target.id === 'vpass') $('#vpm').innerHTML = strengthBar(e.target.value); });
ACT.v_gen = () => { const i = $('#vpass'); i.value = genPass(20); i.type = 'text'; $('#vpm').innerHTML = strengthBar(i.value); };
ACT.v_new = () => modal('Add credential', vForm(), async d => { V.data.items.unshift({ id: uid('c'), ...d }); await vSave(); log('Added a vault item'); save(); render(); toast('Saved & encrypted'); });
ACT.v_edit = el => { const i = V.data.items.find(x => x.id === el.dataset.id); modal('Edit credential', vForm(i), async d => { Object.assign(i, d); await vSave(); render(); toast('Updated'); }); };
ACT.v_del = el => confirmBox('Delete this credential?', async () => { V.data.items = V.data.items.filter(x => x.id !== el.dataset.id); await vSave(); render(); });
ACT.v_show = el => { const i = V.data.items.find(x => x.id === el.dataset.id), s = $('#pw-' + i.id), shown = s.dataset.on === '1'; s.textContent = shown ? '••••••••••' : i.pass; s.dataset.on = shown ? '' : '1'; if (!shown) setTimeout(() => { if (s.isConnected) { s.textContent = '••••••••••'; s.dataset.on = ''; } }, 10000); };
ACT.v_copy = async el => { const i = V.data.items.find(x => x.id === el.dataset.id), v = i[el.dataset.f]; try { await navigator.clipboard.writeText(v); toast(el.dataset.f === 'pass' ? 'Password copied — clipboard clears in 20s' : 'Copied'); if (el.dataset.f === 'pass') setTimeout(() => navigator.clipboard.writeText('').catch(() => { }), 20000); } catch { toast('Clipboard blocked by the browser', 'err'); } };
ACT.v_export = () => download('orbit-vault-encrypted-backup.json', localStorage.getItem(vkey()), 'application/json');

/* ---------- after-render hook ---------- */
const _r3 = render;
render = function () {
  _r3(); const page = (location.hash.split('/')[1] || 'dashboard');
  if (page !== 'vault' && V.key) lockVault(true); if (page !== 'tracking') { TR.map?.remove(); TR.map = null; }
  if (page === 'tracking' && $('#map')) { drawTrackList(); drawMap(); } if (page === 'teamchat') { drawMsgs(); setTimeout(() => $('#cin')?.focus(), 0); } setBadge();
};
function startRealtime() {
  if (ES || !SESSION || API.ok === false) return; loadChat(); ES = new EventSource('/api/stream');
  ES.addEventListener('chat', e => onChat(JSON.parse(e.data))); ES.addEventListener('track', e => onTrack(JSON.parse(e.data)));
  ES.addEventListener('track-clear', e => { const { emp: id } = JSON.parse(e.data); if (id === 'ALL-SIM') Object.keys(TR.data).forEach(k => TR.data[k].sim && delete TR.data[k]); else delete TR.data[id]; if (location.hash.startsWith('#/tracking')) { drawTrackList(); drawMap(); } });
}
setInterval(() => { if (location.hash.startsWith('#/tracking')) drawTrackList(); }, 15000);

