'use strict';
/* ============ Orbit — HR letter generator: offer, appointment, confirmation, increment, salary certificate, experience, relieving, verification.
   Merge fields from the employee record + company profile, your letterhead, numbered register, one-click PDF, employee copy. ============ */
const LTR_DEF = [
  { id: 'offer', code: 'OFR', name: 'Offer letter', icon: '🤝', extra: [{ k: 'joining', label: 'Date of joining', type: 'date', def: 'joined' }, { k: 'probation', label: 'Probation (months)', type: 'number', def: 6 }, { k: 'accept_by', label: 'Accept by', type: 'date', def: '+7' }], table: true, body: `Dear {{name}},

We are delighted to offer you the position of **{{designation}}** in the {{department}} department at **{{company}}**, based at {{work_location}}, reporting to {{manager}}.

## Your offer
- **Date of joining:** {{joining}}
- **Annual cost to company (CTC):** ₹{{ctc}} ({{ctc_words}} only)
- **Probation:** {{probation}} months from the date of joining, after which your confirmation is subject to satisfactory performance.
- **Notice period:** {{notice_period}} days during employment.

{{salary_table}}

This offer is subject to verification of your documents (identity, address, education and previous employment) and to the company's policies, which you will receive on joining. Statutory deductions (PF, ESI where applicable, Professional Tax and TDS) will be made as per law.

Please sign and return a copy of this letter by **{{accept_by}}** to confirm your acceptance. We look forward to welcoming you to the team.

Yours sincerely,` },
  { id: 'appointment', code: 'APT', name: 'Appointment letter', icon: '📜', extra: [{ k: 'joining', label: 'Date of joining', type: 'date', def: 'joined' }, { k: 'probation', label: 'Probation (months)', type: 'number', def: 6 }], table: true, body: `Dear {{name}},

With reference to your acceptance of our offer, we are pleased to appoint you as **{{designation}}** in the {{department}} department with effect from **{{joining}}**. Your employee ID is **{{emp_id}}**.

## Terms of appointment
1. **Remuneration:** Your annual CTC is ₹{{ctc}} ({{ctc_words}} only); the monthly break-up is given below.
2. **Place of work:** {{work_location}}. You may be required to work at any other site or office of the company.
3. **Working hours:** As per the duty roster published by HR; weekly offs and shifts may rotate.
4. **Probation:** {{probation}} months. The company may extend probation if required.
5. **Notice period:** {{notice_period}} days from either side after confirmation; during probation 30 days.
6. **Conduct and confidentiality:** You will follow the company's Code of Conduct, POSH, information-security and site-safety policies, and keep company and customer information confidential.

{{salary_table}}

Please sign the duplicate copy of this letter as your acceptance of these terms.

Yours sincerely,` },
  { id: 'confirmation', code: 'CNF', name: 'Confirmation letter', icon: '✅', extra: [{ k: 'effective', label: 'Confirmed with effect from', type: 'date', def: 'today' }], body: `Dear {{name}},

We are pleased to inform you that, on successful completion of your probation, you are **confirmed** as **{{designation}}** in the {{department}} department with effect from **{{effective}}**.

All other terms and conditions of your appointment remain unchanged. We appreciate your contribution so far and look forward to your continued success with {{company}}.

Yours sincerely,` },
  { id: 'increment', code: 'INC', name: 'Increment letter', icon: '📈', extra: [{ k: 'effective', label: 'Effective from', type: 'date', def: 'today' }, { k: 'new_ctc', label: 'New annual CTC (₹)', type: 'number', def: 'ctc' }, { k: 'new_designation', label: 'New designation', type: 'text', def: 'designation' }], body: `Dear {{name}},

In recognition of your performance and contribution, we are happy to revise your compensation with effect from **{{effective}}**.

- **Designation:** {{new_designation}}
- **Revised annual CTC:** ₹{{new_ctc}} ({{new_ctc_words}} only)

Your revised monthly salary break-up will be reflected in your payslip. All other terms of your employment remain unchanged. Please treat this letter as confidential.

Congratulations, and thank you for your commitment to {{company}}.

Yours sincerely,` },
  { id: 'salary', code: 'SAL', name: 'Salary certificate', icon: '💰', extra: [{ k: 'purpose', label: 'Issued for', type: 'text', def: 'bank / visa / loan purposes' }], body: `## TO WHOMSOEVER IT MAY CONCERN

This is to certify that **{{name}}** (Employee ID {{emp_id}}) is employed with **{{company}}** as **{{designation}}** in the {{department}} department since {{joining_date}}.

{{pronoun_cap}} annual cost to company is ₹{{ctc}} ({{ctc_words}} only), and monthly gross salary is ₹{{monthly_gross}}.

This certificate is issued at the employee's request for {{purpose}} and carries no financial liability on the company.

Yours sincerely,` },
  { id: 'verification', code: 'EVL', name: 'Employment verification', icon: '🔎', extra: [], body: `## TO WHOMSOEVER IT MAY CONCERN

This is to confirm that **{{name}}** (Employee ID {{emp_id}}) has been employed with **{{company}}** since {{joining_date}} and is currently working as **{{designation}}** in the {{department}} department.

{{pronoun_cap}} conduct has been found satisfactory. This letter is issued on request for verification purposes only.

Yours sincerely,` },
  { id: 'experience', code: 'EXP', name: 'Experience certificate', icon: '🎓', extra: [{ k: 'lwd', label: 'Last working day', type: 'date', def: 'exit' }], body: `## EXPERIENCE CERTIFICATE

This is to certify that **{{name}}** (Employee ID {{emp_id}}) worked with **{{company}}** from **{{joining_date}}** to **{{lwd}}** ({{tenure}}) and last held the position of **{{designation}}** in the {{department}} department.

During this period, {{pronoun}} was found to be sincere, hard-working and professional in {{pronoun_pos}} conduct. We wish {{pronoun_obj}} all the best in future endeavours.

Yours sincerely,` },
  { id: 'relieving', code: 'REL', name: 'Relieving letter', icon: '👋', extra: [{ k: 'lwd', label: 'Last working day', type: 'date', def: 'exit' }], body: `Dear {{name}},

This is with reference to your resignation. We hereby accept it and relieve you from the services of **{{company}}** at the close of working hours on **{{lwd}}**.

We confirm that you have handed over all company assets and responsibilities, and that your full and final settlement will be processed as per company policy and applicable law.

We thank you for your contribution as {{designation}} and wish you success ahead.

Yours sincerely,` }
];
const LTR_TOK = ['name', 'emp_id', 'designation', 'department', 'manager', 'work_location', 'company', 'joining_date', 'ctc', 'ctc_words', 'monthly_gross', 'notice_period', 'tenure', 'date', 'ref', 'salary_table', 'signatory', 'signatory_title'];

