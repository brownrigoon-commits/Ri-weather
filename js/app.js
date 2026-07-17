/* =========================================================
 * Ri-Weather — 골프장 날씨 베타
 * 데이터: Open-Meteo(예보/대기질), RainViewer(레이더), Nominatim(검색)
 * ========================================================= */
"use strict";

const STORAGE_KEY = "riweather.courses.v1";

/* ---------- WMO 날씨 코드 → 설명/아이콘 ---------- */
const WMO = {
  0:  ["맑음", "☀️"],       1:  ["대체로 맑음", "🌤️"],
  2:  ["구름 조금", "⛅️"],  3:  ["흐림", "☁️"],
  45: ["안개", "🌫️"],       48: ["착빙 안개", "🌫️"],
  51: ["약한 이슬비", "🌦️"], 53: ["이슬비", "🌦️"], 55: ["강한 이슬비", "🌧️"],
  56: ["어는 이슬비", "🌧️"], 57: ["강한 어는 이슬비", "🌧️"],
  61: ["약한 비", "🌧️"],    63: ["비", "🌧️"],     65: ["강한 비", "🌧️"],
  66: ["어는 비", "🌧️"],    67: ["강한 어는 비", "🌧️"],
  71: ["약한 눈", "🌨️"],    73: ["눈", "🌨️"],     75: ["강한 눈", "❄️"],
  77: ["싸락눈", "🌨️"],
  80: ["약한 소나기", "🌦️"], 81: ["소나기", "🌧️"], 82: ["강한 소나기", "⛈️"],
  85: ["소낙눈", "🌨️"],     86: ["강한 소낙눈", "❄️"],
  95: ["뇌우", "⛈️"],       96: ["뇌우·우박", "⛈️"], 99: ["강한 뇌우·우박", "⛈️"],
};
const wmoDesc = (c) => (WMO[c] || ["-", "🌡️"])[0];
const wmoIcon = (c) => (WMO[c] || ["-", "🌡️"])[1];
const wmoClass = (c) => {
  if (c === 0 || c === 1) return "wx-clear";
  if (c >= 71 && c <= 86) return "wx-snow";
  if (c >= 51) return "wx-rain";
  return "";
};

const DIR_KO = ["북", "북북동", "북동", "동북동", "동", "동남동", "남동", "남남동",
                "남", "남남서", "남서", "서남서", "서", "서북서", "북서", "북북서"];
const windDirKo = (deg) => DIR_KO[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];

const DAY_NAMES = ["오늘", "내일", "모레", "3일 후"];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const fmtDayDate = (dOff, t) =>
  `${DAY_NAMES[dOff] || ""}(${WEEKDAYS[t.getDay()]}) ${t.getMonth() + 1}/${t.getDate()}`;

