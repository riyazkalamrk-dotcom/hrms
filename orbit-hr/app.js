'use strict';
/* ============ Orbit HR — core: helpers, data, auth, shell ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = p => p + Math.random().toString(36).slice(2, 8);
const iso = d => { const z = d.getTimezoneOffset(); return new Date(d.getTime() - z * 60000).toISOString().slice(0, 10); };
const TODAY = () => iso(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const dow = s => new Date(s + 'T00:00:00').getDay();
const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtShort = s => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const monthName = ym => new Date(ym + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const DEMO = { off: +(localStorage.getItem('orbit_demo_off') || 0) };
const nowDate = () => new Date(Date.now() + DEMO.off * 60000);
const nowHM = () => { const d = nowDate(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const hm2m = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const ymOf = s => s.slice(0, 7);
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
const sum = (a, f = x => x) => a.reduce((t, x) => t + f(x), 0);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10', users: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2', calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
  wallet: 'M3 7h18v12H3zM3 7l3-4h12l3 4M16 13h2', briefcase: 'M3 7h18v13H3zM8 7V4h8v3M3 13h18',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  check: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11', help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6', org: 'M12 3v6M5 21v-6h14v6M12 9v6M3 21h4M10 21h4M17 21h4', file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0', search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14', moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z', logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  mega: 'M3 11v2a1 1 0 0 0 1 1h3l8 4V6L7 10H4a1 1 0 0 0-1 1M19 8a5 5 0 0 1 0 8', spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
  menu: 'M3 6h18M3 12h18M3 18h18', x: 'M18 6L6 18M6 6l12 12', download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12M8.2 13.9L7 23l5-3 5 3-1.2-9.1', eye: 'M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10', send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z', printer: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z'
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24"><path d="${ICONS[n] || ''}"/></svg>`;

/* ---------------- Data ---------------- */
const KEY = 'orbit_hr_db_v3';
const HOLIDAYS = [['2026-01-26', 'Republic Day'], ['2026-03-04', 'Holi'], ['2026-08-15', 'Independence Day'], ['2026-10-02', 'Gandhi Jayanti'], ['2026-10-20', 'Dussehra'], ['2026-11-08', 'Diwali'], ['2026-12-25', 'Christmas']];
const isHoliday = d => HOLIDAYS.find(h => h[0] === d);
const LEAVE_TYPES = { CL: 'Casual Leave', SL: 'Sick Leave', EL: 'Earned Leave', CO: 'Comp Off', LOP: 'Loss of Pay' };
const DEPTS = ['Management', 'Sales', 'Channel Partners', 'Site Operations', 'Property Management', 'Legal & Documentation', 'Marketing & CRM', 'Accounts & Finance', 'HR & Admin'];
const COLORS = ['#0f766e', '#7c3aed', '#2563eb', '#c2410c', '#be185d', '#4d7c0f', '#b45309', '#0e7490', '#6d28d9', '#047857'];
const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
const ONB_TASKS = [['Sign offer letter & contract', 'Employee'], ['Submit ID, address & education proofs', 'Employee'], ['Add bank & PF details for payroll', 'Employee'], ['Laptop & accessories issued', 'IT'], ['Email, Slack & HRMS accounts created', 'IT'], ['Complete security awareness training', 'Employee'], ['Meet your buddy & manager', 'HR'], ['30-day check-in conversation', 'HR']];

const seedShift = dept => { const d = SEEDS.departments.find(x => x.title === dept); return SEEDS.shifts.find(s => s.name === d?.shift) || SEEDS.shifts[0]; };
function seed() {
  return { v: 1, company: '', employees: [], att: {}, leaves: [], regs: [], claims: [], jobs: [], cands: [], goals: [], reviews: [], kudos: [], tickets: [], news: [], tasks: [], notes: [], audit: [{ ts: Date.now(), who: 'System', msg: 'Workspace created' }], acks: {}, payruns: {}, faces: {},
    settings: { quota: { CL: 12, SL: 10, EL: 15, CO: 2 }, shiftStart: '09:30', lateAfter: '09:45' } };
}
let DB; const load = () => { try { DB = JSON.parse(localStorage.getItem(KEY)); } catch { } if (!DB || DB.v !== 1) { DB = seed(); save(); } };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch { } };
const log = msg => { DB.audit.unshift({ ts: Date.now(), who: SESSION ? me().name : 'System', msg }); DB.audit.length = Math.min(DB.audit.length, 200); };
const notify = (to, msg) => { DB.notes.unshift({ id: uid('n'), to, msg, ts: Date.now(), read: false }); try { window.notifyHook?.(to, msg); } catch { } };