/* ---- helpers ---- */
function inrWords(n) {
  n = Math.round(+n || 0); if (!n) return 'Zero rupees'; const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'], b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''), three = x => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  const parts = []; const cr = Math.floor(n / 1e7), la = Math.floor(n / 1e5) % 100, th = Math.floor(n / 1e3) % 100, rest = n % 1000; if (cr) parts.push(three(cr) + ' Crore'); if (la) parts.push(two(la) + ' Lakh'); if (th) parts.push(two(th) + ' Thousand'); if (rest) parts.push(three(rest)); return 'Rupees ' + parts.join(' ');
}
const ltrTpl = () => { DB.letterTpl ||= {}; return LTR_DEF.map(t => ({ ...t, ...(DB.letterTpl[t.id] || {}), extra: t.extra, table: t.table })); };
const ltrDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
function tenureText(a, b) { const d1 = new Date(a), d2 = new Date(b); let m = (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth(); if (d2.getDate() < d1.getDate()) m--; m = Math.max(0, m); const y = Math.floor(m / 12), mm = m % 12; return [y && `${y} year${y > 1 ? 's' : ''}`, mm && `${mm} month${mm > 1 ? 's' : ''}`].filter(Boolean).join(' ') || 'less than a month'; }
function salaryTableHtml(e, ctc) {
  try { const ym = ymOf(TODAY()), p = payslip(e.id, ym), k = (+ctc || e.salary) / (e.salary || 1), earn = p.earn.filter(x => x[0] !== 'Reimbursements'), tot = sum(earn, x => x[1]) * k;
    return `<table class="ltr-tbl"><thead><tr><th>Component</th><th>Monthly (₹)</th><th>Annual (₹)</th></tr></thead><tbody>${earn.map(x => `<tr><td>${esc(x[0])}</td><td>${Math.round(x[1] * k).toLocaleString('en-IN')}</td><td>${Math.round(x[1] * k * 12).toLocaleString('en-IN')}</td></tr>`).join('')}<tr class="t"><td>Gross salary</td><td>${Math.round(tot).toLocaleString('en-IN')}</td><td>${Math.round(tot * 12).toLocaleString('en-IN')}</td></tr></tbody></table>`; } catch { return ''; }
}
function ltrVars(e, tpl, extra, o = {}) {
  const co = { ...CO }, he = /^(m|male)$/i.test(e.gender || ''), fe = /^(f|female)$/i.test(e.gender || ''), V = {
    name: e.name, emp_id: e.id, designation: e.title, department: e.dept, manager: emp(e.mgr)?.name || 'the management', work_location: siteName(branchOf(e)) || e.loc || 'our office', company: co.legal || DB.company, joining_date: ltrDate(e.joined), ctc: Math.round(e.salary).toLocaleString('en-IN'), ctc_words: inrWords(e.salary), monthly_gross: Math.round(e.salary / 12).toLocaleString('en-IN'), notice_period: e.contract?.notice || 60, tenure: tenureText(e.joined, extra.lwd || TODAY()), date: ltrDate(o.date || TODAY()), ref: o.ref || 'REF/PREVIEW', signatory: co.signatory || 'Authorised Signatory', signatory_title: co.signatoryTitle || 'Human Resources', pronoun: he ? 'he' : fe ? 'she' : 'they', pronoun_pos: he ? 'his' : fe ? 'her' : 'their', pronoun_obj: he ? 'him' : fe ? 'her' : 'them', pronoun_cap: he ? 'His' : fe ? 'Her' : 'Their'
  };
  (tpl.extra || []).forEach(x => { let v = extra[x.k]; if (v === undefined || v === '') v = x.def === 'joined' ? e.joined : x.def === 'today' ? TODAY() : x.def === 'exit' ? (e.exit || TODAY()) : x.def === 'ctc' ? e.salary : x.def === 'designation' ? e.title : String(x.def).startsWith('+') ? addDays(TODAY(), +x.def) : x.def; V[x.k] = x.type === 'date' ? ltrDate(v) : x.k === 'new_ctc' ? Math.round(+v).toLocaleString('en-IN') : v; if (x.k === 'new_ctc') V.new_ctc_words = inrWords(+v); });
  return V;
}
function ltrRender(tplBody, V, e, tpl, extra) {
  let h = polHtml(tplBody.replace(/\{\{salary_table\}\}/g, '@@TABLE@@')); h = h.replace(/\{\{(\w+)\}\}/g, (_, k) => k in V ? esc(String(V[k])) : `<mark class="ltr-miss">{{${esc(k)}}}</mark>`);
  return h.replace(/<p>@@TABLE@@<\/p>|@@TABLE@@/g, tpl.table ? salaryTableHtml(e, extra.new_ctc || e.salary) : '');
}
function ltrSheet(inner, o = {}) {
  const co = { ...CO }, L = coLines(); return `<div class="ltr-sheet"><div class="ltr-head">${BR.logo ? `<img src="${esc(BR.logo)}" class="ltr-logo">` : ''}<div><div class="ltr-co">${esc(L[0] || BR.name)}</div>${L.slice(1).map(x => `<div class="ltr-sm">${esc(x)}</div>`).join('')}${co.pf || co.esi ? `<div class="ltr-sm">${[co.pf && 'PF ' + esc(co.pf), co.esi && 'ESIC ' + esc(co.esi)].filter(Boolean).join(' · ')}</div>` : ''}</div></div>
  <div class="ltr-meta"><span>Ref: <b>${esc(o.ref || 'REF/PREVIEW')}</b></span><span>Date: <b>${esc(ltrDate(o.date || TODAY()))}</b></span></div><div class="ltr-body">${inner}</div>
  <div class="ltr-sign"><div class="ltr-line"></div><b>${esc(co.signatory || 'Authorised Signatory')}</b><div>${esc(co.signatoryTitle || 'Human Resources')}</div><div>${esc(co.legal || DB.company)}</div></div>${o.void ? '<div class="ltr-void">CANCELLED</div>' : ''}</div>`;
}
const LTR_CSS = `.ltr-sheet{position:relative;background:#fff;color:#111;font:13.5px/1.65 'Georgia','Times New Roman',serif;padding:34px 40px;border-radius:6px;box-shadow:0 12px 40px -20px rgba(0,0,0,.35);max-width:760px;margin:0 auto}.ltr-head{display:flex;gap:16px;align-items:center;border-bottom:2px solid #17406f;padding-bottom:12px;margin-bottom:12px}.ltr-logo{width:56px;height:56px;object-fit:contain}.ltr-co{font:800 20px/1.2 system-ui,sans-serif;color:#17406f}.ltr-sm{font:11.5px/1.45 system-ui,sans-serif;color:#555}.ltr-meta{display:flex;justify-content:space-between;font:12.5px system-ui,sans-serif;margin:8px 0 18px}.ltr-body p{margin:0 0 10px;text-align:justify}.ltr-body h3,.ltr-body h4{font-family:system-ui,sans-serif;margin:14px 0 6px;color:#17406f}.ltr-body ul,.ltr-body ol{margin:0 0 10px;padding-left:22px}.ltr-tbl{width:100%;border-collapse:collapse;margin:8px 0 12px;font:12.5px system-ui,sans-serif}.ltr-tbl th,.ltr-tbl td{border:1px solid #cfd6e0;padding:5px 9px;text-align:left}.ltr-tbl th{background:#eef3f9}.ltr-tbl td:nth-child(n+2),.ltr-tbl th:nth-child(n+2){text-align:right}.ltr-tbl tr.t td{font-weight:700;background:#f6f8fb}.ltr-sign{margin-top:46px;font:13px/1.5 system-ui,sans-serif}.ltr-line{width:180px;border-top:1px solid #111;margin-bottom:6px}.ltr-miss{background:#fde68a;border-radius:3px}.ltr-void{position:absolute;inset:0;display:grid;place-items:center;font:800 90px system-ui;color:rgba(185,28,28,.18);transform:rotate(-24deg);pointer-events:none}`;
function printLetter(html, title) {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  f.srcdoc = `<html><head><title>${esc(title)}</title><style>@page{size:A4;margin:14mm}body{margin:0;background:#fff}${LTR_CSS}.ltr-sheet{box-shadow:none;max-width:none;padding:0}</style></head><body>${html}</body></html>`; f.onload = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }; toast('Choose “Save as PDF” in the print dialog');
}

