'use strict';
/* ============ Orbit Realty — Policies & documents: HR publishes, employees read in-app, acknowledge, and (if HR allows) download ============ */
const POL_CATS = ['Conduct & ethics', 'HR & leave', 'Safety & site', 'IT & data', 'Finance & expenses', 'Legal & compliance'];
const POL_ICON = { 'Conduct & ethics': '🤝', 'HR & leave': '🗓', 'Safety & site': '🦺', 'IT & data': '🔐', 'Finance & expenses': '💳', 'Legal & compliance': '⚖️' };
const DL_MODES = [['allow', '⬇ Everyone can download'], ['mgr', '⬇ Managers & HR only'], ['deny', '👁 Read-only (no download or print)']];
const POL_SEED = [
  ['Code of Conduct', 'Conduct & ethics', 'How we treat each other, buyers, channel partners and vendors.', `# Code of Conduct
## Respect
- Treat colleagues, buyers and partners with courtesy. No abuse, discrimination or intimidation, in person or on WhatsApp/e-mail.
- Dress and behave professionally at the office, at site offices and during site visits.
## Honesty with customers
- Never promise approvals, possession dates, discounts or returns that are not in writing from the company.
- Quote only the price sheet released by Sales Operations. Do not take cash or "token" outside official receipts.
## Conflicts of interest
- Declare any interest in a property, broker, contractor or vendor we deal with. Gifts above ₹2,000 must be reported to HR.
## Reporting
- Raise concerns with your manager or HR. Retaliation against anyone who reports in good faith is a disciplinary offence.`],
  ['Leave & Attendance Policy', 'HR & leave', 'Leave quotas, approvals, regularisation, rotational off days and holidays.', `# Leave & Attendance Policy
## Working pattern
- Duty timings and weekly offs are rotational and published in the Duty roster. Your roster is the source of truth for late and absent marking.
- Check in and out from your allotted location (office or site) using the method set by HR (normal, location or face).
## Leave
- Apply for leave in the app before the leave starts. Approval is by your reporting manager; HR can override.
- Casual and sick leave balances are shown in your profile. Unapproved absence is Loss of Pay.
## Regularisation
- Forgotten punches can be regularised within 3 working days with a reason. Repeated requests may be reviewed.
## Late marks
- Arrival after the grace time counts as a late mark. Beyond the allowed late marks in a month, the attendance penalty rule applies.`],
  ['Work From Home Policy', 'HR & leave', 'Eligibility, expectations and equipment for remote days.', `# Work From Home Policy
- WFH is available to roles marked eligible by HR and needs manager approval for each day.
- You must be reachable on chat and phone during your duty hours and complete your tasks as planned.
- Site visits, client meetings and registrations cannot be done as WFH.
- Company data stays on company-approved apps. Do not forward documents to personal e-mail.`],
  ['POSH — Anti-harassment Policy', 'Legal & compliance', 'Zero tolerance for sexual harassment and how to raise a complaint.', `# Prevention of Sexual Harassment (POSH) Policy
This policy follows the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013.
## What is covered
- Unwelcome physical contact, advances, remarks, showing pornography, or any unwelcome conduct of a sexual nature, at the office, at sites, on calls, chats or at company events.
## How to complain
- Write to the Internal Committee (IC) within 3 months of the incident. The IC will keep your identity confidential.
- The IC completes its inquiry within 90 days. No retaliation is permitted.
## Everyone's duty
- Complete the annual POSH awareness session. Managers must escalate any concern they hear about.`],
  ['Information Security & Privacy Policy', 'IT & data', 'Passwords, devices, customer data, and how we use your location and face data.', `# Information Security & Privacy
## Protect data
- Use strong passwords and never share them. Lock your screen when away.
- Customer lists, KYC copies and payment proofs are confidential. Share only with people who need them for their work.
## Your personal data (DPDP Act, 2023)
- We collect ID proofs, bank details and attendance data to run payroll, statutory compliance and safety.
- Location is read only at check-in and during approved field duty. Face images are used only to verify attendance and are not shared outside the company.
- You can ask HR to correct your data or explain how it is used.
## Incidents
- Report a lost phone, suspicious e-mail or data leak to IT and HR immediately.`],
  ['Expense & Travel Policy', 'Finance & expenses', 'What is reimbursable, limits, and how to claim.', `# Expense & Travel Policy
- Claim expenses in the app within 30 days with the bill attached.
- Local site-visit travel is reimbursed at actuals for public transport or ₹ per km as set by Finance for own vehicle.
- Hotel and outstation travel needs prior approval from your manager.
- Entertainment of clients is reimbursable only with prior approval and a guest list.
- False or duplicate claims lead to disciplinary action and recovery from salary.`],
  ['Site Safety Policy', 'Safety & site', 'PPE, site entry rules and incident reporting for all site visits.', `# Site Safety Policy
## Before you enter a site
- Check in at the site location. Wear a helmet, safety shoes and a visibility jacket. Visitors must be accompanied.
## On site
- Keep to marked walkways. Do not go near open edges, shafts, cranes or live electrical work.
- Never take buyers into an area that is not marked safe by the site engineer.
## Incidents
- Report every injury or near miss to the site engineer and HR on the same day. First-aid kits are at every site office.`],
  ['Attendance & Geo-fence Policy', 'Legal & compliance', 'Why we verify check-ins, what counts as spoofing and what happens if flagged.', `# Attendance & Geo-fence Policy
- Check-ins may be verified by location, face and device checks as configured by HR for your work type.
- Using mock-location apps, VPNs to fake position, photos of faces, or punching for someone else is treated as attendance fraud.
- A flagged check-in goes to HR for review. You will be asked to explain before any action is taken.
- If your phone's GPS is weak, choose the correct location in the check-in screen and add a reason; HR will review it.`]
];
const POLS = () => DB.policies || (DB.policies = []);
const polById = id => POLS().find(p => p.id === id);
const inAud = (p, e) => p.aud !== 'dept' || (p.depts || []).includes(e.dept);
const ackRec = (p, id) => DB.policyAck?.[p.id]?.[id];
const polState = (p, id) => { const a = ackRec(p, id); if (a && a.v >= p.version) return 'done'; if (!p.mandatory) return 'optional'; return p.due && p.due < TODAY() ? 'overdue' : 'pending'; };
const polPending = u => POLS().filter(p => p.status === 'Published' && inAud(p, u) && p.mandatory && polState(p, u.id) !== 'done');
const canDl = p => isHR() || can('docs.manage') || p.dl === 'allow' || (p.dl === 'mgr' && (isMgr() || isHR()));
const polAudience = p => activeEmps().filter(e => inAud(p, e));
const polStats = p => { const a = polAudience(p), done = a.filter(e => polState(p, e.id) === 'done').length; return { n: a.length, done, pct: a.length ? Math.round(done / a.length * 100) : 0 }; };
const polDlLog = (p, act) => { (DB.policyLog ||= []).unshift({ ts: Date.now(), emp: me().id, pol: p.id, v: p.version, act }); DB.policyLog.length = Math.min(DB.policyLog.length, 600); };

