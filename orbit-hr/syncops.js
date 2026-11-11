/* Orbit HRMS — change operations shared by the browser and the server.
   diff(a, b)  → list of small operations that turn a into b
   apply(db, op) → applies one operation in place
   Arrays of records are matched by record id (or by content when a record has no id), so two people adding rows
   to the same list at the same time both keep their rows. Everything else is compared field by field. */
(function (root, make) { if (typeof module === 'object' && module.exports) module.exports = make(); else root.SyncOps = make(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const BAD = new Set(['__proto__', 'constructor', 'prototype']);
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const keyOf = el => el.id !== undefined && el.id !== null && el.id !== '' ? 'i:' + el.id : 'h:' + hash(JSON.stringify(el));
  const keyed = a => a.length > 0 && a.every(isObj);
  const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

  function diff(a, b, path = [], ops = []) {
    if (isObj(a) && isObj(b)) {
      for (const k of Object.keys(a)) if (!(k in b) || b[k] === undefined) ops.push({ p: path.concat(k), d: 1 });
      for (const k of Object.keys(b)) { if (b[k] === undefined) continue; if (!(k in a) || a[k] === undefined) ops.push({ p: path.concat(k), v: b[k] }); else diff(a[k], b[k], path.concat(k), ops); }
      return ops;
    }
    if (Array.isArray(a) && Array.isArray(b) && (keyed(a) || keyed(b)) && (a.length === 0 || keyed(a)) && (b.length === 0 || keyed(b))) {
      const A = new Map(a.map(x => [keyOf(x), x])), B = new Map(); b.forEach((x, i) => { const k = keyOf(x); if (!B.has(k)) B.set(k, [x, i]); });
      for (const k of A.keys()) if (!B.has(k)) ops.push({ p: path, k, r: 1 });
      let firstOld = b.length; for (const [k, [, i]] of B) if (A.has(k)) { firstOld = i; break; }
      const head = [];   /* rows added in front of the existing ones (newest-first lists): replayed last-to-first so their order survives */
      for (const [k, [x, i]] of B) { if (!A.has(k)) { if (i < firstOld && firstOld < b.length) head.push({ p: path, k, v: x, at: 's' }); else ops.push({ p: path, k, v: x, at: 'e' }); } else if (k[0] === 'i' && !same(A.get(k), x)) ops.push({ p: path, k, v: x }); }
      for (let i = head.length - 1; i >= 0; i--) ops.push(head[i]);
      return ops;
    }
    if (!same(a, b)) ops.push({ p: path, v: b });
    return ops;
  }

  const okOp = op => op && Array.isArray(op.p) && op.p.length <= 12 && op.p.every(s => typeof s === 'string' && s.length <= 200 && !BAD.has(s)) && (op.k === undefined || (typeof op.k === 'string' && op.k.length <= 300)) && (op.p.length > 0 || op.k !== undefined);

  function apply(db, op) {
    if (!okOp(op)) return false; let n = db; const last = op.k !== undefined ? op.p.length : op.p.length - 1;
    for (let i = 0; i < last; i++) { const s = op.p[i]; if (!isObj(n[s]) && !(Array.isArray(n[s]) && i === op.p.length - 1 && op.k !== undefined)) { if (op.d || op.r) return true; n[s] = (op.k !== undefined && i === op.p.length - 1) ? [] : {}; } n = n[s]; }
    if (op.k !== undefined) {
      if (!Array.isArray(n)) return false; const i = n.findIndex(x => isObj(x) && keyOf(x) === op.k);
      if (op.r) { if (i >= 0) n.splice(i, 1); return true; }
      if (!isObj(op.v)) return false; if (i >= 0) n[i] = op.v; else if (op.at === 's') n.unshift(op.v); else n.push(op.v); return true;
    }
    const s = op.p[op.p.length - 1]; if (!isObj(n)) return false; if (op.d) delete n[s]; else n[s] = op.v; return true;
  }
  const applyAll = (db, ops) => { for (const op of ops) apply(db, op); return db; };
  return { diff, apply, applyAll, keyOf, okOp, isObj };
});
