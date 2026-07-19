/* Ri-Weather ?쒕퉬???뚯빱 ????堉덈???罹먯떆, ?좎뵪 ?곗씠?곕뒗 ??긽 ?ㅽ듃?뚰겕 */
const CACHE = "riweather-v6";
const CORE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/golfdb.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // API/??쇱? ??긽 ?ㅽ듃?뚰겕
  // 媛숈? 異쒖쿂 ?뺤쟻 ?뚯씪: ?ㅽ듃?뚰겕 ?곗꽑, ?ㅽ뙣 ??罹먯떆 (?ㅽ봽?쇱씤?먯꽌????猿띾뜲湲??대┝)
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
