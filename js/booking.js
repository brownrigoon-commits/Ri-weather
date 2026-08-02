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
    // 구장 나라에 맞는 시간대 — 일본은 KST 와 같은 UTC+9 라 값이 바뀌지 않지만,
    // 우연에 기대지 않고 명시한다(설계 §1). 헬퍼는 app.js 의 tzForCoord.
    timezone: typeof tzForCoord === "function"
      ? tzForCoord(course.lat, course.lon) : "Asia/Seoul",
    forecast_days: String(BOOKING_DAYS),
  });
  const d = await fetchJSON(url, { retries: 2, delay: 1200 });
  try { localStorage.setItem(ck, JSON.stringify({ t: Date.now(), d: d })); } catch (_) {}
  return d;
}

const BK_DOW = tr("bk.dow").split(",");
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

/* 골팡 — **항상 모바일 화면**으로, 부킹이면 부킹·조인이면 조인 화면으로 보낸다.
 *
 * ⚠️ 최종 결정(사장님 2026-07-30): "PC 화면은 정말 아닌 것 같다" — PC 경로 폐기.
 * 그 전에 겪은 과정 (전부 실측, 되살리려는 사람을 위해 남긴다):
 *  ① 모바일(m.)에서 구장까지 걸린 목록에는 **밖에서 못 들어간다.**
 *     · `m/round/bookListTmp.do` GET → 로그인으로 튕김
 *     · 그들 화면과 똑같은 POST(12필드 전부) → 2020년 날짜의 가짜 "점검 중" 페이지
 *     · 서버 직접 POST, Referer·세션 4조합 → 전부 404
 *     · 유니버설 링크 파일 없음 → 앱으로도 못 연다
 *     = 골팡의 정책이다. 우회하지 않는다.
 *  ② 데스크톱(www)은 clubname 으로 구장까지 걸리지만 **폰에서 글씨가 안 읽힌다**
 *     → v163 에서 채택했다가 v168 에서 폐기.
 *
 * 그래서 보낼 수 있는 것은 **날짜 + 지역(sector)** 까지. 구장은 카드 부제에
 * "목록에서 OO 을 골라주세요"라고 적어 한 번만 누르게 한다.
 * 골팡이 모바일 딥링크를 열어주면 여기에 clubname 만 더하면 된다.
 */
function golfpangUrl(kind, id, ymd) {
  const join = kind === "join";
  let p = "rd_date=" + ymd;
  if (id && id.sector) p += "&sector=" + id.sector;   // 지역까지는 걸어준다
  return "https://m.golfpang.com/m/round/" +
         (join ? "join_main" : "booking_main") + ".do?" + p;
}

/* 조인 인원 — 골프몬 필터 값 그대로 쓴다(`filterJoinCount`, 실측 2026-07-30).
   ⚠️ 골팡에는 **인원 필터가 없다**. 조인을 유형(초대·부부·남성·여성)으로 나눈다.
      모바일 폼에 `noma` 라는 칸이 있지만 화면 어디서도 쓰이지 않아 값의 뜻을 확인할 수 없었다.
      뜻을 모르는 파라미터를 찍어 보내면 엉뚱하게 걸러진 목록을 보여주게 된다 → 보내지 않는다. */
