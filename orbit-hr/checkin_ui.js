'use strict';
/* ============ Orbit Realty — check-in button & result: a real fingerprint, a scanning hold animation, and a clear confirmation sheet ============ */

/* ---- procedural fingerprint: concentric loop ridges + base arches, so it looks like a print, not a doodle ---- */
function fpRidges(cx, cy, k, n = 8, arches = 2) {
  const P = (rx, ry, ccy, a) => [(cx + rx * Math.cos(a * Math.PI / 180)).toFixed(2), (ccy + ry * Math.sin(a * Math.PI / 180)).toFixed(2)], out = [];
  for (let i = 0; i < n; i++) {                       /* loop ridges: domes that open at the bottom and fan outward */
    const rx = (2.1 + i * 2.5) * k, ry = (3.3 + i * 3.4) * k, ccy = cy + i * .35 * k;
    if (i === 0) { out.push(`M${(cx - rx).toFixed(2)} ${(ccy + .4 * k).toFixed(2)}a${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 1 ${(2 * rx).toFixed(2)} 0`); continue; }
    const h = 54 - i * (n > 6 ? 2.4 : 4), s = P(rx, ry, ccy, 90 + h), e = P(rx, ry, ccy, 90 - h);
    out.push(`M${s[0]} ${s[1]}A${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 1 ${e[0]} ${e[1]}`);
  }
  for (let j = 0; j < arches; j++) {                  /* shallow arches filling the base, like real ridge flow */
    const rx = (6.4 + j * 3.4) * k, ry = (2.6 + j * 1.2) * k, ccy = cy + (11.6 + j * 3.5) * k, s = P(rx, ry, ccy, 205 + j * 5), e = P(rx, ry, ccy, 335 - j * 5);
    out.push(`M${s[0]} ${s[1]}A${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 1 ${e[0]} ${e[1]}`);
  }
  return out;
}
Object.assign(ICONS, { finger: fpRidges(12, 10.6, .92, 4, 0).join('') });
const fpBig = () => `<svg class="hfp" viewBox="11 3 42 46" aria-hidden="true">${fpRidges(32, 25, 1, 8, 2).map((d, i) => `<path class="fpr" style="--i:${i}" d="${d}"/>`).join('')}</svg>`;

/* ---- the hold button (called by clockInner) ---- */
function holdBtnHtml(kind, label, disabled) {
  const sub = disabled ? 'Not available now' : kind === 'in' ? 'Hold to confirm' : 'Hold to confirm';
  return `<button class="holdbtn ${kind}" id="holdbtn" data-kind="${kind}" ${disabled ? 'disabled' : ''} aria-label="${label} — press and hold"><svg class="hring" viewBox="0 0 160 160"><defs><linearGradient id="hgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd166"/><stop offset="1" stop-color="${kind === 'in' ? '#2dd4bf' : '#fb7185'}"/></linearGradient></defs><circle class="trk" cx="80" cy="80" r="72"/><circle class="prg" id="holdprg" cx="80" cy="80" r="72"/></svg><span class="hcore"><span class="fp">${fpBig()}<i class="scan"></i></span><b>${label}</b><small>${sub}</small></span></button>`;
}

