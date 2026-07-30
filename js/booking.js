/* =========================================================
 * 부킹 — 골팡·골프몬으로 보내주는 연결 허브
 *
 * ⚠️ 우리는 예약을 중개하지 않는다. 티타임·요금을 우리 화면에 옮겨 적지도 않는다.
 *    · 판례: 예약앱이 경쟁사 목록을 긁어 쓰다 10억원 배상(서울중앙지법 2018가합508729)
 *    · 골팡은 브라우저가 아닌 요청에 가짜 점검 페이지를 준다 = 수집 거부 의사
 *    · 티타임·요금은 분 단위로 바뀐다 → 옮겨 적는 순간 반드시 틀린 값을 보여주게 된다
 *      ("틀릴 수 있으면 표시하지 않는다" — 이 앱의 제1원칙)
 *    제휴가 열리면 fetchTeeTimes(course, date) 하나만 만들어 붙이면 된다. 설계는 docs/부킹_설계.md.
 *
 * 우리가 주는 값: **날씨를 보고 날짜를 고르고, 그 날짜 티타임으로 바로 간다.**
 * 골팡·골프몬에는 날씨가 없다. 이 결합이 원스톱의 핵심이다.
 * ========================================================= */

const BOOKING_DAYS = 7;
const BK_LS = "riweather.bkweek.";

/* 부킹용 7일 예보 — 기존 fetchForecast 는 3일치라 그대로 못 쓴다.
   화면 하나 때문에 공용 함수를 건드리면 다른 화면이 같이 흔들린다 → 여기서 따로 받는다. */
async function fetchBookingWeek(course) {
  const ck = BK_LS + course.lat.toFixed(3) + "," + course.lon.toFixed(3);
  try {
    const c = JSON.parse(localStorage.getItem(ck) || "null");
    if (c && Date.now() - c.t < 30 * 60000) return c.d;
  } catch (_) {}
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: course.lat, longitude: course.lon,
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "Asia/Seoul", forecast_days: String(BOOKING_DAYS),
  });
  const d = await fetchJSON(url, { retries: 2, delay: 1200 });
  try { localStorage.setItem(ck, JSON.stringify({ t: Date.now(), d: d })); } catch (_) {}
  return d;
}

const BK_DOW = ["일", "월", "화", "수", "목", "금", "토"];
const bkYmd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
                     "-" + String(d.getDate()).padStart(2, "0");
/* 날짜 칸은 "화 8/4" 처럼 **달까지** 적는다.
   "화 4" 만 쓰면 월말·월초가 섞일 때 며칠인지 헷갈린다(사장님 지적 2026-07-30). */
const bkDayLabel = (d) => BK_DOW[d.getDay()] + " " + (d.getMonth() + 1) + "/" + d.getDate();

/* 기본 선택은 다가오는 토요일. 골프는 주말에 가장 많이 나가고,
   토요일이 7일 안에 없을 수는 없다. 오늘이 토요일이면 오늘. */
function defaultBookingDay(days) {
  const sat = days.findIndex((d) => d.getDay() === 6);
  return sat >= 0 ? sat : 0;
}

/* ───────── 연결 링크 만들기 ─────────
 * 번호(js/bookingids.js)가 있으면 그 구장 목록으로 바로, 없으면 지역 목록·검색 화면으로.
 * ⚠️ 없는 번호를 지어내지 않는다. 엉뚱한 구장 티타임을 띄우는 것이 곧 거짓 정보다.
 */
/* 구장 이름은 사람마다·출처마다 다르게 적힌다 — "파주" · "파주CC" · "파주 컨트리클럽".
   ⚠️ 이름을 통째로 비교했더니 사장님 폰에 저장된 "파주" 가 번호표의 "파주CC" 를 못 찾아
   폴백(검색창)으로 떨어졌다(2026-07-30 신고). 업종어를 걷어낸 핵심 이름으로 찾는다.
   tools/build_booking_ids.py 의 core() 와 같은 규칙이어야 한다. */
