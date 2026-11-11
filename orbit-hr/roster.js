'use strict';
/* ============ Orbit Realty — duty roster: rotational shifts + rotational offs (no fixed weekly off) ============
   DB.roster[date][empId] = shiftId | 'OFF'.  No entry = the department's default shift (legacy Sat/Sun off for dates before the roster starts). */
const SH_COLORS = ['#0f766e', '#2563eb', '#c2410c', '#7c3aed', '#be185d', '#4d7c0f', '#b45309', '#0e7490'];
const shiftColor = s => SH_COLORS[Math.max(0, rows('shifts').findIndex(x => x.id === s.id)) % SH_COLORS.length];
const shiftCode = s => (s.code || s.name.replace(/ Shift$/i, '').slice(0, 2)).toUpperCase();
const weekStart = d => addDays(d, -((dow(d) + 6) % 7));
const ROT_DEPTS = ['Site Operations', 'Property Management', 'Sales', 'Channel Partners'];
const ROSTER_ANCHOR = '2026-01-05';
const shiftByName = n => rows('shifts').find(s => s.name === n);
const defaultShiftOf = e => { const dp = rows('departments').find(x => x.title === e.dept); return shiftByName(dp?.shift) || rows('shifts')[0]; };
const effAssign = (e, d) => { const p = dayPlan(e, d); return p.t === 'off' ? 'OFF' : p.t === 'work' ? p.shift.id : undefined; };
function setAssign(empId, date, val) { DB.roster ??= {}; if (val === undefined || val === '') { if (DB.roster[date]) { delete DB.roster[date][empId]; if (!Object.keys(DB.roster[date]).length) delete DB.roster[date]; } return; } (DB.roster[date] ??= {})[empId] = val; }

/* shared rotation maths (used by the seed and by the auto-rotate wizard) */
function patternAssign(i, e, date, o) {
  const wk = Math.floor(daysBetween(ROSTER_ANCHOR, date) / 7), d = dow(date), off1 = (((i * 2 - wk) % 7) + 7) % 7; let off = d === off1;
  if (o.off === 'two') off = d === off1 || d === (off1 + 3) % 7; if (o.off === 'none') off = false;
  if (off) return 'OFF'; const M = shiftByName('Morning Shift'), G = shiftByName('General Shift'), E = shiftByName('Evening Shift');
  if (o.shift === 'rot3' && M && G && E) return [M, G, E][(i + wk) % 3].id; if (o.shift === 'rot2' && M && E) return [M, E][(i + wk) % 2].id; return defaultShiftOf(e).id;
}

