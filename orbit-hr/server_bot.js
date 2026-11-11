'use strict';
/* Orbit HRMS server extras: installable-app manifest + icons, offline-punch verification, WhatsApp bot (webhooks, commands, approvals), AI assistant proxy. */
const zlib = require('zlib'), crypto = require('crypto'), http2 = require('http2');

/* ---------- tiny PNG writer (no dependencies) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
function pngEncode(w, h, rgba) { const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]); }
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
/* brand-coloured rounded square with a stylised building; `full` = no rounded corners (maskable) */
function iconPng(size, brand, full) {
  const S = size, buf = Buffer.alloc(S * S * 4), [pr, pg, pb] = hex(brand.primary || '#17406f'), [ar, ag, ab] = hex(brand.accent2 || '#c9a24b'), rad = full ? 0 : S * .22, pad = full ? S * .24 : S * .2;
  const put = (x, y, r, g, b, a = 255) => { if (x < 0 || y < 0 || x >= S || y >= S) return; const i = (y * S + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a; };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { let inside = true; if (rad) { const cx = x < rad ? rad : x > S - rad ? S - rad : x, cy = y < rad ? rad : y > S - rad ? S - rad : y; inside = (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad; } if (inside) put(x, y, pr, pg, pb); }
  const rect = (x0, y0, x1, y1, r, g, b) => { for (let y = Math.round(y0); y < Math.round(y1); y++) for (let x = Math.round(x0); x < Math.round(x1); x++) put(x, y, r, g, b); };
  const L = pad, R = S - pad, B = S - pad, T = pad, w = R - L, tw = w * .56, tx = L + w * .06;
  rect(tx, T, tx + tw, B, 255, 255, 255);                                  /* tall tower */
  rect(tx + tw + w * .06, T + (B - T) * .36, R, B, 255, 255, 255);        /* low wing */
  rect(tx, T, tx + tw, T + (B - T) * .07, ar, ag, ab);                    /* gold cap */
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) rect(tx + tw * (.16 + c * .46), T + (B - T) * (.16 + r * .17), tx + tw * (.16 + c * .46) + tw * .22, T + (B - T) * (.16 + r * .17) + (B - T) * .09, pr, pg, pb);
  for (let r = 0; r < 2; r++) rect(tx + tw + w * .06 + w * .08, T + (B - T) * (.5 + r * .2), tx + tw + w * .06 + w * .08 + w * .12, T + (B - T) * (.5 + r * .2) + (B - T) * .09, pr, pg, pb);
  return pngEncode(S, S, buf);
}

module.exports = function init(A, ctx) {
  const { json, ST, persist, verify, getPush } = ctx; ST.devices ||= {}; ST.snap ||= { at: 0, emps: {}, holidays: [] }; ST.wacmd ||= []; ST.wast ||= {}; ST.walog ||= [];
  const readRaw = (req, max = 4e5) => new Promise(r => { let s = '', over = false; req.on('data', c => { s += c; if (s.length > max) { over = true; req.destroy(); } }); req.on('end', () => r(over ? null : s)); req.on('error', () => r(null)); });
  const readJson = async (req, max) => { const s = await readRaw(req, max); if (s === null) return null; try { return JSON.parse(s || '{}'); } catch { return {}; } };
  const rate = new Map(); const limited = (k, n, ms) => { const now = Date.now(), a = (rate.get(k) || []).filter(t => now - t < ms); if (a.length >= n) { rate.set(k, a); return true; } a.push(now); rate.set(k, a); return false; };
  const iconCache = new Map();
  const digits = s => String(s || '').replace(/\D/g, '').slice(-10);
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  /* ---------- WhatsApp conversation ---------- */
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const addD = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
  function parseDate(t) {
    t = t.trim().toLowerCase(); const T = todayStr(); if (t === 'today') return T; if (t === 'tomorrow' || t === 'tmrw') return addD(T, 1); if (t === 'day after' || t === 'day after tomorrow') return addD(T, 2);
    let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return t; const y = +T.slice(0, 4);
    m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s*([a-z]{3})[a-z]*(?:\s+(\d{4}))?$/); if (m && MON[m[2]]) { let yy = m[3] ? +m[3] : y, s = iso(yy, MON[m[2]], +m[1]); if (!m[3] && s < T) s = iso(yy + 1, MON[m[2]], +m[1]); return s; }
    m = t.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/); if (m) { let yy = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : y; return iso(yy, +m[2], +m[1]); }
    return null;
  }
  const LT = { cl: 'CL', casual: 'CL', sl: 'SL', sick: 'SL', ill: 'SL', el: 'EL', earned: 'EL', privilege: 'EL', pl: 'EL', co: 'CO', comp: 'CO' }, LN = { CL: 'Casual leave', SL: 'Sick leave', EL: 'Earned leave', CO: 'Comp-off' };
  function parseLeave(text) {
    let s = text.replace(/^leave\b/i, '').trim(), reason = ''; const rm = s.match(/\b(?:reason|because|for)\b[:\s]+(.+)$/i); if (rm) { reason = rm[1].trim(); s = s.slice(0, rm.index).trim(); }
    let type = 'CL'; s = s.replace(/\b(cl|casual|sl|sick|ill|el|earned|privilege|pl|co|comp(?:-?off)?)\b/ig, (_, k) => { type = LT[k.toLowerCase().replace(/-?off$/, '')] || 'CL'; return ' '; }).trim();
    const parts = s.split(/\s+(?:to|till|until|-|–)\s+/i).map(x => x.trim()).filter(Boolean); if (!parts.length) return null; const a = parseDate(parts[0]); if (!a) return null; const b = parts[1] ? parseDate(parts[1]) : a; if (!b || b < a) return null;
    return { from: a, to: b, type, reason: reason || 'Applied via WhatsApp' };
  }
  const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5) + 1;
  const fd = s => { const d = new Date(s + 'T00:00:00'); return d.getDate() + ' ' + d.toLocaleString('en-IN', { month: 'short' }); };
  const MENU = n => `Hi ${n}! I'm your HR assistant. Try:\n• *balance* — leave balance\n• *today* — your attendance today\n• *leave tomorrow sick* · *leave 12 Nov to 14 Nov casual reason family event*\n• *holidays*\n• *payslip*\n• *approvals* (managers) → *approve 1* / *reject 1*\n• *help*`;
  const enqueue = (c) => { const x = { id: 'W' + crypto.randomBytes(4).toString('hex'), ts: Date.now(), status: 'pending', ...c }; ST.wacmd.push(x); if (ST.wacmd.length > 300) ST.wacmd.shift(); persist(); return x; };
  const findEmp = phone => { const d = digits(phone); return d.length >= 8 ? Object.entries(ST.snap.emps).find(([, e]) => digits(e.phone) === d) : null; };
  async function converse(phone, text) {
    text = String(text || '').trim().slice(0, 500); const hit = findEmp(phone), key = digits(phone);
    if (!hit) return 'Sorry, this number is not registered with HR. Ask HR to add your mobile number to your profile.';
    const [id, e] = hit, t = text.toLowerCase(), first = e.name.split(' ')[0], st = ST.wast[key];
    if (st && Date.now() - st.ts > 10 * 60000) delete ST.wast[key];
    if (/^(yes|y|confirm|ok)$/i.test(t) && ST.wast[key]) { const p = ST.wast[key]; delete ST.wast[key]; enqueue({ emp: id, type: p.type, data: p.data, phone }); return p.type === 'leave' ? '✅ Sent. I’ll confirm here once HR records it (it may take a few minutes).' : '✅ Done — I’ll confirm here shortly.'; }
    if (/^(no|n|cancel)$/i.test(t) && ST.wast[key]) { delete ST.wast[key]; return 'Cancelled.'; }
    if (/^(hi|hello|hey|menu|help|start|namaste)\b/.test(t)) return MENU(first);
    if (/balance|leaves? left|how many leaves?/.test(t)) return 'Your leave balance:\n' + Object.entries(e.leave || {}).map(([k, v]) => `• ${LN[k] || k}: *${v.left}* of ${v.total} left`).join('\n');
    if (/^(today|status|attendance)\b|am i checked/.test(t)) { const d = e.today || {}; return `Today (${fd(todayStr())}): *${d.s || 'not marked yet'}*${d.in ? `\nCheck-in ${d.in}${d.out ? `, check-out ${d.out}` : ''}` : ''}${d.shift ? `\nShift ${d.shift}` : ''}`; }
    if (/holiday/.test(t)) { const h = (ST.snap.holidays || []).filter(x => x[0] >= todayStr()).slice(0, 4); return h.length ? 'Upcoming holidays:\n' + h.map(x => `• ${fd(x[0])} — ${x[1]}`).join('\n') : 'No upcoming holidays on the calendar.'; }
    if (/payslip|salary|pay\s?slip/.test(t)) { if (A.iv('whatsapp', 'allowPayslip') !== 'yes') return 'For your privacy, payslips are not sent on WhatsApp. Open the app → Payroll → My payslips.'; return e.payslip ? `Payslip ${e.payslip.ym}: gross ₹${Math.round(e.payslip.gross).toLocaleString('en-IN')}, net ₹${Math.round(e.payslip.net).toLocaleString('en-IN')}.` : 'No payslip is released yet.'; }
    if (/^leave\b/.test(t)) {
      const p = parseLeave(text); if (!p) return 'I could not read the dates. Try:\n*leave tomorrow sick*\n*leave 12 Nov to 14 Nov casual reason family event*';
      const n = days(p.from, p.to), bal = e.leave?.[p.type]; if (bal && p.type !== 'EL' && n > bal.left) return `You only have ${bal.left} ${LN[p.type]} day(s) left. Pick another type (sick / earned) or fewer days.`;
      ST.wast[key] = { type: 'leave', data: p, ts: Date.now() }; return `Please confirm:\n*${LN[p.type]}* · ${fd(p.from)}${p.to !== p.from ? ' – ' + fd(p.to) : ''} (${n} day${n > 1 ? 's' : ''})\nReason: ${p.reason}\n\nReply *YES* to send or *NO* to cancel.`;
    }
    if (/^approvals?\b|^pending\b/.test(t)) { const L = e.pending || []; return L.length ? 'Waiting for you:\n' + L.slice(0, 6).map((x, i) => `${i + 1}. ${x.label}`).join('\n') + '\n\nReply *approve 1* or *reject 1 reason*.' : 'Nothing is waiting for your approval. 🎉'; }
    const dm = t.match(/^(approve|reject)\s+(\d+)\s*(.*)$/); if (dm) { const L = e.pending || [], x = L[+dm[2] - 1]; if (!x) return 'I could not find that item. Send *approvals* to see the list.'; const v = dm[1] === 'approve' ? 'Approved' : 'Rejected'; enqueue({ emp: id, type: 'decision', data: { id: x.id, kind: x.t, v, note: dm[3] || '' }, phone }); return `${v === 'Approved' ? '✅' : '❌'} ${v}: ${x.label}. I’ll confirm once it is recorded.`; }
    if (A.enabled('ai')) { try { const r = await ctx.aiAsk({ emp: id, q: text, context: `Employee ${e.name} (${e.role}, ${e.dept}). Leave balance: ${Object.entries(e.leave || {}).map(([k, v]) => k + ' ' + v.left).join(', ')}. Today: ${e.today?.s || 'n/a'}. Upcoming holidays: ${(ST.snap.holidays || []).filter(x => x[0] >= todayStr()).slice(0, 3).map(x => x[0] + ' ' + x[1]).join('; ')}.`, history: [] }); return r.slice(0, 900); } catch { } }
    return `I didn’t get that. ${MENU(first)}`;
  }
  async function reply(phone, text) { try { await A.doWa(phone, text); return true; } catch (e) { ST.walog.unshift({ ts: Date.now(), to: digits(phone), err: e.message }); ST.walog.length = 40; return false; } }

  /* ---------- native push (Firebase Cloud Messaging HTTP v1, no SDK needed) ---------- */
  let fcmTok = { t: '', exp: 0 };
  const pemFix = s => { const m = String(s).match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/); if (!m) return String(s); const b = m[2].replace(/\\n|\s+/g, ''); return `-----BEGIN ${m[1]}-----\n${b.match(/.{1,64}/g).join('\n')}\n-----END ${m[1]}-----\n`; };
  const b64u = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const fcmOn = () => A.enabled('fcm') && !!A.sv('fcm', 'privateKey') && !!A.iv('fcm', 'projectId') && !!A.iv('fcm', 'clientEmail');
  const apnsOn = () => A.enabled('apns') && !!A.sv('apns', 'privateKey') && !!A.iv('apns', 'keyId') && !!A.iv('apns', 'teamId') && !!A.iv('apns', 'bundleId');
  const nativeOn = () => fcmOn() || apnsOn();
  async function fcmAccess() {
    if (fcmTok.t && Date.now() < fcmTok.exp - 60000) return fcmTok.t; const now = Math.floor(Date.now() / 1000), key = pemFix(A.sv('fcm', 'privateKey'));
    const un = b64u({ alg: 'RS256', typ: 'JWT' }) + '.' + b64u({ iss: A.iv('fcm', 'clientEmail'), scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
    let sig; try { sig = crypto.createSign('RSA-SHA256').update(un).sign(key).toString('base64url'); } catch { throw new Error('The private key could not be read — paste it exactly as in the JSON file'); }
    const r = await A.fx('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: un + '.' + sig }) }), j = await r.json(); if (!r.ok) throw new Error(j.error_description || j.error || 'Google rejected the service account'); fcmTok = { t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 }; return fcmTok.t;
  }
  async function fcmSend(token, payload, validateOnly) {
    const at = await fcmAccess(), msg = { token, notification: { title: String(payload.title || '').slice(0, 90), body: String(payload.body || '').slice(0, 240) }, data: { url: String(payload.url || '/#/alerts'), tag: String(payload.tag || 'orbit') }, android: { priority: 'HIGH', notification: { channel_id: /check|duty|late|miss/i.test(payload.title || '') ? 'duty' : 'general', tag: String(payload.tag || 'orbit') } }, apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default' } } } };
    const r = await A.fx(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(A.iv('fcm', 'projectId'))}/messages:send`, { method: 'POST', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, validate_only: !!validateOnly }) }), j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, err: j.error };
  }
  /* ---- Apple APNs over HTTP/2 with a token-based (.p8) key ---- */
  let apnsTok = { t: '', at: 0 };
  function apnsJwt() { if (apnsTok.t && Date.now() - apnsTok.at < 50 * 60000) return apnsTok.t; const un = b64u({ alg: 'ES256', kid: A.iv('apns', 'keyId') }) + '.' + b64u({ iss: A.iv('apns', 'teamId'), iat: Math.floor(Date.now() / 1000) }); let sig; try { sig = crypto.sign('sha256', Buffer.from(un), { key: pemFix(A.sv('apns', 'privateKey')), dsaEncoding: 'ieee-p1363' }).toString('base64url'); } catch { throw new Error('The .p8 key could not be read — paste the whole file including the BEGIN/END lines'); } apnsTok = { t: un + '.' + sig, at: Date.now() }; return apnsTok.t; }
  function apnsOnce(token, payload, sandbox) {
    return new Promise((resolve, reject) => {
      const c = http2.connect('https://' + (sandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com')); let done = false; const end = (v, e) => { if (done) return; done = true; try { c.close(); } catch { } e ? reject(e) : resolve(v); }; c.on('error', e => end(null, e)); setTimeout(() => end(null, new Error('APNs timeout')), 9000).unref();
      const body = JSON.stringify({ aps: { alert: { title: String(payload.title || '').slice(0, 90), body: String(payload.body || '').slice(0, 240) }, sound: 'default', 'thread-id': String(payload.tag || 'orbit') }, url: String(payload.url || '/#/alerts') });
      const rq = c.request({ ':method': 'POST', ':path': '/3/device/' + encodeURIComponent(token), authorization: 'bearer ' + apnsJwt(), 'apns-topic': A.iv('apns', 'bundleId'), 'apns-push-type': 'alert', 'apns-priority': '10', 'content-type': 'application/json' }); let st = 0, data = ''; rq.on('response', h => { st = h[':status']; }); rq.on('data', d => { data += d; }); rq.on('end', () => { let j = {}; try { j = JSON.parse(data || '{}'); } catch { } end({ status: st, reason: j.reason || '' }); }); rq.on('error', e => end(null, e)); rq.end(body);
    });
  }
  async function apnsSend(token, payload) { const first = A.iv('apns', 'environment') === 'sandbox'; let r = await apnsOnce(token, payload, first); if (r.status === 400 && r.reason === 'BadDeviceToken') { const r2 = await apnsOnce(token, payload, !first); if (r2.status === 200) r = r2; } return { ok: r.status === 200, status: r.status, reason: r.reason }; }
  async function sendNative(emps, payload) {
    if (!nativeOn()) return 0; let n = 0;
    for (const id of emps) { const rec = ST.devices[id]; if (!rec) continue; for (const d of [...rec.list]) { try {
      if (d.platform === 'ios') { if (!apnsOn()) continue; const r = await apnsSend(d.token, payload); if (r.ok) n++; else if (r.status === 410 || ['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'].includes(r.reason)) rec.list = rec.list.filter(x => x.token !== d.token); }
      else { if (!fcmOn()) continue; const r = await fcmSend(d.token, payload); if (r.ok) n++; else if (r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(JSON.stringify(r.err || ''))) rec.list = rec.list.filter(x => x.token !== d.token); }
    } catch { } } }
    persist(); return n;
  }
  A.setApns(async () => { const r = await apnsSend('0000000000000000000000000000000000000000000000000000000000000000', { title: 'Test', body: 'Test' }); const dev = Object.values(ST.devices).reduce((n, x) => n + x.list.filter(d => d.platform === 'ios').length, 0); if (r.status === 403 || /InvalidProviderToken|ExpiredProviderToken|MissingProviderToken/.test(r.reason)) throw new Error('Apple rejected the key (' + (r.reason || r.status) + ') — check Key ID, Team ID and the .p8 file'); if (r.status === 400 || r.status === 410 || r.ok) return `Apple accepted the key · ${dev} iPhone(s) registered${r.reason && r.reason !== 'BadDeviceToken' ? ' (' + r.reason + ')' : ''}`; throw new Error('APNs returned ' + r.status + ' ' + r.reason); });
  async function sendNativeUnused() {}
  A.setFcm(async () => { if (!fcmOn() && !A.sv('fcm', 'privateKey')) throw new Error('Not configured'); await fcmAccess(); const r = await fcmSend('test-token-that-does-not-exist', { title: 'Test', body: 'Test' }, true); const people = Object.keys(ST.devices).length, dev = Object.values(ST.devices).reduce((n, r) => n + r.list.length, 0); if (r.ok || r.status === 400 || r.status === 404) return `Credentials accepted by Google · ${dev} phone(s) registered across ${people} people`; throw new Error(r.err?.message || 'FCM returned ' + r.status); });

  /* ---------- AI ---------- */
  async function aiAsk({ emp, q, context, history }) {
    const prov = A.iv('ai', 'provider'), key = A.sv('ai', 'apiKey'); if (!key) throw new Error('No API key saved'); const model = A.iv('ai', 'model'), max = +A.iv('ai', 'maxTokens') || 500, extra = A.iv('ai', 'instructions') || '';
    const sys = `You are the HR assistant for ${A.brand().name}, an Indian real-estate company. Answer the employee's question using ONLY the facts in CONTEXT. Be concise (under 120 words), friendly, use ₹ and Indian date style. If the answer is not in CONTEXT, say you are not sure and suggest asking HR or opening the relevant page. Never invent policies, numbers or dates. Never reveal other people's private data.${extra ? '\n' + extra : ''}\n\nCONTEXT:\n${String(context || '').slice(0, 14000)}`;
    const msgs = [...(Array.isArray(history) ? history : []).slice(-6).map(h => ({ role: h.r === 'a' ? 'assistant' : 'user', content: String(h.t).slice(0, 600) })), { role: 'user', content: String(q).slice(0, 800) }];
    const base = String(A.iv('ai', 'baseUrl') || (prov === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1')).replace(/\/$/, '');
    if (prov === 'anthropic') { const r = await A.fx(base + '/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model, max_tokens: max, system: sys, messages: msgs }) }, 30000), j = await r.json(); if (!r.ok) throw new Error(j.error?.message || 'AI provider ' + r.status); return (j.content || []).map(c => c.text || '').join('').trim() || '…'; }
    const r = await A.fx(base + '/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify({ model, max_tokens: max, messages: [{ role: 'system', content: sys }, ...msgs] }) }, 30000), j = await r.json(); if (!r.ok) throw new Error(j.error?.message || 'AI provider ' + r.status); return String(j.choices?.[0]?.message?.content || '').trim() || '…';
  }
  ctx.aiAsk = aiAsk;

  /* privacy: when the bot is switched off, forget the employee snapshot and queued commands */
  setInterval(() => { if (!(A.enabled('whatsapp') && A.iv('whatsapp', 'bot') === 'on') && (ST.snap.at || ST.wacmd.length)) { ST.snap = { at: 0, emps: {}, holidays: [] }; ST.wacmd = []; ST.wast = {}; persist(); } }, 15000).unref();

  async function handle(req, res, u, p) {
    /* installable app */
    if (p === '/manifest.webmanifest') { const b = A.brand(); res.writeHead(200, { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache' }); res.end(JSON.stringify({ name: `${b.name} ${b.product}`.trim(), short_name: (b.short || b.name).slice(0, 14), description: `${b.name} — attendance, leave, payroll and people in one app`, id: '/', start_url: '/?source=pwa', scope: '/', display: 'standalone', orientation: 'portrait-primary', background_color: '#ffffff', theme_color: b.primary, categories: ['business', 'productivity'], icons: [{ src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }], shortcuts: [{ name: 'Check in / out', short_name: 'Check in', url: '/#/dashboard' }, { name: 'Apply for leave', short_name: 'Leave', url: '/#/leave' }, { name: 'My payslips', short_name: 'Payslips', url: '/#/payroll' }, { name: 'Duty alerts', short_name: 'Alerts', url: '/#/alerts' }] })); return true; }
    let m = p.match(/^\/pwa\/(icon-192|icon-512|icon-1024|maskable-512)\.png$/);
    if (m) { const b = A.brand(), size = m[1] === 'icon-192' ? 192 : m[1] === 'icon-1024' ? 1024 : 512, key = m[1] + JSON.stringify([b.primary, b.accent2, b.logo.length]); let png = iconCache.get(key); if (!png) { const lg = /^data:image\/png;base64,(.+)$/.exec(b.logo || ''); png = lg && m[1] !== 'maskable-512' && size < 1024 ? Buffer.from(lg[1], 'base64') : iconPng(size, b, m[1] === 'maskable-512'); iconCache.set(key, png); if (iconCache.size > 12) iconCache.delete(iconCache.keys().next().value); } res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' }); res.end(png); return true; }

    /* mobile app: register / remove a phone for push */
    if (p === '/api/device/register' && req.method === 'POST') { const b = await readJson(req, 8e3); if (!b || !b.emp || !b.token) return json(res, 400, { error: 'bad request' }), true; const rec = ST.devices[b.emp] ||= { role: 'employee', list: [] }; rec.role = String(b.role || 'employee').slice(0, 12); rec.list = rec.list.filter(x => x.token !== b.token); rec.list.push({ token: String(b.token).slice(0, 400), platform: String(b.platform || '').slice(0, 10), app: String(b.app || '').slice(0, 20), ts: Date.now() }); if (rec.list.length > 6) rec.list.shift(); persist(); return json(res, 200, { ok: true, devices: rec.list.length, push: nativeOn() }), true; }
    if (p === '/api/device/unregister' && req.method === 'POST') { const b = await readJson(req, 4e3); const rec = b && ST.devices[b.emp]; if (rec) { rec.list = b.token ? rec.list.filter(x => x.token !== b.token) : []; persist(); } return json(res, 200, { ok: true }), true; }
    if (p === '/api/device/test' && req.method === 'POST') { const b = await readJson(req, 2e3); const n = await sendNative([b?.emp], { title: 'Test notification', body: 'Push is working on this phone ✅', tag: 'test' }); return json(res, 200, { ok: true, delivered: n, configured: nativeOn() }), true; }

    /* offline punches re-verified when the phone is back online */
    if (p === '/api/offline-punch' && req.method === 'POST') { const b = await readJson(req, 6e4); if (!b || !b.emp) return json(res, 400, { error: 'bad request' }), true; if (limited('off:' + b.emp, 30, 60000)) return json(res, 429, { error: 'slow down' }), true; const v = await verify({ ...b, offlineAt: +b.at, clientTs: +b.at }, req.socket.remoteAddress); return json(res, 200, v), true; }

    /* data snapshot used by the WhatsApp bot (only when the bot is switched on) */
    if (p === '/api/snapshot' && req.method === 'POST') { if (!(A.enabled('whatsapp') && A.iv('whatsapp', 'bot') === 'on')) return json(res, 200, { ok: false, off: true }), true; const b = await readJson(req, 3e5); if (!b || typeof b.emps !== 'object') return json(res, 400, { error: 'bad snapshot' }), true; ST.snap = { at: Date.now(), emps: b.emps, holidays: Array.isArray(b.holidays) ? b.holidays.slice(0, 30) : [] }; persist(); return json(res, 200, { ok: true, n: Object.keys(b.emps).length }), true; }
    if (p === '/api/wa/commands' && req.method === 'GET') { return json(res, 200, { cmds: ST.wacmd.filter(c => c.status === 'pending').slice(0, 20) }), true; }
    if (p === '/api/wa/ack' && req.method === 'POST') { const b = await readJson(req, 2e4), c = ST.wacmd.find(x => x.id === b?.id); if (!c) return json(res, 404, { error: 'unknown' }), true; c.status = b.ok ? 'done' : 'failed'; c.msg = String(b.msg || '').slice(0, 300); persist(); if (c.phone && c.msg) reply(c.phone, c.msg); return json(res, 200, { ok: true }), true; }

    /* WhatsApp inbound: Meta Cloud API + Twilio */
    if (p === '/api/wa/webhook') {
      if (req.method === 'GET') { const tok = A.sv('whatsapp', 'verifyToken'); if (tok && u.searchParams.get('hub.mode') === 'subscribe' && u.searchParams.get('hub.verify_token') === tok) { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(u.searchParams.get('hub.challenge') || ''); } else { res.writeHead(403); res.end('forbidden'); } return true; }
      if (req.method === 'POST') {
        const raw = await readRaw(req); if (raw === null) { res.writeHead(413); res.end(); return true; } const sec = A.sv('whatsapp', 'appSecret');
        if (sec) { const sig = String(req.headers['x-hub-signature-256'] || '').replace('sha256=', ''), good = crypto.createHmac('sha256', sec).update(raw).digest('hex'); if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) { res.writeHead(401); res.end('bad signature'); return true; } }
        res.writeHead(200); res.end('ok'); if (!(A.enabled('whatsapp') && A.iv('whatsapp', 'bot') === 'on')) return true;
        let j = {}; try { j = JSON.parse(raw); } catch { return true; }
        for (const en of j.entry || []) for (const ch of en.changes || []) for (const msg of ch.value?.messages || []) { if (msg.type !== 'text' || limited('wa:' + msg.from, 12, 60000)) continue; converse('+' + msg.from, msg.text?.body).then(r => reply('+' + msg.from, r)); }
        return true;
      }
    }
    if (p === '/api/wa/twilio' && req.method === 'POST') { const raw = await readRaw(req, 3e4), f = new URLSearchParams(raw || ''); res.writeHead(200, { 'Content-Type': 'text/xml' }); res.end('<Response/>'); if (!(A.enabled('whatsapp') && A.iv('whatsapp', 'bot') === 'on')) return true; const from = String(f.get('From') || '').replace('whatsapp:', ''); if (from && !limited('wa:' + from, 12, 60000)) converse(from, f.get('Body')).then(r => reply(from, r)); return true; }
    if (p === '/api/wa/simulate' && req.method === 'POST') { if (!A.adminOk(req)) return json(res, 401, { error: 'admin key required' }), true; const b = await readJson(req, 5e3); return json(res, 200, { reply: await converse(b?.phone, b?.text), queue: ST.wacmd.filter(c => c.status === 'pending').length }), true; }
    if (p === '/api/wa/status' && req.method === 'GET') { if (!A.adminOk(req)) return json(res, 401, { error: 'admin key required' }), true; return json(res, 200, { snapshotAt: ST.snap.at, people: Object.keys(ST.snap.emps).length, queue: ST.wacmd.filter(c => c.status === 'pending').length, recent: ST.wacmd.slice(-8).reverse().map(c => ({ id: c.id, type: c.type, status: c.status, msg: c.msg || '', ts: c.ts })), errors: ST.walog.slice(0, 5) }), true; }

    /* AI assistant */
    if (p === '/api/ai/chat' && req.method === 'POST') { const b = await readJson(req, 4e4); if (!b || !b.q) return json(res, 400, { error: 'empty question' }), true; if (!A.enabled('ai')) return json(res, 200, { off: true }), true; if (limited('ai:' + (b.emp || req.socket.remoteAddress), 20, 60000)) return json(res, 429, { error: 'Too many questions — wait a minute.' }), true; try { return json(res, 200, { answer: await aiAsk(b) }), true; } catch (e) { return json(res, 502, { error: String(e.message || e).slice(0, 200) }), true; } }
    return false;
  }
  return { handle, sendNative, nativeOn };
};
