'use strict';
/* ============ Orbit Realty — HR control panel (modelled on TrustedHRM's HR dashboard, extended) ============ */

/* demo data so the probation / review widgets have something to show on a fresh install */
function ensureHrData() {
  const T = TODAY(), a = emp('E006'), b = emp('E008'), c = emp('E007');
  if (a && !a._hr) { a._hr = 1; a.contract = { type: 'Probation', start: addDays(T, -171), end: addDays(T, 9), notice: 30 }; }
  if (b && !b._hr) { b._hr = 1; b.contract = { type: 'Probation', start: addDays(T, -185), end: addDays(T, -5), notice: 30 }; }
  if (c && !c._hr) { c._hr = 1; c.lastReview = addDays(T, -350); }
}
const _boot4 = boot; boot = function () { load(); ensureHrData(); save(); _boot4(); };

/* ---------- pending-request inbox ---------- */
function inboxCounts() {
  const open = DB.tickets.filter(t => t.status !== 'Resolved').length;
  return [
    ['Leave requests', DB.leaves.filter(canApproveLeave).length, 'leave', 'leave', 'appr', 'calendar'],
    ['Expense claims', DB.claims.filter(canApproveClaim).length, 'payroll', 'pay', 'claims', 'wallet'],
    ['Support tickets', isHR() ? open : 0, 'helpdesk', 'x', 'x', 'help'],
    ['Attendance fixes', DB.regs.filter(canApproveReg).length, 'attendance', 'att', 'reg', 'clock'],
    ['Document requests', isHR() ? rows('docreq').filter(d => d.status === 'Pending').length : 0, 'documents', 'docs', 'req', 'file'],
    ['Loans & advances', isHR() ? [...rows('loans'), ...rows('advances')].filter(x => x.status === 'Pending').length : 0, 'payroll', 'pay', 'loans', 'briefcase'],
    ['Resignations', isHR() ? rows('resignations').filter(r => r.status === 'Pending').length : 0, 'lifecycle', 'life', 'resignations', 'logout']
  ];
}
const inboxHtml = () => { const L = inboxCounts(), tot = sum(L, x => x[1]); return `<div class="card" style="margin-bottom:16px"><header><h3>Pending requests</h3><span class="badge ${tot ? 'warn' : 'ok'}">${tot ? tot + ' waiting' : 'inbox zero 🎉'}</span></header><div class="inbox">${L.map(([l, n, p, k, v, i]) => `<a class="inb ${n ? 'has' : ''}" href="#/${p}" data-act="tabgo2" data-p="${p}" data-k="${k}" data-v="${v}">${ic(i)}<span>${l}</span><b data-count>${n}</b></a>`).join('')}</div></div>`; };
ACT.tabgo2 = (el, e) => { e.preventDefault(); if (el.dataset.k !== 'x') S.tab[el.dataset.k] = el.dataset.v; location.hash = '#/' + el.dataset.p; };

