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

  /* ───────── 아이언 ─────────
     아이언 샤프트는 드라이버와 달리 무게 대역이 소재(스틸/그라파이트)로 갈린다.
     무게는 제조사 공표 표준값 기준. 개체·번수별 오차가 있어 "약"으로 표기한다. */
  const IRON_SHAFTS = [
    { b: "니폰", m: "N.S.PRO 모더스3 투어 105", sp: "S", w: 106, fx: "S", mat: "스틸", k: "중", feel: "부드럽다" },
    { b: "니폰", m: "N.S.PRO 모더스3 투어 120", sp: "S", w: 114, fx: "S", mat: "스틸", k: "중저", feel: "단단하다" },
    { b: "니폰", m: "N.S.PRO 950GH neo", sp: "S", w: 98, fx: "S", mat: "스틸", k: "중고", feel: "가볍다" },
    { b: "니폰", m: "N.S.PRO 850GH neo", sp: "R", w: 89, fx: "R", mat: "스틸", k: "고", feel: "가볍다" },
    { b: "트루템퍼", m: "다이나믹골드 EX 투어이슈", sp: "S200", w: 128, fx: "S", mat: "스틸", k: "낮음", feel: "묵직하다" },
    { b: "트루템퍼", m: "다이나믹골드 105", sp: "R300", w: 105, fx: "R", mat: "스틸", k: "중", feel: "묵직하다" },
    { b: "KBS", m: "투어 라이트", sp: "R", w: 95, fx: "R", mat: "스틸", k: "중고", feel: "가볍다" },
    { b: "KBS", m: "$-테이퍼 라이트", sp: "S", w: 110, fx: "S", mat: "스틸", k: "중저", feel: "단단하다" },
    { b: "UST마미야", m: "리코일 다트 75", sp: "S", w: 77, fx: "S", mat: "그라파이트", k: "중", feel: "부드럽다" },
    { b: "UST마미야", m: "리코일 660", sp: "R", w: 66, fx: "R", mat: "그라파이트", k: "고", feel: "가볍다" },
    { b: "후지쿠라", m: "MC 아이언", sp: "S", w: 88, fx: "S", mat: "그라파이트", k: "중", feel: "부드럽다" },
    { b: "던롭", m: "젝시오 순정 MP1300I", sp: "R", w: 60, fx: "R", mat: "그라파이트", k: "고", feel: "가볍다", stock: true },
  ];
  /* 헤드 형상은 관용성(forg)과 난이도가 반비례한다 — 평균 타수로 갈린다 */
  const IRON_HEADS = [
    { br: "타이틀리스트", m: "T100", type: "투어 캐비티", forg: 2, off: "적음", fit: ["80"] },
    { br: "타이틀리스트", m: "T150", type: "캐비티", forg: 3, off: "적음", fit: ["80"] },
    { br: "타이틀리스트", m: "T200", type: "중공", forg: 4, off: "보통", fit: ["80", "90"] },
    { br: "타이틀리스트", m: "T350", type: "중공 맥스", forg: 5, off: "많음", fit: ["90", "100"] },
    { br: "핑", m: "i230", type: "캐비티", forg: 3, off: "적음", fit: ["80"] },
    { br: "핑", m: "G430", type: "맥스 캐비티", forg: 5, off: "많음", fit: ["90", "100"] },
    { br: "테일러메이드", m: "P790", type: "중공", forg: 4, off: "보통", fit: ["80", "90"] },
    { br: "테일러메이드", m: "Qi 아이언", type: "맥스 캐비티", forg: 5, off: "많음", fit: ["90", "100"] },
    { br: "캘러웨이", m: "에이팩스 프로", type: "캐비티", forg: 3, off: "적음", fit: ["80"] },
    { br: "캘러웨이", m: "패러다임 Ai스모크", type: "맥스 캐비티", forg: 5, off: "많음", fit: ["90", "100"] },
    { br: "미즈노", m: "JPX 923 포지드", type: "캐비티", forg: 3, off: "적음", fit: ["80", "90"] },
    { br: "던롭", m: "젝시오 13 아이언", type: "경량 맥스", forg: 5, off: "많음", fit: ["90", "100"], light: true },
  ];
  /* 웨지 — 바운스는 스윙 타입(디거/스위퍼)과 잔디 상태로 정해진다. 이건 규칙으로 계산 가능한 영역 */
  const WEDGES = [
    { br: "타이틀리스트", m: "보키 SM10" },
    { br: "클리브랜드", m: "RTX 6 집코어" },
    { br: "핑", m: "글라이드 4.0" },
    { br: "테일러메이드", m: "밀드그라인드 4" },
    { br: "캘러웨이", m: "죠스 로우" },
    { br: "미즈노", m: "T24" },
  ];
  /* 퍼터 — 스트로크 궤도와 헤드 밸런스의 궁합은 피팅의 기본 원칙 */
  const PUTTERS = [
    { br: "스카티카메론", m: "뉴포트 2", shape: "블레이드", bal: "토우행", arc: "arc" },
    { br: "스카티카메론", m: "팬텀 11", shape: "말렛", bal: "페이스밸런스", arc: "straight" },
    { br: "오디세이", m: "화이트핫 OG #1", shape: "블레이드", bal: "토우행", arc: "arc" },
    { br: "오디세이", m: "아이원 세븐", shape: "말렛", bal: "페이스밸런스", arc: "straight" },
    { br: "테일러메이드", m: "스파이더 텐", shape: "말렛", bal: "페이스밸런스", arc: "straight" },
    { br: "핑", m: "앤서 2", shape: "블레이드", bal: "토우행", arc: "arc" },
    { br: "핑", m: "틴 팬", shape: "미드말렛", bal: "약토우행", arc: "slight" },
    { br: "오디세이", m: "트라이핫 5K 트리플와이드", shape: "미드말렛", bal: "약토우행", arc: "slight" },
  ];

  /* ───────── 상태 ───────── */
  const S = {
    auto: { age: null, sex: null, avg: null, fade: null },   // 실데이터에서 채움
    career: null, scoreConfirm: null, scoreGrp: "90", carry7: 150, carryD: 220,
    shapeD: null, endur: null, brand: null, curShaft: null, complaint: null,
    heightV: 172, traj: null, shapeI: null, tempo: null, budget: null,
    didFine: false, shaftBrand: null,
    // 클럽별 모듈 (드라이버 뒤에 이어서, 각 3문항)
    ironMiss: null, ironFeel: null, ironMat: null,
    wedgeTurf: null, wedgeMiss: null, pwLoft: 45,   // 45° = 요즘 아이언 피칭 표준
    puttStroke: null, puttMiss: null, puttLook: null,
  };
  let idx = 0;

  /* ───────── 선호 브랜드 우선 추천 ─────────
     사장님 지시: 1순위는 선호 브랜드 안에서, 그다음 다른 브랜드의 최적안을 함께 권한다.
     브랜드 안에 마땅한 게 없으면 억지로 채우지 않고 전체 1순위를 내보낸다(신뢰 우선). */
  /* 사장님 원칙: 선호 브랜드가 있으면 **무조건 그 브랜드 안에서** 1순위를 뽑는다.
     점수가 조금 낮아도 그게 "그 브랜드에서 가장 잘 맞는 것"이므로 1순위가 맞다.
     (예전엔 전체 1위의 70% 미만이면 탈락시켜서, 핑을 골라도 타이틀리스트가 나왔다.)

     단 하나의 예외 — `ok` 로 넘기는 **하드 조건**은 못 넘는다.
     아이언에서 목표가 '스틸 107g' 인데 선호 브랜드에 그라파이트 88g 뿐이라면
     그건 취향 문제가 아니라 맞지 않는 물건이다. 이럴 때만 전체 1순위로 넘기고
     "선호 브랜드에는 맞는 게 없어 전체 1순위로 골랐다"고 화면에 밝힌다. */
  function pickByBrand(sorted, brand, key, ok) {
    const bk = key || "b";
    const want = brand && brand !== "any" ? brand : null;
    const fits = (x) => !ok || ok(x);
    const inBrand = want ? sorted.filter((x) => x[bk] === want && fits(x)) : [];
    const main = inBrand[0] || sorted.find(fits) || sorted[0];
    if (!main) return { main: null, alt: null, matched: false };
    // 다른 브랜드 대안 — 조건을 만족하는 것 중 최고점
    const alt = sorted.find((x) => x[bk] !== main[bk] && fits(x))
             || sorted.find((x) => x[bk] !== main[bk]) || null;
    return { main, alt, matched: !!inBrand[0], wanted: want };
  }

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

  /* 진행 표시 문구 — '가봉/본봉' 같은 재단 용어 대신
     클럽이 내게 맞춰지는 과정을 이야기로 들려준다 (사장님 지시 2026-07-27) */
  /* 내부 단계 이름 → 화면에 내보낼 말.
     'stage' 는 코드가 흐름을 구분하려고 쓰는 이름일 뿐이라 그대로 보여주면 안 된다. */
  const STAGE_LABEL = {
    "가봉": "피팅 중", "본봉": "정밀 피팅 중", "가봉 완료": "1차 피팅 완료",
    "판정": "결과", "내 백": "내 백", "자동 파악": "준비 중",
    "아이언": "아이언 맞추는 중", "웨지": "웨지 맞추는 중", "퍼터": "퍼터 맞추는 중",
  };

  const NARRATION = {"이미 알고 있는 것": "클럽을 찾고 있어요", "구력": "샵에 들어와 자리를 잡았어요", "평균 타수 확인": "어떤 골퍼인지 듣고 있어요", "평균 타수": "어떤 골퍼인지 듣고 있어요", "7번 아이언": "7번 아이언 거리를 재고 있어요", "드라이버": "드라이버 비거리를 재고 있어요", "드라이버 구질": "공이 어디로 휘는지 보고 있어요", "체력": "18홀 체력을 가늠하고 있어요", "브랜드": "선호하시는 브랜드를 적어뒀어요", "현재 클럽": "지금 쓰시는 클럽을 살펴봐요", "여기까지의 결과": "1차 피팅이 끝났어요", "키": "길이와 라이각을 맞추는 중이에요", "탄도": "탄도를 어떻게 낼지 보고 있어요", "아이언 구질": "아이언 구질도 함께 봅니다", "템포": "스윙 템포를 재고 있어요", "예산": "예산에 맞는 것만 남깁니다",  "아이언 · 미스 경향": "아이언을 맞추는 중이에요", "아이언 · 소재": "아이언 소재를 고르고 있어요", "아이언 · 타감": "타감을 맞추는 중이에요", "웨지 · 피칭 로프트": "웨지 간격을 계산하고 있어요", "웨지 · 스윙 타입": "바운스를 정하는 중이에요", "웨지 · 미스 경향": "솔 모양을 다듬고 있어요", "퍼터 · 스트로크": "퍼터 궤도를 보고 있어요", "퍼터 · 고민": "헤드 밸런스를 맞춰요", "퍼터 · 생김새": "마지막으로 눈에 맞춰요"};

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
      <div class="q-eyebrow">이미 알고 있는 것</div>
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
      <div class="btn-row"><button class="cf-btn" data-next>피팅 시작 — 8문항</button></div>`
    },
    { stage: "가봉", q: 1, render: () => `
      <div class="q-eyebrow">구력</div>
      <div class="q-title">골프, 얼마나 치셨어요?</div>
      <div class="q-body">${chipList([
        { v: "lt3", t: "3년 미만" }, { v: "y3_10", t: "3~10년" }, { v: "gt10", t: "10년 이상" }], "career")}</div>`
    },
    { stage: "가봉", q: 2, render: () => S.auto.avg !== null ? `
      <div class="q-eyebrow">평균 타수 확인</div>
      <div class="q-title">기록 기준 평균 ${S.auto.avg}타 —<br>맞나요?</div>
      <div class="q-sub">묻는 게 아니라 확인만 합니다.</div>
      <div class="q-body">
        ${chipList([{ v: "ok", t: `맞아요 (${S.scoreGrp === "100" ? "100타 이상" : S.scoreGrp + "대"})` }, { v: "diff", t: "조금 달라요" }], "scoreConfirm", { auto: false })}
        <div id="cf-scorefix" style="display:${S.scoreConfirm === "diff" ? "block" : "none"}" class="sub-q">
          <div class="q-eyebrow">실제 평균 타수대</div>
          ${chipList([{ v: "80", t: "80대 이하" }, { v: "90", t: "90대" }, { v: "100", t: "100타 이상" }], "scoreGrp", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!canPassScore())}` : `
      <div class="q-eyebrow">평균 타수</div>
      <div class="q-title">평균 타수대는?</div>
      <div class="q-sub">스코어 기록이 쌓이면 다음부터는 묻지 않습니다.</div>
      <div class="q-body">${chipList([
        { v: "80", t: "80대 이하" }, { v: "90", t: "90대" }, { v: "100", t: "100타 이상" }], "scoreGrp")}</div>`
    },
    { stage: "가봉", q: 3, render: () => `
      <div class="q-eyebrow">7번 아이언</div>
      <div class="q-title">7번 아이언 캐리는?</div>
      <div class="q-sub">런 빼고, 떨어지는 지점까지. 헤드스피드를 가장 정확히 알려주는 숫자입니다.</div>
      <div class="q-body">${slider("carry7", 110, 185, 5, "m")}</div>${nextBtn()}`
    },
    { stage: "가봉", q: 4, render: () => `
      <div class="q-eyebrow">드라이버</div>
      <div class="q-title">드라이버 캐리는?</div>
      <div class="q-sub">잘 맞은 공 말고, 평소 10번 중 6~7번 나오는 거리로.</div>
      <div class="q-body">${slider("carryD", 170, 265, 5, "m")}<div id="cf-rationote"></div></div>${nextBtn()}`
    },
    { stage: "가봉", q: 5, render: () => `
      <div class="q-eyebrow">드라이버 구질</div>
      <div class="q-title">드라이버는 주로<br>어느 쪽으로 미스가 나나요?</div>
      <div class="q-body">${chipList([
        { v: "slice", t: "슬라이스", s: "오른쪽으로 크게 휨" },
        { v: "fade", t: "페이드", s: "오른쪽으로 살짝" },
        { v: "straight", t: "스트레이트" },
        { v: "draw", t: "드로", s: "왼쪽으로 살짝" },
        { v: "hook", t: "훅", s: "왼쪽으로 크게 휨" }], "shapeD")}</div>`
    },
    { stage: "가봉", q: 6, render: () => `
      <div class="q-eyebrow">체력</div>
      <div class="q-title">하루 36홀, 가능하세요?</div>
      <div class="q-sub">${S.auto.fade !== null && S.auto.fade >= 3
        ? `스코어 기록의 후반 +${S.auto.fade}타 패턴과 함께 봅니다.`
        : "시타실 10구가 아니라 18홀 전체 기준으로 맞춥니다."}</div>
      <div class="q-body">${chipList([
        { v: "strong", t: "거뜬해요" },
        { v: "fadeLate", t: "후반엔 무너져요", s: "13번 홀 넘어가면 스윙이 처짐" },
        { v: "weak", t: "18홀도 벅차요" }], "endur")}</div>`
    },
    /* 헤드 브랜드와 샤프트 브랜드를 한 화면에서 함께 받는다.
       ⚠️ 샤프트 브랜드를 선택 단계(정밀 피팅)에 두었더니 대부분 질문 자체를 못 받고
          지나가 "선호 브랜드 우선 추천"이 작동하지 않았다(2026-07-27 지적).
          둘 다 기본 문항으로 올려서 항상 반영되게 한다. */
    { stage: "가봉", q: 7, render: () => `
      <div class="q-eyebrow">브랜드</div>
      <div class="q-title">선호하는 브랜드가<br>있으신가요?</div>
      <div class="q-sub">있으면 그 브랜드 안에서 가장 잘 맞는 것을 <b>1순위</b>로 골라드립니다.</div>
      <div class="q-body">
        <div class="q-eyebrow" style="margin-bottom:8px">클럽(헤드) 브랜드</div>
        ${chipList([
          { v: "타이틀리스트", t: "타이틀리스트" }, { v: "테일러메이드", t: "테일러메이드" },
          { v: "캘러웨이", t: "캘러웨이" }, { v: "핑", t: "핑" },
          { v: "던롭", t: "젝시오·혼마 계열" }, { v: "any", t: "상관없어요" }],
          "brand", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">샤프트 브랜드</div>
          <div class="q-sub" style="margin-bottom:12px">클럽 브랜드와는 별개입니다.</div>
          ${chipList([
            { v: "후지쿠라", t: "후지쿠라" }, { v: "그라파이트디자인", t: "그라파이트디자인" },
            { v: "미쓰비시", t: "미쓰비시" }, { v: "프로젝트X", t: "프로젝트X" },
            { v: "UST마미야", t: "UST마미야" }, { v: "any", t: "상관없어요" }],
            "shaftBrand", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.brand && S.shaftBrand))}`
    },
    { stage: "가봉", q: 8, render: () => `
      <div class="q-eyebrow">현재 클럽</div>
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
      <div class="q-eyebrow">여기까지의 결과</div>
      <div class="q-title">여기까지로도<br>추천이 가능합니다</div>
      <div class="q-sub">5문항을 더 하면 킥포인트·라이각·예산까지 잡아드립니다. 30초쯤 걸려요.</div>
      <div class="q-body"></div>
      <div class="btn-row">
        <button class="cf-btn ghost" data-jump="result">바로 결과 보기</button>
        <button class="cf-btn accent" data-next>정밀 피팅 계속</button>
      </div>`
    },
    { stage: "본봉", q: 1, render: () => `
      <div class="q-eyebrow">키</div>
      <div class="q-title">키가 어떻게 되세요?</div>
      <div class="q-sub">아이언 라이각·길이 코멘트에만 씁니다.</div>
      <div class="q-body">${slider("heightV", 150, 195, 1, "cm")}</div>
      ${nextBtn()}<button class="skip" data-skip>건너뛰기</button>`
    },
    { stage: "본봉", q: 2, render: () => `
      <div class="q-eyebrow">탄도</div>
      <div class="q-title">평소 드라이버 탄도는?</div>
      <div class="q-body">${chipList([
        { v: "low", t: "낮아요", s: "라인드라이브성" }, { v: "mid", t: "중간" }, { v: "high", t: "높아요", s: "떠서 밀리는 느낌" }], "traj")}</div>
      <button class="skip" data-skip>건너뛰기</button>`
    },
    { stage: "본봉", q: 3, render: () => `
      <div class="q-eyebrow">아이언 구질</div>
      <div class="q-title">아이언은 주로 어느 쪽?</div>
      <div class="q-sub">드라이버와 따로 봅니다 — 다른 유저가 많거든요.</div>
      <div class="q-body">${chipList([
        { v: "slice", t: "슬라이스" }, { v: "straight", t: "스트레이트" }, { v: "hook", t: "훅" }], "shapeI")}</div>
      <button class="skip" data-skip>건너뛰기</button>`
    },
    { stage: "본봉", q: 4, render: () => `
      <div class="q-eyebrow">템포</div>
      <div class="q-title">스윙 템포는?</div>
      <div class="q-body">${chipList([
        { v: "smooth", t: "부드러움", s: "천천히 올려서 툭" }, { v: "normal", t: "보통" }, { v: "fast", t: "빠름", s: "전환이 급하고 때리는 편" }], "tempo")}</div>
      <button class="skip" data-skip>건너뛰기</button>`
    },
    { stage: "본봉", q: 5, render: () => `
      <div class="q-eyebrow">예산</div>
      <div class="q-title">샤프트 예산은?</div>
      <div class="q-body">${chipList([
        { v: "stock", t: "순정이면 충분", s: "추가 지출 없이" },
        { v: "mid", t: "애프터마켓까지", s: "30~40만 원대" },
        { v: "any", t: "상관없어요" }], "budget")}</div>
      <button class="skip" data-skip>건너뛰기</button>`
    },
    { stage: "판정", key: "result", render: renderResult },

    /* ── 내 백 허브 → 클럽별 모듈 (각 3문항) ──
       드라이버에서 이미 받은 답(체력·평균타수·키·브랜드)은 다시 묻지 않는다. */
    { stage: "내 백", key: "bag", render: renderBag },

    { stage: "아이언", key: "iron1", q: 1, render: () => `
      <div class="q-eyebrow">아이언 · 미스 경향</div>
      <div class="q-title">아이언이 빗맞을 때<br>주로 어떻게 되나요?</div>
      <div class="q-body">${chipList([
        { v: "thin", t: "얇게 맞아요", s: "공이 안 뜨고 낮게 날아감" },
        { v: "fat", t: "뒤땅을 쳐요", s: "잔디를 먼저 파고듦" },
        { v: "dir", t: "방향이 흔들려요", s: "좌우로 갈림" },
        { v: "none", t: "특별한 경향은 없어요" }], "ironMiss")}</div>`
    },
    { stage: "아이언", key: "iron2", q: 2, render: () => `
      <div class="q-eyebrow">아이언 · 소재</div>
      <div class="q-title">샤프트 소재,<br>정해두신 게 있나요?</div>
      <div class="q-sub">모르시면 골라드립니다 — 체력과 스피드로 판단해요.</div>
      <div class="q-body">${chipList([
        { v: "unsure", t: "골라주세요", s: "체력·스피드 기준으로 판단" },
        { v: "스틸", t: "스틸", s: "방향·거리가 일정한 대신 무거움" },
        { v: "그라파이트", t: "그라파이트", s: "가벼워 후반까지 편함" }], "ironMat")}</div>`
    },
    { stage: "아이언", key: "iron3", q: 3, render: () => `
      <div class="q-eyebrow">아이언 · 타감</div>
      <div class="q-title">어떤 타감을<br>좋아하세요?</div>
      <div class="q-body">${chipList([
        { v: "soft", t: "부드러운 쪽", s: "손에 닿는 느낌이 포근한" },
        { v: "solid", t: "단단한 쪽", s: "묵직하고 또렷한 타격감" },
        { v: "light", t: "가벼운 쪽", s: "휘두르기 편한" },
        { v: "any", t: "상관없어요" }], "ironFeel")}</div>`
    },
    { stage: "아이언", key: "ironResult", render: renderIron },

    { stage: "웨지", key: "wedge1", q: 1, render: () => `
      <div class="q-eyebrow">웨지 · 피칭 로프트</div>
      <div class="q-title">피칭웨지 로프트가<br>몇 도인가요?</div>
      <div class="q-sub">클럽 헤드에 적혀 있어요. 모르시면 45°로 계산합니다 — 요즘 아이언의 표준값입니다.</div>
      <div class="q-body">${slider("pwLoft", 41, 48, 1, "°")}
        <div class="inline-note">피칭과 로브(58°) 사이 간격을 몇 개로 나눌지가 여기서 정해집니다.
        <b>한 클럽당 4~6°</b>가 거리 공백이 안 생기는 간격이에요.</div>
      </div>${nextBtn(false)}`
    },
    { stage: "웨지", key: "wedge2", q: 2, render: () => `
      <div class="q-eyebrow">웨지 · 스윙 타입</div>
      <div class="q-title">어프로치할 때<br>잔디를 어떻게 치나요?</div>
      <div class="q-sub">바운스(솔의 각도)를 정하는 가장 중요한 정보입니다.</div>
      <div class="q-body">${chipList([
        { v: "dig", t: "깊게 파고들어요", s: "디봇이 크게 파임 — 디거" },
        { v: "sweep", t: "얕게 쓸어 쳐요", s: "디봇이 거의 안 생김 — 스위퍼" },
        { v: "mid", t: "중간이에요" }], "wedgeTurf")}</div>`
    },
    { stage: "웨지", key: "wedge3", q: 3, render: () => `
      <div class="q-eyebrow">웨지 · 미스 경향</div>
      <div class="q-title">짧은 어프로치에서<br>실수는 어느 쪽인가요?</div>
      <div class="q-body">${chipList([
        { v: "fat", t: "뒤땅이 나요", s: "공 앞 잔디를 먼저 침" },
        { v: "thin", t: "토핑이 나요", s: "공 윗부분을 때림" },
        { v: "none", t: "괜찮은 편이에요" }], "wedgeMiss")}</div>`
    },
    { stage: "웨지", key: "wedgeResult", render: renderWedge },

    { stage: "퍼터", key: "putt1", q: 1, render: () => `
      <div class="q-eyebrow">퍼터 · 스트로크</div>
      <div class="q-title">퍼팅할 때 헤드가<br>어떻게 움직이나요?</div>
      <div class="q-sub">퍼터 헤드 밸런스를 정하는 기준입니다.</div>
      <div class="q-body">${chipList([
        { v: "straight", t: "곧게 왔다갔다", s: "직선에 가까운 궤도" },
        { v: "slight", t: "살짝 안쪽으로", s: "약간의 아크" },
        { v: "arc", t: "많이 둥글게", s: "아크가 큰 궤도" }], "puttStroke")}</div>`
    },
    { stage: "퍼터", key: "putt2", q: 2, render: () => `
      <div class="q-eyebrow">퍼터 · 고민</div>
      <div class="q-title">퍼팅에서 더 아쉬운 쪽은?</div>
      <div class="q-body">${chipList([
        { v: "dist", t: "거리감", s: "짧거나 길게 지나감" },
        { v: "dir", t: "방향", s: "홀 옆으로 빗나감" },
        { v: "none", t: "딱히 없어요" }], "puttMiss")}</div>`
    },
    { stage: "퍼터", key: "putt3", q: 3, render: () => `
      <div class="q-eyebrow">퍼터 · 생김새</div>
      <div class="q-title">어떤 모양이<br>눈에 편하세요?</div>
      <div class="q-sub">퍼터는 감각의 비중이 큽니다. 눈에 편한 게 실제로 잘 들어가요.</div>
      <div class="q-body">${chipList([
        { v: "blade", t: "블레이드", s: "얇고 클래식한 모양" },
        { v: "mallet", t: "말렛", s: "크고 묵직한 모양" },
        { v: "any", t: "상관없어요" }], "puttLook")}</div>`
    },
    { stage: "퍼터", key: "puttResult", render: renderPutt },
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
    // 선호 브랜드 1순위 + 다른 브랜드 최적안 (샤프트·헤드 동일 방식)
    const headPick = pickByBrand(heads, S.brand, "br");
    const mainHead = headPick.main, altHead = headPick.alt;
    // 드라이버도 같은 원칙 — 무게 밴드를 크게 벗어난 샤프트는 선호 브랜드라도 1순위로 올리지 않는다
    const shaftPick = pickByBrand(shafts, S.shaftBrand, "b",
      (s) => s.w >= wLo - 6 && s.w <= wHi + 6);

    // 유지 판정 (최우선 분기)
    const keep = cur.w !== null
      && cur.w >= wLo - 3 && cur.w <= wHi + 3
      && fxT.some((f) => Math.abs(FLEX.indexOf(f) - FLEX.indexOf(cur.fx)) <= 0)
      && (S.complaint === "none" || S.complaint === "feel");

    // 점프 경고
    const top = shaftPick.main;
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

    return { wLo, wHi, fxT, notes, tips, shafts: shafts.slice(0, 2),
      shaftPick, headPick, mainHead, altHead, keep, cur, grip,
      mph: Math.round(S.carry7 * 0.63) };
  }

  /* ═══════════════════════════════════════════════════════════════
     클럽별 모듈 — 아이언 · 웨지 · 퍼터
     드라이버 판정이 끝나면 "내 백 채우기" 허브에서 하나씩 이어간다.
     한 번에 다 묻지 않는 이유: 설문이 길면 끝까지 오지 않는다.
     각 모듈은 3문항 이하 + 드라이버에서 이미 안 것(체력·타수·키)은 재사용.
     ═══════════════════════════════════════════════════════════════ */

  /* ── 아이언 ──────────────────────────────────────────────────── */
  function ironEngine() {
    const notes = [], band = speedBand(S.carry7);
    // 아이언 샤프트 무게는 드라이버 대역에 소재별 오프셋을 얹어 잡는다
    // (드라이버 카본 55g대 ≈ 아이언 스틸 105g대가 통상 궁합)
    const drvMid = (band.w[0] + band.w[1]) / 2;
    const steelTarget = Math.round(drvMid + 48);
    const graphTarget = Math.round(drvMid + 22);
    let fxT = [...band.fx];
    const tired = S.endur === "fadeLate" || S.endur === "weak" ||
                  (S.auto.fade !== null && S.auto.fade >= 3);

    // 소재 결정 — 본인 선택 우선, 미선택이면 체력·스피드로 판단
    let mat = S.ironMat;
    if (!mat || mat === "unsure") {
      mat = (tired || S.carry7 < 140 || S.auto.age === "60대 이상") ? "그라파이트" : "스틸";
      notes.push({ h: "소재는 이렇게 정했어요",
        b: mat === "그라파이트"
          ? "후반 체력·스윙 스피드를 보면 <b>가벼운 그라파이트</b>가 18홀 내내 스윙을 지켜줍니다."
          : "지금 스피드라면 <b>스틸</b>이 방향 안정과 거리 일관성에서 유리합니다." });
    }
    const target = mat === "스틸" ? steelTarget : graphTarget;
    if (tired) { fxT = shiftUp(fxT); }

    const pool = S.budget === "stock"
      ? IRON_SHAFTS.filter((s) => s.stock || s.w <= 100)
      : IRON_SHAFTS;
    const shafts = pool.map((s) => {
      let p = 0; const why = [];
      if (s.mat !== mat) p -= 30;
      const gap = Math.abs(s.w - target);
      if (gap <= 6) { p += 40; why.push(`약 ${s.w}g — 목표 무게(약 ${target}g)에 가장 근접`); }
      else p += Math.max(0, 40 - gap * 2.2);
      const fi = FLEX.indexOf(s.fx), tI = fxT.map((f) => FLEX.indexOf(f));
      if (tI.includes(fi)) { p += 30; why.push(`플렉스 ${s.fx} — 목표 강도 일치`); }
      else if (tI.some((t) => Math.abs(t - fi) === 1)) p += 12;
      if (S.ironMiss === "thin" && s.k === "고") { p += 10; why.push("높은 킥 — 얇게 맞는 미스에서 탄도 확보"); }
      if (S.ironMiss === "fat" && (s.k === "낮음" || s.k === "중저")) { p += 10; why.push("낮은 킥 — 뒤땅 경향에서 헤드가 덜 처짐"); }
      if (S.ironFeel === "soft" && s.feel === "부드럽다") { p += 12; why.push("부드러운 타감 선호에 맞음"); }
      if (S.ironFeel === "solid" && (s.feel === "단단하다" || s.feel === "묵직하다")) { p += 12; why.push("단단한 타감 선호에 맞음"); }
      if (S.ironFeel === "light" && s.feel === "가볍다") { p += 12; why.push("가벼운 쪽 선호에 맞음"); }
      return { ...s, p, why };
    }).sort((a, b) => b.p - a.p);

    const heads = IRON_HEADS.map((h) => {
      let p = h.forg * 7; const why = [];
      if (h.fit.includes(S.scoreGrp || "90")) { p += 22; why.push(`평균 ${S.auto.avg || S.scoreGrp + "대"}타 구간에 맞는 난이도`); }
      if (S.ironMiss === "thin" && h.forg >= 4) { p += 14; why.push(`관용성 ${h.forg}/5 — 얇게 맞아도 거리 손실이 적음`); }
      if (S.ironMiss === "dir" && h.off === "많음") { p += 12; why.push("오프셋 많음 — 페이스가 늦게 열려 방향 안정"); }
      if (S.shapeI === "slice" && h.off === "많음") { p += 12; why.push("오프셋 많음 — 슬라이스 완화"); }
      if (S.shapeI === "hook" && h.off === "적음") { p += 10; why.push("오프셋 적음 — 훅 억제"); }
      if (h.light && (tired || S.carry7 < 140)) { p += 10; why.push("경량 설계 — 후반까지 스윙 유지"); }
      return { ...h, p, why };
    }).sort((a, b) => b.p - a.p);

    if (mat === "스틸" && S.ironMat === "그라파이트")
      notes.push({ h: "선택하신 소재를 따랐어요", b: "그라파이트로 골랐습니다. 다만 스틸보다 <b>거리 편차가 커질 수</b> 있어 시타에서 꼭 확인해 보세요." });

    return {
      mat, target, fxT,
      // 소재가 다르거나 목표 무게에서 12g 넘게 벗어난 샤프트는 브랜드 선호와 무관하게 제외
      shaftPick: pickByBrand(shafts, S.shaftBrand, "b",
        (s) => s.mat === mat && Math.abs(s.w - target) <= 12),
      headPick: pickByBrand(heads, S.brand, "br"),
      notes,
      lie: S.heightV >= 185 ? "1~2° 업라이트 검토"
         : S.heightV <= 162 ? "플랫 / 길이 -0.25\" 검토" : "표준 라이각 범위",
    };
  }

  /* ── 웨지 ────────────────────────────────────────────────────
     로프트 갭은 계산으로 딱 떨어지는 영역이라 추측이 들어가지 않는다.
     바운스는 스윙 타입(디거/스위퍼)이 정하는 정석 규칙을 따른다. */
  function wedgeEngine() {
    const pw = S.pwLoft || 45;            // 모르면 최근 아이언 표준값 45°
    const lw = 58;                        // 로브웨지는 58° 기준
    const span = lw - pw;
    // 갭이 12° 이상이면 3개, 아니면 2개로 나눈다 (한 클럽당 4~6°가 정석)
    const cnt = span >= 12 ? 3 : 2;
    const step = Math.round((span / cnt) * 2) / 2;
    const lofts = [];
    for (let i = 1; i <= cnt; i++) lofts.push(Math.round(pw + step * i));
    lofts[lofts.length - 1] = lw;

    // 바운스 — 디거는 높게, 스위퍼는 낮게. 잔디가 무르면 한 단계 더 높게
    let base = S.wedgeTurf === "dig" ? 12 : S.wedgeTurf === "sweep" ? 8 : 10;
    const soft = S.wedgeMiss === "fat";
    if (soft) base += 2;
    const grind = S.wedgeTurf === "dig" ? "넓은 솔(와이드) — 파고들어도 튕겨 나옴"
                : S.wedgeTurf === "sweep" ? "좁은 솔(내로우) — 얕게 쓸어 치기 좋음"
                : "중간 솔 — 두루 무난";

    const specs = lofts.map((lo, i) => {
      // 갭웨지 쪽은 풀스윙이 많아 바운스를 조금 낮추고, 로브는 높인다
      const b = Math.max(4, Math.min(14, base + (i === lofts.length - 1 ? 2 : i === 0 ? -2 : 0)));
      return { loft: lo, bounce: b,
        use: i === 0 ? "풀스윙 갭 메우기" : i === lofts.length - 1 ? "그린 주변 띄우기·벙커" : "어프로치 주력" };
    });

    return {
      pw, cnt, specs, grind,
      pick: pickByBrand(WEDGES.map((w) => ({ ...w, p: w.br === S.brand ? 10 : 0 }))
                        .sort((a, b) => b.p - a.p), S.brand, "br"),
      note: `피칭(${pw}°)과 로브(58°) 사이 ${span}°를 ${cnt}개로 나눴습니다. ` +
            `한 클럽당 ${step}° — 거리 공백이 생기지 않는 간격입니다.`,
    };
  }

  /* ── 퍼터 ────────────────────────────────────────────────────
     스트로크 궤도와 헤드 밸런스의 궁합, 키에 따른 길이 —
     둘 다 피팅에서 근거가 분명한 영역이라 규칙으로 계산한다. */
  function putterEngine() {
    const arc = S.puttStroke || "slight";
    const scored = PUTTERS.map((p) => {
      let s = 0; const why = [];
      if (p.arc === arc) { s += 40; why.push(`${arc === "straight" ? "직선" : arc === "arc" ? "아크가 큰" : "약간 아크"} 스트로크에 맞는 ${p.bal}`); }
      else if ((arc === "slight" && p.arc !== "straight") || (p.arc === "slight")) s += 18;
      if (S.puttMiss === "dir" && p.shape !== "블레이드") { s += 16; why.push("말렛 계열 — 관성이 커서 방향이 덜 틀어짐"); }
      if (S.puttMiss === "dist" && p.shape === "블레이드") { s += 10; why.push("블레이드 — 거리감을 손끝으로 읽기 좋음"); }
      if (S.puttLook === "blade" && p.shape === "블레이드") { s += 14; why.push("선호하시는 생김새"); }
      if (S.puttLook === "mallet" && p.shape !== "블레이드") { s += 14; why.push("선호하시는 생김새"); }
      return { ...p, p: s, why };
    }).sort((a, b) => b.p - a.p);

    // 길이 — 키 기준 표준 (셋업 자세에 따라 ±0.5인치 조정 여지)
    const h = S.heightV || 172;
    const len = h >= 183 ? 35 : h >= 168 ? 34 : h >= 158 ? 33.5 : 33;

    return {
      arc, len,
      pick: pickByBrand(scored, S.brand, "br"),
      lie: "라이각은 셋업에서 퍼터 솔이 지면과 평행해지는지로 확인하세요.",
      note: arc === "straight"
        ? "직선에 가까운 스트로크에는 <b>페이스밸런스</b> 퍼터가 맞습니다. 헤드가 스스로 열리고 닫히지 않아 스트로크를 방해하지 않습니다."
        : arc === "arc"
        ? "아크가 큰 스트로크에는 <b>토우행</b> 퍼터가 맞습니다. 헤드가 자연스럽게 열렸다 닫히며 궤도를 따라옵니다."
        : "약간의 아크에는 <b>약토우행 미드말렛</b>이 무난합니다. 관용성과 궤도 궁합을 함께 가져갑니다.",
    };
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
  /* 클럽별 결과를 같은 백에 덧붙인다 — 드라이버만 하고 그만둬도 저장이 남는다 */
  function saveBagPart(what, r) {
    const bag = window.loadMyBag() || { ts: Date.now() };
    if (what === "iron") {
      bag.iron = {
        mat: r.mat, weight: r.target,
        shaft: `${r.shaftPick.main.m} ${r.shaftPick.main.sp}`,
        head: `${r.headPick.main.br} ${r.headPick.main.m}`,
      };
    } else if (what === "wedge") {
      bag.wedge = {
        lofts: r.specs.map((s) => s.loft),
        bounces: r.specs.map((s) => s.bounce),
        model: `${r.pick.main.br} ${r.pick.main.m}`,
      };
    } else if (what === "putter") {
      bag.putter = {
        model: `${r.pick.main.br} ${r.pick.main.m}`,
        shape: r.pick.main.shape, len: r.len,
      };
    }
    bag.ts = Date.now();
    try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch (_) {}
    return bag;
  }

  /* 추천 카드 한 장 — 선호 브랜드 1순위와 다른 브랜드 대안을 같은 모양으로 그린다 */
  function resCard(kind, name, spec, whys, alt) {
    return `<div class="res-card${alt ? " pick-alt" : ""}"><span class="kind">${kind}</span>
      <div class="r-name">${name}</div>
      <div class="r-spec">${spec}</div>
      <ul>${(whys || []).slice(0, 3).map((w) => `<li>${w}</li>`).join("")}</ul>
    </div>`;
  }
  /* 다른 브랜드 제안 문구 — 밀어붙이지 않고 권하는 말투 */
  function altLead(what) {
    return `<div class="alt-lead">이 ${what}도 골퍼님께 잘 맞을 것 같아요</div>`;
  }
  function brandLine(pick) {
    if (!pick.wanted) return "브랜드 상관없이 1순위";
    return pick.matched ? `${pick.wanted} 안에서 1순위`
      : `${pick.wanted}에는 맞는 게 없어 전체 1순위로 골랐어요`;
  }

  function shaftSpec(s) {
    return `${s.b} · ${s.w}g · ${s.fx} · 토크 ${s.tq}° · 킥 ${s.k}${s.velo ? " · 벨로코어" : ""}`;
  }

  /* ───────── 결과 렌더 (드라이버) ───────── */
  function renderResult() {
    const r = engine();
    const brandTxt = (S.brand && S.brand !== "any") ? S.brand : "전체 브랜드";
    const verdict = r.keep
      ? `<div class="verdict"><span class="v-stamp keep">그대로 유지</span>
          <div class="v-label">피팅 판정</div>
          <div class="v-main">지금 클럽, 그대로 쓰세요</div>
          <div class="v-sub">현재 ${r.cur.label}(${r.cur.w}g·${r.cur.fx})가 계산 밴드(${r.wLo}~${r.wHi}g · ${r.fxT.join("/")}) 안입니다.<br><b>바꿔도 2타 못 법니다.</b> 그 예산은 레슨이나 그린피가 낫습니다.</div>
        </div>`
      : `<div class="verdict"><span class="v-stamp">교체 검토</span>
          <div class="v-label">피팅 판정</div>
          <div class="v-main">맞춰볼 여지가 있습니다</div>
          <div class="v-sub">캐리 ${S.carry7}m → 약 ${r.mph}mph 추정 → 기준 <b>${r.wLo}~${r.wHi}g · ${r.fxT.join("/")}</b></div>
        </div>`;
    const noteHtml = r.notes.map((n) => `<div class="warn-card"><b>${n.h}</b> — ${n.b}</div>`).join("");

    const sp = r.shaftPick, hp = r.headPick;
    const shaftHtml =
      resCard("샤프트 1순위", `${sp.main.m} ${sp.main.sp}`, shaftSpec(sp.main), sp.main.why) +
      (sp.alt ? altLead("샤프트") + resCard(`${sp.alt.b}`, `${sp.alt.m} ${sp.alt.sp}`,
        shaftSpec(sp.alt), sp.alt.why, true) : "");
    const headSpec = (h) => `관용성 ${h.forg}/5 · 스핀 ${h.spin} · ${h.draw ? "드로 바이어스" : "뉴트럴"}`;
    const headHtml =
      resCard("헤드 1순위", `${hp.main.br} ${hp.main.m}`, headSpec(hp.main),
        hp.main.why.length ? hp.main.why : ["선호 브랜드 안에서 최적"]) +
      (hp.alt ? altLead("헤드") + resCard(`${hp.alt.br}`, `${hp.alt.br} ${hp.alt.m}`,
        headSpec(hp.alt), hp.alt.why.length ? hp.alt.why : ["다른 브랜드 중 최고점"], true) : "");

    return `
      <div class="q-eyebrow">드라이버 판정 · ${brandTxt} 우선${S.didFine ? " · 정밀 피팅 반영" : ""}</div>
      ${verdict}${noteHtml}
      <div class="section-h">샤프트 <span class="cnt">${brandLine(sp)}</span></div>
      ${shaftHtml}
      <div class="section-h">헤드 <span class="cnt">${brandLine(hp)}</span></div>
      ${headHtml}
      <div class="section-h">그립</div>
      ${resCard("그립", r.grip.m, r.grip.spec, [r.grip.why])}
      ${r.tips.length ? `<div class="section-h">추가 코멘트</div>${r.tips.map((t) => `<div class="tip-line">· ${t}</div>`).join("")}` : ""}
      <div class="btn-row" style="margin-top:16px">
        <button class="cf-btn accent" data-savebag>내 백에 저장 — AI 캐디가 씁니다</button>
      </div>
      <div id="cf-bag-saved" class="inline-note" style="display:none"><b>저장 완료</b> — 이제 홀별 공략에서 이 클럽 기준으로 조언합니다.</div>
      <div class="btn-row"><button class="cf-btn" data-jump="bag">다음 클럽도 맞춰보기 →</button></div>
      <div class="restart-row">
        <button class="cf-btn ghost" data-restart>처음부터 다시</button>
        ${S.didFine ? "" : '<button class="cf-btn ghost" data-gofine>정밀 피팅 5문항 더 하기</button>'}
      </div>
      <div class="cf-foot">※ 스펙 수치는 초기 데이터 — 시타 없이 구매하지 마세요. 추천은 판매와 무관합니다.</div>`;
  }

  /* ───────── 내 백 허브 ───────── */
  function bagRow(icon, name, desc, done, jump) {
    return `<button class="chip" data-jump="${jump}" style="display:flex;align-items:center;gap:12px">
      <span style="font-size:22px">${icon}</span>
      <span style="flex:1">${name}
        <small>${done ? "맞춤 완료 — 다시 보기" : desc}</small></span>
      <span style="color:var(--${done ? "green" : "text-faint"});font-weight:700">${done ? "완료" : "›"}</span>
    </button>`;
  }
  function renderBag() {
    const b = window.loadMyBag() || {};
    return `
      <div class="q-eyebrow">내 백</div>
      <div class="q-title">어떤 클럽을<br>맞춰볼까요?</div>
      <div class="q-sub">한 번에 다 하지 않아도 됩니다. 하나씩 채워도 AI 캐디가 그만큼 더 정확해져요.</div>
      <div class="q-body"><div class="chips">
        ${bagRow("🏌️", "드라이버", "샤프트 · 헤드 · 그립", !!b.driver, "result")}
        ${bagRow("⛳", "아이언", "3문항 — 소재 · 무게 · 헤드", !!b.iron, "iron1")}
        ${bagRow("🌊", "웨지", "3문항 — 로프트 갭 · 바운스", !!b.wedge, "wedge1")}
        ${bagRow("🎯", "퍼터", "3문항 — 스트로크 · 헤드 · 길이", !!b.putter, "putt1")}
      </div></div>
      <div class="btn-row"><button class="cf-btn ghost" data-jump="result">드라이버 결과로</button></div>`;
  }

  /* ───────── 아이언 결과 ───────── */
  function renderIron() {
    const r = ironEngine();
    const sp = r.shaftPick, hp = r.headPick;
    const sSpec = (s) => `${s.b} · ${s.mat} · 약 ${s.w}g · ${s.fx} · 킥 ${s.k}`;
    const hSpec = (h) => `${h.type} · 관용성 ${h.forg}/5 · 오프셋 ${h.off}`;
    return `
      <div class="q-eyebrow">아이언 판정</div>
      <div class="verdict">
        <div class="v-label">목표 스펙</div>
        <div class="v-main">${r.mat} · 약 ${r.target}g · ${r.fxT.join("/")}</div>
        <div class="v-sub">7번 캐리 ${S.carry7}m와 후반 체력까지 반영한 대역입니다.</div>
      </div>
      ${r.notes.map((n) => `<div class="warn-card"><b>${n.h}</b> — ${n.b}</div>`).join("")}
      <div class="section-h">샤프트 <span class="cnt">${brandLine(sp)}</span></div>
      ${resCard("샤프트 1순위", `${sp.main.m} ${sp.main.sp}`, sSpec(sp.main), sp.main.why)}
      ${sp.alt ? altLead("샤프트") + resCard(sp.alt.b, `${sp.alt.m} ${sp.alt.sp}`, sSpec(sp.alt), sp.alt.why, true) : ""}
      <div class="section-h">헤드 <span class="cnt">${brandLine(hp)}</span></div>
      ${resCard("헤드 1순위", `${hp.main.br} ${hp.main.m}`, hSpec(hp.main), hp.main.why)}
      ${hp.alt ? altLead("아이언") + resCard(hp.alt.br, `${hp.alt.br} ${hp.alt.m}`, hSpec(hp.alt), hp.alt.why, true) : ""}
      <div class="section-h">라이각</div>
      <div class="tip-line">· 키 ${S.heightV}cm — ${r.lie}. 임팩트 테이프로 실제 접지를 확인하는 게 가장 정확합니다.</div>
      <div class="btn-row"><button class="cf-btn accent" data-savebag="iron">내 백에 저장</button></div>
      <div id="cf-bag-saved" class="inline-note" style="display:none"><b>저장 완료</b></div>
      <div class="btn-row"><button class="cf-btn ghost" data-jump="bag">← 내 백으로</button></div>
      <div class="cf-foot">※ 무게는 제조사 표준값 기준이며 번수·개체 차이가 있습니다. 시타로 확인하세요.</div>`;
  }

  /* ───────── 웨지 결과 ───────── */
  function renderWedge() {
    const r = wedgeEngine();
    const p = r.pick;
    const rows = r.specs.map((s) =>
      resCard(`${s.loft}°`, `로프트 ${s.loft}° · 바운스 ${s.bounce}°`, s.use,
        [`${p.main.br} ${p.main.m} 기준 구성`])).join("");
    return `
      <div class="q-eyebrow">웨지 판정</div>
      <div class="verdict">
        <div class="v-label">구성</div>
        <div class="v-main">${r.cnt}개 구성 · ${r.specs.map((s) => s.loft + "°").join(" / ")}</div>
        <div class="v-sub">${r.note}</div>
      </div>
      <div class="warn-card"><b>솔 그라인드</b> — ${r.grind}</div>
      <div class="section-h">추천 구성</div>
      ${rows}
      <div class="section-h">모델 <span class="cnt">${brandLine(p)}</span></div>
      ${resCard("웨지 1순위", `${p.main.br} ${p.main.m}`, "위 로프트·바운스로 주문 가능",
        ["선호 브랜드 안에서 로프트 선택폭이 넓은 라인"])}
      ${p.alt ? altLead("웨지") + resCard(p.alt.br, `${p.alt.br} ${p.alt.m}`,
        "같은 로프트·바운스 구성 가능", ["다른 브랜드 중 대안"], true) : ""}
      <div class="btn-row"><button class="cf-btn accent" data-savebag="wedge">내 백에 저장</button></div>
      <div id="cf-bag-saved" class="inline-note" style="display:none"><b>저장 완료</b></div>
      <div class="btn-row"><button class="cf-btn ghost" data-jump="bag">← 내 백으로</button></div>
      <div class="cf-foot">※ 로프트 갭은 계산값입니다. 실제 거리는 시타로 채워 확인하세요.</div>`;
  }

  /* ───────── 퍼터 결과 ───────── */
  function renderPutt() {
    const r = putterEngine();
    const p = r.pick;
    const pSpec = (x) => `${x.shape} · ${x.bal}`;
    return `
      <div class="q-eyebrow">퍼터 판정</div>
      <div class="verdict">
        <div class="v-label">목표 스펙</div>
        <div class="v-main">${p.main.shape} · ${p.main.bal} · ${r.len}인치</div>
        <div class="v-sub">${r.note}</div>
      </div>
      <div class="section-h">모델 <span class="cnt">${brandLine(p)}</span></div>
      ${resCard("퍼터 1순위", `${p.main.br} ${p.main.m}`, pSpec(p.main), p.main.why)}
      ${p.alt ? altLead("퍼터") + resCard(p.alt.br, `${p.alt.br} ${p.alt.m}`, pSpec(p.alt), p.alt.why, true) : ""}
      <div class="section-h">길이 · 라이각</div>
      <div class="tip-line">· 키 ${S.heightV}cm 기준 <b>${r.len}인치</b>. 눈이 공 바로 위에 오면 맞는 길이입니다.</div>
      <div class="tip-line">· ${r.lie}</div>
      <div class="btn-row"><button class="cf-btn accent" data-savebag="putter">내 백에 저장</button></div>
      <div id="cf-bag-saved" class="inline-note" style="display:none"><b>저장 완료</b></div>
      <div class="btn-row"><button class="cf-btn ghost" data-jump="bag">← 내 백으로</button></div>
      <div class="cf-foot">※ 퍼터는 감각의 비중이 큽니다. 이 결과는 출발점으로만 쓰세요.</div>`;
  }

  /* ───────── 네비게이션 ───────── */
  function scrEl() { return $$("#cf-screen"); }
  /* 판정 화면은 계산이 순식간이라 그냥 뜨면 "정말 분석한 게 맞나" 싶어진다.
     실제로 룰 엔진이 도는 동안 무엇을 보고 있는지 말해주는 편이 결과를 신뢰하게 만든다. */
  const RESULT_KEYS = ["result", "ironResult", "wedgeResult", "puttResult"];
  function go(i) {
    const target = Math.max(0, Math.min(i, SCREENS.length - 1));
    if (RESULT_KEYS.includes(SCREENS[target].key) && typeof WAIT !== "undefined") {
      const w = WAIT.open("clubfit");
      setTimeout(() => { paint(target); w.close(); }, 2400);
      return;
    }
    paint(target);
  }
  function paint(i) {
    idx = i;
    const sc = SCREENS[idx];
    scrEl().innerHTML = (idx > 0 ? `<button class="cf-back" data-back>← 이전</button>` : "") + sc.render();
    const stage = $$("#cf-stage"), step = $$("#cf-step");
    // 진행 표시는 단계 이름("가봉")이 아니라 지금 무슨 일이 일어나는지를 말한다.
    // 화면의 eyebrow 를 열쇠로 문구를 찾고, 없으면 단계 이름으로 폴백.
    const eye = (scrEl().querySelector(".q-eyebrow") || {}).textContent || "";
    // stage 값("가봉"·"본봉")은 코드 안에서만 쓰는 이름이다.
    // 문구를 못 찾았을 때 그대로 노출되면 골퍼가 모르는 재단 용어가 화면에 뜬다 → 반드시 번역해서 내보낸다.
    stage.textContent = NARRATION[eye.trim()] || STAGE_LABEL[sc.stage] || "피팅 중";
    let t = 0;
    if (sc.stage === "가봉") { step.textContent = `${sc.q} / 8`; t = sc.q / 8; }
    else if (sc.stage === "본봉") { step.textContent = `${sc.q} / 5`; t = sc.q / 5; }
    else if (sc.stage === "판정") { step.textContent = "홀인!"; t = 1; }
    else if (sc.stage === "가봉 완료") { step.textContent = "8 / 8 완료"; t = 1; }
    // 클럽별 모듈은 3문항 — 결과 화면(q 없음)은 완료
    else if (["아이언", "웨지", "퍼터"].includes(sc.stage)) {
      step.textContent = sc.q ? `${sc.q} / 3` : "홀인!";
      t = sc.q ? sc.q / 3 : 1;
    }
    else { step.textContent = ""; t = 0; }
    flyBall(t);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* 공을 궤적 위 t(0~1) 지점으로 보낸다.
     경로 위 실제 좌표를 써야 포물선을 자연스럽게 따라간다. */
  let lastT = 0;
  function flyBall(t) {
    const arc = $$("#cf-arc"), ball = $$("#cf-ball"),
          golfer = $$("#cf-golfer"), flag = document.querySelector(".cf-flag");
    if (!arc || !ball) return;
    t = Math.max(0, Math.min(1, t));
    let len = 0;
    try { len = arc.getTotalLength(); } catch (_) { return; }

    // 지나온 만큼만 실선으로 드러낸다
    arc.style.strokeDasharray = len + " " + len;
    arc.style.strokeDashoffset = len * (1 - t);

    const p = arc.getPointAtLength(len * t);
    ball.setAttribute("cx", p.x);
    ball.setAttribute("cy", p.y);

    // 처음 공을 칠 때 스윙, 홀에 들어가면 깃발이 반긴다
    if (t > 0 && lastT === 0 && golfer) {
      golfer.classList.remove("swing"); void golfer.getBoundingClientRect();
      golfer.classList.add("swing");
    }
    ball.classList.toggle("holed", t >= 1);
    if (flag) flag.classList.toggle("cheer", t >= 1);
    lastT = t;
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
      const sb = t.closest("[data-savebag]");
      if (sb) {
        const what = sb.dataset.savebag || "driver";
        if (what === "iron") saveBagPart("iron", ironEngine());
        else if (what === "wedge") saveBagPart("wedge", wedgeEngine());
        else if (what === "putter") saveBagPart("putter", putterEngine());
        else saveBag(engine());
        const ok = $$("#cf-bag-saved"); if (ok) ok.style.display = "block";
        if (typeof STATS !== "undefined") STATS.hit("feature", "clubfit_save_" + what);
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
        // 브랜드 화면은 클럽·샤프트 두 가지를 다 골라야 넘어간다
        if (key === "brand" || key === "shaftBrand") {
          const nb = el.querySelector("[data-next]"); if (nb) nb.disabled = !(S.brand && S.shaftBrand);
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

  /* 검수용: 콘솔에서 엔진 직접 실행 (window.__cfTest(입력) → 판정 요약)
     화면이 실제로 쓰는 필드(shaftPick/headPick)를 그대로 보고해야
     "테스트는 통과인데 화면은 다른" 사고가 안 난다. */
  window.__cfTest = function (inp, which) {
    const bak = JSON.stringify(S);
    Object.assign(S, inp);
    if (inp.auto) Object.assign(S.auto, inp.auto);
    let out;
    if (which === "iron") {
      const r = ironEngine();
      out = { mat: r.mat, target: r.target, fx: r.fxT.join("/"),
        shaft1: `${r.shaftPick.main.m} ${r.shaftPick.main.sp}`,
        shaftAlt: r.shaftPick.alt ? `${r.shaftPick.alt.b} ${r.shaftPick.alt.m}` : null,
        head: `${r.headPick.main.br} ${r.headPick.main.m}`,
        headAlt: r.headPick.alt ? `${r.headPick.alt.br} ${r.headPick.alt.m}` : null };
    } else if (which === "wedge") {
      const r = wedgeEngine();
      out = { cnt: r.cnt, lofts: r.specs.map((s) => s.loft), bounces: r.specs.map((s) => s.bounce),
        model: `${r.pick.main.br} ${r.pick.main.m}` };
    } else if (which === "putter") {
      const r = putterEngine();
      out = { shape: r.pick.main.shape, bal: r.pick.main.bal, len: r.len,
        model: `${r.pick.main.br} ${r.pick.main.m}`,
        alt: r.pick.alt ? `${r.pick.alt.br} ${r.pick.alt.m}` : null };
    } else {
      const r = engine();
      out = { keep: r.keep, band: `${r.wLo}~${r.wHi}g ${r.fxT.join("/")}`,
        shaft1: `${r.shaftPick.main.m} ${r.shaftPick.main.sp}`,
        shaftBrand1: r.shaftPick.main.b,
        shaftAlt: r.shaftPick.alt ? `${r.shaftPick.alt.b} ${r.shaftPick.alt.m}` : null,
        head: `${r.headPick.main.br} ${r.headPick.main.m}`,
        headAlt: r.headPick.alt ? `${r.headPick.alt.br} ${r.headPick.alt.m}` : null,
        notes: r.notes.map((n) => n.h) };
    }
    Object.assign(S, JSON.parse(bak));
    return out;
  };
})();