/* ---------- migration: create a rotational roster + matching attendance history once ---------- */
function ensureRoster() {
  DB.roster ??= {}; const sh = rows('shifts');
  [['Morning Shift', '07:00', '15:00', 'M'], ['General Shift', '09:30', '18:30', 'G'], ['Evening Shift', '13:00', '21:00', 'E']].forEach(([name, start, end, code]) => { if (!sh.some(s => s.name === name)) { const n = Math.max(0, ...sh.map(s => +String(s.id).replace(/\D/g, '') || 0)) + 1; sh.push({ id: 'S' + n, name, start, end, maxOT: 2, tardy: 'Yes', code }); } });
  [['Office Shift', 'OF'], ['Site Shift', 'ST'], ['Sales Shift', 'SL']].forEach(([n, c]) => { const s = shiftByName(n); if (s && !s.code) s.code = c; });
  DB.settings.minCover ??= 50; if (DB.rosterV >= 2) return; DB.rosterV = 2; DB.roster ??= {}; DB.swaps ??= []; save(); return; /* live: HR builds the roster; no generated history */
  const T = TODAY(), R = rng(77), from = addDays(T, -60), to = addDays(T, 35), byDept = {};
  DB.employees.filter(e => e.status !== 'Exited').forEach(e => (byDept[e.dept] ??= []).push(e)); Object.values(byDept).forEach(a => a.sort((x, y) => x.id < y.id ? -1 : 1));
  for (let d = from; d <= to; d = addDays(d, 1)) { if (isHoliday(d)) continue; DB.employees.forEach(e => { if (e.status === 'Exited' && !(e.exit && d <= e.exit)) return; if (d < e.joined || (e.exit && d > e.exit)) return; const i = (byDept[e.dept] || []).indexOf(e); setAssign(e.id, d, patternAssign(Math.max(0, i), e, d, { off: 'one', shift: ROT_DEPTS.includes(e.dept) ? 'rot3' : 'keep' })); }); }
  // history that matches the roster (seeded rows only; real punches with evidence are kept)
  const f = mm2hm, nowM = hm2m(nowHM());
  DB.employees.forEach(e => { DB.att[e.id] ||= {}; for (let d = from; d <= T; d = addDays(d, 1)) { const old = DB.att[e.id][d]; if (old && (old.v || old.reason || old.manual)) continue; delete DB.att[e.id][d];
    const pl = dayPlan(e, d); if (pl.t !== 'work' || pl.lv || e.status === 'Exited' && e.exit && d > e.exit) continue; const sM = hm2m(pl.shift.start), eM = hm2m(pl.shift.end);
    if (d === T) { if (e.id === 'E004' || e.id === 'E010' || e.id === 'E023' || R() < .08) continue; const inM = sM + Math.floor(R() * 24) - 12; if (nowM < inM) continue; const rec = { in: f(inM), out: null, mode: 'Office' }; if (nowM > eM && R() < .55) rec.out = f(eM + Math.floor(R() * 25)); DB.att[e.id][d] = rec; continue; }
    if (R() < .02) continue; const inM = sM + Math.floor(R() * 40) - 20 + (R() < .12 ? 25 : 0), outM = Math.max(inM + 60, eM + Math.floor(R() * 70) - 10 - (R() < .05 ? 200 : 0));
    DB.att[e.id][d] = { in: f(inM), out: f(outM), mode: R() < (ROT_DEPTS.includes(e.dept) ? .02 : .1) ? 'WFH' : 'Office', breaks: [{ s: f(sM + 240), e: f(sM + 285), why: 'Lunch' }] }; } });
  save();
}
const _boot7 = boot; boot = function () { load(); ensureRoster(); _boot7(); };

/* ---------- coverage ---------- */
function coverage(date, people) {
  const by = {}; people.forEach(e => { const p = dayPlan(e, date), o = (by[e.dept] ??= { n: 0, w: 0 }); o.n++; if (p.t === 'work' && !p.lv) o.w++; });
  const min = (DB.settings.minCover ?? 50) / 100; return { total: sum(Object.values(by), v => v.w), low: Object.entries(by).filter(([, v]) => v.n >= 2 && v.w / v.n < min).map(([d, v]) => `${d} ${v.w}/${v.n}`) };
}
const chipHtml = (p, big) => { if (p.t === 'off') return `<span class="rchip off ${p.legacy ? 'legacy' : ''}">OFF</span>`; if (p.t === 'holiday') return `<span class="rchip hol" title="${esc(p.h)}">HOL</span>`; return `<span class="rchip" style="--c:${shiftColor(p.shift)}${p.assigned ? '' : ';opacity:.55'}" title="${esc(p.shift.name)} ${p.shift.start}–${p.shift.end}">${shiftCode(p.shift)}${big ? `<small>${p.shift.start}–${p.shift.end}</small>` : ''}${p.lv ? '<i>L</i>' : ''}</span>`; };

