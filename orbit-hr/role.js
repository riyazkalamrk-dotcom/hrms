'use strict';
/* ============ Orbit Realty — role-based landing, daily briefing, preferences, login preview ============ */
const ROLE_INFO = {
  admin: { label: 'Managing Director', land: 'Executive overview', tab: 'exec', see: ['Hiring pipeline, attrition and open positions', 'Payroll cost, headcount and attendance at every site', 'Risks: late check-ins, missed check-outs, overdue probations', 'Approvals and payroll status in one place'] },
  hr: { label: 'HR & Admin', land: 'HR control room', tab: 'co', see: ['Inbox of every pending request, with counts', 'Live check-in board with one-tap reminders', 'Probation confirmations and salary reviews due', 'Onboarding, exits and today’s attendance by department'] },
  manager: { label: 'Manager', land: 'My team today', tab: 'team', see: ['Who is in, late or on leave in your team', 'Approvals waiting for you', 'Team goals and sales against target', 'Your own clock, break and leave summary'] },
  employee: { label: 'Employee', land: 'My space', tab: 'my', see: ['Hold-to-check-in clock with breaks and worked hours', 'Leave balance, payslips and expense claims', 'Your requests, goals, notices and holidays', 'Meetings and site visits coming up'] }
};
const roleKey = u => can('dash.exec') ? 'admin' : can('dash.hr') ? 'hr' : (can('dash.team') && reportsOf(u.id).length) ? 'manager' : 'employee';
const dashTabs = () => { const t = []; if (can('dash.exec')) t.push(['exec', 'Executive']); if (can('dash.hr')) t.push(['co', roleKey(me()) === 'hr' ? 'HR control room' : 'Company overview']); if (can('dash.team') && reportsOf(me().id).length) t.push(['team', 'My team']); if (can('dash.staff') || !t.length) t.push(['my', 'My space']); return t; };
const defaultDashTab = () => ROLE_INFO[roleKey(me())].tab;
function landingHash() { const p = DB.prefs?.[me().id]?.landing; return '#/' + (p && PAGE_FN[p] ? p : 'dashboard'); }

