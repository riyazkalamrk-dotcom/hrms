/* Loaded first. In the Android / iOS apps (Capacitor) the web files are bundled inside the app, so API calls such as
   fetch('/api/...') must be pointed at your company server. The mobile build script writes your server address below. */
window.ORBIT_NATIVE_CFG = window.ORBIT_NATIVE_CFG || { server: '', version: 'web', fcm: false };
(function () {
  var C = window.Capacitor, native = !!(C && C.isNativePlatform && C.isNativePlatform()); window.ORBIT_NATIVE = native; if (!native) return;
  var bundled = /^(capacitor|ionic|https?):\/\/localhost(:\d+)?$/.test(location.origin), base = '';
  try { base = localStorage.getItem('orbit_server') || window.ORBIT_NATIVE_CFG.server || ''; } catch (e) { }
  window.ORBIT_BASE = bundled ? String(base).replace(/\/+$/, '') : '';
  if (window.ORBIT_BASE) {
    var of = window.fetch.bind(window), fix = function (u) { return typeof u === 'string' && /^\/(api|pwa)\//.test(u) ? window.ORBIT_BASE + u : u; };
    window.fetch = function (u, o) { if (u && typeof u === 'object' && u.url && /^\/(api|pwa)\//.test(new URL(u.url, location.href).pathname) && new URL(u.url, location.href).origin === location.origin) { u = new Request(window.ORBIT_BASE + new URL(u.url).pathname + new URL(u.url).search, u); } return of(fix(u), o); };
    var OE = window.EventSource; if (OE) { window.EventSource = function (u, o) { return new OE(fix(u), o); }; window.EventSource.prototype = OE.prototype; }
  }
})();