const BK_JOIN_COUNTS = [
  { v: "", t: tr("bk.cnt.all") }, { v: "1인", t: tr("bk.cnt.1") }, { v: "2인", t: tr("bk.cnt.2") },
  { v: "3인", t: tr("bk.cnt.3") }, { v: "부부커플", t: tr("bk.cnt.couple") },
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
  if (!course) return "";
  /* 일본 구장의 공식 주소는 **일본 홀맵 꾸러미** 안에 있다(645곳 전부 sourceUrl 을 가지고 있다).
     한국 HOLEIMG_DB 만 뒤지면 일본 구장은 늘 빈손이라 예약처 카드가 하나도 안 뜬다
     — 2026-08-03 鳴尾GC 에서 부킹 화면이 통째로 비어 있는 것을 보고 찾았다. */
  if (course.c === "JP" && typeof JPPACK !== "undefined") {
    const j = JPPACK.imgdb(course);
    if (j && j.sourceUrl) return j.sourceUrl;
  }
  if (typeof HOLEIMG_DB === "undefined") return "";
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
const BK_MODES = { booking: tr("bk.mode.booking"), join: tr("bk.mode.join") };

/* 일본 구장 부킹 카드 — 골팡·골프몬 자리를 라쿠텐 GORA + じゃらんゴルフ 로 바꾼다.
   (한국 카드 2개와 1:1 — 설계 §4-3-1 원칙, 사장님 지시)

   🔴 BOOKINGIDS_JP 에 없는 구장은 GORA 카드를 만들지 않는다.
      이름이 비슷한 옆 구장 예약 페이지가 뜨는 것은 빈 카드보다 나쁘다 —
      조립기가 이름·좌표 둘 다 맞은 구장만 담았고, 여기서도 그 결과만 믿는다.
   じゃらんゴルフ는 gc 번호를 아는 구장만 — 그것도 모르면 카드를 안 만든다. */
function jpBookingCards(course, ymd, kind) {
  const ja = typeof I18N !== "undefined" && I18N.lang === "ja";
  const md = ymd.slice(5).replace("-", "/");
  const out = [];

  const b = typeof JPPACK !== "undefined" && typeof BOOKINGIDS_JP !== "undefined"
    ? JPPACK._pick(BOOKINGIDS_JP, course) : null;
  if (b) {
    const [id, cal] = b;
    // 조인(1인 예약)은 GORA 의 1人予約 목록으로 — 한국 '조인' 자리에 대응한다
    const url = kind === "join"
      ? "https://gora.golf.rakuten.co.jp/plan/one/?f_gc=" + id
      : (cal || "https://gora.golf.rakuten.co.jp/gdk/gora/gc/" + id + "/");
    out.push({
      key: "gora", ico: "⛳", cls: "bk-mon",
      title: ja ? (kind === "join" ? "楽天GORA 1人予約" : "楽天GORAで予約")
                : (kind === "join" ? "라쿠텐 GORA 1인 예약" : "라쿠텐 GORA 예약"),
      sub: ja ? `${md} ${dispName(course)} の空き状況`
              : `${md} · ${dispName(course)} 빈자리 보기`,
      url: url,
    });
  }

  const gc = typeof JPGC_JP !== "undefined" ? JPPACK._pick(JPGC_JP, course) : null;
  if (gc) {
    out.push({
      key: "jalangolf", ico: "🏌️", cls: "bk-pang",
      title: ja ? "じゃらんゴルフで予約" : "자란 골프 예약",
      sub: ja ? `${md} ${dispName(course)}` : `${md} · ${dispName(course)}`,
      url: "https://golf-jalan.net/gc" + gc + "/",
    });
  }

  const site = officialSiteUrl(course);
  if (site)
    out.push({ key: "official", ico: "🏛️", cls: "bk-site", title: tr("bk.card.official"),
               sub: tr("bk.card.official.sub"), url: site });
  return out;
}

function bookingLinkCards(course, ymd, kind, joinCount) {
  // 일본 구장은 골팡·골프몬이 아무 소용이 없다 — 한국 예약 사이트라 목록이 비어 있다.
  if (course.c === "JP") return jpBookingCards(course, ymd, kind);
  const mode = kind === "join" ? "join" : "booking";
  const id = bookingIdOf(course);
  const site = officialSiteUrl(course);
  const md = ymd.slice(5).replace("-", "/");
  /* 골팡은 항상 모바일 화면(사장님 확정 2026-07-30 — PC 화면 폐기).
     구장까지는 밖에서 못 걸어주므로(골팡 정책, golfpangUrl 주석),
     부제에 "목록에서 무엇을 고르면 되는지"를 적어준다. */
  // 구장명 받침에 따라 조사가 달라지므로("파주를"/"솔라고를") 조사가 필요 없는 꼴로 쓴다
  const pangSub = id
    ? tr("bk.sub.pang.pick", { md: md, name: id.pangName })
    : tr("bk.sub.pang.nopick", { md: md });
  const monExact = !!(id && id.mon);
  const cnt = (BK_JOIN_COUNTS.find((c) => c.v === joinCount) || {}).t;

  /* ⚠️ 제목은 짧게 — 로고 칸이 들어오면서 가로가 좁아져 긴 제목이 "…" 로 잘렸다.
     날짜·조건은 부제로 내린다(2026-07-30). */
  if (mode === "join") {
    return [
      // 골팡은 인원으로 못 거른다 — 걸러준다고 쓰면 거짓말이 된다
      { key: "pang_join", img: "assets/brand/golfpang.png", cls: "bk-pang", title: tr("bk.card.pang.join"),
        sub: pangSub, url: golfpangUrl("join", id, ymd) },
      { key: "mon_join", img: "assets/brand/golfmon.png", cls: "bk-mon",
        title: tr("bk.card.mon.join"),
        sub: monExact
          ? (joinCount ? tr("bk.sub.mon.join.cnt", { md: md, course: dispName(course), cnt: cnt })
                       : tr("bk.sub.mon.join", { md: md, course: dispName(course) }))
          : tr("bk.sub.mon.pick"),
        url: golfmonUrl(id, ymd, course.name, "join", joinCount) },
    ];
  }
  const out = [
    { key: "pang_booking", img: "assets/brand/golfpang.png", cls: "bk-pang", title: tr("bk.card.pang.booking"),
      sub: pangSub, url: golfpangUrl("booking", id, ymd) },
    { key: "mon_booking", img: "assets/brand/golfmon.png", cls: "bk-mon",
      title: tr("bk.card.mon.booking"),
      sub: monExact ? tr("bk.sub.mon.booking", { md: md, course: dispName(course) }) : tr("bk.sub.mon.pick"),
      url: golfmonUrl(id, ymd, course.name, "booking") },
  ];
  if (site) {
    out.push({ key: "official", ico: "🏛️", cls: "bk-site", title: tr("bk.card.official"),
      sub: tr("bk.card.official.sub"), url: site });
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
    return tr("bk.note.rain", { dow: dow, pop: pop }) +
      (best >= 0 ? tr("bk.note.better", { dow: BK_DOW[days[best].getDay()] }) : "");
  }
  if (pop >= 30) return tr("bk.note.mid", { dow: dow, pop: pop });
  return tr("bk.note.good", { dow: dow, desc: wmoDesc(code) });
}

const BOOKING_VIEW = { days: [], wx: null, pick: 0, course: null, mode: "booking", joinCount: "" };

function paintBooking() {
  const { days, wx, pick, course, mode, joinCount } = BOOKING_VIEW;
  const ymd = bkYmd(days[pick]);
  const el = document.querySelector("#booking-body");
  const note = bookingDayNote(days, wx, pick);
  const bkCards = bookingLinkCards(course, ymd, mode, joinCount);
  el.innerHTML =
    `<div class="bk-modes" role="tablist">` +
    Object.keys(BK_MODES).map((k) =>
      `<button class="bk-mode${k === mode ? " on" : ""}" data-mode="${k}" role="tab"
        aria-selected="${k === mode}">${BK_MODES[k]}</button>`).join("") +
    `</div>` +
    `<p class="bk-mode-sub">${mode === "join"
      ? tr("bk.mode.sub.join")
      : tr("bk.mode.sub.booking")}</p>` +
    (mode === "join"
      ? `<div class="bk-cnt-row"><span class="bk-cnt-label">${tr("bk.cnt.label")}</span>
         <div class="bk-cnts">` +
        BK_JOIN_COUNTS.map((c) =>
          `<button class="bk-cnt${c.v === joinCount ? " on" : ""}" data-cnt="${c.v}">${c.t}</button>`).join("") +
        `</div></div>`
      : "") +
    `<div class="bk-days">${renderBookingDays(days, wx, pick)}</div>` +
    (note ? `<p class="bk-note">${note}</p>` : "") +
    `<div class="bk-links">` +
    /* 예약처가 하나도 없을 수 있다(회원제 구장 등). 그때 아무 말 없이 빈칸이면
       이용자는 앱이 고장 난 줄 안다 — 2026-08-03 鳴尾GC 에서 실제로 그랬다.
       ⚠️ "이 구장은 예약이 안 됩니다" 라고는 쓰지 않는다. 우리가 확인한 것은
          '우리에게 예약처 자료가 없다'는 것뿐이다. 아는 데까지만 말한다. */
    (bkCards.length === 0 ? `<p class="bk-none">${tr("bk.none")}</p>` : "") +
    bkCards.map((c) =>
      `<div class="bk-slot">` +
      `<a class="bk-card ${c.cls}" href="${c.url}" target="_blank" rel="noopener" data-out="${c.key}">
         <span class="bk-card-ic">${c.img
           ? `<img src="${c.img}" alt="">` : c.ico}</span>
         <span class="bk-card-tx"><b>${c.title}</b><small>${c.sub}</small></span>
         <span class="bk-card-go">↗</span>
       </a>` +
      `</div>`).join("") +
    `</div>` +
    (mode === "join" && joinCount
      ? `<p class="bk-cnt-note">${tr("bk.cnt.note")}</p>`
      : "") +
    `<p class="bk-legal">${tr("bk.legal")}</p>`;

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
  // 일본 예약 자료(GORA 번호·じゃらん gc)는 여기서 처음 받는다.
  // ⚠️ await 를 빼면 첫 진입에서만 카드가 없는 것처럼 보인다(코스공략에서 겪은 그 버그).
  if (course.c === "JP" && typeof JPPACK !== "undefined") await JPPACK.need(course);
  document.querySelector("#booking-title").textContent = tr("bk.title");
  document.querySelector("#booking-desc").textContent =
    tr("bk.desc", { course: dispName(course) });

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
