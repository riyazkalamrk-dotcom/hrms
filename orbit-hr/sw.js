/* Orbit HRMS service worker — installable app shell (works offline) + Web Push when the app/tab is closed. */
const CACHE = 'orbit-shell-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); await self.clients.claim(); })()));

/* network-first for the app itself (always fresh when online), cached copy when offline; never touch /api/ */
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return; const url = new URL(req.url); if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith((async () => {
    try { const r = await fetch(req); if (r.ok) { const c = await caches.open(CACHE); c.put(req, r.clone()); } return r; }
    catch { const c = await caches.match(req, { ignoreSearch: true }); if (c) return c; if (req.mode === 'navigate') { const i = await caches.match('/', { ignoreSearch: true }) || await caches.match('/index.html'); if (i) return i; } return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }); }
  })());
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });

self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Notification', body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // if the app is open and visible, let the page show its own in-app alert instead of a system popup
    if (wins.some(w => w.visibilityState === 'visible')) { wins.forEach(w => w.postMessage({ type: 'push', ...d })); return; }
    await self.registration.showNotification(d.title || 'Notification', {
      body: d.body || '', tag: d.tag || 'orbit', renotify: true, requireInteraction: /check|duty/i.test(d.title || ''), vibrate: [120, 60, 120],
      data: { url: d.url || '/#/alerts' }, icon: '/pwa/icon-192.png', badge: '/pwa/icon-192.png'
    });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || '/#/alerts';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.length) { const w = wins[0]; await w.focus(); try { await w.navigate(url); } catch { w.postMessage({ type: 'goto', url }); } }
    else await self.clients.openWindow(url);
  })());
});
