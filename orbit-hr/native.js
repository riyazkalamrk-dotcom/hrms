'use strict';
/* ============ Orbit — native app layer (Android & iOS via Capacitor) + the "App permissions" centre (also useful in the browser) ============
   • asks for permissions the right way (explains first, asks once, deep-links to Settings when blocked)
   • real push (FCM/APNs) · exact duty reminders that work offline · background live tracking · mock-GPS detection · biometric lock
   • native feel: safe areas, bottom tab bar, haptics, hardware back button, status bar, splash, share-sheet downloads */
const NATIVE = !!window.ORBIT_NATIVE, NPLAT = NATIVE ? Capacitor.getPlatform() : 'web';
const CP = (window.Capacitor && Capacitor.Plugins) || {};
const NV = { lastBg: 0, tok: '', reg: false, locked: false };
const nvPrefs = () => { try { return prefs(); } catch { return {}; } };
Object.assign(FLAG_TEXT, { mock_location_app: 'a fake-location app is active on the phone' });
document.documentElement.classList.toggle('is-native', NATIVE); document.documentElement.classList.add('plat-' + NPLAT);

/* ================= connect to the company server (bundled app, first launch) ================= */
function serverSetup() {
  if (document.getElementById('srvsetup')) return; const el = document.createElement('div'); el.id = 'srvsetup'; el.className = 'srvsetup';
  el.innerHTML = `<div class="srv-card"><div style="font-size:44px">🔗</div><h2>Connect to your company</h2><p class="muted">Enter the address your HR team gave you, for example <b>https://hr.yourcompany.com</b></p><input class="input" id="srvurl" type="url" inputmode="url" autocapitalize="none" autocomplete="off" placeholder="https://hr.yourcompany.com" value="${esc(ORBIT_NATIVE_CFG.server || '')}"><div id="srverr" class="small" style="color:var(--red);min-height:20px;margin-top:6px"></div><button class="btn primary big" id="srvgo" style="width:100%">Connect</button></div>`;
  document.body.appendChild(el);
  $('#srvgo').onclick = async () => { let u = $('#srvurl').value.trim().replace(/\/+$/, ''); if (!u) return; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; const b = $('#srvgo'); b.disabled = true; b.textContent = 'Checking…'; try { const r = await fetch(u + '/api/time', { cache: 'no-store' }), j = await r.json(); if (!j.now) throw 0; localStorage.setItem('orbit_server', u); location.reload(); } catch { $('#srverr').textContent = 'Could not reach that address. Check it and your internet connection.'; b.disabled = false; b.textContent = 'Connect'; } };
}
if (NATIVE && window.ORBIT_BASE === '' && /^(capacitor|ionic|https?):\/\/localhost/.test(location.origin)) addEventListener('load', () => setTimeout(serverSetup, 100));
ACT.change_server = () => confirmBox('Switch to a different company server? You will be signed out of this phone.', () => { localStorage.removeItem('orbit_server'); location.reload(); });