function ensurePolicies() {
  DB.policyAck ||= {}; DB.policyOpen ||= {}; DB.policyLog ||= []; DB.settings ||= {}; DB.settings.polDl ||= 'allow';
  if (DB.policies) return;
  const T = TODAY(), now = Date.now(), legacy = DB.acks || {};
  DB.policies = POL_SEED.map((s, i) => ({ id: 'P' + (i + 1), title: s[0], cat: s[1], summary: s[2], body: s[3], version: i === 1 ? 2 : 1, status: 'Published', effective: addDays(T, -90 + i * 7), due: i === 1 ? addDays(T, 10) : addDays(T, 20 - i), mandatory: true, aud: 'all', depts: [], dl: i === 3 ? 'deny' : i === 4 ? 'mgr' : 'allow', watermark: true, file: null, updated: now - (90 - i * 7) * 864e5, by: 'E001', hist: [{ v: 1, ts: now - 90 * 864e5, by: 'E001', note: 'First issue' }].concat(i === 1 ? [{ v: 2, ts: now - 5 * 864e5, by: 'E001', note: 'Rotational offs and late-mark rules updated' }] : []) }));
  DB.employees.forEach(e => { const hist = legacy[e.id] || []; DB.policies.forEach((p, i) => { const h = [...e.id].reduce((a, c) => a + c.charCodeAt(0), 0) + i * 7; const doneLegacy = hist.includes(i), seeded = false; if (doneLegacy || seeded) { (DB.policyAck[p.id] ||= {})[e.id] = { v: i === 1 ? (h % 2 ? 2 : 1) : 1, ts: now - (h % 40 + 1) * 864e5 }; } }); });
}
const _bootPo = boot; let _poBrief = false;
boot = function () { load(); ensurePolicies(); save(); if (!_poBrief && typeof briefingItems === 'function') { _poBrief = true; const _b = briefingItems; briefingItems = function () { const o = _b(), n = polPending(me()).length; if (n) o.splice(Math.min(2, o.length), 0, { icon: 'file', title: `${n} polic${n > 1 ? 'ies' : 'y'} to read & acknowledge`, sub: polPending(me()).slice(0, 2).map(p => p.title).join(' · '), href: '#/documents', label: 'Read now' }); return o; }; } _bootPo(); };

