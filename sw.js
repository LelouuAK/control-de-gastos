// Service worker: deja la app funcionando sin internet.
// Estrategia: se responde al instante con lo guardado y en segundo plano se baja la versión nueva,
// así los cambios que publiques aparecen la siguiente vez que abras la app.
const CACHE = 'gastos-v1';
const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/main.js',
  'js/version.js',
  'js/format.js',
  'js/calc.js',
  'js/seed.js',
  'js/store.js',
  'js/respaldo.js',
  'js/ui.js',
  'js/views/mes.js',
  'js/views/ahorro.js',
  'js/views/extras.js',
  'js/views/crucero.js',
  'js/views/config.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (ev) => {
  const pedido = ev.request;
  if (pedido.method !== 'GET' || new URL(pedido.url).origin !== location.origin) return;
  ev.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const guardado = await cache.match(pedido);
      // Se pide por URL (no por el pedido original) porque las navegaciones no admiten cambiar la caché.
      const actualizar = fetch(pedido.url, { cache: 'no-cache' }).then((res) => {
        if (res.ok) cache.put(pedido, res.clone());
        return res;
      });
      if (guardado) {
        ev.waitUntil(actualizar.catch(() => {}));
        return guardado;
      }
      return actualizar.catch(() => (pedido.mode === 'navigate' ? cache.match('index.html') : Response.error()));
    })(),
  );
});
