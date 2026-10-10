/* シンプルチェス: Service Worker（オフライン対応）
 * ファイルを更新したら CACHE のバージョンを上げること。 */
const CACHE = 'simple-chess-v5';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'chess.js',
  'ai.js',
  'app.js',
  'feedback.js',
  'story.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// キャッシュ優先で即表示し、裏でネットワークから最新版を取得してキャッシュを更新する
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true }) ||
        (req.mode === 'navigate' ? await cache.match('index.html') : undefined);
      const network = fetch(req)
        .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => cached);
      if (cached) { e.waitUntil(network.catch(() => {})); return cached; }
      return network;
    })
  );
});
