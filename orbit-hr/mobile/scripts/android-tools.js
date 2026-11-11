#!/usr/bin/env node
/* One-time helper for a computer with no Android tools: downloads JDK 21 + the Android SDK (from adoptium.net and dl.google.com)
   into a SHORT folder (Windows path-length limits break long ones), then asks YOU to accept the Android SDK licences.
   Usage: node scripts/android-tools.js [folder]     default: C:\ot (Windows) or ~/orbit-tools */
const fs = require('fs'), path = require('path'), os = require('os'), { execSync, spawnSync } = require('child_process');
if (process.argv[2] && process.argv[2].startsWith('-')) { console.log('Usage: node scripts/android-tools.js [folder]\\nInstalls JDK 21 + Android SDK (asks you to accept the licences).'); process.exit(0); }
const win = process.platform === 'win32', mac = process.platform === 'darwin';
const dir = path.resolve(process.argv[2] || (win ? 'C:\\ot' : path.join(os.homedir(), 'orbit-tools'))), sdk = path.join(dir, 'sdk'), jdk = path.join(dir, 'jdk');
fs.mkdirSync(dir, { recursive: true });
const dl = async (url, out) => { process.stdout.write('  ↓ ' + url.split('/').slice(2, 4).join('/') + ' … '); const r = await fetch(url, { redirect: 'follow' }); if (!r.ok) throw new Error('HTTP ' + r.status); fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); console.log((fs.statSync(out).size / 1048576).toFixed(0) + ' MB'); };
const unzip = (f, to) => { fs.mkdirSync(to, { recursive: true }); if (win) execSync(`powershell -NoProfile -Command "Expand-Archive -Force '${f}' '${to}'"`, { stdio: 'inherit' }); else execSync(`unzip -q -o "${f}" -d "${to}"`, { stdio: 'inherit' }); };
(async () => {
  if (!fs.existsSync(path.join(jdk, 'bin'))) {
    const os_ = win ? 'windows' : mac ? 'mac' : 'linux', arch = process.arch === 'arm64' ? 'aarch64' : 'x64', ext = win ? 'zip' : 'tar.gz', tmp = path.join(dir, 'jdk.' + ext);
    await dl(`https://api.adoptium.net/v3/binary/latest/21/ga/${os_}/${arch}/jdk/hotspot/normal/eclipse`, tmp);
    const t = path.join(dir, 'jdk-x'); fs.rmSync(t, { recursive: true, force: true }); fs.mkdirSync(t, { recursive: true });
    if (win) unzip(tmp, t); else execSync(`tar -xzf "${tmp}" -C "${t}"`);
    let inner = fs.readdirSync(t)[0]; let home = path.join(t, inner); if (mac && fs.existsSync(path.join(home, 'Contents/Home'))) home = path.join(home, 'Contents/Home'); fs.renameSync(home, jdk); fs.rmSync(t, { recursive: true, force: true }); fs.rmSync(tmp, { force: true });
  }
  console.log('✔ JDK 21 ready: ' + jdk);
  const sm = path.join(sdk, 'cmdline-tools/latest/bin', win ? 'sdkmanager.bat' : 'sdkmanager');
  if (!fs.existsSync(sm)) {
    const f = path.join(dir, 'cmdline.zip'), plat = win ? 'win' : mac ? 'mac' : 'linux'; await dl(`https://dl.google.com/android/repository/commandlinetools-${plat}-11076708_latest.zip`, f);
    const t = path.join(sdk, 'cmdline-tools'); unzip(f, t); fs.renameSync(path.join(t, 'cmdline-tools'), path.join(t, 'latest')); fs.rmSync(f, { force: true });
    if (!win) execSync(`chmod -R +x "${path.join(t, 'latest/bin')}"`);
  }
  const env = { ...process.env, JAVA_HOME: jdk, PATH: path.join(jdk, 'bin') + path.delimiter + process.env.PATH };
  console.log('\n▶ Android SDK licences — read them, then answer y to accept (this is your agreement with Google):\n');
  spawnSync(win ? `"${sm}"` : sm, [`--sdk_root=${sdk}`, '--licenses'], { stdio: 'inherit', env, shell: win });
  console.log('\n▶ Installing platform 36, build-tools and platform-tools …');
  const r = spawnSync(win ? `"${sm}"` : sm, [`--sdk_root=${sdk}`, 'platform-tools', 'platforms;android-36', 'build-tools;36.0.0'], { stdio: 'inherit', env, shell: win });
  if (r.status) { console.error('✖ SDK install failed — did you accept the licences?'); process.exit(1); }
  console.log(`\n✔ Done. Build with:\n  ${win ? 'set' : 'export'} ORBIT_ANDROID_SDK=${sdk}\n  ${win ? 'set' : 'export'} ORBIT_JAVA_HOME=${jdk}\n  npm run android:apk\n(If your path is long on Windows also set GRADLE_USER_HOME to a short folder, e.g. ${win ? 'C:\\ot\\gh' : '~/gh'}.)`);
})().catch(e => { console.error('✖ ' + e.message); process.exit(1); });