/* ---------- text rendering ---------- */
const polInl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
function polHtml(t) { let h = '', ul = false; for (const raw of String(t || '').split('\n')) { const l = raw.trimEnd(); if (/^\s*[-•]\s+/.test(l)) { if (!ul) { h += '<ul>'; ul = true; } h += `<li>${polInl(l.replace(/^\s*[-•]\s+/, ''))}</li>`; continue; } if (ul) { h += '</ul>'; ul = false; } if (/^##\s+/.test(l)) h += `<h4>${polInl(l.slice(3))}</h4>`; else if (/^#\s+/.test(l)) h += `<h3>${polInl(l.slice(2))}</h3>`; else if (l.trim()) h += `<p>${polInl(l)}</p>`; } return h + (ul ? '</ul>' : ''); }
const polWm = () => { const u = me(), t = esc(`${u.name} · ${u.id}`); return `url('data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='300' height='170'><text x='150' y='90' text-anchor='middle' transform='rotate(-24 150 85)' font-size='15' font-family='sans-serif' fill='rgba(110,110,110,.17)'>${t}</text></svg>`).replace(/'/g, '%27')}')`; };
const polPlain = p => `${DB.company} — ${p.title}\nVersion ${p.version} · Effective ${fmtDate(p.effective)} · ${p.cat}\n${p.watermark ? `Downloaded by ${me().name} (${me().id}) on ${fmtDate(TODAY())} — confidential, for internal use\n` : ''}\n${p.body.replace(/^#+\s*/gm, '').replace(/\*\*/g, '')}\n`;

/* ---------- downloads ---------- */
async function polDownload(p, kind) {
  if (!canDl(p)) { toast('Downloading this policy is turned off by HR', 'err'); return; }
  if (kind === 'auto') kind = p.file ? 'file' : 'pdf';
  if (kind === 'file' && p.file) { const r = await fileGet(p.file.id); if (!r) return toast('The attached file is missing', 'err'); const a = document.createElement('a'); a.href = URL.createObjectURL(r.blob); a.download = p.file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  else if (kind === 'txt') download(`${p.title.replace(/[^\w]+/g, '-')}-v${p.version}.txt`, polPlain(p), 'text/plain');
  else { const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f); f.srcdoc = `<html><head><title>${esc(p.title)} v${p.version}</title><style>${typeof LH_CSS === 'string' ? LH_CSS : ''}@page{size:A4;margin:14mm}body{font:14px/1.6 system-ui,sans-serif;color:#111;padding:0;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;${p.watermark ? `background-image:${polWm()};` : ''}}h3{font-size:20px}h4{margin:18px 0 4px}ul{padding-left:20px}.m{color:#666;font-size:12px;margin-bottom:16px}</style></head><body>${typeof lhHead === 'function' ? lhHead() : ''}<div class="m">${esc(typeof lhName === 'function' ? lhName() : DB.company)} · Version ${p.version} · Effective ${fmtDate(p.effective)}${p.watermark ? ` · Downloaded by ${esc(me().name)} (${esc(me().id)})` : ''}</div><h3>${esc(p.title)}</h3>${polHtml(p.body)}${typeof lhFoot === 'function' ? lhFoot('Company policy — for internal use.') : ''}</body></html>`; f.onload = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }; toast('Choose “Save as PDF” in the print dialog'); }
  polDlLog(p, kind === 'file' ? 'download' : kind === 'txt' ? 'download' : 'print'); save();
}

/* ---------- reader ---------- */
async function openPolicy(id) {
  const p = polById(id), u = me(); if (!p) return; const a = ackRec(p, u.id), done = a && a.v >= p.version, dl = canDl(p), st = polState(p, u.id);
  const o = (DB.policyOpen[p.id] ||= {}); if (!o[u.id] || o[u.id].v < p.version) { o[u.id] = { ts: Date.now(), v: p.version }; polDlLog(p, 'view'); save(); }
  let furl = '', fr = null; if (p.file) { fr = await fileGet(p.file.id); if (fr) furl = URL.createObjectURL(fr.blob); }
  const isPdf = p.file && /pdf/i.test(p.file.mime), isImg = p.file && /^image\//.test(p.file.mime);
  const fileHtml = !p.file ? '' : !fr ? '<div class="empty">The attached document is missing — ask HR to upload it again.</div>' : isPdf ? `<iframe class="polpdf" src="${furl}${dl ? '' : '#toolbar=0&navpanes=0'}" title="${esc(p.title)}"></iframe>` : isImg ? `<img src="${furl}" style="max-width:100%;border-radius:10px">` : `<div class="muted small">Preview unavailable for this file type.</div>`;
  const needScroll = !!p.body && !done, needFile = !!p.file && !done;
  const m = modal(`${POL_ICON[p.cat] || '📄'} ${esc(p.title)}`, `<div class="row wrap" style="gap:6px;margin-bottom:10px"><span class="badge info">v${p.version}</span><span class="badge">Effective ${fmtDate(p.effective)}</span><span class="badge">${esc(p.cat)}</span>${p.mandatory ? '<span class="badge warn">Mandatory</span>' : ''}${p.due && !done && p.mandatory ? `<span class="badge ${st === 'overdue' ? 'bad' : ''}">Due ${fmtDate(p.due)}</span>` : ''}<span class="badge ${dl ? 'ok' : ''}">${dl ? '⬇ Download allowed' : '👁 Read-only'}</span></div>
  ${p.summary ? `<p class="muted small" style="margin:0 0 10px">${esc(p.summary)}</p>` : ''}
  <div class="polread ${dl ? '' : 'nocopy'}" id="polread" style="${p.watermark ? 'background-image:' + polWm() : ''}">${p.body ? polHtml(p.body) : ''}${fileHtml}</div>
  <div class="polbar"><i id="polprog"></i></div>
  <div class="row between wrap" style="gap:10px;margin-top:12px">
    <div class="row wrap" style="gap:6px">${dl ? `${p.file ? '<button type="button" class="btn sm" id="pdlf">⬇ Original file</button>' : ''}${p.body ? '<button type="button" class="btn sm" id="pdlp">⬇ PDF</button><button type="button" class="btn sm ghost" id="pdlt">.txt</button>' : ''}` : '<span class="muted small">🔒 HR has set this policy to read-only — download and print are off.</span>'}</div>
    <div style="min-width:260px;text-align:right">${done ? `<span class="badge ok">✓ Acknowledged v${a.v} on ${fmtDate(new Date(a.ts).toISOString().slice(0, 10))}</span>${a.v < p.version ? '' : ''}` : `<label class="row" style="gap:8px;justify-content:flex-end;cursor:pointer;margin-bottom:8px"><input type="checkbox" id="pchk" disabled><span class="small">I have read and understood this policy</span></label><button type="button" class="btn primary" id="pack" disabled>Acknowledge &amp; agree</button><div class="muted small" id="phint" style="margin-top:4px">${needScroll ? 'Scroll to the end to continue' : 'Open the document to continue'}</div>`}</div>
  </div>${a && !done ? `<p class="small" style="color:var(--amber);margin:10px 0 0">This policy was updated to v${p.version} — your v${a.v} acknowledgement no longer applies. Please read the changes and acknowledge again.</p>` : ''}`, null, '', true);
  const box = $('#polread', m), chk = $('#pchk', m), btn = $('#pack', m), hint = $('#phint', m), prog = $('#polprog', m); let scrolled = !needScroll, fileSeen = !needFile;
  const upd = () => { const ok = scrolled && fileSeen; if (chk) { chk.disabled = !ok; if (!ok) chk.checked = false; } if (btn) btn.disabled = !(ok && chk?.checked); if (hint) hint.textContent = ok ? (chk.checked ? '' : 'Tick the box to continue') : (!scrolled ? 'Scroll to the end to continue' : 'Open the document to continue'); };
  const chkEnd = () => { const max = box.scrollHeight - box.clientHeight; const pc = max <= 4 ? 100 : Math.min(100, Math.round(box.scrollTop / max * 100)); prog.style.width = pc + '%'; if (pc >= 98) { scrolled = true; upd(); } };
  box.addEventListener('scroll', chkEnd); setTimeout(chkEnd, 60); if (needFile) { const fe = $('iframe,img', box); if (fe) fe.addEventListener('load', () => { fileSeen = true; upd(); }); else fileSeen = true; setTimeout(() => { if (needFile && !fileSeen) { fileSeen = true; upd(); } }, 2500); }
  if (chk) { chk.onchange = upd; upd(); }
  if (btn) btn.onclick = () => { (DB.policyAck[p.id] ||= {})[u.id] = { v: p.version, ts: Date.now() }; log(`Acknowledged policy ${p.title} v${p.version}`); save(); m.remove(); render(); toast('Thanks — acknowledgement recorded'); };
  $('#pdlf', m)?.addEventListener('click', () => polDownload(p, 'file')); $('#pdlp', m)?.addEventListener('click', () => polDownload(p, 'pdf')); $('#pdlt', m)?.addEventListener('click', () => polDownload(p, 'txt'));
  if (!dl) { box.addEventListener('copy', e => e.preventDefault()); box.addEventListener('contextmenu', e => e.preventDefault()); }
  m.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === m) { if (furl) setTimeout(() => URL.revokeObjectURL(furl), 500); } });
}
ACT.pol_open = el => openPolicy(el.dataset.id);
ACT.pol_dl = el => { const p = polById(el.dataset.id); if (p) polDownload(p, 'auto'); };
ACT.ack = el => openPolicy('P' + (+el.dataset.i + 1));

/* ---------- employee library ---------- */
const PF = () => (S.pol ||= { q: '', st: '', cat: '' });
INP.polq = el => { PF().q = el.value; render(); }; CHG.polst = el => { PF().st = el.value; render(); }; CHG.polcat = el => { PF().cat = el.value; render(); };
const stBadge = (p, id) => { const s = polState(p, id); return s === 'done' ? '<span class="badge ok">✓ Acknowledged</span>' : s === 'overdue' ? '<span class="badge bad">Overdue</span>' : s === 'pending' ? '<span class="badge warn">Needs acknowledgement</span>' : '<span class="badge">Optional</span>'; };
function polLibrary() {
  const u = me(), f = PF(), all = POLS().filter(p => p.status === 'Published' && inAud(p, u)), q = f.q.toLowerCase();
  const list = all.filter(p => (!f.cat || p.cat === f.cat) && (!f.st || (f.st === 'done' ? polState(p, u.id) === 'done' : polState(p, u.id) !== 'done')) && (!q || (p.title + p.summary + p.cat).toLowerCase().includes(q)));
  const pend = polPending(u).length, done = all.filter(p => polState(p, u.id) === 'done').length;
  return `<div class="grid g3" style="margin-bottom:14px"><div class="card kpi"><span class="v" style="${pend ? 'color:var(--amber)' : ''}">${pend}</span><span class="l">Need your acknowledgement</span></div><div class="card kpi"><span class="v">${done}</span><span class="l">Acknowledged</span></div><div class="card kpi"><span class="v">${all.length}</span><span class="l">Policies for you</span></div></div>
  ${pend ? `<div class="card polnudge"><b>📌 ${pend} polic${pend > 1 ? 'ies' : 'y'} waiting for you.</b> <span class="muted">Open each one, read to the end and acknowledge.</span></div>` : ''}
  <div class="toolbar"><input class="input" id="polq" data-inp="polq" placeholder="Search policies…" value="${esc(f.q)}" style="min-width:240px"><select class="select" data-chg="polst">${[['', 'All'], ['todo', 'To acknowledge'], ['done', 'Acknowledged']].map(x => `<option value="${x[0]}" ${f.st === x[0] ? 'selected' : ''}>${x[1]}</option>`).join('')}</select><select class="select" data-chg="polcat"><option value="">All categories</option>${POL_CATS.map(c => `<option ${f.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
  ${list.length ? `<div class="grid g2">${list.map(p => { const dl = canDl(p), a = ackRec(p, u.id); return `<div class="card polcard ${polState(p, u.id) === 'done' ? 'ok' : ''}"><div class="row" style="align-items:flex-start;gap:12px"><span class="polic">${POL_ICON[p.cat] || '📄'}</span><div style="flex:1;min-width:0"><b>${esc(p.title)}</b><div class="muted small">${esc(p.summary)}</div></div></div>
  <div class="row wrap" style="gap:6px;margin:10px 0 0"><span class="badge info">v${p.version}</span><span class="badge">${esc(p.cat)}</span>${stBadge(p, u.id)}${a && a.v < p.version ? '<span class="badge warn">Updated — re-acknowledge</span>' : ''}<span class="badge ${dl ? 'ok' : ''}" title="${dl ? 'You may download this policy' : 'HR has set this policy to read-only'}">${dl ? '⬇ Download' : '👁 Read-only'}</span></div>
  <div class="row between" style="margin-top:12px"><span class="muted small">${a && a.v >= p.version ? 'Acknowledged ' + fmtDate(new Date(a.ts).toISOString().slice(0, 10)) : p.due && p.mandatory ? 'Due ' + fmtDate(p.due) : 'Effective ' + fmtDate(p.effective)}</span><div class="row" style="gap:6px"><button class="btn sm ${polState(p, u.id) === 'done' ? '' : 'primary'}" data-act="pol_open" data-id="${p.id}">${polState(p, u.id) === 'done' ? 'Read again' : 'Read & acknowledge'}</button>${dl ? `<button class="btn sm" data-act="pol_dl" data-id="${p.id}" title="Download">⬇</button>` : ''}</div></div></div>`; }).join('')}</div>` : '<div class="card empty">No policies match.</div>'}`;
}

/* ---------- HR: manage ---------- */
function polManage() {
  const L = POLS(), dd = DB.settings.polDl;
  return `<div class="card" style="margin-bottom:14px"><div class="row between wrap" style="gap:10px"><div><b>Download option for employees</b><div class="muted small">Choose who can download or print policies. Read-only policies can still be read and acknowledged in the app.</div></div><div class="row wrap" style="gap:6px"><span class="muted small">Set for all policies:</span>${DL_MODES.map(m => `<button class="btn sm" data-act="pol_dlall" data-v="${m[0]}">${m[1]}</button>`).join('')}</div></div></div>
  <div class="card pad0"><table class="table"><thead><tr><th>Policy</th><th>Version</th><th>Status</th><th>Audience</th><th>Download</th><th>Acknowledged</th><th></th></tr></thead><tbody>${L.map(p => { const s = polStats(p); return `<tr><td><b>${esc(p.title)}</b><div class="muted small">${POL_ICON[p.cat] || ''} ${esc(p.cat)}${p.mandatory ? ' · Mandatory' : ''}${p.file ? ' · 📎 file' : ''}</div></td><td>v${p.version}</td><td><span class="badge ${p.status === 'Published' ? 'ok' : ''}">${p.status}</span></td><td class="small">${p.aud === 'dept' ? esc((p.depts || []).join(', ')) : 'Everyone'}</td>
  <td><select class="select" data-chg="poldl" data-id="${p.id}" style="min-width:210px">${DL_MODES.map(m => `<option value="${m[0]}" ${p.dl === m[0] ? 'selected' : ''}>${m[1]}</option>`).join('')}</select></td>
  <td style="min-width:130px"><div class="bar"><i style="width:${s.pct}%"></i></div><span class="muted small">${s.done}/${s.n} · ${s.pct}%</span></td>
  <td style="white-space:nowrap"><button class="btn sm" data-act="pol_edit" data-id="${p.id}">Edit</button> <button class="btn sm" data-act="pol_track" data-id="${p.id}">Tracker</button> <button class="btn sm ghost" data-act="pol_arch" data-id="${p.id}">${p.status === 'Archived' ? 'Restore' : 'Archive'}</button> <button class="btn sm ghost danger" data-act="pol_del" data-id="${p.id}">✕</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">No policies yet.</td></tr>'}</tbody></table></div>`;
}
CHG.poldl = el => { const p = polById(el.dataset.id); p.dl = el.value; p.updated = Date.now(); log(`Download for “${p.title}” set to ${el.value}`); save(); toast('Download option updated'); render(); };
ACT.pol_dlall = el => { if (!can('docs.manage')) return deny('docs.manage'); POLS().forEach(p => p.dl = el.dataset.v); DB.settings.polDl = el.dataset.v; log('Download option for all policies: ' + el.dataset.v); save(); render(); toast('Applied to all policies'); };
ACT.pol_arch = el => { const p = polById(el.dataset.id); p.status = p.status === 'Archived' ? 'Published' : 'Archived'; log(`${p.status} policy ${p.title}`); save(); render(); };
ACT.pol_del = el => { const p = polById(el.dataset.id); confirmBox(`Delete “${esc(p.title)}” and all its acknowledgement records? This cannot be undone. (Archive it instead to keep the history.)`, () => { if (p.file) fileDel(p.file.id).catch(() => { }); DB.policies = POLS().filter(x => x.id !== p.id); delete DB.policyAck[p.id]; delete DB.policyOpen[p.id]; log('Deleted policy ' + p.title); save(); render(); }); };
ACT.pol_track = el => { S.polTrack = el.dataset.id; S.tab.docs = 'trk'; render(); };

function polModal(p0) {
  const isNew = !p0, p = p0 || { title: '', cat: POL_CATS[0], summary: '', body: '', mandatory: true, aud: 'all', depts: [], dl: DB.settings.polDl || 'allow', watermark: true, status: 'Published', effective: TODAY(), version: 1, file: null };
  modal(isNew ? 'New policy' : 'Edit — ' + esc(p.title), `<div class="form-grid">${fld('Title', 'title', p.title, 'text', 'required', 'full')}${sel('Category', 'cat', POL_CATS, p.cat)}${sel('Status', 'status', ['Published', 'Draft', 'Archived'], p.status)}${fld('One-line summary', 'summary', p.summary, 'text', '', 'full')}
  <label class="f full">Policy text<textarea class="input" name="body" rows="12" placeholder="# Heading&#10;## Sub-heading&#10;- Bullet point&#10;Plain paragraph. Use **bold** for emphasis.">${esc(p.body)}</textarea><span class="muted small">Tip: “# ” is a title, “## ” a heading, “- ” a bullet. Or attach a PDF below instead.</span></label>
  <label class="f full">Attach a PDF or image (optional, max 8 MB)<input class="input" type="file" name="pfile" accept="application/pdf,image/*"></label>${p.file ? `<label class="row full" style="gap:8px"><input type="checkbox" name="rmfile"> <span class="small">Remove current file: ${esc(p.file.name)}</span></label>` : ''}
  ${fld('Effective from', 'effective', p.effective, 'date')}${fld('Days to acknowledge', 'days', 14, 'number', 'min="1" max="90"')}
  ${sel('Who can download', 'dl', DL_MODES, p.dl, 'full')}
  ${sel('Audience', 'aud', [['all', 'Everyone'], ['dept', 'Selected departments only']], p.aud)}<div class="f"><span>Departments (if selected)</span><div class="row wrap" style="gap:8px">${DEPTS.map(d => `<label class="row" style="gap:4px;cursor:pointer"><input type="checkbox" name="d_${esc(d)}" ${(p.depts || []).includes(d) ? 'checked' : ''}> <span class="small">${esc(d)}</span></label>`).join('')}</div></div></div>
  <div class="col" style="gap:8px;margin-top:10px"><label class="row" style="gap:8px;cursor:pointer"><input type="checkbox" name="mandatory" ${p.mandatory ? 'checked' : ''}> <span><b>Mandatory</b> <span class="muted small">— everyone in the audience must acknowledge it</span></span></label>
  <label class="row" style="gap:8px;cursor:pointer"><input type="checkbox" name="watermark" ${p.watermark ? 'checked' : ''}> <span><b>Watermark with the reader’s name &amp; ID</b> <span class="muted small">— on screen and in downloads</span></span></label>
  <label class="row" style="gap:8px;cursor:pointer"><input type="checkbox" name="notify" checked> <span><b>Notify employees</b></span></label>
  ${isNew ? '' : `<label class="row" style="gap:8px;cursor:pointer"><input type="checkbox" name="bump"> <span><b>Issue as a new version (v${p.version + 1}) — everyone must acknowledge again</b></span></label>${fld('What changed? (shown in history)', 'note', '', 'text', '', 'full')}`}</div>`, async d => {
    const title = d.title.trim(); if (!title) { toast('Enter a title', 'err'); return false; } const f = d.pfile instanceof File && d.pfile.size ? d.pfile : null;
    if (f && (f.size > 8e6 || !/^(application\/pdf|image\/)/.test(f.type))) { toast('Attach a PDF or image up to 8 MB', 'err'); return false; }
    let file = p.file; if (f) { const id = 'pf-' + uid('').toLowerCase(); await filePut({ id, name: f.name, mime: f.type, size: f.size, blob: f }); if (file) fileDel(file.id).catch(() => { }); file = { id, name: f.name, mime: f.type, size: f.size }; } else if (d.rmfile && file) { fileDel(file.id).catch(() => { }); file = null; }
    if (!d.body.trim() && !file) { toast('Add policy text or attach a file', 'err'); return false; }
    const depts = DEPTS.filter(x => d['d_' + x]); if (d.aud === 'dept' && !depts.length) { toast('Pick at least one department', 'err'); return false; }
    const was = p.status, rec = { title, cat: d.cat, summary: d.summary.trim(), body: d.body.trim(), file, effective: d.effective, dl: d.dl, aud: d.aud, depts: d.aud === 'dept' ? depts : [], mandatory: !!d.mandatory, watermark: !!d.watermark, status: d.status, updated: Date.now(), by: me().id };
    let target = p0; if (isNew) { target = { id: 'P' + uid('').toUpperCase(), version: 1, hist: [{ v: 1, ts: Date.now(), by: me().id, note: 'First issue' }], ...rec }; POLS().push(target); } else { if (d.bump) { rec.version = p.version + 1; (p.hist ||= []).push({ v: rec.version, ts: Date.now(), by: me().id, note: d.note || 'Updated' }); } Object.assign(p, rec); }
    if (target.mandatory && (isNew || d.bump || (was !== 'Published' && d.status === 'Published'))) target.due = addDays(TODAY(), +d.days || 14);
    if (d.notify && target.status === 'Published' && (isNew || d.bump || was !== 'Published')) { const n = polAudience(target); n.forEach(e => notify(e.id, `${d.bump ? 'Updated policy' : 'New policy'}: ${title}${target.mandatory ? ' — please read and acknowledge' + (target.due ? ' by ' + fmtDate(target.due) : '') : ''}`)); toast(`Notified ${n.length} people`); }
    log(`${isNew ? 'Created' : d.bump ? 'Issued v' + target.version + ' of' : 'Edited'} policy ${title}`); save(); render(); return true; }, isNew ? 'Create policy' : 'Save', true);
}
ACT.pol_new = () => polModal(null); ACT.pol_edit = el => polModal(polById(el.dataset.id));

/* ---------- HR: tracker ---------- */
CHG.poltrack = el => { S.polTrack = el.value; render(); };
function polTracker() {
  const L = POLS().filter(p => p.status !== 'Archived'); if (!L.length) return '<div class="card empty">No policies yet.</div>'; const p = polById(S.polTrack) || L[0]; S.polTrack = p.id; const aud = polAudience(p), st = polStats(p);
  const dlN = (DB.policyLog || []).filter(l => l.pol === p.id && l.act !== 'view').length;
  return `<div class="toolbar"><select class="select" data-chg="poltrack" style="min-width:280px">${L.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.title)} (v${x.version})</option>`).join('')}</select><span class="right row" style="gap:6px"><button class="btn sm" data-act="pol_remind" data-id="${p.id}">🔔 Remind pending</button><button class="btn sm" data-act="pol_csv" data-id="${p.id}">${ic('download')} Export CSV</button></span></div>
  <div class="grid g4" style="margin:12px 0">${[[st.done, 'Acknowledged'], [st.n - st.done, 'Pending'], [st.pct + '%', 'Completion'], [dlN, 'Downloads / prints']].map(k => `<div class="card kpi"><span class="v">${k[0]}</span><span class="l">${k[1]}</span></div>`).join('')}</div>
  <div class="card pad0"><table class="table"><thead><tr><th>Employee</th><th>Department</th><th>Opened</th><th>Status</th><th>Acknowledged on</th></tr></thead><tbody>${aud.sort((a, b) => (polState(p, a.id) === 'done') - (polState(p, b.id) === 'done') || a.name.localeCompare(b.name)).map(e => { const a = ackRec(p, e.id), o = DB.policyOpen[p.id]?.[e.id]; return `<tr><td>${avatar(e)} ${esc(e.name)}</td><td>${esc(e.dept)}</td><td class="small">${o ? fmtDate(new Date(o.ts).toISOString().slice(0, 10)) : '—'}</td><td>${stBadge(p, e.id)}${a && a.v < p.version ? ` <span class="muted small">(acked v${a.v})</span>` : ''}</td><td class="small">${a && a.v >= p.version ? fmtDate(new Date(a.ts).toISOString().slice(0, 10)) : '—'}</td></tr>`; }).join('')}</tbody></table></div>`;
}
ACT.pol_remind = el => { const p = polById(el.dataset.id), n = polAudience(p).filter(e => polState(p, e.id) !== 'done'); if (!n.length) return toast('Everyone has acknowledged'); n.forEach(e => notify(e.id, `Reminder: please read and acknowledge “${p.title}”${p.due ? ' (due ' + fmtDate(p.due) + ')' : ''}`)); log(`Reminded ${n.length} people about ${p.title}`); save(); toast(`Reminder sent to ${n.length} people`); };
ACT.pol_csv = el => { const p = polById(el.dataset.id); download(`policy-${p.id}-v${p.version}-acknowledgements.csv`, csv([['Emp ID', 'Name', 'Department', 'Status', 'Acknowledged version', 'Acknowledged on']].concat(polAudience(p).map(e => { const a = ackRec(p, e.id); return [e.id, e.name, e.dept, polState(p, e.id) === 'done' ? 'Acknowledged' : 'Pending', a?.v || '', a ? new Date(a.ts).toISOString().slice(0, 10) : '']; })))); };

/* ---------- page ---------- */
PAGE_FN.documents = () => {
  const mg = can('docs.manage'), tabs = [['lib', 'Policies'], ...(mg ? [['mng', 'Manage policies'], ['trk', 'Acknowledgements']] : []), ['ltr', 'My letters'], ['req', 'Document requests']], t = tabOf('docs', 'lib'), cur = tabs.some(x => x[0] === t) ? t : 'lib';
  const act = `<button class="btn" data-act="letter">${ic('file')} Employment letter</button>${mg ? `<button class="btn primary" data-act="pol_new">${ic('plus')} New policy</button>` : ''}`;
  return head('Policies & documents', 'Read, acknowledge and download', act) + tabsBar('docs', tabs, 'lib') + (cur === 'lib' ? polLibrary() : cur === 'mng' ? polManage() : cur === 'trk' ? polTracker() : cur === 'ltr' ? myLettersHtml() : entTable('docreq'));
};
document.head.insertAdjacentHTML('beforeend', `<style>.polcard{transition:transform .2s var(--ease),box-shadow .2s}.polcard:hover{transform:translateY(-2px)}.polcard.ok{border-left:3px solid var(--green)}.polic{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:20px;background:var(--accent-soft)}.polnudge{margin-bottom:12px;border-left:3px solid var(--amber);background:var(--amber-soft)}
.polread{max-height:50vh;overflow:auto;padding:18px 22px;border:1px solid var(--line);border-radius:14px;background-color:var(--surface);line-height:1.65}.polread h3{margin:0 0 8px;font-size:19px}.polread h4{margin:16px 0 4px}.polread p{margin:6px 0}.polread ul{margin:6px 0;padding-left:20px}.polread.nocopy{user-select:none;-webkit-user-select:none}.polpdf{width:100%;height:48vh;border:0;border-radius:8px}.polbar{height:3px;background:var(--line);border-radius:3px;margin-top:8px;overflow:hidden}.polbar i{display:block;height:100%;width:0;background:var(--accent);transition:width .15s}
@media print{.nocopy{display:none!important}}</style>`);
