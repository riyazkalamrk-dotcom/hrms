#!/usr/bin/env node
/* Copies the Orbit web app into www/ (what the Android / iOS apps bundle) and points it at your server.
   Usage: node scripts/build-www.js [--web ../path/to/orbit-hr] [--server https://hr.yourcompany.com] [--version 1.0.0] */
const fs = require('fs'), path = require('path');
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : process.env['ORBIT_' + k.toUpperCase()]; };
const root = path.resolve(__dirname, '..');
const web = path.resolve(arg('web') || (fs.existsSync(path.join(root, '..', 'index.html')) ? path.join(root, '..') : ''));
if (!web || !fs.existsSync(path.join(web, 'index.html'))) { console.error('✖ Cannot find the Orbit web app. Pass --web <folder with index.html>.'); process.exit(1); }
const server = (arg('server') || '').replace(/\/+$/, ''), version = arg('version') || require(path.join(root, 'package.json')).version || '1.0.0', out = path.join(root, 'www');
const SKIP = new Set(['server.js', 'server_cfg.js', 'server_bot.js', 'server_db.js', 'package.json', 'package-lock.json', 'data', 'node_modules', 'mobile', '.git', '.github', 'README.md']);
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
let n = 0; (function copy(src, dst) { for (const f of fs.readdirSync(src, { withFileTypes: true })) { if (SKIP.has(f.name) || /\.(out|log|md)$/.test(f.name)) continue; const s = path.join(src, f.name), d = path.join(dst, f.name); if (f.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copy(s, d); } else { fs.copyFileSync(s, d); n++; } } })(web, out);
/* bundled app has no /manifest.webmanifest or /pwa icons on its own origin */
let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8').replace(/<link rel="manifest"[^>]*>\s*/g, '').replace(/<link rel="apple-touch-icon"[^>]*>\s*/g, '');
fs.writeFileSync(path.join(out, 'index.html'), html);
let cfg = fs.readFileSync(path.join(out, 'native-config.js'), 'utf8').replace(/window\.ORBIT_NATIVE_CFG = window\.ORBIT_NATIVE_CFG \|\| \{[^}]*\};/, `window.ORBIT_NATIVE_CFG = { server: ${JSON.stringify(server)}, version: ${JSON.stringify(version)}, fcm: ${fs.existsSync(path.join(root, 'firebase', 'google-services.json'))} };`);
fs.writeFileSync(path.join(out, 'native-config.js'), cfg);
console.log(`✔ www/ ready — ${n} files from ${web}\n  server: ${server || '(asked on first launch)'}   version: ${version}`);
