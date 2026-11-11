# Orbit Realty HRMS

Everything for the HRMS lives in this folder.

| Folder / file | What it is |
|---|---|
| `orbit-hr/` | The web app (plain JavaScript, one file per feature) and its Node server |
| `orbit-hr/server.js`, `server_cfg.js`, `server_bot.js` | Server: static files, attendance verification, push, chat, tracking, settings/integrations, WhatsApp bot, AI proxy |
| `orbit-hr/data/` | Server secrets and state: `admin.key`, `config.json` (API keys), `vapid.json`, `secret.txt`, `state.json`. **Back it up; never share or commit it.** |
| `orbit-hr/mobile/` | Android + iOS app projects (Capacitor), build scripts and `README.md` with store steps |
| `orbit-hr/mobile/dist/OrbitHRMS-debug.apk` | Latest Android test build |

## Run the web app

```bash
cd orbit-hr
npm install
node server.js
```

Then open http://localhost:5173 (phones on the same Wi-Fi: `http://<this-PC-IP>:5173`, app download page at `/app`).

## Build the Android app

The Android toolchain (JDK 21 + Android SDK) is installed outside this folder at `C:\Users\Lenovo\ot`.

```bash
cd orbit-hr/mobile
npm install
set ORBIT_ANDROID_SDK=C:\Users\Lenovo\ot\sdk
set ORBIT_JAVA_HOME=C:\Users\Lenovo\ot\jdk
set GRADLE_USER_HOME=C:\Users\Lenovo\ot\gh
npm run setup -- --server http://<this-PC-IP>:5173 --iconserver http://localhost:5173 --only android
npm run android:apk
```

For a real release use an `https://` server address. iOS needs a Mac — see `orbit-hr/mobile/README.md`.

## Going live

See [GO-LIVE.md](GO-LIVE.md) for the full setup guide and the go-live checklist.

## Good to know

- The app ships with no demo data. The first person to open it creates the administrator account.
- Employee data (attendance, leave, payroll) is stored in each browser / phone app, not on the server yet. Read section 1 of GO-LIVE.md before rolling out to staff.
- Branding, company profile and API keys are stored on the server in `orbit-hr/data/config.json`.