/* ---------------- domain helpers ---------------- */
let SESSION = null;
const emp = id => DB.employees.find(e => e.id === id);
const me = () => emp(SESSION.id);
const reportsOf = id => DB.employees.filter(e => e.mgr === id && e.status !== 'Exited');
const isHR = () => can('hr.panel');
const isAdmin = () => can('settings.manage');
const isMgr = () => can('team.manage') && reportsOf(me().id).length > 0;
const activeEmps = () => DB.employees.filter(e => e.status !== 'Exited');
const initials = n => n.split(' ').map(x => x[0]).slice(0, 2).join('');
const avatar = (e, c = '') => e ? (e.photo ? `<span class="avatar ${c}" style="background:url(${e.photo}) center/cover" title="${esc(e.name)}"></span>` : `<span class="avatar ${c}" style="background:${e.color}" title="${esc(e.name)}">${initials(e.name)}</span>`) : '';
const person = e => e ? `<div class="row">${avatar(e)}<div><div style="font-weight:600">${esc(e.name)}</div><div class="muted small">${esc(e.title)}</div></div></div>` : '—';
function leaveDays(f, t, id) { let n = 0; const e = id ? emp(id) : null; for (let d = f; d <= t; d = addDays(d, 1)) { if (e) { if (dayPlan(e, d).t === 'work') n++; } else if (dow(d) % 6 !== 0 && !isHoliday(d)) n++; } return n; }
function leaveBalance(id, type) {
  const q = DB.settings.quota[type]; if (q === undefined) return { quota: Infinity, used: 0, pending: 0, left: Infinity };
  const y = TODAY().slice(0, 4); const ls = DB.leaves.filter(l => l.emp === id && l.type === type && l.from.startsWith(y));
  const used = sum(ls.filter(l => l.status === 'Approved'), l => l.days), pending = sum(ls.filter(l => l.status === 'Pending'), l => l.days);
  return { quota: q, used, pending, left: q - used - pending };
}
const hoursOf = r => (r && r.in && r.out) ? Math.max(0, (hm2m(r.out) - hm2m(r.in)) / 60) : 0;
const mm2hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function assignFor(e, d) { return DB.roster?.[d]?.[e.id]; }
function shiftOf(e, d) { const a = assignFor(e, d || TODAY()), sh = rows('shifts'); if (a && a !== 'OFF') { const x = sh.find(y => y.id === a); if (x) return x; } const dp = rows('departments').find(y => y.title === e.dept); return sh.find(y => y.name === dp?.shift) || sh[0]; }
function dayPlan(e, d) { const a = assignFor(e, d), h = isHoliday(d), lv = DB.leaves.find(l => l.emp === e.id && l.status === 'Approved' && d >= l.from && d <= l.to); if (a === 'OFF') return { t: 'off', lv }; if (a === undefined) { if (dow(d) % 6 === 0) return { t: 'off', legacy: true, lv }; if (h) return { t: 'holiday', h: h[1], lv }; } return { t: 'work', shift: shiftOf(e, d), assigned: a !== undefined, lv }; }
const lateLimit = (e, d) => mm2hm(hm2m(shiftOf(e, d).start) + 15);
function dayStatus(id, d) {
  const e = emp(id), T = TODAY();
  if (d > T) return { s: 'future' }; if (d < e.joined || (e.exit && d > e.exit)) return { s: 'na' };
  const pl = dayPlan(e, d), worked = DB.att[id]?.[d]; if (pl.t === 'off' && !(worked && worked.in)) return { s: 'weekend', roster: !pl.legacy }; if (pl.t === 'holiday' && !(worked && worked.in)) return { s: 'holiday', h: pl.h };
  const lv = DB.leaves.find(l => l.emp === id && l.status === 'Approved' && d >= l.from && d <= l.to); if (lv) return { s: 'leave', lv };
  const r = DB.att[id]?.[d]; if (r?.absent) return { s: 'absent', r, manual: true }; if (!r) return d === T ? { s: 'notin' } : { s: 'absent' };
  if (!r.out) return d === T ? { s: r.mode === 'WFH' ? 'wfh' : 'present', r, working: true } : { s: 'half', r };
  const h = hoursOf(r); if (h < 4.5) return { s: 'half', r, h }; if (r.mode === 'WFH') return { s: 'wfh', r, h };
  return { s: r.in > lateLimit(e, d) ? 'late' : 'present', r, h };
}
const STATUS_LABEL = { present: 'Present', late: 'Late', wfh: 'WFH', half: 'Half day', absent: 'Absent', leave: 'On leave', holiday: 'Holiday', weekend: 'Day off', notin: 'Not in yet', na: '—', future: '' };
const STATUS_BADGE = { present: 'ok', late: 'warn', wfh: 'info', half: 'warn', absent: 'bad', leave: 'vio', holiday: 'acc', notin: '', weekend: '' };
const SEEDS = {}; const clone = o => JSON.parse(JSON.stringify(o));
const rows = k => { DB.ent ??= {}; return DB.ent[k] ??= clone(SEEDS[k] || []); };
const branchOf = e => e.branch || rows('branches')[0]?.id || 'B1';
function taxAnnual(gross, cfg) {
  const c = cfg || PCFG(), ti = Math.max(0, gross - c.stdDed); if (ti <= c.rebateLimit) return 0; let t = 0;
  for (const s of rows('taxslabs').filter(s => s.status === 'Active').sort((a, b) => a.min - b.min)) { const lo = +s.min, hi = +s.max || Infinity; if (ti > lo) t += (Math.min(ti, hi) - lo) * (+s.rate / 100); }
  return t * (1 + c.cess / 100);
}
function payslip(id, ym) {
  const e = emp(id), C = PCFG(), st = structOf(e, ym), ctc = +st.ctc, gross = ctc / 12, basic = gross * (st.basicPct ?? C.basicPct) / 100, hra = (C.hraOn === 'basic' ? basic : gross) * (st.hraPct ?? C.hraPct) / 100;
  const val = (a, base) => a.amtType === 'Percent of basic' ? base * (+a.amount) / 100 : +a.amount;
  const alw = rows('allowances').filter(a => a.status === 'Active' && +a.amount > 0).map(a => [a.name, val(a, basic)]);
  const xin = (st.earn || []).filter(x => +x.amt > 0 && !x.top).map(x => [x.name, +x.amt]), xtop = (st.earn || []).filter(x => +x.amt > 0 && x.top).map(x => [x.name, +x.amt]);
  const special = Math.max(0, gross - basic - hra - sum(alw, x => x[1]) - sum(xin, x => x[1]));
  const start = ym + '-01', last = addDays(addDays(start, 32).slice(0, 8) + '01', -1), T = TODAY(), div = lopDivFor(ym); let lop = 0, work = 0, lates = 0;
  for (let d = start; d <= last; d = addDays(d, 1)) { const s = dayStatus(id, d); if (['weekend', 'holiday', 'na', 'future'].includes(s.s)) continue; work++; if (s.s === 'absent' || (s.s === 'leave' && s.lv.type === 'LOP')) lop++; if (s.s === 'late') lates++; }
  const lopAmt = gross / div * lop, slab = rows('pfslabs').find(s => s.status === 'Active' && gross >= +s.min && gross <= +s.max), pfRate = slab ? +slab.empRate : C.pfEE;
  const pfWage = st.pf === 'none' ? 0 : (st.pf === 'actual' || !C.pfCapOn ? basic : Math.min(basic, C.pfCap)), pf = pfWage * pfRate / 100, pt = st.pt === 'none' ? 0 : (gross > C.ptMinGross ? C.ptAmt : 0);
  const tds = st.tdsMode === 'none' ? 0 : st.tdsMode === 'fixed' ? (+st.tdsAmt || 0) : taxAnnual(ctc, C) / 12;
  const reimb = sum(DB.claims.filter(c => c.emp === id && c.status === 'Approved' && ymOf(c.date) === ym), c => c.amount);
  const earn = [['Basic', basic], ['House Rent Allowance', hra], ...alw, ...xin, ['Special Allowance', special], ...xtop]; if (reimb) earn.push(['Reimbursements', reimb]);
  const ded = [[`Provident Fund (${pfRate}%)`, pf], ['Professional Tax', pt], ['Income Tax (TDS)', tds]];
  (st.ded || []).filter(x => +x.amt > 0).forEach(x => ded.push([x.name, +x.amt]));
  rows('deductions').filter(a => a.status === 'Active' && +a.amount > 0).forEach(a => ded.push([a.name, val(a, basic)]));
  const ym2n = x => +x.slice(0, 4) * 12 + +x.slice(5, 7);
  rows('loans').filter(l => l.emp === id && l.status === 'Approved' && +l.installment > 0).forEach(l => { const k = ym2n(ym) - ym2n(l.start.slice(0, 7)), n = Math.ceil(+l.amount / +l.installment); if (k >= 0 && k < n) ded.push(['Loan EMI', Math.min(+l.installment, +l.amount - +l.installment * k)]); });
  rows('advances').filter(a => a.emp === id && a.status === 'Approved' && a.month === ym).forEach(a => ded.push(['Salary advance recovery', +a.amount]));
  const rule = rows('tardyrules').find(r => r.status === 'Active'); if (rule && lates > +rule.allowed && +rule.deduction > 0) ded.push([`Late-arrival penalty (${lates - rule.allowed}×)`, (lates - +rule.allowed) * +rule.deduction]);
  if (lop) ded.push([`Loss of Pay (${lop}d)`, lopAmt]);
  if (C.round === 'rupee') { earn.forEach(x => { x[1] = Math.round(x[1]); }); ded.forEach(x => { x[1] = Math.round(x[1]); }); }
  const g = sum(earn, x => x[1]), d = sum(ded, x => x[1]);
  return { id, ym, earn, ded, gross: g, deductions: d, net: g - d, lop, work, pf, empPf: pf, lates, ctc };
}

