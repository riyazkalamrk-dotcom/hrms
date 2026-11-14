'use strict';
/* ============ Orbit HRMS — one company letterhead for every printed document
   Payslips, all generated letters (offer, appointment, increment, experience, relieving…), the employment certificate
   and policy printouts carry the same header: logo, legal name, address, phone / email / website and the registration
   numbers filled in under Settings → Company profile (CIN, GSTIN, PAN, TAN, PF, ESIC, RERA). The accent colour follows
   the brand colour. Nothing is hard-coded: change the logo or company profile and every document changes. ============ */
const lhAcc = () => (/^#[0-9a-f]{6}$/i.test(BR.primary || '') ? BR.primary : '#17406f');
const lhName = () => CO.legal || DB?.company || BR.name || '';
const lhAddr = () => [CO.address, CO.city, CO.state, CO.pin].filter(Boolean).join(', ');
function lhHead() {
  const contact = [CO.phone && 'Tel: ' + CO.phone, CO.email, CO.website].filter(Boolean), reg = [['CIN', CO.cin], ['GSTIN', CO.gstin], ['PAN', CO.pan], ['TAN', CO.tan], ['PF', CO.pf], ['ESIC', CO.esi], ['RERA', CO.rera]].filter(x => x[1]);
  return `<div class="lh-head" style="--acc:${lhAcc()}">${BR.logo ? `<img src="${esc(BR.logo)}" class="lh-logo" alt="">` : `<div class="lh-mark">${esc((lhName().match(/\b\w/g) || ['•']).slice(0, 2).join('').toUpperCase())}</div>`}<div class="lh-co"><div class="lh-name">${esc(lhName())}</div>${lhAddr() ? `<div class="lh-ln">${esc(lhAddr())}</div>` : ''}${contact.length ? `<div class="lh-ln">${contact.map(esc).join(' &nbsp;·&nbsp; ')}</div>` : ''}</div></div>${reg.length ? `<div class="lh-reg" style="--acc:${lhAcc()}">${reg.map(([k, v]) => `<span><b>${k}</b> ${esc(v)}</span>`).join('')}</div>` : ''}`;
}
const lhFoot = note => `<div class="lh-foot">${note ? `<div>${esc(note)}</div>` : ''}<div>${[lhName(), lhAddr(), CO.website].filter(Boolean).map(esc).join(' · ')}</div></div>`;
const lhSign = () => `<div class="ltr-sign"><div class="ltr-line"></div><b>${esc(CO.signatory || 'Authorised Signatory')}</b><div>${esc(CO.signatoryTitle || 'Human Resources')}</div><div>For ${esc(lhName())}</div></div>`;
/* the page: header · optional title · reference/date · content · signature · footer */
function lhSheet(inner, o = {}) {
  return `<div class="ltr-sheet lh-sheet" style="--acc:${lhAcc()}">${lhHead()}${o.title ? `<div class="lh-title">${esc(o.title)}</div>` : ''}${o.ref || o.date ? `<div class="ltr-meta"><span>${o.ref ? `Ref: <b>${esc(o.ref)}</b>` : ''}</span><span>${o.date ? `Date: <b>${esc(typeof ltrDate === 'function' ? ltrDate(o.date) : fmtDate(o.date))}</b>` : ''}</span></div>` : ''}${inner}${o.sign === false ? '' : lhSign()}${lhFoot(o.note)}${o.void ? '<div class="ltr-void">CANCELLED</div>' : ''}</div>`;
}
const LH_CSS = `.lh-head{display:flex;gap:16px;align-items:center;padding-bottom:12px;border-bottom:3px solid var(--acc,#17406f)}.lh-logo{width:68px;height:68px;object-fit:contain;flex:none}.lh-mark{width:60px;height:60px;flex:none;border-radius:12px;background:var(--acc,#17406f);color:#fff;display:grid;place-items:center;font:800 22px/1 system-ui,sans-serif}.lh-co{min-width:0;flex:1}.lh-name{font:800 21px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--acc,#17406f);overflow-wrap:anywhere}.lh-ln{font:12px/1.5 system-ui,sans-serif;color:#444;overflow-wrap:anywhere}.lh-reg{display:flex;flex-wrap:wrap;gap:2px 16px;padding:6px 0;margin-bottom:14px;border-bottom:1px solid #d9dee6;font:10.5px/1.6 system-ui,sans-serif;color:#555}.lh-reg b{color:var(--acc,#17406f);font-weight:700}.lh-title{margin:14px 0 4px;text-align:center;font:800 15px/1.3 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#111}.lh-foot{margin-top:28px;padding-top:8px;border-top:1px solid #d9dee6;text-align:center;font:10.5px/1.6 system-ui,sans-serif;color:#666;overflow-wrap:anywhere}.lh-sheet{box-sizing:border-box;min-width:0;width:100%}.lh-kv{table-layout:fixed;width:100%;border-collapse:collapse;margin:12px 0;font:12.5px/1.5 system-ui,sans-serif}.lh-kv td{padding:4px 8px;border:1px solid #d9dee6;vertical-align:top;overflow-wrap:anywhere}.lh-kv td:nth-child(odd){color:#555;width:21%;background:#f6f8fb}.lh-kv td:nth-child(even){font-weight:600;width:29%}.lh-net{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;padding:12px 14px;border:2px solid var(--acc,#17406f);border-radius:8px;font:700 14px/1.3 system-ui,sans-serif}.lh-net b{font-size:20px;white-space:nowrap}.lh-words{margin:8px 0 0;font:italic 12.5px/1.5 system-ui,sans-serif;color:#333}.lh-sheet .ltr-tbl td:nth-child(3),.lh-sheet .ltr-tbl th:nth-child(3){text-align:left}.lh-scroll{overflow-x:auto}@media print{.lh-sheet{break-inside:auto}.lh-net,.lh-kv tr,.ltr-sign{break-inside:avoid}}`;

/* ---------- every generated letter uses it ---------- */
ltrSheet = function (inner, o = {}) { return lhSheet(`<div class="ltr-body">${inner}</div>`, { ref: o.ref || 'REF/PREVIEW', date: o.date || TODAY(), void: o.void }); };
printLetter = function (html, title) {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  f.srcdoc = `<html><head><title>${esc(title)}</title><style>@page{size:A4;margin:14mm}body{margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}${LTR_CSS}${LH_CSS}.ltr-sheet{box-shadow:none;max-width:none;padding:0;border-radius:0}</style></head><body>${html}</body></html>`;
  f.onload = () => { const go = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }, img = f.contentDocument.querySelector('.lh-logo'); if (img && !img.complete) { img.onload = img.onerror = go; setTimeout(go, 2500); } else go(); };
  toast('Choose “Save as PDF” in the print dialog');
};

