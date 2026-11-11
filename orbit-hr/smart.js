'use strict';
/* ============ Orbit Realty — smart layer (all options editable in Settings → Integrations)
   1. Face recognition: optional "human" engine (anti-spoof + liveness models) beside face-api, liveness on/off
   2. Live tracking: per-site geo-fences, enter / leave alerts, signal-lost state, nearest address, admin-set interval + accuracy
   3. Profile photo: compulsory for every employee, changeable any time
   4. Phones: a clean sign-in screen and no controls for sections the person cannot use ============ */
const fCfg = () => ({ engine: 'face-api', liveness: 'on', similarity: .55, humanJs: 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.5/dist/human.js', humanModels: 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.5/models/', ...(CFGv().face || {}) });
const tCfg = () => ({ interval: 10, minAccuracy: 150, exitAlerts: true, exitGrace: 50, staleMin: 5, address: false, ...(CFGv().track || {}) });

/* ================= 1. FACE ENGINES ================= */
let HUM = null, humReady = null;
function loadHuman() {
  return humReady ??= (async () => {
    const c = fCfg(); await loadScript(c.humanJs);
    HUM = new Human.Human({ modelBasePath: c.humanModels, cacheSensitivity: 0, debug: false, filter: { enabled: true, equalization: false, flip: false }, face: { enabled: true, detector: { rotation: false, maxDetected: 2, minConfidence: .5 }, mesh: { enabled: true }, iris: { enabled: false }, emotion: { enabled: false }, description: { enabled: true }, antispoof: { enabled: true }, liveness: { enabled: true } }, body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }, gesture: { enabled: false }, segmentation: { enabled: false } });
    await HUM.load(); try { await HUM.warmup(); } catch { }
  })().catch(e => { humReady = null; HUM = null; throw e; });
}
const humFaces = async video => ((await HUM.detect(video)).face || []).filter(f => f.embedding && f.embedding.length);
const humScore = f => f.faceScore ?? f.score ?? f.boxScore ?? 0;
async function humEnrol(video, say, alive) {
  const descs = [], t0 = Date.now(), live = fCfg().liveness !== 'off';
  while (descs.length < 3 && Date.now() - t0 < 30000 && alive()) {
    const all = await humFaces(video);
    if (all.length > 1) say('Only one person in frame, please');
    else if (all.length === 1 && humScore(all[0]) > .7) { const f = all[0]; if (live && ((f.real ?? 1) < .5 || (f.live ?? 1) < .5)) say('Hold the phone steady and face the light — a real face is needed'); else { descs.push(Array.from(f.embedding, v => +v.toFixed(4))); say(`Captured ${descs.length}/3 — slightly turn your head`); await sleep(900); } }
    else say('Look at the camera in good light');
    await sleep(120);
  }
  return descs;
}
async function humVerify(video, enrolled, say, alive) {
  const c = fCfg(), needLive = c.liveness !== 'off', t0 = Date.now(); let best = 0, samples = 0, liveOk = !needLive, liveHits = 0;
  while (Date.now() - t0 < 25000 && alive()) {
    const all = await humFaces(video); if (all.length !== 1) { say(all.length ? 'Only one person in frame, please' : 'Look at the camera'); await sleep(120); continue; }
    const f = all[0];
    if (needLive && !liveOk) { if ((f.real ?? 0) > .5 && (f.live ?? 0) > .5) { if (++liveHits >= 2) liveOk = true; } else { liveHits = 0; say('Checking that this is a live face — hold steady'); } }
    say('Checking your face…'); samples++; best = Math.max(best, ...enrolled.map(x => HUM.match.similarity(f.embedding, x)));
    if (samples >= 3 && liveOk) break; await sleep(80);
  }
  return { live: liveOk, matched: liveOk && best >= (c.similarity || .55), dist: +(1 - best).toFixed(3) };
}
/* face-api without the blink step (only when an admin turns liveness off) */
async function faNoBlink(video, enrolled, say, alive) {
  const t0 = Date.now(); let best = 9, samples = 0;
  while (Date.now() - t0 < 20000 && alive() && samples < 3) { say('Checking your face…'); const r = await faceapi.detectSingleFace(video, detOpts()).withFaceLandmarks().withFaceDescriptor(); if (r) { samples++; best = Math.min(best, ...enrolled.map(x => faceapi.euclideanDistance(r.descriptor, x))); } else say('Look at the camera'); await sleep(80); }
  return { live: true, matched: best < (fCfg().threshold || .5), dist: +best.toFixed(3) };
}
{
  const _lf = loadFace, _ce = captureEnrol, _vf = verifyFace;
  loadFace = function () { return fCfg().engine === 'human' ? loadHuman() : _lf(); };
  captureEnrol = function (video, say, alive) { return fCfg().engine === 'human' ? humEnrol(video, say, alive) : _ce(video, say, alive); };
  verifyFace = async function (video, enrolled, say, alive) {
    const human = fCfg().engine === 'human', len = enrolled?.[0]?.length || 0;
    if ((human && len === 128) || (!human && len && len !== 128)) { say('The face engine was changed — please enrol your face again (Attendance → Secure check-in).'); await sleep(2500); return { live: false, matched: false, dist: 9, reenrol: true }; }
    if (human) return humVerify(video, enrolled, say, alive);
    return fCfg().liveness === 'off' ? faNoBlink(video, enrolled, say, alive) : _vf(video, enrolled, say, alive);
  };
}

