'use strict';
/* ============ Orbit Realty — sidebar v2: grouped & collapsible sections, menu filter, pinned pages,
   three "closing" modes (full · icon rail with hover-peek · hidden), and a proper mobile drawer ============ */
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { } };
const SB = { mode: ['full', 'rail', 'hidden'].includes(lsGet('orbit_side', 'full')) ? lsGet('orbit_side', 'full') : 'full', last: lsGet('orbit_side_last', 'full'), groups: (() => { try { return JSON.parse(lsGet('orbit_side_groups', '{}')); } catch { return {}; } })(), q: '', peek: false };
const SB_GROUPS = [
  ['overview', 'Overview', 'home', ['dashboard', 'alerts', 'permissions']],
  ['time', 'Time & attendance', 'clock', ['attendance', 'roster', 'leave', 'attpolicy', 'locations', 'tracking']],
  ['people', 'People', 'users', ['employees', 'retention', 'org', 'recruitment', 'onboarding', 'lifecycle', 'letters']],
  ['pay', 'Pay & performance', 'wallet', ['payroll', 'salary', 'performance']],
  ['work', 'Workplace', 'briefcase', ['teamchat', 'meetings', 'helpdesk', 'assets', 'documents', 'mydocs', 'compliance', 'vault']],
  ['admin', 'Admin & insights', 'settings', ['reports', 'organisation', 'roles', 'settings']]
];
const SB_ICO = { chev: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>', left: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 17l-5-5 5-5M19 17l-5-5 5-5"/></svg>', right: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17l5-5-5-5M5 17l5-5-5-5"/></svg>', pin: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17l-6.1 3.6 1.4-6.8L2.2 9.1l6.9-.8z"/></svg>', x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' };
const sbNarrow = () => innerWidth <= 900;
const sbPins = () => { try { return JSON.parse(lsGet('orbit_pins_' + me().id, '[]')); } catch { return []; } };
const sideClass = () => sbNarrow() ? '' : SB.mode === 'rail' ? 'rail' : SB.mode === 'hidden' ? 'hidden' : '';

function sideHtml(u, cur, pc) {
  const vis = PAGES.filter(p => !p[3] || p[3]()), byId = Object.fromEntries(vis.map(p => [p[0], p])), used = new Set(), pins = sbPins().filter(id => byId[id]);
  const item = (p, grp) => `<div class="sitem ${cur === p[0] ? 'on' : ''}" data-id="${p[0]}"><a href="#/${p[0]}" class="${cur === p[0] ? 'on' : ''}" data-act="nav" data-tip="${esc(p[1])}" ${cur === p[0] ? 'aria-current="page"' : ''}>${ic(p[2])}<span class="lbl">${esc(p[1])}</span>${p[0] === 'leave' && pc ? `<span class="badge-n">${pc}</span>` : ''}</a><button type="button" class="pinb ${pins.includes(p[0]) ? 'on' : ''}" data-act="side_pin" data-id="${p[0]}" title="${pins.includes(p[0]) ? 'Unpin' : 'Pin to top'}" aria-label="Pin ${esc(p[1])}">${SB_ICO.pin}</button></div>`;
  const group = (id, label, icon, ids, extra = '') => { const items = ids.map(i => byId[i]).filter(Boolean); if (!items.length) return ''; const hasActive = items.some(p => p[0] === cur), open = hasActive || SB.groups[id] !== false; return `<section class="sgrp ${open ? 'open' : ''} ${extra}" data-g="${id}"><button type="button" class="sgh" data-act="side_group" data-g="${id}" aria-expanded="${open}"><span class="sgl">${esc(label)}</span><span class="sgc">${SB_ICO.chev}</span></button><div class="gbody"><div class="gin">${items.map(p => item(p, id)).join('')}</div></div></section>`; };
  SB_GROUPS.forEach(g => g[3].forEach(i => used.add(i)));
  const rest = vis.filter(p => !used.has(p[0]) && !pins.includes(p[0])).map(p => p[0]);
  const html = (pins.length ? group('pins', 'Pinned', 'pin', pins, 'pinned') : '') + SB_GROUPS.map(g => group(g[0], g[1], g[2], g[3].filter(i => !pins.includes(i)))).join('') + (rest.length ? group('more', 'More', 'menu', rest) : '');
  return `<aside class="side" id="side" aria-label="Main navigation"><div class="shead"><div class="brand">${brandMark()}<span class="bname">${esc(BR.name)}</span></div><button type="button" class="sbtn sclose" data-act="menu" title="Close menu" aria-label="Close menu">${SB_ICO.x}</button><button type="button" class="sbtn scol" data-act="side_collapse" title="${SB.mode === 'rail' ? 'Expand menu  [ ' : 'Collapse to icons  [ '}" aria-label="Collapse menu">${SB.mode === 'rail' ? SB_ICO.right : SB_ICO.left}</button></div>
  <div class="ssearch">${ic('search')}<input id="sbq" type="search" placeholder="Filter menu…" autocomplete="off" value="${esc(SB.q)}" aria-label="Filter menu"><kbd>[</kbd></div>
  <nav class="snav" id="snav">${html}<div class="snone" hidden>No page matches.<br><span>Press <kbd>Ctrl</kbd> <kbd>K</kbd> to search everything</span></div></nav>
  <div class="me" id="sme">${avatar(u)}<div class="minfo"><div class="mname">${esc(u.name)}</div><div class="mrole">${u.role === 'hr' ? 'HR' : u.role[0].toUpperCase() + u.role.slice(1)}</div></div><div class="mact"><button class="icon-btn" data-act="theme" title="Toggle theme" style="color:inherit">${ic('moon')}</button><button class="icon-btn" data-act="logout" title="Sign out" style="color:inherit">${ic('logout')}</button></div></div></aside><div class="sbk" data-act="menu"></div>`;
}

