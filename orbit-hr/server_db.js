'use strict';
/* Orbit HRMS — shared database. One copy of all employee data lives in data/db.json; every phone and browser syncs with it.
   • Sign-in is checked here. Passwords are stored only as salted scrypt hashes in data/auth.json and never sent to any device.
   • Devices send small change operations (see syncops.js); the server checks each one against the sender's role, applies it,
     and other devices pick the changes up within a few seconds.
   • Each device receives only what its user may see: staff do not receive other people's salary, bank, documents,
     face templates, tickets, claims or disciplinary records. */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), Ops = require('./syncops.js');

module.exports = function (DATA, json) {
  const F = n => path.join(DATA, n), bkDir = F('backups'); fs.mkdirSync(bkDir, { recursive: true });
  const read = (n, d) => { try { return JSON.parse(fs.readFileSync(F(n), 'utf8')); } catch { return d; } };
  let M = read('db.json', { rev: 0, db: null }), AUTH = read('auth.json', {}), SESS = read('sessions.json', {}); const LOG = [], FAILS = new Map();
  const clone = o => JSON.parse(JSON.stringify(o)), now = () => Date.now(), today = () => new Date().toISOString().slice(0, 10);

  /* ---------- storage: atomic writes, one backup per day (14 kept) ---------- */
  let dirtyDb = false, dirtyAux = false, lastBk = '';
  const writeSafe = (n, obj) => { const tmp = F(n + '.tmp'); fs.writeFileSync(tmp, JSON.stringify(obj)); fs.renameSync(tmp, F(n)); };
  function flush() {
    try {
      if (dirtyDb) { dirtyDb = false; const d = today(); if (d !== lastBk && fs.existsSync(F('db.json'))) { lastBk = d; const b = path.join(bkDir, `db-${d}.json`); if (!fs.existsSync(b)) fs.copyFileSync(F('db.json'), b); fs.readdirSync(bkDir).filter(x => /^db-\d{4}-\d\d-\d\d\.json$/.test(x)).sort().slice(0, -14).forEach(x => fs.unlinkSync(path.join(bkDir, x))); } writeSafe('db.json', M); }
      if (dirtyAux) { dirtyAux = false; for (const t of Object.keys(SESS)) if (SESS[t].exp < now()) delete SESS[t]; writeSafe('auth.json', AUTH); writeSafe('sessions.json', SESS); }
    } catch (e) { console.log('DB save failed:', e.message); }
  }
  setInterval(flush, 1500).unref(); process.on('exit', flush); ['SIGINT', 'SIGTERM'].forEach(s => process.on(s, () => { flush(); process.exit(0); }));

  /* ---------- passwords + sessions ---------- */
  const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, hash: crypto.scryptSync(String(pw), salt, 32).toString('hex') });
  const checkPw = (id, pw) => { const a = AUTH[id]; if (!a) return false; const h = crypto.scryptSync(String(pw), a.salt, 32); return crypto.timingSafeEqual(h, Buffer.from(a.hash, 'hex')); };
  const setPw = (id, pw) => { if (typeof pw !== 'string' || pw.length < 6 || pw.length > 200) return false; AUTH[id] = hashPw(pw); dirtyAux = true; return true; };
  const newSession = id => { const t = crypto.randomBytes(32).toString('hex'); SESS[t] = { id, exp: now() + 30 * 864e5 }; dirtyAux = true; return t; };
  const emps = () => M.db?.employees || [], empBy = id => emps().find(e => e.id === id);
  function who(req) { const t = req.headers['x-orbit-token'], s = t && SESS[t]; if (!s || s.exp < now()) return null; const e = empBy(s.id); if (!e || e.status === 'Exited') return null; return ctxOf(e); }
  function ctxOf(e) {
    const roles = M.db.roles, r = roles?.find(x => x.id === e.roleId); let priv = e.role === 'admin' || e.role === 'hr';
    if (r) { const set = new Set(r.perms || []); (e.permsAdd || []).forEach(p => set.add(p)); (e.permsDel || []).forEach(p => set.delete(p)); priv = !!r.all || set.has('hr.panel'); }
    return { id: e.id, priv, reports: new Set(emps().filter(x => x.mgr === e.id).map(x => x.id)) };
  }
  const readBody = (req, max = 6e6) => new Promise(r => { let s = '', big = false; req.on('data', c => { if (big) return; s += c; if (s.length > max) { big = true; s = ''; } }); req.on('end', () => { if (big) return r(null); try { r(JSON.parse(s || '{}')); } catch { r({}); } }); req.on('error', () => r(null)); });

  /* ---------- what each person may see ---------- */
  const SENS = ['salary', 'bankInfo', 'bank', 'emergency', 'address', 'religion', 'marital', 'blood', 'contract', 'payType', 'permsAdd', 'permsDel'];
  const OWN_LISTS = new Set(['tickets', 'claims', 'regs', 'goals', 'reviews', 'letters']), OWN_ENT = new Set(['loans', 'advances', 'promotions', 'resignations', 'terminations', 'warnings', 'complaints', 'docreq', 'appointments', 'evals', 'sticky', 'punchlog']);
  const OWN_MAPS = new Set(['docs', 'faces', 'prefs', 'kycConsent', 'consents']), PRIV_ONLY = new Set(['retention', 'audit', 'policyLog']), MGR_LISTS = new Set(['cands']);
  const mine = (it, c) => [it.emp, it.by, it.against, it.with, it.to, it.from, it.owner].includes(c.id) || c.reports.has(it.emp);
  function seeItem(top, it, c, ent) {
    if (!Ops.isObj(it)) return it;
    if (top === 'employees' && !ent) { const { pass, ...e } = it; if (!c.priv && e.id !== c.id) SENS.forEach(k => delete e[k]); return e; }
    if (c.priv) return it;
    if (ent ? OWN_ENT.has(top) : OWN_LISTS.has(top)) return mine(it, c) ? it : null;
    if (!ent && top === 'notes') return it.to === c.id ? it : null;
    if (!ent && MGR_LISTS.has(top)) return c.reports.size ? it : null;
    if (!ent && top === 'leaves') return mine(it, c) ? it : { id: it.id, emp: it.emp, type: it.type, from: it.from, to: it.to, days: it.days, status: it.status };
    return it;
  }
  const seeEmpKey = (top, id, c) => top === 'att' ? (c.priv || id === c.id || c.reports.has(id)) : top === 'faces' ? id === c.id : (c.priv || id === c.id);
  function seeSection(top, v, c) {
    if (PRIV_ONLY.has(top) && !c.priv) return Array.isArray(v) ? [] : {};
    if (Array.isArray(v)) return v.map(x => seeItem(top, x, c, false)).filter(x => x !== null);
    if (Ops.isObj(v)) {
      if (top === 'att' || OWN_MAPS.has(top)) return Object.fromEntries(Object.entries(v).filter(([id]) => seeEmpKey(top, id, c)));
      if (top === 'payAdj' && !c.priv) return Object.fromEntries(Object.entries(v).map(([ym, m]) => [ym, Ops.isObj(m) ? Object.fromEntries(Object.entries(m).filter(([id]) => id === c.id)) : m]));
      if (top === 'ent') return Object.fromEntries(Object.entries(v).map(([n, a]) => [n, Array.isArray(a) ? a.map(x => seeItem(n, x, c, true)).filter(x => x !== null) : a]));
    }
    return v;
  }
  const view = c => Object.fromEntries(Object.entries(M.db).map(([k, v]) => [k, seeSection(k, v, c)]));
  /* the same rules, applied to one change operation before it is sent to another device */
  function seeOp(op, c) {
    const top = op.p[0], ent = top === 'ent';
    if (PRIV_ONLY.has(top) && !c.priv) return null;
    if (op.k !== undefined) { if (op.r) return op; const name = ent ? op.p[1] : top; if (op.p.length !== (ent ? 2 : 1)) return c.priv || !(top === 'att' || OWN_MAPS.has(top)) || seeEmpKey(top, op.p[1], c) ? op : null; const v = seeItem(name, op.v, c, ent); return v === null ? null : { ...op, v }; }
    if (op.p.length === 1) return op.d ? op : { ...op, v: seeSection(top, op.v, c) };
    if (top === 'att' || OWN_MAPS.has(top)) return seeEmpKey(top, op.p[1], c) ? op : null;
    if (top === 'payAdj' && !c.priv) return op.p.length >= 3 ? (op.p[2] === c.id ? op : null) : (op.d ? op : { ...op, v: Ops.isObj(op.v) ? Object.fromEntries(Object.entries(op.v).filter(([id]) => id === c.id)) : op.v });
    if (ent && op.p.length === 2 && !op.d && Array.isArray(op.v)) return { ...op, v: op.v.map(x => seeItem(op.p[1], x, c, true)).filter(x => x !== null) };
    return op;
  }

  /* ---------- what each person may change ---------- */
  const PROTECTED = ['id', 'role', 'roleId', 'permsAdd', 'permsDel', 'salary', 'status', 'mgr', 'dept', 'title', 'joined', 'exit', 'branch', 'email'];
  const DENY_TOP = new Set(['settings', 'payruns', 'policies', 'company', 'roles', 'permKnown', 'payAdj', 'letterTpl', 'letterSeq', 'letters', 'retention', 'rosterPub', 'v', 'rosterV', 'kycV', '_pv']);
  const DENY_ENT = new Set(['branches', 'shifts', 'departments', 'designations', 'allowances', 'deductions', 'taxslabs', 'pfslabs', 'tardyrules', 'evalq', 'promotions', 'terminations', 'warnings', 'awards', 'assethist']);
  const FREE_EMP = new Set(['tasks', 'visits', 'meetings', 'kudos', 'notes', 'swaps', 'appointments', 'complaints']), DECIDED = new Set(['Approved', 'Verified', 'Paid', 'Disbursed', 'Closed']);
  const ROLE_ID = { admin: 'R-ADMIN', hr: 'R-HR', manager: 'R-MGR', employee: 'R-STAFF' };
  const listAt = p => { let n = M.db; for (const s of p) { n = n?.[s]; } return Array.isArray(n) ? n : null; };
  /* returns the operations to apply (possibly rewritten), or [] when the sender is not allowed */
  function allow(op, c) {
    const top = op.p[0], ent = top === 'ent';
    if (top === 'employees') {
      if (op.k === undefined || op.p.length !== 1) return c.priv && op.p.length === 1 && Array.isArray(op.v) ? [{ ...op, v: op.v.map(e => { if (Ops.isObj(e) && e.pass !== undefined) { if (e.id) setPw(e.id, e.pass); const { pass, ...x } = e; return x; } return e; }) }] : [];
      const id = op.k.slice(2), cur = empBy(id);
      if (op.r) return c.priv && id !== c.id ? [op] : [];
      if (!Ops.isObj(op.v) || op.v.id !== id) return [];
      const { pass, ...v } = op.v; if (pass !== undefined && (c.priv || id === c.id)) setPw(id, pass);
      if (c.priv) { if (!v.roleId) v.roleId = cur?.roleId || ROLE_ID[v.role] || 'R-STAFF'; return [{ ...op, v }]; }
      if (id !== c.id || !cur) return [];
      const out = { ...cur }; for (const k of Object.keys(cur)) if (!(k in v) && !PROTECTED.includes(k)) delete out[k]; for (const k of Object.keys(v)) if (!PROTECTED.includes(k)) out[k] = v[k];
      return [{ ...op, v: out }];
    }
    if (c.priv) return [op];
    if (DENY_TOP.has(top) || (ent && DENY_ENT.has(op.p[1]))) return [];
    if (top === 'roster') return c.reports.size ? [op] : [];
    if (top === 'att' || OWN_MAPS.has(top)) {
      const ok = id => top === 'att' ? (id === c.id || c.reports.has(id)) : id === c.id;
      if (op.p.length >= 2) return ok(op.p[1]) ? [op] : [];
      return op.d || !Ops.isObj(op.v) ? [] : Object.keys(op.v).filter(ok).map(id => ({ p: [top, id], v: op.v[id] }));   /* first write of the whole map: keep only the sender's own part */
    }
    if (top === 'policyAck' || top === 'policyOpen') return op.p.length >= 3 ? (op.p[2] === c.id ? [op] : []) : (op.d ? [] : [op]);
    if (op.k !== undefined) {
      const list = listAt(op.p), cur = list?.find(x => Ops.isObj(x) && Ops.keyOf(x) === op.k), name = ent ? op.p[1] : top, it = op.r ? cur : op.v;
      if (op.r && !cur) return [op];
      if (Ops.isObj(it) && typeof it.emp === 'string' && !FREE_EMP.has(name)) {
        const own = it.emp === c.id, team = c.reports.has(it.emp);
        if (!own && !team) return [];
        if (own && !team && !op.r && DECIDED.has(it.status) && cur?.status !== it.status) return [];   /* nobody approves their own request */
        if (cur && cur.emp !== it.emp) return [];
      }
      return [op];
    }
    if (op.p.length === 1 && (OWN_LISTS.has(top) || top === 'leaves' || top === 'notes' || PRIV_ONLY.has(top) || MGR_LISTS.has(top)) && Array.isArray(M.db[top]) && M.db[top].length) return [];   /* never replace a whole shared list */
    return [op];
  }

  function commit(ops, cid) { if (!ops.length) return; M.rev++; LOG.push({ rev: M.rev, cid, ops }); if (LOG.length > 4000) LOG.splice(0, LOG.length - 4000); dirtyDb = true; }
  const emptyDb = () => ({ v: 1, company: '', employees: [], att: {}, leaves: [], regs: [], claims: [], jobs: [], cands: [], goals: [], reviews: [], kudos: [], tickets: [], news: [], tasks: [], notes: [], audit: [], acks: {}, payruns: {}, faces: {}, settings: { quota: { CL: 12, SL: 10, EL: 15, CO: 2 }, shiftStart: '09:30', lateAfter: '09:45' } });
  const session = (e, extra = {}) => { const c = ctxOf(e); return { token: newSession(e.id), id: e.id, rev: M.rev, db: view(c), ...extra }; };
  const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  async function handle(req, res, u, p) {
    if (!p.startsWith('/api/db/')) return false; const act = p.slice(8), POST = req.method === 'POST', GET = req.method === 'GET';
    if (act === 'status' && GET) return json(res, 200, { ready: true, setup: !emps().length, rev: M.rev }), true;

    if (act === 'setup' && POST) {
      if (emps().length) return json(res, 409, { error: 'This workspace is already set up. Sign in instead.' }), true;
      const b = await readBody(req, 2e5) || {}, s = (v, n) => String(v ?? '').trim().slice(0, n), email = s(b.email, 120).toLowerCase(), name = s(b.name, 80).replace(/\s+/g, ' ');
      if (name.length < 3 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || typeof b.pass !== 'string' || b.pass.length < 8) return json(res, 400, { error: 'Enter your name, a valid email and a password of 8 or more characters.' }), true;
      M = { rev: 1, db: emptyDb() }; M.db.company = s(b.company, 80); M.db.audit.push({ ts: now(), who: 'System', msg: 'Workspace created' });
      const e = { id: 'E001', name, email, role: 'admin', roleId: 'R-ADMIN', title: s(b.title, 60) || 'Administrator', dept: s(b.dept, 60) || 'Management', mgr: null, salary: 0, joined: today(), dob: /^\d{4}-\d\d-\d\d$/.test(b.dob) ? b.dob : '', gender: '', phone: s(b.phone, 20), loc: '', status: 'Active', exit: null, skills: [], color: s(b.color, 20) || '#0f766e', emergency: '', branch: 'B1' };
      M.db.employees.push(e); M.db.att.E001 = {}; setPw('E001', b.pass); LOG.length = 0; dirtyDb = true; flush();
      return json(res, 200, session(e)), true;
    }
    if (act === 'login' && POST) {
      const b = await readBody(req, 2e4) || {}, email = String(b.email || '').trim().toLowerCase(), key = email + '|' + ipOf(req), f = FAILS.get(key);
      if (f && f.until > now()) return json(res, 429, { error: `Too many attempts. Try again in ${Math.ceil((f.until - now()) / 1000)} seconds.` }), true;
      const e = emps().find(x => String(x.email).toLowerCase() === email);
      if (!e || e.status === 'Exited' || !checkPw(e.id, b.pass)) { const n = (f?.n || 0) + 1; FAILS.set(key, n >= 5 ? { n: 0, until: now() + 60000 } : { n, until: 0 }); if (FAILS.size > 5000) FAILS.clear(); return json(res, 401, { error: 'Incorrect email or password.' }), true; }
      FAILS.delete(key); return json(res, 200, session(e)), true;
    }
    const c = who(req); if (!c) return json(res, 401, { error: 'Please sign in again.' }), true;
    if (act === 'logout' && POST) { delete SESS[req.headers['x-orbit-token']]; dirtyAux = true; return json(res, 200, { ok: true }), true; }
    if (act === 'snapshot' && GET) return json(res, 200, { id: c.id, rev: M.rev, db: view(c) }), true;
    if (act === 'changes' && GET) {
      const since = +u.searchParams.get('since'), cid = u.searchParams.get('cid') || '';
      if (since === M.rev) return json(res, 200, { rev: M.rev, ops: [] }), true;
      if (!(since < M.rev) || !LOG.length || LOG[0].rev > since + 1) return json(res, 200, { resync: true, rev: M.rev }), true;
      const ops = []; for (const e of LOG) if (e.rev > since && e.cid !== cid) for (const op of e.ops) { const o = seeOp(op, c); if (o) ops.push(o); }
      return json(res, 200, { rev: M.rev, ops }), true;
    }
    if (act === 'patch' && POST) {
      const b = await readBody(req); if (!b) return json(res, 413, { error: 'Too much data in one save.' }), true; if (!Array.isArray(b.ops) || b.ops.length > 5000) return json(res, 400, { error: 'bad request' }), true;
      const done = [], deniedIdx = []; let before = M.rev;
      b.ops.forEach((op, i) => { if (!Ops.okOp(op)) return deniedIdx.push(i); const list = allow(op, c); if (!list.length) return deniedIdx.push(i); for (const o of list) if (Ops.apply(M.db, o)) done.push(o); });
      const denied = deniedIdx.length;
      commit(done, String(b.cid || '').slice(0, 40));
      return json(res, 200, { rev: M.rev, was: before, applied: done.length, denied, deniedIdx: deniedIdx.slice(0, 500) }), true;
    }
    if (act === 'password' && POST) {
      const b = await readBody(req, 2e4) || {}, target = b.emp && b.emp !== c.id ? String(b.emp) : c.id;
      if (target !== c.id) { if (!c.priv || !empBy(target)) return json(res, 403, { error: 'Only HR or an administrator can reset another person’s password.' }), true; }
      else if (!checkPw(c.id, b.cur)) return json(res, 400, { error: 'Current password is incorrect.' }), true;
      if (typeof b.next !== 'string' || b.next.length < 8) return json(res, 400, { error: 'Use at least 8 characters for the new password.' }), true;
      setPw(target, b.next); if (target === c.id) { const keep = req.headers['x-orbit-token']; for (const t of Object.keys(SESS)) if (SESS[t].id === c.id && t !== keep) delete SESS[t]; } else for (const t of Object.keys(SESS)) if (SESS[t].id === target) delete SESS[t];
      dirtyAux = true; return json(res, 200, { ok: true }), true;
    }
    return json(res, 404, { error: 'not found' }), true;
  }
  const people = () => emps().map(e => ({ id: e.id, name: e.name, role: e.role, dept: e.dept, branch: e.branch, status: e.status, mgr: e.mgr }));
  /* in-app notifications written by the server (broadcasts) */
  function note(ids, msg) { if (!M.db) return; const ops = ids.map((id, i) => ({ p: ['notes'], k: 'i:s' + Date.now().toString(36) + i, v: { id: 's' + Date.now().toString(36) + i, to: id, msg: String(msg).slice(0, 400), ts: Date.now(), read: false }, at: 's' })); const done = ops.filter(o => Ops.apply(M.db, o)); commit(done, 'server'); }
  return { handle, flush, who, people, note };
};