/* ================= PAGE ================= */
PAGE_FN.roster = () => {
  const canEdit = can('roster.manage'), tabs = [...(canEdit ? [['grid', 'Team roster']] : []), ['my', 'My duty calendar'], ['swaps', 'Swap requests']], t = tabOf('roster', canEdit ? 'grid' : 'my');
  return head('Duty roster', 'Rotational shifts and offs — no fixed weekly off') + tabsBar('roster', tabs, canEdit ? 'grid' : 'my') + (t === 'grid' ? rosterGrid() : t === 'swaps' ? swapsHtml() : `<div class="card">${dutyCalendarHtml(me())}</div>`);
};
function rosterGrid() {
  const T = TODAY(), start = S.rStart || weekStart(T), n = S.rDays || 14, days = Array.from({ length: n }, (_, i) => addDays(start, i)), dept = S.rDept || '';
  const people = scope().filter(e => e.status !== 'Exited' && (!dept || e.dept === dept)).sort((a, b) => a.dept === b.dept ? (a.name < b.name ? -1 : 1) : a.dept < b.dept ? -1 : 1), shifts = rows('shifts');
  const covs = days.map(d => coverage(d, people)), lowDays = covs.filter(c => c.low.length).length;
  return `<div class="toolbar"><button class="btn" data-act="rnav" data-v="-1">←</button><button class="btn" data-act="rnav" data-v="0">Today</button><button class="btn" data-act="rnav" data-v="1">→</button><b class="nowrap">${fmtShort(days[0])} – ${fmtShort(days.at(-1))}</b>
  <select class="select" data-chg="rdays">${[7, 14, 28].map(x => `<option value="${x}" ${x === n ? 'selected' : ''}>${x} days</option>`).join('')}</select><select class="select" data-chg="rdept"><option value="">All departments</option>${DEPTS.map(d => `<option ${d === dept ? 'selected' : ''}>${d}</option>`).join('')}</select>
  <span class="right row wrap"><button class="btn primary" data-act="rrotate">${ic('spark')} Auto-rotate</button><button class="btn" data-act="rcopy">Copy previous week</button><button class="btn" data-act="rclear">Clear range</button><button class="btn" data-act="rpublish">${ic('bell')} Publish &amp; notify</button><button class="btn" data-act="rcsv">${ic('download')} CSV</button></span></div>
  <div class="legend" style="margin-bottom:12px">${shifts.map(s => `<span class="rchip" style="--c:${shiftColor(s)}">${shiftCode(s)}</span><span class="small" style="margin-right:10px">${esc(s.name)} ${s.start}–${s.end}</span>`).join('')}<span class="rchip off">OFF</span><span class="small">Day off</span><span class="rchip hol">HOL</span><span class="small">Holiday</span><span class="muted small">· faded = default (not planned) · dashed OFF = legacy weekend</span></div>
  ${lowDays ? `<div class="abar warn nanim" style="border-radius:12px;margin-bottom:12px;padding:10px 16px"><span class="ico">${ic('clockalert')}</span><div class="t">Low coverage on ${lowDays} day${lowDays > 1 ? 's' : ''}<small>Fewer than ${DB.settings.minCover}% of a department is on duty — see the red cells in the bottom row.</small></div></div>` : ''}
  <div class="card pad0 tablewrap"><table class="rtab"><thead><tr><th class="stick">Person</th>${days.map(d => `<th class="tc ${d === T ? 'today' : ''} ${dow(d) % 6 === 0 ? 'wkend' : ''}"><div>${new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}</div><b>${+d.slice(8)}</b></th>`).join('')}<th class="tc">Offs</th></tr></thead><tbody>${people.map((e, idx) => { const pls = days.map(d => dayPlan(e, d)), offs = pls.filter(p => p.t === 'off').length, head_ = idx === 0 || people[idx - 1].dept !== e.dept; return (head_ ? `<tr class="rdept"><td colspan="${n + 2}">${esc(e.dept)}</td></tr>` : '') + `<tr><td class="stick">${person(e)}</td>${pls.map((p, i) => `<td class="rc ${days[i] < T ? 'past' : ''} ${days[i] === T ? 'today' : ''}" ${days[i] >= T ? `data-act="rcell" data-e="${e.id}" data-d="${days[i]}"` : ''}>${chipHtml(p)}</td>`).join('')}<td class="tc"><b>${offs}</b></td></tr>`; }).join('') || `<tr><td colspan="${n + 2}" class="empty">No people in this view.</td></tr>`}
  <tr class="rcov"><td class="stick"><b>On duty</b></td>${covs.map(c => `<td class="tc ${c.low.length ? 'low' : ''}" title="${esc(c.low.join(', ') || 'Coverage OK')}"><b>${c.total}</b>${c.low.length ? ' ⚠' : ''}</td>`).join('')}<td></td></tr></tbody></table></div>
  <p class="small muted" style="margin-top:10px">Click any future cell to change a person's shift or off day. Past days are locked because attendance and payroll already use them. Managers can edit their own team; HR can edit everyone.</p>`;
}
ACT.rnav = el => { const v = +el.dataset.v, n = S.rDays || 14; S.rStart = v === 0 ? weekStart(TODAY()) : addDays(S.rStart || weekStart(TODAY()), v * 7 * (n >= 14 ? 2 : 1)); render(); };
CHG.rdays = el => { S.rDays = +el.value; render(); }; CHG.rdept = el => { S.rDept = el.value; render(); };

