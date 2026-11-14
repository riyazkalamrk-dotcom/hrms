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

/* ================= UPLOADED LETTERHEAD (admin → Letterhead page) =================
   When an admin uploads the company's own letterhead (PDF or image), every document is laid over that design instead of
   the generated header. Content margins (top / bottom / sides, in mm) keep text clear of the artwork. */
let LHC = { present: false, top: 38, bottom: 32, side: 18, v: 0, name: '' };
try { LHC = { ...LHC, ...JSON.parse(localStorage.getItem('orbit_lh') || '{}') }; } catch { }
const lhImg = () => (window.ORBIT_BASE || '') + '/api/letterhead/image?v=' + LHC.v;
const lhKeep = j => { LHC = { ...LHC, ...j }; try { localStorage.setItem('orbit_lh', JSON.stringify(LHC)); } catch { } };
async function lhLoad() { try { const j = await (await fetch('/api/letterhead', { cache: 'no-store' })).json(), ch = ['present', 'v', 'top', 'bottom', 'side'].some(k => j[k] !== LHC[k]); lhKeep(j); if (ch && SESSION && /#\/(letterhead|letters|payroll|salary)/.test(location.hash) && !document.querySelector('.modal-bg')) render(); } catch { } }
lhLoad(); document.addEventListener('visibilitychange', () => { if (!document.hidden) lhLoad(); });
{
  const _gen = lhSheet;
  lhSheet = function (inner, o = {}) {
    if (!LHC.present) return _gen(inner, o);
    const img = lhImg(), body = `${o.title ? `<div class="lh-title">${esc(o.title)}</div>` : ''}${o.ref || o.date ? `<div class="ltr-meta"><span>${o.ref ? `Ref: <b>${esc(o.ref)}</b>` : ''}</span><span>${o.date ? `Date: <b>${esc(typeof ltrDate === 'function' ? ltrDate(o.date) : fmtDate(o.date))}</b>` : ''}</span></div>` : ''}${inner}${o.sign === false ? '' : lhSign()}${o.note ? `<div class="lh-note">${esc(o.note)}</div>` : ''}`;
    return `<div class="ltr-sheet lh-sheet lh-custom" style="--acc:${lhAcc()};--lt:${LHC.top};--lb:${LHC.bottom};--ls:${LHC.side}"><div class="lh-cut top" style="background-image:url('${img}')"></div><div class="lh-in">${body}</div><div class="lh-cut bot" style="background-image:url('${img}')"></div>${o.void ? '<div class="ltr-void">CANCELLED</div>' : ''}</div>`;
  };
  /* printing: the design is a fixed full-page background repeated on every page; a table header/footer reserves the margins on each page */
  const _print = printLetter;
  printLetter = function (html, title, bodyCss = '') {
    if (!/lh-custom/.test(html) && !bodyCss) return _print(html, title);
    const box = document.createElement('div'); box.innerHTML = html; const inn = box.querySelector('.lh-custom > .lh-in'), custom = !!inn;
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
    const css = custom ? `@page{size:A4;margin:0}html{margin:0;padding:0;background:#fff}body{margin:0;padding:0;background:transparent;-webkit-print-color-adjust:exact;print-color-adjust:exact}.lh-bg{position:fixed;left:0;top:0;width:210mm;height:297mm;z-index:-1}table.lh-pg{width:210mm;border-collapse:collapse;border:0}table.lh-pg>thead>tr>td,table.lh-pg>tfoot>tr>td,table.lh-pg>tbody>tr>td{padding:0;border:0}.lh-sp-t{height:${LHC.top}mm}.lh-sp-b{height:${LHC.bottom}mm}${LTR_CSS}${LH_CSS}.lh-note{margin-top:22px;text-align:center;font:10.5px/1.6 system-ui,sans-serif;color:#666}.lh-in.ltr-sheet{box-shadow:none;max-width:none;width:auto;padding:0 ${LHC.side}mm;background:transparent;border-radius:0}${bodyCss}`
      : `@page{size:A4;margin:14mm}body{margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}${LTR_CSS}${LH_CSS}.ltr-sheet{box-shadow:none;max-width:none;padding:0;border-radius:0;background:transparent}${bodyCss}`;
    const doc = custom ? `<img class="lh-bg" src="${lhImg()}" alt=""><table class="lh-pg"><thead><tr><td><div class="lh-sp-t"></div></td></tr></thead><tfoot><tr><td><div class="lh-sp-b"></div></td></tr></tfoot><tbody><tr><td><div class="lh-in ltr-sheet lh-sheet" style="--acc:${lhAcc()}">${inn.innerHTML}</div></td></tr></tbody></table>` : html;
    f.srcdoc = `<html><head><title>${esc(title)}</title><style>${css}</style></head><body>${doc}</body></html>`;
    f.onload = () => { let done = false; const go = () => { if (done) return; done = true; f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }, img = f.contentDocument.querySelector('.lh-bg, .lh-logo'); if (img && !img.complete) { img.onload = img.onerror = go; setTimeout(go, 4000); } else go(); };
    toast('Choose “Save as PDF” in the print dialog');
  };
}

/* ---------- admin page ---------- */
const lhHdr = () => { const h = { 'Content-Type': 'application/json' }; if (typeof SY !== 'undefined' && SY.tok) h['x-orbit-token'] = SY.tok; try { const k = admKey(); if (k) h['x-admin-key'] = k; } catch { } return h; };
async function lhApi(body, method) { const r = await fetch('/api/letterhead', { method: method || 'POST', headers: lhHdr(), body: body ? JSON.stringify(body) : undefined }), j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Request failed (' + r.status + ')'); lhKeep(j); return j; }
/* finds where the artwork ends at the top and starts at the bottom, to suggest content margins */
function lhGuess(canvas) {
  const w = 160, h = Math.round(w * canvas.height / canvas.width), c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(canvas, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, ink = y => { let n = 0; for (let i = 0; i < w; i++) { const o = (y * w + i) * 4; if (d[o] < 235 || d[o + 1] < 235 || d[o + 2] < 235) n++; } return n / w > .004; }, gap = Math.round(h * .05);
  let top = 0; for (let y = 0, blank = 0; y < h * .5; y++) { if (ink(y)) { top = y + 1; blank = 0; } else if (++blank >= gap) break; }
  let bot = h; for (let y = h - 1, blank = 0; y > h * .5; y--) { if (ink(y)) { bot = y; blank = 0; } else if (++blank >= gap) break; }
  const mm = px => Math.round(px / h * 297); return { top: Math.min(110, Math.max(12, mm(top) + 6)), bottom: Math.min(110, Math.max(12, mm(h - bot) + 6)) };
}
async function lhFromFile(file) {
  const W = 1654, out = document.createElement('canvas'), ctx = out.getContext('2d');
  if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'); pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise, pg = await pdf.getPage(1), vp = pg.getViewport({ scale: W / pg.getViewport({ scale: 1 }).width });
    out.width = Math.round(vp.width); out.height = Math.round(vp.height); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height); await pg.render({ canvasContext: ctx, viewport: vp }).promise;
  } else {
    const url = URL.createObjectURL(file), img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read that image.')); i.src = url; });
    out.width = Math.min(W, img.width); out.height = Math.round(out.width * img.height / img.width); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height); ctx.drawImage(img, 0, 0, out.width, out.height); URL.revokeObjectURL(url);
  }
  const ratio = out.height / out.width; if (ratio < 1.25 || ratio > 1.6) throw new Error('That page is not A4-shaped. Upload the full A4 letterhead page (portrait).');
  let q = .92, data = out.toDataURL('image/jpeg', q); while (data.length > 4.2e6 && q > .5) { q -= .1; data = out.toDataURL('image/jpeg', q); }
  return { image: data, ...lhGuess(out) };
}
PAGE_FN.letterhead = () => {
  if (!isHR()) return typeof deniedPage === 'function' ? deniedPage('hr.panel') : '<div class="card">Only HR or an administrator can open this page.</div>';
  const u = me(), sample = lhSheet(`<div class="ltr-body"><p>Dear ${esc(u.name.split(' ')[0])},</p><p>This is how your documents look on the company letterhead. Payslips, offer and appointment letters, increment and experience letters, the employment letter and policy printouts all use it.</p><p>If the text touches the artwork at the top or bottom, increase the margins and save. The preview updates straight away.</p><p>Regards,</p></div>`, { ref: 'SAMPLE/001', date: TODAY() });
  return head('Letterhead', 'The page every payslip, letter and policy is printed on', '') + `<div class="grid g-main" style="align-items:start"><div class="col" style="gap:16px">
   <div class="card"><header><h3>${LHC.present ? '✓ Your own letterhead is in use' : 'Using the generated letterhead'}</h3></header>
    <p class="muted small" style="margin-top:0">${LHC.present ? `Uploaded file: <b>${esc(LHC.name || 'letterhead')}</b>. Upload another to replace it, or remove it to go back to the generated one (logo and company profile from Settings).` : 'Upload your printed letterhead as a PDF, PNG or JPG (one A4 page, portrait). Leave the middle of the page empty — documents are written there.'}</p>
    <div class="row wrap" style="gap:8px"><label class="btn primary" style="cursor:pointer">${LHC.present ? 'Replace letterhead' : 'Upload letterhead'}<input type="file" accept=".pdf,application/pdf,image/png,image/jpeg" hidden data-chg="lh_file"></label>${LHC.present ? '<button class="btn danger" data-act="lh_remove">Remove</button>' : ''}</div><div id="lhMsg" class="small muted" style="margin-top:8px"></div></div>
   <div class="card"><header><h3>Content margins</h3></header><p class="muted small" style="margin-top:0">Space kept clear for the artwork, in millimetres. ${LHC.present ? '' : 'Used once you upload your own letterhead.'}</p>
    <div class="form-grid">${fld('Top', 'top', LHC.top, 'number', 'id="lhTop" min="5" max="120"')}${fld('Bottom', 'bottom', LHC.bottom, 'number', 'id="lhBottom" min="5" max="120"')}${fld('Left and right', 'side', LHC.side, 'number', 'id="lhSide" min="5" max="50"')}</div>
    <div class="row wrap" style="gap:8px;margin-top:10px"><button class="btn primary" data-act="lh_margins">Save margins</button><button class="btn" data-act="lh_test">${ic('printer')} Print a test page</button></div></div></div>
   <div class="card"><header><h3>Preview</h3></header><div class="lh-view">${sample}</div></div></div>`;
};
{ const at = PAGES.findIndex(p => p[0] === 'settings'); PAGES.splice(at < 0 ? PAGES.length : at, 0, ['letterhead', 'Letterhead', 'file', () => isHR()]); }
CHG.lh_file = async el => { const f = el.files[0], msg = $('#lhMsg'); el.value = ''; if (!f) return; if (f.size > 15e6) return toast('That file is too large. Use one under 15 MB.', 'err'); if (msg) msg.textContent = 'Reading the file…'; try { const r = await lhFromFile(f); if (msg) msg.textContent = 'Uploading…'; await lhApi({ image: r.image, name: f.name, top: r.top, bottom: r.bottom }); log('Uploaded company letterhead: ' + f.name); save(); toast('Letterhead uploaded — margins were set automatically, adjust them if needed'); render(); } catch (e) { if (msg) msg.textContent = ''; toast(e.message || 'Could not read that file', 'err'); } };
ACT.lh_margins = async () => { try { await lhApi({ top: $('#lhTop').value, bottom: $('#lhBottom').value, side: $('#lhSide').value }); log('Changed letterhead margins'); save(); toast('Margins saved'); render(); } catch (e) { toast(e.message, 'err'); } };
ACT.lh_remove = () => confirmBox('Remove your uploaded letterhead? Documents go back to the generated letterhead (logo and company profile).', async () => { try { await lhApi(null, 'DELETE'); log('Removed the uploaded letterhead'); save(); toast('Letterhead removed'); render(); } catch (e) { toast(e.message, 'err'); } });
ACT.lh_test = () => printLetter(lhSheet(`<div class="ltr-body"><p>Test page.</p>${Array.from({ length: 34 }, (_, i) => `<p>Line ${i + 1} — this text shows where documents are written on the letterhead and how a second page looks.</p>`).join('')}</div>`, { ref: 'TEST/001', date: TODAY() }), 'Letterhead test');

document.head.insertAdjacentHTML('beforeend', `<style>
.ltr-sheet.lh-custom{padding:0!important;overflow:hidden;container-type:inline-size;background:#fff}
.lh-cut{width:100%;background-repeat:no-repeat;background-size:100% auto}
.lh-cut.top{padding-top:calc(var(--lt) / 210 * 100%);background-position:top center}
.lh-cut.bot{padding-top:calc(var(--lb) / 210 * 100%);background-position:bottom center}
.lh-custom .lh-in{padding:4px calc(var(--ls) / 210 * 100%) 8px;min-height:calc((297 - var(--lt) - var(--lb)) / 210 * 100cqw);box-sizing:border-box}
.lh-note{margin-top:22px;text-align:center;font:10.5px/1.6 system-ui,sans-serif;color:#666}
</style>`);