/* ---- actions ---- */
const sbSetMode = m => { if (m !== 'hidden') { SB.last = m; lsSet('orbit_side_last', m); } SB.mode = m; lsSet('orbit_side', m); const sh = $('.shell'); if (sh) { sh.classList.toggle('rail', m === 'rail' && !sbNarrow()); sh.classList.toggle('hidden', m === 'hidden' && !sbNarrow()); } const s = $('#side'); if (s) { s.classList.remove('peek'); SB.peek = false; } sbSyncBtn(); };
const sbSyncBtn = () => { const b = $('.scol'); if (b) { b.innerHTML = SB.mode === 'rail' ? SB_ICO.right : SB_ICO.left; b.title = SB.mode === 'rail' ? 'Expand menu  [ ' : 'Collapse to icons  [ '; } };
ACT.side_collapse = () => sbSetMode(SB.mode === 'rail' ? 'full' : 'rail');
ACT.menu = () => { if (sbNarrow()) { const s = $('#side'); if (!s) return; const o = s.classList.toggle('open'); document.body.classList.toggle('side-lock', o); } else sbSetMode(SB.mode === 'hidden' ? (SB.last === 'rail' ? 'rail' : 'full') : 'hidden'); };
ACT.nav = () => { $('#side')?.classList.remove('open'); document.body.classList.remove('side-lock'); };
ACT.side_group = el => { const g = el.dataset.g, sec = el.closest('.sgrp'), open = !sec.classList.contains('open'); sec.classList.toggle('open', open); el.setAttribute('aria-expanded', open); SB.groups[g] = open; lsSet('orbit_side_groups', JSON.stringify(SB.groups)); };
ACT.side_pin = el => { const id = el.dataset.id, p = sbPins(), i = p.indexOf(id); if (i >= 0) p.splice(i, 1); else p.unshift(id); lsSet('orbit_pins_' + me().id, JSON.stringify(p.slice(0, 6))); toast(i >= 0 ? 'Unpinned' : 'Pinned to the top of your menu'); render(); };

