/* =====================================================================
 * Ri_Stock 서비스 워커
 *
 * 방침은 Ri-weather 골프앱과 같습니다 — **네트워크 우선, 실패하면 캐시**.
 * 앱 껍데기(html·css·js·아이콘)는 설치할 때 미리 받아 두어 지하철에서도 열립니다.
 *
 * ⚠️ data/ 밑의 JSON 은 **절대 미리 캐시하지 않습니다.**
 *    엔진이 매일 새로 쓰는 파일이라, 캐시가 먼저 응답하면 어제 종목이 그대로 보입니다.
 *    (네트워크가 아예 끊겼을 때만 마지막으로 받은 값을 대신 내줍니다.)
 * ===================================================================== */

const CACHE = "ristock-v1";

const CORE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/strategy.js",
  "./js/data.js",
  "./js/export.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // 파일 하나가 404 여도 설치 자체는 끝나야 합니다.
      // (2026-07-22 골프앱 사고: 파일 하나 누락으로 캐시가 통째로 비었습니다)
      .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null))))
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
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  const 데이터파일 = url.pathname.includes("/data/");

  e.respondWith(
    fetch(e.request, { cache: "no-cache" })   // 항상 서버에 다시 물어봅니다
      .then((res) => {
        // 정상 응답만 캐시에 남깁니다 (404 페이지를 캐시하면 사고가 오래 갑니다)
        if (res && res.ok) {
          const 사본 = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, 사본)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        // 오프라인 — 마지막으로 받아 둔 것을 내줍니다.
        // 데이터 JSON 은 `?v=생성시각` 이 매번 달라지므로 쿼리는 무시하고 찾습니다.
        caches.match(e.request, { ignoreSearch: 데이터파일 }).then((hit) => {
          if (hit) return hit;
          // 화면 이동 요청이면 앱 껍데기라도 띄웁니다.
          if (e.request.mode === "navigate") return caches.match("./index.html");
          // ⚠️ JSON 요청에 index.html 을 돌려주면 안 됩니다.
          //    `res.ok` 가 true 라서 앱이 HTML 을 JSON 으로 파싱하다 엉뚱한 오류를 냅니다.
          //    솔직하게 실패로 알려 주면 "데이터를 불러오지 못했습니다" 안내가 정확히 뜹니다.
          return new Response("", { status: 504, statusText: "오프라인" });
        })
      )
  );
});