/* ---------- payslip ---------- */
function inrWords(n) {
  n = Math.round(Math.abs(n)); if (!n) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'], b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''), three = x => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' and ' : '') : '') + two(x % 100);
  const parts = [[Math.floor(n / 1e7), 'Crore'], [Math.floor(n / 1e5) % 100, 'Lakh'], [Math.floor(n / 1e3) % 100, 'Thousand'], [n % 1000, '']];
  return parts.filter(p => p[0]).map(([v, u], i, arr) => (u === 'Crore' && v > 99 ? inrWords(v) : u ? two(v) : three(v)) + (u ? ' ' + u : '')).join(' ').replace(/\s+/g, ' ').trim();
}
function payslipSheet(id, ym) {
  const p = payslip(id, ym), e = emp(p.id), n = Math.max(p.earn.length, p.ded.length), r = v => Math.round(v).toLocaleString('en-IN'), paid = Math.max(0, (+p.work || 0) - (+p.lop || 0));
  const bank = e.bankInfo?.acc ? `${e.bankInfo.bank || 'Bank'} · A/c ${typeof maskAcc === 'function' ? maskAcc(e.bankInfo.acc) : '••••' + String(e.bankInfo.acc).slice(-4)}` : '—';
  const kv = [['Employee name', e.name], ['Employee ID', e.id], ['Designation', e.title || '—'], ['Department', e.dept || '—'], ['Date of joining', e.joined ? fmtDate(e.joined) : '—'], ['Work location', siteName(branchOf(e)) || e.loc || '—'], ['Bank account', bank], ['Pay period', monthName(p.ym)], ['Working days', p.work ?? '—'], ['Paid days', paid], ['Loss-of-pay days', p.lop || 0], ['PAN', e.pan || e.kyc?.pan || '—']];
  const rows2 = []; for (let i = 0; i < kv.length; i += 2) rows2.push(`<tr><td>${kv[i][0]}</td><td>${esc(String(kv[i][1]))}</td><td>${kv[i + 1] ? kv[i + 1][0] : ''}</td><td>${kv[i + 1] ? esc(String(kv[i + 1][1])) : ''}</td></tr>`);
  const inner = `<table class="lh-kv"><tbody>${rows2.join('')}</tbody></table>
  <div class="lh-scroll"><table class="ltr-tbl"><thead><tr><th>Earnings</th><th>₹</th><th>Deductions</th><th>₹</th></tr></thead><tbody>${Array.from({ length: n }, (_, i) => `<tr><td>${esc(p.earn[i]?.[0] || '')}</td><td>${p.earn[i] ? r(p.earn[i][1]) : ''}</td><td>${esc(p.ded[i]?.[0] || '')}</td><td>${p.ded[i] ? r(p.ded[i][1]) : ''}</td></tr>`).join('')}<tr class="t"><td>Gross earnings</td><td>${r(p.gross)}</td><td>Total deductions</td><td>${r(p.deductions)}</td></tr></tbody></table></div>
  <div class="lh-net"><span>Net pay for ${esc(monthName(p.ym))}</span><b>${inr(p.net)}</b></div><p class="lh-words">Rupees ${inrWords(p.net)} only</p>`;
  return { p, e, html: lhSheet(inner, { title: 'Payslip — ' + monthName(p.ym), sign: false, note: 'This is a computer-generated payslip and does not require a signature.' }) };
}
ACT.slip = el => { const s = payslipSheet(el.dataset.id, el.dataset.ym); modal('Payslip · ' + esc(s.e.name), `<div class="lh-view">${s.html}</div><div class="row wrap" style="margin-top:12px;gap:8px"><button type="button" class="btn primary" data-act="slip_print" data-id="${s.e.id}" data-ym="${s.p.ym}">${ic('printer')} Print / Save PDF</button></div>`, null, '', true); };
ACT.slip_print = el => { const s = payslipSheet(el.dataset.id, el.dataset.ym); printLetter(s.html, `Payslip-${s.e.id}-${s.p.ym}`); log(`Printed payslip ${s.p.ym} for ${s.e.name}`); save(); };

