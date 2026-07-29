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
function bookingIdOf(course) {
  if (typeof BOOKING_IDS === "undefined" || !course) return null;
  return BOOKING_IDS[course.name] || null;
}

/* 골팡 — 실측(2026-07-30): booking_list.do?rd_date=&sector=&clubname= 으로
   그 구장·그 날짜 목록에 바로 착지한다(파주 8/1 확인). 조인은 join_list.do 로 같은 규격. */
function golfpangUrl(kind, id, ymd) {
  const base = "https://www.golfpang.com/web/round/" +
               (kind === "join" ? "join_list" : "booking_list") + ".do";
  const p = new URLSearchParams({ rd_date: ymd });
  if (id) {
    p.set("sector", String(id.sector));
    if (id.sector3) p.set("sector3", String(id.sector3));
    p.set("clubname", String(id.pang));
  }
  return base + "?" + p.toString();
}

/* 골프몬 — golfFk(구장 번호)가 있어야 걸러진다. 이름만 넘기면 전체 목록이 나온다(실측).
   번호가 없으면 검색 화면으로 보낸다 — 거기서 구장명을 한 번 고르면 된다. */
function golfmonUrl(id, ymd, name) {
  if (id && id.mon) {
    const p = new URLSearchParams({ startDate: ymd, golfFk: String(id.mon), golfFkName: name });
    return "https://www.golfmon.net/search/booking?" + p.toString();
  }
  return "https://www.golfmon.net/search/bookingsearch";
}

/* 구장 공식 홈페이지 — 홀맵 DB 에 이미 출처 URL 이 들어 있다(232곳). */
function officialSiteUrl(course) {
  if (typeof HOLEIMG_DB === "undefined" || !course) return "";
  const rec = HOLEIMG_DB[course.name];
  return (rec && rec.sourceUrl) || "";
}

function bookingLinkCards(course, ymd) {
  const id = bookingIdOf(course);
  const exact = !!id;
  const site = officialSiteUrl(course);
  const md = ymd.slice(5).replace("-", "/");
  const out = [
    { key: "golfpang", ico: "⛳", cls: "bk-pang", title: `골팡에서 ${md} 티타임 보기`,
      sub: exact ? `${course.name} 목록으로 바로` : "지역 목록에서 골라주세요",
      url: golfpangUrl("booking", id, ymd) },
    { key: "golfpang_join", ico: "👥", cls: "bk-pang2", title: `골팡 조인 ${md}`,
      sub: exact ? "같이 칠 사람 찾기" : "지역 목록에서 골라주세요",
      url: golfpangUrl("join", id, ymd) },
    { key: "golfmon", ico: "🏌️", cls: "bk-mon",
      title: (id && id.mon) ? `골프몬에서 ${md} 티타임 보기` : "골프몬에서 찾기",
      sub: (id && id.mon) ? "양도 · 조인 함께 보기" : "구장명을 한 번 골라주세요",
      url: golfmonUrl(id, ymd, course.name) },
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
      <span class="bk-dow${d.getDay() === 0 ? " sun" : d.getDay() === 6 ? " sat" : ""}">${BK_DOW[d.getDay()]} ${d.getDate()}</span>
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

const BOOKING_VIEW = { days: [], wx: null, pick: 0, course: null };

function paintBooking() {
  const { days, wx, pick, course } = BOOKING_VIEW;
  const ymd = bkYmd(days[pick]);
  const el = document.querySelector("#booking-body");
  const note = bookingDayNote(days, wx, pick);
  el.innerHTML =
    `<div class="bk-days">${renderBookingDays(days, wx, pick)}</div>` +
    (note ? `<p class="bk-note">${note}</p>` : "") +
    `<div class="bk-links">` +
    bookingLinkCards(course, ymd).map((c) =>
      `<a class="bk-card ${c.cls}" href="${c.url}" target="_blank" rel="noopener" data-out="${c.key}">
         <span class="bk-card-ic">${c.ico}</span>
         <span class="bk-card-tx"><b>${c.title}</b><small>${c.sub}</small></span>
         <span class="bk-card-go">↗</span>
       </a>`).join("") +
    `</div>` +
    `<p class="bk-legal">예약·결제·취소는 각 사이트에서 진행됩니다.<br>` +
    `티타임과 요금은 실시간으로 바뀌므로 각 사이트에서 확인하세요.</p>`;

  el.querySelectorAll(".bk-day").forEach((b) => {
    b.addEventListener("click", () => { BOOKING_VIEW.pick = +b.dataset.day; paintBooking(); });
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
  document.querySelector("#booking-title").textContent = "부킹";
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
  paintBooking();                       // 예보 없이도 링크는 바로 쓸 수 있게 먼저 그린다

  try {
    const d = await fetchBookingWeek(course);
    if (currentCourse !== course || viewStack[viewStack.length - 1] !== "booking") return;
    if (d && d.daily) { BOOKING_VIEW.wx = d.daily; paintBooking(); }
  } catch (_) { /* 예보를 못 받아도 부킹 연결은 그대로 동작한다 */ }
}

window.openBookingView = openBookingView;