/* ---------------- UI primitives ---------------- */
function toast(msg, type = 'ok') { const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3800); }
function modal(title, body, onOk, okLabel = 'Save', wide = false) {
  const m = document.createElement('div'); m.className = 'modal-bg';
  m.innerHTML = `<form class="modal ${wide ? 'wide' : ''}"><header><h3>${title}</h3><button type="button" class="icon-btn" data-close>${ic('x')}</button></header><div class="mbody">${body}</div>${onOk ? `<footer><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">${okLabel}</button></footer>` : ''}</form>`;
  document.body.appendChild(m); const close = () => m.remove();
  m.addEventListener('mousedown', e => { if (e.target === m) close(); });
  m.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  m.querySelector('form').addEventListener('submit', e => { e.preventDefault(); if (!onOk) return; const d = Object.fromEntries(new FormData(e.target)); const r = onOk(d, m); if (r && typeof r.then === 'function') { r.then(v => { if (v !== false) close(); }).catch(er => toast(er.message || 'Something went wrong', 'err')); } else if (r !== false) close(); });
  m.querySelector('input:not([type=hidden]),select,textarea')?.focus(); return m;
}
const confirmBox = (msg, fn) => modal('Please confirm', `<p style="margin:0">${msg}</p>`, () => { fn(); }, 'Confirm');
const fld = (label, name, val = '', type = 'text', extra = '', cls = '') => `<label class="f ${cls}">${label}<input class="input" name="${name}" type="${type}" value="${esc(val)}" ${extra}></label>`;
const sel = (label, name, opts, val = '', cls = '', extra = '') => `<label class="f ${cls}">${label}<select class="select" name="${name}" ${extra}>${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${v == val ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select></label>`;
function download(name, text, mime = 'text/csv') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
const csv = rows => rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

