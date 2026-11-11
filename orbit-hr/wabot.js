'use strict';
/* ============ Orbit — WhatsApp HR bot (client side) + AI assistant ============
   The server receives WhatsApp messages and answers from a small snapshot this app publishes. Requests that change data
   (apply leave, approve/reject) wait in a queue; this app applies them with the normal rules and the bot confirms back.
   Because HR data lives in this app, the queue is processed whenever the app is open on the HR/admin device. */
const WA = { busy: false };
function waSnapshot() {
  const T = TODAY(), emps = {}, payslipOk = !!CFG.botPayslip;
  activeEmps().forEach(e => {
    if (!e.phone) return; const st = dayStatus(e.id, T), sh = shiftOf(e, T), last = payslipOk ? monthsBack(6).find(m => isReleased(m, e.id)) : null;
    const pending = DB.leaves.filter(l => l.status === 'Pending' && l.emp !== e.id && (emp(l.emp)?.mgr === e.id || (e.role === 'hr' && true))).slice(0, 8).map(l => ({ id: l.id, t: 'leave', label: `${emp(l.emp)?.name.split(' ')[0]} — ${l.days}d ${LEAVE_TYPES[l.type]?.replace(' Leave', '') || l.type}, ${fmtShort(l.from)}${l.to !== l.from ? '–' + fmtShort(l.to) : ''}` }));
    emps[e.id] = { name: e.name, phone: e.phone, role: e.role, mgr: e.mgr || '', dept: e.dept, leave: Object.fromEntries(['CL', 'SL', 'EL', 'CO'].map(k => { const b = leaveBalance(e.id, k); return [k, { left: b.left === Infinity ? 99 : b.left, total: DB.settings.quota[k] ?? 0 }]; })), today: { s: STATUS_LABEL[st.s] || st.s, in: st.r?.in || '', out: st.r?.out || '', shift: sh ? `${sh.name} ${sh.start}–${sh.end}` : '' }, payslip: last ? (() => { const p = payslip(e.id, last); return { ym: last, gross: p.gross, net: p.net }; })() : null, pending };
  });
  return { emps, holidays: HOLIDAYS.filter(h => h[0] >= T).slice(0, 12) };
}
async function waPush() { if (!CFG.bot || !SESSION) return; try { await API.post('/api/snapshot', waSnapshot()); } catch { } }
async function waPoll() {
  if (!CFG.bot || !SESSION || WA.busy || offNow()) return; WA.busy = true;
  try {
    const { cmds } = await (await fetch('/api/wa/commands', { cache: 'no-store' })).json(); let n = 0;
    for (const c of cmds || []) { let r; try { r = waApply(c); } catch (e) { r = { ok: false, msg: 'Sorry, I could not do that: ' + e.message }; } await API.post('/api/wa/ack', { id: c.id, ok: r.ok, msg: r.msg }).catch(() => { }); n++; }
    if (n) { save(); render(); waPush(); }
  } catch { } WA.busy = false;
}
function waApply(c) {
  const e = emp(c.emp); if (!e || e.status === 'Exited') return { ok: false, msg: 'Your profile is not active.' };
  if (c.type === 'leave') {
    const d = c.data, days = leaveDays(d.from, d.to, e.id); if (!days) return { ok: false, msg: 'Those dates are your weekly off or holidays — no leave is needed.' };
    if (DB.leaves.some(l => l.emp === e.id && l.status !== 'Rejected' && !(d.to < l.from || d.from > l.to))) return { ok: false, msg: 'You already have a leave request on those dates.' };
    const ap = e.mgr || DB.employees.find(x => x.role === 'hr')?.id || 'E002'; DB.leaves.unshift({ id: uid('L'), emp: e.id, type: d.type, from: d.from, to: d.to, days, status: 'Pending', reason: d.reason, ts: TODAY(), approver: ap, via: 'WhatsApp' });
    notify(ap, `${e.name} applied for ${days} day(s) of ${LEAVE_TYPES[d.type]} (via WhatsApp)`); log(`Leave applied via WhatsApp by ${e.name}`);
    return { ok: true, msg: `✅ Leave request recorded: ${days} working day${days > 1 ? 's' : ''} of ${LEAVE_TYPES[d.type]}. Waiting for approval from ${emp(ap)?.name || 'your manager'}.` };
  }
  if (c.type === 'decision') {
    const l = DB.leaves.find(x => x.id === c.data.id); if (!l) return { ok: false, msg: 'That request no longer exists.' }; if (l.status !== 'Pending') return { ok: false, msg: `Already ${l.status.toLowerCase()}.` };
    const ok = l.emp !== e.id && (emp(l.emp)?.mgr === e.id || e.role === 'hr' || e.role === 'admin'); if (!ok) return { ok: false, msg: 'You are not allowed to decide that request.' };
    l.status = c.data.v; l.by = e.id; if (c.data.note) l.note = c.data.note; notify(l.emp, `Your leave was ${l.status.toLowerCase()} by ${e.name}${c.data.note ? ': ' + c.data.note : ''}`); log(`${l.status} leave for ${emp(l.emp)?.name} via WhatsApp (${e.name})`);
    return { ok: true, msg: `${l.status === 'Approved' ? '✅' : '❌'} ${l.status}: ${emp(l.emp)?.name}'s ${l.days}-day leave. They have been notified.` };
  }
  return { ok: false, msg: 'Unknown request.' };
}
setInterval(waPoll, 20000); setInterval(waPush, 180000); addEventListener('load', () => setTimeout(() => { waPush(); waPoll(); }, 4000));

