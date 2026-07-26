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
    "js/app.js": ["APP_VER", "renderHome", "wmoClass", "wxScene", "BACKUP", "loadScores", "loadCourses"],
    "js/clubfit.js": ["openClubfitView", "loadMyBag", "__cfTest"],
    "js/loading.js": ["WAIT", "staggerIn"],
    "js/legal.js": ["CONSENT"],
    "js/stats.js": ["STATS"],
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
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const inp = { career: "5y", scoreConfirm: "ok", tempo: pick(["smooth","normal","fast"]),
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

      const ir = __cfTest({ ...inp, ironMiss: pick(["thin","fat","dir","none"]),
        ironMat: pick(["unsure","스틸","그라파이트"]), ironFeel: pick(["soft","solid","light","any"]) }, "iron");
      if (!ir.shaft1 || /undefined/.test(ir.shaft1)) add("아이언 샤프트 비정상", JSON.stringify(inp), ir.shaft1);
      if (!ir.head || /undefined/.test(ir.head)) add("아이언 헤드 비정상", JSON.stringify(inp), ir.head);
      if (ir.target < 40 || ir.target > 160) add("아이언 목표무게 이상", JSON.stringify(inp), ir.target);

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
  CLUB_B.forEach(b => SHAFT_B.forEach(sb => {
    try {
      const r = __cfTest({ ...bb, brand: b, shaftBrand: sb });
      if (b !== "any" && r.head.split(" ")[0] !== b)
        add("헤드가 선호 브랜드를 무시함", "선호=" + b, "나온것=" + r.head);
      if (sb !== "any" && r.shaftBrand1 !== sb)
        add("샤프트가 선호 브랜드를 무시함", "선호=" + sb, "나온것=" + r.shaftBrand1);
      if (!r.shaftAlt) add("다른 브랜드 대안이 없음", "샤프트 " + b + "/" + sb, "");
      if (!r.headAlt) add("다른 브랜드 대안이 없음", "헤드 " + b + "/" + sb, "");
    } catch (e) { add("브랜드 조합 예외", b + "/" + sb, e.message); }
  }));

  /* ── 1-3. 브랜드 질문이 기본 문항에 있는지 ───────────────────────
     선택 단계에 두었더니 대부분 질문을 못 받고 지나가 기능이 죽어 있었다. */
  try {
    const src = await (await fetch("/js/clubfit.js?x=" + Date.now())).text();
    const seg = src.slice(src.indexOf('stage: "가봉", q: 7'), src.indexOf('stage: "가봉", q: 8'));
    if (!/\"brand\"|'brand'|"brand"/.test(seg)) add("클럽 브랜드 질문이 기본 문항에 없음", "가봉 7", "");
    if (!/shaftBrand/.test(seg)) add("샤프트 브랜드 질문이 기본 문항에 없음", "가봉 7", "");
  } catch (e) { add("문항 확인 실패", "clubfit.js", e.message); }

  /* ── 2. 모든 화면 렌더 (오류·깨진 문자열) ───────────────────── */
  const views = ["home","hub","detail","course","food","score","clubfit"];
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
  try {
    openClubfitView();
    await sleep(300);
    let visited = 0, stuck = 0, last = "";
    const badWords = ["가봉", "본봉", "시침", "본박음"];
    for (let i = 0; i < 40 && stuck < 3; i++) {
      const eye = (document.querySelector("#cf-screen .q-eyebrow") || {}).innerText || "";
      const stage = (document.querySelector("#cf-stage") || {}).textContent || "";
      const screen = (document.querySelector("#cf-screen") || {}).innerText || "";
      const sig = eye + "|" + stage;
      if (sig === last) { stuck++; } else { stuck = 0; visited++; }
      last = sig;

      badWords.forEach(w => {
        if (stage.includes(w)) add("진행 표시에 재단 용어", stage, eye);
        if (screen.includes(w)) add("화면 문구에 재단 용어", eye, screen.slice(0, 70));
      });

      document.querySelectorAll("#cf-screen .chips").forEach(g => {
        if (!g.querySelector('.chip[aria-pressed="true"]')) g.querySelector(".chip").click();
      });
      await sleep(300);                       // 칩 자동 넘김(220ms) 을 기다린다
      const nb = document.querySelector("#cf-screen .cf-btn[data-next]:not(:disabled)");
      const sk = document.querySelector("#cf-screen [data-skip]");
      const jp = document.querySelector('#cf-screen [data-jump="bag"]');
      if (nb) nb.click(); else if (sk) sk.click(); else if (jp) jp.click();
      await sleep(120);
      if (document.querySelector(".rw-wait")) { WAIT.close(true); await sleep(140); }
    }
    if (visited < 10) add("피팅 화면 순회가 너무 일찍 끝남(검사 부실)", "clubfit", "방문 " + visited + "개");
  } catch (e) { add("피팅 화면 순회 예외", "clubfit", e.message); }

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

  /* ── 4. 브랜드 잔재 점검 ─────────────────────────────────────── */
  const html = document.body.innerText;
  if (/Ri-Weather/i.test(html)) add("옛 브랜드명 노출", "body", html.match(/.{0,30}Ri-Weather.{0,30}/i)[0]);
  if (!/골프라이프/.test(document.title)) add("타이틀 미변경", "title", document.title);

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
