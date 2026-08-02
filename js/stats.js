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
  /* ── 우리 접속은 통계에 넣지 않는다 (2026-08-02 개편) ─────────────────
     우리가 하루에도 수십 번 열어 보는 것이 그대로 쌓여서, 2026-07-31 기준
     PC 접속 1,559건 중 상당수가 개발자 자신이었다. 베타 이용자의 진짜 사용
     패턴을 보려면 이 잡음을 먼저 걷어내야 한다.

     원칙 — **사실이면 아예 보내지 않고, 추측이면 표시해서 보낸다.**
       ① 우리 배포 주소가 아니다   → 사실 → 안 보냄
       ② ?dev=1 로 직접 표시했다   → 사실 → 안 보냄
       ③ 자동화 브라우저 같다      → 추측 → 기기ID에 dev-wd- 를 붙여 **보낸다**
     ③을 여기서 버리지 않는 이유: 틀렸을 때 되돌릴 기록 자체가 없어진다.
     보내 두면 서버가 자동으로 빼고, 화면의 '뺀 것'에 세어지고, 되돌릴 수 있다.

     ⚠️ 예전 방식(localhost 만 금지)은 file:// · 192.168.x.x(폰으로 내 PC 열기) ·
        터널 주소가 전부 통과했다. 7/28 하루에 새 기기 120대가 쌓인 것이 그 결과다.
        그래서 방향을 뒤집어 **우리 주소일 때만 보낸다**.
        ⚠️ 배포 주소를 옮기면 PROD_HOSTS 를 반드시 같이 고칠 것. 안 고치면 통계가
           조용히 멎는다 — tools/check_stats_host.py 가 배포를 막아 준다.

     ⚠️ 베타 의견(FEEDBACK)은 이용자가 스스로 누른 것이라 여기서 막지 않는다.
        (우리가 검사로 보낸 의견은 서버가 기기ID로 걸러 낸다) */
  const CID_KEY = "riweather.cid";
  const DEV_KEY = "riweather.dev";
  const QUEUE_KEY = "riweather.statq";
  const FORBIDDEN = /lat|lon|coord|위도|경도|gps/i;   // 좌표성 데이터 방어벽

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} },
  };
  const rawCid = () => ls.get(CID_KEY) || "";
  const rnd = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  // ① 우리 배포 주소에서만 보낸다
  const PROD_HOSTS = ["brownrigoon-commits.github.io"];
  const onProd = location.protocol === "https:" &&
                 PROD_HOSTS.indexOf(location.hostname) >= 0 &&
                 location.pathname.indexOf("/Ri-weather/") === 0;

  /* ② ?dev=1 — 표시를 저장소와 **기기ID 양쪽에** 남긴다.
     저장소(riweather.dev)는 브라우저 정리·?reset=hard 로 사라지지만
     dev- 로 시작하는 기기ID 는 서버가 알아본다. 한쪽이 지워져도 다른 쪽이 남는다. */
  try {
    const m = /[?&]dev=([01])/.exec(location.search);
    if (m) {
      const cur = rawCid();
      if (m[1] === "1") {
        ls.set(DEV_KEY, "1");
        ls.del(QUEUE_KEY);                       // 표시 전에 모아 둔 것도 보내지 않는다
        if (!/^dev-/.test(cur)) ls.set(CID_KEY, "dev-" + (cur || rnd()));
      } else {
        ls.del(DEV_KEY);
        if (/^dev-(wd-)?/.test(cur)) ls.set(CID_KEY, cur.replace(/^dev-(wd-)?/, ""));
      }
      /* 표시를 적용했으면 주소창에서 ?dev= 를 지운다.
         안 지우면 사장님이 주소를 그대로 복사해 카톡으로 보낼 때 받는 사람까지
         '우리 기기'로 찍혀 통계에서 사라진다(2026-08-02 반박 검증에서 지적). */
      try {
        var q = location.search.replace(/[?&]dev=[01]/, "").replace(/^&/, "?");
        history.replaceState(null, "", location.pathname + q + location.hash);
      } catch (_) {}
    }
  } catch (_) {}
  /* ⚠️ dev-wd- 는 '우리 기기'가 아니라 '자동화 추측'이라 여기서 빼야 한다.
        (?!wd-) 를 빼면 아래 ③의 '보내되 표시한다'가 통째로 무력해진다. */
  const devDevice = ls.get(DEV_KEY) === "1" || /^dev-(?!wd-)/.test(rawCid());

  /* ③ 자동화 브라우저(헤드리스). 검사 스크립트는 실행할 때마다 저장소가 비어 있어
     매번 새 기기로 잡힌다 — 7/28 무더기의 정체가 이것이다.
     ⚠️ 반드시 `=== true` 로 본다. `!== false` 로 쓰면 이 속성이 없는 옛 사파리·
        안드로이드 웹뷰·카톡 인앱 브라우저가 통째로 빠져 진짜 이용자를 잃는다. */
  let robot = false;
  try {
    robot = navigator.webdriver === true || /HeadlessChrome|PhantomJS/i.test(navigator.userAgent);
  } catch (_) {}
  if (robot && !/^dev-wd-/.test(rawCid())) {
    ls.set(CID_KEY, "dev-wd-" + (rawCid().replace(/^dev-/, "") || rnd()));
    ls.del(QUEUE_KEY);                           // 표시 전 큐는 옛 기기ID를 달고 있다
  }

  /* 왜 껐는지 남긴다 — 콘솔에서 바로 보이고 검사 스크립트가 이 값을 확인한다.
     '조용히 빼지 않는다'를 수집 단계에도 적용한 것. */
  const OFF = !onProd ? "not-prod" : devDevice ? "dev-device" : "";
  window.RIW_STATS_OFF = OFF;
  window.RIW_STATS_MARK = robot ? "wd" : "";
  const STATS_URL = OFF ? "" : window.RIW_BACKEND;

  function cid() {
    let v = rawCid();
    if (!v) { v = rnd(); ls.set(CID_KEY, v); }
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
    // ⚠️ 골프장 이름은 숫자 좌표 모양만 막는다 — 글자 검사를 대면 PLATEAU 처럼
    //    'lat' 이 우연히 든 진짜 구장이 통째로, 조용히 안 세어진다(2026-08-02 재검증).
    if (FORBIDDEN.test(ev) || FORBIDDEN.test(reg)) return;
    if (/\d{2,}\.\d{3,}/.test(reg) || /\d{2,}\.\d{3,}/.test(name)) return;   // 숫자 좌표처럼 생긴 건 무조건 버린다
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
    /* 우리 접속(로컬 미리보기·?dev=1 기기)에서 보낸 의견은 기기ID에 표시를 얹어 보낸다.
       의견 자체는 막지 않는다 — 우리도 폰에서 끝까지 눌러 시험해 볼 수 있어야 한다.
       대신 관리자 화면의 목록·건수에서 서버가 이 표시를 보고 걸러 낸다(2026-08-02).
       진짜 이용자는 늘 배포 주소로 열므로 여기 걸리지 않는다. */
    // 기기ID가 아직 없어도(앱을 연 적 없는 브라우저) 표시는 붙는다 — 빈 ID 로 새면 못 걸러낸다
    if (window.RIW_STATS_OFF && !/^dev-/.test(cid)) cid = "dev-" + (cid || "anon");
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
