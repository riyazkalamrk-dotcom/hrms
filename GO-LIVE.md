# Orbit HRMS — go-live setup guide

Read section 1 before giving the app to staff. It explains one limit that decides how you can roll out.

---

## 1. Where the app stands today (must read)

**What is live-ready**

- No demo people, logins, attendance, payroll, documents or simulated tracking. A new install starts empty.
- **One shared database on your server.** Every phone and browser signs in to the server and sees the same data. A change on one device reaches the others within about 5 seconds.
- Sign-in is checked on the server. Passwords are stored only as salted hashes in `orbit-hr/data/auth.json` and are never sent to any device.
- Each device receives only what its user may see. Staff do not receive other people's salary, bank details, documents, face templates, tickets, expense claims or disciplinary records. Managers also receive their own team's attendance, leave and claims. HR and admins receive everything.
- The server refuses changes a person is not allowed to make: editing someone else's record, approving their own request, changing settings, payroll or roles.
- With no connection the app keeps working on its saved copy. Unsent changes are stored on the device and sent when the server is reachable again.
- Branding, company profile and every third-party API key are set from Settings and stored on the server.

**Limits you should know**

- **Uploaded files are not shared yet.** KYC document scans, policy attachments and letter files stay on the device that uploaded them. The records about them are shared; the files are not.
- **Team chat and live tracking** do not check who is sending. Treat chat as non-confidential.
- **Server rules are broad, not field by field.** They stop the cases listed above, but a technically skilled employee could still alter some of their own records, for example their own attendance times. HR should review the audit log and flagged punches.
- **"Forgot password" does not send an email.** HR or an admin opens the person's profile and presses Reset password, which shows a new temporary password once.
- **Two people editing the same record at the same moment:** the last save wins for that record.
- The iPhone app cannot be installed on real phones until you have an Apple Developer account.
- Policies come with eight template documents. Rewrite or remove them before publishing to staff.
- The holiday list is a default national list. Check it against your state's calendar.
- Nothing has been tested on a real phone yet. Do the checklist in section 9 before rollout.

---

## 2. Server

**You need:** a Windows or Linux machine that stays on, Node.js 20 or newer.

```bash
cd orbit-hr
npm install
node server.js
```

The app is then at `http://<server-address>:5173`.

| Setting | How | Why |
|---|---|---|
| Port | `PORT=8080 node server.js` | Default is 5173 |
| Admin key | Created on first start in `orbit-hr/data/admin.key`, or set `ADMIN_KEY` | Needed to change Settings from any machine other than the server itself |
| Always require the admin key | `ADMIN_STRICT=1` | Recommended on a hosted server |
| Extra allowed app origins | `CORS_ORIGINS=https://hr.yourcompany.com` | Only if the apps are served from another address |

