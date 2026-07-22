/* Ri-Weather 이용 통계 수집 (Google Apps Script 백엔드)
 *
 * ⚠️ 절대 규칙: 위치 좌표(위도·경도)는 어떤 형태로도 수집·전송하지 않는다.
 *    (수집 시 위치기반서비스 신고 의무가 발생 — 사장님 확정 사항)
 *
 * 수집 항목: 접속·조회한 골프장 이름·사용 기능·기기 종류·앱 버전,
 *           연령대·성별(동의 화면에서 '맞춤 정보 제공'에 동의한 이용자만)
 * 식별자: 무작위 생성 ID(cid) — 기기당 1개, 개인정보와 연결 불가, 순 방문자 집계용
 *
 * STATS_URL 이 비어 있으면 아무것도 전송하지 않는다(설치 전 안전 상태).
 */
"use strict";

const STATS = (() => {
  // 사장님이 Apps Script를 배포하면 여기에 웹앱 URL을 넣는다 (docs/관리자통계_설치안내.md 참고)
  const STATS_URL = "";

  const CID_KEY = "riweather.cid";
  const QUEUE_KEY = "riweather.statq";
  const FORBIDDEN = /lat|lon|coord|위도|경도|gps/i;   // 좌표성 데이터 방어벽

  function cid() {
    let v = localStorage.getItem(CID_KEY);
    if (!v) {
      v = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      localStorage.setItem(CID_KEY, v);
    }
    return v;
  }

  function device() {
    const u = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(u)) return "iOS";
    if (/Android/i.test(u)) return "Android";
    return "PC";
  }

  function profile() {
    try {
      const c = (typeof CONSENT !== "undefined" && CONSENT.get()) || {};
      if (!c.profile) return {};
      return { age: c.age || "", gen: c.gender || "" };
    } catch (_) { return {}; }
  }

  function loadQ() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch (_) { return []; }
  }
  function saveQ(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-80))); } catch (_) {}
  }

  function hit(ev, name) {
    if (!STATS_URL) return;
    name = String(name || "").slice(0, 60);
    if (FORBIDDEN.test(ev) || FORBIDDEN.test(name)) return;   // 좌표성 항목은 원천 차단
    const p = profile();
    const q = loadQ();
    q.push({ t: Date.now(), cid: cid(), ev: String(ev).slice(0, 20), name,
             ver: typeof APP_VER !== "undefined" ? APP_VER : "", dev: device(),
             age: p.age || "", gen: p.gen || "" });
    saveQ(q);
    schedule();
  }

  let timer = null;
  function schedule() {
    if (timer) return;
    timer = setTimeout(flush, 4000);   // 몇 건 모아서 한 번에 전송
  }

  function flush(useBeacon) {
    timer = null;
    const q = loadQ();
    if (!q.length || !STATS_URL) return;
    const body = JSON.stringify({ rows: q });
    // Apps Script는 preflight를 처리하지 못하므로 단순 요청(text/plain)으로 보낸다
    if (useBeacon && navigator.sendBeacon) {
      if (navigator.sendBeacon(STATS_URL, body)) saveQ([]);
      return;
    }
    fetch(STATS_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body })
      .then((r) => { if (r.ok) saveQ([]); })
      .catch(() => {});   // 실패 시 큐에 남겨 다음 기회에 재전송
  }

  // 접속 1회 기록 + 종료 직전 남은 큐 전송
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  if (STATS_URL) hit("visit", "");

  return { hit };
})();
