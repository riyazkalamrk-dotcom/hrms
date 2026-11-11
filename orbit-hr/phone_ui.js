'use strict';
/* ============ Orbit Realty — phone layout: ink hero with shift dial + slide to check in/out, week bars, tiles, pill tab bar ============ */
const mPhone = () => innerWidth <= 900;
const mSync = () => document.documentElement.classList.toggle('m-ui', mPhone());
mSync(); addEventListener('resize', mSync);
const mIc = n => ic(ICONS[n] ? n : 'check');
const mSvg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const M_CHEV = 'M6 6l6 6-6 6M13 6l6 6-6 6', M_PIN = 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.800 7 11 7 11zM12 12.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z', M_OUT = 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4', M_FP = 'M12 11v4a6 6 0 0 1-1 3.300M8 14v-3a4 4 0 0 1 8 0v3a9 9 0 0 1-.800 3.700M5 12a7 7 0 0 1 14 0v2M8.500 19.500A9 9 0 0 0 9 17', M_OK = 'M5 12.500l4.500 4.500L19 7.500';
const mPage = re => (PAGES.find(p => re.test(p[0])) || PAGES.find(p => re.test(p[1])) || [])[0];

function mHeroData() {
  const u = me(), T = TODAY(), d = dutyOf(u), t = dutyText(d), r0 = DB.att[u.id]?.[T], rec = r0 && !r0.absent ? r0 : null, brk = onBreak(rec);
  const canIn = !rec && (!['off', 'absent'].includes(d.kind) || d.manual), canOut = !!rec && !rec.out, done = !!rec?.out;
  const span = d.eM - d.sM, pct = span > 0 ? Math.min(1, Math.max(0, (d.nm - d.sM) / span)) : 0;
  const big = rec ? fmtHM(netMins(rec)) : nowHM(), lab = canOut ? (brk ? 'On a break' : 'Worked today') : done ? 'Day total' : 'Time now';
  const tone = ['late', 'missed', 'absent'].includes(d.kind) ? 'bad' : ['due', 'checkout'].includes(d.kind) ? 'warn' : ['working', 'done'].includes(d.kind) ? 'ok' : 'idle';
  const site = rec ? (rec.mode === 'WFH' ? 'Work from home' : rec.mode === 'Field' ? 'Field duty' : siteName(rec.site) || rec.mode || '') : siteName(branchOf(u));
  return { u, d, t, rec, brk, canIn, canOut, done, pct, big, lab, tone, site };
}
function mHero() {
  const x = mHeroData(), { d, t } = x, a = Math.PI * x.pct, mx = (120 - 92 * Math.cos(a)).toFixed(1), my = (120 - 92 * Math.sin(a)).toFixed(1);
  const slider = (kind, label, off) => `<div class="mh-sl ${kind}${off ? ' off' : ''}" data-kind="${kind}"><i class="mh-fill"></i><span class="mh-lb"><em>${label}</em>${off ? '' : mSvg(M_CHEV)}</span><button type="button" class="mh-th" ${off ? 'disabled' : ''} aria-label="${label}">${mSvg(kind === 'in' ? M_FP : M_OUT)}</button></div>`;
  let foot = '';
  if (x.canIn) foot = `<div class="mh-site">${siteSelect()}</div>${slider('in', 'Slide to check in')}`;
  else if (x.canOut) foot = `${slider('out', x.brk ? 'End your break first' : 'Slide to check out', x.brk)}<div class="mh-brk">${x.brk ? `<button type="button" class="mh-ghost" data-act="break_end">End break</button>` : `<button type="button" class="mh-ghost" data-act="break_start">Start a break</button>`}<a class="mh-ghost" href="#/attendance">My attendance</a></div>`;
  else foot = `<div class="mh-done">${x.done ? mSvg(M_OK) : mIc('calendar')}<span>${x.done ? `Checked out at ${esc(x.rec.out)}` : esc(t.title)}</span></div>`;
  return `<section class="mh-hero" id="mhero" data-kind="${d.kind}">
    <div class="mh-row"><span class="mh-chip ${x.tone}"><u></u><span id="mhstate">${esc(t.state)}</span></span>${x.site ? `<span class="mh-loc">${mSvg(M_PIN)}<span>${esc(x.site)}</span></span>` : ''}</div>
    <div class="mh-dial"><svg viewBox="0 0 240 132" aria-hidden="true"><path class="bg" d="M28 120A92 92 0 0 1 212 120"/><path class="fg" id="mharc" d="M28 120A92 92 0 0 1 212 120" style="stroke-dashoffset:${(289 * (1 - x.pct)).toFixed(1)}"/>${x.pct > 0 && x.pct < 1 ? `<circle id="mhdot" cx="${mx}" cy="${my}" r="7"/>` : ''}</svg>
      <div class="mh-mid"><small id="mhlab">${x.lab}</small><b id="mhbig">${x.big}</b></div></div>
    <div class="mh-ends"><span>${d.sh.start}</span><span>${esc(d.sh.name)}</span><span>${d.sh.end}</span></div>
    <p class="mh-sub" id="mhsub">${esc(x.rec && !x.done ? t.title + ' · ' + t.sub : x.done ? t.title : t.title + (t.sub ? ' · ' + t.sub : ''))}</p>
    ${foot}</section>`;
}
function mWeek() {
  const u = me(), T = TODAY(), ws = weekStart(T); let tot = 0, target = 0, max = 1; const days = [];
  for (let i = 0; i < 7; i++) {
    const dt = addDays(ws, i), pl = dayPlan(u, dt), r = DB.att[u.id]?.[dt]; let len = 0;
    if (pl.t === 'work' && !pl.lv) { len = hm2m(pl.shift.end) - hm2m(pl.shift.start); if (len <= 0) len += 1440; target += len; }
    const m = dt <= T && r && r.in && !r.absent ? netMins(r, dt === T ? undefined : hm2m(r.out || shiftOf(u, dt).end)) : 0;
    tot += m; max = Math.max(max, len, m); days.push({ dt, m, late: dt <= T && dayStatus(u.id, dt).s === 'late', off: pl.t !== 'work' || !!pl.lv });
  }
  return `<section class="mh-card"><div class="mh-h"><b>This week</b><span>${fmtHM(tot)}${target ? ' of ' + fmtHM(target) : ''}</span></div>
    <div class="mh-bars">${days.map(x => `<i class="${x.dt === T ? 'td' : ''}${x.late ? ' lt' : ''}" style="--h:${Math.round(x.m / max * 100)}%" title="${fmtShort(x.dt)} · ${fmtHM(x.m)}"></i>`).join('')}</div>
    <div class="mh-days">${days.map(x => `<span class="${x.dt === T ? 'td' : ''}${x.off ? ' off' : ''}">${'SMTWTFS'[dow(x.dt)]}</span>`).join('')}</div></section>`;
}
function mTiles() {
  const u = me(), T = TODAY(), left = sum(['CL', 'SL', 'EL'], k => { const b = leaveBalance(u.id, k); return isFinite(b.left) ? Math.max(0, b.left) : 0; });
  const pm = addDays(T.slice(0, 8) + '01', -1).slice(0, 7), mon = new Date(pm + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short' }); let net = null; try { net = payslip(u.id, pm).net; } catch { }
  const pay = mPage(/payslip/i) || mPage(/^pay/i);
  return `<section class="mh-tiles"><a class="mh-tile" href="#/leave"><span>Leave balance</span><b>${left} day${left === 1 ? '' : 's'}</b></a>
    <a class="mh-tile ac" href="#/${pay || 'dashboard'}"><span>${mon} payslip</span><b>${net != null && isFinite(net) ? inr(net) : 'View'}</b></a></section>`;
}
function mQuick() {
  const q = [['leave_new', 'calendar', 'Apply leave'], ['claim_new', 'wallet', 'Claim expense'], ['reg_new', 'clock', 'Fix attendance'], ['tk_new', 'help', 'Raise a ticket']].filter(x => ACT[x[0]]);
  return q.length ? `<section class="mh-card"><div class="mh-h"><b>Quick actions</b></div><div class="mh-quick">${q.map(([a, i, l]) => `<button type="button" data-act="${a}">${mIc(i)}<span>${l}</span></button>`).join('')}</div></section>` : '';
}
function mNews() {
  const n = (DB.news || []).slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (a.ts < b.ts ? 1 : -1)).slice(0, 2);
  return n.length ? `<section class="mh-card"><div class="mh-h"><b>Announcements</b></div>${n.map(x => `<div class="mh-news"><b>${esc(x.title)}</b><span>${fmtShort(x.ts)}</span></div>`).join('')}</section>` : '';
}
function mobileHome() {
  const u = me(), h = nowDate().getHours(), pc = (isHR() || isMgr()) ? pendingCount() : 0;
  return `<div class="mhome" id="mhome"><header class="mh-top"><div><small>${nowDate().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</small><h1>${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, ${esc(u.name.split(' ')[0])}</h1></div><a href="#/employees/${u.id}" aria-label="My profile">${avatar(u)}</a></header>
    ${mHero()}${pc ? `<a class="mh-alert" href="#/leave">${mIc('bell')}<span>${pc} approval${pc > 1 ? 's' : ''} waiting for you</span>${mSvg('M9 6l6 6-6 6')}</a>` : ''}${mWeek()}${mTiles()}${mQuick()}${mNews()}</div>`;
}
{ const _d = PAGE_FN.dashboard; PAGE_FN.dashboard = () => (mPhone() && SESSION && tabOf('dash', 'my') === 'my') ? mobileHome() : _d(); }