/* ---- filter ---- */
function sbFilter(q) {
  SB.q = q; const nav = $('#snav'); if (!nav) return; const t = q.trim().toLowerCase(); nav.classList.toggle('searching', !!t); let any = false;
  nav.querySelectorAll('.sgrp').forEach(g => { let n = 0; g.querySelectorAll('.sitem').forEach(i => { const ok = !t || i.textContent.toLowerCase().includes(t); i.hidden = !ok; if (ok) n++; }); g.hidden = !n; if (n) any = true; });
  const none = nav.querySelector('.snone'); if (none) none.hidden = any || !t;
}
document.addEventListener('input', e => { if (e.target.id === 'sbq') sbFilter(e.target.value); });
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if (e.target.id === 'sbq') { if (e.key === 'Escape') { e.target.value = ''; sbFilter(''); e.target.blur(); } else if (e.key === 'Enter') { $('#snav .sitem:not([hidden]) a')?.click(); } else if (e.key === 'ArrowDown') { e.preventDefault(); $('#snav .sitem:not([hidden]) a')?.focus(); } return; }
  if (e.key === 'Escape' && $('#side.open')) { ACT.nav(); return; }
  if (!typing && e.key === '[' && !e.ctrlKey && !e.metaKey && SESSION) { e.preventDefault(); sbNarrow() ? ACT.menu() : ACT.side_collapse(); return; }
  const a = e.target.closest?.('#snav a'); if (a && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); const all = [...$$('#snav .sitem:not([hidden]) a')], i = all.indexOf(a), n = all[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (n) n.focus(); else if (e.key === 'ArrowUp') $('#sbq')?.focus(); }
});

/* ---- rail hover-peek, mobile swipe ---- */
let sbT = 0;
document.addEventListener('mouseover', e => { const s = e.target.closest?.('#side'); if (!s || SB.mode !== 'rail' || sbNarrow()) return; clearTimeout(sbT); if (!s.classList.contains('peek')) sbT = setTimeout(() => { s.classList.add('peek'); }, 110); });
document.addEventListener('mouseout', e => { const s = $('#side'); if (!s || SB.mode !== 'rail') return; if (e.relatedTarget && s.contains(e.relatedTarget)) return; clearTimeout(sbT); sbT = setTimeout(() => s.classList.remove('peek'), 180); });
document.addEventListener('focusin', e => { const s = e.target.closest?.('#side'); if (s && SB.mode === 'rail' && !sbNarrow() && e.target.matches?.(':focus-visible')) s.classList.add('peek'); });
document.addEventListener('focusout', e => { const s = $('#side'); if (s && SB.mode === 'rail' && !s.contains(e.relatedTarget)) s.classList.remove('peek'); });
let sbX = null; document.addEventListener('touchstart', e => { sbX = e.target.closest?.('#side.open') ? e.touches[0].clientX : (e.touches[0].clientX < 18 && sbNarrow() ? -1 : null); }, { passive: true });
document.addEventListener('touchend', e => { if (sbX === null) return; const dx = e.changedTouches[0].clientX - (sbX < 0 ? 0 : sbX); if (sbX >= 0 && dx < -60) ACT.nav(); else if (sbX < 0 && dx > 70 && !$('#side.open')) ACT.menu(); sbX = null; }, { passive: true });
addEventListener('resize', () => { const sh = $('.shell'); if (!sh) return; if (!sbNarrow()) { document.body.classList.remove('side-lock'); $('#side')?.classList.remove('open'); } sh.classList.toggle('rail', SB.mode === 'rail' && !sbNarrow()); sh.classList.toggle('hidden', SB.mode === 'hidden' && !sbNarrow()); });

/* the shell is rebuilt on every render: keep scroll position, filter text and focus */
const _shellSB = shell;
shell = function () {
  const old = $('#snav'), top = old ? old.scrollTop : 0, hadFocus = document.activeElement?.id === 'sbq', wasOpen = $('#side')?.classList.contains('open'), peek = $('#side')?.classList.contains('peek');
  _shellSB(); const nav = $('#snav'); if (nav) nav.scrollTop = top; if (SB.q) sbFilter(SB.q); if (hadFocus) { const i = $('#sbq'); i?.focus(); try { i.setSelectionRange(SB.q.length, SB.q.length); } catch { } } if (wasOpen && sbNarrow()) $('#side')?.classList.add('open'); if (peek) $('#side')?.classList.add('peek');
  $('.menu-btn')?.setAttribute('aria-label', 'Toggle menu'); const act = $('#snav .sitem.on'); if (act && !old) act.scrollIntoView({ block: 'nearest' });
};

