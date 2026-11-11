'use strict';
/* ============ Orbit — offline check-in / check-out ============
   No signal at the site? The punch is saved on the phone with the time and GPS readings, then re-verified by the server
   (geo-fence, travel speed, GPS quality) as soon as the connection returns. Failed checks go to HR's review queue. */
Object.assign(FLAG_TEXT, { offline_punch: 'saved offline and verified later', offline_time_out_of_range: 'offline punch is too old or in the future' });
const offRecs = () => { const out = []; for (const [id, days] of Object.entries(DB.att || {})) for (const [d, r] of Object.entries(days)) { if (r?.offline?.pending) out.push([id, d, r, 'in']); if (r?.outOffline?.pending) out.push([id, d, r, 'out']); } return out; };
const offPending = () => offRecs().length;

/* ---- check-in while offline ---- */
async function offlineCheckin(opts) {
  const u = me(), T = TODAY(); if (dayStatus(u.id, T).s !== 'notin') return toast('You are already marked for today', 'err');
  const W = punchWhere(), pol = opts || punchPlan(u, W), R = DB.settings.rules ??= {}, wfh = W.mode === 'WFH', field = W.mode === 'Field';
  const needGeo = (!!pol.geo || (pol.choose && pol.methods?.includes('location'))) && !wfh && !field, needFace = !!pol.face;
  const go = async skipFace => {
    let fixes = [], note = ''; try { fixes = await getFixes(3, 12000); } catch (e) { if (needGeo) { note = e.message; } }
    const sites = wfh || field ? [] : siteGeo(W, R); let dist = null, within = null;
    if (fixes.length && sites.length) { const f = fixes.at(-1), n = sites.map(s => ({ s, d: Math.round(haversine(f, s)) })).sort((a, b) => a.d - b.d)[0]; dist = n.d; within = n.d <= n.s.radius + Math.min(+f.acc || 0, 100); }
    if (needGeo && (!fixes.length || within === false)) {
      const why = !fixes.length ? (note || 'Location is not available') : `You are ${dist} m from the work location`;
      if (pol.fallback === false) return toast(why + ' — check-in not possible', 'err');
      return modal('Can’t confirm your location offline', `<p class="muted" style="margin-top:0">${esc(why)}.</p><p class="small">You can still check in. It is saved as <b>offline · unverified</b> and HR will review it.</p>`, () => { save_(fixes, sites, dist, true, 'Offline check-in without a valid location'); }, 'Check in anyway');
    }
    save_(fixes, sites, dist, !!skipFace, skipFace ? 'Face check skipped (offline)' : '');
  };
  const save_ = (fixes, sites, dist, flagIt, why) => {
    const rec = { in: nowHM(), out: null, mode: wfh ? 'WFH' : field ? 'Field' : W.mode, site: wfh || field ? '' : W.site, methods: needGeo && fixes.length ? ['location'] : [], offline: { at: Date.now(), kind: 'in', fixes: fixes.map(f => ({ lat: f.lat, lng: f.lng, acc: f.acc, ts: f.ts })), sites, needGeo, dist, pending: true, faceSkipped: !!needFace } };
    if (flagIt) { rec.flag = 'unverified'; rec.flagWhy = why; }
    DB.att[u.id] ||= {}; DB.att[u.id][T] = rec; rows('punchlog').unshift({ id: uid('p'), emp: u.id, ts: Date.now(), ok: true, risk: 0, flags: ['offline_punch'] }); log('Offline check-in saved'); save(); netBar(); render(); toast('Saved offline — it will be verified when you are back online', 'warn');
  };
  if (needFace) return modal('Face check needs internet', `<p class="muted" style="margin-top:0">Face recognition can’t run without a connection.</p><p class="small">You can check in now using location only. HR will see that the face check was skipped and review it.</p>`, () => { go(true); }, 'Check in offline');
  return go(false);
}
{ const _a = attemptCheckin; attemptCheckin = function () { if (offNow()) return offlineCheckin(); return _a.apply(this, arguments); };
  const _s = secureCheckin; secureCheckin = function (opts) { if (offNow()) return offlineCheckin(opts); return _s.apply(this, arguments); }; }

/* ---- check-out while offline: mark it so it is re-verified later ---- */
{ const _co = ACT.checkout; ACT.checkout = function (...a) { if (offNow()) offWatchOut(); return _co.apply(this, a); }; }
function offWatchOut() { const u = me(), T = TODAY(), had = !!DB.att[u.id]?.[T]?.out, t0 = Date.now(); const iv = setInterval(() => { const r = DB.att[u.id]?.[T]; if (r?.out && !had) { clearInterval(iv); if (!r.outOffline) { r.outOffline = { at: Date.now(), pending: true, fixes: r.outGeo ? [{ lat: r.outGeo.lat, lng: r.outGeo.lng, acc: r.outGeo.acc, ts: Date.now() }] : [] }; save(); netBar(); } } else if (Date.now() - t0 > 90000) clearInterval(iv); }, 300); }

/* ---- sync when the connection returns ---- */
let offBusy = false;
async function offSync() {
  if (offBusy || offNow() || !offPending()) return; offBusy = true; let done = 0, bad = 0;
  try {
    for (const [id, d, r, kind] of offRecs()) {
      const o = kind === 'in' ? r.offline : r.outOffline, e = emp(id); if (!e) { o.pending = false; continue; }
      let v; try { v = await API.post('/api/offline-punch', { emp: id, at: o.at, fixes: o.fixes || [], sites: o.sites || (r.site ? siteGeo({ mode: r.mode, site: r.site }, DB.settings.rules || {}) : []), needGeo: !!o.needGeo, maxRisk: DB.settings.attPolicy?.maxRisk || 70, kind }); } catch { break; }
      o.pending = false; o.syncedAt = Date.now(); o.risk = v.risk; o.flags = v.flags; o.sig = v.sig; o.ok = v.ok; done++;
      const to = [...new Set([e.mgr, ...DB.employees.filter(x => x.role === 'hr' && x.status !== 'Exited').map(x => x.id)])].filter(x => x && x !== id);
      if (kind === 'in') { r.v = { ts: v.serverTs, risk: v.risk, flags: v.flags, lat: v.lat, lng: v.lng, acc: v.acc, dist: v.dist, site: v.site, sig: v.sig, offline: true }; if (!v.ok || (o.faceSkipped && !r.flag)) { bad++; r.flag = 'unverified'; r.flagWhy = (r.flagWhy ? r.flagWhy + '; ' : '') + (v.flags.filter(f => f !== 'offline_punch').map(flagText).join(', ') || 'offline punch needs review'); to.forEach(t => notify(t, `🚩 ${e.name}'s offline check-in on ${fmtShort(d)} needs review (${r.flagWhy})`)); } }
      else if (!v.ok) { bad++; r.outFlag = 'remote'; r.outRemote = { dist: v.dist ?? null, site: v.site || '', none: !(o.fixes || []).length }; r.outReason ||= 'Offline check-out failed verification'; to.forEach(t => notify(t, `🚩 ${e.name}'s offline check-out on ${fmtShort(d)} needs review`)); }
    }
  } finally { offBusy = false; }
  if (done) { log(`Synced ${done} offline punch(es)${bad ? `, ${bad} sent to HR for review` : ''}`); save(); netBar(); if (SESSION) render(); toast(bad ? `${done} synced · ${bad} sent to HR for review` : `${done} offline punch${done > 1 ? 'es' : ''} verified ✅`, bad ? 'warn' : 'ok'); }
}
addEventListener('online', () => setTimeout(offSync, 800)); setInterval(offSync, 45000); setTimeout(offSync, 4000);