/* ================= EXECUTIVE VIEW (MD / admin) ================= */
function execView() {
  const T = TODAY(), ym = ymOf(T), act = activeEmps(), states = act.map(e => [e, dutyOf(e)]), pres = states.filter(x => ['working', 'checkout', 'missed', 'done'].includes(x[1].kind)).length;
  const payCost = sum(act, e => e.salary / 12), run = DB.payruns[ym], exits = DB.employees.filter(e => e.status === 'Exited').length, attr = (exits / Math.max(1, DB.employees.length) * 100).toFixed(1), openPos = sum(rows('jobs').filter(j => j.status === 'Open'), j => +j.openings);
  const stages = STAGES.map((s, i) => ({ l: s, v: DB.cands.filter(c => c.stage === s).length, c: COLORS[i] }));
  const branches = rows('branches').map(b => { const m = act.filter(e => (DB.att[e.id]?.[T]?.site || branchOf(e)) === b.id), p = m.filter(e => DB.att[e.id]?.[T] && !DB.att[e.id][T].absent && hm2m(DB.att[e.id][T].in) <= nowMin()).length; return { b, p, n: m.length }; }).filter(x => x.n);
  const late = states.filter(x => x[1].kind === 'late'), miss = states.filter(x => x[1].kind === 'missed'), prob = DB.employees.filter(e => e.contract?.type === 'Probation' && e.contract.end && e.contract.end < T), notice = DB.employees.filter(e => e.status === 'Notice period');
  const risks = [[late.length, 'not checked in', 'bad', 'alerts'], [miss.length, 'missed check-outs', 'bad', 'alerts'], [prob.length, 'probations overdue', 'warn', 'dashboard'], [notice.length, 'in notice period', 'warn', 'lifecycle'], [pendingCount(), 'approvals waiting', 'warn', 'leave'], [openPos, 'open positions', '', 'recruitment']];
  const cost = DEPTS.map((d, i) => ({ l: d, v: Math.round(sum(act.filter(e => e.dept === d), e => e.salary) / 100000), c: COLORS[i] })).filter(x => x.v);
  const leaders = act.filter(e => e.status === 'Active' && e.role !== 'admin').map(e => ({ e, v: attRate(e, ym) })).sort((a, b) => b.v - a.v).slice(0, 5);
  const onLeave = act.filter(e => dayStatus(e.id, T).s === 'leave').length, newJoin = act.filter(e => daysBetween(e.joined, T) <= 30).length;
  return `<div class="hero slim"><div style="position:relative;z-index:1"><h1>Executive overview</h1><p>${monthName(ym)} · ${esc(DB.company)} · ${act.length} people across ${branches.length} locations</p></div>${skylineSvg}</div>
  <div class="grid g4" style="margin-bottom:16px"><div class="card kpi"><span class="v">${act.length}</span><span class="l">Headcount</span><span class="d muted">${newJoin} joined in 30 days · ${notice.length} leaving</span></div><div class="card kpi"><span class="v">${pres}</span><span class="l">Checked in today</span><span class="d muted">${Math.round(pres / Math.max(1, act.length) * 100)}% of workforce · ${onLeave} on leave</span></div><div class="card kpi"><span class="v">${inr(payCost)}</span><span class="l">Monthly payroll cost</span><span class="d muted">Run: ${run ? run.status : 'not started'}</span></div><div class="card kpi"><span class="v">${attr}%</span><span class="l">Attrition (all time)</span><span class="d muted">${openPos} open position${openPos === 1 ? '' : 's'}</span></div></div>
  <div class="grid g2" style="align-items:start;margin-bottom:16px"><div class="card"><header><h3>Hiring pipeline</h3><a class="btn sm" href="#/recruitment">Open</a></header>${barChart(stages)}<div class="muted small" style="margin-top:6px">${DB.cands.length} candidates across ${rows('jobs').filter(j => j.status === 'Open').length} open roles</div></div>
  <div class="card"><header><h3>Needs your attention</h3></header><div class="inbox">${risks.map(([n, l, c, p]) => `<a class="inb ${n && c ? 'has' : ''}" href="#/${p}"><span>${l}</span><b data-count>${n}</b></a>`).join('')}</div><div class="muted small" style="margin-top:12px">${late.slice(0, 3).map(x => esc(x[0].name)).join(', ')}${late.length ? ' have not checked in. ' : ''}${miss.length ? esc(miss[0][0].name) + ' missed check-out.' : ''}</div></div></div>
  <div class="grid g2" style="align-items:start;margin-bottom:16px"><div class="card"><header><h3>Attendance by site</h3><span class="muted small">present / total now</span></header><div class="leader col">${branches.map(({ b, p, n }, i) => `<div><div class="row"><b style="flex:1">${esc(b.name)}</b><span class="small"><b>${p}</b> / ${n}</span></div><div class="bar" style="margin-top:5px"><i style="width:${Math.round(p / n * 100)}%;background:${COLORS[i]}"></i></div></div>`).join('')}</div></div>
  <div class="card"><header><h3>🏅 Attendance leaders</h3><span class="muted small">${monthName(ym)}</span></header><div class="leader col">${leaders.map(({ e, v }) => `<div><div class="row">${avatar(e, 'sm')}<b style="flex:1">${esc(e.name)}</b><span class="badge ${v >= 95 ? 'ok' : 'acc'}">${v}%</span></div><div class="bar" style="margin-top:5px"><i style="width:${v}%"></i></div></div>`).join('')}</div></div></div>
  <div class="grid g2" style="align-items:start"><div class="card"><header><h3>People cost by department</h3><span class="muted small">annual CTC, ₹ lakh</span></header>${donut(cost, 130)}</div><div class="card"><header><h3>Payroll — ${monthName(ym)}</h3>${run ? statusBadge(run.status) : '<span class="badge warn">Draft</span>'}</header><div class="kpi"><span class="v">${inr(sum(act, e => payslip(e.id, ym).net))}</span><span class="l">Estimated net payable (so far this month)</span></div><div class="row" style="margin-top:12px"><button class="btn primary" data-act="tabgo" data-p="payroll" data-k="pay" data-v="run">Open payroll run</button><a class="btn" href="#/reports">Reports</a></div></div></div>`;
}