document.head.insertAdjacentHTML('beforeend', `<style>
:root{--side-hi:#fff;--side-mut:#6f8097;--side-line:#ffffff14;--side-hover:#ffffff12;--side-on:#ffffff1f}
.shell{--sw:252px;grid-template-columns:var(--sw) minmax(0,1fr);transition:grid-template-columns .28s var(--ease)}
.shell.rail{--sw:76px}.shell.hidden{--sw:0px}
.side{padding:0!important;gap:0!important;overflow:visible!important;width:100%;display:flex;flex-direction:column;border-right:1px solid var(--side-line);transition:width .28s var(--ease),box-shadow .2s;z-index:40}
.shead{display:flex;align-items:center;gap:6px;padding:16px 12px 10px 14px;min-height:64px}
.shead .brand{padding:0!important;display:flex;align-items:center;gap:10px;flex:1;min-width:0;color:var(--side-hi)}.shead .bname{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:800;letter-spacing:-.01em}
.sbtn{width:30px;height:30px;border:0;border-radius:9px;background:transparent;color:var(--side-ink);display:grid;place-items:center;cursor:pointer;flex:none;transition:background .15s,color .15s,transform .15s}.sbtn:hover{background:var(--side-hover);color:var(--side-hi)}.sbtn:active{transform:scale(.92)}.sclose{display:none}
.ssearch{display:flex;align-items:center;gap:8px;margin:2px 12px 8px;padding:0 10px;height:34px;border-radius:10px;background:var(--side-hover);border:1px solid transparent;color:var(--side-ink);transition:border-color .15s,background .15s}.ssearch:focus-within{border-color:var(--gold);background:var(--side-on)}.ssearch svg{width:15px;height:15px;flex:none}.ssearch input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--side-hi);font:inherit;font-size:13px}.ssearch input::placeholder{color:var(--side-mut)}.ssearch input::-webkit-search-cancel-button{display:none}.ssearch kbd{font-size:10px;padding:1px 6px;border-radius:5px;border:1px solid var(--side-line);color:var(--side-mut)}.ssearch:focus-within kbd{display:none}
.snav{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:2px 10px 10px;scrollbar-width:thin;scrollbar-color:var(--side-line) transparent}.snav::-webkit-scrollbar{width:6px}.snav::-webkit-scrollbar-thumb{background:var(--side-line);border-radius:6px}
.sgrp{margin-top:6px}.sgh{display:flex;align-items:center;width:100%;border:0;background:transparent;color:var(--side-mut);padding:7px 10px 5px;cursor:pointer;font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;border-radius:8px;transition:color .15s}.sgh:hover{color:var(--side-hi)}.sgl{flex:1;text-align:left;white-space:nowrap}.sgc{display:grid;transition:transform .25s var(--ease)}.sgrp:not(.open) .sgc{transform:rotate(-90deg)}
.gbody{display:grid;grid-template-rows:0fr;transition:grid-template-rows .28s var(--ease)}.sgrp.open .gbody,.snav.searching .gbody{grid-template-rows:1fr}.gin{overflow:hidden;min-height:0}
.sitem{position:relative;margin:1px 0}.sitem a{display:flex;align-items:center;gap:11px;padding:8px 12px;border-radius:10px;color:var(--side-ink);font-weight:500;font-size:13.5px;text-decoration:none;position:relative;transition:background .18s,color .18s,transform .18s var(--ease)}
.sitem a svg{width:18px;height:18px;flex:none}.sitem a:hover{background:var(--side-hover);color:var(--side-hi);transform:none}.sitem a.on{background:var(--side-on);color:var(--side-hi);font-weight:650}.sitem a:focus-visible{outline:2px solid var(--gold);outline-offset:-2px}
.sitem a.on::before{content:"";position:absolute;left:-10px;top:9px;bottom:9px;width:4px;border-radius:0 4px 4px 0;background:var(--gold);animation:grow-y .35s var(--ease)}
.lbl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}.sitem .badge-n{margin-left:auto;flex:none;background:#f59e0b;color:#1a1200;border-radius:99px;font-size:10.5px;font-weight:800;padding:1px 7px}
.pinb{position:absolute;right:6px;top:50%;transform:translateY(-50%) scale(.8);width:24px;height:24px;border:0;border-radius:7px;background:transparent;color:var(--side-mut);display:grid;place-items:center;cursor:pointer;opacity:0;transition:opacity .15s,transform .15s,color .15s}.sitem:hover .pinb,.pinb:focus-visible{opacity:1;transform:translateY(-50%) scale(1)}.pinb:hover{color:var(--gold)}.pinb.on{color:var(--gold);opacity:.9}.sitem:hover .badge-n{margin-right:26px}
.snone{padding:22px 12px;text-align:center;color:var(--side-mut);font-size:13px}.snone span{font-size:11.5px}.snone kbd{font-size:10px;padding:1px 5px;border:1px solid var(--side-line);border-radius:5px}
.side .me{margin:0!important;border-radius:0!important;border-top:1px solid var(--side-line);background:transparent!important;padding:12px 12px 14px 14px!important;display:flex;align-items:center;gap:10px;color:var(--side-hi);position:relative}
.minfo{min-width:0;flex:1}.mname{font-weight:650;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mrole{font-size:11.5px;color:var(--side-mut)}.mact{display:flex;align-items:center;gap:2px;flex:none}.mact .icon-btn{width:30px;height:30px;color:var(--side-ink)!important}.mact .icon-btn:hover{color:var(--side-hi)!important;background:var(--side-hover)}
.sbk{display:none}
/* ---- icon rail ---- */
.shell.rail .side:not(.peek){width:76px}.shell.rail .side:not(.peek) .bname,.shell.rail .side:not(.peek) .ssearch,.shell.rail .side:not(.peek) .minfo,.shell.rail .side:not(.peek) .lbl,.shell.rail .side:not(.peek) .sgc,.shell.rail .side:not(.peek) .pinb{display:none}
.shell.rail .side:not(.peek) .shead{flex-direction:column;padding:14px 0 8px;gap:8px}.shell.rail .side:not(.peek) .shead .brand{flex:none}
.shell.rail .side:not(.peek) .snav{padding:2px 12px 8px}.shell.rail .side:not(.peek) .sgrp{margin-top:0;border-top:1px solid var(--side-line);padding-top:6px;margin-top:6px}.shell.rail .side:not(.peek) .sgrp:first-of-type{border:0;margin-top:0;padding-top:0}
.shell.rail .side:not(.peek) .sgh{height:0;padding:0;overflow:hidden}.shell.rail .side:not(.peek) .gbody{grid-template-rows:1fr!important}
.shell.rail .side:not(.peek) .sitem a{justify-content:center;padding:10px 0;gap:0}.shell.rail .side:not(.peek) .sitem a.on::before{left:-12px}
.shell.rail .side:not(.peek) .sitem .badge-n{position:absolute;top:2px;right:2px;margin:0;font-size:9px;padding:0 5px;min-width:15px;text-align:center}
.shell.rail .side:not(.peek) .me{flex-direction:column;padding:12px 0}.shell.rail .side:not(.peek) .mact{flex-direction:column}
.shell.rail .side:not(.peek) .sitem a:hover::after{content:attr(data-tip);position:absolute;left:calc(100% + 12px);top:50%;transform:translateY(-50%);background:#0b1626;color:#fff;font-size:12px;font-weight:600;padding:6px 10px;border-radius:8px;white-space:nowrap;box-shadow:0 10px 24px -10px #000a;pointer-events:none;z-index:80}
.shell.rail .side.peek{width:252px;box-shadow:24px 0 48px -24px rgba(0,0,0,.45)}
/* ---- hidden ---- */
.shell.hidden .side{width:0;border:0;overflow:hidden!important;visibility:hidden;pointer-events:none}.shell.hidden .menu-btn{display:grid}
.menu-btn{display:grid}
@media(min-width:901px){.shell:not(.hidden) .menu-btn{display:none}}
/* ---- mobile drawer ---- */
@media(max-width:900px){.shell{grid-template-columns:minmax(0,1fr)!important}.side{position:fixed!important;left:0!important;top:0;bottom:0;height:100dvh!important;width:min(300px,86vw)!important;transform:translateX(-105%);transition:transform .28s var(--ease),box-shadow .2s!important;z-index:90;visibility:visible!important}.side.open{transform:none;box-shadow:30px 0 70px -20px rgba(0,0,0,.6)}
 .sclose{display:grid}.scol{display:none}.sbk{display:block;position:fixed;inset:0;background:rgba(6,12,22,.5);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .25s;z-index:80}.side.open+.sbk{opacity:1;pointer-events:auto}
 .sitem a{padding:11px 12px;font-size:14.5px}.pinb{opacity:.7}.ssearch kbd{display:none}.sitem a.on::before{left:-10px}}
body.side-lock{overflow:hidden}
@media(prefers-reduced-motion:reduce){.shell,.side,.gbody,.sgc{transition:none!important}}
</style>`);