/* ================= permission status (native + browser) ================= */
async function permState(k) {
  try {
    if (NATIVE) {
      if (k === 'location') { const r = await CP.Geolocation.checkPermissions(); return r.location === 'granted' ? 'granted' : r.location === 'denied' ? 'denied' : 'prompt'; }
      if (k === 'push') { const r = await CP.PushNotifications.checkPermissions(); return r.receive; }
      if (k === 'reminders') { const r = await CP.LocalNotifications.checkPermissions(); return r.display; }
      if (k === 'camera') { const r = await CP.Camera.checkPermissions(); return r.camera; }
      if (k === 'bio') { const r = await CP.BiometricAuthNative.checkBiometry(); return r.isAvailable ? 'granted' : 'unavailable'; }
      if (k === 'bgloc') return localStorage.getItem('orbit_bgloc') === '1' ? 'granted' : 'prompt';
      if (k === 'exact') { if (NPLAT !== 'android') return 'n/a'; const r = await CP.LocalNotifications.checkExactNotificationSetting(); return r.exact_alarm === 'granted' ? 'granted' : 'denied'; }
    } else {
      if (k === 'location') { const r = await navigator.permissions?.query({ name: 'geolocation' }); return r ? (r.state === 'granted' ? 'granted' : r.state === 'denied' ? 'denied' : 'prompt') : 'prompt'; }
      if (k === 'push' || k === 'reminders') return typeof Notification === 'undefined' ? 'unavailable' : Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'prompt';
      if (k === 'camera') { const r = await navigator.permissions?.query({ name: 'camera' }); return r ? (r.state === 'granted' ? 'granted' : r.state === 'denied' ? 'denied' : 'prompt') : 'prompt'; }
    }
  } catch { }
  return 'unavailable';
}
async function permAsk(k) {
  try {
    if (NATIVE) {
      if (k === 'location') { const r = await CP.Geolocation.requestPermissions({ permissions: ['location'] }); return r.location; }
      if (k === 'push') { const r = await CP.PushNotifications.requestPermissions(); if (r.receive === 'granted') { try { await CP.LocalNotifications.requestPermissions(); } catch { } nativePushRegister().catch(() => { }); setTimeout(scheduleDutyReminders, 500); } return r.receive; }
      if (k === 'reminders') { const r = await CP.LocalNotifications.requestPermissions(); if (r.display === 'granted') scheduleDutyReminders(); return r.display; }
      if (k === 'camera') { const r = await CP.Camera.requestPermissions({ permissions: ['camera'] }); return r.camera; }
      if (k === 'bio') { return permState('bio'); }
      if (k === 'bgloc') { const r = await CP.Geolocation.requestPermissions({ permissions: ['location'] }); if (r.location !== 'granted') return 'denied'; localStorage.setItem('orbit_bgloc', '1'); try { await startBgProbe(); } catch { } return 'granted'; }
      if (k === 'exact') { await CP.LocalNotifications.changeExactNotificationSetting(); return permState('exact'); }
    } else {
      if (k === 'location') { await getFixes(1, 8000); return 'granted'; }
      if (k === 'push' || k === 'reminders') { if (typeof Notification === 'undefined') return 'unavailable'; const r = await Notification.requestPermission(); if (r === 'granted' && k === 'push') enablePush().catch(() => { }); return r; }
      if (k === 'camera') { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach(t => t.stop()); return 'granted'; }
    }
  } catch (e) { return 'denied'; }
  return 'unavailable';
}
/* briefly start a background watcher so the OS shows its "Allow all the time" step, then stop it */
async function startBgProbe() { const B = CP.BackgroundGeolocation; if (!B) return; const id = await B.addWatcher({ backgroundMessage: 'Checking background location access', backgroundTitle: BR.name, requestPermissions: true, distanceFilter: 500 }, () => { }); setTimeout(() => B.removeWatcher({ id }).catch(() => { }), 2500); }
const openAppSettings = () => { try { CP.BackgroundGeolocation?.openSettings(); } catch { toast('Open your phone Settings → Apps → ' + BR.name, 'warn'); } };

const APPPERMS = [
  { k: 'push', ic: '🔔', t: 'Notifications', why: 'Duty reminders, late and missed check-out alerts, approvals and announcements — even when the app is closed.', need: ['Duty reminders', 'Approvals', 'Alerts'] },
  { k: 'location', ic: '📍', t: 'Location (while using the app)', why: 'Confirms you are at the right office or site when you check in and out. Your position is only read at that moment.', need: ['Check-in / check-out', 'Geo-fence', 'Anti-spoofing'] },
  { k: 'bgloc', ic: '🛰️', t: 'Location in the background (optional)', why: 'Only for field and sales staff who choose to share live location with HR during duty. A notification is always visible while sharing, and it stops when duty ends.', need: ['Live field tracking'], native: true },
  { k: 'camera', ic: '📷', t: 'Camera', why: 'Face check-in (blink test) and taking photos of documents. Face data stays on your device as numbers — no photo is stored.', need: ['Face attendance', 'Document upload'] },
  { k: 'reminders', ic: '⏰', t: 'On-phone reminders', why: 'Schedules your duty-start and check-out reminders on the phone itself, so they fire even with no internet.', need: ['Offline reminders'], native: true },
  { k: 'exact', ic: '⏱️', t: 'Exact alarms (Android)', why: 'Lets reminders arrive at the exact minute instead of a few minutes late.', need: ['On-time reminders'], native: true, only: 'android' },
  { k: 'bio', ic: '🔐', t: 'Fingerprint / Face ID lock', why: 'Locks the app when you switch away, so nobody else can open your payslips or HR data.', need: ['App lock'], native: true }
];
const stBadge2 = s => s === 'granted' ? '<span class="badge ok">✓ Allowed</span>' : s === 'denied' ? '<span class="badge bad">Blocked</span>' : s === 'unavailable' ? '<span class="badge">Not available</span>' : s === 'n/a' ? '' : '<span class="badge warn">Not asked yet</span>';