/* ---------- employment certificate (was a plain text file) ---------- */
function empLetterSheet(u) { const ref = `EMP/${u.id}/${TODAY().replace(/-/g, '')}`; return { ref, html: lhSheet(`<div class="ltr-body"><p style="text-align:center;font-weight:700;letter-spacing:.04em;margin:8px 0 18px">TO WHOMSOEVER IT MAY CONCERN</p><p>This is to certify that <b>${esc(u.name)}</b> (Employee ID <b>${esc(u.id)}</b>) has been employed with <b>${esc(lhName())}</b> since <b>${esc(fmtDate(u.joined))}</b> and is currently working as <b>${esc(u.title || '—')}</b> in the <b>${esc(u.dept || '—')}</b> department.</p><p>This letter is issued at the request of the employee for whatever purpose it may serve.</p></div>`, { ref, date: TODAY() }) }; }
ACT.letter = () => { const s = empLetterSheet(me()); modal('Employment letter', `<div class="lh-view">${s.html}</div><div class="row wrap" style="margin-top:12px;gap:8px"><button type="button" class="btn primary" data-act="letter_print">${ic('printer')} Print / Save PDF</button></div>`, null, '', true); };
ACT.letter_print = () => { const s = empLetterSheet(me()); printLetter(s.html, 'Employment-letter-' + me().id); log('Printed own employment letter'); save(); };

document.head.insertAdjacentHTML('beforeend', `<style>${LH_CSS}
.lh-view{background:var(--surface2);border-radius:14px;padding:14px;overflow-x:auto}
@media(max-width:900px){.lh-view{padding:8px}.ltr-sheet{padding:18px 14px!important;font-size:13px}.lh-logo{width:52px;height:52px}.lh-mark{width:46px;height:46px;font-size:17px}.lh-name{font-size:17px}.lh-kv{font-size:11.500px}.lh-kv td{padding:4px 5px}.lh-kv td:nth-child(odd){width:22%}.lh-kv td:nth-child(even){width:28%}.lh-sheet .ltr-tbl{table-layout:fixed;font-size:11.500px}.lh-sheet .ltr-tbl th,.lh-sheet .ltr-tbl td{padding:5px 5px;overflow-wrap:anywhere}.lh-net{font-size:13px}.lh-net b{font-size:17px}.lh-title{font-size:13px;letter-spacing:.05em}}
</style>`);
