#!/usr/bin/env node
/* Adds every permission, usage text, background mode, notification icon and push entitlement to the generated Android / iOS projects.
   Safe to run again and again (idempotent). Run automatically by `npm run setup`. */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), cfg = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
const brand = cfg.appName || 'Orbit HRMS';

/* ---------------- Android ---------------- */
const man = path.join(root, 'android/app/src/main/AndroidManifest.xml');
if (fs.existsSync(man)) {
  let x = fs.readFileSync(man, 'utf8');
  const perms = ['ACCESS_NETWORK_STATE', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'ACCESS_BACKGROUND_LOCATION', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION', 'POST_NOTIFICATIONS', 'CAMERA', 'USE_BIOMETRIC', 'VIBRATE', 'RECEIVE_BOOT_COMPLETED', 'WAKE_LOCK', 'SCHEDULE_EXACT_ALARM'];
  const feats = [['android.hardware.camera', false], ['android.hardware.location.gps', false], ['android.hardware.fingerprint', false], ['android.hardware.touchscreen', false]];
  let add = ''; perms.forEach(p => { if (!x.includes(`android.permission.${p}"`)) add += `    <uses-permission android:name="android.permission.${p}" />\n`; });
  feats.forEach(([f, r]) => { if (!x.includes(`"${f}"`)) add += `    <uses-feature android:name="${f}" android:required="${r}" />\n`; });
  if (add) x = x.replace(/(\s*)<\/manifest>/, `\n    <!-- Orbit: permissions the app asks for at the right moment (see App permissions screen) -->\n${add}</manifest>`);
  if (!x.includes('default_notification_icon')) x = x.replace('</application>', `        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_icon" />\n        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="duty" />\n    </application>`);
  if (!/android:allowBackup=/.test(x)) x = x.replace('<application', '<application android:allowBackup="false"'); else x = x.replace(/android:allowBackup="true"/, 'android:allowBackup="false"');
  if (process.env.ORBIT_CLEARTEXT === '1' && !x.includes('usesCleartextTraffic')) x = x.replace('<application', '<application android:usesCleartextTraffic="true"');
  fs.writeFileSync(man, x);
  const dd = path.join(root, 'android/app/src/main/res/drawable'); fs.mkdirSync(dd, { recursive: true });
  fs.writeFileSync(path.join(dd, 'ic_stat_icon.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#FFFFFFFF" android:pathData="M3,21V5l9,-3v19H3zM14,21V9l7,2v10h-7zM5.5,7h2v2h-2zM8.5,7h2v2h-2zM5.5,11h2v2h-2zM8.5,11h2v2h-2zM5.5,15h2v2h-2zM8.5,15h2v2h-2zM16,13h2v2h-2zM16,17h2v2h-2z"/></vector>\n`);
  const gs = path.join(root, 'firebase/google-services.json'); if (fs.existsSync(gs)) { fs.copyFileSync(gs, path.join(root, 'android/app/google-services.json')); console.log('✔ Android: google-services.json installed (push enabled)'); } else console.log('ℹ Android: no firebase/google-services.json yet — the app builds, push starts working once you add it (see README step 3)');
  /* release signing (keystore.properties) + version numbers from the environment, so CI builds are repeatable */
  const gr = path.join(root, 'android/app/build.gradle'); let g = fs.readFileSync(gr, 'utf8');
  if (!g.includes('keystore.properties')) {
    g = g.replace('android {\n', `def ksFile = rootProject.file('keystore.properties')\ndef ks = new Properties()\nif (ksFile.exists()) { ksFile.withInputStream { ks.load(it) } }\n\nandroid {\n`);
    g = g.replace('    buildTypes {', `    signingConfigs {\n        release {\n            if (ksFile.exists()) {\n                storeFile rootProject.file(ks['storeFile'])\n                storePassword ks['storePassword']\n                keyAlias ks['keyAlias']\n                keyPassword ks['keyPassword']\n            }\n        }\n    }\n    buildTypes {`);
    g = g.replace(/(release \{\n)(\s+minifyEnabled false)/, `$1            if (ksFile.exists()) { signingConfig signingConfigs.release }\n$2`);
    g = g.replace(/versionCode\s+[^\n]+/, 'versionCode Integer.parseInt(System.getenv("ORBIT_VERSION_CODE") ?: "1")').replace(/versionName\s+"[^"]*"/, 'versionName System.getenv("ORBIT_VERSION") ?: "1.0"');
  }
  fs.writeFileSync(gr, g);
  console.log('✔ Android manifest: permissions + notification icon · release signing + versioning');
}

/* ---------------- iOS ---------------- */
const plist = path.join(root, 'ios/App/App/Info.plist');
if (fs.existsSync(plist)) {
  let p = fs.readFileSync(plist, 'utf8'); const setStr = (k, v) => { if (p.includes(`<key>${k}</key>`)) return; p = p.replace(/<\/dict>\s*<\/plist>/, `\t<key>${k}</key>\n\t<string>${v}</string>\n</dict>\n</plist>`); };
  setStr('NSLocationWhenInUseUsageDescription', `${brand} uses your location to confirm you are at your office or site when you check in or out.`);
  setStr('NSLocationAlwaysAndWhenInUseUsageDescription', `${brand} can share your live location with HR during duty hours if you turn on live tracking. A banner is always visible while sharing.`);
  setStr('NSLocationAlwaysUsageDescription', `${brand} can share your live location with HR during duty hours if you turn on live tracking.`);
  setStr('NSCameraUsageDescription', `${brand} uses the camera for face check-in and for photographing documents you upload.`);
  setStr('NSPhotoLibraryUsageDescription', `Choose photos of your documents to upload to your HR profile.`);
  setStr('NSPhotoLibraryAddUsageDescription', `Save your payslips and letters to your photos or files.`);
  setStr('NSFaceIDUsageDescription', `Use Face ID to unlock ${brand} and protect your HR data.`);
  if (!p.includes('<key>UIBackgroundModes</key>')) p = p.replace(/<\/dict>\s*<\/plist>/, `\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>location</string>\n\t\t<string>remote-notification</string>\n\t\t<string>fetch</string>\n\t</array>\n</dict>\n</plist>`);
  if (!p.includes('ITSAppUsesNonExemptEncryption')) p = p.replace(/<\/dict>\s*<\/plist>/, `\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>\n</dict>\n</plist>`);
  fs.writeFileSync(plist, p);
  /* push entitlement + wire it into the Xcode project (APNs is called directly by the server — no Firebase on iOS) */
  const ent = path.join(root, 'ios/App/App/App.entitlements'); fs.writeFileSync(ent, `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n\t<key>aps-environment</key>\n\t<string>development</string>\n</dict>\n</plist>\n`);
  const pbx = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');
  if (fs.existsSync(pbx)) { let b = fs.readFileSync(pbx, 'utf8'); if (!b.includes('CODE_SIGN_ENTITLEMENTS')) { b = b.replace(/(PRODUCT_BUNDLE_IDENTIFIER = [^;]+;)/g, m => `CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\t${m}`); fs.writeFileSync(pbx, b); } }
  console.log('✔ iOS: usage descriptions, background modes, push entitlement');
}