const BK_BIZ = /(컨트리클럽|골프앤리조트|골프클럽|골프리조트|골프장|리조트|CC|GC|G\.C|C\.C|골프)/gi;
function bkCore(name) {
  return String(name || "").replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(BK_BIZ, " ").replace(/[^0-9A-Za-z가-힣]/g, "").toLowerCase();
}
let BK_INDEX = null;
function bookingIdOf(course) {
  if (typeof BOOKING_IDS === "undefined" || !course) return null;
  if (BOOKING_IDS[course.name]) return BOOKING_IDS[course.name];
  if (!BK_INDEX) {
    BK_INDEX = {};
    for (const n in BOOKING_IDS) {
      const k = bkCore(n);
      // 핵심 이름이 겹치면 둘 다 버린다 — 엉뚱한 구장으로 보내느니 폴백이 낫다
      BK_INDEX[k] = k in BK_INDEX ? null : BOOKING_IDS[n];
    }
  }
  return BK_INDEX[bkCore(course.name)] || null;
}

/* 골팡 지역 이름 — 카드에 "어느 칸을 누르면 되는지"까지 적어주기 위해서다. */
const BK_SECTOR_NAME = { 5: "한강/이남", 1: "강북/경춘", 4: "충청", 8: "원주/영동", 16: "영호남·제주" };

/* 골팡 — **번호가 있으면 그 구장 목록으로 바로 보낸다(PC 화면)**, 없으면 모바일 화면.
 *
 * 이 규칙에 이른 과정 (전부 실측, 2026-07-30):
 *  ① 모바일(m.)에서 구장까지 걸린 목록에는 **밖에서 못 들어간다.**
 *     · `m/round/bookListTmp.do` GET → 로그인으로 튕김
 *     · 그들 화면과 똑같은 POST → **2020년 날짜의 가짜 "서비스 점검 중" 페이지**
 *     · `m/round/booking_list.do` → 200 이지만 목록 없는 껍데기
 *     · 유니버설 링크 파일(apple-app-site-association·assetlinks.json) 없음 → 앱으로도 못 연다
 *  ② 데스크톱(www)은 `booking_list.do?rd_date=&sector=&clubname=` 로
 *     **그 구장 티타임 목록에 정확히 착지한다**(파주 134개 확인).
 *
 * 처음엔 ②가 폰에서 글씨가 작아 ①로 갔는데, 지역까지만 걸리니 "의미가 없다"는
 * 판단을 받았다(사장님 2026-07-30). **구장까지 정확히 가는 것이 먼저다.**
 * 골팡이 모바일 딥링크를 열어주면 이 함수 한 곳만 고치면 된다.
 */
function golfpangUrl(kind, id, ymd) {
  const join = kind === "join";
  if (id) {
    // 구장 번호가 있다 → 그 구장 목록으로 바로 (PC 화면이지만 내용이 정확하다)
    const p = new URLSearchParams({ rd_date: ymd, sector: String(id.sector) });
    if (id.sector3) p.set("sector3", String(id.sector3));
    p.set("clubname", String(id.pang));
    return "https://www.golfpang.com/web/round/" +
           (join ? "join_list" : "booking_list") + ".do?" + p.toString();
  }
  // 번호가 없다 → 어차피 사용자가 골라야 하니 읽기 편한 모바일 화면으로
  return "https://m.golfpang.com/m/round/" +
         (join ? "join_main" : "booking_main") + ".do?rd_date=" + ymd;
}

/* 조인 인원 — 골프몬 필터 값 그대로 쓴다(`filterJoinCount`, 실측 2026-07-30).
   ⚠️ 골팡에는 **인원 필터가 없다**. 조인을 유형(초대·부부·남성·여성)으로 나눈다.
      모바일 폼에 `noma` 라는 칸이 있지만 화면 어디서도 쓰이지 않아 값의 뜻을 확인할 수 없었다.
      뜻을 모르는 파라미터를 찍어 보내면 엉뚱하게 걸러진 목록을 보여주게 된다 → 보내지 않는다. */
const BK_JOIN_COUNTS = [
  { v: "", t: "전체" }, { v: "1인", t: "1명" }, { v: "2인", t: "2명" },
  { v: "3인", t: "3명" }, { v: "부부커플", t: "부부·커플" },
];

/* 골프몬 — golfFk(구장 번호)가 있어야 걸러진다. 이름만 넘기면 전체 목록이 나온다(실측).
   tab=조인 이면 조인 목록으로 열린다(실측 2026-07-30).
   번호가 없으면 검색 화면으로 보낸다 — 거기서 구장명을 한 번 고르면 된다. */