/* ================= 2. LIVE TRACKING + GEO-FENCES ================= */
const trkSites = () => rows('branches').filter(b => b.status !== 'Inactive' && Number.isFinite(+b.lat) && Number.isFinite(+b.lng) && (+b.lat || +b.lng));
const trkRadius = b => +b.radius || +(DB.settings.rules?.radius) || 200;
function trkFence(p) { let best = null; for (const b of trkSites()) { const d = haversine(p, { lat: +b.lat, lng: +b.lng }); if (!best || d < best.d) best = { b, d }; } if (!best) return null; const r = trkRadius(best.b); return { site: best.b, dist: Math.round(best.d), inside: best.d <= r + Math.min(p.acc || 0, 60), left: best.d > r + tCfg().exitGrace + Math.min(p.acc || 0, 60) }; }
const trkStale = t => Date.now() - t.last.ts > tCfg().staleMin * 60000;
const trkKm = m => m < 1000 ? m + ' m' : (m / 1000).toFixed(1) + ' km';
const TRK_IN = {}, TRK_ADDR = {};
function trkAddr(id, p) { if (!tCfg().address) return; const k = p.lat.toFixed(4) + ',' + p.lng.toFixed(4); if (TRK_ADDR[id]?.k === k) return; TRK_ADDR[id] = { k, name: TRK_ADDR[id]?.name || '' }; fetch(`/api/revgeo?lat=${p.lat}&lng=${p.lng}`).then(r => r.ok ? r.json() : null).then(j => { if (j?.name && TRK_ADDR[id]?.k === k) { TRK_ADDR[id].name = j.name; const n = document.querySelector(`[data-addr="${id}"]`); if (n) n.textContent = j.name; } }).catch(() => { }); }
function trkBadge(t) { if (trkStale(t)) return '<span class="badge warn">Signal lost</span>'; const f = trkFence(t.last); if (!f) return ''; return f.inside ? `<span class="badge ok">At ${esc(f.site.name)}</span>` : `<span class="badge ${f.left ? 'bad' : 'warn'}">${trkKm(f.dist)} from ${esc(f.site.name)}</span>`; }
drawTrackList = function () {
  const el = $('#tlist'); if (!el) return; const ok = trackScope(), ids = Object.keys(TR.data).filter(ok);
  el.innerHTML = ids.map(id => { const t = TR.data[id]; trkAddr(id, t.last); return `<div class="trow">${emp(id) ? avatar(emp(id), 'sm') : ''}<div class="tinfo"><b>${esc(t.name || empName(id))}</b>${t.sim ? ' <span class="badge">simulated</span>' : ''}<div class="tbadge">${trkBadge(t)}</div><div class="muted small">${ago(t.last.ts)} · ±${Math.round(t.last.acc || 0)} m · ${t.trail.length} pts</div>${tCfg().address ? `<div class="muted small taddr" data-addr="${id}">${esc(TRK_ADDR[id]?.name || '')}</div>` : ''}</div><button class="btn sm" data-act="trk_focus" data-id="${id}">Locate</button></div>`; }).join('') || '<div class="muted">Nobody is sharing location right now.</div>';
};
drawMap = async function () {
  const box = $('#map'); if (!box) return;
  try { loadCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'); await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'); } catch { box.innerHTML = '<div class="empty">Could not load the map library (offline?).</div>'; return; }
  if (!TR.map || TR.map._container !== box) { TR.map?.remove(); TR.map = L.map(box).setView([12.9716, 77.5946], 11); orbitTiles().addTo(TR.map); TR.layer = L.layerGroup().addTo(TR.map); TR.fit = true; }
  TR.layer.clearLayers(); const ok = trackScope(), pts = [];
  trkSites().forEach(b => { L.circle([+b.lat, +b.lng], { radius: trkRadius(b), color: '#0f766e', weight: 1.5, fillOpacity: .1 }).addTo(TR.layer).bindTooltip(`${esc(b.name)} · ${trkRadius(b)} m fence`); });
  Object.entries(TR.data).filter(([id]) => ok(id)).forEach(([id, t]) => {
    const ll = [t.last.lat, t.last.lng], f = trkFence(t.last), stale = trkStale(t), col = stale ? '#9ca3af' : !f ? (emp(id)?.color || '#2563eb') : f.inside ? '#16a34a' : f.left ? '#dc2626' : '#f59e0b'; pts.push(ll);
    L.polyline(t.trail.map(p => [p.lat, p.lng]), { color: emp(id)?.color || '#2563eb', weight: 3, opacity: .55 }).addTo(TR.layer);
    if (t.last.acc) L.circle(ll, { radius: Math.min(t.last.acc, 300), color: col, weight: 0, fillOpacity: .12 }).addTo(TR.layer);
    L.circleMarker(ll, { radius: 9, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1 }).addTo(TR.layer).bindPopup(`<b>${esc(t.name || id)}</b><br>${stale ? 'Signal lost · ' : ''}${ago(t.last.ts)}${f ? '<br>' + (f.inside ? 'Inside ' : trkKm(f.dist) + ' from ') + esc(f.site.name) : ''}${TRK_ADDR[id]?.name ? '<br><span style="color:#6b7280">' + esc(TRK_ADDR[id].name) + '</span>' : ''}${t.sim ? '<br><i>simulated</i>' : ''}`);
  });
  if (pts.length && TR.fit) { TR.map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 }); TR.fit = false; }
  setTimeout(() => TR.map?.invalidateSize(), 50);
};
/* enter / leave alerts: for the person sharing, and for HR / the manager watching their team */
{
  const _on = onTrack;
  onTrack = function (t) {
    try {
      if (tCfg().exitAlerts && SESSION && t?.emp && t.last && !t.sim) {
        const f = trkFence(t.last), now = f?.inside ? f.site.id : f?.left ? '' : TRK_IN[t.emp], was = TRK_IN[t.emp], mine = t.emp === me().id, watch = !mine && trackScope()(t.emp) && (isHR() || isMgr());
        if (was !== undefined && now !== was && (mine || watch)) {
          const who = mine ? 'You' : (t.name || empName(t.emp)), sn = id => siteName(id) || 'the site';
          const msg = now ? `📍 ${who} entered ${sn(now)}` : `🚩 ${who} left ${sn(was)}${f ? ' — now ' + trkKm(f.dist) + ' away' : ''}`;
          toast(msg, now ? 'ok' : 'err'); if (watch) { notify(me().id, msg); save(); try { updateBell(); } catch { } }
        }
        if (now !== undefined) TRK_IN[t.emp] = now;
      }
    } catch { }
    return _on(t);
  };
}
/* browser sharing honours the admin's interval + accuracy settings (the phone apps keep their own background watcher) */
if (!window.ORBIT_NATIVE) {
  ACT.trk_start = () => { const c = tCfg(); modal('Share live location?', `<p style="margin-top:0">Your position will be sent to the ${esc(BR.name)} server about every ${c.interval} seconds and shown to HR${me().mgr ? ' and ' + esc(empName(me().mgr)) : ''}. It stops when you press <b>Stop</b> or close this tab.</p><label class="row"><input type="checkbox" name="ok" required> I agree to share my location during duty hours.</label>`, () => {
    if (!navigator.geolocation) return toast('Geolocation not supported', 'err') || false; TR.sharing = true;
    TR.watch = navigator.geolocation.watchPosition(p => {
      if (Date.now() - TR.lastSent < c.interval * 1000 - 800) return; if (p.coords.accuracy > c.minAccuracy) return; TR.lastSent = Date.now();
      const fix = { emp: me().id, name: me().name, lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
      try { onTrack({ ...(TR.data[me().id] || { trail: [] }), emp: me().id, name: me().name, last: { ...fix, ts: Date.now() }, trail: [...(TR.data[me().id]?.trail || []), { lat: fix.lat, lng: fix.lng }].slice(-200) }); } catch { }
      API.post('/api/track', fix).catch(() => { });
    }, e => { toast('Location error: ' + e.message, 'err'); stopSharing(); render(); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    log('Started live location sharing'); render(); toast('Sharing started');
  }, 'Start sharing'); };
}

/* ================= 3. COMPULSORY, CHANGEABLE PROFILE PHOTO ================= */
const photoRequired = () => DB?.settings?.rules?.photoRequired !== false;
function photoSet(file, done) {
  if (!file) return; if (!/^image\//.test(file.type)) return toast('Choose an image file', 'err');
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), s = Math.min(img.width, img.height); x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256); URL.revokeObjectURL(url); try { me().photo = c.toDataURL('image/jpeg', .82); log('Updated profile photo'); save(); } catch { return toast('Could not save the photo — storage is full', 'err'); } done?.(); };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read that image', 'err'); }; img.src = url;
}
CHG.photo2 = el => photoSet(el.files[0], () => { document.getElementById('pgate')?.remove(); document.querySelector('.modal-bg.psheet')?.remove(); render(); toast('Profile photo saved'); });
const photoBtns = () => `<label class="btn primary big pg-btn">${ic(ICONS.camera ? 'camera' : 'plus')} Take a photo<input type="file" accept="image/*" capture="user" hidden data-chg="photo2"></label><label class="btn big pg-btn">Choose from gallery<input type="file" accept="image/*" hidden data-chg="photo2"></label>`;
function photoGate() {
  if (!SESSION || !DB || !photoRequired() || me()?.photo || document.getElementById('pgate')) return; const u = me(), el = document.createElement('div'); el.id = 'pgate'; el.className = 'pgate';
  el.innerHTML = `<div class="pg-card" role="dialog" aria-label="Add your profile photo"><div class="pg-av">${esc(initials(u.name))}</div><h2>Add your profile photo</h2><p class="muted">Hello ${esc(u.name.split(' ')[0])}. A clear photo of your face is required before you can use the app. It appears on your profile, attendance records and ID card. You can change it any time.</p>${photoBtns()}<button type="button" class="btn ghost pg-out" data-act="logout">Sign out</button></div>`;
  document.body.appendChild(el);
}
ACT.photo_change = () => { const u = me(), m = modal('Profile photo', `<div class="pg-sheet"><div class="pg-cur">${avatar(u, 'lg')}</div><p class="muted small" style="text-align:center;margin:8px 0 14px">Use a clear, recent photo of your face.</p>${photoBtns()}<a class="btn ghost pg-btn" href="#/employees/${u.id}" data-close>View my profile</a></div>`, null, '', false); m.classList.add('psheet'); m.addEventListener('click', e => { if (e.target.closest('[data-close]')) m.remove(); }); };
{ const _r = render; render = function () { _r(); try { if (SESSION && !me()?.photo) photoGate(); else document.getElementById('pgate')?.remove(); smartPhone(); } catch { } }; }
{ const _lv = loginView; loginView = function () { _lv(); document.getElementById('pgate')?.remove(); try { smartLogin(); } catch { } }; }

/* ================= 4. PHONES: CLEAN SIGN-IN, NO CONTROLS FOR SECTIONS WITHOUT ACCESS ================= */
function smartLogin() {
  const card = document.querySelector('.login-card'); if (!card || card.querySelector('.ml-brand')) return;
  card.insertAdjacentHTML('afterbegin', `<div class="ml-brand">${typeof brandMark === 'function' ? brandMark() : ''}<b>${esc(BR.name)}</b><span>${esc(BR.product || '')}</span></div>`);
  const demo = card.querySelector('.demo-chips'); if (demo && !demo.closest('details')) { const d = document.createElement('details'); d.className = 'ml-demo'; d.innerHTML = '<summary>Demo accounts</summary>'; const prev = demo.previousElementSibling; demo.before(d); if (prev && /demo|try/i.test(prev.textContent) && !prev.querySelector('input,button')) d.appendChild(prev); d.appendChild(demo); const rp = document.getElementById('rolepreview'); if (rp) d.appendChild(rp); }
}
function smartPhone() {
  const staffOnly = !(isHR() || isMgr() || can('dash.exec')); document.documentElement.classList.toggle('m-staff', staffOnly);
  document.querySelectorAll('#side .sgroup, #side .sgrp, #side section').forEach(g => { const any = g.querySelector('a[href^="#/"]'); if (!any) g.style.display = 'none'; });
}
document.head.insertAdjacentHTML('beforeend', `<style>
.trow{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}.trow:last-child{border-bottom:0}.trow .tinfo{flex:1;min-width:0}.trow .tbadge{margin:3px 0}.trow .tbadge .badge{white-space:normal;text-align:left}.trow .taddr{overflow-wrap:anywhere}
.pgate{position:fixed;inset:0;z-index:260;display:grid;place-items:center;padding:20px;background:var(--bg);overflow:auto}
.pg-card{width:min(400px,100%);display:flex;flex-direction:column;align-items:stretch;gap:12px;text-align:center}
.pg-av{width:112px;height:112px;margin:0 auto 4px;border-radius:50%;display:grid;place-items:center;font-size:36px;font-weight:800;color:var(--muted);background:var(--surface);border:2px dashed var(--line)}
.pg-card h2{font-size:22px;letter-spacing:-.02em}.pg-card p{margin:0 0 6px;line-height:1.55}
.pg-btn{width:100%;justify-content:center;min-height:50px;cursor:pointer}.pg-out{margin-top:2px;justify-content:center;width:100%}
.pg-sheet{display:flex;flex-direction:column;gap:10px}.pg-cur{display:grid;place-items:center}.pg-cur .avatar{width:96px;height:96px;font-size:30px}
.ml-brand,.ml-demo{display:none}
@media(max-width:900px){
 .login{display:block!important;min-height:100dvh;background:var(--bg)}
 .login .login-art{display:none!important}
 .login .login-form{min-height:100dvh;display:grid;place-items:center;padding:calc(env(safe-area-inset-top,0px) + 24px) 20px calc(env(safe-area-inset-bottom,0px) + 24px)}
 .login .login-card{width:min(420px,100%);padding:0;background:none;border:0;box-shadow:none}
 .login .login-card h2{font-size:24px;letter-spacing:-.02em}
 .ml-brand{display:flex;align-items:center;gap:10px;margin-bottom:28px;font-size:16px}.ml-brand b{font-weight:800}.ml-brand span{color:var(--muted);font-weight:600}
 .ml-demo{display:block;margin-top:18px;border-top:1px solid var(--line);padding-top:12px}.ml-demo summary{cursor:pointer;font-size:13px;font-weight:700;color:var(--muted);list-style:none;min-height:36px;display:flex;align-items:center;justify-content:center}.ml-demo summary::-webkit-details-marker{display:none}.ml-demo[open] summary{margin-bottom:8px}
 .login .btn.primary{min-height:50px;border-radius:14px}.login .input{min-height:50px;border-radius:14px}
 html.m-staff .top>select.select{display:none!important}
 html.m-staff .top .searchbox{flex:1;width:auto;justify-content:flex-start;padding:0 14px}html.m-staff .top .searchbox span{display:inline;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
}
</style>`);