/* charts */
function barChart(data, { h = 170, color = 'var(--accent)', fmt = x => x } = {}) {
  const max = Math.max(...data.map(d => d.v), 1), w = 100 / data.length;
  return `<svg viewBox="0 0 ${data.length * 60} ${h + 34}" style="width:100%;height:auto">${data.map((d, i) => { const bh = d.v / max * h; return `<g><rect x="${i * 60 + 10}" y="${h - bh + 6}" width="40" height="${bh}" rx="6" class="cbar" style="--d:${i * 70}ms" fill="${d.c || color}" opacity=".9"><title>${esc(d.l)}: ${fmt(d.v)}</title></rect><text x="${i * 60 + 30}" y="${h - bh}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)">${fmt(d.v)}</text><text x="${i * 60 + 30}" y="${h + 22}" text-anchor="middle" font-size="10" fill="var(--muted)">${esc(d.l.length > 9 ? d.l.slice(0, 8) + '…' : d.l)}</text></g>`; }).join('')}</svg>`;
}
function donut(data, size = 150) {
  const tot = sum(data, d => d.v) || 1; let off = 0; const r = 52, c = 2 * Math.PI * r;
  return `<div class="row" style="gap:20px"><svg viewBox="0 0 140 140" width="${size}" height="${size}"><g transform="rotate(-90 70 70)">${data.map(d => { const len = d.v / tot * c, s = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${d.c}" stroke-width="22" class="cdn" style="--len:${len};--c:${c}" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}"><title>${esc(d.l)}: ${d.v}</title></circle>`; off += len; return s; }).join('')}</g><text x="70" y="75" text-anchor="middle" font-size="22" font-weight="800" fill="var(--ink)">${tot}</text></svg><div class="col" style="gap:4px">${data.map(d => `<div class="small"><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${d.c};margin-right:6px"></i>${esc(d.l)} <b>${d.v}</b></div>`).join('')}</div></div>`;
}
function lineChart(pts, { h = 140, fmt = x => x } = {}) {
  if (!pts.length) return ''; const max = Math.max(...pts.map(p => p.v), 1), min = Math.min(...pts.map(p => p.v)), W = 600, rngv = (max - min) || 1;
  const xy = pts.map((p, i) => [i / (pts.length - 1 || 1) * (W - 20) + 10, h - 14 - (p.v - min) / rngv * (h - 34)]);
  const path = xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return `<svg viewBox="0 0 ${W} ${h + 16}" style="width:100%;height:auto"><path class="car" d="${path} L${xy.at(-1)[0]} ${h} L${xy[0][0]} ${h}Z" fill="var(--accent)" opacity=".12"/><path class="cln" pathLength="1" d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>${xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="var(--accent)"><title>${esc(pts[i].l)}: ${fmt(pts[i].v)}</title></circle>`).join('')}<text x="10" y="${h + 12}" font-size="10" fill="var(--muted)">${esc(pts[0].l)}</text><text x="${W - 10}" y="${h + 12}" text-anchor="end" font-size="10" fill="var(--muted)">${esc(pts.at(-1).l)}</text></svg>`;
}

