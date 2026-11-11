# Orbit HRMS — Android & iOS apps

One codebase, two stores. The apps are your Orbit web app wrapped in a native shell ([Capacitor](https://capacitorjs.com)), so every screen you build in the web app is automatically in the phone apps — plus the native things a browser can't do:

| Native feature | Android | iOS |
|---|---|---|
| Push notifications (even when the app is closed) | Firebase FCM | Apple APNs (direct, no Firebase) |
| Duty reminders that fire offline, to the minute | ✅ exact alarms | ✅ |
| Precise check-in location + **fake-GPS detection** | ✅ | ✅ (simulated-source flag where the OS provides it) |
| Live tracking in the **background** (foreground service + visible notification) | ✅ | ✅ (blue pill) |
| Camera for face check-in / documents | ✅ | ✅ |
| Fingerprint / Face ID app lock | ✅ | ✅ |
| Offline check-in, synced & re-verified later | ✅ | ✅ |
| Share-sheet for payslips / letters / CSV | ✅ | ✅ |
| Permission centre + first-run set-up + consent log | ✅ | ✅ |

Every permission is asked **in context, with a plain-language reason**, once; if the user blocks one, the app deep-links to the phone's Settings. See **Settings → App permissions** in the app.

> **Important — where data lives.** The Orbit web app keeps each person's data in their own browser/app storage (demo architecture). The phone apps therefore have their *own* copy until you move the data to a shared server database. Everything else (push, tracking, branding, WhatsApp bot, AI, offline-punch verification, integrations) already runs on your Orbit **server** and is shared.

---

## 0 · What you need

| | Android | iOS |
|---|---|---|
| Computer | Windows, Mac or Linux | **a Mac** (Apple's rule) — or the GitHub Mac runner in `ci/mobile.yml` |
| Tools | JDK 21 + Android SDK (run `npm run android:tools` to install both) | Xcode 16+ |
| Accounts | Google Play Console ($25 once) · Firebase (free) | Apple Developer Program ($99/yr) |
| Server | Orbit server on **https** (e.g. `https://hr.yourcompany.com`) — phones can't use plain http | same |

## 1 · Create the native projects (any computer)
> **Windows:** copy this `mobile` folder to a short path such as `C:\orbit-mobile` first — Windows can't handle very long folder names during Android builds.

```bash
cd mobile
npm install
npm run setup -- --name "Skyline HR" --id com.skyline.hr --server https://hr.skyline.com
```

That single command: bundles the web app, adds Android + iOS, draws the **icon and splash from your Branding settings**, writes every permission, usage text, background mode and push entitlement, and syncs. Re-run it whenever you change the web app, branding, name or server. (`--server` is optional: without it the app asks the user for the company address on first launch — handy for one app serving many companies.)

## 2 · Android

```bash
npm run android:tools          # only if you have no JDK/SDK yet (you accept Google's licences)
npm run android:apk            # → dist/app-debug.apk   (install on any phone, share by link)
```
**Google Play release**
1. Create a keystore once: `keytool -genkey -v -keystore release.jks -alias orbit -keyalg RSA -keysize 2048 -validity 10000`
2. Save `android/keystore.properties` (git-ignored): `storeFile=../release.jks`, `storePassword=…`, `keyAlias=orbit`, `keyPassword=…`
3. `ORBIT_VERSION=1.0.0 ORBIT_VERSION_CODE=1 npm run android:aab` → `dist/app-release.aab` → upload in Play Console.
4. Play Console → **App content**: fill *Data safety* and the **Background location declaration** (text below).

## 3 · Push notifications

*Android (Firebase)* — console.firebase.google.com → new project → add Android app with your id → download **google-services.json** into `mobile/firebase/` → *Project settings → Service accounts → Generate new private key* → paste that JSON into **Orbit → Settings → Integrations → Mobile push (Firebase FCM)**. Re-run `npm run setup`.

*iPhone (Apple, no Firebase)* — developer.apple.com → Keys → "+" → tick **Apple Push Notifications service** → download the `.p8`. In Orbit → Settings → Integrations → **iPhone push (Apple APNs)** enter Key ID, Team ID, bundle id (same as `--id`) and paste the `.p8` contents. Press **Test connection**.

Use **App permissions → Send me a test notification** on a phone to confirm end-to-end.

## 4 · iOS (on a Mac)

```bash
npm run setup -- --name "Skyline HR" --id com.skyline.hr --server https://hr.skyline.com --only ios
npm run ios:open               # opens Xcode
```
In Xcode: select the **App** target → *Signing & Capabilities* → pick your Team → tick **Push Notifications** and **Background Modes → Location updates + Remote notifications** (the entitlement and Info.plist keys are already there). Product → Archive → Distribute → TestFlight.
Apple review notes are in the box at the bottom.

## 5 · Automatic builds (recommended)
`ci/mobile.yml` is a GitHub Actions workflow: copy it to `.github/workflows/mobile.yml`, add the secrets listed at the top of the file, and every push builds a signed **Android AAB/APK** on Linux and an **iOS IPA → TestFlight** on a Mac runner. No local tools needed.

## 6 · Updating
- Web/UI change → `npm run setup` (or `npm run sync`) → rebuild.
- Branding/name/colours → change in **Settings → Branding** → `npm run icons && npm run sync`.
- Version numbers: `ORBIT_VERSION`, `ORBIT_VERSION_CODE` env vars (Android) and `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` (iOS, set in CI).

---

## Store paperwork (copy-paste)

**Google Play – background location declaration**
> Orbit HRMS shares an employee's live location with their HR team *only* when that employee turns on "Live tracking" for field duty. It runs as a foreground service with a persistent notification, stops automatically 30 minutes after the shift ends, and can be stopped at any time in the app. Consent is recorded in-app. Location is also read once at check-in/check-out to verify the employee is at the assigned site.

**Play – Data safety (summary):** collects precise location, name/employee id, photos (documents) and device id for app functionality and fraud prevention; data in transit encrypted (HTTPS); users can request deletion via HR.

**Apple – App Review notes**
> Demo login is shown on the sign-in screen (role chips). Location is requested only when checking in or when the user enables Live Tracking; "Always" is optional and used for field-duty tracking with the blue status indicator. Camera is used for face check-in and document photos. Face ID unlocks the app. A privacy policy URL is available from your company's Orbit server.

**Privacy policy:** use *Policies & docs → Information Security & Privacy* (it already describes location, face and attendance data under the DPDP Act, 2023) and publish it at a public URL.

---

## Troubleshooting
| Symptom | Fix |
|---|---|
| App shows "Connect to your company" | Enter your https server address; or rebuild with `--server`. |
| Android build: *SDK location not found* | `npm run android:tools`, or set `ORBIT_ANDROID_SDK` / `ANDROID_HOME`. |
| Windows build: path-too-long errors | Keep this folder near the drive root (e.g. `C:\orbit-mobile`) and set `GRADLE_USER_HOME=C:\ot\gh`. |
| Push: "nothing delivered" | Finish step 3; the phone must have opened the app once, signed in and allowed notifications. |
| Location "Allow all the time" missing on Android 11+ | It is a second Settings step by design: App permissions → *Choose "Allow all the time"*. |
| iOS push never arrives in Xcode-installed builds | Set APNs environment to **sandbox** (the server also retries the other one automatically). |