/* ---- result sheet ---- */
const fmt12 = hm => { const [h, m] = hm.split(':').map(Number); return { t: `${h % 12 || 12}:${String(m).padStart(2, '0')}`, ap: h >= 12 ? 'PM' : 'AM' }; };
function ciSheet(kind) {
  const u = me(), T = TODAY(), r = DB.att[u.id]?.[T]; if (!r) return; document.getElementById('cires')?.remove();
  const sh = shiftOf(u, T), st = dayStatus(u.id, T).s, hr = nowDate().getHours(), nm = u.name.split(' ')[0];
  const t = fmt12(kind === 'in' ? r.in : r.out), where = r.mode === 'WFH' ? ['🏠', 'Working from home'] : r.mode === 'Field' ? ['🚗', 'Field duty'] : [r.mode === 'Office' ? '🏢' : '🏗', siteName(r.site) || r.mode || 'Office'];
  const meth = (r.methods && r.methods.length) ? r.methods : [], rows_ = [];
  let tone = 'ok', title, sub, chip;
  if (kind === 'in') {
    const diff = hm2m(r.in) - hm2m(sh.start);
    const isLate = !!r.lateBy || hm2m(r.in) > hm2m(lateLimit(u, T));
    if (isLate) { tone = 'warn'; chip = `Late by ${ciDur(Math.max(1, diff))}`; sub = 'Checked in after your grace time. Add a reason if HR asks.'; }
    else if (diff < -5) { chip = `${ciDur(-diff)} early`; sub = 'Great start to the day.'; } else { chip = 'On time'; sub = 'Right on schedule.'; }
    title = `${hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'}, ${esc(nm)}`;
    rows_.push(['📍', 'Location', `${where[1]}${r.v?.dist != null ? ` · ${r.v.dist} m from point` : ''}`], ['🕒', 'Your shift', `${esc(sh.name)} · ${sh.start}–${sh.end}`]);
    if (r.reason && r.lateBy) { sub = 'Your reason was sent to your manager and HR.'; rows_.push(['📝', 'Reason', esc(r.reason)]); }
    const left = hm2m(sh.end) - hm2m(r.in); if (left > 0) rows_.push(['⏳', 'Shift ends in', fmtHM(left)]);
    const sk = streakOf(u.id); if (sk > 1 && !isLate) rows_.push(['🔥', 'On-time streak', `${sk} days`]);
  } else {
    const worked = netMins(r), over = hm2m(r.out) - hm2m(sh.end); chip = fmtHM(worked) + ' worked';
    if (over >= 15) { chip += ` · ${ciDur(over)} overtime`; sub = 'Thanks for the extra effort today.'; } else if (over < -15) { tone = 'warn'; sub = `You left ${ciDur(-over)} before shift end.`; } else sub = 'Day complete. See you next duty.';
    title = `${hr < 17 ? 'Done for now' : 'Good evening'}, ${esc(nm)}`;
    if (r.outReason) { tone = 'warn'; chip = `${fmtHM(worked)} worked · left ${ciDur(r.earlyBy || -over)} early`; sub = 'Your reason was sent to your manager and HR. Take care.'; }
    rows_.push(['🕒', 'Checked in', fmt12(r.in).t + ' ' + fmt12(r.in).ap], ['☕', 'Breaks', fmtHM(breakMins(r))], ['📍', 'Location', where[1]]);
    if (r.outReason) rows_.push(['📝', 'Reason', esc(r.outReason)]);
    const tm = addDays(T, 1), pl = dayPlan(u, tm); rows_.push(['🗓', 'Tomorrow', pl.t === 'work' ? `${esc(pl.shift.name)} · ${pl.shift.start}–${pl.shift.end}` : pl.t === 'holiday' ? 'Holiday' : 'Weekly off']);
  }
  const ver = [...(meth.includes('location') ? ['📍 Location verified'] : []), ...(meth.includes('face') ? ['🙂 Face matched'] : []), ...(r.v?.sig ? ['🔏 Server-signed time'] : []), ...(!meth.length && kind === 'in' ? ['✓ Recorded'] : []), ...((kind === 'in' ? r.offline?.pending : r.outOffline?.pending) ? ['📴 Saved offline — verifying when you are back online'] : [])];
  const flagged = r.v?.flags?.length || r.flagged || r.outFlag === 'remote';
  const el = document.createElement('div'); el.id = 'cires'; el.className = 'cires';
  el.innerHTML = `<div class="cires-card ${tone}" role="dialog" aria-label="${kind === 'in' ? 'Checked in' : 'Checked out'}">${tone === 'ok' && kind === 'in' ? [...Array(16)].map((_, i) => `<s class="cf" style="--a:${i * 22.5}deg;--d:${60 + (i * 37) % 50}px;--c:${['#fbbf24', '#2dd4bf', '#a78bfa', '#fb7185'][i % 4]};animation-delay:${(i % 4) * 40}ms"></s>`).join('') : ''}
    <button class="icon-btn cires-x" data-x aria-label="Close">${ic('x')}</button>
    <div class="cires-ring"><svg viewBox="0 0 80 80"><circle class="rc" cx="40" cy="40" r="35"/><path class="rk" d="${kind === 'in' ? 'M24 41l11 11 21-24' : 'M26 40h28M44 28l12 12-12 12'}"/></svg></div>
    <div class="cires-k">${kind === 'in' ? 'CHECKED IN' : 'CHECKED OUT'}</div>
    <div class="cires-time"><b>${t.t}</b><small>${t.ap}</small></div>
    <div class="cires-date muted">${nowDate().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    <span class="cires-chip ${tone}">${esc(chip)}</span>
    <h3>${title}</h3><p class="muted">${esc(sub)}</p>
    <div class="cires-rows">${rows_.map(x => `<div><span>${x[0]}</span><em>${x[1]}</em><b>${x[2]}</b></div>`).join('')}</div>
    ${ver.length ? `<div class="cires-ver">${ver.map(v => `<span>${v}</span>`).join('')}</div>` : ''}
    ${flagged ? '<div class="cires-note">This punch was sent to HR for a quick review.</div>' : ''}
    <button class="btn primary big cires-ok" data-x>Done</button><i class="cires-bar"></i></div>`;
  document.body.appendChild(el); navigator.vibrate?.(kind === 'in' ? [30, 40, 30] : 40);
  const close = () => { el.classList.add('bye'); setTimeout(() => el.remove(), 260); document.removeEventListener('keydown', esc_); clearTimeout(tm); }, esc_ = e => { if (e.key === 'Escape') close(); }, tm = setTimeout(close, 9000);
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-x]')) close(); }); document.addEventListener('keydown', esc_);
}
/* ---- reasons: a late check-in and an early check-out cannot be recorded without one ---- */
const LATE_WHY = ['Traffic / road block', 'Vehicle or transport breakdown', 'Not well', 'Family emergency', 'Visited a site or client first', 'Network / GPS problem', 'Other'];
const EARLY_WHY = ['Medical emergency', 'Family emergency', 'Personal emergency', 'Not feeling well', 'Site / client work elsewhere', 'Approved by my manager', 'Other'];
let CI_REASON = null; const ciDur = m => m < 60 ? m + ' min' : fmtHM(m);
const ciRules = () => (DB.settings.rules ||= {});
function ciLateBy() { const u = me(), T = TODAY(); if (dayPlan(u, T).t !== 'work' || ciRules().lateReason === false) return 0; const m = nowMin() - hm2m(lateLimit(u, T)); return m > 0 ? m + 15 : 0; }
function ciEarlyBy() { const u = me(), T = TODAY(); if (dayPlan(u, T).t !== 'work' || ciRules().earlyReason === false) return 0; const m = hm2m(shiftOf(u, T).end) - nowMin(); return m > 5 ? m : 0; }
function ciAsk(kind, mins, go) {
  const late = kind === 'in', list = late ? LATE_WHY : EARLY_WHY, sh = shiftOf(me(), TODAY());
  modal(late ? `⏰ You are ${ciDur(mins)} late` : `🚪 Leaving ${ciDur(mins)} before shift end`, `<div class="cigate ${late ? 'late' : 'early'}"><p class="muted" style="margin:0 0 12px">${late ? `Your shift starts at <b>${sh.start}</b> and it is <b>${nowHM()}</b> now. A reason is needed before your check-in can be recorded.` : `Your shift ends at <b>${sh.end}</b> and it is <b>${nowHM()}</b>. A reason is needed before you can check out. Your manager and HR will be told.`}</p>
    <div class="cichips">${list.map((x, i) => `<label class="cichip"><input type="radio" name="cat" value="${esc(x)}" ${i === 0 ? 'checked' : ''}><span>${esc(x)}</span></label>`).join('')}</div>
    <label class="f" style="margin-top:12px">${late ? 'Tell us more' : 'What happened? (required)'}<textarea class="input" name="why" rows="3" required minlength="3" placeholder="${late ? 'e.g. Bus broke down near Silk Board' : 'e.g. Mother admitted to hospital, need to leave now'}"></textarea></label>
    ${late ? '' : '<p class="small muted" style="margin:10px 0 0">Short hours may count as a half-day or loss of pay as per company policy.</p>'}</div>`, d => {
      const txt = (d.why || '').trim(); if (txt.length < 3) { toast('Please write a short reason', 'err'); return false; }
      CI_REASON = { kind, cat: d.cat, txt, mins, ts: Date.now() }; setTimeout(go, 60);
    }, late ? 'Check in with reason' : 'Check out with reason');
}
function ciApplyReason(kind, r) {
  const x = CI_REASON; if (!x || x.kind !== kind || Date.now() - x.ts > 180000) return; CI_REASON = null; const u = me(), line = `${x.cat} — ${x.txt}`;
  if (kind === 'in') { r.reason = line; r.lateBy = x.mins; } else { r.outReason = line; if (x.mins) r.earlyBy = x.mins; if (x.remote) { r.outRemote = x.remote; r.outFlag = 'remote'; } }
  const to = new Set([u.mgr, ...DB.employees.filter(e => e.role === 'hr' && e.status !== 'Exited').map(e => e.id)].filter(id => id && id !== u.id));
  to.forEach(id => notify(id, x.remote ? `🚩 ${u.name} checked out away from work (${x.remote.dist != null ? x.remote.dist + ' m from ' + (x.remote.site || 'site') : 'location unavailable'}) — ${line}. Please review.` : kind === 'in' ? `${u.name} checked in ${ciDur(x.mins)} late — ${line}` : `${u.name} checked out ${ciDur(x.mins)} early — ${line}`));
  log(`${kind === 'in' ? 'Late check-in' : 'Early check-out'} reason (${u.name}): ${line}`); save();
}
/* watch for the punch to land (works for tap, hold, secure/face flow and fallbacks) */
function ciWatch(kind) {
  const u = me(), T = TODAY(), before = DB.att[u.id]?.[T], had = kind === 'in' ? !!before?.in : !!before?.out, t0 = Date.now();
  const iv = setInterval(() => { const r = DB.att[u.id]?.[T], ok = kind === 'in' ? (!had && r?.in) : (!had && r?.out); if (ok) { ciApplyReason(kind, r); if (document.querySelector('.modal-bg')) { if (Date.now() - t0 < 20000) return; } clearInterval(iv); setTimeout(() => ciSheet(kind), 250); } else if (Date.now() - t0 > 90000) clearInterval(iv); }, 250);
}
const ciInGate = orig => function (...a) { const go = () => { ciWatch('in'); return orig.apply(this, a); }, m = ciLateBy(); if (m && !DB.att[me().id]?.[TODAY()]?.in) return ciAsk('in', m, go); return go(); };
const ciOutGate = orig => function (...a) { const go = () => { ciWatch('out'); return orig.apply(this, a); }, m = ciEarlyBy(), pre = CI_REASON && CI_REASON.kind === 'out' && Date.now() - CI_REASON.ts < 120000; if (m && !pre) return ciAsk('out', m, go); return go(); };
ACT.checkin = ciInGate(ACT.checkin); ACT.checkout = ciOutGate(ACT.checkout);
if (ACT.secure_go) ACT.secure_go = ciInGate(ACT.secure_go);
if (ACT.verify_fallback) ACT.verify_fallback = ciInGate(ACT.verify_fallback);