/* phones: the assistant moves from a floating button (it covered content) into the top bar */
{ const _r = render; render = function () { _r(); try { mSync(); const rt = document.querySelector('.top .right'); if (rt && mPhone() && !rt.querySelector('.m-ai')) rt.insertAdjacentHTML('afterbegin', `<button class="icon-btn m-ai" data-act="chat" title="Orbit Assistant" aria-label="Orbit Assistant">${ic('spark')}</button>`); } catch { } }; }

/* live numbers without a full re-render; a full render only when the duty state changes */
setInterval(() => { const el = document.getElementById('mhero'); if (!el || mDrag || !SESSION) return; const x = mHeroData(); if (x.d.kind !== el.dataset.kind) return render(); const s = (id, v) => { const n = document.getElementById(id); if (n && n.textContent !== v) n.textContent = v; }; s('mhbig', x.big); s('mhlab', x.lab); const a = document.getElementById('mharc'); if (a) a.style.strokeDashoffset = (289 * (1 - x.pct)).toFixed(1); const dot = document.getElementById('mhdot'); if (dot) { const g = Math.PI * x.pct; dot.setAttribute('cx', (120 - 92 * Math.cos(g)).toFixed(1)); dot.setAttribute('cy', (120 - 92 * Math.sin(g)).toFixed(1)); } }, 15000);