/* ================= MANAGER VIEW ================= */
function teamView() {
  const u = me(), T = TODAY(), ym = ymOf(T), team = reportsOf(u.id), st = team.map(e => [e, dutyOf(e)]), cnt = ks => st.filter(x => ks.includes(x[1].kind)).length, pc = pendingCount();
  const leaves = DB.leaves.filter(l => team.some(e => e.id === l.emp) && ['Approved', 'Pending'].includes(l.status) && l.to >= T && l.from <= addDays(T, 14)).sort((a, b) => a.from < b.from ? -1 : 1);
  const goals = team.map(e => { const g = DB.goals.filter(x => x.emp === e.id); return { e, p: g.length ? Math.round(sum(g, x => x.progress) / g.length) : null }; });
  const rates = team.map(e => ({ e, v: attRate(e, ym) })).sort((a, b) => b.v - a.v), avg = rates.length ? Math.round(sum(rates, x => x.v) / rates.length) : 0;
  return `<div class="hero slim"><div style="position:relative;z-index:1"><h1>My team today</h1><p>${team.length} people report to you · ${esc(u.dept)}</p></div>${skylineSvg}</div>
  <div class="grid g4" style="margin-bottom:16px"><div class="card kpi"><span class="v">${cnt(['working', 'checkout', 'missed', 'done'])}</span><span class="l">Checked in</span><span class="d muted">of ${team.length}</span></div><div class="card kpi"><span class="v">${cnt(['late'])}</span><span class="l">Late — not in</span><span class="d muted">${cnt(['pre', 'due'])} awaiting</span></div><div class="card kpi"><span class="v">${st.filter(x => x[1].kind === 'off' && x[1].why === 'leave').length}</span><span class="l">On leave</span><span class="d muted">${leaves.filter(l => l.status === 'Pending').length} requests pending</span></div><div class="card kpi"><span class="v">${avg}%</span><span class="l">Team attendance this month</span><span class="d muted">${pc} approval${pc === 1 ? '' : 's'} waiting for you</span></div></div>
  <div class="grid g-main" style="align-items:start"><div class="col" style="gap:16px"><div class="card" id="dutycard">${dutyCardInner()}</div>
   <div class="card pad0"><div style="padding:16px 18px 0"><h3>Team status right now</h3></div><div class="tablewrap"><table><thead><tr><th>Person</th><th>Shift</th><th>Status</th><th>In</th><th>Out</th><th></th></tr></thead><tbody>${st.map(([e, d]) => { const b = KIND_BADGE[d.kind]; return `<tr><td>${person(e)}</td><td class="nowrap">${d.sh.start}–${d.sh.end}</td><td><span class="badge ${b[0]}">${b[1]}</span></td><td>${d.rec?.in || '—'}</td><td>${d.rec?.out || '—'}</td><td class="nowrap">${['pre', 'due', 'late', 'checkout', 'missed'].includes(d.kind) ? `<button class="btn sm primary" data-act="remind" data-id="${e.id}">${ic('bell')} Remind</button> ` : ''}<a class="btn sm" href="#/employees/${e.id}">Profile</a></td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">No direct reports yet.</td></tr>'}</tbody></table></div></div>
   ${pc ? `<div class="card pad0"><div style="padding:16px 18px 0"><h3>Needs your approval <span class="badge warn">${pc}</span></h3></div>${approvalsTable()}</div>` : ''}</div>
  <div class="col" style="gap:16px"><div class="card"><header><h3>🏅 Team attendance</h3><span class="muted small">${monthName(ym)}</span></header><div class="leader col">${rates.map(({ e, v }) => `<div><div class="row">${avatar(e, 'sm')}<b style="flex:1">${esc(e.name.split(' ')[0])}</b><span class="badge ${v >= 95 ? 'ok' : v >= 85 ? 'acc' : 'warn'}">${v}%</span></div><div class="bar" style="margin-top:5px"><i style="width:${v}%"></i></div></div>`).join('') || '<div class="muted">No team yet.</div>'}</div></div>
   <div class="card"><header><h3>Goal progress</h3></header>${goals.map(({ e, p }) => `<div style="margin-bottom:10px"><div class="row between"><span>${esc(e.name.split(' ')[0])}</span><b>${p === null ? '—' : p + '%'}</b></div><div class="progress"><i style="width:${p || 0}%"></i></div></div>`).join('') || '<div class="muted">No team goals yet.</div>'}</div>
   <div class="card"><header><h3>Team leave · next 14 days</h3></header><div class="list">${leaves.map(l => `<div class="row"><div style="flex:1"><b>${esc(empName(l.emp))}</b><div class="muted small">${fmtShort(l.from)}${l.to !== l.from ? ' – ' + fmtShort(l.to) : ''} · ${LEAVE_TYPES[l.type]}</div></div>${statusBadge(l.status)}</div>`).join('') || '<div class="muted">No leave planned.</div>'}</div></div></div></div>`;
}

/* ================= DASHBOARD ROUTER ================= */
const _dashBase = PAGE_FN.dashboard;
PAGE_FN.dashboard = () => {
  const tabs = dashTabs(); let t = S.tab.dash; if (!tabs.some(x => x[0] === t)) t = defaultDashTab(); S.tab.dash = t;
  const bar = tabs.length > 1 ? tabsBar('dash', tabs, t) : '';
  if (t === 'exec') return bar + execView(); if (t === 'team') return bar + teamView();
  const html = _dashBase().replace(/<div class="tabs">[\s\S]*?<\/div>/, ''); return bar + html;
};

/* ================= DAILY BRIEFING ================= */
function briefingItems() {
  const u = me(), k = roleKey(u), T = TODAY(), d = dutyOf(u), t = dutyText(d), out = [];
  const add = (icon, title, sub, href, label) => out.push({ icon, title, sub, href, label });
  add('clock', `${d.sh.name} · ${d.sh.start}–${d.sh.end}`, `${t.state}${t.sub ? ' — ' + t.sub : ''}`, '#/dashboard', d.kind === 'off' ? '' : 'Open clock');
  const pc = pendingCount(); if (pc && k !== 'employee') add('check', `${pc} approval${pc > 1 ? 's' : ''} waiting`, 'Leave, expenses and corrections', '#/dashboard', 'Review');
  if (k === 'admin') { const ym = ymOf(T), act0 = activeEmps(), pres = act0.filter(e => ['working', 'checkout', 'missed', 'done'].includes(dutyOf(e).kind)).length; add('users', `${pres} of ${act0.length} people checked in`, 'Across all sites', '#/dashboard', 'Executive view'); const late = activeEmps().filter(e => dutyOf(e).kind === 'late'); if (late.length) add('clockalert', `${late.length} not checked in`, late.slice(0, 3).map(e => e.name.split(' ')[0]).join(', '), '#/alerts', 'Alert board'); const run = DB.payruns[ym]; add('wallet', `Payroll ${run ? run.status : 'not started'} for ${monthName(ym)}`, 'Review before the month-end run', '#/payroll', 'Payroll'); }
  if (k === 'hr') { const inbox = sum(inboxCounts(), x => x[1]), rv = reviewItems().filter(x => x.days <= 14); if (inbox) add('help', `${inbox} request${inbox > 1 ? 's' : ''} in your inbox`, 'Leave, tickets, documents, loans…', '#/dashboard', 'Open inbox'); if (rv.length) add('award', `${rv.length} probation / salary review${rv.length > 1 ? 's' : ''} due`, rv.slice(0, 3).map(x => x.e.name.split(' ')[0]).join(', '), '#/dashboard', 'Take action'); const late = scope().filter(e => dutyOf(e).kind === 'late'); if (late.length) add('clockalert', `${late.length} not checked in`, late.slice(0, 3).map(e => e.name.split(' ')[0]).join(', '), '#/alerts', 'Live board'); const onb = [...new Set(DB.tasks.filter(x => !x.done && !x.off).map(x => x.emp))]; if (onb.length) add('check', `${onb.length} new joiner${onb.length > 1 ? 's' : ''} onboarding`, onb.map(empName).join(', '), '#/onboarding', 'Open'); }
  if (k === 'manager') { const team = reportsOf(u.id), late = team.filter(e => dutyOf(e).kind === 'late'); add('users', `${team.length} on your team`, late.length ? `${late.length} not checked in: ${late.map(e => e.name.split(' ')[0]).join(', ')}` : 'Everyone is on track', '#/dashboard', 'Team view'); }
  const vs = rows('visits').filter(v => v.date === T && v.status === 'Scheduled' && (v.emp === u.id || (k !== 'employee' && emp(v.emp)?.mgr === u.id))); if (vs.length) add('map', `${vs.length} site visit${vs.length > 1 ? 's' : ''} today`, vs.map(v => `${v.time} ${v.client}`).join(' · '), '#/meetings', 'View');
  const mt = rows('meetings').filter(m => m.date === T); if (mt.length) add('users', `${mt.length} meeting${mt.length > 1 ? 's' : ''} today`, mt.map(m => `${m.time} ${m.title}`).join(' · '), '#/meetings', 'View');
  const my = DB.leaves.filter(l => l.emp === u.id && l.status === 'Pending').length + DB.claims.filter(c => c.emp === u.id && c.status === 'Pending').length; if (my) add('calendar', `${my} of your requests pending`, 'Waiting for approval', '#/dashboard', 'Track');
  const bd = activeEmps().filter(e => e.dob.slice(5) === T.slice(5)); if (bd.length) add('award', `🎂 ${bd.map(e => e.name.split(' ')[0]).join(', ')} ${bd.length > 1 ? 'have' : 'has a'} birthday today`, 'Send a kudos!', '#/performance', 'Say hi');
  const nw = DB.news.filter(n => daysBetween(n.ts, T) <= 3); if (nw.length) add('mega', `${nw.length} new announcement${nw.length > 1 ? 's' : ''}`, nw.map(n => n.title).slice(0, 2).join(' · '), '#/dashboard', 'Read');
  const un = DB.notes.filter(n => n.to === u.id && !n.read).length; if (un) add('bell', `${un} unread notification${un > 1 ? 's' : ''}`, '', '#/notifications', 'Open');
  return out;
}
function showBriefing() {
  const u = me(), k = roleKey(u), info = ROLE_INFO[k], h = nowDate().getHours(), items = briefingItems();
  const m = modal(`${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, ${esc(u.name.split(' ')[0])} 👋`, `<div class="muted" style="margin:-4px 0 14px">Your day at a glance · ${esc(info.label)} · landing on <b>${info.land}</b></div><div class="brief">${items.map((x, i) => `<a class="bi" style="--i:${i}" href="${x.href}" data-close>${ic(x.icon)}<div style="flex:1;min-width:0"><b>${x.title}</b>${x.sub ? `<div class="muted small">${x.sub}</div>` : ''}</div>${x.label ? `<span class="btn sm">${x.label}</span>` : ''}</a>`).join('') || '<div class="empty">Nothing needs you right now 🎉</div>'}</div><div class="row between" style="margin-top:16px"><label class="row small" style="cursor:pointer"><input type="checkbox" id="nobrief"> Don’t show this again</label><button type="button" class="btn primary" data-close>Let’s go →</button></div>`, null, '', false);
  m.addEventListener('click', e => { if (e.target.closest('[data-close]')) { if ($('#nobrief', m)?.checked) { prefsFor().briefing = false; save(); toast('Briefing turned off — change it in Preferences'); } } });
}
const prefsFor = () => { DB.prefs ??= {}; return DB.prefs[me().id] ??= { before: 15, browser: true, push: false, sound: true, outRemind: true }; };
let briefedThisLoad = false;

/* ================= PREFERENCES ================= */
PAGE_FN.preferences = () => {
  const u = me(), p = prefsFor(), info = ROLE_INFO[roleKey(u)], opts = [['', `Role default — ${info.land}`], ...PAGES.filter(x => !x[3] || x[3]()).map(x => [x[0], x[1]])];
  const sw = (k, l, h, on) => `<label class="row" style="cursor:pointer;padding:9px 0"><span class="sw"><input type="checkbox" data-chg="pref2" data-k="${k}" ${on ? 'checked' : ''}><span></span></span><span style="flex:1"><b>${l}</b><div class="muted small">${h}</div></span></label>`;
  return head('Preferences', 'Make Orbit land where you want it') + `<div class="grid g2" style="align-items:start"><div class="card"><header><h3>${ic('home')} After I sign in</h3></header><label class="f">Open this page first<select class="select" data-chg="landing">${opts.map(([v, l]) => `<option value="${v}" ${(p.landing || '') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label><div class="muted small" style="margin:8px 0 12px">As <b>${info.label}</b> your default is the <b>${info.land}</b>:</div><ul class="small" style="margin:0 0 8px;padding-left:18px;color:var(--muted)">${info.see.map(x => `<li>${x}</li>`).join('')}</ul>${sw('briefing', 'Daily briefing', 'A short summary of your day the first time you open Orbit each day', p.briefing !== false)}<div class="row"><button class="btn" data-act="brief_now">Preview my briefing</button></div></div>
  <div class="card"><header><h3>${ic('settings')} Look &amp; feel</h3></header>${sw('motionOff', 'Reduce animations', 'Turns off page, chart and button motion', !!p.motionOff)}${sw('compact', 'Compact density', 'Tighter tables and cards to fit more on screen', !!p.compact)}<div class="row" style="padding:9px 0"><span style="flex:1"><b>Theme</b><div class="muted small">Light or dark</div></span><button class="btn" data-act="theme">${ic('moon')} Toggle theme</button></div><div class="row" style="padding-top:9px;border-top:1px solid var(--line)"><span style="flex:1"><b>Duty reminders &amp; push</b><div class="muted small">Alert timing and notifications</div></span><a class="btn" href="#/alerts">Open settings</a></div></div></div>`;
};
CHG.landing = el => { prefsFor().landing = el.value; save(); toast('Saved — you will land on ' + (el.value ? PAGES.find(x => x[0] === el.value)[1] : ROLE_INFO[roleKey(me())].land)); };
CHG.pref2 = el => { prefsFor()[el.dataset.k] = el.dataset.k === 'briefing' ? el.checked : el.checked; save(); applyPrefs(); toast('Preference saved'); };
ACT.brief_now = () => showBriefing();
function applyPrefs() { const p = SESSION && DB.prefs?.[SESSION.id] || {}, r = document.documentElement; r.dataset.motion = p.motionOff ? 'off' : ''; r.dataset.density = p.compact ? 'compact' : ''; }

/* ================= LOGIN: role preview ================= */
ACT.demo = el => {
  const u = el.dataset.u, key = { 'aarav.mehta': 'admin', 'priya.nair': 'hr', 'rohan.iyer': 'manager', 'sneha.kapoor': 'employee' }[u.split('@')[0]], info = ROLE_INFO[key];
  $('#em').value = u; $('#pw').value = 'demo123'; $$('.demo-chip').forEach(c => c.classList.toggle('sel', c === el));
  $('#rolepreview').innerHTML = `<div class="rp"><div class="row"><span class="badge acc">${info.label}</span><b>Lands on: ${info.land}</b></div><ul>${info.see.map((x, i) => `<li style="--i:${i}">${x}</li>`).join('')}</ul><button type="button" class="btn primary" style="width:100%;justify-content:center" data-act="demo_go">Continue as ${info.label} →</button></div>`;
};
ACT.demo_go = () => $('#lf').requestSubmit();

/* ================= wiring ================= */
const _lv = loginView; loginView = function () { _lv(); if (!$('#rolepreview')) $('.demo-chips')?.insertAdjacentHTML('afterend', '<div id="rolepreview"><div class="muted small" style="margin-top:12px">👆 Pick a role to preview what that person sees when they sign in.</div></div>'); };
const _r7 = render;
render = function () { _r7(); applyPrefs(); if (SESSION && !briefedThisLoad) { briefedThisLoad = true; const p = prefsFor(); if (p.briefing !== false && p.briefDate !== TODAY()) { p.briefDate = TODAY(); save(); setTimeout(showBriefing, 700); } }
  const meb = $('.side .me'); if (meb && !$('#prefbtn')) meb.querySelector('[data-act=logout]')?.insertAdjacentHTML('beforebegin', `<a class="icon-btn" id="prefbtn" href="#/preferences" title="Preferences" style="color:#cbd">${ic('settings')}</a>`); };
const _lo3 = logout; logout = function () { briefedThisLoad = false; _lo3(); };
const _boot5 = boot; boot = function () { load(); _boot5(); briefedThisLoad = false; };
document.head.insertAdjacentHTML('beforeend', `<style>
.demo-chip.sel{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);transform:translateY(-2px)}
.rp{margin-top:12px;padding:14px;border-radius:14px;background:var(--surface);border:1px solid var(--line);animation:rise .4s var(--ease)}.rp ul{margin:10px 0 12px;padding-left:18px;font-size:13px;color:var(--muted)}.rp li{margin:3px 0;animation:fadein .4s ease both;animation-delay:calc(var(--i)*70ms + .1s)}
.brief{display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow:auto}.bi{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:14px;background:var(--surface2);border:1px solid var(--line);color:var(--ink);animation:rise .45s var(--ease) both;animation-delay:calc(var(--i)*60ms);transition:transform .2s var(--ease),border-color .2s}.bi:hover{transform:translateX(4px);border-color:var(--accent)}.bi>svg{color:var(--accent);width:22px;height:22px}
[data-motion=off] *,[data-motion=off] *::before,[data-motion=off] *::after{animation:none!important;transition:none!important}
[data-density=compact] .card{padding:12px}[data-density=compact] td,[data-density=compact] th{padding:6px 10px}[data-density=compact] .view{padding-top:14px}[data-density=compact] .page-head{margin-bottom:12px}[data-density=compact] .grid{gap:10px}
</style>`);
boot();