const PM = { st: {}, loaded: false };
async function loadPerms() { for (const p of APPPERMS) if (!(p.native && !NATIVE) && !(p.only && p.only !== NPLAT)) PM.st[p.k] = await permState(p.k); PM.loaded = true; if (location.hash.startsWith('#/permissions')) render(); }
PAGE_FN.permissions = () => {
  if (!PM.loaded) loadPerms(); const u = me(), cons = (DB.consents ||= {})[u.id] || {}, dev = NV.info;
  const list = APPPERMS.filter(p => !(p.native && !NATIVE) && !(p.only && p.only !== NPLAT));
  return head('App permissions', NATIVE ? 'What this app can use on your phone — you stay in control' : 'What this browser has allowed') + `<div class="card flat" style="margin-bottom:14px;background:var(--accent-soft)"><b>🔒 Your privacy</b> <span class="small">We only ask for what a feature needs, explain why first, and you can switch any of it off in your phone settings at any time. Location is never read when you are off duty unless you started live sharing.</span></div>
  <div class="col" style="gap:12px">${list.map(p => { const s = PM.st[p.k]; return `<div class="card permc"><div class="row" style="gap:14px;align-items:flex-start"><span class="int-ic">${p.ic}</span><div style="flex:1;min-width:0"><div class="row between wrap" style="gap:8px"><b>${p.t}</b>${s ? stBadge2(s) : '<span class="badge">…</span>'}</div><div class="muted small" style="margin:4px 0 8px">${p.why}</div><div class="row wrap" style="gap:6px">${p.need.map(n => `<span class="chip-b" style="font-family:inherit;color:var(--muted)">${n}</span>`).join('')}</div></div></div>
   <div class="row wrap" style="gap:8px;margin-top:12px">${s === 'granted' && p.k !== 'bio' ? '<button class="btn sm" disabled>Allowed</button>' : s === 'denied' && p.k === 'exact' ? `<button class="btn primary sm" data-act="perm_ask" data-k="exact">Allow exact alarms</button>` : s === 'denied' ? `<button class="btn primary sm" data-act="perm_settings">Open phone settings</button>` : s === 'unavailable' || s === 'n/a' ? '' : `<button class="btn primary sm" data-act="perm_ask" data-k="${p.k}">${p.k === 'bio' ? 'Check' : 'Allow'}</button>`}${p.k === 'bio' && s === 'granted' ? `<label class="row" style="gap:8px;cursor:pointer"><span class="sw"><input type="checkbox" data-chg="perm_lock" ${nvPrefs().lock ? 'checked' : ''}><span></span></span><span class="small">Lock the app when I switch away</span></label>` : ''}${p.k === 'push' && s === 'granted' ? '<button class="btn sm" data-act="perm_test">Send me a test notification</button>' : ''}${p.k === 'bgloc' ? `<button class="btn sm ghost" data-act="perm_settings">Choose “Allow all the time”</button>` : ''}${p.k === 'exact' && s === 'denied' ? '' : ''}</div></div>`; }).join('')}</div>
  <div class="grid g2" style="margin-top:16px;align-items:start"><div class="card"><header><h3>Your consents</h3></header><div class="list small">${[['location', 'Location at check-in / check-out'], ['tracking', 'Live location sharing during duty'], ['face', 'Face recognition for attendance']].map(([k, l]) => `<div class="row"><span style="flex:1">${l}</span>${cons[k] ? `<span class="badge ok">Given ${fmtDate(new Date(cons[k].ts).toISOString().slice(0, 10))}</span> <button class="btn sm ghost" data-act="consent_off" data-k="${k}">Withdraw</button>` : '<span class="badge">Not given</span>'}</div>`).join('')}</div><div class="muted small" style="margin-top:10px">Consent is recorded with date and version for audit (DPDP Act). Withdrawing stops that feature for you; HR may then use manual attendance.</div></div>
  <div class="card"><header><h3>${NATIVE ? 'This app' : 'This browser'}</h3></header><div class="list small"><div class="row"><span style="flex:1">Platform</span><b>${NATIVE ? (NPLAT === 'ios' ? 'iPhone / iPad' : 'Android') : 'Web / PWA'}${dev ? ' · ' + esc(dev.model || '') : ''}</b></div>${NATIVE ? `<div class="row"><span style="flex:1">App version</span><b>${esc(ORBIT_NATIVE_CFG.version || '1.0')}</b></div><div class="row"><span style="flex:1">Server</span><b style="word-break:break-all">${esc(ORBIT_BASE || location.origin)}</b></div><div class="row"><span style="flex:1">Push registered</span><b>${NV.reg ? '✓ Yes' : 'Not yet'}</b></div>` : ''}</div><div class="row wrap" style="gap:8px;margin-top:12px">${NATIVE ? '<button class="btn sm" data-act="perm_settings">Phone settings for this app</button><button class="btn sm ghost danger" data-act="change_server">Change server</button>' : '<button class="btn sm" data-act="pwa_install">Install as an app</button>'}<button class="btn sm" data-act="perm_wizard">Run setup again</button></div></div></div>`;
};
ACT.perm_ask = async el => { const k = el.dataset.k; el.disabled = true; PM.st[k] = await permAsk(k); if (PM.st[k] === 'denied') toast('That permission is blocked — use “Open phone settings”', 'warn'); else if (PM.st[k] === 'granted') toast('Allowed ✓'); loadPerms(); };
ACT.perm_settings = openAppSettings;
CHG.perm_lock = el => { nvPrefs().lock = el.checked; save(); toast(el.checked ? 'App lock is on' : 'App lock is off'); };
ACT.perm_test = async () => { try { const r = await API.post('/api/device/test', { emp: me().id }); if (NATIVE && !r.configured) toast('Server push (Firebase) is not set up yet — ask your admin', 'warn'); else if (r.delivered) toast('Sent — it should arrive in a few seconds'); else if (NATIVE) toast('Nothing delivered — is this phone registered?', 'warn'); else { new Notification(BR.name, { body: 'Notifications work ✅' }); } } catch { toast('Could not reach the server', 'err'); } };
ACT.consent_off = el => { const c = (DB.consents ||= {})[me().id] || {}; delete c[el.dataset.k]; if (el.dataset.k === 'tracking') stopSharing?.(); log('Withdrew consent: ' + el.dataset.k); save(); render(); toast('Consent withdrawn'); };
const giveConsent = k => { const c = (DB.consents ||= {})[me().id] ||= {}; c[k] = { ts: Date.now(), v: 1, platform: NPLAT }; log('Consent given: ' + k); save(); };

