'use strict';
/* ============ Orbit HRMS — shared database sync (see server_db.js)
   • Sign-in, first-time setup and password changes go to the server.
   • After every save the app works out what changed (syncops.js) and sends only that.
   • Every few seconds it fetches what other people changed and redraws the screen.
   • With no connection the app keeps working on its saved copy; unsent changes are stored and sent when the server is reachable. ============ */
window.SYNC_ON = true;
const SY = { on: false, tok: null, rev: 0, cid: '', base: null, pend: [], skip: new Set(), busy: false, again: false, timer: 0, offline: false, stale: false, store: localStorage };
{
  const ss = sessionStorage.getItem('orbit_tok'); SY.store = ss ? sessionStorage : localStorage; SY.tok = SY.store.getItem('orbit_tok'); SY.rev = +(SY.store.getItem('orbit_rev') || 0);
  SY.cid = sessionStorage.getItem('orbit_cid') || (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)); sessionStorage.setItem('orbit_cid', SY.cid);
  try { SY.pend = JSON.parse(localStorage.getItem('orbit_pend') || '[]'); } catch { SY.pend = []; }
  if (!SY.tok) { localStorage.removeItem('orbit_session'); sessionStorage.removeItem('orbit_session'); localStorage.removeItem(KEY); localStorage.removeItem('orbit_pend'); SY.pend = []; }
}
const syClone = o => JSON.parse(JSON.stringify(o));
async function syApi(path, body, method) {
  const r = await fetch('/api/db/' + path, { method: method || (body ? 'POST' : 'GET'), cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(SY.tok ? { 'x-orbit-token': SY.tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch { } if (!r.ok) { const e = new Error(j.error || 'Server error ' + r.status); e.status = r.status; throw e; } return j;
}
const syKeep = () => { try { SY.store.setItem('orbit_rev', String(SY.rev)); } catch { } };
const syCache = () => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch { } };
const syOpId = op => JSON.stringify(op.p) + '|' + (op.k || '');
const syPending = () => SY.base ? SY.pend.concat(SyncOps.diff(SY.base, DB)).filter(op => !SY.skip.has(syOpId(op))) : [];
const syBusyUi = () => !!document.querySelector('.modal-bg, .cires, #pgate') || (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && document.activeElement.closest('#view'));
function syRedraw() { if (!SESSION) return; if (!emp(SESSION.id) || emp(SESSION.id).status === 'Exited') return syDrop('Your account is no longer active.'); if (syBusyUi()) { SY.stale = true; return; } SY.stale = false; try { render(); } catch { } }
function sySetOffline(v) { if (SY.offline === v) return; SY.offline = v; document.documentElement.classList.toggle('sy-off', v); if (SESSION) toast(v ? 'No connection to the server — working offline. Changes will be sent when it is back.' : 'Back online — changes sent.', v ? 'err' : 'ok'); }

/* take a full copy from the server, keeping anything not sent yet */
function syAdopt(snap, rev) { const mineOps = syPending(); DB = syClone(snap); SyncOps.applyAll(DB, mineOps); SY.base = snap; SY.pend = []; SY.rev = rev; SY.on = true; syKeep(); syCache(); if (mineOps.length) syQueue(50); }
async function sySnapshot() { const j = await syApi('snapshot'); syAdopt(j.db, j.rev); sySetOffline(false); syRedraw(); }
async function syPull() {
  if (!SY.on || !SY.tok || SY.busy) return;
  try {
    const j = await syApi(`changes?since=${SY.rev}&cid=${encodeURIComponent(SY.cid)}`); sySetOffline(false);
    if (j.resync) return sySnapshot();
    if (j.ops.length) { const u = me(), was = u && (u.roleId + '|' + u.role + '|' + u.status + '|' + u.mgr); SyncOps.applyAll(DB, j.ops); SyncOps.applyAll(SY.base, syClone(j.ops)); SY.rev = j.rev; syKeep(); syCache(); const n = me(); if (n && was !== (n.roleId + '|' + n.role + '|' + n.status + '|' + n.mgr)) return sySnapshot(); syRedraw(); }
    else { SY.rev = j.rev; syKeep(); if (SY.stale) syRedraw(); }
  } catch (e) { if (e.status === 401) return syDrop('Please sign in again.'); sySetOffline(true); }
}
async function syPush() {
  if (!SY.on || !SY.tok) return; if (SY.busy) { SY.again = true; return; }
  const ops = syPending(); if (!ops.length) { localStorage.removeItem('orbit_pend'); return; }
  SY.busy = true; const snap = JSON.stringify(DB), text = JSON.stringify(ops);
  try {
    const j = await syApi('patch', { cid: SY.cid, ops }); SY.base = JSON.parse(snap); SY.pend = []; localStorage.removeItem('orbit_pend'); sySetOffline(false);
    const clean = j.was === SY.rev && !j.denied; if (clean) { SY.rev = j.rev; syKeep(); }
    if (j.denied) { (j.deniedIdx || []).forEach(i => ops[i] && SY.skip.add(syOpId(ops[i]))); SY.busy = false; await sySnapshot(); }   /* the server refused something: show the real state, never resend it */
    else if (text.includes('"pass"')) { SY.busy = false; await sySnapshot(); }                            /* drop any typed password from this device */
    else if (!clean) { SY.busy = false; await syPull(); }
  } catch (e) {
    if (e.status === 401) { SY.busy = false; return syDrop('Please sign in again.'); }
    if (e.status === 413) toast('That change is too large to save. Use a smaller photo or file.', 'err');
    else { SY.pend = ops; SY.base = JSON.parse(snap); try { localStorage.setItem('orbit_pend', text); } catch { } sySetOffline(true); }
  } finally { SY.busy = false; if (SY.again) { SY.again = false; syQueue(100); } }
}
function syQueue(ms = 400) { clearTimeout(SY.timer); SY.timer = setTimeout(syPush, ms); }
window.syncHook = () => { if (!SY.on || !SY.base) return; const ops = syPending(); try { if (ops.length) localStorage.setItem('orbit_pend', JSON.stringify(ops)); else localStorage.removeItem('orbit_pend'); } catch { } if (ops.length) syQueue(); };
setInterval(() => { if (!document.hidden && SY.on) { if (SY.offline && syPending().length) syPush(); else syPull(); } }, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && SY.on) syPull(); }); addEventListener('online', () => { if (SY.on) syPush().then(syPull); });
addEventListener('focusout', () => setTimeout(() => { if (SY.stale && !syBusyUi()) syRedraw(); }, 300));

/* ---------- sign-in / out ---------- */
function syEnter(j, remember) {
  SY.store = remember ? localStorage : sessionStorage; SY.tok = j.token; SY.store.setItem('orbit_tok', j.token); (remember ? sessionStorage : localStorage).removeItem('orbit_tok');
  SY.skip.clear(); SY.pend = []; SY.base = null; DB = syClone(j.db); SY.base = j.db; SY.rev = j.rev; SY.on = true; syKeep(); syCache(); localStorage.removeItem('orbit_pend');
  SESSION = { id: j.id }; (remember ? localStorage : sessionStorage).setItem('orbit_session', JSON.stringify(SESSION));
  briefedThisLoad = false; boot(); location.hash = landingHash(); render();
}
function syForget() { SY.on = false; SY.tok = null; SY.base = null; SY.pend = []; SY.rev = 0; clearTimeout(SY.timer);['orbit_tok', 'orbit_rev'].forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); }); localStorage.removeItem('orbit_pend'); localStorage.removeItem(KEY); }
function syDrop(msg) { syForget(); localStorage.removeItem('orbit_session'); sessionStorage.removeItem('orbit_session'); SESSION = null; document.querySelectorAll('.modal-bg, #pgate').forEach(n => n.remove()); location.hash = ''; boot(); if (msg) toast(msg, 'err'); }
{
  const _lo = logout;
  logout = function () { const t = SY.tok, go = () => { if (t) fetch('/api/db/logout', { method: 'POST', headers: { 'x-orbit-token': t } }).catch(() => { }); syForget(); _lo(); }; if (SY.on && syPending().length && !SY.offline) syPush().finally(go); else go(); };
  const _b = boot;
  boot = function () {
    if (SY.tok && !SY.on) { let c = null; try { c = JSON.parse(localStorage.getItem(KEY)); } catch { } if (c && c.v === 1) { SY.base = c; SY.on = true; } else syForget(); }
    _b();
    if (SY.on && SESSION && !SY.started) { SY.started = true; sySnapshot().catch(e => { if (e.status === 401) syDrop('Please sign in again.'); else sySetOffline(true); }); }
    if (!SESSION) SY.started = false;
  };
  const _lv = loginView;
  loginView = function () {
    document.getElementById('pgate')?.remove();
    $('#app').innerHTML = `<div class="login"><section class="login-form" style="width:100%"><div class="login-card" style="text-align:center"><div class="sy-spin"></div><p class="muted" id="syst">Connecting to the server…</p><button class="btn" id="syretry" style="display:none;margin:8px auto 0">Try again</button></div></section></div>`;
    const go = () => syApi('status').then(st => {
      if (SESSION) return;
      if (st.setup) return setupView();
      _lv(); const f = $('#lf'); if (!f) return; const nf = f.cloneNode(true); f.replaceWith(nf);
      nf.addEventListener('submit', async e => {
        e.preventDefault(); const err = $('#lerr'), btn = nf.querySelector('button.primary, button:not([type=button])'); err.textContent = ''; if (btn) btn.disabled = true;
        try { const j = await syApi('login', { email: $('#em').value.trim(), pass: $('#pw').value }); syEnter(j, !!$('#rm')?.checked); log('Signed in'); save(); }
        catch (x) { err.textContent = x.status ? x.message : 'Cannot reach the server. Check your internet connection and try again.'; if (btn) btn.disabled = false; }
      });
    }).catch(() => { const s = $('#syst'), b = $('#syretry'); if (!s) return; s.textContent = 'Cannot reach the server. Check your internet connection.'; b.style.display = ''; b.onclick = () => { s.textContent = 'Connecting to the server…'; b.style.display = 'none'; go(); }; });
    go();
  };
}
/* first-time setup creates the workspace on the server (called from live.js) */
window.syncSetup = async (d, err) => { try { const j = await syApi('setup', { company: d.company, name: d.name, title: d.title, email: d.email, phone: d.phone, dob: d.dob, pass: d.p1, color: COLORS[0], dept: rows('departments').find(x => /manage/i.test(x.title))?.title || rows('departments')[0]?.title }); syEnter(j, true); log('Created the administrator account'); save(); toast('Workspace ready. Next: Settings → company profile, Locations, then add your people.'); } catch (x) { err(x.status ? x.message : 'Cannot reach the server. Check your connection and try again.'); } };

