'use strict';
/* ============ Orbit Realty — what happens at check-OUT when location is required, and when someone forgets to check out ============
   • Checked in with location → check-out is also read against the same geo-fence.
   • Inside the fence → normal. Outside / no GPS → choose: "check out from here" (reason + HR review) or "I left earlier" (time-correction request).
   • Forgot completely → the next day the app shows a banner and a one-tap correction form, HR gets it in the review queue. */

const outGeoOn = () => (DB.settings.rules ||= {}).outGeo !== false;
function outNeedsGeo(u, r) {
  if (!outGeoOn() || !r || r.manual || ['WFH', 'Field'].includes(r.mode) || !r.site) return false;
  const W = { mode: r.mode, site: r.site }, pl = punchPlan(u, W);
  return !!(pl.geo || (r.methods || []).includes('location'));
}
async function outReadPlace(u, r) {
  const b = rows('branches').find(x => x.id === r.site), R = DB.settings.rules || {}, sites = (b ? [b] : allowedSites(u)).filter(x => x.lat !== undefined && x.lat !== '');
  let fixes; try { fixes = await getFixes(2, 9000); } catch (e) { return { ok: false, why: e.message || 'Location not available', none: true, site: b?.name }; }
  const f = fixes.at(-1); let best = null;
  sites.forEach(s => { const d = Math.round(haversine(f, s)); if (!best || d < best.d) best = { d, s, rad: +s.radius || +R.radius || 200 }; });
  let flags = [], hard = false;
  try { const v = await API.post('/api/verify', { emp: u.id, clientTs: Date.now(), webdriver: !!navigator.webdriver, needGeo: true, faceRequired: false, maxRisk: DB.settings.attPolicy?.maxRisk || 70, fixes, sites: sites.map(x => ({ id: x.id, name: x.name, lat: +x.lat, lng: +x.lng, radius: +x.radius || +R.radius || 200 })) }); flags = v.flags || []; hard = !v.ok && (v.hard || []).length > 0 && !(v.hard || []).every(h => h === 'outside_geofence'); if (v.dist != null && !best) best = { d: v.dist, s: b || {}, rad: 200 }; } catch { }
  const inside = best && best.d <= best.rad + Math.min(+f.acc || 0, 50) && !hard;
  return { ok: !!inside, dist: best?.d, site: best?.s?.name || b?.name, lat: f.lat, lng: f.lng, acc: Math.round(f.acc || 0), flags, hard, rad: best?.rad };
}
const OUT_WHY = ['Forgot to check out at the office', 'Left for another site / client', 'Emergency', 'Phone location / GPS problem', 'Other'];
function outAsk(u, r, place, go) {
  const far = place.none ? 'We could not read your location' : `You are <b>${place.dist >= 1000 ? (place.dist / 1000).toFixed(1) + ' km' : place.dist + ' m'}</b> from <b>${esc(place.site || 'your work location')}</b>${place.hard ? ' and the location looks unreliable' : ''}`;
  const m = modal('📍 You are not at your work location', `<div class="cigate early"><p class="muted" style="margin:0 0 12px">${far}. You checked in with location, so check-out is also verified. You have two options:</p>
    <div class="card flat" style="margin-bottom:12px;border-color:var(--amber)"><b>1 · Check out from here</b><div class="muted small" style="margin:2px 0 10px">Recorded <b>now (${nowHM()})</b>. It is marked “away from site” and sent to HR to approve.</div>
    <div class="cichips">${OUT_WHY.map((x, i) => `<label class="cichip"><input type="radio" name="cat" value="${esc(x)}" ${i === 0 ? 'checked' : ''}><span>${esc(x)}</span></label>`).join('')}</div>
    <label class="f" style="margin-top:10px">Reason (required)<textarea class="input" name="why" rows="2" placeholder="e.g. Left office at 6:30pm and forgot to check out"></textarea></label></div>
    <div class="card flat"><b>2 · I left earlier — fix my time</b><div class="muted small" style="margin:2px 0 8px">Tell us the real time you left. Your manager/HR approves it; until then you stay checked in.</div><button type="button" class="btn sm" id="outFix">Request time correction</button></div></div>`,
    d => { const txt = (d.why || '').trim(); if (txt.length < 3) { toast('Please write the reason', 'err'); return false; } CI_REASON = { kind: 'out', cat: d.cat, txt, mins: ciEarlyBy(), ts: Date.now(), remote: { dist: place.dist ?? null, site: place.site || '', lat: place.lat, lng: place.lng, acc: place.acc, none: !!place.none } }; setTimeout(go, 60); }, 'Check out from here');
  $('#outFix', m)?.addEventListener('click', () => { m.remove(); regFix(r.date || TODAY(), r); });
}
const _coGeo = ACT.checkout;
ACT.checkout = async function (...a) {
  const u = me(), T = TODAY(), r = DB.att[u.id]?.[T], inner = () => _coGeo.apply(this, a);
  if (!r || r.out || !outNeedsGeo(u, r)) return inner();
  const t = toast; toast('Checking your location…'); const place = await outReadPlace(u, r);
  if (place.ok) { r.outGeo = { lat: place.lat, lng: place.lng, acc: place.acc, dist: place.dist, site: place.site }; save(); return inner(); }
  return outAsk(u, r, place, inner);
};

