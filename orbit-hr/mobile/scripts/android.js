#!/usr/bin/env node
/* Builds the Android app:  node scripts/android.js apk   → debug APK (install on any phone)
                            node scripts/android.js aab   → signed release bundle for Google Play (needs keystore.properties, see README)
   Finds your Android SDK + JDK automatically (ANDROID_HOME / JAVA_HOME / ORBIT_ANDROID_SDK / Android Studio defaults). */
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..'), android = path.join(root, 'android'), mode = process.argv[2] || 'apk', win = process.platform === 'win32';
const first = (...l) => l.filter(Boolean).find(p => fs.existsSync(p));
const sdk = first(process.env.ORBIT_ANDROID_SDK, process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, path.join(os.homedir(), 'AppData/Local/Android/Sdk'), path.join(os.homedir(), 'Library/Android/sdk'), path.join(os.homedir(), 'Android/Sdk'));
if (!sdk) { console.error('✖ Android SDK not found. Install Android Studio or set ANDROID_HOME.'); process.exit(1); }
const jdk = first(process.env.ORBIT_JAVA_HOME, process.env.JAVA_HOME, '/Applications/Android Studio.app/Contents/jbr/Contents/Home', 'C:/Program Files/Android/Android Studio/jbr');
if (!fs.existsSync(path.join(android, 'gradlew'))) { console.error('✖ No android/ project yet — run: npm run setup'); process.exit(1); }
fs.writeFileSync(path.join(android, 'local.properties'), `sdk.dir=${sdk.replace(/\\/g, '/')}\n`);
const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, ...(jdk ? { JAVA_HOME: jdk } : {}), GRADLE_OPTS: process.env.GRADLE_OPTS || '-Dorg.gradle.daemon=false -Xmx2g' };
const task = mode === 'aab' ? 'bundleRelease' : mode === 'release' ? 'assembleRelease' : 'assembleDebug';
console.log(`▶ gradle ${task}  (SDK ${sdk}${jdk ? ', JDK ' + jdk : ''})`);
const wrapper = path.join(android, win ? 'gradlew.bat' : 'gradlew'); if (!win) try { fs.chmodSync(wrapper, 0o755); } catch { }
const r = win ? spawnSync(`"${wrapper}" ${task} --no-daemon --console=plain`, { cwd: android, env, stdio: 'inherit', shell: true }) : spawnSync(wrapper, [task, '--no-daemon', '--console=plain'], { cwd: android, env, stdio: 'inherit' });
if (r.status) process.exit(r.status);
const find = (d, re) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(f => f.isDirectory() ? find(path.join(d, f.name), re) : re.test(f.name) ? [path.join(d, f.name)] : []) : [];
const outs = find(path.join(android, 'app/build/outputs'), /\.(apk|aab)$/); fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
outs.forEach(o => { const t = path.join(root, 'dist', path.basename(o)); fs.copyFileSync(o, t); console.log('✔ ' + t + `  (${(fs.statSync(t).size / 1048576).toFixed(1)} MB)`); });