/* ---------- passwords live on the server only ---------- */
ACT.pw_change = () => modal('Change password', `<div class="col">${fld('Current password', 'cur', '', 'password', 'required autocomplete="current-password"')}${fld('New password (8+ characters)', 'n1', '', 'password', 'required minlength="8" autocomplete="new-password"')}${fld('Confirm new password', 'n2', '', 'password', 'required autocomplete="new-password"')}</div>`, d => {
  if (d.n1 !== d.n2) { toast('New passwords do not match', 'err'); return false; } if (d.n1 === d.cur) { toast('Choose a different password', 'err'); return false; }
  syApi('password', { cur: d.cur, next: d.n1 }).then(() => { log('Changed own password'); save(); toast('Password changed. Other devices were signed out.'); }).catch(e => toast(e.message, 'err'));
}, 'Update password');
ACT.pw_reset = el => { const e = emp(el.dataset.id); if (!e || !isHR()) return; confirmBox(`Reset the password for ${e.name}? They are signed out of every device and get a new temporary password.`, () => { const pw = tempPass(); syApi('password', { emp: e.id, next: pw }).then(() => { log('Reset password for ' + e.name); save(); showTempPass(e.id, pw); }).catch(x => toast(x.message, 'err')); }); };
ACT.emp_pw = ACT.pw_reset;
{ const _pe = PAGE_FN.employees; PAGE_FN.employees = function (arg) { const h = _pe.apply(this, arguments); if (!arg || arg === me().id || !isHR() || !emp(arg) || typeof h !== 'string' || h.includes('class="card denied"')) return h; return h + `<div class="card" style="margin-top:16px"><div class="row wrap between"><div><b>Sign-in</b><div class="muted small">${esc(emp(arg).email)} · passwords are stored only on the server</div></div><button class="btn" data-act="pw_reset" data-id="${arg}">Reset password</button></div></div>`; }; }
/* erasing or replacing everything is a server job now */
ACT.reset = () => toast('Disabled while the shared database is on. To start over, stop the server and delete data/db.json (keep a backup).', 'err');
{ const _imp = CHG.imp; CHG.imp = el => { if (!can('backup') || !isAdmin()) { el.value = ''; return toast('Only an administrator can import a backup.', 'err'); } confirmBox('Import this backup into the shared database? It replaces the data for everyone.', () => _imp(el)); }; }

document.head.insertAdjacentHTML('beforeend', `<style>
.sy-spin{width:34px;height:34px;margin:0 auto 14px;border-radius:50%;border:3px solid var(--line);border-top-color:var(--accent);animation:syspin .8s linear infinite}@keyframes syspin{to{transform:rotate(360deg)}}
html.sy-off .top::after{content:"Offline";position:absolute;right:12px;bottom:-9px;font-size:10.500px;font-weight:700;padding:1px 8px;border-radius:99px;background:var(--amber-soft);color:var(--amber);z-index:2}
</style>`);