/* ---------- time-correction request for a day with a missing/wrong check-out ---------- */
function regFix(date, r) {
  const u = me(), sh = shiftOf(u, date), dflt = date === TODAY() ? nowHM() : sh.end, rec = r || DB.att[u.id]?.[date], inT = rec?.in || sh.start;
  modal(`Fix check-out — ${fmtDate(date)}`, `<p class="muted small" style="margin-top:0">Checked in at <b>${inT}</b>. Enter the time you really finished work. Your manager or HR will approve it.</p><div class="form-grid">${fld('Date', 'date', date, 'date', 'readonly', 'full')}${fld('In time', 'in', inT, 'time', 'required')}${fld('Out time', 'out', dflt, 'time', 'required')}<label class="f full">Reason<textarea class="input" name="reason" rows="2" required placeholder="e.g. Left at 6:30pm, forgot to check out"></textarea></label></div>`, d => {
    if (hm2m(d.out) <= hm2m(d.in)) { toast('Out time must be after in time', 'err'); return false; } if (date === TODAY() && hm2m(d.out) > nowMin()) { toast('Out time cannot be in the future', 'err'); return false; }
    if (DB.regs.some(x => x.emp === u.id && x.date === date && x.status === 'Pending')) { toast('You already have a pending request for this day', 'err'); return false; }
    DB.regs.unshift({ id: uid('R'), emp: u.id, date, in: d.in, out: d.out, reason: d.reason, status: 'Pending', kind: 'forgot-out' });
    [...new Set([u.mgr, ...DB.employees.filter(e => e.role === 'hr' && e.status !== 'Exited').map(e => e.id)])].filter(id => id && id !== u.id).forEach(id => notify(id, `${u.name} asked to fix check-out for ${fmtShort(date)} → ${d.out} (${d.reason})`));
    log(`Check-out correction requested for ${fmtShort(date)}`); save(); render(); toast('Sent for approval — you will be notified'); }, 'Send request');
}
ACT.reg_fix = el => regFix(el.dataset.d);

/* ---------- reminders: days with check-in but no check-out ---------- */
function missedOuts(u) {
  const T = TODAY(), out = []; for (let k = 1; k <= 7; k++) { const d = addDays(T, -k), r = DB.att[u.id]?.[d]; if (r && r.in && !r.out && !r.absent && !DB.regs.some(x => x.emp === u.id && x.date === d && x.status !== 'Rejected')) out.push([d, r]); } return out;
}
const _clkO = clockInner;
clockInner = function () {
  const html = _clkO(), u = me(), m = missedOuts(u); if (!m.length) return html;
  return `<div class="missout">${m.slice(0, 2).map(([d, r]) => `<div class="row"><span class="mo-ic">⏰</span><div style="flex:1;min-width:0"><b>You didn’t check out on ${fmtShort(d)}</b><div class="muted small">Checked in ${r.in}. Tell us when you left so your hours and pay are right.</div></div><button class="btn sm primary" data-act="reg_fix" data-d="${d}">Fix now</button></div>`).join('')}</div>` + html;
};
let _moBrief = false;
const _bootMO = boot; boot = function () { load(); if (!_moBrief && typeof briefingItems === 'function') { _moBrief = true; const _b = briefingItems; briefingItems = function () { const o = _b(), m = missedOuts(me()); if (m.length) o.splice(Math.min(1, o.length), 0, { icon: 'clockalert', title: `You forgot to check out on ${fmtShort(m[0][0])}`, sub: `Checked in ${m[0][1].in} — send the time you left`, href: '#/dashboard', label: 'Fix now' }); return o; }; } _bootMO(); };

