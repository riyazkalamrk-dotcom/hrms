#!/usr/bin/env node
/* Fetches the Firebase Android app file that an admin uploaded in the HRMS (Notifications → Firebase) and puts it where the
   Android build expects it, so nobody has to copy google-services.json by hand.
   Usage: node scripts/firebase-fetch.js --server https://hr.yourcompany.com [--adminkey <key from data/admin.key>]
   The admin key can also come from ORBIT_ADMINKEY. A server on this same machine needs no key. */
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : (process.env['ORBIT_' + k.toUpperCase()] || d); };
const server = String(arg('server', '') || '').replace(/\/+$/, ''), key = arg('adminkey', ''), out = path.join(root, 'firebase', 'google-services.json');
(async () => {
  if (!server) return console.log('ℹ Firebase: no server address given — keeping firebase/google-services.json as it is.');
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(server + '/api/notif/firebase/google-services.json', { headers: key ? { 'x-admin-key': key } : {}, signal: ctl.signal }); clearTimeout(t);
    if (r.status === 404) return console.log('ℹ Firebase: nothing uploaded in the admin panel yet (Notifications → Firebase). Android push stays off in this build.');
    if (r.status === 401) return console.log('ℹ Firebase: the server needs the admin key. Add  --adminkey <contents of data/admin.key>  to fetch the Firebase file.');
    if (!r.ok) return console.log('ℹ Firebase: server answered ' + r.status + ' — keeping the existing file.');
    const j = await r.json(); if (!j.project_info?.project_id) return console.log('ℹ Firebase: the server sent an unexpected file — ignored.');
    fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(j, null, 2));
    console.log(`✔ Firebase: google-services.json fetched from the admin panel (project ${j.project_info.project_id})`);
  } catch (e) { console.log('ℹ Firebase: could not reach the server (' + (e.name === 'AbortError' ? 'timed out' : e.message) + ') — keeping the existing file.'); }
})();
