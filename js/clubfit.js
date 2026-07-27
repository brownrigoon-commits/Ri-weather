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
    { b: "후지쿠라", m: "벤투스 TR 블랙", st: "cur", pr: 3, sp: "5X", w: 58, fx: "X", tq: 3.2, k: "낮음", velo: true },
    { b: "후지쿠라", m: "벤투스 TR 블랙", st: "cur", pr: 3, sp: "6S", w: 67, fx: "S", tq: 3.0, k: "낮음", velo: true },
    { b: "후지쿠라", m: "벤투스 블루", st: "cur", pr: 3, sp: "5S", w: 56, fx: "S", tq: 3.6, k: "중", velo: true },
    { b: "후지쿠라", m: "벤투스 블루", st: "cur", pr: 3, sp: "6S", w: 64, fx: "S", tq: 3.1, k: "중", velo: true },
    { b: "후지쿠라", m: "벤투스 블랙", st: "old", pr: 3, sp: "6X", w: 67, fx: "X", tq: 3.0, k: "낮음", velo: true },
    { b: "후지쿠라", m: "스피더 NX 그린", st: "cur", pr: 3, sp: "50S", w: 54, fx: "S", tq: 4.3, k: "중고", velo: true },
    { b: "후지쿠라", m: "스피더 NX 블루", st: "old", pr: 2, sp: "40R", w: 46, fx: "R", tq: 5.4, k: "고", velo: true },
    { b: "후지쿠라", m: "스피더 NX 블랙", st: "cur", pr: 3, sp: "60X", w: 65, fx: "X", tq: 3.0, k: "낮음", velo: true },
    { b: "그라파이트디자인", m: "투어AD DI", st: "cur", pr: 3, sp: "6S", w: 64, fx: "S", tq: 3.3, k: "중" },
    { b: "그라파이트디자인", m: "투어AD UB", st: "old", pr: 3, sp: "5S", w: 57, fx: "S", tq: 3.9, k: "중" },
    { b: "그라파이트디자인", m: "투어AD VF", st: "cur", pr: 3, sp: "6X", w: 66, fx: "X", tq: 3.1, k: "중저" },
    { b: "미쓰비시", m: "텐세이 프로 블루 1K", st: "cur", pr: 3, sp: "50S", w: 56, fx: "S", tq: 4.0, k: "중" },
    { b: "미쓰비시", m: "디아마나 PD", st: "cur", pr: 3, sp: "60S", w: 63, fx: "S", tq: 3.2, k: "중저" },
    { b: "프로젝트X", m: "HZRDUS 스모크 블랙", st: "old", pr: 2, sp: "60 6.0", w: 62, fx: "S", tq: 3.4, k: "낮음" },
    { b: "던롭", m: "젝시오 순정 MP1300", st: "old", pr: 1, sp: "R", w: 40, fx: "R", tq: 6.5, k: "고", stock: true },
    { b: "타이틀리스트", m: "순정 TSP322", st: "cur", pr: 1, sp: "55S", w: 55, fx: "S", tq: 4.6, k: "중", stock: true },
    { b: "UST마미야", m: "아타스 킹", st: "old", pr: 2, sp: "5SR", w: 56, fx: "SR", tq: 4.2, k: "중고" },
  ];
  const HEADS = [
    { br: "타이틀리스트", m: "GT2", st: "cur", pr: 3, forg: 4, draw: false, spin: "중", light: false, fit: ["80", "90"] },
    { br: "타이틀리스트", m: "GT3", st: "cur", pr: 3, forg: 3, draw: false, spin: "중저", light: false, fit: ["80"] },
    { br: "타이틀리스트", m: "GT4", st: "cur", pr: 3, forg: 2, draw: false, spin: "저", light: false, fit: ["80"] },
    { br: "핑", m: "G430 MAX 10K", st: "cur", pr: 3, forg: 5, draw: false, spin: "중", light: false, fit: ["90", "100"] },
    { br: "핑", m: "G430 SFT", st: "old", pr: 2, forg: 4, draw: true, spin: "중", light: false, fit: ["90", "100"] },
    { br: "테일러메이드", m: "Qi10 MAX", st: "old", pr: 2, forg: 5, draw: false, spin: "중", light: false, fit: ["90", "100"] },
    { br: "캘러웨이", m: "Ai스모크 MAX D", st: "old", pr: 2, forg: 4, draw: true, spin: "중", light: false, fit: ["90", "100"] },
    { br: "던롭", m: "젝시오 13", st: "old", pr: 3, forg: 5, draw: true, spin: "중고", light: true, fit: ["90", "100"] },
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
    { b: "니폰", m: "N.S.PRO 모더스3 투어 105", st: "cur", pr: 2, sp: "S", w: 106, fx: "S", mat: "스틸", k: "중", feel: "부드럽다" },
    { b: "니폰", m: "N.S.PRO 모더스3 투어 120", st: "cur", pr: 2, sp: "S", w: 114, fx: "S", mat: "스틸", k: "중저", feel: "단단하다" },
    { b: "니폰", m: "N.S.PRO 950GH neo", st: "cur", pr: 2, sp: "S", w: 98, fx: "S", mat: "스틸", k: "중고", feel: "가볍다" },
    { b: "니폰", m: "N.S.PRO 850GH neo", st: "cur", pr: 2, sp: "R", w: 89, fx: "R", mat: "스틸", k: "고", feel: "가볍다" },
    { b: "트루템퍼", m: "다이나믹골드 EX 투어이슈", st: "cur", pr: 2, sp: "S200", w: 128, fx: "S", mat: "스틸", k: "낮음", feel: "묵직하다" },
    { b: "트루템퍼", m: "다이나믹골드 105", st: "cur", pr: 2, sp: "R300", w: 105, fx: "R", mat: "스틸", k: "중", feel: "묵직하다" },
    { b: "KBS", m: "투어 라이트", st: "cur", pr: 2, sp: "R", w: 95, fx: "R", mat: "스틸", k: "중고", feel: "가볍다" },
    { b: "KBS", m: "$-테이퍼 라이트", st: "cur", pr: 2, sp: "S", w: 110, fx: "S", mat: "스틸", k: "중저", feel: "단단하다" },
    { b: "UST마미야", m: "리코일 다트 75", st: "cur", pr: 3, sp: "S", w: 77, fx: "S", mat: "그라파이트", k: "중", feel: "부드럽다" },
    { b: "UST마미야", m: "리코일 660", st: "old", pr: 2, sp: "R", w: 66, fx: "R", mat: "그라파이트", k: "고", feel: "가볍다" },
    { b: "후지쿠라", m: "MC 아이언", st: "cur", pr: 3, sp: "S", w: 88, fx: "S", mat: "그라파이트", k: "중", feel: "부드럽다" },
    { b: "던롭", m: "젝시오 순정 MP1300I", st: "old", pr: 1, sp: "R", w: 60, fx: "R", mat: "그라파이트", k: "고", feel: "가볍다", stock: true },
  ];
  /* 헤드 형상은 관용성(forg)과 난이도가 반비례한다 — 평균 타수로 갈린다 */
  const IRON_HEADS = [
    { br: "타이틀리스트", m: "T100", st: "cur", pr: 3, type: "투어 캐비티", forg: 2, off: "적음", fit: ["80"] },
    { br: "타이틀리스트", m: "T150", st: "cur", pr: 3, type: "캐비티", forg: 3, off: "적음", fit: ["80"] },
    { br: "타이틀리스트", m: "T200", st: "cur", pr: 3, type: "중공", forg: 4, off: "보통", fit: ["80", "90"] },
    { br: "타이틀리스트", m: "T350", st: "cur", pr: 3, type: "중공 맥스", forg: 5, off: "많음", fit: ["90", "100"] },
    { br: "핑", m: "i230", st: "old", pr: 2, type: "캐비티", forg: 3, off: "적음", fit: ["80"] },
    { br: "핑", m: "G430", st: "old", pr: 2, type: "맥스 캐비티", forg: 5, off: "많음", fit: ["90", "100"] },
    { br: "테일러메이드", m: "P790", st: "cur", pr: 3, type: "중공", forg: 4, off: "보통", fit: ["80", "90"] },
    { br: "테일러메이드", m: "Qi 아이언", st: "cur", pr: 2, type: "맥스 캐비티", forg: 5, off: "많음", fit: ["90", "100"] },
    { br: "캘러웨이", m: "에이팩스 프로", st: "cur", pr: 3, type: "캐비티", forg: 3, off: "적음", fit: ["80"] },
    { br: "캘러웨이", m: "패러다임 Ai스모크", st: "old", pr: 2, type: "맥스 캐비티", forg: 5, off: "많음", fit: ["90", "100"] },
    { br: "미즈노", m: "JPX 923 포지드", st: "old", pr: 2, type: "캐비티", forg: 3, off: "적음", fit: ["80", "90"] },
    { br: "던롭", m: "젝시오 13 아이언", st: "old", pr: 3, type: "경량 맥스", forg: 5, off: "많음", fit: ["90", "100"], light: true },
  ];
  /* 웨지 — 바운스는 스윙 타입(디거/스위퍼)과 잔디 상태로 정해진다. 이건 규칙으로 계산 가능한 영역 */
  const WEDGES = [
    { br: "타이틀리스트", m: "보키 SM10", st: "cur", pr: 2 },
    { br: "클리브랜드", m: "RTX 6 집코어", st: "old", pr: 2 },
    { br: "핑", m: "글라이드 4.0", st: "cur", pr: 2 },
    { br: "테일러메이드", m: "밀드그라인드 4", st: "cur", pr: 2 },
    { br: "캘러웨이", m: "죠스 로우", st: "cur", pr: 2 },
    { br: "미즈노", m: "T24", st: "cur", pr: 2 },
  ];
  /* 퍼터 — 스트로크 궤도와 헤드 밸런스의 궁합은 피팅의 기본 원칙 */
  const PUTTERS = [
    { br: "스카티카메론", m: "뉴포트 2", st: "cur", pr: 3, shape: "블레이드", bal: "토우행", arc: "arc" },
    { br: "스카티카메론", m: "팬텀 11", st: "cur", pr: 3, shape: "말렛", bal: "페이스밸런스", arc: "straight" },
    { br: "오디세이", m: "화이트핫 OG #1", st: "cur", pr: 2, shape: "블레이드", bal: "토우행", arc: "arc" },
    { br: "오디세이", m: "아이원 세븐", st: "cur", pr: 3, shape: "말렛", bal: "페이스밸런스", arc: "straight" },
    { br: "테일러메이드", m: "스파이더 텐", st: "cur", pr: 3, shape: "말렛", bal: "페이스밸런스", arc: "straight" },
    { br: "핑", m: "앤서 2", st: "cur", pr: 2, shape: "블레이드", bal: "토우행", arc: "arc" },
    { br: "핑", m: "틴 팬", st: "old", pr: 2, shape: "미드말렛", bal: "약토우행", arc: "slight" },
    { br: "오디세이", m: "트라이핫 5K 트리플와이드", st: "old", pr: 2, shape: "미드말렛", bal: "약토우행", arc: "slight" },
  ];

  /* ───────── 그립 ─────────
     그립은 피팅에서 **유일하게 규칙만으로 거의 확정되는 영역**이다.
     사이즈는 제조사 공표 사이징표가 있고, 재질·경도는 조건이 명확하다.
     tex 재질 · firm 경도 · taper 하부 두께 · w 무게(g) */
  const GRIPS = [
    { b: "골프프라이드", m: "투어 벨벳", tex: "러버", firm: "표준", w: 50, taper: "표준" },
    { b: "골프프라이드", m: "MCC", tex: "하프코드", firm: "표준", w: 51, taper: "표준" },
    { b: "골프프라이드", m: "MCC 플러스4", tex: "하프코드", firm: "표준", w: 52, taper: "리듀스드" },
    { b: "골프프라이드", m: "CP2 프로", tex: "러버", firm: "소프트", w: 52, taper: "표준" },
    { b: "골프프라이드", m: "CP2 랩", tex: "러버", firm: "소프트", w: 54, taper: "표준" },
    { b: "골프프라이드", m: "Z-그립 코드", tex: "풀코드", firm: "펌", w: 52, taper: "표준" },
    { b: "람킨", m: "크로스라인 코드", tex: "풀코드", firm: "펌", w: 50, taper: "표준" },
    { b: "이오믹", m: "스티키 2.3", tex: "러버", firm: "소프트", w: 48, taper: "표준" },
    { b: "윈", m: "드라이 택 어드밴스", tex: "폴리머", firm: "소프트", w: 50, taper: "표준" },
  ];
  /* 골프프라이드 공표 사이징표 — 기준은 **손 길이**(가운뎃손가락 끝 ~ 손목 주름) */
  const GRIP_SIZE = [
    { max: 17.8, size: "언더사이즈" },
    { max: 21.0, size: "스탠다드" },
    { max: 23.5, size: "미드사이즈" },
    { max: 99, size: "점보" },
  ];
  /* ⚠️ 한국 장갑 호수 ↔ 미국 S/M/L 대응은 브랜드마다 다르다.
     호수만으로 단정하면 틀린다(절대 원칙 2) → **구간(범위)으로만** 쓰고
     손 길이를 재도록 안내한다. 손 길이가 있으면 항상 그쪽을 우선한다. */
  const GLOVE_HINT = {
    "18": "언더사이즈~스탠다드", "19": "언더사이즈~스탠다드", "20": "스탠다드",
    "21": "스탠다드", "22": "스탠다드", "23": "스탠다드~미드사이즈",
    "24": "스탠다드~미드사이즈", "25": "미드사이즈", "26": "미드사이즈~점보",
  };
  /* 퍼터 그립 — 손을 얼마나 쓰게 할지로 갈린다 */
  const PUTTER_GRIPS = [
    { m: "표준 피스톨", spec: "약 50~60g", why: "손끝 감각이 그대로 전달됩니다" },
    { m: "미드사이즈 (예: 슈퍼스트로크 2.0)", spec: "약 70~80g", why: "손 동작이 줄어 방향이 안정됩니다" },
    { m: "오버사이즈 + 카운터밸런스", spec: "약 90~110g", why: "손 떨림·짧은 퍼트 긴장을 눌러줍니다" },
  ];

  /* ───────── 상태 ───────── */
  /* 공통 프로필(P*)은 클럽을 바꿔도 다시 묻지 않는다 — localStorage 에 저장 */
  const S = {
    club: null,                                              // driver | iron | wedge | putter
    auto: { age: null, sex: null, avg: null, fade: null },   // 실데이터에서 채움
    /* ── 공통 프로필 ── */
    career: null, scoreConfirm: null, scoreGrp: "90", carry7: 150,
    heightV: 172, wristFloor: null, gloveSize: null, handLen: null,
    wristFloorV: 85, handLenV: 19, wristSkip: null, handSkip: null,
    endur: null, bodyIssue: [], venue: null, tempo: null,
    /* ── 그립 ── */
    gripCond: [], gripPress: null, gripFeel: null,
    /* ── 드라이버 ── */
    carryD: 220, startDir: null, curveDir: null, flight: null,
    faceV: null, faceH: null, teeHt: null, complaint: null,
    curLoft: null, curShaft: null, curLen: null, gripDown: null, carryVar: null,
    ball: null, budget: null, brand: null, shaftBrand: null,
    /* ── 아이언 ── */
    ironMiss: null, ironTraj: null, shapeI: null, ironMat: null, ironLook: null,
    ironComplaint: null, ironLongest: null, ironLongOk: null,
    ironBallMark: null, ironDivot: null, ironFeel: null,
    ironBrand: null, ironShaftBrand: null, ironCurModel: "", ironBudget: null,
    pwLoft: 45,                                              // 45° = 요즘 아이언 피칭 표준
    /* ── 웨지 ── */
    wedgeTurf: null, wedgeMiss: null, wedgeGrass: null,
    wedgeCount: null, wedgeBunker: null, wedgeShaft: null, wedgeBrand: null,
    /* ── 퍼터 ── */
    puttStroke: null, puttMiss: null, puttShort: null, puttLook: null,
    puttLine: null, puttFeel: null, puttCurLen: null, puttLong: null,
    puttEye: null, greenSpeed: null, puttHands: null, puttGrip: null,
    puttYips: null, putterBrand: null,
    /* 구버전 호환 — 옛 필드를 참조하는 코드가 남아 있어도 죽지 않게 */
    shapeD: null, traj: null, didFine: true,
  };
  let idx = 0;

  /* 공통 프로필 저장 — 두 번째 클럽부터는 확인 한 장으로 끝난다 */
  const PROFILE_KEY = "riweather.fitprofile";
  const PROFILE_FIELDS = ["career", "scoreConfirm", "scoreGrp", "carry7", "heightV",
    "wristFloor", "gloveSize", "handLen", "endur", "bodyIssue", "venue", "tempo"];
  function saveFitProfile() {
    const o = {};
    PROFILE_FIELDS.forEach((k) => { o[k] = S[k]; });
    o.ts = Date.now();
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(o)); } catch (_) {}
  }
  function loadFitProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch (_) { return null; }
  }
  /* 프로필이 "쓸 만한가" — 핵심 항목이 다 있어야 확인 화면으로 넘어간다 */
  function profileReady() {
    const p = loadFitProfile();
    if (!p) return false;
    return !!(p.career && p.endur && p.tempo && p.venue && p.carry7);
  }
  function applyFitProfile() {
    const p = loadFitProfile();
    if (!p) return false;
    PROFILE_FIELDS.forEach((k) => { if (p[k] !== undefined && p[k] !== null) S[k] = p[k]; });
    return true;
  }

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

  /* ───────── 현행 / 단종 2단 추천 ─────────
     사장님 확정(2026-07-27):
       · 1차 — **지금 살 수 있는 최신 모델** 중에서 고른다. 새로 사는 사람 기준.
       · 2차 — **단종까지 포함**해 더 잘 맞는 게 있으면 함께 알려준다.
              한국은 중고 시장이 커서 이게 실제로 값어치 있는 정보다.
     st: "cur" 현행 · "old" 단종/구세대 · 없음 = 아직 확인 못 함(현행으로 취급하지 않는다)
     pr: 1 순정·저가 · 2 중가 · 3 고가 */
  const PRICE_LABEL = { 1: "순정·보급", 2: "중가", 3: "고가" };
  function inBudget(x, budget) {
    if (!budget || budget === "any") return true;
    if (x.pr === undefined) return true;              // 모르는 건 거르지 않는다
    return budget === "stock" ? x.pr <= 1 : x.pr <= 2;
  }
  function pickTiers(sorted, brand, key, ok, budget) {
    const pool = sorted.filter((x) => inBudget(x, budget));
    const use = pool.length ? pool : sorted;
    const cur = use.filter((x) => x.st === "cur");
    const now = pickByBrand(cur.length ? cur : use, brand, key, ok);
    /* 2차 — 단종 중 가장 잘 맞는 것.
       "단종이 현행보다 점수가 높을 때만" 으로 잡았더니 45조합 중 0번 떴다.
       실제 값어치는 거기 있지 않다 — **성능이 비슷한데 값이 내려가는 것**이 핵심이다.
       그래서 현행 1순위의 85% 이상이면 내민다. 더 높으면 그렇다고 따로 말한다. */
    const olds = use.filter((x) => x.st === "old" && x !== now.main);
    const bestOld = olds.length ? pickByBrand(olds, brand, key, ok).main : null;
    const keep = bestOld && (bestOld.p || 0) >= (now.main ? (now.main.p || 0) * 0.85 : 0);
    return { ...now, older: keep ? bestOld : null,
             olderBetter: !!(keep && now.main && (bestOld.p || 0) > (now.main.p || 0)),
             narrowed: pool.length < sorted.length };
  }

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
    "선택": "어떤 클럽을 맞출까요", "확인": "지난 기록을 꺼내봐요", "공통": "골퍼님을 파악하는 중이에요",
    "브랜드": "선호하시는 브랜드를 적어뒀어요", "그립": "손에 맞는 그립을 고르는 중이에요",
    "드라이버": "드라이버를 맞추는 중이에요", "아이언": "아이언을 맞추는 중이에요",
    "웨지": "웨지를 맞추는 중이에요", "퍼터": "퍼터를 맞추는 중이에요", "결과": "결과",
  };

  /* 화면 eyebrow → 진행 문구. 없으면 group 으로 폴백한다(내부 이름이 새지 않게). */
  const NARRATION = {
    "클럽 선택": "어떤 클럽을 맞출까요",
    "이미 알고 있는 것": "이미 아는 것부터 꺼냈어요",
    "구력": "샵에 들어와 자리를 잡았어요",
    "평균 타수 확인": "어떤 골퍼인지 듣고 있어요", "평균 타수": "어떤 골퍼인지 듣고 있어요",
    "7번 아이언": "7번 아이언 거리를 재고 있어요",
    "키 · 팔 길이": "길이와 라이각을 맞추는 중이에요",
    "그립 사이즈": "손 크기를 재고 있어요",
    "체력": "18홀 체력을 가늠하고 있어요",
    "템포": "스윙 템포를 재고 있어요",
    "몸 상태": "무리가 가지 않게 맞춥니다",
    "주 플레이": "어디서 치시는지 보고 있어요",
    "브랜드": "선호하시는 브랜드를 적어뒀어요",
    "드라이버 캐리": "드라이버 비거리를 재고 있어요",
    "드라이버 구질": "공이 어디로 휘는지 보고 있어요",
    "탄도와 낙하": "스핀이 많은지 보고 있어요",
    "페이스 자국 · 위아래": "어디에 맞는지 살펴봐요",
    "페이스 자국 · 좌우": "타점을 살펴보는 중이에요",
    "티 높이": "티 높이를 확인하고 있어요",
    "지금 드라이버": "지금 쓰시는 클럽을 살펴봐요",
    "지금 스펙": "지금 스펙을 적어두고 있어요",
    "길이 · 편차": "길이를 재는 중이에요",
    "공": "쓰시는 공도 함께 봅니다",
    "예산": "예산에 맞는 것만 남깁니다",
    "아이언 · 미스 경향": "아이언을 맞추는 중이에요",
    "아이언 탄도": "탄도를 어떻게 낼지 보고 있어요",
    "아이언 구질": "아이언 구질도 함께 봅니다",
    "아이언 · 소재": "아이언 소재를 고르고 있어요",
    "헤드 모양": "눈에 맞는 모양을 봐요",
    "지금 아이언": "지금 아이언을 살펴봐요",
    "세트 구성": "뺄 클럽이 있는지 봅니다",
    "페이스 자국": "라이각을 보는 중이에요",
    "디봇 방향": "디봇을 읽고 있어요",
    "아이언 · 타감": "타감을 맞추는 중이에요",
    "피칭 로프트": "웨지 간격을 계산하고 있어요",
    "지금 쓰는 모델": "지금 쓰시는 클럽을 살펴봐요",
    "스윙 타입": "바운스를 정하는 중이에요",
    "미스 경향": "솔 모양을 다듬고 있어요",
    "코스 잔디": "잔디 상태를 반영합니다",
    "구성 · 벙커": "웨지 구성을 짜는 중이에요",
    "웨지 샤프트": "웨지 샤프트를 고르고 있어요",
    "스트로크 궤도": "퍼터 궤도를 보고 있어요",
    "퍼팅 고민": "헤드 밸런스를 맞춰요",
    "짧은 퍼트": "짧은 퍼트를 살펴봐요",
    "생김새": "눈에 맞는 모양을 봐요",
    "정렬선": "조준선을 정하는 중이에요",
    "타감과 소리": "타감을 맞추는 중이에요",
    "지금 퍼터 길이": "길이를 재는 중이에요",
    "눈 위치": "셋업을 확인하고 있어요",
    "그린 빠르기": "그린 빠르기를 반영합니다",
    "손 위치": "로프트를 정하는 중이에요",
    "퍼터 그립": "그립을 고르는 중이에요",
    "그립 · 손과 환경": "손에 맞는 그립을 고르는 중이에요",
    "그립 · 쥐는 힘과 타감": "그립 굵기를 맞추는 중이에요",
  };

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

  /* 여러 개를 동시에 고를 수 있는 칩 (몸 상태·손 상태처럼 겹치는 항목) */
  function chipMulti(items, key) {
    const cur = S[key] || [];
    return `<div class="chips" data-key="${key}" data-multi="1" data-auto="0">` +
      items.map((it) => `<button class="chip" data-v="${it.v}" aria-pressed="${cur.includes(it.v)}">${it.t}${it.s ? `<small>${it.s}</small>` : ""}</button>`).join("") +
      `</div>`;
  }
  function textBox(key, ph) {
    return `<input class="cf-text" type="text" data-text="${key}" value="${(S[key] || "").replace(/"/g, "&quot;")}" placeholder="${ph}">`;
  }
  const CLUBS = {
    driver: { ko: "드라이버", ico: "golfer", desc: "로프트 · 샤프트 · 헤드 · 길이" },
    iron:   { ko: "아이언",   ico: "iron",   desc: "헤드 타입 · 샤프트 · 라이각 · 세트 구성" },
    wedge:  { ko: "웨지",     ico: "wedge",  desc: "로프트 갭 · 바운스 · 그라인드" },
    putter: { ko: "퍼터",     ico: "putter", desc: "밸런스 · 길이 · 로프트 · 헤드 무게" },
  };

  /* ───────── [1] 클럽 선택 ───────── */
  const PICK = { key: "pick", group: "선택", render: () => {
    const bag = window.loadMyBag() || {};
    const done = { driver: !!bag.driver, iron: !!bag.iron, wedge: !!bag.wedge, putter: !!bag.putter };
    return `
      <div class="q-eyebrow">클럽 선택</div>
      <div class="q-title">어떤 클럽을<br>맞춰볼까요?</div>
      <div class="q-sub">하나씩 하셔도 됩니다. 맞춘 클럽은 AI 캐디가 그대로 씁니다.</div>
      <div class="q-body"><div class="cf-club-grid">
        ${Object.entries(CLUBS).map(([k, c]) => `
          <button class="cf-club-tile" data-club="${k}">
            <span class="cf-club-ico ico-${c.ico}"></span>
            <b>${c.ko}</b><small>${c.desc}</small>
            ${done[k] ? `<span class="cf-club-done">맞춤 완료</span>` : ""}
          </button>`).join("")}
      </div></div>`;
  } };

  /* ───────── [2] 공통 프로필 ─────────
     한 번만 묻고 저장한다. 두 번째 클럽부터는 확인 한 장으로 끝난다. */
  const CONFIRM = { key: "confirm", group: "확인", render: () => {
    const p = loadFitProfile() || {};
    const row = (l, v) => `<div class="known-card"><div class="k-label">${l}</div><div class="k-val">${v}</div></div>`;
    const careerTxt = { lt3: "3년 미만", y3_10: "3~10년", gt10: "10년 이상" }[p.career] || "-";
    const endurTxt = { strong: "36홀 거뜬", fadeLate: "후반에 무너짐", weak: "18홀도 벅참" }[p.endur] || "-";
    const venueTxt = { field: "필드 위주", screen: "스크린 위주", both: "반반" }[p.venue] || "-";
    return `
      <div class="q-eyebrow">이미 알고 있는 것</div>
      <div class="q-title">지난번에 알려주신<br>내용 그대로 갈까요?</div>
      <div class="q-sub">바뀐 게 있으면 다시 답하실 수 있습니다.</div>
      <div class="q-body">
        ${row("구력 · 평균 타수", `${careerTxt} · ${p.scoreGrp === "100" ? "100타 이상" : (p.scoreGrp || "-") + "대"}`)}
        ${row("7번 아이언 캐리", (p.carry7 || "-") + "m")}
        ${row("키", (p.heightV || "-") + "cm" + (p.wristFloor ? ` · 손목–바닥 ${p.wristFloor}cm` : ""))}
        ${row("체력 · 주 플레이", `${endurTxt} · ${venueTxt}`)}
      </div>
      <div class="btn-row">
        <button class="cf-btn accent" data-useprofile>이대로 진행</button>
        <button class="cf-btn ghost" data-redoprofile>다시 답할래요</button>
      </div>`;
  } };

  const COMMON = [
    { key: "auto", group: "공통", render: () => `
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
      <div class="btn-row"><button class="cf-btn" data-next>${CLUBS[S.club].ko} 피팅 시작</button></div>` },

    { key: "career", group: "공통", q: 1, render: () => `
      <div class="q-eyebrow">구력</div>
      <div class="q-title">골프, 얼마나 치셨어요?</div>
      <div class="q-body">${chipList([
        { v: "lt3", t: "3년 미만" }, { v: "y3_10", t: "3~10년" }, { v: "gt10", t: "10년 이상" }], "career")}</div>` },

    { key: "score", group: "공통", q: 2, render: () => S.auto.avg !== null ? `
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
        { v: "80", t: "80대 이하" }, { v: "90", t: "90대" }, { v: "100", t: "100타 이상" }], "scoreGrp")}</div>` },

    { key: "carry7", group: "공통", q: 3, render: () => `
      <div class="q-eyebrow">7번 아이언</div>
      <div class="q-title">7번 아이언 캐리는?</div>
      <div class="q-sub">런 빼고, 떨어지는 지점까지. <b>헤드스피드를 가장 정확히 알려주는 숫자</b>라 모든 클럽 계산의 출발점입니다.</div>
      <div class="q-body">${slider("carry7", 100, 190, 5, "m")}
        <div class="inline-note">잘 모르시겠으면 <b>평균 타수 기준 대략값</b>으로 두셔도 됩니다 —
        80대 약 155m · 90대 약 140m · 100타 이상 약 125m.</div>
      </div>${nextBtn()}` },

    { key: "body", group: "공통", q: 4, render: () => `
      <div class="q-eyebrow">키 · 팔 길이</div>
      <div class="q-title">길이와 라이각을<br>맞춰볼게요</div>
      <div class="q-body">
        <div class="q-eyebrow" style="margin-bottom:8px">키</div>
        ${slider("heightV", 145, 200, 1, "cm")}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">손목 – 바닥 거리 <span style="opacity:.6">(선택)</span></div>
          <div class="q-sub" style="margin-bottom:10px">똑바로 서서 팔을 늘어뜨렸을 때 <b>손목 주름에서 바닥까지</b>.
          길이·라이각의 진짜 기준은 키가 아니라 이 값입니다 — 키가 같아도 팔 길이는 다르거든요.</div>
          ${slider("wristFloorV", 70, 100, 1, "cm")}
          ${chipList([{ v: "skip", t: "재보지 않았어요 — 키로만 계산" }], "wristSkip", { auto: false })}
        </div>
      </div>${nextBtn()}` },

    { key: "glove", group: "공통", q: 5, render: () => `
      <div class="q-eyebrow">그립 사이즈</div>
      <div class="q-title">장갑 호수가<br>어떻게 되세요?</div>
      <div class="q-sub">그립 굵기를 정하는 기준입니다. 굵기가 안 맞으면 손이 과하게 쓰이거나 릴리즈가 막힙니다.</div>
      <div class="q-body">
        ${chipList(["18", "19", "20", "21", "22", "23", "24", "25", "26"].map((n) => ({ v: n, t: n + "호" }))
          .concat([{ v: "unknown", t: "모름" }]), "gloveSize", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">손 길이 <span style="opacity:.6">(선택 — 이게 더 정확합니다)</span></div>
          <div class="q-sub" style="margin-bottom:10px"><b>가운뎃손가락 끝에서 손목 주름까지</b> 재보세요.
          장갑 호수는 브랜드마다 기준이 달라서, 손 길이가 있으면 그쪽을 씁니다.</div>
          ${slider("handLenV", 15, 26, 0.5, "cm")}
          ${chipList([{ v: "skip", t: "재보지 않았어요 — 호수로만 계산" }], "handSkip", { auto: false })}
        </div>
      </div>${nextBtn(!S.gloveSize)}` },

    { key: "endur", group: "공통", q: 6, render: () => `
      <div class="q-eyebrow">체력</div>
      <div class="q-title">하루 36홀, 가능하세요?</div>
      <div class="q-sub">${S.auto.fade !== null && S.auto.fade >= 3
        ? `스코어 기록의 후반 +${S.auto.fade}타 패턴과 함께 봅니다.`
        : "시타실 10구가 아니라 18홀 전체 기준으로 맞춥니다."}</div>
      <div class="q-body">${chipList([
        { v: "strong", t: "거뜬해요" },
        { v: "fadeLate", t: "후반엔 무너져요", s: "13번 홀 넘어가면 스윙이 처짐" },
        { v: "weak", t: "18홀도 벅차요" }], "endur")}</div>` },

    { key: "tempo", group: "공통", q: 7, render: () => `
      <div class="q-eyebrow">템포</div>
      <div class="q-title">스윙 템포는?</div>
      <div class="q-sub">같은 스피드라도 전환이 급하면 샤프트가 더 버텨줘야 합니다.</div>
      <div class="q-body">${chipList([
        { v: "smooth", t: "부드러움", s: "천천히 올려서 툭" },
        { v: "normal", t: "보통" },
        { v: "fast", t: "빠름", s: "전환이 급하고 때리는 편" }], "tempo")}</div>` },

    { key: "bodyIssue", group: "공통", q: 8, render: () => `
      <div class="q-eyebrow">몸 상태</div>
      <div class="q-title">불편한 곳이 있으세요?</div>
      <div class="q-sub">해당되는 것을 모두 골라주세요. 무게와 소재 추천이 달라집니다.</div>
      <div class="q-body">${chipMulti([
        { v: "wrist", t: "손목 · 팔꿈치가 아파요" },
        { v: "back", t: "허리가 아파요" },
        { v: "finger", t: "손가락 관절이 아파요" },
        { v: "grip", t: "손 힘이 약해요" },
        { v: "none", t: "해당 없음" }], "bodyIssue")}</div>${nextBtn()}` },

    { key: "venue", group: "공통", q: 9, render: () => `
      <div class="q-eyebrow">주 플레이</div>
      <div class="q-title">주로 어디서 치세요?</div>
      <div class="q-sub">스크린은 매트 위에서 치고 런이 계산으로 나옵니다 — 필드와 맞는 클럽이 달라요.</div>
      <div class="q-body">${chipList([
        { v: "field", t: "필드 위주" },
        { v: "screen", t: "스크린 위주", s: "매트·실내" },
        { v: "both", t: "반반이에요" }], "venue")}</div>` },
  ];

  /* ───────── [3] 선호 브랜드 ─────────
     ⚠️ 브랜드 문항을 선택 단계에 두었더니 대부분 질문 자체를 못 받고 지나가
        "선호 브랜드 우선 추천"이 작동하지 않았다(2026-07-27). 항상 받는 자리에 둔다. */
  const HEAD_BRANDS = {
    driver: [{ v: "타이틀리스트", t: "타이틀리스트" }, { v: "테일러메이드", t: "테일러메이드" },
      { v: "캘러웨이", t: "캘러웨이" }, { v: "핑", t: "핑" },
      { v: "던롭", t: "젝시오·혼마 계열" }, { v: "any", t: "상관없어요" }],
    iron: [{ v: "타이틀리스트", t: "타이틀리스트" }, { v: "핑", t: "핑" },
      { v: "테일러메이드", t: "테일러메이드" }, { v: "캘러웨이", t: "캘러웨이" },
      { v: "미즈노", t: "미즈노" }, { v: "던롭", t: "젝시오 계열" }, { v: "any", t: "상관없어요" }],
    wedge: [{ v: "타이틀리스트", t: "타이틀리스트 (보키)" }, { v: "클리브랜드", t: "클리브랜드" },
      { v: "핑", t: "핑" }, { v: "테일러메이드", t: "테일러메이드" },
      { v: "캘러웨이", t: "캘러웨이" }, { v: "미즈노", t: "미즈노" }, { v: "any", t: "상관없어요" }],
    putter: [{ v: "스카티카메론", t: "스카티카메론" }, { v: "오디세이", t: "오디세이" },
      { v: "테일러메이드", t: "테일러메이드 (스파이더)" }, { v: "핑", t: "핑" }, { v: "any", t: "상관없어요" }],
  };
  const SHAFT_BRANDS = {
    driver: [{ v: "후지쿠라", t: "후지쿠라" }, { v: "그라파이트디자인", t: "그라파이트디자인" },
      { v: "미쓰비시", t: "미쓰비시" }, { v: "프로젝트X", t: "프로젝트X" },
      { v: "UST마미야", t: "UST마미야" }, { v: "any", t: "상관없어요" }],
    iron: [{ v: "니폰", t: "니폰 (N.S.PRO)" }, { v: "트루템퍼", t: "트루템퍼 (다이나믹골드)" },
      { v: "KBS", t: "KBS" }, { v: "UST마미야", t: "UST마미야" },
      { v: "후지쿠라", t: "후지쿠라" }, { v: "any", t: "상관없어요" }],
  };
  const BRANDQ = { key: "brandq", group: "브랜드", q: 1, render: () => {
    const c = S.club, heads = HEAD_BRANDS[c], shafts = SHAFT_BRANDS[c];
    const hKey = c === "iron" ? "ironBrand" : c === "wedge" ? "wedgeBrand" : c === "putter" ? "putterBrand" : "brand";
    const sKey = c === "iron" ? "ironShaftBrand" : "shaftBrand";
    return `
      <div class="q-eyebrow">브랜드</div>
      <div class="q-title">선호하는 브랜드가<br>있으신가요?</div>
      <div class="q-sub">있으면 <b>그 브랜드 안에서</b> 가장 잘 맞는 것을 1순위로 골라드립니다.
      다른 브랜드에 더 맞는 게 있으면 대안으로 함께 보여드려요.</div>
      <div class="q-body">
        <div class="q-eyebrow" style="margin-bottom:8px">${CLUBS[c].ko}(헤드) 브랜드</div>
        ${chipList(heads, hKey, { row: true, auto: false })}
        ${shafts ? `<div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">샤프트 브랜드</div>
          <div class="q-sub" style="margin-bottom:12px">${c === "iron"
            ? "아이언 샤프트는 드라이버와 만드는 회사가 다릅니다."
            : "클럽 브랜드와는 별개입니다."}</div>
          ${chipList(shafts, sKey, { row: true, auto: false })}
        </div>` : ""}
      </div>${nextBtn(!(S[hKey] && (!shafts || S[sKey])))}`;
  } };

  /* ───────── [5] 그립 (드라이버·아이언·웨지 공통) ───────── */
  const GRIPQ = [
    { key: "gripCond", group: "그립", q: 1, render: () => `
      <div class="q-eyebrow">그립 · 손과 환경</div>
      <div class="q-title">손이나 라운드 환경,<br>해당되는 게 있나요?</div>
      <div class="q-sub">모두 골라주세요. 재질과 경도가 여기서 갈립니다.</div>
      <div class="q-body">${chipMulti([
        { v: "sweat", t: "손에 땀이 많아요" },
        { v: "wet", t: "여름·비 오는 날에도 라운드해요" },
        { v: "joint", t: "손가락·손목 관절이 아파요" },
        { v: "nogl", t: "장갑을 안 껴요" },
        { v: "none", t: "해당 없음" }], "gripCond")}</div>${nextBtn()}` },

    { key: "gripFeel", group: "그립", q: 2, render: () => `
      <div class="q-eyebrow">그립 · 쥐는 힘과 타감</div>
      <div class="q-title">그립을 어떻게<br>쥐는 편이세요?</div>
      <div class="q-body">
        ${chipList([
          { v: "tight", t: "꽉 쥐는 편" }, { v: "mid", t: "보통" },
          { v: "soft", t: "부드럽게" }], "gripPress", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">손에 닿는 느낌은</div>
          ${chipList([
            { v: "soft", t: "부드러운 고무" }, { v: "firm", t: "단단하고 또렷한" },
            { v: "any", t: "상관없어요" }], "gripFeel", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.gripPress && S.gripFeel))}` },
  ];

  /* ───────── [4-D] 드라이버 ─────────
     기존 로직은 개인 경험 기반이라 편차가 컸다(사장님 지적 2026-07-27).
     실제 피팅이 보는 순서 — 스피드 → 어택앵글/스핀 → 궤도·페이스 → 정타 → 길이 — 로 다시 세웠다. */
  const QD = [
    { key: "d1", group: "드라이버", q: 1, render: () => `
      <div class="q-eyebrow">드라이버 캐리</div>
      <div class="q-title">드라이버 캐리는?</div>
      <div class="q-sub">잘 맞은 공 말고, 평소 10번 중 6~7번 나오는 거리로.</div>
      <div class="q-body">${slider("carryD", 150, 280, 5, "m")}<div id="cf-rationote"></div></div>${nextBtn()}` },

    { key: "d2", group: "드라이버", q: 2, render: () => `
      <div class="q-eyebrow">드라이버 구질</div>
      <div class="q-title">공이 어디로 출발해서<br>어디로 휘나요?</div>
      <div class="q-sub"><b>출발 방향은 스윙 궤도</b>, <b>휘는 방향은 페이스</b>가 만듭니다.
      둘을 나눠 봐야 같은 '슬라이스'라도 처방이 달라집니다.</div>
      <div class="q-body">
        <div class="q-eyebrow" style="margin-bottom:8px">① 처음 출발하는 방향</div>
        ${chipList([
          { v: "left", t: "왼쪽으로" }, { v: "straight", t: "곧게" },
          { v: "right", t: "오른쪽으로" }], "startDir", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">② 날아가면서 휘는 방향</div>
          ${chipList([
            { v: "left", t: "왼쪽으로 휘어요" }, { v: "none", t: "거의 안 휘어요" },
            { v: "right", t: "오른쪽으로 휘어요" }], "curveDir", { row: true, auto: false })}
        </div>
        <div id="cf-flightnote"></div>
      </div>${nextBtn(!(S.startDir && S.curveDir))}` },

    { key: "d3", group: "드라이버", q: 3, render: () => `
      <div class="q-eyebrow">탄도와 낙하</div>
      <div class="q-title">공이 어떻게<br>떨어지나요?</div>
      <div class="q-sub">스핀이 많은지 적은지를 여기서 봅니다. 로프트를 정하는 핵심 정보예요.</div>
      <div class="q-body">${chipList([
        { v: "low", t: "낮게 나가서 뚝 떨어져요", s: "런치가 부족한 신호" },
        { v: "good", t: "쭉 뻗다가 부드럽게 떨어져요", s: "이상적" },
        { v: "balloon", t: "붕 떠서 힘없이 떨어져요", s: "스핀 과다 신호" },
        { v: "high", t: "너무 높이 뜨는데 거리가 안 나요" },
        { v: "unknown", t: "잘 모르겠어요" }], "flight")}</div>` },

    { key: "d4", group: "드라이버", q: 4, render: () => `
      <div class="q-eyebrow">페이스 자국 · 위아래</div>
      <div class="q-title">페이스 어디쯤에<br>자국이 남나요?</div>
      <div class="q-sub">헤드에 흰 가루나 파운데이션을 얇게 바르고 한 번 치면 바로 보입니다.
      <b>위쪽에 맞을수록 스핀이 줄고 멀리 갑니다</b>(기어 효과).</div>
      <div class="q-body">${chipList([
        { v: "high", t: "위쪽", s: "잘 맞고 계신 겁니다" },
        { v: "mid", t: "가운데" },
        { v: "low", t: "아래쪽", s: "스핀이 늘고 거리가 줄어요" },
        { v: "unknown", t: "확인 안 해봤어요" }], "faceV")}</div>` },

    { key: "d5", group: "드라이버", q: 5, render: () => `
      <div class="q-eyebrow">티 높이</div>
      <div class="q-title">티를 얼마나<br>높게 꽂으세요?</div>
      <div class="q-sub">티 높이는 <b>돈이 안 드는 유일한 피팅</b>입니다. 이것만 고쳐도 거리가 늘어나는 분이 많아요.</div>
      <div class="q-body">${chipList([
        { v: "high", t: "공 절반 이상이 크라운 위로" },
        { v: "mid", t: "공 윗부분이 크라운과 비슷" },
        { v: "low", t: "낮게 꽂아요" },
        { v: "vary", t: "그때그때 달라요" }], "teeHt")}</div>` },

    { key: "d6", group: "드라이버", q: 6, render: () => `
      <div class="q-eyebrow">페이스 자국 · 좌우</div>
      <div class="q-title">좌우로는<br>어디에 맞나요?</div>
      <div class="q-body">${chipList([
        { v: "toe", t: "토우(끝) 쪽" },
        { v: "center", t: "가운데" },
        { v: "heel", t: "힐(안쪽) 쪽" },
        { v: "vary", t: "들쭉날쭉해요", s: "길이를 줄이면 좋아집니다" },
        { v: "unknown", t: "확인 안 해봤어요" }], "faceH")}</div>` },

    { key: "d7", group: "드라이버", q: 7, render: () => `
      <div class="q-eyebrow">지금 드라이버</div>
      <div class="q-title">지금 드라이버,<br>뭐가 제일 아쉬워요?</div>
      <div class="q-body">${chipList([
        { v: "dist", t: "거리" }, { v: "dir", t: "방향" },
        { v: "traj", t: "탄도 (안 떠요)" }, { v: "feel", t: "타감" },
        { v: "consist", t: "일관성", s: "잘 맞을 때와 아닐 때 차이가 큼" },
        { v: "none", t: "딱히 없어요, 그냥 궁금" }], "complaint")}</div>` },

    { key: "d8", group: "드라이버", q: 8, render: () => `
      <div class="q-eyebrow">지금 스펙</div>
      <div class="q-title">지금 쓰시는<br>드라이버 스펙은?</div>
      <div class="q-sub">"그대로 쓰세요" 판정을 하려면 지금 것을 알아야 합니다.</div>
      <div class="q-body">
        <div class="q-eyebrow" style="margin-bottom:8px">로프트</div>
        ${chipList([
          { v: "8.5", t: "8.5°" }, { v: "9", t: "9°" }, { v: "9.5", t: "9.5°" },
          { v: "10.5", t: "10.5°" }, { v: "12", t: "12° 이상" }, { v: "unknown", t: "모름" }],
          "curLoft", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">샤프트</div>
          ${chipList(Object.entries(CUR_SHAFT).map(([v, o]) => ({ v, t: o.label })), "curShaft", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.curLoft && S.curShaft))}` },

    { key: "d9", group: "드라이버", q: 9, render: () => `
      <div class="q-eyebrow">길이 · 편차</div>
      <div class="q-title">클럽 길이는<br>어떠세요?</div>
      <div class="q-sub">요즘 표준 45.75″는 <b>대부분의 아마추어에게 깁니다.</b>
      짧게 잡고 계시다면 그건 클럽이 길다는 몸의 신호예요.</div>
      <div class="q-body">
        <div class="q-eyebrow" style="margin-bottom:8px">그립 끝을 남기고 짧게 잡으시나요?</div>
        ${chipList([
          { v: "yes", t: "네, 짧게 잡아요" }, { v: "no", t: "아니요, 끝까지 잡아요" }],
          "gripDown", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">잘 맞을 때와 평소 거리 차이는</div>
          ${chipList([
            { v: "small", t: "10m 안팎" }, { v: "mid", t: "20m쯤" },
            { v: "big", t: "30m 이상", s: "정타가 병목입니다" }], "carryVar", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.gripDown && S.carryVar))}` },

    { key: "d10", group: "드라이버", q: 10, render: () => `
      <div class="q-eyebrow">공</div>
      <div class="q-title">어떤 공을 쓰세요?</div>
      <div class="q-sub">스핀 고민이라면 <b>클럽보다 공이 먼저</b>일 수 있습니다. 훨씬 싸게 해결되거든요.</div>
      <div class="q-body">${chipList([
        { v: "urethane", t: "우레탄 프리미엄", s: "프로V1 · 크롬소프트 계열" },
        { v: "distance", t: "거리용 2피스", s: "서라인 · 슈퍼뉴트론 계열" },
        { v: "any", t: "아무거나 / 로스트볼" }], "ball")}</div>` },

    { key: "d11", group: "드라이버", q: 11, render: () => `
      <div class="q-eyebrow">예산</div>
      <div class="q-title">샤프트 예산은?</div>
      <div class="q-body">${chipList([
        { v: "stock", t: "순정이면 충분", s: "추가 지출 없이" },
        { v: "mid", t: "애프터마켓까지", s: "30~40만 원대" },
        { v: "any", t: "상관없어요" }], "budget")}</div>` },
  ];

  /* ───────── [4-I] 아이언 ───────── */
  const QI = [
    { key: "i1", group: "아이언", q: 1, render: () => `
      <div class="q-eyebrow">아이언 · 미스 경향</div>
      <div class="q-title">아이언이 빗맞을 때<br>주로 어떻게 되나요?</div>
      <div class="q-body">${chipList([
        { v: "thin", t: "얇게 맞아요", s: "공이 안 뜨고 낮게 날아감" },
        { v: "fat", t: "뒤땅을 쳐요", s: "잔디를 먼저 파고듦" },
        { v: "dir", t: "방향이 흔들려요", s: "좌우로 갈림" },
        { v: "none", t: "특별한 경향은 없어요" }], "ironMiss")}</div>` },

    { key: "i2", group: "아이언", q: 2, render: () => `
      <div class="q-eyebrow">아이언 탄도</div>
      <div class="q-title">아이언 탄도는<br>어떠세요?</div>
      <div class="q-sub">드라이버와 따로 봅니다 — 킥포인트가 다르게 나옵니다.</div>
      <div class="q-body">${chipList([
        { v: "low", t: "낮아요", s: "그린에 안 서고 굴러 나감" },
        { v: "mid", t: "적당해요" },
        { v: "high", t: "너무 떠요", s: "거리 손해" },
        { v: "unknown", t: "잘 모르겠어요" }], "ironTraj")}</div>` },

    { key: "i3", group: "아이언", q: 3, render: () => `
      <div class="q-eyebrow">아이언 구질</div>
      <div class="q-title">아이언은 주로<br>어느 쪽으로 휘나요?</div>
      <div class="q-body">${chipList([
        { v: "slice", t: "오른쪽 (슬라이스)" },
        { v: "straight", t: "거의 곧게" },
        { v: "hook", t: "왼쪽 (훅)" }], "shapeI")}</div>` },

    { key: "i4", group: "아이언", q: 4, render: () => `
      <div class="q-eyebrow">아이언 · 소재</div>
      <div class="q-title">샤프트 소재,<br>정해두신 게 있나요?</div>
      <div class="q-sub">모르시면 골라드립니다 — 체력·스피드·몸 상태로 판단해요.</div>
      <div class="q-body">${chipList([
        { v: "unsure", t: "골라주세요", s: "체력·스피드 기준으로 판단" },
        { v: "스틸", t: "스틸", s: "방향·거리가 일정한 대신 무거움" },
        { v: "그라파이트", t: "그라파이트", s: "가벼워 후반까지 편함" }], "ironMat")}</div>` },

    { key: "i5", group: "아이언", q: 5, render: () => `
      <div class="q-eyebrow">헤드 모양</div>
      <div class="q-title">어드레스에서 어떤 모양이<br>눈에 편하세요?</div>
      <div class="q-sub">헤드 타입을 정하는 실제 기준입니다. 평균 타수만으로 정하면 취향이 무시돼요.</div>
      <div class="q-body">${chipList([
        { v: "classic", t: "얇고 깔끔한 것", s: "톱라인 얇고 오프셋 적음" },
        { v: "mid", t: "보통" },
        { v: "forgiving", t: "두툼하고 든든한 것", s: "빗맞아도 손해가 적음" },
        { v: "unsure", t: "잘 모르겠어요", s: "실력에 맞게 골라주세요" }], "ironLook")}</div>` },

    { key: "i6", group: "아이언", q: 6, render: () => `
      <div class="q-eyebrow">지금 아이언</div>
      <div class="q-title">지금 아이언,<br>뭐가 제일 아쉬워요?</div>
      <div class="q-sub">"그대로 쓰세요" 판정의 근거입니다.</div>
      <div class="q-body">${chipList([
        { v: "dist", t: "거리" }, { v: "dir", t: "방향" },
        { v: "traj", t: "탄도" }, { v: "feel", t: "타감" },
        { v: "forg", t: "빗맞을 때 손해가 큼" },
        { v: "none", t: "딱히 없어요, 그냥 궁금" }], "ironComplaint")}</div>` },

    { key: "i7", group: "아이언", q: 7, render: () => `
      <div class="q-eyebrow">세트 구성</div>
      <div class="q-title">세트에서 가장 긴 아이언은<br>몇 번인가요?</div>
      <div class="q-sub">긴 아이언을 억지로 들고 다니는 분이 많습니다. 뺄 게 있으면 빼는 것도 피팅입니다.</div>
      <div class="q-body">
        ${chipList([
          { v: "3", t: "3번부터" }, { v: "4", t: "4번부터" },
          { v: "5", t: "5번부터" }, { v: "6", t: "6번부터" },
          { v: "unknown", t: "모름" }], "ironLongest", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">그 클럽, 잘 맞으세요?</div>
          ${chipList([
            { v: "ok", t: "잘 맞아요" },
            { v: "no", t: "자신 없어요", s: "잘 안 뜨거나 안 맞음" }], "ironLongOk", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.ironLongest && S.ironLongOk))}` },

    { key: "i8", group: "아이언", q: 8, render: () => `
      <div class="q-eyebrow">페이스 자국</div>
      <div class="q-title">페이스 어디에<br>자국이 남나요?</div>
      <div class="q-sub">라이각을 보는 가장 확실한 신호입니다. 헤드에 흰 가루를 얇게 바르고 한 번 쳐보세요.</div>
      <div class="q-body">${chipList([
        { v: "toe", t: "토우(끝) 쪽" },
        { v: "center", t: "가운데" },
        { v: "heel", t: "힐(안쪽) 쪽" },
        { v: "unknown", t: "확인 안 해봤어요" }], "ironBallMark")}</div>` },

    { key: "i9", group: "아이언", q: 9, render: () => `
      <div class="q-eyebrow">디봇 방향</div>
      <div class="q-title">디봇이 어느 쪽을<br>향하나요?</div>
      <div class="q-sub">타깃 라인과 비교해서 봐주세요. 궤도와 라이각을 함께 읽습니다.</div>
      <div class="q-body">${chipList([
        { v: "left", t: "타깃보다 왼쪽" },
        { v: "straight", t: "곧게" },
        { v: "right", t: "타깃보다 오른쪽" },
        { v: "none", t: "디봇이 잘 안 생겨요" }], "ironDivot")}</div>` },

    { key: "i10", group: "아이언", q: 10, render: () => `
      <div class="q-eyebrow">아이언 · 타감</div>
      <div class="q-title">어떤 타감을<br>좋아하세요?</div>
      <div class="q-body">${chipList([
        { v: "soft", t: "부드러운 쪽", s: "손에 닿는 느낌이 포근한" },
        { v: "solid", t: "단단한 쪽", s: "묵직하고 또렷한 타격감" },
        { v: "light", t: "가벼운 쪽", s: "휘두르기 편한" },
        { v: "any", t: "상관없어요" }], "ironFeel")}</div>` },

    { key: "i11", group: "아이언", q: 11, render: () => `
      <div class="q-eyebrow">피칭 로프트</div>
      <div class="q-title">피칭웨지 로프트가<br>몇 도인가요?</div>
      <div class="q-sub">클럽 헤드에 적혀 있어요. 모르시면 45°로 계산합니다 — 요즘 아이언의 표준값입니다.
      아이언 로프트 세대(스트롱/전통) 판별과 웨지 간격 계산에 함께 씁니다.</div>
      <div class="q-body">${slider("pwLoft", 41, 48, 1, "°")}</div>${nextBtn()}` },

    { key: "i12", group: "아이언", q: 12, render: () => `
      <div class="q-eyebrow">지금 쓰는 모델</div>
      <div class="q-title">지금 아이언 모델을<br>아시나요?</div>
      <div class="q-sub">선택 사항입니다. 적어주시면 "바꿀 필요 없습니다" 판정이 훨씬 정확해집니다.</div>
      <div class="q-body">
        ${textBox("ironCurModel", "예) 타이틀리스트 T200 / 젝시오 12")}
        <div class="inline-note">모르시면 비워두셔도 됩니다. 모르는 걸 추측해서 판정하지는 않습니다.</div>
      </div>${nextBtn()}` },

    { key: "i13", group: "아이언", q: 13, render: () => `
      <div class="q-eyebrow">예산</div>
      <div class="q-title">샤프트 예산은?</div>
      <div class="q-body">${chipList([
        { v: "stock", t: "순정이면 충분" },
        { v: "mid", t: "애프터마켓까지" },
        { v: "any", t: "상관없어요" }], "ironBudget")}</div>` },
  ];

  /* ───────── [4-W] 웨지 ───────── */
  const QW = [
    { key: "w1", group: "웨지", q: 1, render: () => `
      <div class="q-eyebrow">피칭 로프트</div>
      <div class="q-title">피칭웨지 로프트가<br>몇 도인가요?</div>
      <div class="q-sub">클럽 헤드에 적혀 있어요. 모르시면 45°로 계산합니다.
      <b>한 클럽당 4~6°</b>가 거리 공백이 안 생기는 간격입니다.</div>
      <div class="q-body">${slider("pwLoft", 41, 48, 1, "°")}</div>${nextBtn()}` },

    { key: "w2", group: "웨지", q: 2, render: () => `
      <div class="q-eyebrow">스윙 타입</div>
      <div class="q-title">어프로치할 때<br>잔디를 어떻게 치나요?</div>
      <div class="q-sub">바운스(솔의 각도)를 정하는 가장 중요한 정보입니다.</div>
      <div class="q-body">${chipList([
        { v: "dig", t: "깊게 파고들어요", s: "디봇이 크게 파임 — 디거" },
        { v: "sweep", t: "얕게 쓸어 쳐요", s: "디봇이 거의 안 생김 — 스위퍼" },
        { v: "mid", t: "중간이에요" }], "wedgeTurf")}</div>` },

    { key: "w3", group: "웨지", q: 3, render: () => `
      <div class="q-eyebrow">미스 경향</div>
      <div class="q-title">짧은 어프로치에서<br>실수는 어느 쪽인가요?</div>
      <div class="q-body">${chipList([
        { v: "fat", t: "뒤땅이 나요", s: "공 앞 잔디를 먼저 침" },
        { v: "thin", t: "토핑이 나요", s: "공 윗부분을 때림" },
        { v: "none", t: "괜찮은 편이에요" }], "wedgeMiss")}</div>` },

    { key: "w4", group: "웨지", q: 4, render: () => `
      <div class="q-eyebrow">코스 잔디</div>
      <div class="q-title">주로 라운드하는 코스<br>잔디는 어떤가요?</div>
      <div class="q-sub">같은 스윙이라도 잔디가 무르면 바운스가 더 필요합니다.</div>
      <div class="q-body">${chipList([
        { v: "soft", t: "두툼하고 폭신해요", s: "공이 잔디 위에 떠 있음" },
        { v: "mid", t: "보통이에요" },
        { v: "tight", t: "타이트하고 딱딱해요", s: "맨땅에 가까움" },
        { v: "unknown", t: "잘 모르겠어요" }], "wedgeGrass")}</div>` },

    { key: "w5", group: "웨지", q: 5, render: () => `
      <div class="q-eyebrow">구성 · 벙커</div>
      <div class="q-title">웨지를 몇 개<br>쓰시나요?</div>
      <div class="q-body">
        ${chipList([
          { v: "2", t: "2개" }, { v: "3", t: "3개" }, { v: "4", t: "4개" },
          { v: "unknown", t: "모름" }], "wedgeCount", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">벙커샷은 어떠세요?</div>
          ${chipList([
            { v: "ok", t: "괜찮아요" },
            { v: "no", t: "자신 없어요", s: "바운스를 더 씁니다" }], "wedgeBunker", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.wedgeCount && S.wedgeBunker))}` },

    { key: "w6", group: "웨지", q: 6, render: () => `
      <div class="q-eyebrow">웨지 샤프트</div>
      <div class="q-title">웨지 샤프트는<br>어떻게 할까요?</div>
      <div class="q-sub">웨지는 풀스윙보다 컨트롤이 많아 아이언보다 조금 무겁게 가는 것이 정석입니다.</div>
      <div class="q-body">${chipList([
        { v: "same", t: "아이언과 같은 것으로" },
        { v: "heavy", t: "웨지 전용 무거운 것으로" },
        { v: "unsure", t: "골라주세요" }], "wedgeShaft")}</div>` },
  ];

  /* ───────── [4-U] 퍼터 ───────── */
  const QU = [
    { key: "u1", group: "퍼터", q: 1, render: () => `
      <div class="q-eyebrow">스트로크 궤도</div>
      <div class="q-title">퍼팅할 때 헤드가<br>어떻게 움직이나요?</div>
      <div class="q-sub">헤드 밸런스를 정하는 기준입니다. 잘 모르시겠으면 —
      짧은 퍼트에서 <b>페이스가 열렸다 닫히는 느낌</b>이 있으면 아크,
      계속 목표를 향해 있으면 직선에 가깝습니다.</div>
      <div class="q-body">${chipList([
        { v: "straight", t: "곧게 왔다갔다", s: "직선에 가까운 궤도" },
        { v: "slight", t: "살짝 안쪽으로", s: "약간의 아크" },
        { v: "arc", t: "많이 둥글게", s: "아크가 큰 궤도" },
        { v: "unknown", t: "잘 모르겠어요", s: "약간의 아크로 가정합니다" }], "puttStroke")}</div>` },

    { key: "u2", group: "퍼터", q: 2, render: () => `
      <div class="q-eyebrow">퍼팅 고민</div>
      <div class="q-title">퍼팅에서<br>더 아쉬운 쪽은?</div>
      <div class="q-body">${chipList([
        { v: "dist", t: "거리감", s: "짧거나 길게 지나감" },
        { v: "dir", t: "방향", s: "홀 옆으로 빗나감" },
        { v: "both", t: "둘 다요" },
        { v: "none", t: "딱히 없어요" }], "puttMiss")}</div>` },

    { key: "u3", group: "퍼터", q: 3, render: () => `
      <div class="q-eyebrow">짧은 퍼트</div>
      <div class="q-title">짧은 퍼트는 어느 쪽으로<br>빗나가나요?</div>
      <div class="q-sub">1~2m 퍼트 기준입니다. 라이각·정렬·길이를 함께 읽습니다.</div>
      <div class="q-body">${chipList([
        { v: "left", t: "왼쪽으로 (당겨요)" },
        { v: "right", t: "오른쪽으로 (밀어요)" },
        { v: "vary", t: "일정하지 않아요" },
        { v: "none", t: "잘 안 놓쳐요" }], "puttShort")}</div>` },

    { key: "u4", group: "퍼터", q: 4, render: () => `
      <div class="q-eyebrow">생김새</div>
      <div class="q-title">어떤 모양이<br>눈에 편하세요?</div>
      <div class="q-sub">퍼터는 감각의 비중이 큽니다. 눈에 편한 게 실제로 잘 들어가요.</div>
      <div class="q-body">${chipList([
        { v: "blade", t: "블레이드", s: "얇고 클래식한 모양" },
        { v: "mallet", t: "말렛", s: "크고 묵직한 모양" },
        { v: "any", t: "상관없어요" }], "puttLook")}</div>` },

    { key: "u5", group: "퍼터", q: 5, render: () => `
      <div class="q-eyebrow">정렬선</div>
      <div class="q-title">조준선은<br>있는 게 편하세요?</div>
      <div class="q-sub">같은 말렛이라도 정렬선 유무로 전혀 다른 클럽이 됩니다.</div>
      <div class="q-body">${chipList([
        { v: "line", t: "긴 조준선이 있어야 편해요" },
        { v: "none", t: "선이 없는 게 편해요", s: "선이 있으면 오히려 신경 쓰임" },
        { v: "any", t: "상관없어요" }], "puttLine")}</div>` },

    { key: "u6", group: "퍼터", q: 6, render: () => `
      <div class="q-eyebrow">타감과 소리</div>
      <div class="q-title">어떤 타감을<br>좋아하세요?</div>
      <div class="q-body">${chipList([
        { v: "soft", t: "부드럽게 툭", s: "인서트 페이스" },
        { v: "firm", t: "단단하고 또렷하게", s: "밀드 페이스" },
        { v: "any", t: "상관없어요" }], "puttFeel")}</div>` },

    { key: "u7", group: "퍼터", q: 7, render: () => `
      <div class="q-eyebrow">지금 퍼터 길이</div>
      <div class="q-title">지금 퍼터는<br>몇 인치인가요?</div>
      <div class="q-sub">샤프트나 그립 아래에 적혀 있기도 합니다.
      <b>아마추어 다수가 너무 긴 퍼터를 씁니다</b> — 1인치 줄이는 게 가장 싸고 확실한 개선이에요.</div>
      <div class="q-body">
        ${chipList([
          { v: "32", t: "32″" }, { v: "33", t: "33″" }, { v: "34", t: "34″" },
          { v: "35", t: "35″" }, { v: "unknown", t: "모름" }], "puttCurLen", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">길게 느껴지시나요?</div>
          ${chipList([
            { v: "yes", t: "네, 길게 느껴져요", s: "손을 몸에서 띄우게 됨" },
            { v: "no", t: "아니요, 편해요" }], "puttLong", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.puttCurLen && S.puttLong))}` },

    { key: "u8", group: "퍼터", q: 8, render: () => `
      <div class="q-eyebrow">눈 위치</div>
      <div class="q-title">공을 눈 아래로<br>떨어뜨려 보세요</div>
      <div class="q-sub">평소처럼 어드레스한 뒤, 눈 앞에서 공을 그냥 놓으면 어디에 떨어지나요?
      길이와 라이각을 보는 가장 쉬운 자가진단입니다.</div>
      <div class="q-body">${chipList([
        { v: "on", t: "공 바로 위에 떨어져요", s: "가장 이상적" },
        { v: "inside", t: "공보다 안쪽(발 쪽)", s: "퍼터가 길거나 너무 서 있음" },
        { v: "outside", t: "공보다 바깥쪽", s: "너무 멀리 서 있음" },
        { v: "unknown", t: "안 해봤어요" }], "puttEye")}</div>` },

    { key: "u9", group: "퍼터", q: 9, render: () => `
      <div class="q-eyebrow">그린 빠르기</div>
      <div class="q-title">주로 치는 그린은<br>빠른 편인가요?</div>
      <div class="q-sub">한국 코스는 잔디 종류에 따라 편차가 큽니다.
      <b>느린 그린에 가벼운 헤드를 쓰면 거리감이 안 맞습니다.</b></div>
      <div class="q-body">${chipList([
        { v: "slow", t: "느린 편", s: "한국잔디·관리 보통" },
        { v: "mid", t: "보통" },
        { v: "fast", t: "빠른 편", s: "벤트그래스·잘 관리된 곳" },
        { v: "unknown", t: "잘 모르겠어요" }], "greenSpeed")}</div>` },

    { key: "u10", group: "퍼터", q: 10, render: () => `
      <div class="q-eyebrow">손 위치</div>
      <div class="q-title">어드레스에서 손은<br>어디에 있나요?</div>
      <div class="q-sub">손이 공보다 앞에 있으면 로프트가 죽습니다 — 그만큼 로프트가 더 있는 퍼터가 맞아요.</div>
      <div class="q-body">${chipList([
        { v: "forward", t: "공보다 앞(타깃 쪽)" },
        { v: "level", t: "공과 나란히" },
        { v: "back", t: "공보다 뒤" },
        { v: "unknown", t: "잘 모르겠어요" }], "puttHands")}</div>` },

    { key: "u11", group: "퍼터", q: 11, render: () => `
      <div class="q-eyebrow">퍼터 그립</div>
      <div class="q-title">퍼터 그립은<br>어떤 게 좋으세요?</div>
      <div class="q-body">
        ${chipList([
          { v: "pistol", t: "얇은 피스톨", s: "손끝 감각" },
          { v: "over", t: "두꺼운 오버사이즈", s: "손을 덜 쓰게" },
          { v: "any", t: "상관없어요" }], "puttGrip", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">짧은 퍼트에서 손이 굳거나 떨리시나요?</div>
          ${chipList([
            { v: "yes", t: "네, 그런 편이에요" },
            { v: "no", t: "아니요" }], "puttYips", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.puttGrip && S.puttYips))}` },
  ];

  /* ───────── 화면 조립 ─────────
     선택한 클럽에 따라 [선택 → 공통 → 브랜드 → 클럽 문항 → 그립 → 결과] 로 만든다.
     공통 프로필이 이미 있으면 10문항 대신 확인 한 장으로 대체된다. */
  const RESULT_SCREENS = {
    driver: { key: "result", group: "결과", render: renderResult },
    iron: { key: "ironResult", group: "결과", render: renderIron },
    wedge: { key: "wedgeResult", group: "결과", render: renderWedge },
    putter: { key: "puttResult", group: "결과", render: renderPutt },
  };
  const CLUB_Q = { driver: QD, iron: QI, wedge: QW, putter: QU };
  let SCREENS = [PICK];

  function buildScreens(club, redoProfile) {
    const useConfirm = !redoProfile && profileReady();
    const head = useConfirm ? [CONFIRM] : COMMON;
    // 퍼터는 전용 그립 문항(U11)이 있어 공통 그립 블록을 넣지 않는다
    const grip = club === "putter" ? [] : GRIPQ;
    SCREENS = [PICK].concat(head, [BRANDQ], CLUB_Q[club], grip, [RESULT_SCREENS[club]]);
    // 진행 표시용 — 결과를 뺀 실제 문항 수
    TOTAL_Q = SCREENS.filter((s) => s.q).length;
  }
  let TOTAL_Q = 1;


  /* ───────── 룰 엔진 (기준 구현 그대로) ───────── */
  function speedBand(c) {
    if (c < 130) return { w: [40, 52], fx: ["R", "SR"] };
    if (c < 145) return { w: [48, 58], fx: ["SR", "S"] };
    if (c < 160) return { w: [54, 64], fx: ["S"] };
    if (c < 172) return { w: [58, 68], fx: ["S", "X"] };
    return { w: [63, 75], fx: ["X"] };
  }
  const shiftUp = (l) => l.map((f) => FLEX[Math.min(FLEX.indexOf(f) + 1, 3)]).filter((v, i, a) => a.indexOf(v) === i);

  /* ───────── 그립 엔진 (모든 클럽 공통) ─────────
     사이즈는 손 길이 → 제조사 공표표. 손 길이가 없으면 장갑 호수로 **구간만** 잡는다.
     재질·경도·테이퍼·무게는 조건이 명확해 규칙으로 확정된다. */
  function gripEngine() {
    const why = [], cond = S.gripCond || [];
    const has = (v) => cond.includes(v);

    // ① 사이즈
    let size = null, sizeNote = "";
    if (S.handLen) {
      size = (GRIP_SIZE.find((g) => S.handLen < g.max) || GRIP_SIZE[1]).size;
      why.push(`손 길이 ${S.handLen}cm → <b>${size}</b> (제조사 공표 사이징표 기준)`);
    } else if (S.gloveSize && S.gloveSize !== "unknown") {
      sizeNote = GLOVE_HINT[S.gloveSize] || "스탠다드";
      size = sizeNote.split("~")[0];
      why.push(`장갑 ${S.gloveSize}호 → <b>${sizeNote}</b> 구간. 호수 기준은 브랜드마다 달라 범위로만 봅니다`);
    } else {
      size = "스탠다드";
      why.push("손 크기 정보가 없어 <b>스탠다드</b>를 기본으로 두었습니다");
    }
    // 관절·손 힘 → 한 단계 굵게 (쥐는 힘이 덜 듦)
    const UP = { "언더사이즈": "스탠다드", "스탠다드": "미드사이즈", "미드사이즈": "점보", "점보": "점보" };
    if (has("joint") || has("grip") || (S.bodyIssue || []).includes("finger")) {
      size = UP[size] || size;
      why.push("손가락 관절·악력을 고려해 <b>한 단계 굵게</b> — 굵을수록 쥐는 힘이 덜 듭니다");
    }

    // ② 테이퍼 — 훅·손 과활성이면 하부가 두꺼운 것
    const hooking = S.curveDir === "left" || S.shapeI === "hook";
    const slicing = S.curveDir === "right" || S.shapeI === "slice";
    let taper = "표준";
    if (hooking) { taper = "리듀스드"; why.push("왼쪽으로 휘는 경향 — <b>하부가 두꺼운 리듀스드 테이퍼</b>가 손 동작을 줄여 페이스가 덜 닫힙니다"); }
    if (slicing) why.push("오른쪽으로 휘는 경향 — 굵게 가면 릴리즈가 더 막히므로 <b>굵기를 올리지 않았습니다</b>");

    // ③ 재질 — 땀·우천이면 코드
    let tex = "러버";
    if (has("sweat") && has("wet")) tex = "풀코드";
    else if (has("sweat") || has("wet")) tex = "하프코드";
    if (has("nogl")) { tex = "러버"; why.push("장갑을 안 끼시면 코드는 손에 거칩니다 — <b>택키한 러버</b>로 골랐습니다"); }
    else if (tex !== "러버") why.push(`땀·우천 조건 — <b>${tex}</b>는 젖어도 미끄러지지 않습니다`);

    // ④ 경도
    let firm = "표준";
    if (has("joint") || S.gripPress === "tight" || S.gripFeel === "soft") firm = "소프트";
    if (S.gripFeel === "firm" && !has("joint")) firm = "펌";
    if (S.gripPress === "tight") why.push("꽉 쥐는 편 — <b>소프트</b>가 손과 팔의 긴장을 덜어줍니다");

    // ⑤ 무게 — 후반 체력 저하는 무거운 그립(카운터밸런스)이 헤드 체감을 낮춘다
    const tired = S.endur === "fadeLate" || S.endur === "weak" ||
                  (S.auto.fade !== null && S.auto.fade >= 3);
    const heavy = tired;
    if (heavy) why.push("후반에 스윙이 처지는 신호 — <b>무거운 그립(카운터밸런스)</b>이 헤드 체감 무게를 낮춰 후반 스윙을 지켜줍니다");

    // ⑥ 후보 채점
    const pick = GRIPS.map((g) => {
      let p = 0;
      if (g.tex === tex) p += 40;
      else if ((tex === "하프코드" && g.tex === "풀코드") || (tex === "풀코드" && g.tex === "하프코드")) p += 22;
      if (g.firm === firm) p += 25;
      if (g.taper === taper) p += 20; else if (taper === "리듀스드") p -= 8;
      if (heavy) p += (g.w - 48) * 1.5;
      return { ...g, p };
    }).sort((a, b) => b.p - a.p)[0];

    return {
      size, sizeNote, tex, firm, taper, heavy, why,
      model: `${pick.b} ${pick.m}`,
      spec: `${size} · ${pick.tex} · ${pick.firm} · 약 ${pick.w}g${taper === "리듀스드" ? " · 하부 두꺼움" : ""}`,
      measure: !S.handLen,
    };
  }

  /* ───────── 구질 판정 ─────────
     출발 방향 = 스윙 궤도, 휘는 방향 = 페이스가 궤도에 대해 열렸나 닫혔나.
     둘을 나눠 봐야 같은 '슬라이스'라도 처방이 갈린다. */
  const FLIGHT9 = {
    "left|left":     { n: "풀 훅", path: "아웃-인", face: "많이 닫힘", bias: "neutral", tq: "low" },
    "left|none":     { n: "풀", path: "아웃-인", face: "궤도와 같음", bias: "neutral", tq: "mid" },
    "left|right":    { n: "슬라이스", path: "아웃-인", face: "열림", bias: "draw", tq: "high" },
    "straight|left": { n: "드로~훅", path: "거의 곧음", face: "닫힘", bias: "neutral", tq: "low" },
    "straight|none": { n: "스트레이트", path: "곧음", face: "스퀘어", bias: "neutral", tq: "mid" },
    "straight|right":{ n: "페이드~슬라이스", path: "거의 곧음", face: "열림", bias: "draw", tq: "high" },
    "right|left":    { n: "드로", path: "인-아웃", face: "닫힘", bias: "neutral", tq: "mid" },
    "right|none":    { n: "푸시", path: "인-아웃", face: "궤도와 같음", bias: "neutral", tq: "mid" },
    "right|right":   { n: "푸시 슬라이스", path: "인-아웃", face: "많이 열림", bias: "draw", tq: "high" },
  };
  function flightRead() {
    const k = `${S.startDir || "straight"}|${S.curveDir || "none"}`;
    return FLIGHT9[k] || FLIGHT9["straight|none"];
  }

  /* ───────── 로프트 계산 ─────────
     드라이버 거리에서 가장 큰 변수인데 기존 로직에는 아예 없었다.
     기본값은 스피드(7번 캐리 프록시), 보정은 런치·스핀 신호로 한다. */
  function driverLoft() {
    const c7 = S.carry7;
    let L = c7 < 130 ? 12 : c7 < 145 ? 11 : c7 < 160 ? 10.5 : c7 < 172 ? 9.5 : 9;
    const why = [`7번 캐리 ${c7}m로 본 스피드 → 기본 ${L}°`];
    if (S.flight === "low") { L += 1; why.push("낮게 나가 뚝 떨어짐 — 런치를 확보하려 <b>+1°</b>"); }
    if (S.flight === "balloon") { L -= 1; why.push("붕 떠서 힘없이 떨어짐(스핀 과다) — <b>−1°</b>"); }
    if (S.flight === "high") { L -= 1.5; why.push("높이 뜨는데 거리 손해 — <b>−1.5°</b>"); }
    if (S.faceV === "low") { L += 0.5; why.push("페이스 아래쪽 타격 — 스핀이 늘어나는 자리라 <b>+0.5°</b> (티 높이부터 고치는 게 먼저입니다)"); }
    if (S.faceV === "high") { L -= 0.5; why.push("페이스 위쪽 타격 — 기어 효과로 이미 스핀이 낮습니다"); }
    if (S.curveDir === "right") { L += 0.5; why.push("우측으로 휘는 경향 — <b>로프트가 높을수록 사이드스핀 비율이 줄어듭니다</b>"); }
    if (S.endur === "weak" || S.auto.age === "60대 이상") { L += 0.5; why.push("스피드 여유가 크지 않아 런치를 조금 더 확보"); }
    L = Math.max(8.5, Math.min(12, Math.round(L * 2) / 2));
    return { loft: L, why };
  }

  /* ───────── 길이 계산 ─────────
     표준 45.75″는 대부분의 아마추어에게 길다. 정타 일관성이 병목이면 짧게가 정답. */
  function driverLength() {
    const scatter = S.faceH === "vary" || S.carryVar === "big" || S.gripDown === "yes";
    if (scatter) return { len: "44.75 ~ 45.25″",
      why: "정타가 흔들리는 신호가 있습니다. <b>짧게 잡으면 스피드는 거의 안 줄고 정타율이 확실히 오릅니다</b> — 평균 거리는 오히려 늘어납니다." };
    if (S.faceH === "center" && S.carry7 < 140) return { len: "45.5 ~ 45.75″",
      why: "정타가 안정적이고 스피드 여유가 있는 편이 아니라, 표준 길이로 헤드스피드를 확보하는 쪽이 낫습니다." };
    return { len: "45.25 ~ 45.5″", why: "표준보다 살짝 짧은 구간 — 정타율과 스피드의 균형점입니다." };
  }

  function engine() {
    const notes = [], tips = [];
    const band = speedBand(S.carry7);
    let wLo = band.w[0], wHi = band.w[1], fxT = [...band.fx];
    const fl = flightRead();
    const lf = driverLoft();
    const ln = driverLength();

    // 비율 검증 (거짓말 탐지기 겸 정타율 신호)
    const ratio = S.carryD / S.carry7;
    let lowSmash = false;
    if (ratio > 1.68) notes.push({ t: "warn", h: "드라이버 수치는 참고만", b: `7번 대비 드라이버가 깁니다(×${ratio.toFixed(2)}). 헤드스피드 추정은 <b>7번 캐리 기준</b>으로만 계산했습니다.` });
    if (ratio < 1.50) { lowSmash = true; notes.push({ t: "warn", h: "정타율이 병목입니다", b: `7번 대비 드라이버가 짧습니다(×${ratio.toFixed(2)}). 스피드보다 <b>가운데 맞히는 것</b>이 먼저 — 관용성 헤드와 짧은 길이에 가점했습니다.` }); }

    if (S.tempo === "fast") fxT = shiftUp(fxT);
    const fadeSig = S.auto.fade !== null && S.auto.fade >= 3;
    const tired = S.endur === "fadeLate" || S.endur === "weak" || fadeSig;
    if (tired) {
      wLo -= 8; wHi -= 8; fxT = shiftUp(fxT);
      notes.push({ t: "rule", h: "후반 체력 보정 발동", b: `${fadeSig ? `스코어 기록의 후반 +${S.auto.fade}타 패턴` : "36홀 응답"} → <b>무게 한 체급 ↓, 강도 한 단계 ↑</b>. 시타실 10구가 아니라 18홀 전체 기준입니다.` });
    }
    if (S.endur === "weak") { wLo -= 4; wHi -= 4; }
    if ((S.bodyIssue || []).includes("wrist") || (S.bodyIssue || []).includes("back")) {
      wLo -= 4; wHi -= 4;
      notes.push({ t: "rule", h: "몸 상태 반영", b: "손목·허리 부담을 말씀하셔서 <b>무게 밴드를 낮췄습니다.</b> 무거운 샤프트가 스윙을 잡아주는 건 몸이 버틸 때 얘기입니다." });
    }

    // 티 높이 처방 — 돈이 안 드는 유일한 피팅
    if (S.faceV === "low" || S.teeHt === "low")
      notes.push({ t: "rule", h: "먼저 해볼 것 — 티 높이", b: "페이스 아래쪽에 맞으면 <b>스핀이 늘고 런치가 낮아져</b> 거리를 잃습니다. <b>공 절반이 크라운 위로 올라오게</b> 꽂고 공 위치를 왼발 뒤꿈치 안쪽으로 옮겨 보세요. 클럽을 바꾸기 전에 이것부터입니다." });
    if (S.teeHt === "vary")
      tips.push("티 높이가 그때그때 다르면 탄도도 그때그때 달라집니다. <b>티에 표시를 해두고 같은 높이로</b> 꽂아 보세요.");
    if (S.flight === "balloon" && S.ball === "urethane")
      notes.push({ t: "rule", h: "클럽보다 공이 먼저", b: "스핀이 많은 신호인데 <b>우레탄 프리미엄 볼</b>을 쓰고 계십니다. 드라이버 스핀은 공이 만드는 몫이 큽니다 — 거리용 공으로 한 라운드만 바꿔 보세요. 훨씬 싸게 해결될 수 있습니다." });

    // 샤프트 채점
    let pool = SHAFTS;
    if (S.budget === "stock") pool = SHAFTS.filter((s) => s.stock);
    if (!pool.length) pool = SHAFTS;
    const cur = CUR_SHAFT[S.curShaft] || CUR_SHAFT.unknown;
    const shafts = pool.map((s) => {
      let p = 0; const why = [];
      if (s.w >= wLo && s.w <= wHi) { p += 40; why.push(`무게 ${s.w}g — 체력·몸 상태를 반영한 밴드(${wLo}~${wHi}g) 안`); }
      else p += Math.max(0, 40 - 4 * (s.w < wLo ? wLo - s.w : s.w - wHi));
      const fi = FLEX.indexOf(s.fx), tI = fxT.map((f) => FLEX.indexOf(f));
      if (tI.includes(fi)) { p += 35; why.push(`플렉스 ${s.fx} — 목표 강도 일치`); }
      else if (tI.some((t) => Math.abs(t - fi) === 1)) p += (S.tempo === "smooth" && tI.every((t) => fi < t)) ? 25 : 12;
      // 토크 — 페이스가 열려 맞으면 잘 돌아오는(고토크) 쪽, 닫혀 맞으면 안 돌아오는(저토크) 쪽
      if (fl.tq === "high" && s.tq >= 3.8) { p += 12; why.push(`토크 ${s.tq}° — 페이스가 열려 맞는 경향(${fl.n})에서 헤드 턴을 도와줍니다`); }
      if (fl.tq === "low" && s.tq <= 3.2) { p += 12; why.push(`토크 ${s.tq}° — 페이스가 닫혀 맞는 경향(${fl.n}) 억제`); }
      // 킥포인트 — 런치·스핀 신호로 정한다
      if ((S.flight === "low" || S.flight === "unknown" && S.complaint === "traj") && (s.k === "중고" || s.k === "고")) { p += 10; why.push(`킥 ${s.k} — 낮은 탄도를 끌어올립니다`); }
      if ((S.flight === "balloon" || S.flight === "high") && (s.k === "낮음" || s.k === "중저")) { p += 12; why.push(`킥 ${s.k} — 뜨는 탄도와 스핀을 눌러줍니다`); }
      if (S.complaint === "dist" && s.w <= (wLo + wHi) / 2) { p += 6; why.push("밴드 내 가벼운 쪽 — 스피드 확보"); }
      if (S.complaint === "dir" && s.tq <= 3.4) { p += 8; why.push("저토크 — 방향 안정"); }
      if (S.complaint === "consist" && s.tq <= 3.6) { p += 8; why.push("저토크 — 스윙마다 편차를 줄여줍니다"); }
      if (cur.w && Math.abs(s.w - cur.w) > 10) p -= 15;   // 안전장치: 10g 점프 감점
      return { ...s, p, why };
    }).sort((a, b) => b.p - a.p);

    // 헤드 채점
    const heads = HEADS.map((h) => {
      let p = h.forg * 8; const why = [];
      if (h.fit.includes(S.scoreGrp)) p += 15;
      if (fl.bias === "draw" && h.draw) { p += 28; why.push(`드로 바이어스 — 페이스가 열려 맞는 ${fl.n} 교정`); }
      if (fl.bias !== "draw" && h.draw) p -= 15;
      if (S.scoreGrp === "80") {
        if (h.forg <= 3) { p += 18; why.push("조정형 — 구질 세팅 가능"); }
        if (h.spin === "저" && S.carry7 >= 163) { p += 14; why.push("저스핀 — 고속 스윙 런 확보"); }
      } else if (h.forg >= 4) { p += 20; why.push(`관용성 ${h.forg}/5 — 미스에 관대`); }
      if ((S.flight === "balloon" || S.flight === "high") && h.spin === "저") { p += 14; why.push("저스핀 헤드 — 뜨는 탄도·스핀 과다를 눌러줍니다"); }
      if (S.flight === "low" && (h.spin === "중고" || h.spin === "중")) { p += 8; why.push("런치를 확보하는 헤드"); }
      if (lowSmash && h.forg >= 4) { p += 10; why.push("정타율 신호 → 관용성 가점"); }
      if (S.faceH === "vary" && h.forg >= 4) { p += 8; why.push("타점이 흩어지는 편 — 관용성이 실거리를 지켜줍니다"); }
      if (S.venue === "screen" && h.forg >= 4) { p += 4; why.push("스크린 위주 — 매트에서도 손해가 적은 관용성"); }
      if (h.light && S.carry7 < 140) { p += 12; why.push("경량 — 스피드 보전"); }
      if (h.light && S.carry7 >= 160) p -= 12;
      return { ...h, p, why };
    }).sort((a, b) => b.p - a.p);

    const headPick = pickTiers(heads, S.brand, "br", null, null);
    const mainHead = headPick.main, altHead = headPick.alt;
    const shaftPick = pickTiers(shafts, S.shaftBrand, "b",
      (s) => s.w >= wLo - 6 && s.w <= wHi + 6, S.budget);

    // 유지 판정 — 무게·강도가 밴드 안이고 로프트도 맞으면 바꿀 이유가 없다
    const curL = S.curLoft && S.curLoft !== "unknown" ? Number(S.curLoft) : null;
    const loftOk = curL === null ? true : Math.abs(curL - lf.loft) <= 0.5;
    const keep = cur.w !== null
      && cur.w >= wLo - 3 && cur.w <= wHi + 3
      && fxT.some((f) => FLEX.indexOf(f) === FLEX.indexOf(cur.fx))
      && loftOk
      && (S.complaint === "none" || S.complaint === "feel");

    // 로프트만 어긋난 경우 — 클럽을 사지 말고 조정하라고 말해준다
    if (!keep && curL !== null && !loftOk && cur.w !== null && cur.w >= wLo - 3 && cur.w <= wHi + 3)
      notes.push({ t: "rule", h: "새로 사기 전에 — 로프트 조정", b: `샤프트는 이미 맞습니다. 로프트만 ${curL}° → <b>${lf.loft}°</b> 쪽으로 옮기면 됩니다. 요즘 드라이버는 대부분 <b>호젤로 ±1~2° 조정</b>이 되니, 샵에서 돌려보고 결정하세요.` });

    // 점프 경고
    const top = shaftPick.main;
    if (!keep && cur.w && top && Math.abs(top.w - cur.w) > 10)
      notes.push({ t: "warn", h: "무게 점프 주의", b: `현재 ${cur.w}g대 → 추천 ${top.w}g. <b>한 번에 10g 이상 이동은 위험</b> — 중간 체급을 경유하거나 시타 필수.` });

    const grip = gripEngine();

    // 팁
    tips.push(`구질 판정 — <b>${fl.n}</b>. 출발이 ${S.startDir === "left" ? "왼쪽" : S.startDir === "right" ? "오른쪽" : "곧게"}이므로 스윙 궤도는 <b>${fl.path}</b>, 휘는 방향으로 보면 페이스는 궤도에 대해 <b>${fl.face}</b> 상태입니다.`);
    if (fl.path === "아웃-인")
      tips.push("클럽으로 완화는 되지만 <b>근본은 궤도</b>입니다. 드로 바이어스 헤드는 보조 수단으로 보세요.");
    if (S.faceV === "high")
      tips.push("페이스 위쪽에 맞고 계십니다 — <b>잘 치고 계신 겁니다.</b> 기어 효과로 스핀이 줄고 런치가 올라가 실제로 가장 멀리 갑니다.");
    if (S.venue === "screen")
      tips.push("스크린 위주라면 런이 계산으로 나옵니다. <b>캐리 기준으로만</b> 스펙을 맞추는 게 맞습니다.");
    if (S.budget === "stock") tips.push("예산 순정 — 순정 라인 내에서만 골랐습니다.");

    return { wLo, wHi, fxT, notes, tips, shafts: shafts.slice(0, 2),
      shaftPick, headPick, mainHead, altHead, keep, cur, grip, fl, lf, ln,
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
    const notes = [], tips = [], band = speedBand(S.carry7);
    // 아이언 샤프트 무게는 드라이버 대역에 소재별 오프셋을 얹어 잡는다
    // (드라이버 카본 55g대 ≈ 아이언 스틸 105g대가 통상 궁합)
    const drvMid = (band.w[0] + band.w[1]) / 2;
    const steelTarget = Math.round(drvMid + 48);
    const graphTarget = Math.round(drvMid + 22);
    let fxT = [...band.fx];
    const issues = S.bodyIssue || [];
    const tired = S.endur === "fadeLate" || S.endur === "weak" ||
                  (S.auto.fade !== null && S.auto.fade >= 3);

    // ── 소재 — 본인 선택 우선, 미선택이면 체력·스피드·몸 상태로 판단
    let mat = S.ironMat;
    if (!mat || mat === "unsure") {
      const soft = tired || S.carry7 < 140 || S.auto.age === "60대 이상" ||
                   issues.includes("wrist") || issues.includes("back");
      mat = soft ? "그라파이트" : "스틸";
      notes.push({ h: "소재는 이렇게 정했어요",
        b: mat === "그라파이트"
          ? (issues.includes("wrist") || issues.includes("back")
             ? "손목·허리 부담을 말씀하셔서 <b>가벼운 그라파이트</b>로 골랐습니다. 스틸이 잡아주는 건 몸이 버틸 때 얘기입니다."
             : "후반 체력·스윙 스피드를 보면 <b>가벼운 그라파이트</b>가 18홀 내내 스윙을 지켜줍니다.")
          : "지금 스피드라면 <b>스틸</b>이 방향 안정과 거리 일관성에서 유리합니다." });
    }
    let target = mat === "스틸" ? steelTarget : graphTarget;
    if (tired) fxT = shiftUp(fxT);
    if (S.tempo === "fast") fxT = shiftUp(fxT);
    if (issues.includes("wrist") || issues.includes("back")) target -= 8;

    // ── 라이각 — 볼자국(가장 확실) → 디봇 → 손목·바닥/키 순으로 근거를 본다.
    //    ⚠️ 확정이 아니라 **방향과 범위**만 낸다 (절대 원칙 2).
    let lieAdj = 0; const lieWhy = [];
    if (S.ironBallMark === "toe") { lieAdj += 1.5; lieWhy.push("자국이 <b>토우 쪽</b> — 라이가 플랫해서 힐이 들린 상태입니다"); }
    if (S.ironBallMark === "heel") { lieAdj -= 1.5; lieWhy.push("자국이 <b>힐 쪽</b> — 라이가 업라이트해서 토우가 들린 상태입니다"); }
    if (S.ironDivot === "left" && S.ironBallMark !== "toe") { lieAdj += 0.5; lieWhy.push("디봇이 타깃보다 왼쪽 — 업라이트 쪽 신호와 함께 봅니다"); }
    if (S.ironDivot === "right" && S.ironBallMark !== "heel") { lieAdj -= 0.5; lieWhy.push("디봇이 타깃보다 오른쪽"); }
    // 정적 측정 — 손목-바닥이 있으면 그쪽을 쓰고, 없으면 키로만 대략 본다
    const h = S.heightV || 172, wf = S.wristFloor;
    if (wf) {
      const expect = h * 0.4867;                       // 키 대비 통상 손목-바닥 비율
      const d = wf - expect;
      if (d <= -3) { lieAdj += 1; lieWhy.push(`키 ${h}cm에 손목–바닥 ${wf}cm — <b>팔이 짧은 편</b>이라 업라이트 쪽입니다`); }
      else if (d >= 3) { lieAdj -= 1; lieWhy.push(`키 ${h}cm에 손목–바닥 ${wf}cm — <b>팔이 긴 편</b>이라 플랫 쪽입니다`); }
      else lieWhy.push(`키 ${h}cm · 손목–바닥 ${wf}cm — 정적 기준으로는 표준 범위`);
    } else {
      if (h >= 185) { lieAdj += 1; lieWhy.push(`키 ${h}cm — 업라이트 쪽 검토 대상`); }
      else if (h <= 162) { lieAdj -= 1; lieWhy.push(`키 ${h}cm — 플랫 쪽 검토 대상`); }
      else lieWhy.push(`키 ${h}cm — 표준 라이각 범위`);
    }
    const lieDir = lieAdj >= 0.5 ? `업라이트 ${Math.min(3, Math.round(lieAdj * 2) / 2)}° 쪽`
                 : lieAdj <= -0.5 ? `플랫 ${Math.min(3, Math.round(-lieAdj * 2) / 2)}° 쪽` : "표준";
    const lieConfident = S.ironBallMark && S.ironBallMark !== "unknown";

    // ── 길이 — 손목-바닥 기준. 표준은 키가 아니라 이 값에서 나온다
    let lenAdj = "표준";
    if (wf) {
      if (wf >= 92) lenAdj = "+0.25 ~ +0.5″";
      else if (wf <= 78) lenAdj = "−0.25 ~ −0.5″";
    } else if (h >= 188) lenAdj = "+0.25 ~ +0.5″";
    else if (h <= 158) lenAdj = "−0.25 ~ −0.5″";

    // ── 샤프트 채점
    const pool = S.ironBudget === "stock"
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
      if (S.ironTraj === "low" && (s.k === "고" || s.k === "중고")) { p += 12; why.push(`킥 ${s.k} — 낮은 탄도를 끌어올려 그린에 세웁니다`); }
      if (S.ironTraj === "high" && (s.k === "낮음" || s.k === "중저")) { p += 12; why.push(`킥 ${s.k} — 뜨는 탄도를 눌러 거리 손실을 막습니다`); }
      if (S.ironMiss === "thin" && s.k === "고") { p += 10; why.push("높은 킥 — 얇게 맞는 미스에서 탄도 확보"); }
      if (S.ironMiss === "fat" && (s.k === "낮음" || s.k === "중저")) { p += 10; why.push("낮은 킥 — 뒤땅 경향에서 헤드가 덜 처짐"); }
      if (S.ironFeel === "soft" && s.feel === "부드럽다") { p += 12; why.push("부드러운 타감 선호에 맞음"); }
      if (S.ironFeel === "solid" && (s.feel === "단단하다" || s.feel === "묵직하다")) { p += 12; why.push("단단한 타감 선호에 맞음"); }
      if (S.ironFeel === "light" && s.feel === "가볍다") { p += 12; why.push("가벼운 쪽 선호에 맞음"); }
      return { ...s, p, why };
    }).sort((a, b) => b.p - a.p);

    // ── 헤드 채점 — 어드레스 취향이 실제 기준. 실력만으로 정하면 취향이 무시된다
    const look = S.ironLook;
    const heads = IRON_HEADS.map((hd) => {
      let p = hd.forg * 7; const why = [];
      if (hd.fit.includes(S.scoreGrp || "90")) { p += 22; why.push(`평균 ${S.auto.avg || (S.scoreGrp + "대")}타 구간에 맞는 난이도`); }
      if (look === "classic") { p += (5 - hd.forg) * 7; if (hd.off === "적음") { p += 14; why.push("얇은 톱라인·적은 오프셋 — 원하시는 생김새"); } }
      if (look === "forgiving") { p += hd.forg * 7; if (hd.off === "많음") { p += 10; why.push("두툼한 헤드·넉넉한 오프셋 — 원하시는 생김새"); } }
      if (S.ironComplaint === "forg" && hd.forg >= 4) { p += 16; why.push(`관용성 ${hd.forg}/5 — 빗맞을 때 손해가 가장 적은 쪽`); }
      if (S.ironMiss === "thin" && hd.forg >= 4) { p += 14; why.push(`관용성 ${hd.forg}/5 — 얇게 맞아도 거리 손실이 적음`); }
      if (S.ironMiss === "dir" && hd.off === "많음") { p += 12; why.push("오프셋 많음 — 페이스가 늦게 열려 방향 안정"); }
      if (S.shapeI === "slice" && hd.off === "많음") { p += 12; why.push("오프셋 많음 — 슬라이스 완화"); }
      if (S.shapeI === "hook" && hd.off === "적음") { p += 10; why.push("오프셋 적음 — 훅 억제"); }
      if (S.ironTraj === "low" && hd.forg >= 4) { p += 8; why.push("중공·맥스 계열 — 낮은 탄도를 띄워줍니다"); }
      if (hd.light && (tired || S.carry7 < 140)) { p += 10; why.push("경량 설계 — 후반까지 스윙 유지"); }
      if (S.venue === "screen" && hd.forg >= 4) { p += 4; why.push("스크린 위주 — 매트에서도 손해가 적은 관용성"); }
      return { ...hd, p, why };
    }).sort((a, b) => b.p - a.p);

    // ── 세트 구성 — 클럽을 파는 조언이 아니라 빼라는 조언
    let setAdvice = null;
    const longest = Number(S.ironLongest);
    if (S.ironLongOk === "no" && longest && longest <= 5) {
      const swap = [];
      for (let n = longest; n <= (S.carry7 < 140 ? 6 : 5); n++) swap.push(n + "번");
      setAdvice = { drop: swap, b: `<b>${swap.join(" · ")} 아이언은 빼고 유틸리티(하이브리드)로 바꾸세요.</b> 자신 없는 클럽을 들고 다니는 것보다, 같은 거리를 쉽게 띄우는 클럽 하나가 스코어에 훨씬 낫습니다. 클럽을 더 사시라는 뜻이 아니라 <b>바꾸시라는</b> 뜻입니다.` };
    } else if (S.ironLongOk === "ok" && longest && longest >= 6) {
      setAdvice = { drop: [], b: `${longest}번부터 쓰고 계시고 잘 맞으신다면 지금 구성이 맞습니다. 굳이 긴 아이언을 늘릴 이유가 없습니다.` };
    }

    // ── 로프트 세대 — 스트롱 로프트면 웨지 간격이 벌어진다
    if (S.pwLoft && S.pwLoft <= 43)
      tips.push(`피칭 ${S.pwLoft}° — <b>스트롱 로프트</b>입니다. 거리는 늘지만 피칭 아래 간격이 벌어지니 <b>웨지를 하나 더</b> 고려하세요.`);

    // ── 유지 판정
    const keepish = S.ironComplaint === "none" || S.ironComplaint === "feel";
    if (keepish && S.ironCurModel)
      notes.push({ h: "바꿀 이유가 뚜렷하지 않습니다", b: `지금 <b>${S.ironCurModel}</b>에 특별히 아쉬운 점이 없다고 하셨습니다. 아래는 참고용이고, <b>먼저 라이각과 길이만 맞춰보시길</b> 권합니다. 훨씬 싸고 효과가 큽니다.` });

    if (mat === "스틸" && S.ironMat === "그라파이트")
      notes.push({ h: "선택하신 소재를 따랐어요", b: "그라파이트로 골랐습니다. 다만 스틸보다 <b>거리 편차가 커질 수</b> 있어 시타에서 꼭 확인해 보세요." });

    return {
      mat, target, fxT, notes, tips, setAdvice,
      lie: lieDir, lieWhy, lieConfident, lenAdj,
      keepish: keepish && !!S.ironCurModel,
      grip: gripEngine(),
      shaftPick: pickTiers(shafts, S.ironShaftBrand, "b",
        (s) => s.mat === mat && Math.abs(s.w - target) <= 12, S.ironBudget),
      headPick: pickTiers(heads, S.ironBrand, "br", null, null),
    };
  }

  /* ── 웨지 ────────────────────────────────────────────────────
     로프트 갭은 계산으로 딱 떨어지는 영역이라 추측이 들어가지 않는다.
     바운스는 스윙 타입(디거/스위퍼) × 잔디 상태 × 벙커 자신감으로 정해진다. */
  function wedgeEngine() {
    const pw = S.pwLoft || 45;            // 모르면 최근 아이언 표준값 45°
    const lw = 58;                        // 로브웨지는 58° 기준
    const span = lw - pw;
    // 본인이 쓰는 개수를 존중하되, 갭이 12° 이상이면 3개가 정석
    let cnt = span >= 12 ? 3 : 2;
    const want = Number(S.wedgeCount);
    if (want && want >= 2 && want <= 4) cnt = Math.max(2, Math.min(4, want));
    const step = Math.round((span / cnt) * 2) / 2;
    const lofts = [];
    for (let i = 1; i <= cnt; i++) lofts.push(Math.round(pw + step * i));
    lofts[lofts.length - 1] = lw;

    // 바운스 — 디거는 높게, 스위퍼는 낮게. 잔디가 무르면 더 높게, 타이트하면 낮게
    let base = S.wedgeTurf === "dig" ? 12 : S.wedgeTurf === "sweep" ? 8 : 10;
    const why = [`스윙 타입 ${S.wedgeTurf === "dig" ? "디거(깊게 파고듦)" : S.wedgeTurf === "sweep" ? "스위퍼(얕게 쓸어침)" : "중간"} → 기본 ${base}°`];
    if (S.wedgeMiss === "fat") { base += 2; why.push("뒤땅 경향 — 바운스를 <b>+2°</b> (솔이 튕겨 나와 실수를 덮어줍니다)"); }
    if (S.wedgeMiss === "thin") { base -= 1; why.push("토핑 경향 — 바운스를 <b>−1°</b> (솔이 두꺼우면 리딩에지가 떠서 더 얇게 맞습니다)"); }
    if (S.wedgeGrass === "soft") { base += 2; why.push("잔디가 두툼함 — <b>+2°</b>"); }
    if (S.wedgeGrass === "tight") { base -= 2; why.push("타이트하고 딱딱함 — <b>−2°</b> (바운스가 크면 튕겨서 토핑이 납니다)"); }
    if (S.venue === "screen") why.push("스크린 위주라면 매트에서는 바운스 차이가 잘 안 느껴집니다 — <b>필드 기준</b>으로 맞췄습니다");

    const grind = S.wedgeTurf === "dig" ? "넓은 솔(와이드) — 파고들어도 튕겨 나옴"
                : S.wedgeTurf === "sweep" ? "좁은 솔(내로우) — 얕게 쓸어 치기 좋음"
                : "중간 솔 — 두루 무난";

    const specs = lofts.map((lo, i) => {
      // 갭웨지 쪽은 풀스윙이 많아 바운스를 조금 낮추고, 로브·샌드는 높인다
      let b = base + (i === lofts.length - 1 ? 2 : i === 0 ? -2 : 0);
      if (S.wedgeBunker === "no" && i === lofts.length - 1) b += 2;
      b = Math.max(4, Math.min(14, b));
      return { loft: lo, bounce: b,
        use: i === 0 ? "풀스윙 갭 메우기" : i === lofts.length - 1 ? "그린 주변 띄우기·벙커" : "어프로치 주력" };
    });
    if (S.wedgeBunker === "no") why.push("벙커에 자신 없다고 하셔서 <b>가장 로프트가 큰 웨지의 바운스를 더 올렸습니다</b> — 모래를 파고들지 않고 미끄러집니다");

    // 샤프트 — 웨지는 아이언보다 조금 무겁게 가는 것이 정석
    const band = speedBand(S.carry7);
    const ironW = Math.round((band.w[0] + band.w[1]) / 2 + 48);
    const shaft = S.wedgeShaft === "same"
      ? { t: "아이언과 동일", b: `아이언 샤프트를 그대로 쓰면 감각이 이어집니다. 약 ${ironW}g 전후.` }
      : S.wedgeShaft === "heavy"
      ? { t: `웨지 전용 · 약 ${ironW + 10}g`, b: "웨지는 풀스윙보다 컨트롤 샷이 많아 <b>아이언보다 5~15g 무겁게</b> 가면 손이 덜 쓰이고 거리가 일정해집니다." }
      : { t: `약 ${ironW + 10}g 권장`, b: "아이언보다 <b>10g쯤 무거운</b> 쪽을 권합니다. 웨지는 스피드보다 일정함이 중요한 클럽입니다." };

    return {
      pw, cnt, specs, grind, why, shaft,
      pick: pickTiers(WEDGES.map((w) => ({ ...w, p: w.br === S.wedgeBrand ? 10 : 0 }))
                      .sort((a, b) => b.p - a.p), S.wedgeBrand, "br", null, null),
      grip: gripEngine(),
      note: `피칭(${pw}°)과 로브(58°) 사이 ${span}°를 ${cnt}개로 나눴습니다. ` +
            `한 클럽당 ${step}° — 거리 공백이 생기지 않는 간격입니다.`,
    };
  }

  /* ── 퍼터 ────────────────────────────────────────────────────
     궤도↔밸런스, 눈 위치↔길이, 그린 빠르기↔헤드 무게, 손 위치↔로프트 —
     퍼터 피팅에서 근거가 분명한 축들을 각각 따로 계산한다. */
  function putterEngine() {
    const arc = (!S.puttStroke || S.puttStroke === "unknown") ? "slight" : S.puttStroke;
    const notes = [], tips = [];
    if (S.puttStroke === "unknown")
      notes.push({ h: "궤도는 이렇게 가정했어요", b: "잘 모르겠다고 하셔서 <b>약간의 아크</b>로 두었습니다. 아마추어에게 가장 흔하고, 약토우행 미드말렛은 어느 궤도에서도 크게 어긋나지 않습니다." });

    const scored = PUTTERS.map((p) => {
      let s = 0; const why = [];
      if (p.arc === arc) { s += 40; why.push(`${arc === "straight" ? "직선" : arc === "arc" ? "아크가 큰" : "약간 아크"} 스트로크에 맞는 ${p.bal}`); }
      else if ((arc === "slight" && p.arc !== "straight") || (p.arc === "slight")) s += 18;
      if ((S.puttMiss === "dir" || S.puttMiss === "both") && p.shape !== "블레이드") { s += 16; why.push("말렛 계열 — 관성이 커서 방향이 덜 틀어짐"); }
      if ((S.puttMiss === "dist" || S.puttMiss === "both") && p.shape === "블레이드") { s += 10; why.push("블레이드 — 거리감을 손끝으로 읽기 좋음"); }
      if (S.puttShort === "vary" && p.shape !== "블레이드") { s += 12; why.push("짧은 퍼트가 일정하지 않음 — 관성이 큰 헤드가 방향을 지켜줍니다"); }
      if (S.puttLook === "blade" && p.shape === "블레이드") { s += 14; why.push("선호하시는 생김새"); }
      if (S.puttLook === "mallet" && p.shape !== "블레이드") { s += 14; why.push("선호하시는 생김새"); }
      if (S.puttLine === "line" && p.shape !== "블레이드") { s += 10; why.push("긴 조준선을 넣기 좋은 형상"); }
      if (S.puttLine === "none" && p.shape === "블레이드") { s += 8; why.push("조준선 없는 깔끔한 상판"); }
      return { ...p, p: s, why };
    }).sort((a, b) => b.p - a.p);

    // ── 길이 — 정적 기준(키·손목바닥) + 눈 위치 자가진단
    const h = S.heightV || 172, wf = S.wristFloor;
    let len = wf ? (wf >= 92 ? 35 : wf >= 86 ? 34.5 : wf >= 80 ? 34 : 33.5)
                 : (h >= 183 ? 35 : h >= 173 ? 34.5 : h >= 165 ? 34 : h >= 157 ? 33.5 : 33);
    const lenWhy = [wf ? `손목–바닥 ${wf}cm 기준 ${len}″` : `키 ${h}cm 기준 ${len}″ (손목–바닥을 재면 더 정확합니다)`];
    if (S.puttEye === "inside") { len -= 1; lenWhy.push("공을 떨어뜨렸을 때 <b>안쪽(발 쪽)</b>에 떨어진다면 퍼터가 길어 손이 몸에서 떨어진 상태입니다 — <b>1인치 짧게</b>"); }
    if (S.puttEye === "outside") { len += 0.5; lenWhy.push("공보다 바깥쪽에 떨어진다면 너무 멀리 서 있습니다 — 자세를 먼저 보고, 길이는 +0.5″만"); }
    if (S.puttLong === "yes" && S.puttEye !== "inside") { len -= 0.5; lenWhy.push("길게 느껴진다고 하셔서 <b>0.5인치</b> 더 줄였습니다"); }
    len = Math.max(32, Math.min(35, len));
    const curLen = S.puttCurLen && S.puttCurLen !== "unknown" ? Number(S.puttCurLen) : null;
    if (curLen && curLen - len >= 1)
      notes.push({ h: "새로 사기 전에 — 길이부터", b: `지금 ${curLen}″를 쓰시는데 계산상 <b>${len}″</b>가 맞습니다. <b>퍼터를 자르는 건 몇만 원이면 됩니다.</b> 새 퍼터를 사기 전에 이것부터 해보세요. 다만 자르면 헤드가 가볍게 느껴지니 그립을 조금 무거운 것으로 함께 보세요.` });

    // ── 헤드 무게 — 그린 빠르기가 정한다 (미국식 기준을 그대로 쓰면 한국에서 안 맞음)
    const hw = S.greenSpeed === "slow" ? { t: "무거운 헤드 (약 355g 이상)", b: "느린 그린에서는 <b>무거운 헤드</b>가 짧은 퍼트를 덜 남깁니다. 손으로 때리지 않아도 굴러가거든요." }
             : S.greenSpeed === "fast" ? { t: "가벼운~표준 헤드 (약 340g 전후)", b: "빠른 그린에서 무거운 헤드는 계속 지나칩니다. <b>가벼운 쪽</b>이 거리감을 잡기 쉽습니다." }
             : { t: "표준 헤드 (약 350g)", b: "그린 편차가 크면 표준 무게가 가장 무난합니다." };

    // ── 로프트 — 손 위치(포워드 프레스)가 정한다
    const loft = S.puttHands === "forward" ? { t: "3.5 ~ 4°", b: "손이 공보다 앞에 있으면 임팩트에서 로프트가 죽습니다. <b>정적 로프트가 더 있는 퍼터</b>라야 공이 뜨지 않고 바로 구릅니다." }
               : S.puttHands === "back" ? { t: "1.5 ~ 2°", b: "손이 뒤에 있으면 로프트가 더해집니다 — <b>낮은 로프트</b>가 공을 띄우지 않습니다." }
               : { t: "2.5 ~ 3°", b: "표준 범위입니다. 공이 처음에 통통 튄다면 로프트를 조금 올려 보세요." };

    // ── 페이스 — 타감 선호 × 그린 빠르기
    const face = S.puttFeel === "firm" ? "밀드 페이스 — 단단하고 또렷한 소리"
               : S.puttFeel === "soft" ? "인서트 페이스 — 부드럽게 툭"
               : (S.greenSpeed === "slow" ? "밀드 페이스 — 느린 그린에서는 단단한 쪽이 굴림이 좋습니다"
                                          : "인서트 페이스 — 무난한 선택");

    // ── 그립
    let pg = PUTTER_GRIPS[0];
    if (S.puttGrip === "over") pg = PUTTER_GRIPS[1];
    if (S.puttYips === "yes" || (S.puttMiss === "dir" && S.puttShort === "vary")) pg = PUTTER_GRIPS[2];
    if (S.puttYips === "yes")
      tips.push("짧은 퍼트에서 손이 굳는다면 <b>오버사이즈 + 카운터밸런스</b>가 손 개입을 줄여줍니다. 그래도 안 되면 암락·롱퍼터도 방법이지만, 그건 데이터가 부족해 저희가 단정해 드리지 않습니다.");

    // ── 짧은 퍼트 미스 방향 → 정렬·라이각
    if (S.puttShort === "left")
      tips.push("짧은 퍼트를 <b>왼쪽으로 당기신다</b>면 조준이 이미 왼쪽을 보고 있거나 라이각이 업라이트할 수 있습니다. 퍼터를 바닥에 놓고 <b>토우가 들리는지</b> 확인해 보세요.");
    if (S.puttShort === "right")
      tips.push("짧은 퍼트를 <b>오른쪽으로 미신다</b>면 라이각이 플랫해서 힐이 들렸을 수 있습니다. 솔이 지면과 평행한지 확인해 보세요.");
    if (S.puttLine === "none")
      tips.push("조준선이 없는 게 편하시다면, 대신 <b>공의 로고선</b>을 목표에 맞춰 놓는 방식이 잘 맞습니다.");
    if (S.greenSpeed === "unknown")
      tips.push("그린 빠르기를 모르시겠다면, 라운드 때 <b>10m 퍼트가 홀을 얼마나 지나치는지</b>만 봐두셔도 다음에 훨씬 정확해집니다.");

    return {
      arc, len, lenWhy, notes, tips, hw, loft, face, curLen,
      grip: pg,
      pick: pickTiers(scored, S.putterBrand, "br", null, null),
      lie: "라이각은 셋업에서 퍼터 솔이 지면과 평행해지는지로 확인하세요. 토우나 힐이 들리면 그만큼 시작 방향이 틀어집니다.",
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
  /* 가격대·단종 표시 — 고르는 사람 입장에선 스펙만큼 중요한 정보다 */
  function tagsOf(x) {
    if (!x) return "";
    const t = [];
    if (x.pr !== undefined) t.push(`<span class="r-tag">${PRICE_LABEL[x.pr]}</span>`);
    if (x.st === "old") t.push(`<span class="r-tag old">단종 · 중고로 구함</span>`);
    return t.length ? `<div class="r-tags">${t.join("")}</div>` : "";
  }
  function resCard(kind, name, spec, whys, alt, x) {
    return `<div class="res-card${alt ? " pick-alt" : ""}"><span class="kind">${kind}</span>
      <div class="r-name">${name}</div>
      <div class="r-spec">${spec}</div>${tagsOf(x)}
      <ul>${(whys || []).slice(0, 3).map((w) => `<li>${w}</li>`).join("")}</ul>
    </div>`;
  }
  /* 다른 브랜드 제안 문구 — 밀어붙이지 않고 권하는 말투 */
  function altLead(what) {
    return `<div class="alt-lead">이 ${what}도 골퍼님께 잘 맞을 것 같아요</div>`;
  }
  /* 2차 제안 — 단종까지 포함하면 더 잘 맞는 게 있을 때만 내민다.
     한국은 중고 시장이 커서, 지난 모델이 값도 싸고 더 맞는 경우가 실제로 많다. */
  function olderCard(what, x, specTxt, better) {
    if (!x) return "";
    return `<div class="alt-lead">${better
        ? `단종까지 보면 — <b>더 잘 맞는</b> ${what}가 있습니다`
        : `단종까지 보면 — 성능은 비슷하고 <b>값은 내려가는</b> ${what}입니다`}</div>` +
      resCard("중고로 찾을 만한 것", `${x.b || x.br || ""} ${x.m}`.trim(),
        specTxt, (x.why && x.why.length ? x.why : ["지금 조건에 더 가깝습니다"]), true, x) +
      `<div class="inline-note">지난 모델이라 <b>새 제품은 구하기 어렵습니다.</b>
        중고로 보실 때는 샤프트 스펙(무게·플렉스)이 표기와 같은지 꼭 확인하세요 —
        같은 이름이라도 다른 스펙이 끼워져 있는 매물이 흔합니다.</div>`;
  }
  function brandLine(pick) {
    if (!pick.wanted) return "브랜드 상관없이 1순위";
    return pick.matched ? `${pick.wanted} 안에서 1순위`
      : `${pick.wanted}에는 맞는 게 없어 전체 1순위로 골랐어요`;
  }

  function shaftSpec(s) {
    return `${s.b} · ${s.w}g · ${s.fx} · 토크 ${s.tq}° · 킥 ${s.k}${s.velo ? " · 벨로코어" : ""}`;
  }

  /* ═══════════════════════════════════════════════════════════════
     설명 (가장 중요한 부분 — 사장님 지시 2026-07-27)
     "왜 이 클럽인가"를 골퍼가 납득할 때까지 풀어서 말한다.
     스펙 나열은 신뢰를 만들지 않는다. 순서는 늘 같다:
       ① 당신의 스윙을 이렇게 읽었습니다 (진단)
       ② 그래서 이런 스펙이 필요합니다 (기준)
       ③ 이 클럽이 그 기준에 이렇게 맞습니다 (연결)
       ④ 바꾸면 무엇이 달라집니다 (기대)
       ⑤ 다만 이건 조심하세요 (정직 — 이게 있어야 나머지가 믿긴다)
     ═══════════════════════════════════════════════════════════════ */
  function readBlock(title, rows) {
    return `<div class="cf-read"><div class="cf-read-h">${title}</div>` +
      rows.filter(Boolean).map((r) => `<div class="cf-read-row">
        <div class="cf-read-k">${r.k}</div>
        <div class="cf-read-v">${r.v}</div>
        ${r.b ? `<div class="cf-read-b">${r.b}</div>` : ""}</div>`).join("") + `</div>`;
  }
  function story(title, paras, kind) {
    return `<div class="cf-story${kind ? " " + kind : ""}">
      <div class="cf-story-h">${title}</div>
      ${paras.filter(Boolean).map((p) => `<p>${p}</p>`).join("")}</div>`;
  }
  const speedTxt = (c7) => c7 < 130 ? "느린 편" : c7 < 145 ? "보통보다 조금 아래" : c7 < 160 ? "보통~빠른 편" : c7 < 172 ? "빠른 편" : "아주 빠른 편";
  const gradeTxt = () => S.scoreGrp === "80" ? "80대 이하" : S.scoreGrp === "100" ? "100타 이상" : "90대";

  /* ── 드라이버 설명 ───────────────────────────────────────────── */
  function explainDriver(r) {
    const fl = r.fl, sp = r.shaftPick.main, hd = r.headPick.main;
    const c7 = S.carry7, ratio = (S.carryD / c7);
    const flightTxt = { low: "낮게 나가서 뚝 떨어진다", good: "쭉 뻗다가 부드럽게 떨어진다",
      balloon: "붕 떠서 힘없이 떨어진다", high: "너무 높이 뜨는데 거리가 안 난다", unknown: "잘 모르겠다" }[S.flight] || "-";

    // ① 진단
    const read = readBlock("골퍼님의 스윙, 이렇게 읽었습니다", [
      { k: "스피드", v: `7번 캐리 ${c7}m — ${speedTxt(c7)} (약 ${r.mph}mph 추정)`,
        b: "드라이버 거리는 잘 맞은 한 방에 좌우돼서 스피드 지표로 부정확합니다. 7번 아이언 캐리가 훨씬 정직해요." },
      { k: "정타율", v: `드라이버 ${S.carryD}m ÷ 7번 ${c7}m = ×${ratio.toFixed(2)}`,
        b: ratio < 1.50 ? "<b>1.50 아래</b>입니다. 스피드가 있는데 드라이버에서 그만큼을 못 받고 있다는 뜻 — 병목은 힘이 아니라 <b>가운데 맞히기</b>입니다."
          : ratio > 1.68 ? "1.68 위로 드문 조합입니다. 드라이버 수치는 참고만 하고 <b>7번 기준</b>으로 계산했습니다."
          : "정상 범위입니다. 스피드가 드라이버까지 잘 전달되고 있습니다." },
      { k: "궤도와 페이스", v: `${fl.n} — 궤도 ${fl.path} · 페이스는 궤도 대비 ${fl.face}`,
        b: `공이 <b>${S.startDir === "left" ? "왼쪽" : S.startDir === "right" ? "오른쪽" : "곧게"}</b>으로 출발한다는 건 스윙 궤도가 그 방향이라는 뜻이고, 거기서 <b>${S.curveDir === "right" ? "오른쪽으로 휜다" : S.curveDir === "left" ? "왼쪽으로 휜다" : "안 휜다"}</b>는 건 페이스가 그 궤도에 대해 ${fl.face} 상태라는 뜻입니다. 두 정보를 나눠 받는 이유가 이겁니다.` },
      { k: "런치와 스핀", v: flightTxt,
        b: S.flight === "balloon" ? "이건 <b>스핀 과다</b>의 전형적인 모습입니다. 높이는 나오는데 앞으로 못 가고 서버립니다."
          : S.flight === "low" ? "런치가 부족합니다. 스핀도 같이 부족하면 공이 그냥 떨어집니다 — 로프트를 올려야 하는 자리입니다."
          : S.flight === "high" ? "뜨는 데 힘을 다 쓰고 있습니다. 로프트와 스핀을 함께 낮춰야 합니다."
          : "런치는 큰 문제가 없어 보입니다." },
      S.faceV && S.faceV !== "unknown" ? { k: "타점 (위아래)",
        v: S.faceV === "high" ? "페이스 위쪽" : S.faceV === "low" ? "페이스 아래쪽" : "가운데",
        b: S.faceV === "high" ? "<b>칭찬드립니다.</b> 위쪽 타격은 기어 효과로 스핀이 줄고 런치가 올라갑니다 — 실제로 가장 멀리 가는 자리예요."
          : S.faceV === "low" ? "아래쪽은 <b>스핀이 늘고 볼스피드가 떨어지는</b> 자리입니다. 여기가 지금 가장 큰 손실 지점입니다."
          : "무난합니다." } : null,
      S.faceH && S.faceH !== "unknown" ? { k: "타점 (좌우)",
        v: { toe: "토우 쪽", heel: "힐 쪽", center: "가운데", vary: "들쭉날쭉" }[S.faceH],
        b: S.faceH === "vary" ? "타점이 흩어지면 <b>거리가 아니라 편차</b>가 문제가 됩니다. 길이를 줄이는 게 가장 확실한 답입니다."
          : S.faceH === "heel" ? "힐 쪽은 기어 효과로 <b>오른쪽으로 휘는</b> 성분이 더해집니다. 슬라이스의 절반은 여기서 오기도 합니다."
          : S.faceH === "toe" ? "토우 쪽은 <b>왼쪽으로 감기는</b> 성분이 더해집니다." : "가장 좋은 자리입니다." } : null,
      { k: "체력", v: { strong: "36홀 거뜬", fadeLate: "후반에 무너짐", weak: "18홀도 벅참" }[S.endur] || "-",
        b: S.endur === "strong" ? "체력 보정 없이 원래 밴드로 계산했습니다."
          : "<b>시타실 10구가 아니라 18홀 전체</b>가 기준입니다. 후반에 못 휘두를 무게는 처음부터 맞는 무게가 아닙니다 — 그래서 무게를 한 체급 내리고 강도를 한 단계 올렸습니다." },
    ]);

    // ② 기준 → ③ 연결 → ④ 기대
    const why = story("그래서 이 조합입니다", [
      `<b>로프트 ${r.lf.loft}°</b> — ${r.lf.why.join(". ")}. 로프트는 드라이버 거리에서 <b>가장 큰 변수</b>인데, 대부분 스펙 표에서 맨 뒤로 밀립니다. 여기서는 맨 앞에 둡니다.`,
      `<b>${sp.m} ${sp.sp}</b> — 무게 ${sp.w}g는 계산 밴드 ${r.wLo}~${r.wHi}g 안이고, 플렉스 ${sp.fx}는 ${S.tempo === "fast" ? "전환이 급한 템포를 감안해 한 단계 올린" : "지금 스피드에 맞는"} 강도입니다. 토크 ${sp.tq}°는 ${fl.tq === "high" ? "페이스가 열려 맞는 지금 경향에서 <b>헤드가 제때 돌아오도록</b> 도와주는 쪽" : fl.tq === "low" ? "페이스가 닫혀 맞는 경향을 <b>덜 감기게</b> 눌러주는 쪽" : "중립적인 쪽"}이고, 킥 ${sp.k}는 ${S.flight === "balloon" || S.flight === "high" ? "지금의 <b>과한 런치와 스핀을 눌러주는</b>" : S.flight === "low" ? "부족한 <b>런치를 끌어올리는</b>" : "탄도를 유지하는"} 성격입니다.`,
      `<b>${hd.br} ${hd.m}</b> — 관용성 ${hd.forg}/5, 스핀 ${hd.spin}${hd.draw ? ", 드로 바이어스" : ", 뉴트럴"}. ${hd.draw ? `페이스가 열려 맞는 ${fl.n} 경향을 헤드 무게 배치로 <b>물리적으로 상쇄</b>합니다 — 스윙을 안 바꿔도 공이 덜 휩니다.` : `구질을 억지로 건드리지 않고 <b>타점이 흔들려도 거리를 지켜주는</b> 쪽으로 골랐습니다.`} 평균 ${gradeTxt()} 구간에서 ${hd.forg >= 4 ? "관용성이 곧 평균 거리입니다 — 잘 맞은 한 방보다 <b>안 맞은 공의 손해를 줄이는 것</b>이 스코어에 훨씬 큽니다." : "조정 기능으로 구질을 직접 세팅할 수 있는 쪽이 낫습니다."}`,
      `<b>길이 ${r.ln.len}</b> — ${r.ln.why}`,
      `<b>그립 ${r.grip.model}</b> — ${r.grip.why.join(". ")}.`,
    ]);

    const expect = story("바꾸면 이렇게 달라집니다", [
      r.keep
        ? "지금 클럽이 이미 밴드 안이라 <b>바꿔서 얻을 게 거의 없습니다.</b> 이 판정을 그대로 믿으셔도 됩니다."
        : (S.flight === "balloon" || S.flight === "high")
          ? "스핀이 줄면 공이 <b>앞으로 더 갑니다.</b> 높이가 낮아 보여도 캐리와 런이 함께 늘어 총거리가 올라갑니다. 지금은 높이에 힘을 쓰고 있습니다."
        : S.flight === "low"
          ? "런치가 올라가면 <b>체공이 길어져 캐리가 늘어납니다.</b> 지금은 공이 뻗기도 전에 떨어지고 있습니다."
        : "밴드 안의 무게·강도로 맞추면 <b>스윙마다의 편차</b>가 먼저 줄어듭니다. 최고 거리보다 평균 거리가 올라갑니다.",
      (S.faceV === "low" || S.teeHt === "low")
        ? "<b>그리고 이건 오늘 당장, 돈 안 들이고 됩니다</b> — 티를 올려서 공 절반이 크라운 위로 나오게 꽂아 보세요. 타점이 위로 올라가면 스핀이 줄고 볼스피드가 붙습니다. 클럽 바꾸는 것보다 이게 먼저입니다."
        : null,
      (S.faceH === "vary" || S.carryVar === "big")
        ? "길이를 0.5~1인치 줄이면 <b>헤드스피드는 거의 안 줄고</b> 정타율이 확실히 오릅니다. 스피드 1~2mph 잃고 정타를 얻으면 평균 거리는 오히려 늘어납니다."
        : null,
    ], "good");

    const caution = story("다만, 이건 꼭 짚어드립니다", [
      "이 추천은 <b>설문을 근거로 한 계산</b>입니다. 실제 피팅은 런치모니터로 볼스피드·스핀·어택앵글을 재서 확정합니다. 저희는 <b>후보를 좁혀드리는 것</b>까지가 역할입니다.",
      r.cur.w ? `무게는 <b>한 번에 10g 이상 옮기지 마세요.</b> 지금 ${r.cur.w}g대를 쓰고 계신데, 급하게 바꾸면 스윙 타이밍이 먼저 무너집니다.` : "지금 샤프트를 모르신다면 <b>바꾸기 전에 먼저 확인</b>하세요. 비교 대상이 있어야 좋아졌는지 알 수 있습니다.",
      "<b>시타 없이 사지 마세요.</b> 그리고 저희는 어떤 브랜드와도 관계가 없습니다 — 팔아서 남는 게 없으니 '그대로 쓰세요'라고 말할 수 있는 겁니다.",
    ], "warn");

    return { read: read, rest: why + expect + caution };
  }

  /* ── 아이언 설명 ─────────────────────────────────────────────── */
  function explainIron(r) {
    const sp = r.shaftPick.main, hd = r.headPick.main;
    const read = readBlock("골퍼님의 아이언, 이렇게 읽었습니다", [
      { k: "스피드", v: `7번 캐리 ${S.carry7}m — ${speedTxt(S.carry7)}`,
        b: `이 숫자로 샤프트 무게 목표(약 ${r.target}g)와 강도(${r.fxT.join("/")})가 나옵니다.` },
      { k: "임팩트", v: { thin: "얇게 맞음", fat: "뒤땅", dir: "방향이 흔들림", none: "특별한 경향 없음" }[S.ironMiss] || "-",
        b: S.ironMiss === "thin" ? "얇게 맞으면 공이 안 뜹니다. <b>높은 킥 + 관용성 큰 헤드</b>가 이 미스에서 거리를 지켜줍니다."
          : S.ironMiss === "fat" ? "뒤땅은 헤드가 먼저 떨어지는 겁니다. <b>낮은 킥</b>이 임팩트에서 헤드가 덜 처지게 합니다."
          : S.ironMiss === "dir" ? "좌우로 갈리면 <b>오프셋</b>으로 페이스가 늦게 열리게 잡아줍니다." : "무난합니다." },
      { k: "탄도", v: { low: "낮음 — 그린에 안 섬", mid: "적당", high: "너무 뜸", unknown: "모름" }[S.ironTraj] || "-",
        b: S.ironTraj === "low" ? "아이언은 <b>그린에 세우는 게 목적</b>입니다. 안 서면 거리가 맞아도 결과가 안 남습니다 — 킥이 높은 샤프트로 띄웁니다."
          : S.ironTraj === "high" ? "너무 뜨면 바람에 약하고 거리를 잃습니다 — 킥을 낮춰 눌러줍니다." : "적정합니다." },
      { k: "구질", v: { slice: "오른쪽(슬라이스)", straight: "거의 곧게", hook: "왼쪽(훅)" }[S.shapeI] || "-",
        b: S.shapeI === "slice" ? "오프셋이 <b>많은</b> 헤드가 페이스를 제때 닫아줍니다."
          : S.shapeI === "hook" ? "오프셋이 <b>적은</b> 헤드가 과하게 감기는 걸 막아줍니다." : "구질 보정은 필요 없습니다." },
      { k: "라이각 근거", v: r.lie,
        b: r.lieConfident ? "<b>볼자국</b>이라는 실측 근거가 있어 방향이 분명합니다." : "볼자국을 못 보셔서 <b>키·팔 길이(정적 기준)</b>로만 봤습니다 — 정확도가 낮습니다." },
      { k: "몸 상태", v: (S.bodyIssue || []).includes("none") || !(S.bodyIssue || []).length ? "특이사항 없음" : "불편한 곳 있음",
        b: (S.bodyIssue || []).some((x) => x === "wrist" || x === "back")
          ? "<b>무게를 낮췄습니다.</b> 무거운 스틸이 방향을 잡아주는 건 몸이 버틸 때 얘기입니다." : "무게 보정 없이 계산했습니다." },
    ]);

    const why = story("그래서 이 조합입니다", [
      `<b>${r.mat} · 약 ${r.target}g</b> — ${r.mat === "스틸" ? "스틸은 무겁지만 <b>스윙마다의 편차가 작습니다.</b> 아이언은 거리를 맞히는 클럽이라 일관성이 최우선입니다." : "그라파이트는 <b>가벼워서 후반까지 스윙이 유지됩니다.</b> 18홀 뒤쪽 여섯 홀에서 무너지면 앞의 열두 홀이 의미가 없습니다."}`,
      `<b>${sp.m} ${sp.sp}</b> — 약 ${sp.w}g로 목표에 가장 가깝고, 킥 ${sp.k}는 ${S.ironTraj === "low" ? "부족한 탄도를 <b>끌어올리는</b>" : S.ironTraj === "high" ? "과한 탄도를 <b>눌러주는</b>" : "지금 탄도를 유지하는"} 성격입니다. 타감은 ${sp.feel} 쪽이라 ${S.ironFeel === "any" || !S.ironFeel ? "무난합니다." : "선호하신 느낌과 맞습니다."}`,
      `<b>${hd.br} ${hd.m}</b> — ${hd.type}, 관용성 ${hd.forg}/5, 오프셋 ${hd.off}. ${S.ironLook === "classic" ? "얇고 깔끔한 걸 원하셔서 <b>취향을 먼저</b> 반영했습니다. 다만 얇을수록 빗맞을 때 손해가 커집니다 — 그건 감수하시는 대가입니다." : S.ironLook === "forgiving" ? "두툼하고 든든한 걸 원하셔서 <b>관용성이 큰 쪽</b>으로 골랐습니다. 어드레스에서 마음이 편한 게 실제로 스윙을 좋게 만듭니다." : `평균 ${gradeTxt()} 구간에서 무리 없는 난이도로 골랐습니다.`}`,
      `<b>라이각 ${r.lie} · 길이 ${r.lenAdj}</b> — ${r.lieWhy.join(". ")}.`,
      r.setAdvice ? `<b>세트 구성</b> — ${r.setAdvice.b}` : null,
      `<b>그립 ${r.grip.model}</b> — ${r.grip.why.join(". ")}.`,
    ]);

    const expect = story("바꾸면 이렇게 달라집니다", [
      S.ironTraj === "low" ? "탄도가 올라가면 <b>공이 그린에 섭니다.</b> 지금은 온그린을 시켜도 굴러 나가고 있을 가능성이 큽니다 — 스코어에 바로 반영되는 변화입니다."
        : S.ironMiss === "thin" ? "관용성이 큰 헤드로 가면 <b>빗맞은 공의 거리 손실</b>이 줄어듭니다. 잘 맞은 공보다 이쪽이 스코어를 만듭니다."
        : "무게와 강도가 맞으면 <b>번호별 거리 간격</b>이 일정해집니다. 7번이 몇 미터인지 믿을 수 있게 되는 게 아이언 피팅의 진짜 목적입니다.",
      r.lieConfident
        ? "라이각을 맞추면 <b>방향이 먼저 좋아집니다.</b> 1° 어긋나면 150m에서 좌우로 몇 미터가 밀립니다 — 스윙이 아니라 클럽이 만든 오차입니다."
        : "<b>다음에 연습장 가시면 페이스에 흰 가루를 얇게 바르고 한 번 쳐보세요.</b> 자국이 어디 남는지 한 장 찍어두시면 라이각을 훨씬 정확히 잡아드릴 수 있습니다.",
      r.setAdvice && r.setAdvice.drop.length
        ? "그리고 <b>안 맞는 긴 아이언을 빼는 것</b>만으로 홀당 반 타는 줄어듭니다. 자신 없는 클럽을 백에 넣어두면 결국 그 클럽을 잡아야 하는 상황이 옵니다."
        : null,
    ], "good");

    const caution = story("다만, 이건 꼭 짚어드립니다", [
      "<b>라이각은 여기서 확정하지 않습니다.</b> 정확한 값은 샵에서 임팩트 테이프를 붙이고 몇 번 쳐봐야 나옵니다. 저희는 방향과 대략의 폭만 말씀드립니다 — 틀릴 수 있는 숫자를 단정해서 알려드리지 않는 게 원칙입니다.",
      r.keepish ? `지금 <b>${S.ironCurModel}</b>에 특별한 불만이 없다고 하셨습니다. 그렇다면 <b>새로 사기 전에 라이각과 길이만 맞춰보세요.</b> 몇만 원이면 되고, 효과는 새 클럽보다 클 수 있습니다.` : null,
      "스펙 수치는 제조사 공표값 기준이지만 개체·번수별 오차가 있습니다. 반드시 시타에서 확인하세요.",
    ], "warn");

    return { read: read, rest: why + expect + caution };
  }

  /* ── 웨지 설명 ───────────────────────────────────────────────── */
  function explainWedge(r) {
    const read = readBlock("골퍼님의 어프로치, 이렇게 읽었습니다", [
      { k: "피칭 로프트", v: `${r.pw}°`,
        b: r.pw <= 43 ? "<b>스트롱 로프트</b>입니다. 요즘 아이언은 거리를 위해 로프트를 세우는데, 그만큼 피칭 아래로 <b>거리 공백</b>이 생깁니다. 이게 웨지 개수를 정하는 출발점입니다."
          : "표준에 가깝습니다. 피칭과 로브 사이를 균등하게 나누면 됩니다." },
      { k: "잔디 치는 방식", v: { dig: "디거 — 깊게 파고듦", sweep: "스위퍼 — 얕게 쓸어침", mid: "중간" }[S.wedgeTurf] || "-",
        b: S.wedgeTurf === "dig" ? "파고드는 스윙에는 <b>바운스가 커야</b> 합니다. 솔이 땅에 박히지 않고 튕겨 나와야 뒤땅이 안 납니다."
          : S.wedgeTurf === "sweep" ? "쓸어 치는 스윙에 바운스가 크면 <b>솔이 먼저 튕겨</b> 토핑이 납니다. 낮은 바운스가 맞습니다."
          : "중간 바운스가 두루 무난합니다." },
      { k: "코스 잔디", v: { soft: "두툼하고 폭신함", mid: "보통", tight: "타이트하고 딱딱함", unknown: "모름" }[S.wedgeGrass] || "-",
        b: S.wedgeGrass === "tight" ? "딱딱한 라이에서 바운스가 크면 <b>리딩에지가 떠서</b> 공 윗부분을 때립니다 — 바운스를 낮췄습니다."
          : S.wedgeGrass === "soft" ? "무른 잔디에서는 헤드가 더 파고들어서 <b>바운스를 더</b> 줘야 합니다." : "표준으로 계산했습니다." },
      { k: "미스 경향", v: { fat: "뒤땅", thin: "토핑", none: "괜찮은 편" }[S.wedgeMiss] || "-",
        b: S.wedgeMiss === "fat" ? "바운스가 <b>실수를 덮어줍니다.</b> 조금 뒤에 맞아도 솔이 미끄러져 공을 건져냅니다." : S.wedgeMiss === "thin" ? "바운스를 낮춰 리딩에지를 지면에 가깝게 둡니다." : "보정 폭을 작게 잡았습니다." },
      { k: "벙커", v: S.wedgeBunker === "no" ? "자신 없음" : "괜찮음",
        b: S.wedgeBunker === "no" ? "벙커는 <b>바운스가 실력을 대신해 줍니다.</b> 모래를 파고들지 않고 미끄러지게 만드는 게 전부라, 가장 로프트가 큰 웨지의 바운스를 더 올렸습니다." : "표준으로 두었습니다." },
    ]);

    const why = story("그래서 이 구성입니다", [
      `<b>${r.specs.map((s) => s.loft + "°").join(" · ")}</b> — ${r.note} 웨지는 <b>거리 공백을 없애는 게 전부</b>입니다. 간격이 8° 벌어지면 그 사이 거리는 스윙 크기로 억지로 맞춰야 하고, 그게 어프로치가 흔들리는 가장 흔한 이유입니다.`,
      `<b>바운스 ${r.specs.map((s) => s.bounce + "°").join(" · ")}</b> — ${r.why.join(". ")}. 바운스는 골퍼가 가장 모르고 지나가는 스펙인데, 어프로치 실수의 상당 부분이 <b>스윙이 아니라 바운스</b> 문제입니다.`,
      `<b>${r.grind}</b> — 솔의 모양입니다. 같은 바운스라도 솔이 넓으면 파고들지 않고, 좁으면 잔디를 얇게 지나갑니다.`,
      `<b>샤프트 — ${r.shaft.t}</b> ${r.shaft.b}`,
      `<b>${r.pick.main.br} ${r.pick.main.m}</b> — ${brandLine(r.pick)}. 웨지는 브랜드별 성능 차이보다 <b>로프트·바운스·그라인드 조합</b>이 훨씬 중요합니다. 그래서 모델은 선호를 그대로 따랐습니다.`,
    ]);

    const expect = story("바꾸면 이렇게 달라집니다", [
      "간격이 맞으면 <b>풀스윙으로 칠 수 있는 거리가 늘어납니다.</b> 어중간한 거리를 손 감각으로 조절하지 않아도 되는 게 어프로치에서 가장 큰 차이입니다.",
      S.wedgeMiss === "fat" ? "바운스가 맞으면 <b>뒤땅이 미스가 아니게 됩니다.</b> 조금 뒤에 맞아도 솔이 미끄러져 공이 나갑니다 — 실수의 폭이 줄어드는 게 아니라 실수가 결과로 안 이어지는 겁니다." : null,
      S.wedgeBunker === "no" ? "벙커는 <b>클럽으로 해결되는 몇 안 되는 영역</b>입니다. 바운스가 충분하면 모래를 얕게 치고 나가는 게 훨씬 쉬워집니다." : null,
    ], "good");

    const caution = story("다만, 이건 꼭 짚어드립니다", [
      "로프트와 간격은 <b>계산으로 정확히 나오지만</b>, 바운스는 코스와 잔디 상태에 따라 체감이 달라집니다. 한 자루를 먼저 바꿔 보고 판단하세요.",
      S.venue === "screen" ? "스크린 위주라고 하셨는데, <b>매트 위에서는 바운스 차이가 거의 안 느껴집니다.</b> 이 추천은 필드 기준입니다." : null,
      "웨지는 소모품입니다. 그루브가 닳으면 스핀이 눈에 띄게 줄어요 — 라운드 수가 많으시면 2~3년 주기로 보시는 게 맞습니다.",
    ], "warn");

    return { read: read, rest: why + expect + caution };
  }

  /* ── 퍼터 설명 ───────────────────────────────────────────────── */
  function explainPutt(r) {
    const p = r.pick.main;
    const read = readBlock("골퍼님의 퍼팅, 이렇게 읽었습니다", [
      { k: "스트로크 궤도", v: { straight: "직선에 가까움", slight: "약간의 아크", arc: "아크가 큰 궤도" }[r.arc],
        b: "퍼터 피팅에서 <b>가장 먼저 정해지는 축</b>입니다. 궤도와 헤드 밸런스가 안 맞으면 스트로크 내내 헤드를 손으로 붙잡고 있어야 합니다." },
      { k: "고민", v: { dist: "거리감", dir: "방향", both: "둘 다", none: "딱히 없음" }[S.puttMiss] || "-",
        b: S.puttMiss === "dir" ? "방향이 문제면 <b>관성(MOI)이 큰 헤드</b>가 답입니다. 살짝 빗맞아도 헤드가 덜 틀어집니다."
          : S.puttMiss === "dist" ? "거리감은 <b>손끝 피드백</b>에서 나옵니다. 헤드 무게와 페이스 재질이 여기에 직접 관여합니다." : "무난합니다." },
      { k: "짧은 퍼트", v: { left: "왼쪽으로 당김", right: "오른쪽으로 밀림", vary: "일정하지 않음", none: "잘 안 놓침" }[S.puttShort] || "-",
        b: S.puttShort === "left" ? "당기는 건 <b>조준이 이미 왼쪽</b>이거나 라이각이 업라이트할 때 나옵니다 — 스윙 탓만 하기 전에 클럽부터 보세요."
          : S.puttShort === "right" ? "미는 건 라이각이 <b>플랫해서 힐이 들렸을</b> 때 흔합니다." : "" },
      { k: "그린 빠르기", v: { slow: "느린 편", mid: "보통", fast: "빠른 편", unknown: "모름" }[S.greenSpeed] || "-",
        b: S.greenSpeed === "slow" ? "<b>이게 한국에서 특히 중요합니다.</b> 미국식 추천은 빠른 그린을 전제로 하는데, 느린 그린에 가벼운 헤드를 쓰면 계속 짧게 남습니다."
          : S.greenSpeed === "fast" ? "빠른 그린에서 무거운 헤드는 계속 지나칩니다." : "표준으로 잡았습니다." },
      S.puttEye && S.puttEye !== "unknown" ? { k: "눈 위치",
        v: { on: "공 바로 위", inside: "공보다 안쪽", outside: "공보다 바깥쪽" }[S.puttEye],
        b: S.puttEye === "inside" ? "안쪽에 떨어지면 <b>퍼터가 길다</b>는 뜻입니다. 손이 몸에서 떨어지면 궤도가 스스로 흔들립니다." : S.puttEye === "on" ? "가장 이상적인 자리입니다." : "너무 멀리 서 계십니다." } : null,
      { k: "손 위치", v: { forward: "공보다 앞", level: "공과 나란히", back: "공보다 뒤", unknown: "모름" }[S.puttHands] || "-",
        b: S.puttHands === "forward" ? "손이 앞에 있으면 임팩트에서 <b>로프트가 죽습니다.</b> 공이 잠깐 눌렸다 튀어서 초반 구름이 불안정해집니다 — 정적 로프트가 더 필요한 이유입니다." : "" },
    ]);

    const why = story("그래서 이 조합입니다", [
      `<b>${p.br} ${p.m} — ${p.shape} · ${p.bal}</b> ${r.note}`,
      `<b>길이 ${r.len}″</b> — ${r.lenWhy.join(". ")}. 퍼터 길이는 <b>가장 저평가된 스펙</b>입니다. 길면 손이 몸에서 떨어지고, 그러면 팔로 궤도를 만들게 되어 매번 달라집니다.`,
      `<b>헤드 무게 — ${r.hw.t}</b> ${r.hw.b}`,
      `<b>로프트 ${r.loft.t}</b> — ${r.loft.b}`,
      `<b>${r.face}</b> — 페이스 재질은 소리와 손 감각을 바꾸고, 그게 그대로 <b>거리감</b>이 됩니다. 퍼팅에서 감각은 취향이 아니라 성능입니다.`,
      `<b>그립 — ${r.grip.m}</b> (${r.grip.spec}) ${r.grip.why}.`,
      S.puttLine === "line" ? "정렬선이 있는 쪽으로 골랐습니다 — 조준을 눈이 아니라 <b>선에 맡기는</b> 방식이 잘 맞으십니다." : S.puttLine === "none" ? "정렬선이 없는 깔끔한 상판으로 골랐습니다. 선이 오히려 신경 쓰이는 분들이 실제로 많습니다." : null,
    ]);

    const expect = story("바꾸면 이렇게 달라집니다", [
      r.curLen && r.curLen - r.len >= 1
        ? `<b>길이만 줄여도 달라집니다.</b> 지금 ${r.curLen}″에서 ${r.len}″로 자르는 건 몇만 원이면 되고, 눈이 공 위로 오면 조준이 먼저 정확해집니다. 새 퍼터를 사기 전에 이것부터 해보세요.`
        : "궤도와 밸런스가 맞으면 <b>헤드를 붙잡지 않아도 됩니다.</b> 손을 덜 쓰게 되는 게 퍼팅에서 가장 큰 변화입니다.",
      S.greenSpeed === "slow" ? "느린 그린에 맞는 무게로 가면 <b>짧게 남기는 퍼트</b>가 확 줄어듭니다. 홀에 못 미치는 퍼트는 절대 안 들어갑니다." : null,
      S.puttYips === "yes" ? "손이 굳는 증상은 <b>그립으로 상당 부분 눌러집니다.</b> 오버사이즈는 손목의 미세한 개입을 물리적으로 줄여줍니다 — 의지로 참는 것보다 훨씬 확실합니다." : null,
    ], "good");

    const caution = story("다만, 이건 꼭 짚어드립니다", [
      "<b>퍼터는 감각의 비중이 가장 큰 클럽입니다.</b> 계산으로 맞아도 눈에 안 편하면 안 들어갑니다. 이 결과는 <b>매장에서 무엇을 집어볼지</b> 좁혀드리는 용도로 쓰세요.",
      "라이각은 셋업에서 솔이 지면과 평행한지로 확인하세요. 토우나 힐이 들리면 그만큼 시작 방향이 틀어집니다.",
      S.puttStroke === "unknown" ? "궤도를 모르겠다고 하셔서 <b>약간의 아크</b>로 가정했습니다. 매장에서 몇 번 굴려보고 페이스가 열렸다 닫히는 느낌이 크면 토우행 쪽으로 다시 보세요." : null,
    ], "warn");

    return { read: read, rest: why + expect + caution };
  }

  /* 결과 화면 공통 조각 */
  function noteHtml(notes) {
    return (notes || []).map((n) => `<div class="warn-card"><b>${n.h}</b> — ${n.b}</div>`).join("");
  }
  function tipHtml(tips) {
    if (!tips || !tips.length) return "";
    return `<div class="section-h">이것부터 해보세요</div>` +
      tips.map((t) => `<div class="tip-line">· ${t}</div>`).join("");
  }
  /* 그립 결과 — 드라이버·아이언·웨지가 같은 모양으로 쓴다 */
  function gripHtml(g) {
    return `<div class="section-h">그립 <span class="cnt">${g.size}</span></div>` +
      resCard("그립", g.model, g.spec, g.why.slice(0, 4)) +
      (g.measure ? `<div class="inline-note"><b>손 길이를 재보시면 정확해집니다</b> —
        가운뎃손가락 끝에서 손목 주름까지 재서 다시 답해 주세요.
        장갑 호수는 브랜드마다 기준이 달라 범위로만 잡았습니다.</div>` : "");
  }
  const saveRow = (what) => `
      <div class="btn-row" style="margin-top:16px">
        <button class="cf-btn accent" data-savebag="${what}">내 백에 저장 — AI 캐디가 씁니다</button>
      </div>
      <div id="cf-bag-saved" class="inline-note" style="display:none"><b>저장 완료</b> — 이제 홀별 공략에서 이 클럽 기준으로 조언합니다.</div>
      <div class="btn-row"><button class="cf-btn" data-jump="pick">다른 클럽도 맞춰보기 →</button></div>
      <div class="restart-row"><button class="cf-btn ghost" data-restart>처음부터 다시</button></div>`;

  /* ───────── 결과 렌더 (드라이버) ───────── */
  function renderResult() {
    const r = engine(), ex = explainDriver(r);
    const brandTxt = (S.brand && S.brand !== "any") ? S.brand : "전체 브랜드";
    const verdict = r.keep
      ? `<div class="verdict"><span class="v-stamp keep">그대로 유지</span>
          <div class="v-label">피팅 판정</div>
          <div class="v-main">지금 클럽, 그대로 쓰세요</div>
          <div class="v-sub">현재 ${r.cur.label}(${r.cur.w}g·${r.cur.fx})가 계산 밴드(${r.wLo}~${r.wHi}g · ${r.fxT.join("/")}) 안이고 로프트도 맞습니다.<br><b>바꿔도 2타 못 법니다.</b> 그 예산은 레슨이나 그린피가 낫습니다.</div>
        </div>`
      : `<div class="verdict"><span class="v-stamp">교체 검토</span>
          <div class="v-label">피팅 판정</div>
          <div class="v-main">맞춰볼 여지가 있습니다</div>
          <div class="v-sub">캐리 ${S.carry7}m → 약 ${r.mph}mph 추정 → 기준 <b>${r.wLo}~${r.wHi}g · ${r.fxT.join("/")}</b></div>
        </div>`;

    const sp = r.shaftPick, hp = r.headPick;
    const shaftHtml =
      resCard("샤프트 1순위", `${sp.main.m} ${sp.main.sp}`, shaftSpec(sp.main), sp.main.why, false, sp.main) +
      (sp.alt ? altLead("샤프트") + resCard(`${sp.alt.b}`, `${sp.alt.m} ${sp.alt.sp}`,
        shaftSpec(sp.alt), sp.alt.why, true, sp.alt) : "") +
      olderCard("샤프트", sp.older, sp.older ? shaftSpec(sp.older) : "", sp.olderBetter);
    const headSpec = (h) => `관용성 ${h.forg}/5 · 스핀 ${h.spin} · ${h.draw ? "드로 바이어스" : "뉴트럴"}`;
    const headHtml =
      resCard("헤드 1순위", `${hp.main.br} ${hp.main.m}`, headSpec(hp.main),
        hp.main.why.length ? hp.main.why : ["선호 브랜드 안에서 최적"], false, hp.main) +
      (hp.alt ? altLead("헤드") + resCard(`${hp.alt.br}`, `${hp.alt.br} ${hp.alt.m}`,
        headSpec(hp.alt), hp.alt.why.length ? hp.alt.why : ["다른 브랜드 중 최고점"], true, hp.alt) : "") +
      olderCard("헤드", hp.older, hp.older ? headSpec(hp.older) : "", hp.olderBetter);

    return `
      <div class="q-eyebrow">드라이버 판정 · ${brandTxt} 우선</div>
      ${verdict}${noteHtml(r.notes)}
      ${ex.read}
      <div class="section-h">로프트 <span class="cnt">거리에 가장 큰 변수</span></div>
      ${resCard("로프트", `${r.lf.loft}°`, "호젤 조정으로 ±1~2° 움직일 수 있습니다", r.lf.why)}
      <div class="section-h">길이</div>
      ${resCard("길이", r.ln.len, "표준 45.75″ 기준", [r.ln.why])}
      <div class="section-h">샤프트 <span class="cnt">${brandLine(sp)}</span></div>
      ${shaftHtml}
      <div class="section-h">헤드 <span class="cnt">${brandLine(hp)}</span></div>
      ${headHtml}
      ${gripHtml(r.grip)}
      ${ex.rest}
      ${tipHtml(r.tips)}
      ${saveRow("driver")}
      <div class="cf-foot">※ 스펙 수치는 초기 데이터 — 시타 없이 구매하지 마세요. 추천은 판매와 무관합니다.</div>`;
  }

  /* ───────── 결과 렌더 (아이언) ───────── */
  function renderIron() {
    const r = ironEngine(), ex = explainIron(r);
    const sp = r.shaftPick, hp = r.headPick;
    const headSpec = (h) => `${h.type} · 관용성 ${h.forg}/5 · 오프셋 ${h.off}`;
    return `
      <div class="q-eyebrow">아이언 판정</div>
      <div class="verdict"><span class="v-stamp${r.keepish ? " keep" : ""}">${r.keepish ? "먼저 조정" : "맞춤 완료"}</span>
        <div class="v-label">아이언</div>
        <div class="v-main">${r.mat} · 약 ${r.target}g · ${r.fxT.join("/")}</div>
        <div class="v-sub">7번 캐리 ${S.carry7}m와 체력·몸 상태를 함께 반영한 목표 스펙입니다.</div>
      </div>
      ${noteHtml(r.notes)}
      ${ex.read}
      <div class="section-h">샤프트 <span class="cnt">${brandLine(sp)}</span></div>
      ${resCard("샤프트 1순위", `${sp.main.m} ${sp.main.sp}`,
        `${sp.main.b} · ${sp.main.mat} · 약 ${sp.main.w}g · ${sp.main.fx} · 킥 ${sp.main.k} · ${sp.main.feel}`, sp.main.why, false, sp.main)}
      ${sp.alt ? altLead("샤프트") + resCard(sp.alt.b, `${sp.alt.m} ${sp.alt.sp}`,
        `${sp.alt.mat} · 약 ${sp.alt.w}g · ${sp.alt.fx}`, sp.alt.why, true, sp.alt) : ""}
      ${olderCard("샤프트", sp.older, sp.older ? `${sp.older.mat} · 약 ${sp.older.w}g · ${sp.older.fx}` : "", sp.olderBetter)}
      <div class="section-h">헤드 <span class="cnt">${brandLine(hp)}</span></div>
      ${resCard("헤드 1순위", `${hp.main.br} ${hp.main.m}`, headSpec(hp.main),
        hp.main.why.length ? hp.main.why : ["선호 브랜드 안에서 최적"], false, hp.main)}
      ${hp.alt ? altLead("헤드") + resCard(hp.alt.br, `${hp.alt.br} ${hp.alt.m}`,
        headSpec(hp.alt), hp.alt.why, true, hp.alt) : ""}
      ${olderCard("헤드", hp.older, hp.older ? headSpec(hp.older) : "", hp.olderBetter)}
      <div class="section-h">라이각 · 길이 <span class="cnt">${r.lieConfident ? "볼자국 근거 있음" : "정적 기준만"}</span></div>
      ${resCard("라이각", r.lie, `길이 ${r.lenAdj}`, r.lieWhy)}
      <div class="warn-card"><b>라이각은 여기서 확정하지 않습니다</b> —
        ${r.lieConfident
          ? "볼자국까지 보고 <b>방향과 대략의 폭</b>을 잡은 것입니다."
          : "볼자국을 확인 못 하셔서 <b>정적 기준(키·팔 길이)</b>으로만 봤습니다."}
        정확한 값은 <b>샵에서 임팩트 테이프를 붙이고 몇 번 쳐봐야</b> 나옵니다.
        틀릴 수 있는 숫자를 단정해서 알려드리지 않습니다.</div>
      ${r.setAdvice ? `<div class="section-h">세트 구성</div><div class="warn-card">${r.setAdvice.b}</div>` : ""}
      ${gripHtml(r.grip)}
      ${ex.rest}
      ${tipHtml(r.tips)}
      ${saveRow("iron")}
      <div class="cf-foot">※ 스펙 수치는 초기 데이터 — 시타 없이 구매하지 마세요.</div>`;
  }

  /* ───────── 결과 렌더 (웨지) ───────── */
  function renderWedge() {
    const r = wedgeEngine(), ex = explainWedge(r);
    const p = r.pick;
    return `
      <div class="q-eyebrow">웨지 판정</div>
      <div class="verdict"><span class="v-stamp">맞춤 완료</span>
        <div class="v-label">웨지 구성</div>
        <div class="v-main">${r.specs.map((s) => s.loft + "°").join(" · ")}</div>
        <div class="v-sub">${r.note}</div>
      </div>
      ${ex.read}
      <div class="section-h">클럽별 스펙</div>
      ${r.specs.map((s) => resCard(`${s.loft}°`, `로프트 ${s.loft}° · 바운스 ${s.bounce}°`,
        `${r.grind} · ${s.use}`, [])).join("")}
      <div class="section-h">바운스를 이렇게 정했어요</div>
      ${r.why.map((w) => `<div class="tip-line">· ${w}</div>`).join("")}
      <div class="section-h">샤프트</div>
      ${resCard("샤프트", r.shaft.t, "", [r.shaft.b])}
      <div class="section-h">모델 <span class="cnt">${brandLine(p)}</span></div>
      ${resCard("웨지 1순위", `${p.main.br} ${p.main.m}`, "", ["선호·조건에 맞는 라인업"], false, p.main)}
      ${p.alt ? altLead("웨지") + resCard(p.alt.br, `${p.alt.br} ${p.alt.m}`, "", [], true, p.alt) : ""}
      ${olderCard("웨지", p.older, "", p.olderBetter)}
      ${gripHtml(r.grip)}
      ${ex.rest}
      ${saveRow("wedge")}
      <div class="cf-foot">※ 로프트·바운스는 계산으로 나오지만, 잔디 상태는 코스마다 다릅니다.</div>`;
  }

  /* ───────── 결과 렌더 (퍼터) ───────── */
  function renderPutt() {
    const r = putterEngine(), ex = explainPutt(r);
    const p = r.pick;
    const pSpec = (x) => `${x.shape} · ${x.bal}`;
    return `
      <div class="q-eyebrow">퍼터 판정</div>
      <div class="verdict"><span class="v-stamp">맞춤 완료</span>
        <div class="v-label">퍼터</div>
        <div class="v-main">${p.main.shape} · ${p.main.bal} · ${r.len}″</div>
        <div class="v-sub">${r.note}</div>
      </div>
      ${noteHtml(r.notes)}
      ${ex.read}
      <div class="section-h">모델 <span class="cnt">${brandLine(p)}</span></div>
      ${resCard("퍼터 1순위", `${p.main.br} ${p.main.m}`, pSpec(p.main), p.main.why, false, p.main)}
      ${p.alt ? altLead("퍼터") + resCard(p.alt.br, `${p.alt.br} ${p.alt.m}`, pSpec(p.alt), p.alt.why, true, p.alt) : ""}
      ${olderCard("퍼터", p.older, p.older ? pSpec(p.older) : "", p.olderBetter)}
      <div class="section-h">길이</div>
      ${resCard("길이", `${r.len}″`, r.curLen ? `지금 ${r.curLen}″` : "", r.lenWhy)}
      <div class="section-h">헤드 무게 <span class="cnt">그린 빠르기 기준</span></div>
      ${resCard("헤드 무게", r.hw.t, "", [r.hw.b])}
      <div class="section-h">로프트</div>
      ${resCard("로프트", r.loft.t, "", [r.loft.b])}
      <div class="section-h">페이스 · 그립</div>
      ${resCard("페이스", r.face, "", [])}
      ${resCard("그립", r.grip.m, r.grip.spec, [r.grip.why])}
      <div class="section-h">라이각</div>
      <div class="tip-line">· ${r.lie}</div>
      ${ex.rest}
      ${tipHtml(r.tips)}
      ${saveRow("putter")}
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
    // 진행 표시는 내부 단계 이름이 아니라 "지금 무슨 일이 일어나는지"를 말한다.
    const eye = (scrEl().querySelector(".q-eyebrow") || {}).textContent || "";
    stage.textContent = NARRATION[eye.trim()] || STAGE_LABEL[sc.group] || "피팅 중";
    // 문항 번호는 클럽 전체에서 몇 번째인지로 센다 (블록마다 1부터 다시 세면 끝이 안 보인다)
    let t = 0;
    if (RESULT_KEYS.includes(sc.key)) { step.textContent = "홀인!"; t = 1; }
    else if (sc.q) {
      const n = SCREENS.slice(0, idx + 1).filter((s) => s.q).length;
      step.textContent = `${n} / ${TOTAL_Q}`;
      t = TOTAL_Q ? n / TOTAL_Q : 0;
    } else { step.textContent = ""; t = 0; }
    // 골퍼 실루엣도 고른 클럽에 맞춰 바뀐다
    // ⚠️ #cf-golfer 는 SVG(foreignObject)라 className 에 대입하면 던진다 — setAttribute 로만 바꾼다
    const fig = $$("#cf-golfer");
    if (fig) fig.setAttribute("class", "cf-golfer" + (S.club ? " club-" + S.club : ""));
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

    arc.style.strokeDasharray = len + " " + len;
    arc.style.strokeDashoffset = len * (1 - t);

    const p = arc.getPointAtLength(len * t);
    ball.setAttribute("cx", p.x);
    ball.setAttribute("cy", p.y);

    if (t > 0 && lastT === 0 && golfer) {
      golfer.classList.remove("swing"); void golfer.getBoundingClientRect();
      golfer.classList.add("swing");
    }
    ball.classList.toggle("holed", t >= 1);
    if (flag) flag.classList.toggle("cheer", t >= 1);
    lastT = t;
  }
  function canPassScore() { return S.scoreConfirm === "ok" || (S.scoreConfirm === "diff" && S.scoreGrp); }

  /* 화면을 떠날 때 그 화면에서 받은 값을 확정한다.
     (슬라이더는 "안 만졌으면 기본값"이라 건너뛴 것과 구분해야 한다) */
  function commitScreen() {
    const sc = SCREENS[idx];
    if (!sc) return;
    if (sc.key === "body") S.wristFloor = S.wristSkip === "skip" ? null : S.wristFloorV;
    if (sc.key === "glove") S.handLen = (S.handSkip === "skip" || S.gloveSize === "unknown" && !S.handSkip) ? (S.handSkip === "skip" ? null : S.handLen) : S.handLenV;
    if (sc.key === "glove" && S.handSkip === "skip") S.handLen = null;
    // 공통 블록 마지막 문항을 넘기면 프로필로 저장한다
    if (sc.key === "venue") saveFitProfile();
  }
  function advance() { commitScreen(); go(idx + 1); }

  function startClub(club, redoProfile) {
    S.club = club;
    if (!redoProfile) applyFitProfile();
    buildScreens(club, redoProfile);
    if (typeof STATS !== "undefined") STATS.hit("feature", "clubfit_start_" + club);
    go(1);
  }

  function bindEvents() {
    const el = $$("#clubfit-view");
    if (!el || el._cfBound) return;
    el._cfBound = true;
    el.addEventListener("click", (e) => {
      const t = e.target;
      // 클럽 선택 타일
      const tile = t.closest("[data-club]");
      if (tile) return startClub(tile.dataset.club, false);
      if (t.closest("[data-useprofile]")) return advance();
      if (t.closest("[data-redoprofile]")) { buildScreens(S.club, true); return go(1); }
      if (t.closest("[data-back]")) return go(idx - 1);
      if (t.closest("[data-next]")) return advance();
      if (t.closest("[data-skip]")) return advance();
      if (t.closest("[data-restart]")) { S.club = null; SCREENS = [PICK]; return go(0); }
      if (t.closest("[data-jump]")) {
        const k = t.closest("[data-jump]").dataset.jump;
        if (k === "pick") { S.club = null; SCREENS = [PICK]; return go(0); }
        const i = SCREENS.findIndex((s) => s.key === k);
        return i >= 0 ? go(i) : null;
      }
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
        if (!key) return;
        // 복수 선택 — "해당 없음"은 다른 항목과 같이 고를 수 없다
        if (box.dataset.multi === "1") {
          let cur = (S[key] || []).slice();
          const v = chip.dataset.v;
          if (v === "none") cur = cur.includes("none") ? [] : ["none"];
          else {
            cur = cur.filter((x) => x !== "none");
            cur = cur.includes(v) ? cur.filter((x) => x !== v) : cur.concat([v]);
          }
          S[key] = cur;
          box.querySelectorAll(".chip").forEach((c) =>
            c.setAttribute("aria-pressed", cur.includes(c.dataset.v) ? "true" : "false"));
          return;
        }
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
        // 구질 2단 문항 — 고르는 즉시 무엇으로 읽었는지 보여준다
        if (key === "startDir" || key === "curveDir") {
          const nb = el.querySelector("[data-next]"); if (nb) nb.disabled = !(S.startDir && S.curveDir);
          const box2 = $$("#cf-flightnote");
          if (box2 && S.startDir && S.curveDir) {
            const f = flightRead();
            box2.innerHTML = `<div class="inline-note"><b>${f.n}</b>으로 읽었습니다 —
              스윙 궤도는 <b>${f.path}</b>, 페이스는 궤도에 대해 <b>${f.face}</b>.</div>`;
          }
          return;
        }
        // 두 개를 다 골라야 넘어가는 화면들
        const PAIRS = {
          brand: ["brand", "shaftBrand"], shaftBrand: ["brand", "shaftBrand"],
          ironBrand: ["ironBrand", "ironShaftBrand"], ironShaftBrand: ["ironBrand", "ironShaftBrand"],
          curLoft: ["curLoft", "curShaft"], curShaft: ["curLoft", "curShaft"],
          gripDown: ["gripDown", "carryVar"], carryVar: ["gripDown", "carryVar"],
          ironLongest: ["ironLongest", "ironLongOk"], ironLongOk: ["ironLongest", "ironLongOk"],
          wedgeCount: ["wedgeCount", "wedgeBunker"], wedgeBunker: ["wedgeCount", "wedgeBunker"],
          puttCurLen: ["puttCurLen", "puttLong"], puttLong: ["puttCurLen", "puttLong"],
          puttGrip: ["puttGrip", "puttYips"], puttYips: ["puttGrip", "puttYips"],
          gripPress: ["gripPress", "gripFeel"], gripFeel: ["gripPress", "gripFeel"],
        };
        if (PAIRS[key]) {
          const nb = el.querySelector("[data-next]");
          if (nb) nb.disabled = !PAIRS[key].every((k) => S[k]);
          return;
        }
        if (key === "gloveSize" || key === "wedgeBrand" || key === "putterBrand") {
          const nb = el.querySelector("[data-next]"); if (nb) nb.disabled = false;
          return;
        }
        if (key === "wristSkip" || key === "handSkip") return;   // 안내용 토글
        if (box.dataset.auto === "1") setTimeout(advance, 220);
      }
    });
    el.addEventListener("input", (e) => {
      const sl = e.target.closest("[data-slider]");
      if (sl) {
        const key = sl.dataset.slider;
        S[key] = Number(sl.value);
        const v = $$("#cfv_" + key); if (v) v.textContent = S[key];
        // 손목-바닥·손 길이 슬라이더를 만졌으면 "재봤다"는 뜻
        if (key === "wristFloorV") S.wristSkip = null;
        if (key === "handLenV") S.handSkip = null;
        if (key === "carryD" || key === "carry7") {
          const box = $$("#cf-rationote");
          if (box) {
            const r = S.carryD / S.carry7;
            box.innerHTML = r > 1.68 ? `<div class="inline-note"><b>흠, 잠깐요</b> — 7번 ${S.carry7}m에 드라이버 ${S.carryD}m(×${r.toFixed(2)})는 드문 조합입니다. 정타 기준으로 다시 한번?</div>`
              : (r < 1.50 && S.carryD > 0) ? `<div class="inline-note"><b>정타율 신호</b> — 7번 대비 드라이버가 짧네요. 스피드보다 가운데 맞히는 게 먼저입니다.</div>` : "";
          }
        }
        return;
      }
      const tx = e.target.closest("[data-text]");
      if (tx) S[tx.dataset.text] = tx.value;
    });
  }

  /* ───────── 진입점 ───────── */
  window.openClubfitView = function () {
    computeAuto();
    bindEvents();
    if (typeof pushView === "function") pushView("clubfit");
    S.club = null;
    SCREENS = [PICK];
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
      out = { mat: r.mat, target: r.target, fx: r.fxT.join("/"), lie: r.lie, len: r.lenAdj,
        set: r.setAdvice ? r.setAdvice.drop.join(",") || "유지" : null,
        shaft1: `${r.shaftPick.main.m} ${r.shaftPick.main.sp}`,
        shaftAlt: r.shaftPick.alt ? `${r.shaftPick.alt.b} ${r.shaftPick.alt.m}` : null,
        head: `${r.headPick.main.br} ${r.headPick.main.m}`,
        headAlt: r.headPick.alt ? `${r.headPick.alt.br} ${r.headPick.alt.m}` : null,
        grip: r.grip.model + " / " + r.grip.size };
    } else if (which === "wedge") {
      const r = wedgeEngine();
      out = { cnt: r.cnt, lofts: r.specs.map((s) => s.loft), bounces: r.specs.map((s) => s.bounce),
        shaft: r.shaft.t, model: `${r.pick.main.br} ${r.pick.main.m}` };
    } else if (which === "putter") {
      const r = putterEngine();
      out = { shape: r.pick.main.shape, bal: r.pick.main.bal, len: r.len,
        headWeight: r.hw.t, loft: r.loft.t, face: r.face, grip: r.grip.m,
        model: `${r.pick.main.br} ${r.pick.main.m}`,
        alt: r.pick.alt ? `${r.pick.alt.br} ${r.pick.alt.m}` : null };
    } else if (which === "grip") {
      out = gripEngine();
    } else {
      const r = engine();
      out = { keep: r.keep, band: `${r.wLo}~${r.wHi}g ${r.fxT.join("/")}`,
        flight: r.fl.n, path: r.fl.path, face: r.fl.face,
        loft: r.lf.loft, length: r.ln.len,
        shaft1: `${r.shaftPick.main.m} ${r.shaftPick.main.sp}`,
        shaftBrand1: r.shaftPick.main.b,
        shaftAlt: r.shaftPick.alt ? `${r.shaftPick.alt.b} ${r.shaftPick.alt.m}` : null,
        head: `${r.headPick.main.br} ${r.headPick.main.m}`,
        headAlt: r.headPick.alt ? `${r.headPick.alt.br} ${r.headPick.alt.m}` : null,
        grip: r.grip.model + " / " + r.grip.size,
        priceShaft: r.shaftPick.main.pr, priceHead: r.headPick.main.pr,
        olderShaft: r.shaftPick.older ? r.shaftPick.older.m : null,
        olderHead: r.headPick.older ? r.headPick.older.m : null,
        notes: r.notes.map((n) => n.h) };
    }
    Object.assign(S, JSON.parse(bak));
    return out;
  };

  /* 검수용: 지금 화면 목록을 그대로 보고한다 (문항이 빠지지 않았는지 확인) */
  window.__cfScreens = function (club, redo) {
    S.club = club || "driver";
    buildScreens(S.club, !!redo);
    return { club: S.club, total: TOTAL_Q, reused: !redo && profileReady(),
      keys: SCREENS.map((s) => s.key + (s.q ? "" : "*")) };
  };
})();