/* ---------- edit one person / one range ---------- */
ACT.rcell = el => {
  const e = emp(el.dataset.e), d0 = el.dataset.d; if (!scope().some(x => x.id === e.id)) return toast('You can only edit your own team', 'err');
  const cur = DB.roster?.[d0]?.[e.id] ?? '', opts = [['OFF', 'Day off', 'var(--muted)'], ...rows('shifts').map(s => [s.id, `${s.name} · ${s.start}–${s.end}`, shiftColor(s)]), ['', 'Default (clear this assignment)', 'var(--line)']];
  modal(`${esc(e.name)} · ${fmtDate(d0)}`, `<div class="col" style="gap:8px">${opts.map(([v, l, c]) => `<label class="rpick"><input type="radio" name="val" value="${v}" ${cur === v ? 'checked' : ''}><span class="rchip" style="--c:${c}">${v === 'OFF' ? 'OFF' : v === '' ? '—' : shiftCode(rows('shifts').find(s => s.id === v))}</span><span>${esc(l)}</span></label>`).join('')}</div><div class="form-grid" style="margin-top:14px">${fld('From', 'from', d0, 'date', `min="${TODAY()}" required`)}${fld('To', 'to', d0, 'date', `min="${TODAY()}" required`)}${sel('Apply to', 'who', [[e.id, 'Only ' + e.name], ['dept', 'Everyone in ' + e.dept + ' (my scope)']], e.id, 'full')}</div>`, d => {
    if (d.val === undefined) { toast('Pick a shift or day off', 'err'); return false; } if (d.to < d.from) { toast('End date is before start date', 'err'); return false; }
    const targets = d.who === 'dept' ? scope().filter(x => x.dept === e.dept && x.status !== 'Exited') : [e]; let n = 0;
    for (let x = d.from; x <= d.to; x = addDays(x, 1)) { if (x < TODAY()) continue; targets.forEach(p => { if (x >= p.joined && !(p.exit && x > p.exit)) { setAssign(p.id, x, d.val); n++; } }); }
    const low = []; for (let x = d.from; x <= d.to; x = addDays(x, 1)) { const c = coverage(x, scope().filter(p => p.status !== 'Exited')); if (c.low.length) low.push(fmtShort(x) + ': ' + c.low.join(', ')); }
    log(`Roster: ${targets.length} person(s), ${d.from}→${d.to} = ${d.val || 'default'}`); save(); render(); toast(low.length ? `Saved — low coverage ${low[0]}` : `Roster updated (${n} day${n === 1 ? '' : 's'})`, low.length ? 'warn' : 'ok'); }, 'Save');
};

