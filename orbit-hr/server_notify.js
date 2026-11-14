'use strict';
/* Orbit HRMS — notification control centre (everything here is set from the admin panel → Notifications).
   • Which reminders are sent, their wording and timing; quiet hours; per-channel on/off (browser, Android, iPhone)
   • Firebase app file (google-services.json) kept on the server so app builds can fetch it — no file copying by hand
   • Send a message to everyone, a role, a department, a branch or one person
   • Devices registered for push, and a delivery log
   Channels: browsers + installed web app → Web Push (VAPID) · Android app → Firebase Cloud Messaging · iPhone app → Apple Push (APNs). */
const fs = require('fs'), path = require('path');

module.exports = function (DATA, json, X) {
  const file = path.join(DATA, 'notify.json'), fbDir = path.join(DATA, 'firebase'), gsFile = path.join(fbDir, 'google-services.json');
  const DEF = {
    channels: { web: true, android: true, ios: true },
    quiet: { on: false, from: '22:00', to: '06:00' },
    timing: { lateEvery: 10, lateMax: 6, outEvery: 15, outMax: 6, missedAfter: 120 },
    events: {
      pre: { on: true, to: 'Employee', label: 'Before duty starts', title: '⏰ Duty starts at {start}', body: 'Starts in {mins} min — check in when you arrive.' },
      start: { on: true, to: 'Employee', label: 'Duty has started', title: '🟢 Your duty has started', body: 'Please check in now.' },
      late: { on: true, to: 'Employee', label: 'Not checked in (repeats)', title: '⚠ You have not checked in', body: 'Duty began at {start} — you are {mins} min late.' },
      lateHR: { on: true, to: 'HR + manager', label: 'Someone has not checked in', title: '⚠ {name} has not checked in', body: 'Shift started {start} ({mins} min ago).' },
      out: { on: true, to: 'Employee', label: 'Check-out reminder (repeats)', title: '🔔 Remember to check out', body: 'Duty ended at {end} ({mins} min ago).' },
      missedHR: { on: true, to: 'HR + manager', label: 'Someone missed check-out', title: '🕒 {name} missed check-out', body: 'Shift ended {end} and no check-out is recorded.' }
    }
  };
  const clone = o => JSON.parse(JSON.stringify(o)), str = (v, n) => String(v ?? '').slice(0, n), num = (v, d, lo, hi) => { v = Math.round(+v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const hmOk = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '');
  let C = clone(DEF); try { merge(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { }
  function merge(n) {
    if (!n || typeof n !== 'object') return;
    if (n.channels) for (const k of Object.keys(DEF.channels)) if (k in n.channels) C.channels[k] = !!n.channels[k];
    if (n.quiet) { if ('on' in n.quiet) C.quiet.on = !!n.quiet.on; if (hmOk(n.quiet.from)) C.quiet.from = n.quiet.from; if (hmOk(n.quiet.to)) C.quiet.to = n.quiet.to; }
    if (n.timing) { const t = n.timing, T = C.timing; if ('lateEvery' in t) T.lateEvery = num(t.lateEvery, 10, 5, 120); if ('lateMax' in t) T.lateMax = num(t.lateMax, 6, 1, 50); if ('outEvery' in t) T.outEvery = num(t.outEvery, 15, 5, 120); if ('outMax' in t) T.outMax = num(t.outMax, 6, 1, 50); if ('missedAfter' in t) T.missedAfter = num(t.missedAfter, 120, 15, 720); }
    if (n.events) for (const k of Object.keys(DEF.events)) { const e = n.events[k]; if (!e) continue; if ('on' in e) C.events[k].on = !!e.on; if (typeof e.title === 'string' && e.title.trim()) C.events[k].title = str(e.title.trim(), 90); if (typeof e.body === 'string' && e.body.trim()) C.events[k].body = str(e.body.trim(), 240); }
  }
  const saveCfg = () => { const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(C)); fs.renameSync(tmp, file); };
  const fill = (t, v) => String(t).replace(/\{(name|start|end|mins)\}/g, (_, k) => v[k] ?? '');

  /* used by the reminder scheduler and the push sender in server.js */
  const text = (key, vars) => { const e = C.events[key]; if (!e || !e.on) return null; return { title: fill(e.title, vars), body: fill(e.body, vars) }; };
  const inQuiet = (d = new Date()) => { if (!C.quiet.on) return false; const m = d.getHours() * 60 + d.getMinutes(), hm = t => { const [h, x] = t.split(':').map(Number); return h * 60 + x; }, a = hm(C.quiet.from), b = hm(C.quiet.to); return a === b ? false : a < b ? (m >= a && m < b) : (m >= a || m < b); };
  const muted = reason => (reason === 'employee' || reason === 'hr') && inQuiet();
  const ch = k => C.channels[k] !== false;

  /* ---------- Firebase app file ---------- */
  function gsInfo() { try { const j = JSON.parse(fs.readFileSync(gsFile, 'utf8')); return { present: true, projectId: j.project_info?.project_id || '', packages: (j.client || []).map(c => c.client_info?.android_client_info?.package_name).filter(Boolean), at: fs.statSync(gsFile).mtimeMs }; } catch { return { present: false, projectId: '', packages: [] }; } }
  function gsSave(txt) {
    let j; try { j = JSON.parse(String(txt)); } catch { throw new Error('That is not a valid JSON file. Download google-services.json again from Firebase and upload it unchanged.'); }
    if (j.type === 'service_account' || j.private_key) throw new Error('This is the service-account key, not google-services.json. Paste the service-account key into the “Server key” box instead.');
    if (!j.project_info?.project_id || !Array.isArray(j.client) || !j.client.some(c => c.client_info?.android_client_info?.package_name)) throw new Error('This file has no Android app in it. In Firebase: Project settings → Your apps → Android → download google-services.json.');
    fs.mkdirSync(fbDir, { recursive: true }); fs.writeFileSync(gsFile, JSON.stringify(j, null, 2)); return gsInfo();
  }

  /* ---------- status ---------- */
  function devices() {
    const names = Object.fromEntries(X.people().map(e => [e.id, e.name])), out = [];
    for (const [emp, rec] of Object.entries(X.ST.subs || {})) for (const s of rec.list || []) { let host = ''; try { host = new URL(s.endpoint).host; } catch { } out.push({ emp, name: names[emp] || emp, channel: 'web', platform: /apple/.test(host) ? 'Safari / iPhone web app' : /google|fcm/.test(host) ? 'Chrome / Android browser' : /mozilla/.test(host) ? 'Firefox' : /windows|microsoft/.test(host) ? 'Edge' : 'Browser', id: 'w:' + str(s.endpoint, 500).slice(-24), ts: s.ts || 0 }); }
    for (const [emp, rec] of Object.entries(X.ST.devices || {})) for (const d of rec.list || []) out.push({ emp, name: names[emp] || emp, channel: d.platform === 'ios' ? 'ios' : 'android', platform: d.platform === 'ios' ? 'iPhone app' : 'Android app', id: 'n:' + str(d.token, 400).slice(-24), ts: d.ts || 0 });
    return out.sort((a, b) => b.ts - a.ts);
  }
  function state() {
    const dv = devices(), n = k => dv.filter(d => d.channel === k).length, iv = X.cfg.iv, sv = X.cfg.sv, en = X.cfg.enabled, gs = gsInfo();
    const fcmReady = en('fcm') && !!sv('fcm', 'privateKey') && !!iv('fcm', 'projectId') && !!iv('fcm', 'clientEmail'), apnsReady = en('apns') && !!sv('apns', 'privateKey') && !!iv('apns', 'keyId') && !!iv('apns', 'teamId') && !!iv('apns', 'bundleId');
    return { cfg: C, defaults: DEF, quietNow: inQuiet(), devices: dv.slice(0, 500), log: (X.ST.plog || []).slice(0, 80),
      channels: {
        web: { ready: X.webpushOn(), on: ch('web'), devices: n('web') },
        android: { ready: fcmReady, on: ch('android'), devices: n('android'), serverKey: !!sv('fcm', 'privateKey'), enabled: en('fcm'), projectId: iv('fcm', 'projectId') || '', appFile: gs, mismatch: !!(gs.present && iv('fcm', 'projectId') && gs.projectId !== iv('fcm', 'projectId')) },
        ios: { ready: apnsReady, on: ch('ios'), devices: n('ios'), enabled: en('apns'), bundleId: iv('apns', 'bundleId') || '' }
      } };
  }
  function audience(a) {
    const all = X.people().filter(e => e.status !== 'Exited'), [kind, val] = String(a || 'all').split(':');
    if (kind === 'all') return all; if (kind === 'role') return all.filter(e => e.role === val); if (kind === 'dept') return all.filter(e => e.dept === val); if (kind === 'branch') return all.filter(e => (e.branch || '') === val); if (kind === 'emp') return all.filter(e => e.id === val); return [];
  }
  const readBody = (req, max = 4e5) => new Promise(r => { let s = '', big = false; req.on('data', c => { if (big) return; s += c; if (s.length > max) { big = true; s = ''; } }); req.on('end', () => { if (big) return r(null); try { r(JSON.parse(s || '{}')); } catch { r({}); } }); req.on('error', () => r(null)); });

  async function handle(req, res, u, p) {
    if (!p.startsWith('/api/notif/')) return false; const act = p.slice(11), POST = req.method === 'POST', GET = req.method === 'GET';
    const me = X.who(req), admin = !!(me && me.priv) || X.cfg.adminOk(req);
    if (act === 'firebase/google-services.json' && GET) {   /* fetched by the app build (npm run setup) with the admin key */
      if (!admin) return json(res, 401, { error: 'Admin sign-in or admin key required.' }), true; if (!fs.existsSync(gsFile)) return json(res, 404, { error: 'No google-services.json has been uploaded yet.' }), true;
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="google-services.json"' }); return res.end(fs.readFileSync(gsFile)), true;
    }
    if (act === 'test' && POST) {   /* anyone signed in can test their own devices */
      if (!me && !admin) return json(res, 401, { error: 'Please sign in again.' }), true; const b = await readBody(req) || {}, id = admin && b.emp ? str(b.emp, 20) : me?.id; if (!id) return json(res, 400, { error: 'Choose a person.' }), true;
      const mine = devices().filter(d => d.emp === id), n = await X.sendPush([id], { title: 'Test notification', body: 'Notifications are working on this device ✅', tag: 'test-' + Date.now(), url: '/#/alerts' }, 'test');
      return json(res, 200, { delivered: n, devices: mine.length, hint: !mine.length ? 'This person has no device registered for notifications yet. They must open the app, sign in and allow notifications.' : n ? '' : 'A device is registered but nothing was delivered. Check the channel is switched on and its keys are saved.' }), true;
    }
    if (!admin) return json(res, 403, { error: 'Only HR or an administrator can manage notifications.' }), true;
    if (act === 'state' && GET) return json(res, 200, state()), true;
    if (act === 'config' && POST) { const b = await readBody(req); if (!b) return json(res, 413, { error: 'too large' }), true; if (b.reset) C = clone(DEF); else merge(b); saveCfg(); return json(res, 200, state()), true; }
    if (act === 'firebase' && POST) { const b = await readBody(req, 2e5); if (!b) return json(res, 413, { error: 'That file is too large to be google-services.json.' }), true; try { gsSave(b.googleServices); } catch (e) { return json(res, 400, { error: e.message }), true; } return json(res, 200, state()), true; }
    if (act === 'firebase' && req.method === 'DELETE') { try { fs.unlinkSync(gsFile); } catch { } return json(res, 200, state()), true; }
    if (act === 'send' && POST) {
      const b = await readBody(req) || {}, title = str(b.title, 90).trim(), body = str(b.body, 240).trim(); if (title.length < 2 || body.length < 2) return json(res, 400, { error: 'Write a title and a message.' }), true;
      const list = audience(b.audience), ids = list.map(e => e.id); if (!ids.length) return json(res, 400, { error: 'Nobody matches that audience.' }), true;
      const payload = { title, body, tag: 'msg-' + Date.now(), url: '/#/notifications' }; X.note(ids, `📣 ${title} — ${body}`);   /* the in-app copy reaches every device through the database sync */
      const delivered = await X.sendPush(ids, payload, 'broadcast'); return json(res, 200, { people: ids.length, delivered }), true;
    }
    if (act === 'device/remove' && POST) {
      const b = await readBody(req) || {}, emp = str(b.emp, 20), id = str(b.id, 40); let n = 0;
      const s = X.ST.subs?.[emp]; if (s && id.startsWith('w:')) { const k = s.list.length; s.list = s.list.filter(x => 'w:' + str(x.endpoint, 500).slice(-24) !== id); n += k - s.list.length; }
      const d = X.ST.devices?.[emp]; if (d && id.startsWith('n:')) { const k = d.list.length; d.list = d.list.filter(x => 'n:' + str(x.token, 400).slice(-24) !== id); n += k - d.list.length; }
      X.persist(); return json(res, 200, { removed: n, ...state() }), true;
    }
    return json(res, 404, { error: 'not found' }), true;
  }
  return { handle, text, muted, ch, timing: () => C.timing };
};