/* ---------------- Auth + login ---------------- */
function restoreSession() { try { const s = localStorage.getItem('orbit_session') || sessionStorage.getItem('orbit_session'); if (s) { const o = JSON.parse(s); if (emp(o.id) && emp(o.id).status !== 'Exited') SESSION = o; } } catch { } }
function loginView() {
  $('#app').innerHTML = `<div class="login ${BR.skyline === false ? 'noskyline' : ''}"><section class="login-art ${BR.loginBg ? 'hasbg' : ''}" ${BR.loginBg ? `style="--loginbg:url('${BR.loginBg}')"` : ''}><div class="stars"></div><div class="brand">${brandMark()}${esc(BR.name)}</div>
  <div class="art-copy">${loginHero()}
  <div class="feat">${BR.features.map((f, i) => `<div style="--i:${i}">${ic('check')}${f}</div>`).join('')}</div></div>
  <svg class="skyline" viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2dd4bf" stop-opacity=".35"/><stop offset="1" stop-color="#0b1c30" stop-opacity="0"/></linearGradient></defs>
   <circle class="sun" cx="640" cy="110" r="46" fill="#f5c451" opacity=".9"/><g class="clouds"><ellipse cx="150" cy="70" rx="46" ry="12" fill="#fff" opacity=".12"/><ellipse cx="190" cy="62" rx="30" ry="10" fill="#fff" opacity=".12"/><ellipse cx="520" cy="40" rx="50" ry="12" fill="#fff" opacity=".1"/></g>
   ${[[40, 120, 70], [120, 170, 60], [190, 90, 54], [250, 200, 80], [340, 140, 64], [414, 230, 70], [494, 130, 60], [564, 180, 76], [650, 110, 58], [718, 160, 70]].map((b, i) => `<g class="bld" style="--i:${i}"><rect x="${b[0]}" y="${300 - b[1]}" width="${b[2]}" height="${b[1]}" fill="#10304f" stroke="#1d4a73" stroke-width="1"/>${Array.from({ length: Math.floor(b[1] / 26) * 3 }, (_, k) => `<rect class="win" style="--w:${(i * 7 + k * 3) % 9}" x="${b[0] + 8 + (k % 3) * (b[2] / 3.2)}" y="${300 - b[1] + 10 + Math.floor(k / 3) * 26}" width="${b[2] / 6}" height="10" rx="1.5" fill="#f5c451"/>`).join('')}</g>`).join('')}
   <g class="crane"><path d="M470 70V0M470 8h120M470 8l-26 26M590 8v40" stroke="#f5c451" stroke-width="3" fill="none"/><rect x="580" y="46" width="20" height="14" fill="#f5c451"/></g><rect x="0" y="296" width="800" height="4" fill="#0b1c30"/></svg>
  <div class="small" style="color:#6c8a86;position:relative;z-index:2">${esc(BR.footer)}${BR.support ? ' · ' + esc(BR.support) : ''}</div></section>
  <section class="login-form"><div class="login-card"><h2>Welcome back 👋</h2><p class="muted" style="margin:0 0 22px">Sign in to ${esc(BR.name)} ${esc(BR.product)}</p>
  <form id="lf" class="col" style="gap:14px" autocomplete="on">
   <label class="f">Work email<input class="input" id="em" name="email" type="email" autocomplete="username" placeholder="you@company.com" required></label>
   <label class="f">Password<span style="position:relative"><input class="input" id="pw" name="password" type="password" autocomplete="current-password" required style="padding-right:64px"><button type="button" data-act="togglepw" class="btn sm ghost" style="position:absolute;right:5px;top:4px;border:0">Show</button></span></label>
   <div class="row between"><label class="row small" style="cursor:pointer"><input type="checkbox" id="rm" checked> Keep me signed in</label><a href="#" data-act="forgot" class="small">Forgot password?</a></div>
   <div id="lerr" class="small" style="color:var(--red);min-height:18px"></div>
   <button class="btn primary" style="justify-content:center;padding:11px">Sign in</button></form>
  <p class="small muted" style="margin-top:18px">For your security, sign-in locks for 60 seconds after 5 wrong attempts.</p></div></section></div>`;
  $('#lf').addEventListener('submit', e => {
    e.preventDefault(); const lock = JSON.parse(localStorage.getItem('orbit_lock') || '{"n":0,"until":0}');
    if (Date.now() < lock.until) { $('#lerr').textContent = `Too many attempts. Try again in ${Math.ceil((lock.until - Date.now()) / 1000)}s.`; return; }
    const em = $('#em').value.trim().toLowerCase(), pw = $('#pw').value; const u = DB.employees.find(x => x.email.toLowerCase() === em);
    if (!u || u.pass !== pw || u.status === 'Exited') { lock.n++; if (lock.n >= 5) { lock.until = Date.now() + 60000; lock.n = 0; } localStorage.setItem('orbit_lock', JSON.stringify(lock)); $('#lerr').textContent = lock.until > Date.now() ? 'Account locked for 60 seconds.' : 'Incorrect email or password.'; return; }
    localStorage.removeItem('orbit_lock'); SESSION = { id: u.id }; const s = JSON.stringify(SESSION); (e.target.querySelector('#rm').checked ? localStorage : sessionStorage).setItem('orbit_session', s);
    log('Signed in'); save(); briefedThisLoad = false; boot(); location.hash = landingHash(); render();
  });
}
function logout() { localStorage.removeItem('orbit_session'); sessionStorage.removeItem('orbit_session'); SESSION = null; location.hash = ''; boot(); }

