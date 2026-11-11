'use strict';
/* ============ Orbit Realty — real-estate modules, duty reminders & alerts, push, motion ============ */
document.head.insertAdjacentHTML('beforeend', '<style>@keyframes ringin{from{stroke-dashoffset:var(--c)}}</style>');
Object.assign(ICONS, { building: 'M3 21h18M5 21V5l8-2v18M19 21V10l-6-2M9 8v.01M9 12v.01M9 16v.01M16 13v.01M16 17v.01', clockalert: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 7v5M12 16v.01', phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z' });
{ const i = PAGES.findIndex(p => p[0] === 'attendance'); PAGES.splice(i + 1, 0, ['alerts', 'Duty alerts', 'clockalert']); }
PAGES.find(p => p[0] === 'helpdesk')[1] = 'Helpdesk';

/* ================= SITE VISITS (field log) + attendance rate helper ================= */
const PROJECTS = [];
(() => {
  const T = TODAY();
  SEEDS.visits = [];
})();
ENT.visits = { own: 'emp', canNew: () => true, newLabel: 'Schedule site visit', cols: [['emp', 'Employee', 'emp'], ['client', 'Client'], ['project', 'Project'], ['date', 'Date', 'date'], ['time', 'Time'], ['status', 'Status', 'status']], fields: [['emp', 'Employee', 'emp'], ['client', 'Client / group', 'text'], ['project', 'Project / site', 'text'], ['date', 'Date', 'date'], ['time', 'Time', 'time']], defaults: () => ({ status: 'Scheduled', notes: '' }), acts: [{ l: 'Done', cls: 'primary', if: r => r.status === 'Scheduled' && (isHR() || r.emp === me().id), f: r => { r.status = 'Done'; } }, { l: 'No-show', cls: 'danger', if: r => r.status === 'Scheduled' && (isHR() || r.emp === me().id), f: r => { r.status = 'No-show'; } }] };
function attRate(e, ym) { const first = ym + '-01', T = TODAY(); let w = 0, p = 0; for (let d = first; d <= T && d.slice(0, 7) === ym; d = addDays(d, 1)) { const s = dayStatus(e.id, d).s; if (['weekend', 'holiday', 'na', 'future', 'leave'].includes(s)) continue; w++; if (['present', 'late', 'wfh', 'half'].includes(s)) p++; } return w ? Math.round(p / w * 100) : 100; }