document.head.insertAdjacentHTML('beforeend', `<style>
/* ===== hold button v2 ===== */
.holdbtn.holdbtn{width:196px;height:196px;padding:0;background:none;box-shadow:none;animation:none;color:#fff;--c1:var(--accent);--c2:color-mix(in srgb,var(--accent) 68%,#000);display:inline-grid;place-items:center;border-radius:50%}
.holdbtn.holdbtn.out{background:none;--c1:#ff8a5c;--c2:#c93a1e}
[data-theme=dark] .holdbtn.holdbtn{background:none;color:#1a1200;--c1:#f4cf72;--c2:#b8841f}
[data-theme=dark] .holdbtn.holdbtn.out{--c1:#ff9a76;--c2:#c93a1e;color:#2a0c04}
.holdbtn .hring{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);overflow:visible}
.holdbtn .hring .trk{fill:none;stroke:color-mix(in srgb,var(--c1) 22%,transparent);stroke-width:5}
.holdbtn .hring .prg{fill:none;stroke:url(#hgrad);stroke-width:6.5;stroke-linecap:round;stroke-dasharray:452;stroke-dashoffset:452;filter:drop-shadow(0 0 5px color-mix(in srgb,var(--c1) 70%,transparent))}
.holdbtn .hcore{position:absolute;inset:13px;border-radius:50%;display:grid;place-items:center;align-content:center;gap:1px;padding-top:4px;background:radial-gradient(circle at 32% 22%,color-mix(in srgb,var(--c1) 62%,#fff) 0,var(--c1) 46%,var(--c2) 100%);box-shadow:0 24px 46px -18px var(--c2),inset 0 2px 0 #ffffff55,inset 0 -16px 30px #0003;transition:transform .25s var(--ease),filter .25s;animation:hbreath 3.4s ease-in-out infinite}
.holdbtn .hcore::before{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 50% 0,#ffffff40,transparent 60%);pointer-events:none}
.holdbtn .fp{position:relative;display:grid;place-items:center;width:102px;height:102px;border-radius:50%;overflow:hidden;background:#ffffff1f;box-shadow:inset 0 0 0 1.5px #ffffff3d}
.holdbtn .hfp{position:static;width:78px;height:86px;transform:none;fill:none;stroke:currentColor;stroke-width:1.55;stroke-linecap:round;overflow:visible;filter:drop-shadow(0 1px 1px #0004)}
.holdbtn .fpr{stroke-opacity:.92;animation:fpglow 3s ease-in-out infinite;animation-delay:calc(var(--i)*.14s)}
.holdbtn .scan{position:absolute;left:0;right:0;bottom:0;height:26px;opacity:0;background:linear-gradient(0deg,transparent,#ffffff8c 55%,#fff);filter:blur(.4px);border-bottom:2px solid #fff}
.holdbtn b{margin-top:4px;font-size:16px;letter-spacing:.01em}.holdbtn small{font-size:10.5px;opacity:.82;letter-spacing:.04em;text-transform:uppercase}
.holdbtn::after{content:"";position:absolute;inset:6px;border-radius:50%;border:2px solid var(--c1);opacity:0;animation:echo2 2.6s ease-out infinite;pointer-events:none}
.holdbtn:hover .hcore{filter:brightness(1.06)}
.holdbtn.holding{transform:none;animation:none}.holdbtn.holding .hcore{transform:scale(.95);animation:none}.holdbtn.holding::after{animation:none}
.holdbtn.holding .fpr{animation:fplit 1s linear forwards;animation-delay:calc(var(--i)*70ms)}
.holdbtn.holding .scan{opacity:1;animation:fpscan 1s linear forwards}
.holdbtn.ok .hcore{animation:okflash .55s var(--ease)}.holdbtn.ok .fpr{stroke-opacity:1;animation:none}
.holdbtn:disabled .hcore{filter:grayscale(1) opacity(.55);animation:none}.holdbtn:disabled::after{animation:none}
@keyframes hbreath{50%{transform:translateY(-4px)}}
@keyframes fpglow{0%,100%{stroke-opacity:.78}50%{stroke-opacity:1}}
@keyframes fplit{from{stroke-opacity:.5;stroke-width:1.7}to{stroke-opacity:1;stroke-width:2.2;filter:drop-shadow(0 0 2px #fff)}}
@keyframes fpscan{from{transform:translateY(100%)}to{transform:translateY(-230%)}}
@keyframes echo2{from{transform:scale(1);opacity:.55}to{transform:scale(1.32);opacity:0}}
@keyframes okflash{40%{transform:scale(1.1);filter:brightness(1.3)}}
@media(prefers-reduced-motion:reduce){.holdbtn .hcore,.holdbtn::after,.holdbtn .fpr{animation:none!important}}

/* ===== result sheet ===== */
.cires{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:16px;background:rgba(8,16,28,.46);backdrop-filter:blur(6px);animation:cfade .25s ease both}
.cires.bye{opacity:0;transition:opacity .25s}
.cires-card{position:relative;width:min(380px,100%);max-height:calc(100vh - 32px);overflow:auto;text-align:center;padding:30px 26px 22px;border-radius:26px;background:var(--surface);border:1px solid var(--line);box-shadow:0 40px 90px -30px #000a;animation:cpop .5s var(--ease) both}
.cires-card::before{content:"";position:absolute;left:0;right:0;top:0;height:150px;background:radial-gradient(120% 100% at 50% 0,color-mix(in srgb,var(--green) 22%,transparent),transparent 72%);pointer-events:none}
.cires-card.warn::before{background:radial-gradient(120% 100% at 50% 0,color-mix(in srgb,var(--amber) 26%,transparent),transparent 72%)}
.cires-x{position:absolute;right:12px;top:12px}
.cires-ring{width:84px;height:84px;margin:0 auto 10px;position:relative}.cires-ring svg{width:100%;height:100%;overflow:visible}
.cires-ring .rc{fill:var(--green-soft);stroke:var(--green);stroke-width:3.5;stroke-dasharray:220;stroke-dashoffset:220;animation:cdraw .7s .1s var(--ease) forwards;transform:rotate(-90deg);transform-origin:center}
.cires-card.warn .rc{fill:var(--amber-soft);stroke:var(--amber)}
.cires-ring .rk{fill:none;stroke:var(--green);stroke-width:5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:60;stroke-dashoffset:60;animation:cdraw .5s .55s var(--ease) forwards}.cires-card.warn .rk{stroke:var(--amber)}
.cires-k{font-size:11.5px;letter-spacing:.18em;font-weight:800;color:var(--green)}.cires-card.warn .cires-k{color:var(--amber)}
.cires-time{display:flex;justify-content:center;align-items:flex-start;gap:6px;margin-top:4px}.cires-time b{font-size:58px;line-height:1;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums}.cires-time small{font-size:14px;font-weight:700;color:var(--muted);margin-top:9px}
.cires-date{font-size:13px;margin-top:2px}
.cires-chip{display:inline-block;margin:12px 0 6px;padding:5px 14px;border-radius:99px;font-weight:700;font-size:13px;background:var(--green-soft);color:var(--green)}.cires-chip.warn{background:var(--amber-soft);color:var(--amber)}
.cires-card h3{margin:6px 0 2px;font-size:18px}.cires-card p{margin:0 0 14px;font-size:13.5px}
.cires-rows{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:16px;overflow:hidden;text-align:left;background:var(--surface2)}
.cires-rows>div{display:grid;grid-template-columns:26px auto 1fr;gap:8px;align-items:center;padding:10px 14px;font-size:13px;border-bottom:1px solid var(--line)}.cires-rows>div:last-child{border:0}
.cires-rows em{font-style:normal;color:var(--muted)}.cires-rows b{text-align:right;font-weight:650;overflow-wrap:anywhere}
.cires-ver{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:12px}.cires-ver span{font-size:12px;padding:4px 10px;border-radius:99px;background:var(--accent-soft);color:var(--accent);font-weight:600}
.cires-note{margin-top:10px;font-size:12.5px;color:var(--amber)}
.cires-ok{margin-top:16px;width:100%}
.cires-bar{position:absolute;left:0;bottom:0;height:3px;width:100%;background:var(--accent);transform-origin:left;animation:cbar 9s linear forwards}
.cf{position:absolute;left:50%;top:76px;width:7px;height:11px;border-radius:2px;background:var(--c);opacity:0;animation:cburst 1.1s .5s cubic-bezier(.2,.8,.3,1) forwards;pointer-events:none}
@keyframes cfade{from{opacity:0}}@keyframes cpop{from{opacity:0;transform:translateY(24px) scale(.94)}}@keyframes cdraw{to{stroke-dashoffset:0}}@keyframes cbar{to{transform:scaleX(0)}}
@keyframes cburst{0%{opacity:1;transform:rotate(var(--a)) translateY(0)}100%{opacity:0;transform:rotate(var(--a)) translateY(calc(var(--d)*-1.9)) rotate(240deg)}}
</style>`);
document.head.insertAdjacentHTML('beforeend', `<style>.cichips{display:flex;flex-wrap:wrap;gap:8px}.cichip{cursor:pointer}.cichip input{position:absolute;opacity:0;pointer-events:none}.cichip span{display:inline-block;padding:7px 13px;border-radius:99px;border:1px solid var(--line);background:var(--surface);font-size:13px;transition:all .16s}.cichip:hover span{border-color:var(--accent)}.cichip input:checked+span{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}.cichip input:focus-visible+span{outline:2px solid var(--accent);outline-offset:2px}.cigate.early .cichip input:checked+span{background:var(--amber);border-color:var(--amber)}</style>`);