function golfmonUrl(id, ymd, name, kind, joinCount) {
  if (id && id.mon) {
    const p = new URLSearchParams({ startDate: ymd, golfFk: String(id.mon), golfFkName: name });
    if (kind === "join") {
      p.set("tab", "조인");
      if (joinCount) p.set("filterJoinCount", joinCount);
    }
    return "https://www.golfmon.net/search/booking?" + p.toString();
  }
  return "https://www.golfmon.net/search/bookingsearch";
}

/* 구장 공식 홈페이지 — 홀맵 DB 에 이미 출처 URL 이 들어 있다(232곳).
   여기도 이름을 통째로 비교하면 "파주" 가 "파주CC" 를 못 찾는다 → 핵심 이름으로. */
let BK_SITE_INDEX = null;
function officialSiteUrl(course) {
  if (typeof HOLEIMG_DB === "undefined" || !course) return "";
  const direct = HOLEIMG_DB[course.name];
  if (direct && direct.sourceUrl) return direct.sourceUrl;
  if (!BK_SITE_INDEX) {
    BK_SITE_INDEX = {};
    for (const n in HOLEIMG_DB) {
      const k = bkCore(n), u = HOLEIMG_DB[n].sourceUrl;
      if (u) BK_SITE_INDEX[k] = k in BK_SITE_INDEX ? null : u;
    }
  }
  return BK_SITE_INDEX[bkCore(course.name)] || "";
}

/* 부킹이냐 조인이냐를 **먼저** 고르게 한다.
   같이 갈 사람이 있으면 부킹(티타임 양도), 혼자면 조인 — 찾는 곳이 아예 다르다.
   먼저 물어야 어디로 보낼지가 정해진다(사장님 지적 2026-07-30). */
const BK_MODES = { booking: "부킹", join: "조인" };

function bookingLinkCards(course, ymd, kind, joinCount) {
  const mode = kind === "join" ? "join" : "booking";
  const id = bookingIdOf(course);
  const site = officialSiteUrl(course);
  const md = ymd.slice(5).replace("-", "/");
  /* 번호가 있으면 그 구장 목록으로 바로 간다. 다만 PC 화면이라 글씨가 작으니
     기대를 미리 맞춰준다 — 열어보고 당황하는 것보다 낫다. */
  const pangSub = id
    ? `${md} · ${id.pangName} 티타임 바로 · PC 화면`
    : `${md} · ${BK_SECTOR_NAME[id && id.sector] || "지역"} 목록에서 골라주세요`;
  const monExact = !!(id && id.mon);
  const cnt = (BK_JOIN_COUNTS.find((c) => c.v === joinCount) || {}).t;

  /* ⚠️ 제목은 짧게 — 로고 칸이 들어오면서 가로가 좁아져 긴 제목이 "…" 로 잘렸다.
     날짜·조건은 부제로 내린다(2026-07-30). */
  /* 골팡은 둘 중 하나를 고르게 한다 — 어느 쪽도 완벽하지 않기 때문이다.
     · 기본(카드)  : PC 목록 = 구장까지 정확히 걸림. 글씨가 작다.
     · 보조(작은 줄): 모바일 화면 = 읽기 편하다. 구장은 목록에서 한 번 골라야 한다.
     골팡이 모바일 딥링크를 열어주면 보조 줄을 지우고 기본을 모바일로 바꾸면 된다. */
  const pangAlt = id
    ? { label: "글씨가 작으면 → 골팡 모바일 화면 (구장은 직접 선택)",
        url: "https://m.golfpang.com/m/round/" +
             (mode === "join" ? "join_main" : "booking_main") + ".do?rd_date=" + ymd +
             "&sector=" + id.sector }
    : null;

  if (mode === "join") {
    return [
      // 골팡은 인원으로 못 거른다 — 걸러준다고 쓰면 거짓말이 된다
      { key: "pang_join", img: "assets/brand/golfpang.png", cls: "bk-pang", title: "골팡 조인",
        sub: pangSub, url: golfpangUrl("join", id, ymd), alt: pangAlt },
      { key: "mon_join", img: "assets/brand/golfmon.png", cls: "bk-mon",
        title: "골프몬 조인",
        sub: monExact
          ? `${md} · ${course.name}` + (joinCount ? ` · ${cnt} 모집만` : "")
          : "구장명을 한 번 골라주세요",
        url: golfmonUrl(id, ymd, course.name, "join", joinCount) },
    ];
  }
  const out = [
    { key: "pang_booking", img: "assets/brand/golfpang.png", cls: "bk-pang", title: "골팡 부킹",
      sub: pangSub, url: golfpangUrl("booking", id, ymd), alt: pangAlt },
    { key: "mon_booking", img: "assets/brand/golfmon.png", cls: "bk-mon",
      title: "골프몬 부킹",
      sub: monExact ? `${md} · ${course.name} 양도 목록` : "구장명을 한 번 골라주세요",
      url: golfmonUrl(id, ymd, course.name, "booking") },
  ];
  if (site) {
    out.push({ key: "official", ico: "🏛️", cls: "bk-site", title: "구장 공식 홈페이지 예약",
      sub: "회원 우선 · 정가 예약", url: site });
  }
  return out;
}