/* ================= DUTY STATE + PREFERENCES ================= */
const nowMin = () => { const d = nowDate(); return d.getHours() * 60 + d.getMinutes(); };
const prefs = () => { DB.prefs ??= {}; return DB.prefs[me().id] ??= { before: 15, browser: true, push: false, sound: true, outRemind: true }; };
function dutyOf(e, date = TODAY()) {
  const st = dayStatus(e.id, date), sh = shiftOf(e), sM = hm2m(sh.start), eM = hm2m(sh.end), nm = nowMin(), before = DB.prefs?.[e.id]?.before || 15, grace = 15;
  let rec = DB.att[e.id]?.[date]; if (rec && hm2m(rec.in) > nm + 1) rec = null; else if (rec?.out && hm2m(rec.out) > nm) rec = { ...rec, out: null };
  const base = { sh, sM, eM, nm, rec, before, grace }; if (rec?.absent) return { ...base, rec: null, kind: 'absent', manual: true };
  if (e.status === 'Exited' || ['weekend', 'holiday', 'leave', 'na'].includes(st.s)) return { ...base, kind: 'off', why: st.s };
  if (!rec) { if (nm < sM - before) return { ...base, kind: 'before' }; if (nm < sM) return { ...base, kind: 'pre' }; if (nm < sM + grace) return { ...base, kind: 'due' }; if (nm >= eM) return { ...base, kind: 'absent' }; return { ...base, kind: 'late', late: nm - sM }; }
  if (!rec.out) { if (nm < eM) return { ...base, kind: 'working' }; if (nm >= eM + 120) return { ...base, kind: 'missed', over: nm - eM }; return { ...base, kind: 'checkout', over: nm - eM }; }
  return { ...base, kind: 'done' };
}
const dur = m => { m = Math.max(0, Math.round(m)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? m % 60 + 'm' : ''}`.trim() : m + ' min'; };
function dutyText(d) {
  const { sh, sM, eM, nm } = d;
  switch (d.kind) {
    case 'before': return { state: 'Shift not started', title: `Starts at ${sh.start}`, sub: `in ${dur(sM - nm)}`, c: 'var(--muted)', pct: 0, mid: sh.start };
    case 'pre': return { state: 'Starting soon', title: `Duty starts at ${sh.start}`, sub: `in ${dur(sM - nm)} — get ready to check in`, c: 'var(--accent)', pct: 0, mid: dur(sM - nm) };
    case 'due': return { state: 'Duty started', title: 'Check in now', sub: `Shift began at ${sh.start}`, c: '#f59e0b', pct: 0, mid: 'Now' };
    case 'late': return { state: 'Not checked in', title: `${dur(d.late)} late`, sub: `Shift began at ${sh.start}`, c: '#ef4444', pct: 0, mid: dur(d.late) };
    case 'working': return { state: 'On duty', title: `Checked in at ${d.rec.in}`, sub: `Ends in ${dur(eM - nm)} (${sh.end})`, c: '#22c55e', pct: Math.min(1, (nm - sM) / (eM - sM)), mid: dur(eM - nm) };
    case 'checkout': return { state: 'Check-out due', title: 'Duty has ended', sub: `Ended ${dur(d.over)} ago — please check out`, c: '#f59e0b', pct: 1, mid: 'Done?' };
    case 'missed': return { state: 'Missed check-out', title: 'No check-out recorded', sub: `Shift ended at ${sh.end}`, c: '#ef4444', pct: 1, mid: '!' };
    case 'done': return { state: 'Day complete', title: `${d.rec.in} – ${d.rec.out}`, sub: `${hoursOf(d.rec).toFixed(1)} hours worked`, c: '#22c55e', pct: 1, mid: '✓' };
    case 'absent': return { state: 'Absent', title: 'No attendance today', sub: 'You did not check in', c: '#ef4444', pct: 0, mid: '—' };
    default: return { state: 'Day off', title: { weekend: 'Day off (roster)', holiday: 'Holiday', leave: 'On leave', na: 'Not active' }[d.why] || 'Off duty', sub: 'Enjoy!', c: 'var(--muted)', pct: 0, mid: '☼' };
  }
}
const ringHtml = (pct, mid, sub, c) => { const r = 56, k = 2 * Math.PI * r; return `<div class="ring"><svg viewBox="0 0 132 132"><circle class="tr" cx="66" cy="66" r="${r}" fill="none" stroke-width="10"/><circle class="pg" cx="66" cy="66" r="${r}" fill="none" stroke="${c}" stroke-width="10" stroke-dasharray="${k}" stroke-dashoffset="${k * (1 - pct)}" style="animation:ringin 1.2s var(--ease) both;--c:${k}"/></svg><div class="mid"><b>${mid}</b><span>${sub}</span></div></div>`; };
const dutyAction = d => ['pre', 'due', 'late'].includes(d.kind) ? { a: 'checkin', l: 'Check in', i: 'clock' } : ['checkout', 'missed'].includes(d.kind) ? { a: 'checkout', l: 'Check out', i: 'logout' } : d.kind === 'working' ? { a: 'checkout', l: 'Check out', i: 'logout', quiet: 1 } : d.kind === 'before' ? { a: 'checkin', l: 'Check in early', i: 'clock', quiet: 1 } : null;
function dutyCardInner(u = me()) {
  const d = dutyOf(u), t = dutyText(d), act = dutyAction(d), urgent = act && !act.quiet && d.kind !== 'pre';
  return `<div class="duty">${ringHtml(t.pct, t.mid, d.sh.name, t.c)}<div style="flex:1;min-width:200px"><div class="state" style="color:${t.c}"><span class="live-dot ${['late', 'missed'].includes(d.kind) ? 'bad' : ['due', 'checkout'].includes(d.kind) ? 'warn' : ''}"></span>${t.state}</div><div style="font-size:22px;font-weight:800;margin:2px 0">${esc(t.title)}</div><div class="muted">${esc(t.sub)}</div><div class="muted small" style="margin-top:4px">${d.sh.name} · ${d.sh.start}–${d.sh.end}</div>${act ? `<div class="row wrap" style="margin-top:12px">${['before', 'pre', 'due', 'late'].includes(d.kind) ? `${siteSelect()}` : ''}<button class="btn primary big ${urgent ? 'pulse' : ''}" data-act="${act.a}">${ic(act.i)} ${act.l}</button></div>` : ''}</div></div>`;
}

/* ================= REMINDER ENGINE ================= */
const REM = { lastKind: '', seen: {}, started: false };
const seenRecent = tag => { const now = Date.now(); if (REM.seen[tag] && now - REM.seen[tag] < 4 * 60000) return true; REM.seen[tag] = now; return false; };
function beep() { if (!prefs().sound) return; try { const a = new (window.AudioContext || window.webkitAudioContext)(), g = a.createGain(); g.connect(a.destination); g.gain.value = .06;[[880, 0], [1175, .16]].forEach(([f, t]) => { const o = a.createOscillator(); o.frequency.value = f; o.type = 'sine'; o.connect(g); o.start(a.currentTime + t); o.stop(a.currentTime + t + .13); }); } catch { } }
function updateBell() { const btn = $('[data-act=notes]'); if (!btn) return; const n = DB.notes.filter(x => x.to === me().id && !x.read).length; let dot = $('.dot', btn); if (!n) { dot?.remove(); return; } if (!dot) { dot = document.createElement('span'); dot.className = 'dot'; btn.appendChild(dot); } dot.textContent = n; btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); }
function browserNotify(title, body, tag) {
  if (!prefs().browser || !('Notification' in window) || Notification.permission !== 'granted') return;
  const o = { body, tag, renotify: true, data: { url: '/#/alerts' } };
  if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then(r => r ? r.showNotification(title, o) : new Notification(title, o)).catch(() => { try { new Notification(title, o); } catch { } }); else try { new Notification(title, o); } catch { }
}
function remind(title, body, tag, type = 'warn') { if (tag && seenRecent(tag)) return; toast(`${title} — ${body}`, type); notify(me().id, `${title} — ${body}`); save(); updateBell(); beep(); browserNotify(title, body, tag); }
function remTick() {
  if (!SESSION || !DB) return; const u = me(), d = dutyOf(u), T = TODAY(), p = prefs();
  const fire = (k, title, body, tag, type) => { const key = `rem:${u.id}:${T}:${k}`; if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); remind(title, body, tag, type); };
  if (d.kind === 'pre') fire('pre', `⏰ Duty starts at ${d.sh.start}`, `in ${dur(d.sM - d.nm)} — check in when you arrive.`, 'pre-' + u.id, 'warn');
  if (d.kind === 'due') fire('start', '🟢 Your duty has started', 'Please check in now.', 'start-' + u.id, 'warn');
  if (d.kind === 'late') fire('late' + Math.floor((d.late - d.grace) / 10), '⚠ You have not checked in', `${dur(d.late)} after shift start (${d.sh.start}).`, 'late-' + u.id, 'warn');
  if (['checkout', 'missed'].includes(d.kind) && p.outRemind) fire('out' + Math.floor(d.over / 15), '🔔 Remember to check out', `Duty ended at ${d.sh.end} (${dur(d.over)} ago).`, 'out-' + u.id, 'warn');
  if (isHR() || isMgr()) scope().filter(e => e.id !== u.id).forEach(e => { const x = dutyOf(e); if (x.kind === 'late') fire('hrl-' + e.id, `⚠ ${e.name} has not checked in`, `Shift started ${x.sh.start} — ${dur(x.late)} late.`, 'hrlate-' + e.id, 'warn'); if (x.kind === 'missed') fire('hrm-' + e.id, `🕒 ${e.name} missed check-out`, `Shift ended ${x.sh.end}.`, 'hrmiss-' + e.id, 'warn'); });
  renderBars(); if (location.hash.startsWith('#/dashboard')) { const c = $('#dutycard'); if (c && !c.matches(':hover')) c.innerHTML = dutyCardInner(); } if (location.hash.startsWith('#/alerts')) refreshBoard();
}
function renderBars() {
  const box = $('#alertbar'); if (!box || !SESSION) return; const u = me(), d = dutyOf(u), snooze = +sessionStorage.getItem('snooze') || 0; let html = '';
  if (Date.now() > snooze) {
    const m = { pre: { c: 'info', t: `Duty starts at ${d.sh.start}`, s: `in ${dur(d.sM - d.nm)} — don't forget to check in`, a: 'Check in' }, due: { c: 'warn', t: 'Your duty has started', s: 'Please check in now', a: 'Check in' }, late: { c: 'bad', t: "You haven't checked in", s: `${dur(d.late || 0)} after shift start (${d.sh.start})`, a: 'Check in now' }, checkout: { c: 'warn', t: `Duty ended at ${d.sh.end}`, s: `Don't forget to check out — ${dur(d.over || 0)} ago`, a: 'Check out' }, missed: { c: 'bad', t: 'Check-out missed', s: `Shift ended at ${d.sh.end}. Check out now and add a note to HR if needed`, a: 'Check out' } }[d.kind];
    if (m) html += `<div class="abar ${m.c} ${REM.lastKind === d.kind ? 'nanim' : ''}"><span class="ico">${ic('clockalert')}</span><div class="t">${m.t}<small>${m.s}</small></div><button class="btn sm ${m.c === 'info' ? 'primary' : ''}" data-act="${['checkout', 'missed'].includes(d.kind) ? 'checkout' : 'checkin'}">${m.a}</button><button class="btn sm ghost" data-act="snooze">Snooze 10m</button></div>`;
  }
  let hrN = 0;
  if (isHR() || isMgr()) { const l = scope().filter(e => e.id !== u.id).map(e => [e, dutyOf(e)]), late = l.filter(x => x[1].kind === 'late'), miss = l.filter(x => x[1].kind === 'missed'); hrN = late.length + miss.length; if (hrN) html += `<div class="abar hr nanim"><span class="live-dot ${miss.length ? 'bad' : 'warn'}"></span><div class="t"><b>${late.length}</b> not checked in · <b>${miss.length}</b> missed check-out <span class="muted small">— ${[...late, ...miss].slice(0, 3).map(x => esc(x[0].name.split(' ')[0])).join(', ')}${hrN > 3 ? ' +' + (hrN - 3) : ''}</span></div><a class="btn sm" href="#/alerts">Open alert board</a></div>`; }
  box.innerHTML = html; REM.lastKind = d.kind;
  const a = $('.side a[href="#/alerts"]'); if (a) { let b = $('.badge-n', a); if (!hrN) b?.remove(); else { if (!b) { b = document.createElement('span'); b.className = 'badge-n'; a.appendChild(b); } b.textContent = hrN; } }
}
ACT.snooze = () => { sessionStorage.setItem('snooze', Date.now() + 10 * 60000); renderBars(); toast('Snoozed for 10 minutes', 'ok'); };
const _co = ACT.checkout; ACT.checkout = () => { _co(); syncPresence(); };
const _ci3 = ACT.checkin; ACT.checkin = () => { _ci3(); setTimeout(syncPresence, 1500); };

