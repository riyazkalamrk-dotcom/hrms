'use strict';
/* ============ Orbit Realty — charts v2: nothing is clipped, axes + gridlines, compact ₹ labels, wrapped category names, hover tips ============ */
let CHID = 0;
const chShort = s => { s = String(s); const m = s.match(/^₹\s?([\d,]+(?:\.\d+)?)$/); if (!m) return s; const n = +m[1].replace(/,/g, ''), f = (v, d) => v.toFixed(d).replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1'); return n >= 1e7 ? '₹' + f(n / 1e7, n >= 1e8 ? 0 : 1) + 'Cr' : n >= 1e5 ? '₹' + f(n / 1e5, n >= 1e6 ? 0 : 1) + 'L' : n >= 1e4 ? '₹' + f(n / 1e3, 0) + 'K' : s; };
const chNice = m => { if (m <= 0) return 1; const p = 10 ** Math.floor(Math.log10(m)), f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
const chWrap = (s, max = 12) => { s = String(s); if (s.length <= max) return [s]; const w = s.split(' '); if (w.length > 1) { let best = null; for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '); if (a.length <= max + 2 && b.length <= max + 2) { if (!best || Math.abs(a.length - b.length) < Math.abs(best[0].length - best[1].length)) best = [a, b]; } } if (best) return best; } const a = s.slice(0, max); return [a, s.length > max * 2 ? s.slice(max, max * 2 - 1) + '…' : s.slice(max)]; };
const chEmpty = '<div class="chempty"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>No data to chart yet</div>';

const chBar = (data, o = {}, Wt = 0) => {
  const { h = 170, color = 'var(--accent)', fmt = x => x } = o;
  data = (data || []).filter(d => d && isFinite(d.v)); if (!data.length || data.every(d => !d.v)) return chEmpty;
  if ((data.length >= 5 && sum(data, d => String(d.l).length) / data.length >= 8) || (Wt && (Wt - 56) / data.length < 44)) { /* long category names → horizontal bars in real HTML so every letter stays readable */
    const mx = Math.max(...data.map(d => d.v), 1); return `<div class="chh">${data.map((d, i) => `<div class="chr" title="${esc(d.l)}: ${esc(fmt(d.v))}"><span class="chl">${esc(d.l)}</span><div class="cht"><i class="chf" style="width:${Math.max(d.v > 0 ? 2 : 0, d.v / mx * 100).toFixed(1)}%;background:${d.c || color};animation-delay:${i * 50}ms"></i></div><b class="chv">${esc(chShort(String(fmt(d.v))))}</b></div>`).join('')}</div>`; }
  const n = data.length, L = 46, R = 10, T = 28, B = 48, slot = Wt ? Math.max(30, Math.min(110, (Wt - L - R) / n)) : Math.max(58, Math.min(104, 540 / n)), W = L + R + slot * n, H = T + h + B, top = (m => data.every(d => Number.isInteger(d.v)) && m <= 24 ? Math.max(4, Math.ceil(m / 4) * 4) : chNice(m))(Math.max(...data.map(d => d.v), 1)), id = 'cg' + (++CHID);
  const tick = v => chShort(String(fmt(+v.toFixed(2))));
  const grid = [0, 1, 2, 3, 4].map(k => { const y = T + h - k * h / 4; return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1" ${k ? 'stroke-dasharray="3 5"' : ''}/><text x="${L - 8}" y="${y + 3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${esc(tick(top * k / 4))}</text>`; }).join('');
  const bars = data.map((d, i) => { const bh = Math.max(d.v > 0 ? 3 : 0, d.v / top * h), bw = Math.min(46, slot * .6), x = L + i * slot + (slot - bw) / 2, y = T + h - bh, lab = chShort(String(fmt(d.v))), fs = lab.length * 6.4 > slot - 4 ? 9.5 : 11.5, lines = chWrap(d.l, Math.max(6, Math.floor(slot / 6.2)));
    return `<g class="chg"><rect x="${(L + i * slot).toFixed(1)}" y="${T - 6}" width="${slot}" height="${h + 6}" fill="transparent"/><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="7" class="cbar" style="--d:${i * 60}ms" fill="${d.c || `url(#${id})`}"><title>${esc(d.l)}: ${esc(fmt(d.v))}</title></rect><text x="${(x + bw / 2).toFixed(1)}" y="${(y - 7).toFixed(1)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="var(--ink)">${esc(lab)}</text><text text-anchor="middle" font-size="10.5" fill="var(--muted)">${lines.map((t, k) => `<tspan x="${(L + i * slot + slot / 2).toFixed(1)}" y="${T + h + 18 + k * 13}">${esc(t)}</tspan>`).join('')}<title>${esc(d.l)}</title></text></g>`; }).join('');
  return `<svg class="chsvg" role="img" viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${Wt ? Math.round(W) : Math.round(W * 1.4)}px;height:auto"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${color};stop-opacity:1"/><stop offset="1" style="stop-color:${color};stop-opacity:.62"/></linearGradient></defs>${grid}${bars}</svg>`;
};

donut = function (data, size = 150) {
  data = (data || []).filter(d => d && d.v > 0); const tot = sum(data, d => d.v); const r = 50, c = 2 * Math.PI * r; let off = 0;
  if (!tot) return chEmpty;
  const gap = data.length > 1 ? 2.5 : 0;
  return `<div class="chdonut"><svg viewBox="0 0 140 140" width="${size}" height="${size}" role="img" style="flex:none"><g transform="rotate(-90 70 70)"><circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--line)" stroke-width="20" opacity=".55"/>${data.map(d => { const len = Math.max(0, d.v / tot * c - gap), s = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${d.c}" stroke-width="20" class="cdn" style="--len:${len};--c:${c}" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}"><title>${esc(d.l)}: ${d.v} (${Math.round(d.v / tot * 100)}%)</title></circle>`; off += d.v / tot * c; return s; }).join('')}</g><text x="70" y="72" text-anchor="middle" font-size="24" font-weight="800" fill="var(--ink)">${tot}</text><text x="70" y="88" text-anchor="middle" font-size="9.5" fill="var(--muted)" letter-spacing=".6">TOTAL</text></svg><div class="chleg">${data.map(d => `<div class="chli"><i style="background:${d.c}"></i><span>${esc(d.l)}</span><b>${d.v}</b><em>${Math.round(d.v / tot * 100)}%</em></div>`).join('')}</div></div>`;
};

const chLine = (pts, o = {}, Wt = 0) => {
  const { h = 140, fmt = x => x } = o;
  pts = (pts || []).filter(p => p && isFinite(p.v)); if (!pts.length) return chEmpty;
  const W = Wt ? Math.max(220, Math.round(Wt)) : 600, L = 44, R = 18, T = 22, B = 30, H = T + h + B, id = 'cl' + (++CHID); let mn = Math.min(...pts.map(p => p.v)), mx = Math.max(...pts.map(p => p.v)); if (mx === mn) { mx += Math.abs(mx) * .1 || 1; mn = Math.max(0, mn - Math.abs(mn) * .1); } const pad = (mx - mn) * .12; const lo = mn >= 0 ? Math.max(0, mn - pad) : mn - pad, hi0 = mx + pad, hi = (mx <= 100 && mn >= 0) ? Math.min(100, hi0) : hi0, rg = hi - lo;
  const xs = i => L + (pts.length === 1 ? (W - L - R) / 2 : i / (pts.length - 1) * (W - L - R)), ys = v => T + h - (v - lo) / rg * h, xy = pts.map((p, i) => [xs(i), ys(p.v)]);
  const path = xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '), tk = v => esc(chShort(String(fmt(Math.round(v * 10) / 10))));
  const grid = [0, 1, 2].map(k => { const v = lo + rg * k / 2, y = ys(v); return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="var(--line)" ${k ? 'stroke-dasharray="3 5"' : ''}/><text x="${L - 8}" y="${y + 3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${tk(v)}</text>`; }).join('');
  const idx = [...new Set([0, Math.floor((pts.length - 1) / 2), pts.length - 1])], lx = idx.map((i, k) => `<text x="${xs(i)}" y="${T + h + 20}" text-anchor="${k === 0 && idx.length > 1 ? 'start' : i === pts.length - 1 && idx.length > 1 ? 'end' : 'middle'}" font-size="10" fill="var(--muted)">${esc(pts[i].l)}</text>`).join('');
  const last = xy.at(-1), ly = last[1] - 11 < 12 ? last[1] + 20 : last[1] - 11;
  return `<svg class="chsvg" role="img" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>${grid}${xy.length > 1 ? `<path class="car" d="${path} L${last[0]} ${T + h} L${xy[0][0]} ${T + h}Z" fill="url(#${id})"/>` : ''}<path class="cln" pathLength="1" d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>${xy.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === xy.length - 1 ? 5 : 3.2}" fill="${i === xy.length - 1 ? 'var(--accent)' : 'var(--surface)'}" stroke="var(--accent)" stroke-width="2" class="chdot"><title>${esc(pts[i].l)}: ${esc(fmt(pts[i].v))}</title></circle>`).join('')}<text x="${Math.min(W - R, last[0] + 4)}" y="${ly}" text-anchor="end" font-size="11.5" font-weight="700" fill="var(--ink)">${tk(pts.at(-1).v)}</text>${lx}</svg>`;
};

/* responsive: after insertion each chart is re-drawn at the real width of its card, so text is always true-size and never shrinks */
const CHREG = {}; let CHN = 0;
const chTag = (html, id, wt) => html.replace('<svg class="chsvg"', `<svg class="chsvg" data-i="${id}" data-k="${wt}"`);
barChart = function (d, o) { const id = ++CHN; CHREG[id] = { kind: 'bar', d, o }; delete CHREG[id - 400]; return chTag(chBar(d, o, 0), id, 0); };
lineChart = function (d, o) { const id = ++CHN; CHREG[id] = { kind: 'line', d, o }; delete CHREG[id - 400]; return chTag(chLine(d, o, 0), id, 0); };
function chFit() {
  document.querySelectorAll('svg.chsvg[data-i]').forEach(svg => {
    const r = CHREG[svg.dataset.i], host = svg.parentElement; if (!r || !host) return; const cs = getComputedStyle(host), cw = Math.floor(host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    if (cw < 120 || Math.abs(cw - (+svg.dataset.k || 0)) < 10) return;
    const html = chTag(r.kind === 'bar' ? chBar(r.d, r.o, cw) : chLine(r.d, r.o, cw), svg.dataset.i, cw), t = document.createElement('div'); t.innerHTML = html; svg.replaceWith(t.firstElementChild.cloneNode ? t.firstElementChild : t.firstChild);
  });
}
let chT = 0; const chSched = () => { clearTimeout(chT); chT = setTimeout(chFit, 0); };
new MutationObserver(m => { if (m.some(x => [...x.addedNodes].some(n => n.nodeType === 1 && (n.matches?.('svg.chsvg') || n.querySelector?.('svg.chsvg'))))) chFit(); }).observe(document.body, { childList: true, subtree: true });
addEventListener('resize', chSched);