/* slide to confirm */
let mDrag = null;
const mSet = (s, v, snap) => { s.x = v; s.th.classList.toggle('snap', !!snap); s.fill.classList.toggle('snap', !!snap); s.th.style.transform = `translateX(${v}px)`; s.fill.style.width = (v + 54) + 'px'; s.lb.style.opacity = Math.max(0, 1 - v / (s.max * .55)); };
function mFire(s) { mSet(s, s.max, true); s.th.innerHTML = mSvg(M_OK); navigator.vibrate?.(18); const kind = s.sl.dataset.kind; setTimeout(() => { try { kind === 'in' ? ACT.checkin() : ACT.checkout(); } finally { setTimeout(() => { if (document.body.contains(s.sl)) { s.th.innerHTML = mSvg(kind === 'in' ? M_FP : M_OUT); mSet(s, 0, true); } }, 900); } }, 320); }
document.addEventListener('pointerdown', e => { const th = e.target.closest?.('.mh-th'); if (!th || th.disabled || mDrag) return; const sl = th.parentNode; e.preventDefault(); mDrag = { sl, th, fill: sl.querySelector('.mh-fill'), lb: sl.querySelector('.mh-lb'), sx: e.clientX, x: 0, max: sl.clientWidth - 54, moved: false }; try { th.setPointerCapture(e.pointerId); } catch { } });
document.addEventListener('pointermove', e => { const s = mDrag; if (!s) return; const v = Math.min(s.max, Math.max(0, e.clientX - s.sx)); if (v > 4) s.moved = true; mSet(s, v, false); });
const mUp = () => { const s = mDrag; if (!s) return; mDrag = null; if (s.x > s.max * .8) mFire(s); else { mSet(s, 0, true); if (!s.moved) toast('Slide the button to the right to confirm'); } };
document.addEventListener('pointerup', mUp); document.addEventListener('pointercancel', mUp);
document.addEventListener('keydown', e => { const th = e.target.closest?.('.mh-th'); if (!th || th.disabled || (e.key !== 'Enter' && e.key !== ' ')) return; e.preventDefault(); const sl = th.parentNode; mFire({ sl, th, fill: sl.querySelector('.mh-fill'), lb: sl.querySelector('.mh-lb'), x: 0, max: sl.clientWidth - 54 }); });