**Use https for real use.** Phones block camera, location and push on plain `http` addresses (except your own Wi-Fi during testing). Put the server behind a reverse proxy with a certificate (Caddy, Nginx or your host's panel) and use an address like `https://hr.yourcompany.com`.

**Back up `orbit-hr/data/`.** It holds the employee database (`db.json`), password hashes (`auth.json`), your API keys, admin key and push keys. Never share it or commit it. It is excluded from Git. The server also keeps one copy of the database per day for 14 days in `orbit-hr/data/backups/`.

**Keep it running.** On Linux use `pm2 start server.js --name orbit-hr` or a systemd service. On Windows use Task Scheduler or NSSM.

---

## 3. First-time setup (administrator)

1. Open the app. You see **Set up your workspace**.
2. Enter company name, your name, job title, work email, mobile, date of birth and a password of 8 or more characters.
3. Add your profile photo when asked. Every user must add one before using the app.
4. You are now signed in as the administrator (employee ID `E001`).

This creates the workspace on the server. It can be done once only; after that everyone signs in.

---

## 4. Company settings (Settings page)

Do these in order.

1. **Branding** — company name, logo, colours, sign-in text.
2. **Company profile** — legal name, address, GSTIN, PAN, TAN, PF and ESI numbers, signatory. These print on letters and payslips.
3. **Integrations** — each card has a Test button.

| Card | Needed for | Free option |
|---|---|---|
| Map tiles | Tracking and location maps | OpenStreetMap (default). Use MapTiler or similar for heavy use |
| Address search | Finding a site when adding a location; nearest address in tracking | Nominatim (default). Add your contact email |
| Face recognition | Face check-in | Both engines are free and run on the phone. `face-api` is the default; `human` adds anti-spoofing but has not been tested on a real camera yet |
| Live tracking and geo-fence alerts | Send interval, accuracy, enter/leave alerts | Built in, no fees |
| IP location | Catching fake GPS | ip-api (default) |
| Web push | Reminders when the app is closed | Built in |
| Email (SMTP) | Emailing alerts and payslips | Your mail provider's SMTP |
| SMS / WhatsApp | Text and WhatsApp alerts | Paid providers (MSG91, Twilio, Meta) |
| Mobile push (Firebase) / iPhone push (Apple) | Push in the Android and iPhone apps | Firebase is free; Apple needs a developer account |
| AI assistant | Chat answers from your policies | Needs a paid API key; works in basic mode without one |

---

## 5. Organisation setup

1. **Locations** — rename "Head Office", then add each office and site. Set the pin by current location, address search or latitude/longitude, set the fence radius, and lock it.
2. **Organisation** — departments, designations and shifts. Starter lists are provided; edit them to match your company.
3. **Attendance policy** — choose the check-in method per work type (normal, location, face) and the fallback rules.
4. **Attendance rules** — grace time, late and early-leave reasons.
5. **Leave** — yearly quotas (default: 12 casual, 10 sick, 15 earned, 2 comp-off).
6. **Payroll settings** — basic and HRA percentages, allowances, deductions, PF and tax slabs. Defaults are provided; have your accountant check them.
7. **Roles and permissions** — review what Admin, HR, Manager and Employee can see. Staff only see the sections their role allows.
8. **Policies** — edit or remove the eight templates, then publish.
9. **Duty roster** — build shifts and weekly offs. Nothing is generated for you.

---

## 6. Adding people

1. **People → Add employee** for each person. Set role, department, manager, branch and salary.
2. When you save a new person the app shows a random temporary password once. Give it to them privately with their work email. Ask them to change it at first sign-in (profile → Change password).
3. At first sign-in each person adds a profile photo.
4. For face check-in, each person enrols their face once under **Attendance → Secure check-in**.
5. Add bank details and KYC documents from each profile. Nothing is pre-filled.

---

## 7. Phone apps

**Android**

```bash
cd orbit-hr/mobile
npm install
npm run setup -- --server https://hr.yourcompany.com --id com.yourcompany.hr --name "Your Company HR" --only android
npm run android:apk
```

The file appears in `orbit-hr/mobile/dist/`. Staff can also download it from `https://<server>/app`.

- The server address is fixed inside the app when it is built. Rebuild if the address changes.
- For the Play Store, create a signing key and run `npm run android:aab` (see `orbit-hr/mobile/README.md`).
- Android push needs `google-services.json` from Firebase (see `orbit-hr/mobile/firebase/README.md`).

**iPhone**

- Needs a paid Apple Developer account and an `https://` server.
- GitHub builds it for you: add the signing secrets listed at the top of `.github/workflows/mobile.yml`, then set the repository variable `ORBIT_IOS_SIGNING` to `yes`.

**GitHub builds**

Every push to `main` builds a test Android APK and compiles the iPhone app. Set the repository variables `ORBIT_SERVER`, `ORBIT_APP_ID` and `ORBIT_APP_NAME` so those builds point at your real server.

---

## 8. Daily running

- **Backups:** copy the whole `orbit-hr/data/` folder to another machine or cloud drive regularly. An admin can also use Settings → Data → **Export JSON**.
- **Restore:** stop the server, put a backup `db.json` (and `auth.json`) back into `orbit-hr/data/`, start the server.
- **Start over:** stop the server, move `db.json`, `auth.json` and `sessions.json` out of `orbit-hr/data/`, start the server. The app returns to first-time setup.
- **Lost admin password:** another admin or HR user resets it from the profile page. If nobody can sign in, restore from a backup or start over.
- **Old demo data:** the first time this version opens on a device that had the demo, the demo workspace is removed. One copy is kept in the browser under `orbit_demo_backup` in case real entries were made in it.

---

## 9. Go-live checklist

- [ ] Server on an `https://` address and kept running
- [ ] `orbit-hr/data/` backed up; `ADMIN_STRICT=1` set
- [ ] Administrator account created; branding and company profile filled in
- [ ] Locations added with correct pins and radius, then locked
- [ ] Shifts, departments, leave quotas and payroll settings checked
- [ ] Policies rewritten for your company
- [ ] Holiday list checked
- [ ] Employees added with roles and managers
- [ ] Test on two real phones: sign in, add photo, check in inside the fence, check in outside the fence, face check-in, check out early with a reason, and confirm HR sees each one on another device
- [ ] Android app rebuilt with the real server address
- [ ] `orbit-hr/data/` copied to a second location on a schedule
