/* Offline: de hele app wordt bewaard op het toestel. Eerst uit de cache, op de achtergrond verversen. */
const CACHE = 'ysm-v1.0.0';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'js/figure.js', 'js/geo.js', 'js/poses.js', 'js/app.js',
  'fonts/Lato-Light.woff2', 'fonts/Lato-LightItalic.woff2', 'fonts/Lato-Regular.woff2', 'fonts/Lato-Bold.woff2', 'fonts/Courgette-Regular.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/maskable-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('ysm-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true }) || (e.request.mode === 'navigate' ? await c.match('index.html') : null);
    const net = fetch(e.request).then((r) => { if (r && r.ok && r.type === 'basic') c.put(e.request, r.clone()); return r; }).catch(() => hit || Response.error());
    return hit || net;
  }));
});
