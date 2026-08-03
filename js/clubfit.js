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
    unknown: { label: tr("cf.curshaft.unknown"), w: null, fx: null },
    stock: { label: tr("cf.curshaft.stock"), w: 50, fx: "SR" },
    s50s: { label: tr("cf.curshaft.s50s"), w: 55, fx: "S" },
    s50x: { label: tr("cf.curshaft.s50x"), w: 55, fx: "X" },
    s60s: { label: tr("cf.curshaft.s60s"), w: 65, fx: "S" },
    s60x: { label: tr("cf.curshaft.s60x"), w: 65, fx: "X" },
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
  /* ───────── 볼 ─────────
     사장님 지시 5 (2026-07-30): 클럽 14개는 골라 쓰지만 **볼은 모든 샷에 쓰는 유일한 장비**다.
     PGA 선수들이 장비 중 볼을 가장 신중히 고르는 이유고, 아마추어도 다르지 않다.
     그리고 볼은 **가장 싸게 결과가 바뀌는 피팅**이다.
     ⚠️ 컴프레션 수치는 제조사가 공표하지 않는다 → **숫자를 적지 않고 성향으로만** 쓴다(절대 원칙 2).
        피스 수·커버 소재는 공표값이라 그대로 적는다.
     cover 우레탄/아이오노머 · feel 소프트/미드/펌 · spinShort 숏게임 스핀 · spinSide 사이드스핀 억제 */
  const BALLS = [
    { br: "타이틀리스트", m: "프로V1", st: "cur", pr: 3, pieces: 3, cover: "우레탄",
      feel: "미드", spinShort: "높음", spinSide: "중", color: false },
    { br: "타이틀리스트", m: "프로V1x", st: "cur", pr: 3, pieces: 4, cover: "우레탄",
      feel: "펌", spinShort: "높음", spinSide: "중", color: false },
    { br: "타이틀리스트", m: "AVX", st: "cur", pr: 3, pieces: 3, cover: "우레탄",
      feel: "소프트", spinShort: "중", spinSide: "낮음", color: false },
    { br: "타이틀리스트", m: "투어스피드", st: "cur", pr: 2, pieces: 3, cover: "우레탄",
      feel: "미드", spinShort: "중", spinSide: "중", color: false },
    { br: "테일러메이드", m: "TP5", st: "cur", pr: 3, pieces: 5, cover: "우레탄",
      feel: "소프트", spinShort: "높음", spinSide: "중", color: false },
    { br: "테일러메이드", m: "투어리스폰스", st: "cur", pr: 2, pieces: 3, cover: "우레탄",
      feel: "소프트", spinShort: "중", spinSide: "낮음", color: false },
    { br: "캘러웨이", m: "크롬소프트", st: "cur", pr: 3, pieces: 4, cover: "우레탄",
      feel: "소프트", spinShort: "높음", spinSide: "낮음", color: false },
    { br: "캘러웨이", m: "ERC 소프트", st: "cur", pr: 2, pieces: 3, cover: "아이오노머",
      feel: "소프트", spinShort: "중", spinSide: "낮음", color: true },
    { br: "캘러웨이", m: "슈퍼소프트", st: "cur", pr: 1, pieces: 2, cover: "아이오노머",
      feel: "소프트", spinShort: "낮음", spinSide: "낮음", color: true },
    { br: "타이틀리스트", m: "벨로시티", st: "cur", pr: 1, pieces: 2, cover: "아이오노머",
      feel: "펌", spinShort: "낮음", spinSide: "낮음", color: true },
    { br: "브리지스톤", m: "e6", st: "cur", pr: 1, pieces: 2, cover: "아이오노머",
      feel: "소프트", spinShort: "낮음", spinSide: "낮음", color: false },
    { br: "스릭슨", m: "AD333", st: "cur", pr: 1, pieces: 2, cover: "아이오노머",
      feel: "소프트", spinShort: "낮음", spinSide: "낮음", color: false },
    { br: "볼빅", m: "비비드", st: "cur", pr: 1, pieces: 3, cover: "아이오노머",
      feel: "소프트", spinShort: "낮음", spinSide: "낮음", color: true },
  ];

  /* 퍼터 그립 — 손을 얼마나 쓰게 할지로 갈린다 */
  const PUTTER_GRIPS = [
    { m: tr("cf.pg.pistol"), spec: tr("cf.pg.pistol.spec"), why: tr("cf.pg.pistol.why") },
    { m: tr("cf.pg.mid"), spec: tr("cf.pg.mid.spec"), why: tr("cf.pg.mid.why") },
    { m: tr("cf.pg.over"), spec: tr("cf.pg.over.spec"), why: tr("cf.pg.over.why") },
  ];

  /* ───────── 제조사 실측 스펙 덮어쓰기 ─────────
     js/clubdb.js (tools/build_clubdb.py 산출물)가 로드돼 있으면 그 값을 쓴다.
     · 제조사 공식 페이지에서만 받은 값이고, 못 읽은 항목은 채우지 않고 비워 뒀다.
     · 헤드·그립은 엔진이 쓰는 기준(관용성·타감 등)이 계측값이 아니라 어느 제조사도
       공개하지 않는다 → 실측으로 바꾸지 못하고 데모를 유지한다.
     · clubdb.js 를 못 불러와도 앱은 데모 데이터로 그대로 동작한다(끊기지 않음). */
  let SHAFTS_ACTIVE = SHAFTS, IRON_SHAFTS_ACTIVE = IRON_SHAFTS;
  let WEDGES_ACTIVE = WEDGES, PUTTERS_ACTIVE = PUTTERS;
  (function useRealSpecs() {
    const DB = (typeof globalThis !== "undefined" && globalThis.CLUBDB) || null;
    if (!DB) return;
    const pick = (arr, fallback) => (Array.isArray(arr) && arr.length ? arr : fallback);
    SHAFTS_ACTIVE = pick(DB.SHAFTS, SHAFTS);
    IRON_SHAFTS_ACTIVE = pick(DB.IRON_SHAFTS, IRON_SHAFTS);
    WEDGES_ACTIVE = pick(DB.WEDGES, WEDGES);
    PUTTERS_ACTIVE = pick(DB.PUTTERS, PUTTERS);
  })();

  /* ───────── 상태 ───────── */
  /* 공통 프로필(P*)은 클럽을 바꿔도 다시 묻지 않는다 — localStorage 에 저장 */
  const S = {
    club: null,                                              // driver | iron | wedge | putter
    auto: { age: null, sex: null, avg: null, fade: null },   // 실데이터에서 채움
    /* ── 공통 프로필 ── */
    career: null, scoreConfirm: null, scoreGrp: "90", carry7: 150,
    /* 7번 캐리는 슬라이더 값(carry7V)과 계산에 쓰는 값(carry7)을 나눠 둔다.
       "모르겠어요"면 추정하고, 스크린 토탈이면 런을 빼서 캐리로 환산하기 때문이다.
       나눠 두지 않으면 뒤로 갔다 오는 것만으로 6m씩 계속 깎인다.
       carry7Est 는 그 값이 그대로 받은 숫자가 아님을 화면에 밝히는 표시다(절대 원칙 2). */
    carry7V: 150, carry7Est: null, carry7Unknown: null, carry7Src: null, carry7Kind: null,
    heightV: 172, wristFloor: null, gloveSize: null, handLen: null,
    wristFloorV: 85, handLenV: 19, wristSkip: null, handSkip: null,
    endur: null, bodyIssue: [], venue: null, tempo: null,
    /* ── 그립 ── */
    gripCond: [], gripPress: null, gripFeel: null,
    /* ── 드라이버 ── */
    carryD: 220, startDir: null, curveDir: null, flight: null,
    faceV: null, faceH: null, teeHt: null, complaint: null,
    curLoft: null, curShaft: null, curLen: null, gripDown: null, carryVar: null,
    budget: null, brand: null, shaftBrand: null,   /* ball 은 아래 볼 블록에 한 번만 둔다 */
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
    /* ── 볼 ── (드라이버 D10 과 `ball` 필드를 공유한다 — 한쪽을 하면 다른 쪽은 묻지 않는다) */
    ball: null, ballLost: null, ballShort: null, ballShape: null,
    ballFeel: null, ballCold: null, ballFind: null,
    /* 구버전 호환 — 옛 필드를 참조하는 코드가 남아 있어도 죽지 않게 */
    shapeD: null, traj: null, didFine: true,
  };
  let idx = 0;

  /* 공통 프로필 저장 — 두 번째 클럽부터는 확인 한 장으로 끝난다 */
  const PROFILE_KEY = "riweather.fitprofile";
  const PROFILE_FIELDS = ["career", "scoreConfirm", "scoreGrp", "carry7", "heightV",
    "wristFloor", "gloveSize", "handLen", "endur", "bodyIssue", "venue", "tempo",
    "carry7V", "carry7Est", "carry7Unknown", "carry7Src", "carry7Kind"];
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
    /* 7/30 이전에 저장된 프로필에는 carry7V(슬라이더 값)가 없다.
       그대로 두면 "다시 답할래요"로 들어갔을 때 슬라이더가 기본값 150으로 돌아가
       지난번에 답한 거리가 사라진다 — 계산값에서 되살린다. */
    if (p.carry7V === undefined && p.carry7) S.carry7V = p.carry7;
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
  const PRICE_LABEL = { 1: tr("cf.price.1"), 2: tr("cf.price.2"), 3: tr("cf.price.3") };
  function inBudget(x, budget) {
    if (!budget || budget === "any") return true;
    if (x.pr === undefined) return true;              // 모르는 건 거르지 않는다
    return budget === "stock" ? x.pr <= 1 : x.pr <= 2;
  }
  function pickTiers(sorted, brand, key, ok, budget, levelFit) {
    const pool = sorted.filter((x) => inBudget(x, budget));
    const use = pool.length ? pool : sorted;
    const cur = use.filter((x) => x.st === "cur");
    /* ⚠️ 선호 브랜드는 '현행 우선'보다 앞선다.
       테일러메이드·캘러웨이·던롭은 표에 단종 모델뿐이라, 현행만 먼저 보면
       사장님이 그 브랜드를 골라도 타이틀리스트가 나왔다(2026-07-29 sweep 적발).
       선호 브랜드가 현행에 없으면 단종까지 포함해 그 브랜드에서 고른다.
       단종이면 화면에 "단종 · 중고로 구함" 이 그대로 붙으므로 속이는 게 아니다.

       ⚠️ 실력도 '현행 우선'보다 앞선다 (2026-07-31 발견 — v169 게이트의 거울상).
       캘러웨이는 현행이 '에이팩스 프로'(관용성 3, 80대용) 하나뿐이라, 100타 초심자가
       캘러웨이를 고르면 **현행 안에서만 고르느라** 그 상급자용 아이언이 1순위로 나갔다.
       정작 맞는 '패러다임 Ai스모크'(관용성 5, 90·100대용)는 단종이라 후보에서 통째로 빠졌다.
       상급자에게 초심자 클럽을 주면 신뢰가 무너지고, 초심자에게 상급자 클럽을 주면
       **아예 못 친다.** 그래서 그 브랜드의 현행이 실력대에 안 맞으면 단종까지 열어 준다. */
    const bk0 = key || "b";
    const want0 = brand && brand !== "any" ? brand : null;
    const brandInCur = !want0 || cur.some((x) =>
      x[bk0] === want0 && (!ok || ok(x)) && (!levelFit || levelFit(x)));
    const base = cur.length && brandInCur ? cur : use;
    const now = pickByBrand(base, brand, key, ok);
    /* 다른 브랜드 대안이 현행 안에서 안 나오면 단종까지 넓혀 찾는다.
       실력 게이트(2026-07-30)가 현행 후보를 한 브랜드만 남기는 경우가 실제로 있다 —
       80대 이하 드라이버에서 비(非)타이틀 현행이 전부 forg 5 라 컷됐다.
       단종이면 화면에 그 표시가 그대로 붙으니 속이는 게 아니다. */
    if (now.main && !now.alt)
      now.alt = use.find((x) => x[bk0] !== now.main[bk0] && (!ok || ok(x))) || null;
    /* 2차 — 단종 중 가장 잘 맞는 것.
       "단종이 현행보다 점수가 높을 때만" 으로 잡았더니 45조합 중 0번 떴다.
       실제 값어치는 거기 있지 않다 — **성능이 비슷한데 값이 내려가는 것**이 핵심이다.
       그래서 현행 1순위의 85% 이상이면 내민다. 더 높으면 그렇다고 따로 말한다. */
    const olds = use.filter((x) => x.st === "old" && x !== now.main);
    const bestOld = olds.length ? pickByBrand(olds, brand, key, ok).main : null;
    /* 구력 3년 미만이면 문턱을 낮춰 중고·지난 모델을 더 적극적으로 보여준다.
       스윙이 1~2년 안에 또 바뀔 시기에 고가 커스텀부터 가는 건 순서가 아니다. */
    const oldGate = isNovice() ? 0.75 : 0.85;
    const keep = bestOld && (bestOld.p || 0) >= (now.main ? (now.main.p || 0) * oldGate : 0);
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

  /* ───────── 7번 캐리 추정 · 환산 ─────────
     사장님 지시 2 감사에서 나온 것 — **성별(동의 화면)이 화면 표시에만 쓰이고
     계산에는 한 번도 안 쓰이고 있었다.** 캐리를 모르는 골퍼의 추정에 쓴다.
     ⚠️ 추정값은 반드시 "추정"이라고 밝힌다. 단정하면 그 위의 계산이 전부 거짓이 된다. */
  const CARRY7_EST = { "80": { m: 150, f: 130 }, "90": { m: 140, f: 120 }, "100": { m: 125, f: 105 } };
  const SCREEN_RUN_7I = 6;              // 7번 아이언 런 가정치(m) — 토탈에서 이만큼 빼 캐리로 본다
  function estimateCarry7() {
    const t = CARRY7_EST[S.scoreGrp || "90"] || CARRY7_EST["90"];
    let v = S.auto.sex === "여성" ? t.f : t.m;
    if (S.auto.age === "60대 이상") v -= 10;
    return Math.max(100, Math.min(190, v));
  }
  /* 슬라이더 값(carry7V) → 계산에 쓸 값(carry7) 을 세운다.
     화면(commitScreen)과 검사(__cfCarry)가 **같은 함수**를 부르게 해 둔다 —
     두 벌로 두면 검사는 통과인데 화면은 다른 사고가 난다. */
  function applyCarry7() {
    if (S.carry7Unknown === "yes") { S.carry7 = estimateCarry7(); S.carry7Est = "추정"; return; }
    if (S.carry7Src === "screen" && (S.carry7Kind === "total" || S.carry7Kind === "unknown")) {
      S.carry7 = Math.max(100, S.carry7V - SCREEN_RUN_7I); S.carry7Est = "환산"; return;
    }
    S.carry7 = S.carry7V; S.carry7Est = null;
  }
  /* 추정·환산으로 세운 값이면 결과에 그 사실과 근거를 카드로 남긴다 */
  function carry7Note() {
    if (S.carry7Est === "추정")
      return { t: "rule", h: tr("cf.note.est.h"),
        b: tr("cf.note.est.b", { grade: gradeTxt() + (S.auto.sex ? " · " + S.auto.sex : "") +
             (S.auto.age === "60대 이상" ? tr("cf.note.est.age") : ""), m: S.carry7 }) +
           (S.auto.sex ? "" : tr("cf.note.est.nosex")) + tr("cf.note.est.tail") };
    if (S.carry7Est === "환산")
      return { t: "rule", h: tr("cf.note.conv.h"),
        b: tr("cf.note.conv.b", { run: SCREEN_RUN_7I, m: S.carry7 }) };
    return null;
  }
  /* 구력 — 사장님 지시 2 감사에서 나온 것. 저장·표시만 되고 **어느 엔진도 읽지 않았다.**
     구력이 실제로 바꾸는 것은 둘이다:
       ① 스윙이 아직 완성 전이라 미스 범위가 넓다 → 관용성
       ② 자가진단(볼자국·디봇)의 신뢰도 — 스윙이 매달 바뀌면 그 자국도 바뀐다
     ⚠️ 미스 경향(슬라이스 등) 자체는 초보도 정확히 압니다. 그건 깎지 않습니다. */
  const isNovice = () => S.career === "lt3";
  function careerNote() {
    if (!isNovice()) return null;
    return { t: "rule", h: tr("cf.note.novice.h"), b: tr("cf.note.novice.b") };
  }

  /* 진행 표시 문구 — '가봉/본봉' 같은 재단 용어 대신
     클럽이 내게 맞춰지는 과정을 이야기로 들려준다 (사장님 지시 2026-07-27) */
  /* 내부 단계 이름 → 화면에 내보낼 말.
     'stage' 는 코드가 흐름을 구분하려고 쓰는 이름일 뿐이라 그대로 보여주면 안 된다. */
  const STAGE_LABEL = {
    "선택": tr("cf.stage.pick"), "확인": tr("cf.stage.confirm"), "공통": tr("cf.stage.common"),
    "골프백": tr("cf.stage.bag"), "볼": tr("cf.stage.ball"),
    "브랜드": tr("cf.stage.brand"), "그립": tr("cf.stage.grip"),
    "드라이버": tr("cf.stage.driver"), "아이언": tr("cf.stage.iron"),
    "웨지": tr("cf.stage.wedge"), "퍼터": tr("cf.stage.putter"), "결과": tr("cf.stage.result"),
  };

  /* 화면 eyebrow → 진행 문구. 없으면 group 으로 폴백한다(내부 이름이 새지 않게). */
  const NARRATION = {
    [tr("cf.eb.pick")]: tr("cf.nar.pick"),
    [tr("cf.eb.bag")]: tr("cf.nar.bag"),
    [tr("cf.eb.known")]: tr("cf.nar.known"),
    [tr("cf.eb.career")]: tr("cf.nar.career"),
    [tr("cf.eb.scoreconfirm")]: tr("cf.nar.score"), [tr("cf.eb.score")]: tr("cf.nar.score"),
    [tr("cf.eb.carry7")]: tr("cf.nar.carry7"),
    [tr("cf.eb.body")]: tr("cf.nar.body"),
    [tr("cf.eb.glove")]: tr("cf.nar.glove"),
    [tr("cf.eb.endur")]: tr("cf.nar.endur"),
    [tr("cf.eb.tempo")]: tr("cf.nar.tempo"),
    [tr("cf.eb.bodyissue")]: tr("cf.nar.bodyissue"),
    [tr("cf.eb.venue")]: tr("cf.nar.venue"),
    [tr("cf.eb.brand")]: tr("cf.nar.brand"),
    [tr("cf.eb.d1")]: tr("cf.nar.d1"),
    [tr("cf.eb.d2")]: tr("cf.nar.d2"),
    [tr("cf.eb.d3")]: tr("cf.nar.d3"),
    [tr("cf.eb.d4")]: tr("cf.nar.d4"),
    [tr("cf.eb.d6")]: tr("cf.nar.d6"),
    [tr("cf.eb.d5")]: tr("cf.nar.d5"),
    [tr("cf.eb.d7")]: tr("cf.nar.d7"),
    [tr("cf.eb.d8")]: tr("cf.nar.d8"),
    [tr("cf.eb.d9")]: tr("cf.nar.d9"),
    [tr("cf.eb.d10")]: tr("cf.nar.d10"),
    [tr("cf.eb.budget")]: tr("cf.nar.budget"),
    [tr("cf.eb.i1")]: tr("cf.nar.i1"),
    [tr("cf.eb.i2")]: tr("cf.nar.i2"),
    [tr("cf.eb.i3")]: tr("cf.nar.i3"),
    [tr("cf.eb.i4")]: tr("cf.nar.i4"),
    [tr("cf.eb.i5")]: tr("cf.nar.i5"),
    [tr("cf.eb.i6")]: tr("cf.nar.i6"),
    [tr("cf.eb.i7")]: tr("cf.nar.i7"),
    [tr("cf.eb.i8")]: tr("cf.nar.i8"),
    [tr("cf.eb.i9")]: tr("cf.nar.i9"),
    [tr("cf.eb.i10")]: tr("cf.nar.i10"),
    [tr("cf.eb.pwloft")]: tr("cf.nar.pwloft"),
    [tr("cf.eb.i12")]: tr("cf.nar.i12"),
    [tr("cf.eb.w2")]: tr("cf.nar.w2"),
    [tr("cf.eb.w3")]: tr("cf.nar.w3"),
    [tr("cf.eb.w4")]: tr("cf.nar.w4"),
    [tr("cf.eb.w5")]: tr("cf.nar.w5"),
    [tr("cf.eb.w6")]: tr("cf.nar.w6"),
    [tr("cf.eb.u1")]: tr("cf.nar.u1"),
    [tr("cf.eb.u2")]: tr("cf.nar.u2"),
    [tr("cf.eb.u3")]: tr("cf.nar.u3"),
    [tr("cf.eb.u4")]: tr("cf.nar.u4"),
    [tr("cf.eb.u5")]: tr("cf.nar.u5"),
    [tr("cf.eb.u6")]: tr("cf.nar.u6"),
    [tr("cf.eb.u7")]: tr("cf.nar.u7"),
    [tr("cf.eb.u8")]: tr("cf.nar.u8"),
    [tr("cf.eb.u9")]: tr("cf.nar.u9"),
    [tr("cf.eb.u10")]: tr("cf.nar.u10"),
    [tr("cf.eb.u11")]: tr("cf.nar.u11"),
    [tr("cf.eb.gripcond")]: tr("cf.nar.gripcond"),
    [tr("cf.eb.gripfeel")]: tr("cf.nar.gripfeel"),
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
  const nextBtn = (dis = false, label = tr("cf.btn.next")) =>
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
    driver: { ko: tr("cf.club.driver"), ico: "golfer", desc: tr("cf.club.driver.d") },
    iron:   { ko: tr("cf.club.iron"),   ico: "iron",   desc: tr("cf.club.iron.d") },
    wedge:  { ko: tr("cf.club.wedge"),  ico: "wedge",  desc: tr("cf.club.wedge.d") },
    putter: { ko: tr("cf.club.putter"), ico: "putter", desc: tr("cf.club.putter.d") },
    /* 볼은 클럽이 아니라 실루엣이 없다 — CSS 로 그린 공을 쓴다(아이콘 생성 스크립트 손대지 않음).
       2열 격자 아래에 가로 한 줄로 붙인다. */
    ball:   { ko: tr("cf.club.ball"),   ico: "ball",   desc: tr("cf.club.ball.d"), wide: true },
  };

  /* ───────── [1] 클럽 선택 ───────── */
  const PICK = { key: "pick", group: "선택", render: () => {
    const bag = readBag();
    return `
      <div class="q-eyebrow">${tr("cf.eb.pick")}</div>
      <div class="q-title">${tr("cf.pick.title")}</div>
      <div class="q-sub">${tr("cf.pick.sub")}</div>
      <div class="q-body">
        ${bagStrip()}
        <div class="cf-club-grid">
        ${Object.entries(CLUBS).map(([k, c]) => `
          <button class="cf-club-tile${c.wide ? " wide" : ""}" data-club="${k}">
            <span class="cf-club-ico ico-${c.ico}"></span>
            <b>${c.ko}</b><small>${c.desc}</small>
            ${bag[k] ? `<span class="cf-club-done">${tr("cf.pick.done")}</span>` : ""}
          </button>`).join("")}
        </div>
      </div>`;
  } };

  /* ───────── [1-B] 내 골프백 ─────────
     저장은 되는데 **볼 화면이 없었다**(사장님 지적 2026-07-30).
     저장한 게 뭔지 다시 볼 수 없으면 저장 버튼은 아무 말도 하지 않는 버튼이다. */
  function bagStrip() {
    const bag = readBag();
    const have = BAG_ORDER.filter((k) => bag[k]);
    if (!have.length)
      return `<div class="bag-strip empty">
        <span class="bag-strip-ic" aria-hidden="true">🎒</span>
        <div class="bag-strip-t"><b>${tr("cf.bag.strip.t")}</b>
          <span>${tr("cf.bag.strip.empty")}</span></div>
      </div>`;
    return `<button class="bag-strip" data-jump="bag">
        <span class="bag-strip-ic" aria-hidden="true">🎒</span>
        <div class="bag-strip-t"><b>${tr("cf.bag.strip.t")}</b>
          <span>${tr("cf.bag.strip.saved", { list: have.map((k) => CLUBS[k].ko).join(" · ") })}</span></div>
        <span class="bag-strip-go">${tr("cf.bag.strip.open")}</span>
      </button>`;
  }
  /* 저장 시각은 있을 때만 적는다 — 없는 걸 지어내지 않는다 */
  function bagWhen(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return isNaN(d.getTime()) ? "" : tr("cf.bag.when", { md: (d.getMonth() + 1) + "/" + d.getDate() });
  }
  const BAG = { key: "bag", group: "골프백", render: () => {
    const bag = readBag();
    const have = BAG_ORDER.filter((k) => bag[k]);
    /* 값이 없는 줄은 통째로 뺀다 — "그립 undefined" 가 찍히면 안 된다 */
    const row = (l, v) => (has(v) ? `<div class="bag-row"><span>${l}</span><b>${v}</b></div>` : "");
    const card = (k) => {
      const c = CLUBS[k], d = bag[k];
      if (!c) return "";
      if (!d) return `<div class="bag-card empty">
          <div class="bag-head"><b>${c.ko}</b></div>
          <div class="bag-none">${tr("cf.bag.none")}</div>
          <button class="cf-btn ghost bag-btn" data-club="${k}">${tr("cf.bag.go")}</button>
        </div>`;
      let body = "";
      if (k === "driver")
        body = row(tr("cf.k.head"), d.keep ? tr("cf.bag.keepdrv") : d.head) +
               row(tr("cf.k.shaft"), d.shaft) + row(tr("cf.k.loft"), d.loft) + row(tr("cf.k.grip"), d.grip);
      else if (k === "iron")
        body = row(tr("cf.k.head"), d.head) + row(tr("cf.k.shaft"), d.shaft) +
               row(tr("cf.k.matw"), d.mat && d.weight ? tr("cf.bag.matw", { mat: d.mat, w: d.weight }) : null) +
               row(tr("cf.k.lielen"), d.lie && d.len ? `${d.lie} · ${d.len}` : null) +
               row(tr("cf.k.grip"), d.grip);
      else if (k === "wedge")
        body = row(tr("cf.k.comp"), (d.lofts || []).length ? d.lofts.map((x) => x + "°").join(" · ") : null) +
               row(tr("cf.k.bounce"), (d.bounces || []).length ? d.bounces.map((x) => x + "°").join(" · ") : null) +
               row(tr("cf.k.model"), d.model) + row(tr("cf.k.grip"), d.grip);
      else if (k === "putter")
        body = row(tr("cf.k.model"), d.model) + row(tr("cf.k.shape"), d.shape) +
               row(tr("cf.k.len"), d.len ? d.len + "″" : null) + row(tr("cf.k.grip"), d.grip);
      else if (k === "ball")
        body = row(tr("cf.k.kind"), d.cat) + row(tr("cf.k.model"), d.model) + row(tr("cf.k.cover"), d.cover);
      return `<div class="bag-card">
          <div class="bag-head"><b>${c.ko}</b><span>${bagWhen(d.ts)}</span></div>
          ${body}
          ${d.tldr && d.tldr.read ? `<div class="bag-why">${d.tldr.read}</div>` : ""}
          <button class="cf-btn ghost bag-btn" data-club="${k}">${tr("cf.bag.again")}</button>
        </div>`;
    };
    return `
      <div class="q-eyebrow">${tr("cf.eb.bag")}</div>
      <div class="q-title">${tr("cf.bag.title")}</div>
      <div class="q-sub">${have.length
        ? tr("cf.bag.sub", { n: have.length })
        : tr("cf.bag.sub.empty")}</div>
      <div class="q-body">${BAG_ORDER.map(card).join("")}
        <div class="inline-note">${tr("cf.bag.local")}</div>
      </div>
      <div class="btn-row"><button class="cf-btn" data-jump="pick">${tr("cf.bag.topick")}</button></div>`;
  } };

  /* ───────── [2] 공통 프로필 ─────────
     한 번만 묻고 저장한다. 두 번째 클럽부터는 확인 한 장으로 끝난다. */
  const CONFIRM = { key: "confirm", group: "확인", render: () => {
    const p = loadFitProfile() || {};
    const row = (l, v) => `<div class="known-card"><div class="k-label">${l}</div><div class="k-val">${v}</div></div>`;
    const careerTxt = { lt3: tr("cf.career.lt3"), y3_10: tr("cf.career.y3_10"), gt10: tr("cf.career.gt10") }[p.career] || "-";
    const endurTxt = { strong: tr("cf.endur.s.strong"), fadeLate: tr("cf.endur.s.fade"), weak: tr("cf.endur.s.weak") }[p.endur] || "-";
    const venueTxt = { field: tr("cf.venue.field"), screen: tr("cf.venue.screen"), both: tr("cf.venue.both.s") }[p.venue] || "-";
    return `
      <div class="q-eyebrow">${tr("cf.eb.known")}</div>
      <div class="q-title">${tr("cf.confirm.title")}</div>
      <div class="q-sub">${tr("cf.confirm.sub")}</div>
      <div class="q-body">
        ${row(tr("cf.confirm.k.career"), `${careerTxt} · ${p.scoreGrp === "100" ? tr("cf.grade.100") : tr("cf.grade.n", { n: p.scoreGrp || "-" })}`)}
        ${row(tr("cf.confirm.k.carry7"), (p.carry7 || "-") + "m")}
        ${row(tr("cf.confirm.k.height"), (p.heightV || "-") + "cm" + (p.wristFloor ? tr("cf.confirm.wrist", { v: p.wristFloor }) : ""))}
        ${row(tr("cf.confirm.k.endur"), `${endurTxt} · ${venueTxt}`)}
      </div>
      <div class="btn-row">
        <button class="cf-btn accent" data-useprofile>${tr("cf.confirm.use")}</button>
        <button class="cf-btn ghost" data-redoprofile>${tr("cf.confirm.redo")}</button>
      </div>`;
  } };

  const COMMON = [
    { key: "auto", group: "공통", render: () => `
      <div class="q-eyebrow">${tr("cf.eb.known")}</div>
      <div class="q-title">${tr("cf.auto.title")}</div>
      <div class="q-sub">${tr("cf.auto.sub")}</div>
      <div class="q-body">
        <div class="known-card"><div class="k-label">${tr("cf.auto.k.agesex")}</div>
          <div class="k-val">${S.auto.age || tr("cf.auto.none")} · ${S.auto.sex || tr("cf.auto.none")}</div>
          <div class="k-src">${tr("cf.auto.src.consent")}</div></div>
        <div class="known-card"><div class="k-label">${tr("cf.auto.k.avg")}</div>
          <div class="k-val">${S.auto.avg !== null ? tr("cf.auto.avg", { n: S.auto.avg }) : tr("cf.auto.avg.none")}</div>
          <div class="k-src">${tr("cf.auto.src.score")}</div></div>
        <div class="known-card"><div class="k-label">${tr("cf.auto.k.fade")}</div>
          <div class="k-val">${S.auto.fade !== null
            ? tr("cf.auto.fade", { v: (S.auto.fade >= 0 ? "+" : "") + S.auto.fade })
            : tr("cf.auto.fade.none")}</div>
          <div class="k-src">${tr("cf.auto.src.fade")}</div></div>
      </div>
      <div class="btn-row"><button class="cf-btn" data-next>${tr("cf.auto.start", { club: CLUBS[S.club].ko })}</button></div>` },

    { key: "career", group: "공통", q: 1, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.career")}</div>
      <div class="q-title">${tr("cf.career.title")}</div>
      <div class="q-body">${chipList([
        { v: "lt3", t: tr("cf.career.lt3") }, { v: "y3_10", t: tr("cf.career.y3_10") },
        { v: "gt10", t: tr("cf.career.gt10") }], "career")}</div>` },

    { key: "score", group: "공통", q: 2, render: () => S.auto.avg !== null ? `
      <div class="q-eyebrow">${tr("cf.eb.scoreconfirm")}</div>
      <div class="q-title">${tr("cf.score.title.confirm", { n: S.auto.avg })}</div>
      <div class="q-sub">${tr("cf.score.sub.confirm")}</div>
      <div class="q-body">
        ${chipList([{ v: "ok", t: tr("cf.score.ok", { grade: S.scoreGrp === "100" ? tr("cf.grade.100") : tr("cf.grade.n", { n: S.scoreGrp }) }) }, { v: "diff", t: tr("cf.score.diff") }], "scoreConfirm", { auto: false })}
        <div id="cf-scorefix" style="display:${S.scoreConfirm === "diff" ? "block" : "none"}" class="sub-q">
          <div class="q-eyebrow">${tr("cf.score.actual")}</div>
          ${chipList([{ v: "80", t: tr("cf.grade.80") }, { v: "90", t: tr("cf.grade.90") }, { v: "100", t: tr("cf.grade.100") }], "scoreGrp", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!canPassScore())}` : `
      <div class="q-eyebrow">${tr("cf.eb.score")}</div>
      <div class="q-title">${tr("cf.score.title")}</div>
      <div class="q-sub">${tr("cf.score.sub")}</div>
      <div class="q-body">${chipList([
        { v: "80", t: tr("cf.grade.80") }, { v: "90", t: tr("cf.grade.90") },
        { v: "100", t: tr("cf.grade.100") }], "scoreGrp")}</div>` },

    /* 주 플레이 환경을 캐리 문항보다 **앞으로** 옮겼다.
       스크린 위주면 "그 거리를 어디서 봤는지"를 이어서 물어야 하는데,
       뒤에 있으면 물을 수가 없다(사장님 지시 3, 2026-07-30). */
    { key: "venue", group: "공통", q: 3, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.venue")}</div>
      <div class="q-title">${tr("cf.venue.title")}</div>
      <div class="q-sub">${tr("cf.venue.sub")}</div>
      <div class="q-body">${chipList([
        { v: "field", t: tr("cf.venue.field") },
        { v: "screen", t: tr("cf.venue.screen"), s: tr("cf.venue.screen.s") },
        { v: "both", t: tr("cf.venue.both") }], "venue")}</div>` },

    { key: "carry7", group: "공통", q: 4, render: () => {
      const askSrc = S.venue === "screen" || S.venue === "both";
      return `
      <div class="q-eyebrow">${tr("cf.eb.carry7")}</div>
      <div class="q-title">${tr("cf.carry7.title")}</div>
      <div class="q-sub">${tr("cf.carry7.sub")}</div>
      <div class="q-body">${slider("carry7V", 100, 190, 5, "m")}
        ${chipList([{ v: "yes", t: tr("cf.carry7.dunno"), s: tr("cf.carry7.dunno.s") }],
          "carry7Unknown", { auto: false })}
        ${askSrc ? `<div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.carry7.src.q")}</div>
          <div class="q-sub" style="margin-bottom:10px">${tr("cf.carry7.src.sub")}</div>
          ${chipList([
            { v: "screen", t: tr("cf.carry7.src.screen") },
            { v: "field", t: tr("cf.carry7.src.field"), s: tr("cf.carry7.src.field.s") },
            { v: "guess", t: tr("cf.carry7.src.guess") }], "carry7Src", { row: true, auto: false })}
          <div id="cf-kindbox" class="sub-q" style="display:${S.carry7Src === "screen" ? "block" : "none"}">
            <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.carry7.kind.q")}</div>
            ${chipList([
              { v: "carry", t: tr("cf.carry7.kind.carry") }, { v: "total", t: tr("cf.carry7.kind.total") },
              { v: "unknown", t: tr("cf.carry7.kind.unknown") }], "carry7Kind", { row: true, auto: false })}
          </div>
        </div>` : ""}
        <div class="inline-note">${tr("cf.carry7.hint")}</div>
      </div>${nextBtn()}`;
    } },

    { key: "body", group: "공통", q: 5, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.body")}</div>
      <div class="q-title">${tr("cf.body.title")}</div>
      <div class="q-body">
        <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.body.height")}</div>
        ${slider("heightV", 145, 200, 1, "cm")}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.body.wrist")} <span style="opacity:.6">${tr("cf.opt.optional")}</span></div>
          <div class="q-sub" style="margin-bottom:10px">${tr("cf.body.wrist.sub")}</div>
          ${slider("wristFloorV", 70, 100, 1, "cm")}
          ${chipList([{ v: "skip", t: tr("cf.body.wrist.skip") }], "wristSkip", { auto: false })}
        </div>
      </div>${nextBtn()}` },

    { key: "glove", group: "공통", q: 6, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.glove")}</div>
      <div class="q-title">${tr("cf.glove.title")}</div>
      <div class="q-sub">${tr("cf.glove.sub")}</div>
      <div class="q-body">
        ${chipList(["18", "19", "20", "21", "22", "23", "24", "25", "26"].map((n) => ({ v: n, t: tr("cf.glove.no", { n: n }) }))
          .concat([{ v: "unknown", t: tr("cf.opt.unknown") }]), "gloveSize", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.glove.hand")} <span style="opacity:.6">${tr("cf.glove.hand.opt")}</span></div>
          <div class="q-sub" style="margin-bottom:10px">${tr("cf.glove.hand.sub")}</div>
          ${slider("handLenV", 15, 26, 0.5, "cm")}
          ${chipList([{ v: "skip", t: tr("cf.glove.hand.skip") }], "handSkip", { auto: false })}
        </div>
      </div>${nextBtn(!S.gloveSize)}` },

    { key: "endur", group: "공통", q: 7, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.endur")}</div>
      <div class="q-title">${tr("cf.endur.title")}</div>
      <div class="q-sub">${S.auto.fade !== null && S.auto.fade >= 3
        ? tr("cf.endur.sub.fade", { n: S.auto.fade })
        : tr("cf.endur.sub")}</div>
      <div class="q-body">${chipList([
        { v: "strong", t: tr("cf.endur.strong") },
        { v: "fadeLate", t: tr("cf.endur.fade"), s: tr("cf.endur.fade.s") },
        { v: "weak", t: tr("cf.endur.weak") }], "endur")}</div>` },

    { key: "tempo", group: "공통", q: 8, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.tempo")}</div>
      <div class="q-title">${tr("cf.tempo.title")}</div>
      <div class="q-sub">${tr("cf.tempo.sub")}</div>
      <div class="q-body">${chipList([
        { v: "smooth", t: tr("cf.tempo.smooth"), s: tr("cf.tempo.smooth.s") },
        { v: "normal", t: tr("cf.opt.normal") },
        { v: "fast", t: tr("cf.tempo.fast"), s: tr("cf.tempo.fast.s") }], "tempo")}</div>` },

    { key: "bodyIssue", group: "공통", q: 9, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.bodyissue")}</div>
      <div class="q-title">${tr("cf.bodyissue.title")}</div>
      <div class="q-sub">${tr("cf.bodyissue.sub")}</div>
      <div class="q-body">${chipMulti([
        { v: "wrist", t: tr("cf.bodyissue.wrist") },
        { v: "back", t: tr("cf.bodyissue.back") },
        { v: "finger", t: tr("cf.bodyissue.finger") },
        { v: "grip", t: tr("cf.bodyissue.grip") },
        { v: "none", t: tr("cf.opt.none") }], "bodyIssue")}</div>${nextBtn()}` },
  ];

  /* ───────── [3] 선호 브랜드 ─────────
     ⚠️ 브랜드 문항을 선택 단계에 두었더니 대부분 질문 자체를 못 받고 지나가
        "선호 브랜드 우선 추천"이 작동하지 않았다(2026-07-27). 항상 받는 자리에 둔다. */
  const HEAD_BRANDS = {
    driver: [{ v: "타이틀리스트", t: tr("cf.brand.titleist") }, { v: "테일러메이드", t: tr("cf.brand.taylormade") },
      { v: "캘러웨이", t: tr("cf.brand.callaway") }, { v: "핑", t: tr("cf.brand.ping") },
      { v: "던롭", t: tr("cf.brand.dunlop.d") }, { v: "any", t: tr("cf.any") }],
    iron: [{ v: "타이틀리스트", t: tr("cf.brand.titleist") }, { v: "핑", t: tr("cf.brand.ping") },
      { v: "테일러메이드", t: tr("cf.brand.taylormade") }, { v: "캘러웨이", t: tr("cf.brand.callaway") },
      { v: "미즈노", t: tr("cf.brand.mizuno") }, { v: "던롭", t: tr("cf.brand.dunlop.i") }, { v: "any", t: tr("cf.any") }],
    wedge: [{ v: "타이틀리스트", t: tr("cf.brand.titleist.v") }, { v: "클리브랜드", t: tr("cf.brand.cleveland") },
      { v: "핑", t: tr("cf.brand.ping") }, { v: "테일러메이드", t: tr("cf.brand.taylormade") },
      { v: "캘러웨이", t: tr("cf.brand.callaway") }, { v: "미즈노", t: tr("cf.brand.mizuno") }, { v: "any", t: tr("cf.any") }],
    putter: [{ v: "스카티카메론", t: tr("cf.brand.cameron") }, { v: "오디세이", t: tr("cf.brand.odyssey") },
      { v: "테일러메이드", t: tr("cf.brand.taylormade.s") }, { v: "핑", t: tr("cf.brand.ping") }, { v: "any", t: tr("cf.any") }],
  };
  const SHAFT_BRANDS = {
    driver: [{ v: "후지쿠라", t: tr("cf.sb.fujikura") }, { v: "그라파이트디자인", t: tr("cf.sb.gd") },
      { v: "미쓰비시", t: tr("cf.sb.mitsubishi") }, { v: "프로젝트X", t: tr("cf.sb.projectx") },
      { v: "UST마미야", t: tr("cf.sb.ust") }, { v: "any", t: tr("cf.any") }],
    iron: [{ v: "니폰", t: tr("cf.sb.nippon") }, { v: "트루템퍼", t: tr("cf.sb.truetemper") },
      { v: "KBS", t: tr("cf.sb.kbs") }, { v: "UST마미야", t: tr("cf.sb.ust") },
      { v: "후지쿠라", t: tr("cf.sb.fujikura") }, { v: "any", t: tr("cf.any") }],
  };
  const BRANDQ = { key: "brandq", group: "브랜드", q: 1, render: () => {
    const c = S.club, heads = HEAD_BRANDS[c], shafts = SHAFT_BRANDS[c];
    const hKey = c === "iron" ? "ironBrand" : c === "wedge" ? "wedgeBrand" : c === "putter" ? "putterBrand" : "brand";
    const sKey = c === "iron" ? "ironShaftBrand" : "shaftBrand";
    return `
      <div class="q-eyebrow">${tr("cf.eb.brand")}</div>
      <div class="q-title">${tr("cf.brandq.title")}</div>
      <div class="q-sub">${tr("cf.brandq.sub")}</div>
      <div class="q-body">
        <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.brandq.head", { club: CLUBS[c].ko })}</div>
        ${chipList(heads, hKey, { row: true, auto: false })}
        ${shafts ? `<div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.brandq.shaft")}</div>
          <div class="q-sub" style="margin-bottom:12px">${c === "iron"
            ? tr("cf.brandq.shaft.iron")
            : tr("cf.brandq.shaft.etc")}</div>
          ${chipList(shafts, sKey, { row: true, auto: false })}
        </div>` : ""}
      </div>${nextBtn(!(S[hKey] && (!shafts || S[sKey])))}`;
  } };

  /* ───────── [5] 그립 (드라이버·아이언·웨지 공통) ───────── */
  const GRIPQ = [
    { key: "gripCond", group: "그립", q: 1, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.gripcond")}</div>
      <div class="q-title">${tr("cf.gripcond.title")}</div>
      <div class="q-sub">${tr("cf.gripcond.sub")}</div>
      <div class="q-body">${chipMulti([
        { v: "sweat", t: tr("cf.gripcond.sweat") },
        { v: "wet", t: tr("cf.gripcond.wet") },
        { v: "joint", t: tr("cf.gripcond.joint") },
        { v: "nogl", t: tr("cf.gripcond.nogl") },
        { v: "none", t: tr("cf.opt.none") }], "gripCond")}</div>${nextBtn()}` },

    { key: "gripFeel", group: "그립", q: 2, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.gripfeel")}</div>
      <div class="q-title">${tr("cf.gripfeel.title")}</div>
      <div class="q-body">
        ${chipList([
          { v: "tight", t: tr("cf.grippress.tight") }, { v: "mid", t: tr("cf.opt.normal") },
          { v: "soft", t: tr("cf.grippress.soft") }], "gripPress", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.gripfeel.q")}</div>
          ${chipList([
            { v: "soft", t: tr("cf.gripfeel.soft") }, { v: "firm", t: tr("cf.gripfeel.firm") },
            { v: "any", t: tr("cf.any") }], "gripFeel", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.gripPress && S.gripFeel))}` },
  ];

  /* ───────── [4-D] 드라이버 ─────────
     기존 로직은 개인 경험 기반이라 편차가 컸다(사장님 지적 2026-07-27).
     실제 피팅이 보는 순서 — 스피드 → 어택앵글/스핀 → 궤도·페이스 → 정타 → 길이 — 로 다시 세웠다. */
  const QD = [
    { key: "d1", group: "드라이버", q: 1, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.d1")}</div>
      <div class="q-title">${tr("cf.d1.title")}</div>
      <div class="q-sub">${tr("cf.d1.sub")}</div>
      <div class="q-body">${slider("carryD", 150, 280, 5, "m")}<div id="cf-rationote"></div></div>${nextBtn()}` },

    { key: "d2", group: "드라이버", q: 2, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.d2")}</div>
      <div class="q-title">${tr("cf.d2.title")}</div>
      <div class="q-sub">${tr("cf.d2.sub")}</div>
      <div class="q-body">
        <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.d2.q1")}</div>
        ${chipList([
          { v: "left", t: tr("cf.dir.left") }, { v: "straight", t: tr("cf.dir.straight") },
          { v: "right", t: tr("cf.dir.right") }], "startDir", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.d2.q2")}</div>
          ${chipList([
            { v: "left", t: tr("cf.curve.left") }, { v: "none", t: tr("cf.curve.none") },
            { v: "right", t: tr("cf.curve.right") }], "curveDir", { row: true, auto: false })}
        </div>
        <div id="cf-flightnote"></div>
      </div>${nextBtn(!(S.startDir && S.curveDir))}` },

    { key: "d3", group: "드라이버", q: 3, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.d3")}</div>
      <div class="q-title">${tr("cf.d3.title")}</div>
      <div class="q-sub">${tr("cf.d3.sub")}</div>
      <div class="q-body">${chipList([
        { v: "low", t: tr("cf.d3.low"), s: tr("cf.d3.low.s") },
        { v: "good", t: tr("cf.d3.good"), s: tr("cf.d3.good.s") },
        { v: "balloon", t: tr("cf.d3.balloon"), s: tr("cf.d3.balloon.s") },
        { v: "high", t: tr("cf.d3.high") },
        { v: "unknown", t: tr("cf.opt.dunno") }], "flight")}</div>` },

    { key: "d4", group: "드라이버", q: 4, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.d4")}</div>
      <div class="q-title">${tr("cf.d4.title")}</div>
      <div class="q-sub">${tr("cf.d4.sub")}</div>
      <div class="q-body">${chipList([
        { v: "high", t: tr("cf.d4.high"), s: tr("cf.d4.high.s") },
        { v: "mid", t: tr("cf.opt.center") },
        { v: "low", t: tr("cf.d4.low"), s: tr("cf.d4.low.s") },
        { v: "unknown", t: tr("cf.opt.notchecked") }], "faceV")}</div>` },

    { key: "d5", group: "드라이버", q: 5, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.d5")}</div>
      <div class="q-title">${tr("cf.d5.title")}</div>
      <div class="q-sub">${tr("cf.d5.sub")}</div>
      <div class="q-body">${chipList([
        { v: "high", t: tr("cf.d5.high") },
        { v: "mid", t: tr("cf.d5.mid") },
        { v: "low", t: tr("cf.d5.low") },
        { v: "vary", t: tr("cf.d5.vary") }], "teeHt")}</div>` },

    { key: "d6", group: "드라이버", q: 6, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.d6")}</div>
      <div class="q-title">${tr("cf.d6.title")}</div>
      <div class="q-body">${chipList([
        { v: "toe", t: tr("cf.opt.toe") },
        { v: "center", t: tr("cf.opt.center") },
        { v: "heel", t: tr("cf.opt.heel") },
        { v: "vary", t: tr("cf.d6.vary"), s: tr("cf.d6.vary.s") },
        { v: "unknown", t: tr("cf.opt.notchecked") }], "faceH")}</div>` },

    { key: "d7", group: "드라이버", q: 7, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.d7")}</div>
      <div class="q-title">${tr("cf.d7.title")}</div>
      <div class="q-body">${chipList([
        { v: "dist", t: tr("cf.opt.dist") }, { v: "dir", t: tr("cf.opt.dir") },
        { v: "traj", t: tr("cf.d7.traj") }, { v: "feel", t: tr("cf.opt.feel") },
        { v: "consist", t: tr("cf.d7.consist"), s: tr("cf.d7.consist.s") },
        { v: "none", t: tr("cf.opt.nocomplaint") }], "complaint")}</div>` },

    { key: "d8", group: "드라이버", q: 8, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.d8")}</div>
      <div class="q-title">${tr("cf.d8.title")}</div>
      <div class="q-sub">${tr("cf.d8.sub")}</div>
      <div class="q-body">
        <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.k.loft")}</div>
        ${chipList([
          { v: "8.5", t: "8.5°" }, { v: "9", t: "9°" }, { v: "9.5", t: "9.5°" },
          { v: "10.5", t: "10.5°" }, { v: "12", t: tr("cf.d8.loft12") }, { v: "unknown", t: tr("cf.opt.unknown") }],
          "curLoft", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.k.shaft")}</div>
          ${chipList(Object.entries(CUR_SHAFT).map(([v, o]) => ({ v, t: o.label })), "curShaft", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.curLoft && S.curShaft))}` },

    { key: "d9", group: "드라이버", q: 9, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.d9")}</div>
      <div class="q-title">${tr("cf.d9.title")}</div>
      <div class="q-sub">${tr("cf.d9.sub")}</div>
      <div class="q-body">
        <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.d9.q1")}</div>
        ${chipList([
          { v: "yes", t: tr("cf.d9.yes") }, { v: "no", t: tr("cf.d9.no") }],
          "gripDown", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.d9.q2")}</div>
          ${chipList([
            { v: "small", t: tr("cf.d9.small") }, { v: "mid", t: tr("cf.d9.mid") },
            { v: "big", t: tr("cf.d9.big"), s: tr("cf.d9.big.s") }], "carryVar", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.gripDown && S.carryVar))}` },

    { key: "d10", group: "드라이버", q: 10, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.d10")}</div>
      <div class="q-title">${tr("cf.d10.title")}</div>
      <div class="q-sub">${tr("cf.d10.sub")}</div>
      <div class="q-body">${chipList([
        { v: "urethane", t: tr("cf.ball.urethane"), s: tr("cf.d10.urethane.s") },
        { v: "distance", t: tr("cf.ball.distance"), s: tr("cf.d10.distance.s") },
        { v: "any", t: tr("cf.d10.any") }], "ball")}</div>` },

    { key: "d11", group: "드라이버", q: 11, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.budget")}</div>
      <div class="q-title">${tr("cf.budget.title")}</div>
      <div class="q-body">${chipList([
        { v: "stock", t: tr("cf.budget.stock"), s: tr("cf.budget.stock.s") },
        { v: "mid", t: tr("cf.budget.mid"), s: tr("cf.budget.mid.s") },
        { v: "any", t: tr("cf.any") }], "budget")}</div>` },
  ];

  /* ───────── [4-I] 아이언 ───────── */
  const QI = [
    { key: "i1", group: "아이언", q: 1, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.i1")}</div>
      <div class="q-title">${tr("cf.i1.title")}</div>
      <div class="q-body">${chipList([
        { v: "thin", t: tr("cf.i1.thin"), s: tr("cf.i1.thin.s") },
        { v: "fat", t: tr("cf.i1.fat"), s: tr("cf.i1.fat.s") },
        { v: "dir", t: tr("cf.i1.dir"), s: tr("cf.i1.dir.s") },
        { v: "none", t: tr("cf.i1.none") }], "ironMiss")}</div>` },

    { key: "i2", group: "아이언", q: 2, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.i2")}</div>
      <div class="q-title">${tr("cf.i2.title")}</div>
      <div class="q-sub">${tr("cf.i2.sub")}</div>
      <div class="q-body">${chipList([
        { v: "low", t: tr("cf.i2.low"), s: tr("cf.i2.low.s") },
        { v: "mid", t: tr("cf.i2.mid") },
        { v: "high", t: tr("cf.i2.high"), s: tr("cf.i2.high.s") },
        { v: "unknown", t: tr("cf.opt.dunno") }], "ironTraj")}</div>` },

    { key: "i3", group: "아이언", q: 3, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.i3")}</div>
      <div class="q-title">${tr("cf.i3.title")}</div>
      <div class="q-body">${chipList([
        { v: "slice", t: tr("cf.shape.slice") },
        { v: "straight", t: tr("cf.shape.straight") },
        { v: "hook", t: tr("cf.shape.hook") }], "shapeI")}</div>` },

    { key: "i4", group: "아이언", q: 4, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.i4")}</div>
      <div class="q-title">${tr("cf.i4.title")}</div>
      <div class="q-sub">${tr("cf.i4.sub")}</div>
      <div class="q-body">${chipList([
        { v: "unsure", t: tr("cf.opt.chooseforme"), s: tr("cf.i4.unsure.s") },
        { v: "스틸", t: tr("cf.mat.steel"), s: tr("cf.i4.steel.s") },
        { v: "그라파이트", t: tr("cf.mat.graphite"), s: tr("cf.i4.graphite.s") }], "ironMat")}</div>` },

    { key: "i5", group: "아이언", q: 5, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.i5")}</div>
      <div class="q-title">${tr("cf.i5.title")}</div>
      <div class="q-sub">${tr("cf.i5.sub")}</div>
      <div class="q-body">${chipList([
        { v: "classic", t: tr("cf.i5.classic"), s: tr("cf.i5.classic.s") },
        { v: "mid", t: tr("cf.opt.normal") },
        { v: "forgiving", t: tr("cf.i5.forgiving"), s: tr("cf.i5.forgiving.s") },
        { v: "unsure", t: tr("cf.opt.dunno"), s: tr("cf.i5.unsure.s") }], "ironLook")}</div>` },

    { key: "i6", group: "아이언", q: 6, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.i6")}</div>
      <div class="q-title">${tr("cf.i6.title")}</div>
      <div class="q-sub">${tr("cf.i6.sub")}</div>
      <div class="q-body">${chipList([
        { v: "dist", t: tr("cf.opt.dist") }, { v: "dir", t: tr("cf.opt.dir") },
        { v: "traj", t: tr("cf.opt.traj") }, { v: "feel", t: tr("cf.opt.feel") },
        { v: "forg", t: tr("cf.i6.forg") },
        { v: "none", t: tr("cf.opt.nocomplaint") }], "ironComplaint")}</div>` },

    { key: "i7", group: "아이언", q: 7, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.i7")}</div>
      <div class="q-title">${tr("cf.i7.title")}</div>
      <div class="q-sub">${tr("cf.i7.sub")}</div>
      <div class="q-body">
        ${chipList([
          { v: "3", t: tr("cf.i7.from", { n: 3 }) }, { v: "4", t: tr("cf.i7.from", { n: 4 }) },
          { v: "5", t: tr("cf.i7.from", { n: 5 }) }, { v: "6", t: tr("cf.i7.from", { n: 6 }) },
          { v: "unknown", t: tr("cf.opt.unknown") }], "ironLongest", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.i7.q2")}</div>
          ${chipList([
            { v: "ok", t: tr("cf.i7.ok") },
            { v: "no", t: tr("cf.i7.no"), s: tr("cf.i7.no.s") }], "ironLongOk", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.ironLongest && S.ironLongOk))}` },

    { key: "i8", group: "아이언", q: 8, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.i8")}</div>
      <div class="q-title">${tr("cf.i8.title")}</div>
      <div class="q-sub">${tr("cf.i8.sub")}</div>
      <div class="q-body">${chipList([
        { v: "toe", t: tr("cf.opt.toe") },
        { v: "center", t: tr("cf.opt.center") },
        { v: "heel", t: tr("cf.opt.heel") },
        { v: "unknown", t: tr("cf.opt.notchecked") }], "ironBallMark")}</div>` },

    { key: "i9", group: "아이언", q: 9, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.i9")}</div>
      <div class="q-title">${tr("cf.i9.title")}</div>
      <div class="q-sub">${tr("cf.i9.sub")}</div>
      <div class="q-body">${chipList([
        { v: "left", t: tr("cf.i9.left") },
        { v: "straight", t: tr("cf.dir.straight") },
        { v: "right", t: tr("cf.i9.right") },
        { v: "none", t: tr("cf.i9.none") }], "ironDivot")}</div>` },

    { key: "i10", group: "아이언", q: 10, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.i10")}</div>
      <div class="q-title">${tr("cf.feel.title")}</div>
      <div class="q-body">${chipList([
        { v: "soft", t: tr("cf.i10.soft"), s: tr("cf.i10.soft.s") },
        { v: "solid", t: tr("cf.i10.solid"), s: tr("cf.i10.solid.s") },
        { v: "light", t: tr("cf.i10.light"), s: tr("cf.i10.light.s") },
        { v: "any", t: tr("cf.any") }], "ironFeel")}</div>` },

    { key: "i11", group: "아이언", q: 11, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.pwloft")}</div>
      <div class="q-title">${tr("cf.pwloft.title")}</div>
      <div class="q-sub">${tr("cf.i11.sub")}</div>
      <div class="q-body">${slider("pwLoft", 41, 48, 1, "°")}</div>${nextBtn()}` },

    { key: "i12", group: "아이언", q: 12, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.i12")}</div>
      <div class="q-title">${tr("cf.i12.title")}</div>
      <div class="q-sub">${tr("cf.i12.sub")}</div>
      <div class="q-body">
        ${textBox("ironCurModel", tr("cf.i12.ph"))}
        <div class="inline-note">${tr("cf.i12.note")}</div>
      </div>${nextBtn()}` },

    { key: "i13", group: "아이언", q: 13, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.budget")}</div>
      <div class="q-title">${tr("cf.budget.title")}</div>
      <div class="q-body">${chipList([
        { v: "stock", t: tr("cf.budget.stock") },
        { v: "mid", t: tr("cf.budget.mid") },
        { v: "any", t: tr("cf.any") }], "ironBudget")}</div>` },
  ];

  /* ───────── [4-W] 웨지 ───────── */
  const QW = [
    { key: "w1", group: "웨지", q: 1, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.pwloft")}</div>
      <div class="q-title">${tr("cf.pwloft.title")}</div>
      <div class="q-sub">${tr("cf.w1.sub")}</div>
      <div class="q-body">${slider("pwLoft", 41, 48, 1, "°")}</div>${nextBtn()}` },

    { key: "w2", group: "웨지", q: 2, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.w2")}</div>
      <div class="q-title">${tr("cf.w2.title")}</div>
      <div class="q-sub">${tr("cf.w2.sub")}</div>
      <div class="q-body">${chipList([
        { v: "dig", t: tr("cf.w2.dig"), s: tr("cf.w2.dig.s") },
        { v: "sweep", t: tr("cf.w2.sweep"), s: tr("cf.w2.sweep.s") },
        { v: "mid", t: tr("cf.w2.mid") }], "wedgeTurf")}</div>` },

    { key: "w3", group: "웨지", q: 3, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.w3")}</div>
      <div class="q-title">${tr("cf.w3.title")}</div>
      <div class="q-body">${chipList([
        { v: "fat", t: tr("cf.w3.fat"), s: tr("cf.w3.fat.s") },
        { v: "thin", t: tr("cf.w3.thin"), s: tr("cf.w3.thin.s") },
        { v: "none", t: tr("cf.w3.none") }], "wedgeMiss")}</div>` },

    { key: "w4", group: "웨지", q: 4, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.w4")}</div>
      <div class="q-title">${tr("cf.w4.title")}</div>
      <div class="q-sub">${tr("cf.w4.sub")}</div>
      <div class="q-body">${chipList([
        { v: "soft", t: tr("cf.w4.soft"), s: tr("cf.w4.soft.s") },
        { v: "mid", t: tr("cf.w4.mid") },
        { v: "tight", t: tr("cf.w4.tight"), s: tr("cf.w4.tight.s") },
        { v: "unknown", t: tr("cf.opt.dunno") }], "wedgeGrass")}</div>` },

    { key: "w5", group: "웨지", q: 5, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.w5")}</div>
      <div class="q-title">${tr("cf.w5.title")}</div>
      <div class="q-body">
        ${chipList([
          { v: "2", t: tr("cf.w5.cnt", { n: 2 }) }, { v: "3", t: tr("cf.w5.cnt", { n: 3 }) },
          { v: "4", t: tr("cf.w5.cnt", { n: 4 }) },
          { v: "unknown", t: tr("cf.opt.unknown") }], "wedgeCount", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.w5.q2")}</div>
          ${chipList([
            { v: "ok", t: tr("cf.w5.ok") },
            { v: "no", t: tr("cf.w5.no"), s: tr("cf.w5.no.s") }], "wedgeBunker", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.wedgeCount && S.wedgeBunker))}` },

    { key: "w6", group: "웨지", q: 6, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.w6")}</div>
      <div class="q-title">${tr("cf.w6.title")}</div>
      <div class="q-sub">${tr("cf.w6.sub")}</div>
      <div class="q-body">${chipList([
        { v: "same", t: tr("cf.w6.same") },
        { v: "heavy", t: tr("cf.w6.heavy") },
        { v: "unsure", t: tr("cf.opt.chooseforme") }], "wedgeShaft")}</div>` },
  ];

  /* ───────── [4-U] 퍼터 ───────── */
  const QU = [
    { key: "u1", group: "퍼터", q: 1, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.u1")}</div>
      <div class="q-title">${tr("cf.u1.title")}</div>
      <div class="q-sub">${tr("cf.u1.sub")}</div>
      <div class="q-body">${chipList([
        { v: "straight", t: tr("cf.u1.straight"), s: tr("cf.u1.straight.s") },
        { v: "slight", t: tr("cf.u1.slight"), s: tr("cf.u1.slight.s") },
        { v: "arc", t: tr("cf.u1.arc"), s: tr("cf.u1.arc.s") },
        { v: "unknown", t: tr("cf.opt.dunno"), s: tr("cf.u1.unknown.s") }], "puttStroke")}</div>` },

    { key: "u2", group: "퍼터", q: 2, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.u2")}</div>
      <div class="q-title">${tr("cf.u2.title")}</div>
      <div class="q-body">${chipList([
        { v: "dist", t: tr("cf.u2.dist"), s: tr("cf.u2.dist.s") },
        { v: "dir", t: tr("cf.opt.dir"), s: tr("cf.u2.dir.s") },
        { v: "both", t: tr("cf.u2.both") },
        { v: "none", t: tr("cf.opt.nonespecial") }], "puttMiss")}</div>` },

    { key: "u3", group: "퍼터", q: 3, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.u3")}</div>
      <div class="q-title">${tr("cf.u3.title")}</div>
      <div class="q-sub">${tr("cf.u3.sub")}</div>
      <div class="q-body">${chipList([
        { v: "left", t: tr("cf.u3.left") },
        { v: "right", t: tr("cf.u3.right") },
        { v: "vary", t: tr("cf.u3.vary") },
        { v: "none", t: tr("cf.u3.none") }], "puttShort")}</div>` },

    { key: "u4", group: "퍼터", q: 4, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.u4")}</div>
      <div class="q-title">${tr("cf.u4.title")}</div>
      <div class="q-sub">${tr("cf.u4.sub")}</div>
      <div class="q-body">${chipList([
        { v: "blade", t: tr("cf.u4.blade"), s: tr("cf.u4.blade.s") },
        { v: "mallet", t: tr("cf.u4.mallet"), s: tr("cf.u4.mallet.s") },
        { v: "any", t: tr("cf.any") }], "puttLook")}</div>` },

    { key: "u5", group: "퍼터", q: 5, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.u5")}</div>
      <div class="q-title">${tr("cf.u5.title")}</div>
      <div class="q-sub">${tr("cf.u5.sub")}</div>
      <div class="q-body">${chipList([
        { v: "line", t: tr("cf.u5.line") },
        { v: "none", t: tr("cf.u5.none"), s: tr("cf.u5.none.s") },
        { v: "any", t: tr("cf.any") }], "puttLine")}</div>` },

    { key: "u6", group: "퍼터", q: 6, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.u6")}</div>
      <div class="q-title">${tr("cf.feel.title")}</div>
      <div class="q-body">${chipList([
        { v: "soft", t: tr("cf.u6.soft"), s: tr("cf.u6.soft.s") },
        { v: "firm", t: tr("cf.u6.firm"), s: tr("cf.u6.firm.s") },
        { v: "any", t: tr("cf.any") }], "puttFeel")}</div>` },

    { key: "u7", group: "퍼터", q: 7, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.u7")}</div>
      <div class="q-title">${tr("cf.u7.title")}</div>
      <div class="q-sub">${tr("cf.u7.sub")}</div>
      <div class="q-body">
        ${chipList([
          { v: "32", t: "32″" }, { v: "33", t: "33″" }, { v: "34", t: "34″" },
          { v: "35", t: "35″" }, { v: "unknown", t: tr("cf.opt.unknown") }], "puttCurLen", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.u7.q2")}</div>
          ${chipList([
            { v: "yes", t: tr("cf.u7.yes"), s: tr("cf.u7.yes.s") },
            { v: "no", t: tr("cf.u7.no") }], "puttLong", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.puttCurLen && S.puttLong))}` },

    { key: "u8", group: "퍼터", q: 8, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.u8")}</div>
      <div class="q-title">${tr("cf.u8.title")}</div>
      <div class="q-sub">${tr("cf.u8.sub")}</div>
      <div class="q-body">${chipList([
        { v: "on", t: tr("cf.u8.on"), s: tr("cf.u8.on.s") },
        { v: "inside", t: tr("cf.u8.inside"), s: tr("cf.u8.inside.s") },
        { v: "outside", t: tr("cf.u8.outside"), s: tr("cf.u8.outside.s") },
        { v: "unknown", t: tr("cf.u8.unknown") }], "puttEye")}</div>` },

    { key: "u9", group: "퍼터", q: 9, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.u9")}</div>
      <div class="q-title">${tr("cf.u9.title")}</div>
      <div class="q-sub">${tr("cf.u9.sub")}</div>
      <div class="q-body">${chipList([
        { v: "slow", t: tr("cf.gs.slow"), s: tr("cf.u9.slow.s") },
        { v: "mid", t: tr("cf.opt.normal") },
        { v: "fast", t: tr("cf.gs.fast"), s: tr("cf.u9.fast.s") },
        { v: "unknown", t: tr("cf.opt.dunno") }], "greenSpeed")}</div>` },

    { key: "u10", group: "퍼터", q: 10, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.u10")}</div>
      <div class="q-title">${tr("cf.u10.title")}</div>
      <div class="q-sub">${tr("cf.u10.sub")}</div>
      <div class="q-body">${chipList([
        { v: "forward", t: tr("cf.u10.forward") },
        { v: "level", t: tr("cf.u10.level") },
        { v: "back", t: tr("cf.u10.back") },
        { v: "unknown", t: tr("cf.opt.dunno") }], "puttHands")}</div>` },

    { key: "u11", group: "퍼터", q: 11, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.u11")}</div>
      <div class="q-title">${tr("cf.u11.title")}</div>
      <div class="q-body">
        ${chipList([
          { v: "pistol", t: tr("cf.u11.pistol"), s: tr("cf.u11.pistol.s") },
          { v: "over", t: tr("cf.u11.over"), s: tr("cf.u11.over.s") },
          { v: "any", t: tr("cf.any") }], "puttGrip", { row: true, auto: false })}
        <div class="sub-q">
          <div class="q-eyebrow" style="margin-bottom:8px">${tr("cf.u11.q2")}</div>
          ${chipList([
            { v: "yes", t: tr("cf.u11.yes") },
            { v: "no", t: tr("cf.u11.no") }], "puttYips", { row: true, auto: false })}
        </div>
      </div>${nextBtn(!(S.puttGrip && S.puttYips))}` },
  ];

  /* ───────── [4-B] 볼 ─────────
     사장님 지시 5. 클럽은 골라 쓰지만 볼은 모든 샷에 쓴다 —
     그린 주변에서 서느냐 구르느냐는 스윙보다 **커버 소재**가 정한다. */
  const QB = [
    { key: "b1", group: "볼", q: 1, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.b1")}</div>
      <div class="q-title">${tr("cf.b1.title")}</div>
      <div class="q-sub">${tr("cf.b1.sub")}</div>
      <div class="q-body">${chipList([
        { v: "urethane", t: tr("cf.ball.urethane"), s: tr("cf.b1.urethane.s") },
        { v: "mid", t: tr("cf.b1.mid"), s: tr("cf.b1.mid.s") },
        { v: "distance", t: tr("cf.ball.distance"), s: tr("cf.b1.distance.s") },
        { v: "any", t: tr("cf.b1.any") },
        { v: "unknown", t: tr("cf.opt.dunno") }], "ball")}</div>` },

    { key: "b2", group: "볼", q: 2, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.b2")}</div>
      <div class="q-title">${tr("cf.b2.title")}</div>
      <div class="q-sub">${tr("cf.b2.sub")}</div>
      <div class="q-body">${chipList([
        { v: "few", t: tr("cf.b2.few") },
        { v: "some", t: tr("cf.b2.some") },
        { v: "many", t: tr("cf.b2.many"), s: tr("cf.b2.many.s") }], "ballLost")}</div>` },

    { key: "b3", group: "볼", q: 3, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.b3")}</div>
      <div class="q-title">${tr("cf.b3.title")}</div>
      <div class="q-sub">${tr("cf.b3.sub")}</div>
      <div class="q-body">${chipList([
        { v: "roll", t: tr("cf.b3.roll"), s: tr("cf.b3.roll.s") },
        { v: "control", t: tr("cf.b3.control") },
        { v: "none", t: tr("cf.opt.nonespecial") }], "ballShort")}</div>` },

    /* 드라이버를 이미 맞췄으면 구질을 다시 묻지 않는다 — 그때 판정한 값을 그대로 쓴다 */
    { key: "b4", group: "볼", q: 4, render: () => {
      const known = bagShape();
      return known ? `
        <div class="q-eyebrow">${tr("cf.eb.b4")}</div>
        <div class="q-title">${tr("cf.b4.title.known")}</div>
        <div class="q-sub">${tr("cf.b4.sub.known")}</div>
        <div class="q-body"><div class="known-card">
          <div class="k-label">${tr("cf.b4.k")}</div><div class="k-val">${known}</div>
          <div class="k-src">${tr("cf.b4.src")}</div></div>
        </div>${nextBtn()}` : `
        <div class="q-eyebrow">${tr("cf.eb.b4")}</div>
        <div class="q-title">${tr("cf.b4.title")}</div>
        <div class="q-sub">${tr("cf.b4.sub")}</div>
        <div class="q-body">${chipList([
          { v: "slice", t: tr("cf.shape.slice") },
          { v: "straight", t: tr("cf.shape.straight") },
          { v: "hook", t: tr("cf.shape.hook") }], "ballShape")}</div>`;
    } },

    { key: "b5", group: "볼", q: 5, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.b5")}</div>
      <div class="q-title">${tr("cf.b5.title")}</div>
      <div class="q-sub">${tr("cf.b5.sub")}</div>
      <div class="q-body">${chipList([
        { v: "soft", t: tr("cf.i10.soft"), s: tr("cf.b5.soft.s") },
        { v: "firm", t: tr("cf.b5.firm") },
        { v: "any", t: tr("cf.any") }], "ballFeel")}</div>` },

    { key: "b6", group: "볼", q: 6, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.b6")}</div>
      <div class="q-title">${tr("cf.b6.title")}</div>
      <div class="q-sub">${tr("cf.b6.sub")}</div>
      <div class="q-body">${chipList([
        { v: "yes", t: tr("cf.b6.yes") },
        { v: "no", t: tr("cf.b6.no") }], "ballCold")}</div>` },

    { key: "b7", group: "볼", q: 7, render: () => `
      <div class="q-eyebrow">${tr("cf.eb.b7")}</div>
      <div class="q-title">${tr("cf.b7.title")}</div>
      <div class="q-body">${chipList([
        { v: "often", t: tr("cf.b7.often"), s: tr("cf.b7.often.s") },
        { v: "rare", t: tr("cf.b7.rare") }], "ballFind")}</div>` },
  ];

  /* 드라이버 피팅에서 판정한 구질 — 볼 문항에서 다시 묻지 않으려고 백에서 꺼낸다 */
  function bagShape() {
    const b = readBag();
    return b && b.shape ? b.shape : null;
  }

  /* ───────── 화면 조립 ─────────
     선택한 클럽에 따라 [선택 → 공통 → 브랜드 → 클럽 문항 → 그립 → 결과] 로 만든다.
     공통 프로필이 이미 있으면 10문항 대신 확인 한 장으로 대체된다. */
  const RESULT_SCREENS = {
    driver: { key: "result", group: "결과", render: renderResult },
    iron: { key: "ironResult", group: "결과", render: renderIron },
    wedge: { key: "wedgeResult", group: "결과", render: renderWedge },
    putter: { key: "puttResult", group: "결과", render: renderPutt },
    ball: { key: "ballResult", group: "결과", render: renderBall },
  };
  const CLUB_Q = { driver: QD, iron: QI, wedge: QW, putter: QU, ball: QB };
  let SCREENS = [PICK];

  function buildScreens(club, redoProfile) {
    const useConfirm = !redoProfile && profileReady();
    const head = useConfirm ? [CONFIRM] : COMMON;
    // 퍼터는 전용 그립 문항(U11)이 있어 공통 그립 블록을 넣지 않는다. 볼은 그립이 없다.
    const grip = (club === "putter" || club === "ball") ? [] : GRIPQ;
    // 볼은 브랜드를 먼저 고르게 하지 않는다 — 커버·컴프레션이 브랜드보다 훨씬 중요하다
    const brand = club === "ball" ? [] : [BRANDQ];
    let qs = CLUB_Q[club];
    /* 볼 피팅을 이미 하셨으면 드라이버에서 "어떤 공 쓰세요"(D10)를 다시 묻지 않는다.
       같은 `ball` 필드를 쓰므로 백에서 꺼내 채워 넣고 화면만 뺀다. */
    if (club === "driver" && ballKnown()) qs = qs.filter((s) => s.key !== "d10");
    SCREENS = [PICK].concat(head, brand, qs, grip, [RESULT_SCREENS[club]]);
    // 진행 표시용 — 결과를 뺀 실제 문항 수
    TOTAL_Q = SCREENS.filter((s) => s.q).length;
  }
  /* 볼 피팅에서 받아둔 "지금 쓰는 공" — 있으면 드라이버 문항을 하나 줄인다 */
  function ballKnown() {
    const b = readBag();
    return !!(b.ball && b.ball.cur);
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
      why.push(tr("cf.grip.why.hand", { cm: S.handLen, size: size }));
    } else if (S.gloveSize && S.gloveSize !== "unknown") {
      sizeNote = GLOVE_HINT[S.gloveSize] || "스탠다드";
      size = sizeNote.split("~")[0];
      why.push(tr("cf.grip.why.glove", { n: S.gloveSize, hint: sizeNote }));
    } else {
      size = "스탠다드";
      why.push(tr("cf.grip.why.nosize"));
    }
    // 관절·손 힘 → 한 단계 굵게 (쥐는 힘이 덜 듦)
    const UP = { "언더사이즈": "스탠다드", "스탠다드": "미드사이즈", "미드사이즈": "점보", "점보": "점보" };
    if (has("joint") || has("grip") || (S.bodyIssue || []).includes("finger")) {
      size = UP[size] || size;
      why.push(tr("cf.grip.why.thicker"));
    }

    // ② 테이퍼 — 훅·손 과활성이면 하부가 두꺼운 것
    const hooking = S.curveDir === "left" || S.shapeI === "hook";
    const slicing = S.curveDir === "right" || S.shapeI === "slice";
    let taper = "표준";
    if (hooking) { taper = "리듀스드"; why.push(tr("cf.grip.why.hook")); }
    if (slicing) why.push(tr("cf.grip.why.slice"));

    // ③ 재질 — 땀·우천이면 코드
    let tex = "러버";
    if (has("sweat") && has("wet")) tex = "풀코드";
    else if (has("sweat") || has("wet")) tex = "하프코드";
    if (has("nogl")) { tex = "러버"; why.push(tr("cf.grip.why.nogl")); }
    else if (tex !== "러버") why.push(tr("cf.grip.why.tex", { tex: tex }));

    // ④ 경도
    let firm = "표준";
    if (has("joint") || S.gripPress === "tight" || S.gripFeel === "soft") firm = "소프트";
    if (S.gripFeel === "firm" && !has("joint")) firm = "펌";
    if (S.gripPress === "tight") why.push(tr("cf.grip.why.tight"));

    // ⑤ 무게 — 후반 체력 저하는 무거운 그립(카운터밸런스)이 헤드 체감을 낮춘다
    const tired = S.endur === "fadeLate" || S.endur === "weak" ||
                  (S.auto.fade !== null && S.auto.fade >= 3);
    const heavy = tired;
    if (heavy) why.push(tr("cf.grip.why.heavy"));

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
      spec: tr("cf.grip.spec", { size: size, tex: pick.tex, firm: pick.firm, w: pick.w }) +
            (taper === "리듀스드" ? tr("cf.grip.spec.reduced") : ""),
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
    const why = [tr("cf.loft.why.base", { m: c7, deg: L })];
    if (S.flight === "low") { L += 1; why.push(tr("cf.loft.why.low")); }
    if (S.flight === "balloon") { L -= 1; why.push(tr("cf.loft.why.balloon")); }
    if (S.flight === "high") { L -= 1.5; why.push(tr("cf.loft.why.high")); }
    if (S.faceV === "low") { L += 0.5; why.push(tr("cf.loft.why.facelow")); }
    if (S.faceV === "high") { L -= 0.5; why.push(tr("cf.loft.why.facehigh")); }
    if (S.curveDir === "right") { L += 0.5; why.push(tr("cf.loft.why.curveright")); }
    if (S.endur === "weak" || S.auto.age === "60대 이상") { L += 0.5; why.push(tr("cf.loft.why.weak")); }
    /* 상급자 보정(사장님 지적 2026-07-30) — 정타 관리가 되는 골퍼는 스핀 손실이 적어
       같은 스피드라도 로프트를 반 클릭 낮춰 강한 탄도로 가는 것이 실제 피팅 관행이다.
       단, 탄도가 낮다는 신호(flight low·페이스 하단 타격)가 있으면 건드리지 않는다. */
    if (S.scoreGrp === "80" && S.flight !== "low" && S.faceV !== "low") {
      L -= 0.5; why.push(tr("cf.loft.why.low80"));
    }
    L = Math.max(8.5, Math.min(12, Math.round(L * 2) / 2));
    return { loft: L, why };
  }

  /* ───────── 길이 계산 ─────────
     표준 45.75″는 대부분의 아마추어에게 길다. 정타 일관성이 병목이면 짧게가 정답. */
  function driverLength() {
    const scatter = S.faceH === "vary" || S.carryVar === "big" || S.gripDown === "yes";
    if (scatter) return { len: "44.75 ~ 45.25″", why: tr("cf.len.why.scatter") };
    if (S.faceH === "center" && S.carry7 < 140) return { len: "45.5 ~ 45.75″", why: tr("cf.len.why.std") };
    return { len: "45.25 ~ 45.5″", why: tr("cf.len.why.mid") };
  }

  function engine() {
    const notes = [], tips = [];
    const c7n = carry7Note(); if (c7n) notes.push(c7n);
    const crn = careerNote(); if (crn) notes.push(crn);
    const band = speedBand(S.carry7);
    let wLo = band.w[0], wHi = band.w[1], fxT = [...band.fx];
    const fl = flightRead();
    const lf = driverLoft();
    const ln = driverLength();

    // 비율 검증 (거짓말 탐지기 겸 정타율 신호)
    const ratio = S.carryD / S.carry7;
    let lowSmash = false;
    if (ratio > 1.68) notes.push({ t: "warn", h: tr("cf.note.ratiohi.h"), b: tr("cf.note.ratiohi.b", { r: ratio.toFixed(2) }) });
    if (ratio < 1.50) { lowSmash = true; notes.push({ t: "warn", h: tr("cf.note.ratiolo.h"), b: tr("cf.note.ratiolo.b", { r: ratio.toFixed(2) }) }); }

    if (S.tempo === "fast") fxT = shiftUp(fxT);
    const fadeSig = S.auto.fade !== null && S.auto.fade >= 3;
    const tired = S.endur === "fadeLate" || S.endur === "weak" || fadeSig;
    if (tired) {
      wLo -= 8; wHi -= 8; fxT = shiftUp(fxT);
      notes.push({ t: "rule", h: tr("cf.note.tired.h"),
        b: tr("cf.note.tired.b", { src: fadeSig ? tr("cf.note.tired.src.rec", { n: S.auto.fade }) : tr("cf.note.tired.src.q") }) });
    }
    if (S.endur === "weak") { wLo -= 4; wHi -= 4; }
    if ((S.bodyIssue || []).includes("wrist") || (S.bodyIssue || []).includes("back")) {
      wLo -= 4; wHi -= 4;
      notes.push({ t: "rule", h: tr("cf.note.body.h"), b: tr("cf.note.body.b") });
    }

    // 티 높이 처방 — 돈이 안 드는 유일한 피팅
    if (S.faceV === "low" || S.teeHt === "low")
      notes.push({ t: "rule", h: tr("cf.note.tee.h"), b: tr("cf.note.tee.b") });
    if (S.teeHt === "vary")
      tips.push(tr("cf.tip.teevary"));
    if (S.flight === "balloon" && S.ball === "urethane")
      notes.push({ t: "rule", h: tr("cf.note.ballfirst.h"), b: tr("cf.note.ballfirst.b") });

    // 샤프트 채점
    let pool = SHAFTS_ACTIVE;
    if (S.budget === "stock") pool = SHAFTS_ACTIVE.filter((s) => s.stock);
    if (!pool.length) pool = SHAFTS_ACTIVE;
    const cur = CUR_SHAFT[S.curShaft] || CUR_SHAFT.unknown;
    const shafts = pool.map((s) => {
      let p = 0; const why = [];
      if (s.w >= wLo && s.w <= wHi) { p += 40; why.push(tr("cf.sw.band", { w: s.w, lo: wLo, hi: wHi })); }
      else p += Math.max(0, 40 - 4 * (s.w < wLo ? wLo - s.w : s.w - wHi));
      const fi = FLEX.indexOf(s.fx), tI = fxT.map((f) => FLEX.indexOf(f));
      if (tI.includes(fi)) { p += 35; why.push(tr("cf.sw.flex", { fx: s.fx })); }
      else if (tI.some((t) => Math.abs(t - fi) === 1)) p += (S.tempo === "smooth" && tI.every((t) => fi < t)) ? 25 : 12;
      // 토크 — 페이스가 열려 맞으면 잘 돌아오는(고토크) 쪽, 닫혀 맞으면 안 돌아오는(저토크) 쪽
      if (fl.tq === "high" && s.tq >= 3.8) { p += 12; why.push(tr("cf.sw.tqhigh", { tq: s.tq, n: fl.n })); }
      if (fl.tq === "low" && s.tq <= 3.2) { p += 12; why.push(tr("cf.sw.tqlow", { tq: s.tq, n: fl.n })); }
      // 킥포인트 — 런치·스핀 신호로 정한다
      if ((S.flight === "low" || S.flight === "unknown" && S.complaint === "traj") && (s.k === "중고" || s.k === "고")) { p += 10; why.push(tr("cf.sw.kicklow", { k: s.k })); }
      if ((S.flight === "balloon" || S.flight === "high") && (s.k === "낮음" || s.k === "중저")) { p += 12; why.push(tr("cf.sw.kickhigh", { k: s.k })); }
      if (S.complaint === "dist" && s.w <= (wLo + wHi) / 2) { p += 6; why.push(tr("cf.sw.light")); }
      if (S.complaint === "dir" && s.tq <= 3.4) { p += 8; why.push(tr("cf.sw.dir")); }
      if (S.complaint === "consist" && s.tq <= 3.6) { p += 8; why.push(tr("cf.sw.consist")); }
      /* 상급자 성향(사장님 지적 2026-07-30) — 80대 이하는 벤투스류 저킥·저토크의
         안정형 프로파일을 선호하고 실제로도 그 편이 맞는다. 탄도를 띄워야 하는
         신호(flight low)가 있으면 이 가점은 주지 않는다. */
      if (S.scoreGrp === "80" && S.flight !== "low") {
        if (s.k === "낮음" || s.k === "중저") { p += 8; why.push(tr("cf.sw.adv")); }
        if (s.tq !== null && s.tq !== undefined && s.tq <= 3.4) p += 4;
      }
      if (cur.w && Math.abs(s.w - cur.w) > 10) p -= 15;   // 안전장치: 10g 점프 감점
      return { ...s, p, why };
    }).sort((a, b) => b.p - a.p);

    // 헤드 채점 — 아이언과 같은 실력 게이트: 80대 이하에게 초심자용 맥스 헤드는 후보에서 컷
    const drvPool = S.scoreGrp === "80" ? HEADS.filter((h) => h.forg <= 4) : HEADS;
    /* 브랜드 선호와 게이트가 부딪히면 **게이트가 이긴다**(사장님 2026-07-30 —
       상급자에게 초심자 헤드를 권하는 순간 신뢰가 무너진다). 다만 말없이 다른
       브랜드를 내밀면 v150 "브랜드 무시" 사고와 똑같아 보이므로 이유를 꼭 적는다. */
    if (S.brand && S.brand !== "any" && HEADS.some((h) => h.br === S.brand) &&
        !drvPool.some((h) => h.br === S.brand))
      notes.push({ t: "rule", h: tr("cf.note.gate.head.h"), b: tr("cf.note.gate.b", { brand: S.brand }) });
    const heads = drvPool.map((h) => {
      let p = h.forg * 8; const why = [];
      if (h.fit.includes(S.scoreGrp)) p += 15;
      if (fl.bias === "draw" && h.draw) { p += 28; why.push(tr("cf.hw.draw", { n: fl.n })); }
      if (fl.bias !== "draw" && h.draw) p -= 15;
      if (S.scoreGrp === "80") {
        if (h.forg <= 3) { p += 18; why.push(tr("cf.hw.adjust")); }
        /* 저스핀의 값어치는 **런**에서 나온다. 스크린은 런이 시뮬레이션이라
           캐리를 깎아가며 스핀을 줄일 이유가 필드보다 작다 → 가점을 절반으로. */
        if (h.spin === "저" && S.carry7 >= 163) {
          const g = S.venue === "screen" ? 7 : 14;
          p += g;
          why.push(S.venue === "screen"
            ? tr("cf.hw.lowspin.screen")
            : tr("cf.hw.lowspin"));
        }
      } else if (h.forg >= 4) { p += 20; why.push(tr("cf.hw.forg", { f: h.forg })); }
      if ((S.flight === "balloon" || S.flight === "high") && h.spin === "저") { p += 14; why.push(tr("cf.hw.lowspin.head")); }
      if (S.flight === "low" && (h.spin === "중고" || h.spin === "중")) { p += 8; why.push(tr("cf.hw.launch")); }
      if (lowSmash && h.forg >= 4) { p += 10; why.push(tr("cf.hw.smash")); }
      if (S.faceH === "vary" && h.forg >= 4) { p += 8; why.push(tr("cf.hw.vary")); }
      if (S.venue === "screen" && h.forg >= 4) { p += 4; why.push(tr("cf.screen.forg")); }
      /* 구력 3년 미만 — 스윙이 아직 완성 전이라 미스 범위가 넓다. 관용성이 곧 평균 거리다. */
      if (isNovice() && h.forg >= 4) { p += 8; why.push(tr("cf.novice.forg")); }
      if (h.light && S.carry7 < 140) { p += 12; why.push(tr("cf.hw.light")); }
      if (h.light && S.carry7 >= 160) p -= 12;
      return { ...h, p, why };
    }).sort((a, b) => b.p - a.p);

    const headPick = pickTiers(heads, S.brand, "br", null, null,
                               (hd) => (hd.fit || []).includes(S.scoreGrp || "90"));
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
      notes.push({ t: "rule", h: tr("cf.note.loftadj.h"), b: tr("cf.note.loftadj.b", { cur: curL, rec: lf.loft }) });

    // 점프 경고
    const top = shaftPick.main;
    if (!keep && cur.w && top && Math.abs(top.w - cur.w) > 10)
      notes.push({ t: "warn", h: tr("cf.note.jump.h"), b: tr("cf.note.jump.b", { cur: cur.w, rec: top.w }) });

    const grip = gripEngine();

    // 팁
    tips.push(tr("cf.tip.flight", { n: fl.n,
      dir: S.startDir === "left" ? tr("cf.w.left") : S.startDir === "right" ? tr("cf.w.right") : tr("cf.w.straight"),
      path: fl.path, face: fl.face }));
    if (fl.path === "아웃-인")
      tips.push(tr("cf.tip.outin"));
    if (S.faceV === "high")
      tips.push(tr("cf.tip.facehigh"));
    if (S.venue === "screen")
      tips.push(tr("cf.tip.screen"));
    if (S.budget === "stock") tips.push(tr("cf.tip.stock"));

    const out = { wLo, wHi, fxT, notes, tips, shafts: shafts.slice(0, 2),
      shaftPick, headPick, mainHead, altHead, keep, cur, grip, fl, lf, ln,
      mph: Math.round(S.carry7 * 0.63) };
    /* 요약은 엔진 안에서 만든다 — 저장 버튼이 엔진을 다시 돌리므로
       화면에 뜬 세 문장이 골프백에도 그대로 들어간다. */
    out.tldr = tldrDriver(out);
    return out;
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
    const c7n = carry7Note(); if (c7n) notes.push(c7n);
    const crn = careerNote(); if (crn) notes.push(crn);
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
      notes.push({ h: tr("cf.iron.mat.h"),
        b: mat === "그라파이트"
          ? (issues.includes("wrist") || issues.includes("back")
             ? tr("cf.iron.mat.graph.body") +
               (S.venue === "screen" && issues.includes("wrist")
                 ? tr("cf.iron.mat.graph.screen") : "")
             : tr("cf.iron.mat.graph.tired"))
          : tr("cf.iron.mat.steel") +
            (S.venue === "screen" && issues.includes("wrist")
              ? tr("cf.iron.mat.steel.screen") : "") });
    }
    let target = mat === "스틸" ? steelTarget : graphTarget;
    if (tired) fxT = shiftUp(fxT);
    if (S.tempo === "fast") fxT = shiftUp(fxT);
    if (issues.includes("wrist") || issues.includes("back")) target -= 8;

    // ── 라이각 — 볼자국(가장 확실) → 디봇 → 손목·바닥/키 순으로 근거를 본다.
    //    ⚠️ 확정이 아니라 **방향과 범위**만 낸다 (절대 원칙 2).
    let lieAdj = 0; const lieWhy = [];
    /* 구력 3년 미만이면 자가진단 신호의 비중을 절반으로 본다.
       스윙이 아직 매달 바뀌는 시기라 오늘 남은 자국이 다음 달에도 같은 자리라는 보장이 없다.
       ⚠️ 미스 경향(슬라이스 등)은 초보도 정확히 안다 — 그건 깎지 않는다. 여기만 깎는다. */
    const selfW = isNovice() ? 0.5 : 1;
    if (S.ironBallMark === "toe") { lieAdj += 1.5 * selfW; lieWhy.push(tr("cf.lie.toe")); }
    if (S.ironBallMark === "heel") { lieAdj -= 1.5 * selfW; lieWhy.push(tr("cf.lie.heel")); }
    if (S.ironDivot === "left" && S.ironBallMark !== "toe") { lieAdj += 0.5 * selfW; lieWhy.push(tr("cf.lie.divotleft")); }
    if (S.ironDivot === "right" && S.ironBallMark !== "heel") { lieAdj -= 0.5 * selfW; lieWhy.push(tr("cf.lie.divotright")); }
    if (isNovice() && (S.ironBallMark && S.ironBallMark !== "unknown" || S.ironDivot && S.ironDivot !== "none"))
      lieWhy.push(tr("cf.lie.novice"));
    // 정적 측정 — 손목-바닥이 있으면 그쪽을 쓰고, 없으면 키로만 대략 본다
    const h = S.heightV || 172, wf = S.wristFloor;
    if (wf) {
      const expect = h * 0.4867;                       // 키 대비 통상 손목-바닥 비율
      const d = wf - expect;
      if (d <= -3) { lieAdj += 1; lieWhy.push(tr("cf.lie.short", { h: h, wf: wf })); }
      else if (d >= 3) { lieAdj -= 1; lieWhy.push(tr("cf.lie.long", { h: h, wf: wf })); }
      else lieWhy.push(tr("cf.lie.mid", { h: h, wf: wf }));
    } else {
      if (h >= 185) { lieAdj += 1; lieWhy.push(tr("cf.lie.tall", { h: h })); }
      else if (h <= 162) { lieAdj -= 1; lieWhy.push(tr("cf.lie.small", { h: h })); }
      else lieWhy.push(tr("cf.lie.stdh", { h: h }));
    }
    const lieDir = lieAdj >= 0.5 ? tr("cf.lie.upright", { deg: Math.min(3, Math.round(lieAdj * 2) / 2) })
                 : lieAdj <= -0.5 ? tr("cf.lie.flat", { deg: Math.min(3, Math.round(-lieAdj * 2) / 2) }) : tr("cf.opt.std");
    const lieConfident = S.ironBallMark && S.ironBallMark !== "unknown";

    // ── 길이 — 손목-바닥 기준. 표준은 키가 아니라 이 값에서 나온다
    let lenAdj = tr("cf.opt.std");
    if (wf) {
      if (wf >= 92) lenAdj = "+0.25 ~ +0.5″";
      else if (wf <= 78) lenAdj = "−0.25 ~ −0.5″";
    } else if (h >= 188) lenAdj = "+0.25 ~ +0.5″";
    else if (h <= 158) lenAdj = "−0.25 ~ −0.5″";

    // ── 샤프트 채점
    const pool = S.ironBudget === "stock"
      ? IRON_SHAFTS_ACTIVE.filter((s) => s.stock || s.w <= 100)
      : IRON_SHAFTS_ACTIVE;
    const shafts = pool.map((s) => {
      let p = 0; const why = [];
      if (s.mat !== mat) p -= 30;
      const gap = Math.abs(s.w - target);
      if (gap <= 6) { p += 40; why.push(tr("cf.isw.w", { w: s.w, t: target })); }
      else p += Math.max(0, 40 - gap * 2.2);
      const fi = FLEX.indexOf(s.fx), tI = fxT.map((f) => FLEX.indexOf(f));
      if (tI.includes(fi)) { p += 30; why.push(tr("cf.sw.flex", { fx: s.fx })); }
      else if (tI.some((t) => Math.abs(t - fi) === 1)) p += 12;
      if (S.ironTraj === "low" && (s.k === "고" || s.k === "중고")) { p += 12; why.push(tr("cf.isw.kicklow", { k: s.k })); }
      if (S.ironTraj === "high" && (s.k === "낮음" || s.k === "중저")) { p += 12; why.push(tr("cf.isw.kickhigh", { k: s.k })); }
      if (S.ironMiss === "thin" && s.k === "고") { p += 10; why.push(tr("cf.isw.thin")); }
      if (S.ironMiss === "fat" && (s.k === "낮음" || s.k === "중저")) { p += 10; why.push(tr("cf.isw.fat")); }
      if (S.ironFeel === "soft" && s.feel === "부드럽다") { p += 12; why.push(tr("cf.feel.soft.ok")); }
      if (S.ironFeel === "solid" && (s.feel === "단단하다" || s.feel === "묵직하다")) { p += 12; why.push(tr("cf.feel.firm.ok")); }
      if (S.ironFeel === "light" && s.feel === "가볍다") { p += 12; why.push(tr("cf.feel.light.ok")); }
      return { ...s, p, why };
    }).sort((a, b) => b.p - a.p);

    // ── 헤드 채점 — 어드레스 취향이 실제 기준. 실력만으로 정하면 취향이 무시된다
    const look = S.ironLook;
    /* ⚠️ 실력 게이트 — 가점이 아니라 **컷**이다 (사장님 실사용 지적 2026-07-30).
       관용성 기본점(forg×7)에 미스 가점이 쌓이면 실력 가점(+22)은 반드시 진다.
       실측: 평균 80대(싱글 포함) 프로필의 답 240조합 중 60조합에서 T350 같은
       맥스 관용성(초심자용) 헤드가 1순위로 나갔다. 상급자에게 초심자 헤드를 권하는
       순간 피팅 전체의 신뢰가 무너진다 — 뒤땅·방향 보정은 상급자용 후보
       (투어 캐비티~중공) **안에서** 한다. 실제 피팅샵의 방식이다.
       반대로 100타 이상에게 블레이드급(forg 2)도 후보에서 뺀다. */
    const ironPool = S.scoreGrp === "80" ? IRON_HEADS.filter((hd) => hd.forg <= 4)
                   : S.scoreGrp === "100" ? IRON_HEADS.filter((hd) => hd.forg >= 3)
                   : IRON_HEADS;
    if (S.scoreGrp === "80")
      notes.push({ h: tr("cf.note.advgate.h"), b: tr("cf.note.advgate.b") });
    // 브랜드 선호와 게이트가 부딪히면 게이트가 이긴다 — 대신 이유를 꼭 적는다 (드라이버와 동일)
    if (S.ironBrand && S.ironBrand !== "any" && IRON_HEADS.some((h) => h.br === S.ironBrand) &&
        !ironPool.some((h) => h.br === S.ironBrand))
      notes.push({ h: tr("cf.note.gate.iron.h"), b: tr("cf.note.gate.b", { brand: S.ironBrand }) });
    const heads = ironPool.map((hd) => {
      let p = hd.forg * 7; const why = [];
      if (hd.fit.includes(S.scoreGrp || "90")) { p += 22; why.push(tr("cf.ihw.fit", { g: S.auto.avg || tr("cf.grade.n", { n: S.scoreGrp }) })); }
      if (look === "classic") { p += (5 - hd.forg) * 7; if (hd.off === "적음") { p += 14; why.push(tr("cf.ihw.classic")); } }
      if (look === "forgiving") { p += hd.forg * 7; if (hd.off === "많음") { p += 10; why.push(tr("cf.ihw.forgiving")); } }
      if (S.ironComplaint === "forg" && hd.forg >= 4) { p += 16; why.push(tr("cf.ihw.forg", { f: hd.forg })); }
      if (S.ironMiss === "thin" && hd.forg >= 4) { p += 14; why.push(tr("cf.ihw.thin", { f: hd.forg })); }
      if (S.ironMiss === "dir" && hd.off === "많음") { p += 12; why.push(tr("cf.ihw.offdir")); }
      if (S.shapeI === "slice" && hd.off === "많음") { p += 12; why.push(tr("cf.ihw.offslice")); }
      if (S.shapeI === "hook" && hd.off === "적음") { p += 10; why.push(tr("cf.ihw.offhook")); }
      if (S.ironTraj === "low" && hd.forg >= 4) { p += 8; why.push(tr("cf.ihw.traj")); }
      if (hd.light && (tired || S.carry7 < 140)) { p += 10; why.push(tr("cf.ihw.light")); }
      /* 스크린 위주 — 매트는 솔이 미끄러져 뒤땅을 덮어준다.
         그래서 "미스가 별로 없다"는 답이 필드 기준으로는 과대평가일 수 있어 관용성을 더 본다. */
      if (S.venue === "screen" && hd.forg >= 4) {
        const bump = S.ironMiss === "none" ? 10 : 4;
        p += bump;
        why.push(S.ironMiss === "none"
          ? tr("cf.screen.mat")
          : tr("cf.screen.forg"));
      }
      if (isNovice() && hd.forg >= 4) { p += 8; why.push(tr("cf.novice.forg")); }
      return { ...hd, p, why };
    }).sort((a, b) => b.p - a.p);

    // ── 세트 구성 — 클럽을 파는 조언이 아니라 빼라는 조언
    let setAdvice = null;
    const longest = Number(S.ironLongest);
    if (S.ironLongOk === "no" && longest && longest <= 5) {
      const swap = [];
      for (let n = longest; n <= (S.carry7 < 140 ? 6 : 5); n++) swap.push(tr("cf.iron.no", { n: n }));
      setAdvice = { drop: swap, b: tr("cf.iron.set.drop", { list: swap.join(" · ") }) };
    } else if (S.ironLongOk === "ok" && longest && longest >= 6) {
      setAdvice = { drop: [], b: tr("cf.iron.set.keep", { n: longest }) };
    }

    // ── 로프트 세대 — 스트롱 로프트면 웨지 간격이 벌어진다
    if (S.pwLoft && S.pwLoft <= 43)
      tips.push(tr("cf.iron.strongloft", { deg: S.pwLoft }));

    // ── 유지 판정
    const keepish = S.ironComplaint === "none" || S.ironComplaint === "feel";
    if (keepish && S.ironCurModel)
      notes.push({ h: tr("cf.iron.keep.h"), b: tr("cf.iron.keep.b", { model: S.ironCurModel }) });

    if (mat === "스틸" && S.ironMat === "그라파이트")
      notes.push({ h: tr("cf.iron.matpick.h"), b: tr("cf.iron.matpick.b") });

    const out = {
      mat, target, fxT, notes, tips, setAdvice,
      lie: lieDir, lieWhy, lieConfident, lenAdj,
      keepish: keepish && !!S.ironCurModel,
      grip: gripEngine(),
      shaftPick: pickTiers(shafts, S.ironShaftBrand, "b",
        (s) => s.mat === mat && Math.abs(s.w - target) <= 12, S.ironBudget),
      // 실력대(fit)에 맞는 현행이 그 브랜드에 없으면 단종까지 연다 — pickTiers 주석 참고
      headPick: pickTiers(heads, S.ironBrand, "br", null, null,
                          (hd) => (hd.fit || []).includes(S.scoreGrp || "90")),
    };
    out.tldr = tldrIron(out);
    return out;
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
    const why = [tr("cf.wedge.why.base", { type: S.wedgeTurf === "dig" ? tr("cf.wedge.digger") : S.wedgeTurf === "sweep" ? tr("cf.wedge.sweeper") : tr("cf.wedge.midtype"), deg: base })];
    if (S.wedgeMiss === "fat") { base += 2; why.push(tr("cf.wedge.why.fat")); }
    if (S.wedgeMiss === "thin") { base -= 1; why.push(tr("cf.wedge.why.thin")); }
    if (S.wedgeGrass === "soft") { base += 2; why.push(tr("cf.wedge.why.soft")); }
    if (S.wedgeGrass === "tight") { base -= 2; why.push(tr("cf.wedge.why.tight")); }
    if (S.venue === "screen") why.push(tr("cf.wedge.why.screen"));

    const grind = S.wedgeTurf === "dig" ? tr("cf.wedge.grind.wide")
                : S.wedgeTurf === "sweep" ? tr("cf.wedge.grind.narrow")
                : tr("cf.wedge.grind.mid");

    const specs = lofts.map((lo, i) => {
      // 갭웨지 쪽은 풀스윙이 많아 바운스를 조금 낮추고, 로브·샌드는 높인다
      let b = base + (i === lofts.length - 1 ? 2 : i === 0 ? -2 : 0);
      if (S.wedgeBunker === "no" && i === lofts.length - 1) b += 2;
      b = Math.max(4, Math.min(14, b));
      return { loft: lo, bounce: b,
        use: i === 0 ? tr("cf.wedge.use.gap") : i === lofts.length - 1 ? tr("cf.wedge.use.lob") : tr("cf.wedge.use.main") };
    });
    if (S.wedgeBunker === "no") why.push(tr("cf.wedge.why.bunker"));

    // 샤프트 — 웨지는 아이언보다 조금 무겁게 가는 것이 정석
    const band = speedBand(S.carry7);
    const ironW = Math.round((band.w[0] + band.w[1]) / 2 + 48);
    const shaft = S.wedgeShaft === "same"
      ? { t: tr("cf.wedge.shaft.same"), b: tr("cf.wedge.shaft.same.b", { w: ironW }) }
      : S.wedgeShaft === "heavy"
      ? { t: tr("cf.wedge.shaft.heavy", { w: ironW + 10 }), b: tr("cf.wedge.shaft.heavy.b") }
      : { t: tr("cf.wedge.shaft.rec", { w: ironW + 10 }), b: tr("cf.wedge.shaft.rec.b") };

    const out = {
      pw, cnt, specs, grind, why, shaft,
      pick: pickTiers(WEDGES_ACTIVE.map((w) => ({ ...w, p: w.br === S.wedgeBrand ? 10 : 0 }))
                      .sort((a, b) => b.p - a.p), S.wedgeBrand, "br", null, null),
      grip: gripEngine(),
      note: tr("cf.wedge.note", { pw: pw, span: span, cnt: cnt, step: step }),
    };
    out.tldr = tldrWedge(out);
    return out;
  }

  /* ── 퍼터 ────────────────────────────────────────────────────
     궤도↔밸런스, 눈 위치↔길이, 그린 빠르기↔헤드 무게, 손 위치↔로프트 —
     퍼터 피팅에서 근거가 분명한 축들을 각각 따로 계산한다. */
  function putterEngine() {
    const arc = (!S.puttStroke || S.puttStroke === "unknown") ? "slight" : S.puttStroke;
    const notes = [], tips = [];
    if (S.puttStroke === "unknown")
      notes.push({ h: tr("cf.putt.arc.h"), b: tr("cf.putt.arc.b") });

    const scored = PUTTERS_ACTIVE.map((p) => {
      let s = 0; const why = [];
      if (p.arc === arc) { s += 40; why.push(tr("cf.pw.arc", { arc: arc === "straight" ? tr("cf.arc.straight") : arc === "arc" ? tr("cf.arc.big") : tr("cf.arc.slight"), bal: p.bal })); }
      else if ((arc === "slight" && p.arc !== "straight") || (p.arc === "slight")) s += 18;
      if ((S.puttMiss === "dir" || S.puttMiss === "both") && p.shape !== "블레이드") { s += 16; why.push(tr("cf.pw.mallet")); }
      if ((S.puttMiss === "dist" || S.puttMiss === "both") && p.shape === "블레이드") { s += 10; why.push(tr("cf.pw.blade")); }
      if (S.puttShort === "vary" && p.shape !== "블레이드") { s += 12; why.push(tr("cf.pw.vary")); }
      if (S.puttLook === "blade" && p.shape === "블레이드") { s += 14; why.push(tr("cf.pw.look")); }
      if (S.puttLook === "mallet" && p.shape !== "블레이드") { s += 14; why.push(tr("cf.pw.look")); }
      if (S.puttLine === "line" && p.shape !== "블레이드") { s += 10; why.push(tr("cf.pw.line")); }
      if (S.puttLine === "none" && p.shape === "블레이드") { s += 8; why.push(tr("cf.pw.noline")); }
      return { ...p, p: s, why };
    }).sort((a, b) => b.p - a.p);

    // ── 길이 — 정적 기준(키·손목바닥) + 눈 위치 자가진단
    const h = S.heightV || 172, wf = S.wristFloor;
    let len = wf ? (wf >= 92 ? 35 : wf >= 86 ? 34.5 : wf >= 80 ? 34 : 33.5)
                 : (h >= 183 ? 35 : h >= 173 ? 34.5 : h >= 165 ? 34 : h >= 157 ? 33.5 : 33);
    const lenWhy = [wf ? tr("cf.putt.len.wf", { wf: wf, len: len }) : tr("cf.putt.len.h", { h: h, len: len })];
    if (S.puttEye === "inside") { len -= 1; lenWhy.push(tr("cf.putt.len.inside")); }
    if (S.puttEye === "outside") { len += 0.5; lenWhy.push(tr("cf.putt.len.outside")); }
    if (S.puttLong === "yes" && S.puttEye !== "inside") { len -= 0.5; lenWhy.push(tr("cf.putt.len.long")); }
    len = Math.max(32, Math.min(35, len));
    const curLen = S.puttCurLen && S.puttCurLen !== "unknown" ? Number(S.puttCurLen) : null;
    if (curLen && curLen - len >= 1)
      notes.push({ h: tr("cf.putt.cut.h"), b: tr("cf.putt.cut.b", { cur: curLen, rec: len }) });

    // ── 헤드 무게 — 그린 빠르기가 정한다 (미국식 기준을 그대로 쓰면 한국에서 안 맞음)
    const hw = S.greenSpeed === "slow" ? { t: tr("cf.putt.hw.heavy"), b: tr("cf.putt.hw.heavy.b") }
             : S.greenSpeed === "fast" ? { t: tr("cf.putt.hw.light"), b: tr("cf.putt.hw.light.b") }
             : { t: tr("cf.putt.hw.std"), b: tr("cf.putt.hw.std.b") };

    // ── 로프트 — 손 위치(포워드 프레스)가 정한다
    const loft = S.puttHands === "forward" ? { t: "3.5 ~ 4°", b: tr("cf.putt.loft.fwd") }
               : S.puttHands === "back" ? { t: "1.5 ~ 2°", b: tr("cf.putt.loft.back") }
               : { t: "2.5 ~ 3°", b: tr("cf.putt.loft.std") };

    // ── 페이스 — 타감 선호 × 그린 빠르기
    const face = S.puttFeel === "firm" ? tr("cf.putt.face.milled")
               : S.puttFeel === "soft" ? tr("cf.putt.face.insert")
               : (S.greenSpeed === "slow" ? tr("cf.putt.face.milled.slow")
                                          : tr("cf.putt.face.insert.any"));

    // ── 그립
    let pg = PUTTER_GRIPS[0];
    if (S.puttGrip === "over") pg = PUTTER_GRIPS[1];
    if (S.puttYips === "yes" || (S.puttMiss === "dir" && S.puttShort === "vary")) pg = PUTTER_GRIPS[2];
    if (S.puttYips === "yes")
      tips.push(tr("cf.putt.tip.yips"));

    // ── 짧은 퍼트 미스 방향 → 정렬·라이각
    if (S.puttShort === "left")
      tips.push(tr("cf.putt.tip.left"));
    if (S.puttShort === "right")
      tips.push(tr("cf.putt.tip.right"));
    if (S.puttLine === "none")
      tips.push(tr("cf.putt.tip.noline"));
    if (S.greenSpeed === "unknown")
      tips.push(tr("cf.putt.tip.speed"));

    const out = {
      arc, len, lenWhy, notes, tips, hw, loft, face, curLen,
      grip: pg,
      pick: pickTiers(scored, S.putterBrand, "br", null, null),
      lie: tr("cf.putt.lie"),
      note: arc === "straight"
        ? tr("cf.putt.note.straight")
        : arc === "arc"
        ? tr("cf.putt.note.arc")
        : tr("cf.putt.note.slight"),
    };
    out.tldr = tldrPutt(out);
    return out;
  }

  /* ── 볼 ──────────────────────────────────────────────────────
     축은 셋뿐이라 규칙이 분명하다.
       ① 커버 — 숏게임 스핀은 커버가 만든다. 그린 주변 고민이면 우레탄.
       ② 컴프레션 성향 — 스피드가 눌러줄 수 있는 공이어야 한다. 겨울이면 한 단계 무르게.
       ③ 사이드스핀 — 많이 휘면 스핀 적은 공이 휘는 폭을 줄인다.
     ⚠️ 컴프레션 **수치**는 제조사가 공표하지 않는다 → 성향(소프트/미드/펌)으로만 말한다. */
  function ballEngine() {
    const notes = [], tips = [], why = [];
    /* 구질은 드라이버 판정이 있으면 그걸 쓰고, 없으면 이 블록에서 받은 답을 쓴다 */
    const shapeSaved = bagShape();
    const bendy = shapeSaved
      ? /슬라이스|훅/.test(shapeSaved)
      : (S.ballShape === "slice" || S.ballShape === "hook");

    // ① 컴프레션 성향 — 스피드가 정한다
    let feel = S.carry7 < 130 ? "소프트" : S.carry7 < 160 ? "미드" : "펌";
    why.push(tr("cf.ball.why.feel", { carry: carry7Txt(), feel: feel }));
    if (S.ballCold === "yes") {
      feel = feel === "펌" ? "미드" : "소프트";
      why.push(tr("cf.ball.why.cold"));
    }
    if (S.ballFeel === "soft" && feel === "펌") { feel = "미드"; why.push(tr("cf.ball.why.softer")); }
    if (S.ballFeel === "firm" && feel === "소프트") { feel = "미드"; why.push(tr("cf.ball.why.firmer")); }

    // ② 커버 — 볼 피팅의 핵심 축
    let cover = "아이오노머", coverWhy;
    if (S.ballShort === "roll") {
      cover = "우레탄";
      coverWhy = tr("cf.ball.cover.roll");
    } else if (S.ballShort === "control") {
      cover = "우레탄";
      coverWhy = tr("cf.ball.cover.control");
    } else if (S.scoreGrp === "100") {
      cover = "아이오노머";
      coverWhy = tr("cf.ball.cover.iono");
    } else {
      cover = "우레탄";
      coverWhy = tr("cf.ball.cover.ure");
    }
    why.push(coverWhy);

    // ③ 사이드스핀
    if (bendy) why.push(tr("cf.ball.why.bendy", { src: shapeSaved ? tr("cf.ball.why.bendy.drv", { n: shapeSaved }) : tr("cf.ball.why.bendy.self") }));

    // ④ 가격 현실 — 예산을 따로 묻지 않고 분실 개수로 대신한다
    let budgetCap = 3;
    if (S.ballLost === "many") {
      budgetCap = 1;
      notes.push({ h: tr("cf.ball.lost.h"), b: tr("cf.ball.lost.b") });
    } else if (S.ballLost === "some") budgetCap = 2;

    // 스코어링
    const want = { 소프트: 0, 미드: 1, 펌: 2 }[feel];
    const scored = BALLS.map((b) => {
      let p = 0; const w = [];
      if (b.cover === cover) { p += 40; w.push(tr("cf.bw.cover", { cover: b.cover, why: cover === "우레탄" ? tr("cf.ball.cover.ure.s") : tr("cf.ball.cover.iono.s") })); }
      else p -= 20;
      const fd = Math.abs(({ 소프트: 0, 미드: 1, 펌: 2 })[b.feel] - want);
      p += fd === 0 ? 26 : fd === 1 ? 12 : 0;
      if (fd === 0) w.push(tr("cf.bw.feel", { feel: b.feel }));
      if (S.ballShort === "roll" && b.spinShort === "높음") { p += 18; w.push(tr("cf.bw.spinshort")); }
      if (bendy && b.spinSide === "낮음") { p += 16; w.push(tr("cf.bw.spinside")); }
      if (bendy && b.spinShort === "높음") p -= 6;
      if (S.ballFeel === "soft" && b.feel === "소프트") { p += 8; w.push(tr("cf.feel.soft.ok")); }
      if (S.ballFeel === "firm" && b.feel === "펌") { p += 8; w.push(tr("cf.feel.firm.ok")); }
      if (S.ballFind === "often" && b.color) { p += 10; w.push(tr("cf.bw.color")); }
      if (b.pr > budgetCap) p -= 22;
      return { ...b, p, why: w };
    }).sort((a, b) => b.p - a.p);

    const pick = pickTiers(scored, "any", "br", null, null);

    // ⑤ 유지 판정 — 신뢰의 핵심
    const curCat = S.ball;
    const recCat = cover === "우레탄" ? (budgetCap >= 3 ? "urethane" : "mid") : "distance";
    const keep = S.ballShort === "none" && curCat === recCat;
    if (keep)
      notes.push({ h: tr("cf.ball.keep.h"), b: tr("cf.ball.keep.b") });
    if (curCat === "any")
      tips.push(tr("cf.ball.tip.any"));
    if (S.venue === "screen")
      tips.push(tr("cf.ball.tip.screen"));
    if (S.ballCold === "yes")
      tips.push(tr("cf.ball.tip.cold"));

    const out = { cover, feel, cat: BALL_CAT[recCat], recCat, keep, notes, tips, why, pick,
                  bendy, shapeSaved, budgetCap };
    out.tldr = tldrBall(out);
    return out;
  }
  const BALL_CAT = { urethane: tr("cf.ball.urethane"), mid: tr("cf.ball.cat.mid"), distance: tr("cf.ball.cat.dist") };

  function tldrBall(r) {
    const p = r.pick.main;
    const bits = [tr("cf.tldr.speed", { carry: carry7Txt(), sp: speedTxt(S.carry7) })];
    if (S.ballShort === "roll") bits.push(tr("cf.tldr.ball.roll"));
    else if (S.ballShort === "control") bits.push(tr("cf.tldr.ball.control"));
    if (r.bendy) bits.push(r.shapeSaved ? tr("cf.tldr.ball.bendy.drv", { n: r.shapeSaved }) : tr("cf.tldr.ball.bendy"));
    if (S.ballLost === "many") bits.push(tr("cf.tldr.ball.lost"));
    let act;
    if (S.ballLost === "many") act = tr("cf.tldr.ball.act.lost");
    else if (S.ball === "any") act = tr("cf.tldr.ball.act.any");
    else if (r.keep) act = tr("cf.tldr.ball.act.keep");
    else act = tr("cf.tldr.ball.act");
    return {
      read: tr("cf.tldr.read", { bits: bits.join(", ") }),
      fix: r.keep
        ? tr("cf.tldr.ball.fix.keep", { cat: r.cat })
        : tr("cf.tldr.ball.fix", { cover: r.cover, feel: r.feel, model: p.br + " " + p.m }),
      act,
    };
  }

  function renderBall() {
    const r = ballEngine(), p = r.pick;
    const spec = (b) => tr("cf.ball.spec", { pieces: b.pieces, cover: b.cover, feel: b.feel }) +
      (b.color ? tr("cf.ball.spec.color") : "");
    return `
      <div class="q-eyebrow">${tr("cf.res.ball")}</div>
      <div class="verdict"><span class="v-stamp${r.keep ? " keep" : ""}">${r.keep ? tr("cf.stamp.keep") : tr("cf.stamp.done")}</span>
        <div class="v-label">${tr("cf.club.ball")}</div>
        <div class="v-main">${tr("cf.ball.main", { cover: r.cover, feel: r.feel })}</div>
        <div class="v-sub">${tr("cf.ball.vsub")}</div>
      </div>
      ${tldrBlock(r.tldr)}
      ${noteHtml(r.notes)}
      ${pickStrip([
        { k: tr("cf.k.top"), v: `${p.main.br} ${p.main.m}`, s: spec(p.main) },
        { k: tr("cf.k.cover"), v: r.cover, s: r.cover === "우레탄" ? tr("cf.ball.cover.ure.s") : tr("cf.ball.cover.iono.s2") },
        { k: tr("cf.k.compression"), v: tr("cf.ball.feeltxt", { feel: r.feel }), s: tr("cf.ball.compression.note") },
      ])}
      ${venueBlock()}
      ${fold(tr("cf.fold.how"), `<div class="cf-read"><div class="cf-read-h">${tr("cf.ball.readh")}</div>` +
        r.why.map((w) => `<div class="cf-read-row"><div class="cf-read-b">${w}</div></div>`).join("") +
        `</div>`, tr("cf.fold.ball.sub"))}
      ${fold(tr("cf.fold.alt"),
        `${resCard(tr("cf.card.ball1"), `${p.main.br} ${p.main.m}`, spec(p.main),
           p.main.why.length ? p.main.why : [tr("cf.why.closest")], false, p.main)}
         ${p.alt ? altLead(tr("cf.w.ball")) + resCard(p.alt.br, `${p.alt.br} ${p.alt.m}`, spec(p.alt), p.alt.why, true, p.alt) : ""}
         ${olderCard(tr("cf.w.ball"), p.older, p.older ? spec(p.older) : "", p.olderBetter)}
         ${tipHtml(r.tips)}`, tr("cf.fold.alt.sub"))}
      ${cautionBlock([
        tr("cf.ball.caution1"),
        tr("cf.ball.caution2"),
        tr("cf.ball.caution3"),
      ])}
      ${saveRow("ball")}
      <div class="cf-foot">${tr("cf.foot.ball")}</div>`;
  }

  function label(v) { return { slice: "슬라이스", fade: "페이드", straight: "스트레이트", draw: "드로", hook: "훅" }[v] || "-"; }

  /* ───────── 내 백 저장 → AI 캐디 입력값 ─────────
     ⚠️ 2026-07-30 손봄 — 골프백 화면(사장님 지시 1)을 만들면서 저장 자체의 구멍 넷이 드러났다.
       ① saveBag 이 백을 **통째로 새로 만들어**, 먼저 맞춘 아이언·웨지·퍼터가 조용히 지워졌다.
          (아이언 → 드라이버 순서로 맞추면 아이언 저장분이 사라진다. 화면이 없어서 아무도 몰랐다.)
       ② 그립을 `r.grip.m` 으로 읽는데 gripEngine 은 `model` 로 준다 → **undefined 저장**.
       ③ 샤프트를 `r.shafts[0]`(브랜드를 무시한 전체 1위)로 저장 → **화면에 보인 추천과 다른 값**이 저장.
       ④ `shapeD` 는 옛 필드라 항상 null 이었다 → 구질 판정명(fl.n)을 넣는다.
     화면에 그대로 보이는 값이므로 여기서 틀리면 사용자가 바로 본다. */
  const BAG_KEY = "riweather.mybag";
  const BAG_ORDER = ["driver", "iron", "wedge", "putter", "ball"];
  function readBag() { return window.loadMyBag() || {}; }
  function writeBag(bag) {
    bag.ts = Date.now();
    try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch (_) {}
    return bag;
  }
  function saveBag(r) {
    const bag = readBag();                      // ← 다른 클럽 저장분을 지우지 않는다
    const sp = r.shaftPick.main;                // 화면에 띄운 1순위 그대로 저장한다
    const now = Date.now();
    bag.verdict = r.keep ? "keep" : "review";
    bag.band = { wLo: r.wLo, wHi: r.wHi, fx: r.fxT };
    bag.driver = r.keep
      ? { head: null, keep: true, grip: r.grip.model, ts: now, tldr: r.tldr || null,
          shaft: r.cur.label + (r.cur.w ? ` (${r.cur.w}g·${r.cur.fx})` : "") }
      : { head: `${r.headPick.main.br} ${r.headPick.main.m}`, keep: false,
          shaft: `${sp.m} ${sp.sp}` + (has(sp.w) ? ` (${sp.w}g·${sp.fx})` : ""),
          loft: r.lf.loft + "°", grip: r.grip.model, ts: now, tldr: r.tldr || null };
    bag.carry7 = S.carry7; bag.carryD = S.carryD;
    bag.shape = r.fl.n;                         // 구질 판정 — 옛 shapeD(항상 null) 자리
    return writeBag(bag);
  }
  window.loadMyBag = function () {
    try { return JSON.parse(localStorage.getItem(BAG_KEY) || "null"); } catch (_) { return null; }
  };
  /* 클럽별 결과를 같은 백에 덧붙인다 — 드라이버만 하고 그만둬도 저장이 남는다 */
  function saveBagPart(what, r) {
    const bag = readBag();
    const now = Date.now();
    if (what === "iron") {
      bag.iron = {
        mat: r.mat, weight: r.target,
        shaft: `${r.shaftPick.main.m} ${r.shaftPick.main.sp}`,
        head: `${r.headPick.main.br} ${r.headPick.main.m}`,
        lie: r.lie, len: r.lenAdj, grip: r.grip.model,
        ts: now, tldr: r.tldr || null,
      };
    } else if (what === "wedge") {
      bag.wedge = {
        lofts: r.specs.map((s) => s.loft),
        bounces: r.specs.map((s) => s.bounce),
        model: `${r.pick.main.br} ${r.pick.main.m}`,
        grip: r.grip.model, ts: now, tldr: r.tldr || null,
      };
    } else if (what === "putter") {
      bag.putter = {
        model: `${r.pick.main.br} ${r.pick.main.m}`,
        shape: r.pick.main.shape, len: r.len,
        grip: r.grip.m,                          // 퍼터 그립은 PUTTER_GRIPS 항목(m) 이 맞다
        ts: now, tldr: r.tldr || null,
      };
    } else if (what === "ball") {
      bag.ball = {
        cat: r.cat, model: r.pick.main ? `${r.pick.main.br} ${r.pick.main.m}` : null,
        cover: r.cover, feel: r.feel, recCat: r.recCat,
        cur: S.ball,                              // 지금 쓰는 공 — 드라이버 D10 을 대신한다
        ts: now, tldr: r.tldr || null,
      };
    }
    return writeBag(bag);
  }

  /* 추천 카드 한 장 — 선호 브랜드 1순위와 다른 브랜드 대안을 같은 모양으로 그린다 */
  /* 가격대·단종 표시 — 고르는 사람 입장에선 스펙만큼 중요한 정보다 */
  function tagsOf(x) {
    if (!x) return "";
    const t = [];
    // 가격대는 제조사 스펙표에 없다(실측분은 pr=null). 모르는 걸 적지 않는다.
    if (has(x.pr) && PRICE_LABEL[x.pr]) t.push(`<span class="r-tag">${PRICE_LABEL[x.pr]}</span>`);
    if (x.st === "old") t.push(`<span class="r-tag old">${tr("cf.tag.old")}</span>`);
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
    return `<div class="alt-lead">${tr("cf.altlead", { what: what })}</div>`;
  }
  /* 2차 제안 — 단종까지 포함하면 더 잘 맞는 게 있을 때만 내민다.
     한국은 중고 시장이 커서, 지난 모델이 값도 싸고 더 맞는 경우가 실제로 많다. */
  function olderCard(what, x, specTxt, better) {
    if (!x) return "";
    return `<div class="alt-lead">${better
        ? tr("cf.older.better", { what: what })
        : tr("cf.older.cheap", { what: what })}</div>` +
      resCard(tr("cf.card.used"), `${x.b || x.br || ""} ${x.m}`.trim(),
        specTxt, (x.why && x.why.length ? x.why : [tr("cf.why.closer")]), true, x) +
      `<div class="inline-note">${tr("cf.older.note")}</div>`;
  }
  function brandLine(pick) {
    if (!pick.wanted) return tr("cf.brandline.any");
    return pick.matched ? tr("cf.brandline.in", { brand: pick.wanted })
      : tr("cf.brandline.none", { brand: pick.wanted });
  }

  /* 제조사가 공개하지 않는 값(킥포인트·타감 등)은 비어 있다.
     "킥 null" 처럼 찍히면 안 되므로, 값이 없으면 그 항목을 통째로 뺀다.
     — 틀릴 수 있으면 아예 표시하지 않는다는 원칙. */
  const has = (v) => v !== null && v !== undefined && v !== "";
  const part = (label, v, unit) => (has(v) ? [`${label} ${v}${unit || ""}`] : []);

  function shaftSpec(s) {
    return [s.b, has(s.w) ? `${s.w}g` : null, s.fx]
      .filter(Boolean)
      .concat(part(tr("cf.k.torque"), s.tq, "°"), part(tr("cf.k.kick"), s.k), s.velo ? ["벨로코어"] : [])
      .join(" · ");
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
  const speedTxt = (c7) => c7 < 130 ? tr("cf.sp.1") : c7 < 145 ? tr("cf.sp.2") : c7 < 160 ? tr("cf.sp.3") : c7 < 172 ? tr("cf.sp.4") : tr("cf.sp.5");
  const gradeTxt = () => S.scoreGrp === "80" ? tr("cf.grade.80") : S.scoreGrp === "100" ? tr("cf.grade.100") : tr("cf.grade.90");
  /* 후반 체력 신호 — 엔진 세 곳이 같은 조건을 쓰므로 요약에서도 같은 판단을 써야 말이 어긋나지 않는다 */
  function tiredSignal() {
    return S.endur === "fadeLate" || S.endur === "weak" ||
           (S.auto.fade !== null && S.auto.fade >= 3);
  }
  /* 7번 캐리를 추정으로 채웠으면 요약에도 그렇게 밝힌다 — 단정하지 않는다(절대 원칙 2) */
  const carry7Txt = () => tr("cf.carry7txt", { m: S.carry7 }) + (S.carry7Est ? tr("cf.carry7txt.est") : "");

  /* ═══════════════════════════════════════════════════════════════
     세 문장 요약 — "이런 스윙의 골퍼 → 그래서 이 클럽 → 오늘은 이것부터"
     결과를 다 읽지 않아도 이 세 줄로 끝나야 한다(사장님 지시 2026-07-30).
     ═══════════════════════════════════════════════════════════════ */
  function tldrDriver(r) {
    const fl = r.fl, sp = r.shaftPick.main, hd = r.headPick.main;
    const ratio = S.carryD / S.carry7;
    const bits = [tr("cf.tldr.speed", { carry: carry7Txt(), sp: speedTxt(S.carry7) }),
                  tr("cf.tldr.drv.shape", { n: fl.n, path: fl.path, face: fl.face })];
    // 손해가 가장 큰 신호 하나만 더 붙인다 — 세 개를 넘기면 요약이 아니게 된다
    if (ratio < 1.50) bits.push(tr("cf.tldr.drv.smash"));
    else if (S.flight === "balloon") bits.push(tr("cf.tldr.drv.balloon"));
    else if (S.flight === "high") bits.push(tr("cf.tldr.drv.high"));
    else if (S.flight === "low") bits.push(tr("cf.tldr.drv.low"));
    else if (tiredSignal()) bits.push(tr("cf.tldr.tired"));
    const curL = S.curLoft && S.curLoft !== "unknown" ? Number(S.curLoft) : null;
    let act;
    if (S.faceV === "low" || S.teeHt === "low")
      act = tr("cf.tldr.drv.act.tee");
    else if (S.faceH === "vary" || S.carryVar === "big")
      act = tr("cf.tldr.drv.act.len");
    else if (curL !== null && Math.abs(curL - r.lf.loft) > 0.5)
      act = tr("cf.tldr.drv.act.loft", { cur: curL, rec: r.lf.loft });
    else if (S.flight === "balloon" && S.ball === "urethane")
      act = tr("cf.tldr.drv.act.ball");
    else if (S.teeHt === "vary")
      act = tr("cf.tldr.drv.act.teevary");
    else act = tr("cf.tldr.drv.act");
    return {
      read: tr("cf.tldr.read", { bits: bits.join(", ") }),
      fix: r.keep
        ? tr("cf.tldr.drv.fix.keep")
        : tr("cf.tldr.drv.fix", { head: hd.br + " " + hd.m,
            hspec: hd.draw ? tr("cf.spec.draw") : tr("cf.spec.forg", { f: hd.forg }),
            shaft: sp.m + " " + sp.sp, grip: r.grip.model, loft: r.lf.loft }),
      act,
    };
  }
  function tldrIron(r) {
    const sp = r.shaftPick.main, hd = r.headPick.main;
    const bits = [tr("cf.tldr.speed", { carry: carry7Txt(), sp: speedTxt(S.carry7) })];
    const miss = { thin: tr("cf.tldr.iron.thin"), fat: tr("cf.tldr.iron.fat"), dir: tr("cf.tldr.iron.dir") }[S.ironMiss];
    if (miss) bits.push(`<b>${miss}</b>`);
    if (S.ironTraj === "low") bits.push(tr("cf.tldr.iron.low"));
    else if (S.ironTraj === "high") bits.push(tr("cf.tldr.iron.high"));
    else if (!miss && tiredSignal()) bits.push(tr("cf.tldr.tired"));
    let act;
    if (r.setAdvice && r.setAdvice.drop.length)
      act = tr("cf.tldr.iron.act.set", { list: r.setAdvice.drop.join(" · ") });
    else if (r.keepish)
      act = tr("cf.tldr.iron.act.keep");
    else if (!r.lieConfident)
      act = tr("cf.tldr.iron.act.mark");
    else act = tr("cf.tldr.iron.act");
    return {
      read: tr("cf.tldr.read", { bits: bits.join(", ") }),
      fix: tr("cf.tldr.iron.fix", { head: hd.br + " " + hd.m, type: hd.type,
        shaft: sp.m + " " + sp.sp, mat: r.mat, w: r.target, grip: r.grip.model, lie: r.lie }),
      act,
    };
  }
  function tldrWedge(r) {
    const bits = [tr("cf.tldr.wedge.pw", { deg: r.pw }) + (r.pw <= 43 ? tr("cf.tldr.wedge.strong") : "")];
    const turf = { dig: tr("cf.tldr.wedge.dig"), sweep: tr("cf.tldr.wedge.sweep"), mid: tr("cf.tldr.wedge.mid") }[S.wedgeTurf];
    if (turf) bits.push(turf);
    if (S.wedgeMiss === "fat") bits.push(tr("cf.tldr.wedge.fat"));
    else if (S.wedgeMiss === "thin") bits.push(tr("cf.tldr.wedge.thin"));
    else if (S.wedgeBunker === "no") bits.push(tr("cf.tldr.wedge.bunker"));
    const act = S.wedgeBunker === "no"
      ? tr("cf.tldr.wedge.act.bunker")
      : tr("cf.tldr.wedge.act");
    return {
      read: tr("cf.tldr.read", { bits: bits.join(", ") }),
      fix: tr("cf.tldr.wedge.fix", { lofts: r.specs.map((s) => s.loft + "°").join(" · "),
        bounces: r.specs.map((s) => s.bounce + "°").join(" · "), grind: r.grind.split(" — ")[0],
        model: r.pick.main.br + " " + r.pick.main.m }),
      act,
    };
  }
  function tldrPutt(r) {
    const p = r.pick.main;
    const bits = [{ straight: tr("cf.tldr.putt.straight"), slight: tr("cf.tldr.putt.slight"),
                    arc: tr("cf.tldr.putt.arc") }[r.arc]];
    const miss = { dist: tr("cf.tldr.putt.dist"), dir: tr("cf.tldr.putt.dir"), both: tr("cf.tldr.putt.both") }[S.puttMiss];
    if (miss) bits.push(miss);
    if (S.greenSpeed === "slow") bits.push(tr("cf.tldr.putt.slow"));
    else if (S.greenSpeed === "fast") bits.push(tr("cf.tldr.putt.fast"));
    let act;
    if (r.curLen && r.curLen - r.len >= 1)
      act = tr("cf.tldr.putt.act.cut", { len: r.len });
    else if (S.puttEye === "inside")
      act = tr("cf.tldr.putt.act.eye");
    else if (S.puttYips === "yes")
      act = tr("cf.tldr.putt.act.grip");
    else act = tr("cf.tldr.putt.act");
    return {
      read: tr("cf.tldr.read", { bits: bits.filter(Boolean).join(", ") }),
      fix: tr("cf.tldr.putt.fix", { model: p.br + " " + p.m, shape: p.shape, bal: p.bal,
        len: r.len, hw: r.hw.t, loft: r.loft.t, grip: r.grip.m }),
      act,
    };
  }

  /* ── 드라이버 설명 ───────────────────────────────────────────── */
  function explainDriver(r) {
    const fl = r.fl, sp = r.shaftPick.main, hd = r.headPick.main;
    const c7 = S.carry7, ratio = (S.carryD / c7);
    const flightTxt = { low: tr("cf.flighttxt.low"), good: tr("cf.flighttxt.good"),
      balloon: tr("cf.flighttxt.balloon"), high: tr("cf.flighttxt.high"), unknown: tr("cf.flighttxt.unknown") }[S.flight] || "-";

    // ① 진단
    const read = readBlock(tr("cf.rd.drv.h"), [
      { k: tr("cf.k.speed"), v: tr("cf.rd.drv.speed.v", { m: c7, sp: speedTxt(c7), mph: r.mph }),
        b: tr("cf.rd.drv.speed.b") },
      { k: tr("cf.k.smash"), v: tr("cf.rd.drv.smash.v", { d: S.carryD, m: c7, r: ratio.toFixed(2) }),
        b: ratio < 1.50 ? tr("cf.rd.drv.smash.lo")
          : ratio > 1.68 ? tr("cf.rd.drv.smash.hi")
          : tr("cf.rd.drv.smash.ok") },
      { k: tr("cf.k.pathface"), v: tr("cf.rd.drv.path.v", { n: fl.n, path: fl.path, face: fl.face }),
        b: tr("cf.rd.drv.path.b", {
          start: S.startDir === "left" ? tr("cf.w.left") : S.startDir === "right" ? tr("cf.w.right") : tr("cf.w.straight"),
          curve: S.curveDir === "right" ? tr("cf.w.bendright") : S.curveDir === "left" ? tr("cf.w.bendleft") : tr("cf.w.bendnone"),
          face: fl.face }) },
      { k: tr("cf.k.launch"), v: flightTxt,
        b: S.flight === "balloon" ? tr("cf.rd.drv.launch.balloon")
          : S.flight === "low" ? tr("cf.rd.drv.launch.low")
          : S.flight === "high" ? tr("cf.rd.drv.launch.high")
          : tr("cf.rd.drv.launch.ok") },
      S.faceV && S.faceV !== "unknown" ? { k: tr("cf.k.facev"),
        v: S.faceV === "high" ? tr("cf.rd.drv.facev.high") : S.faceV === "low" ? tr("cf.rd.drv.facev.low") : tr("cf.opt.center"),
        b: S.faceV === "high" ? tr("cf.rd.drv.facev.high.b")
          : S.faceV === "low" ? tr("cf.rd.drv.facev.low.b")
          : tr("cf.rd.ok") } : null,
      S.faceH && S.faceH !== "unknown" ? { k: tr("cf.k.faceh"),
        v: { toe: tr("cf.rd.drv.faceh.toe"), heel: tr("cf.rd.drv.faceh.heel"), center: tr("cf.opt.center"), vary: tr("cf.rd.drv.faceh.vary") }[S.faceH],
        b: S.faceH === "vary" ? tr("cf.rd.drv.faceh.vary.b")
          : S.faceH === "heel" ? tr("cf.rd.drv.faceh.heel.b")
          : S.faceH === "toe" ? tr("cf.rd.drv.faceh.toe.b") : tr("cf.rd.drv.faceh.center.b") } : null,
      { k: tr("cf.k.endur"), v: { strong: tr("cf.endur.s.strong"), fadeLate: tr("cf.endur.s.fade"), weak: tr("cf.endur.s.weak") }[S.endur] || "-",
        b: S.endur === "strong" ? tr("cf.rd.drv.endur.strong")
          : tr("cf.rd.drv.endur.tired") },
    ]);

    // ② 기준 → ③ 연결 → ④ 기대
    const why = story(tr("cf.story.why"), [
      tr("cf.ex.drv.loft", { deg: r.lf.loft, why: r.lf.why.join(". ") }),
      tr("cf.ex.drv.shaft", { model: sp.m + " " + sp.sp, w: sp.w, lo: r.wLo, hi: r.wHi, fx: sp.fx,
        tempo: S.tempo === "fast" ? tr("cf.ex.drv.tempo.fast") : tr("cf.ex.drv.tempo.now") })
        + (has(sp.tq) ? tr("cf.ex.drv.torque", { tq: sp.tq,
            role: fl.tq === "high" ? tr("cf.ex.drv.torque.hi") : fl.tq === "low" ? tr("cf.ex.drv.torque.lo") : tr("cf.ex.drv.torque.mid") }) : "")
        + (has(sp.k) ? tr("cf.ex.drv.kick", { k: sp.k,
            role: S.flight === "balloon" || S.flight === "high" ? tr("cf.ex.drv.kick.down") : S.flight === "low" ? tr("cf.ex.drv.kick.up") : tr("cf.ex.drv.kick.keep") }) : ""),
      tr("cf.ex.drv.head", { model: hd.br + " " + hd.m, forg: hd.forg, spin: hd.spin,
        bias: hd.draw ? tr("cf.ex.drv.head.drawtag") : tr("cf.ex.drv.head.neutraltag"),
        role: hd.draw ? tr("cf.ex.drv.head.draw", { n: fl.n }) : tr("cf.ex.drv.head.neutral"),
        grade: gradeTxt(),
        tail: hd.forg >= 4 ? tr("cf.ex.drv.head.forg") : tr("cf.ex.drv.head.adj") }),
      tr("cf.ex.len", { len: r.ln.len, why: r.ln.why }),
      tr("cf.ex.grip", { model: r.grip.model, why: r.grip.why.join(". ") }),
    ]);

    const expect = story(tr("cf.story.expect"), [
      r.keep
        ? tr("cf.ex.drv.exp.keep")
        : (S.flight === "balloon" || S.flight === "high")
          ? tr("cf.ex.drv.exp.spin")
        : S.flight === "low"
          ? tr("cf.ex.drv.exp.launch")
        : tr("cf.ex.drv.exp.band"),
      (S.faceV === "low" || S.teeHt === "low")
        ? tr("cf.ex.drv.exp.tee")
        : null,
      (S.faceH === "vary" || S.carryVar === "big")
        ? tr("cf.ex.drv.exp.len")
        : null,
    ], "good");

    const caution = cautionBlock([
      tr("cf.caution.calc"),
      r.cur.w ? tr("cf.caution.jump", { w: r.cur.w }) : tr("cf.caution.noshaft"),
      tr("cf.caution.test"),
    ]);

    return { read, detail: why + expect, caution };
  }

  /* ── 아이언 설명 ─────────────────────────────────────────────── */
  function explainIron(r) {
    const sp = r.shaftPick.main, hd = r.headPick.main;
    const read = readBlock(tr("cf.rd.iron.h"), [
      { k: tr("cf.k.speed"), v: tr("cf.rd.iron.speed.v", { m: S.carry7, sp: speedTxt(S.carry7) }),
        b: tr("cf.rd.iron.speed.b", { w: r.target, fx: r.fxT.join("/") }) },
      { k: tr("cf.k.impact"), v: { thin: tr("cf.rd.iron.thin"), fat: tr("cf.rd.iron.fat"), dir: tr("cf.rd.iron.dir"), none: tr("cf.rd.iron.nonemiss") }[S.ironMiss] || "-",
        b: S.ironMiss === "thin" ? tr("cf.rd.iron.thin.b")
          : S.ironMiss === "fat" ? tr("cf.rd.iron.fat.b")
          : S.ironMiss === "dir" ? tr("cf.rd.iron.dir.b") : tr("cf.rd.ok") },
      { k: tr("cf.k.traj"), v: { low: tr("cf.rd.iron.traj.low"), mid: tr("cf.rd.iron.traj.mid"), high: tr("cf.rd.iron.traj.high"), unknown: tr("cf.opt.unknown") }[S.ironTraj] || "-",
        b: S.ironTraj === "low" ? tr("cf.rd.iron.traj.low.b")
          : S.ironTraj === "high" ? tr("cf.rd.iron.traj.high.b") : tr("cf.rd.iron.traj.ok") },
      { k: tr("cf.k.flight"), v: { slice: tr("cf.rd.shape.slice"), straight: tr("cf.rd.shape.straight"), hook: tr("cf.rd.shape.hook") }[S.shapeI] || "-",
        b: S.shapeI === "slice" ? tr("cf.rd.iron.slice.b")
          : S.shapeI === "hook" ? tr("cf.rd.iron.hook.b") : tr("cf.rd.iron.shape.ok") },
      { k: tr("cf.k.liesrc"), v: r.lie,
        b: r.lieConfident ? tr("cf.rd.iron.lie.sure") : tr("cf.rd.iron.lie.unsure") },
      { k: tr("cf.k.bodyissue"), v: (S.bodyIssue || []).includes("none") || !(S.bodyIssue || []).length ? tr("cf.rd.iron.body.none") : tr("cf.rd.iron.body.some"),
        b: (S.bodyIssue || []).some((x) => x === "wrist" || x === "back")
          ? tr("cf.rd.iron.body.down") : tr("cf.rd.iron.body.keep") },
    ]);

    const why = story(tr("cf.story.why"), [
      tr("cf.ex.iron.mat", { mat: r.mat, w: r.target,
        b: r.mat === "스틸" ? tr("cf.ex.iron.mat.steel") : tr("cf.ex.iron.mat.graph") }),
      tr("cf.ex.iron.shaft", { model: sp.m + " " + sp.sp, w: sp.w })
        + (has(sp.k) ? tr("cf.ex.iron.kick", { k: sp.k,
            role: S.ironTraj === "low" ? tr("cf.ex.iron.kick.up") : S.ironTraj === "high" ? tr("cf.ex.iron.kick.down") : tr("cf.ex.iron.kick.keep") }) : "")
        + (has(sp.feel) ? tr("cf.ex.iron.feel", { feel: sp.feel,
            tail: S.ironFeel === "any" || !S.ironFeel ? tr("cf.ex.iron.feel.any") : tr("cf.ex.iron.feel.match") }) : ""),
      tr("cf.ex.iron.head", { model: hd.br + " " + hd.m, type: hd.type, forg: hd.forg, off: hd.off,
        b: S.ironLook === "classic" ? tr("cf.ex.iron.head.classic") : S.ironLook === "forgiving" ? tr("cf.ex.iron.head.forgiving") : tr("cf.ex.iron.head.grade", { grade: gradeTxt() }) }),
      tr("cf.ex.iron.lie", { lie: r.lie, len: r.lenAdj, why: r.lieWhy.join(". ") }),
      r.setAdvice ? tr("cf.ex.iron.set", { b: r.setAdvice.b }) : null,
      tr("cf.ex.grip", { model: r.grip.model, why: r.grip.why.join(". ") }),
    ]);

    const expect = story(tr("cf.story.expect"), [
      S.ironTraj === "low" ? tr("cf.ex.iron.exp.traj")
        : S.ironMiss === "thin" ? tr("cf.ex.iron.exp.thin")
        : tr("cf.ex.iron.exp.band"),
      r.lieConfident
        ? tr("cf.ex.iron.exp.lie")
        : tr("cf.ex.iron.exp.mark"),
      r.setAdvice && r.setAdvice.drop.length
        ? tr("cf.ex.iron.exp.set")
        : null,
    ], "good");

    const caution = cautionBlock([
      tr("cf.caution.lie"),
      r.keepish ? tr("cf.caution.iron.keep", { model: S.ironCurModel }) : null,
      tr("cf.caution.spec"),
    ]);

    return { read, detail: why + expect, caution };
  }

  /* ── 웨지 설명 ───────────────────────────────────────────────── */
  function explainWedge(r) {
    const read = readBlock(tr("cf.rd.wedge.h"), [
      { k: tr("cf.eb.pwloft"), v: `${r.pw}°`,
        b: r.pw <= 43 ? tr("cf.rd.wedge.strong")
          : tr("cf.rd.wedge.std") },
      { k: tr("cf.k.turf"), v: { dig: tr("cf.rd.wedge.dig"), sweep: tr("cf.rd.wedge.sweep"), mid: tr("cf.w2.mid.s") }[S.wedgeTurf] || "-",
        b: S.wedgeTurf === "dig" ? tr("cf.rd.wedge.dig.b")
          : S.wedgeTurf === "sweep" ? tr("cf.rd.wedge.sweep.b")
          : tr("cf.rd.wedge.mid.b") },
      { k: tr("cf.eb.w4"), v: { soft: tr("cf.rd.wedge.grass.soft"), mid: tr("cf.opt.normal"), tight: tr("cf.rd.wedge.grass.tight"), unknown: tr("cf.opt.unknown") }[S.wedgeGrass] || "-",
        b: S.wedgeGrass === "tight" ? tr("cf.rd.wedge.grass.tight.b")
          : S.wedgeGrass === "soft" ? tr("cf.rd.wedge.grass.soft.b") : tr("cf.rd.wedge.grass.std") },
      { k: tr("cf.eb.w3"), v: { fat: tr("cf.rd.wedge.miss.fat"), thin: tr("cf.rd.wedge.miss.thin"), none: tr("cf.rd.wedge.miss.none") }[S.wedgeMiss] || "-",
        b: S.wedgeMiss === "fat" ? tr("cf.rd.wedge.miss.fat.b") : S.wedgeMiss === "thin" ? tr("cf.rd.wedge.miss.thin.b") : tr("cf.rd.wedge.miss.none.b") },
      { k: tr("cf.k.bunker"), v: S.wedgeBunker === "no" ? tr("cf.rd.wedge.bunker.no") : tr("cf.rd.wedge.bunker.ok"),
        b: S.wedgeBunker === "no" ? tr("cf.rd.wedge.bunker.no.b") : tr("cf.rd.wedge.bunker.ok.b") },
    ]);

    const why = story(tr("cf.story.why.set"), [
      tr("cf.ex.wedge.lofts", { lofts: r.specs.map((s) => s.loft + "°").join(" · "), note: r.note }),
      tr("cf.ex.wedge.bounce", { bounces: r.specs.map((s) => s.bounce + "°").join(" · "), why: r.why.join(". ") }),
      tr("cf.ex.wedge.grind", { grind: r.grind }),
      tr("cf.ex.wedge.shaft", { t: r.shaft.t, b: r.shaft.b }),
      tr("cf.ex.wedge.model", { model: r.pick.main.br + " " + r.pick.main.m, line: brandLine(r.pick) }),
    ]);

    const expect = story(tr("cf.story.expect"), [
      tr("cf.ex.wedge.exp.gap"),
      S.wedgeMiss === "fat" ? tr("cf.ex.wedge.exp.fat") : null,
      S.wedgeBunker === "no" ? tr("cf.ex.wedge.exp.bunker") : null,
    ], "good");

    const caution = cautionBlock([
      tr("cf.caution.wedge.bounce"),
      S.venue === "screen" ? tr("cf.caution.wedge.screen") : null,
      tr("cf.caution.wedge.wear"),
    ]);

    return { read, detail: why + expect, caution };
  }

  /* ── 퍼터 설명 ───────────────────────────────────────────────── */
  function explainPutt(r) {
    const p = r.pick.main;
    const read = readBlock(tr("cf.rd.putt.h"), [
      { k: tr("cf.eb.u1"), v: { straight: tr("cf.rd.putt.arc.straight"), slight: tr("cf.rd.putt.arc.slight"), arc: tr("cf.rd.putt.arc.big") }[r.arc],
        b: tr("cf.rd.putt.arc.b") },
      { k: tr("cf.k.worry"), v: { dist: tr("cf.u2.dist"), dir: tr("cf.opt.dir"), both: tr("cf.rd.putt.both"), none: tr("cf.rd.putt.nonemiss") }[S.puttMiss] || "-",
        b: S.puttMiss === "dir" ? tr("cf.rd.putt.dir.b")
          : S.puttMiss === "dist" ? tr("cf.rd.putt.dist.b") : tr("cf.rd.ok") },
      { k: tr("cf.eb.u3"), v: { left: tr("cf.rd.putt.short.left"), right: tr("cf.rd.putt.short.right"), vary: tr("cf.rd.putt.short.vary"), none: tr("cf.rd.putt.short.none") }[S.puttShort] || "-",
        b: S.puttShort === "left" ? tr("cf.rd.putt.short.left.b")
          : S.puttShort === "right" ? tr("cf.rd.putt.short.right.b") : "" },
      { k: tr("cf.eb.u9"), v: { slow: tr("cf.gs.slow"), mid: tr("cf.opt.normal"), fast: tr("cf.gs.fast"), unknown: tr("cf.opt.unknown") }[S.greenSpeed] || "-",
        b: S.greenSpeed === "slow" ? tr("cf.rd.putt.green.slow")
          : S.greenSpeed === "fast" ? tr("cf.rd.putt.green.fast") : tr("cf.rd.putt.green.std") },
      S.puttEye && S.puttEye !== "unknown" ? { k: tr("cf.eb.u8"),
        v: { on: tr("cf.rd.putt.eye.on"), inside: tr("cf.rd.putt.eye.inside"), outside: tr("cf.rd.putt.eye.outside") }[S.puttEye],
        b: S.puttEye === "inside" ? tr("cf.rd.putt.eye.inside.b") : S.puttEye === "on" ? tr("cf.rd.putt.eye.on.b") : tr("cf.rd.putt.eye.outside.b") } : null,
      { k: tr("cf.eb.u10"), v: { forward: tr("cf.rd.putt.hands.fwd"), level: tr("cf.rd.putt.hands.level"), back: tr("cf.rd.putt.hands.back"), unknown: tr("cf.opt.unknown") }[S.puttHands] || "-",
        b: S.puttHands === "forward" ? tr("cf.rd.putt.hands.fwd.b") : "" },
    ]);

    const why = story(tr("cf.story.why"), [
      tr("cf.ex.putt.model", { model: p.br + " " + p.m, shape: p.shape, bal: p.bal, note: r.note }),
      tr("cf.ex.putt.len", { len: r.len, why: r.lenWhy.join(". ") }),
      tr("cf.ex.putt.hw", { t: r.hw.t, b: r.hw.b }),
      tr("cf.ex.putt.loft", { t: r.loft.t, b: r.loft.b }),
      tr("cf.ex.putt.face", { face: r.face }),
      tr("cf.ex.putt.grip", { m: r.grip.m, spec: r.grip.spec, why: r.grip.why }),
      S.puttLine === "line" ? tr("cf.ex.putt.line") : S.puttLine === "none" ? tr("cf.ex.putt.noline") : null,
    ]);

    const expect = story(tr("cf.story.expect"), [
      r.curLen && r.curLen - r.len >= 1
        ? tr("cf.ex.putt.exp.cut", { cur: r.curLen, rec: r.len })
        : tr("cf.ex.putt.exp.bal"),
      S.greenSpeed === "slow" ? tr("cf.ex.putt.exp.slow") : null,
      S.puttYips === "yes" ? tr("cf.ex.putt.exp.yips") : null,
    ], "good");

    const caution = cautionBlock([
      tr("cf.caution.putt.feel"),
      tr("cf.caution.putt.lie"),
      S.puttStroke === "unknown" ? tr("cf.caution.putt.arc") : null,
      S.venue === "screen" && S.greenSpeed === "unknown" ? tr("cf.caution.putt.screen") : null,
    ]);

    return { read, detail: why + expect, caution };
  }

  /* 결과 화면 공통 조각 */
  function noteHtml(notes) {
    return (notes || []).map((n) => `<div class="warn-card"><b>${n.h}</b> — ${n.b}</div>`).join("");
  }
  function tipHtml(tips) {
    if (!tips || !tips.length) return "";
    return `<div class="section-h">${tr("cf.sec.tips")}</div>` +
      tips.map((t) => `<div class="tip-line">· ${t}</div>`).join("");
  }
  /* 그립 결과 — 드라이버·아이언·웨지가 같은 모양으로 쓴다 */
  function gripHtml(g) {
    return `<div class="section-h">${tr("cf.k.grip")} <span class="cnt">${g.size}</span></div>` +
      resCard(tr("cf.k.grip"), g.model, g.spec, g.why.slice(0, 4)) +
      (g.measure ? `<div class="inline-note">${tr("cf.grip.measure")}</div>` : "");
  }
  /* ═══════════════════════════════════════════════════════════════
     결과를 짧게 — 3문장 요약 + 접이식 상세 (사장님 지시 2026-07-30)
     "내용이 너무 많아서 다 읽어볼 엄두가 안 난다."
     설명을 없애지 않는다. **순서를 바꾼다** — 결론을 먼저 보여주고 근거를 접는다.
     ═══════════════════════════════════════════════════════════════ */
  /* 세 줄 요약. read(진단) → fix(처방) → act(오늘 할 것) 순서는 어느 클럽이든 같다. */
  function tldrBlock(t) {
    if (!t || !t.read) return "";
    return `<div class="cf-tldr">
      <div class="cf-tldr-r"><span>${tr("cf.tldr.k.read")}</span><p>${t.read}</p></div>
      ${t.fix ? `<div class="cf-tldr-r"><span>${tr("cf.tldr.k.fix")}</span><p>${t.fix}</p></div>` : ""}
      ${t.act ? `<div class="cf-tldr-r act"><span>${tr("cf.tldr.k.act")}</span><p>${t.act}</p></div>` : ""}
    </div>`;
  }
  /* 1순위만 한 줄씩 — 대안·단종은 접힌 쪽으로 내린다 */
  function pickStrip(rows) {
    const list = rows.filter((r) => r && has(r.v));
    if (!list.length) return "";
    return `<div class="cf-picks">` + list.map((r) =>
      `<div class="cf-pick"><span class="cf-pick-k">${r.k}</span>
        <div class="cf-pick-v"><b>${r.v}</b>${has(r.s) ? `<small>${r.s}</small>` : ""}</div>
      </div>`).join("") + `</div>`;
  }
  /* 접이식 — <details> 대신 앱의 다른 버튼과 같은 모양으로 만든다(스타일 통일·검사 용이).
     펼침 상태는 저장하지 않는다. 결과는 언제 열어도 요약부터 시작해야 한다. */
  let foldSeq = 0;
  function fold(title, inner, sub) {
    if (!inner) return "";
    const id = "cffold" + (++foldSeq);
    return `<div class="cf-fold">
      <button class="cf-fold-h" data-fold="${id}" aria-expanded="false">
        <span class="cf-fold-t">${title}${sub ? `<small>${sub}</small>` : ""}</span>
        <span class="cf-fold-x" aria-hidden="true">＋</span></button>
      <div class="cf-fold-b" id="${id}" hidden>${inner}</div>
    </div>`;
  }
  /* 주의사항은 접지 않는다 — 이게 있어야 나머지가 믿긴다.
     다만 세 문단을 다 펴두면 요약을 만든 뜻이 없어지므로 첫 문단만 남기고 나머지를 접는다. */
  function cautionBlock(paras) {
    const ps = (paras || []).filter(Boolean);
    if (!ps.length) return "";
    const rest = ps.slice(1).map((p) => `<p>${p}</p>`).join("");
    return `<div class="cf-story warn">
      <div class="cf-story-h">${tr("cf.caution.h")}</div>
      <p>${ps[0]}</p>
      ${rest ? fold(tr("cf.caution.more", { n: ps.length - 1 }), rest) : ""}
    </div>`;
  }

  /* ── 스크린 위주 골퍼 전용 (사장님 지시 3, 2026-07-30) ──────────────
     한국은 스크린의 성지다. 스크린과 필드는 세 가지가 다르고 그 셋이 전부 스펙으로 이어진다.
     점수만 조용히 바꾸면 "반영했다"고 할 수 없다 — 무엇이 왜 달라졌는지 글로 남긴다. */
  function screenRules() {
    const on = [];
    if (S.carry7Src === "screen")
      on.push(S.carry7Kind === "carry"
        ? tr("cf.sr.carry")
        : tr("cf.sr.total", { m: S.carry7 }));
    if (S.club === "driver")
      on.push(tr("cf.sr.driver"));
    if (S.club === "iron") {
      on.push(tr("cf.sr.iron"));
      if ((S.bodyIssue || []).includes("wrist"))
        on.push(tr("cf.sr.iron.wrist"));
    }
    if (S.club === "wedge")
      on.push(tr("cf.sr.wedge"));
    if (S.club === "putter" && S.greenSpeed === "unknown")
      on.push(tr("cf.sr.putter"));
    return on;
  }
  function venueBlock() {
    if (S.venue !== "screen") return "";      // 반반(both)은 규칙만 걸고 이 글은 생략한다
    const on = screenRules();
    return `<div class="cf-story">
      <div class="cf-story-h">${tr("cf.venue.h")}</div>
      <p>${tr("cf.venue.p0")}</p>
      <p>${tr("cf.venue.p1")}</p>
      <p>${tr("cf.venue.p2")}</p>
      <p>${tr("cf.venue.p3")}</p>
      ${on.length ? `<p>${tr("cf.venue.applied", { list: on.join(" · ") })}</p>` : ""}
    </div>`;
  }

  const saveRow = (what) => `
      <div class="btn-row" style="margin-top:16px">
        <button class="cf-btn accent" data-savebag="${what}">${tr("cf.save.btn")}</button>
      </div>
      <div id="cf-bag-saved" class="inline-note" style="display:none">${tr("cf.save.done")}
        <div class="btn-row" style="margin-top:10px"><button class="cf-btn ghost" data-jump="bag">${tr("cf.save.openbag")}</button></div></div>
      <div class="btn-row"><button class="cf-btn" data-jump="pick">${tr("cf.save.another")}</button></div>
      <div class="restart-row"><button class="cf-btn ghost" data-restart>${tr("cf.save.restart")}</button></div>`;

  /* ───────── 결과 렌더 (드라이버) ───────── */
  function renderResult() {
    const r = engine(), ex = explainDriver(r);
    const brandTxt = (S.brand && S.brand !== "any") ? S.brand : tr("cf.brand.all");
    const verdict = r.keep
      ? `<div class="verdict"><span class="v-stamp keep">${tr("cf.stamp.keep")}</span>
          <div class="v-label">${tr("cf.v.label")}</div>
          <div class="v-main">${tr("cf.v.keep.main")}</div>
          <div class="v-sub">${tr("cf.v.keep.sub", { label: r.cur.label, w: r.cur.w, fx: r.cur.fx, lo: r.wLo, hi: r.wHi, band: r.fxT.join("/") })}</div>
        </div>`
      : `<div class="verdict"><span class="v-stamp">${tr("cf.stamp.review")}</span>
          <div class="v-label">${tr("cf.v.label")}</div>
          <div class="v-main">${tr("cf.v.review.main")}</div>
          <div class="v-sub">${tr("cf.v.review.sub", { m: S.carry7, mph: r.mph, lo: r.wLo, hi: r.wHi, band: r.fxT.join("/") })}</div>
        </div>`;

    const sp = r.shaftPick, hp = r.headPick;
    const shaftHtml =
      resCard(tr("cf.card.shaft1"), `${sp.main.m} ${sp.main.sp}`, shaftSpec(sp.main), sp.main.why, false, sp.main) +
      (sp.alt ? altLead(tr("cf.k.shaft")) + resCard(`${sp.alt.b}`, `${sp.alt.m} ${sp.alt.sp}`,
        shaftSpec(sp.alt), sp.alt.why, true, sp.alt) : "") +
      olderCard(tr("cf.k.shaft"), sp.older, sp.older ? shaftSpec(sp.older) : "", sp.olderBetter);
    const headSpec = (h) => tr("cf.spec.head", { forg: h.forg, spin: h.spin,
      bias: h.draw ? tr("cf.spec.draw") : tr("cf.spec.neutral") });
    const headHtml =
      resCard(tr("cf.card.head1"), `${hp.main.br} ${hp.main.m}`, headSpec(hp.main),
        hp.main.why.length ? hp.main.why : [tr("cf.why.bestinbrand")], false, hp.main) +
      (hp.alt ? altLead(tr("cf.k.head")) + resCard(`${hp.alt.br}`, `${hp.alt.br} ${hp.alt.m}`,
        headSpec(hp.alt), hp.alt.why.length ? hp.alt.why : [tr("cf.why.bestother")], true, hp.alt) : "") +
      olderCard(tr("cf.k.head"), hp.older, hp.older ? headSpec(hp.older) : "", hp.olderBetter);

    return `
      <div class="q-eyebrow">${tr("cf.res.driver", { brand: brandTxt })}</div>
      ${verdict}
      ${tldrBlock(r.tldr)}
      ${noteHtml(r.notes)}
      ${pickStrip([
        { k: tr("cf.k.loft"), v: `${r.lf.loft}°`, s: tr("cf.s.hosel") },
        { k: tr("cf.k.len"), v: r.ln.len, s: tr("cf.s.stdlen") },
        { k: tr("cf.k.head"), v: `${hp.main.br} ${hp.main.m}`, s: headSpec(hp.main) },
        { k: tr("cf.k.shaft"), v: `${sp.main.m} ${sp.main.sp}`, s: shaftSpec(sp.main) },
        { k: tr("cf.k.grip"), v: r.grip.model, s: r.grip.spec },
      ])}
      ${venueBlock()}
      ${fold(tr("cf.fold.how"), ex.read, tr("cf.fold.how.drv"))}
      ${fold(tr("cf.fold.detail"),
        `<div class="section-h">${tr("cf.k.loft")} <span class="cnt">${tr("cf.sec.loft.cnt")}</span></div>
         ${resCard(tr("cf.k.loft"), `${r.lf.loft}°`, tr("cf.s.hosel2"), r.lf.why)}
         <div class="section-h">${tr("cf.k.len")}</div>
         ${resCard(tr("cf.k.len"), r.ln.len, tr("cf.s.stdlen"), [r.ln.why])}
         <div class="section-h">${tr("cf.k.shaft")} <span class="cnt">${brandLine(sp)}</span></div>
         ${shaftHtml}
         <div class="section-h">${tr("cf.k.head")} <span class="cnt">${brandLine(hp)}</span></div>
         ${headHtml}
         ${gripHtml(r.grip)}
         ${ex.detail}
         ${tipHtml(r.tips)}`, tr("cf.fold.detail.sub"))}
      ${ex.caution}
      ${saveRow("driver")}
      <div class="cf-foot">${tr("cf.foot.driver")}</div>`;
  }

  /* ───────── 결과 렌더 (아이언) ───────── */
  function renderIron() {
    const r = ironEngine(), ex = explainIron(r);
    const sp = r.shaftPick, hp = r.headPick;
    const headSpec = (h) => tr("cf.spec.ironhead", { type: h.type, forg: h.forg, off: h.off });
    return `
      <div class="q-eyebrow">${tr("cf.res.iron")}</div>
      <div class="verdict"><span class="v-stamp${r.keepish ? " keep" : ""}">${r.keepish ? tr("cf.stamp.adjfirst") : tr("cf.stamp.done")}</span>
        <div class="v-label">${tr("cf.club.iron")}</div>
        <div class="v-main">${tr("cf.iron.main", { mat: r.mat, w: r.target, fx: r.fxT.join("/") })}</div>
        <div class="v-sub">${tr("cf.iron.vsub", { m: S.carry7 })}</div>
      </div>
      ${tldrBlock(r.tldr)}
      ${noteHtml(r.notes)}
      ${pickStrip([
        { k: tr("cf.k.head"), v: `${hp.main.br} ${hp.main.m}`, s: headSpec(hp.main) },
        { k: tr("cf.k.shaft"), v: `${sp.main.m} ${sp.main.sp}`,
          s: [sp.main.mat, has(sp.main.w) ? tr("cf.s.about", { w: sp.main.w }) : null, sp.main.fx].filter(Boolean).join(" · ") },
        { k: tr("cf.k.lielen"), v: `${r.lie} · ${r.lenAdj}`,
          s: r.lieConfident ? tr("cf.s.lie.sure") : tr("cf.s.lie.unsure") },
        { k: tr("cf.k.grip"), v: r.grip.model, s: r.grip.spec },
      ])}
      ${r.setAdvice && r.setAdvice.drop.length ? `<div class="warn-card"><b>${tr("cf.k.set")}</b> — ${r.setAdvice.b}</div>` : ""}
      ${venueBlock()}
      ${fold(tr("cf.fold.how"), ex.read, tr("cf.fold.how.iron"))}
      ${fold(tr("cf.fold.detail"),
        `<div class="section-h">${tr("cf.k.shaft")} <span class="cnt">${brandLine(sp)}</span></div>
         ${resCard(tr("cf.card.shaft1"), `${sp.main.m} ${sp.main.sp}`,
           [sp.main.b, sp.main.mat, tr("cf.s.about", { w: sp.main.w }), sp.main.fx]
             .concat(part(tr("cf.k.kick"), sp.main.k), has(sp.main.feel) ? [sp.main.feel] : [])
             .filter(Boolean).join(" · "), sp.main.why, false, sp.main)}
         ${sp.alt ? altLead(tr("cf.k.shaft")) + resCard(sp.alt.b, `${sp.alt.m} ${sp.alt.sp}`,
           `${sp.alt.mat} · ${tr("cf.s.about", { w: sp.alt.w })} · ${sp.alt.fx}`, sp.alt.why, true, sp.alt) : ""}
         ${olderCard(tr("cf.k.shaft"), sp.older, sp.older ? `${sp.older.mat} · ${tr("cf.s.about", { w: sp.older.w })} · ${sp.older.fx}` : "", sp.olderBetter)}
         <div class="section-h">${tr("cf.k.head")} <span class="cnt">${brandLine(hp)}</span></div>
         ${resCard(tr("cf.card.head1"), `${hp.main.br} ${hp.main.m}`, headSpec(hp.main),
           hp.main.why.length ? hp.main.why : [tr("cf.why.bestinbrand")], false, hp.main)}
         ${hp.alt ? altLead(tr("cf.k.head")) + resCard(hp.alt.br, `${hp.alt.br} ${hp.alt.m}`,
           headSpec(hp.alt), hp.alt.why, true, hp.alt) : ""}
         ${olderCard(tr("cf.k.head"), hp.older, hp.older ? headSpec(hp.older) : "", hp.olderBetter)}
         <div class="section-h">${tr("cf.k.lielen")} <span class="cnt">${r.lieConfident ? tr("cf.s.lie.sure") : tr("cf.s.lie.staticonly")}</span></div>
         ${resCard(tr("cf.k.lie"), r.lie, tr("cf.s.len", { len: r.lenAdj }), r.lieWhy)}
         <div class="warn-card"><b>${tr("cf.lie.warn.h")}</b> —
           ${r.lieConfident
             ? tr("cf.lie.warn.sure")
             : tr("cf.lie.warn.unsure")}
           ${tr("cf.lie.warn.tail")}</div>
         ${r.setAdvice ? `<div class="section-h">${tr("cf.k.set")}</div><div class="warn-card">${r.setAdvice.b}</div>` : ""}
         ${gripHtml(r.grip)}
         ${ex.detail}
         ${tipHtml(r.tips)}`, tr("cf.fold.detail.sub"))}
      ${ex.caution}
      ${saveRow("iron")}
      <div class="cf-foot">${tr("cf.foot.iron")}</div>`;
  }

  /* ───────── 결과 렌더 (웨지) ───────── */
  function renderWedge() {
    const r = wedgeEngine(), ex = explainWedge(r);
    const p = r.pick;
    return `
      <div class="q-eyebrow">${tr("cf.res.wedge")}</div>
      <div class="verdict"><span class="v-stamp">${tr("cf.stamp.done")}</span>
        <div class="v-label">${tr("cf.wedge.vlabel")}</div>
        <div class="v-main">${r.specs.map((s) => s.loft + "°").join(" · ")}</div>
        <div class="v-sub">${r.note}</div>
      </div>
      ${tldrBlock(r.tldr)}
      ${pickStrip([
        { k: tr("cf.k.comp"), v: r.specs.map((s) => s.loft + "°").join(" · "), s: tr("cf.s.wedgecnt", { n: r.cnt }) },
        { k: tr("cf.k.bounce"), v: r.specs.map((s) => s.bounce + "°").join(" · "), s: r.grind },
        { k: tr("cf.k.model"), v: `${p.main.br} ${p.main.m}`, s: brandLine(p) },
        { k: tr("cf.k.shaft"), v: r.shaft.t, s: "" },
        { k: tr("cf.k.grip"), v: r.grip.model, s: r.grip.spec },
      ])}
      ${venueBlock()}
      ${fold(tr("cf.fold.how"), ex.read, tr("cf.fold.how.wedge"))}
      ${fold(tr("cf.fold.detail"),
        `<div class="section-h">${tr("cf.sec.perclub")}</div>
         ${r.specs.map((s) => resCard(`${s.loft}°`, tr("cf.wedge.card", { loft: s.loft, bounce: s.bounce }),
           `${r.grind} · ${s.use}`, [])).join("")}
         <div class="section-h">${tr("cf.sec.bouncewhy")}</div>
         ${r.why.map((w) => `<div class="tip-line">· ${w}</div>`).join("")}
         <div class="section-h">${tr("cf.k.shaft")}</div>
         ${resCard(tr("cf.k.shaft"), r.shaft.t, "", [r.shaft.b])}
         <div class="section-h">${tr("cf.k.model")} <span class="cnt">${brandLine(p)}</span></div>
         ${resCard(tr("cf.card.wedge1"), `${p.main.br} ${p.main.m}`, "", [tr("cf.why.lineup")], false, p.main)}
         ${p.alt ? altLead(tr("cf.club.wedge")) + resCard(p.alt.br, `${p.alt.br} ${p.alt.m}`, "", [], true, p.alt) : ""}
         ${olderCard(tr("cf.club.wedge"), p.older, "", p.olderBetter)}
         ${gripHtml(r.grip)}
         ${ex.detail}`, tr("cf.fold.detail.sub.set"))}
      ${ex.caution}
      ${saveRow("wedge")}
      <div class="cf-foot">${tr("cf.foot.wedge")}</div>`;
  }

  /* ───────── 결과 렌더 (퍼터) ───────── */
  function renderPutt() {
    const r = putterEngine(), ex = explainPutt(r);
    const p = r.pick;
    const pSpec = (x) => `${x.shape} · ${x.bal}`;
    return `
      <div class="q-eyebrow">${tr("cf.res.putter")}</div>
      <div class="verdict"><span class="v-stamp">${tr("cf.stamp.done")}</span>
        <div class="v-label">${tr("cf.club.putter")}</div>
        <div class="v-main">${p.main.shape} · ${p.main.bal} · ${r.len}″</div>
        <div class="v-sub">${r.note}</div>
      </div>
      ${tldrBlock(r.tldr)}
      ${noteHtml(r.notes)}
      ${pickStrip([
        { k: tr("cf.k.model"), v: `${p.main.br} ${p.main.m}`, s: pSpec(p.main) },
        { k: tr("cf.k.len"), v: `${r.len}″`, s: r.curLen ? tr("cf.s.curlen", { len: r.curLen }) : "" },
        { k: tr("cf.k.hw"), v: r.hw.t, s: tr("cf.s.greenspeed") },
        { k: tr("cf.k.loft"), v: r.loft.t, s: "" },
        { k: tr("cf.k.grip"), v: r.grip.m, s: r.grip.spec },
      ])}
      ${venueBlock()}
      ${fold(tr("cf.fold.how"), ex.read, tr("cf.fold.how.putt"))}
      ${fold(tr("cf.fold.detail"),
        `<div class="section-h">${tr("cf.k.model")} <span class="cnt">${brandLine(p)}</span></div>
         ${resCard(tr("cf.card.putt1"), `${p.main.br} ${p.main.m}`, pSpec(p.main), p.main.why, false, p.main)}
         ${p.alt ? altLead(tr("cf.club.putter")) + resCard(p.alt.br, `${p.alt.br} ${p.alt.m}`, pSpec(p.alt), p.alt.why, true, p.alt) : ""}
         ${olderCard(tr("cf.club.putter"), p.older, p.older ? pSpec(p.older) : "", p.olderBetter)}
         <div class="section-h">${tr("cf.k.len")}</div>
         ${resCard(tr("cf.k.len"), `${r.len}″`, r.curLen ? tr("cf.s.curlen", { len: r.curLen }) : "", r.lenWhy)}
         <div class="section-h">${tr("cf.k.hw")} <span class="cnt">${tr("cf.s.greenspeed")}</span></div>
         ${resCard(tr("cf.k.hw"), r.hw.t, "", [r.hw.b])}
         <div class="section-h">${tr("cf.k.loft")}</div>
         ${resCard(tr("cf.k.loft"), r.loft.t, "", [r.loft.b])}
         <div class="section-h">${tr("cf.sec.facegrip")}</div>
         ${resCard(tr("cf.k.face"), r.face, "", [])}
         ${resCard(tr("cf.k.grip"), r.grip.m, r.grip.spec, [r.grip.why])}
         <div class="section-h">${tr("cf.k.lie")}</div>
         <div class="tip-line">· ${r.lie}</div>
         ${ex.detail}
         ${tipHtml(r.tips)}`, tr("cf.fold.detail.sub"))}
      ${ex.caution}
      ${saveRow("putter")}
      <div class="cf-foot">${tr("cf.foot.putter")}</div>`;
  }

  /* ───────── 네비게이션 ───────── */
  function scrEl() { return $$("#cf-screen"); }
  /* 판정 화면은 계산이 순식간이라 그냥 뜨면 "정말 분석한 게 맞나" 싶어진다.
     실제로 룰 엔진이 도는 동안 무엇을 보고 있는지 말해주는 편이 결과를 신뢰하게 만든다. */
  const RESULT_KEYS = ["result", "ironResult", "wedgeResult", "puttResult", "ballResult"];
  /* 판정 화면은 2.4초 뒤에 그린다. 그 사이에 사장님이 '처음부터 다시'나
     '다른 클럽도 맞춰보기'를 누르면 SCREENS 가 통째로 [PICK] 로 바뀌는데,
     예약해둔 그리기가 그대로 실행되면서 없는 화면을 그리려다 앱이 깨졌다
     (Cannot read properties of undefined (reading 'render') — 2026-07-29 sweep 적발).
     이동할 때마다 번호를 새로 매기고, 번호가 바뀌었으면 예약된 그리기를 버린다. */
  let paintToken = 0;
  function go(i) {
    const target = Math.max(0, Math.min(i, SCREENS.length - 1));
    const mine = ++paintToken;
    if (SCREENS[target] && RESULT_KEYS.includes(SCREENS[target].key) && typeof WAIT !== "undefined") {
      const w = WAIT.open("clubfit");
      setTimeout(() => {
        if (mine !== paintToken) { w.close(); return; }   // 그 사이에 다른 데로 갔다
        paint(target); w.close();
      }, 2400);
      return;
    }
    paint(target);
  }
  /* 클럽 자료(js/clubdb.js)의 낱말을 **화면에서만** 일본어로 바꾼다.
   *
   * 왜 DB 를 안 바꾸나 — 그 값들이 곧 판정 기준이기 때문이다.
   * clubfit.js 안에 `=== "낮음"` · `=== "스틸"` · `!== "블레이드"` 같은 비교가 40군데 넘게 있다.
   * 자료를 일본어로 바꾸는 순간 추천 엔진이 통째로 어긋난다.
   * 그래서 값은 한국어 그대로 두고, **다 그린 뒤 글자 마디만** 갈아 끼운다.
   * (프로필 칩·홀 공략에서 쓴 것과 같은 원칙 — 값과 글자를 가른다)
   *
   * 글자 마디(TEXT_NODE)만 건드리므로 주소·클래스·data 속성은 손대지 않는다.
   * 한국어 화면에서는 아무 일도 하지 않는다.
   */
  function cfLocalizeWords(root) {
    if (typeof I18N === "undefined" || I18N.lang !== "ja" || !root) return;
    const w = (s) => { const k = "cf.w." + s, v = tr(k); return v === k ? null : v; };
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const KO = /[가-힣]/;
    const jobs = [];
    for (let n = walk.nextNode(); n; n = walk.nextNode())
      if (KO.test(n.nodeValue)) jobs.push(n);
    jobs.forEach((n) => {
      let s = n.nodeValue;
      const whole = w(s.trim());
      if (whole) { n.nodeValue = s.replace(s.trim(), whole); return; }
      // 통째로 없으면 마디 단위로 — "던롭 젝시오 13 아이언" 처럼 이어 붙은 값이 있다
      s = s.replace(/[가-힣][가-힣0-9A-Za-z.]*(?:\s[가-힣0-9A-Za-z.]+)*/g, (m) => {
        let t = m;
        while (t) { const v = w(t); if (v) return v + m.slice(t.length);
          const cut = t.lastIndexOf(" "); if (cut < 0) break; t = t.slice(0, cut); }
        return m;
      });
      n.nodeValue = s;
    });
  }

  function paint(i) {
    idx = Math.max(0, Math.min(i, SCREENS.length - 1));
    const sc = SCREENS[idx];
    if (!sc) return;                                      // 화면 목록이 비어 있으면 아무것도 하지 않는다
    scrEl().innerHTML = (idx > 0 ? `<button class="cf-back" data-back>${tr("cf.btn.back")}</button>` : "") + sc.render();
    cfLocalizeWords(scrEl());
    const stage = $$("#cf-stage"), step = $$("#cf-step");
    // 진행 표시는 내부 단계 이름이 아니라 "지금 무슨 일이 일어나는지"를 말한다.
    const eye = (scrEl().querySelector(".q-eyebrow") || {}).textContent || "";
    stage.textContent = NARRATION[eye.trim()] || STAGE_LABEL[sc.group] || tr("cf.stage.default");
    // 문항 번호는 클럽 전체에서 몇 번째인지로 센다 (블록마다 1부터 다시 세면 끝이 안 보인다)
    let t = 0;
    if (RESULT_KEYS.includes(sc.key)) { step.textContent = tr("cf.step.holein"); t = 1; }
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
    // window.scrollTo 는 이 앱에서 듣지 않는다 — 스크롤 주체가 body 다(app.js scrollToTop 주석)
    if (typeof window.scrollToTop === "function") window.scrollToTop(true);
    else document.body.scrollTo({ top: 0, behavior: "smooth" });
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
    /* 7번 캐리 — 슬라이더 값에서 매번 새로 계산한다(뒤로 갔다 와도 같은 값이 나오게).
       ① 모르겠다 → 평균 타수·성별·연령으로 추정  ② 스크린 토탈 → 런을 빼서 캐리로 환산 */
    if (sc.key === "carry7") applyCarry7();
    if (sc.key === "body") S.wristFloor = S.wristSkip === "skip" ? null : S.wristFloorV;
    if (sc.key === "glove") S.handLen = (S.handSkip === "skip" || S.gloveSize === "unknown" && !S.handSkip) ? (S.handSkip === "skip" ? null : S.handLen) : S.handLenV;
    if (sc.key === "glove" && S.handSkip === "skip") S.handLen = null;
    // 공통 블록 **마지막** 문항을 넘기면 프로필로 저장한다.
    // (주 플레이를 캐리 앞으로 옮겼으므로 저장 시점도 마지막 문항인 몸 상태로 옮겼다 —
    //  venue 에서 저장하면 그 뒤 답이 프로필에 안 들어간다.)
    if (sc.key === "bodyIssue") saveFitProfile();
  }
  function advance() { commitScreen(); go(idx + 1); }

  function startClub(club, redoProfile) {
    S.club = club;
    if (!redoProfile) applyFitProfile();
    // 지난번 볼 피팅에서 받아둔 "지금 쓰는 공"을 되살린다 (드라이버 D10 을 건너뛰는 근거)
    if (!S.ball && ballKnown()) S.ball = readBag().ball.cur;
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
      // 접이식 상세 — 결과를 세 줄로 줄이고 근거는 접어 뒀다(사장님 지시 2026-07-30)
      const fd = t.closest("[data-fold]");
      if (fd) {
        const body = document.getElementById(fd.dataset.fold);
        if (!body) return;
        const opening = body.hidden;
        body.hidden = !opening;
        fd.setAttribute("aria-expanded", opening ? "true" : "false");
        const x = fd.querySelector(".cf-fold-x");
        if (x) x.textContent = opening ? "－" : "＋";
        return;
      }
      if (t.closest("[data-useprofile]")) return advance();
      if (t.closest("[data-redoprofile]")) { buildScreens(S.club, true); return go(1); }
      if (t.closest("[data-back]")) return go(idx - 1);
      if (t.closest("[data-next]")) return advance();
      if (t.closest("[data-skip]")) return advance();
      if (t.closest("[data-restart]")) { S.club = null; SCREENS = [PICK]; return go(0); }
      if (t.closest("[data-jump]")) {
        const k = t.closest("[data-jump]").dataset.jump;
        if (k === "pick") { S.club = null; SCREENS = [PICK]; return go(0); }
        // 골프백은 문항 흐름 밖의 화면이다 — [선택 → 백] 두 장으로 갈아끼워 뒤로가기가 선택으로 가게 한다
        if (k === "bag") { S.club = null; SCREENS = [PICK, BAG]; return go(1); }
        const i = SCREENS.findIndex((s) => s.key === k);
        return i >= 0 ? go(i) : null;
      }
      const sb = t.closest("[data-savebag]");
      if (sb) {
        const what = sb.dataset.savebag || "driver";
        if (what === "iron") saveBagPart("iron", ironEngine());
        else if (what === "wedge") saveBagPart("wedge", wedgeEngine());
        else if (what === "putter") saveBagPart("putter", putterEngine());
        else if (what === "ball") saveBagPart("ball", ballEngine());
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
        const prevV = S[key];
        box.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
        chip.setAttribute("aria-pressed", "true");
        S[key] = chip.dataset.v;

        /* "7번 캐리를 잘 모르겠어요" — 한 번 더 누르면 해제되는 토글.
           켜면 추정값을 슬라이더에 바로 얹어 무엇으로 계산할지 눈에 보이게 한다. */
        if (key === "carry7Unknown") {
          if (prevV === "yes") { S.carry7Unknown = null; chip.setAttribute("aria-pressed", "false"); }
          else {
            S.carry7V = estimateCarry7();
            const sl2 = el.querySelector('[data-slider="carry7V"]'); if (sl2) sl2.value = S.carry7V;
            const vv = $$("#cfv_carry7V"); if (vv) vv.textContent = S.carry7V;
          }
          return;
        }
        // 스크린 화면 숫자라고 하면 캐리/토탈을 한 번 더 묻는다 (토탈이면 런을 빼야 한다)
        if (key === "carry7Src") {
          const kb = $$("#cf-kindbox");
          if (kb) kb.style.display = S.carry7Src === "screen" ? "block" : "none";
          return;
        }
        if (key === "carry7Kind") return;

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
            box2.innerHTML = `<div class="inline-note">${tr("cf.flightnote", { n: f.n, path: f.path, face: f.face })}</div>`;
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
        // 캐리 슬라이더를 직접 만졌으면 "모르겠어요"(추정)는 해제한다
        if (key === "carry7V" && S.carry7Unknown === "yes") {
          S.carry7Unknown = null;
          const c = el.querySelector('.chips[data-key="carry7Unknown"] .chip');
          if (c) c.setAttribute("aria-pressed", "false");
        }
        if (key === "carryD") {
          const box = $$("#cf-rationote");
          if (box) {
            const r = S.carryD / S.carry7;
            box.innerHTML = r > 1.68 ? `<div class="inline-note">${tr("cf.rationote.hi", { m: S.carry7, d: S.carryD, r: r.toFixed(2) })}</div>`
              : (r < 1.50 && S.carryD > 0) ? `<div class="inline-note">${tr("cf.rationote.lo")}</div>` : "";
          }
        }
        return;
      }
      const tx = e.target.closest("[data-text]");
      if (tx) S[tx.dataset.text] = tx.value;
    });
  }

  /* ───────── 진입점 ───────── */
  /* 한 문항 뒤로 — 잘못 눌렀을 때 되돌리는 통로.
     선택지를 누르면 바로 다음으로 넘어가므로(자동 진행) 되돌릴 길이 반드시 있어야 한다.
     화면 왼쪽 아래 뒤로가기 버튼과 스와이프가 이 함수를 먼저 부른다.
     반환값 true = 여기서 처리했으니 화면을 빠져나가지 말 것. */
  window.clubfitBack = function () {
    if (idx <= 0) return false;          // 첫 화면이면 피팅을 나가는 게 맞다
    go(idx - 1);
    return true;
  };

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
        headForg: r.headPick.main.forg,          // 검사용 — 실력 게이트(80대 이하 forg≤4) 검증
        headAlt: r.headPick.alt ? `${r.headPick.alt.br} ${r.headPick.alt.m}` : null,
        notes: r.notes.map((n) => n.h),          // 검사용 — 게이트로 브랜드를 못 지킨 안내 확인
        grip: r.grip.model + " / " + r.grip.size, tldr: r.tldr };
    } else if (which === "wedge") {
      const r = wedgeEngine();
      out = { cnt: r.cnt, lofts: r.specs.map((s) => s.loft), bounces: r.specs.map((s) => s.bounce),
        shaft: r.shaft.t, model: `${r.pick.main.br} ${r.pick.main.m}`, tldr: r.tldr };
    } else if (which === "putter") {
      const r = putterEngine();
      out = { shape: r.pick.main.shape, bal: r.pick.main.bal, len: r.len,
        headWeight: r.hw.t, loft: r.loft.t, face: r.face, grip: r.grip.m,
        model: `${r.pick.main.br} ${r.pick.main.m}`,
        alt: r.pick.alt ? `${r.pick.alt.br} ${r.pick.alt.m}` : null, tldr: r.tldr };
    } else if (which === "ball") {
      const r = ballEngine();
      out = { cover: r.cover, feel: r.feel, cat: r.cat, keep: r.keep,
        model: r.pick.main ? `${r.pick.main.br} ${r.pick.main.m}` : null,
        alt: r.pick.alt ? `${r.pick.alt.br} ${r.pick.alt.m}` : null,
        tldr: r.tldr };
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
        headForg: r.headPick.main.forg,          // 검사용 — 실력 게이트(80대 이하 forg≤4) 검증
        headAlt: r.headPick.alt ? `${r.headPick.alt.br} ${r.headPick.alt.m}` : null,
        grip: r.grip.model + " / " + r.grip.size,
        priceShaft: r.shaftPick.main.pr, priceHead: r.headPick.main.pr,
        olderShaft: r.shaftPick.older ? r.shaftPick.older.m : null,
        olderHead: r.headPick.older ? r.headPick.older.m : null,
        notes: r.notes.map((n) => n.h), tldr: r.tldr };
    }
    Object.assign(S, JSON.parse(bak));
    return out;
  };

  /* 검수용: 7번 캐리 추정·환산만 따로 돌려본다.
     화면과 같은 applyCarry7() 을 부르므로 여기서 통과하면 화면도 같게 동작한다. */
  window.__cfCarry = function (inp) {
    const bak = JSON.stringify(S);
    Object.assign(S, inp || {});
    if (inp && inp.auto) Object.assign(S.auto, inp.auto);
    applyCarry7();
    const out = { carry7: S.carry7, carry7Est: S.carry7Est };
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