/* ================= PUSH (service worker + web push) ================= */
const b64u = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
async function registerSW() { if (!('serviceWorker' in navigator)) return null; try { const r = await navigator.serviceWorker.register('/sw.js'); navigator.serviceWorker.addEventListener('message', e => { const m = e.data || {}; if (m.type === 'push') onAlert({ title: m.title, body: m.body, tag: m.tag, to: me()?.id }); if (m.type === 'goto') location.hash = m.url.replace(/^.*#/, '#'); }); return r; } catch { return null; } }
async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('This browser does not support push notifications');
  const k = await API.get('/api/push/key'); if (!k.enabled) throw new Error('Push is not enabled on the server');
  const perm = await Notification.requestPermission(); if (perm !== 'granted') throw new Error('Notification permission was not granted');
  const reg = (await registerSW()) || (await navigator.serviceWorker.ready); await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(k.key) });
  await API.post('/api/push/subscribe', { emp: me().id, role: me().role, sub: sub.toJSON() }); prefs().push = true; save(); syncPresence(); return true;
}
async function disablePush() { const r = await navigator.serviceWorker?.getRegistration(); const s = await r?.pushManager.getSubscription(); await API.post('/api/push/unsubscribe', { emp: me().id, endpoint: s?.endpoint }); await s?.unsubscribe(); prefs().push = false; save(); }
async function pushStatus() { const el = $('#pushst'); if (!el) return; let txt, cls = ''; try { if (!('Notification' in window)) txt = 'Not supported in this browser'; else { const r = await navigator.serviceWorker?.getRegistration(), s = await r?.pushManager.getSubscription(); txt = s ? 'Active — alerts reach this device even when the app is closed' : Notification.permission === 'denied' ? 'Blocked in browser settings' : 'Not enabled'; cls = s ? 'ok' : 'warn'; } } catch { txt = 'Unavailable'; } el.innerHTML = `<span class="badge ${cls}">${txt}</span>`; const b = $('#pushbtn'); if (b) b.textContent = cls === 'ok' ? 'Turn off push' : 'Enable push alerts'; if (b) b.dataset.on = cls === 'ok' ? '1' : ''; }
function onAlert(a) { if (!SESSION) return; const u = me(), mine = a.to === u.id || a.toEmp === u.id || (a.toRoles && a.toRoles.includes(u.role)); if (!mine) return; remind(a.title, a.body, a.tag, 'warn'); if (location.hash.startsWith('#/alerts')) refreshBoard(); }
const _sr2 = startRealtime; startRealtime = function () { _sr2(); if (ES && !ES._al) { ES._al = 1; ES.addEventListener('alert', e => onAlert(JSON.parse(e.data))); } };
async function syncPresence() {
  if (!SESSION || API.ok === false) return; const T = TODAY();
  const mk = e => { const sh = shiftOf(e), st = dayStatus(e.id, T), rec = DB.att[e.id]?.[T]; return { emp: e.id, name: e.name, role: e.role, mgr: e.mgr || '', date: T, start: sh.start, end: sh.end, inTime: rec?.in || '', outTime: rec?.out || '', off: ['weekend', 'holiday', 'leave', 'na'].includes(st.s) || e.status === 'Exited', before: DB.prefs?.[e.id]?.before || 15, status: e.status }; };
  try { await API.post('/api/presence', { list: isHR() ? DB.employees.filter(e => e.status !== 'Exited').map(mk) : [mk(me())] }); } catch { }
}

/* ================= ALERTS PAGE ================= */
const GROUPS = { wait: ['pre', 'due'], late: ['late'], in: ['working'], out: ['checkout'], miss: ['missed'], done: ['done'], idle: ['before', 'off', 'absent'] };
const KIND_BADGE = { before: ['', 'Not started'], pre: ['info', 'Starting soon'], due: ['warn', 'Check-in due'], late: ['bad', 'Late'], working: ['ok', 'On duty'], checkout: ['warn', 'Check-out due'], missed: ['bad', 'Missed check-out'], done: ['ok', 'Done'], off: ['', 'Off'], absent: ['bad', 'Absent'] };
function boardInner() {
  const list = scope().filter(e => e.status !== 'Exited').map(e => [e, dutyOf(e)]), f = S.alertF || 'all';
  const chips = [['wait', 'Awaiting check-in', 'info'], ['late', 'Late — not in', 'bad'], ['in', 'On duty', 'ok'], ['out', 'Check-out due', 'warn'], ['miss', 'Missed check-out', 'bad'], ['done', 'Day complete', 'ok']];
  const rowsL = list.filter(([, d]) => f === 'all' || GROUPS[f].includes(d.kind)).sort((a, b) => ['missed', 'late', 'checkout', 'due', 'pre', 'working', 'done', 'before', 'off', 'absent'].indexOf(a[1].kind) - ['missed', 'late', 'checkout', 'due', 'pre', 'working', 'done', 'before', 'off', 'absent'].indexOf(b[1].kind));
  const remindable = list.filter(([e, d]) => e.id !== me().id && ['pre', 'due', 'late', 'checkout', 'missed'].includes(d.kind)).length;
  return `<div class="row wrap" style="gap:12px;margin-bottom:16px">${chips.map(([k, l, c]) => `<div class="sum-chip ${f === k ? 'on' : ''}" data-act="alertf" data-v="${f === k ? 'all' : k}"><b data-count>${list.filter(x => GROUPS[k].includes(x[1].kind)).length}</b><span class="muted small"><span class="live-dot ${c === 'bad' ? 'bad' : c === 'warn' ? 'warn' : ''}"></span>${l}</span></div>`).join('')}</div>
  <div class="row" style="margin-bottom:10px"><span class="muted small">Auto-refreshes every 15 seconds · times follow ${DEMO.off ? '<b style="color:var(--amber)">demo clock ' + nowHM() + '</b>' : 'your device clock'}</span><button class="btn primary right" data-act="remind_all" ${remindable ? '' : 'disabled'}>${ic('bell')} Remind all pending (${remindable})</button></div>
  <div class="card pad0 tablewrap"><table><thead><tr><th>Employee</th><th>Team</th><th>Shift</th><th>Status</th><th>In</th><th>Out</th><th>Note</th><th></th></tr></thead><tbody>${rowsL.map(([e, d]) => { const b = KIND_BADGE[d.kind], note = d.kind === 'late' ? dur(d.late) + ' late' : d.kind === 'pre' ? 'starts in ' + dur(d.sM - d.nm) : d.kind === 'working' ? 'ends in ' + dur(d.eM - d.nm) : ['checkout', 'missed'].includes(d.kind) ? 'ended ' + dur(d.over) + ' ago' : d.rec && d.rec.in > lateLimit(e) ? 'arrived late' : ''; return `<tr><td>${person(e)}</td><td>${esc(e.dept)}</td><td class="nowrap">${d.sh.start}–${d.sh.end}</td><td><span class="badge ${b[0]}">${['late', 'missed', 'due', 'checkout'].includes(d.kind) ? '<span class="live-dot ' + (b[0] === 'bad' ? 'bad' : 'warn') + '" style="margin:0"></span>' : ''}${b[1]}</span></td><td>${d.rec?.in || '—'}</td><td>${d.rec?.out || '—'}</td><td class="small muted">${note}</td><td class="nowrap" style="text-align:right">${e.id !== me().id && ['pre', 'due', 'late', 'checkout', 'missed'].includes(d.kind) ? `<button class="btn sm primary" data-act="remind" data-id="${e.id}">${ic('bell')} Remind</button> ` : ''}${e.phone ? `<a class="btn sm" href="tel:${esc(e.phone.replace(/\s/g, ''))}" title="Call">${ic('phone')}</a>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">Nobody in this filter 🎯</td></tr>'}</tbody></table></div>`;
}
function refreshBoard() { const b = $('#board'); if (b) b.innerHTML = boardInner(); }
function myInner() {
  const u = me(), p = prefs(), d = dutyOf(u), mine = DB.notes.filter(n => n.to === u.id && /^(⏰|🟢|⚠|🔔|🕒)/.test(n.msg)).slice(0, 8);
  const sw = (k, label, hint) => `<label class="row" style="cursor:pointer;padding:8px 0"><span class="sw"><input type="checkbox" data-chg="pref" data-k="${k}" ${p[k] ? 'checked' : ''}><span></span></span><span style="flex:1"><b>${label}</b><div class="muted small">${hint}</div></span></label>`;
  return `<div class="grid g2"><div class="col" style="gap:16px"><div class="card" id="dutycard">${dutyCardInner()}</div>
  <div class="card"><header><h3>${ic('bell')} Reminder settings</h3></header><label class="f">Remind me before my duty starts<select class="select" data-chg="prefbefore">${[5, 10, 15, 20, 30, 45].map(m => `<option value="${m}" ${p.before === m ? 'selected' : ''}>${m} minutes before ${d.sh.start}</option>`).join('')}</select></label>
  ${sw('outRemind', 'Check-out reminders', `Nudges at ${d.sh.end} and every 15 minutes until you check out`)}${sw('browser', 'Desktop / phone notifications', 'Pop-ups while the app is open in the background')}${sw('sound', 'Alert sound', 'Short chime with each reminder')}
  <div class="row between wrap" style="padding:10px 0;border-top:1px solid var(--line);margin-top:6px"><div><b>Background push</b><div class="muted small">Reaches you even when this tab or the app is closed</div><div id="pushst" style="margin-top:6px"></div></div><button class="btn primary" id="pushbtn" data-act="push_toggle">Enable push alerts</button></div>
  <div class="row wrap" style="margin-top:6px"><button class="btn" data-act="notif_test">${ic('bell')} Send test alert</button></div></div></div>
  <div class="col" style="gap:16px">
  <div class="card"><header><h3>Recent reminders</h3></header><div class="list">${mine.map(n => `<div><div>${esc(n.msg)}</div><div class="muted small">${new Date(n.ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div>`).join('') || '<div class="muted">No reminders yet today.</div>'}</div></div>
  ${isHR() ? `<div class="card"><header><h3>Server push log</h3></header><div id="plog" class="small muted">Loading…</div></div>` : ''}</div></div>`;
}
PAGE_FN.alerts = () => {
  const mgr = isHR() || isMgr(), tabs = [...(mgr ? [['board', 'Live board']] : []), ['my', 'My reminders']], t = tabOf('alert', mgr ? 'board' : 'my');
  setTimeout(() => { pushStatus(); if (isHR()) API.get('/api/alerts/debug').then(x => { const el = $('#plog'); if (el) el.innerHTML = x.log.length ? x.log.slice(0, 8).map(l => `<div style="padding:4px 0;border-bottom:1px solid var(--line)"><b>${esc(l.title)}</b> → ${esc(l.to)} <span class="badge ${l.delivered ? 'ok' : ''}">${l.delivered} delivered</span> <span class="muted">${new Date(l.ts).toLocaleTimeString('en-IN')}</span></div>`).join('') : 'Nothing sent yet. Subscribed devices: ' + Object.keys(x.subs).length; }).catch(() => { }); }, 0);
  return head('Duty alerts', 'Check-in & check-out reminders and live attendance monitoring') + tabsBar('alert', tabs, mgr ? 'board' : 'my') + (t === 'board' ? `<div id="board">${boardInner()}</div>` : myInner());
};
ACT.alertf = el => { S.alertF = el.dataset.v; refreshBoard(); };
CHG.pref = el => { prefs()[el.dataset.k] = el.checked; save(); syncPresence(); if (el.dataset.k === 'browser' && el.checked && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(r => { if (r !== 'granted') { el.checked = false; prefs().browser = false; save(); toast('Notifications were blocked by the browser', 'err'); } }); };
CHG.prefbefore = el => { prefs().before = +el.value; save(); syncPresence(); toast(`Reminder set ${el.value} min before duty`); };
ACT.push_toggle = async el => { try { if (el.dataset.on) { await disablePush(); toast('Push alerts turned off'); } else { await enablePush(); toast('Push alerts enabled on this device'); } pushStatus(); } catch (e) { toast(e.message, 'err'); } };
ACT.notif_test = () => { REM.seen = {}; remind('⏰ Test alert', 'This is how your duty reminders will look.', 'test-' + Date.now(), 'warn'); };
ACT.remind = async el => {
  const e = emp(el.dataset.id), d = dutyOf(e), msg = ['checkout', 'missed'].includes(d.kind) ? ['🔔 Please check out', `${me().name} reminded you: duty ended at ${d.sh.end}.`] : ['⏰ Please check in', `${me().name} reminded you: your duty ${d.kind === 'pre' ? 'starts at' : 'started at'} ${d.sh.start}.`];
  notify(e.id, msg.join(' — ')); save(); try { const r = await API.post('/api/push/send', { to: e.id, title: msg[0], body: msg[1], tag: 'manual-' + e.id }); toast(`Reminder sent to ${e.name.split(' ')[0]}${r.delivered ? ' (push delivered)' : ''}`); } catch { toast(`Reminder saved for ${e.name.split(' ')[0]}`); }
};
ACT.remind_all = () => scope().filter(e => e.id !== me().id && ['pre', 'due', 'late', 'checkout', 'missed'].includes(dutyOf(e).kind)).forEach(e => ACT.remind({ dataset: { id: e.id } }));
ACT.clock_to = el => {
  const d = dutyOf(me()), real = new Date().getHours() * 60 + new Date().getMinutes(), w = el.dataset.w, target = { pre: d.sM - 15, late: d.sM + 30, end: d.eM, missed: d.eM + 125 }[w];
  DEMO.off = w === 'reset' ? 0 : target - real; localStorage.setItem('orbit_demo_off', DEMO.off); Object.keys(localStorage).filter(k => k.startsWith('rem:')).forEach(k => localStorage.removeItem(k)); REM.seen = {}; sessionStorage.removeItem('snooze');
  render(); remTick(); toast(w === 'reset' ? 'Back to real time' : `Demo clock set to ${nowHM()}`);
};
ACT.reset_day = () => { delete DB.att[me().id][TODAY()]; Object.keys(localStorage).filter(k => k.startsWith('rem:')).forEach(k => localStorage.removeItem(k)); save(); render(); remTick(); toast('Today’s attendance cleared'); };

/* ================= DASHBOARD (real estate) ================= */
const skylineSvg = `<svg class="sky" viewBox="0 0 400 200" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">${[[10, 90, 50], [70, 140, 44], [124, 70, 40], [174, 120, 56], [240, 100, 46], [296, 150, 52], [356, 80, 40]].map((b, i) => `<g><rect x="${b[0]}" y="${200 - b[1]}" width="${b[2]}" height="${b[1]}" fill="#fff" opacity=".08"/>${Array.from({ length: Math.floor(b[1] / 24) * 2 }, (_, k) => `<rect class="win" style="--w:${(i * 5 + k * 3) % 9}" x="${b[0] + 8 + (k % 2) * (b[2] / 2.2)}" y="${200 - b[1] + 10 + Math.floor(k / 2) * 24}" width="${b[2] / 4}" height="9" rx="1" fill="#f5c451"/>`).join('')}</g>`).join('')}</svg>`;
PAGE_FN.dashboard = () => {
  const u = me(), T = TODAY(), h = nowDate().getHours(), greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening', ym = ymOf(T), mgrView = isHR() || isMgr();
  const act = activeEmps(), states = act.map(e => [e, dutyOf(e)]), cnt = ks => states.filter(x => ks.includes(x[1].kind)).length;
  const onDuty = cnt(['working', 'checkout', 'missed', 'done']), wait = cnt(['pre', 'due']), late = cnt(['late']), onLeave = act.filter(e => dayStatus(e.id, T).s === 'leave').length, pc = pendingCount();
  const myGoals = DB.goals.filter(g => g.emp === u.id), lastDay = iso(new Date(nowDate().getFullYear(), nowDate().getMonth() + 1, 0));
  const kpis = mgrView ? [[act.length, 'Active team', `${act.filter(e => e.status === 'Onboarding').length} onboarding`], [onDuty, 'Checked in today', `${wait} awaiting · ${late} late`], [onLeave, 'On leave today', 'approved'], [pc, 'Pending approvals', 'need your action']]
    : [[leaveBalance(u.id, 'CL').left, 'Casual leave left', `of ${DB.settings.quota.CL} this year`], [myGoals.length, 'Active goals', 'this cycle'], [leaveBalance(u.id, 'EL').left, 'Earned leave left', `of ${DB.settings.quota.EL} this year`], [fmtShort(lastDay), 'Next payday', 'salary credited']];
  const ev = []; act.forEach(e => { const b = nextOcc(e.dob.slice(5)); ev.push([b, '🎂', `${e.name}'s birthday`]); const a = nextOcc(e.joined.slice(5)), y = +a.slice(0, 4) - +e.joined.slice(0, 4); if (y >= 1) ev.push([a, '🏅', `${e.name} — ${y} yr${y > 1 ? 's' : ''} with us`]); }); HOLIDAYS.forEach(x => { if (x[0] >= T) ev.push([x[0], '🎉', x[1]]); }); ev.sort((a, b) => a[0] < b[0] ? -1 : 1);
  const off = act.filter(e => dayStatus(e.id, T).s === 'leave');
  const trend = []; for (let k = 13; k >= 1; k--) { const d = addDays(T, -k); const base = act.filter(e => !['weekend', 'holiday', 'na'].includes(dayStatus(e.id, d).s)); if (!base.length) continue; const p = base.filter(e => ['present', 'late', 'wfh'].includes(dayStatus(e.id, d).s)).length; trend.push({ l: fmtShort(d), v: Math.round(p / base.length * 100) }); }
  const depts = DEPTS.map((d, i) => ({ l: d, v: act.filter(e => e.dept === d).length, c: COLORS[i] })).filter(d => d.v);
  const probs = states.filter(x => ['late', 'missed', 'checkout'].includes(x[1].kind) && x[0].id !== u.id).slice(0, 5);
  const notes = rows('sticky').filter(n => n.emp === u.id), my = rows('awards').filter(a => a.emp === u.id), visitsToday = rows('visits').filter(v => v.date === T && (isHR() || v.emp === u.id || emp(v.emp)?.mgr === u.id));
  return `<div class="hero"><div style="position:relative;z-index:1"><h1>${greet}, ${esc(u.name.split(' ')[0])} 👋</h1><p>${nowDate().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${esc(DB.company)}</p><div class="row wrap" style="margin-top:16px">${isHR() ? `<button class="btn" data-act="news_new" style="background:#ffffff1c;color:#fff;border-color:#ffffff40">${ic('mega')} Post announcement</button><button class="btn" data-act="emp_new" style="background:#fff;color:#0a1a2f">${ic('plus')} Add employee</button>` : `<button class="btn" data-act="leave_new" style="background:#fff;color:#0a1a2f">${ic('plus')} Apply leave</button><button class="btn" data-act="tabgo" data-p="meetings" data-k="meet" data-v="v" style="background:#ffffff1c;color:#fff;border-color:#ffffff40">Site visits</button>`}</div></div>${skylineSvg}</div>
  <div class="grid g4" style="margin-bottom:16px">${kpis.map(k => `<div class="card kpi"><span class="v">${k[0]}</span><span class="l">${k[1]}</span><span class="d muted">${k[2]}</span></div>`).join('')}</div>
  <div class="grid g-main"><div class="col" style="gap:16px">
   <div class="card" id="dutycard">${dutyCardInner()}</div>
   ${mgrView && probs.length ? `<div class="card"><header><h3><span class="live-dot bad"></span>Needs attention now</h3><a class="btn sm" href="#/alerts">Alert board</a></header><div class="list">${probs.map(([e, d]) => `<div class="row">${avatar(e, 'sm')}<div style="flex:1"><b>${esc(e.name)}</b><div class="muted small">${d.kind === 'late' ? dur(d.late) + ' late — shift ' + d.sh.start : d.kind === 'checkout' ? 'check-out due — ended ' + dur(d.over) + ' ago' : 'missed check-out'}</div></div><button class="btn sm primary" data-act="remind" data-id="${e.id}">${ic('bell')} Remind</button></div>`).join('')}</div></div>` : ''}
   ${pc ? `<div class="card pad0"><div style="padding:16px 18px 0"><h3>Needs your approval <span class="badge warn">${pc}</span></h3></div>${approvalsTable()}</div>` : ''}
   ${mgrView ? `<div class="card"><header><h3>🏅 Attendance leaders</h3><span class="muted small">${monthName(ym)}</span></header><div class="leader col">${act.filter(e => e.status === 'Active' && e.role !== 'admin').map(e => ({ e, v: attRate(e, ym) })).sort((a, b) => b.v - a.v).slice(0, 5).map(({ e, v }) => `<div><div class="row">${avatar(e, 'sm')}<b style="flex:1">${esc(e.name)}</b><span class="badge ${v >= 95 ? 'ok' : 'acc'}">${v}%</span></div><div class="bar" style="margin-top:6px"><i style="width:${v}%"></i></div></div>`).join('')}</div></div>
   <div class="grid g2"><div class="card"><header><h3>Attendance trend</h3><span class="muted small">% present</span></header>${lineChart(trend, { fmt: x => x + '%' })}</div><div class="card"><header><h3>Team by department</h3></header>${donut(depts, 120)}</div></div>` : ''}
   <div class="card"><header><h3>Announcements</h3></header><div class="list">${DB.news.slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0)).slice(0, 4).map(n => `<div><div class="row"><b>${n.pin ? '📌 ' : ''}${esc(n.title)}</b><span class="muted small right">${fmtShort(n.ts)}</span></div><div class="muted">${esc(n.body)}</div><div class="small muted">— ${esc(empName(n.by))}</div></div>`).join('')}</div></div>
  </div><div class="col" style="gap:16px">
   ${visitsToday.length ? `<div class="card"><header><h3>🏗 Site visits today</h3><span class="badge acc">${visitsToday.length}</span></header><div class="list">${visitsToday.map(v => `<div class="row"><span class="badge">${v.time}</span><div style="flex:1"><b>${esc(v.client)}</b><div class="muted small">${esc(v.project)} · ${esc(empName(v.emp).split(' ')[0])}</div></div>${statusBadge(v.status)}</div>`).join('')}</div></div>` : ''}
   <div class="card"><header><h3>Out today</h3><span class="badge vio">${off.length}</span></header>${off.length ? off.map(e => `<div class="row" style="padding:5px 0">${avatar(e, 'sm')}<span>${esc(e.name)}</span><span class="muted small right">${LEAVE_TYPES[dayStatus(e.id, T).lv.type]}</span></div>`).join('') : '<div class="muted">Everyone is in 🎯</div>'}</div>
   <div class="card"><header><h3>Coming up</h3></header><div class="list">${ev.slice(0, 6).map(x => `<div class="row"><span style="font-size:18px">${x[1]}</span><div style="flex:1">${esc(x[2])}</div><span class="muted small">${x[0] === T ? 'Today' : fmtShort(x[0])}</span></div>`).join('')}</div></div>
   <div class="card"><header><h3>📝 Sticky notes</h3><button class="btn sm" data-act="note_new">${ic('plus')}</button></header>${notes.map(n => `<div class="row" style="padding:7px 10px;margin-bottom:6px;border-radius:10px;background:var(--gold-soft)"><span style="flex:1">${esc(n.text)}</span><button class="icon-btn" data-act="note_del" data-id="${n.id}" style="padding:2px">${ic('x')}</button></div>`).join('') || '<div class="muted">Private reminders — only you see these.</div>'}</div>
   <div class="card"><header><h3>🏆 My rewards</h3></header>${my.map(a => `<div class="row" style="padding:5px 0"><span class="badge vio">${esc(a.type)}</span><span class="muted small">${esc(a.description)}</span></div>`).join('') || '<div class="muted">No rewards yet — keep going!</div>'}</div>
   <div class="card"><header><h3>Recent kudos</h3></header><div class="list">${DB.kudos.slice(0, 3).map(k => `<div><div class="small"><b>${esc(empName(k.from).split(' ')[0])}</b> → <b>${esc(empName(k.to).split(' ')[0])}</b> <span class="badge vio">${esc(k.badge)}</span></div><div class="muted">${esc(k.msg)}</div></div>`).join('')}</div></div>
  </div></div>`;
};

/* ================= MOTION: counters, stagger, ripple ================= */
let lastRoute = null;
function countUp(el) {
  const raw = el.textContent.trim(), m = raw.match(/^(₹)?([\d,]+(?:\.\d+)?)(.*)$/); if (!m || el.children.length) return;
  const target = parseFloat(m[2].replace(/,/g, '')), dec = (m[2].split('.')[1] || '').length, indian = !!m[1] || m[2].includes(','); if (!isFinite(target) || target === 0) return;
  const fmt = v => (m[1] || '') + (indian ? v.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec)) + m[3], t0 = performance.now(), D = 900;
  el.textContent = fmt(0); const step = t => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(target * e); if (k < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = raw; }; requestAnimationFrame(step);
}
function enhance() {
  const v = $('#view'); if (!v) return; const changed = location.hash !== lastRoute; lastRoute = location.hash; v.classList.toggle('enter', changed);
  if (changed) { $$('.card,.kpi,.kcol,.chan', v).forEach((el, i) => el.style.setProperty('--i', Math.min(i, 14))); $$('tbody tr', v).forEach((tr, i) => tr.style.setProperty('--r', Math.min(i, 16))); $$('.kpi .v, [data-count], .sum-chip b', v).forEach(countUp); }
}
document.addEventListener('pointerdown', e => { const b = e.target.closest('.btn'); if (!b || b.disabled) return; const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height), x = document.createElement('span'); x.className = 'ripple'; x.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`; b.appendChild(x); setTimeout(() => x.remove(), 650); });
const _r5 = render;
render = function () { _r5(); renderBars(); enhance(); if (!REM.started) { REM.started = true; setInterval(remTick, 15000); setInterval(syncPresence, 60000); registerSW(); setTimeout(() => { syncPresence(); remTick(); }, 800); } };
const _lo2 = logout; logout = function () { _lo2(); lastRoute = null; };
const _boot2 = boot; boot = function () { _boot2(); lastRoute = null; };
