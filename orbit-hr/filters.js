'use strict';
/* ============ Orbit Realty — smart filters on every list ============
   Any data table with enough rows gets: live search · status chips · dropdowns for the columns that make sense (type, stage, shift …)
   · Department / Location filters whenever the rows are employees · a date range when there is a date column · click-to-sort headers
   · "x of y" counter · Clear · CSV of exactly what is on screen. State survives re-renders and is remembered per page/tab. */
const TF = { st: {}, empIdx: null };
const tfNorm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
function tfEmpIdx() { if (!TF.empIdx || TF.n !== DB.employees.length) { TF.n = DB.employees.length; TF.empIdx = DB.employees.map(e => [e.name.toLowerCase(), e]).sort((a, b) => b[0].length - a[0].length); } return TF.empIdx; }
const tfBranchName = e => { const id = (typeof branchOf === 'function' ? branchOf(e) : e.branch), b = rows('branches').find(x => x.id === id); return b ? b.name.replace(/ — .*$/, '').trim() + (b.type === 'site' ? ' (site)' : '') : '—'; };
const TF_EMPCACHE = new WeakMap();
function tfRowEmp(tr) {
  if (TF_EMPCACHE.has(tr)) return TF_EMPCACHE.get(tr); let hit = null; const cells = [...tr.cells].slice(0, 4);
  for (const c of cells) { const t = tfNorm(c.textContent), id = t.match(/\bE\d{3,}\b/); if (id && emp(id[0])) { hit = emp(id[0]); break; } const low = t.toLowerCase(); const f = tfEmpIdx().find(x => low.includes(x[0])); if (f) { hit = f[1]; break; } }
  TF_EMPCACHE.set(tr, hit); return hit;
}
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function tfDate(t) { t = tfNorm(t); let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`; m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?(?:\s+(\d{4}))?/); if (m && MON[m[2].toLowerCase()] !== undefined) { const y = m[3] || new Date().getFullYear(); return `${y}-${String(MON[m[2].toLowerCase()] + 1).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; } m = t.match(/^([A-Za-z]{3})[a-z]*\s+(\d{4})$/); if (m && MON[m[1].toLowerCase()] !== undefined) return `${m[2]}-${String(MON[m[1].toLowerCase()] + 1).padStart(2, '0')}-01`; return null; }
function tfNum(t) { t = tfNorm(t); if (!/^[₹+\-−]?\s?[\d,]+(\.\d+)?\s?(%|d|h|m|km)?$/i.test(t.replace(/^₹\s?/, '₹'))) return null; return parseFloat(t.replace(/[₹,\s−]/g, m => m === '−' ? '-' : '').replace(/[a-z%]+$/i, '')); }
const TF_PRI = [/status|state|stage/i, /dept|department/i, /location|site|branch|office/i, /type|category|kind/i, /priority|severity|level|grade/i, /role|shift|mode|method|source|result|reason|month|plan|team|designation|title/i];
function tfBuild(table) {
  const heads = [...table.tHead?.rows[0]?.cells || []].map(h => tfNorm(h.textContent)); if (heads.length < 2 || heads.length > 14) return null;
  const body = table.tBodies[0]; if (!body) return null; const all = [...body.rows].filter(r => r.cells.length === heads.length && !r.querySelector('.empty')); if (all.length < 7) return null;
  const dims = []; const hasCol = re => heads.some(h => re.test(h));
  heads.forEach((h, i) => { if (!h || /^#$|action|^$|name|employee|email|phone|mobile|amount|net|gross|salary|ctc|total|remark|note|description|subject|title$|check|late by|^vs |people|version|progress|acknowledged|balance|score|rating|hours|^out$|^in$|^day$/i.test(h) && !/designation/i.test(h)) return; const vals = all.map(r => tfNorm(r.cells[i].textContent)).filter(v => v && v !== '—' && v !== '-'); if (vals.length < all.length * .5) return; if (vals.every(v => tfNum(v) !== null || /^\d{1,2}:\d{2}/.test(v) || tfDate(v) || /^[\d.,]+\s?[a-z%]{0,3}$/i.test(v))) return; const set = [...new Set(vals)]; if (set.length < 2 || set.length > 14 || set.length > all.length * .7 || set.some(v => v.length > 34)) return; dims.push({ label: h, i, get: tr => tfNorm(tr.cells[i].textContent), vals: set }); });
  const empRows = all.filter(r => tfRowEmp(r)).length;
  if (empRows >= all.length * .6) { if (!hasCol(/dept|department/i)) { const g = tr => tfRowEmp(tr)?.dept || '—', v = [...new Set(all.map(r => g(r)))]; if (v.length > 1) dims.push({ label: 'Department', syn: true, get: g, vals: v }); } if (!hasCol(/location|site|branch|office/i) && rows('branches').filter(b => b.status !== 'Inactive').length > 1) { const g = tr => { const e = tfRowEmp(tr); return e ? tfBranchName(e) : '—'; }, v = [...new Set(all.map(r => g(r)))]; if (v.length > 1) dims.push({ label: 'Location', syn: true, get: g, vals: v }); } }
  const pri = d => { const k = TF_PRI.findIndex(re => re.test(d.label)); return k < 0 ? 9 : k; }; dims.sort((a, b) => pri(a) - pri(b) || a.vals.length - b.vals.length);
  const chip = dims.find(d => /status|state|stage/i.test(d.label) && d.vals.length <= 7); const sels = dims.filter(d => d !== chip).slice(0, 4);
  let date = null; heads.forEach((h, i) => { if (date) return; const ok = all.filter(r => tfDate(r.cells[i].textContent)).length; if (ok >= all.length * .7 && /date|day|on$|when|period|month|joined|from|due|time|created|start/i.test(h)) date = { label: h, i }; });
  return { heads, all, chip, sels, date, key: location.hash + '|' + heads.join('/') };
}
function tfApply(table, cfg, st, bar) {
  const q = st.q.toLowerCase(); let shown = 0; const sd = st.from || '', ed = st.to || '';
  cfg.all.forEach(tr => {
    let ok = true;
    if (q) { const e = tfRowEmp(tr); ok = (tr.textContent + ' ' + (e ? e.dept + ' ' + tfBranchName(e) : '')).toLowerCase().includes(q); }
    if (ok && cfg.chip && st.chip) ok = cfg.chip.get(tr) === st.chip;
    if (ok) for (const d of cfg.sels) { const v = st.sel[d.label]; if (v && d.get(tr) !== v) { ok = false; break; } }
    if (ok && cfg.date && (sd || ed)) { const dt = tfDate(tr.cells[cfg.date.i].textContent); if (!dt || (sd && dt < sd) || (ed && dt > ed)) ok = false; }
    tr.style.display = ok ? '' : 'none'; if (ok) shown++;
  });
  const body = table.tBodies[0]; let em = body.querySelector('tr.tf-empty'); if (!shown) { if (!em) { em = document.createElement('tr'); em.className = 'tf-empty'; em.innerHTML = `<td colspan="${cfg.heads.length}"><div class="empty" style="padding:22px;text-align:center">Nothing matches these filters. <a href="#" class="tf-clear2">Clear filters</a></div></td>`; body.appendChild(em); em.querySelector('.tf-clear2').onclick = e => { e.preventDefault(); bar.querySelector('.tf-clear')?.click(); }; } } else em?.remove();
  bar.querySelector('.tf-count').innerHTML = `Showing <b>${shown}</b> of ${cfg.all.length}`;
  const act = (st.q ? 1 : 0) + (st.chip ? 1 : 0) + Object.values(st.sel).filter(Boolean).length + (sd || ed ? 1 : 0); bar.querySelector('.tf-clear').style.visibility = act ? 'visible' : 'hidden'; bar.classList.toggle('tf-on', !!act);
  bar.querySelectorAll('.tf-chip').forEach(c => c.classList.toggle('on', (c.dataset.v || '') === (st.chip || '')));
}
function tfSort(table, cfg, st) {
  const body = table.tBodies[0]; if (!st.sort) return; const { i, dir } = st.sort, f = dir === 'desc' ? -1 : 1; const val = tr => tfNorm(tr.cells[i].textContent);
  const sorted = [...cfg.all].sort((a, b) => { const x = val(a), y = val(b), nx = tfNum(x), ny = tfNum(y); if (nx !== null && ny !== null) return (nx - ny) * f; const dx = tfDate(x), dy = tfDate(y); if (dx && dy) return (dx < dy ? -1 : dx > dy ? 1 : 0) * f; return x.localeCompare(y, undefined, { numeric: true }) * f; });
  const em = body.querySelector('tr.tf-empty'); sorted.forEach(tr => body.insertBefore(tr, em || null)); cfg.all = sorted;
  [...table.tHead.rows[0].cells].forEach((h, k) => { h.classList.toggle('tf-s', k === i); h.dataset.dir = k === i ? dir : ''; });
}
function tfEnhance(table) {
  if (table.dataset.tf) return; table.dataset.tf = '1'; if (table.closest('.modal-bg,[data-nofilter]')) return; const cfg = tfBuild(table); if (!cfg) return;
  const prev0 = (table.closest('.card.pad0') || table.parentElement).previousElementSibling, ex = { search: false };
  if (prev0 && prev0.matches('.toolbar')) { const pt = prev0.textContent.toLowerCase(); ex.search = !!prev0.querySelector('input'); if (/all departments|any department/.test(pt)) cfg.sels = cfg.sels.filter(d => !/dept|department/i.test(d.label)); if (prev0.querySelectorAll('button').length >= 3) cfg.chip = null; if (/all locations|all branches|any location/.test(pt)) cfg.sels = cfg.sels.filter(d => !/location|site|branch/i.test(d.label)); }
  const st = TF.st[cfg.key] ||={ q: '', chip: '', sel: {}, from: '', to: '', sort: null }; const host = table.closest('.card.pad0') || table.parentElement, bar = document.createElement('div'); bar.className = 'tfbar';
  const opt = (d, v) => `<option value="${esc(v)}" ${st.sel[d.label] === v ? 'selected' : ''}>${esc(v)}</option>`;
  bar.innerHTML = `<div class="tf-row">${ex.search ? '' : `<label class="tf-search">${ic('search')}<input type="search" class="tf-q" placeholder="Search ${cfg.all.length} rows…" value="${esc(st.q)}"></label>`}
  ${cfg.sels.map(d => `<select class="select tf-sel" data-l="${esc(d.label)}" title="${esc(d.label)}"><option value="">All ${esc(d.label.toLowerCase())}${/s$/.test(d.label) ? '' : 's'}</option>${d.vals.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(v => opt(d, v)).join('')}</select>`).join('')}
  ${cfg.date ? `<span class="tf-date" title="Filter by ${esc(cfg.date.label)}"><span class="muted small">${esc(cfg.date.label)}</span><input type="date" class="input tf-from" value="${esc(st.from)}"><span class="muted small">to</span><input type="date" class="input tf-to" value="${esc(st.to)}"></span>` : ''}
  <span class="tf-right"><span class="tf-count muted small"></span><button type="button" class="btn sm ghost tf-clear">✕ Clear</button><button type="button" class="btn sm tf-csv" title="Download what is shown as CSV">${ic('download')} CSV</button></span></div>
  ${cfg.chip ? `<div class="tf-chips"><button type="button" class="tf-chip" data-v="">All <i>${cfg.all.length}</i></button>${cfg.chip.vals.sort().map(v => `<button type="button" class="tf-chip" data-v="${esc(v)}">${esc(v)} <i>${cfg.all.filter(r => cfg.chip.get(r) === v).length}</i></button>`).join('')}</div>` : ''}`;
  host.parentNode.insertBefore(bar, host);
  const go = () => tfApply(table, cfg, st, bar);
  bar.querySelector('.tf-q')?.addEventListener('input', e => { st.q = e.target.value; go(); });
  bar.querySelectorAll('.tf-sel').forEach(s => s.addEventListener('change', () => { st.sel[s.dataset.l] = s.value; go(); }));
  bar.querySelector('.tf-from')?.addEventListener('change', e => { st.from = e.target.value; go(); }); bar.querySelector('.tf-to')?.addEventListener('change', e => { st.to = e.target.value; go(); });
  bar.querySelectorAll('.tf-chip').forEach(c => c.addEventListener('click', () => { st.chip = c.dataset.v; go(); }));
  bar.querySelector('.tf-clear').addEventListener('click', () => { Object.assign(st, { q: '', chip: '', sel: {}, from: '', to: '' }); bar.querySelectorAll('.tf-q').forEach(i => i.value = ''); bar.querySelectorAll('.tf-sel').forEach(s => s.value = ''); bar.querySelectorAll('.tf-from,.tf-to').forEach(i => i.value = ''); go(); });
  bar.querySelector('.tf-csv').addEventListener('click', () => { const keep = cfg.heads.map((h, i) => h ? i : -1).filter(i => i >= 0 && !/^action/i.test(cfg.heads[i])), vis = cfg.all.filter(r => r.style.display !== 'none'); download(`${(document.title.split('·')[0] || 'export').trim().toLowerCase().replace(/\W+/g, '-')}-filtered.csv`, csv([keep.map(i => cfg.heads[i])].concat(vis.map(r => keep.map(i => tfNorm(r.cells[i].textContent)))))); toast(`Exported ${vis.length} rows`); });
  [...table.tHead.rows[0].cells].forEach((h, i) => { if (!cfg.heads[i] || /^action/i.test(cfg.heads[i]) || h.querySelector('input,button')) return; h.classList.add('tf-h'); h.title = 'Click to sort'; h.addEventListener('click', () => { st.sort = { i, dir: st.sort?.i === i && st.sort.dir === 'asc' ? 'desc' : 'asc' }; tfSort(table, cfg, st); }); });
  tfSort(table, cfg, st); go();
}
let tfTimer = 0; const tfScan = () => { clearTimeout(tfTimer); tfTimer = setTimeout(() => document.querySelectorAll('#view table:not([data-tf])').forEach(t => { try { tfEnhance(t); } catch (e) { console.warn('filters', e); } }), 40); };
new MutationObserver(tfScan).observe(document.body, { childList: true, subtree: true }); tfScan();
document.head.insertAdjacentHTML('beforeend', `<style>.tfbar{margin:0 0 10px}.tf-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.tf-search{display:flex;align-items:center;gap:8px;padding:0 12px;height:36px;border:1px solid var(--line);border-radius:10px;background:var(--surface);min-width:230px;flex:1;max-width:340px;transition:box-shadow .2s,border-color .2s}.tf-search:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}.tf-search .ic{width:16px;height:16px;color:var(--muted)}.tf-q{border:0;outline:0;background:transparent;color:inherit;width:100%;font:inherit}.tf-sel{width:auto;min-width:130px;max-width:210px;height:36px}.tf-date{display:inline-flex;align-items:center;gap:6px}.tf-date .input{height:36px;width:140px}.tf-right{margin-left:auto;display:inline-flex;align-items:center;gap:8px}.tf-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.tf-chip{border:1px solid var(--line);background:var(--surface);color:inherit;border-radius:999px;padding:4px 12px;font:inherit;font-size:12.5px;cursor:pointer;transition:all .18s}.tf-chip i{font-style:normal;opacity:.6;margin-left:4px}.tf-chip:hover{border-color:var(--accent)}.tf-chip.on{background:var(--accent);border-color:var(--accent);color:#fff}.tfbar.tf-on .tf-search{border-color:var(--accent)}th.tf-h{cursor:pointer;user-select:none;white-space:nowrap}th.tf-h:hover{color:var(--accent)}th.tf-s::after{content:' ↑';color:var(--accent)}th.tf-s[data-dir=desc]::after{content:' ↓'}@media(max-width:700px){.tf-right{margin-left:0;width:100%}.tf-search{max-width:none}}</style>`);

CHG.empmgr = el => { S.emp.mgr = el.value; render(); }; CHG.emprole = el => { S.emp.role = el.value; render(); }; CHG.empsort = el => { S.emp.sort = el.value; render(); };
ACT.empclear = () => { Object.assign(S.emp, { q: '', dept: '', status: 'Active', mgr: '', role: '', sort: '' }); S.branch = ''; render(); };
