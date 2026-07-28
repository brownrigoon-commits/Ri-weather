/* 골프라이프 서비스 워커 — 앱 뼈대는 캐시, 날씨 데이터는 항상 네트워크 */
const CACHE = "riweather-v151";
const CORE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./css/leaflet.css",
  "./js/vendor/leaflet.js",
  "./js/app.js",
  "./js/legal.js",
  "./js/stats.js",
  "./js/stay.js",
  "./js/clubdb.js",
  "./js/clubfit.js",
  "./js/loading.js",
  "./js/weatherfx.js",
  "./js/golfdb.js",
  "./js/holesdb.js",
  "./js/holeimgdb.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

/* 그림 파일은 "있으면 캐시" — 한 장이 없다고 앱 전체가 죽으면 안 된다.
   CORE 는 addAll 이라 하나라도 404 면 서비스워커 설치가 통째로 실패한다
   (js/legal.js 누락 사고와 같은 구멍). 코드는 그대로 엄격하게 두고,
   교체될 수 있는 이미지만 개별 캐시로 뺀다. */
const OPTIONAL = [
  "./assets/golfer.png",
  "./assets/iron.png",
  "./assets/wedge.png",
  "./assets/putter.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE)
        .then(() => Promise.all(OPTIONAL.map((u) => c.add(u).catch(() => null)))))
      .then(() => self.skipWaiting())
  );
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
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // API/타일은 항상 네트워크
  // 같은 출처 정적 파일: 네트워크 우선, 실패 시 캐시 (오프라인에서도 앱 껍데기 열림)
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }) // 항상 서버 재검증 → 업데이트 즉시 반영
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