/* ---- first-run set-up: explain, then ask one thing at a time ---- */
const WIZ = [['push', '🔔', 'Stay on schedule', 'Get a nudge before your duty starts and an alert if you forget to check out.', 'Allow notifications'], ['location', '📍', 'Check in from the right place', 'We read your location only at the moment you check in or out, to confirm you are at your office or site.', 'Allow location'], ['camera', '📷', 'Face check-in', 'Used for the blink test when your company requires face attendance. Nothing is uploaded as a photo.', 'Allow camera'], ['bio', '🔐', 'Protect your data', 'Lock the app with your fingerprint or face when you switch away.', 'Turn on app lock']];
function permWizard(i = 0) {
  document.querySelector('.modal-bg.wiz')?.remove(); const steps = WIZ.filter(w => !(w[0] === 'bio' && !NATIVE)); if (i >= steps.length) { localStorage.setItem('orbit_perm_done_' + me().id, '1'); return toast('All set — you can change these anytime in App permissions'); }
  const [k, icon, title, text, btn] = steps[i], m = modal('', `<div class="tc" style="padding:8px 4px"><div style="font-size:54px">${icon}</div><div class="muted small" style="margin:4px 0">Step ${i + 1} of ${steps.length}</div><h2 style="margin:6px 0 8px">${title}</h2><p class="muted" style="margin:0 0 18px">${text}</p><button class="btn primary big" id="wzGo" style="width:100%">${btn}</button><button class="btn ghost" id="wzSkip" style="width:100%;margin-top:6px">Not now</button></div>`, null); m.classList.add('wiz');
  $('#wzGo', m).onclick = async () => { $('#wzGo', m).disabled = true; if (k === 'bio') { const s = await permState('bio'); if (s === 'granted') { try { await CP.BiometricAuthNative.internalAuthenticate({ reason: 'Turn on app lock', allowDeviceCredential: true }); nvPrefs().lock = true; save(); toast('App lock is on'); } catch { } } else toast('This phone has no fingerprint or Face ID set up', 'warn'); } else { const r = await permAsk(k); if (k === 'location' && r === 'granted') giveConsent('location'); if (k === 'camera' && r === 'granted') giveConsent('face'); if (r === 'denied') toast('Blocked — you can allow it later in App permissions', 'warn'); } m.remove(); permWizard(i + 1); };
  $('#wzSkip', m).onclick = () => { m.remove(); permWizard(i + 1); };
}
ACT.perm_wizard = () => permWizard(0);
let _wizOnce = false; setInterval(() => { if (SESSION && !_wizOnce && (NATIVE || PWA?.installed) && !localStorage.getItem('orbit_perm_done_' + SESSION.id)) { _wizOnce = true; setTimeout(() => permWizard(0), 1500); } }, 4000);