/* ---------- 유틸 ---------- */
const $ = (sel) => document.querySelector(sel);
const fmtHourKo = (d) => {
  const h = d.getHours();
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}시`;
};
const fmtHM = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const dayOffsetFrom = (base, t) =>
  Math.round((new Date(t).setHours(0, 0, 0, 0) - new Date(base).setHours(0, 0, 0, 0)) / 864e5);
const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

function loadCourses() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveCourses(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/* ---------- API ---------- */
async function fetchForecast(lat, lon) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly: "temperature_2m,precipitation_probability,precipitation,weather_code,relative_humidity_2m,dew_point_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code",
    wind_speed_unit: "ms",
    timezone: "Asia/Seoul",
    forecast_days: "3",
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("forecast HTTP " + res.status);
  return res.json();
}

async function fetchAir(lat, lon) {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.search = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: "pm10,pm2_5",
    timezone: "Asia/Seoul",
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("air HTTP " + res.status);
  return res.json();
}

/* 전국 격자(약 0.5°)의 시간별 강수 예보 — 예보 지도 렌더링용 */
const GRID = {
  latMin: 33.0, latMax: 39.0,
  lonMin: 124.4, lonMax: 130.4,
  step: 0.4,
};
GRID.nLat = Math.round((GRID.latMax - GRID.latMin) / GRID.step) + 1; // 13
GRID.nLon = Math.round((GRID.lonMax - GRID.lonMin) / GRID.step) + 1; // 13

async function fetchPrecipGrid() {
  const lats = [], lons = [];
  // 북→남, 서→동 순서 (캔버스 픽셀 순서와 일치)
  for (let r = 0; r < GRID.nLat; r++) {
    for (let c = 0; c < GRID.nLon; c++) {
      lats.push((GRID.latMax - r * GRID.step).toFixed(1));
      lons.push((GRID.lonMin + c * GRID.step).toFixed(1));
    }
  }
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: lats.join(","), longitude: lons.join(","),
    hourly: "precipitation",
    timezone: "Asia/Seoul",
    forecast_days: "3",
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("grid HTTP " + res.status);
  return res.json();
}

async function searchPlaces(q) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q, format: "jsonv2", "accept-language": "ko",
    countrycodes: "kr", limit: "8",
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("search HTTP " + res.status);
  return res.json();
}

/* 좌표 → 간단한 행정구역 주소 (골프장 DB 항목용) */
async function reverseGeocode(lat, lon) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    lat, lon, format: "jsonv2", "accept-language": "ko", zoom: "10",
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("reverse HTTP " + res.status);
  const j = await res.json();
  const a = j.address || {};
  return [a.province || a.state, a.city || a.county, a.borough || a.district]
    .filter(Boolean).join(" ");
}

/* ---------- 내장 골프장 DB 검색 ---------- */
/* "울산cc" ↔ "울산컨트리클럽" ↔ "울산CC" 같은 표기 차이를 흡수 */
function normName(s) {
  return s.toLowerCase()
    .replace(/[\s·.\-()&']/g, "")
    .replace(/컨트리클럽|칸트리클럽|countryclub/g, "cc")
    .replace(/골프클럽|golfclub/g, "gc")
    .replace(/골프장|골프리조트|golfresort|golf&resort/g, "");
}
const stripSuffix = (s) => s.replace(/(cc|gc|골프|golf|리조트|resort)+$/g, "");

function searchGolfDB(q) {
  if (typeof GOLF_DB === "undefined") return [];
  const nq = normName(q);
  if (nq.length < 2) return [];
  const cq = stripSuffix(nq);
  const scored = [];
  for (const g of GOLF_DB) {
    if (!g._n) { g._n = normName(g.n); g._c = stripSuffix(g._n); }
    let score = -1;
    if (g._n === nq) score = 100;
    else if (g._n.includes(nq)) score = 80 - (g._n.length - nq.length);
    else if (cq.length >= 2 && g._c === cq) score = 90;
    else if (cq.length >= 2 && g._c.includes(cq)) score = 60 - (g._c.length - cq.length);
    else if (g._c.length >= 3 && nq.includes(g._c)) score = 40;
    if (score >= 0) scored.push([score, g]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, 6).map(([, g]) => g);
}

/* PM10/PM2.5 등급 (한국 환경부 기준) */
function pmGrade(v, isPm25) {
  const t = isPm25 ? [15, 35, 75] : [30, 80, 150];
  if (v == null) return ["-", ""];
  if (v <= t[0]) return ["좋음", "grade-good"];
  if (v <= t[1]) return ["보통", "grade-normal"];
  if (v <= t[2]) return ["나쁨", "grade-bad"];
  return ["매우나쁨", "grade-worst"];
}

/* =========================================================
 * 홈 화면
 * ========================================================= */
const homeView = $("#home-view");
const detailView = $("#detail-view");
const courseListEl = $("#course-list");
const emptyEl = $("#empty-state");
const searchInput = $("#search-input");
const searchResults = $("#search-results");
const searchStatus = $("#search-status");
const searchClear = $("#search-clear");

function renderHome() {
  const courses = loadCourses();
  courseListEl.innerHTML = "";
  emptyEl.hidden = courses.length > 0;

  courses.forEach((c) => {
    const card = document.createElement("article");
    card.className = "course-card";
    card.innerHTML = `
      <div class="cc-top">
        <div>
          <div class="cc-name">${c.name}</div>
          <div class="cc-sub">${c.addr || ""}</div>
        </div>
        <div style="display:flex;align-items:flex-start">
          <div class="cc-temp">--°</div>
          <button class="cc-del" aria-label="삭제">✕</button>
        </div>
      </div>
      <div class="cc-bottom">
        <span class="cc-desc">불러오는 중...</span>
        <span class="cc-minmax"></span>
      </div>`;
    card.addEventListener("click", () => openDetail(c));
    card.querySelector(".cc-del").addEventListener("click", (e) => {
      e.stopPropagation();
      if (!confirm(`'${c.name}'을(를) 목록에서 삭제할까요?`)) return;
      saveCourses(loadCourses().filter((x) => x.id !== c.id));
      renderHome();
    });
    courseListEl.appendChild(card);

    fetchForecast(c.lat, c.lon).then((d) => {
      const cur = d.current;
      const wxCls = wmoClass(cur.weather_code);
      if (wxCls) card.classList.add(wxCls);
      card.querySelector(".cc-temp").textContent = Math.round(cur.temperature_2m) + "°";
      card.querySelector(".cc-desc").textContent = wmoIcon(cur.weather_code) + " " + wmoDesc(cur.weather_code);
      card.querySelector(".cc-minmax").textContent =
        `최고:${Math.round(d.daily.temperature_2m_max[0])}° 최저:${Math.round(d.daily.temperature_2m_min[0])}°`;
    }).catch(() => {
      card.querySelector(".cc-desc").textContent = "날씨를 불러오지 못했습니다";
    });
  });
}

/* ---------- 검색 ---------- */
function hideSearchUI() {
  searchResults.hidden = true;
  searchStatus.hidden = true;
}

function renderResultItem(entry) {
  const li = document.createElement("li");
  li.innerHTML = `
    <div class="r-name">${entry.name}${entry.golf ? '<span class="r-tag">⛳ 골프장</span>' : '<span class="r-tag r-tag-area">📍 지역</span>'}</div>
    <div class="r-addr">${entry.addr || (entry.golf ? "골프장" : "")}</div>`;
  li.addEventListener("click", () => {
    hideSearchUI();
    searchInput.value = "";
    searchClear.hidden = true;
    openDetail({ id: entry.id, name: entry.name, addr: entry.addr || "", lat: entry.lat, lon: entry.lon });
  });
  return li;
}

const runSearch = debounce(async (q) => {
  if (q.length < 2) { hideSearchUI(); return; }

  /* 1) 내장 골프장 DB — 즉시 표시 */
  const golf = searchGolfDB(q).map((g) => ({
    id: "gdb-" + g.lat + "," + g.lon,
    name: g.n, addr: "", lat: g.lat, lon: g.lon, golf: true,
  }));

  searchResults.innerHTML = "";
  searchStatus.hidden = true;
  if (golf.length) {
    golf.forEach((e) => searchResults.appendChild(renderResultItem(e)));
    searchResults.hidden = false;
  } else {
    searchStatus.textContent = "검색 중...";
    searchStatus.hidden = false;
    searchResults.hidden = true;
  }

  /* 2) 지역/주소 검색 (Nominatim) — 도착하면 아래에 추가 */
  let nomi = [];
  try { nomi = await searchPlaces(q); } catch { /* 지역 검색 실패해도 골프장 결과는 유지 */ }
  if (searchInput.value.trim() !== q) return; // 입력이 바뀌었으면 무시

  const isGolfPlace = (r) =>
    r.type === "golf_course" || /golf|골프|cc|컨트리/i.test(r.display_name + " " + (r.name || ""));
  const golfNorms = new Set(golf.map((e) => normName(e.name)));
  const areas = nomi
    .filter((r) => !(isGolfPlace(r) && golfNorms.has(normName(r.name || r.display_name.split(",")[0]))))
    .slice(0, Math.max(3, 8 - golf.length))
    .map((r) => {
      const name = r.name || r.display_name.split(",")[0];
      const addr = r.display_name.split(",").slice(1).map((s) => s.trim()).slice(0, 3).reverse().join(" ");
      return {
        id: "osm-" + r.place_id, name, addr,
        lat: parseFloat(r.lat), lon: parseFloat(r.lon), golf: isGolfPlace(r),
      };
    });

  if (!golf.length && !areas.length) {
    searchStatus.textContent = `'${q}' 검색 결과가 없습니다. 골프장 이름이나 지역명(예: 제주 서귀포)으로 검색해 보세요.`;
    searchStatus.hidden = false;
    return;
  }
  searchStatus.hidden = true;
  areas.forEach((e) => searchResults.appendChild(renderResultItem(e)));
  searchResults.hidden = false;
}, 350);

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  searchClear.hidden = q.length === 0;
  runSearch(q);
});
searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchClear.hidden = true;
  hideSearchUI();
  searchInput.focus();
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrap")) hideSearchUI();
});

/* =========================================================
 * 상세 화면
 * ========================================================= */
let currentCourse = null;

function isSaved(id) {
  return loadCourses().some((c) => c.id === id);
}

function updateSaveBtn() {
  const btn = $("#btn-save");
  const saved = isSaved(currentCourse.id);
  btn.textContent = saved ? "★" : "☆";
  btn.classList.toggle("saved", saved);
}

$("#btn-save").addEventListener("click", () => {
  const list = loadCourses();
  if (isSaved(currentCourse.id)) {
    saveCourses(list.filter((c) => c.id !== currentCourse.id));
  } else {
    list.push(currentCourse);
    saveCourses(list);
  }
  updateSaveBtn();
});

$("#btn-back").addEventListener("click", () => {
  detailView.hidden = true;
  homeView.hidden = false;
  stopPlay();
  renderHome();
});

// 스크롤 시 상단 미니 타이틀 표시
window.addEventListener("scroll", () => {
  $("#detail-title-mini").classList.toggle("show", window.scrollY > 140);
});

async function openDetail(course) {
  currentCourse = course;
  homeView.hidden = true;
  detailView.hidden = false;
  window.scrollTo(0, 0);
  updateSaveBtn();

  $("#hero-name").textContent = course.name;
  $("#detail-title-mini").textContent = course.name;
  $("#hero-addr").textContent = course.addr || "";

  // 내장 DB 골프장은 주소가 없으므로 지역명을 뒤에서 채움
  if (!course.addr) {
    reverseGeocode(course.lat, course.lon).then((addr) => {
      if (currentCourse !== course || !addr) return;
      course.addr = addr;
      $("#hero-addr").textContent = addr;
      const list = loadCourses();
      const saved = list.find((c) => c.id === course.id);
      if (saved && !saved.addr) { saved.addr = addr; saveCourses(list); }
    }).catch(() => {});
  }
  $("#hero-temp").textContent = "--°";
  $("#hero-desc").textContent = "불러오는 중...";
  $("#hero-minmax").textContent = "";
  $("#summary-text").textContent = "예보를 불러오는 중입니다...";
  $("#hourly-scroll").innerHTML = "";
  $("#precip-scroll").innerHTML = "";

  resetMapState(course);
  initRadar();                 // 실황 레이더 프레임 로드 (백그라운드)
  const airP = fetchAir(course.lat, course.lon).catch(() => null);

  let data;
  try {
    data = await fetchForecast(course.lat, course.lon);
  } catch (e) {
    $("#summary-text").textContent = "날씨 데이터를 불러오지 못했습니다. 네트워크를 확인해 주세요.";
    return;
  }
  renderDetail(data, await airP);
  buildForecastFrames(data);   // 예보 지도 프레임 생성 (기본 모드)
}

/* 상세 데이터 중 지도/동기화에 필요한 것 */
let fc = { times: [], precip: [], startIdx: 0 };

function renderDetail(d, air) {
  const cur = d.current;

  /* 히어로 */
  $("#hero-temp").textContent = Math.round(cur.temperature_2m) + "°";
  $("#hero-desc").textContent = wmoDesc(cur.weather_code);
  $("#hero-minmax").textContent =
    `최고:${Math.round(d.daily.temperature_2m_max[0])}° 최저:${Math.round(d.daily.temperature_2m_min[0])}°`;

  /* 시간별 (현재부터 24시간) */
  const now = new Date();
  const times = d.hourly.time.map((t) => new Date(t));
  let startIdx = times.findIndex((t) => t.getTime() >= now.getTime() - 3600e3);
  if (startIdx < 0) startIdx = 0;
  fc = { times, precip: d.hourly.precipitation, startIdx };

  const hourlyEl = $("#hourly-scroll");
  hourlyEl.innerHTML = "";
  for (let i = startIdx; i < Math.min(startIdx + 24, times.length); i++) {
    const item = document.createElement("div");
    const isNow = i === startIdx;
    item.className = "hour-item" + (isNow ? " now" : "");
    const pop = d.hourly.precipitation_probability[i];
    item.innerHTML = `
      <span class="h-time">${isNow ? "지금" : fmtHourKo(times[i])}</span>
      <span class="h-icon">${wmoIcon(d.hourly.weather_code[i])}</span>
      <span class="h-pop">${pop >= 20 ? pop + "%" : ""}</span>
      <span class="h-temp">${Math.round(d.hourly.temperature_2m[i])}°</span>`;
    hourlyEl.appendChild(item);
  }

  /* 요약 문장 */
  let summary = "";
  let rainIdx = -1;
  for (let i = startIdx; i < Math.min(startIdx + 12, times.length); i++) {
    if (d.hourly.precipitation[i] >= 0.1 || d.hourly.precipitation_probability[i] >= 60) { rainIdx = i; break; }
  }
  if (cur.precipitation >= 0.1) {
    summary = `현재 시간당 ${cur.precipitation}mm의 강수가 관측되고 있습니다.`;
  } else if (rainIdx >= 0) {
    const amt = d.hourly.precipitation[rainIdx];
    summary = `${fmtHourKo(times[rainIdx])}쯤 강우 상태가 예상됩니다.` + (amt >= 0.1 ? ` 예상 강수량은 시간당 ${amt}mm입니다.` : "");
  } else {
    summary = "앞으로 12시간 동안 강수 소식은 없습니다.";
  }
  const maxGust = Math.max(...d.hourly.wind_gusts_10m.slice(startIdx, startIdx + 12));
  summary += ` 돌풍의 풍속은 최대 ${Math.round(maxGust)}m/s입니다.`;
  $("#summary-text").textContent = summary;

  /* 시간별 강수 예보 (모레까지) — 지도 타임라인과 1:1 동기화 */
  const precipEl = $("#precip-scroll");
  precipEl.innerHTML = "";
  const maxMm = Math.max(1, ...d.hourly.precipitation.slice(startIdx));
  for (let i = startIdx; i < times.length; i++) {
    const t = times[i];
    const mm = d.hourly.precipitation[i];
    const pop = d.hourly.precipitation_probability[i];
    const dOff = dayOffsetFrom(times[startIdx], t);
    const isDayStart = i > startIdx && t.getHours() === 0;
    const isNoon = t.getHours() === 12;
    const isNow = i === startIdx;

    // 날짜 라벨: 지금 / 자정(날짜 바뀜) / 정오(중간 리마인드)
    let dayLabel = "";
    if (isNow || isDayStart) dayLabel = fmtDayDate(dOff, t);
    else if (isNoon) dayLabel = `<i>${t.getMonth() + 1}/${t.getDate()}</i>`;

    const cell = document.createElement("div");
    cell.className = "p-hour" + (isDayStart ? " day-start" : "") + (isNow ? " now" : "");
    cell.dataset.idx = i;
    const barH = Math.max(2, Math.round((mm / maxMm) * 44));
    cell.innerHTML = `
      <span class="p-day">${dayLabel}</span>
      <span class="p-time">${isNow ? "지금" : t.getHours() + "시"}</span>
      <span class="p-bar"><i class="${mm > 0 ? "" : "zero"}" style="height:${mm > 0 ? barH : 2}px"></i></span>
      <span class="p-mm ${mm > 0 ? "has-rain" : "dry"}">${mm > 0 ? mm : 0}<small>mm</small></span>
      <span class="p-pop ${pop >= 60 ? "high" : ""}">${pop >= 10 ? pop + "%" : "-"}</span>`;
    // 칸을 탭하면 예보 지도가 그 시간으로 점프
    cell.addEventListener("click", () => {
      if (!fcFrames.length) return;
      stopPlay();
      setMode("fc");
      showFcFrame(i - fc.startIdx);
    });
    precipEl.appendChild(cell);
  }

  /* 지표 카드 */
  const todayPrecip = d.daily.precipitation_sum[0];
  $("#m-precip").innerHTML = `${cur.precipitation ?? 0}<small> mm/h</small>`;
  $("#m-precip-sub").textContent = `오늘 예상 누적 ${todayPrecip ?? 0}mm`;

  const curIdx = Math.max(0, startIdx);
  $("#m-humidity").innerHTML = `${cur.relative_humidity_2m}<small> %</small>`;
  $("#m-humidity-sub").textContent = `이슬점 ${Math.round(d.hourly.dew_point_2m[curIdx])}° · 체감 ${Math.round(cur.apparent_temperature)}°`;

  const ws = Math.round(cur.wind_speed_10m * 10) / 10;
  const gust = Math.round(cur.wind_gusts_10m * 10) / 10;
  $("#m-wind").innerHTML = `${ws}<small> m/s</small>`;
  $("#m-wind-arrow").style.transform = `rotate(${(cur.wind_direction_10m + 180) % 360}deg)`;
  $("#m-wind-sub").textContent = `${windDirKo(cur.wind_direction_10m)}풍 · 돌풍 ${gust}m/s`;

  const visKm = d.hourly.visibility[curIdx] / 1000;
  $("#m-vis").innerHTML = `${visKm >= 10 ? Math.round(visKm) : visKm.toFixed(1)}<small> km</small>`;
  if (air && air.current) {
    const [g10, c10] = pmGrade(air.current.pm10, false);
    const [g25, c25] = pmGrade(air.current.pm2_5, true);
    $("#m-vis-sub").innerHTML =
      `미세먼지 <b class="${c10}">${g10}</b> (${Math.round(air.current.pm10)}) · 초미세 <b class="${c25}">${g25}</b> (${Math.round(air.current.pm2_5)})`;
  } else {
    $("#m-vis-sub").textContent = "미세먼지 정보를 불러오지 못했습니다";
  }

  updatePrecipChip(cur.precipitation ?? 0);
}

/* =========================================================
 * 강수 지도 — 예보(기본) + 실황 레이더 겸용
 * ========================================================= */
let map = null;
let mapMode = "fc";              // 'fc' 예보 | 'rv' 실황
let playTimer = null;

/* 실황(RainViewer) 상태 */
let rvFrames = [];               // {time, layer, isNowcast}
let rvActive = -1;

/* 예보(Open-Meteo 격자) 상태 */
let fcFrames = [];               // {time, url, hourIdx, mmAtCourse}
let fcActive = -1;
let fcOverlay = null;

let courseDotMarker = null;
let precipChipMarker = null;

const slider = $("#radar-slider");
const playBtn = $("#radar-play");

function ensureMap(lat, lon) {
  if (map) {
    map.setView([lat, lon], 7);
    return;
  }
  map = L.map("map", {
    zoomControl: false,
    attributionControl: true,
    scrollWheelZoom: false,
    maxZoom: 10, minZoom: 5,
  }).setView([lat, lon], 7);
  // 지명 라벨을 강수 오버레이 위에 올려 지도 가독성 확보
  const labelPane = map.createPane("labels");
  labelPane.style.zIndex = 450;
  labelPane.style.pointerEvents = "none";
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OSM &copy; CARTO",
    subdomains: "abcd", maxZoom: 10, minZoom: 5,
  }).addTo(map);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd", maxZoom: 10, minZoom: 5, pane: "labels",
  }).addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);
}

function placeCourseDot(lat, lon) {
  if (courseDotMarker) map.removeLayer(courseDotMarker);
  if (precipChipMarker) map.removeLayer(precipChipMarker);
  courseDotMarker = L.marker([lat, lon], {
    icon: L.divIcon({ className: "", html: '<div class="course-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
    interactive: false, zIndexOffset: 500,
  }).addTo(map);
  precipChipMarker = L.marker([lat, lon], {
    icon: L.divIcon({ className: "", html: `<div class="precip-chip" id="precip-chip">강수량<br><b>-</b> mm/h</div>`, iconSize: [0, 0] }),
    interactive: false, zIndexOffset: 600,
  }).addTo(map);
}

function updatePrecipChip(mmh) {
  const el = document.getElementById("precip-chip");
  if (el) el.innerHTML = `강수량<br><b>${mmh}</b> mm/h`;
}

/* 코스 변경 시 지도 상태 초기화 */
function resetMapState(course) {
  ensureMap(course.lat, course.lon);
  placeCourseDot(course.lat, course.lon);
  stopPlay();
  rvFrames.forEach((f) => map.removeLayer(f.layer));
  rvFrames = []; rvActive = -1;
  if (fcOverlay) { map.removeLayer(fcOverlay); fcOverlay = null; }
  fcFrames = []; fcActive = -1;
  $("#radar-updated").textContent = "";
}

/* ---------- 실황 레이더 (RainViewer) ---------- */
async function initRadar() {
  let json;
  try {
    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
    json = await res.json();
  } catch {
    return;
  }
  const host = json.host;
  const all = [
    ...(json.radar?.past || []).map((f) => ({ ...f, isNowcast: false })),
    ...(json.radar?.nowcast || []).map((f) => ({ ...f, isNowcast: true })),
  ];
  if (!all.length) return;

  rvFrames = all.map((f) => ({
    time: new Date(f.time * 1000),
    isNowcast: f.isNowcast,
    // RainViewer 무료 타일은 줌 7까지만 실데이터 제공 → 그 이상은 업스케일
    layer: L.tileLayer(`${host}${f.path}/256/{z}/{x}/{y}/4/1_1.png`, {
      opacity: 0, zIndex: 200, maxNativeZoom: 7, maxZoom: 10,
    }),
  }));
  rvFrames.forEach((f) => f.layer.addTo(map));
  rvActive = all.reduce((acc, f, i) => (f.isNowcast ? acc : i), 0);
  if (mapMode === "rv") setMode("rv"); // 이미 실황 모드면 UI 갱신
}

/* ---------- 예보 지도 (Open-Meteo 격자 → 캔버스) ---------- */
function precipRGBA(mm) {
  if (mm < 0.1) return [0, 0, 0, 0];
  if (mm < 1)   return [136, 226, 161, 150]; // 약
  if (mm < 4)   return [247, 226, 107, 170]; // 중
  if (mm < 10)  return [242, 153, 74, 185];  // 강
  return [235, 87, 87, 200];                 // 매우강
}

async function buildForecastFrames(detailData) {
  $("#radar-updated").textContent = "예보 지도 생성 중...";
  let grid;
  try {
    grid = await fetchPrecipGrid();
  } catch {
    $("#radar-updated").textContent = "예보 지도 로딩 실패";
    return;
  }
  if (!Array.isArray(grid)) grid = [grid];

  // 상세 예보의 시작 시각과 격자 데이터의 시간축 정렬
  const startIso = detailData.hourly.time[fc.startIdx];
  let gStart = grid[0].hourly.time.indexOf(startIso);
  if (gStart < 0) gStart = 0;
  const nFrames = Math.min(grid[0].hourly.time.length - gStart, fc.times.length - fc.startIdx);

  const small = document.createElement("canvas");
  small.width = GRID.nLon; small.height = GRID.nLat;
  const sctx = small.getContext("2d");
  const big = document.createElement("canvas");
  big.width = GRID.nLon * 36; big.height = GRID.nLat * 36;
  const bctx = big.getContext("2d");
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = "high";

  fcFrames = [];
  for (let k = 0; k < nFrames; k++) {
    const img = sctx.createImageData(GRID.nLon, GRID.nLat);
    for (let p = 0; p < grid.length; p++) {
      const mm = grid[p].hourly.precipitation[gStart + k] ?? 0;
      const [r, g, b, a] = precipRGBA(mm);
      img.data[p * 4] = r; img.data[p * 4 + 1] = g;
      img.data[p * 4 + 2] = b; img.data[p * 4 + 3] = a;
    }
    sctx.putImageData(img, 0, 0);
    bctx.clearRect(0, 0, big.width, big.height);
    bctx.drawImage(small, 0, 0, big.width, big.height);
    const hourIdx = fc.startIdx + k;
    fcFrames.push({
      time: fc.times[hourIdx],
      hourIdx,
      mmAtCourse: fc.precip[hourIdx] ?? 0,
      url: big.toDataURL("image/png"),
    });
  }

  const half = GRID.step / 2;
  const bounds = [[GRID.latMin - half, GRID.lonMin - half], [GRID.latMax + half, GRID.lonMax + half]];
  if (fcOverlay) map.removeLayer(fcOverlay);
  fcOverlay = L.imageOverlay(fcFrames[0].url, bounds, { opacity: 0.58, zIndex: 210 });

  if (mapMode === "fc") setMode("fc");
}

/* ---------- 모드 전환 / 프레임 표시 / 재생 ---------- */
document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    stopPlay();
    setMode(btn.dataset.mode);
  });
});

function setMode(m) {
  mapMode = m;
  document.querySelectorAll(".mode-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === m));

  // 반대 모드 레이어 숨김
  if (m === "fc") {
    if (rvActive >= 0 && rvFrames[rvActive]) rvFrames[rvActive].layer.setOpacity(0);
    if (!fcFrames.length) {
      $("#radar-time").textContent = "--:--";
      return;
    }
    if (fcOverlay && !map.hasLayer(fcOverlay)) fcOverlay.addTo(map);
    slider.max = fcFrames.length - 1;
    $("#radar-t0").textContent = "지금";
    $("#radar-tmid").textContent = "내일";
    $("#radar-t1").textContent = DAY_NAMES[dayOffsetFrom(fcFrames[0].time, fcFrames[fcFrames.length - 1].time)] || "모레";
    $("#radar-updated").textContent = "1시간 간격 · " + fcFrames.length + "시간";
    showFcFrame(fcActive >= 0 ? fcActive : 0);
  } else {
    if (fcOverlay && map.hasLayer(fcOverlay)) map.removeLayer(fcOverlay);
    clearStripHighlight();
    if (!rvFrames.length) {
      $("#radar-time").textContent = "--:--";
      $("#radar-updated").textContent = "레이더 로딩 중...";
      return;
    }
    slider.max = rvFrames.length - 1;
    $("#radar-t0").textContent = fmtHM(rvFrames[0].time);
    $("#radar-tmid").textContent = "지금";
    $("#radar-t1").textContent = fmtHM(rvFrames[rvFrames.length - 1].time);
    const lastPast = rvFrames.reduce((acc, f, i) => (f.isNowcast ? acc : i), 0);
    $("#radar-updated").textContent = "업데이트 " + fmtHM(rvFrames[lastPast].time);
    showRvFrame(rvActive >= 0 ? rvActive : lastPast);
  }
}

function setSliderUI(i, max) {
  slider.value = i;
  slider.style.setProperty("--fill", max > 0 ? (i / max) * 100 + "%" : "0%");
}

function showRvFrame(i) {
  if (!rvFrames.length) return;
  i = Math.max(0, Math.min(rvFrames.length - 1, i));
  if (rvActive >= 0) rvFrames[rvActive].layer.setOpacity(0);
  rvFrames[i].layer.setOpacity(0.72);
  rvActive = i;
  setSliderUI(i, rvFrames.length - 1);
  $("#radar-time").textContent = fmtHM(rvFrames[i].time);
  const badge = $("#radar-badge");
  badge.textContent = rvFrames[i].isNowcast ? "예측" : "과거";
  badge.className = "badge " + (rvFrames[i].isNowcast ? "future" : "past");
}

function clearStripHighlight() {
  document.querySelectorAll(".p-hour.active").forEach((el) => el.classList.remove("active"));
}

function showFcFrame(k) {
  if (!fcFrames.length) return;
  k = Math.max(0, Math.min(fcFrames.length - 1, k));
  const f = fcFrames[k];
  fcOverlay.setUrl(f.url);
  fcActive = k;
  setSliderUI(k, fcFrames.length - 1);

  const dOff = dayOffsetFrom(fcFrames[0].time, f.time);
  $("#radar-time").textContent =
    (k === 0 ? "지금" : `${DAY_NAMES[dOff] || ""}(${WEEKDAYS[f.time.getDay()]}) ${f.time.getHours()}시`);
  const badge = $("#radar-badge");
  badge.textContent = `예보 · ${f.time.getMonth() + 1}/${f.time.getDate()}`;
  badge.className = "badge future";

  // 골프장 지점 강수량 칩 + 하단 강수 타임라인 동기화
  updatePrecipChip(f.mmAtCourse);
  clearStripHighlight();
  const cell = document.querySelector(`.p-hour[data-idx="${f.hourIdx}"]`);
  if (cell) {
    cell.classList.add("active");
    // 페이지(세로) 스크롤은 건드리지 않고 타임라인 가로 스크롤만 이동
    const wrap = $("#precip-scroll");
    const wr = wrap.getBoundingClientRect();
    const cr = cell.getBoundingClientRect();
    const target = wrap.scrollLeft + (cr.left - wr.left) - (wr.width - cr.width) / 2;
    wrap.scrollTo({ left: target, behavior: playTimer ? "auto" : "smooth" });
  }
}

slider.addEventListener("input", () => {
  stopPlay();
  if (mapMode === "fc") showFcFrame(Number(slider.value));
  else showRvFrame(Number(slider.value));
});

function stopPlay() {
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
  playBtn.textContent = "▶";
  playBtn.classList.remove("playing");
}

playBtn.addEventListener("click", () => {
  if (playTimer) { stopPlay(); return; }
  const frames = mapMode === "fc" ? fcFrames : rvFrames;
  if (!frames.length) return;
  playBtn.textContent = "⏸";
  playBtn.classList.add("playing");
  playTimer = setInterval(() => {
    if (mapMode === "fc") showFcFrame((fcActive + 1) % fcFrames.length);
    else showRvFrame((rvActive + 1) % rvFrames.length);
  }, mapMode === "fc" ? 800 : 650);
});

/* ---------- 시작 ---------- */
renderHome();

/* PWA 서비스 워커 (HTTPS 또는 localhost에서만 동작) */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
