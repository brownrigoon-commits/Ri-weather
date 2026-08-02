/* 투어리스트(구 골프라이프) 서비스 워커 — 앱 뼈대는 캐시, 날씨 데이터는 항상 네트워크 */
const CACHE = "riweather-v213";
const CORE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./css/leaflet.css",
  "./js/vendor/leaflet.js",
  "./js/i18n.js",
  "./js/i18n/ko.js",
  "./js/app.js",
  "./js/legal.js",
  "./js/stats.js",
  "./js/stay.js",
  "./js/bookingids.js",
  "./js/booking.js",
  "./js/spiritdb.js",
  "./js/spirit.js",
  "./assets/brand/golfpang.png",
  "./assets/brand/golfmon.png",
  "./js/clubdb.js",
  "./js/clubfit.js",
  "./js/loading.js",
  "./js/weatherfx.js",
  "./js/golfdb.js",
  "./js/holesdb.js",
  "./js/holeimgdb.js",
  "./js/coursevideos.js",
  "./js/jppack.js",
  // ⚠️ holeimgdb_jp.js(2.4MB)·holestats_jp.js(2.6MB)·holetext_jp.js(1.2MB) 는 여기 넣지 않는다.
  //    설치 때 6MB 를 미리 받게 되고, 한국 이용자는 평생 쓰지 않는다.
  //    일본 구장을 열 때 jppack 이 받고, 아래 "있으면 캐시" 규칙이 알아서 남긴다.
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
  /* 관리자 화면은 캐시하지 않는다 — 백엔드 없이는 아무것도 못 보므로 오프라인 캐시가 이득이 0인데,
     한 번 담기면 통신이 잠깐 끊긴 날 **옛 화면이 아무 표시 없이** 뜬다(2026-08-02 실측).
     새 기능을 배포했는데 "그대로인데요?" 가 되는 경로 중 하나였다. 브라우저에 그냥 맡긴다. */
  if (/\/ops-[\w-]+\.html$/.test(url.pathname)) return;
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
