'use strict';
/* ============ Orbit HRMS — live mode: no demo people or records. A new install starts empty and the first person
   to open it creates the administrator account. Loaded after every feature file and before the app boots. ============ */

/* one-time: clear the old demo workspace from this device (kept once as a backup, in case real entries were made in it) */
try {
  if (!localStorage.getItem('orbit_live_v1')) {
    const old = localStorage.getItem(KEY); if (old) { try { localStorage.setItem('orbit_demo_backup', old); } catch { } }
    [KEY, 'orbit_session', 'orbit_demo_off', 'orbit_lock'].forEach(k => localStorage.removeItem(k)); sessionStorage.removeItem('orbit_session');
    Object.keys(localStorage).filter(k => k.startsWith('rem:') || k.startsWith('orbit_lastsite_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('orbit_live_v1', String(Date.now()));
  }
} catch { }
DEMO.off = 0;

/* an empty workspace instead of the sample company */
seed = function () {
  return { v: 1, company: '', employees: [], att: {}, leaves: [], regs: [], claims: [], jobs: [], cands: [], goals: [], reviews: [], kudos: [], tickets: [], news: [], tasks: [], notes: [], audit: [{ ts: Date.now(), who: 'System', msg: 'Workspace created' }], acks: {}, payruns: {}, faces: {},
    settings: { quota: { CL: 12, SL: 10, EL: 15, CO: 2 }, shiftStart: '09:30', lateAfter: '09:45' } };
};
/* starter lists: one location to rename, no sample people-linked records */
Object.assign(SEEDS, { branches: [{ id: 'B1', name: 'Head Office', addr: '', type: 'office', status: 'Active' }], loans: [], advances: [], promotions: [], resignations: [], terminations: [], warnings: [], complaints: [], awards: [], assets: [], assethist: [], meetings: [], appointments: [], docreq: [], visits: [], evals: [], sticky: [] });

/* first-time setup: shown instead of sign-in while there are no accounts on this device */
function setupView() {
  $('#app').innerHTML = `<div class="login"><section class="login-form" style="width:100%"><div class="login-card" style="max-width:460px">
   <div class="ml-brand" style="display:flex">${typeof brandMark === 'function' ? brandMark() : ''}<b>${esc(BR.name)}</b><span>${esc(BR.product || '')}</span></div>
   <h2>Set up your workspace</h2><p class="muted" style="margin:0 0 20px">This device has no accounts yet. Create the administrator account — you can add HR, managers and employees after signing in.</p>
   <form id="sf" class="col" style="gap:14px" autocomplete="on">
    <label class="f">Company name<input class="input" name="company" required maxlength="80" value="${esc(CO.legal || BR.name || '')}"></label>
    <label class="f">Your full name<input class="input" name="name" required maxlength="80" autocomplete="name" placeholder="First and last name"></label>
    <label class="f">Your job title<input class="input" name="title" required maxlength="60" value="Administrator"></label>
    <label class="f">Work email<input class="input" name="email" type="email" required autocomplete="username" placeholder="you@company.com"></label>
    <label class="f">Mobile number<input class="input" name="phone" type="tel" required maxlength="20" autocomplete="tel" placeholder="+91 98765 43210"></label>
    <label class="f">Date of birth<input class="input" name="dob" type="date" required max="${TODAY()}"></label>
    <label class="f">Password (8 or more characters)<input class="input" name="p1" type="password" required minlength="8" autocomplete="new-password"></label>
    <label class="f">Confirm password<input class="input" name="p2" type="password" required minlength="8" autocomplete="new-password"></label>
    <div id="serr" class="small" style="color:var(--red);min-height:18px"></div>
    <button class="btn primary" style="justify-content:center;padding:11px">Create administrator account</button>
   </form><p class="small muted" style="margin-top:16px">Already set up on another device? Employee records are stored per device for now — see the setup guide before rolling out to staff.</p></div></section></div>`;
  $('#sf').addEventListener('submit', e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)), err = t => { $('#serr').textContent = t; };
    const name = d.name.trim().replace(/\s+/g, ' '); if (name.length < 3) return err('Enter your full name.'); if (d.p1 !== d.p2) return err('The two passwords do not match.'); if (d.p1.length < 8) return err('Use at least 8 characters for the password.');
    if (DB.employees.length) return loginView();
    const depts = rows('departments'), dept = depts.find(x => /manage/i.test(x.title))?.title || depts[0]?.title || 'Management';
    DB.company = d.company.trim(); DB.employees.push({ id: 'E001', name, email: d.email.trim().toLowerCase(), pass: d.p1, role: 'admin', title: d.title.trim() || 'Administrator', dept, mgr: null, salary: 0, joined: TODAY(), dob: d.dob, gender: '', phone: d.phone.trim(), loc: '', status: 'Active', exit: null, skills: [], color: COLORS[0], emergency: '', branch: 'B1' });
    DB.att.E001 = {}; SESSION = { id: 'E001' }; localStorage.setItem('orbit_session', JSON.stringify(SESSION)); log('Created the administrator account'); save(); briefedThisLoad = false; boot(); location.hash = '#/dashboard'; render();
    toast('Workspace ready. Next: Settings → company profile, Locations, then add your people.');
  });
}
{ const _lv = loginView; loginView = function () { if (DB && !DB.employees.length) return setupView(); return _lv(); }; }
