/* 투어리스트(구 골프라이프) 이용 통계 수집 (Google Apps Script 백엔드)
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

/* 백엔드(Apps Script) 주소 — '골프라이프 백엔드' 프로젝트 (2026-07-23 설치 완료)
   통계 수집 + 맛집 실제 사진(카카오 플레이스)이 이 주소 하나로 동작한다. */
window.RIW_BACKEND = "https://script.google.com/macros/s/AKfycbzVkab8qBwUdukg_O9FtYjwHvTygc9Riyh3tEOD0z-bALNZxbO9ksRNPLM9y1mOWv9q4A/exec";

const STATS = (() => {
  /* 개발용 접속은 통계에 넣지 않는다.
     우리가 하루에도 수십 번 열어보는 미리보기가 그대로 쌓여서,
     2026-07-31 기준 PC 접속 1,559건 중 상당수가 개발자 자신이었다.
     베타 100명의 진짜 사용 패턴을 보려면 이 잡음을 먼저 걷어내야 한다.

     막는 경로가 둘이다:
       ① 로컬 미리보기(localhost) — 자동
       ② 배포본을 우리가 열어 보는 경우 — 주소 뒤에 **?dev=1** 을 한 번 붙이면
          그 기기는 계속 빠진다(`?dev=0` 으로 해제). 관리자 화면에도 버튼이 있다.
          ⚠️ ①만 있던 때는 github.io 로 우리가 확인한 것이 전부 쌓였다.

     ⚠️ 베타 의견(FEEDBACK)은 이용자가 스스로 누른 것이라 여기서 막지 않는다.
        (우리가 검사로 보낸 의견은 서버가 기기ID로 걸러 낸다) */
  const DEV_KEY = "riweather.dev";
  try {
    const m = /[?&]dev=([01])/.exec(location.search);
    if (m) {
      if (m[1] === "1") localStorage.setItem(DEV_KEY, "1");
      else localStorage.removeItem(DEV_KEY);
    }
  } catch (_) {}
  let devDevice = false;
  try { devDevice = localStorage.getItem(DEV_KEY) === "1"; } catch (_) {}
  const IS_DEV = devDevice ||
    /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname);
  const STATS_URL = IS_DEV ? "" : window.RIW_BACKEND;

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

  /* 주소 문자열 → 시/도 이름.
   *
   * ⚠️ 이것은 '이용자가 어디 있는지'가 아니라 '어느 지역 골프장을 봤는지'다.
   *    우리가 가진 건 골프장 주소(이미 화면에 떠 있는 공개 정보)뿐이고,
   *    이용자의 위치 좌표는 읽지도, 만들지도, 보내지도 않는다.
   *    보내는 값은 "경기" 같은 시/도 이름 한 단어가 전부다.
   */
  const SIDO = [
    ["서울", "서울"], ["부산", "부산"], ["대구", "대구"], ["인천", "인천"],
    ["광주", "광주"], ["대전", "대전"], ["울산", "울산"], ["세종", "세종"],
    ["경기", "경기"], ["강원", "강원"],
    ["충청북", "충북"], ["충북", "충북"], ["충청남", "충남"], ["충남", "충남"],
    ["전라북", "전북"], ["전북", "전북"], ["전라남", "전남"], ["전남", "전남"],
    ["경상북", "경북"], ["경북", "경북"], ["경상남", "경남"], ["경남", "경남"],
    ["제주", "제주"],
  ];

  /* 시/도만으로는 뭉뚱그려져 쓸모가 적다 — 국내 골프장의 절반 가까이가 '경기' 한 칸에 몰린다.
     그래서 '파주 골프장을 봤으면 경기북부' 처럼 골프장이 실제로 묶이는 축으로 쪼갠다
     (사장님 지시 2026-07-31).
     ⚠️ 쪼개는 기준은 여전히 **골프장 주소**다. 이용자가 있는 위치가 아니다.
     경기·강원만 나눈다. 나머지 도는 골프장 수가 적어 더 쪼개면 한 칸에 한두 곳이 되어
     오히려 읽기 어려워진다. */
  const GROUP = {
    경기: {
      경기북부: ["고양", "파주", "김포", "양주", "의정부", "동두천", "연천",
                 "포천", "남양주", "구리", "가평"],
      경기동부: ["하남", "광주", "이천", "여주", "양평"],
      경기서부: ["부천", "광명", "시흥", "안산"],
      경기남부: ["성남", "용인", "수원", "화성", "평택", "오산", "안성",
                 "안양", "과천", "의왕", "군포"],
    },
    강원: {
      강원영동: ["강릉", "속초", "동해", "삼척", "양양", "고성"],
      강원영서: ["춘천", "원주", "홍천", "횡성", "평창", "정선", "영월",
                 "철원", "화천", "양구", "인제", "태백"],
    },
  };

  /* "파주시" → "파주", "가평군" → "가평".
     '광주시'(경기)와 '광주광역시'는 시/도 칸이 다르므로 여기서 섞이지 않는다. */
  function city(s) {
    return String(s || "").replace(/(특별자치|광역)?시$|군$|구$/, "");
  }

  function region(addr, country) {
    const c = String(country || "").toUpperCase();
    if (c === "JP") return "일본";
    if (c === "CN") return "중국";
    const tok = String(addr || "").trim().split(/\s+/);
    const head = tok[0] || "";
    let sido = "";
    for (const [pre, out] of SIDO) if (head.indexOf(pre) === 0) { sido = out; break; }
    if (!sido) return (c && c !== "KR") ? "해외" : "";
    const g = GROUP[sido];
    if (g) {
      const t = city(tok[1]);
      // 시/군 이름을 모르면(주소가 시/도까지만 온 경우) 시/도 그대로 둔다 — 지어내지 않는다
      if (t) for (const name in g) if (g[name].indexOf(t) >= 0) return name;
    }
    return sido;
  }

  function hit(ev, name, reg) {
    if (!STATS_URL) return;
    name = String(name || "").slice(0, 60);
    reg = String(reg || "").slice(0, 10);
    // 좌표성 항목은 원천 차단 (지역 칸에도 같은 잣대를 댄다)
    if (FORBIDDEN.test(ev) || FORBIDDEN.test(name) || FORBIDDEN.test(reg)) return;
    if (/\d{2,}\.\d{3,}/.test(reg)) return;        // 숫자 좌표처럼 생긴 건 무조건 버린다
    const p = profile();
    const q = loadQ();
    q.push({ t: Date.now(), cid: cid(), ev: String(ev).slice(0, 20), name,
             ver: typeof APP_VER !== "undefined" ? APP_VER : "", dev: device(),
             age: p.age || "", gen: p.gen || "", reg });
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

  return { hit, region };
})();

