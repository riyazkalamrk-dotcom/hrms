'use strict';
/* ============ Orbit — installable app (PWA): manifest, offline shell, install prompt, connection bar ============ */
const PWA = { evt: null, installed: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true, ios: /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream };
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { }));
addEventListener('beforeinstallprompt', e => { e.preventDefault(); PWA.evt = e; pwaBanner(); });
addEventListener('appinstalled', () => { PWA.installed = true; PWA.evt = null; document.getElementById('pwabar')?.remove(); try { toast('App installed 🎉'); } catch { } });
const offNow = () => navigator.onLine === false || window.__forceOffline === true;

async function pwaInstall() {
  if (PWA.installed) return toast('The app is already installed on this device');
  if (PWA.evt) { PWA.evt.prompt(); const r = await PWA.evt.userChoice.catch(() => ({})); PWA.evt = null; document.getElementById('pwabar')?.remove(); return r.outcome === 'accepted' ? toast('Installing…') : null; }
  modal('Install on your phone', `<div class="col" style="gap:14px"><div class="row" style="gap:12px"><span class="int-ic">📱</span><div><b>${PWA.ios ? 'iPhone / iPad (Safari)' : 'Android / Chrome'}</b><div class="muted small">Works like a normal app — opens full-screen, keeps working offline.</div></div></div>${PWA.ios ? `<ol class="small" style="margin:0;padding-left:18px;line-height:1.9"><li>Tap the <b>Share</b> button (square with arrow) in Safari</li><li>Scroll and tap <b>Add to Home Screen</b></li><li>Tap <b>Add</b></li></ol>` : `<ol class="small" style="margin:0;padding-left:18px;line-height:1.9"><li>Open this page in <b>Chrome</b></li><li>Tap the <b>⋮ menu</b> → <b>Install app</b> (or <b>Add to Home screen</b>)</li><li>Confirm — the icon appears on your home screen</li></ol>`}<div class="muted small">On a desktop, look for the install icon (⊕) at the right of the address bar.</div></div>`, null);
}
ACT.pwa_install = pwaInstall;
function pwaBanner() {
  if (PWA.installed || !SESSION || document.getElementById('pwabar')) return; const snooze = +localStorage.getItem('orbit_pwa_snooze') || 0; if (Date.now() < snooze) return;
  const el = document.createElement('div'); el.id = 'pwabar'; el.className = 'pwabar'; el.innerHTML = `<span class="pwa-ic">${brandMark()}</span><div style="flex:1;min-width:0"><b>Install ${esc(BR.short || BR.name)}</b><div class="muted small">One tap from your home screen · works offline</div></div><button class="btn primary sm" data-act="pwa_install">Install</button><button class="icon-btn" data-act="pwa_later" aria-label="Not now">${ic('x')}</button>`; document.body.appendChild(el);
}
ACT.pwa_later = () => { localStorage.setItem('orbit_pwa_snooze', Date.now() + 7 * 864e5); document.getElementById('pwabar')?.remove(); };
/* show the install banner a few seconds after sign-in on phones, once per week */
setInterval(() => { if (SESSION && (PWA.evt || (PWA.ios && !PWA.installed)) && innerWidth < 900 && !document.getElementById('pwabar')) pwaBanner(); }, 8000);

/* ---- connection bar ---- */
function netBar() {
  let el = document.getElementById('netbar'); const off = offNow(), n = typeof offPending === 'function' ? offPending() : 0;
  if (!off && !n && !netBar.just) { el?.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'netbar'; document.body.appendChild(el); }
  el.className = 'netbar ' + (off ? 'off' : n ? 'sync' : 'ok');
  el.innerHTML = off ? `<span>📴</span><b>You’re offline</b><span class="muted">— check-ins are saved on this phone${n ? ` (${n} waiting)` : ''} and verified when you’re back online.</span>` : n ? `<span>🔄</span><b>Back online</b><span>syncing ${n} saved punch${n > 1 ? 'es' : ''}…</span>` : `<span>✅</span><b>All synced</b>`;
}
addEventListener('offline', () => { netBar(); document.body.classList.add('is-offline'); }); addEventListener('online', () => { document.body.classList.remove('is-offline'); netBar.just = true; netBar(); setTimeout(() => { netBar.just = false; netBar(); }, 3500); });
setInterval(netBar, 4000); setTimeout(netBar, 1500);

document.head.insertAdjacentHTML('beforeend', `<style>
.netbar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:110;display:flex;align-items:center;gap:8px;max-width:min(560px,calc(100vw - 24px));padding:10px 16px;border-radius:14px;font-size:13px;box-shadow:0 18px 40px -16px rgba(0,0,0,.45);animation:cpop .35s var(--ease) both;flex-wrap:wrap}
.netbar.off{background:#1f2937;color:#fff}.netbar.off .muted{color:#cbd5e1}.netbar.sync{background:var(--amber);color:#1a1200}.netbar.ok{background:var(--green);color:#fff}
.pwabar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:100;width:min(440px,calc(100vw - 24px));display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;background:var(--surface);border:1px solid var(--line);box-shadow:0 24px 50px -20px rgba(0,0,0,.5);animation:cpop .4s var(--ease) both}.pwa-ic .logo{width:40px;height:40px}
body.is-offline .btn[data-needs-net]{opacity:.5;pointer-events:none}
</style>`);
