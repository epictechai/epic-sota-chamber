const CACHE = "epic-sota-chamber-v18";
const CORE = [
  "/",
  "/index.html",
  "/chamber.css?v=18",
  "/kernel.js?v=18",
  "/media-encode.js?v=18",
  "/caps.js?v=18",
  "/account.js?v=18",
  "/chamber.js?v=18",
  "/icon.jpg",
  "/field.jpg",
  "/manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith("/api/")) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.ok && e.request.method === "GET") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("/"))),
  );
});