/* ================= push (FCM / APNs) ================= */
async function ensureChannels() { if (NPLAT !== 'android') return; try { await CP.PushNotifications.createChannel({ id: 'duty', name: 'Duty & attendance', description: 'Duty reminders and check-in alerts', importance: 5, visibility: 1, vibration: true }); await CP.PushNotifications.createChannel({ id: 'general', name: 'General', description: 'Approvals and announcements', importance: 3, visibility: 1 }); await CP.LocalNotifications.createChannel({ id: 'duty', name: 'Duty reminders', importance: 5, vibration: true }); } catch { } }
async function nativePushRegister() {
  const P = CP.PushNotifications; if (!P) throw new Error('Push is not available in this build'); if (NPLAT === 'android' && !ORBIT_NATIVE_CFG.fcm) throw new Error('Push alerts need Firebase set up for this build — duty reminders still work on the phone'); let s = await P.checkPermissions(); if (s.receive === 'prompt' || s.receive === 'prompt-with-rationale') s = await P.requestPermissions(); if (s.receive !== 'granted') throw new Error('Notification permission was not granted');
  await ensureChannels(); await P.register(); nvPrefs().push = true; save();
}
async function sendToken() { if (!SESSION || !NV.tok) return; try { await API.post('/api/device/register', { emp: me().id, role: me().role, token: NV.tok, platform: NPLAT, app: ORBIT_NATIVE_CFG.version }); NV.reg = true; NV.regFor = me().id; } catch { } }
function nativeBoot() {
  const P = CP.PushNotifications; if (P) {
    P.addListener('registration', t => { NV.tok = t.value; sendToken(); }); P.addListener('registrationError', e => toast('Push registration failed: ' + (e.error || ''), 'err'));
    P.addListener('pushNotificationReceived', n => { onAlert({ title: n.title, body: n.body, tag: n.id, to: me()?.id }); });
    P.addListener('pushNotificationActionPerformed', a => { const u = a.notification?.data?.url; if (u && u.includes('#')) location.hash = u.replace(/^.*#/, '#'); });
  }
  CP.LocalNotifications?.addListener('localNotificationActionPerformed', a => { const u = a.notification?.extra?.url; if (u) location.hash = u.replace(/^.*#/, '#'); });
  CP.App?.addListener('appUrlOpen', e => { const h = (e.url || '').split('#')[1]; if (h) location.hash = '#' + h; });
  CP.App?.addListener('appStateChange', ({ isActive }) => { if (!isActive) { NV.lastBg = Date.now(); return; } if (SESSION) { try { loadPublic(); offSync(); scheduleDutyReminders(); } catch { } lockCheck(); } });
  CP.App?.addListener('backButton', ({ canGoBack }) => { const m = document.querySelector('.modal-bg:not(.wiz)'); if (m) return m.remove(); if ($('#side.open')) return ACT.nav(); if (document.querySelector('.cires')) return document.querySelector('.cires').remove(); if (location.hash && !/^#\/(dashboard)?$/.test(location.hash) && canGoBack !== false) return history.back(); CP.App.minimizeApp?.(); });
  CP.Network?.addListener('networkStatusChange', s => { window.dispatchEvent(new Event(s.connected ? 'online' : 'offline')); });
  CP.Device?.getInfo().then(i => { NV.info = i; }).catch(() => { });
  try { CP.StatusBar?.setStyle({ style: 'DARK' }); if (NPLAT === 'android') CP.StatusBar?.setBackgroundColor({ color: BR.primary }); CP.StatusBar?.setOverlaysWebView?.({ overlay: false }); } catch { }
  setTimeout(() => CP.SplashScreen?.hide(), 700);
  ensureChannels();
}
if (NATIVE) { nativeBoot(); enablePush = async function () { await nativePushRegister(); await sendToken(); return true; }; disablePush = async function () { await API.post('/api/device/unregister', { emp: me().id, token: NV.tok }).catch(() => { }); nvPrefs().push = false; save(); };
  setInterval(async () => { if (!SESSION) return; if (NV.regFor && NV.regFor !== SESSION.id) NV.reg = false; if (!NV.reg && NV.tok) sendToken(); if (!NV.tok && (await permState('push')) === 'granted') nativePushRegister().catch(() => { }); }, 6000);
  const _lo = logout; logout = function () { if (NV.tok && SESSION) API.post('/api/device/unregister', { emp: SESSION.id, token: NV.tok }).catch(() => { }); NV.reg = false; try { CP.LocalNotifications?.cancel({ notifications: Array.from({ length: 80 }, (_, i) => ({ id: 1000 + i })) }); } catch { } _lo(); }; }

/* ================= exact duty reminders on the phone (work offline) ================= */
async function scheduleDutyReminders() {
  if (!NATIVE || !SESSION || nvPrefs().reminders === false) return; const L = CP.LocalNotifications; if (!L) return; try { if ((await L.checkPermissions()).display !== 'granted') return; } catch { return; }
  const u = me(), T = TODAY(), now = Date.now(), list = [], mm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, at = (d, min) => { const x = new Date(d + 'T00:00:00'); x.setMinutes(min); return x; };
  const rec = DB.att[u.id]?.[T], lead = +(nvPrefs().remindBefore || 15);
  for (let i = 0; i < 7; i++) { const d = addDays(T, i), pl = dayPlan(u, d); if (pl.t !== 'work' || !pl.shift) continue; const s = hm2m(pl.shift.start), e = hm2m(pl.shift.end), base = 1000 + i * 10;
    const add = (n, min, title, body) => { const w = at(d, min); if (w.getTime() > now + 15000) list.push({ id: base + n, title, body, schedule: { at: w, allowWhileIdle: true }, channelId: 'duty', extra: { url: '#/dashboard' }, smallIcon: 'ic_stat_icon' }); };
    if (!(i === 0 && rec?.in)) { add(1, s - lead, `⏰ Duty starts at ${pl.shift.start}`, `${pl.shift.name} begins in ${lead} minutes. Check in when you arrive.`); add(2, s + 5, '🟢 Time to check in', `Your duty started at ${pl.shift.start}.`); add(3, s + 20, '⚠️ You have not checked in', 'Check in now or add a reason.'); }
    if (!(i === 0 && rec?.out)) add(4, e, '🔔 Remember to check out', `Duty ended at ${pl.shift.end}.`); }
  try { const pend = await L.getPending(); const mine = (pend.notifications || []).filter(n => n.id >= 1000 && n.id < 1100); if (mine.length) await L.cancel({ notifications: mine.map(n => ({ id: n.id })) }); if (list.length) await L.schedule({ notifications: list }); NV.sched = list.length; } catch { }
}
if (NATIVE) { setInterval(scheduleDutyReminders, 30 * 60000); addEventListener('load', () => setTimeout(scheduleDutyReminders, 5000)); const _ci_ = typeof ciWatch === 'function' ? ciWatch : null; if (_ci_) ciWatch = function (k) { _ci_(k); setTimeout(scheduleDutyReminders, 4000); }; }

/* ================= location: precise fixes with mock-GPS detection ================= */
const _gf = getFixes;
async function nativeFixes(n = 3, timeout = 12000) {
  const B = CP.BackgroundGeolocation; if (!B) return _gf(n, timeout);
  return new Promise((res, rej) => { const out = []; let id = null, done = false; const fin = (ok, v) => { if (done) return; done = true; clearTimeout(t); if (id) B.removeWatcher({ id }).catch(() => { }); ok ? res(v) : rej(v); }; const t = setTimeout(() => out.length ? fin(true, out) : fin(false, new Error('Location request timed out')), timeout);
    B.addWatcher({ requestPermissions: true, stale: false, distanceFilter: 0 }, (loc, err) => { if (err) return fin(false, new Error(err.code === 'NOT_AUTHORIZED' ? 'Location permission was denied' : 'Location is unavailable')); out.push({ lat: loc.latitude, lng: loc.longitude, acc: loc.accuracy, alt: loc.altitude, spd: loc.speed, ts: loc.time || Date.now(), mock: !!loc.simulated }); if (out.length >= n) fin(true, out); }).then(i => { id = i; if (done) B.removeWatcher({ id }).catch(() => { }); }).catch(e => fin(false, e)); });
}
if (NATIVE) { getFixes = function (n, timeout) { return nativeFixes(n, timeout); }; const _oc = openCam; openCam = async function (v) { try { await CP.Camera?.requestPermissions({ permissions: ['camera'] }); } catch { } return _oc(v); }; }

/* ---- live tracking that keeps going in the background ---- */
if (NATIVE) {
  ACT.trk_start = () => modal('Share live location?', `<p style="margin-top:0">Your position is sent to HR${me().mgr ? ' and ' + esc(empName(me().mgr)) : ''} every ~10 seconds <b>while you are on duty</b>, even if the app is in the background. A notification stays visible the whole time, and it stops automatically 30 minutes after your duty ends — or when you press <b>Stop</b>.</p><p class="small muted">On the next screen choose <b>“Allow all the time”</b> for location.</p><label class="row"><input type="checkbox" name="ok" required> I agree to share my location during duty hours.</label>`, async () => {
    const B = CP.BackgroundGeolocation; if (!B) return toast('Background location is not available in this build', 'err') || false; giveConsent('tracking'); TR.sharing = true;
    try { TR.nid = await B.addWatcher({ backgroundTitle: `${BR.name} — sharing location`, backgroundMessage: 'Your live location is shared with HR during duty. Tap to open.', requestPermissions: true, stale: false, distanceFilter: 15 }, (loc, err) => { if (err) { if (err.code === 'NOT_AUTHORIZED') { toast('Allow location “all the time” in Settings to share in the background', 'warn'); openAppSettings(); } return; } if (Date.now() - (TR.lastSent || 0) < 9000) return; TR.lastSent = Date.now(); API.post('/api/track', { emp: me().id, name: me().name, lat: loc.latitude, lng: loc.longitude, acc: loc.accuracy }).catch(() => { }); }); localStorage.setItem('orbit_bgloc', '1'); log('Started live location sharing (background)'); render(); toast('Sharing started'); } catch (e) { TR.sharing = false; toast('Could not start: ' + e.message, 'err'); }
  }, 'Start sharing');
  const _ss = stopSharing; stopSharing = function () { if (TR.nid) { CP.BackgroundGeolocation?.removeWatcher({ id: TR.nid }).catch(() => { }); TR.nid = null; } _ss(); };
  setInterval(() => { if (TR.sharing && SESSION) { const u = me(), pl = dayPlan(u, TODAY()), end = pl.shift ? hm2m(pl.shift.end) + 30 : 24 * 60; if (nowMin() > end) { stopSharing(); render(); try { CP.LocalNotifications?.schedule({ notifications: [{ id: 999, title: 'Location sharing stopped', body: 'Your duty has ended, so live sharing was switched off.', schedule: { at: new Date(Date.now() + 500) } }] }); } catch { } } } }, 60000);
}

/* ================= biometric app lock ================= */
function lockShow() {
  if (document.getElementById('applock')) return; NV.locked = true; const el = document.createElement('div'); el.id = 'applock'; el.className = 'applock';
  el.innerHTML = `<div class="al-card">${brandMark()}<h2>${esc(BR.name)} is locked</h2><p class="muted">Use your fingerprint or face to continue</p><button class="btn primary big" id="alGo">Unlock</button><button class="btn ghost" id="alOut">Sign out</button></div>`; document.body.appendChild(el);
  const go = async () => { try { await CP.BiometricAuthNative.internalAuthenticate({ reason: 'Unlock ' + BR.name, allowDeviceCredential: true, cancelTitle: 'Cancel', androidTitle: 'Unlock ' + BR.name }); el.remove(); NV.locked = false; NV.lastBg = Date.now(); } catch { } };
  $('#alGo', el).onclick = go; $('#alOut', el).onclick = () => { el.remove(); NV.locked = false; logout(); }; go();
}
function lockCheck(cold) { if (!NATIVE || !SESSION || !nvPrefs().lock || NV.locked || !CP.BiometricAuthNative) return; if (cold || Date.now() - NV.lastBg > 45000) lockShow(); }
if (NATIVE) addEventListener('load', () => setTimeout(() => lockCheck(true), 800));

/* ================= share-sheet downloads (WebViews cannot save blobs) ================= */
async function nativeSave(name, text, mime) {
  try { const w = await CP.Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' }); await CP.Share.share({ title: name, url: w.uri, dialogTitle: 'Save or share' }); } catch (e) { if (!/cancel/i.test(String(e.message || e))) toast('Could not share the file', 'err'); }
}
if (NATIVE) {
  const _dl = download; download = function (name, text, mime) { if (CP.Filesystem && CP.Share) return nativeSave(name, text, mime); return _dl(name, text, mime); };
  const _pl = printLetter; printLetter = function (html, title) { if (!CP.Filesystem) return _pl(html, title); nativeSave((title || 'letter').replace(/[^\w ]+/g, '').trim().replace(/\s+/g, '-') + '.html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{margin:16px;background:#fff}${LTR_CSS}.ltr-sheet{box-shadow:none;max-width:none}</style></head><body>${html}</body></html>`, 'text/html'); toast('Open the file and use Print → Save as PDF'); };
  const _pd = polDownload; polDownload = function (p, kind) { if ((kind === 'pdf' || kind === 'auto') && !p.file) kind = 'txt'; return _pd(p, kind); };
  const _cs = ciSheet; ciSheet = function (k) { try { CP.Haptics?.notification({ type: 'SUCCESS' }); } catch { } return _cs(k); };
}

/* ================= bottom tab bar (phones and the apps) ================= */
const TABS = () => { const hr = isHR() || isMgr(); return [['dashboard', 'Home', 'home'], ['attendance', 'Attendance', 'clock'], ['leave', 'Leave', 'calendar'], [hr ? 'alerts' : 'documents', hr ? 'Alerts' : 'Policies', hr ? 'bell' : 'file'], ['__menu', 'Menu', 'menu']]; };
function renderTabbar() {
  const show = SESSION && innerWidth <= 900 && !document.querySelector('.login'); let el = document.getElementById('tabbar'); if (!show) { el?.remove(); document.body.classList.remove('has-tabbar'); return; }
  if (!el) { el = document.createElement('nav'); el.id = 'tabbar'; el.className = 'tabbar'; el.setAttribute('aria-label', 'Quick navigation'); document.body.appendChild(el); }
  const cur = location.hash.split('/')[1] || 'dashboard', badge = id => id === 'leave' ? pendingCount() : 0;
  el.innerHTML = TABS().map(([id, l, i]) => `<a href="${id === '__menu' ? '#' : '#/' + id}" class="${cur === id ? 'on' : ''}" ${id === '__menu' ? 'data-act="menu"' : ''}>${ic(i)}<span>${l}</span>${badge(id) ? `<b class="tb-n">${badge(id)}</b>` : ''}</a>`).join(''); document.body.classList.add('has-tabbar');
}
{ const _r = render; render = function () { _r(); try { renderTabbar(); if (NATIVE) nativeAfter(); } catch { } }; }
addEventListener('resize', () => renderTabbar()); addEventListener('hashchange', () => setTimeout(renderTabbar, 30));
function nativeAfter() { $$('#view .muted.small').forEach(n => { if (/Only while this tab stays open/.test(n.textContent)) n.textContent = 'Keeps working in the background (a notification shows while sharing) until you stop, or your duty ends.'; }); }
document.addEventListener('click', e => { const a = e.target.closest?.('a.btn[href^=http],a[target=_blank]'); if (NATIVE && a && /^https?:/.test(a.href) && CP.Browser) { e.preventDefault(); CP.Browser.open({ url: a.href }); } });

PAGES.splice(PAGES.findIndex(p => p[0] === 'documents') + 1, 0, ['permissions', 'App permissions', 'shield']);

document.head.insertAdjacentHTML('beforeend', `<style>
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}body{-webkit-tap-highlight-color:transparent;overscroll-behavior-y:none}
button,a,.btn,.sitem a,.tabbar a,[data-act]{touch-action:manipulation}
html.is-native body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}html.is-native input,html.is-native textarea,html.is-native [contenteditable],html.is-native .ltr-sheet,html.is-native .polread:not(.nocopy){-webkit-user-select:text;user-select:text}
@supports (height:100dvh){.shell{min-height:100dvh}.side{height:100dvh}}
@media(max-width:900px){
 input,select,textarea{font-size:16px!important}
 .top{padding-top:calc(env(safe-area-inset-top,0px) + 10px)!important;position:sticky;top:0;z-index:35;background:var(--surface);border-bottom:1px solid var(--line)}
 .side{padding-top:env(safe-area-inset-top,0px)!important}
 .view{padding-left:max(16px,env(safe-area-inset-left,0px))!important;padding-right:max(16px,env(safe-area-inset-right,0px))!important;padding-bottom:calc(92px + env(safe-area-inset-bottom,0px))!important}
 .btn,.icon-btn,.tabs button,select,.sitem a{min-height:42px}
 .modal{max-height:calc(100dvh - 32px);border-radius:22px}
 .toast,#toasts{bottom:calc(86px + env(safe-area-inset-bottom,0px))!important}
 body.has-tabbar .fab,body.has-tabbar .netbar,body.has-tabbar .pwabar{bottom:calc(76px + env(safe-area-inset-bottom,0px))!important}
 body.has-tabbar .fab{right:16px}
}
.tabbar{position:fixed;left:0;right:0;bottom:0;z-index:55;display:flex;justify-content:space-around;padding:6px 6px calc(6px + env(safe-area-inset-bottom,0px));background:color-mix(in srgb,var(--surface) 88%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--line)}
.tabbar a{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;border-radius:14px;color:var(--muted);font-size:10.5px;font-weight:600;text-decoration:none;transition:color .15s,background .15s,transform .12s}
.tabbar a svg{width:22px;height:22px}.tabbar a.on{color:var(--accent)}.tabbar a.on svg{transform:translateY(-1px) scale(1.08)}.tabbar a:active{transform:scale(.93);background:var(--accent-soft)}
.tb-n{position:absolute;top:2px;left:calc(50% + 6px);background:#f59e0b;color:#1a1200;border-radius:99px;font-size:9px;padding:0 5px;min-width:15px;text-align:center}
@media(min-width:901px){.tabbar{display:none}}
.srvsetup,.applock{position:fixed;inset:0;z-index:300;display:grid;place-items:center;padding:20px;background:radial-gradient(1000px 500px at 50% -10%,color-mix(in srgb,var(--accent) 25%,var(--bg)),var(--bg))}.applock{backdrop-filter:blur(22px);background:color-mix(in srgb,var(--bg) 92%,transparent)}
.srv-card,.al-card{width:min(400px,100%);text-align:center;padding:30px 24px;border-radius:26px;background:var(--surface);border:1px solid var(--line);box-shadow:0 30px 70px -30px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:10px;align-items:stretch}.al-card .logo{margin:0 auto;width:60px;height:60px}
.permc .int-ic{flex:none}
</style>`);