/* ───────── 화면 ───────── */
function renderBookingDays(days, wx, pick) {
  return days.map((d, i) => {
    const code = wx ? wx.weather_code[i] : null;
    const tmax = wx ? Math.round(wx.temperature_2m_max[i]) : null;
    const pop = wx ? wx.precipitation_probability_max[i] : null;
    const rainy = pop !== null && pop >= 60;
    return `<button class="bk-day${i === pick ? " on" : ""}" data-day="${i}">
      <span class="bk-dow${d.getDay() === 0 ? " sun" : d.getDay() === 6 ? " sat" : ""}">${bkDayLabel(d)}</span>
      <span class="bk-ic">${code === null ? "·" : wmoIcon(code)}</span>
      <span class="bk-t">${rainy ? pop + "%" : (tmax === null ? "" : tmax + "°")}</span>
    </button>`;
  }).join("");
}

/* 고른 날 한 줄 평 — 날씨를 보고 날짜를 정하라고 만든 화면이니 판단을 도와준다.
   ⚠️ 없는 정보를 지어내지 않는다. 예보를 못 받았으면 아무 말도 하지 않는다. */
function bookingDayNote(days, wx, pick) {
  if (!wx) return "";
  const pop = wx.precipitation_probability_max[pick];
  const code = wx.weather_code[pick];
  const dow = BK_DOW[days[pick].getDay()];
  if (pop >= 60) {
    // 더 나은 날이 있으면 같이 알려준다
    let best = -1;
    for (let i = 0; i < days.length; i++) {
      if (wx.precipitation_probability_max[i] <= 30 &&
          (best < 0 || wx.precipitation_probability_max[i] < wx.precipitation_probability_max[best])) best = i;
    }
    return `${dow}요일은 비 올 확률 ${pop}%` +
      (best >= 0 ? ` — ${BK_DOW[days[best].getDay()]}요일이 나아 보여요` : "");
  }
  if (pop >= 30) return `${dow}요일 강수 확률 ${pop}% — 우비는 챙기세요`;
  return `${dow}요일 ${wmoDesc(code)} · 라운딩하기 좋은 날이에요`;
}

const BOOKING_VIEW = { days: [], wx: null, pick: 0, course: null, mode: "booking", joinCount: "" };

