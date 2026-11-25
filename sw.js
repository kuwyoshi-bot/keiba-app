// オフラインでも開けるように、アプリのファイルを保存しておく
const CACHE = "turfnote-v45";
const FILES = [
  "./", "index.html", "style.css", "app.js", "data.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "img/tab-course.png", "img/tab-blood.png", "img/tab-jockey.png", "img/tab-stable.png",
  "img/tokyo-3d.jpg", "img/nakayama-3d.jpg", "img/hanshin-3d.jpg", "img/kyoto-3d.jpg", "img/chukyo-3d.jpg",
  "img/niigata-3d.jpg", "img/sapporo-3d.jpg", "img/hakodate-3d.jpg", "img/fukushima-3d.jpg", "img/kokura-3d.jpg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// 新しい版があればそれを使い、つながらないときは保存した版を出す
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // 自分のサイトのファイルは、ブラウザの一時保存を使わずに毎回新しいか確かめる
  const same = new URL(e.request.url).origin === self.location.origin;
  e.respondWith(
    (same ? fetch(e.request.url, { cache: "no-cache" }) : fetch(e.request))
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
