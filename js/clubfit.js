/* =========================================================
 * 클럽 피팅 (AI 클럽선택 캐디) — 인수인계 v1 (2026.07.25) 이식
 *
 * 기준 구현: club-survey-flow.html 의 engine() — 룰 엔진 로직은 그대로 유지.
 * 원칙(요약):
 *  - 후보 선정은 100% 룰 엔진. AI는 설명만(차기). 스펙 환각 금지.
 *  - "그대로 쓰세요" 유지 판정이 신뢰의 핵심.
 *  - 이미 아는 것(연령·성별·평균타수·후반패턴)은 다시 묻지 않는다.
 *  - 후반 체력 신호 → 무게 한 체급 ↓ + 강도 한 단계 ↑ (6S→5X 로직).
 * ⚠️ 스펙 수치는 데모용 샘플 — 실서비스 전 제조사 공식 스펙 전수 검증 필요.
 * ========================================================= */
(function () {
  "use strict";
  const $$ = (s) => document.querySelector(s);

  /* ───────── 데이터 (기준 구현 원본 그대로) ───────── */
  const FLEX = ["R", "SR", "S", "X"];
  const SHAFTS = [
    { b: "후지쿠라", m: "벤투스 TR 블랙", sp: "5X", w: 58, fx: "X", tq: 3.2, k: "낮음", velo: true },
    { b: "후지쿠라", m: "벤투스 TR 블랙", sp: "6S", w: 67, fx: "S", tq: 3.0, k: "낮음", velo: true },
    { b: "후지쿠라", m: "벤투스 블루", sp: "5S", w: 56, fx: "S", tq: 3.6, k: "중", velo: true },
    { b: "후지쿠라", m: "벤투스 블루", sp: "6S", w: 64, fx: "S", tq: 3.1, k: "중", velo: true },
    { b: "후지쿠라", m: "벤투스 블랙", sp: "6X", w: 67, fx: "X", tq: 3.0, k: "낮음", velo: true },
    { b: "후지쿠라", m: "스피더 NX 그린", sp: "50S", w: 54, fx: "S", tq: 4.3, k: "중고", velo: true },
    { b: "후지쿠라", m: "스피더 NX 블루", sp: "40R", w: 46, fx: "R", tq: 5.4, k: "고", velo: true },
    { b: "후지쿠라", m: "스피더 NX 블랙", sp: "60X", w: 65, fx: "X", tq: 3.0, k: "낮음", velo: true },
    { b: "그라파이트디자인", m: "투어AD DI", sp: "6S", w: 64, fx: "S", tq: 3.3, k: "중" },
    { b: "그라파이트디자인", m: "투어AD UB", sp: "5S", w: 57, fx: "S", tq: 3.9, k: "중" },
    { b: "그라파이트디자인", m: "투어AD VF", sp: "6X", w: 66, fx: "X", tq: 3.1, k: "중저" },
    { b: "미쓰비시", m: "텐세이 프로 블루 1K", sp: "50S", w: 56, fx: "S", tq: 4.0, k: "중" },
    { b: "미쓰비시", m: "디아마나 PD", sp: "60S", w: 63, fx: "S", tq: 3.2, k: "중저" },
    { b: "프로젝트X", m: "HZRDUS 스모크 블랙", sp: "60 6.0", w: 62, fx: "S", tq: 3.4, k: "낮음" },
    { b: "던롭", m: "젝시오 순정 MP1300", sp: "R", w: 40, fx: "R", tq: 6.5, k: "고", stock: true },
    { b: "타이틀리스트", m: "순정 TSP322", sp: "55S", w: 55, fx: "S", tq: 4.6, k: "중", stock: true },
    { b: "UST마미야", m: "아타스 킹", sp: "5SR", w: 56, fx: "SR", tq: 4.2, k: "중고" },
  ];
  const HEADS = [
    { br: "타이틀리스트", m: "GT2", forg: 4, draw: false, spin: "중", light: false, fit: ["80", "90"] },
    { br: "타이틀리스트", m: "GT3", forg: 3, draw: false, spin: "중저", light: false, fit: ["80"] },
    { br: "타이틀리스트", m: "GT4", forg: 2, draw: false, spin: "저", light: false, fit: ["80"] },
    { br: "핑", m: "G430 MAX 10K", forg: 5, draw: false, spin: "중", light: false, fit: ["90", "100"] },
    { br: "핑", m: "G430 SFT", forg: 4, draw: true, spin: "중", light: false, fit: ["90", "100"] },
    { br: "테일러메이드", m: "Qi10 MAX", forg: 5, draw: false, spin: "중", light: false, fit: ["90", "100"] },
    { br: "캘러웨이", m: "Ai스모크 MAX D", forg: 4, draw: true, spin: "중", light: false, fit: ["90", "100"] },
    { br: "던롭", m: "젝시오 13", forg: 5, draw: true, spin: "중고", light: true, fit: ["90", "100"] },
  ];
  const CUR_SHAFT = {
    unknown: { label: "몰라요", w: null, fx: null },
    stock: { label: "순정 그대로", w: 50, fx: "SR" },
    s50s: { label: "50g대 · S", w: 55, fx: "S" },
    s50x: { label: "50g대 · X", w: 55, fx: "X" },
    s60s: { label: "60g대 · S", w: 65, fx: "S" },
    s60x: { label: "60g대 · X", w: 65, fx: "X" },
  };

  /* ───────── 상태 ───────── */
  const S = {
    auto: { age: null, sex: null, avg: null, fade: null },   // 실데이터에서 채움
    career: null, scoreConfirm: null, scoreGrp: "90", carry7: 150, carryD: 220,
    shapeD: null, endur: null, brand: null, curShaft: null, complaint: null,
    heightV: 172, traj: null, shapeI: null, tempo: null, budget: null,
    didFine: false,
  };
  let idx = 0;

  /* ───────── 0단 자동 — 동의 화면 + 스코어 기록에서 (다시 묻지 않는다) ───────── */
  function computeAuto() {
    const c = (typeof CONSENT !== "undefined" && CONSENT.get()) || {};
    S.auto.age = c.age || null;
    S.auto.sex = (c.gender && c.gender !== "선택 안 함") ? c.gender : null;
    // 평균 타수: 최근 10라운드 기록 → 없으면 프로필의 평균타수 칩
    let avg = null, fade = null;
    try {
      const recs = (typeof loadScores === "function" ? loadScores() : [])
        .filter((r) => r && r.score > 50 && r.score < 160).slice(0, 10);
      if (recs.length >= 3)
        avg = Math.round(recs.reduce((a, r) => a + r.score, 0) / recs.length);
      // 후반 패턴: 홀별 기록(파 대비 상대타수 18개)이 있는 라운드에서 (후반9 − 전반9) 평균
      const diffs = recs.filter((r) => Array.isArray(r.holes) && r.holes.length === 18 &&
          r.holes.every((h) => h === null || typeof h === "number"))
        .map((r) => {
          const f = r.holes.slice(0, 9), b = r.holes.slice(9);
          if (f.some((h) => h === null) || b.some((h) => h === null)) return null;
          return b.reduce((a, x) => a + x, 0) - f.reduce((a, x) => a + x, 0);
        }).filter((d) => d !== null);
      if (diffs.length >= 2)
        fade = Math.round(diffs.reduce((a, x) => a + x, 0) / diffs.length * 10) / 10;
    } catch (_) {}
    if (avg === null && typeof loadProfile === "function") {
      const a = loadProfile().avg || "";               // "90대" 같은 칩 값
      if (/^7/.test(a)) avg = 79; else if (/^8/.test(a)) avg = 85;
      else if (/^9/.test(a)) avg = 95; else if (/^1[01]/.test(a)) avg = 105;
    }
    S.auto.avg = avg;
    S.auto.fade = fade;
    S.scoreGrp = avg === null ? null : (avg < 90 ? "80" : avg < 100 ? "90" : "100");
  }

  /* ───────── 화면 구성 ───────── */
  function chipList(items, key, { row = false, auto = true } = {}) {
    return `<div class="chips${row ? " row" : ""}" data-key="${key}" data-auto="${auto ? 1 : 0}">` +
      items.map((it) => `<button class="chip" data-v="${it.v}" aria-pressed="${S[key] === it.v}">${it.t}${it.s ? `<small>${it.s}</small>` : ""}</button>`).join("") +
      `</div>`;
  }
  function slider(key, min, max, step, unit) {
    return `<div class="slider-box">
      <div class="slider-val"><span id="cfv_${key}">${S[key]}</span><span> ${unit}</span></div>
      <input type="range" data-slider="${key}" min="${min}" max="${max}" step="${step}" value="${S[key]}" aria-label="${key}">
      <div class="range-ends"><span>${min}${unit}</span><span>${max}${unit}</span></div>
    </div>`;
  }
  const nextBtn = (dis = false, label = "다음") =>
    `<div class="btn-row"><button class="cf-btn" data-next ${dis ? "disabled" : ""}>${label}</button></div>`;

  const SCREENS = [
    { stage: "자동 파악", render: () => `
      <div class="q-eyebrow">0단 · 묻지 않는 정보</div>
      <div class="q-title">이미 알고 있어요</div>
      <div class="q-sub">동의 화면과 스코어 기록에서 가져왔습니다. 다시 묻지 않습니다.</div>
      <div class="q-body">
        <div class="known-card"><div class="k-label">연령대 · 성별</div>
          <div class="k-val">${S.auto.age || "미입력"} · ${S.auto.sex || "미입력"}</div>
          <div class="k-src">동의 화면 (선택 항목)</div></div>
        <div class="known-card"><div class="k-label">평균 타수</div>
          <div class="k-val">${S.auto.avg !== null ? S.auto.avg + "타" : "기록 없음 — 설문에서 여쭤봅니다"}</div>
          <div class="k-src">최근 라운드 스코어 기록</div></div>
        <div class="known-card"><div class="k-label">후반 패턴</div>
          <div class="k-val">${S.auto.fade !== null
            ? "13~18홀 평균 " + (S.auto.fade >= 0 ? "+" : "") + S.auto.fade + "타"
            : "홀별 기록 부족 — 설문으로 봅니다"}</div>
          <div class="k-src">스코어 기록 자동 분석 — 체력 신호</div></div>
      </div>
      <div class="btn-row"><button class="cf-btn" data-next>가봉 시작 — 8문항</button></div>`
    },
    { stage: "가봉", q: 1, render: () => `
      <div class="q-eyebrow">가봉 1/8 · 구력</div>
      <div class="q-title">골프, 얼마나 치셨어요?</div>
      <div class="q-body">${chipList([
        { v: "lt3", t: "3년 미만" }, { v: "y3_10", t: "3~10년" }, { v: "gt10", t: "10년 이상" }], "career")}</div>`
    },
    { stage: "가봉", q: 2, render: () => S.auto.avg !== null ? `
      <div class="q-eyebrow">가봉 2/8 · 평균 타수 확인</div>
      <div class="q-title">기록 기준 평균 ${S.auto.avg}타 —<br>맞나요?</div>
      <div class="q-sub">묻는 게 아니라 확인만 합니다.</div>
      <div class="q-body">
        ${chipList([{ v: "ok", t: `맞아요 (${S.scoreGrp === "100" ? "100타 이상" : S.scoreGrp + "대"})` }, { v: "diff", t: "조금 달라요" }], "scoreConfirm", { auto: false })}
        <div id="cf-scorefix" style="display:${S.scoreConfirm === "diff" ? "block" : "none"}" class="sub-q">
          <div class="q-eyebrow">실제 평균 타수대</div>
          ${chipList([{ v: "80", t: "80대 이하" }, { v: "90", t: "90대" }, { v: "100", t: "100타 이상" }], "scoreGrp", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!canPassScore())}` : `
      <div class="q-eyebrow">가봉 2/8 · 평균 타수</div>
      <div class="q-title">평균 타수대는?</div>
      <div class="q-sub">스코어 기록이 쌓이면 다음부터는 묻지 않습니다.</div>
      <div class="q-body">${chipList([
        { v: "80", t: "80대 이하" }, { v: "90", t: "90대" }, { v: "100", t: "100타 이상" }], "scoreGrp")}</div>`
    },
    { stage: "가봉", q: 3, render: () => `
      <div class="q-eyebrow">가봉 3/8 · 7번 아이언</div>
      <div class="q-title">7번 아이언 캐리는?</div>
      <div class="q-sub">런 빼고, 떨어지는 지점까지. 헤드스피드를 가장 정확히 알려주는 숫자입니다.</div>
      <div class="q-body">${slider("carry7", 110, 185, 5, "m")}</div>${nextBtn()}`
    },
    { stage: "가봉", q: 4, render: () => `
      <div class="q-eyebrow">가봉 4/8 · 드라이버</div>
      <div class="q-title">드라이버 캐리는?</div>
      <div class="q-sub">잘 맞은 공 말고, 평소 10번 중 6~7번 나오는 거리로.</div>
      <div class="q-body">${slider("carryD", 170, 265, 5, "m")}<div id="cf-rationote"></div></div>${nextBtn()}`
    },
    { stage: "가봉", q: 5, render: () => `
      <div class="q-eyebrow">가봉 5/8 · 드라이버 구질</div>
      <div class="q-title">드라이버는 주로<br>어느 쪽으로 미스가 나나요?</div>
      <div class="q-body">${chipList([
        { v: "slice", t: "슬라이스", s: "오른쪽으로 크게 휨" },
        { v: "fade", t: "페이드", s: "오른쪽으로 살짝" },
        { v: "straight", t: "스트레이트" },
        { v: "draw", t: "드로", s: "왼쪽으로 살짝" },
        { v: "hook", t: "훅", s: "왼쪽으로 크게 휨" }], "shapeD")}</div>`
    },
    { stage: "가봉", q: 6, render: () => `
      <div class="q-eyebrow">가봉 6/8 · 체력</div>
      <div class="q-title">하루 36홀, 가능하세요?</div>
      <div class="q-sub">${S.auto.fade !== null && S.auto.fade >= 3
        ? `스코어 기록의 후반 +${S.auto.fade}타 패턴과 함께 봅니다.`
        : "시타실 10구가 아니라 18홀 전체 기준으로 맞춥니다."}</div>
      <div class="q-body">${chipList([
        { v: "strong", t: "거뜬해요" },
        { v: "fadeLate", t: "후반엔 무너져요", s: "13번 홀 넘어가면 스윙이 처짐" },
        { v: "weak", t: "18홀도 벅차요" }], "endur")}</div>`
    },
    { stage: "가봉", q: 7, render: () => `
      <div class="q-eyebrow">가봉 7/8 · 브랜드</div>
      <div class="q-title">선호 브랜드가 있나요?</div>
      <div class="q-sub">추천은 이 브랜드 안에서 먼저 찾습니다.</div>
      <div class="q-body">${chipList([
        { v: "타이틀리스트", t: "타이틀리스트" }, { v: "테일러메이드", t: "테일러메이드" },
        { v: "캘러웨이", t: "캘러웨이" }, { v: "핑", t: "핑" },
        { v: "던롭", t: "젝시오·혼마 계열" }, { v: "any", t: "상관없어요" }], "brand", { row: true })}</div>`
    },
    { stage: "가봉", q: 8, render: () => `
      <div class="q-eyebrow">가봉 8/8 · 현재 클럽</div>
      <div class="q-title">지금 드라이버 샤프트는?</div>
      <div class="q-body">
        ${chipList(Object.entries(CUR_SHAFT).map(([v, o]) => ({ v, t: o.label })), "curShaft", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow">지금 클럽, 뭐가 제일 아쉬워요?</div>
          ${chipList([
            { v: "dist", t: "거리" }, { v: "dir", t: "방향" }, { v: "traj", t: "탄도 (안 떠요)" },
            { v: "feel", t: "타감" }, { v: "none", t: "딱히 없어요, 그냥 궁금" }], "complaint", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.curShaft && S.complaint))}`
    },
    { stage: "가봉 완료", render: () => `
      <div class="q-eyebrow">가봉 끝</div>
      <div class="q-title">여기까지로도<br>추천이 가능합니다</div>
      <div class="q-sub">본봉(정밀 피팅) 5문항을 더 하면 킥포인트·라이각·예산까지 잡아드립니다. 30초쯤 걸려요.</div>
      <div class="q-body"></div>
      <div class="btn-row">
        <button class="cf-btn ghost" data-jump="result">바로 결과 보기</button>
        <button class="cf-btn accent" data-next>본봉 계속</button>
      </div>`
    },
    { stage: "본봉", q: 1, render: () => `
      <div class="q-eyebrow">본봉 1/5 · 키</div>
      <div class="q-title">키가 어떻게 되세요?</div>
      <div class="q-sub">아이언 라이각·길이 코멘트에만 씁니다.</div>
      <div class="q-body">${slider("heightV", 150, 195, 1, "cm")}</div>
      ${nextBtn()}<button class="skip" data-skip>건너뛰기</button>`
    },
    { stage: "본봉", q: 2, render: () => `
      <div class="q-eyebrow">본봉 2/5 · 탄도</div>
      <div class="q-title">평소 드라이버 탄도는?</div>
      <div class="q-body">${chipList([
        { v: "low", t: "낮아요", s: "라인드라이브성" }, { v: "mid", t: "중간" }, { v: "high", t: "높아요", s: "떠서 밀리는 느낌" }], "traj")}</div>
      <button class="skip" data-skip>건너뛰기</button>`
    },
    { stage: "본봉", q: 3, render: () => `
      <div class="q-eyebrow">본봉 3/5 · 아이언 구질</div>
      <div class="q-title">아이언은 주로 어느 쪽?</div>
      <div class="q-sub">드라이버와 따로 봅니다 — 다른 유저가 많거든요.</div>
      <div class="q-body">${chipList([
        { v: "slice", t: "슬라이스" }, { v: "straight", t: "스트레이트" }, { v: "hook", t: "훅" }], "shapeI")}</div>
      <button class="skip" data-skip>건너뛰기</button>`
    },
    { stage: "본봉", q: 4, render: () => `
      <div class="q-eyebrow">본봉 4/5 · 템포</div>
      <div class="q-title">스윙 템포는?</div>
      <div class="q-body">${chipList([
        { v: "smooth", t: "부드러움", s: "천천히 올려서 툭" }, { v: "normal", t: "보통" }, { v: "fast", t: "빠름", s: "전환이 급하고 때리는 편" }], "tempo")}</div>
      <button class="skip" data-skip>건너뛰기</button>`
    },
    { stage: "본봉", q: 5, render: () => `
      <div class="q-eyebrow">본봉 5/5 · 예산</div>
      <div class="q-title">샤프트 예산은?</div>
      <div class="q-body">${chipList([
        { v: "stock", t: "순정이면 충분", s: "추가 지출 없이" },
        { v: "mid", t: "애프터마켓까지", s: "30~40만 원대" },
        { v: "any", t: "상관없어요" }], "budget")}</div>
      <button class="skip" data-skip>건너뛰기</button>`
    },
    { stage: "판정", key: "result", render: renderResult },
  ];

  /* ───────── 룰 엔진 (기준 구현 그대로) ───────── */
  function speedBand(c) {
    if (c < 130) return { w: [40, 52], fx: ["R", "SR"] };
    if (c < 145) return { w: [48, 58], fx: ["SR", "S"] };
    if (c < 160) return { w: [54, 64], fx: ["S"] };
    if (c < 172) return { w: [58, 68], fx: ["S", "X"] };
    return { w: [63, 75], fx: ["X"] };
  }
  const shiftUp = (l) => l.map((f) => FLEX[Math.min(FLEX.indexOf(f) + 1, 3)]).filter((v, i, a) => a.indexOf(v) === i);

  function engine() {
    const notes = [], tips = [];
    const band = speedBand(S.carry7);
    let wLo = band.w[0], wHi = band.w[1], fxT = [...band.fx];

    // 비율 검증 (거짓말 탐지기)
    const ratio = S.carryD / S.carry7;
    let lowSmash = false;
    if (ratio > 1.68) notes.push({ t: "warn", h: "드라이버 수치는 참고만", b: `7번 대비 드라이버가 깁니다(×${ratio.toFixed(2)}). 헤드스피드 추정은 <b>7번 캐리 기준</b>으로만 계산했습니다.` });
    if (ratio < 1.50) { lowSmash = true; notes.push({ t: "warn", h: "정타율 신호", b: `7번 대비 드라이버가 짧습니다(×${ratio.toFixed(2)}). 스피드보다 <b>정타</b>가 병목 — 관용성 헤드에 가점했습니다.` }); }

    if (S.tempo === "fast") fxT = shiftUp(fxT);
    const fadeSig = S.auto.fade !== null && S.auto.fade >= 3;
    const tired = S.endur === "fadeLate" || S.endur === "weak" || fadeSig;
    if (tired) {
      wLo -= 8; wHi -= 8; fxT = shiftUp(fxT);
      notes.push({ t: "rule", h: "후반 체력 보정 발동", b: `${fadeSig ? `스코어 기록의 후반 +${S.auto.fade}타 패턴` : "36홀 응답"} → <b>무게 한 체급 ↓, 강도 한 단계 ↑</b>. 시타실 10구가 아니라 18홀 전체 기준입니다.` });
    }
    if (S.endur === "weak") { wLo -= 4; wHi -= 4; }

    // 샤프트 채점
    let pool = SHAFTS;
    if (S.budget === "stock") pool = SHAFTS.filter((s) => s.stock);
    const cur = CUR_SHAFT[S.curShaft] || CUR_SHAFT.unknown;
    const shafts = pool.map((s) => {
      let p = 0; const why = [];
      if (s.w >= wLo && s.w <= wHi) { p += 40; why.push(`무게 ${s.w}g — 체력 반영 밴드(${wLo}~${wHi}g) 안`); }
      else p += Math.max(0, 40 - 4 * (s.w < wLo ? wLo - s.w : s.w - wHi));
      const fi = FLEX.indexOf(s.fx), tI = fxT.map((f) => FLEX.indexOf(f));
      if (tI.includes(fi)) { p += 35; why.push(`플렉스 ${s.fx} — 목표 강도 일치`); }
      else if (tI.some((t) => Math.abs(t - fi) === 1)) p += (S.tempo === "smooth" && tI.every((t) => fi < t)) ? 25 : 12;
      if ((S.shapeD === "slice") && s.tq >= 3.8) { p += 10; why.push(`토크 ${s.tq}° — 헤드 턴 도와 슬라이스 완화`); }
      if ((S.shapeD === "hook") && s.tq <= 3.2) { p += 10; why.push(`토크 ${s.tq}° — 훅 억제`); }
      if (S.shapeD === "slice" && (s.k === "중고" || s.k === "고")) p += 6;
      if (S.shapeD === "hook" && s.k === "낮음") p += 6;
      if (S.complaint === "dist" && s.w <= (wLo + wHi) / 2) { p += 6; why.push(`밴드 내 가벼운 쪽 — 스피드 확보`); }
      if (S.complaint === "dir" && s.tq <= 3.4) { p += 8; why.push(`저토크 — 방향 안정`); }
      if (S.complaint === "traj" && (s.k === "중고" || s.k === "고")) { p += 8; why.push(`킥 ${s.k} — 탄도 확보`); }
      if (S.traj === "high" && s.k === "낮음") { p += 6; why.push(`킥 낮음 — 뜨는 탄도 억제`); }
      if (S.traj === "low" && (s.k === "중고" || s.k === "고")) p += 6;
      if (cur.w && Math.abs(s.w - cur.w) > 10) p -= 15;   // 안전장치: 10g 점프 감점
      return { ...s, p, why };
    }).sort((a, b) => b.p - a.p);

    // 헤드 채점
    const heads = HEADS.map((h) => {
      let p = h.forg * 8; const why = [];
      if (h.fit.includes(S.scoreGrp)) { p += 15; }
      if (S.shapeD === "slice" && h.draw) { p += 28; why.push(`드로 바이어스 — 슬라이스 교정`); }
      if (S.shapeD === "hook" && h.draw) p -= 15;
      if (S.scoreGrp === "80") {
        if (h.forg <= 3) { p += 18; why.push(`조정형 — 구질 세팅 가능`); }
        if (h.spin === "저" && S.carry7 >= 163) { p += 14; why.push(`저스핀 — 고속 스윙 런 확보`); }
      } else if (h.forg >= 4) { p += 20; why.push(`관용성 ${h.forg}/5 — 미스에 관대`); }
      if (lowSmash && h.forg >= 4) { p += 8; why.push(`정타율 신호 → 관용성 가점`); }
      if (h.light && S.carry7 < 140) { p += 12; why.push(`경량 — 스피드 보전`); }
      if (h.light && S.carry7 >= 160) p -= 12;
      return { ...h, p, why };
    }).sort((a, b) => b.p - a.p);
    const brandHeads = (S.brand && S.brand !== "any") ? heads.filter((h) => h.br === S.brand) : heads;
    const mainHead = brandHeads[0] || heads[0];
    const altHead = heads.find((h) => h.br !== mainHead.br);

    // 유지 판정 (최우선 분기)
    const keep = cur.w !== null
      && cur.w >= wLo - 3 && cur.w <= wHi + 3
      && fxT.some((f) => Math.abs(FLEX.indexOf(f) - FLEX.indexOf(cur.fx)) <= 0)
      && (S.complaint === "none" || S.complaint === "feel");

    // 점프 경고
    const top = shafts[0];
    if (!keep && cur.w && top && Math.abs(top.w - cur.w) > 10)
      notes.push({ t: "warn", h: "무게 점프 주의", b: `현재 ${cur.w}g대 → 추천 ${top.w}g. <b>한 번에 10g 이상 이동은 위험</b> — 중간 체급을 경유하거나 시타 필수.` });

    // 그립
    let grip = { m: "골프프라이드 투어벨벳", spec: "50g · 스탠다드 · 러버", why: "기본기에 충실한 표준" };
    if (S.complaint === "dir" || tired) grip = { m: "골프프라이드 MCC 플러스4", spec: "52g · 미드 · 하프코드", why: "후반 손힘 빠질 때·땀에 강함, 하부 두꺼워 릴리즈 안정" };
    if (S.complaint === "feel") grip = { m: "골프프라이드 CP2 프로", spec: "52g · 미드 · 소프트러버", why: "부드러운 타감 선호에 맞춤" };

    // 팁
    if (S.heightV) {
      if (S.heightV >= 185) tips.push(`키 ${S.heightV}cm — 아이언 <b>라이각 1~2° 업라이트</b> 검토 대상.`);
      else if (S.heightV <= 162) tips.push(`키 ${S.heightV}cm — 아이언 <b>라이각 플랫/길이 -0.25"</b> 검토 대상.`);
      else tips.push(`키 ${S.heightV}cm — 표준 라이각 범위.`);
    }
    if (S.shapeI && S.shapeI !== S.shapeD) tips.push(`드라이버(${label(S.shapeD)})와 아이언(${label(S.shapeI)}) 구질이 다릅니다 — 아이언 샤프트는 별도 진단 권장. 다음 업데이트에서.`);
    if (S.budget === "stock") tips.push(`예산 순정 — 순정 라인 내에서만 골랐습니다.`);

    return { wLo, wHi, fxT, notes, tips, shafts: shafts.slice(0, 2), mainHead, altHead, keep, cur, grip,
      mph: Math.round(S.carry7 * 0.63) };
  }
  function label(v) { return { slice: "슬라이스", fade: "페이드", straight: "스트레이트", draw: "드로", hook: "훅" }[v] || "-"; }

  /* ───────── 내 백 저장 → AI 캐디 입력값 ───────── */
  const BAG_KEY = "riweather.mybag";
  function saveBag(r) {
    const bag = {
      ts: Date.now(),
      verdict: r.keep ? "keep" : "review",
      band: { wLo: r.wLo, wHi: r.wHi, fx: r.fxT },
      driver: r.keep
        ? { head: null, shaft: r.cur.label + (r.cur.w ? ` (${r.cur.w}g·${r.cur.fx})` : ""), keep: true }
        : { head: `${r.mainHead.br} ${r.mainHead.m}`,
            shaft: `${r.shafts[0].m} ${r.shafts[0].sp} (${r.shafts[0].w}g·${r.shafts[0].fx})`, keep: false },
      grip: r.grip.m,
      carry7: S.carry7, carryD: S.carryD, shapeD: S.shapeD,
    };
    try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch (_) {}
    return bag;
  }
  window.loadMyBag = function () {
    try { return JSON.parse(localStorage.getItem(BAG_KEY) || "null"); } catch (_) { return null; }
  };

  /* ───────── 결과 렌더 ───────── */
  function renderResult() {
    const r = engine();
    const brandTxt = (S.brand && S.brand !== "any") ? S.brand : "전체 브랜드";
    const verdict = r.keep
      ? `<div class="verdict"><span class="v-stamp keep">유 지</span>
          <div class="v-label">FITTING VERDICT</div>
          <div class="v-main">지금 클럽, 그대로 쓰세요</div>
          <div class="v-sub">현재 ${r.cur.label}(${r.cur.w}g·${r.cur.fx})가 계산 밴드(${r.wLo}~${r.wHi}g · ${r.fxT.join("/")}) 안입니다.<br><b>바꿔도 2타 못 법니다.</b> 그 예산은 레슨이나 그린피가 낫습니다.</div>
        </div>`
      : `<div class="verdict"><span class="v-stamp">교체 검토</span>
          <div class="v-label">FITTING VERDICT</div>
          <div class="v-main">맞춰볼 여지가 있습니다</div>
          <div class="v-sub">캐리 ${S.carry7}m → 약 ${r.mph}mph 추정 → 기준 <b>${r.wLo}~${r.wHi}g · ${r.fxT.join("/")}</b></div>
        </div>`;
    const noteHtml = r.notes.map((n) => `<div class="warn-card"><b>${n.h}</b> — ${n.b}</div>`).join("");
    const shaftHtml = r.shafts.map((s, i) => `
      <div class="res-card"><span class="kind">SHAFT ${i + 1}</span>
        <div class="r-name">${s.m} ${s.sp}</div>
        <div class="r-spec">${s.b} · ${s.w}g · ${s.fx} · 토크 ${s.tq}° · 킥 ${s.k}${s.velo ? " · 벨로코어" : ""}</div>
        <ul>${s.why.slice(0, 3).map((w) => `<li>${w}</li>`).join("")}</ul>
      </div>`).join("");
    const headHtml = `
      <div class="res-card"><span class="kind">HEAD</span>
        <div class="r-name">${r.mainHead.br} ${r.mainHead.m}</div>
        <div class="r-spec">관용성 ${r.mainHead.forg}/5 · 스핀 ${r.mainHead.spin} · ${r.mainHead.draw ? "드로 바이어스" : "뉴트럴"}</div>
        <ul>${r.mainHead.why.slice(0, 3).map((w) => `<li>${w}</li>`).join("") || "<li>선호 브랜드 내 최적</li>"}</ul>
      </div>
      ${r.altHead ? `<button class="alt-toggle" data-alt>다른 브랜드 1개만 참고로 보기 ▾</button>
      <div id="cf-altbox" style="display:none">
        <div class="res-card"><span class="kind">ALT</span>
          <div class="r-name">${r.altHead.br} ${r.altHead.m}</div>
          <div class="r-spec">관용성 ${r.altHead.forg}/5 · 스핀 ${r.altHead.spin} · ${r.altHead.draw ? "드로 바이어스" : "뉴트럴"}</div>
          <ul>${r.altHead.why.slice(0, 2).map((w) => `<li>${w}</li>`).join("") || "<li>타 브랜드 중 최고점</li>"}</ul>
        </div>
      </div>` : ""}`;
    return `
      <div class="q-eyebrow">판정 · ${brandTxt} 우선 ${S.didFine ? "· 본봉 반영" : "· 가봉만 반영"}</div>
      ${verdict}${noteHtml}
      <div class="section-h">샤프트 <span class="cnt">${S.budget === "stock" ? "순정 풀" : SHAFTS.length + "장 풀"}에서 압축</span></div>
      ${shaftHtml}
      <div class="section-h">헤드 <span class="cnt">${brandTxt} 안에서 1순위</span></div>
      ${headHtml}
      <div class="section-h">그립</div>
      <div class="res-card"><span class="kind">GRIP</span>
        <div class="r-name">${r.grip.m}</div>
        <div class="r-spec">${r.grip.spec}</div>
        <ul><li>${r.grip.why}</li></ul>
      </div>
      ${r.tips.length ? `<div class="section-h">추가 코멘트</div>${r.tips.map((t) => `<div class="tip-line">· ${t}</div>`).join("")}` : ""}
      <div class="btn-row" style="margin-top:16px">
        <button class="cf-btn accent" data-savebag>💾 내 백에 저장 — AI 캐디가 씁니다</button>
      </div>
      <div id="cf-bag-saved" class="inline-note" style="display:none"><b>저장 완료</b> — 이제 홀별 공략에서 이 클럽 기준으로 조언합니다.</div>
      <div class="restart-row">
        <button class="cf-btn ghost" data-restart>처음부터 다시</button>
        ${S.didFine ? "" : '<button class="cf-btn" data-gofine>본봉 5문항 추가</button>'}
      </div>
      <div class="cf-foot">※ 스펙 수치는 초기 데이터 — 시타 없이 구매하지 마세요. 추천은 판매와 무관합니다.</div>`;
  }

  /* ───────── 네비게이션 ───────── */
  function scrEl() { return $$("#cf-screen"); }
  function go(i) {
    idx = Math.max(0, Math.min(i, SCREENS.length - 1));
    const sc = SCREENS[idx];
    scrEl().innerHTML = (idx > 0 ? `<button class="cf-back" data-back>← 이전</button>` : "") + sc.render();
    const stage = $$("#cf-stage"), step = $$("#cf-step"), bar = $$("#cf-stitch");
    stage.textContent = sc.stage;
    if (sc.stage === "가봉") { step.textContent = `${sc.q} / 8 시침`; bar.style.width = (sc.q / 8 * 100) + "%"; }
    else if (sc.stage === "본봉") { step.textContent = `${sc.q} / 5 본박음`; bar.style.width = (sc.q / 5 * 100) + "%"; }
    else if (sc.stage === "판정") { step.textContent = "완성"; bar.style.width = "100%"; }
    else if (sc.stage === "가봉 완료") { step.textContent = "8 / 8 시침 완료"; bar.style.width = "100%"; }
    else { step.textContent = ""; bar.style.width = "0%"; }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function canPassScore() { return S.scoreConfirm === "ok" || (S.scoreConfirm === "diff" && S.scoreGrp); }
  function advance() {
    const sc = SCREENS[idx];
    if (sc.stage === "본봉" && sc.q === 5) S.didFine = true;
    go(idx + 1);
  }

  function bindEvents() {
    const el = $$("#clubfit-view");
    if (!el || el._cfBound) return;
    el._cfBound = true;
    el.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest("[data-back]")) return go(idx - 1);
      if (t.closest("[data-next]")) return advance();
      if (t.closest("[data-skip]")) { if (SCREENS[idx].stage === "본봉" && SCREENS[idx].q === 1) S.heightV = null; return advance(); }
      if (t.closest("[data-restart]")) {
        Object.assign(S, { career: null, scoreConfirm: null, carry7: 150, carryD: 220, shapeD: null, endur: null, brand: null, curShaft: null, complaint: null, heightV: 172, traj: null, shapeI: null, tempo: null, budget: null, didFine: false });
        computeAuto();
        return go(0);
      }
      if (t.closest("[data-gofine]")) { S.didFine = true; return go(SCREENS.findIndex((s) => s.stage === "본봉" && s.q === 1)); }
      if (t.closest("[data-jump]")) return go(SCREENS.findIndex((s) => s.key === t.closest("[data-jump]").dataset.jump));
      if (t.closest("[data-alt]")) { const b = $$("#cf-altbox"); if (b) b.style.display = b.style.display === "none" ? "block" : "none"; return; }
      if (t.closest("[data-savebag]")) {
        saveBag(engine());
        const ok = $$("#cf-bag-saved"); if (ok) ok.style.display = "block";
        if (typeof STATS !== "undefined") STATS.hit("feature", "clubfit_save");
        return;
      }
      const chip = t.closest(".chip");
      if (chip && chip.closest("#clubfit-view")) {
        const box = chip.parentElement, key = box.dataset.key;
        box.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
        chip.setAttribute("aria-pressed", "true");
        S[key] = chip.dataset.v;
        if (key === "scoreConfirm") {
          if (S.scoreConfirm === "ok" && S.auto.avg !== null)
            S.scoreGrp = S.auto.avg < 90 ? "80" : S.auto.avg < 100 ? "90" : "100";
          const fix = $$("#cf-scorefix"); if (fix) fix.style.display = S.scoreConfirm === "diff" ? "block" : "none";
          const nb = el.querySelector("[data-next]"); if (nb) nb.disabled = !canPassScore();
          return;
        }
        if (key === "scoreGrp" && S.auto.avg !== null) {
          const nb = el.querySelector("[data-next]"); if (nb) { nb.disabled = !canPassScore(); return; }
        }
        if (key === "curShaft" || key === "complaint") {
          const nb = el.querySelector("[data-next]"); if (nb) nb.disabled = !(S.curShaft && S.complaint);
          return;
        }
        if (box.dataset.auto === "1") setTimeout(advance, 220);
      }
    });
    el.addEventListener("input", (e) => {
      const sl = e.target.closest("[data-slider]");
      if (!sl) return;
      const key = sl.dataset.slider;
      S[key] = Number(sl.value);
      const v = $$("#cfv_" + key); if (v) v.textContent = S[key];
      if (key === "carryD" || key === "carry7") {
        const box = $$("#cf-rationote");
        if (box) {
          const r = S.carryD / S.carry7;
          box.innerHTML = r > 1.68 ? `<div class="inline-note"><b>흠, 잠깐요</b> — 7번 ${S.carry7}m에 드라이버 ${S.carryD}m(×${r.toFixed(2)})는 드문 조합입니다. 정타 기준으로 다시 한번?</div>`
            : (r < 1.50 && S.carryD > 0) ? `<div class="inline-note"><b>정타율 신호</b> — 7번 대비 드라이버가 짧네요. 관용성 헤드에 가점됩니다.</div>` : "";
        }
      }
    });
  }

  /* ───────── 진입점 ───────── */
  window.openClubfitView = function () {
    computeAuto();
    bindEvents();
    if (typeof pushView === "function") pushView("clubfit");
    go(0);
  };

  // 검수용: 콘솔에서 엔진 직접 실행 (window.__cfTest(입력) → 판정 요약)
  window.__cfTest = function (inp) {
    const bak = JSON.stringify(S);
    Object.assign(S, inp);
    if (inp.auto) Object.assign(S.auto, inp.auto);
    const r = engine();
    const out = { keep: r.keep, band: `${r.wLo}~${r.wHi}g ${r.fxT.join("/")}`,
      shaft1: r.shafts[0] ? `${r.shafts[0].m} ${r.shafts[0].sp}` : null,
      head: `${r.mainHead.br} ${r.mainHead.m}`,
      notes: r.notes.map((n) => n.h) };
    Object.assign(S, JSON.parse(bak));
    return out;
  };
})();