/* ================= AI assistant (chat widget) =================
   Rules answer instantly for the things they know (balances, holidays, who is on leave…). Anything else goes to the AI,
   which only receives what the asker is allowed to see plus published policies. */
function aiContext() {
  const u = me(), T = TODAY(), L = [], share = CFG.aiShare !== false;
  L.push(`Today is ${T} (${new Date(T + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })}). Company: ${DB.company}. Currency INR.`);
  L.push('Holidays: ' + HOLIDAYS.filter(h => h[0] >= T).slice(0, 6).map(h => `${h[0]} ${h[1]}`).join('; '));
  (DB.policies || []).filter(p => p.status === 'Published' && inAud(p, u)).forEach(p => L.push(`POLICY "${p.title}" (v${p.version}, ${p.cat}): ${p.summary} ${String(p.body || '').replace(/[#*]/g, '').replace(/\n+/g, ' ').slice(0, 1400)}`));
  L.push('App pages: Dashboard, People, Attendance (check-in/out, corrections), Leave (apply/approve), Payroll (payslips, claims, loans), Policies & docs (read/acknowledge), Helpdesk (raise a ticket), Duty roster, Meetings, Assets. Tell the user which page to open.');
  if (share) {
    const sh = shiftOf(u, T), nx = dayPlan(u, addDays(T, 1)), st = dayStatus(u.id, T);
    L.push(`ASKER: ${u.name}, ${u.title}, ${u.dept}, role ${u.role}, joined ${u.joined}, manager ${emp(u.mgr)?.name || 'none'}.`, `Shift today: ${sh.name} ${sh.start}-${sh.end}. Today's status: ${STATUS_LABEL[st.s] || st.s}${st.r?.in ? ', in ' + st.r.in : ''}. Tomorrow: ${nx.t === 'work' ? nx.shift.name + ' ' + nx.shift.start + '-' + nx.shift.end : nx.t}.`);
    L.push('Leave balance: ' + ['CL', 'SL', 'EL', 'CO'].map(k => `${LEAVE_TYPES[k]} ${leaveBalance(u.id, k).left}`).join(', '));
    const mine = DB.leaves.filter(l => l.emp === u.id).slice(0, 4); if (mine.length) L.push('Recent leave requests: ' + mine.map(l => `${l.from}..${l.to} ${l.type} ${l.status}`).join('; '));
    const off = [...Array(14)].map((_, i) => addDays(T, i)).filter(d => dayPlan(u, d).t === 'off').slice(0, 3); if (off.length) L.push('Upcoming weekly offs: ' + off.join(', '));
    const ym = monthsBack(6).find(m => isReleased(m, u.id)); if (ym) { const p = payslip(u.id, ym); L.push(`Latest payslip ${ym}: gross ${Math.round(p.gross)}, net ${Math.round(p.net)}.`); }
    if (isMgr() || isHR()) { const team = isHR() ? activeEmps() : activeEmps().filter(e => e.mgr === u.id), c = { present: 0, late: 0, absent: 0, leave: 0 }; team.forEach(e => { const s = dayStatus(e.id, T).s; if (s === 'present' || s === 'wfh') c.present++; else if (s === 'late') c.late++; else if (s === 'absent') c.absent++; else if (s === 'leave') c.leave++; }); L.push(`${isHR() ? 'Company' : 'Team'} today: ${team.length} people, present ${c.present}, late ${c.late}, absent ${c.absent}, on leave ${c.leave}. Pending approvals: ${pendingCount()}.`); }
  }
  return L.join('\n');
}
const _answer = answer;
async function askAI(v) {
  const hist = S.chat.msgs.slice(-8, -1).filter(m => m.t && !m.pending).map(m => ({ r: m.b ? 'a' : 'u', t: m.t }));
  const r = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emp: me().id, q: v, context: aiContext(), history: hist }) }), j = await r.json(); if (j.off) throw new Error('off'); if (!r.ok) throw new Error(j.error || 'AI error'); return j.answer;
}
ask = function (v) {
  S.chat.msgs.push({ t: v }); const rule = _answer(v), fallback = /^I can help with:/.test(rule) || (CFG.ai && /polic|rule|allowed|entitle|notice period|probation|dress|overtime/i.test(v) && !/^(show |list |all |what |which )*(the )?(company )?policies\??$/i.test(v.trim()));
  if (!fallback || !CFG.ai || offNow()) { S.chat.msgs.push({ b: 1, t: fallback && CFG.ai && offNow() ? 'I need an internet connection for open questions.\n\n' + rule : rule }); return drawChat(); }
  const m = { b: 1, t: '…', pending: true, ai: true }; S.chat.msgs.push(m); drawChat();
  askAI(v).then(a => { m.t = a; m.pending = false; }).catch(e => { m.t = e.message === 'off' ? rule : `The AI assistant is unavailable right now (${e.message}).\n\n${rule}`; m.pending = false; m.ai = false; }).finally(drawChat);
};
{ const _dc = drawChat; drawChat = function () { _dc(); const s = $('#chatbox .chat header .small'); if (s) s.textContent = CFG.ai ? 'AI + rules' : 'rule-based · offline'; $$('#msgs .m').forEach((el, i) => { const m = S.chat.msgs[i]; if (m?.ai) el.classList.add('ai'); if (m?.pending) el.classList.add('pending'); }); const sg = $('#chatbox .sugg'); if (sg && CFG.ai && !sg.dataset.x) { sg.dataset.x = 1; sg.insertAdjacentHTML('beforeend', ['What is the POSH policy?', 'When is my next day off?'].map(s => `<button data-act="ask" data-q="${s}">${s}</button>`).join('')); } }; }
document.head.insertAdjacentHTML('beforeend', `<style>.chat .m{white-space:pre-wrap}.chat .m.ai::before{content:"✨ AI";display:block;font-size:10px;font-weight:800;letter-spacing:.08em;opacity:.6;margin-bottom:2px}.chat .m.pending{opacity:.65;animation:pulse-badge 1.2s infinite}</style>`);