/* ---------- today activity (checked in / on break / on leave / not in) ---------- */
function todayActivity() {
  const T = TODAY(), tab = tabOf('tact', 'in'), people = scope().filter(e => e.status !== 'Exited').map(e => ({ e, d: dutyOf(e), rec: (r0 => r0 && !r0.absent ? r0 : undefined)(DB.att[e.id]?.[T]) }));
  const groups = { in: people.filter(x => x.rec && !onBreak(x.rec) && !x.rec.out), brk: people.filter(x => onBreak(x.rec)), out: people.filter(x => x.rec?.out), lv: people.filter(x => x.d.kind === 'off' && x.d.why === 'leave'), no: people.filter(x => !x.rec && !['off'].includes(x.d.kind)) };
  const tabs = [['in', 'Checked in', 'ok'], ['brk', 'On break', 'warn'], ['out', 'Checked out', ''], ['lv', 'On leave', 'vio'], ['no', 'Not checked in', 'bad']];
  const line = ({ e, d, rec }) => `<div class="row actl">${avatar(e, 'sm')}<div style="flex:1;min-width:0"><b>${esc(e.name)}</b><div class="muted small">${esc(e.dept)} · ${d.sh.start}–${d.sh.end}</div></div>${tab === 'in' || tab === 'out' ? `<span class="badge ok">${rec.in}${rec.out ? ' → ' + rec.out : ''}</span><span class="badge">${esc(rec.mode)}</span>` : tab === 'brk' ? `<span class="badge warn">on break · ${fmtHM(breakMins(rec))}</span>` : tab === 'lv' ? `<span class="badge vio">${esc(LEAVE_TYPES[dayStatus(e.id, T).lv?.type] || 'Leave')}</span>` : `<span class="badge ${KIND_BADGE[d.kind][0]}">${KIND_BADGE[d.kind][1]}</span>${['pre', 'due', 'late'].includes(d.kind) && e.id !== me().id ? `<button class="btn sm primary" data-act="remind" data-id="${e.id}">${ic('bell')}</button>` : ''}`}</div>`;
  return `<div class="card"><header><h3>Today activity</h3><a class="btn sm" href="#/alerts">Live board</a></header><div class="pill-toggle" style="margin-bottom:12px;flex-wrap:wrap">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tact" data-v="${k}">${l} <b>${groups[k].length}</b></button>`).join('')}</div><div class="actlist">${groups[tab].slice(0, 8).map(line).join('') || '<div class="muted" style="padding:14px 0">Nobody here right now.</div>'}${groups[tab].length > 8 ? `<div class="muted small" style="padding:8px 0">+ ${groups[tab].length - 8} more — see the live board</div>` : ''}</div></div>`;
}
ACT.tact = el => { S.tab.tact = el.dataset.v; render(); };

/* ---------- department presence ---------- */
function deptPresence() {
  const T = TODAY(), act = scope().filter(e => e.status !== 'Exited'), data = DEPTS.map((d, i) => { const m = act.filter(e => e.dept === d), p = m.filter(e => DB.att[e.id]?.[T] && hm2m(DB.att[e.id][T].in) <= nowMin()).length; return { d, p, n: m.length, c: COLORS[i] }; }).filter(x => x.n);
  return `<div class="card"><header><h3>Department presence</h3><span class="muted small">present / total today</span></header><div class="leader col">${data.map(x => `<div><div class="row"><span style="width:10px;height:10px;border-radius:3px;background:${x.c}"></span><b style="flex:1">${esc(x.d)}</b><span class="small"><b>${x.p}</b> / ${x.n}</span></div><div class="bar" style="margin-top:5px"><i style="width:${Math.round(x.p / x.n * 100)}%;background:${x.c}"></i></div></div>`).join('')}</div></div>`;
}

/* ---------- probation & salary review ---------- */
function reviewItems() {
  const T = TODAY(), out = [];
  scope().filter(e => e.status !== 'Exited' && e.role !== 'admin').forEach(e => {
    if (e.contract?.type === 'Probation' && e.contract.end) { const days = daysBetween(T, e.contract.end); if (days <= 30) out.push({ e, kind: 'prob', days, label: 'Probation ends ' + fmtShort(e.contract.end) }); }
    else if (e.status === 'Active') { const y = +T.slice(0, 4); let due; if (e.lastReview) due = addDays(e.lastReview, 365); else if (daysBetween(e.joined, T) < 365) due = addDays(e.joined, 365); else { due = y + e.joined.slice(4); if (daysBetween(due, T) > 30) due = (y + 1) + e.joined.slice(4); } const days = daysBetween(T, due); if (days <= 30 && days >= -30) out.push({ e, kind: 'rev', days, label: 'Salary review due ' + fmtShort(due) }); }
  });
  return out.sort((a, b) => a.days - b.days);
}
function reviewCard() {
  if (!isHR()) return ''; const L = reviewItems();
  return `<div class="card"><header><h3>Probation &amp; salary review</h3><span class="badge ${L.some(x => x.days < 0) ? 'bad' : L.length ? 'warn' : 'ok'}">${L.length ? L.length + ' to action' : 'all clear'}</span></header>${L.slice(0, 6).map(x => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">${avatar(x.e, 'sm')}<div style="flex:1;min-width:0"><b>${esc(x.e.name)}</b><div class="muted small">${esc(x.e.title)} · ${x.label}</div></div><span class="badge ${x.days < 0 ? 'bad' : x.days <= 14 ? 'warn' : ''}">${x.days < 0 ? Math.abs(x.days) + ' days overdue' : x.days === 0 ? 'today' : x.days + ' days left'}</span><button class="btn sm primary" data-act="review_act" data-id="${x.e.id}" data-k="${x.kind}">Take action</button></div>`).join('') || '<div class="muted">Nobody is due for probation confirmation or salary review in the next 30 days.</div>'}</div>`;
}
ACT.review_act = el => {
  const e = emp(el.dataset.id), prob = el.dataset.k === 'prob';
  if (prob) return modal(`Probation — ${esc(e.name)}`, `<p class="muted" style="margin-top:0">Probation ${e.contract.end < TODAY() ? 'ended' : 'ends'} ${fmtDate(e.contract.end)}.</p><div class="col"><label class="row" style="cursor:pointer"><input type="radio" name="act" value="confirm" checked> <span><b>Confirm employment</b> — becomes permanent</span></label><label class="row" style="cursor:pointer"><input type="radio" name="act" value="extend"> <span><b>Extend probation</b></span></label><label class="f">Extend by<select class="select" name="months"><option value="1">1 month</option><option value="2">2 months</option><option value="3" selected>3 months</option></select></label><label class="row" style="cursor:pointer"><input type="radio" name="act" value="exit"> <span><b>Do not confirm</b> — start exit</span></label><label class="f">Note (optional)<textarea class="input" name="note" rows="2"></textarea></label></div>`, d => {
    if (d.act === 'confirm') { e.contract = { ...e.contract, type: 'Permanent', end: '', confirmed: TODAY() }; notify(e.id, '🎉 Your employment has been confirmed. Congratulations!'); log('Confirmed probation of ' + e.name); }
    else if (d.act === 'extend') { const nd = new Date(e.contract.end + 'T00:00:00'); nd.setMonth(nd.getMonth() + +d.months); e.contract.end = iso(nd); notify(e.id, `Your probation was extended to ${fmtDate(e.contract.end)}`); log('Extended probation of ' + e.name); }
    else { startExit(e, addDays(TODAY(), +(e.contract.notice || 30)), 'Probation not confirmed'); }
    save(); render(); toast('Updated'); }, 'Apply');
  modal(`Salary review — ${esc(e.name)}`, `<p class="muted" style="margin-top:0">Current CTC <b>${inr(e.salary)}</b> · last reviewed ${fmtDate(e.lastReview || e.joined)}.</p><div class="form-grid">${fld('Increment %', 'pct', 8, 'number', 'step="any" min="0" id="rvp"')}${fld('New annual CTC (₹)', 'ctc', Math.round(e.salary * 1.08), 'number', 'min="0" required id="rvc"')}${fld('Effective from', 'date', TODAY(), 'date', 'required', 'full')}</div>`, d => { const pr = { id: uid('r'), emp: e.id, newTitle: e.title, newCtc: +d.ctc, date: d.date, type: 'Annual', status: 'Executed' }; rows('promotions').unshift(pr); reviseSalary(e, { ctc: +d.ctc, from: d.date.slice(0, 7) + '-01', reason: 'Annual salary review' }); e.lastReview = TODAY(); notify(e.id, `💰 Your salary was revised to ${inr(e.salary)} per year effective ${fmtDate(d.date)}`); log('Salary review for ' + e.name); save(); render(); toast('Revision recorded'); }, 'Apply revision');
  const m = $('.modal-bg:last-of-type'); if (m) { const p = $('#rvp', m), c = $('#rvc', m); p?.addEventListener('input', () => { c.value = Math.round(e.salary * (1 + (+p.value || 0) / 100)); }); c?.addEventListener('input', () => { p.value = ((+c.value / e.salary - 1) * 100).toFixed(1); }); }
};

/* ---------- company overview = HR panel + existing admin dashboard ---------- */
const _dash2 = PAGE_FN.dashboard;
PAGE_FN.dashboard = () => { const html = _dash2(); if (!(isHR() || isMgr()) || tabOf('dash', 'my') !== 'co') return html; return html.replace('<div class="grid g-main">', inboxHtml() + `<div class="grid g2" style="margin-bottom:16px;align-items:start">${todayActivity()}${deptPresence()}</div>${reviewCard()}<div class="grid g-main" style="margin-top:16px">`); };

document.head.insertAdjacentHTML('beforeend', `<style>
.inbox{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}.inb{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;background:var(--surface2);border:1px solid var(--line);color:var(--ink);transition:transform .2s var(--ease),border-color .2s,box-shadow .2s}.inb:hover{transform:translateY(-3px);border-color:var(--accent)}.inb span{flex:1;font-size:13px;font-weight:600}.inb b{min-width:28px;height:28px;border-radius:99px;display:grid;place-items:center;background:var(--green-soft);color:var(--green);font-size:13px}.inb.has{background:var(--amber-soft);border-color:transparent}.inb.has b{background:var(--amber);color:#fff;animation:pulse-badge 2s infinite}.inb svg{color:var(--muted)}
.actl{padding:8px 0;border-bottom:1px solid var(--line)}.actl:last-child{border-bottom:0}
</style>`);
