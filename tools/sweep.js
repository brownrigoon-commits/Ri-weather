(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const bugs = [];
  const add = (kind, where, detail) => bugs.push({ kind, where, detail });

  // 런타임 오류 수집
  const errs = [];
  window.addEventListener("error", e => e.message && errs.push(e.message));
  window.addEventListener("unhandledrejection", e => errs.push(String(e.reason && (e.reason.message || e.reason))));

  /* ── 0. 스크립트가 살아 있는지부터 ─────────────────────────────
     app.js 에 문법 오류가 하나라도 있으면 파일 전체가 실행되지 않는다.
     그런데 DOM 은 그대로라 화면 검사는 통과해버린다(2026-07-27 실제로 놓쳤음).
     그래서 각 파일의 대표 전역이 실제로 존재하는지를 가장 먼저 확인한다. */
  const MUST = {
    "js/app.js": ["APP_VER", "renderHome", "wmoClass", "wxScene", "BACKUP", "loadScores", "loadCourses", "FB_UI"],
    "js/clubfit.js": ["openClubfitView", "loadMyBag", "__cfTest"],
    "js/loading.js": ["WAIT", "staggerIn"],
    "js/weatherfx.js": ["WXFX"],
    "js/stay.js": ["openStayView", "fetchKakaoStay", "stayKind", "bookingLinks", "stayCache", "STAY_VIEW"],
    "js/booking.js": ["openBookingView", "golfpangUrl", "golfmonUrl", "bookingLinkCards", "BOOKING_VIEW"],
    "js/bookingids.js": ["BOOKING_IDS"],
    "js/spirit.js": ["openSpiritView", "SPIRIT_VIEW", "todayQuote", "renderQuoteCard"],
    "js/spiritdb.js": ["SPIRIT_DB", "QUOTES_DB"],
    "js/legal.js": ["CONSENT"],
    "js/stats.js": ["STATS", "FEEDBACK"],
    /* 2026-07-31 G7 — 데이터 파일도 여기 넣는다. 여태 golfdb/holeimgdb/clubdb 는
       이 표에 없어서, 문법 오류로 통째로 죽어도 sweep 이 직접 잡지 못했다.
       (국가별 파일 분리 작업을 앞두고 가장 먼저 막아야 할 구멍) */
    /* 문구 사전 — 이게 안 실리면 화면이 통째로 키(home.title 같은 글자)로 도배된다 */
    "js/i18n.js": ["I18N", "tr"],
    "js/i18n/ko.js": [],
    "js/golfdb.js": ["GOLF_DB"],
    "js/holesdb.js": ["HOLES_DB"],
    "js/holeimgdb.js": ["HOLEIMG_DB"],
    "js/clubdb.js": ["CLUBDB"],
  };
  for (const file in MUST) {
    for (const name of MUST[file]) {
      let ok = false;
      try { ok = (eval("typeof " + name) !== "undefined"); } catch (_) { ok = false; }
      if (!ok) add("스크립트가 실행되지 않음(문법 오류 의심)", file, name + " 없음");
    }
  }
  // 실제 파싱까지 확인 — 문법 오류를 메시지째 잡아낸다
  for (const file in MUST) {
    try {
      const t = await (await fetch("/" + file + "?x=" + Date.now())).text();
      try { new Function(t); } catch (e) { add("문법 오류", file, e.message); }
    } catch (_) { add("파일을 받지 못함", file, ""); }
  }

  /* ── 0-b. 데이터가 '반토막'으로 실린 건 아닌지 (2026-07-31 G7) ───
     전역이 있다고 내용이 온전한 게 아니다. 조립기가 중간에 실패하거나 파일이
     잘려도 선언부만 살아 있으면 위 검사는 그대로 통과한다.
     그래서 건수 하한을 함께 본다. **하한은 느슨하게** 잡는다 — 오등록 구장을
     지우는 정상 작업(2026-07-30 232→231)까지 막으면 안 되기 때문이다.
     KR 항목의 '한 건도 변하지 않았음'은 여기가 아니라 tools/check_golfdb_kr.py
     (배포 관문)가 정확히 본다. 여기서 잡을 것은 '반토막' 뿐이다.
     실측 기준(2026-07-31): GOLF_DB 2,984(KR 635·JP 2,014·CN 335) ·
     HOLEIMG_DB 231구장 · CLUBDB.SHAFTS 876 · IRON_SHAFTS 322 */
  const MIN = [
    ["GOLF_DB 전체", () => GOLF_DB.length, 2900],
    ["GOLF_DB 한국분", () => GOLF_DB.filter(x => x.c === "KR").length, 600],
    ["HOLEIMG_DB 구장수", () => Object.keys(HOLEIMG_DB).length, 220],
    ["CLUBDB.SHAFTS", () => CLUBDB.SHAFTS.length, 800],
    ["CLUBDB.IRON_SHAFTS", () => CLUBDB.IRON_SHAFTS.length, 300],
  ];
  for (const [label, get, min] of MIN) {
    let n = -1;
    try { n = get(); } catch (_) { n = -1; }
    if (!(n >= min)) add("데이터가 반토막으로 실렸습니다", label, `${n}건 (하한 ${min})`);
  }
  /* 일본 홀맵(HOLEIMG_DB_JP)은 Phase 5 에서 생긴다. 생기면 위 MUST·MIN 에 함께 넣을 것 —
     넣지 않으면 지연 로드 실패가 '코스공략 준비중'으로만 보여 조용히 묻힌다. */

  /* ── 1. 클럽 피팅 엔진 전수 조합 (조용한 논리 오류 잡기) ───────── */
  const V = {
    carry7: [110, 130, 150, 165, 185],
    carryD: [150, 200, 240, 290],
    shapeD: ["slice", "fade", "straight", "draw", "hook"],
    endur: ["strong", "fadeLate", "weak"],
    brand: ["타이틀리스트", "핑", "던롭", "any"],
    shaftBrand: ["후지쿠라", "그라파이트디자인", "UST마미야", "any"],
    curShaft: ["unknown", "stock", "s50s", "s60x"],
    complaint: ["dist", "dir", "traj", "feel", "none"],
    budget: ["stock", "mid", "any"],
    scoreGrp: ["80", "90", "100"],
    heightV: [155, 172, 190],
    /* 2026-07-30 추가 — 구력·주 플레이가 실제로 엔진에 물렸다.
       예전엔 career 에 없는 값("5y")을 넣어 구력 규칙이 한 번도 안 돌았다. */
    career: ["lt3", "y3_10", "gt10"],
    venue: ["field", "screen", "both"],
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  /* 요약(세 문장)에 내부 코드값이 새는지 — 이 조합에서 실제로 쓴 영문 값만 본다 */
  const codesOf = (o) => {
    const out = [];
    const walk = (x) => { if (typeof x === "string") { if (/^[a-z][a-zA-Z0-9_]{1,}$/.test(x)) out.push(x); }
      else if (x && typeof x === "object") Object.values(x).forEach(walk); };
    walk(o); return out;
  };
  const checkTldr = (t, where, inp) => {
    if (!t || !t.read || !t.fix) { add("요약이 비어 있음", where, JSON.stringify(t)); return; }
    [t.read, t.fix, t.act].filter(Boolean).forEach(line => {
      if (/undefined|null|NaN|\[object/.test(line)) add("요약에 빈 값 노출", where, line.slice(0, 80));
      codesOf(inp).forEach(c => {
        if (new RegExp(`(^|[^A-Za-z0-9])${c}([^A-Za-z0-9]|$)`).test(line))
          add("요약에 내부 코드값 노출", where, c + " → " + line.slice(0, 60));
      });
    });
  };
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const inp = { scoreConfirm: "ok", tempo: pick(["smooth","normal","fast"]),
      traj: pick(["low","mid","high",null]), shapeI: pick(["slice","straight","hook",null]),
      auto: { age: pick(["30대","50대","60대 이상",null]), sex: null,
              avg: pick([79, 88, 95, 108, null]), fade: pick([0, 2, 4, null]) } };
    for (const k in V) inp[k] = pick(V[k]);
    try {
      const d = __cfTest(inp);
      n++;
      // 결과에 값이 비어 있으면 화면에 "undefined"가 찍힌다
      if (!d.shaft1 || /undefined|null|NaN/.test(d.shaft1)) add("드라이버 샤프트 비정상", JSON.stringify(inp), d.shaft1);
      if (!d.head || /undefined|null|NaN/.test(d.head)) add("드라이버 헤드 비정상", JSON.stringify(inp), d.head);
      if (!/^\d+~\d+g/.test(d.band)) add("무게 밴드 형식 오류", JSON.stringify(inp), d.band);
      const [lo, hi] = d.band.match(/\d+/g).map(Number);
      if (lo > hi) add("무게 밴드 역전", JSON.stringify(inp), d.band);
      if (lo < 20 || hi > 110) add("무게 밴드 범위 이탈", JSON.stringify(inp), d.band);

      /* ironLook(어드레스 취향)을 꼭 섞는다 — 실력 게이트가 없던 시절 초심자용 헤드가
         1순위로 나가던 60개 조합이 전부 look=forgiving 이었다. 이걸 안 섞으면
         게이트가 사라져도 이 검사가 영영 못 잡는다. */
      const ir = __cfTest({ ...inp, ironMiss: pick(["thin","fat","dir","none"]),
        ironMat: pick(["unsure","스틸","그라파이트"]), ironFeel: pick(["soft","solid","light","any"]),
        ironLook: pick([null, "classic", "forgiving"]),
        ironComplaint: pick(["dist","dir","forg","feel","none"]) }, "iron");
      if (!ir.shaft1 || /undefined/.test(ir.shaft1)) add("아이언 샤프트 비정상", JSON.stringify(inp), ir.shaft1);
      if (!ir.head || /undefined/.test(ir.head)) add("아이언 헤드 비정상", JSON.stringify(inp), ir.head);
      if (ir.target < 40 || ir.target > 160) add("아이언 목표무게 이상", JSON.stringify(inp), ir.target);
      /* 실력 게이트(2026-07-30 사장님 지적) — 평균 80대 이하에게 초심자용 맥스 관용성
         헤드(forg 5)가 나가면 피팅 신뢰가 무너진다. 어떤 미스·취향 조합에서도 컷이어야 한다.
         반대로 100타 이상에게 블레이드급(forg 2)이 나가도 잡는다. */
      if (inp.scoreGrp === "80") {
        if (d.headForg > 4) add("80대 이하에 초심자용 드라이버 헤드", JSON.stringify(inp), d.head);
        if (ir.headForg > 4) add("80대 이하에 초심자용 아이언 헤드", JSON.stringify(inp), ir.head);
      }
      if (inp.scoreGrp === "100" && ir.headForg < 3)
        add("100타 이상에 블레이드급 아이언 헤드", JSON.stringify(inp), ir.head);

      const we = __cfTest({ ...inp, pwLoft: pick([41,43,45,46,48]),
        wedgeTurf: pick(["dig","sweep","mid"]), wedgeMiss: pick(["fat","thin","none"]) }, "wedge");
      if (!we.lofts.length) add("웨지 구성 없음", JSON.stringify(inp), we);
      // 로프트는 오름차순이어야 하고 마지막은 58도
      for (let k = 1; k < we.lofts.length; k++)
        if (we.lofts[k] <= we.lofts[k-1]) add("웨지 로프트 순서 오류", JSON.stringify(inp), we.lofts);
      if (we.lofts[we.lofts.length-1] !== 58) add("웨지 최종 로프트 != 58", JSON.stringify(inp), we.lofts);
      we.bounces.forEach(b => { if (b < 4 || b > 14) add("웨지 바운스 범위 이탈", JSON.stringify(inp), b); });

      const pu = __cfTest({ ...inp, puttStroke: pick(["straight","slight","arc"]),
        puttMiss: pick(["dist","dir","none"]), puttLook: pick(["blade","mallet","any"]) }, "putter");
      if (!pu.model || /undefined/.test(pu.model)) add("퍼터 모델 비정상", JSON.stringify(inp), pu.model);
      if (pu.len < 32 || pu.len > 36) add("퍼터 길이 이상", JSON.stringify(inp), pu.len);

      /* 볼 (2026-07-30 신설) — 커버·컴프레션 성향이 표에 있는 값으로만 나와야 한다.
         ⚠️ 컴프레션 **수치**는 제조사 비공개라 절대 숫자로 나오면 안 된다(절대 원칙 2). */
      const ba = __cfTest({ ...inp, ball: pick(["urethane","mid","distance","any","unknown"]),
        ballLost: pick(["few","some","many"]), ballShort: pick(["roll","control","none"]),
        ballShape: pick(["slice","straight","hook"]), ballFeel: pick(["soft","firm","any"]),
        ballCold: pick(["yes","no"]), ballFind: pick(["often","rare"]) }, "ball");
      if (!ba.model || /undefined|null|NaN/.test(ba.model)) add("볼 모델 비정상", JSON.stringify(inp), ba.model);
      if (!["우레탄", "아이오노머"].includes(ba.cover)) add("볼 커버 값 이상", JSON.stringify(inp), ba.cover);
      if (!["소프트", "미드", "펌"].includes(ba.feel)) add("볼 컴프레션 성향 값 이상", JSON.stringify(inp), ba.feel);
      if (/컴프레션\s*\d/.test(JSON.stringify(ba))) add("컴프레션을 숫자로 표기(제조사 비공개값)", JSON.stringify(inp), JSON.stringify(ba).slice(0, 80));

      // 요약 세 문장 — 다섯 클럽 모두
      checkTldr(d.tldr, "driver", inp); checkTldr(ir.tldr, "iron", inp);
      checkTldr(we.tldr, "wedge", inp); checkTldr(pu.tldr, "putter", inp);
      checkTldr(ba.tldr, "ball", inp);
    } catch (e) { add("엔진 예외", JSON.stringify(inp), e.message); }
  }

  /* ── 1-2. 선호 브랜드 우선 추천 — 36조합 ─────────────────────────
     "선호 브랜드가 있으면 무조건 그 안에서 1순위" 가 사장님 확정 원칙이다.
     점수 가드 때문에 핑을 골라도 타이틀리스트가 나오던 버그가 있었다(2026-07-27). */
  const CLUB_B = ["타이틀리스트", "테일러메이드", "캘러웨이", "핑", "던롭", "any"];
  const SHAFT_B = ["후지쿠라", "그라파이트디자인", "미쓰비시", "프로젝트X", "UST마미야", "any"];
  const bb = { career: "5y", scoreConfirm: "ok", scoreGrp: "80", heightV: 175, tempo: "normal",
    budget: "any", carry7: 165, carryD: 250, shapeD: "fade", endur: "strong",
    curShaft: "unknown", complaint: "dist", auto: { age: null, sex: null, avg: null, fade: null } };
  /* 실력 게이트(2026-07-30)와 부딪히는 브랜드 — 데모 표 기준 상급자용(forg≤4)
     드라이버가 없는 브랜드. bb 가 scoreGrp "80" 이므로 이 브랜드들은 **브랜드를 접고
     실력을 따르는 것이 정답**이고, 대신 "왜 못 지켰는지" 안내문이 반드시 있어야 한다. */
  const NO_ADV_DRV = ["던롭", "테일러메이드"];
  CLUB_B.forEach(b => SHAFT_B.forEach(sb => {
    try {
      const r = __cfTest({ ...bb, brand: b, shaftBrand: sb });
      const gated = NO_ADV_DRV.includes(b);
      if (b !== "any" && !gated && r.head.split(" ")[0] !== b)
        add("헤드가 선호 브랜드를 무시함", "선호=" + b, "나온것=" + r.head);
      if (gated && !(r.notes || []).some((h) => /상급자용 헤드가 없/.test(h)))
        add("게이트로 브랜드를 못 지켰는데 안내가 없음", "선호=" + b, "나온것=" + r.head);
      if (sb !== "any" && r.shaftBrand1 !== sb)
        add("샤프트가 선호 브랜드를 무시함", "선호=" + sb, "나온것=" + r.shaftBrand1);
      if (!r.shaftAlt) add("다른 브랜드 대안이 없음", "샤프트 " + b + "/" + sb, "");
      if (!gated && !r.headAlt) add("다른 브랜드 대안이 없음", "헤드 " + b + "/" + sb, "");
    } catch (e) { add("브랜드 조합 예외", b + "/" + sb, e.message); }
  }));


  /* ── 1-2b. 아이언·웨지·퍼터도 선호 브랜드가 1순위인지 ─────────────
     드라이버만 검사하고 있어서, 세 클럽은 브랜드를 무시해도 통과했다.
     특히 표에 단종(st:"old") 모델뿐인 브랜드(핑 아이언·클리브랜드 웨지)는
     '현행 먼저' 규칙에 밀려 선호가 통째로 무시됐다(2026-07-29 적발). */
  const BRAND_CASES = [
    // 마지막 배열 = 실력 게이트 때문에 브랜드를 접는 게 정답인 브랜드(데모 표 기준, bb=80대)
    ["iron", "ironBrand", ["타이틀리스트", "핑", "테일러메이드", "캘러웨이", "미즈노", "던롭"],
      (r) => r.head, { ironMiss: "thin", ironMat: "unsure", ironFeel: "any" }, ["던롭"]],
    ["wedge", "wedgeBrand", ["타이틀리스트", "클리브랜드", "핑", "테일러메이드", "캘러웨이", "미즈노"],
      (r) => r.model, { pwLoft: 45, wedgeTurf: "mid", wedgeMiss: "none" }, []],
    ["putter", "putterBrand", ["스카티카메론", "오디세이", "테일러메이드", "핑"],
      (r) => r.model, { puttStroke: "arc", puttMiss: "dist", puttLook: "any" }, []],
  ];
  BRAND_CASES.forEach(([club, key, brands, get, extra, gatedBrands]) => brands.forEach((b) => {
    try {
      const r = __cfTest({ ...bb, ...extra, [key]: b }, club);
      const got = get(r) || "";
      const gated = (gatedBrands || []).includes(b);
      if (!gated && got.split(" ")[0] !== b)
        add(club + " 추천이 선호 브랜드를 무시함", "선호=" + b, "나온것=" + got);
      if (gated && !(r.notes || []).some((h) => /상급자용 아이언이 없/.test(h)))
        add("게이트로 브랜드를 못 지켰는데 안내가 없음", club + " " + b, "나온것=" + got);
    } catch (e) { add(club + " 브랜드 검사 예외", b, e.message); }
  }));

  /* ── 2. 모든 화면 렌더 (오류·깨진 문자열) ───────────────────── */
  const views = ["home","hub","detail","course","food","stay","booking","score","clubfit","spirit"];
  for (const v of views) {
    try {
      const el = document.querySelector("#" + v + "-view");
      if (!el) { add("화면 없음", v, ""); continue; }
      views.forEach(x => { const e2 = document.querySelector("#"+x+"-view"); if (e2) e2.hidden = x !== v; });
      await sleep(60);
      const t = el.innerText || "";
      ["undefined","NaN","[object Object]"].forEach(bad => {
        if (t.includes(bad)) add("화면에 " + bad + " 노출", v, t.slice(t.indexOf(bad)-40, t.indexOf(bad)+40));
      });
    } catch (e) { add("화면 렌더 예외", v, e.message); }
  }

  /* ── 3. 대기 화면 문구 세트 점검 ─────────────────────────────── */
  for (const k in WAIT.SCRIPTS) {
    const s = WAIT.SCRIPTS[k];
    if (!s.msgs || !s.msgs.length) add("대기 문구 없음", k, "");
    (s.msgs||[]).forEach(m => { if (m.length > 26) add("대기 문구 너무 김(줄바뀜 위험)", k, m); });
  }

  /* ── 3-2. 클럽 피팅 전 화면 순회 — 재단 용어가 새는지 확인 ─────
     주의: 칩 화면은 고른 순간 스스로 넘어간다.
     '다음 버튼이 없으면 끝'이라고 보면 두 화면만 보고 끝나버린다(실제로 그랬음).
     화면이 바뀌었는지를 기준으로 계속 돈다. */
  for (const club of ["driver", "iron", "wedge", "putter"]) try {
    openClubfitView();
    await sleep(300);
    /* 첫 화면은 클럽 고르기 타일이다. 칩만 누르던 시절 코드로는 여기서 막혀
       "방문 1개"로 끝나면서 나머지 화면을 하나도 못 봤다(2026-07-29 적발). */
    const tile = document.querySelector(`#cf-screen .cf-club-tile[data-club="${club}"]`);
    if (!tile) { add("클럽 선택 타일이 없음", club, ""); continue; }
    tile.click();
    await sleep(300);

    let visited = 0, stuck = 0, last = "", sawBrand = false;
    const badWords = ["가봉", "본봉", "시침", "본박음"];
    for (let i = 0; i < 60 && stuck < 3; i++) {
      const eye = (document.querySelector("#cf-screen .q-eyebrow") || {}).innerText || "";
      const stage = (document.querySelector("#cf-stage") || {}).textContent || "";
      const screen = (document.querySelector("#cf-screen") || {}).innerText || "";
      const sig = eye + "|" + stage + "|" + screen.slice(0, 40);
      if (sig === last) { stuck++; } else { stuck = 0; visited++; }
      last = sig;
      if (/선호하는 브랜드가/.test(screen)) sawBrand = true;

      badWords.forEach(w => {
        if (stage.includes(w)) add("진행 표시에 재단 용어", stage, eye);
        if (screen.includes(w)) add("화면 문구에 재단 용어", eye, screen.slice(0, 70));
      });

      const groups = [...document.querySelectorAll("#cf-screen .chips")];
      groups.forEach(g => {
        const c = g.querySelector('.chip[aria-pressed="true"]') ? null : g.querySelector(".chip");
        if (c) c.click();
      });
      await sleep(300);                       // 칩 자동 넘김(220ms) 을 기다린다
      const nb = document.querySelector("#cf-screen .cf-btn[data-next]:not(:disabled)")
              || document.querySelector("#cf-screen [data-useprofile]");   // 프로필 확인 화면
      const sk = document.querySelector("#cf-screen [data-skip]");
      const jp = document.querySelector('#cf-screen [data-jump="bag"]');
      if (nb) nb.click();
      else if (sk) sk.click();
      else if (jp) jp.click();
      /* 다음 버튼이 없는 '고르면 바로 넘어가는' 화면인데 이미 다 선택돼 있으면
         아무 일도 안 일어나 순회가 거기서 멈춘다(2026-07-29 실제로 그랬다).
         같은 칩을 다시 눌러도 넘어가므로 그렇게 뚫는다. */
      else if (groups.length) groups[groups.length - 1].querySelector(".chip").click();
      await sleep(120);
      if (document.querySelector(".rw-wait")) { WAIT.close(true); await sleep(140); }
    }
    if (visited < 6) add("피팅 화면 순회가 너무 일찍 끝남(검사 부실)", club, "방문 " + visited + "개");
    /* 선호 브랜드 질문은 반드시 거쳐야 한다.
       선택 단계에 두었더니 대부분 질문을 못 받고 지나가 기능이 죽어 있었다(2026-07-27). */
    if (!sawBrand) add("선호 브랜드 질문을 거치지 않음", club, "방문 " + visited + "개");

    /* 판정 화면이 뜨기까지 2.4초 기다리는 동안 다른 버튼을 누르면 어떻게 되는지.
       예약된 그리기가 없어진 화면을 그리려다 앱이 깨진 적이 있다(2026-07-29). */
    const restart = document.querySelector("#cf-screen [data-restart], #cf-screen [data-jump='pick']");
    if (restart) {
      restart.click();
      await sleep(200);
      const jump = document.querySelector("#cf-screen .cf-club-tile[data-club='driver']");
      if (jump) jump.click();
      await sleep(3000);                       // 예약된 그리기(2.4초)가 지나가도록
      if (document.querySelector(".rw-wait")) WAIT.close(true);
      if (!document.querySelector("#cf-screen .q-title, #cf-screen .cf-club-tile"))
        add("판정 대기 중 화면을 옮기면 피팅이 깨짐", club, "cf-screen 이 비었음");
    }
  } catch (e) { add("피팅 화면 순회 예외", club, e.message); }

  /* ── 3-3. 백업·복구가 서버에서 실제로 되는지 ─────────────────
     이걸 확인 안 해서 사장님이 기록을 잃었다(2026-07-27).
     '켜짐' 표시만 보고 넘어가지 말고, 저장한 것이 진짜 돌아오는지 매번 확인한다. */
  try {
    const B = window.RIW_BACKEND;
    if (!B) add("백엔드 주소 없음", "RIW_BACKEND", "");
    else {
      const code = "9" + String(Date.now()).slice(-11);      // 검사 전용 임시 코드
      const mark = "검사-" + code.slice(-4);
      const r1 = await fetch(B, { method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ fn: "backup", code, data: { v: 1, t: Date.now(),
          courses: [{ id: 1, name: mark }], scores: [] } }) });
      const save = await r1.json();
      if (!save || !save.ok) add("백업 저장 실패", "fn=backup", JSON.stringify(save));
      const r2 = await fetch(B + "?fn=restore&code=" + code);
      const load = await r2.json();
      if (load && load.service && !("data" in load))
        add("백엔드에 복구 기능이 배포되지 않음", "fn=restore", "Apps Script 새 버전 배포 필요");
      else if (!load || !load.ok || !load.data)
        add("복구 실패", "fn=restore", JSON.stringify(load));
      else if (((load.data.courses || [])[0] || {}).name !== mark)
        add("복구 내용 불일치", "fn=restore", JSON.stringify(load.data.courses));
    }
  } catch (e) { add("백업·복구 검사 예외", "backup", e.message); }

  /* ── 3-4. 하늘 카드 — 날씨별로 카드가 깨지지 않는지 ───────────────
     wx-cloud 를 '흐림 상태'와 '구름 요소' 양쪽에 써서 카드 전체가
     블러 처리된 사고가 있었다(2026-07-27). 16조합을 매번 확인한다. */
  try {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-9999px;top:0;width:340px";
    document.body.appendChild(host);
    [0, 2, 3, 45, 63, 73, 81, 95].forEach(code => {
      [1, 0].forEach(day => {
        const w = document.createElement("article");
        w.className = "course-card has-scene " + wmoClass(code) + (day ? "" : " is-night");
        w.style.cssText = "position:relative;height:105px";
        w.innerHTML = wxScene(code, day) + '<div class="cc-name">테스트</div>';
        host.appendChild(w);
        const cs = getComputedStyle(w);
        const tag = "code=" + code + (day ? " 낮" : " 밤");
        if (cs.filter !== "none") add("하늘 카드에 블러가 걸림", tag, cs.filter);
        if (cs.borderRadius === "50%") add("하늘 카드가 원형이 됨", tag, "");
        if (getComputedStyle(w.querySelector(".cc-name")).color !== "rgb(255, 255, 255)")
          add("하늘 카드 글자색이 흰색이 아님", tag, "");
        [...w.querySelectorAll(".wx-puff")].forEach(p => {
          const h = p.getBoundingClientRect().height;
          if (h > 60) add("구름이 카드보다 큼", tag, Math.round(h) + "px");
        });
        w.remove();
      });
    });
    host.remove();
  } catch (e) { add("하늘 카드 검사 예외", "wxScene", e.message); }

  /* ── 3-5. 비·눈이 실제로 그려지는지 ──────────────────────────── */
  try {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-9999px;top:0;width:340px";
    document.body.appendChild(host);
    for (const [code, label] of [[63, "비"], [95, "뇌우"], [73, "눈"]]) {
      const w = document.createElement("article");
      w.className = "course-card has-scene " + wmoClass(code);
      w.style.cssText = "position:relative;height:105px";
      w.innerHTML = wxScene(code, 1);
      host.appendChild(w);
      WXFX.scan(w);
      WXFX._frame(0.05);
      const cv = w.querySelector("canvas.wx-fx");
      if (!cv) { add("하늘 효과 캔버스가 없음", label, ""); continue; }
      if (!cv.width) { add("하늘 효과 캔버스 크기가 0", label, ""); continue; }
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      let lit = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 6) lit++;
      const pct = lit / (cv.width * cv.height) * 100;
      if (pct < 0.15) add("하늘 효과가 거의 안 그려짐", label, pct.toFixed(2) + "%");
      w.remove();
    }
    host.remove();
    WXFX.sweep();
  } catch (e) { add("하늘 효과 검사 예외", "WXFX", e.message); }

  /* ── 3-6. 숙박 — 예약 링크가 제대로 만들어지는지 ────────────── */
  try {
    // bookingLinks 는 숙소 '객체'를 받는다 — 문자열을 넘기면 검색어가 빈 채로 통과한다
    const ls = bookingLinks({ name: "웰리힐리파크", addr: "강원 횡성군 둔내면", kind: "리조트" });
    if (ls.length < 3) add("예약 링크 개수 부족", "stay", ls.length);
    ls.forEach(([t, u]) => {
      if (!/^https:\/\//.test(u)) add("예약 링크 형식 오류", t, u);
      if (!/=[^&]+/.test(u.split("?")[1] || "")) add("예약 링크에 검색어가 안 들어감", t, u);
    });
    ["호텔 신라", "OO리조트", "행복펜션", "굿모텔", "게스트하우스 봄", "글램핑장"]
      .forEach((c) => { if (!stayKind("", c)) add("숙소 종류 분류 실패", c, ""); });
  } catch (e) { add("숙박 검사 예외", "stay", e.message); }

  /* ── 3-6b. 숙박을 실제로 끝까지 돌려본다 ────────────────────────
     ⚠️ 이걸 안 만들어서 사고가 났다(2026-07-29).
     날짜·인원 화면을 걷어낼 때 stayCache 선언이 같이 지워졌는데,
     링크 만들기·분류 같은 '조각 검사'만 하고 있어서 전부 통과했고
     사장님 폰에서는 숙박 메뉴가 통째로 "불러오지 못했습니다"만 떴다.
     조각이 아니라 사장님이 실제로 누르는 경로를 그대로 돌린다. */
  try {
    const tc = { name: "알프스대영CC", lat: 37.4612973730308, lon: 128.074450027055 };
    const list = await fetchKakaoStay(tc);          // ReferenceError 는 여기서 잡힌다
    if (!list.length) add("숙박 검색 결과 0곳", "fetchKakaoStay", tc.name);
    else {
      const bad = list.find((x) => !x.name || !x.id || !(x.dist >= 0));
      if (bad) add("숙소 항목이 비어 있음", "fetchKakaoStay", JSON.stringify(bad));
      const shown = await attachPhotos(list.slice(0, 6), "stay");
      if (!shown.length) add("숙소 사진을 한 장도 못 받음", "attachPhotos(stay)", list.length + "곳 중 6곳 시도");
      const host = document.createElement("div");
      host.id = "stay-list";
      host.style.cssText = "position:fixed;left:-9999px;top:0;width:360px";
      const real = document.querySelector("#stay-list");
      if (real) real.id = "stay-list-real";
      document.body.appendChild(host);
      try {
        renderStayList(shown.length ? shown : list.slice(0, 6), tc);
        const t = host.innerText || "";
        if (!t.trim()) add("숙박 목록이 비어 있음", "renderStayList", "");
        ["undefined", "NaN", "[object Object]"].forEach((w) => {
          if (t.includes(w)) add("숙박 목록에 " + w + " 노출", "renderStayList", t.slice(0, 80));
        });
        if (/예약 가능/.test(t))
          add("날짜별 빈방을 모르는데 '예약 가능'이라 표기", "renderStayList", "");
      } finally {
        host.remove();
        if (real) real.id = "stay-list";
      }
    }
  } catch (e) { add("숙박이 끝까지 돌지 않음", "숙박 메뉴 전체", e.message); }

  /* ── 3-7. 허브 메뉴가 전부 '보이는 화면'으로 이어지는지 ──────────
     ⚠️ 2026-07-30: 부킹 화면을 만들고 VIEWS 등록부에 넣는 걸 빠뜨려서
     메뉴를 눌러도 하얀 화면만 떴다. DOM 에는 내용이 다 있는데 hidden 이라
     '내용이 있는지'만 보는 검사로는 절대 안 잡힌다. **보이는지**를 본다. */
  try {
    const menus = [...document.querySelectorAll(".hub-item")].map((b) => b.dataset.menu);
    if (menus.length < 6) add("허브 메뉴 수가 줄었음", "hub", menus.join(","));
    for (const m of menus) {
      const id = { weather: "detail", course: "course", food: "food", stay: "stay",
                   score: "score", booking: "booking", clubfit: "clubfit", spirit: "spirit" }[m];
      if (!id) { add("허브 메뉴에 대응 화면이 없음", m, ""); continue; }
      if (typeof VIEWS === "undefined" || !VIEWS[id])
        add("VIEWS 등록부에 없음(눌러도 하얀 화면)", m, id + "-view");
      const el = document.querySelector("#" + id + "-view");
      if (!el) add("화면 요소가 없음", m, id + "-view");
    }
  } catch (e) { add("허브 메뉴 검사 예외", "hub", e.message); }

  /* ── 3-8. 부킹 — 링크가 제대로 만들어지는지 ─────────────────────
     티타임·요금을 우리가 옮겨 적지 않으므로, 이 화면의 품질 = 링크의 정확성이다. */
  try {
    const ymd = "2026-08-01";
    // ⚠️ "파주" 는 번호표에 "파주CC" 로 들어 있다. 이름을 통째로 비교하던 시절
    //    사장님 폰의 "파주" 가 폴백으로 떨어졌다(2026-07-30) → 핵심이름 매칭을 검사한다.
    const known = { name: "솔라고컨트리클럽" };
    const shortName = { name: "파주" };               // 업종어 없는 이름도 찾아야 한다
    const unknown = { name: "없는골프장XYZ" };        // 폴백으로 떨어져야 하는 구장
    if (!bookingIdOf(shortName)) add("업종어 없는 이름으로 번호를 못 찾음", "파주", "핵심이름 매칭 확인");
    if (bookingIdOf(unknown)) add("없는 구장인데 번호를 찾아냄", "없는골프장XYZ", "");
    for (const [c, tag] of [[known, "번호있음"], [shortName, "짧은이름"], [unknown, "번호없음"]]) {
      for (const mode of ["booking", "join"]) {
        const cards = bookingLinkCards(c, ymd, mode);
        if (cards.length < 2) add("부킹 링크 개수 부족", tag + "/" + mode, cards.length);
        cards.forEach((k) => {
          if (!/^https:\/\//.test(k.url)) add("부킹 링크 형식 오류", tag + " " + k.key, k.url);
          if (/undefined|null|NaN/.test(k.url)) add("부킹 링크에 빈 값이 샜음", tag + " " + k.key, k.url);
          if (/undefined/.test(k.title + k.sub)) add("부킹 카드 문구에 undefined", tag + " " + k.key, k.title);
        });
        const pang = cards.find((k) => /^pang_/.test(k.key));
        if (!pang) { add("골팡 카드가 없음", tag + "/" + mode, ""); continue; }
        /* 골팡: **항상 모바일 화면**(사장님 확정 2026-07-30 — "PC 화면은 정말 아니다").
           구장 딥링크(clubname)는 PC 화면에서만 되는데 그 경로를 폐기했으므로,
           clubname 이 보이면 PC 링크가 되살아났다는 뜻이다. 날짜(+지역)까지만 건다. */
        if (pang.url.indexOf("rd_date=" + ymd) < 0) add("골팡 링크에 날짜가 안 들어감", tag, pang.url);
        if (pang.url.indexOf("https://m.golfpang.com/") !== 0)
          add("골팡은 모바일 화면이어야 함(PC 폐기, 2026-07-30)", tag + "/" + mode, pang.url);
        if (pang.url.indexOf("clubname=") >= 0)
          add("골팡 PC 딥링크가 되살아남(쓰지 않기로 함)", tag + "/" + mode, pang.url);
        if (tag !== "번호없음" && pang.url.indexOf("sector=") < 0)
          add("번호가 있는데 지역이 안 걸림", tag + "/" + mode, pang.url);
        // 부킹이면 부킹 화면, 조인이면 조인 화면 — 모드와 화면이 어긋나면 안 된다
        const wantJoinPath = mode === "join" ? /join_main/ : /booking_main/;
        if (!wantJoinPath.test(pang.url))
          add("골팡 부킹/조인 경로가 모드와 다름", tag + "/" + mode, pang.url);
        const mon = cards.find((k) => /^mon_/.test(k.key));
        if (mode === "join" && mon.url.indexOf("golfFk=") >= 0 && mon.url.indexOf("tab=") < 0)
          add("골프몬 조인 탭이 안 걸림", tag, mon.url);
        if (tag === "번호없음" && mon.url.indexOf("golfFk=") >= 0)
          add("번호가 없는데 골프몬 번호를 지어냄", tag, mon.url);
      }
    }
    // 날짜 칸 문구는 달까지 — "화 4" 는 월말·월초에 헷갈린다
    if (bkDayLabel(new Date(2026, 7, 4)) !== "화 8/4")
      add("날짜 칸에 달이 빠짐", "bkDayLabel", bkDayLabel(new Date(2026, 7, 4)));

    // 조인 인원 — 골프몬에만 걸린다(골팡은 인원 필터가 없음). 실측 파라미터 이름 고정.
    for (const c of BK_JOIN_COUNTS) {
      const cards = bookingLinkCards(known, ymd, "join", c.v);
      const mon = cards.find((k) => k.key === "mon_join").url;
      const want = c.v ? "filterJoinCount=" + encodeURIComponent(c.v) : null;
      if (want && mon.indexOf(want) < 0) add("조인 인원이 골프몬 링크에 안 걸림", c.t, mon);
      if (!c.v && mon.indexOf("filterJoinCount") >= 0)
        add("전체인데 인원 조건을 붙임", c.t, mon);
      // 골팡에는 뜻을 확인 못 한 파라미터를 찍어 보내지 않는다
      const pang = cards.find((k) => k.key === "pang_join").url;
      if (/noma=|jitype=|filterJoinCount=/.test(pang))
        add("골팡에 확인 안 된 인원 파라미터를 보냄", c.t, pang);
    }
    // 번호표 자체 검산 — 숫자가 아니면 링크가 깨진다
    let bad = 0;
    for (const n in BOOKING_IDS) {
      const r = BOOKING_IDS[n];
      if (!(r.pang > 0) || !(r.sector > 0)) bad++;
      if ("mon" in r && !(r.mon > 0)) bad++;
    }
    if (bad) add("번호표에 잘못된 값", "bookingids.js", bad + "건");
    // 날짜 문자열 형식 (KST 기준으로 어제·내일이 되면 안 된다)
    const t = new Date(2026, 7, 1);
    if (bkYmd(t) !== "2026-08-01") add("날짜 문자열 형식 오류", "bkYmd", bkYmd(t));
  } catch (e) { add("부킹 링크 검사 예외", "booking", e.message); }

  /* ── 3-9. 부킹 화면을 실제로 열어본다 ─────────────────────────── */
  try {
    const keep = currentCourse;
    currentCourse = { name: "솔라고컨트리클럽", lat: 36.7648, lon: 126.3452 };
    await openBookingView();
    await sleep(600);
    const view = document.querySelector("#booking-view");
    if (view && view.hidden) add("부킹 화면이 열리지 않음(hidden)", "booking", "VIEWS 등록 확인");
    const body = document.querySelector("#booking-body");
    const txt = (body && body.innerText) || "";
    if (!txt.trim()) add("부킹 화면이 비어 있음", "booking", "");
    if (body && body.querySelectorAll(".bk-day").length !== 7)
      add("날짜 칸이 7개가 아님", "booking", body.querySelectorAll(".bk-day").length);
    if (body && !body.querySelector(".bk-day.on")) add("고른 날짜 표시가 없음", "booking", "");
    // 부킹/조인을 먼저 고르게 하는 화면 — 토글이 살아 있어야 한다
    if (body && body.querySelectorAll(".bk-mode").length !== 2)
      add("부킹/조인 선택이 없음", "booking", body.querySelectorAll(".bk-mode").length);
    if (body && !body.querySelector(".bk-mode.on")) add("부킹/조인 현재 선택 표시가 없음", "booking", "");
    /* 로고·제목 — 로고 칸이 들어오면서 가로가 좁아져 제목이 "…" 로 잘린 적이 있다(2026-07-30).
       그림이 실제로 그려졌는지(naturalWidth)와 제목이 잘리지 않았는지를 함께 본다. */
    if (body) {
      const imgs = [...body.querySelectorAll(".bk-card-ic img")];
      if (imgs.length < 2) add("연결처 로고가 없음", "booking", imgs.length);
      await Promise.all(imgs.map((im) => im.complete ? null : new Promise((res) => {
        im.onload = im.onerror = res; setTimeout(res, 1500);
      })));
      imgs.forEach((im) => {
        if (!im.naturalWidth) add("로고 그림이 안 뜸", im.getAttribute("src"), "파일 경로·배포 확인");
      });
      body.querySelectorAll(".bk-card-tx b").forEach((t) => {
        if (t.scrollWidth > t.clientWidth + 1) add("카드 제목이 잘림", t.innerText, t.scrollWidth + ">" + t.clientWidth);
      });
    }
    if (body) {
      const join = body.querySelector('.bk-mode[data-mode="join"]');
      if (join) {
        join.click(); await sleep(200);
        const u = [...body.querySelectorAll(".bk-card")].map((a) => a.href).join(" ");
        // 번호가 있으면 join_list(PC·구장까지), 없으면 join_main(모바일) — 둘 다 조인이다
        if (!/join_(list|main)/.test(u)) add("조인을 골랐는데 부킹으로 보냄", "booking", u.slice(0, 90));
        body.querySelector('.bk-mode[data-mode="booking"]').click(); await sleep(200);
      }
    }
    ["undefined", "NaN", "[object Object]"].forEach((w) => {
      if (txt.includes(w)) add("부킹 화면에 " + w + " 노출", "booking", txt.slice(0, 80));
    });
    // 요금·잔여 티타임을 우리 화면에 적으면 안 된다 (제휴 전)
    if (/\d{1,3},\d{3}원/.test(txt)) add("부킹 화면에 요금이 표시됨(제휴 전 금지)", "booking", txt.slice(0, 80));
    currentCourse = keep;
  } catch (e) { add("부킹 화면 검사 예외", "booking", e.message); }

  /* ── 3-10. 샷별 AI 캐디 — 파별 항목·응답 파싱·음성 전처리·제공 범위 ──
     실제 AI 호출은 하지 않는다(돈·한도). 호출 결과를 다루는 부분만 검사한다.
     설계: docs/코스공략_캐디_설계.md                                       */
  try {
    // (1) 파에 맞는 항목 구성 — 항목 수가 흔들리면 화면도 음성도 흔들린다
    const L3 = shotLabels(3, false), L4 = shotLabels(4, false), L5 = shotLabels(5, false);
    if (L3.join() !== "티샷,그린 주변") add("파3 캐디 항목 어긋남", "caddie", L3.join());
    if (L4.join() !== "티샷,세컨샷") add("파4 캐디 항목 어긋남", "caddie", L4.join());
    if (L5.join() !== "티샷,세컨샷,서드샷") add("파5 캐디 항목 어긋남", "caddie", L5.join());
    if (shotLabels(4, true).slice(-1)[0] !== "그린")
      add("그린 자료가 있는데 [그린] 항목이 안 붙음", "caddie", shotLabels(4, true).join());

    // (2) 응답 파싱 — 라벨이 없어도 내용을 잃으면 안 된다
    const P = parseCaddie("[티샷] 좌측을 보고\n치세요.\n[세컨샷] 길게.", ["티샷", "세컨샷"]);
    if (P.length !== 2) add("캐디 응답 파싱 실패", "caddie", JSON.stringify(P));
    else if (P[0].text !== "좌측을 보고 치세요.") add("줄바뀐 문장이 이어붙지 않음", "caddie", P[0].text);
    const F = parseCaddie("라벨 없는 통짜 답변", ["티샷", "세컨샷"]);
    if (F.length !== 1 || !F[0].text.includes("통짜")) add("라벨 없을 때 내용이 사라짐", "caddie", JSON.stringify(F));

    // (3) 읽어줄 글자 — 라벨·이모지가 그대로 읽히면 안 된다
    const S = speechText("[티샷] 350m 를 노리세요! 🎯");
    if (/\[|🎯/.test(S) || !S.includes("350미터")) add("음성 전처리 미흡", "caddie", S);

    /* (4) 카드가 실제로 그려지고 버튼이 진짜 눌리는지 (덮여 있으면 .click() 은 통과해버린다)
       ⚠️ 크기를 재려면 **화면이 실제로 보여야** 한다. 앞 검사들이 다른 화면을 켜 두고 가서
       #course-view 가 hidden 이면 모든 크기가 0 이 되고, "버튼이 0px" 이라는 헛경보가 뜬다.
       그동안 안 걸린 건 음성 목록이 늦게 로드되면 버튼이 hidden 이라 검사를 통째로
       건너뛰었기 때문이다 — 즉 **이 검사는 될 때만 되는 상태였다**(2026-07-30 확인). */
    const outEl = document.getElementById("ai-strategy");
    const courseView = document.getElementById("course-view");
    const courseWasHidden = courseView.hidden;
    courseView.hidden = false;
    /* 동의 시트가 떠 있으면 그게 화면 전체를 덮어 "버튼이 덮였다"는 헛경보가 난다.
       실제 사용자는 동의를 끝낸 뒤 이 화면에 온다 → 검사 동안만 치워 둔다. */
    const veils = [...document.querySelectorAll(".consent-back, .sheet-back")].filter((v) => !v.hidden);
    veils.forEach((v) => { v.hidden = true; });
    document.getElementById("hole-detail-card").hidden = false;
    const demo = [{ label: "티샷", text: "테스트 티샷 멘트" }, { label: "세컨샷", text: "테스트 세컨 멘트" }];
    renderCaddieCards(demo, outEl, false);
    const cs = outEl.querySelectorAll(".cad-card");
    if (cs.length !== 2) add("캐디 카드가 안 그려짐", "caddie", outEl.innerHTML.slice(0, 60));
    else {
      if (cs[0].querySelector(".cad-text").hidden) add("티샷이 접혀 있음(바로 보여야 함)", "caddie", "");
      if (!cs[0].querySelector(".cad-open").hidden) add("티샷에 여는 버튼이 남아 있음", "caddie", "");
      if (!cs[1].querySelector(".cad-text").hidden) add("세컨샷이 미리 펼쳐져 있음(눌러야 열려야 함)", "caddie", "");
      if (cs[1].querySelector(".cad-open").hidden) add("세컨샷 여는 버튼이 없음", "caddie", "");
      // 눌러서 실제로 열리는지
      cs[1].querySelector(".cad-open").click();
      if (cs[1].querySelector(".cad-text").hidden) add("눌러도 세컨샷 공략이 안 열림", "caddie", "");
    }
    if (parseFloat(getComputedStyle(outEl.querySelector(".cad-text")).fontSize) < 15.5)
      add("캐디 멘트 글씨가 작음(고령 이용자 가독성)", "caddie", getComputedStyle(outEl.querySelector(".cad-text")).fontSize);
    outEl.querySelectorAll(".cad-play, .cad-all, .cad-open").forEach(el => {
      /* 음성이 없는 기기면 숨기는 게 정상이라 건너뛴다.
         ⚠️ 단, 음성 목록은 늦게 로드된다 — 여기서 그냥 return 하면
         "빠르면 검사 안 하고 넘어가는" 상태가 된다. 크기만이라도 강제로 재도록
         잠깐 보이게 해서 확인한다(원래 hidden 이었으면 되돌린다). */
      const wasHidden = el.hidden;
      if (wasHidden) el.hidden = false;
      /* 화면 밖에 있으면 elementFromPoint 가 null 을 준다 — 그건 '덮였다'가 아니다.
         사용자도 스크롤해서 누르므로 **보이는 자리로 가져와서** 잰다. */
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit) add("캐디 버튼이 화면 밖", "caddie", el.className + " top=" + Math.round(r.top));
      else if (!(hit === el || el.contains(hit)))
        add("캐디 버튼이 덮여 있음", "caddie", el.className + " ← " + (hit.className || hit.tagName));
      if (r.height < 44) add("캐디 버튼이 손가락에 작음", "caddie", el.className + " " + Math.round(r.height));
      if (wasHidden) el.hidden = true;
    });

    // (5) 제공 범위 — 공식 홀 자료가 없는 구장에 캐디를 내보내면 안 된다(파·거리가 추정치)
    setCaddieAvailable(false);
    if (!document.getElementById("ai-strategy-btn").hidden)
      add("자료 없는 구장인데 캐디 버튼이 보임", "caddie", "setCaddieAvailable(false)");
    if (!outEl.textContent.includes("준비중")) add("자료 없는 구장 안내가 없음", "caddie", outEl.textContent.slice(0, 40));
    setCaddieAvailable(true);
    if (document.getElementById("ai-strategy-btn").hidden)
      add("등록 구장인데 캐디 버튼이 안 돌아옴", "caddie", "setCaddieAvailable(true)");

    // (6) 위성 추정 구장에 AI 를 붙이던 옛 경로가 남아 있지 않은지
    if (typeof holeSatelliteDataUrl !== "undefined")
      add("위성 AI 캐디 옛 경로가 남아 있음", "caddie", "holeSatelliteDataUrl");
    if (courseWasHidden) courseView.hidden = true;        // 원래대로 되돌린다
    veils.forEach((v) => { v.hidden = false; });
  } catch (e) { add("캐디 검사 예외", "caddie", e.message); }

  /* ── 3-11. 골프 정신 — 탭·명언·룰 카드 ─────────────────────────
     설계: docs/골프정신_설계.md 9장.
     이 화면은 '읽으라고 만든 글'이라 검사 항목도 내용 쪽에 몰려 있다:
     글씨 크기, 출처 표기, 정식 규칙과 필드 룰의 구분, 규칙 원문 전재 여부. */
  try {
    if (typeof SPIRIT_DB === "undefined" || typeof QUOTES_DB === "undefined") {
      add("골프 정신 DB 없음", "spirit", "SPIRIT_DB/QUOTES_DB");
    } else {
      // (1) 명언 무결성 — en 은 선택(국내 선수의 한국어 원발언), 나머지는 필수
      QUOTES_DB.forEach((q, i) => {
        if (!q.who || !q.ko || !q.tip) add("명언에 빈 칸이 있음", "QUOTES_DB[" + i + "]", JSON.stringify(q).slice(0, 90));
        if (!q.en && !q.ko) add("명언 원문·번역이 둘 다 없음", "QUOTES_DB[" + i + "]", "");
        if (typeof q.sure !== "boolean") add("명언 출처 표시(sure) 없음", "QUOTES_DB[" + i + "]", q.who || "");
      });
      // (2) 1~366일 어느 날이든 유효한 명언이 나오는지
      for (let d = 1; d <= 366; d++) {
        const q = QUOTES_DB[d % QUOTES_DB.length];
        if (!q || !q.ko) { add("그날의 명언이 비어 있음", "todayQuote", d + "일"); break; }
      }
      /* (3) 동호회 룰이 공식 룰로 읽히면 안 된다 — diff 표시 카드는 "공식 룰" 병기 필수.
             그리고 룰 두 탭은 서로 비교하라고 나란히 둔 것이라, 순서·번호가 전제다
             (사장님 지시 2026-07-31). */
      const sec = (k) => SPIRIT_DB.sections.find((s) => s.key === k);
      const official = sec("rules"), club = sec("club");
      if (!official) add("공식 룰 탭이 없음", "spiritdb", "");
      if (!club) add("동호회 룰 탭이 없음", "spiritdb", "");
      if (official && club) {
        if (SPIRIT_DB.sections[0].key !== "rules" || SPIRIT_DB.sections[1].key !== "club")
          add("룰 탭이 맨 앞 두 자리가 아님", "spiritdb",
              SPIRIT_DB.sections.map((s) => s.key).join(","));
        if (!official.num || !club.num) add("룰 탭에 번호(num)가 꺼져 있음", "spiritdb", "");
        club.items.forEach((it) => {
          if (it.diff && !/공식/.test(it.d))
            add("동호회 룰에 '공식 룰' 병기가 없음(공식 룰로 오해)", "spiritdb", it.t);
          // 비교 링크가 없는 번호를 가리키면 눌러도 엉뚱한 카드로 간다
          if (it.see && !(it.see >= 1 && it.see <= official.items.length))
            add("비교 대상 공식 룰 번호가 범위 밖", "spiritdb", it.t + " → " + it.see);
        });
      }
      // (4) 규칙 원문 전재 감지 — 카드 본문에 영문이 길게 이어지면 배포를 멈춘다(저작권)
      SPIRIT_DB.sections.forEach((s) => s.items.forEach((it) => {
        const m = String(it.d || "").match(/[A-Za-z][A-Za-z'’,.\-]*(?:\s+[A-Za-z][A-Za-z'’,.\-]*){19,}/);
        if (m) add("규칙 원문 전재 의심(영문 20단어 이상)", "spiritdb", it.t + " — " + m[0].slice(0, 60));
      }));
    }

    // (5) 실제로 화면을 열어 탭을 눌러 본다
    const spView = document.querySelector("#spirit-view");
    if (!spView) add("골프 정신 화면 요소가 없음", "spirit", "#spirit-view");
    else if (typeof openSpiritView === "function") {
      const wasHidden = spView.hidden;
      spView.hidden = false;
      paintSpirit();
      const tabs = [...spView.querySelectorAll(".sp-tab")];
      if (tabs.length < 6) add("골프 정신 탭 수가 모자람", "spirit", tabs.length + "개");
      for (const tb of tabs) {
        tb.click();
        await sleep(30);
        const items = spView.querySelectorAll(".sp-item");
        if (!items.length) add("탭을 눌렀는데 카드가 없음", "spirit", tb.dataset.tab);
        // 읽는 글이라 16px 기준 — 캐디 멘트와 같은 이유(고령 이용자 가독성)
        const d0 = spView.querySelector(".sp-d");
        if (d0) {
          const px = parseFloat(getComputedStyle(d0).fontSize);
          if (px < 15.5) add("골프 정신 본문 글씨가 작음(고령 이용자 가독성)", tb.dataset.tab, px + "px");
        }
      }
      // (6) 룰 탭 꼬리말 — 점검일·반영일·공식 링크
      const rt = tabs.find((t) => t.dataset.tab === "rules");
      if (rt) {
        rt.click();
        await sleep(30);
        const foot = spView.querySelector(".sp-foot");
        const ft = foot ? foot.innerText : "";
        if (!/최근 점검/.test(ft)) add("룰 탭에 최근 점검일이 없음", "spirit", ft.slice(0, 60));
        if (!/내용 반영/.test(ft)) add("룰 탭에 내용 반영일이 없음", "spirit", ft.slice(0, 60));
        if (!spView.querySelector(".sp-link")) add("룰 탭에 공식 규칙 링크가 없음", "spirit", "");
      }
      // (7) 출처 불확실한 명언은 반드시 "전해지는" 으로 적는다
      if (typeof quoteWho === "function") {
        const unsure = QUOTES_DB.find((q) => !q.sure);
        if (unsure && !/전해지는/.test(quoteWho(unsure)))
          add("출처 불확실 명언에 '전해지는 말' 표기가 없음", "quoteWho", unsure.who);
      }
      spView.hidden = wasHidden;
    }
  } catch (e) { add("골프 정신 검사 예외", "spirit", e.message); }

  /* ── 4. 브랜드 잔재 점검 ─────────────────────────────────────── */
  const html = document.body.innerText;
  if (/Ri-Weather/i.test(html)) add("옛 브랜드명 노출", "body", html.match(/.{0,30}Ri-Weather.{0,30}/i)[0]);
  /* 2026-07-31 투어리스트로 개명(상표 출원 진행, 사장님 지시).
     옛 이름 '골프라이프'가 화면에 남으면 잡는다 — '구 골프라이프' 병기(약관)만 허용. */
  const oldName = html.match(/.{0,20}골프라이프.{0,20}/g) || [];
  oldName.filter((s) => !/구 골프라이프/.test(s))
    .forEach((s) => add("옛 브랜드명 노출", "body", s));
  if (!/투어리스트/.test(document.title)) add("타이틀 미변경", "title", document.title);

  /* 문구 사전 키가 화면에 그대로 새어 나왔는지 (2026-07-31 다국어 작업)
     tr("hub.title") 을 불렀는데 사전에 그 키가 없으면 `hub.title` 이 그대로 찍힌다.
     화면 어디에도 `영문.영문` 꼴의 낱말이 홀로 서 있을 이유가 없다. */
  const leaked = (html.match(/(^|[\s>])([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+)(?=[\s<]|$)/g) || [])
    .map((s) => s.trim())
    .filter((s) => !/\.(com|net|kr|jp|co|org|io|gg|js|css|png|jpg|html)$/i.test(s));
  [...new Set(leaked)].slice(0, 5).forEach((s) => add("문구 사전 키가 화면에 노출", "i18n", s));

  /* ── 5. 색 잔재 점검 (파랑이 남았는지) ───────────────────────── */
  const blues = [];
  [...document.styleSheets].forEach(ss => { try {
    [...ss.cssRules].forEach(r => { const c = r.cssText || "";
      if (/#3182f6|49,\s*130,\s*246|#1b64da/i.test(c)) blues.push(r.selectorText || c.slice(0,50)); });
  } catch {} });
  if (blues.length) add("토스 블루 잔재", "css", blues.slice(0,6).join(" / "));

  return JSON.stringify({
    엔진조합수: n, 런타임오류: errs.slice(0,5),
    발견버그수: bugs.length,
    버그: bugs.slice(0, 25)
  }, null, 1);
})()