/* ---------------- Shell + router ---------------- */
const PAGES = [
  ['dashboard', 'Dashboard', 'home'], ['employees', 'People', 'users'], ['attendance', 'Attendance', 'clock'], ['leave', 'Leave', 'calendar'], ['payroll', 'Payroll', 'wallet'],
  ['recruitment', 'Recruitment', 'briefcase', () => isHR() || isMgr()], ['performance', 'Performance', 'target'], ['onboarding', 'Onboarding', 'check'], ['helpdesk', 'Helpdesk', 'help'],
  ['meetings', 'Meetings', 'calendar'], ['assets', 'Assets', 'shield'], ['documents', 'Policies & docs', 'file'], ['org', 'Org chart', 'org'], ['lifecycle', 'Lifecycle', 'award', () => isHR()], ['organisation', 'Organisation', 'settings', () => isHR()], ['reports', 'Reports', 'chart', () => isHR() || isMgr()], ['settings', 'Settings', 'settings', () => isAdmin()]
];
const S = { emp: { q: '', dept: '', status: 'Active', view: 'cards' }, tab: {}, calMonth: null, calEmp: null, payYm: null, jobF: '' };
function pendingCount() {
  const m = me(); let n = DB.leaves.filter(canApproveLeave).length + DB.regs.filter(canApproveReg).length + DB.claims.filter(canApproveClaim).length; return n;
}
const canApproveLeave = l => l.status === 'Pending' && l.emp !== me().id && (emp(l.emp).mgr === me().id || (isHR() && true));
const canApproveReg = r => r.status === 'Pending' && r.emp !== me().id && (emp(r.emp).mgr === me().id || isHR());
const canApproveClaim = c => c.status === 'Pending' && c.emp !== me().id && (emp(c.emp).mgr === me().id || isHR());
function shell() {
  const u = me(), cur = (location.hash.split('/')[1] || 'dashboard'), pc = pendingCount(), unread = DB.notes.filter(n => n.to === u.id && !n.read).length;
  $('#app').innerHTML = `<div class="shell ${sideClass()}">${sideHtml(u, cur, pc)}
  <div class="main"><div class="top"><button class="icon-btn menu-btn" data-act="menu">${ic('menu')}</button><div class="searchbox" data-act="palette">${ic('search')}<span>Search people, pages, actions…</span><kbd>Ctrl K</kbd></div><select class="select" data-chg="branch" title="Branch" style="width:auto;max-width:180px">${'<option value="">All branches</option>' + rows('branches').filter(b => b.status !== 'Inactive').map(b => `<option value="${b.id}" ${S.branch === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select><div class="right row" style="gap:4px;position:relative">
  <button class="icon-btn" data-act="theme" title="Toggle theme">${ic('moon')}</button><button class="icon-btn" data-act="notes" title="Notifications">${ic('bell')}${unread ? `<span class="dot">${unread}</span>` : ''}</button><div id="notemenu"></div></div></div>
  <div id="alertbar"></div><main class="view" id="view"></main></div></div>
  <button class="fab" data-act="chat" title="Orbit Assistant">${ic('spark')}</button><div id="chatbox"></div>`;
}
function render() {
  if (!SESSION) return; const a = document.activeElement, id = a?.id, pos = a?.selectionStart; const scroll = window.scrollY;
  const [, name = 'dashboard', arg] = location.hash.split('/'); const fn = PAGE_FN[name] || PAGE_FN.dashboard;
  if (!$('#view')) shell(); else { shell(); }
  $('#view').innerHTML = fn(arg); document.title = (PAGES.find(p => p[0] === name)?.[1] || BR.short) + ' · ' + BR.short;
  if (id) { const n = document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch { } } } window.scrollTo(0, scroll);
}
const PAGE_FN = {};
function boot() { load(); restoreSession(); const t = localStorage.getItem('orbit_theme'); if (t) document.documentElement.dataset.theme = t; if (!SESSION) loginView(); else { if (!location.hash) location.hash = landingHash(); render(); } }
window.addEventListener('hashchange', () => { if (SESSION) { render(); window.scrollTo(0, 0); } });
setInterval(() => { const c = $('#clk'); if (c) c.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }, 1000);