/* ---- state + page ---- */
const LS = () => (S.ltr ||= { tpl: 'offer', emp: '', extra: {}, bulk: false, sel: [], date: '' });
PAGE_FN.letters = () => {
  const t = tabOf('ltr', 'gen'); DB.letters ||= []; DB.letterSeq ||= {};
  return head('Letters', 'Generate numbered letters on your letterhead', `<span class="muted small">${DB.letters.length} issued</span>`) + tabsBar('ltr', [['gen', 'Generate'], ['tpl', 'Templates'], ['reg', 'Issued register']], 'gen') + (t === 'gen' ? ltrGen() : t === 'tpl' ? ltrTplTab() : ltrReg());
};
function ltrGen() {
  const s = LS(), T = ltrTpl(), tpl = T.find(x => x.id === s.tpl) || T[0], emps = activeEmps().filter(e => e.status !== 'Exited' || true).sort((a, b) => a.name.localeCompare(b.name)); const e = emp(s.emp) || emps[0]; if (!s.emp) s.emp = e.id;
  const nextRef = `${tpl.code}/${TODAY().slice(0, 4)}/${String(((DB.letterSeq[tpl.code]) || 0) + 1).padStart(4, '0')}`, V = ltrVars(e, tpl, s.extra, { ref: nextRef, date: s.date || TODAY() }), inner = ltrRender(tpl.body, V, e, tpl, s.extra);
  return `<div class="grid g-main" style="align-items:start"><div class="col" style="gap:14px"><div class="card"><header><h3>1 · Choose a letter</h3></header><div class="ltr-cards">${T.map(x => `<button type="button" class="ltr-card ${x.id === tpl.id ? 'on' : ''}" data-act="ltr_pick" data-id="${x.id}"><span>${x.icon}</span><b>${esc(x.name)}</b></button>`).join('')}</div></div>
  <div class="card"><header><h3>2 · Who is it for?</h3><label class="row small" style="gap:6px;cursor:pointer"><input type="checkbox" data-chg="ltr_bulk" ${s.bulk ? 'checked' : ''}> Several people</label></header>${s.bulk ? `<div class="ltr-multi">${emps.map(x => `<label class="row" style="gap:8px;padding:5px 2px;cursor:pointer"><input type="checkbox" data-chg="ltr_sel" data-id="${x.id}" ${s.sel.includes(x.id) ? 'checked' : ''}> ${avatar(x, 'sm')} <span>${esc(x.name)}</span><span class="muted small right">${esc(x.dept)}</span></label>`).join('')}</div><div class="muted small" style="margin-top:6px">${s.sel.length} selected</div>` : `<select class="select" data-chg="ltr_emp">${emps.map(x => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${esc(x.name)} — ${esc(x.title)}${x.status === 'Exited' ? ' (exited)' : ''}</option>`).join('')}</select>`}
   <div class="form-grid" style="margin-top:12px">${fld('Letter date', 'ltrdate', s.date || TODAY(), 'date', 'data-chg="ltr_date"')}${(tpl.extra || []).map(x => { let v = s.extra[x.k] ?? (x.def === 'joined' ? e.joined : x.def === 'today' ? TODAY() : x.def === 'exit' ? (e.exit || TODAY()) : x.def === 'ctc' ? e.salary : x.def === 'designation' ? e.title : String(x.def).startsWith('+') ? addDays(TODAY(), +x.def) : x.def); return fld(x.label, 'x_' + x.k, v, x.type, `data-chg="ltr_extra" data-k="${x.k}"`); }).join('')}</div></div>
  <div class="row wrap" style="gap:10px"><button class="btn primary big" data-act="ltr_issue" data-print="1">${ic('download')} Issue & save as PDF</button><button class="btn big" data-act="ltr_issue">Issue (no download)</button><button class="btn ghost" data-act="ltr_print_prev">Print preview only</button></div><div class="muted small">Issuing assigns a reference number, stores a copy in the register and notifies the employee. ${s.bulk ? `Bulk: one numbered letter per selected person.` : ''}</div></div>
  <div class="col" style="gap:10px;position:sticky;top:88px"><div class="card pad0"><div style="padding:14px 18px 0"><h3 style="margin:0">Preview — ${esc(e.name)}</h3></div><div style="padding:14px;background:var(--surface2);max-height:78vh;overflow:auto"><div class="ltr-wrap">${ltrSheet(inner, { ref: nextRef, date: s.date || TODAY() })}</div></div></div></div></div>`;
}
ACT.ltr_pick = el => { LS().tpl = el.dataset.id; LS().extra = {}; render(); };
CHG.ltr_emp = el => { LS().emp = el.value; LS().extra = {}; render(); }; CHG.ltr_date = el => { LS().date = el.value; render(); }; CHG.ltr_extra = el => { LS().extra[el.dataset.k] = el.value; render(); };
CHG.ltr_bulk = el => { LS().bulk = el.checked; render(); }; CHG.ltr_sel = el => { const s = LS(); s.sel = el.checked ? [...new Set([...s.sel, el.dataset.id])] : s.sel.filter(x => x !== el.dataset.id); render(); };
function issueFor(e, tpl, s, bulk) {
  const seq = DB.letterSeq[tpl.code] = (DB.letterSeq[tpl.code] || 0) + 1, ref = `${tpl.code}/${TODAY().slice(0, 4)}/${String(seq).padStart(4, '0')}`, V = ltrVars(e, tpl, s.extra, { ref, date: s.date || TODAY() }), inner = ltrRender(tpl.body, V, e, tpl, s.extra), html = ltrSheet(inner, { ref, date: s.date || TODAY() });
  const rec = { id: uid('LT'), ref, tpl: tpl.id, tplName: tpl.name, emp: e.id, date: s.date || TODAY(), html, by: me().id, ts: Date.now(), status: 'Issued' }; DB.letters.unshift(rec); notify(e.id, `📄 A new letter is available: ${tpl.name} (${ref}) — see Policies & docs → My letters`); log(`Issued ${tpl.name} ${ref} to ${e.name}`); return rec;
}
ACT.ltr_issue = el => {
  const s = LS(), tpl = ltrTpl().find(x => x.id === s.tpl), list = s.bulk ? s.sel.map(emp).filter(Boolean) : [emp(s.emp)].filter(Boolean); if (!list.length) return toast('Select at least one person', 'err');
  const go = () => { const recs = list.map(e => issueFor(e, tpl, s)); save(); toast(recs.length > 1 ? `${recs.length} letters issued` : `Issued ${recs[0].ref}`); if (el.dataset.print) printLetter(recs.map(r => r.html).join('<div style="page-break-after:always"></div>'), tpl.name); render(); };
  if (list.length > 1) confirmBox(`Issue ${list.length} “${esc(tpl.name)}” letters? Each gets its own reference number and the people are notified.`, go); else go();
};
ACT.ltr_print_prev = () => { const s = LS(), tpl = ltrTpl().find(x => x.id === s.tpl), e = emp(s.emp); printLetter(ltrSheet(ltrRender(tpl.body, ltrVars(e, tpl, s.extra, { ref: 'PREVIEW', date: s.date || TODAY() }), e, tpl, s.extra), { ref: 'PREVIEW', date: s.date || TODAY() }), tpl.name + ' (preview)'); };

/* ---- templates tab ---- */
function ltrTplTab() {
  const s = LS(), T = ltrTpl(), tpl = T.find(x => x.id === s.tpl) || T[0], custom = !!DB.letterTpl?.[tpl.id];
  return `<div class="grid g-main" style="align-items:start"><div class="card"><header><h3>${tpl.icon} ${esc(tpl.name)} — template</h3>${custom ? '<span class="badge warn">Customised</span>' : '<span class="badge">Default</span>'}</header><div class="ltr-cards" style="margin-bottom:12px">${T.map(x => `<button type="button" class="ltr-card ${x.id === tpl.id ? 'on' : ''}" data-act="ltr_pick" data-id="${x.id}"><span>${x.icon}</span><b>${esc(x.name)}</b></button>`).join('')}</div>
  <form id="ltrtf" data-act="noop"><textarea class="input" id="ltrbody" name="body" rows="22" style="font-family:ui-monospace,Consolas,monospace;font-size:12.5px">${esc(tpl.body)}</textarea><div class="row wrap" style="gap:8px;margin-top:12px"><button class="btn primary">Save template</button>${custom ? '<button type="button" class="btn ghost" data-act="ltr_tpl_reset">Reset to default</button>' : ''}</div></form></div>
  <div class="card"><header><h3>Merge fields</h3></header><p class="muted small" style="margin-top:0">Click to insert at the cursor. Unknown fields show highlighted in the preview.</p><div class="row wrap" style="gap:6px">${[...LTR_TOK, ...(tpl.extra || []).map(x => x.k)].map(k => `<button type="button" class="chip-b" data-act="ltr_tok" data-k="${k}">{{${k}}}</button>`).join('')}</div><div class="small muted" style="margin-top:12px;line-height:1.7"><b>Formatting:</b> <code>## Heading</code> · <code>**bold**</code> · <code>- bullet</code> · <code>1. numbered</code><br>The letterhead, reference, date and signature block are added automatically from <b>Settings → Company profile</b> and <b>Branding</b>.</div></div></div>`;
}
document.addEventListener('submit', e => { if (e.target.id !== 'ltrtf') return; e.preventDefault(); if (!can('letters.manage')) return deny('letters.manage'); const s = LS(); (DB.letterTpl ||= {})[s.tpl] = { body: e.target.body.value }; log('Edited letter template ' + s.tpl); save(); render(); toast('Template saved'); });
ACT.ltr_tpl_reset = () => confirmBox('Restore the default wording for this letter?', () => { delete DB.letterTpl[LS().tpl]; save(); render(); });
ACT.ltr_tok = el => { const ta = $('#ltrbody'); if (!ta) return; const t = `{{${el.dataset.k}}}`, a = ta.selectionStart, b = ta.selectionEnd; ta.value = ta.value.slice(0, a) + t + ta.value.slice(b); ta.focus(); ta.setSelectionRange(a + t.length, a + t.length); };

/* ---- register + employee copies ---- */
function ltrReg() {
  const L = DB.letters; return `<div class="card pad0"><table><thead><tr><th>Reference</th><th>Letter</th><th>Employee</th><th>Date</th><th>Issued by</th><th>Status</th><th></th></tr></thead><tbody>${L.map(r => `<tr><td><b>${esc(r.ref)}</b></td><td>${esc(r.tplName)}</td><td>${emp(r.emp) ? esc(emp(r.emp).name) : '—'}</td><td>${fmtDate(r.date)}</td><td>${esc(empName(r.by))}</td><td><span class="badge ${r.status === 'Issued' ? 'ok' : 'bad'}">${r.status}</span></td><td style="white-space:nowrap"><button class="btn sm" data-act="ltr_view" data-id="${r.id}">View</button> <button class="btn sm" data-act="ltr_dl" data-id="${r.id}">PDF</button> ${r.status === 'Issued' ? `<button class="btn sm ghost danger" data-act="ltr_void" data-id="${r.id}">Cancel</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No letters issued yet.</td></tr>'}</tbody></table></div>`;
}
const ltrById = id => DB.letters.find(x => x.id === id);
ACT.ltr_view = el => { const r = ltrById(el.dataset.id); modal(`${esc(r.tplName)} — ${esc(r.ref)}`, `<div class="ltr-wrap" style="background:var(--surface2);padding:12px;border-radius:12px;max-height:68vh;overflow:auto">${r.status === 'Issued' ? r.html : r.html.replace('</div></div>', '</div><div class="ltr-void">CANCELLED</div></div>')}</div>`, null, '', true); };
ACT.ltr_dl = el => { const r = ltrById(el.dataset.id); if (r.emp !== me().id && !can('letters.manage')) return deny('letters.manage'); printLetter(r.html, r.tplName + ' ' + r.ref); };
ACT.ltr_void = el => modal('Cancel this letter?', `<p class="muted small" style="margin-top:0">It stays in the register marked CANCELLED and the employee’s copy shows the same.</p><label class="f">Reason<textarea class="input" name="why" rows="2" required></textarea></label>`, d => { const r = ltrById(el.dataset.id); r.status = 'Cancelled'; r.voidWhy = d.why; log(`Cancelled letter ${r.ref}: ${d.why}`); save(); render(); }, 'Cancel letter');
const myLetters = () => DB.letters?.filter(r => r.emp === me().id) || [];
function myLettersHtml() { const L = myLetters(); return L.length ? `<div class="card pad0"><table><thead><tr><th>Letter</th><th>Reference</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>${L.map(r => `<tr><td><b>${esc(r.tplName)}</b></td><td>${esc(r.ref)}</td><td>${fmtDate(r.date)}</td><td><span class="badge ${r.status === 'Issued' ? 'ok' : 'bad'}">${r.status}</span></td><td style="white-space:nowrap"><button class="btn sm" data-act="ltr_view" data-id="${r.id}">View</button> ${r.status === 'Issued' ? `<button class="btn sm primary" data-act="ltr_dl" data-id="${r.id}">${ic('download')} PDF</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">No letters have been issued to you yet. You can ask HR from <b>Document requests</b>.</div>'; }

PAGES.splice(PAGES.findIndex(p => p[0] === 'documents') + 1, 0, ['letters', 'Letters', 'file', () => can('letters.manage')]);
document.head.insertAdjacentHTML('beforeend', `<style>${LTR_CSS}.ltr-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.ltr-card{display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:inherit;font:inherit;font-size:13px;cursor:pointer;text-align:left;transition:all .16s}.ltr-card span{font-size:18px}.ltr-card:hover{border-color:var(--accent)}.ltr-card.on{border-color:var(--accent);background:var(--accent-soft);box-shadow:0 0 0 2px var(--accent-soft)}.ltr-multi{max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:6px 10px}.chip-b{border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:3px 8px;font:12px ui-monospace,Consolas,monospace;color:var(--accent);cursor:pointer}.chip-b:hover{border-color:var(--accent)}.ltr-wrap .ltr-sheet{font-size:12.5px;padding:26px 28px}</style>`);