/* ---------- auto-rotate wizard ---------- */
ACT.rrotate = () => {
  const nextMon = addDays(weekStart(TODAY()), 7);
  modal('Auto-rotate roster', `<p class="muted small" style="margin-top:0">Builds fair rotating shifts and rotating off days. Each person’s off day moves forward every week and offs are staggered so the team is never all off together.</p><div class="form-grid">${sel('Who', 'dept', [['', 'Everyone in my scope'], ...DEPTS.map(d => [d, d])], S.rDept || '', 'full')}${fld('Start on a Monday', 'start', nextMon, 'date', `min="${TODAY()}" required`)}${fld('Number of weeks', 'weeks', 4, 'number', 'min="1" max="12" required')}
  ${sel('Shift pattern', 'shift', [['keep', 'Keep each person on their default shift'], ['rot3', 'Rotate weekly: Morning → General → Evening'], ['rot2', 'Rotate weekly: Morning ↔ Evening']], 'rot3', 'full')}${sel('Off-day pattern', 'off', [['one', '1 off per week — moves forward each week'], ['two', '2 offs per week — moving'], ['none', 'Don’t change offs (shifts only)']], 'one', 'full')}</div><label class="row small" style="margin-top:10px"><input type="checkbox" name="skipleave" checked> Leave existing approved leave untouched</label>`, d => {
    const st = weekStart(d.start); if (st < weekStart(TODAY())) { toast('Start in the current or a future week', 'err'); return false; } const people = scope().filter(e => e.status !== 'Exited' && (!d.dept || e.dept === d.dept)), byDept = {}; people.forEach(e => (byDept[e.dept] ??= []).push(e)); Object.values(byDept).forEach(a => a.sort((x, y) => x.id < y.id ? -1 : 1));
    let n = 0; for (let k = 0; k < +d.weeks * 7; k++) { const day = addDays(st, k); if (day < TODAY() || isHoliday(day)) continue; people.forEach(e => { if (day < e.joined || (e.exit && day > e.exit)) return; setAssign(e.id, day, patternAssign(Math.max(0, byDept[e.dept].indexOf(e)), e, day, { off: d.off, shift: d.shift })); n++; }); }
    const lows = []; for (let k = 0; k < +d.weeks * 7; k++) { const c = coverage(addDays(st, k), people); if (c.low.length) lows.push(c.low[0]); } log(`Auto-rotated roster: ${people.length} people × ${d.weeks} weeks`); S.rStart = st; save(); render(); toast(lows.length ? `Rotation built — ${lows.length} day(s) with low coverage to review` : `Rotation built for ${people.length} people (${d.weeks} weeks)`, lows.length ? 'warn' : 'ok'); }, 'Build roster');
};
ACT.rcopy = () => { const st = S.rStart || weekStart(TODAY()), people = scope().filter(e => e.status !== 'Exited' && (!S.rDept || e.dept === S.rDept)); let n = 0; for (let k = 0; k < 7; k++) { const d = addDays(st, k); if (d < TODAY()) continue; people.forEach(e => { const v = effAssign(e, addDays(d, -7)); setAssign(e.id, d, v); n++; }); } log('Copied previous week into roster'); save(); render(); toast(`Copied last week's pattern (${n} cells)`); };
ACT.rclear = () => confirmBox('Clear all planned shifts and offs in this range? People fall back to their default shift.', () => { const st = S.rStart || weekStart(TODAY()), n = S.rDays || 14, people = scope().filter(e => e.status !== 'Exited' && (!S.rDept || e.dept === S.rDept)); for (let k = 0; k < n; k++) { const d = addDays(st, k); if (d >= TODAY()) people.forEach(e => setAssign(e.id, d, undefined)); } save(); render(); toast('Range cleared'); });
ACT.rpublish = () => { DB.rosterPub ??= {}; const T = TODAY(); let sent = 0; scope().filter(e => e.status !== 'Exited' && e.id !== me().id).forEach(e => { const line = Array.from({ length: 7 }, (_, i) => { const d = addDays(T, i), p = dayPlan(e, d); return `${new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })} ${p.t === 'off' ? 'OFF' : p.t === 'holiday' ? 'HOL' : shiftCode(p.shift) + ' ' + p.shift.start}`; }).join(' · '); if (DB.rosterPub[e.id] !== line) { DB.rosterPub[e.id] = line; notify(e.id, '📅 Your duty roster was updated: ' + line); API.post('/api/push/send', { to: e.id, title: '📅 Duty roster updated', body: line, tag: 'roster-' + e.id }).catch(() => { }); sent++; } }); log('Published roster'); save(); toast(sent ? `Roster published — ${sent} people notified` : 'Nothing changed since the last publish'); };
ACT.rcsv = () => { const st = S.rStart || weekStart(TODAY()), n = S.rDays || 14, days = Array.from({ length: n }, (_, i) => addDays(st, i)); download(`roster-${st}.csv`, csv([['Employee', 'Department', ...days], ...scope().filter(e => e.status !== 'Exited').map(e => [e.name, e.dept, ...days.map(d => { const p = dayPlan(e, d); return p.t === 'off' ? 'OFF' : p.t === 'holiday' ? 'HOL' : `${shiftCode(p.shift)} ${p.shift.start}-${p.shift.end}`; })])])); };

