#!/usr/bin/env node
/* One command that turns the Orbit web app into native Android + iOS projects.
     npm run setup -- --name "Skyline HR" --id com.skyline.hr --server https://hr.skyline.com --web ../orbit-hr
   Re-run it any time you change the web app, branding or server address. */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : (process.env['ORBIT_' + k.toUpperCase()] || d); };
const root = path.resolve(__dirname, '..'), run = (c, o = {}) => execSync(c, { stdio: 'inherit', cwd: root, env: { ...process.env, ...(o.env || {}) } });
const cfgFile = path.join(root, 'capacitor.config.json'); const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const name = arg('name', cfg.appName), id = arg('id', cfg.appId), server = (arg('server', '') || '').replace(/\/+$/, ''), color = arg('color', cfg.android.backgroundColor), web = arg('web', ''), only = arg('only', '');
if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(id)) { console.error('✖ App id must look like com.company.hr'); process.exit(1); }
cfg.appName = name; cfg.appId = id; cfg.android.backgroundColor = color; cfg.ios.backgroundColor = color; cfg.plugins.SplashScreen.backgroundColor = color; cfg.plugins.StatusBar.backgroundColor = color; cfg.plugins.LocalNotifications.iconColor = color;
const clear = /^http:\/\//i.test(server); cfg.server.cleartext = clear; cfg.android.allowMixedContent = clear; fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2) + '\n');
console.log(`\n▶ ${name} (${id})  server: ${server || '(asked on first launch)'}${clear ? '  ⚠ http:// — development only, use https:// for real users' : ''}\n`);
/* Firebase app file uploaded in the admin panel (Notifications → Firebase) — fetched first so this build switches Android push on */
{ const fb = arg('iconserver', server); try { run('node scripts/firebase-fetch.js' + (fb ? ' --server "' + fb + '"' : '') + (arg('adminkey', '') ? ' --adminkey "' + arg('adminkey', '') + '"' : '')); } catch { } }
run(`node scripts/build-www.js ${web ? `--web "${web}"` : ''} --server "${server}"`);
const hasA = fs.existsSync(path.join(root, 'android')), hasI = fs.existsSync(path.join(root, 'ios'));
if (only !== 'ios' && !hasA) run('npx cap add android');
if (only !== 'android' && !hasI) { try { run('npx cap add ios'); } catch { console.log('ℹ Could not add iOS on this computer (needs a Mac). Run `npm run setup` on a Mac, or let the GitHub workflow do it.'); } }
const iconServer = arg('iconserver', server); try { run('node scripts/icons.js ' + (iconServer ? `--server "${iconServer}"` : '')); } catch { console.log('ℹ Icon generation skipped (server not reachable) — default icons stay. Re-run once your server is up.'); }
const env = { ORBIT_CLEARTEXT: clear ? '1' : '0' };
run('node scripts/patch-native.js', { env });
try { run('npx cap sync' + (only ? ' ' + only : '')); } catch (e) { console.log('ℹ cap sync reported a problem (iOS pods need a Mac) — Android is unaffected.'); }
run('node scripts/patch-native.js', { env });
console.log(`\n✔ Done.\n  Android debug APK : npm run android:apk\n  Android Play AAB  : npm run android:aab  (after step 4 in README)\n  iOS               : on a Mac → npm run ios:open  (or use the GitHub workflow)\n`);