/* ---------- approving a correction keeps the site / method info of the original punch ---------- */
{ const _ap = ACT.appr; ACT.appr = function (el) { if (el.dataset.t === 'reg' && el.dataset.v === 'Approved') { const x = DB.regs.find(i => i.id === el.dataset.id), old = x && DB.att[x.emp]?.[x.date]; if (x && old && !old.absent) { const keep = { ...old }; const r = _ap.apply(this, arguments); DB.att[x.emp][x.date] = { ...keep, in: x.in, out: x.out, corrected: true, outFlag: undefined }; save(); return r; } } return _ap.apply(this, arguments); }; }

/* ---------- HR: review check-outs made away from site ---------- */
const flaggedOut = () => scope().flatMap(e => Object.entries(DB.att[e.id] || {}).filter(([d, r]) => r.outFlag === 'remote' && d >= addDays(TODAY(), -7)).map(([d, r]) => ({ e, d, r })));
ACT.out_ok = el => { const e = emp(el.dataset.e), r = DB.att[e.id][el.dataset.d]; r.outFlag = 'reviewed'; r.outReview = { by: me().id, at: Date.now(), ok: true }; notify(e.id, `✅ Your check-out on ${fmtShort(el.dataset.d)} was accepted`); log(`Accepted away-from-site check-out of ${e.name}`); save(); render(); toast('Accepted'); };
ACT.out_no = el => modal('Reject this check-out?', `<p class="muted small" style="margin-top:0">The check-out is removed and ${esc(emp(el.dataset.e).name)} is asked to send the real time they left.</p><label class="f">Note to employee<textarea class="input" name="n" rows="2"></textarea></label>`, d => { const e = emp(el.dataset.e), dt = el.dataset.d, r = DB.att[e.id][dt]; r.out = null; r.outFlag = 'rejected'; notify(e.id, `❌ Your check-out on ${fmtShort(dt)} was not accepted${d.n ? ': ' + d.n : ''} — please request a time correction`); log(`Rejected away-from-site check-out of ${e.name}`); save(); render(); }, 'Reject');
const _sec2 = TABX.att.secure;
TABX.att.secure = () => { const f = flaggedOut(), ok = can('att.approve'); return (f.length ? `<div class="card" style="margin-bottom:16px;border-color:var(--amber)"><header><h3>📍 Check-outs made away from site</h3><span class="badge warn">${f.length}</span></header><div class="list">${f.map(({ e, d, r }) => `<div class="row">${avatar(e, 'sm')}<div style="flex:1;min-width:0"><b>${esc(e.name)}</b> · ${fmtShort(d)} out ${r.out}<div class="muted small">${r.outRemote?.none ? 'Location unavailable' : (r.outRemote?.dist ?? '?') + ' m from ' + esc(r.outRemote?.site || 'site')} · ${esc(r.outReason || '')}</div></div>${ok ? `<button class="btn sm primary" data-act="out_ok" data-e="${e.id}" data-d="${d}">Accept</button><button class="btn sm danger" data-act="out_no" data-e="${e.id}" data-d="${d}">Reject</button>` : ''}</div>`).join('')}</div></div>` : '') + _sec2(); };
const _ic5 = inboxCounts; inboxCounts = function () { const L = _ic5(); L.push(['Away-from-site check-outs', can('att.approve') ? flaggedOut().length : 0, 'attendance', 'att', 'secure', 'pin']); return L; };

document.head.insertAdjacentHTML('beforeend', `<style>.missout{margin-bottom:14px;padding:12px 14px;border-radius:16px;background:var(--amber-soft);border:1px solid color-mix(in srgb,var(--amber) 40%,transparent);display:flex;flex-direction:column;gap:10px}.missout .row{gap:12px}.mo-ic{font-size:22px}</style>`);