/* ================= DUTY CALENDAR (profile tab + my calendar) ================= */
function dutyCalendarHtml(e) {
  const T = TODAY(), ym = S.dcMonth || ymOf(T), first = ym + '-01', last = addDays(addDays(first, 32).slice(0, 8) + '01', -1), pad = (dow(first) + 6) % 7, own = e.id === me().id, canEdit = can('roster.manage') && scope().some(x => x.id === e.id);
  const days = []; for (let d = first; d <= last; d = addDays(d, 1)) days.push(d); const pls = days.map(d => [d, dayPlan(e, d)]), work = pls.filter(x => x[1].t === 'work'), offs = pls.filter(x => x[1].t === 'off').length, hrs = sum(work, x => (hm2m(x[1].shift.end) - hm2m(x[1].shift.start)) / 60), nextOff = pls.find(x => x[0] > T && x[1].t === 'off') || (() => { for (let k = 1; k < 30; k++) { const d = addDays(T, k); if (dayPlan(e, d).t === 'off') return [d]; } })();
  const pm = addDays(first, -1).slice(0, 7), nm = addDays(last, 1).slice(0, 7);
  return `<div class="row wrap" style="margin-bottom:12px"><button class="btn" data-act="dcnav" data-v="${pm}">←</button><b style="min-width:140px;text-align:center">${monthName(ym)}</b><button class="btn" data-act="dcnav" data-v="${nm}">→</button><span class="right row wrap"><span class="badge acc">${work.length} duty days</span><span class="badge">${offs} offs</span><span class="badge">${hrs.toFixed(0)}h scheduled</span>${nextOff ? `<span class="badge ok">Next off: ${new Date(nextOff[0] + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>` : ''}</span></div>
  <div class="cal rcal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => `<div class="h">${x}</div>`).join('')}${'<div class="d x"></div>'.repeat(pad)}${pls.map(([d, p]) => `<div class="d rdc ${d === T ? 'today' : ''} ${d < T ? 'past' : ''}" ${d >= T && (canEdit || (own && can('roster.swap'))) ? `data-act="dccell" data-e="${e.id}" data-d="${d}" style="cursor:pointer"` : ''}><b>${+d.slice(8)}</b>${chipHtml(p, true)}</div>`).join('')}</div>
  <div class="small muted" style="margin-top:12px">${canEdit ? 'Click a future day to change this person’s duty. ' : own && can('roster.swap') ? 'Click a future day to ask a colleague to swap with you. ' : ''}Shifts and offs rotate — check this calendar every week or turn on push alerts under Duty alerts.</div>`;
}
ACT.dcnav = el => { S.dcMonth = el.dataset.v; render(); };
ACT.dccell = el => { const e = emp(el.dataset.e); if (can('roster.manage') && scope().some(x => x.id === e.id)) return ACT.rcell(el); if (e.id === me().id) return swapModal(el.dataset.d); };
const weekStrip = u => { const T = TODAY(), days = Array.from({ length: 7 }, (_, i) => addDays(T, i)); let nextOff = null; for (let k = 1; k < 30 && !nextOff; k++) { const d = addDays(T, k); if (dayPlan(u, d).t === 'off') nextOff = d; }
  return `<div class="card"><header><h3>My duty this week</h3><a class="btn sm" href="#/roster">Calendar &amp; swaps</a></header><div class="wkstrip">${days.map((d, i) => { const p = dayPlan(u, d); return `<div class="wkc ${p.t} ${i === 0 ? 'today' : ''}"><small>${i === 0 ? 'Today' : new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}</small>${chipHtml(p)}<span>${p.t === 'work' ? p.shift.start + '–' + p.shift.end : p.t === 'off' ? 'Day off' : 'Holiday'}</span></div>`; }).join('')}</div>${nextOff ? `<div class="small muted" style="margin-top:10px">Next day off: <b>${new Date(nextOff + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</b></div>` : ''}</div>`; };

/* ================= SWAPS (shift / day-off swap with a colleague, then manager approval) ================= */
const descPlan = (e, d) => { const p = dayPlan(e, d); return p.t === 'off' ? 'Day off' : p.t === 'holiday' ? 'Holiday' : `${p.shift.name} ${p.shift.start}–${p.shift.end}`; };
function swapModal(d0) {
  const u = me(), peers = activeEmps().filter(e => e.id !== u.id && e.dept === u.dept);
  if (!peers.length) return toast('No colleagues in your department to swap with', 'err');
  const m = modal('Request a swap', `<div class="form-grid">${fld('Date', 'date', d0 || addDays(TODAY(), 1), 'date', `min="${TODAY()}" required`)}${sel('Swap with', 'with', peers.map(e => [e.id, e.name]), peers[0].id)}<div class="full" id="swprev"></div><label class="f full">Reason<textarea class="input" name="reason" rows="2" required></textarea></label></div><p class="small muted">Your colleague has to accept first, then your manager approves. Nothing changes until both say yes.</p>`, d => {
    const o = emp(d.with), pu = dayPlan(u, d.date), po = dayPlan(o, d.date); if (po.t === 'holiday' || pu.t === 'holiday') { toast('Holidays can’t be swapped', 'err'); return false; } if (po.lv || pu.lv) { toast('One of you is on approved leave that day', 'err'); return false; } if (descPlan(u, d.date) === descPlan(o, d.date)) { toast('You both have the same duty that day — nothing to swap', 'err'); return false; }
    DB.swaps ??= []; DB.swaps.unshift({ id: uid('W'), emp: u.id, with: o.id, date: d.date, reason: d.reason, a: effAssign(u, d.date), b: effAssign(o, d.date), status: 'Awaiting colleague', ts: Date.now() }); notify(o.id, `🔁 ${u.name} asks to swap duty on ${fmtShort(d.date)} with you`); save(); render(); toast('Swap requested — waiting for ' + o.name.split(' ')[0]); return true; }, 'Send request');
  const upd = () => { const date = $('[name=date]', m).value, o = emp($('[name=with]', m).value); $('#swprev', m).innerHTML = date ? `<div class="row" style="gap:10px"><div class="card flat" style="flex:1;padding:10px"><div class="muted small">You now</div><b>${esc(descPlan(u, date))}</b></div><span>⇄</span><div class="card flat" style="flex:1;padding:10px"><div class="muted small">${esc(o.name.split(' ')[0])} now</div><b>${esc(descPlan(o, date))}</b></div></div>` : ''; }; m.addEventListener('input', upd); m.addEventListener('change', upd); upd();
}
ACT.swap_new = () => swapModal();
function swapsHtml() {
  const u = me(), list = (DB.swaps || []).filter(s => s.emp === u.id || s.with === u.id || can('roster.approve') && (isHR() || emp(s.emp)?.mgr === u.id));
  return `<div class="row" style="margin-bottom:12px"><span class="muted">Trade a shift or a day off with a colleague in your department.</span>${can('roster.swap') ? `<button class="btn primary right" data-act="swap_new">${ic('plus')} Request swap</button>` : ''}</div>
  <div class="card pad0 tablewrap"><table><thead><tr><th>Date</th><th>Requester</th><th>Swap with</th><th>Exchange</th><th>Status</th><th></th></tr></thead><tbody>${list.map(s => { const a = emp(s.emp), b = emp(s.with), name = x => { if (x === 'OFF') return 'Day off'; const sh = rows('shifts').find(y => y.id === x); return sh ? sh.name.replace(' Shift', '') : 'Default'; };
    return `<tr><td>${fmtDate(s.date)}</td><td>${person(a)}</td><td>${person(b)}</td><td class="small"><b>${esc(a.name.split(' ')[0])}</b>: ${name(s.a)} → ${name(s.b)}<br><b>${esc(b.name.split(' ')[0])}</b>: ${name(s.b)} → ${name(s.a)}<div class="muted">${esc(s.reason || '')}</div></td><td>${statusBadge(s.status)}</td><td class="nowrap">${s.status === 'Awaiting colleague' && s.with === u.id ? `<button class="btn sm primary" data-act="swap_act" data-id="${s.id}" data-v="accept">Accept</button> <button class="btn sm danger" data-act="swap_act" data-id="${s.id}" data-v="decline">Decline</button>` : ''}${s.status === 'Pending' && can('roster.approve') && s.emp !== u.id && (isHR() || a.mgr === u.id) ? `<button class="btn sm primary" data-act="swap_act" data-id="${s.id}" data-v="approve">Approve</button> <button class="btn sm danger" data-act="swap_act" data-id="${s.id}" data-v="reject">Reject</button>` : ''}${['Awaiting colleague', 'Pending'].includes(s.status) && s.emp === u.id ? `<button class="btn sm" data-act="swap_act" data-id="${s.id}" data-v="cancel">Cancel</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">No swap requests yet.</td></tr>'}</tbody></table></div>`;
}
ACT.swap_act = el => {
  const s = (DB.swaps || []).find(x => x.id === el.dataset.id), v = el.dataset.v, a = emp(s.emp), b = emp(s.with);
  if (v === 'accept') { s.status = 'Pending'; notify(a.mgr || 'E001', `🔁 Swap awaiting approval: ${a.name} ⇄ ${b.name} on ${fmtShort(s.date)}`); notify(a.id, `${b.name} accepted your swap — now with your manager`); }
  if (v === 'decline') { s.status = 'Declined'; notify(a.id, `${b.name} declined your swap request`); }
  if (v === 'cancel') s.status = 'Cancelled'; if (v === 'reject') { s.status = 'Rejected'; notify(a.id, `Your swap on ${fmtShort(s.date)} was rejected`); notify(b.id, `The swap on ${fmtShort(s.date)} was rejected`); }
  if (v === 'approve') { if (effAssign(a, s.date) !== s.a || effAssign(b, s.date) !== s.b) { s.status = 'Rejected'; save(); render(); return toast('Roster changed since the request — it was closed', 'err'); } setAssign(a.id, s.date, s.b); setAssign(b.id, s.date, s.a); s.status = 'Approved'; s.by = me().id; [a, b].forEach(x => notify(x.id, `✅ Duty swap on ${fmtShort(s.date)} approved — check your roster`)); log(`Approved swap ${a.name} ⇄ ${b.name} on ${s.date}`); }
  save(); render(); toast('Updated');
};

document.head.insertAdjacentHTML('beforeend', `<style>
.rchip{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;min-width:34px;padding:3px 7px;border-radius:9px;background:var(--c,#64748b);color:#fff;font-weight:700;font-size:11.5px;line-height:1.15;position:relative;box-shadow:0 2px 6px -3px var(--c,#000)}
.rchip small{font-size:9.5px;font-weight:500;opacity:.9}.rchip i{position:absolute;top:-5px;right:-5px;width:14px;height:14px;border-radius:50%;background:var(--violet);font-style:normal;font-size:9px;display:grid;place-items:center}
.rchip.off{background:var(--surface2);color:var(--muted);border:1px solid var(--line);box-shadow:none}.rchip.off.legacy{border-style:dashed}.rchip.hol{background:var(--gold-soft);color:var(--ink);border:1px solid var(--gold);box-shadow:none}
.rtab{border-collapse:separate;border-spacing:0;font-size:12.5px}.rtab th,.rtab td{padding:6px 4px;border-bottom:1px solid var(--line)}.rtab .stick{position:sticky;left:0;background:var(--surface);z-index:2;min-width:190px;padding-left:12px;border-right:1px solid var(--line)}.rtab thead th{background:var(--surface2);text-align:center;min-width:52px}.rtab th.today,.rtab td.today{background:var(--accent-soft)}.rtab th.wkend{color:var(--muted)}.rtab td.rc{text-align:center;cursor:pointer;transition:background .15s}.rtab td.rc:hover{background:var(--accent-soft)}.rtab td.rc.past{opacity:.55;cursor:default}.rtab td.rc.past:hover{background:none}
.rdept td{background:var(--accent-soft);color:var(--accent);font-weight:700;padding:6px 12px;font-size:12px;text-transform:uppercase;letter-spacing:.05em}.rcov td{background:var(--surface2);font-weight:600}.rcov td.low{background:var(--red-soft);color:var(--red)}
.rpick{display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--line);border-radius:12px;cursor:pointer}.rpick:has(input:checked){border-color:var(--accent);background:var(--accent-soft)}
.rcal .d.rdc{min-height:72px;aspect-ratio:auto;align-items:flex-start;gap:4px;transition:transform .2s var(--ease),box-shadow .2s}.rcal .d.rdc[data-act]:hover{transform:translateY(-2px);box-shadow:0 8px 20px -12px var(--accent)}.rcal .d.rdc.past{opacity:.55}.rcal .d.rdc.today{outline:2px solid var(--accent)}
.wkstrip{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.wkc{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;border-radius:12px;background:var(--surface2);border:1px solid var(--line);font-size:11px;text-align:center}.wkc.today{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}.wkc small{color:var(--muted);font-weight:600}.wkc span:last-child{color:var(--muted);font-size:10px}
@media(max-width:700px){.wkstrip{grid-template-columns:repeat(4,1fr)}}
</style>`);

{ const i = PAGES.findIndex(p => p[0] === 'alerts'); PAGES.splice(i + 1, 0, ['roster', 'Duty roster', 'calendar']); }
