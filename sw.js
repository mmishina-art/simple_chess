/* シンプルチェス: Service Worker（オフライン対応）
 * ファイルを更新したら CACHE のバージョンを上げること。 */
const CACHE = 'simple-chess-v1.40'; // version.js の APP_VERSION と同じ番号
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'boot.js',
  'version.js',
  'chess.js',
  'pieces.js',
  'ai.js',
  'app.js',
  'feedback.js',
  'story.js',
  'scene.js',
  'pwa.js',
  'backup.js',
  'tutorial.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

// 新しい版はまとめて取得して待機させ、画面の「更新」ボタンが押されたら切り替える
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// 古い版のキャッシュを片づける。名前が「simple-chess-」で始まるものだけ（同じサイトのほかのアプリのキャッシュは消さない）
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('simple-chess-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// キャッシュ優先（版の中身が混ざらないよう、更新は版ごとに行う）
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true }) ||
        (req.mode === 'navigate' ? await cache.match('index.html') : undefined);
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      });
    })
  );
});