function paintBooking() {
  const { days, wx, pick, course, mode, joinCount } = BOOKING_VIEW;
  const ymd = bkYmd(days[pick]);
  const el = document.querySelector("#booking-body");
  const note = bookingDayNote(days, wx, pick);
  el.innerHTML =
    `<div class="bk-modes" role="tablist">` +
    Object.keys(BK_MODES).map((k) =>
      `<button class="bk-mode${k === mode ? " on" : ""}" data-mode="${k}" role="tab"
        aria-selected="${k === mode}">${BK_MODES[k]}</button>`).join("") +
    `</div>` +
    `<p class="bk-mode-sub">${mode === "join"
      ? "혼자 가시나요? 같이 칠 사람을 찾습니다"
      : "일행이 있으신가요? 넘겨받을 티타임을 찾습니다"}</p>` +
    (mode === "join"
      ? `<div class="bk-cnt-row"><span class="bk-cnt-label">몇 명 자리를 찾으세요?</span>
         <div class="bk-cnts">` +
        BK_JOIN_COUNTS.map((c) =>
          `<button class="bk-cnt${c.v === joinCount ? " on" : ""}" data-cnt="${c.v}">${c.t}</button>`).join("") +
        `</div></div>`
      : "") +
    `<div class="bk-days">${renderBookingDays(days, wx, pick)}</div>` +
    (note ? `<p class="bk-note">${note}</p>` : "") +
    `<div class="bk-links">` +
    bookingLinkCards(course, ymd, mode, joinCount).map((c) =>
      `<div class="bk-slot">` +
      `<a class="bk-card ${c.cls}" href="${c.url}" target="_blank" rel="noopener" data-out="${c.key}">
         <span class="bk-card-ic">${c.img
           ? `<img src="${c.img}" alt="">` : c.ico}</span>
         <span class="bk-card-tx"><b>${c.title}</b><small>${c.sub}</small></span>
         <span class="bk-card-go">↗</span>
       </a>` +
      // 골팡만 — 어느 쪽도 완벽하지 않으니 그 자리에서 고를 수 있게 둔다
      (c.alt ? `<a class="bk-alt" href="${c.alt.url}" target="_blank" rel="noopener"
                  data-out="${c.key}_m">${c.alt.label}</a>` : "") +
      `</div>`).join("") +
    `</div>` +
    (mode === "join" && joinCount
      ? `<p class="bk-cnt-note">인원 조건은 골프몬에만 걸립니다 — 골팡은 조인을
         인원이 아니라 유형(초대·부부·남성·여성)으로 나눕니다.</p>`
      : "") +
    `<p class="bk-legal">예약·결제·취소는 각 사이트에서 진행됩니다.<br>` +
    `티타임과 요금은 실시간으로 바뀌므로 각 사이트에서 확인하세요.</p>`;

  el.querySelectorAll(".bk-day").forEach((b) => {
    b.addEventListener("click", () => { BOOKING_VIEW.pick = +b.dataset.day; paintBooking(); });
  });
  el.querySelectorAll(".bk-mode").forEach((b) => {
    b.addEventListener("click", () => {
      BOOKING_VIEW.mode = b.dataset.mode;
      if (typeof STATS !== "undefined") STATS.hit("feature", "booking_mode_" + b.dataset.mode);
      paintBooking();
    });
  });
  el.querySelectorAll(".bk-cnt").forEach((b) => {
    b.addEventListener("click", () => { BOOKING_VIEW.joinCount = b.dataset.cnt; paintBooking(); });
  });
  // 어디로 얼마나 보내는지 센다 — 이 숫자가 나중에 제휴 협상 카드가 된다
  el.querySelectorAll("[data-out]").forEach((a) => {
    a.addEventListener("click", () => {
      if (typeof STATS !== "undefined") STATS.hit("feature", "booking_out_" + a.dataset.out);
    });
  });
}

async function openBookingView() {
  const course = currentCourse;
  if (viewStack[viewStack.length - 1] !== "booking") pushView("booking");
  document.querySelector("#booking-title").textContent = "부킹/조인";
  document.querySelector("#booking-desc").textContent =
    `${course.name} — 가는 날을 고르면 그날 티타임으로 연결합니다`;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: BOOKING_DAYS }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() + i); return d;
  });
  BOOKING_VIEW.days = days;
  BOOKING_VIEW.course = course;
  BOOKING_VIEW.pick = defaultBookingDay(days);
  BOOKING_VIEW.wx = null;
  BOOKING_VIEW.mode = "booking";       // 들어올 때마다 부킹부터 — 대부분이 부킹이다
  BOOKING_VIEW.joinCount = "";         // 인원 조건도 초기화 (지난번 조건이 남으면 헷갈린다)
  paintBooking();                       // 예보 없이도 링크는 바로 쓸 수 있게 먼저 그린다

  try {
    const d = await fetchBookingWeek(course);
    if (currentCourse !== course || viewStack[viewStack.length - 1] !== "booking") return;
    if (d && d.daily) { BOOKING_VIEW.wx = d.daily; paintBooking(); }
  } catch (_) { /* 예보를 못 받아도 부킹 연결은 그대로 동작한다 */ }
}

window.openBookingView = openBookingView;