/* =========================================================
 * 베타 피드백 전송
 *
 * 통계와 달리 이용자가 '보냈다'고 믿는 행동이라, 성공·실패를 분명히 알려준다.
 * 보내지 못하면 폰에 넣어 두고 다음 기회에 다시 보낸다 — 조용히 버리지 않는다.
 * 이름·연락처는 받지도 보내지도 않는다(cid = 무작위 기기 ID뿐).
 * ========================================================= */
const FEEDBACK = (() => {
  const QK = "riweather.fbq";
  const URL_ = window.RIW_BACKEND;

  const loadQ = () => { try { return JSON.parse(localStorage.getItem(QK)) || []; } catch (_) { return []; } };
  const saveQ = (q) => { try { localStorage.setItem(QK, JSON.stringify(q.slice(-20))); } catch (_) {} };

  function meta() {
    let cid = "";
    try { cid = localStorage.getItem("riweather.cid") || ""; } catch (_) {}
    const u = navigator.userAgent;
    const dev = /iPhone|iPad|iPod/i.test(u) ? "iOS" : /Android/i.test(u) ? "Android" : "PC";
    return { cid, dev, ver: typeof APP_VER !== "undefined" ? APP_VER : "" };
  }

  async function post(item) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    try {
      // Apps Script 는 preflight 를 못 받으므로 text/plain 단순 요청으로 보낸다
      const r = await fetch(URL_, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(Object.assign({ fn: "feedback" }, item)), signal: ctl.signal,
      });
      if (!r.ok) return { ok: false, net: true };
      const j = await r.json();
      // 백엔드가 아직 옛 버전이면 피드백을 모르고 {ok:false} 만 준다 →
      // 이용자 탓으로 돌리지 말고 대기열에 남긴다
      if (j && j.ok) return { ok: true };
      if (j && j.err && j.err !== "limit" && !/^서버/.test(j.err)) return { ok: false, err: j.err };
      if (j && j.err === "limit") return { ok: false, limit: true };
      return { ok: false, net: true };
    } catch (_) {
      return { ok: false, net: true };
    } finally {
      clearTimeout(timer);
    }
  }

  /* 대기 중인 것 먼저 비우고, 새 글을 보낸다 */
  async function send(input) {
    if (!URL_) return { ok: false, err: tr("stats.err.nourl") };
    const item = Object.assign({ t: Date.now() }, meta(), input);
    const res = await post(item);
    if (res.ok) { flush(); return res; }
    if (res.limit || res.err) return res;          // 서버가 분명히 거절한 것은 큐에 넣지 않는다
    const q = loadQ(); q.push(item); saveQ(q);     // 연결 문제 → 보관했다가 나중에
    return { ok: false, queued: true };
  }

  let busy = false;
  async function flush() {
    if (busy || !URL_) return;
    const q = loadQ();
    if (!q.length) return;
    busy = true;
    try {
      while (q.length) {
        const res = await post(q[0]);
        if (!res.ok && res.net) break;             // 아직도 연결이 안 되면 다음 기회에
        q.shift();                                 // 성공했거나 서버가 거절한 것은 뺀다
        saveQ(q);
      }
    } finally { busy = false; }
    saveQ(q);
  }

  const pending = () => loadQ().length;

  window.addEventListener("online", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") flush();
  });

  return { send, flush, pending };
})();