document.head.insertAdjacentHTML('beforeend', `<style>
:root{--mh-ink:#14151a;--mh-lime:#c6f24e;--mh-coral:#ff6b4a;--mh-dim:#9a9ca6}
[data-theme=dark]{--mh-ink:#1b2027}
.mhome{display:flex;flex-direction:column;gap:12px;max-width:560px;margin:0 auto}
.mh-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:2px 2px 0}
.mh-top>div{min-width:0}.mh-top small{display:block;font-size:12px;font-weight:600;color:var(--muted)}
.mh-top h1{font-size:22px;line-height:1.2;font-weight:800;letter-spacing:-.02em;overflow-wrap:anywhere}
.mh-top a{flex:none}.mh-top .avatar{width:42px;height:42px;font-size:14px}
.mh-hero{background:var(--mh-ink);color:#fff;border-radius:28px;padding:16px}
.mh-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}
.mh-chip{flex:none;display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;background:#ffffff14;padding:6px 11px;border-radius:99px;white-space:nowrap}
.mh-chip u{width:8px;height:8px;border-radius:50%;background:var(--mh-dim)}
.mh-chip.ok u{background:var(--mh-lime);animation:mhping 1.8s infinite}.mh-chip.warn u{background:#fbbf24}.mh-chip.bad u{background:var(--mh-coral)}
@keyframes mhping{0%{box-shadow:0 0 0 0 #c6f24e99}70%{box-shadow:0 0 0 8px #c6f24e00}100%{box-shadow:0 0 0 0 #c6f24e00}}
.mh-loc{display:flex;align-items:center;gap:5px;min-width:0;font-size:12px;color:var(--mh-dim);font-weight:600}
.mh-loc svg{flex:none;width:14px;height:14px}.mh-loc span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mh-dial{position:relative;max-width:300px;margin:8px auto 0}
.mh-dial svg{display:block;width:100%;height:auto;overflow:visible}
.mh-dial path{fill:none;stroke-width:9;stroke-linecap:round}.mh-dial .bg{stroke:#ffffff1a}
.mh-dial .fg{stroke:var(--mh-lime);stroke-dasharray:289;transition:stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1);animation:mharc 1.3s cubic-bezier(.2,.8,.2,1) both}
@keyframes mharc{from{stroke-dashoffset:289}}
.mh-dial circle{fill:var(--mh-ink);stroke:#fff;stroke-width:3;animation:mhfade .4s 1s both}
@keyframes mhfade{from{opacity:0}}
.mh-mid{position:absolute;left:0;right:0;bottom:6%;text-align:center;pointer-events:none}
.mh-mid small{display:block;font-size:12px;font-weight:600;color:var(--mh-dim)}
.mh-mid b{display:block;font-size:38px;line-height:1.1;font-weight:800;letter-spacing:-.04em;font-variant-numeric:tabular-nums;white-space:nowrap}
.mh-ends{display:flex;justify-content:space-between;align-items:center;gap:8px;max-width:300px;margin:2px auto 0;font-size:11px;font-weight:700;color:var(--mh-dim)}
.mh-ends span:nth-child(2){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.mh-sub{margin:10px 0 14px;text-align:center;font-size:13px;line-height:1.45;color:#d6d7dc;overflow-wrap:anywhere}
.mh-sl{position:relative;height:54px;border-radius:27px;background:#ffffff14;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.mh-fill{position:absolute;left:0;top:0;bottom:0;width:54px;border-radius:27px;background:#c6f24e33}.mh-sl.out .mh-fill{background:#ff6b4a40}
.mh-lb{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 14px 0 58px;font-size:14px;font-weight:700;color:#fff;pointer-events:none}
.mh-lb em{font-style:normal;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mh-lb svg{flex:none;width:16px;height:16px;opacity:.6;animation:mhnudge 1.4s infinite}
@keyframes mhnudge{50%{transform:translateX(5px);opacity:1}}
.mh-th{position:absolute;left:4px;top:4px;width:46px;height:46px;min-height:0;padding:0;border:0;border-radius:50%;background:var(--mh-lime);color:var(--mh-ink);display:grid;place-items:center;cursor:grab;touch-action:none}
.mh-th svg{width:22px;height:22px}.mh-sl.out .mh-th{background:var(--mh-coral);color:#fff}
.mh-sl.off{opacity:.55}.mh-sl.off .mh-th{background:#ffffff33;color:#fff;cursor:not-allowed}
.mh-th.snap,.mh-fill.snap{transition:transform .4s cubic-bezier(.3,1.3,.5,1),width .4s cubic-bezier(.3,1.3,.5,1)}
.mh-th:focus-visible{outline:2px solid #fff;outline-offset:2px}
.mh-site{margin-bottom:10px;display:flex;flex-direction:column;gap:6px}
.mh-site select.select{width:100%!important;max-width:none!important;min-height:44px;background-color:#ffffff14;color:#fff;border:0;border-radius:14px;font-weight:600}
.mh-site select option{color:#14151a;background:#fff}
.mh-site .polhint{display:block;font-size:12px;line-height:1.4;color:var(--mh-dim)!important;overflow-wrap:anywhere}
.mh-brk{display:flex;gap:8px;margin-top:10px}
.mh-ghost{flex:1;min-width:0;min-height:42px;display:inline-flex;align-items:center;justify-content:center;padding:0 10px;border:0;border-radius:14px;background:#ffffff14;color:#fff;font:inherit;font-size:13px;font-weight:700;text-decoration:none;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mh-done{display:flex;align-items:center;justify-content:center;gap:8px;min-height:54px;padding:8px 14px;border-radius:27px;background:#ffffff14;font-size:14px;font-weight:700;text-align:center}
.mh-done svg{flex:none;width:20px;height:20px;color:var(--mh-lime)}.mh-done span{min-width:0;overflow-wrap:anywhere}
.mh-alert{display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:18px;background:var(--amber-soft);color:var(--ink);font-weight:700;font-size:13.500px;text-decoration:none}
.mh-alert svg{flex:none;width:18px;height:18px}.mh-alert span{flex:1;min-width:0}
.mh-card{background:var(--surface);border-radius:22px;padding:15px 16px}
.mh-h{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:14px}.mh-h b{font-weight:800}.mh-h span{color:var(--muted);font-size:12.500px;font-weight:600;white-space:nowrap}
.mh-bars{display:flex;gap:8px;align-items:flex-end;height:46px;margin-top:12px}
.mh-bars i{flex:1;height:max(4px,var(--h));border-radius:6px;background:var(--line);animation:mhgrow .9s cubic-bezier(.2,.8,.2,1) both;transform-origin:bottom}
.mh-bars i.td{background:var(--ink)}.mh-bars i.lt{background:#ffb199}
@keyframes mhgrow{from{transform:scaleY(.05)}}
.mh-days{display:flex;gap:8px;margin-top:6px;font-size:11px;font-weight:700;color:var(--muted)}.mh-days span{flex:1;text-align:center}.mh-days .td{color:var(--ink)}.mh-days .off{opacity:.5}
.mh-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mh-tile{min-width:0;background:var(--surface);border-radius:20px;padding:14px 15px;text-decoration:none;color:var(--muted);font-size:12.500px;font-weight:600;display:flex;flex-direction:column;gap:2px}
.mh-tile b{color:var(--ink);font-size:21px;line-height:1.2;font-weight:800;letter-spacing:-.02em;overflow-wrap:anywhere}
.mh-tile.ac{background:var(--mh-lime);color:#3d4a10}.mh-tile.ac b{color:#14151a}
.mh-quick{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.mh-quick button{min-width:0;min-height:48px;display:flex;align-items:center;gap:9px;padding:8px 11px;border:0;border-radius:14px;background:var(--surface2);color:var(--ink);font:inherit;font-size:13px;font-weight:700;text-align:left;cursor:pointer}
.mh-quick button svg{flex:none;width:18px;height:18px}.mh-quick button span{min-width:0;line-height:1.25;overflow-wrap:anywhere}
.mh-quick button:active,.mh-ghost:active,.mh-tile:active{transform:scale(.97)}
.mh-news{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:10px 0;border-top:1px solid var(--line);font-size:13.500px}.mh-news:first-of-type{border-top:0;margin-top:4px}
.mh-news b{min-width:0;font-weight:600;overflow-wrap:anywhere}.mh-news span{flex:none;color:var(--muted);font-size:12px}
.mhome>*{animation:mhin .5s cubic-bezier(.2,.8,.2,1) both}.mhome>*:nth-child(2){animation-delay:.05s}.mhome>*:nth-child(3){animation-delay:.1s}.mhome>*:nth-child(4){animation-delay:.15s}.mhome>*:nth-child(n+5){animation-delay:.2s}
@keyframes mhin{from{opacity:0;transform:translateY(12px)}}

/* ---- phone chrome: floating pill tab bar, calmer top bar, rounder cards, bottom-sheet dialogs ---- */
html.m-ui .tabbar{left:12px;right:12px;bottom:calc(10px + env(safe-area-inset-bottom,0px));height:60px;padding:6px;gap:2px;border:0;border-radius:30px;background:var(--surface);backdrop-filter:none;-webkit-backdrop-filter:none;box-shadow:0 8px 28px -8px rgba(20,21,26,.28),0 0 0 1px var(--line);align-items:center}
html.m-ui .tabbar a{flex:1 1 0;min-width:0;height:48px;flex-direction:row;justify-content:center;gap:6px;padding:0 4px;border-radius:24px;font-size:12.500px;font-weight:700}
html.m-ui .tabbar a span{display:none;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html.m-ui .tabbar a svg{flex:none;width:22px;height:22px;transform:none!important}
html.m-ui .tabbar a.on{flex:2.300 1 0;background:var(--ink);color:var(--surface);animation:mhtab .35s cubic-bezier(.3,1.2,.5,1) both}
html.m-ui .tabbar a.on span{display:block}
@media(max-width:350px){html.m-ui .tabbar{left:8px;right:8px}html.m-ui .tabbar a.on{flex:3.100 1 0;gap:5px;font-size:12px}}
html.m-ui .tabbar a:active{background:var(--surface2)}html.m-ui .tabbar a.on:active{background:var(--ink)}
html.m-ui .tabbar .tb-n{top:4px;left:auto;right:6px}
@keyframes mhtab{from{transform:scale(.9);opacity:.6}}
html.m-ui .top{background:var(--bg)!important;border-bottom:0!important}
html.m-ui .top{flex-wrap:nowrap!important;gap:6px!important;padding-left:12px!important;padding-right:12px!important}
html.m-ui .top .searchbox{flex:none;min-width:0;width:42px;height:42px;padding:0;justify-content:center;border-radius:14px}
html.m-ui .top .searchbox span,html.m-ui .top .searchbox kbd{display:none}
html.m-ui .top>select.select{flex:1 1 0;min-width:0;width:auto!important;max-width:none!important;height:42px;border-radius:14px;text-overflow:ellipsis}
html.m-ui .top .right{flex:none;margin-left:0;gap:2px!important}
html.m-ui .top .right>[data-act=checkout],html.m-ui .top .right>[data-act=checkin],html.m-ui .top .right>[data-act=quickadd],html.m-ui .top .right>[data-act=theme],html.m-ui .top .right>.icon-btn:not([data-act]){display:none!important}
html.m-ui .fab{display:none!important}
html.m-ui .ticker{display:none!important}
html.m-ui #alertbar .abar{padding:8px 14px;gap:10px;font-size:13px}
html.m-ui #alertbar .abar .t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
html.m-ui #alertbar .abar .t .muted{display:none}
html.m-ui #alertbar{position:static!important}
html.m-ui #alertbar .abar .btn{flex:none;white-space:nowrap;min-height:36px;padding:0 12px;font-size:12.500px}
html.m-ui #alertbar .abar a.btn[href="#/alerts"]{font-size:0}
html.m-ui #alertbar .abar a.btn[href="#/alerts"]::after{content:"Open";font-size:13px}
html.m-ui #alertbar .abar:not(.hr){flex-wrap:wrap;row-gap:8px}
html.m-ui #alertbar .abar:not(.hr) .t{flex:1 1 200px;min-width:0;white-space:normal;overflow:visible}
html.m-ui #alertbar .abar:not(.hr) .t .muted{display:inline}
html.m-ui .tablewrap table:has(td.empty){min-width:0}
html.m-ui .tablewrap td.empty{white-space:normal;text-align:center}
html.m-ui .rcal .rchip{padding:4px 1px;max-width:100%}
html.m-ui .rcal .rchip small{display:block;font-size:8.500px;line-height:1.2;letter-spacing:-.03em;word-break:normal;overflow-wrap:normal}
html.m-ui .cal .d small{font-size:9px;line-height:1.15;letter-spacing:-.02em;word-break:normal;overflow-wrap:normal}
html.m-ui .view .tabs{overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}html.m-ui .view .tabs::-webkit-scrollbar{display:none}html.m-ui .view .tabs button{flex:none;white-space:nowrap}
html.m-ui .modal-bg{place-items:end center;padding:0}
html.m-ui .modal-bg>.modal{max-width:none;width:100%;border-radius:26px 26px 0 0;max-height:calc(100dvh - 40px);padding-bottom:env(safe-area-inset-bottom,0px);animation:mhsheet .38s cubic-bezier(.2,.9,.25,1) both}
@keyframes mhsheet{from{transform:translateY(100%)}}
html.m-ui .row.wrap:has(>.sum-chip){display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
html.m-ui .sum-chip{min-width:0;margin:0}
html.m-ui .tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
html.m-ui .tablewrap table{min-width:640px}
html.m-ui table td,html.m-ui table th{overflow-wrap:normal;word-break:normal}
html.m-ui .view :not(.tablewrap)>table{display:block;max-width:100%;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch}
html.m-ui .view .card>header{flex-wrap:wrap;gap:8px}
html.m-ui .view .card>header h3{min-width:0;flex:1 1 160px}
html.m-ui .polgrid{overflow-x:auto;grid-template-columns:repeat(4,minmax(112px,1fr))!important}
html.m-ui .steps{flex-wrap:wrap}html.m-ui .steps>*{flex:1 1 140px}
html.m-ui .modal .grid{grid-template-columns:minmax(0,1fr)!important}
html.m-ui .modal .mbody>*{max-width:100%}html.m-ui input[type=file]{width:100%;max-width:100%}
html.m-ui .view .grid.g-main,html.m-ui .view .grid.g2:not(:has(>.kpi)){grid-template-columns:minmax(0,1fr)!important}
html.m-ui .view .grid>*{min-width:0}
html.m-ui .view .grid:has(>.kpi){grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px}
html.m-ui .view .card.kpi{min-width:0;padding:14px}html.m-ui .view .card.kpi .l,html.m-ui .view .card.kpi .d{overflow-wrap:anywhere}
html.m-ui .view .card{border-radius:20px}
html.m-ui .view{padding-bottom:calc(96px + env(safe-area-inset-bottom,0px))!important}
@media(prefers-reduced-motion:reduce){.mhome>*,.mh-dial .fg,.mh-bars i,.mh-chip u,.mh-lb svg,html.m-ui .tabbar a.on{animation:none!important}}
</style>`);
