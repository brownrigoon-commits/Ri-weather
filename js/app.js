/* =========================================================
 * 투어리스트 (TOURLIST, 구 골프라이프) — 골프 날씨·코스공략·맛집·스코어·클럽 피팅
 * 데이터: Open-Meteo(예보/대기질), RainViewer(레이더), Nominatim(검색)
 * ========================================================= */
"use strict";

const APP_VER = "v231"; // 배포 버전 (홈 화면 배지에 표시)
const APP_NOTE = "코스명 진짜 이름으로"; // 이번 업데이트 내용 — 배포 시 자동 갱신됨
const STORAGE_KEY = "riweather.courses.v1";

/* 나중에 필요할 때 불러오는 파일 목록 (2026-07-31 신설).
   index.html 의 <script src=...> 에 없는 파일은 배포 관문이 통째로 놓친다 —
   저장소에서 빠지거나 배포가 404 여도 아무도 모른다(js/legal.js 404 사고와 같은 구멍).
   그래서 **여기 적힌 것만** 지연 로드하고, release_courses.py 와 verify_deploy.py 가
   이 목록을 읽어 '저장소에 있는지·실서버에서 받아지는지'를 함께 검사한다.
   ⚠️ 동적으로 불러오는 파일을 새로 만들면 반드시 여기에 먼저 적을 것.
   (일본 홀맵 js/holeimgdb_jp.js 가 첫 사용처가 된다) */
const LAZY_FILES = [];
const GEM_KEY = "riweather.gemini"; // 정밀 인식(비전 AI) 개인 키 저장소
// 기본 제공 키 (무료 한도 공유) — 개인 키를 설정하면 그 키가 우선됩니다
const EMBED_GEM_B64 = "QVEuQWI4Uk42S29NMXN6VU9DbnE3UUpCQUc2b1FtUU1hMnc5RnpONnF3WnlVUG43WjdHMXc=";
const getGemKey = () => localStorage.getItem(GEM_KEY) || atob(EMBED_GEM_B64);

/* ---------- WMO 날씨 코드 → 설명/아이콘 ---------- */
const WMO = {
  0:  [tr("app.wmo.0"), "☀️"],       1:  [tr("app.wmo.1"), "🌤️"],
  2:  [tr("app.wmo.2"), "⛅️"],  3:  [tr("app.wmo.3"), "☁️"],
  45: [tr("app.wmo.45"), "🌫️"],       48: [tr("app.wmo.48"), "🌫️"],
  51: [tr("app.wmo.51"), "🌦️"], 53: [tr("app.wmo.53"), "🌦️"], 55: [tr("app.wmo.55"), "🌧️"],
  56: [tr("app.wmo.56"), "🌧️"], 57: [tr("app.wmo.57"), "🌧️"],
  61: [tr("app.wmo.61"), "🌧️"],    63: [tr("app.wmo.63"), "🌧️"],     65: [tr("app.wmo.65"), "🌧️"],
  66: [tr("app.wmo.66"), "🌧️"],    67: [tr("app.wmo.67"), "🌧️"],
  71: [tr("app.wmo.71"), "🌨️"],    73: [tr("app.wmo.73"), "🌨️"],     75: [tr("app.wmo.75"), "❄️"],
  77: [tr("app.wmo.77"), "🌨️"],
  80: [tr("app.wmo.80"), "🌦️"], 81: [tr("app.wmo.81"), "🌧️"], 82: [tr("app.wmo.82"), "⛈️"],
  85: [tr("app.wmo.85"), "🌨️"],     86: [tr("app.wmo.86"), "❄️"],
  95: [tr("app.wmo.95"), "⛈️"],       96: [tr("app.wmo.96"), "⛈️"], 99: [tr("app.wmo.99"), "⛈️"],
};
const wmoDesc = (c) => (WMO[c] || ["-", "🌡️"])[0];
const wmoIcon = (c) => (WMO[c] || ["-", "🌡️"])[1];
/* 날씨 코드 → 하늘 종류.
   iOS 날씨 앱처럼 카드 배경을 그리기 위해 상태를 조금 더 잘게 나눈다. */
const wmoClass = (c) => {
  if (c === 0) return "wx-clear";
  if (c === 1 || c === 2) return "wx-partly";
  if (c === 3) return "wx-cloud";
  if (c === 45 || c === 48) return "wx-fog";
  if (c >= 95) return "wx-storm";
  // ⚠️ 눈 코드는 71·73·75·77·85·86 뿐이다.
  //    71~86 을 통째로 눈으로 보면 소나기(80·81·82)까지 눈이 되어버린다(기존 버그).
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "wx-snow";
  if (c >= 51) return "wx-rain";
  return "wx-cloud";
};

/* 하늘 장면 — 조건에 맞는 배경과 움직임을 카드 안에 깔아준다.
   비가 오면 빗줄기가 흐르고, 흐리면 구름이 천천히 지나간다(사장님 지시 2026-07-27).
   요소는 CSS 애니메이션만 쓰므로 목록에 여러 장이 있어도 부담이 적다. */
function wxScene(code, isDay) {
  const k = wmoClass(code);
  const night = isDay === 0 || isDay === false;
  const bits = ['<span class="wx-sky"></span>'];
  if (k === "wx-clear" || k === "wx-partly") {
    bits.push(night ? '<span class="wx-moon"></span><span class="wx-stars"></span>'
                    : '<span class="wx-sun"></span>');
  }
  if (k !== "wx-clear") {
    const n = (k === "wx-partly") ? 2 : 3;
    for (let i = 1; i <= n; i++) bits.push(`<span class="wx-puff c${i}"></span>`);
  }
  if (k === "wx-rain") bits.push('<span data-fx="rain"></span>');
  if (k === "wx-storm") bits.push('<span data-fx="storm"></span>');
  if (k === "wx-snow") bits.push('<span data-fx="snow"></span>');
  if (k === "wx-storm") bits.push('<span class="wx-bolt"></span>');
  if (k === "wx-fog") bits.push('<span class="wx-haze"></span>');
  return `<div class="wx-scene ${k}${night ? " is-night" : ""}" aria-hidden="true">${bits.join("")}</div>`;
}

const DIR_KO = tr("app.dir").split(",");
const windDirKo = (deg) => DIR_KO[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];

const DAY_NAMES = tr("app.day.names").split(",");
const WEEKDAYS = tr("app.dow").split(",");
const fmtDayDate = (dOff, t) =>
  `${DAY_NAMES[dOff] || ""}(${WEEKDAYS[t.getDay()]}) ${t.getMonth() + 1}/${t.getDate()}`;

/* ---------- 유틸 ---------- */
const $ = (sel) => document.querySelector(sel);
const fmtHourKo = (d) => {
  const h = d.getHours();
  const ampm = h < 12 ? tr("app.time.am") : tr("app.time.pm");
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return tr("app.time.hour", { ampm: ampm, h: h12 });
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
  if (typeof BACKUP !== "undefined") BACKUP.touch();   // 기록이 바뀌면 자동 백업
}

/* ---------- API ---------- */
/* 429(요청 한도) 등 일시적 실패 시 재시도 */
/* 하루치 한도를 다 쓴 상태 — 재시도해도 소용없고 오히려 한도를 더 태운다.
   한 번 확인하면 자정(현지시각)까지 기억해 두고 아예 요청하지 않는다. */
const QUOTA_LS = "riweather.wxquota";
function quotaBlockedUntil() {
  try {
    const t = +localStorage.getItem(QUOTA_LS) || 0;
    return Date.now() < t ? t : 0;
  } catch (_) { return 0; }
}
function markQuotaExhausted() {
  // 30분만 쉬었다가 다시 확인한다.
  // 하루 종일 막아버리면 한도가 풀린 뒤에도 앱이 계속 먹통이 된다 —
  // Open-Meteo 일일 한도는 UTC 자정(한국 오전 9시)에 풀리는데
  // '한국 자정까지 차단'으로 짜서 15시간을 더 막았던 실수가 있었다. (2026-07-28)
  try { localStorage.setItem(QUOTA_LS, String(Date.now() + 30 * 60000)); } catch (_) {}
}

async function fetchJSON(url, { retries = 2, delay = 1200 } = {}) {
  const isMeteo = String(url).indexOf("open-meteo.com") >= 0;
  if (isMeteo && quotaBlockedUntil()) throw new Error("WX_QUOTA");
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetchT(url, null, 10000);   // 연결이 물려도 10초 뒤 재시도·실패 처리로 넘어감
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise((r) => setTimeout(r, delay * (attempt + 1)));
      continue;
    }
    if (res.ok) return res.json();
    if (res.status === 429 && isMeteo) {
      // 분당·시간당 초과는 잠시 뒤 풀리지만, 일일 한도는 내일까지 안 풀린다.
      // 본문을 읽어 구분한다 — 안 그러면 3번 더 두드려 한도만 깎는다. (2026-07-28)
      let reason = "";
      try { reason = (await res.clone().text()).slice(0, 200); } catch (_) {}
      if (/Daily API request limit/i.test(reason)) {
        markQuotaExhausted();
        throw new Error("WX_QUOTA");
      }
    }
    // 429(분·시간 한도)/503 등은 잠시 후 재시도
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await new Promise((r) => setTimeout(r, delay * (attempt + 1)));
      continue;
    }
    throw new Error("HTTP " + res.status);
  }
}

const FC_LS = "riweather.fc.";
/* 좌표가 어느 나라 시간대인가 — 날씨 API 에 넘길 값 (설계 §1)
 *
 * 왜 좌표로 보나: fetchForecast·fetchAir 는 lat/lon 만 받는다. 구장 객체가 없다.
 *
 * 🔴 왜 timezone=auto 를 안 쓰나 — 두 호출의 **시각 문자열이 맞아떨어져야** 한다.
 *    app.js:1473 이 `grid[0].hourly.time.indexOf(startIso)` 로 상세 예보의 시각을
 *    격자 예보에서 찾는다. 격자는 여러 구장을 한 번에 묻는 호출이라 시간대가 하나뿐이고,
 *    auto 로 두면 구장마다 달라져 이 대조가 깨진다(비구름 애니메이션이 죽는다).
 *    그래서 격자는 Asia/Seoul 로 고정하고, 여기서는 **같은 offset 인 나라만** 갈라준다.
 *
 * 일본(JST)은 한국(KST)과 똑같이 UTC+9 라 값이 바뀌지 않는다 —
 * 그래도 명시하는 이유는 **우연에 기대지 않기 위해서**다(해외진출_설계 D4).
 * 중국(UTC+8)은 offset 이 달라 격자 대조가 깨지므로 지금은 건드리지 않는다.
 *
 * ⚠️ 경계 상자로 가르려다 실패했다 — 한국(위도 33~39·경도 124~132)이 일본을 감싸는
 *    어떤 상자에도 들어간다. 대마도·규슈가 한국 동해안과 경도가 겹치기 때문이다.
 *    그래서 **golfdb 에서 그 좌표의 구장을 찾아 나라를 읽는다** — 정확하고 흔들리지 않는다.
 */
let _tzIdx = null;
function tzForCoord(lat, lon) {
  if (typeof GOLF_DB === "undefined") return "Asia/Seoul";
  if (!_tzIdx) {
    _tzIdx = {};
    for (const g of GOLF_DB) _tzIdx[g.lat.toFixed(3) + "," + g.lon.toFixed(3)] = g.c;
  }
  const c = _tzIdx[Number(lat).toFixed(3) + "," + Number(lon).toFixed(3)];
  return c === "JP" ? "Asia/Tokyo" : "Asia/Seoul";
}

async function fetchForecast(lat, lon) {
  // 같은 골프장을 오갈 때마다 새로 받지 않는다 — 15분이면 예보는 바뀌지 않는다
  const ck = FC_LS + lat.toFixed(3) + "," + lon.toFixed(3);
  try {
    const c = JSON.parse(localStorage.getItem(ck) || "null");
    if (c && Date.now() - c.t < 15 * 60000) return c.d;
  } catch (_) {}
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day",
    hourly: "temperature_2m,precipitation_probability,precipitation,weather_code,relative_humidity_2m,dew_point_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code",
    wind_speed_unit: "ms",
    timezone: tzForCoord(lat, lon),
    forecast_days: "3",
  });
  const d = await fetchJSON(url, { retries: 2, delay: 1500 });
  try { localStorage.setItem(ck, JSON.stringify({ t: Date.now(), d: d })); } catch (_) {}
  return d;
}

async function fetchAir(lat, lon) {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.search = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: "pm10,pm2_5",
    timezone: tzForCoord(lat, lon),
  });
  return fetchJSON(url, { retries: 1 });
}

/* 전국 격자(약 0.5°)의 시간별 강수 예보 — 예보 지도 렌더링용 */
/* 예보 격자 — 선택한 지점을 중심으로 동적 생성 (해외 골프장도 그대로 동작) */
/* 격자 1칸 = Open-Meteo 호출 1건으로 계산된다.
   예전엔 ±350km / 0.5° = 13×15 = 195칸이라 지도를 50번만 열어도 하루 무료 한도(1만)를
   통째로 태웠다. 골프 라운딩에 필요한 건 그 골프장 주변 날씨지 전국 지도가 아니다.
   ±180km / 0.6° = 7×7 = 49칸으로 줄였다 (약 4배 절약). (2026-07-28) */
const GRID_STEP = 0.6; // 약 66km 간격
function makeGrid(centerLat, centerLon) {
  const halfLat = 1.8, halfLon = 2.1; // 선택 지점 중심 약 ±200km 커버
  const g = {
    latMin: Math.max(-85, centerLat - halfLat),
    latMax: Math.min(85, centerLat + halfLat),
    lonMin: centerLon - halfLon,
    lonMax: centerLon + halfLon,
    step: GRID_STEP,
  };
  g.nLat = Math.round((g.latMax - g.latMin) / g.step) + 1;
  g.nLon = Math.round((g.lonMax - g.lonMin) / g.step) + 1;
  return g;
}

const GRID_LS = "riweather.precipgrid";
async function fetchPrecipGrid(GRID) {
  // 격자 1칸 = 호출 1건이라 이 지도가 하루 한도의 대부분을 먹는다.
  // 모레까지의 강수 예보는 3시간 안에 의미 있게 바뀌지 않으므로 캐시를 길게 잡는다.
  // (30분 → 3시간: 같은 사용자의 호출이 6분의 1로 준다. 2026-07-28)
  const ck = [GRID.latMax, GRID.lonMin, GRID.nLat, GRID.nLon].join(",");
  try {
    const c = JSON.parse(localStorage.getItem(GRID_LS) || "null");
    if (c && c.k === ck && Date.now() - c.t < 180 * 60000) return c.d;
  } catch (_) {}
  const lats = [], lons = [];
  // 북→남, 서→동 순서 (캔버스 픽셀 순서와 일치)
  for (let r = 0; r < GRID.nLat; r++) {
    for (let c = 0; c < GRID.nLon; c++) {
      lats.push((GRID.latMax - r * GRID.step).toFixed(2));
      lons.push((GRID.lonMin + c * GRID.step).toFixed(2));
    }
  }
  // 병렬 요청으로 분할 (429 시 재시도 포함)
  const chunkSize = 120;
  const jobs = [];
  for (let i = 0; i < lats.length; i += chunkSize) {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: lats.slice(i, i + chunkSize).join(","),
      longitude: lons.slice(i, i + chunkSize).join(","),
      hourly: "precipitation",
      // 🔴 여기만 일부러 고정한다. 격자는 좌표 수백 개를 한 번에 묻는 호출이라
      //    시간대가 하나뿐이고, app.js 의 비구름 코드가 상세 예보의 시각 문자열을
      //    이 응답에서 indexOf 로 찾는다(`grid[0].hourly.time.indexOf(startIso)`).
      //    구장마다 시간대가 달라지면 그 대조가 -1 이 되어 비구름이 죽는다.
      //    일본은 KST 와 같은 UTC+9 라 이대로도 시각이 정확히 맞는다.
      //    ⚠️ 중국(UTC+8)을 붙일 때는 이 구조부터 다시 봐야 한다.
      timezone: "Asia/Seoul",
      forecast_days: "3",
    });
    jobs.push(fetchJSON(url, { retries: 2, delay: 1500 }));
  }
  const parts = await Promise.all(jobs);
  const out = parts.flatMap((p) => (Array.isArray(p) ? p : [p]));
  try { localStorage.setItem(GRID_LS, JSON.stringify({ k: ck, t: Date.now(), d: out })); } catch (_) {}
  return out;
}

async function searchPlaces(q) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    // 주소를 **보는 사람의 말**로 받는다. "ko" 로 못 박아 두면 일본어 화면에서도
    // "니시노미야시 鳴尾町一丁目" 처럼 한글 음차가 섞여 나온다(2026-08-03 실측).
    q, format: "jsonv2", "accept-language": I18N.lang,
    countrycodes: "kr,jp,cn", limit: "8",
  });
  const res = await fetchT(url, null, 6000);
  if (!res.ok) throw new Error("search HTTP " + res.status);
  return res.json();
}

/* 전체 주소("울산 울주군 웅촌면 웅촌로 1")는 무료 검색기가 못 찾으므로
   실패 시 번지 제거 → 시군구+도로명 → 도로명만 순으로 단순화해 재시도 */
async function searchPlacesSmart(q) {
  let results = await searchPlaces(q);
  if (results.length) return results;

  const road = q.match(/([가-힣A-Za-z0-9]+(?:대로|로|길)(?:\s?\d+번길)?)/);
  const tries = [];
  const noNum = q.replace(/\s*\d+(?:-\d+)?\s*$/, "").trim();
  if (noNum && noNum !== q) tries.push(noNum);
  if (road) {
    const regions = q.match(/[가-힣]+(?:시|군|구)/g) || [];
    if (regions.length) tries.push(regions[regions.length - 1] + " " + road[1]);
    tries.push(road[1]);
  }
  for (const t of [...new Set(tries)]) {
    if (!t || t === q) continue;
    try { results = await searchPlaces(t); } catch { continue; }
    if (results.length) return results;
  }
  return results;
}

/* 좌표 → 간단한 행정구역 주소 (골프장 DB 항목용) */
async function reverseGeocode(lat, lon) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    lat, lon, format: "jsonv2", "accept-language": I18N.lang, zoom: "10",
  });
  const res = await fetchT(url, null, 6000);
  if (!res.ok) throw new Error("reverse HTTP " + res.status);
  const j = await res.json();
  const a = j.address || {};
  return [a.province || a.state, a.city || a.county, a.borough || a.district]
    .filter(Boolean).join(" ");
}

/* 한글(일본어 가타카나 표기) → 일본어 로마자
   예: "히츠지가오카" → "hitsujigaoka", "삿포로" → "sapporo"
   Korean 관광 일정표의 일본 골프장 한글 표기를 영문명과 매칭하기 위함 */
const KANA_ROMAJI = {
  "아":"a","이":"i","우":"u","에":"e","오":"o",
  "카":"ka","키":"ki","쿠":"ku","케":"ke","코":"ko","가":"ga","기":"gi","구":"gu","게":"ge","고":"go",
  "사":"sa","시":"shi","스":"su","세":"se","소":"so","자":"za","지":"ji","즈":"zu","제":"ze","조":"zo",
  "타":"ta","치":"chi","츠":"tsu","테":"te","토":"to","다":"da","디":"di","두":"du","데":"de","도":"do",
  "나":"na","니":"ni","누":"nu","네":"ne","노":"no",
  "하":"ha","히":"hi","후":"fu","헤":"he","호":"ho","바":"ba","비":"bi","부":"bu","베":"be","보":"bo","파":"pa","피":"pi","푸":"pu","페":"pe","포":"po",
  "마":"ma","미":"mi","무":"mu","메":"me","모":"mo",
  "야":"ya","유":"yu","요":"yo",
  "라":"ra","리":"ri","루":"ru","레":"re","로":"ro",
  "와":"wa","워":"wo","응":"n","은":"n",
  "캬":"kya","큐":"kyu","쿄":"kyo","갸":"gya","규":"gyu","교":"gyo",
  "샤":"sha","슈":"shu","쇼":"sho","쟈":"ja","쥬":"ju","죠":"jo","자":"za",
  "챠":"cha","츄":"chu","쵸":"cho","냐":"nya","뉴":"nyu","뇨":"nyo",
  "햐":"hya","휴":"hyu","효":"hyo","뱌":"bya","뷰":"byu","뵤":"byo","퍄":"pya","퓨":"pyu","표":"pyo",
  "먀":"mya","뮤":"myu","묘":"myo","랴":"rya","류":"ryu","료":"ryo","쓰":"tsu","쯔":"tsu",
  // 외래어 표기용 (ㅡ 모음) — 신치토세, 클라크 등
  "크":"ku","트":"to","프":"pu","드":"do","그":"gu","브":"bu","르":"ru","므":"mu","흐":"fu","츠":"tsu","즈":"zu","스":"su",
};
const N_FINALS = [4, 16, 21];                        // ㄴ ㅁ ㅇ → ん(n)
const GEMINATE_FINALS = [1, 2, 7, 17, 19, 20, 22, 23, 24, 25, 26]; // ㄱㄷㅂㅅ… → 촉음(다음 자음 겹침)
function hangulToRomaji(s) {
  let out = "", geminate = false;
  for (const ch of s) {
    let r = KANA_ROMAJI[ch] || null;
    let fin = 0;
    if (r === null) {
      const code = ch.charCodeAt(0);
      if (code >= 0xAC00 && code <= 0xD7A3) {
        const idx = code - 0xAC00;
        fin = idx % 28;
        r = KANA_ROMAJI[String.fromCharCode(0xAC00 + (idx - fin))] || null; // 종성 제거 후 조회
      }
    }
    if (r) {
      if (geminate) { out += r[0]; geminate = false; } // 촉음: 다음 자음 겹침
      out += r;
      if (N_FINALS.includes(fin)) out += "n";
      else if (GEMINATE_FINALS.includes(fin)) geminate = true;
    } else if (/[a-z0-9]/i.test(ch)) {
      out += ch.toLowerCase();
      geminate = false;
    }
  }
  return out;
}

/* ---------- 내장 골프장 DB 검색 (한/일/중 다국어) ---------- */
/* "울산cc" ↔ "울산컨트리클럽", "富士カントリー" ↔ "富士cc" 등 표기 차이 흡수 */
function normName(s) {
  return s.toLowerCase()
    .replace(/[\s·.\-()&'’,]/g, "")
    // 한국어
    .replace(/컨트리클럽|칸트리클럽|countryclub/g, "cc")
    .replace(/골프클럽|golfclub/g, "gc")
    .replace(/골프장|골프리조트|golfresort|golf&resort/g, "")
    // 일본어
    .replace(/カントリークラブ|カントリー倶楽部|カンツリー倶楽部|カンツリークラブ/g, "cc")
    .replace(/ゴルフクラブ|ゴルフ倶楽部/g, "gc")
    .replace(/ゴルフ場|ゴルフコース|ゴルフパーク|ゴルフ/g, "")
    // 중국어
    .replace(/乡村俱乐部|鄉村俱樂部/g, "cc")
    .replace(/高尔夫俱乐部|高爾夫俱樂部|高尔夫球会|高尔夫球俱乐部/g, "gc")
    .replace(/高尔夫球场|高爾夫球場|高尔夫练习场|高尔夫/g, "");
}
const stripSuffix = (s) => s.replace(/(cc|gc|골프|golf|리조트|resort|倶楽部|俱乐部)+$/g, "");

const onlyLetters = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function searchGolfDB(q) {
  if (typeof GOLF_DB === "undefined") return [];
  const nq = normName(q);
  if (nq.length < 2) return [];
  const cq = stripSuffix(nq);
  // 한글 발음 → 일본어 로마자 (일본 골프장 영문명 매칭용)
  const hasHangul = /[가-힣]/.test(q);
  const rq = hasHangul ? onlyLetters(hangulToRomaji(stripSuffix(q.toLowerCase().replace(/[\s·.\-()&'’,]/g, "")))) : "";
  const scored = [];
  for (const g of GOLF_DB) {
    if (!g._n) {
      g._n = normName(g.n);
      g._c = stripSuffix(g._n);
      g._k = g.k ? normName(g.k) : "";   // 한글 표기명
      g._kc = g._k ? stripSuffix(g._k) : "";
      g._a = g.a ? normName(g.a) : "";   // 별칭(정규화)
      g._en = onlyLetters(g.a);          // 영문 별칭(로마자 매칭용)
    }
    let score = -1;
    // 한글 표기명 매칭 (일본/중국 골프장을 한글로 검색)
    if (g._k) {
      if (g._k === nq) score = 100;
      else if (g._k.includes(nq)) score = 82 - (g._k.length - nq.length);
      else if (cq.length >= 2 && g._kc === cq) score = 92;
      else if (cq.length >= 2 && g._kc.includes(cq)) score = 62 - (g._kc.length - cq.length);
    }
    if (score >= 60) { scored.push([score, g]); continue; }
    if (g._n === nq) score = 100;
    else if (g._n.includes(nq)) score = 80 - (g._n.length - nq.length);
    else if (cq.length >= 2 && g._c === cq) score = 90;
    else if (cq.length >= 2 && g._c.includes(cq)) score = Math.max(score, 60 - (g._c.length - cq.length));
    else if (g._c.length >= 3 && nq.includes(g._c)) score = Math.max(score, 40);
    else if (g._a && g._a.includes(nq)) score = Math.max(score, 55 - (g._a.length - nq.length) * 0.1);
    else if (score < 0 && rq.length >= 4 && g._en) {
      // 발음 표기 차이 흡수: 뒷글자를 조금씩 줄여가며 매칭 (엘름→erun vs elm 등)
      for (const cut of [0, 2, 4]) {
        const sub = rq.slice(0, rq.length - cut);
        if (sub.length >= (cut === 0 ? 4 : 6) && g._en.includes(sub)) { score = 50 - cut * 3; break; }
      }
    }
    if (score >= 0) scored.push([score, g]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, 8).map(([, g]) => g);
}

const COUNTRY_FLAG = { KR: "🇰🇷", JP: "🇯🇵", CN: "🇨🇳" };

/* ---------- 골프 기준 한 줄 평가 ---------- */
function evalPrecip(mmh) {
  if (mmh < 0.1) return [tr("app.eval.rain.0"), "grade-good"];
  if (mmh < 0.5) return [tr("app.eval.rain.1"), "grade-normal"];
  if (mmh < 3)   return [tr("app.eval.rain.2"), "grade-bad"];
  if (mmh < 8)   return [tr("app.eval.rain.3"), "grade-worst"];
  return [tr("app.eval.rain.4"), "grade-worst"];
}
function evalHumidity(rh) {
  if (rh < 40) return [tr("app.eval.hum.0"), "grade-good"];
  if (rh < 65) return [tr("app.eval.hum.1"), "grade-good"];
  if (rh < 80) return [tr("app.eval.hum.2"), "grade-normal"];
  if (rh < 90) return [tr("app.eval.hum.3"), "grade-bad"];
  return [tr("app.eval.hum.4"), "grade-worst"];
}
function evalWind(ms) {
  if (ms < 2) return [tr("app.eval.wind.0"), "grade-good"];
  if (ms < 4) return [tr("app.eval.wind.1"), "grade-good"];
  if (ms < 6) return [tr("app.eval.wind.2"), "grade-normal"];
  if (ms < 9) return [tr("app.eval.wind.3"), "grade-bad"];
  return [tr("app.eval.wind.4"), "grade-worst"];
}
function evalVis(km) {
  if (km >= 10) return [tr("app.eval.vis.0"), "grade-good"];
  if (km >= 5)  return [tr("app.eval.vis.1"), "grade-normal"];
  if (km >= 2)  return [tr("app.eval.vis.2"), "grade-bad"];
  return [tr("app.eval.vis.3"), "grade-worst"];
}
function setEval(id, [text, cls]) {
  const el = $(id);
  el.textContent = text;
  el.className = "metric-eval " + cls;
}

/* PM10/PM2.5 등급 (한국 환경부 기준) */
function pmGrade(v, isPm25) {
  const t = isPm25 ? [15, 35, 75] : [30, 80, 150];
  if (v == null) return ["-", ""];
  if (v <= t[0]) return [tr("app.pm.good"), "grade-good"];
  if (v <= t[1]) return [tr("app.pm.normal"), "grade-normal"];
  if (v <= t[2]) return [tr("app.pm.bad"), "grade-bad"];
  return [tr("app.pm.worst"), "grade-worst"];
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

/* 홈 카드용 가벼운 날씨 — 저장한 골프장 전부를 **한 번에** 받는다.
 *
 * 예전엔 카드마다 3일치 시간별 예보(변수 10개)를 따로 받았다. 카드에 필요한 건
 * 현재기온·날씨코드·오늘 최고최저뿐인데 수십 배를 받아온 셈이라 무료 한도를
 * 빠르게 태웠고, 한도가 차면 카드가 "불러오는 중..."에서 멈췄다. (2026-07-28)
 * Open-Meteo 는 좌표를 콤마로 여러 개 받으면 배열로 돌려준다.
 */
const HOME_WX_LS = "riweather.homewx";
async function fetchHomeWeather(courses) {
  if (!courses.length) return {};
  const key = courses.map((c) => c.lat.toFixed(2) + "," + c.lon.toFixed(2)).join("|");
  try {
    const c = JSON.parse(localStorage.getItem(HOME_WX_LS) || "null");
    if (c && c.k === key && Date.now() - c.t < 20 * 60000) return c.d;   // 20분 캐시
  } catch (_) {}
  const light = (lat, lon) => {
    const u = new URL("https://api.open-meteo.com/v1/forecast");
    u.search = new URLSearchParams({
      latitude: lat, longitude: lon,
      current: "temperature_2m,weather_code,is_day",
      daily: "temperature_2m_max,temperature_2m_min",
      timezone: tzForCoord(lat, lon),
      forecast_days: "1",
    });
    return u;
  };

  let arr = null;
  try {
    const j = await fetchJSON(
      light(courses.map((c) => c.lat.toFixed(4)).join(","),
            courses.map((c) => c.lon.toFixed(4)).join(",")),
      { retries: 1, delay: 1200 });
    // 한 곳만 요청하면 배열이 아니라 객체가 온다. 순서는 보낸 좌표 순서와 같다.
    // 골프장 id 로 묶지 않는다 — 저장된 골프장에 id 가 없어 서로 덮어쓴 적이 있다.
    const a = Array.isArray(j) ? j : [j];
    if (a.length === courses.length && a[0] && a[0].current) arr = a;
  } catch (e) {
    if (String(e && e.message) === "WX_QUOTA") throw e;   // 한도 초과는 그대로 알린다
  }

  // 묶음 요청이 기대한 모양으로 안 오면 예전처럼 한 곳씩 받는다 (동작 보장 우선)
  if (!arr) {
    arr = await Promise.all(courses.map((c) =>
      fetchJSON(light(c.lat.toFixed(4), c.lon.toFixed(4)), { retries: 1 }).catch(() => null)));
  }
  try { localStorage.setItem(HOME_WX_LS, JSON.stringify({ k: key, t: Date.now(), d: arr })); } catch (_) {}
  return arr;
}

function renderHome() {
  const courses = loadCourses();
  courseListEl.innerHTML = "";
  emptyEl.hidden = courses.length > 0;

  const cards = [];
  courses.forEach((c) => {
    const card = document.createElement("article");
    card.className = "course-card";
    card.innerHTML = `
      <div class="cc-top">
        <div>
          <div class="cc-name">${dispName(c)}</div>
          <div class="cc-sub">${c.addr || ""}</div>
        </div>
        <div style="display:flex;align-items:flex-start">
          <div class="cc-temp"><span class="skel" style="display:inline-block;width:44px;height:26px"></span></div>
          <button class="cc-del" aria-label="${tr("app.home.del")}">✕</button>
        </div>
      </div>
      <div class="cc-bottom">
        <span class="cc-desc">${tr("app.loading")}</span>
        <span class="cc-minmax"></span>
      </div>`;
    card.addEventListener("click", () => openHub(c));
    card.querySelector(".cc-del").addEventListener("click", (e) => {
      e.stopPropagation();
      if (!confirm(tr("app.home.del.ask", { name: dispName(c) }))) return;
      saveCourses(loadCourses().filter((x) => x.id !== c.id));
      renderHome();
    });
    courseListEl.appendChild(card);
    cards.push(card);
  });
  staggerIn(courseListEl);   // 카드가 위에서부터 차례로 떠오르게

  // 오늘의 한마디 (승락한 분에게만) — 저장 구장이 없어도 보여야 하므로 return 앞에 둔다
  if (typeof renderQuoteCard === "function") renderQuoteCard();

  if (!courses.length) return;
  fetchHomeWeather(courses).then((list) => {
    courses.forEach((c, i) => {
      const card = cards[i], d = list[i];
      if (!card) return;
      if (!d || !d.current) {
        card.querySelector(".cc-temp").textContent = "--°";
        card.querySelector(".cc-desc").textContent = tr("app.home.nowx");
        return;
      }
      const cur = d.current;
      // iOS 날씨 앱처럼 카드 자체가 그날 하늘이 된다
      card.insertAdjacentHTML("afterbegin", wxScene(cur.weather_code, cur.is_day));
      if (typeof WXFX !== "undefined") WXFX.scan(card);
      card.classList.add("has-scene", wmoClass(cur.weather_code));
      if (cur.is_day === 0) card.classList.add("is-night");
      card.querySelector(".cc-temp").textContent = Math.round(cur.temperature_2m) + "°";
      card.querySelector(".cc-desc").textContent = wmoIcon(cur.weather_code) + " " + wmoDesc(cur.weather_code);
      card.querySelector(".cc-minmax").textContent =
        tr("app.minmax", { max: Math.round(d.daily.temperature_2m_max[0]),
                                min: Math.round(d.daily.temperature_2m_min[0]) });
    });
  }).catch((e) => {
    const quota = String(e && e.message) === "WX_QUOTA";
    courses.forEach((c, i) => {
      const card = cards[i];
      if (!card) return;
      card.querySelector(".cc-temp").textContent = "--°";
      card.querySelector(".cc-desc").textContent =
        quota ? tr("app.home.quota") : tr("app.home.wxfail");
    });
  });
}

/* ---------- 검색 ---------- */
function hideSearchUI() {
  searchResults.hidden = true;
  searchStatus.hidden = true;
}

/* Nominatim 결과의 행정 단위 → 라벨.
   글자를 바로 쓰지 않고 사전을 거친다 — 전에는 "시"·"읍·면" 이 코드에 박혀 있어
   일본어 화면에서도 「📍 지역」처럼 한국어가 그대로 나왔다(2026-08-03). */
const ADDR_TYPE_KO = {
  province: "도", state: "도", city: "시", county: "군", borough: "구",
  town: "읍·면", village: "리·마을", suburb: "동", neighbourhood: "동네",
  hamlet: "마을", road: "도로", building: "건물", house: "건물",
  amenity: "시설", leisure: "시설",
};
function addrTypeLabel(r) {
  const ko = ADDR_TYPE_KO[r.addresstype] || ADDR_TYPE_KO[r.type];
  return ko ? tr("app.addr." + ko) : tr("app.search.tag.area");
}

/* 화면에 보일 구장 이름. 일본어 화면에서는 현지 원어명(鳴尾GC)을 보여준다.
   ⚠️ course.name 자체는 **절대 바꾸지 않는다.** 즐겨찾기·스코어·홀맵·통계가
      모두 이 이름을 열쇠로 쓴다. 열쇠를 바꾸면 이용자가 언어를 바꾼 순간
      저장해 둔 구장과 기록이 통째로 사라진 것처럼 보인다.
      보이는 글자만 바꾸고 열쇠는 그대로 둔다.
   한국 구장은 golfdb 에 k(한글별칭)가 없어 n 이 곧 한국어다 — 그대로 나온다. */
/* 프로필 칸의 '값' → 화면에 보일 글자.
   ⚠️ 값(t)은 절대 바꾸지 않는다 — localStorage 에 그대로 저장되고
      "여성" · "60대 이상" 같은 문자열 동치로 분기한다(check_i18n.py KEEP 참조).
      바꾸면 기존 이용자의 저장값이 어느 칩과도 안 맞아 선택이 풀린 것처럼 보인다.
      글자만 사전을 거치고, 사전에 없으면 원래 값을 그대로 보여준다. */
function pfLabel(t) {
  if (t == null) return "";
  const k = "app.pf." + t, v = tr(k);
  return v === k ? t : v;
}

function dispName(course) {
  const nm = (typeof course === "string") ? course : (course && course.name);
  if (!nm || typeof I18N === "undefined" || I18N.lang !== "ja") return nm || "";
  if (typeof GOLF_DB === "undefined") return nm;
  const lat = course && course.lat, lon = course && course.lon;
  let best = null, bd = Infinity;
  for (const g of GOLF_DB) {
    if (g.k !== nm && g.n !== nm) continue;
    if (lat == null || lon == null) return g.n || nm;
    // 같은 별칭이 여러 구장을 가리킬 때가 있다(조요CC = 城陽·常陽, 400km 거리) — 좌표로 고른다
    const d = (g.lat - lat) ** 2 + (g.lon - lon) ** 2;
    if (d < bd) { bd = d; best = g; }
  }
  return (best && best.n) || nm;
}

function renderResultItem(entry) {
  const li = document.createElement("li");
  const flag = entry.flag ? entry.flag + " " : "";
  const tag = entry.golf
    ? `<span class="r-tag">${tr("app.search.tag.golf")}</span>`
    : `<span class="r-tag r-tag-area">📍 ${entry.typeLabel || tr("app.search.tag.area")}</span>`;
  const note = entry.centerNote
    ? ` <span class="r-note">${tr("app.search.centernote")}</span>` : "";
  const sub = entry.addr || entry.alias || "";
  li.innerHTML = `
    <div class="r-name">${flag}${entry.disp || entry.name}${tag}</div>
    ${sub || note ? `<div class="r-addr">${sub}${note}</div>` : ""}`;
  li.addEventListener("click", () => {
    hideSearchUI();
    searchInput.value = "";
    searchClear.hidden = true;
    openHub({ id: entry.id, name: entry.name, addr: entry.addr || "", lat: entry.lat, lon: entry.lon, c: entry.c });
  });
  return li;
}

const runSearch = debounce(async (q) => {
  if (q.length < 2) { hideSearchUI(); return; }

  /* 1) 내장 골프장 DB — 즉시 표시 (한글 표기명 우선) */
  const golf = searchGolfDB(q).map((g) => ({
    id: "gdb-" + g.lat + "," + g.lon,
    name: g.k || g.n,                       // 열쇠는 언제나 한국어 우선 — 언어를 바꿔도 안 변한다
    addr: "", lat: g.lat, lon: g.lon, golf: true,
    c: g.c,
    flag: COUNTRY_FLAG[g.c] || "",
    // 보이는 글자만 언어를 따른다. 일본어 화면: 원어명이 위, 한글 음차가 부제
    disp: (I18N.lang === "ja" && g.n) ? g.n : (g.k || g.n),
    alias: (I18N.lang === "ja")
      ? (g.k || (g.a ? g.a.split(" ")[0] : ""))
      : (g.k ? g.n : (g.a ? g.a.split(" ")[0] : "")),
  }));

  searchResults.innerHTML = "";
  searchStatus.hidden = true;
  if (golf.length) {
    golf.forEach((e) => searchResults.appendChild(renderResultItem(e)));
    searchResults.hidden = false;
  } else {
    searchStatus.textContent = tr("app.search.searching");
    searchStatus.hidden = false;
    searchResults.hidden = true;
  }

  /* 2) 지역/주소 검색 (Nominatim) — 도착하면 아래에 추가 */
  let nomi = [];
  try { nomi = await searchPlacesSmart(q); } catch { /* 지역 검색 실패해도 골프장 결과는 유지 */ }
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
      // ⚠️ typeKo 는 **값**이다 — 바로 아래 centerNote 가 이 한국어를 정규식으로 본다.
      //    번역하면 안내가 조용히 사라진다. 보이는 글자는 typeLabel 로 따로 만든다.
      const typeKo = ADDR_TYPE_KO[r.addresstype] || ADDR_TYPE_KO[r.type] || "지역";
      // 검색어에 번지 등 숫자가 있는데 마을/동 단위로만 매칭된 경우 안내
      const centerNote = /\d/.test(q) && /리·마을|동|읍·면|마을|동네/.test(typeKo);
      return {
        id: "osm-" + r.place_id, name, addr, typeKo, centerNote,
        typeLabel: addrTypeLabel(r),
        lat: parseFloat(r.lat), lon: parseFloat(r.lon), golf: isGolfPlace(r),
      };
    });

  // 같은 도로의 구간 중복 제거 (이름+주소 기준)
  const seen = new Set();
  const dedupedAreas = areas.filter((e) => {
    const key = e.name + "|" + e.addr;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  areas.length = 0;
  areas.push(...dedupedAreas);

  if (!golf.length && !areas.length) {
    searchStatus.textContent = tr("app.search.empty", { q: q });
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

/* ---------- 화면 전환 (뒤로가기 스택 + 스와이프) ---------- */
const VIEWS = {
  home: homeView, hub: $("#hub-view"), detail: detailView,
  course: $("#course-view"), food: $("#food-view"), score: $("#score-view"),
  stay: $("#stay-view"),
  booking: $("#booking-view"),
  clubfit: $("#clubfit-view"),
  spirit: $("#spirit-view"),
};
/* ⚠️ 화면을 새로 만들면 **여기 등록부터** 하세요.
   showOnly() 는 이 표에 있는 것만 켜고 나머지는 전부 끕니다.
   빠뜨리면 메뉴를 눌러도 하얀 화면만 뜹니다(2026-07-30 부킹에서 실제로 겪음). */
let viewStack = ["home"];

/* 화면 맨 위로 올린다.
   ⚠️ 이 앱은 `html, body { height: 100% }` 때문에 **스크롤 주체가 body** 다.
   `window.scrollTo` 는 html 을 움직이려 하는데 html 은 넘칠 일이 없어서 **아무 일도 안 한다**
   (같은 경고가 app.js 2057·2163 에도 적혀 있다).
   그래서 화면을 옮겨도 앞 화면의 스크롤 위치가 그대로 남아, 새 화면이 중간부터 보였다
   (2026-07-31 사장님 지적 — 허브로 넘어가면 구장 이름이 잘린 채로 뜸).
   맨 위로 올리는 일은 반드시 이 함수로 한다. */
function scrollToTop(smooth) {
  const el = document.scrollingElement || document.documentElement;
  if (smooth) {
    try { document.body.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) { document.body.scrollTop = 0; }
    try { el.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) { el.scrollTop = 0; }
    return;
  }
  document.body.scrollTop = 0;
  el.scrollTop = 0;
  window.scrollTo(0, 0);
}
window.scrollToTop = scrollToTop;   // 다른 파일(clubfit 등)에서도 쓴다

function showOnly(name, back) {
  window.__curView = name;          // 베타 의견에 '어느 화면에서 썼는지' 함께 보내기 위함
  for (const k in VIEWS) VIEWS[k].hidden = k !== name;
  scrollToTop();
  if (name !== "detail") stopPlay();
  if (typeof stopCaddieVoice === "function") stopCaddieVoice();  // 화면을 옮기면 캐디 음성도 멈춘다
  // 미뤄둔 업데이트가 있으면 화면을 옮기는 이 순간이 적용하기 가장 안전하다
  if (typeof window.__applyPendingUpdate === "function") setTimeout(window.__applyPendingUpdate, 0);
  if (name === "home") renderHome();
  // 홈이 아니면 플로팅 뒤로가기 버튼 표시
  const fb = document.getElementById("float-back-btn");
  if (fb) fb.hidden = name === "home";
  // 화면이 아래에서 떠오르는 전환 (뒤로가기는 반대 방향)
  // — 애니메이션 클래스는 매번 새로 붙여야 다시 재생된다
  const el = VIEWS[name];
  if (el) {
    el.classList.remove("is-entering", "is-entering-back");
    void el.offsetWidth;
    el.classList.add(back ? "is-entering-back" : "is-entering");
  }
  nudgeFloatBlur();
}

/* 플로팅 버튼의 '배경 블러'를 한 번 다시 그리게 흔든다.
   iOS 는 뒤에 깔린 내용이 통째로 바뀌면(화면 전환) 블러 스냅샷을 옛 화면인 채로
   굳혀 버리는 일이 있다 — 예전에 이 문제로 블러를 아예 뺐던 이력이 있다.
   값을 아주 살짝 바꿨다가 다음 프레임에 되돌리면 다시 그린다(눈에는 안 보인다). */
function nudgeFloatBlur() {
  const btns = document.querySelectorAll(".float-btn");
  if (!btns.length) return;
  /* ⚠️ 흔드는 값을 여기 적어 두면 안 된다 — css/style.css 의 버튼 모양을 바꿀 때마다
     같이 안 고치면 화면 전환 순간 한 프레임 동안 엉뚱한 블러가 스친다.
     (2026-07-31 실제로 어긋났다: CSS 는 1.8px 인데 여기는 14.01px 였다)
     지금 적용된 값을 읽어서 0.01px 만 더한다 — 언제 스타일이 바뀌어도 따라간다. */
  btns.forEach((b) => {
    const cs = getComputedStyle(b);
    const cur = cs.backdropFilter || cs.webkitBackdropFilter || "";
    if (!cur || cur === "none") return;
    const nudged = cur.replace(/blur\(([\d.]+)px\)/,
      (_, px) => `blur(${(parseFloat(px) + 0.01).toFixed(2)}px)`);
    b.style.backdropFilter = nudged;
    b.style.webkitBackdropFilter = nudged;
  });
  requestAnimationFrame(() => {
    btns.forEach((b) => { b.style.backdropFilter = ""; b.style.webkitBackdropFilter = ""; });
  });
}
function pushView(name) {
  viewStack.push(name);
  showOnly(name);
  history.pushState({ depth: viewStack.length }, "");
  if (typeof CONSENT_NAG !== "undefined") CONSENT_NAG.bump();   // 약관 미동의 시 주기적 안내
}
let lastPopAt = 0;
window.addEventListener("popstate", () => {
  lastPopAt = Date.now();
  if (viewStack.length > 1) {
    viewStack.pop();
    showOnly(viewStack[viewStack.length - 1], true);
  }
});
function goBack() {
  /* 기다리는 화면이 떠 있으면 **그것부터 닫는다.**
     오래 걸리는 처리 중에는 대기 화면(z-index 5000)이 화면을 다 덮어 이용자가 갇혔다
     — "오래 걸려서 다른 메뉴를 보려 할 때 뒤로갈 수 있어야 하는데 그게 없으니
        계속 기다려야 하고, 슬라이딩도 잘 안 된다"(사장님 2026-08-03).
     기다릴지 말지는 이용자가 정한다. 닫고 나서 평소대로 한 화면 물러난다.
     ⚠️ 이때는 clubfitBack(이전 문항으로) 을 타지 않는다 — 나가려고 누른 것이기 때문이다. */
  if (typeof WAIT !== "undefined" && typeof WAIT.isOpen === "function" && WAIT.isOpen()) {
    WAIT.close(true);
    if (viewStack.length > 1) history.back();
    return;
  }
  // 클럽 피팅 중에는 화면을 나가지 말고 '이전 문항'으로 돌아간다.
  // 선택지를 누르면 자동으로 다음 문항으로 넘어가므로, 잘못 눌렀을 때
  // 가장 눈에 띄는 뒤로가기가 피팅 전체를 날려버리면 안 된다(2026-07-28 지적).
  if (viewStack[viewStack.length - 1] === "clubfit" &&
      typeof window.clubfitBack === "function" && window.clubfitBack()) return;
  if (viewStack.length > 1) history.back();
}
document.querySelectorAll(".btn-back-any").forEach((b) => b.addEventListener("click", goBack));
document.getElementById("float-back-btn")?.addEventListener("click", goBack);

/* 왼쪽 끝 → 오른쪽 스와이프 = 뒤로가기
   (Safari가 자체적으로 뒤로가기를 처리한 직후에는 중복 실행 방지 → 한 번에 한 화면씩) */
let swipeStart = null;
document.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  swipeStart = t.clientX < 30 ? { x: t.clientX, y: t.clientY } : null;
}, { passive: true });
document.addEventListener("touchend", (e) => {
  if (!swipeStart) return;
  const t = e.changedTouches[0];
  const isSwipe = t.clientX - swipeStart.x > 70 && Math.abs(t.clientY - swipeStart.y) < 90;
  swipeStart = null;
  if (!isSwipe) return;
  // 브라우저(사파리 등)가 이미 이 제스처로 뒤로가기를 실행했다면 우리는 건너뜀
  setTimeout(() => {
    if (Date.now() - lastPopAt > 600) goBack();
  }, 350);
}, { passive: true });

/* ---------- 저장(★) — 상세/허브 공용 ---------- */
function isSaved(id) {
  return loadCourses().some((c) => c.id === id);
}
function refreshStars() {
  const saved = currentCourse && isSaved(currentCourse.id);
  ["#btn-save", "#hub-save"].forEach((sel) => {
    const btn = $(sel);
    btn.textContent = saved ? "★" : "☆";
    btn.classList.toggle("saved", saved);
  });
}
function updateSaveBtn() { refreshStars(); }
function toggleSave() {
  const list = loadCourses();
  if (isSaved(currentCourse.id)) {
    saveCourses(list.filter((c) => c.id !== currentCourse.id));
  } else {
    list.push(currentCourse);
    saveCourses(list);
  }
  refreshStars();
}
$("#btn-save").addEventListener("click", toggleSave);
$("#hub-save").addEventListener("click", toggleSave);
$("#btn-back").addEventListener("click", goBack);

/* ---------- 허브 (4개 메뉴) ---------- */
function openHub(course) {
  currentCourse = course;
  /* 이 골프장을 봤다고 한 번만 기록한다.
     지역은 '골프장 주소의 시/도' 한 단어뿐 — 좌표는 절대 보내지 않는다.
     주소를 아직 모르면(검색으로 처음 연 곳) 주소가 도착한 뒤에 기록해
     지역 칸이 빈 채로 쌓이지 않게 한다. */
  const hitCourse = () => {
    if (typeof STATS === "undefined" || course.__hit) return;
    course.__hit = 1;
    STATS.hit("course", course.name, STATS.region(course.addr, course.c));
  };
  if (course.addr || (course.c && course.c !== "KR")) hitCourse();
  $("#hub-name").textContent = dispName(course);
  $("#hub-title-mini").textContent = dispName(course);
  $("#hub-addr").textContent = course.addr || "";
  $("#hub-now").textContent = "";
  refreshStars();

  if (!course.addr) {
    reverseGeocode(course.lat, course.lon).then((addr) => {
      if (addr) course.addr = addr;
      hitCourse();                      // 주소를 못 받아도 방문 자체는 기록한다(지역만 빈칸)
      if (currentCourse !== course || !addr) return;
      $("#hub-addr").textContent = addr;
      const list = loadCourses();
      const saved = list.find((c) => c.id === course.id);
      if (saved && !saved.addr) { saved.addr = addr; saveCourses(list); }
    }).catch(() => hitCourse());
  }
  fetchForecast(course.lat, course.lon).then((d) => {
    if (currentCourse !== course) return;
    $("#hub-now").innerHTML = tr("app.hub.now", {
      temp: Math.round(d.current.temperature_2m),
      desc: wmoDesc(d.current.weather_code),
      max: Math.round(d.daily.temperature_2m_max[0]),
      min: Math.round(d.daily.temperature_2m_min[0]),
    });
  }).catch(() => {});
  prefetchFood(course); // 맛집 메뉴를 누르기 전에 미리 로딩 → 즉시 표시

  pushView("hub");
}

document.querySelectorAll(".hub-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const m = btn.dataset.menu;
    if (typeof STATS !== "undefined") STATS.hit("feature", m);
    if (m === "weather") openDetail(currentCourse);
    else if (m === "spirit") openSpiritView();
    else if (m === "course") openCourseView();
    else if (m === "food") openFoodView();
    else if (m === "score") openScoreView();
    else if (m === "stay") openStayView();
    else if (m === "booking") openBookingView();
    else if (m === "clubfit") openClubfitView();
  });
});

// 스크롤 시 상단 미니 타이틀 표시
// 브라우저·CSS 조합에 따라 실제로 스크롤되는 요소가 window 가 아니라 body 일 수 있어
// 둘 다에서 값을 읽고 이벤트도 둘 다 받는다 (한쪽만 보면 0 이라 영영 안 뜬다).
const onScrollForTitle = () => {
  const y = window.scrollY || document.body.scrollTop || document.documentElement.scrollTop || 0;
  $("#detail-title-mini").classList.toggle("show", y > 140);
};
window.addEventListener("scroll", onScrollForTitle, { passive: true });
document.body.addEventListener("scroll", onScrollForTitle, { passive: true });

async function openDetail(course) {
  currentCourse = course;
  if (viewStack[viewStack.length - 1] !== "detail") pushView("detail"); // 재시도 시 중복 방지
  refreshStars();

  $("#hero-name").textContent = dispName(course);
  $("#detail-title-mini").textContent = dispName(course);
  $("#hero-addr").textContent = course.addr || "";
  $("#hero-temp").textContent = "--°";
  $("#hero-desc").textContent = tr("app.loading");
  $("#hero-minmax").textContent = "";
  $("#summary-text").textContent = tr("app.detail.summary.loading");
  $("#hourly-scroll").innerHTML = "";
  $("#precip-scroll").innerHTML = "";

  updateDistCard(course);      // 내 위치 → 골프장 거리/이동시간
  // 지도 라이브러리가 로드되지 않아도(구버전 캐시 등) 날씨는 계속 보이게 한다
  if (typeof L !== "undefined") {
    resetMapState(course);
    initRadar();               // 실황 레이더 프레임 로드 (백그라운드)
  } else {
    $("#radar-updated").textContent = tr("app.detail.map.fail");
  }
  const airP = fetchAir(course.lat, course.lon).catch(() => null);

  let data;
  try {
    data = await fetchForecast(course.lat, course.lon);
  } catch (e) {
    if (String(e && e.message) === "WX_QUOTA") {
      // 다시 눌러도 오늘은 안 되므로 재시도 버튼을 주지 않는다
      $("#hero-desc").textContent = tr("app.detail.quota.short");
      $("#summary-text").innerHTML = tr("app.detail.quota.long");
      return;
    }
    $("#hero-desc").textContent = tr("app.detail.err.short");
    $("#summary-text").innerHTML =
      tr("app.detail.err.long") +
      `<button class="retry-btn" id="btn-retry">${tr("app.retry")}</button>`;
    $("#btn-retry").addEventListener("click", () => openDetail(course));
    return;
  }
  renderDetail(data, await airP);
  buildForecastFrames(data);   // 예보 지도 프레임 생성 (기본 모드)
}

/* ---------- 내 위치 → 골프장 거리·이동시간 ---------- */
let userPos = null, userPosAt = 0;
const routeCache = new Map();

function fmtDrive(sec) {
  const m = Math.round(sec / 60);
  return m < 60 ? tr("app.drive.min", { m: m })
                : tr("app.drive.hm", { h: Math.floor(m / 60), m: m % 60 });
}

function updateDistCard(course) {
  const el = $("#dist-content");
  const fresh = userPos && Date.now() - userPosAt < 300000; // 5분 캐시
  if (fresh) { renderDist(course, el); return; }
  // 권한이 이미 허용돼 있으면 자동, 아니면 버튼으로 요청
  const ask = () => {
    el.innerHTML = `<span class="dist-loading">${tr("app.dist.locating")}</span>`;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userPos = [pos.coords.latitude, pos.coords.longitude];
        userPosAt = Date.now();
        if (currentCourse === course) renderDist(course, el);
      },
      () => {
        el.innerHTML =
          `<div class="dist-denied">${tr("app.dist.denied")}` +
          `<small>${tr("app.dist.denied.sub")}</small></div>` +
          `<button class="dist-btn">${tr("app.retry")}</button>`;
        el.querySelector(".dist-btn").addEventListener("click", ask);
      },
      { timeout: 9000, maximumAge: 300000 }
    );
  };
  if (!("geolocation" in navigator)) { el.innerHTML = ""; return; }

  // 위치 이용에 동의했으면 버튼 없이 바로 표시
  if (CONSENT.allowsLocation()) { ask(); return; }

  const showButton = () => {
    el.innerHTML = `<button class="dist-btn">${tr("app.dist.ask")}</button>`;
    el.querySelector(".dist-btn").addEventListener("click", () => {
      requestLocationConsent(() => { if (currentCourse === course) ask(); });
    });
  };
  if (navigator.permissions?.query) {
    navigator.permissions.query({ name: "geolocation" })
      .then((p) => {
        // 이미 브라우저에서 위치를 허용한 이용자는 동의한 것으로 보고 그대로 이용
        if (p.state === "granted") { CONSENT.setLocation(true); ask(); }
        else showButton();
      })
      .catch(showButton);
  } else { showButton(); }
}

/* 위치 이용 동의를 받은 뒤 실행 */
function requestLocationConsent(after) {
  openDoc("loc");
  const body = $("#doc-body");
  const wrap = document.createElement("div");
  wrap.style.marginTop = "14px";
  const ok = document.createElement("button");
  ok.className = "consent-start";
  ok.textContent = tr("app.dist.consent.ok");
  ok.addEventListener("click", () => {
    CONSENT.setLocation(true);
    $("#doc-sheet").hidden = true;
    after();
  });
  wrap.appendChild(ok);
  body.appendChild(wrap);
}

async function renderDist(course, el) {
  const straight = distM(userPos, [course.lat, course.lon]);
  /* 길안내 앱은 **구장이 어느 나라인지**로 고른다. 화면 언어가 아니다 —
     한국 이용자가 일본 구장에 가도 카카오내비·T맵은 일본에서 길을 못 찾는다.
     일본 구장에서는 맛집·숙박 카드와 같은 것을 쓴다(Yahoo!카내비 + 구글맵). */
  const isJP = course.c === "JP" && typeof JPPACK !== "undefined";
  const navs = isJP
    ? [["dist-nav tmap", JPPACK.yahooNaviUrl(course.lat, course.lon, dispName(course)),
        tr("app.dist.nav.yahoo")],
       ["dist-nav kakao",
        `https://www.google.com/maps/dir/?api=1&destination=${course.lat},${course.lon}`,
        tr("app.dist.nav.gmap")]]
    // 카카오맵 앱의 길안내를 직접 실행 (키 불필요 · 웹 중간 페이지 없음)
    : [["dist-nav kakao", `kakaomap://route?ep=${course.lat},${course.lon}&by=CAR`,
        tr("app.dist.nav.kakao")],
       ["dist-nav tmap",
        `tmap://route?goalname=${encodeURIComponent(course.name)}&goaly=${course.lat}&goalx=${course.lon}`,
        tr("app.dist.nav.tmap")]];
  const show = (km, mins, approx) => {
    el.innerHTML = `
      <div class="dist-main">${tr("app.dist.main", { km: km, mins: mins })}
        <small>${approx ? tr("app.dist.approx") : tr("app.dist.exact")}</small>
      </div>
      <div class="dist-navs">` +
      navs.map(([cls, href, label]) =>
        `<a class="${cls}" href="${href}"${/^https/.test(href) ? ' target="_blank" rel="noopener"' : ""}>${label}</a>`
      ).join("") +
      `</div>`;
  };
  const key = userPos[0].toFixed(3) + "|" + course.lat.toFixed(4) + "," + course.lon.toFixed(4);
  const cached = routeCache.get(key);
  if (cached) { show(cached.km, cached.mins, cached.approx); return; }

  el.innerHTML = `<span class="dist-loading">${tr("app.dist.calc")}</span>`;
  try {
    const r = await fetchT(
      `https://router.project-osrm.org/route/v1/driving/${userPos[1]},${userPos[0]};${course.lon},${course.lat}?overview=false`,
      null, 7000);   // 7초 안에 못 받으면 직선거리 기반 추정치로 넘어간다
    const j = await r.json();
    if (j.routes && j.routes[0]) {
      const km = (j.routes[0].distance / 1000).toFixed(j.routes[0].distance < 99500 ? 1 : 0);
      const mins = fmtDrive(j.routes[0].duration * 1.15); // 실주행 보정
      routeCache.set(key, { km, mins, approx: false });
      show(km, mins, false);
      return;
    }
    throw new Error("no route");
  } catch {
    const km = (straight * 1.35 / 1000).toFixed(1); // 도로 우회 계수
    const mins = fmtDrive((straight * 1.35) / 1000 / 70 * 3600); // 평균 70km/h
    routeCache.set(key, { km, mins, approx: true });
    show(km, mins, true);
  }
}

/* 상세 데이터 중 지도/동기화에 필요한 것 */
let fc = { times: [], precip: [], startIdx: 0 };

function renderDetail(d, air) {
  const cur = d.current;

  /* 히어로 — 화면 위쪽이 통째로 지금 하늘이 된다 (iOS 날씨 앱 방식) */
  const dv = $("#detail-view");
  dv.querySelectorAll(".wx-scene").forEach((n) => n.remove());
  dv.className = "view " + wmoClass(cur.weather_code) + (cur.is_day === 0 ? " is-night" : "") + " has-sky";
  dv.insertAdjacentHTML("afterbegin", wxScene(cur.weather_code, cur.is_day));
  if (typeof WXFX !== "undefined") WXFX.scan(dv);

  $("#hero-temp").textContent = Math.round(cur.temperature_2m) + "°";
  $("#hero-desc").textContent = wmoDesc(cur.weather_code);
  $("#hero-minmax").textContent =
    tr("app.minmax", { max: Math.round(d.daily.temperature_2m_max[0]),
                       min: Math.round(d.daily.temperature_2m_min[0]) });

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
      <span class="h-time">${isNow ? tr("app.now") : fmtHourKo(times[i])}</span>
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
    summary = tr("app.sum.raining", { mm: cur.precipitation });
  } else if (rainIdx >= 0) {
    const amt = d.hourly.precipitation[rainIdx];
    summary = tr("app.sum.rain.soon", { time: fmtHourKo(times[rainIdx]) }) +
      (amt >= 0.1 ? tr("app.sum.rain.amt", { mm: amt }) : "");
  } else {
    summary = tr("app.sum.dry");
  }
  const maxGust = Math.max(...d.hourly.wind_gusts_10m.slice(startIdx, startIdx + 12));
  summary += tr("app.sum.gust", { gust: Math.round(maxGust) });
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
      <span class="p-time">${isNow ? tr("app.now") : tr("app.hour", { h: t.getHours() })}</span>
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
  setEval("#m-precip-eval", evalPrecip(cur.precipitation ?? 0));
  $("#m-precip-sub").textContent = tr("app.m.precip.sub", { mm: todayPrecip ?? 0 });

  const curIdx = Math.max(0, startIdx);
  $("#m-humidity").innerHTML = `${cur.relative_humidity_2m}<small> %</small>`;
  setEval("#m-humidity-eval", evalHumidity(cur.relative_humidity_2m));
  $("#m-humidity-sub").textContent = tr("app.m.humidity.sub", {
    dew: Math.round(d.hourly.dew_point_2m[curIdx]), feel: Math.round(cur.apparent_temperature) });

  const ws = Math.round(cur.wind_speed_10m * 10) / 10;
  const gust = Math.round(cur.wind_gusts_10m * 10) / 10;
  $("#m-wind").innerHTML = `${ws}<small> m/s</small>`;
  setEval("#m-wind-eval", evalWind(ws));
  $("#m-wind-arrow").style.transform = `rotate(${(cur.wind_direction_10m + 180) % 360}deg)`;
  $("#m-wind-sub").textContent =
    tr("app.m.wind.sub", { dir: windDirKo(cur.wind_direction_10m), gust: gust });

  const visKm = d.hourly.visibility[curIdx] / 1000;
  $("#m-vis").innerHTML = `${visKm >= 10 ? Math.round(visKm) : visKm.toFixed(1)}<small> km</small>`;
  setEval("#m-vis-eval", evalVis(visKm));
  if (air && air.current) {
    const [g10, c10] = pmGrade(air.current.pm10, false);
    const [g25, c25] = pmGrade(air.current.pm2_5, true);
    $("#m-vis-sub").innerHTML = tr("app.m.vis.sub", {
      c10: c10, g10: g10, pm10: Math.round(air.current.pm10),
      c25: c25, g25: g25, pm25: Math.round(air.current.pm2_5) });
  } else {
    $("#m-vis-sub").textContent = tr("app.m.vis.fail");
  }

  updatePrecipChip(cur.precipitation ?? 0);
}

/* =========================================================
 * 강수 지도 — 예보(기본) + 실황 레이더 겸용
 * ========================================================= */
let map = null;
let mapMode = "fc";              // 'fc' 예보 | 'rv' 실황
let mapAutoRv = false;           // 예보 지도가 막혀서 '자동으로' 실황으로 넘어간 상태인가
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

/* 강수 지도 위에 얹는 주요 도시 이름 — [한국어, 위도, 경도, 일본어]
   ⚠️ 예전엔 세 나라 도시를 **전부 한글 음차**로만 두고 주석에는 '현지 언어' 라고 적어 두었다.
      그래서 일본어 화면에서도 지도에 「도쿄」·「오사카」가 떴다(2026-08-03 사장님이 발견).
      한 자리에 두 표기를 같이 들고, 화면 언어에 맞는 것을 고른다.
   ※ 밑지도는 라벨 없는 판(light_nolabels)이라 이 글자가 지도의 유일한 지명이다.
      여기가 한국어면 일본 이용자에게는 지도가 통째로 낯설어진다. */
const CITY_LABELS = [
  // 한국
  ["서울", 37.566, 126.978, "ソウル"], ["인천", 37.456, 126.705, "仁川"],
  ["수원", 37.263, 127.029, "水原"], ["춘천", 37.881, 127.730, "春川"],
  ["강릉", 37.752, 128.876, "江陵"], ["대전", 36.351, 127.385, "大田"],
  ["청주", 36.642, 127.489, "清州"], ["천안", 36.815, 127.114, "天安"],
  ["전주", 35.824, 127.148, "全州"], ["광주", 35.160, 126.851, "光州"],
  ["목포", 34.812, 126.392, "木浦"], ["여수", 34.760, 127.662, "麗水"],
  ["대구", 35.872, 128.601, "大邱"], ["안동", 36.568, 128.730, "安東"],
  ["포항", 36.019, 129.343, "浦項"], ["부산", 35.180, 129.076, "釜山"],
  ["울산", 35.538, 129.311, "蔚山"], ["창원", 35.228, 128.681, "昌原"],
  ["제주", 33.500, 126.531, "済州"], ["원주", 37.342, 127.920, "原州"],
  // 일본
  ["도쿄", 35.690, 139.692, "東京"], ["오사카", 34.694, 135.502, "大阪"],
  ["나고야", 35.181, 136.907, "名古屋"], ["삿포로", 43.062, 141.354, "札幌"],
  ["후쿠오카", 33.590, 130.402, "福岡"], ["센다이", 38.268, 140.872, "仙台"],
  ["히로시마", 34.386, 132.456, "広島"], ["교토", 35.012, 135.768, "京都"],
  ["니가타", 37.916, 139.036, "新潟"], ["나하", 26.212, 127.681, "那覇"],
  ["가고시마", 31.560, 130.558, "鹿児島"], ["치토세", 42.821, 141.652, "千歳"],
  // 중국
  ["베이징", 39.905, 116.407, "北京"], ["상하이", 31.230, 121.474, "上海"],
  ["광저우", 23.129, 113.264, "広州"], ["선전", 22.543, 114.058, "深圳"],
  ["청두", 30.573, 104.067, "成都"], ["항저우", 30.274, 120.155, "杭州"],
  ["난징", 32.060, 118.796, "南京"], ["칭다오", 36.067, 120.383, "青島"],
  ["다롄", 38.914, 121.615, "大連"], ["톈진", 39.343, 117.361, "天津"],
  ["우한", 30.593, 114.305, "武漢"], ["시안", 34.342, 108.940, "西安"],
];

function ensureMap(lat, lon) {
  if (map) {
    map.setView([lat, lon], 7);
    return;
  }
  map = L.map("map", {
    zoomControl: false,
    attributionControl: true,
    scrollWheelZoom: false,
    maxZoom: 15, minZoom: 5, // 확대해서 녹색점(내 위치) 확인 가능
  }).setView([lat, lon], 7);
  // 라벨 없는 밝은 지도 (영문 지명 제거)
  // — 앱이 라이트 테마로 바뀌면서 다크 지도만 검은 덩어리로 남아 겉돌았다.
  //   강수 오버레이(초록·노랑·빨강)는 밝은 바탕에서도 그대로 읽힌다.
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OSM &copy; CARTO",
    subdomains: "abcd", maxZoom: 15, minZoom: 5,
  }).addTo(map);
  // 현지 언어 도시 라벨을 강수 오버레이 위에 표시
  const labelPane = map.createPane("labels");
  labelPane.style.zIndex = 450;
  labelPane.style.pointerEvents = "none";
  const jaMap = typeof I18N !== "undefined" && I18N.lang === "ja";
  CITY_LABELS.forEach(([ko, la, lo, jp]) => {
    const name = (jaMap && jp) ? jp : ko;
    L.marker([la, lo], {
      pane: "labels", interactive: false,
      icon: L.divIcon({ className: "city-label", html: `<span>${name}</span>`, iconSize: [0, 0] }),
    }).addTo(map);
  });
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
    icon: L.divIcon({ className: "", html: `<div class="precip-chip" id="precip-chip">${tr("app.map.chip", { mm: "-" })}</div>`, iconSize: [0, 0] }),
    interactive: false, zIndexOffset: 600,
  }).addTo(map);
}

function updatePrecipChip(mmh) {
  const el = document.getElementById("precip-chip");
  if (el) el.innerHTML = tr("app.map.chip", { mm: mmh });
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
let rvLoading = false;
async function initRadar() {
  if (rvLoading || rvFrames.length) return;   // 중복 호출 방지 (재시도는 탭 다시 누르기)
  rvLoading = true;
  let json;
  try {
    const res = await fetchT("https://api.rainviewer.com/public/weather-maps.json", null, 10000);
    json = await res.json();
  } catch {
    rvLoading = false;
    if (mapMode === "rv")
      $("#radar-updated").textContent = tr("app.map.rv.fail");
    return;
  } finally {
    rvLoading = false;
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
      opacity: 0, zIndex: 200, maxNativeZoom: 7, maxZoom: 15,
    }),
  }));
  rvFrames.forEach((f) => f.layer.addTo(map));
  rvActive = all.reduce((acc, f, i) => (f.isNowcast ? acc : i), 0);
  if (mapMode === "rv") setMode("rv"); // 이미 실황 모드면 UI 갱신
}

/* ---------- 예보 지도 (Open-Meteo 격자 → 캔버스) ---------- */
/* 레이더풍 연속 색상 팔레트 — mm/h 값을 부드러운 그라데이션으로 */
const PALETTE = [
  // [mm, r, g, b, a]
  [0.1, 140, 225, 165, 110],
  [0.5,  90, 205, 130, 150],
  [1.0,  70, 190, 110, 165],
  [2.0, 200, 220, 100, 175],
  [3.0, 247, 226, 107, 182],
  [5.0, 245, 190,  85, 190],
  [7.0, 242, 153,  74, 198],
  [10,  238, 115,  80, 205],
  [14,  235,  87,  87, 212],
  [20,  185,  50,  95, 218],
  [30,  140,  35, 110, 224],
];
function precipRGBA(mm) {
  if (mm < 0.1) return [0, 0, 0, 0];
  if (mm >= PALETTE[PALETTE.length - 1][0]) return PALETTE[PALETTE.length - 1].slice(1);
  let lo = PALETTE[0];
  if (mm <= lo[0]) return lo.slice(1);
  for (let i = 1; i < PALETTE.length; i++) {
    const hi = PALETTE[i];
    if (mm <= hi[0]) {
      const t = (mm - lo[0]) / (hi[0] - lo[0]);
      return [0, 1, 2, 3].map((k) => Math.round(lo[k + 1] + (hi[k + 1] - lo[k + 1]) * t));
    }
    lo = hi;
  }
  return lo.slice(1);
}

/* 값 인코딩: mm를 √스케일로 0~255에 담아 약한 비의 디테일 보존 */
const VMAX = 30;
const encodeMm = (mm) => Math.round(Math.sqrt(Math.min(mm, VMAX) / VMAX) * 255);
const decodeMm = (v) => Math.pow(v / 255, 2) * VMAX;

/* 결정적 의사난수 — 레이더 특유의 입자 질감용 */
function grain(x, y, k) {
  let h = (x * 374761393 + y * 668265263 + k * 69069) | 0;
  h = (h ^ (h >> 13)) * 1274126177 | 0;
  return (((h ^ (h >> 16)) >>> 0) % 1000) / 1000; // 0~1
}

const gridCache = new Map(); // 같은 지점 재방문 시 API 재호출 방지

async function buildForecastFrames(detailData) {
  $("#radar-updated").textContent = tr("app.map.fc.building");
  // 한도가 풀렸을 수 있으니 매번 원래 상태로 되돌려 놓고 시작한다.
  // 사용자가 직접 실황 탭을 고른 경우는 건드리지 않고, 막혀서 자동으로 넘어갔던 때만 되돌린다.
  const fcBtn0 = document.querySelector('.mode-btn[data-mode="fc"]');
  if (fcBtn0 && fcBtn0.disabled) {
    fcBtn0.disabled = false;
    fcBtn0.innerHTML = tr("app.map.fc.btn");
  }
  if (mapAutoRv) { mapAutoRv = false; setMode("fc"); }
  const GRID = makeGrid(currentCourse.lat, currentCourse.lon); // 골프장 중심 격자
  const cacheKey = currentCourse.lat.toFixed(2) + "," + currentCourse.lon.toFixed(2);
  const openedFor = currentCourse;
  let grid = gridCache.get(cacheKey);
  if (!grid) {
    try {
      grid = await fetchPrecipGrid(GRID);
      gridCache.set(cacheKey, grid);
      if (gridCache.size > 12) gridCache.delete(gridCache.keys().next().value);
    } catch (e) {
      // 예보 지도가 막혀도 지도 화면을 빈손으로 두지 않는다.
      // 기상청 레이더는 키도 한도도 없으므로 국내 구장이면 그쪽으로 넘긴다. (2026-07-28)
      const quota = String(e && e.message) === "WX_QUOTA";
      // 눌러도 안 되는 탭을 그대로 두면 사용자는 앱이 고장난 줄 안다
      const fcBtn = document.querySelector('.mode-btn[data-mode="fc"]');
      if (fcBtn && quota) {
        fcBtn.disabled = true;
        fcBtn.innerHTML = tr("app.map.fc.btn.wait");
      }
      if (isKRCourse()) {
        mapAutoRv = true;
        setMode("rv");
      } else {
        $("#radar-updated").textContent =
          quota ? tr("app.map.fc.quota") : tr("app.map.fc.retry");
      }
      return;
    }
  }
  if (currentCourse !== openedFor) return; // 그 사이 다른 골프장으로 이동했으면 중단
  if (!Array.isArray(grid)) grid = [grid];

  // 상세 예보의 시작 시각과 격자 데이터의 시간축 정렬
  const startIso = detailData.hourly.time[fc.startIdx];
  let gStart = grid[0].hourly.time.indexOf(startIso);
  if (gStart < 0) gStart = 0;
  const nFrames = Math.min(grid[0].hourly.time.length - gStart, fc.times.length - fc.startIdx);

  /* 1) 값(mm)을 저해상도 캔버스에 넣고 → 2) 부드럽게 확대 → 3) 픽셀별로
     레이더풍 연속 팔레트 + 입자 질감을 입혀 실황 레이더 느낌으로 렌더링 */
  const small = document.createElement("canvas");
  small.width = GRID.nLon; small.height = GRID.nLat;
  const sctx = small.getContext("2d");
  const SCALE = 16;
  const W = GRID.nLon * SCALE, H = GRID.nLat * SCALE;
  const big = document.createElement("canvas");
  big.width = W; big.height = H;
  const bctx = big.getContext("2d");
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = "high";

  fcFrames = [];
  for (let k = 0; k < nFrames; k++) {
    // 값 인코딩 (R 채널, √스케일)
    const img = sctx.createImageData(GRID.nLon, GRID.nLat);
    for (let p = 0; p < grid.length; p++) {
      const mm = grid[p].hourly.precipitation[gStart + k] ?? 0;
      const v = encodeMm(mm);
      img.data[p * 4] = v; img.data[p * 4 + 1] = 0;
      img.data[p * 4 + 2] = 0; img.data[p * 4 + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    bctx.clearRect(0, 0, W, H);
    bctx.drawImage(small, 0, 0, W, H); // 값 공간에서 보간 → 색 경계가 뭉개지지 않음

    // 픽셀별 색 입히기 + 질감 + 가장자리 페이드(경계가 뚝 잘려 보이지 않게)
    const out = bctx.getImageData(0, 0, W, H);
    const d = out.data;
    const fadePx = SCALE * 2.5;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        let mm = decodeMm(d[i]);
        if (mm >= 0.05) {
          // 강수량에 비례한 미세 요철 — 실황 레이더의 입자감 재현
          const g1 = grain(x >> 1, y >> 1, k);         // 굵은 입자
          const g2 = grain(x, y, k * 7 + 3);           // 고운 입자
          mm *= 0.78 + g1 * 0.34 + (g2 - 0.5) * 0.18;
        }
        const [r, g, b, a] = precipRGBA(mm);
        const edge = Math.min(x, W - 1 - x, y, H - 1 - y);
        const fade = edge < fadePx ? edge / fadePx : 1;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = Math.round(a * fade);
      }
    }
    bctx.putImageData(out, 0, 0);

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
  fcOverlay = L.imageOverlay(fcFrames[0].url, bounds, { opacity: 0.68, zIndex: 210 });

  if (mapMode === "fc") setMode("fc");
}

/* ---------- 모드 전환 / 프레임 표시 / 재생 ---------- */
document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    stopPlay();
    mapAutoRv = false;              // 사용자가 직접 고른 탭은 다음에 되돌리지 않는다
    setMode(btn.dataset.mode);
  });
});

/* 한국 구장 여부 — 기상청 레이더는 한반도 전용이라 해외 구장은 기존 위성 레이더 유지 */
function isKRCourse() {
  if (!currentCourse) return true;
  if (currentCourse.c) return currentCourse.c === "KR";
  // 옛 저장 기록(c 없음): 내장 DB 에서 좌표로 정확히 되찾는다
  const hit = (typeof GOLF_DB !== "undefined" ? GOLF_DB : [])
    .find((g) => g.lat === currentCourse.lat && g.lon === currentCourse.lon);
  if (hit && hit.c) return hit.c === "KR";
  // 지역 검색(OSM) 등 DB 밖: 기상청 영상이 실제로 덮는 한반도 범위일 때만 한국
  const { lat, lon } = currentCourse;
  return lat >= 32.5 && lat <= 39.5 && lon >= 124 && lon <= 132;
}

/* 기상청 레이더 이미지(500x520) 위경도→픽셀 변환.
   제주·울릉도·독도·백령도 4점 아핀 보정 — 서울·부산·영종 육안 검증 잔차 ±2px */
function kmaPx(lon, lat) {
  return {
    x: 42.8633 * lon - 1.9545 * lat - 5118.17,
    y: -1.2920 * lon - 55.1689 * lat + 2395.94,
  };
}
let kmaZoomed = true;   // 기본: 내 골프장 중심 확대
function positionKmaView() {
  const wrap = $("#kma-viewport"), img = $("#kma-radar-img"), dot = $("#kma-dot");
  if (!wrap || !img || !currentCourse) return;
  const W = wrap.clientWidth || 320;
  const H = Math.round(W * 0.92);
  wrap.style.height = H + "px";
  const Z = kmaZoomed ? 2.4 : 1;                 // 확대율
  const s = (W / 500) * Z;                       // 표시 스케일
  const p = kmaPx(currentCourse.lon, currentCourse.lat);
  let ox = p.x * s - W / 2, oy = p.y * s - H / 2;
  ox = Math.max(0, Math.min(500 * s - W, ox));
  oy = Math.max(0, Math.min(520 * s - H, oy));
  img.style.width = (500 * s) + "px";
  img.style.maxWidth = "none";
  img.style.transform = `translate(${-ox}px, ${-oy}px)`;
  dot.style.left = (p.x * s - ox) + "px";
  dot.style.top = (p.y * s - oy) + "px";
  // 영상 밖이면 아예 감춘다 — 틀린 위치를 보여주느니 안 보여준다
  dot.hidden = !(p.x >= 0 && p.x <= 500 && p.y >= 0 && p.y <= 520);
  const zb = $("#kma-zoom-btn");
  if (zb) zb.textContent = kmaZoomed ? tr("app.kma.zoom.out") : tr("app.kma.zoom.in");
  // 시각 띠: 영상 상단 제목부(0,0~340,26)만 확대해 항상 보이게 — 프레임별 시각이 그대로 읽힌다
  const tb = document.querySelector(".kma-timebar"), ti = $("#kma-time-img");
  if (tb && ti) {
    const st = W / 340;
    tb.style.height = Math.round(26 * st) + "px";
    ti.style.width = Math.round(500 * st) + "px";
  }
}

(function initKmaZoomBtn() {
  const b = document.getElementById("kma-zoom-btn");
  if (b) b.addEventListener("click", () => { kmaZoomed = !kmaZoomed; positionKmaView(); });
})();

/* 기상청 공식 '레이더 실황+2시간 예측' 애니메이션 (10분 단위 발표, 생성 지연 대비 폴백) */
let kmaRadarLoadedTm = null;
function loadKmaRadar() {
  const img = $("#kma-radar-img");
  if (!img) return;
  const cands = [];
  for (let back = 1; back <= 6; back++) {
    const t = new Date(Date.now() + 9 * 3600e3 - back * 600e3);   // KST 기준 10분 전부터
    const p = (n) => String(n).padStart(2, "0");
    cands.push("" + t.getUTCFullYear() + p(t.getUTCMonth() + 1) + p(t.getUTCDate()) +
               p(t.getUTCHours()) + p(Math.floor(t.getUTCMinutes() / 10) * 10));
  }
  if (kmaRadarLoadedTm === cands[0] && img.src) return;   // 이미 최신
  let i = 0;
  const tryNext = () => {
    if (i >= cands.length) {
      $("#radar-updated").textContent = tr("app.kma.fail");
      return;
    }
    const tm = cands[i++];
    const probe = new Image();
    probe.onload = () => {
      img.src = probe.src;
      const tImg = $("#kma-time-img");
      if (tImg) tImg.src = probe.src;
      kmaRadarLoadedTm = cands[0];
      positionKmaView();
      $("#radar-updated").textContent =
        tr("app.kma.updated", { t: tm.slice(8, 10) + ":" + tm.slice(10, 12) });
    };
    probe.onerror = tryNext;
    probe.src = "https://www.weather.go.kr/w/repositary/image/rdr/img/qpr_" + tm + ".gif";
  };
  tryNext();
}

function setMode(m) {
  mapMode = m;
  document.querySelectorAll(".mode-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === m));
  if (m === "rv" && !isKRCourse()) initRadar();   // 이전에 실패했어도 탭 누르면 재시도

  // 한국: 실황 탭이 '기상청 레이더·예측'으로 동작 (해외는 위성 레이더 유지)
  const kr = isKRCourse();
  const rvBtn = $("#rv-mode-btn");
  if (rvBtn) rvBtn.innerHTML = kr
    ? tr("app.map.rv.btn.kr")
    : tr("app.map.rv.btn");
  const kmaWrap = $("#kma-radar-wrap");
  const mapWrap = document.querySelector(".radar-card .map-wrap");
  const controls = document.querySelector(".radar-card .radar-controls");
  const useKma = kr && m === "rv";
  if (kmaWrap) kmaWrap.hidden = !useKma;
  if (mapWrap) mapWrap.style.display = useKma ? "none" : "";
  if (controls) controls.style.display = useKma ? "none" : "";
  if (useKma) { loadKmaRadar(); stopPlay(); positionKmaView(); return; }

  // 반대 모드 레이어 숨김
  if (m === "fc") {
    if (rvActive >= 0 && rvFrames[rvActive]) rvFrames[rvActive].layer.setOpacity(0);
    if (!fcFrames.length) {
      $("#radar-time").textContent = "--:--";
      return;
    }
    if (fcOverlay && !map.hasLayer(fcOverlay)) fcOverlay.addTo(map);
    slider.max = fcFrames.length - 1;
    $("#radar-t0").textContent = tr("app.now");
    $("#radar-tmid").textContent = tr("app.radar.tomorrow");
    $("#radar-t1").textContent = DAY_NAMES[dayOffsetFrom(fcFrames[0].time, fcFrames[fcFrames.length - 1].time)] || DAY_NAMES[2];
    $("#radar-updated").textContent = tr("app.radar.step", { n: fcFrames.length });
    showFcFrame(fcActive >= 0 ? fcActive : 0);
  } else {
    if (fcOverlay && map.hasLayer(fcOverlay)) map.removeLayer(fcOverlay);
    clearStripHighlight();
    if (!rvFrames.length) {
      $("#radar-time").textContent = "--:--";
      $("#radar-updated").textContent = tr("app.radar.loading");
      return;
    }
    slider.max = rvFrames.length - 1;
    $("#radar-t0").textContent = fmtHM(rvFrames[0].time);
    $("#radar-tmid").textContent = tr("app.now");
    $("#radar-t1").textContent = fmtHM(rvFrames[rvFrames.length - 1].time);
    const lastPast = rvFrames.reduce((acc, f, i) => (f.isNowcast ? acc : i), 0);
    $("#radar-updated").textContent = tr("app.radar.updated", { t: fmtHM(rvFrames[lastPast].time) });
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
  badge.textContent = rvFrames[i].isNowcast ? tr("app.radar.badge.nowcast") : tr("app.radar.badge.past");
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
    (k === 0 ? tr("app.now") : tr("app.radar.fc.time", {
      day: DAY_NAMES[dOff] || "", dow: WEEKDAYS[f.time.getDay()], h: f.time.getHours() }));
  const badge = $("#radar-badge");
  badge.textContent = tr("app.radar.badge.fc", { md: (f.time.getMonth() + 1) + "/" + f.time.getDate() });
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

/* =========================================================
 * 코스공략 — OSM 골프 데이터 + 위성지도
 * ========================================================= */
const OVERPASS_EPS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
async function overpassQuery(q) {
  // 두 서버에 동시에 요청해서 먼저 응답하는 쪽을 사용 (속도 최우선)
  const jobs = OVERPASS_EPS.map((ep) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 18000);
    return fetch(ep, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(q),
      signal: ctrl.signal,
    }).then(async (r) => {
      clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).catch((e) => { clearTimeout(timer); throw e; });
  });
  return Promise.any(jobs).catch(() => { throw new Error("overpass fail"); });
}

const distM = (a, b) => {
  const R = 6371000, dLa = (b[0] - a[0]) * Math.PI / 180, dLo = (b[1] - a[1]) * Math.PI / 180;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const lineLen = (pts) => pts.slice(1).reduce((s, p, i) => s + distM(pts[i], p), 0);
const bearing = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;

/* 홀 라인 위 특정 거리 지점의 좌표 (티샷 낙하지점 계산용) */
function pointAtDist(line, d) {
  let acc = 0;
  for (let i = 1; i < line.length; i++) {
    const seg = distM(line[i - 1], line[i]);
    if (acc + seg >= d) {
      const t = (d - acc) / seg;
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t,
              line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
    }
    acc += seg;
  }
  return line[line.length - 1];
}
/* 진행 방향 기준 지점의 좌/우 판별 (외적 부호) */
function sideOfPlay(from, to, pt) {
  const cross = (to[1] - from[1]) * (pt[0] - from[0]) - (to[0] - from[0]) * (pt[1] - from[1]);
  return cross > 0 ? "좌측" : "우측";
}

/* 플레이어 프로필 (구질·비거리) */
const PROFILE_KEY = "riweather.profile";
function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch { return {}; }
}
/* 프로필은 여러 화면에서 조각조각 저장된다(구질·비거리 / 평균타수 / 약관 / 백업복구).
   통째로 덮어쓰면 다른 화면이 넣어둔 값이 조용히 사라진다 —
   실제로 평균타수를 고른 뒤 구질을 건드리면 평균타수가 날아갔다(2026-07-28).
   그래서 항상 '병합'한다. {avg:null} 처럼 값을 지우는 것도 그대로 동작한다. */
function saveProfile(patch) {
  const cur = loadProfile();
  localStorage.setItem(PROFILE_KEY, JSON.stringify(Object.assign(cur, patch)));
  if (typeof BACKUP !== "undefined") BACKUP.touch();
}

let courseMap = null, courseLayers = [], holeLayers = [], courseHoles = [], courseHazards = [];
const courseCache = new Map();
let aiHoleCtx = null;        // AI 캐디용 현재 홀 정보
let lastHoleSelect = null;   // 프로필 변경 시 공략 재계산용

/* 구질·비거리 기반 맞춤 공략 텍스트 */
function buildHoleStrategy(h, bunkers, waters) {
  const prof = loadProfile();
  const shape = prof.shape || "스트레이트";
  const tee = h.line[0], green = h.line[h.line.length - 1];
  const mid = h.line[Math.floor(h.line.length / 2)];
  const turn = ((bearing(mid, green) - bearing(tee, mid) + 540) % 360) - 180;
  const shapeBend = { 슬라이스: "우", 페이드: "우", 드로우: "좌", 훅: "좌" }[shape] || null;

  /* ⚠️ 아래 "좌"·"우측"·"벙커" 같은 한국어는 **값**이다 — 방향 판정과 비교에 쓴다.
     값은 그대로 두고, 화면에 나갈 때만 hw() 로 사전을 거친다.
     (문장 자체도 코드에 박혀 있어 일본어 화면에서 통째로 한국어로 나왔다 — 2026-08-03) */
  const hw = (w) => { const k = "app.hs.w." + w, v = tr(k); return v === k ? w : v; };
  const shapeTxt = pfLabel(shape);

  let txt = tr("app.hs.head", { par: h.par, len: h.len });
  const bendDir = Math.abs(turn) > 28 ? (turn > 0 ? "우" : "좌") : null;
  if (bendDir) {
    txt += tr("app.hs.dogleg", { dir: hw(bendDir) });
    if (shapeBend === bendDir) {
      txt += tr("app.hs.bend.same", { shape: shapeTxt });
    } else if (shapeBend) {
      txt += tr("app.hs.bend.opp", { shape: shapeTxt });
    }
  } else {
    txt += tr("app.hs.straight");
  }

  if (h.par >= 4) {
    const drv = Math.min(prof.dist || 200, Math.round(h.len * 0.85));
    const land = pointAtDist(h.line, drv);
    const L = [], R = [];
    bunkers.forEach((b) => { if (distM(b, land) < 65) (sideOfPlay(tee, green, b) === "좌측" ? L : R).push("벙커"); });
    waters.forEach((w) => { if (distM(w, land) < 85) (sideOfPlay(tee, green, w) === "좌측" ? L : R).push("워터해저드"); });
    txt += tr("app.hs.tee.head", { drv });
    const uniq = (a) => [...new Set(a)].map(hw).join("·");
    if (L.length && R.length) {
      txt += tr("app.hs.tee.both", { l: uniq(L), r: uniq(R) });
    } else if (L.length || R.length) {
      const danger = L.length ? "좌측" : "우측";
      const aim = L.length ? "우측" : "좌측";
      txt += tr("app.hs.tee.one", { danger: hw(danger), hz: uniq(L.length ? L : R) });
      const risky = (danger === "우측" && (shape === "슬라이스" || shape === "페이드")) ||
                    (danger === "좌측" && (shape === "훅" || shape === "드로우"));
      txt += risky
        ? tr("app.hs.tee.risky", { shape: shapeTxt, aim: hw(aim) })
        : tr("app.hs.tee.safe", { aim: hw(aim) });
    } else {
      txt += shapeBend
        ? tr("app.hs.tee.clear.shape",
             { side: hw(shapeBend === "우" ? "좌측" : "우측"), shape: shapeTxt })
        : tr("app.hs.tee.clear");
    }
    const remain = Math.max(0, h.len - drv);
    if (remain > 30) txt += tr("app.hs.second", { m: remain });
  } else {
    txt += tr("app.hs.par3", { m: h.len });
  }

  // 그린 주변 벙커 (앞/좌/우)
  const gb = bunkers.filter((b) => distM(b, green) < 38);
  if (gb.length) {
    const tags = [...new Set(gb.map((b) =>
      distM(b, tee) < distM(green, tee) - 10 ? "앞" : sideOfPlay(tee, green, b)))];
    txt += tr("app.hs.gb", { tags: tags.map(hw).join("·") });
    txt += tags.includes("앞")
      ? tr("app.hs.gb.front")
      : tr("app.hs.gb.side", { side: hw(tags[0] === "좌측" ? "우측" : "좌측") });
  } else if (h.par >= 4) {
    txt += tr("app.hs.gb.none");
  }

  // 그린 흐름(지형 추정)은 실제 그린 조형과 다를 수 있어 표시하지 않음 —
  // 틀린 정보로 신뢰를 잃지 않도록 확실한 정보(공식 데이터·위성 확인 사실)만 노출한다.
  return txt;
}

function ensureCourseMap(lat, lon) {
  if (courseMap) { courseMap.setView([lat, lon], 16); return; }
  courseMap = L.map("course-map", {
    zoomControl: true, attributionControl: true, scrollWheelZoom: false,
  }).setView([lat, lon], 16);
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "&copy; Esri", maxZoom: 19,
  }).addTo(courseMap);
}
function clearCourseLayers() {
  [...courseLayers, ...holeLayers].forEach((l) => courseMap.removeLayer(l));
  courseLayers = []; holeLayers = [];
}

async function openCourseView() {
  const course = currentCourse;
  pushView("course");
  refreshProfileCard();   // 연령·성별·구력 중 미입력 항목만 노출
  $("#course-title").textContent = dispName(course);
  $("#course-status").textContent = tr("app.course.loading");
  $("#hole-list-card").hidden = true;
  $("#hole-detail-card").hidden = true;
  $("#course-note").hidden = true;
  // 공략 영상은 홀맵 유무와 상관없이 붙는다 — 홀맵을 못 구한 구장에서 이 화면이 비지 않게 한다
  renderCourseVideos(course);
  // 지도 라이브러리가 없어도(구버전 캐시 등) 홀맵·공략은 계속 보이게 한다
  if (typeof L !== "undefined") {
    ensureCourseMap(course.lat, course.lon);
    clearCourseLayers();
    setTimeout(() => courseMap.invalidateSize(), 60);
  } else {
    $("#course-status").textContent = tr("app.course.map.fail");
  }

  // 공식 홀맵 이미지가 있는 구장: 홈페이지 홀맵 그대로 표시 + AI 캐디
  // 일본 구장 자료(홀맵 2.4MB·통계 2.6MB)는 여기서 처음 받는다 — 한국 이용자는 받지 않는다.
  // ⚠️ await 를 빼면 첫 진입에서만 "준비중"으로 보이는 버그가 된다.
  if (typeof JPPACK !== "undefined") await JPPACK.need(course);
  if (currentCourse !== course || viewStack[viewStack.length - 1] !== "course") return;
  const imgdb = (typeof HOLEIMG_DB !== "undefined" && HOLEIMG_DB[course.name])
    || (typeof JPPACK !== "undefined" && JPPACK.imgdb(course)) || null;
  const prepNote = $("#course-prep-note");
  if (prepNote) prepNote.hidden = !!imgdb;
  if (imgdb) { renderImgCourse(course, imgdb); return; }
  $("#course-map-card").hidden = false;
  $("#hole-img").hidden = true;
  $("#hole-img-src").hidden = true;

  // 내장 홀DB(위성 분석 제작)가 있으면 서버 조회 없이 바로 사용
  const builtin = (typeof HOLES_DB !== "undefined" && HOLES_DB[course.name]) || null;
  const key = course.lat.toFixed(4) + "," + course.lon.toFixed(4);
  let data = builtin ? { elements: [] } : courseCache.get(key);
  if (!data) {
    try {
      data = await overpassQuery(
        `[out:json][timeout:25];way["golf"~"hole|green|tee|fairway|bunker|water_hazard|lateral_water_hazard"](around:1500,${course.lat},${course.lon});out geom;`);
      courseCache.set(key, data);
    } catch {
      $("#course-status").textContent = "";
      $("#course-note").textContent = tr("app.course.busy");
      $("#course-note").hidden = false;
      return;
    }
  }
  if (currentCourse !== course || viewStack[viewStack.length - 1] !== "course") return;

  const ways = (data.elements || []).filter((e) => e.geometry && e.geometry.length > 1);
  const pts = (w) => w.geometry.map((g) => [g.lat, g.lon]);
  const centroid = (w) => {
    const p = pts(w);
    return [p.reduce((s, x) => s + x[0], 0) / p.length, p.reduce((s, x) => s + x[1], 0) / p.length];
  };

  // 배경 요소 그리기
  const styleMap = [
    ["fairway", { color: "#7ac943", weight: 1, fillColor: "#7ac943", fillOpacity: 0.18 }],
    ["green",   { color: "#b9f6ca", weight: 1, fillColor: "#b9f6ca", fillOpacity: 0.35 }],
    ["tee",     { color: "#fff59d", weight: 1, fillColor: "#fff59d", fillOpacity: 0.4 }],
    ["bunker",  { color: "#ffe082", weight: 1, fillColor: "#ffd54f", fillOpacity: 0.55 }],
  ];
  for (const [kind, style] of styleMap) {
    ways.filter((w) => w.tags.golf === kind).forEach((w) => {
      courseLayers.push(L.polygon(pts(w), style).addTo(courseMap));
    });
  }
  courseHazards = ways.filter((w) => /water_hazard/.test(w.tags.golf || ""));
  courseHazards.forEach((w) => {
    courseLayers.push(L.polygon(pts(w), { color: "#4fc3f7", weight: 1, fillColor: "#29b6f6", fillOpacity: 0.5 }).addTo(courseMap));
  });
  const bunkers = ways.filter((w) => w.tags.golf === "bunker").map(centroid);
  const waters = courseHazards.map(centroid);

  courseHoles = builtin
    ? builtin.map((h) => ({ ref: String(h.ref), par: h.par || 0, name: h.name || "", line: h.line, len: h.len || 0, tip: h.tip || "", gf: h.gf || null }))
    : ways.filter((w) => w.tags.golf === "hole")
        .map((w) => ({
          ref: w.tags.ref || "?", par: parseInt(w.tags.par) || 0,
          name: w.tags.name || "", line: pts(w),
        }))
        .sort((a, b) => (parseInt(a.ref) || 99) - (parseInt(b.ref) || 99));

  /* 🔴 홀 번호를 모르면 홀 목록을 만들지 않는다.
     OSM 에 golf=hole 은 있는데 ref(홀 번호) 태그가 없는 구장이 있다.
     예전 코드는 번호를 "?" 로 채워, 지도에도 목록에도 ? 가 깔리고
     제목이 「?번홀 공략」 이 됐다(2026-08-03 사장님이 나고야GC 에서 발견).
     번호를 우리가 1·2·3… 으로 매길 수도 없다 — OSM 의 way 순서는 라운드 순서가 아니라
     그렇게 하면 **없는 정보를 지어내는 것**이 된다.
     모르면 모른다고 두고 위성 전경만 보여준다
     ("홀맵이 정확히 없는 것은 그냥 위성 전체 구장이 비추게" — 사장님 지시).
     par 만 있어도 어느 홀인지 못 짚으면 쓸모가 없다. */
  if (courseHoles.length && !courseHoles.some((h) => /^\d+$/.test(String(h.ref)))) {
    courseHoles = [];
  }

  if (!courseHoles.length) {
    // 공식 자료가 없는 구장 — 추정 정보는 만들지 않고 위성 전경만 보여준다
    $("#course-status").textContent = tr("app.course.satellite");
    $("#hole-list-card").hidden = true;
    $("#hole-detail-card").hidden = true;
    // 저장된 게 골프장이 아니라 **지역**인지 가린다.
    //   폰에 저장된 "파주"(파주 시내)가 골프장처럼 안내돼, 위성사진이 시내를
    //   비추는데 화면은 골프장이라고 말했다(2026-08-02).
    // ⚠️ OSM 골프 지형 유무로 판정하면 안 된다 — 세부 태그가 없는 구장이 많아
    //    진짜 골프장(파주CC)까지 "골프장 아님" 이 된다. 실제로 겪었다.
    //    ① 지역 검색으로 담은 것(주소가 있다) ② 골프장DB에도 근처에 없다
    //    ③ OSM 골프 지형도 없다 — 셋이 모두 맞을 때만 지역으로 본다.
    const nearDb = typeof GOLF_DB !== "undefined" && GOLF_DB.some(
      (g) => cvDistKm(course.lat, course.lon, g.lat, g.lon) <= 1.5);
    const noGolf = !!course.addr && !nearDb && !ways.length;
    if (noGolf) {
      $("#course-note").innerHTML = tr("app.course.notgolf");
      if (prepNote) {
        prepNote.innerHTML = tr("app.course.notgolf");
        prepNote.hidden = false;
      }
    } else {
      $("#course-note").innerHTML = tr("app.course.prep");
    }
    $("#course-note").hidden = false;
    /* 코스 **전체**가 담기게 지도를 맞춘다.
       ⚠️ 그려 놓은 도형(courseLayers)만 보면 안 된다.
          홀 번호가 없어 홀 라인을 안 그리는 구장에서는 남은 도형이 그린 하나뿐이라
          지도가 거기에 딱 맞아 **건물 지붕만 크게** 나왔다(2026-08-03 나고야GC 실측).
          그리지 않았을 뿐 홀·페어웨이 좌표는 ways 에 그대로 있다 — 그걸로 범위를 잡는다.
       ("홀맵이 정확히 없는 것은 그냥 위성 전체 구장이 비추게" — 사장님 지시) */
    setTimeout(() => {
      courseMap.invalidateSize();
      let b = null;
      const add = (la, lo) => {
        if (la == null || lo == null) return;
        b = b ? b.extend([la, lo]) : L.latLngBounds([[la, lo], [la, lo]]);
      };
      ways.forEach((w) => pts(w).forEach((p) => add(p[0], p[1])));
      courseLayers.forEach((l) => {
        if (!l.getBounds) return;
        const lb = l.getBounds();
        if (lb && lb.isValid()) { add(lb.getNorth(), lb.getWest()); add(lb.getSouth(), lb.getEast()); }
      });
      if (b && b.isValid()) courseMap.fitBounds(b.pad(0.12));
      else courseMap.setView([course.lat, course.lon], 15);
    }, 120);
    return;
  }

  // 전체 화면: 점선 대신 네이버 지도식 홀 번호 마커 (코스별 색 구분)
  const allBounds = L.latLngBounds(courseHoles.flatMap((h) => h.line));
  const NINE_COLORS = ["#16a34a", "#2563eb", "#d97706", "#9333ea"];
  const nineNames = [...new Set(courseHoles.map((h) => h.name))];
  courseHoles.forEach((h, i) => {
    const color = NINE_COLORS[nineNames.indexOf(h.name) % NINE_COLORS.length];
    const g = h.line[h.line.length - 1];
    const mk = L.marker(g, {
      icon: L.divIcon({
        className: "",
        html: `<div class="hole-num-dot" style="background:${color}">${h.ref}</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13],
      }),
    });
    mk.on("click", () => selectHole(i, true));
    courseLayers.push(mk.addTo(courseMap));
  });
  courseMap.fitBounds(allBounds.pad(0.08));
  $("#course-status").textContent = tr("app.course.holecount", { n: courseHoles.length });
  // (위성 추정 홀 배치는 폐지 — HOLES_DB는 비어 있고, 여기는 OSM 공개 홀 데이터만 사용)

  const grid = $("#hole-grid");
  grid.innerHTML = "";
  courseHoles.forEach((h, i) => {
    if (!h.len) h.len = Math.round(lineLen(h.line)); // 공식 거리가 있으면 유지
    if (!h.par) h.par = h.len < 230 ? 3 : h.len < 430 ? 4 : 5;
    const b = document.createElement("button");
    b.className = "hole-btn";
    b.innerHTML = `${h.ref}<small>${tr("app.hole.par", { par: h.par })}</small>`;
    b.addEventListener("click", () => selectHole(i, true));
    grid.appendChild(b);
  });
  $("#hole-list-card").hidden = false;

  function selectHole(i, byUser) {
    const h = courseHoles[i];
    grid.querySelectorAll(".hole-btn").forEach((b, j) => b.classList.toggle("active", j === i));
    holeLayers.forEach((l) => courseMap.removeLayer(l));
    holeLayers = [];
    // 선택한 홀만 선명하게: 어두운 외곽선 + 밝은 라인
    holeLayers.push(L.polyline(h.line, { color: "#08130c", weight: 9, opacity: 0.7, lineCap: "round" }).addTo(courseMap));
    holeLayers.push(L.polyline(h.line, { color: "#4ade80", weight: 4, opacity: 1, lineCap: "round" }).addTo(courseMap));
    const tee = h.line[0], green = h.line[h.line.length - 1];
    holeLayers.push(L.marker(tee, { icon: L.divIcon({ className: "", html: '<div class="course-dot" style="background:#fff59d"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false }).addTo(courseMap));
    holeLayers.push(L.marker(green, { icon: L.divIcon({ className: "", html: "⛳", iconSize: [22, 22], iconAnchor: [11, 20] }), interactive: false }).addTo(courseMap));
    // 지도는 전체 코스 뷰 유지 — 홀 상세는 아래 세로 홀 뷰(캔버스)로 표시
    renderHoleCanvas(h, course.name + "|" + h.name + h.ref);

    // 내 구질·비거리 기반 맞춤 공략 생성 (규칙 기반 — 화면의 위성 라인이 근거)
    aiHoleCtx = { h, bunkers, waters, courseName: course.name };
    lastHoleSelect = () => selectHole(i);
    // ⚠ 이 구장은 홀 라인이 공개 지도 자료라 파·거리가 추정치다.
    //   샷별 AI 캐디는 파를 기준으로 항목을 나누므로 여기서 제공하면 전제부터 틀린다.
    setCaddieAvailable(false);
    $("#hole-detail-title").textContent = tr("app.hole.title", { no: h.ref }) +
      (h.name ? tr("app.hole.title.name", { name: h.name }) : "");
    $("#hole-strategy").hidden = false;
    $("#hole-strategy").textContent = buildHoleStrategy(h, bunkers, waters) +
      (h.tip ? tr("app.hole.tip", { tip: h.tip }) : "");
    $("#hole-video").hidden = false;
    $("#hole-video").href = "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(`${course.name} ${h.ref}번홀 공략`);
    $("#hole-detail-card").hidden = false;
    // 사용자가 직접 홀을 눌렀을 때만 공략으로 스크롤한다.
    // (진입 자동선택·프로필 재계산에서 움직이면 홀 목록이 사라지고 입력 중 화면이 튄다)
    // ⚠️ 이 앱은 스크롤러가 body 라 window.scrollTo 가 듣지 않는다 — scrollIntoView 를 쓸 것
    if (byUser) $("#hole-detail-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  selectHole(0);
}

/* ---------- 구장 공략 영상 (유튜브) ----------
 *
 * 사장님 지시(2026-08-01): "홀맵이 있건 없건 그 구장 공략 영상을 골프존처럼 깔끔하게,
 * 영향력 있는 순서로 밑에 하나하나 나열해 달라."
 *
 * ⚠️ 조회수는 유튜브 정책상 30일 이상 보관 금지(Non-Authorized Data).
 *    그래서 수집 기준일(COURSE_VIDEOS_AT)을 화면에 함께 찍는다. 2주마다 재수집할 것.
 * ⚠️ 조회수·좋아요를 섞은 자체 점수를 화면에 쓰지 않는다(정책 III.E.4.h).
 *    정렬은 수집 단계에서 조회수 그대로 끝내 두었다.
 * ⚠️ 처음부터 iframe 을 여러 개 심으면 화면이 무거워지고 데이터도 많이 쓴다.
 *    썸네일만 깔고 **누른 것만** 재생기로 바꾼다(유튜브 권장 방식이기도 하다).
 */
/* 두 좌표 사이 거리(km) — 같은 구장인지 판정하는 데만 쓴다 */
function cvDistKm(a, b, c, d) {
  const R = 6371, r = Math.PI / 180;
  const dx = (c - a) * r, dy = (d - b) * r;
  const h = Math.sin(dx / 2) ** 2 +
            Math.cos(a * r) * Math.cos(c * r) * Math.sin(dy / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* 이름이 가리키는 구장이 **정말 이 자리**인지 확인한다.
   ⚠️ 이름만 믿었더니, 폰에 저장된 지역 "파주"(파주 시내)에 원더클럽 파주CC 영상이
      붙었다(2026-08-02). 지도는 시내를 비추는데 화면엔 골프장 공략 영상이 뜨는,
      신뢰가 깨지는 상황이었다. 확인할 수 없으면 **안 붙인다.** */
function cvSamePlace(course, dbName) {
  if (!course || !course.lat || typeof GOLF_DB === "undefined") return false;
  const g = GOLF_DB.find((x) => x.n === dbName || x.k === dbName);
  if (!g) return false;
  return cvDistKm(course.lat, course.lon, g.lat, g.lon) <= 3;
}

function courseVideosFor(course) {
  if (typeof COURSE_VIDEOS === "undefined" || !course) return [];
  // 이름이 그대로 같으면 그 자체로 강한 근거다
  const direct = COURSE_VIDEOS[course.name];
  if (direct) return direct;
  // 표기가 달라도 찾도록 — 다만 핵심어가 같아도 **좌표까지 맞아야** 붙인다
  const k = typeof bkCore === "function" ? bkCore(course.name) : "";
  if (!k) return [];
  for (const n in COURSE_VIDEOS) {
    if (typeof bkCore === "function" && bkCore(n) === k && cvSamePlace(course, n))
      return COURSE_VIDEOS[n];
  }
  return [];
}

const cvViews = (n) => n >= 10000 ? Math.round(n / 1000) + "천회"
                     : n > 0 ? n.toLocaleString("ko-KR") + "회" : "";

function renderCourseVideos(course) {
  const card = $("#course-videos-card"), list = $("#cv-list"), more = $("#cv-more");
  if (!card) return;
  const vids = courseVideosFor(course);
  // 없으면 카드를 통째로 감춘다 — 빈 목록을 보여주느니 없는 게 낫다.
  // 대신 검색 링크는 홀 카드에 이미 있다(없는 걸 있는 척하지 않는다).
  card.hidden = !vids.length;
  // 비었으면 목록도 비운다. 안 비우면 앞 구장에서 **재생 중이던 iframe 이 숨은 채로 살아남아
  // 소리가 계속 난다**(2026-08-01 확인). 화면에 안 보인다고 없어진 게 아니다.
  if (!vids.length) { list.innerHTML = ""; $("#cv-sub").textContent = ""; return; }

  const at = typeof COURSE_VIDEOS_AT !== "undefined" ? COURSE_VIDEOS_AT : "";
  // 기준일은 반드시 화면에 남긴다 — 조회수 30일 보관 규정 때문이다(설계 §4)
  $("#cv-sub").textContent = tr("ui.course.videos.sub", { n: vids.length })
    + (at ? tr("ui.course.videos.at", { at }) : "");
  list.innerHTML = vids.map((v) => `
    <div class="cv-item" data-vid="${v.videoId}">
      <div class="cv-thumb">
        <!-- loading="lazy" 를 쓰지 않는다 — 한 구장에 많아야 10편이고,
             화면이 가려진 상태에서는 lazy 가 영영 안 뜨는 경우가 있다(2026-08-01 겪음) -->
        <img src="https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg" alt="">
        <span class="cv-play" aria-hidden="true"></span>
      </div>
      <div class="cv-meta">
        <b>${v.title}</b>
        <small>${v.channel}${v.views ? " · " + cvViews(v.views) : ""}</small>
      </div>
    </div>`).join("");

  // 누르면 그 자리에서 재생 — 이미 재생 중인 것은 그대로 둔다
  list.querySelectorAll(".cv-item").forEach((el) => {
    el.addEventListener("click", () => {
      if (el.querySelector("iframe")) return;
      const id = el.dataset.vid;
      const box = el.querySelector(".cv-thumb");
      /* 한 번만 눌러도 재생되게 하는 방법 — 아이폰이 문제다.
         iOS 는 **소리 있는 자동재생을 무조건 막는다.** autoplay·playsinline 을 다 붙여도
         멈춘 채로 떠서 사용자가 유튜브 재생 버튼을 한 번 더 눌러야 했다(2026-08-02 확인).
         뚫는 방법은 하나뿐이다 — **음소거로 시작**하면 자동재생이 허용된다.
         그래서 mute=1 로 띄우고, 곧바로 소리를 켠다(사용자가 방금 눌렀으므로 허용된다).
         혹시 소리 켜기가 막히면 영상은 재생되고 소리만 꺼진 상태라, 유튜브 스피커
         아이콘으로 켤 수 있다 — 아무것도 안 되던 지금보다 낫다. */
      const ifr = document.createElement("iframe");
      ifr.src = `https://www.youtube-nocookie.com/embed/${id}` +
                "?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1" +
                "&origin=" + encodeURIComponent(location.origin);
      ifr.title = tr("app.video.title");
      ifr.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      ifr.setAttribute("allowfullscreen", "");
      ifr.setAttribute("playsinline", "");
      ifr.frameBorder = "0";
      const cmd = (func, args) => {
        try {
          ifr.contentWindow.postMessage(
            JSON.stringify({ event: "command", func, args: args || [] }), "*");
        } catch (e) { /* 아직 준비 전이면 다음 시도에서 들어간다 */ }
      };
      ifr.addEventListener("load", () => {
        // 먼저 수신 등록을 해야 플레이어가 우리 명령을 받고 상태도 돌려준다
        try {
          ifr.contentWindow.postMessage(
            JSON.stringify({ event: "listening", id: id }), "*");
        } catch (e) { /* 무시 */ }
        // 플레이어가 준비되는 시점이 제각각이라 잠깐 동안 여러 번 밀어준다
        [0, 150, 400, 800, 1500, 2500].forEach((ms) => setTimeout(() => {
          cmd("unMute"); cmd("setVolume", [100]); cmd("playVideo");
        }, ms));
      });
      box.innerHTML = "";
      box.appendChild(ifr);
      if (typeof STATS !== "undefined") STATS.hit("feature", "coursevideo_play");
    });
  });

  // 출처 표기 — 유튜브 약관상 원본으로 가는 길을 열어둔다
  more.href = "https://www.youtube.com/results?search_query=" +
              encodeURIComponent(course.name + " 코스공략");
  more.textContent = tr("app.video.more");
}

/* ---------- 공식 홀맵 이미지 모드 (홈페이지 홀맵 그대로 + AI 캐디) ---------- */
/* 티별 거리를 사람이 읽을 문자열로.
   🔴 일본 구장은 **야드**로 적는다 — 등록된 645곳 중 610곳이 그렇다(2026-08-02 실측).
      한국 자료는 미터(t.m), 일본 자료는 야드(t.y) 로 들어온다.
      · 야드를 그냥 숫자만 보여주면 한국 골퍼가 미터로 읽어 **클럽을 한 번호 잘못 잡는다**.
      · 그렇다고 미터로만 바꿔 적으면 코스 현장의 야드 표지판과 어긋난다.
      그래서 **원문 단위를 앞세우고 미터를 괄호로** 덧붙인다.
   (이 함수가 없던 동안 화면에 "レギュラー undefined · T2 undefinedm" 이 나왔다 — 배선 검증에서 잡았다) */
function teeText(tees) {
  const yd = tees.some((t) => t.y !== undefined && t.y !== null);
  if (!yd)   // 한국 구장 — 지금 화면 그대로 둔다(단위는 맨 뒤에 한 번)
    return tees.map((t) => `${t.name} ${t.m}`).join(" · ") + "m";
  return tees.map((t) => (t.y !== undefined && t.y !== null)
    ? `${t.name} ${t.y}y(${Math.round(t.y * 0.9144)}m)`
    : `${t.name} ${t.m}m`).join(" · ");
}

function renderImgCourse(course, db) {
  $("#course-map-card").hidden = true;
  $("#course-status").textContent = "";
  $("#course-note").hidden = true;
  $("#hole-canvas").hidden = true;
  $("#hole-canvas-loading").hidden = true;

  const grid = $("#hole-grid");
  grid.innerHTML = "";
  const flat = [];
  db.courses.forEach((c) => {
    const label = document.createElement("div");
    label.className = "hole-course-label";
    label.textContent = tr("app.hole.course.label", { name: c.name });
    grid.appendChild(label);
    c.holes.forEach((h) => {
      const i = flat.length;
      flat.push({ ...h, cname: c.name });
      const b = document.createElement("button");
      b.className = "hole-btn";
      // 파를 모르는 홀이 있다(공식 표기가 없는 일본 구장 396홀). 지어내지 않고 비운다.
      b.innerHTML = h.par ? `${h.no}<small>${tr("app.hole.par", { par: h.par })}</small>` : `${h.no}`;
      b.addEventListener("click", () => sel(i, true));
      grid.appendChild(b);
    });
  });
  $("#hole-list-card").querySelector(".card-title").innerHTML = tr("app.hole.pick");
  $("#hole-list-card").hidden = false;

  // 스코어대 — 내 평균 타수로 정해 놓고, 이용자가 직접 고르면 그 선택이 이긴다
  let holeBand = typeof JPPACK !== "undefined" ? JPPACK.autoBand() : 0;
  let curHole = 0;
  // 단추는 홀을 옮길 때마다 다시 그려지므로 개별 등록이 아니라 위임으로 듣는다
  const strat = $("#hole-strategy");
  if (strat && !strat.dataset.bandBound) {
    strat.dataset.bandBound = "1";
    strat.addEventListener("click", (e) => {
      const b = e.target.closest(".jps-band-b");
      if (!b || !strat.__onBand) return;
      strat.__onBand(parseInt(b.dataset.band, 10));
    });
  }
  if (strat) strat.__onBand = (n) => { holeBand = n; sel(curHole); };

  function sel(i, byUser) {
    curHole = i;
    const h = flat[i];
    grid.querySelectorAll(".hole-btn").forEach((b, j) => b.classList.toggle("active", j === i));
    $("#hole-detail-title").textContent = tr("app.hole.title.course", { cname: h.cname, no: h.no });
    const img = $("#hole-img");
    if (h.img) {
      img.src = h.img;
      img.hidden = false;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
    }
    // 홀 3D 영상 — AI 캐디 아래에 배치, 탭할 때만 로드(데이터 절약)
    // 처음에는 컨트롤 없이 첫 장면만 보여준다. controls 를 켜둔 채로 두면
    // iOS 가 ±10초 건너뛰기까지 얹어 영상 위를 덮는다(2026-07-28 지적).
    const vp = $("#hole-video-player"), vw = $("#hole-video-wrap"),
          vb = $("#hole-video-play");
    vp.pause?.();
    vp.removeAttribute("controls");
    if (vb) vb.hidden = false;
    if (h.video) {
      vp.src = h.video;
      // 영상에서 미리 뽑아둔 첫 장면을 표지로 — 영상을 받기 전에도 깔끔하게 보인다
      if (h.frames && h.frames[0]) vp.poster = h.frames[0];
      else vp.removeAttribute("poster");
      vw.hidden = false;
    } else {
      vp.removeAttribute("src");
      vp.removeAttribute("poster");
      vw.hidden = true;
    }
    $("#hole-img-src").textContent = tr("app.hole.imgsrc", { src: db.source });
    $("#hole-img-src").hidden = false;
    if (h.green) {
      $("#hole-green-img").src = h.green;
      $("#hole-green-wrap").hidden = false;
    } else {
      $("#hole-green-wrap").hidden = true;
    }
    let infoHtml = "";
    if (h.dist) {
      const row = (g, a) => tr("app.hole.dist.row",
        { g: g, back: a[0], reg: a[1], front: a[2], lady: a[3] });
      infoHtml += tr("app.hole.dist.title") + `${row("L", h.dist.L)}<br>${row("R", h.dist.R)}<br><br>`;
    } else if (h.tees) {
      const elev = h.elev
        ? tr("app.hole.elev", {
            dir: h.elev > 0 ? tr("app.hole.elev.up") : tr("app.hole.elev.down"), m: h.elev })
        : "";
      infoHtml += tr("app.hole.dist.title") + teeText(h.tees) + elev + "<br><br>";
    } else if (h.len) {
      infoHtml += tr("app.hole.len", { len: h.len }) +
        (h.hdcp ? tr("app.hole.hdcp", { hdcp: h.hdcp }) : "") + "<br><br>";
    }
    // 일본어 화면에서는 한국 구장 TIP 의 일본어판을 얹는다. 없으면 한국어 원문 그대로 —
    // 어색한 기계 번역을 지어내는 것보다 원문이 낫다(설계 D6).
    const tipText = (typeof JPPACK !== "undefined" &&
                     JPPACK.tipJa(course.name, h.cname, h.no)) || h.tip;
    if (tipText) {
      const safeTip = tipText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      infoHtml += tr("app.hole.tip.title") + safeTip;
    }
    if (typeof JPPACK !== "undefined") {
      // 홀별 한 줄 공략 — 공식 TIP 이 없는 일본 구장에서 이 자리를 채운다.
      // 지어낸 문장이 아니라 통계·사실 토큰에서 끌어낸 말이다(tools/jp/gen_hole_text.py).
      // 공식 TIP 이 있으면 그쪽이 이긴다 — 구장이 직접 쓴 글이 우리 요약보다 낫다.
      // 🔴 딱지는 '공식 TIP' 이 아니라 JPPACK.textLabel() 이다 — 구장이 한 말이 아니다.
      const line = JPPACK.text(course, i);
      if (line && !tipText) {
        infoHtml += JPPACK.textLabel() +
          line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }
      // 홀별 실전 통계 — 스코어대는 내 평균 타수에 맞춰 처음부터 열린다(§2-8-1)
      const stat = JPPACK.statHtml(course.name, i, holeBand);
      if (stat) infoHtml += JPPACK.bandHtml(holeBand) + stat;
    }
    if (infoHtml) {
      $("#hole-strategy").hidden = false;
      $("#hole-strategy").innerHTML = infoHtml;
    } else {
      $("#hole-strategy").textContent = "";
      $("#hole-strategy").hidden = true;
    }
    // 공식 홀 자료가 있는 구장 — 샷별 캐디 제공. 홀을 옮기면 읽던 음성은 끊는다.
    setCaddieAvailable(true);
    aiHoleCtx = { imgHole: h, courseName: course.name };
    lastHoleSelect = () => sel(i);
    $("#hole-video").hidden = true; // 홀별 영상 선별 불가 — 신뢰 문제로 미표시
    $("#hole-detail-card").hidden = false;
    // 사용자가 직접 홀을 눌렀을 때만 공략으로 스크롤한다.
    // (진입 자동선택·프로필 재계산에서 움직이면 홀 목록이 사라지고 입력 중 화면이 튄다)
    // ⚠️ 이 앱은 스크롤러가 body 라 window.scrollTo 가 듣지 않는다 — scrollIntoView 를 쓸 것
    if (byUser) $("#hole-detail-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  sel(0);
}

/* 로컬(같은 출처) 이미지 → base64 (AI 캐디 전송용) */
async function imgToB64(imgEl) {
  if (!imgEl.complete) await imgEl.decode();
  const cv = document.createElement("canvas");
  cv.width = imgEl.naturalWidth;
  cv.height = imgEl.naturalHeight;
  const c2 = cv.getContext("2d");
  c2.fillStyle = "#fff";               // 투명 배경 → 흰색 (AI 분석용)
  c2.fillRect(0, 0, cv.width, cv.height);
  c2.drawImage(imgEl, 0, 0);
  return cv.toDataURL("image/jpeg", 0.85).split(",")[1];
}

/* ---------- AI 캐디: 홀 위성사진 + 정밀 AI 공략 ---------- */
const lon2tx = (lon, z) => (lon + 180) / 360 * Math.pow(2, z);
const lat2ty = (lat, z) => {
  const r = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
};

/* ---------- 홀 세로 뷰: 위성사진을 홀 방향으로 회전 (아래=티, 위=그린) ---------- */
const holeCanvasCache = new Map();
let holeCanvasToken = 0;
async function renderHoleCanvas(h, cacheKey) {
  const cv = $("#hole-canvas"), loading = $("#hole-canvas-loading");
  const token = ++holeCanvasToken;
  const cached = holeCanvasCache.get(cacheKey);
  if (cached) {
    cv.width = cached.w; cv.height = cached.h;
    cv.getContext("2d").drawImage(cached.img, 0, 0);
    cv.hidden = false; loading.hidden = true;
    return;
  }
  cv.hidden = true; loading.hidden = false;
  try {
    const tee = h.line[0], green = h.line[h.line.length - 1];
    const lat0 = tee[0], lon0 = tee[1];
    const mLat = 111320, mLon = 111320 * Math.cos(lat0 * Math.PI / 180);
    const toM = (p) => [(p[1] - lon0) * mLon, (p[0] - lat0) * mLat]; // 티 기준 [동,북] m
    const [gE, gN] = toM(green);
    const A = Math.atan2(gE, gN), cosA = Math.cos(A), sinA = Math.sin(A);
    const rot = (E, N) => [E * cosA - N * sinA, E * sinA + N * cosA];   // X'=좌우, Y'=티→그린
    const inv = (x, y) => [x * cosA + y * sinA, -x * sinA + y * cosA];
    const rpts = h.line.map((p) => rot(...toM(p)));
    let minX = 0, maxX = 0, maxY = 0;
    rpts.forEach(([x, y]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); });
    const rx0 = minX - 70, rx1 = maxX + 70, ry0 = -45, ry1 = maxY + 60;
    const rectW = rx1 - rx0, rectH = ry1 - ry0;
    const scale = Math.min(720 / rectW, 1500 / rectH);
    const W = Math.round(rectW * scale), H = Math.round(rectH * scale);

    // 회전 사각형이 덮는 지리 범위 → 위성 타일 합성
    const corners = [[rx0, ry0], [rx1, ry0], [rx0, ry1], [rx1, ry1]].map(([x, y]) => inv(x, y));
    const lats = corners.map(([E, N]) => lat0 + N / mLat);
    const lons = corners.map(([E, N]) => lon0 + E / mLon);
    const z = 18;
    const tx0 = Math.floor(lon2tx(Math.min(...lons), z)), tx1 = Math.floor(lon2tx(Math.max(...lons), z));
    const ty0 = Math.floor(lat2ty(Math.max(...lats), z)), ty1 = Math.floor(lat2ty(Math.min(...lats), z));
    const off = document.createElement("canvas");
    off.width = (tx1 - tx0 + 1) * 256; off.height = (ty1 - ty0 + 1) * 256;
    const octx = off.getContext("2d");
    const jobs = [];
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        jobs.push(fetchT(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`, null, 8000)
          .then((r) => r.blob()).then(createImageBitmap)
          .then((b) => octx.drawImage(b, (tx - tx0) * 256, (ty - ty0) * 256)).catch(() => {}));
      }
    }
    await Promise.all(jobs);
    if (token !== holeCanvasToken) return; // 다른 홀로 이동함

    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const dx = (x) => (x - rx0) * scale;
    const dy = (y) => H - (y - ry0) * scale;
    // 위성 배경 (회전)
    const mPerTilePx = 40075016.686 * Math.cos(lat0 * Math.PI / 180) / Math.pow(2, z) / 256;
    const lonLeft = tx0 / Math.pow(2, z) * 360 - 180;
    const nTop = Math.PI - 2 * Math.PI * ty0 / Math.pow(2, z);
    const latTop = 180 / Math.PI * Math.atan(Math.sinh(nTop));
    const E_left = (lonLeft - lon0) * mLon, N_top = (latTop - lat0) * mLat;
    ctx.save();
    ctx.translate(dx(0), dy(0));
    ctx.scale(scale, -scale);
    ctx.transform(cosA, sinA, -sinA, cosA, 0, 0);
    ctx.translate(E_left, N_top);
    ctx.scale(mPerTilePx, -mPerTilePx);
    ctx.drawImage(off, 0, 0);
    ctx.restore();

    // 그린까지 거리 링 (100/150/200m)
    const [gx2, gy2] = rpts[rpts.length - 1];
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.setLineDash([8, 8]); ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "bold 20px sans-serif";
    [100, 150, 200].forEach((r) => {
      if (h.len > r + 25) {
        ctx.beginPath();
        ctx.arc(dx(gx2), dy(gy2), r * scale, Math.PI * 0.35, Math.PI * 0.65);
        ctx.stroke();
        ctx.fillText(String(r), dx(gx2) - 14, dy(gy2) + r * scale - 8);
      }
    });
    ctx.restore();

    // 공략 라인 + 티/그린
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    rpts.forEach(([x, y], i) => (i ? ctx.lineTo(dx(x), dy(y)) : ctx.moveTo(dx(x), dy(y))));
    ctx.strokeStyle = "rgba(5,20,10,0.7)"; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 4.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(dx(0), dy(0), 10, 0, Math.PI * 2);
    ctx.fillStyle = "#fff59d"; ctx.fill(); ctx.strokeStyle = "#333"; ctx.lineWidth = 3; ctx.stroke();
    ctx.font = "30px sans-serif"; ctx.fillText("⛳", dx(gx2) - 15, dy(gy2) + 8);

    const img = await createImageBitmap(cv);
    holeCanvasCache.set(cacheKey, { img, w: W, h: H });
    if (token !== holeCanvasToken) return;
    cv.hidden = false; loading.hidden = true;
  } catch (e) {
    if (token === holeCanvasToken) { loading.textContent = tr("app.hole.canvas.fail"); }
  }
}

/* ---------- 샷별 캐디: 파에 맞는 항목 · 응답 파싱 · 음성 ----------
   홀 전체를 한 덩어리로 설명하면 길어서 티박스에서 읽을 수가 없다.
   그래서 파를 보고 '샷 단위'로 나눠 짧게 말하고, 각각 따로 들을 수 있게 한다.
   설계: docs/코스공략_캐디_설계.md                                     */

/* 항목을 코드가 정한다 — 모델에게 "파 보고 알아서 나누라"고 하면
   홀마다 항목 수가 들쭉날쭉해져 화면과 음성이 흔들린다. */
function shotLabels(par, hasGreen) {
  const p = Number(par) || 4;
  const base = p <= 3 ? ["티샷", "그린 주변"]
             : p >= 5 ? ["티샷", "세컨샷", "서드샷"]
             : ["티샷", "세컨샷"];
  return hasGreen ? base.concat("그린") : base;
}
const SHOT_ICON = { "티샷": "⛳", "세컨샷": "🏌️", "서드샷": "🎯", "그린 주변": "🎯", "그린": "🟢" };

/* 모델 응답(라벨 줄) → 카드 배열.
   라벨이 하나도 안 잡히면 통짜로 한 장 — 받은 내용을 잃지 않는다. */
function parseCaddie(text, labels) {
  const t = String(text || "").trim();
  if (!t) return [];
  const head = new RegExp("^\\s*[\\[\\(【]\\s*(" + labels.join("|") + ")\\s*[\\]\\)】]\\s*[:：]?\\s*");
  const cards = [];
  t.split(/\r?\n/).forEach((line) => {
    const s = line.trim();
    if (!s) return;
    const m = s.match(head);
    if (m) cards.push({ label: m[1], text: s.slice(m[0].length).trim() });
    else if (cards.length) cards[cards.length - 1].text += " " + s;   // 줄바꿈된 이어진 문장
  });
  const ok = cards.filter((c) => c.text);
  return ok.length ? ok : [{ label: "공략", text: t }];
}

/* ── 음성: 기기 내장 TTS(여성 한국어). 없으면 조용히 숨긴다 ──
   어색한 억양으로 읽느니 글자만 보여주는 게 낫다(틀릴 수 있으면 표시하지 않는다). */
const VOICE_OFF_KEY = "riweather.voice.off";
const voiceOn = () => !localStorage.getItem(VOICE_OFF_KEY);
const hasTTS = () => typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";
/* 이름이 알려진 여성 한국어 음성 — iOS/맥 유나, 안드로이드 크롬, 윈도우 순 */
const VOICE_PREFER = ["Yuna", "유나", "Google 한국의", "SunHi", "Sora", "Heami"];
let koVoice = null, voiceUnlocked = false, speakingBtn = null;

/* 목소리 점수 — 이름 순서만 보면 '압축판'을 고르게 된다.
 *
 * 기기에 깔린 기본 한국어 음성은 대부분 용량을 줄인 압축판(compact)이라
 * 딱딱하고 알아듣기 어렵다. 같은 유나라도 (Enhanced)/(Premium) 이 붙은 것은
 * 훨씬 사람에 가깝고, localService=false 인 서버 합성 음성도 대개 신경망이다.
 * 그래서 이름 우선순위보다 **품질 표시를 먼저** 본다. (사장님 지적 2026-07-30)
 */
function voiceScore(v) {
  const n = v.name || "";
  let s = 0;
  if (/premium|enhanced|neural|natural|고품질|프리미엄/i.test(n)) s += 100;
  if (v.localService === false) s += 40;          // 서버 합성 = 대개 신경망
  VOICE_PREFER.forEach((w, i) => { if (n.includes(w)) s += 30 - i * 3; });
  return s;
}
function pickKoVoice() {
  if (!hasTTS()) return null;
  let all = [];
  try { all = speechSynthesis.getVoices() || []; } catch { return null; }
  const ko = all.filter((v) => /^ko/i.test(v.lang || "") || /korean|한국/i.test(v.name || ""));
  if (!ko.length) return null;
  return ko.slice().sort((a, b) => voiceScore(b) - voiceScore(a))[0];
}
/* 지금 고른 목소리가 압축판뿐인지 — 화면에서 안내를 띄울지 판단하는 데 쓴다 */
function voiceIsBasic() {
  return !!koVoice && !/premium|enhanced|neural|natural|고품질|프리미엄/i.test(koVoice.name || "")
         && koVoice.localService !== false;
}
if (hasTTS()) {
  koVoice = pickKoVoice();
  // 첫 호출에 빈 배열이 오는 기기가 많다 — 목록이 준비되면 다시 고르고 버튼을 살린다
  speechSynthesis.addEventListener?.("voiceschanged", () => {
    koVoice = pickKoVoice();
    document.querySelectorAll(".cad-voice").forEach((b) => { b.hidden = !koVoice || !voiceOn(); });
  });
}
/* iOS는 '사용자가 누른 그 순간' 소리를 한 번 내야 이후 재생이 허용된다.
   그래서 버튼 핸들러 안에서 동기적으로 호출해야 한다(응답을 기다린 뒤엔 늦다). */
function unlockVoice() {
  if (voiceUnlocked || !voiceOn()) return;
  ttsUnlock();                       // 서버 음성(mp3)도 같은 규칙이라 여기서 함께 푼다
  if (!hasTTS()) { voiceUnlocked = true; return; }
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
    voiceUnlocked = true;
  } catch { /* 안 되면 그냥 글자만 */ }
}
function stopCaddieVoice() {
  // 서버 음성·기기 음성 둘 다 멈춘다. 홀을 옮겼는데 이전 홀 멘트가 계속 나오면 안 된다.
  if (ttsAudio) { try { ttsAudio.pause(); ttsAudio.onended = ttsAudio.onerror = null; } catch (_) {} }
  if (hasTTS()) { try { speechSynthesis.cancel(); } catch { /* 무시 */ } }
  if (speakingBtn) { speakingBtn.textContent = "🔊"; speakingBtn = null; }
}
/* 화면 글자 → 읽을 글자 (같은 문장을 쓰고 전처리만 다르게 한다) */
function speechText(s) {
  return String(s || "")
    .replace(/[\[\(【][^\]\)】]*[\]\)】]/g, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, " ")
    .replace(/(\d)\s*m(?![a-z])/gi, "$1미터")
    .replace(/파\s*(\d)/g, "파 $1")
    .replace(/["'`*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
/* ───────── 서버 음성 (네이버 클로바 보이스) ─────────
 *
 * 기기에 깔린 합성음은 압축판이라 "기계가 읽는 느낌"을 못 벗어난다(사장님 2026-07-30).
 * 그래서 백엔드가 클로바 보이스로 만든 mp3 를 받아 재생한다.
 *
 * ⚠️ 규칙: **서버가 안 되면 반드시 기기 음성으로 되돌아간다.**
 *    소리가 아예 안 나오는 것이 가장 나쁘다. 키가 없든, 요금이 끊겼든,
 *    네트워크가 죽었든 — 캐디는 계속 말해야 한다.
 * ⚠️ iOS 는 사용자가 누른 그 순간이 아니면 오디오를 못 튼다.
 *    그래서 무음 재생으로 미리 풀어 둔다(unlockVoice 와 같은 이유).
 */
const TTS_SPEAKER = "nara";        // 여성·차분 — 캐디 톤
let ttsServerOk = null;            // null=아직 모름 · true=됨 · false=안 됨(다시 안 부른다)
let ttsAudio = null;               // 재생기는 하나만 — 겹쳐 나오면 알아들을 수 없다
const ttsMemo = new Map();         // 같은 문장은 다시 받지 않는다

function ttsUnlock() {
  if (ttsAudio) return;
  try {
    ttsAudio = new Audio();
    ttsAudio.preload = "auto";
    // 아주 짧은 무음 — 이걸 사용자 터치 안에서 한 번 틀어야 이후 재생이 허용된다
    ttsAudio.src = "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA";
    ttsAudio.play().catch(() => {});
  } catch (_) { ttsAudio = null; }
}

async function ttsFetch(text) {
  if (ttsServerOk === false || !window.RIW_BACKEND) return null;
  if (ttsMemo.has(text)) return ttsMemo.get(text);
  try {
    const u = window.RIW_BACKEND + "?fn=tts&speaker=" + TTS_SPEAKER +
              "&k=" + window.RIW_TOK() + "&text=" + encodeURIComponent(text);
    const r = await fetchT(u, null, 9000);
    const j = await r.json();
    if (!j || !j.ok || !j.mp3) { ttsServerOk = false; return null; }
    ttsServerOk = true;
    const src = "data:audio/mp3;base64," + j.mp3;
    if (ttsMemo.size > 60) ttsMemo.clear();       // 메모리 정리
    ttsMemo.set(text, src);
    return src;
  } catch (_) { ttsServerOk = false; return null; }
}

/* 서버 음성으로 이어 읽기. 하나라도 실패하면 false 를 돌려주고 호출한 쪽이 기기 음성으로 간다. */
async function speakByServer(parts, btn, done) {
  const first = await ttsFetch(parts[0]);
  if (!first) return false;
  if (!ttsAudio) ttsUnlock();
  const play = (src) => new Promise((res) => {
    ttsAudio.onended = ttsAudio.onerror = () => res();
    ttsAudio.src = src;
    ttsAudio.play().catch(() => res());
  });
  const srcs = [first];
  for (let i = 1; i < parts.length; i++) srcs.push(await ttsFetch(parts[i]));
  for (const s of srcs) {
    if (speakingBtn !== btn) return true;          // 그 사이 멈췄거나 다른 걸 눌렀다
    if (s) await play(s);
  }
  done();
  return true;
}

function speakCaddie(texts, btn) {
  if (!voiceOn()) return;
  stopCaddieVoice();
  const raw = (Array.isArray(texts) ? texts : [texts]).map(speechText).filter(Boolean);
  if (!raw.length) return;
  const chunks = [];
  raw.forEach((t) => t.split(/(?<=[.!?])\s+/).forEach((s) => { if (s.trim()) chunks.push(s.trim()); }));
  if (btn) { speakingBtn = btn; btn.textContent = "⏹"; }
  const finish = () => { if (btn && speakingBtn === btn) { btn.textContent = "🔊"; speakingBtn = null; } };

  // 1순위 서버 음성 → 안 되면 기기 음성
  speakByServer(chunks, btn, finish).then((ok) => {
    if (!ok) speakByDevice(chunks, btn, finish);
  }).catch(() => speakByDevice(chunks, btn, finish));
}

function speakByDevice(parts, btn, done) {
  if (!hasTTS()) { done(); return; }
  koVoice = koVoice || pickKoVoice();
  if (!koVoice) { done(); return; }
  /* 문장 단위로 끊어서 말한다 — 통짜로 넘기면 쉼 없이 쏟아져 알아듣기 어렵다.
     문장마다 따로 넣으면 브라우저가 사이에 자연스러운 쉼을 준다.
     (쪼개는 일은 speakCaddie 가 이미 해서 넘겨준다) */
  parts.forEach((t, i) => {
    const u = new SpeechSynthesisUtterance(t);
    u.voice = koVoice;
    u.lang = koVoice.lang || "ko-KR";
    /* ⚠️ 예전엔 pitch 1.12 · rate 1.02 였다. 톤을 올리면 밝아 보이지만
       합성음은 소리가 얇아져 **더 안 들린다**("뭐라는지 하나도 안 들려요" — 2026-07-30).
       라운드 중엔 바람·주변 소음도 있다. 기본 톤에 살짝 느리게가 가장 잘 들린다. */
    u.pitch = 1.0;
    u.rate = 0.94;
    if (i === parts.length - 1) { u.onend = done; u.onerror = done; }
    try { speechSynthesis.speak(u); } catch { done(); }
  });
}

/* 카드 그리기 — 샷마다 한 장.
   AI 호출은 한 번이고 세 샷을 한꺼번에 받아 둔다(생각 시간이 지연의 대부분이라
   샷마다 따로 부르면 그 시간이 그대로 곱해진다). 받아 둔 것을 언제 보여주느냐만 다르다.

   ⛳ 티샷  : 버튼을 누른 그 자리가 티박스다 → 글도 바로 보이고 음성도 바로 나온다.
   🏌️ 나머지: 그 지점에 가서 누르면 → 그때 공략이 열리면서 캐디가 읽어준다.
              (사장님 지시 2026-07-29. 미리 다 펼쳐 두면 결국 다 읽어야 해서 길어진다) */
function renderCaddieCards(cards, out, autoPlay) {
  out.innerHTML = "";
  out.hidden = false;
  /* 읽어줄 수 있는가 — 서버 음성(클로바)이 살아 있으면 기기 음성이 없어도 된다.
     ttsServerOk 가 null(아직 안 불러봄)이면 '될 수도 있다'로 보고 버튼을 보여준다.
     실제로 안 되면 speakCaddie 가 기기 음성으로 되돌아가고, 그것도 없으면 조용히 넘어간다. */
  const voiceReady = (hasTTS() && !!koVoice) || (ttsServerOk !== false && !!window.RIW_BACKEND);
  const canSpeak = () => voiceReady && voiceOn();
  const openers = [];        // 아직 안 연 카드의 여는 버튼 (음성 껐다 켤 때 글자만 바꾼다)
  let firstPlay = null;

  cards.forEach((c, i) => {
    const card = document.createElement("div");
    card.className = "cad-card";
    const head = document.createElement("div");
    head.className = "cad-head";
    head.innerHTML = `<span class="cad-ico">${SHOT_ICON[c.label] || "💡"}</span>` +
                     `<span class="cad-label"></span>`;
    head.querySelector(".cad-label").textContent = c.label;

    // 다시 듣기 (카드가 열린 뒤에만 보인다)
    const play = document.createElement("button");
    play.type = "button";
    play.className = "cad-play cad-voice";
    play.textContent = "🔊";
    play.setAttribute("aria-label", tr("app.cad.replay", { label: c.label }));
    play.addEventListener("click", () => {
      if (speakingBtn === play) { stopCaddieVoice(); return; }
      speakCaddie(c.text, play);
    });
    head.appendChild(play);

    const p = document.createElement("p");
    p.className = "cad-text";
    p.textContent = c.text;

    // 이 샷 차례에 누르는 버튼 — 누르면 공략이 열리면서 읽어준다
    const open = document.createElement("button");
    open.type = "button";
    open.className = "cad-open";
    const paintOpen = () => {
      open.textContent = canSpeak() ? tr("app.cad.open.listen", { label: c.label })
                                    : tr("app.cad.open.read", { label: c.label });
    };
    paintOpen();
    const reveal = (speak) => {
      p.hidden = false;
      open.hidden = true;
      play.hidden = !canSpeak();
      if (speak && canSpeak()) speakCaddie(c.text, play);
    };
    open.addEventListener("click", () => reveal(true));

    card.appendChild(head);
    card.appendChild(open);
    card.appendChild(p);
    out.appendChild(card);

    if (i === 0) {
      // 티샷은 열어둔 채로 시작 (누른 사람이 지금 티박스에 서 있다)
      p.hidden = false;
      open.hidden = true;
      play.hidden = !canSpeak();
      firstPlay = play;
    } else {
      p.hidden = true;
      play.hidden = true;
      openers.push({ open, paintOpen, reveal });
    }
  });

  const foot = document.createElement("div");
  foot.className = "cad-foot";
  const all = document.createElement("button");
  all.type = "button";
  all.className = "cad-all cad-voice";
  all.textContent = tr("app.cad.all");
  all.hidden = !canSpeak();
  all.addEventListener("click", () => {
    if (speakingBtn === all) { stopCaddieVoice(); return; }
    openers.forEach((o) => o.reveal(false));            // 전체 듣기는 전부 펼치고 이어서 읽는다
    speakCaddie(cards.map((c) => c.label + ". " + c.text), all);
  });
  const mute = document.createElement("button");
  mute.type = "button";
  mute.className = "cad-mute";
  mute.hidden = !voiceReady;
  const paintMute = () => { mute.textContent = voiceOn() ? tr("app.cad.mute.off") : tr("app.cad.mute.on"); };
  paintMute();
  mute.addEventListener("click", () => {
    if (voiceOn()) { localStorage.setItem(VOICE_OFF_KEY, "1"); stopCaddieVoice(); }
    else localStorage.removeItem(VOICE_OFF_KEY);
    paintMute();
    // 음성을 끄면 '듣기'가 아니라 '보기'가 되어야 한다 (안 나오는 걸 나온다고 하면 안 됨)
    openers.forEach((o) => o.paintOpen());
    out.querySelectorAll(".cad-voice").forEach((b) => {
      if (b.closest(".cad-card") && b.parentElement.parentElement.querySelector(".cad-text").hidden) return;
      b.hidden = !canSpeak();
    });
  });
  foot.appendChild(all);
  foot.appendChild(mute);
  out.appendChild(foot);

  /* 기기에 압축판 목소리뿐이면 안내한다.
     iOS·안드로이드 모두 고품질 한국어 음성을 **따로 내려받아야** 하고,
     받고 나면 같은 코드로 훨씬 사람에 가깝게 들린다. 우리가 해줄 수 없는 부분이라
     "어디서 받는지"를 알려주는 것이 최선이다. (2026-07-30) */
  // 서버 음성이 살아 있으면 기기 음성 품질은 상관없다 → 안내를 띄우지 않는다
  if (canSpeak() && ttsServerOk === false && voiceIsBasic()) {
    const tip = document.createElement("p");
    tip.className = "cad-voice-tip";
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    tip.innerHTML = tr("app.cad.voicetip") +
      (ios ? tr("app.cad.voicetip.ios") : tr("app.cad.voicetip.aos"));
    out.appendChild(tip);
  }

  // 티샷은 버튼을 누른 그 순간 바로 들려준다
  if (autoPlay && canSpeak() && firstPlay) speakCaddie(cards[0].text, firstPlay);
  return voiceReady;
}

/* 이 홀에 캐디 공략을 제공할 수 있는지 — 공식 홀 자료가 있는 구장만.
   위성으로 추정한 구장은 파·거리가 추정치라 샷별로 나누면 그 전제부터 틀린다.
   (자신감 있는 음성으로 틀리는 것이 가장 나쁘다 — 설계서 2-1장)            */
function setCaddieAvailable(ok) {
  const btn = $("#ai-strategy-btn"), out = $("#ai-strategy");
  stopCaddieVoice();
  btn.hidden = !ok;
  out.innerHTML = "";
  if (ok) {
    out.hidden = true;
  } else {
    out.innerHTML = tr("app.cad.prep");
    out.hidden = false;
  }
}

/* 동의받은 연령대·성별을 AI 캐디 공략에 실제로 반영한다 */
function playerTraits() {
  const c = CONSENT.get() || {};
  const p = loadProfile();
  const bits = [];
  if (c.age) bits.push(c.age);
  if (c.gender && c.gender !== "선택 안 함") bits.push(c.gender);
  if (p.years) bits.push("구력 " + p.years);
  if (p.avg) bits.push("평균 " + p.avg + " 타수");
  const bag = (typeof loadMyBag === "function") ? loadMyBag() : null;
  if (bag && bag.driver)
    bits.push("드라이버 " + (bag.driver.keep ? bag.driver.shaft : bag.driver.head + " + " + bag.driver.shaft));
  if (bag && bag.iron) bits.push("아이언 " + bag.iron.head);
  if (bag && bag.carryD) bits.push("드라이버 캐리 " + bag.carryD + "m");
  if (bag && bag.ball && bag.ball.cover) bits.push("볼 " + (bag.ball.model || bag.ball.cat));
  return bits.length ? ", " + bits.join(" ") : "";
}
function playerTraitGuide() {
  const c = CONSENT.get() || {};
  const y = (loadProfile().years) || "";
  let g = "";
  if (c.gender === "여성")
    g += "이 플레이어는 여성이므로 레드티(레이디티) 기준 거리로 계산해 조언하고, 남성 기준 비거리를 전제하지 마세요. ";
  if (c.age === "60대 이상")
    g += "연령대를 고려해 오르막·장타가 필요한 상황에서는 무리한 공략보다 안전한 레이업과 체력 안배를 우선 권하세요. ";
  else if (c.age === "50대")
    g += "무리한 장타보다 정확도를 살린 공략을 우선 제시하세요. ";
  // 구력 = 실력 수준. 조언의 난이도와 공격성을 여기에 맞춘다.
  if (y.startsWith("1년 미만"))
    g += "골프를 시작한 지 얼마 안 된 입문자입니다. 어려운 용어를 쓰지 말고 쉬운 말로 설명하며, " +
         "OB·해저드 같은 벌타를 피하는 것을 최우선으로 하는 가장 안전한 공략만 권하세요. 핀 공략은 권하지 마세요. ";
  else if (y === "1~3년")
    g += "초급자입니다. 페어웨이를 지키는 안전한 공략 위주로, 실수했을 때의 대처까지 한 줄 덧붙이세요. ";
  else if (y === "3~5년" || y === "5~10년")
    g += "중급자입니다. 코스 매니지먼트 관점에서 공략 지점과 클럽 선택 근거를 함께 제시하세요. ";
  else if (y === "10년 이상")
    g += "구력이 오래된 상급자입니다. 핀 위치별 공략, 탄도·스핀, 그린 공략각 등 세밀한 조언까지 제시해도 좋습니다. ";
  // 평균 타수 = 가장 정확한 실력 지표. 캐디+레슨프로처럼 호칭과 조언 톤을 여기에 맞춘다.
  // ⚠️ avg 가 숫자로 저장돼 있어도 죽지 않게 문자열로 바꾼다 — 여기서 던지면
  //    runAiCaddieInner 의 catch 로 넘어가 캐디 전체가 "연결 실패"로 죽는다(2026-07-30 발견).
  const a = String(loadProfile().avg || "");
  // 호칭 원칙(사장님 지시 2026-07-30): '싱글 골퍼님'만 예외적으로 부른다 — 칭찬이니까.
  // 그 외에는 전부 '골퍼님'. "80대/90대 골퍼님"처럼 타수를 입 밖에 내면
  // 동반자 앞에서 창피할 수 있다. 조언의 눈높이는 그대로 타수에 맞춘다.
  if (a.startsWith("70"))
    g += "평균 70대 타수의 싱글 골퍼입니다. 반드시 '싱글 골퍼님'이라고 부르세요. " +
         "실수 확률이 낮으니 핀을 직접 노리는 과감한 공략, 버디 찬스를 만드는 적극적인 옵션까지 제시하세요. ";
  else if (a.startsWith("80"))
    g += "평균 80대 타수의 중상급 골퍼입니다. 호칭은 '골퍼님'으로만 하고, 평균 타수는 절대 입 밖에 내지 마세요(동반자가 들으면 민망합니다). " +
         "파온을 우선하되 확실한 상황에서만 공격하는 균형 잡힌 공략을 제시하세요. ";
  else if (a.startsWith("90"))
    g += "평균 90대 타수의 골퍼입니다. 호칭은 '골퍼님'으로만 하고, 평균 타수는 절대 입 밖에 내지 마세요(동반자가 들으면 민망합니다). " +
         "힘이 들어가면 뒷땅·토핑이 나기 쉬우니 '힘을 빼고 부드럽게 천천히 스윙하세요' 같은 " +
         "스윙 리듬 조언을 곁들이고, 보기 온 전략과 큰 트러블 회피를 우선하세요. ";
  else if (a.startsWith("100") || a.startsWith("110"))
    g += "평균 " + a + " 타수의 골퍼입니다. 호칭은 '골퍼님'으로만 하고, 평균 타수는 절대 입 밖에 내지 마세요(동반자가 들으면 민망합니다). 따뜻하게 격려하는 말투로, " +
         "더블보기를 막는 것을 목표로 가장 넓고 안전한 지점만 권하고 한 클럽 짧게 잡아 편하게 치도록 권하세요. ";
  if (a)
    g += "캐디를 넘어 레슨 프로처럼, 이 수준의 골퍼가 이 홀에서 흔히 하는 실수와 그걸 막는 팁을 한 줄 곁들이세요. ";
  // 클럽 피팅 결과(내 백) — 장비 기준의 구체적 클럽 선택 조언
  const bag = (typeof loadMyBag === "function") ? loadMyBag() : null;
  if (bag && bag.carryD)
    g += `이 골퍼의 드라이버 캐리는 약 ${bag.carryD}m, 7번 아이언 캐리는 약 ${bag.carry7}m입니다. ` +
         "홀 거리와 이 수치를 비교해 티샷·세컨드 클럽을 구체적으로 지정하세요(예: 드라이버 대신 우드, 한 클럽 길게). ";
  // 웨지 구성을 알면 그린 주변 조언에서 실제로 가진 클럽만 지정할 수 있다
  if (bag && bag.wedge && bag.wedge.lofts && bag.wedge.lofts.length)
    g += `이 골퍼의 웨지는 ${bag.wedge.lofts.join("°, ")}° 구성입니다. ` +
         "그린 주변 조언에서는 이 중에서만 클럽을 지정하고, 갖고 있지 않은 로프트는 언급하지 마세요. ";
  // 볼 — 그린 주변에서 세울 수 있느냐 굴려야 하느냐는 커버 소재가 정한다
  if (bag && bag.ball && bag.ball.cover)
    g += `이 골퍼의 볼은 ${bag.ball.model || bag.ball.cat}(${bag.ball.cover} 커버)입니다. ` +
         (bag.ball.cover === "우레탄"
           ? "숏게임 스핀이 걸리는 공이므로 그린 주변에서 띄워 세우는 공략을 선택지에 넣어도 됩니다. "
           : "숏게임 스핀이 적은 공이므로 그린 주변에서는 띄워 세우기보다 굴려 붙이는 공략을 권하세요. ");
  return g;
}

/* AI 캐디 실행 전 — 맞춤 공략에 필요한 연령대·성별을 한 번만 물어본다.
   알려주지 않아도 공략은 그대로 제공(선택 항목 강제 금지).                */
const AI_PROFILE = {
  ASKED: "riweather.aiprofile.asked",
  AGES: ["10대", "20대", "30대", "40대", "50대", "60대 이상"],
  GENDERS: ["남성", "여성", "선택 안 함"],
  need() {
    const c = CONSENT.get() || {};
    return !c.age && !c.gender && !localStorage.getItem(this.ASKED);
  },
  ask(then) {
    localStorage.setItem(this.ASKED, "1");
    let a = null, g = null;
    const draw = (host, items, get, set) => {
      host.innerHTML = "";
      items.forEach((t) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pi-chip" + (get() === t ? " on" : "");
        b.textContent = pfLabel(t);
        b.addEventListener("click", () => { set(get() === t ? null : t); draw(host, items, get, set); });
        host.appendChild(b);
      });
    };
    draw($("#ai-age"), this.AGES, () => a, (v) => { a = v; });
    draw($("#ai-gender"), this.GENDERS, () => g, (v) => { g = v; });
    const sheet = $("#ai-profile-sheet");
    sheet.hidden = false;
    const close = () => { sheet.hidden = true; };
    $("#ai-profile-ok").onclick = () => {
      const c = CONSENT.get() || { v: LEGAL_VERSION, at: new Date().toISOString(), age14: true, tos: true };
      if (a) c.age = a;
      if (g) c.gender = g;
      if (a || g) { c.profile = true; c.profileAt = new Date().toISOString(); }
      CONSENT.save(c);
      close(); then();
    };
    $("#ai-profile-skip").onclick = () => { close(); then(); };
    sheet.onclick = (e) => { if (e.target === sheet) { close(); then(); } };
  },
};

async function aiCaddie() {
  if (!aiHoleCtx || !aiHoleCtx.imgHole) return;
  // iOS는 '누른 그 순간' 소리를 한 번 내야 이후 재생이 허용된다 — 응답을 기다린 뒤엔 늦다
  unlockVoice();
  if (typeof STATS !== "undefined") STATS.hit("feature", "ai");
  if (AI_PROFILE.need()) { AI_PROFILE.ask(() => runAiCaddie()); return; }
  return runAiCaddie();
}

/* 몇 초 걸리는 호출 — 대기 화면으로 말을 걸어 기다림을 지운다 */
async function runAiCaddie() {
  if (!aiHoleCtx) return;
  return WAIT.run("caddie", () => runAiCaddieInner());
}

/* 같은 홀을 다시 열면 다시 부르지 않는다(홀 이동 중엔 0초가 최고).
   프로필이 바뀌면 키가 달라져 저절로 새로 만든다. */
const caddieCache = new Map();
function caddieKey(hh, courseName) {
  const p = loadProfile(), c = CONSENT.get() || {};
  const bag = (typeof loadMyBag === "function") ? loadMyBag() : null;
  return [courseName, hh.cname, hh.no, p.shape, p.dist, p.years, p.avg,
          c.age, c.gender, bag && bag.carryD].join("|");
}

/* 같은 출처 이미지 → base64 (모델 첨부용) */
async function fetchImgB64(src) {
  const b = await fetchT(src, null, 5000).then((r) => r.blob());
  return await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(",")[1]);
    fr.onerror = rej;
    fr.readAsDataURL(b);
  });
}

async function runAiCaddieInner() {
  const btn = $("#ai-strategy-btn"), out = $("#ai-strategy");
  const hh = aiHoleCtx && aiHoleCtx.imgHole;
  if (!hh) return;                       // 공식 홀 자료가 없는 구장은 버튼 자체가 없다
  stopCaddieVoice();
  btn.disabled = true; btn.textContent = tr("app.cad.btn.loading");

  const finish = (cards) => {
    // 티샷은 바로 펼쳐서 읽어주고(누른 곳이 티박스다), 세컨샷부터는 그 지점에서 눌러 연다
    renderCaddieCards(cards, out, true);
    btn.disabled = false; btn.textContent = tr("app.cad.btn");
  };

  const key = caddieKey(hh, aiHoleCtx.courseName);
  const hit = caddieCache.get(key);
  if (hit) { finish(hit); return; }

  const prof2 = loadProfile();
  const labels = shotLabels(hh.par, !!hh.green);
  try {
    const hasImg = !!hh.img;
    // 홀맵·3D 장면·그린 경사도를 한꺼번에 받는다(순차로 받으면 그만큼 늦어진다)
    const [data, frameData, greenData] = await Promise.all([
      hasImg ? imgToB64($("#hole-img")).catch(() => null) : Promise.resolve(null),
      Promise.all((hh.frames || []).map((s) => fetchImgB64(s).catch(() => null)))
        .then((a) => a.filter(Boolean)),
      hh.green ? fetchImgB64(hh.green).catch(() => null) : Promise.resolve(null),
    ]);
    const elevTxt = hh.elev
      ? `티에서 그린까지 ${hh.elev > 0 ? "오르막 " + hh.elev : "내리막 " + Math.abs(hh.elev)}m. ` : "";
    const frameTxt = frameData.length
      ? `이어지는 ${frameData.length}장은 이 홀의 실제 3D 코스 영상에서 뽑은 장면입니다(티잉구역 → 페어웨이 중간 → 그린 접근 순서). 페어웨이 폭·굴곡, 나무·러프 경계, 해저드, 그린 주변 지형을 이 장면들에서 직접 확인하고 조언에 반영하세요. `
      : "";
    const greenTxt = greenData
      ? `마지막 이미지는 이 홀 그린의 공식 경사도입니다(빨강=높은 쪽, 파랑=낮은 쪽). [그린] 항목은 이 그림에서 보이는 것만 근거로 말하세요. ` +
        `단, '빨갛다'·'파랗다' 같은 색깔 단어는 절대 쓰지 마세요 — 듣는 사람은 그림을 모릅니다. '오른쪽이 높다'처럼 높낮이로만 말하세요. `
      : "";
    const head = hasImg ?
      `당신은 밝고 자신감 넘치는 투어 경력의 여성 캐디입니다. 지금 플레이어 옆에서 함께 걸으며 말로 안내하는 중입니다 — 보고서가 아니라 대화입니다. ` +
      `첨부 이미지 1번은 ${aiHoleCtx.courseName} ${hh.cname}코스 ${hh.no}번홀${hh.par ? `(파${hh.par})` : ""}의 공식 홀맵입니다. ` +
      `홀맵에는 홀 모양, 벙커·해저드 위치, 그린까지 거리선(50/100/150M)이 표시되어 있습니다. ` + frameTxt + greenTxt + elevTxt :
      `당신은 밝고 자신감 넘치는 투어 경력의 여성 캐디입니다. 지금 플레이어 옆에서 함께 걸으며 말로 안내하는 중입니다 — 보고서가 아니라 대화입니다. ` +
      `${aiHoleCtx.courseName} ${hh.cname}코스 ${hh.no}번홀${hh.par ? `(파${hh.par})` : ""}을 안내합니다. ` +
      `홀맵 그림은 없고 아래 수치 정보만 있습니다. 사진이 있는 것처럼 지형·벙커 위치를 지어내지 말고, 주어진 파·거리·고도차와 플레이어 구질만으로 조언하세요. ` + elevTxt;
    const facts =
      (hh.dist ? `티별 거리(m): L그린 백${hh.dist.L[0]}/레귤러${hh.dist.L[1]}/프론트${hh.dist.L[2]}/레이디${hh.dist.L[3]}, R그린 백${hh.dist.R[0]}/레귤러${hh.dist.R[1]}/프론트${hh.dist.R[2]}/레이디${hh.dist.R[3]}. ` :
       // ⚠️ 일본 구장은 야드다 — teeText 이 단위를 붙여 준다.
       //    여기서 단위를 빼면 캐디가 야드를 미터로 읽고 **한 클럽 짧게** 조언한다.
       hh.tees ? `티별 거리: ${teeText(hh.tees)}. ` :
       hh.len ? `전장 ${hh.len}m${hh.hdcp ? ", 핸디캡 " + hh.hdcp : ""}. ` : "") +
      (hh.tip ? `골프장 공식 공략 TIP: "${hh.tip}" ` : "") +
      `플레이어: 구질 ${prof2.shape || "스트레이트"}, 드라이버 평균 ${prof2.dist || 200}m${playerTraits()}. ` +
      playerTraitGuide() +
      `가장 중요한 것은 구질 맞춤입니다 — 이 플레이어의 구질(${prof2.shape || "스트레이트"})이 이 홀에서 유리한지 불리한지 판단해, ` +
      `구질을 감안한 구체적인 조준점(예: 슬라이스면 좌측 OO를 보고)과 위험 구역 회피법을 [티샷]에 반드시 넣으세요. ` +
      `확인할 수 없는 정보(그린 경사, 잔디 상태 등)는 절대 지어내지 마세요. ` +
      `위 지시들은 문장 수를 늘리지 말고 각 항목 안에 녹여 넣으세요. `;
    // 형식 지시는 맨 끝에 — 지시가 여러 개일 때 마지막 지시의 이행률이 가장 높다
    const fmt =
      `\n아래 형식으로만 답하세요. 각 줄은 대괄호 라벨로 시작합니다.\n` +
      labels.map((l) => `[${l}] (조언)`).join("\n") + "\n" +
      `- 위 ${labels.length}개 라벨을 순서대로 정확히 한 번씩만 쓰고, 다른 줄은 절대 쓰지 마세요.\n` +
      `- [티샷]은 1~2문장 90자 이내, 나머지 항목은 1~2문장 70자 이내.\n` +
      `- 호칭(예: 싱글 골퍼님)은 [티샷]에서 한 번만.\n` +
      `- 글이 아니라 말입니다. 옆에서 걷는 캐디가 말을 거는 것처럼 짧은 구어체로 하세요.\n` +
      `  '~가 핵심입니다', '~찬스입니다', '~에 착지합니다' 같은 딱딱한 문어체 마무리 금지 — ` +
      `'~하세요', '~보시면 됩니다', '~하시고요!', '~해 보세요' 처럼 말하듯 끝내세요.\n` +
      `- 응원하는 사람처럼 자연스럽게. 마지막 줄은 가벼운 응원으로 마무리하되(화이팅!, 버디 기대할게요~ 등) 문구를 매번 똑같이 쓰지 마세요.\n` +
      `- 목록·번호·별표·이모지 금지. 소리 내어 읽어줄 문장이니 자연스러운 존댓말로만.\n` +
      `말투 예시 (톤만 따라하세요 — 호칭은 위에서 지정한 호칭을, 내용은 이 홀에 맞게) —\n` +
      `[티샷] 골퍼님, 구질이 페이드시니 좌측 카트도로 보고 자신 있게 때리세요. 힘 빼고 부드러운 템포만 지키시고요!\n` +
      `[세컨샷] 내리막 감안해서 100미터 정도만 보시면 됩니다. 백스핀 살려서 핀 직접 노려 보세요. 버디 기대할게요~\n`;

    const build = (extra) => {
      const parts = [{ text: head + facts + fmt + (extra || "") }];
      if (data) parts.push({ inline_data: { mime_type: "image/jpeg", data } });
      frameData.forEach((d2) => parts.push({ inline_data: { mime_type: "image/jpeg", data: d2 } }));
      if (greenData) parts.push({ inline_data: { mime_type: "image/jpeg", data: greenData } });
      return parts;
    };
    // 상한은 '생각 + 답' 합계다 — 낮게 잡으면 답이 잘린다(주석 참고). 넉넉히 준다.
    const opts = { maxTokens: 3072, lowThinking: true };
    let text = await geminiGenerate(build(), 0.4, opts);
    let cards = parseCaddie(text, labels);
    // 형식이 어긋나면 한 번만 다시 — 그래도 어긋나면 받은 그대로 보여준다(내용을 버리지 않는다)
    const tooLong = cards.reduce((s, c) => s + c.text.length, 0) > 400;
    if (cards.length !== labels.length || tooLong) {
      try {
        text = await geminiGenerate(
          build(`\n⚠ 반드시 지키세요: 정확히 ${labels.length}줄, 각 줄은 [${labels.join("] / [")}] 라벨로 시작, ` +
                `[티샷] 90자 이내·나머지 70자 이내. 다른 줄은 쓰지 마세요.\n`), 0.4, opts);
        const retry = parseCaddie(text, labels);
        if (retry.length === labels.length) cards = retry;
      } catch { /* 재시도 실패 시 첫 응답을 그대로 쓴다 */ }
    }
    caddieCache.set(key, cards);
    finish(cards);
  } catch (e) {
    out.innerHTML = tr("app.cad.err");
    out.hidden = false;
    btn.disabled = false; btn.textContent = tr("app.cad.btn");
  }
}
$("#ai-strategy-btn").addEventListener("click", aiCaddie);

/* ---------- 홀 3D 영상: 터치해야 컨트롤이 나온다 ----------
   처음에는 첫 장면만 깔끔하게 보이고, 화면을 누르면 그때 재생 컨트롤이 붙는다.
   (controls 를 미리 켜두면 iOS 가 ±10초 버튼으로 영상을 덮어버린다) */
(function initHoleVideo() {
  const vp = $("#hole-video-player"), vb = $("#hole-video-play");
  if (!vp) return;
  /* 재생을 시작할 때는 컨트롤을 붙이지 않는다.
     controls 를 켜는 순간 iOS 가 ±10초·일시정지·진행바를 영상 위에 덮어버려
     정작 보려던 코스가 가려진다(2026-07-28 지적). 영상만 깨끗하게 흐르게 둔다. */
  const start = () => {
    if (vb) vb.hidden = true;
    vp.removeAttribute("controls");
    vp.play?.().catch(() => {
      // 브라우저가 자동재생을 막으면 그때만 컨트롤을 붙여 직접 누르게 한다
      vp.setAttribute("controls", "");
    });
  };
  vb?.addEventListener("click", start);
  vp.addEventListener("click", () => {
    if (vp.hasAttribute("controls")) return;   // 이미 떠 있으면 브라우저에 맡긴다
    if (vp.paused) start();                    // 아직 시작 전 → 재생만
    else vp.setAttribute("controls", "");      // 재생 중에 터치 → 그때 컨트롤을 띄운다
  });
  // 재생이 끝나면 다시 처음처럼 — 표지 화면으로 돌아간다
  vp.addEventListener("ended", () => {
    vp.removeAttribute("controls");
    vp.load?.();                 // 표지(poster)를 다시 그리게 한다
    if (vb) vb.hidden = false;
  });
})();

/* 앱 공유 버튼 — 모든 화면 공통 */
(function initAppShare() {
  const APP_URL = "https://brownrigoon-commits.github.io/Ri-weather/";
  const btn = $("#app-share-btn"), toast = $("#app-share-toast");
  if (!btn) return;
  let toastTimer = null;
  btn.addEventListener("click", async () => {
    const data = {
      title: tr("app.brand"),
      text: tr("app.share.text"),
      url: APP_URL,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return; // 사용자가 공유창 닫음
    }
    try {
      await navigator.clipboard.writeText(APP_URL);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = APP_URL;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2500);
  });
})();

/* 내 플레이 정보 (구질·비거리·구력) 초기화·저장 */
(function initProfile() {
  const p = loadProfile();
  if (p.shape) $("#pf-shape").value = p.shape;
  if (p.dist) $("#pf-dist").value = p.dist;
  if (p.years) $("#pf-years").value = p.years;
  const save = () => {
    saveProfile({
      shape: $("#pf-shape").value,
      dist: parseInt($("#pf-dist").value) || null,
      years: $("#pf-years").value || null,
    });
    if (lastHoleSelect) lastHoleSelect(); // 열려 있는 홀 공략 즉시 재계산
  };
  $("#pf-shape").addEventListener("change", save);
  $("#pf-dist").addEventListener("change", save);
  $("#pf-years").addEventListener("change", save);
})();

/* 코스 공략의 연령대·성별 입력 — 약관에서 이미 입력한 항목은 보이지 않는다.
   (약관에서 안 넣고 들어온 이용자도 여기서 넣을 수 있게 — 사장님 요청)     */
function refreshProfileCard() {
  const c = CONSENT.get() || {};
  const p = loadProfile();
  // 이미 입력된 항목은 숨김
  const yearsRow = $("#pf-years-row");
  if (yearsRow) yearsRow.hidden = !!p.years;
  const ageRow = $("#pfc-age-row"), genRow = $("#pfc-gender-row");
  if (!ageRow || !genRow) return;
  ageRow.hidden = !!c.age;
  genRow.hidden = !!c.gender;
  const drawChips = (host, items, get, set) => {
    host.innerHTML = "";
    items.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pi-chip" + (get() === t ? " on" : "");
      b.textContent = pfLabel(t);
      b.addEventListener("click", () => {
        set(get() === t ? null : t);
        drawChips(host, items, get, set);
        if (lastHoleSelect) lastHoleSelect();   // 공략 문구 즉시 반영
      });
      host.appendChild(b);
    });
  };
  const saveField = (k, v) => {
    const cc = CONSENT.get() || { v: LEGAL_VERSION, at: new Date().toISOString(), age14: true, tos: true };
    cc[k] = v;
    if (v) { cc.profile = true; cc.profileAt = new Date().toISOString(); }
    CONSENT.save(cc);
  };
  if (!ageRow.hidden)
    drawChips($("#pfc-age"), AI_PROFILE.AGES, () => (CONSENT.get() || {}).age || null, (v) => saveField("age", v));
  if (!genRow.hidden)
    drawChips($("#pfc-gender"), AI_PROFILE.GENDERS, () => (CONSENT.get() || {}).gender || null, (v) => saveField("gender", v));
  // 평균타수 — AI 캐디가 실력에 맞는 공략 톤을 잡는 핵심 정보 (플레이 정보라 프로필에 저장)
  const avgRow = $("#pfc-avg-row");
  if (avgRow) {
    avgRow.hidden = !!p.avg;
    if (!avgRow.hidden)
      drawChips($("#pfc-avg"), ["70대 (싱글)", "80대", "90대", "100대", "110 이상"],
        () => loadProfile().avg || null,
        (v) => saveProfile(Object.assign(loadProfile(), { avg: v })));
  }
}

/* =========================================================
 * 주변맛집 — OSM 식당 + 카카오/네이버 연결
 * ========================================================= */
const CUISINE_KO = {
  korean: ["한식", "🍚"], chicken: ["치킨", "🍗"], japanese: ["일식", "🍣"],
  sushi: ["초밥", "🍣"], chinese: ["중식", "🥟"], pizza: ["피자", "🍕"],
  burger: ["햄버거", "🍔"], seafood: ["해산물", "🦐"], barbecue: ["고기구이", "🥩"],
  noodle: ["국수", "🍜"], ramen: ["라멘", "🍜"], asian: ["아시아", "🍛"],
  italian: ["양식", "🍝"], western: ["양식", "🍴"], coffee_shop: ["카페", "☕"],
};
const cuisineInfo = (c) => {
  if (!c) return ["식당", "🍴"];
  const k = c.split(";")[0].trim().toLowerCase();
  return CUISINE_KO[k] || [k, "🍴"];
};
const foodCache = new Map();
const FOOD_LS = "riweather.food.";

/* 식당 데이터: 메모리 → 폰 저장(7일) → 서버 순으로 확인 (재방문 시 즉시 표시) */
async function fetchFoodData(course) {
  const key = course.lat.toFixed(3) + "," + course.lon.toFixed(3);
  if (foodCache.has(key)) return foodCache.get(key);
  try {
    const c = JSON.parse(localStorage.getItem(FOOD_LS + key) || "null");
    if (c && Date.now() - c.t < 7 * 864e5) { foodCache.set(key, c.d); return c.d; }
  } catch { /* 캐시 손상 시 무시 */ }
  const raw = await overpassQuery(
    `[out:json][timeout:25];(node["amenity"~"restaurant|fast_food"]["name"](around:5000,${course.lat},${course.lon});way["amenity"~"restaurant|fast_food"]["name"](around:5000,${course.lat},${course.lon}););out center meta 80;`);
  const d = {
    elements: (raw.elements || []).map((e) => ({
      lat: e.lat, lon: e.lon, center: e.center, tags: e.tags, timestamp: e.timestamp,
    })),
  };
  foodCache.set(key, d);
  try { localStorage.setItem(FOOD_LS + key, JSON.stringify({ t: Date.now(), d })); } catch {}
  return d;
}
function prefetchFood(course) { fetchFoodData(course).catch(() => {}); }

/* ---------- 카카오 로컬/이미지 API (맛집 목록·사진) ---------- */
const KAKAO_KEY_LS = "riweather.kakaokey";
const EMBED_KAKAO_B64 = "OTg0N2VjNWU5YTRkMTEyN2M1NzY1MDY1YjNlNzFmZjI=";   // 투어리스트 공용 키
const getKakaoKey = () => localStorage.getItem(KAKAO_KEY_LS) ||
  (EMBED_KAKAO_B64 ? atob(EMBED_KAKAO_B64) : "");

/* 시간 제한이 있는 fetch — 연결이 물려도 화면이 영원히 기다리지 않게 한다.
   (2026-07-24 '무한 로딩' 신고 후 도입. 새 네트워크 요청은 반드시 이걸 쓸 것) */
function fetchT(url, opts, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms || 8000);
  return fetch(url, Object.assign({}, opts, { signal: ctrl.signal }))
    .finally(() => clearTimeout(timer));
}

async function kakaoApi(url) {
  const key = getKakaoKey();
  if (!key) throw new Error("no-kakao-key");
  const r = await fetchT(url, { headers: { Authorization: "KakaoAK " + key } }, 8000);
  if (!r.ok) throw new Error("kakao " + r.status);
  return r.json();
}

/* 골프장 주변 음식점 (카카오맵 등록 기준, 가까운 순) */
const kakaoFoodCache = new Map();
async function fetchKakaoFood(course) {
  const ck = course.lat.toFixed(3) + "," + course.lon.toFixed(3);
  if (kakaoFoodCache.has(ck)) return kakaoFoodCache.get(ck);
  const out = [];
  // 3페이지를 병렬로 — 목록 표시가 그만큼 빨라진다
  const pages = await Promise.all([1, 2, 3].map((page) =>
    kakaoApi("https://dapi.kakao.com/v2/local/search/category.json" +
      `?category_group_code=FD6&x=${course.lon}&y=${course.lat}&radius=5000&sort=distance&page=${page}&size=15`)
      .catch(() => ({}))));
  pages.forEach((j) => {
    (j.documents || []).forEach((d) => out.push({
      name: d.place_name,
      cat: (d.category_name || "").split(">").pop().trim(),
      phone: d.phone || "",
      addr: d.road_address_name || d.address_name || "",
      lat: parseFloat(d.y), lon: parseFloat(d.x),
      dist: parseInt(d.distance) || 0,
      url: d.place_url || "",
    }));
  });
  out.sort((a, b) => a.dist - b.dist);
  kakaoFoodCache.set(ck, out);
  return out;
}

/* 식당 사진 자동 수집은 폐기 — 이미지 검색으로는 '그 식당' 사진임을 보장할 수 없다.
   (다른 식당 음식·전경이 섞여 나와 신뢰 하락. 카카오맵 페이지 연결로 대체) */

/* ---------- 사진 크게 보기 (라이트박스) ---------- */
let lbList = [], lbIdx = 0;
function lbShow(i) {
  if (!lbList.length) return;
  lbIdx = (i + lbList.length) % lbList.length;
  const im = lbList[lbIdx];
  const el = $("#lb-img");
  el.onerror = () => {
    el.onerror = () => {                       // 썸네일까지 실패 → 이 사진을 빼고 다음으로
      el.onerror = null;
      lbList.splice(lbIdx, 1);
      if (!lbList.length) { closeLightbox(); return; }
      lbShow(lbIdx);
    };
    el.src = im.t;                             // 원본 실패 시 썸네일
  };
  el.src = im.u || im.t;
  $("#lb-count").textContent = `${lbIdx + 1} / ${lbList.length}`;
  const multi = lbList.length > 1;
  $("#lb-prev").hidden = !multi;
  $("#lb-next").hidden = !multi;
}
function openLightbox(list, i) {
  lbList = list;
  $("#img-lightbox").hidden = false;
  document.body.style.overflow = "hidden";
  /* 떠 있는 뒤로가기·공유를 감춘다 — 뷰어에는 제 닫기(×)와 넘김(‹ ›)이 따로 있다.
     버튼을 대기 화면 위(5100)로 올린 뒤 사진 뷰어(200)까지 덮어 서로 겹쳐 눌렸다
     (2026-08-03 사장님 화면 — 맛집 사진에서 발견). */
  document.body.classList.add("lb-open");
  lbShow(i);
}
function closeLightbox() {
  $("#img-lightbox").hidden = true;
  document.body.style.overflow = "";
  document.body.classList.remove("lb-open");
  $("#lb-img").src = "";
}
(function initLightbox() {
  const box = $("#img-lightbox");
  if (!box) return;
  $("#lb-close").addEventListener("click", closeLightbox);
  $("#lb-prev").addEventListener("click", (e) => { e.stopPropagation(); lbShow(lbIdx - 1); });
  $("#lb-next").addEventListener("click", (e) => { e.stopPropagation(); lbShow(lbIdx + 1); });
  box.addEventListener("click", (e) => { if (e.target === box || e.target.id === "lb-img" || e.target.className === "lb-stage") closeLightbox(); });
  document.addEventListener("keydown", (e) => {
    if (box.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") lbShow(lbIdx - 1);
    if (e.key === "ArrowRight") lbShow(lbIdx + 1);
  });
  // 좌우 스와이프로 사진 넘기기
  let sx = null, sy = null;
  box.addEventListener("touchstart", (e) => {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  box.addEventListener("touchend", (e) => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      e.stopPropagation();
      lbShow(dx < 0 ? lbIdx + 1 : lbIdx - 1);
    } else if (dy < -70 && Math.abs(dy) > Math.abs(dx)) {
      e.stopPropagation();
      closeLightbox();                    // 위로 강하게 쓸어올리면 닫기
    }
    sx = sy = null;
  });
})();

const catEmoji = (cat) => {
  const s = cat || "";
  if (/한식|백반|국밥|찌개|한정식|해장/.test(s)) return "🍚";
  if (/고기|삼겹|갈비|곱창|족발|보쌈/.test(s)) return "🥩";
  if (/치킨|닭/.test(s)) return "🍗";
  if (/일식|초밥|스시|돈까스|라멘/.test(s)) return "🍣";
  if (/중식|중국|짜장|짬뽕/.test(s)) return "🥢";
  if (/양식|파스타|스테이크|피자/.test(s)) return "🍝";
  if (/횟집|회|해물|조개|장어|물회/.test(s)) return "🐟";
  if (/분식|김밥|떡볶이|만두|국수|칼국수/.test(s)) return "🍜";
  if (/카페|커피|디저트|베이커리|빵/.test(s)) return "☕";
  return "🍴";
};

// 맛집 화면이 오류 상태로 보이는 중에 앱으로 돌아오면 자동 재시도
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && viewStack[viewStack.length - 1] === "food" && !$("#food-note").hidden) {
    openFoodView();
  }
});

async function openFoodView() {
  const course = currentCourse;
  if (viewStack[viewStack.length - 1] !== "food") pushView("food");
  $("#food-title").textContent = tr("app.food.title");
  $("#food-desc").textContent = tr("app.food.desc", { course: dispName(course) });
  const listEl = $("#food-list");
  listEl.innerHTML = "";
  $("#food-note").hidden = true;

  const region = (course.addr || "").split(" ").slice(0, 2).join(" ");
  const alive = () => currentCourse === course && viewStack[viewStack.length - 1] === "food";

  // 🔴 일본 구장은 Google Places 로 간다 (설계 §3).
  //    카카오는 한국 POI 라 일본에서 사실상 빈 목록이고, OSM 은 사진·평점이 없다.
  //    아래 한국 경로(카카오→OSM)는 **한 줄도 건드리지 않는다** — KR 무변경 원칙.
  if (course.c === "JP" && typeof JPPACK !== "undefined") {
    const w = WAIT.open("food", { msgs: [tr("app.food.wait.find", { course: course.name })] });
    try {
      const list = await JPPACK.food(course);
      if (!alive()) { w.close(); return; }
      FOOD_VIEW.sort = "reco";
      FOOD_VIEW.cat = "전체";
      renderFoodList(list, region, true);
      staggerIn(listEl);
    } catch (e) {
      // 있는 척하지 않는다 — 왜 못 보여주는지 밝히고 다시 시도할 길을 준다
      listEl.innerHTML = "";
      const note = $("#food-note");
      note.innerHTML = tr("app.food.busy");
      const b = document.createElement("button");
      b.className = "retry-btn";
      b.textContent = tr("app.retry");
      b.addEventListener("click", () => openFoodView());
      note.appendChild(b);
      note.hidden = false;
    }
    w.close();
    return;
  }

  // 1순위: 카카오맵 등록 맛집 (평점·사진 제공)
  //
  // 예전에는 거리순으로 먼저 보여준 뒤 평점이 도착하면 추천순으로 다시 정렬했는데,
  // 목록이 눈앞에서 뒤바뀌는 게 거슬린다는 지적이 있었다(2026-07-27).
  // 이제는 찾기 → 평가 → 사진까지 다 끝내고 **한 번에** 추천순으로 보여준다.
  // 그동안 무엇을 하고 있는지는 대기 화면이 단계별로 말해준다.
  if (getKakaoKey()) {
    const findMsg = tr("app.food.wait.find", { course: course.name });
    const w = WAIT.open("food", { msgs: [findMsg] });
    try {
      w.say(findMsg, 12);
      const list = await fetchKakaoFood(course);
      if (!alive()) { w.close(); return; }

      if (list.length) {
        w.say(tr("app.food.wait.rate", { n: list.length }), 34);
        try { await attachFoodRatings(list); } catch (_) { /* 평점 없어도 목록은 보여준다 */ }
        if (!alive()) { w.close(); return; }

        // 오래 걸리는 구간 — 무슨 발품을 팔고 있는지 문구를 계속 바꿔가며 알려준다
        const STEPS = tr("app.food.steps").split(",");
        w.say(STEPS[0], 46);
        let shown = [];
        try {
          shown = await attachPhotos(list, "food", (d, t) => {
            const i = Math.min(STEPS.length - 1, Math.floor((d / t) * STEPS.length));
            w.say(`${STEPS[i]} (${d}/${t})`, 46 + Math.round((d / t) * 44));
          });
        } catch (_) { shown = []; }
        if (!alive()) { w.close(); return; }

        // 사진이 한 곳도 없으면 목록을 비우는 대신 이유를 밝힌다 (백엔드 장애일 수 있다)
        if (!shown.length) {
          listEl.innerHTML =
            `<p class="food-osm-empty">${tr("app.food.photo.fail")}</p>`;
          w.close();
          return;
        }

        w.say(tr("app.food.wait.sort"), 92);
        FOOD_VIEW.sort = "reco";
        FOOD_VIEW.cat = "전체";
        renderFoodList(shown, region, true);
        staggerIn(listEl);
        w.close();
        return;
      }
    } catch (e) {
      if (String(e.message).indexOf("kakao") === 0) console.warn("kakao food:", e.message);
    }
    w.close();
  }

  let data;
  try {
    data = await fetchFoodData(course);
  } catch {
    listEl.innerHTML = "";
    const note = $("#food-note");
    note.innerHTML = tr("app.food.busy");
    const b = document.createElement("button");
    b.className = "retry-btn";
    b.textContent = tr("app.retry");
    b.addEventListener("click", () => openFoodView());
    note.appendChild(b);
    note.hidden = false;
    return;
  }
  if (currentCourse !== course || viewStack[viewStack.length - 1] !== "food") return;
  $("#food-note").hidden = true;

  const now = Date.now();
  const items = (data.elements || [])
    .map((e) => {
      const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
      if (lat == null || !e.tags || !e.tags.name) return null;
      const t = e.tags;
      // 신뢰도 필터: 폐업 표시 제외, 오래 방치된 데이터 제외
      if (t["disused:amenity"] || t.disused === "yes" || /폐업|closed/i.test(t.name)) return null;
      const ageYears = e.timestamp ? (now - Date.parse(e.timestamp)) / 3.156e10 : 99;
      const verified = !!(t.phone || t["contact:phone"] || t.opening_hours || t.website);
      if (ageYears > 5 && !verified) return null; // 5년 넘게 확인 안 된 곳은 숨김
      return {
        name: t.name, tags: t, lat, lon, verified,
        dist: distM([course.lat, course.lon], [lat, lon]),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.verified - a.verified) || (a.dist - b.dist)) // 검증 정보 있는 곳 우선
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 25);

  const list = items.map((it) => {
    const [cuiKo] = cuisineInfo(it.tags.cuisine);
    return {
      name: it.name, cat: cuiKo,
      phone: it.tags.phone || it.tags["contact:phone"] || "",
      addr: it.tags["addr:full"] ||
        [it.tags["addr:city"], it.tags["addr:district"], it.tags["addr:street"], it.tags["addr:housenumber"]].filter(Boolean).join(" "),
      lat: it.lat, lon: it.lon, dist: Math.round(it.dist),
    };
  });
  renderFoodList(list, region, false);
}

/* 맛집 목록 렌더링 — 클릭하면 사진·전화·내비 (가까운 순) */
/* 맛집 목록 상태 — 기본은 '추천순'(카카오 평점·리뷰수 기반, 가게 ID라 정확).
   평점을 아직 못 받았거나 백엔드가 없으면 거리순으로 자연스럽게 동작한다. */
const FOOD_UI_V2 = true;   // 전면 펼침 카드. 예전 접이식으로 되돌리려면 false
const FOOD_VIEW = { sort: "reco", cat: "전체" };
const FOOD_CATS = [
  ["전체", null],
  ["한식", /한식|백반|국밥|찌개|한정식|해장|두부|칼국수|국수|분식/],
  ["고기", /고기|삼겹|갈비|곱창|족발|보쌈|오리|닭|치킨/],
  ["회·해물", /횟집|회|해물|조개|장어|물회|매운탕|일식|초밥|스시/],
  ["중식·양식", /중식|중국|짜장|짬뽕|양식|파스타|스테이크|피자|돈까스/],
  ["카페", /카페|커피|디저트|베이커리|빵/],
];

/* 백엔드에서 가게별 평점·리뷰수 일괄 조회 후 목록에 붙인다 (24시간 로컬 캐시) */
async function attachFoodRatings(list) {
  if (!window.RIW_BACKEND) return false;
  const ids = list.map((it) => (((it.url || "").match(/\/(\d+)\/?$/) || [])[1])).filter(Boolean);
  if (!ids.length) return false;
  const LS = "riweather.foodmeta3." + ids.slice(0, 5).join("_");
  let meta = null;
  try {
    const c = JSON.parse(localStorage.getItem(LS) || "null");
    if (c && Date.now() - c.t < 864e5 && c.d && typeof c.d === "object") meta = c.d;
  } catch (_) {}
  if (!meta) {
    try {
      // 백엔드(Apps Script)는 콜드스타트 시 오래 걸릴 수 있다 → 12초 상한.
      // 실패해도 목록은 이미 떠 있고 거리순으로 동작하므로 조용히 포기한다.
      const r = await fetchT(window.RIW_BACKEND + "?fn=placemeta&k=" + window.RIW_TOK() + "&ids=" + ids.join(","), null, 12000);
      meta = await r.json();
      if (!meta || typeof meta !== "object") return false;   // 'null' 응답을 캐시에 남기지 않는다
      try { localStorage.setItem(LS, JSON.stringify({ t: Date.now(), d: meta })); } catch (_) {}
    } catch (_) { return false; }
  }
  if (!meta || typeof meta !== "object") return false;   // 백엔드가 null·이상값을 줘도 안전
  let any = false;
  list.forEach((it) => {
    const id = (((it.url || "").match(/\/(\d+)\/?$/) || [])[1]);
    const m = (id && meta[id]) || null;
    it.rating = Number(m && m.r) || 0;    // 문자열 "4.5"가 와도 숫자로 (toFixed 오류 방지)
    it.reviews = Number(m && m.c) || 0;
    // 숙박: 카카오 예약하기에 올라온 객실·실판매가 (옛 백엔드는 안 준다 → undefined)
    it.rooms = Array.isArray(m && m.rooms) ? m.rooms : null;
    it.bookUrl = (m && m.bk) || "";
    if (it.rating > 0) any = true;
  });
  return any;
}

/* 추천 점수 — 리뷰가 적은 5점짜리보다 리뷰 많은 4점짜리가 위로 오도록 보정 */
function recoScore(it) {
  const r = it.rating || 0, c = it.reviews || 0;
  if (!c) return 0;
  return (r * c + 3.3 * 8) / (c + 8);
}

const foodThumb = (u) =>
  "https://img1.kakaocdn.net/cthumb/local/C176x176.q50/?fname=" + encodeURIComponent(u);
const foodPid = (it) => (((it.url || "").match(/\/(\d+)\/?$/) || [])[1]);

/* 서버가 주는 사진 = 카카오맵 '사진 탭'(가게 ID 기반 공식 사진첩) — 카카오 앱과 동일 소스.
   여기서는 형식 검증만 한다 (http 이미지 URL). */
const genuinePhotos = (arr) => (arr || []).filter((u) => typeof u === "string" && /^https?:\/\//.test(u));

/* 사진을 미리 다 받아 it.photos 에 담고, **사진 있는 곳만** 돌려준다.
 *
 * 사진 없이 이름만 있는 카드("카카오맵에서 사진 보기")는 오히려 신뢰를 깎는다는
 * 사장님 지적(2026-07-28). 우리는 이미지로 승부하므로 사진 없는 업체는 아예 뺀다.
 * 그래서 렌더 전에 전 목록의 사진 유무를 알아야 한다 — 상위 12곳만 미리 받던
 * 예전 방식으로는 판단이 불가능하다.
 *
 * kind: "stay" 면 숙박용 사진 정렬(업주 객실컷 우선)과 별도 캐시를 쓴다.
 * onProgress(done, total) 로 대기 화면에 진행률을 알려준다.
 */
async function attachPhotos(list, kind, onProgress) {
  const qs = kind === "stay" ? "&kind=stay" : "";
  const pre = kind === "stay" ? "riweather.stayph1." : "riweather.placeph5.";
  let done = 0;
  const one = async (it) => {
    const pid = it.id || foodPid(it);
    if (!pid) { it.photos = []; return; }
    const LS = pre + pid;
    try {
      const c = JSON.parse(localStorage.getItem(LS) || "null");
      if (c && Date.now() - c.t < 7 * 864e5) { it.photos = genuinePhotos(c.d); return; }
    } catch (_) {}
    if (!window.RIW_BACKEND) { it.photos = []; return; }
    try {
      const r = await fetchT(window.RIW_BACKEND + "?fn=placephotos&k=" + window.RIW_TOK() + "&id=" + pid + qs, null, 8000);
      const j = await r.json();
      it.photos = genuinePhotos(j.photos).slice(0, 10);
      // 숙박: '카카오 예약하기' 연동 여부. 옛 백엔드는 이 값을 안 주므로 null 이면 판단하지 않는다.
      it.vendor = (typeof j.vendor === "number") ? j.vendor : null;
      try {
        localStorage.setItem(LS, JSON.stringify({ t: Date.now(), d: it.photos, v: it.vendor }));
      } catch (_) {}
    } catch (_) { it.photos = []; }
  };
  // 동시 8개씩 — 한꺼번에 45개를 던지면 백엔드가 막힌다
  let i = 0;
  const worker = async () => {
    while (i < list.length) {
      const it = list[i++];
      await one(it);
      done++;
      if (onProgress && done % 5 === 0) onProgress(done, list.length);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));

  const withPhoto = list.filter((x) => (x.photos || []).length);
  // 첫 장들은 미리 받아둬야 목록이 뜰 때 사진이 이미 그려져 있다
  await Promise.race([
    Promise.all(withPhoto.slice(0, 12).map((it) => new Promise((res) => {
      const im = new Image();
      im.onload = im.onerror = res;
      im.src = foodThumb(it.photos[0]);
      setTimeout(res, 3000);
    }))),
    new Promise((res) => setTimeout(res, 6000)),
  ]);
  return withPhoto;
}

/* 일본 맛집 카드의 단추 — 한국 카드와 같은 밀도로 맞춘다(설계 §4-3-1, 사장님 지시).
   카카오내비·티맵·네이버는 일본에서 무의미하므로(D4) 자리별로 갈아끼운다:
     전화 · 내비2(구글맵 + Yahoo!카내비) · 가게정보 · 사진
   전화번호는 필드마스크에 nationalPhoneNumber 를 더해 받는다 —
   rating 이 이미 Enterprise SKU 라 **과금 등급이 오르지 않는다**(8/2 실측). */
function jpFoodActions(it) {
  const ja = typeof I18N !== "undefined" && I18N.lang === "ja";
  const tel = (it.phone || "").replace(/[^0-9+]/g, "");
  const nav = `https://www.google.com/maps/dir/?api=1&destination=${it.lat},${it.lon}`;
  let h = "";
  if (tel) h += `<a class="fa-btn fa-tel" href="tel:${tel}">${ja ? "📞 電話" : "📞 전화"}</a>`;
  h += `<a class="fa-btn fa-kakao" href="${nav}" target="_blank" rel="noopener">${
    ja ? "🧭 経路案内" : "🧭 길찾기"}</a>`;
  h += `<a class="fa-btn fa-tmap" href="${JPPACK.yahooNaviUrl(it.lat, it.lon, it.name)}">${
    ja ? "Yahoo!カーナビ" : "야후 카내비"}</a>`;
  if (it.mapUri)
    h += `<a class="fa-btn fa-naver" href="${it.mapUri}" target="_blank" rel="noopener">${
      ja ? "店舗ページ" : "가게 정보"}</a>`;
  /* 사진 버튼은 없앴다 — 사진은 카드 안에 바로 깔린다(bindJpFoodPhoto).
     버튼이 다섯 개면 폰 화면(375px)에서 한 칸이 58px 로 눌려 글자가 잘린다.
     실측: 経路案内 78px · Yahoo!カーナビ 95px · 店舗ページ 69px 가 필요했다. */
  return h;
}

/* 일본 맛집 사진 — 한국 화면과 똑같이 **카드 안에 바로** 깔린다.
 *
 * 전에는 '📷 写真(10)' 버튼을 눌러야 나왔고, 그것도 1장뿐이었다.
 * 게다가 버튼 다섯 개가 한 줄에 눌려 「写真 (」 로 잘려 있어서
 * 누를 수 있다는 것조차 보이지 않았다(2026-08-03 사장님 지적).
 *
 * 비용은 이렇게 지킨다 — Places 는 **사진 이름은 공짜로** 준다(검색 응답에 딸려 온다).
 * 돈이 드는 것은 **그림을 실제로 내려받을 때**뿐이다.
 *   ① 화면에 들어온 카드만 받는다(IntersectionObserver). 안 내려보면 안 받는다.
 *   ② 카드당 3장까지만 깐다. 나머지는 눌러서 크게 볼 때 받는다.
 *   ③ 한 번 받은 카드는 다시 안 받는다.
 * 목록을 열자마자 20곳 × 10장을 받으면 한 번에 200번 과금이다. 그 짓을 하지 않는다.
 */
const JP_FOOD_THUMBS = 3;
function bindJpFoodPhoto(it, div) {
  const box = div.querySelector(".fi-photos");
  const names = (it.photoNames && it.photoNames.length)
    ? it.photoNames : (it.photoName ? [it.photoName] : []);
  const btn = div.querySelector(".jp-photo");
  if (btn) btn.remove();                    // 이제 버튼 없이 바로 보여준다
  if (!box || !names.length) return;

  let done = false;
  const fill = () => {
    if (done) return;
    done = true;
    names.slice(0, JP_FOOD_THUMBS).forEach((nm, i) => {
      const img = document.createElement("img");
      img.src = JPPACK.photoUrl(nm, 400);
      img.alt = it.name;
      img.loading = "lazy";
      img.addEventListener("click", () => openLightbox(
        names.map((n) => ({ t: JPPACK.photoUrl(n, 400), u: JPPACK.photoUrl(n, 1200) })), i));
      img.addEventListener("error", () => img.remove());
      box.appendChild(img);
    });
    if (it.attrib) {
      const a = document.createElement("div");
      a.className = "fi-meta";
      a.textContent = "📷 " + it.attrib;      // 사진 제공자 표기 (Places 요구사항)
      box.appendChild(a);
    }
    box.hidden = false;
  };

  if (typeof IntersectionObserver !== "function") { fill(); return; }
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { fill(); io.disconnect(); }
  }, { rootMargin: "200px" });               // 조금 못 미쳐도 미리 받아 둔다
  io.observe(div);
}

function renderFoodList(list, region, fromKakao) {
  const listEl = $("#food-list");
  listEl.innerHTML = "";
  if (!list.length) {
    const p = document.createElement("p");
    p.className = "food-osm-empty";
    p.textContent = tr("app.food.empty");
    listEl.appendChild(p);
    return;
  }

  const hasRatings = list.some((it) => (it.rating || 0) > 0);
  if (FOOD_VIEW.sort === "reco" && !hasRatings) FOOD_VIEW.sort = "dist";

  // 🔴 일본 목록은 분류 칩을 달지 않는다.
  //    FOOD_CATS 는 한식·고기·회해물 같은 **한국 음식 분류**라 '스시/초밥집'·'이탈리아 음식점'
  //    같은 구글 분류에는 하나도 안 걸린다. 그대로 두면 칩을 누르는 순간 목록이 텅 빈다
  //    (조립 검증에서 잡았다). 없는 기능을 있는 척하느니 안 보여주는 편이 낫다.
  const isJP = list.some((it) => it.jp);
  if (isJP) FOOD_VIEW.cat = "전체";

  // 정렬·종류 선택 칩
  if (fromKakao) {
    const bar = document.createElement("div");
    bar.className = "food-filter";
    const sorts = hasRatings
      ? [["reco", tr("app.food.sort.reco")], ["dist", tr("app.food.sort.dist")]]
      : [["dist", tr("app.food.sort.dist")]];
    bar.innerHTML =
      `<div class="ff-row">` +
      sorts.map(([k, t]) =>
        `<button class="ff-chip${FOOD_VIEW.sort === k ? " on" : ""}" data-sort="${k}">${t}</button>`).join("") +
      `</div>` +
      (isJP ? "" : `<div class="ff-row">` +
      FOOD_CATS.map(([name]) =>
        `<button class="ff-chip sm${FOOD_VIEW.cat === name ? " on" : ""}" data-cat="${name}">${name}</button>`).join("") +
      `</div>`);
    bar.addEventListener("click", (e) => {
      const b = e.target.closest(".ff-chip");
      if (!b) return;
      if (b.dataset.sort) FOOD_VIEW.sort = b.dataset.sort;
      if (b.dataset.cat) FOOD_VIEW.cat = b.dataset.cat;
      renderFoodList(list, region, fromKakao);
    });
    listEl.appendChild(bar);
  }

  // 필터·정렬 적용
  let shown = list.slice();
  const catRe = (FOOD_CATS.find(([n]) => n === FOOD_VIEW.cat) || [])[1];
  if (catRe) shown = shown.filter((it) => catRe.test(it.cat || ""));
  if (FOOD_VIEW.sort === "reco" && hasRatings)
    shown.sort((a, b) => (recoScore(b) - recoScore(a)) || (a.dist - b.dist));
  else
    shown.sort((a, b) => a.dist - b.dist);

  const sub = document.createElement("p");
  sub.className = "food-osm-sub";
  // 🔴 일본 목록에 "카카오맵 평점 기준" 이라고 적으면 거짓말이다 — 구글 자료다.
  sub.textContent = isJP
    ? (typeof JPPACK !== "undefined" ? JPPACK.foodSub(FOOD_VIEW.sort) : "")
    : !fromKakao
      ? tr("app.food.sub.osm")
      : (FOOD_VIEW.sort === "reco"
          ? tr("app.food.sub.reco")
          : tr("app.food.sub.dist"));
  listEl.appendChild(sub);

  if (!shown.length) {
    const p = document.createElement("p");
    p.className = "food-osm-empty";
    p.textContent = tr("app.food.cat.empty");
    listEl.appendChild(p);
    return;
  }

  /* 사진 그리기 — attachPhotos() 가 이미 받아 둔 it.photos 만 쓴다.
     목록에 오른 곳은 사진이 있음이 보장되므로 "카카오맵에서 사진 보기" 대체 링크는 없앴다.
     (사진 없는 카드는 아예 목록에서 빠진다 — 2026-07-28) */
  async function loadFoodPhotos(it, photos) {
    if (!photos) return;
    const list = genuinePhotos(it.photos);
    photos.hidden = !list.length;
    if (!list.length) return;
    const imgs = list.map((u) => ({ t: foodThumb(u), u: u }));
    photos.innerHTML = imgs
      .map((im, k) => `<img src="${im.t}" data-k="${k}" alt="${it.name}" loading="lazy">`)
      .join("");
    photos.querySelectorAll("img").forEach((el) => {
      el.addEventListener("click", () => openLightbox(imgs, +el.dataset.k));
      el.addEventListener("error", () => el.remove());
    });
  }

  /* ── 새 카드(전면 펼침) — FOOD_UI_V2. 기존 접이식은 아래 else에 보존 ── */
  if (typeof FOOD_UI_V2 !== "undefined" && FOOD_UI_V2) {
    // 예전엔 IntersectionObserver 로 스크롤할 때 사진을 받아왔는데,
    // 이제 attachPhotos() 가 목록을 만들기 전에 전부 받아 두므로 바로 그리면 된다.
    // (관찰이 안 걸려 사진이 영영 안 뜨는 사고가 있었다 — 2026-07-28)
    // 실제 이미지 내려받기는 <img loading="lazy"> 가 알아서 미룬다.
    shown.forEach((it) => {
      const km = it.dist < 950 ? it.dist + "m" : (it.dist / 1000).toFixed(1) + "km";
      const tel = (it.phone || "").replace(/[^0-9+]/g, "");
      const div = document.createElement("div");
      div.className = "food-item v2";
      div.innerHTML = `
        <div class="fi-row">
          <span class="fi-emoji">${catEmoji(it.cat)}</span>
          <div style="flex:1;min-width:0">
            <div class="fi-name">${it.name}</div>
            <div class="fi-sub">${it.cat || tr("app.food.cat.default")}${it.rating > 0
              ? ` <span class="fi-star">⭐ ${it.rating.toFixed(1)} <em>(${it.reviews})</em></span>` : ""}</div>
          </div>
          <span class="fi-dist">${km}</span>
        </div>
        <div class="fi-photos" hidden></div>
        <div class="fi-meta">📍 ${it.addr || ""}</div>
        <div class="fi-actions">
          ${it.jp ? jpFoodActions(it) : `
          ${tel ? `<a class="fa-btn fa-tel" href="tel:${tel}">${tr("app.food.tel")}</a>` : ""}
          <a class="fa-btn fa-kakao" href="kakaomap://route?ep=${it.lat},${it.lon}&by=CAR">${tr("app.dist.nav.kakao")}</a>
          <a class="fa-btn fa-tmap" href="tmap://route?goalname=${encodeURIComponent(it.name)}&goaly=${it.lat}&goalx=${it.lon}">${tr("app.dist.nav.tmap")}</a>
          <a class="fa-btn fa-naver" href="https://m.search.naver.com/search.naver?query=${encodeURIComponent((region ? region + " " : "") + it.name)}" target="_blank" rel="noopener">${tr("app.food.naver.short")}</a>`}
        </div>`;
      div._it = it;
      if (it.jp) bindJpFoodPhoto(it, div);
      else loadFoodPhotos(it, div.querySelector(".fi-photos"));
      listEl.appendChild(div);
    });
    // 출처 표기 — 어디서 온 자료인지 밝힌다
    if (shown.some((it) => it.jp) && typeof JPPACK !== "undefined") {
      const c = document.createElement("p");
      c.className = "food-osm-sub";
      c.style.marginTop = "10px";
      c.textContent = JPPACK.foodCredit();
      listEl.appendChild(c);
    }
    return;
  }

  shown.forEach((it) => {
    const km = it.dist < 950 ? it.dist + "m" : (it.dist / 1000).toFixed(1) + "km";
    const tel = (it.phone || "").replace(/[^0-9+]/g, "");
    const div = document.createElement("div");
    div.className = "food-item";
    div.innerHTML = `
      <div class="fi-row">
        <span class="fi-emoji">${catEmoji(it.cat)}</span>
        <div style="flex:1;min-width:0">
          <div class="fi-name">${it.name}</div>
          <div class="fi-sub">${it.cat || tr("app.food.cat.default")}${it.rating > 0
            ? ` <span class="fi-star">⭐ ${it.rating.toFixed(1)} <em>(${it.reviews})</em></span>` : ""}</div>
        </div>
        <span class="fi-dist">${km}</span>
      </div>
      <div class="fi-detail">
        <div class="fi-photos" hidden></div>
        <div class="fi-addr">${it.addr ? "📍 " + it.addr + " " : ""}<span class="fi-addr-dist">${tr("app.food.fromcourse", { km: km })}</span></div>
        ${tel ? `<a class="fi-phone" href="tel:${tel}">${tr("app.food.phone", { phone: it.phone })}</a>` : ""}
        <div class="fi-links">
          <a class="kakaonavi" href="kakaomap://route?ep=${it.lat},${it.lon}&by=CAR">${tr("app.food.nav.kakao")}</a>
          <a class="tmapnavi" href="tmap://route?goalname=${encodeURIComponent(it.name)}&goaly=${it.lat}&goalx=${it.lon}">${tr("app.food.nav.tmap")}</a>
        </div>
        <a class="fi-naver" href="https://m.search.naver.com/search.naver?query=${encodeURIComponent((region ? region + " " : "") + it.name)}"
           target="_blank" rel="noopener">${tr("app.food.naver")}</a>
      </div>`;
    /* 사진 원칙: '그 가게' 사진임이 보장될 때만 앱 안에 표시한다.
       ① 백엔드가 연결돼 있으면 — 카카오 플레이스(가게 ID 기반) 등록 사진을 가져와 표시.
          이미지 검색이 아니라 가게 ID 조회라 다른 가게 사진이 섞일 수 없다.
       ② 백엔드가 없거나 실패하면 — 카카오맵 페이지 버튼으로 대체 (추측 사진 금지). */
    const photos = div.querySelector(".fi-photos");
    const placeBtn = () => {
      photos.innerHTML = it.url
        ? `<a class="fi-place-btn" href="${it.url}" target="_blank" rel="noopener">${tr("app.food.placebtn")}</a>`
        : "";
    };
    let loaded = false;
    div.querySelector(".fi-row").addEventListener("click", async () => {
      div.classList.toggle("open");
      if (!div.classList.contains("open") || loaded) return;
      loaded = true;
      photos.hidden = false;
      const pid = ((it.url || "").match(/\/(\d+)\/?$/) || [])[1];
      if (!window.RIW_BACKEND || !pid) { placeBtn(); return; }
      photos.innerHTML = `<div class="fi-photo-loading">${tr("app.food.photo.loading")}</div>`;
      try {
        const LS = "riweather.placeph5." + pid;
        let list = null;
        try {
          const c = JSON.parse(localStorage.getItem(LS) || "null");
          if (c && Date.now() - c.t < 7 * 864e5) list = c.d;
        } catch (_) {}
        if (!list) {
          const r = await fetchT(window.RIW_BACKEND + "?fn=placephotos&k=" + window.RIW_TOK() + "&id=" + pid, null, 10000);
          list = genuinePhotos((await r.json()).photos).slice(0, 10);
          try { localStorage.setItem(LS, JSON.stringify({ t: Date.now(), d: list })); } catch (_) {}
        }
        list = genuinePhotos(list);          // 캐시에 남은 옛 데이터도 한 번 더 거른다
        if (!list.length) { placeBtn(); return; }
        // 카카오 썸네일 서버는 정해진 규격(C176x176.q50)만 허용한다 — 다른 크기는 거부됨
        const imgs = list.map((u) => ({ t: foodThumb(u), u: u }));
        photos.innerHTML = imgs
          .map((im, k) => `<img src="${im.t}" data-k="${k}" alt="${it.name}" loading="lazy">`)
          .join("");
        photos.querySelectorAll("img").forEach((el) => {
          el.addEventListener("click", () => openLightbox(imgs, +el.dataset.k));
          el.addEventListener("error", () => { el.remove(); if (!photos.querySelector("img")) placeBtn(); });
        });
      } catch (_) { placeBtn(); }
    });
    listEl.appendChild(div);
  });
}

/* =========================================================
 * MY스코어 — 라운딩 기록 + 그날 날씨 자동 저장
 * ========================================================= */
const SCORE_KEY = "riweather.scores.v1";
const GOAL_KEY = "riweather.goalhandi.v1";
const loadScores = () => { try { return JSON.parse(localStorage.getItem(SCORE_KEY)) || []; } catch { return []; } };
const saveScores = (l) => {
  localStorage.setItem(SCORE_KEY, JSON.stringify(l));
  if (typeof BACKUP !== "undefined") BACKUP.touch();
};

let editingId = null;       // 수정 중인 기록 id
let selectedYear = "전체";
let photoThumb = null;      // 첨부 사진 (압축본)
let parsedPars = null;      // 사진에서 인식된 홀별 파 (스코어판 표시용)

/* DB에 없는 구장 직접 등록 (공식 주소 기준 좌표) */
const EXTRA_CLUBS = [
  { n: "자유로CC",      lat: 38.0042, lon: 126.9520, c: "KR" },
  { n: "포천 힐마루CC", lat: 37.9896, lon: 127.2252, c: "KR", a: "Hillmaru" },
  { n: "푸른솔포천GC",  lat: 37.9688, lon: 127.1692, c: "KR", a: "Purunsol" },
  { n: "라싸CC",        lat: 38.0388, lon: 127.3659, c: "KR", a: "Lassa" },
  { n: "클럽72",        lat: 37.4795, lon: 126.4702, c: "KR", a: "Club72" },
];
if (typeof GOLF_DB !== "undefined") GOLF_DB.push(...EXTRA_CLUBS);

/* 전용 코스명 DB — 확인된 구장은 여기서 우선 조회 (공식 정보 기준) */
const CLUB_COURSES = [
  { match: "파주cc",   lat: 37.8431, lon: 126.9040, courses: ["EAST", "WEST"] },
  { match: "타이거",   lat: 37.9240, lon: 126.8920, courses: ["가온", "누리"] },
  { match: "필로스",   lat: 37.9382, lon: 127.3312, courses: ["동", "서", "남"] },
  { match: "스카이72", lat: 37.4514, lon: 126.4824, courses: ["하늘", "오션", "레이크", "클래식"] },
  { match: "클럽72",   lat: 37.4795, lon: 126.4702, courses: ["오션", "레이크", "클래식", "하늘"] },
  { match: "자유로",   lat: 38.0042, lon: 126.9520, courses: ["대한", "민국", "통일"] },
  { match: "힐마루",   lat: 37.9896, lon: 127.2252, courses: ["시그니처A", "시그니처B", "브리즈", "선샤인", "네스트"] },
  { match: "푸른솔",   lat: 37.9688, lon: 127.1692, courses: ["마운틴", "레이크", "밸리"] },
  { match: "라싸",     lat: 38.0388, lon: 127.3659, courses: ["레이크", "밸리", "마운틴"] },
  { match: "몽베르",   lat: 38.0826, lon: 127.3061, courses: ["망무봉 OUT", "망무봉 IN", "쁘렝땅", "에떼", "오똔", "이베르"] },
];

/* 선택한 골프장 주변(3km)의 DB 항목에서 코스명(하늘/바다/EAST...)을 자동 추출 */
function findCourseNames(course) {
  if (!course) return [];
  // 1) 전용 DB 우선 (이름 일치 또는 3km 이내)
  const nc = normName(course.name || "");
  for (const c of CLUB_COURSES) {
    if (nc.includes(c.match) || distM([c.lat, c.lon], [course.lat, course.lon]) < 3000) {
      return [...c.courses];
    }
  }
  if (typeof GOLF_DB === "undefined") return [];
  const names = new Set();
  const myPrefix = normName(course.name).slice(0, 3);
  for (const g of GOLF_DB) {
    if (Math.abs(g.lat - course.lat) > 0.06 || Math.abs(g.lon - course.lon) > 0.08) continue;
    const d = distM([g.lat, g.lon], [course.lat, course.lon]);
    // 1.5km 이내면 같은 구장으로 간주, 6km까지는 이름 앞부분이 같아야 인정
    const samePrefix = myPrefix.length >= 2 && normName(g.k || g.n).startsWith(myPrefix);
    if (d > 6000 || (d > 1500 && !samePrefix)) continue;
    const nm = (g.k || g.n).replace(/\s*\(.*?\)\s*/g, " ");
    const m = nm.match(/([가-힣A-Za-z0-9]{1,10})\s*코스\s*$/);
    if (m && !/^(골프|퍼블릭|골프장)$/.test(m[1])) names.add(m[1]);
  }
  return [...names];
}

let courseNameList = [];

function renderCourseNameChips() {
  const box = $("#course-name-chips");
  const dl = $("#course-names-dl");
  box.hidden = true; box.innerHTML = ""; dl.innerHTML = "";
  courseNameList = findCourseNames(currentCourse);
  courseNameList.forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n;
    dl.appendChild(opt);
  });
  setupCourseSelects();
}

/* 코스명이 2개면(18홀) 전반·후반 자동 입력, 3개 이상이면(27·36홀) 선택 목록 표시 */
function setupCourseSelects() {
  const names = courseNameList;
  [["#sf-front-sel", "#sf-front"], ["#sf-back-sel", "#sf-back"]].forEach(([selId, inpId], idx) => {
    const sel = $(selId), inp = $(inpId);
    if (names.length >= 2) {
      sel.innerHTML =
        `<option value="">${tr("app.score.course.pick")}</option>` +
        names.map((n) => `<option value="${n}">${n}</option>`).join("") +
        `<option value="__direct">${tr("app.score.course.direct")}</option>`;
      sel.hidden = false; inp.hidden = true;
      if (names.length === 2) { sel.value = names[idx]; inp.value = names[idx]; } // 18홀: 자동 입력
      sel.onchange = () => {
        if (sel.value === "__direct") {
          sel.hidden = true; inp.hidden = false; inp.value = ""; inp.focus();
        } else {
          inp.value = sel.value;
        }
      };
    } else {
      sel.hidden = true; inp.hidden = false;
      if (!inp.value) inp.value = idx === 0 ? "전반" : "후반"; // 코스명 미확인 시 기본값
    }
  });
}

/* 입력값(수정/AI인식)을 선택 목록 UI에 반영 */
function syncCourseSelectUI() {
  [["#sf-front-sel", "#sf-front"], ["#sf-back-sel", "#sf-back"]].forEach(([selId, inpId]) => {
    const sel = $(selId), inp = $(inpId);
    if (sel.hidden && courseNameList.length >= 2 && !inp.value) return;
    if (courseNameList.length < 2) return;
    if (inp.value && courseNameList.includes(inp.value)) {
      sel.value = inp.value; sel.hidden = false; inp.hidden = true;
    } else if (inp.value) {
      sel.hidden = true; inp.hidden = false; // 목록에 없는 값 → 직접 입력 표시
    }
  });
}

function openScoreView() {
  pushView("score");
  resetScoreForm();
  $("#score-form").hidden = true;
  renderScores();
}
function resetScoreForm() {
  editingId = null;
  photoThumb = null;
  parsedPars = null;
  $("#sf-title").textContent = tr("app.score.form.add");
  $("#sf-date").value = new Date().toISOString().slice(0, 10);
  $("#sf-time").value = ""; $("#sf-time-unknown").checked = false; $("#sf-time").disabled = false;
  $("#sf-course").value = currentCourse ? currentCourse.name : "";
  $("#sf-score").value = ""; $("#sf-memo").value = "";
  $("#sf-front").value = ""; $("#sf-back").value = "";
  // 티 기본값: 남성=화이트, 여성=레이디 (최초 1회 선택)
  const defTee = localStorage.getItem("riweather.defaultTee");
  $("#sf-tee").value = defTee || "화이트";
  $("#tee-default").hidden = !!defTee;
  ["#sf-f1", "#sf-f2", "#sf-f3", "#sf-f4"].forEach((s) => { $(s).value = ""; });
  holeInputs.forEach((i) => { i.value = ""; });
  $("#holes-grid").hidden = true; $("#hg-sum").textContent = "";
  $("#sf-photo-preview").hidden = true;
  $("#sf-photo").value = "";
  $("#ocr-status").hidden = true; $("#ocr-chips").hidden = true;
  renderCourseNameChips();
}
$("#score-add-btn").addEventListener("click", () => {
  const f = $("#score-form");
  if (f.hidden) { resetScoreForm(); f.hidden = false; }
  else f.hidden = true;
});
$("#sf-cancel").addEventListener("click", () => { $("#score-form").hidden = true; });
$("#sf-time-unknown").addEventListener("change", (e) => {
  $("#sf-time").disabled = e.target.checked;
  if (e.target.checked) $("#sf-time").value = "";
});

/* 정밀 인식(비전 AI) 키 설정 */
function refreshAiKeyBtn() {
  const btn = $("#ai-key-btn");
  const personal = !!localStorage.getItem(GEM_KEY);
  btn.textContent = personal ? tr("app.score.aikey.mine") : tr("app.score.aikey");
  btn.style.color = "var(--primary)";
  btn.style.borderColor = "var(--primary)";
}
$("#ai-key-btn").addEventListener("click", () => {
  const cur = localStorage.getItem(GEM_KEY) || "";
  const v = prompt(tr("app.score.aikey.prompt"), cur);
  if (v === null) return;
  const t = v.trim();
  if (t) localStorage.setItem(GEM_KEY, t);
  else localStorage.removeItem(GEM_KEY);
  refreshAiKeyBtn();
});
refreshAiKeyBtn();

/* 기본 티 최초 설정 (남성=화이트 / 여성=레이디) */
document.querySelectorAll("#tee-default .ocr-chip").forEach((b) => {
  b.addEventListener("click", () => {
    localStorage.setItem("riweather.defaultTee", b.dataset.tee);
    $("#sf-tee").value = b.dataset.tee;
    $("#tee-default").hidden = true;
  });
});

/* ---------- 홀별 스코어 입력 (파 대비) ---------- */
const holeInputs = [];
["#hg-front", "#hg-back"].forEach((sel, half) => {
  const row = $(sel);
  for (let i = 0; i < 9; i++) {
    const inp = document.createElement("input");
    inp.type = "number"; inp.step = "1"; inp.min = "-4"; inp.max = "9";
    inp.placeholder = String(half * 9 + i + 1);
    inp.addEventListener("input", updateHoleSum);
    row.appendChild(inp);
    holeInputs.push(inp);
  }
});
$("#holes-toggle").addEventListener("click", () => {
  $("#holes-grid").hidden = !$("#holes-grid").hidden;
});
const holeVals = () => holeInputs.map((i) => (i.value === "" ? null : parseInt(i.value)));
function updateHoleSum() {
  const v = holeVals();
  if (!v.some((x) => x !== null)) { $("#hg-sum").textContent = ""; return; }
  const sum = (a) => a.reduce((s, x) => s + (x || 0), 0);
  const f = sum(v.slice(0, 9)), b = sum(v.slice(9));
  $("#sf-score").value = 72 + f + b;
  $("#hg-sum").textContent =
    tr("app.score.holesum", { f: 36 + f, b: 36 + b, t: 72 + f + b });
}

/* ---------- 스코어보드 사진 AI 인식 ---------- */
let ocrWorkerP = null;
function getOcrWorker() {
  if (!ocrWorkerP) {
    ocrWorkerP = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js";
      s.onload = () => resolve(Tesseract.createWorker("kor+eng")); // 골프장명(한글)까지 인식
      s.onerror = reject;
      document.head.appendChild(s);
    }).then((p) => p);
  }
  return ocrWorkerP;
}

/* OCR용 이미지 전처리 3종: 일반 대비, 흰 글자용(반전), 진한 글자용
   — 사진 배경 위 흰 글씨(스마트스코어 캡처)와 박스 속 검은 숫자를 모두 커버 */
function ocrVariants(img) {
  const scale = Math.min(2.2, 2000 / img.width); // 해상도 상향 (실사진 작은 숫자 대응)
  const W = Math.round(img.width * scale), H = Math.round(img.height * scale);
  const base = document.createElement("canvas");
  base.width = W; base.height = H;
  base.getContext("2d").drawImage(img, 0, 0, W, H);
  const src = base.getContext("2d").getImageData(0, 0, W, H);

  // Otsu 자동 임계값: 사진마다 밝기가 달라도 최적 이진화 지점을 계산
  const hist = new Array(256).fill(0);
  for (let i = 0; i < src.data.length; i += 16) { // 1/4 샘플링
    hist[Math.round(src.data[i] * 0.3 + src.data[i + 1] * 0.59 + src.data[i + 2] * 0.11)]++;
  }
  const totalPx = hist.reduce((s, v) => s + v, 0);
  let sumAll = 0; for (let t = 0; t < 256; t++) sumAll += t * hist[t];
  let sumB = 0, wB = 0, otsu = 128, maxVar = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = totalPx - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sumAll - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > maxVar) { maxVar = v; otsu = t; }
  }

  const make = (fn) => {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const d = new ImageData(new Uint8ClampedArray(src.data), W, H);
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const g = p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11;
      const v = fn(g);
      p[i] = p[i + 1] = p[i + 2] = v;
    }
    c.getContext("2d").putImageData(d, 0, 0);
    return c;
  };
  return [
    make((g) => Math.max(0, Math.min(255, (g - 128) * 1.6 + 140))), // 일반 대비 강화
    make((g) => (g < otsu ? 0 : 255)),                               // Otsu 이진화 (표 숫자)
    make((g) => (g > 238 ? 0 : 255)),                                // 흰 글자 → 검정
  ];
}

/* ---------- 정밀 AI 인식 (Google Gemini 비전, 무료 키) ---------- */
async function geminiRecognize(dataUrl) {
  const key = getGemKey();
  if (!key) return null;
  const b64 = dataUrl.split(",")[1];
  const prompt = `골프 스코어보드 사진입니다. 아래 JSON 형식으로만 답하세요(설명·마크다운 금지):
{"date":"YYYY-MM-DD 또는 null","teeTime":"HH:MM(24시간) 또는 null","club":"골프장명 또는 null","front":"전반 코스명 또는 null","back":"후반 코스명 또는 null","tee":"화이트|레드|블루|블랙|레이디 또는 null","companions":["본인 외 동반자 이름들"],"pars":[홀별 파(3~5) 배열, 표에 보일 때만] 또는 null,"players":[{"name":"이름","total":합계숫자,"holes":[홀별 파 대비 상대타수 숫자 배열]}]}
규칙: 공유카드(1명)면 players 1명, 카트 태블릿(여러 명)이면 전원 포함. holes는 -1=버디, 0=파, 1=보기 형식으로 표에 보이는 순서대로. 확실하지 않은 값은 null.`;
  const body = {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: b64 } }] }],
    generationConfig: { temperature: 0 },
  };
  // 모델은 시기에 따라 바뀌므로 최신 별칭 순으로 시도
  const models = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.0-flash"];
  let lastErr = null;
  for (const model of models) {
    try {
      const r = await fetchT(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` + encodeURIComponent(key),
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, 20000);
      if (!r.ok) { lastErr = new Error("HTTP " + r.status); continue; }
      const j = await r.json();
      const txt = j.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      lastErr = new Error("응답 형식 오류");
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("gemini fail");
}

/* 정밀 AI 결과를 폼에 적용 */
function applyGeminiResult(g) {
  const filled = [];
  if (g.date && /^\d{4}-\d{2}-\d{2}$/.test(g.date)) { $("#sf-date").value = g.date; filled.push(tr("app.ocr.f.date")); }
  if (g.teeTime && /^\d{1,2}:\d{2}$/.test(g.teeTime)) {
    $("#sf-time").value = g.teeTime.padStart(5, "0");
    $("#sf-time-unknown").checked = false; $("#sf-time").disabled = false;
    filled.push(tr("app.ocr.f.teetime"));
  }
  if (g.club) {
    const hit = searchGolfDB(g.club);
    $("#sf-course").value = hit.length ? (hit[0].k || hit[0].n) : g.club;
    filled.push(tr("app.ocr.f.club"));
  }
  if (g.front) $("#sf-front").value = g.front;
  if (g.back) $("#sf-back").value = g.back;
  if (g.front || g.back) filled.push(tr("app.ocr.f.course"));
  if (g.tee) { $("#sf-tee").value = g.tee; filled.push(tr("app.ocr.f.tee")); }
  if (Array.isArray(g.companions) && g.companions.length) {
    g.companions.slice(0, 4).forEach((n, i) => { $("#sf-f" + (i + 1)).value = String(n); });
    filled.push(tr("app.ocr.f.friends"));
  }
  if (Array.isArray(g.pars) && g.pars.length >= 9) {
    parsedPars = g.pars.slice(0, 18).filter((p) => p >= 3 && p <= 6);
  }
  let cartPlayers = null;
  const ps = (g.players || []).filter((p) => p && typeof p.total === "number");
  if (ps.length > 1) {
    cartPlayers = ps.map((p) => ({
      name: p.name || "?", total: p.total,
      holes: (Array.isArray(p.holes) ? p.holes : []).slice(0, 18).map((v) => (typeof v === "number" ? v : null)),
    }));
  } else if (ps.length === 1) {
    const p = ps[0];
    if (Array.isArray(p.holes) && p.holes.length >= 9) {
      holeInputs.forEach((h, i) => { h.value = i < p.holes.length && typeof p.holes[i] === "number" ? p.holes[i] : ""; });
      $("#holes-grid").hidden = false;
      if (p.holes.length >= 18) updateHoleSum();
      else { $("#sf-score").value = p.total; $("#hg-sum").textContent = tr("app.score.holesum.part", { n: p.holes.length, t: p.total }); }
      filled.push(tr("app.ocr.f.holes"));
    }
    if (p.total) { $("#sf-score").value = p.total; filled.push(tr("app.ocr.f.total", { n: p.total })); }
  }
  syncCourseSelectUI();
  return { filled, cartPlayers };
}

/* 여러 명 인식 시 본인 선택 칩 (기본·정밀 인식 공용) */
function renderCartChips(cartPlayers) {
  const chips = $("#ocr-chips");
  chips.innerHTML = `<span class="chip-label">${tr("app.ocr.chip.players")}</span>`;
  cartPlayers.forEach((p) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ocr-chip";
    b.textContent = tr("app.ocr.chip.player", { name: p.name, total: p.total });
    b.addEventListener("click", () => {
      holeInputs.forEach((h, i) => {
        h.value = i < p.holes.length && p.holes[i] != null ? p.holes[i] : "";
      });
      $("#holes-grid").hidden = false;
      $("#sf-score").value = p.total;
      const nFilled = p.holes.filter((v) => v != null).length;
      $("#hg-sum").textContent = nFilled < 18
        ? tr("app.score.holesum.part", { n: nFilled, t: p.total }) : "";
      [1, 2, 3, 4].forEach((i) => { $("#sf-f" + i).value = ""; });
      cartPlayers.filter((x) => x !== p).slice(0, 4)
        .forEach((x, i) => { $("#sf-f" + (i + 1)).value = x.name; });
      chips.querySelectorAll(".ocr-chip").forEach((c) => c.classList.remove("active"));
      b.classList.add("active");
    });
    chips.appendChild(b);
  });
  chips.hidden = false;
}

/* 범용 정밀 AI 텍스트 생성 (AI 캐디 등) */
/* opts.maxTokens    — 출력 상한.
     ⚠️ 이 상한에는 **모델의 '생각' 토큰이 함께 잡힌다.** 짧은 답이라고 512 같은 값을 주면
     생각하다 한도를 다 써서 **답이 문장 중간에 잘린다**(2026-07-29 실측으로 확인).
     캐디 멘트는 출력이 100토큰 남짓이지만 생각이 1,000~2,000 나오므로 3072 로 잡는다.
   opts.lowThinking — 생각을 줄인다. 지연의 대부분이 여기서 나온다(실측: 생각 1,900 → 900,
     11~18초 → 7초대). 캐디 멘트처럼 짧은 답에는 이 정도면 충분하다.
     ⚠️ 항목 이름·값이 판마다 다르다. `thinkingBudget`·소문자 `low`·generationConfig 최상위는
     전부 400 이고, **thinkingConfig.thinkingLevel = "LOW"(대문자)만** 통했다.
     lite 계열은 이 항목 자체를 모르므로(400) 그때는 빼고 한 번 더 보낸다. */
async function geminiGenerate(parts, temperature = 0.3, opts = {}) {
  const key = getGemKey();
  if (!key) throw new Error("no key");
  const cfg = { temperature };
  if (opts.maxTokens) cfg.maxOutputTokens = opts.maxTokens;
  // lite 를 앞에 둔다(2026-08-02) — 번역 배치가 flash 하루 한도를 먹어 캐디가 같이
  // 막힌 사고가 있었다. lite 는 한도가 따로고, 캐디 멘트 품질은 lite 로 충분한 것을
  // 일본어 번역 268문장으로 확인했다(투어리스트_3 창 실측). flash 는 예비로 남긴다.
  const models = ["gemini-flash-lite-latest", "gemini-flash-latest"];
  let lastErr = null;
  for (const model of models) {
    // 1차: 생각 줄이기 포함 / 2차: 거부당하면 그 항목만 빼고 재시도
    const tries = opts.lowThinking ? [{ ...cfg, thinkingConfig: { thinkingLevel: "LOW" } }, cfg] : [cfg];
    for (const generationConfig of tries) {
      try {
        const r = await fetchT(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` + encodeURIComponent(key),
          { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts }], generationConfig }) }, 20000);
        if (!r.ok) {
          lastErr = new Error("HTTP " + r.status);
          if (r.status === 400 && generationConfig.thinkingConfig) continue;  // 이 판은 생각 끄기를 모른다
          break;                                                             // 그 외 오류는 다음 모델로
        }
        const j = await r.json();
        const t = j.candidates?.[0]?.content?.parts?.[0]?.text;
        if (t) return t;
        lastErr = new Error("빈 응답");
        break;
      } catch (e) { lastErr = e; break; }
    }
  }
  throw lastErr || new Error("gemini fail");
}

/* 사진 상단 띠(동반자·날짜·시간 영역)만 잘라 3배 확대 — 흰 글자 정밀 인식용 */
function topStripVariants(img) {
  const W = img.width, H = img.height;
  const stripH = Math.round(H * 0.17);
  const scale = Math.min(3, 2200 / W);
  const base = document.createElement("canvas");
  base.width = Math.round(W * scale); base.height = Math.round(stripH * scale);
  base.getContext("2d").drawImage(img, 0, 0, W, stripH, 0, 0, base.width, base.height);
  const src = base.getContext("2d").getImageData(0, 0, base.width, base.height);
  // 스트립 내 밝은 글자 임계값 (상위 밝기 클러스터)
  let maxG = 0;
  for (let i = 0; i < src.data.length; i += 16) {
    const g = src.data[i] * 0.3 + src.data[i + 1] * 0.59 + src.data[i + 2] * 0.11;
    if (g > maxG) maxG = g;
  }
  const th = Math.max(200, maxG - 45);
  const make = (fn, despeckle) => {
    const c = document.createElement("canvas");
    c.width = base.width; c.height = base.height;
    const d = new ImageData(new Uint8ClampedArray(src.data), base.width, base.height);
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const g = p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11;
      const v = fn(g);
      p[i] = p[i + 1] = p[i + 2] = v;
    }
    if (despeckle) {
      // 고립된 검은 점(반사광·노이즈) 제거 — 2회 반복으로 작은 덩어리까지 정리
      const Wp = base.width, Hp = base.height;
      for (let pass = 0; pass < 2; pass++) {
        const isBlack = new Uint8Array(Wp * Hp);
        for (let i = 0; i < Wp * Hp; i++) isBlack[i] = p[i * 4] < 128 ? 1 : 0;
        for (let y = 1; y < Hp - 1; y++) {
          for (let x = 1; x < Wp - 1; x++) {
            const i = y * Wp + x;
            if (!isBlack[i]) continue;
            const n = isBlack[i - 1] + isBlack[i + 1] + isBlack[i - Wp] + isBlack[i + Wp] +
                      isBlack[i - Wp - 1] + isBlack[i - Wp + 1] + isBlack[i + Wp - 1] + isBlack[i + Wp + 1];
            if (n < 3) { const j = i * 4; p[j] = p[j + 1] = p[j + 2] = 255; }
          }
        }
      }
    }
    c.getContext("2d").putImageData(d, 0, 0);
    return c;
  };
  return [
    make((g) => (g > th ? 0 : 255), true),                            // 밝은 글자 → 검정 + 점 제거
    make((g) => Math.max(0, Math.min(255, (g - 128) * 1.8 + 150))),   // 대비 강화
  ];
}

/* OCR 텍스트에서 날짜·시간·골프장·스코어를 추출해 폼에 자동 입력 */
function autofillFromOcr(text) {
  const filled = [];
  const textLines = text.split("\n");
  const dateRe = /(20\d{2})[.,\-\/년\s]{1,3}(\d{1,2})[.,\-\/월\s]{1,3}(\d{1,2})/;
  const timeRe = /([01]?\d|2[0-3])\s?:\s?([0-5]\d)/;

  let dateLineIdx = -1, dm = null;
  for (let i = 0; i < textLines.length; i++) {
    const m = textLines[i].match(dateRe);
    if (m) { dm = m; dateLineIdx = i; break; }
    // OCR이 구분점을 숫자로 붙여 읽은 경우: "2026.07416" → 07/16 복원
    const b = textLines[i].match(/(20\d{2})\D{0,2}(\d{4,5})(?=\D|$)/);
    if (b) {
      const digits = b[2];
      const mm = digits.slice(0, 2), dd = digits.slice(-2);
      if (+mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31) {
        dm = [null, b[1], mm, dd]; dateLineIdx = i; break;
      }
    }
  }
  if (dm) {
    $("#sf-date").value = `${dm[1]}-${dm[2].padStart(2, "0")}-${dm[3].padStart(2, "0")}`;
    filled.push(tr("app.ocr.f.date"));
  }
  // 티업시간: 날짜와 같은/인접 줄의 시간만 우선 인정 (상태바 시계 오인 방지)
  let tm = null;
  if (dateLineIdx >= 0) {
    for (const j of [dateLineIdx, dateLineIdx + 1, dateLineIdx - 1]) {
      const m = (textLines[j] || "").match(timeRe);
      if (m) { tm = m; break; }
    }
  }
  if (!tm) {
    for (let i = 2; i < textLines.length; i++) { // 첫 두 줄(상태바 영역) 제외
      const m = textLines[i].match(timeRe);
      if (m && +m[1] >= 5 && +m[1] <= 21) { tm = m; break; }
    }
  }
  if (tm) {
    $("#sf-time").value = `${tm[1].padStart(2, "0")}:${tm[2]}`;
    $("#sf-time-unknown").checked = false; $("#sf-time").disabled = false;
    filled.push(tr("app.ocr.f.teetime"));
  }

  // ---- 카트 태블릿(스마트스코어) 사진 감지: "4/8 5/3 3/7..." 파 행이 있으면 표 형식 파싱 ----
  // 다중 인식본 중 가장 온전하게 읽힌 파 행 선택
  let parLineIdx = -1, parBest = 0;
  textLines.forEach((l, i) => {
    const c = (l.match(/\d\s*\/\s*\d/g) || []).length;
    if (c > parBest) { parBest = c; parLineIdx = i; }
  });
  if (parBest >= 5) {
    const pars = (textLines[parLineIdx].match(/(\d)\s*\/\s*\d/g) || []).map((s) => parseInt(s));
    const parTotal9 = pars.length === 9 ? pars.reduce((s, v) => s + v, 0) : 36;
    const players = [];
    for (const line of textLines) {
      const nm = line.match(/^[^가-힣\n]{0,4}([가-힣]{2,4})[^\d\-]*(-?\d.*)$/);
      if (!nm || /번호입력|스코어|리더보드|홀맵/.test(line)) continue;
      const nums = (nm[2].match(/-?\d+/g) || []).map(Number);
      if (nums.length < 5) continue;
      // 열 구성이 (전반/후반/합계) 또는 (전반/합계)로 달라짐 → 둘 다 시도해 검증 통과하는 쪽 채택
      const L = nums.length;
      const attempts = [
        { holes: nums.slice(0, L - 3), front: nums[L - 3], back: nums[L - 2], total: nums[L - 1] },
        { holes: nums.slice(0, L - 2), front: nums[L - 2], back: 0, total: nums[L - 1] },
      ];
      for (const a of attempts) {
        if (a.total < 27 || a.total > 160) continue;
        const holes = a.holes.filter((n) => n >= -4 && n <= 9).slice(0, 9);
        if (!holes.length) continue;
        const hs = holes.reduce((s, v) => s + v, 0);
        const playedPar = pars.slice(0, holes.length).reduce((s, v) => s + v, 0) || 36;
        const sumOk = hs === a.front || hs === a.back;
        const totOk = [playedPar + a.front + a.back, parTotal9 + a.front + a.back, 72 + a.front + a.back].includes(a.total);
        if (sumOk && totOk && !players.some((p) => p.name === nm[1])) {
          players.push({ name: nm[1], holes, total: a.total });
          break;
        }
      }
    }
    if (players.length) {
      // 코스명: 파 행 위쪽의 "힐 ^" / "스프링^" 헤더
      for (let i = Math.max(0, parLineIdx - 3); i <= parLineIdx; i++) {
        const h = textLines[i].match(/^\s*([가-힣]{1,5})[\s.…]*[\^▲]/);
        if (h) { $("#sf-front").value = h[1]; filled.push(tr("app.ocr.f.course.name", { name: h[1] })); break; }
      }
      if (pars.length >= 5) parsedPars = pars.slice(0, 9); // 스코어판 PAR 줄 표시용
      filled.push(tr("app.ocr.f.cart", { n: players.length }));
      return { filled, candidates: [], cartPlayers: players };
    }
  }

  // 골프장명: 각 줄을 내장 DB에서 검색해 매칭 (이름이 실제로 겹칠 때만 인정)
  let matchedClub = null;
  for (const line of text.split("\n")) {
    if (line.includes(",")) continue; // 동반자 목록 줄 제외
    const t = line.trim().replace(/[^가-힣A-Za-z0-9 ]/g, "");
    if (t.length < 2 || t.length > 14 || !/[가-힣]/.test(t)) continue;
    const hit = searchGolfDB(t);
    if (!hit.length) continue;
    const nq = normName(t);
    const hn = normName(hit[0].k || hit[0].n);
    if (!hn.includes(nq) && !nq.includes(stripSuffix(hn))) continue; // 발음 유사 등 약한 매칭 거부
    matchedClub = hit[0];
    $("#sf-course").value = matchedClub.k || matchedClub.n;
    filled.push(tr("app.ocr.f.club"));
    break;
  }

  // 전·후반 코스명
  // ① 그 구장의 알려진 코스명이 사진 속에 있으면 등장 순서대로 전반→후반
  const knownNames = matchedClub
    ? findCourseNames({ name: matchedClub.k || matchedClub.n, lat: matchedClub.lat, lon: matchedClub.lon })
    : courseNameList;
  const findIdx = (n) => {
    if (n.length === 1) {
      const m = text.match(new RegExp(`(?:^|[^가-힣])(${n})(?:[^가-힣]|$)`, "m"));
      return m ? m.index : -1;
    }
    return text.indexOf(n);
  };
  const seen = (knownNames || [])
    .map((n) => [findIdx(n), n]).filter(([i]) => i >= 0)
    .sort((a, b) => a[0] - b[0]).map(([, n]) => n);
  if (seen.length >= 2) {
    $("#sf-front").value = seen[0]; $("#sf-back").value = seen[1];
    filled.push(tr("app.ocr.f.course"));
  } else {
    // ② "남, 동" / "East, West" / "망무봉 OUT, 망무봉 IN" 형태의 줄에서 직접 추출
    const BAD = /^(putt|gir|fwhit|par|hole|tee|white|red|blue|black|total)$/i;
    // 주의: \s는 줄바꿈까지 매칭하므로 공백/탭만 허용 (같은 줄 안에서만 코스 추출)
    const seg = "[A-Za-z가-힣0-9]{1,10}(?: [A-Za-z가-힣0-9]{1,8})?";
    const cm = text.match(new RegExp(`^[ \\t]*(${seg})[ \\t]*[,·/][ \\t]*(${seg})[ \\t]*$`, "m"));
    if (cm && !BAD.test(cm[1].trim()) && !BAD.test(cm[2].trim()) &&
        !/^\d+$/.test(cm[1]) && !/^\d+$/.test(cm[2])) {
      $("#sf-front").value = cm[1].trim(); $("#sf-back").value = cm[2].trim();
      filled.push(tr("app.ocr.f.course"));
    }
  }

  // 동반자: "이성민, 박**, 조**, 이**" 형태 줄 (마스킹 별표가 잡음으로 읽혀도 허용)
  const knownSet = new Set(knownNames || []);
  for (const line of textLines) {
    const toks = line.split(/[,，]/).map((s) => s.trim().replace(/\s/g, "")).filter(Boolean);
    if (toks.length < 2 || toks.length > 5) continue;
    const names = toks.map((t) => {
      const m = t.match(/^([가-힣]{1,4})[^가-힣]{0,4}$/); // 뒤에 붙은 **·잡음 허용
      return m ? m[1] + (m[0].length > m[1].length ? "**" : "") : null;
    });
    if (names.every(Boolean) && !toks.every((t) => knownSet.has(t))) {
      names.slice(0, 4).forEach((t, i) => { $("#sf-f" + (i + 1)).value = t; });
      filled.push(tr("app.ocr.f.friends"));
      break;
    }
  }

  // 티: "White Tee" 등 인식
  const teeM = text.match(/(white|red|blue|black|gold|yellow|lady)\s*tee/i);
  if (teeM) {
    const teeMap = { white: "화이트", red: "레드", blue: "블루", black: "블랙", gold: "골드", yellow: "옐로우", lady: "레이디" };
    $("#sf-tee").value = teeMap[teeM[1].toLowerCase()] || "";
    filled.push(tr("app.ocr.f.tee"));
  }

  // 홀별 점수 줄 → 홀 그리드 자동 입력
  // OCR 오류 복원: "11"처럼 붙은 숫자는 한 자리씩 분리, o/O는 0으로
  const allTotals = new Set((text.match(/\d{2,3}/g) || []).map(Number).filter((n) => n >= 55 && n <= 150));
  function parseHoleRow(line) {
    const toks = line.replace(/[oO]/g, "0").match(/-\d|\d+/g);
    if (!toks) return null;
    const build = (collapseDouble) => {
      const vals = [];
      let rowTotal = null;
      for (const t of toks) {
        if (t.startsWith("-")) { vals.push(parseInt(t)); continue; }
        if (t.length === 1) { vals.push(parseInt(t)); continue; }
        const n = parseInt(t);
        if (n >= 27 && n <= 60 && vals.length >= 8) { rowTotal = n; break; } // 행 끝 합계
        // OCR이 글자를 겹쳐 읽은 경우("22"=2) 복원 시도
        if (collapseDouble && t.length === 2 && t[0] === t[1]) { vals.push(parseInt(t[0])); continue; }
        for (const ch of t) vals.push(parseInt(ch)); // 붙은 한 자리 숫자 분리
      }
      if (vals.length !== 9 || !vals.every((v) => v >= -4 && v <= 9)) return null;
      if (rowTotal !== null && 36 + vals.reduce((s, v) => s + v, 0) !== rowTotal) return null;
      return { nine: vals, verified: rowTotal !== null };
    };
    return build(false) || build(true);
  }
  const rows = [];
  const rowSeen = new Set();
  textLines.forEach((line, li) => {
    if (rows.length >= 2) return;
    if ((line.match(/\d/g) || []).length < 8) return;
    const r = parseHoleRow(line);
    if (!r) return;
    const key = r.nine.join(",");
    if (rowSeen.has(key)) return; // 다중 인식 병합 시 중복 제거
    rowSeen.add(key);
    r.li = li;
    rows.push(r);
  });
  let holesFilled = false;
  if (rows.length === 2) {
    const sumAll = rows[0].nine.concat(rows[1].nine).reduce((s, v) => s + v, 0);
    const half1 = rows[0].nine.reduce((s, v) => s + v, 0), half2 = rows[1].nine.reduce((s, v) => s + v, 0);
    // 채택 조건: ①행별 합계 검증 통과 ②72+18홀 합=사진 속 총점
    // ③합계가 안 읽혔어도 인접한 두 줄이 모두 정상 범위의 9칸이면 스코어카드로 인정
    const adjacentOk = Math.abs(rows[0].li - rows[1].li) <= 2 &&
      half1 >= -9 && half1 <= 24 && half2 >= -9 && half2 <= 24;
    const ok = rows.every((r) => r.verified) || allTotals.has(72 + sumAll) || adjacentOk;
    if (ok) {
      rows[0].nine.concat(rows[1].nine).forEach((v, i) => { holeInputs[i].value = v; });
      $("#holes-grid").hidden = false;
      updateHoleSum(); // 총타수까지 자동 계산
      holesFilled = true;
      filled.push(tr("app.ocr.f.holes.total", { n: $("#sf-score").value }));
    }
  } else if (rows.length === 1 && rows[0].verified) {
    // 9홀 라운드 (후반 없음)
    rows[0].nine.forEach((v, i) => { holeInputs[i].value = v; });
    const t9 = 36 + rows[0].nine.reduce((s, v) => s + v, 0);
    $("#holes-grid").hidden = false;
    $("#sf-score").value = t9;
    $("#hg-sum").textContent = tr("app.score.holesum.9", { t: t9 });
    holesFilled = true;
    filled.push(tr("app.ocr.f.9holes", { n: t9 }));
  }

  // 총타수: ①홀별 인식 완료 시 그 값 ②전·후반 합계 교차검증 ③후보 제시
  let best = holesFilled ? parseInt($("#sf-score").value) : null;
  const nums = (text.match(/\d{2,3}/g) || []).map(Number);
  if (!best) {
    const halves = nums.filter((n) => n >= 28 && n <= 60);
    const totals = new Set(nums.filter((n) => n >= 55 && n <= 150));
    for (let i = 0; i < halves.length && !best; i++) {
      for (let j = i + 1; j < halves.length; j++) {
        const s = halves[i] + halves[j];
        if (totals.has(s)) { best = s; break; } // 예: 39+35=74가 사진에 함께 있으면 확정
      }
    }
    if (best) { $("#sf-score").value = best; filled.push(tr("app.ocr.f.total", { n: best })); }
  }
  const candidates = best ? [] :
    [...new Set(nums.filter((n) => n >= 60 && n <= 130))].sort((a, b) => a - b).slice(0, 6);
  return { filled, candidates };
}

$("#sf-photo").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  // 미리보기 + 저장용 압축본
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = async () => {
    const cv = document.createElement("canvas");
    const scale = Math.min(1, 900 / img.width);
    cv.width = img.width * scale; cv.height = img.height * scale;
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    photoThumb = cv.toDataURL("image/jpeg", 0.6);
    const prev = $("#sf-photo-preview");
    prev.src = photoThumb; prev.hidden = false;
    URL.revokeObjectURL(url);

    const st = $("#ocr-status");
    st.hidden = false;

    // ① 정밀 AI(비전) 인식 — 기본 제공 (개인 키 설정 시 개인 키 우선)
    if (getGemKey()) {
      st.textContent = tr("app.ocr.gem.working");
      try {
        const g = await geminiRecognize(photoThumb);
        if (g) {
          const { filled, cartPlayers } = applyGeminiResult(g);
          if (cartPlayers && cartPlayers.length) {
            st.textContent = tr("app.ocr.gem.cart");
            renderCartChips(cartPlayers);
          } else if (filled.length) {
            st.textContent = tr("app.ocr.gem.filled", { list: filled.join(" · ") });
          } else {
            st.textContent = tr("app.ocr.gem.none");
          }
          return; // 정밀 인식 성공 시 기본 인식 생략
        }
      } catch (e) {
        st.textContent = tr("app.ocr.gem.fail");
      }
    }

    // ② 기본 인식 — 3가지 전처리로 각각 읽어 결과 병합 (흰 글자·검은 숫자 모두 커버)
    try {
      const worker = await getOcrWorker();
      const vars = ocrVariants(img);
      // 캡처 하단의 광고 배너 영역은 잘라내고 스코어 카드 부분만 사용
      const cardRegion = (t) => {
        const lines = t.split("\n");
        const idx = lines.findIndex((l) =>
          /(인스타|공유하기|스코어저장|골프예약|부킹|PICK|이달의|핫딜|Click)/i.test(l));
        return idx > 4 ? lines.slice(0, idx).join("\n") : t;
      };
      let mergedText = "";
      for (let i = 0; i < vars.length; i++) {
        st.textContent = tr("app.ocr.reading", { i: i + 1 });
        const { data } = await worker.recognize(vars[i]);
        mergedText += "\n" + cardRegion(data.text);
      }
      // 상단 띠(동반자·날짜·시간) 정밀 재인식 — 결과를 앞쪽에 배치해 우선 사용
      st.textContent = tr("app.ocr.reading", { i: 4 });
      try {
        for (const sv of topStripVariants(img)) {
          const { data } = await worker.recognize(sv);
          mergedText = data.text + "\n" + mergedText;
        }
      } catch { /* 스트립 인식 실패해도 본문 인식 결과 사용 */ }
      // "인식 원문 보기" — 어떤 글자가 읽혔는지 사용자가 직접 확인 가능
      const rawEl = $("#ocr-raw");
      rawEl.textContent = mergedText.split("\n").filter((l) => l.trim()).join("\n");
      rawEl.classList.remove("show");
      const { filled, candidates, cartPlayers } = autofillFromOcr(mergedText);
      syncCourseSelectUI();
      if (cartPlayers && cartPlayers.length) {
        // 카트 태블릿: 여러 명 중 본인 선택
        st.textContent = tr("app.ocr.cart");
        renderCartChips(cartPlayers);
      } else if (filled.length) {
        st.textContent = tr("app.ocr.filled", { list: filled.join(" · ") });
      } else {
        st.textContent = tr("app.ocr.none");
      }
      const rawBtn = document.createElement("button");
      rawBtn.type = "button"; rawBtn.className = "ocr-raw-btn"; rawBtn.textContent = tr("app.ocr.raw");
      rawBtn.addEventListener("click", () => $("#ocr-raw").classList.toggle("show"));
      st.appendChild(rawBtn);
      if (candidates.length) {
        st.textContent += tr("app.ocr.pick.total");
        const chips = $("#ocr-chips");
        chips.innerHTML = `<span class="chip-label">${tr("app.ocr.chip.totals")}</span>`;
        candidates.forEach((n) => {
          const b = document.createElement("button");
          b.type = "button"; b.className = "ocr-chip"; b.textContent = tr("app.ocr.chip.total", { n: n });
          b.addEventListener("click", () => { $("#sf-score").value = n; });
          chips.appendChild(b);
        });
        chips.hidden = false;
      }
    } catch {
      st.textContent = tr("app.ocr.fail");
    }
  };
  img.src = url;
});

$("#score-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  // 날씨 조회까지 겸하는 저장이라 몇 초 걸린다 — 그동안 라운딩을 격려하는 화면을 띄운다
  return WAIT.run("score", () => saveScoreRecord());
});
async function saveScoreRecord() {
  const btn = $("#sf-save-btn");
  btn.disabled = true; btn.textContent = tr("app.score.saving");
  const rec = {
    id: editingId || Date.now(),
    date: $("#sf-date").value,
    teeTime: $("#sf-time-unknown").checked ? "" : $("#sf-time").value,
    course: $("#sf-course").value.trim(),
    front: $("#sf-front").value.trim(),
    back: $("#sf-back").value.trim(),
    tee: $("#sf-tee").value,
    score: parseInt($("#sf-score").value),
    friends: ["#sf-f1", "#sf-f2", "#sf-f3", "#sf-f4"]
      .map((s) => $(s).value.trim()).filter(Boolean).join(", "),
    memo: $("#sf-memo").value.trim(),
  };
  const hv = holeVals();
  if (hv.some((x) => x !== null)) rec.holes = hv;
  const prev = editingId ? loadScores().find((x) => x.id === editingId) : null;
  if (parsedPars && parsedPars.length) rec.pars = parsedPars;
  else if (prev?.pars) rec.pars = prev.pars;
  if (photoThumb) rec.photo = photoThumb;
  else if (prev?.photo) rec.photo = prev.photo;

  // 그날 날씨 자동 기록 (날짜가 안 바뀌었으면 기존 날씨 유지)
  if (prev && prev.date === rec.date && prev.wx) {
    rec.wx = prev.wx;
  } else if (currentCourse) {
    try {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.search = new URLSearchParams({
        latitude: currentCourse.lat, longitude: currentCourse.lon,
        daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code",
        wind_speed_unit: "ms", timezone: tzForCoord(currentCourse.lat, currentCourse.lon),
        start_date: rec.date, end_date: rec.date,
      });
      const d = await fetchJSON(url, { retries: 1 });
      rec.wx = {
        code: d.daily.weather_code[0],
        tmax: Math.round(d.daily.temperature_2m_max[0]),
        tmin: Math.round(d.daily.temperature_2m_min[0]),
        rain: d.daily.precipitation_sum[0],
        wind: Math.round(d.daily.wind_speed_10m_max[0] * 10) / 10,
      };
    } catch { /* 날씨 없이 저장 */ }
  }
  let list = loadScores();
  if (editingId) list = list.map((x) => (x.id === editingId ? rec : x));
  else list.unshift(rec);
  try { saveScores(list); }
  catch {
    // 용량 초과 시 사진 없이 저장
    delete rec.photo;
    if (editingId) list = loadScores().map((x) => (x.id === editingId ? rec : x));
    else { list = loadScores(); list.unshift(rec); }
    saveScores(list);
    alert(tr("app.score.save.nophoto"));
  }
  btn.disabled = false; btn.textContent = tr("app.score.save");
  resetScoreForm(); // 첨부 사진·입력값 정리
  $("#score-form").hidden = true;
  renderScores();
}

/* ---------- 통계: 평균·핸디·목표 ---------- */
function calcStats(records) {
  // 9홀 라운드(55타 미만)는 평균·핸디 계산에서 제외 (왜곡 방지)
  const full = records.filter((r) => r.score >= 55);
  if (full.length) records = full;
  if (!records.length) return null;
  const avg = records.reduce((s, r) => s + r.score, 0) / records.length;
  // 추정 핸디: 최근 20라운드 중 베스트 8 평균 - 72 (라운드가 적으면 베스트 절반)
  const recent = [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  const nBest = Math.max(1, Math.min(8, Math.ceil(recent.length / 2)));
  const best = recent.map((r) => r.score).sort((a, b) => a - b).slice(0, nBest);
  const handi = Math.max(0, best.reduce((s, v) => s + v, 0) / best.length - 72);
  return { avg: Math.round(avg * 10) / 10, handi: Math.round(handi * 10) / 10, n: records.length };
}

function renderStats(all) {
  const box = $("#score-stats");
  if (!all.length) { box.hidden = true; return; }
  box.hidden = false;

  const years = [...new Set(all.map((r) => r.date.slice(0, 4)))].sort((a, b) => b - a);
  if (selectedYear !== "전체" && !years.includes(selectedYear)) selectedYear = "전체";
  const tabs = $("#year-tabs");
  tabs.innerHTML = "";
  ["전체", ...years].forEach((y) => {
    const b = document.createElement("button");
    b.className = "year-tab" + (selectedYear === y ? " active" : "");
    b.textContent = y === "전체" ? tr("app.score.year.all") : tr("app.score.year", { y: y });
    b.addEventListener("click", () => { selectedYear = y; renderScores(); });
    tabs.appendChild(b);
  });

  const filtered = selectedYear === "전체" ? all : all.filter((r) => r.date.startsWith(selectedYear));
  const st = calcStats(filtered);
  $("#st-avg").textContent = st ? st.avg : "-";
  $("#st-rounds").textContent = st
    ? tr("app.score.rounds", {
        y: selectedYear === "전체" ? tr("app.score.year.all") : tr("app.score.year", { y: selectedYear }),
        n: st.n })
    : "";
  $("#st-handi").textContent = st ? st.handi : "-";

  const goal = localStorage.getItem(GOAL_KEY);
  $("#st-goal").textContent = goal ?? tr("app.score.goal.set");
  $("#st-gap").textContent = goal && st
    ? tr("app.score.goal.gap", { n: Math.round((st.handi - goal) * 10) / 10 })
    : tr("app.score.goal.tap");
  return filtered;
}
$("#goal-box").addEventListener("click", () => {
  const cur = localStorage.getItem(GOAL_KEY) || "";
  const v = prompt(tr("app.score.goal.prompt"), cur);
  if (v === null) return;
  const n = parseFloat(v);
  if (isNaN(n) || n < 0 || n > 54) { alert(tr("app.score.goal.range")); return; }
  localStorage.setItem(GOAL_KEY, String(n));
  renderScores();
});

/* ---------- 기록 공유: 카드 이미지 생성 → 공유/저장 ---------- */
async function shareScoreCard(r) {
  const W = 720, H = 900;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d");

  // 배경 — 앱과 같은 토스 무드(흰 카드 + 진한 글씨)
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#f2f4f6"; x.fillRect(0, 0, W, 8);      // 상단 얇은 띠

  x.textAlign = "center"; x.fillStyle = "#191f28";
  x.font = "700 44px -apple-system, 'Malgun Gothic', sans-serif";
  x.fillText(r.course, W / 2, 110);
  x.fillStyle = "#8b95a1";
  x.font = "400 26px -apple-system, sans-serif";
  const sub = r.date + (r.teeTime ? tr("app.card.teetime", { t: r.teeTime }) : "") +
    (r.tee ? tr("app.card.tee", { tee: r.tee }) : "");
  x.fillText(sub, W / 2, 155);
  if (r.front || r.back) {
    x.fillText((r.front || "전반") + " · " + (r.back || "후반"), W / 2, 192);
  }

  // 대형 스코어
  x.fillStyle = "#191f28";
  x.font = "700 190px -apple-system, sans-serif";
  x.fillText(String(r.score), W / 2, 400);
  x.font = "400 34px -apple-system, sans-serif";
  x.fillStyle = "#0b9e36";
  x.fillText(tr("app.card.stroke"), W / 2 + 130, 395);

  // 홀별 표 (라벨 | 1~9홀 | 합계 — 겹침 없는 고정 칼럼)
  let y = 470;
  if (r.holes) {
    const cellsX0 = 165, cellsX1 = W - 150; // 홀 숫자 영역
    const cell = (cellsX1 - cellsX0) / 9;
    const rows = [
      [r.holes.slice(0, 9), (r.pars || []).slice(0, 9), r.front || "전반"],
      [r.holes.slice(9), (r.pars || []).slice(9, 18), r.back || "후반"],
    ];
    rows.forEach(([nine, pars, label]) => {
      if (nine.every((v) => v == null)) return; // 9홀 라운드의 빈 후반 생략
      x.fillStyle = "#f7f8fa";
      x.fillRect(50, y, W - 100, 54);
      x.font = "600 18px -apple-system, sans-serif";
      x.fillStyle = "#8b95a1";
      x.textAlign = "left";
      x.fillText(label, 60, y + 33, 100); // 폭 초과 시 자동 압축 (망무봉 OUT 등)
      x.textAlign = "center";
      x.font = "600 22px -apple-system, sans-serif";
      nine.forEach((v, i) => {
        x.fillStyle = v > 0 ? "#f5232b" : v < 0 ? "#0b9e36" : "#191f28";
        x.fillText(v == null ? "·" : v > 0 ? "+" + v : String(v), cellsX0 + cell * i + cell / 2, y + 34);
      });
      const parT = pars.length === 9 ? pars.reduce((s, v) => s + v, 0) : 36;
      const t = parT + nine.reduce((s, v) => s + (v || 0), 0);
      x.fillStyle = "#0b9e36";
      x.font = "800 26px -apple-system, sans-serif";
      x.fillText(String(t), W - 92, y + 35);
      y += 62;
    });
    y += 20;
  }

  // 그날 날씨
  if (r.wx) {
    x.fillStyle = "#4e5968";
    x.font = "400 26px -apple-system, sans-serif";
    x.fillText(tr("app.card.wx", { desc: wmoDesc(r.wx.code), tmin: r.wx.tmin, tmax: r.wx.tmax,
      rain: r.wx.rain, wind: r.wx.wind }), W / 2, y + 30);
    y += 70;
  }
  if (r.friends) {
    x.fillStyle = "#8b95a1";
    x.font = "400 24px -apple-system, sans-serif";
    x.fillText(tr("app.card.friends", { friends: r.friends }), W / 2, y + 30, W - 100);
    y += 52;
  }
  if (r.memo) {
    x.fillStyle = "#4e5968";
    x.font = "italic 400 25px -apple-system, sans-serif";
    const memo = `“ ${r.memo} ”`;
    const MAXC = 26;
    if (memo.length <= MAXC) {
      x.fillText(memo, W / 2, y + 34, W - 90);
    } else { // 긴 메모는 2줄로
      x.fillText(memo.slice(0, MAXC), W / 2, y + 34, W - 90);
      x.fillText(memo.slice(MAXC, MAXC * 2) + (memo.length > MAXC * 2 ? "…" : ""), W / 2, y + 66, W - 90);
    }
  }

  // 워터마크
  x.fillStyle = "#0b9e36";
  x.font = "700 26px -apple-system, sans-serif";
  x.fillText(tr("app.card.watermark"), W / 2, H - 50);

  return new Promise((resolve) => {
    cv.toBlob(async (blob) => {
      const file = new File([blob], `score-${r.date}.png`, { type: "image/png" });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: tr("app.card.share.title", { course: r.course, score: r.score }) });
          resolve(true); return;
        }
      } catch { /* 공유 취소 등 */ }
      // 폴백: 새 탭에 이미지 표시 (길게 눌러 저장)
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      resolve(false);
    }, "image/png");
  });
}

/* 스코어카드 표 (홀별 입력이 있는 기록) — 스마트스코어 스타일 */
/* 스마트스코어 스타일 블루 스코어판 */
function scorecardHtml(r) {
  const f = r.holes.slice(0, 9), b = r.holes.slice(9);
  const pf = (r.pars || []).slice(0, 9), pb = (r.pars || []).slice(9, 18);
  const sum = (a) => a.reduce((s, x) => s + (x || 0), 0);
  const empty = (a) => a.every((x) => x == null);
  const holeHead = Array.from({ length: 9 }, (_, i) => `<span>${i + 1}</span>`).join("");

  const block = (nine, pars) => {
    if (empty(nine)) return ""; // 9홀 라운드의 빈 후반은 표 생략
    const parT = pars.length === 9 ? pars.reduce((s, v) => s + v, 0) : 36;
    const scoreT = parT + sum(nine);
    const parRow = pars.length === 9
      ? `<div class="sb-row sb-par"><span>PAR</span>${pars.map((p) => `<span>${p}</span>`).join("")}<span>${parT}</span></div>`
      : "";
    return `<div class="sb-table">
      <div class="sb-row sb-head"><span>HOLE</span>${holeHead}<span>T</span></div>
      ${parRow}
      <div class="sb-row sb-score"><span>●</span>${nine.map((v) => `<span>${v == null ? "-" : v}</span>`).join("")}<span class="sb-t">${scoreT}</span></div>
    </div>`;
  };

  return `<div class="sb-card">
    <div class="sb-top"><span class="sb-name">${r.course}</span><span class="sb-total">${r.score}</span></div>
    ${r.front || r.back ? `<div class="sb-courses">⚑ ${r.front || tr("app.sc.front")} - ${r.back || tr("app.sc.back")}</div>` : ""}
    ${block(f, pf)}
    ${block(b, pb)}
  </div>`;
}

function renderScores() {
  const all = loadScores();
  const filtered = renderStats(all) || [];
  const el = $("#score-list");
  el.innerHTML = "";
  $("#score-empty").hidden = all.length > 0;
  // 저장 순서와 무관하게 라운드 날짜 최신순 정렬 (같은 날짜면 티업 시간순)
  const list = [...(selectedYear === "전체" ? all : filtered)].sort(
    (a, b) => (b.date + (b.teeTime || "")).localeCompare(a.date + (a.teeTime || "")) || b.id - a.id);
  list.forEach((r) => {
    const div = document.createElement("div");
    div.className = "score-item";
    const wx = r.wx
      ? `<div class="si-wx">
           <span>${wmoIcon(r.wx.code)} ${wmoDesc(r.wx.code)}</span>
           <span>🌡 ${r.wx.tmin}~${r.wx.tmax}°</span>
           <span>🌧 ${r.wx.rain}mm</span>
           <span>${tr("app.si.wind", { wind: r.wx.wind })}</span>
         </div>` : "";
    div.innerHTML = `
      <div class="si-top">
        <div>
          <div class="si-course">${r.course}</div>
          <div class="si-date">${r.date}${r.teeTime ? tr("app.si.teetime", { t: r.teeTime }) : ""}${r.tee ? tr("app.card.tee", { tee: r.tee }) : ""}</div>
        </div>
        ${r.holes ? "" : `<div class="si-score">${r.score}<small>${tr("app.card.stroke")}</small></div>`}
      </div>
      ${r.friends ? `<div class="si-friends">👥 ${r.friends}</div>` : ""}
      ${r.memo ? `<div class="si-memo">"${r.memo}"</div>` : ""}
      ${r.holes ? scorecardHtml(r) : ""}
      ${wx}
      ${r.photo ? `<img class="si-photo" src="${r.photo}" alt="${tr("app.si.photo.alt")}">` : ""}
      <div class="si-actions">
        <button class="si-edit2">${tr("app.si.edit")}</button>
        <button class="si-share">${tr("app.si.share")}</button>
        ${r.photo ? `<button class="si-photo-toggle">${tr("app.si.photo")}</button>` : ""}
        <button class="si-del2">${tr("app.si.del")}</button>
      </div>`;
    div.querySelector(".si-share").addEventListener("click", () => shareScoreCard(r));
    div.querySelector(".si-del2").addEventListener("click", () => {
      if (!confirm(tr("app.si.del.ask", { date: r.date, course: r.course }))) return;
      saveScores(loadScores().filter((x) => x.id !== r.id));
      renderScores();
    });
    const pt = div.querySelector(".si-photo-toggle");
    if (pt) pt.addEventListener("click", () => {
      const open = div.classList.toggle("show-photo");
      pt.textContent = open ? tr("app.si.photo.close") : tr("app.si.photo.open");
    });
    div.querySelector(".si-edit2").addEventListener("click", () => {
      resetScoreForm();
      editingId = r.id;
      $("#sf-title").textContent = tr("app.score.form.edit");
      $("#sf-date").value = r.date;
      if (r.teeTime) { $("#sf-time").value = r.teeTime; }
      else { $("#sf-time-unknown").checked = true; $("#sf-time").disabled = true; }
      $("#sf-course").value = r.course;
      $("#sf-front").value = r.front || ""; $("#sf-back").value = r.back || "";
      syncCourseSelectUI();
      $("#sf-tee").value = r.tee || "";
      $("#sf-score").value = r.score;
      const fr = (r.friends || "").split(",").map((s) => s.trim());
      ["#sf-f1", "#sf-f2", "#sf-f3", "#sf-f4"].forEach((s, i) => { $(s).value = fr[i] || ""; });
      if (r.holes) {
        r.holes.forEach((v, i) => { holeInputs[i].value = v == null ? "" : v; });
        $("#holes-grid").hidden = false;
        updateHoleSum();
      }
      $("#sf-memo").value = r.memo || "";
      if (r.photo) { $("#sf-photo-preview").src = r.photo; $("#sf-photo-preview").hidden = false; }
      $("#score-form").hidden = false;
      scrollToTop();          // window.scrollTo 는 이 앱에서 듣지 않는다(scrollToTop 주석 참고)
    });
    el.appendChild(div);
  });
}

/* ---------- 이용 동의 ----------
   개인정보보호법: 선택 항목 미동의해도 전체 기능 이용 가능해야 함(제16조제3항).
   위치정보: 기기 내에서만 계산하고 서버로 보내지 않음.                    */
const CONSENT = {
  KEY: "riweather.consent",
  get() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || "null"); } catch (_) { return null; }
  },
  save(d) {
    // 저장이 실패하면(사파리 시크릿 모드 등) 매번 약관이 다시 나온다 — 조용히 넘기지 않고 방어
    try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch (e) { console.warn("동의 저장 실패", e); }
  },
  done() {
    const c = this.get();
    return !!(c && c.v === LEGAL_VERSION && c.tos && c.age14);
  },
  allowsLocation() {
    const c = this.get();
    return !!(c && c.loc);
  },
  setLocation(on) {
    const c = this.get() || { v: LEGAL_VERSION, at: new Date().toISOString(), age14: true, tos: true };
    c.loc = !!on;
    c.locAt = new Date().toISOString();
    this.save(c);
  },
};

/* 약관 미동의 상태 관리 — '나중에'를 눌러도 사용은 가능하되 주기적으로 다시 안내 */
const CONSENT_NAG = {
  KEY: "riweather.consent.nag",
  EVERY: 5,                       // 화면 이동 5번마다 안내
  read() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || "{}"); } catch (_) { return {}; }
  },
  write(s) { localStorage.setItem(this.KEY, JSON.stringify(s)); },
  postponed() { return !!this.read().later; },
  postpone() { const s = this.read(); s.later = true; s.n = 0; this.write(s); },
  clear() { localStorage.removeItem(this.KEY); },
  bump() {
    if (CONSENT.done() || !this.postponed()) return;
    const s = this.read();
    s.n = (s.n || 0) + 1;
    this.write(s);
    if (s.n >= this.EVERY) { s.n = 0; this.write(s); this.show(); }
  },
  show() {
    if (CONSENT.done()) return;
    const sheet = $("#nag-sheet");
    if (sheet && sheet.hidden && $("#consent-view").hidden) sheet.hidden = false;
  },
};

/* 약관 전문 보기 (앱 어디서나 .c-view[data-doc] 클릭) */
function openDoc(key) {
  const d = LEGAL_DOCS[key];
  if (!d) return;
  $("#doc-title").textContent = d.title;
  $("#doc-body").innerHTML = d.body;
  $("#doc-body").scrollTop = 0;
  $("#doc-sheet").hidden = false;
}
/* 인앱 브라우저(카카오·네이버 등)에서 이벤트 위임이 불안정한 경우가 있어
   위임과 직접 등록을 함께 걸어 둔다. 중복 실행은 플래그로 막는다. */
function bindDocButtons(root) {
  (root || document).querySelectorAll(".c-view[data-doc]").forEach((b) => {
    if (b.dataset.bound) return;
    b.dataset.bound = "1";
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openDoc(b.dataset.doc); });
  });
}
document.addEventListener("click", (e) => {
  const t = e.target;
  const b = (t.closest ? t.closest(".c-view[data-doc]") : null);
  if (b && !b.dataset.bound) { e.preventDefault(); openDoc(b.dataset.doc); }
});
bindDocButtons();
$("#doc-close").addEventListener("click", () => { $("#doc-sheet").hidden = true; });
$("#doc-sheet").addEventListener("click", (e) => {
  if (e.target === $("#doc-sheet")) $("#doc-sheet").hidden = true;
});

(function () {
  const view = $("#consent-view");
  const AGES = ["10대", "20대", "30대", "40대", "50대", "60대 이상"];
  const GENDERS = ["남성", "여성", "선택 안 함"];
  const YEARS = ["1년 미만 (입문)", "1~3년", "3~5년", "5~10년", "10년 이상"];
  const AVGS = ["70대 (싱글)", "80대", "90대", "100대", "110 이상"];
  let pickedAge = null, pickedGender = null, pickedYears = null, pickedAvg = null;

  const chips = (host, items, get, set) => {
    host.innerHTML = "";
    items.forEach((t) => {
      const b = document.createElement("button");
      b.className = "pi-chip" + (get() === t ? " on" : "");
      b.type = "button";
      b.textContent = pfLabel(t);
      b.addEventListener("click", () => {
        set(get() === t ? null : t);
        chips(host, items, get, set);
      });
      host.appendChild(b);
    });
  };

  const boxes = () => ({
    all: $("#c-all"), age: $("#c-age"), tos: $("#c-tos"),
    loc: $("#c-loc"), profile: $("#c-profile"), mkt: $("#c-mkt"),
  });

  function sync() {
    const b = boxes();
    // disabled 를 쓰지 않는다 — 눌러도 반응이 없으면 고장으로 오해하기 때문.
    // 대신 흐리게 보여주고, 누르면 빠진 항목을 짚어준다.
    const ready = b.age.checked && b.tos.checked;
    $("#c-start").classList.toggle("is-off", !ready);
    $("#profile-input").hidden = !b.profile.checked;
    b.all.checked = b.age.checked && b.tos.checked && b.loc.checked && b.profile.checked && b.mkt.checked;
  }

  function open(prefill) {
    const b = boxes();
    const c = prefill || CONSENT.get() || {};
    b.age.checked = !!c.age14; b.tos.checked = !!c.tos;
    b.loc.checked = !!c.loc; b.profile.checked = !!c.profile; b.mkt.checked = !!c.mkt;
    pickedAge = c.age || null; pickedGender = c.gender || null;
    pickedYears = (typeof loadProfile === "function" && loadProfile().years) || null;
    pickedAvg = (typeof loadProfile === "function" && loadProfile().avg) || null;
    chips($("#pi-age"), AGES, () => pickedAge, (v) => { pickedAge = v; });
    chips($("#pi-gender"), GENDERS, () => pickedGender, (v) => { pickedGender = v; });
    chips($("#pi-years"), YEARS, () => pickedYears, (v) => { pickedYears = v; });
    chips($("#pi-avg"), AVGS, () => pickedAvg, (v) => { pickedAvg = v; });
    // 홈 화면 앱은 브라우저와 저장 공간이 분리(iOS 정책) — 왜 다시 묻는지 설명해 오해를 막는다
    const sn = $("#consent-standalone-note");
    if (sn) {
      const standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) ||
                         window.navigator.standalone === true;
      sn.hidden = !(standalone && !CONSENT.get());
    }
    sync();
    view.hidden = false;
    view.scrollTop = 0;
  }

  $("#c-all").addEventListener("change", (e) => {
    const on = e.target.checked;
    ["#c-age", "#c-tos", "#c-loc", "#c-profile", "#c-mkt"].forEach((s) => { $(s).checked = on; });
    sync();
  });
  ["#c-age", "#c-tos", "#c-loc", "#c-profile", "#c-mkt"].forEach((s) =>
    $(s).addEventListener("change", sync));

  $("#c-start").addEventListener("click", () => {
    const b = boxes();
    // 필수 항목이 빠졌으면 버튼 바로 위에 알려준다.
    // (화면 위쪽 항목을 강조해도 스크롤 밖이면 안 보이므로 여기에 띄운다)
    if (!b.age.checked || !b.tos.checked) {
      const miss = [];
      if (!b.age.checked) miss.push(tr("app.consent.miss.age"));
      if (!b.tos.checked) miss.push(tr("app.consent.miss.tos"));
      let warn = $("#c-warn");
      if (!warn) {
        warn = document.createElement("div");
        warn.id = "c-warn";
        warn.className = "consent-warn";
        $("#c-start").parentNode.insertBefore(warn, $("#c-start"));
      }
      warn.textContent = tr("app.consent.miss", { list: miss.join(", ") });
      [b.age, b.tos].forEach((x) => {
        if (x.checked) return;
        const li = x.closest("li");
        if (!li) return;
        li.classList.remove("c-need");
        void li.offsetWidth;              // 애니메이션 재시작
        li.classList.add("c-need");
        setTimeout(() => li.classList.remove("c-need"), 1600);
      });
      const first = !b.age.checked ? b.age : b.tos;
      try { first.closest("li").scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}
      return;
    }
    { const w = $("#c-warn"); if (w) w.remove(); }
    CONSENT.save({
      v: LEGAL_VERSION,
      at: new Date().toISOString(),
      age14: b.age.checked,
      tos: b.tos.checked,
      loc: b.loc.checked,
      profile: b.profile.checked,
      age: b.profile.checked ? pickedAge : null,
      gender: b.profile.checked ? pickedGender : null,
      mkt: b.mkt.checked,
    });
    // 구력·평균타수는 동의 항목이 아닌 플레이 정보 — 프로필에 저장해 코스 공략·AI 캐디가 사용
    if (b.profile.checked && typeof saveProfile === "function") {
      const patch = {};
      if (pickedYears) patch.years = pickedYears;
      if (pickedAvg) patch.avg = pickedAvg;
      if (Object.keys(patch).length) {
        saveProfile(Object.assign(loadProfile(), patch));
        const sel = $("#pf-years"); if (sel && patch.years) sel.value = patch.years;
      }
    }
    view.hidden = true;
    CONSENT_NAG.clear();                       // 동의 완료 → 더 이상 안내하지 않음
    if (typeof currentCourse !== "undefined" && currentCourse) updateDistCard(currentCourse);
  });

  // 나중에 하기 — 사용은 계속하되 화면 이동 5번마다 다시 안내
  $("#c-later").addEventListener("click", () => {
    view.hidden = true;
    CONSENT_NAG.postpone();
  });

  // 미동의 안내 팝업
  $("#nag-go").addEventListener("click", () => { $("#nag-sheet").hidden = true; open(); });
  $("#nag-later").addEventListener("click", () => { $("#nag-sheet").hidden = true; });
  $("#nag-sheet").addEventListener("click", (e) => {
    if (e.target === $("#nag-sheet")) $("#nag-sheet").hidden = true;
  });

  $("#consent-settings").addEventListener("click", () => open());

  // 첫 방문이면 동의 화면, '나중에'를 눌렀던 이용자는 사용 중 안내로만
  if (!CONSENT.done() && !CONSENT_NAG.postponed()) open();
})();

/* 언어 전환 (2026-08-03 · 해외진출_설계 Phase 3)
 *
 * 🔴 왜 다시 그리지 않고 새로고침하나
 *    화면의 상당 부분이 자바스크립트로 그려진 뒤 DOM 에 남아 있다(홀 카드·목록·차트…).
 *    I18N.applyDom() 은 data-i18n 이 달린 정적 마크업만 다시 입히므로,
 *    이미 그려진 것들은 한국어인 채로 남아 **반쪽짜리 화면**이 된다.
 *    새로고침이 느려 보여도 그게 정직하다 — 어중간하게 섞인 화면보다 낫다.
 *    (언어를 바꾸는 일은 자주 있는 일이 아니다.)
 */
(function () {
  const paint = () => {
    const cur = I18N.lang;
    const ko = $("#lang-ko"), ja = $("#lang-ja");
    if (!ko || !ja) return;
    ko.classList.toggle("on", cur === "ko");
    ja.classList.toggle("on", cur === "ja");
    ko.setAttribute("aria-pressed", String(cur === "ko"));
    ja.setAttribute("aria-pressed", String(cur === "ja"));
  };
  const pick = (lang) => {
    if (I18N.lang === lang) return;
    I18N.setLang(lang);
    location.reload();
  };
  const ko = $("#lang-ko"), ja = $("#lang-ja");
  if (ko) ko.addEventListener("click", () => pick("ko"));
  if (ja) ja.addEventListener("click", () => pick("ja"));
  paint();
})();

/* ---------- 홈 화면에 추가 (기기 자동 감지) ----------
   · 안드로이드/PC 크롬 계열 : 버튼 한 번으로 바로 설치
   · 아이폰 사파리          : 공유 → 홈 화면에 추가 단계 안내
   · 아이폰 크롬 등         : 사파리로 열도록 안내 + 주소 복사
   · 카톡·인스타 등 인앱     : 기본 브라우저로 열도록 안내 + 주소 복사
   설치가 끝나면 버튼은 사라진다.                                   */
(function () {
  const KEY = "riweather.install.snooze";     // 닫기 누른 시각(7일 뒤 다시 노출)
  const SNOOZE_DAYS = 7;
  const cta = $("#install-cta");
  const sheet = $("#guide-sheet");
  if (!cta || !sheet) return;

  const ua = navigator.userAgent || "";
  const installed = () =>
    matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isIPad =
    /iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const inApp =
    /KAKAOTALK|NAVER\(|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|kakaostory|everytimeApp|TikTok|Snapchat|MicroMessenger/i.test(ua);
  const iosOtherBrowser = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS|Whale|SamsungBrowser/i.test(ua);

  const snoozed = () => {
    const t = Number(localStorage.getItem(KEY) || 0);
    return t && Date.now() - t < SNOOZE_DAYS * 864e5;
  };

  /* ---- 안내 시트 ---- */
  const ICO = (t) => `<span class="gs-ico">${t}</span>`;
  function openSheet(title, desc, steps, withCopy) {
    $("#guide-title").textContent = title;
    $("#guide-desc").innerHTML = desc;
    $("#guide-steps").innerHTML = steps
      .map((s, i) => `<li><span class="gs-num">${i + 1}</span><span>${s}</span></li>`)
      .join("");
    $("#guide-copy").hidden = !withCopy;
    sheet.hidden = false;
  }
  const closeSheet = () => { sheet.hidden = true; };
  $("#guide-close").addEventListener("click", closeSheet);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheet(); });
  $("#guide-copy").addEventListener("click", async () => {
    const url = location.href.split("?")[0];
    try {
      await navigator.clipboard.writeText(url);
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = url; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
    $("#guide-copy").textContent = tr("app.install.copied");
    setTimeout(() => { $("#guide-copy").textContent = tr("app.install.copy"); }, 2500);
  });

  /* ---- 기기별 동작 ---- */
  function handleClick() {
    if (inApp) {
      openSheet(
        tr("app.install.inapp.title"),
        tr("app.install.inapp.desc"),
        [
          tr("app.install.inapp.s1", { a: ICO("⋯"), b: ICO("⋮") }),
          tr("app.install.inapp.s2"),
          tr("app.install.inapp.s3"),
        ],
        true
      );
      return;
    }
    if (iosOtherBrowser) {
      openSheet(
        tr("app.install.safari.title"),
        tr("app.install.safari.desc"),
        [
          tr("app.install.safari.s1"),
          tr("app.install.safari.s2"),
          tr("app.install.safari.s3"),
        ],
        true
      );
      return;
    }
    if (isIOS) {
      openSheet(
        tr("app.install.ios.title"),
        tr("app.install.ios.desc"),
        [
          isIPad
            ? tr("app.install.ios.s1.pad", { ico: ICO("⬆︎") })
            : tr("app.install.ios.s1", { ico: ICO("⬆︎") }),
          tr("app.install.ios.s2"),
          tr("app.install.ios.s3"),
        ],
        false
      );
      return;
    }
    const prompt = window.__installPrompt;
    if (prompt) {
      prompt.prompt();
      prompt.userChoice.then((r) => {
        window.__installPrompt = null;
        if (r && r.outcome === "accepted") cta.hidden = true;
      });
      return;
    }
    openSheet(
      tr("app.install.etc.title"),
      tr("app.install.etc.desc"),
      [
        tr("app.install.etc.s1", { ico: ICO("⋮") }),
        tr("app.install.etc.s2"),
        tr("app.install.etc.s3"),
      ],
      false
    );
  }

  /* ---- 노출 여부 판단 ---- */
  function refresh() {
    if (installed()) { cta.hidden = true; return; }
    if (snoozed()) { cta.hidden = true; return; }
    if (inApp) {
      $("#install-title").textContent = tr("app.install.cta.title");
      $("#install-sub").textContent = tr("app.install.cta.inapp");
    } else if (isIOS) {
      $("#install-title").textContent = tr("app.install.cta.title");
      $("#install-sub").textContent = tr("app.install.cta.ios");
    } else if (isAndroid) {
      $("#install-title").textContent = tr("app.install.cta.title");
      $("#install-sub").textContent = tr("app.install.cta.aos");
    } else if (!window.__installPrompt) {
      cta.hidden = true; return;               // PC는 설치 가능할 때만 노출
    }
    cta.hidden = false;
  }

  $("#btn-install").addEventListener("click", handleClick);
  $("#install-dismiss").addEventListener("click", () => {
    cta.hidden = true;
    localStorage.setItem(KEY, String(Date.now()));
  });
  window.addEventListener("riweather:installable", refresh);
  window.addEventListener("appinstalled", () => {
    cta.hidden = true; closeSheet();
    localStorage.removeItem(KEY);
  });
  matchMedia("(display-mode: standalone)").addEventListener?.("change", refresh);
  refresh();
})();

/* ---------- 기록 지키기 (백업·복구) ----------
   즐겨찾기·스코어는 폰 안에만 저장되는데, 아이폰은 앱을 지우면 이 저장소를
   함께 지운다. '복구 코드' 하나로 서버(구글 시트)에 백업해 두고,
   재설치·기기변경 후 코드 입력으로 되살린다. 사진은 용량 문제로 제외. */
const BACKUP = (() => {
  const KEY = "riweather.backup";
  const st = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { return {}; } };
  const put = (s) => localStorage.setItem(KEY, JSON.stringify(s));

  function newCode() {
    const a = new Uint32Array(3);
    crypto.getRandomValues(a);
    return [...a].map((n) => String(n % 10000).padStart(4, "0")).join("");   // 12자리
  }
  const fmt = (c) => (c || "").replace(/(\d{4})(?=\d)/g, "$1-");

  function collect() {
    const scores = loadScores().map((r) => { const c = { ...r }; delete c.photo; return c; });
    return {
      v: 1, t: Date.now(),
      courses: loadCourses(),
      scores,
      profile: loadProfile(),
      defaultTee: localStorage.getItem("riweather.defaultTee") || null,
    };
  }
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return h + ":" + s.length; };

  let timer = null;
  async function send(force) {
    const s = st();
    if (!s.on || !s.code || !window.RIW_BACKEND) return false;
    const data = collect();
    const body = JSON.stringify({ fn: "backup", code: s.code, data, k: window.RIW_TOK() });
    const h = hash(body);
    if (!force && s.hash === h) return true;             // 달라진 게 없으면 보내지 않음
    /* ⚠️ 구글(Apps Script)이 가끔 JSON 대신 HTML 오류 페이지를 돌려준다.
       한 번 실패했다고 그냥 넘기면 그날 기록이 백업 안 된 채로 남는다.
       기록을 잃은 적이 있는 기능이라(2026-07-27) **세 번까지 다시 시도한다.** */
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Apps Script 는 preflight 를 못 받으므로 text/plain 단순 요청으로
        const r = await fetchT(window.RIW_BACKEND, { method: "POST", headers: { "Content-Type": "text/plain" }, body }, 15000);
        const txt = await r.text();
        const j = txt.trim().startsWith("{") ? JSON.parse(txt) : null;
        if (j && j.ok) { s.hash = h; s.last = Date.now(); s.err = null; put(s); refreshUI(); return true; }
        // 서버가 응답은 했는데 저장은 안 된 경우 — 백엔드가 옛 버전이면 여기로 온다
        lastErr = (j && j.err) ? String(j.err) : tr("app.bk.err.server");
      } catch (_) {
        lastErr = tr("app.bk.err.net");
      }
      if (attempt < 3) await new Promise((res) => setTimeout(res, attempt * 900));
    }
    s.err = lastErr;
    put(s); refreshUI();
    return false;
  }
  function touch() {
    const s = st();
    if (!s.on) { maybeNudge(); return; }
    clearTimeout(timer);
    timer = setTimeout(() => send(false), 4000);         // 연속 저장은 4초 묶음
  }

  /* 처음 기록이 생겼을 때 딱 한 번 권유 */
  function maybeNudge() {
    const s = st();
    if (s.on || s.nudged) return;
    if (!loadCourses().length && !loadScores().length) return;
    s.nudged = true; put(s);
    open();
  }

  async function enable() {
    const s = st();
    if (!s.code) s.code = newCode();
    s.on = true; put(s);
    refreshUI();
    const btn = $("#bk-enable");
    if (btn) { btn.disabled = true; btn.textContent = tr("app.bk.checking"); }
    // ⚠️ 첫 백업이 실제로 저장됐는지 확인하고 나서 '켜짐'이라고 말한다.
    //    (2026-07-27: 백엔드에 백업 기능이 배포되지 않았는데도 '켜짐 · 첫 백업 대기 중'만
    //     계속 떠서, 사용자는 백업된 줄 알고 앱을 지웠다가 기록을 잃었다.)
    const ok = await send(true);
    if (btn) { btn.disabled = false; btn.textContent = tr("app.bk.enable"); }
    if (!ok) { const t = st(); t.on = false; put(t); refreshUI(); }
  }

  async function restore(codeRaw) {
    const code = String(codeRaw || "").replace(/[^0-9]/g, "");
    const msg = $("#bk-restore-msg");
    if (code.length < 10) { msg.textContent = tr("app.bk.code.short"); return; }
    msg.textContent = tr("app.bk.searching");
    let j = null;
    // 저장과 같은 이유로 여기도 다시 시도한다 — 한 번 실패했다고 "기록 없음" 이라
    // 말하면, 있는 기록을 없다고 하는 셈이라 제일 나쁘다.
    for (let attempt = 1; attempt <= 3 && !j; attempt++) {
      try {
        const r = await fetchT(window.RIW_BACKEND + "?fn=restore&k=" + window.RIW_TOK() + "&code=" + code, null, 15000);
        const txt = await r.text();
        j = txt.trim().startsWith("{") ? JSON.parse(txt) : null;
      } catch (_) { j = null; }
      if (!j && attempt < 3) await new Promise((res) => setTimeout(res, attempt * 900));
    }
    if (!j) {
      msg.textContent = tr("app.bk.restore.net");
      return;
    }
    // 백엔드가 restore 를 모르면 기본 응답(service)만 돌아온다 → 코드 탓으로 돌리면 안 된다
    if (j.service && !("data" in j) && !("err" in j)) {
      msg.textContent = tr("app.bk.restore.na");
      return;
    }
    if (!j.ok || !j.data) {
      msg.textContent = tr("app.bk.restore.none");
      return;
    }
    const d = j.data;
    // 합치기 — 지금 폰에 있는 기록은 지우지 않고, 없는 것만 추가한다
    const cur = loadCourses();
    (d.courses || []).forEach((c) => { if (!cur.some((x) => x.name === c.name)) cur.push(c); });
    saveCourses(cur);
    const sc = loadScores();
    (d.scores || []).forEach((r2) => { if (!sc.some((x) => x.id === r2.id)) sc.push(r2); });
    sc.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    saveScores(sc);
    if (d.profile && !Object.keys(loadProfile()).length) saveProfile(d.profile);
    if (d.defaultTee && !localStorage.getItem("riweather.defaultTee"))
      localStorage.setItem("riweather.defaultTee", d.defaultTee);
    // 복구한 기기에서도 같은 코드로 계속 백업하게 이어받는다
    const s = st(); s.code = code; s.on = true; s.hash = null; put(s);
    renderHome();
    refreshUI();
    msg.textContent = tr("app.bk.restore.ok", { courses: cur.length, scores: sc.length });
  }

  function refreshUI() {
    const s = st();
    const codeEl = $("#bk-code"), stateEl = $("#bk-state");
    if (!codeEl) return;
    if (s.on && s.code && s.last) {
      codeEl.textContent = fmt(s.code);
      stateEl.textContent = tr("app.bk.state.on", {
        t: new Date(s.last).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) });
      stateEl.classList.remove("bk-bad");
      $("#bk-enable").hidden = true;
      $("#bk-code-wrap").hidden = false;
    } else if (s.err) {
      // 실패를 감추지 않는다 — 백업된 줄 알고 앱을 지우는 것이 가장 큰 사고다
      stateEl.textContent = tr("app.bk.state.err", { err: s.err });
      stateEl.classList.add("bk-bad");
      $("#bk-enable").hidden = false;
      $("#bk-code-wrap").hidden = true;
    } else {
      stateEl.textContent = tr("app.bk.state.off");
      stateEl.classList.remove("bk-bad");
      $("#bk-enable").hidden = false;
      $("#bk-code-wrap").hidden = true;
    }
  }

  function open() { refreshUI(); $("#backup-sheet").hidden = false; }

  /* ── 앱 지우기 전 확인 ──────────────────────────────────────
     ⚠️ 웹앱은 **사용자가 앱을 지우는 순간을 알 수 없다.** 그래서 지우기 직전에
        자동으로 뜨게 만들 수는 없고, 사용자가 스스로 열어보는 자리를 만든다.
     대신 기록은 있는데 백업이 꺼져 있으면 앱을 켤 때 한 번 먼저 보여준다 —
     "백업된 줄 알고 지웠다가 기록을 잃는" 사고를 막는 것이 목적이다(2026-07-27). */
  function openBye() {
    const s = st();
    const c = loadCourses().length, sc = loadScores().length;
    const desc = $("#bye-desc"), wrap = $("#bye-code-wrap"), msg = $("#bye-msg");
    msg.textContent = "";
    /* ⚠️ 순서가 중요하다 — **백업 켜짐을 가장 먼저 본다.**
       예전엔 '기록 없음'을 먼저 봐서, 이 기기에 저장된 게 없으면 백업이 켜져 있어도
       복구 코드를 감췄다. 새 기기·브라우저 정리 직후가 정확히 그 상태인데,
       그때 서버엔 기록이 남아 있다 — 되살릴 유일한 열쇠를 감추고 "잃을 것 없다"고
       말하는 셈이었다(2026-08-02 발견). 코드는 이용자의 것이니 항상 보여준다. */
    if (s.on && s.code) {
      desc.innerHTML = tr(c || sc ? "app.bye.desc.on" : "app.bye.desc.on.empty");
      $("#bye-code").textContent = fmt(s.code);
      wrap.hidden = false;
      $("#bye-keep").hidden = false;
    } else if (!c && !sc) {
      desc.innerHTML = tr("app.bye.desc.none");
      wrap.hidden = true;
      $("#bye-keep").hidden = true;
    } else {
      desc.innerHTML = tr("app.bye.desc.off", { c, s: sc });
      wrap.hidden = true;
      $("#bye-keep").hidden = false;
    }
    $("#bye-sheet").hidden = false;
  }

  /* '기록해두기' — 말만 하지 않고 **서버에 실제로 올라갔는지 확인하고** 알려준다 */
  async function byeKeep() {
    const btn = $("#bye-keep"), msg = $("#bye-msg");
    btn.disabled = true;
    msg.textContent = tr("app.bye.saving");
    const s = st();
    if (!s.code) { s.code = newCode(); }
    s.on = true; s.hash = null; put(s);
    const ok = await send(true);
    btn.disabled = false;
    refreshUI();
    if (ok) {
      $("#bye-code").textContent = fmt(st().code);
      $("#bye-code-wrap").hidden = false;
      $("#bye-desc").innerHTML = tr("app.bye.desc.on");
      msg.textContent = tr("app.bye.saved");
    } else {
      const t = st(); t.on = false; put(t); refreshUI();
      msg.textContent = tr("app.bye.failed");
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && st().on) send(false);
  });

  return { touch, open, enable, restore, send, openBye, byeKeep };
})();

$("#backup-open")?.addEventListener("click", () => BACKUP.open());
$("#backup-open-empty")?.addEventListener("click", () => BACKUP.open());
$("#bk-enable")?.addEventListener("click", () => BACKUP.enable());
$("#bk-close")?.addEventListener("click", () => { $("#backup-sheet").hidden = true; });
$("#backup-sheet")?.addEventListener("click", (e) => { if (e.target === $("#backup-sheet")) $("#backup-sheet").hidden = true; });
$("#bk-copy")?.addEventListener("click", async () => {
  const t = $("#bk-code").textContent;
  try { await navigator.clipboard.writeText(t); } catch (_) {}
  $("#bk-copy").textContent = tr("app.bk.copied");
  setTimeout(() => { $("#bk-copy").textContent = tr("app.bk.copy"); }, 2000);
});
$("#bk-restore-btn")?.addEventListener("click", () => BACKUP.restore($("#bk-restore-input").value));

/* 앱 지우기 전 확인 */
$("#bye-open")?.addEventListener("click", () => { $("#backup-sheet").hidden = true; BACKUP.openBye(); });
$("#bye-keep")?.addEventListener("click", () => BACKUP.byeKeep());
$("#bye-drop")?.addEventListener("click", () => {
  // 그냥 지우겠다고 해도 **무엇을 잃는지는 분명히 말하고** 닫는다
  const c = loadCourses().length, s = loadScores().length;
  if (c || s) $("#bye-msg").textContent = tr("app.bye.drop.warn");
  setTimeout(() => { $("#bye-sheet").hidden = true; }, c || s ? 1600 : 0);
});
$("#bye-copy")?.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("#bye-code").textContent); } catch (_) {}
  $("#bye-copy").textContent = tr("app.bye.copied");
  setTimeout(() => { $("#bye-copy").textContent = tr("app.bk.copy"); }, 2000);
});
$("#bye-sheet")?.addEventListener("click", (e) => { if (e.target === $("#bye-sheet")) $("#bye-sheet").hidden = true; });

/* ---------- 베타 의견 보내기 ----------
   100명 시험 배포(2026-07-31)용. 들어오는 길은 셋 — 홈의 초대 카드,
   푸터 링크, BETA 배지 탭. 어디서 눌러도 같은 시트가 열린다.
   ⚠️ 이름·연락처는 받지 않는다. 함께 가는 건 앱 버전·기기 종류·현재 화면뿐이고,
      그 사실을 시트 안에 그대로 적어 이용자가 보고 보내게 한다. */
const SCREEN_KO = {
  home: tr("app.screen.home"), hub: tr("app.screen.hub"), detail: tr("app.screen.detail"),
  course: tr("app.screen.course"), food: tr("app.screen.food"), score: tr("app.screen.score"),
  stay: tr("app.screen.stay"), booking: tr("app.screen.booking"), clubfit: tr("app.screen.clubfit"),
};
const FB_UI = (() => {
  let cat = "", stars = 0, sending = false;

  const el = (id) => document.getElementById(id);
  const msg = (text, kind) => {
    const m = el("fb-msg");
    if (!m) return;
    m.hidden = !text;
    m.textContent = text || "";
    m.className = "fb-msg" + (kind ? " " + kind : "");
  };

  function refreshStars() {
    document.querySelectorAll("#fb-stars button").forEach((b) => {
      const on = Number(b.dataset.s) <= stars;
      b.textContent = on ? "★" : "☆";
      b.classList.toggle("on", on);
    });
  }

  function open() {
    cat = ""; stars = 0; sending = false;
    document.querySelectorAll("#fb-cats .pi-chip").forEach((b) => b.classList.remove("on"));
    refreshStars();
    const t = el("fb-text");
    if (t) { t.value = ""; }
    el("fb-count").textContent = "0";
    msg("");
    const send = el("fb-send");
    if (send) { send.disabled = false; send.textContent = tr("app.fb.send"); }

    const dev = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? tr("app.fb.dev.ios")
      : /Android/i.test(navigator.userAgent) ? tr("app.fb.dev.aos") : tr("app.fb.dev.pc");
    const scr = SCREEN_KO[window.__curView] || tr("app.screen.home");
    const waiting = typeof FEEDBACK !== "undefined" ? FEEDBACK.pending() : 0;
    el("fb-note").innerHTML =
      tr("app.fb.note", { ver: APP_VER, dev: dev, screen: scr }) +
      (waiting ? tr("app.fb.note.waiting", { n: waiting }) : "");

    el("fb-sheet").hidden = false;
    if (typeof FEEDBACK !== "undefined") FEEDBACK.flush();   // 밀린 것 먼저 정리
  }

  function close() { el("fb-sheet").hidden = true; }

  async function submit() {
    if (sending) return;
    const text = (el("fb-text").value || "").trim();
    if (!cat) { msg(tr("app.fb.need.cat"), "bad"); return; }
    if (text.length < 5) { msg(tr("app.fb.need.text"), "bad"); return; }

    sending = true;
    const btn = el("fb-send");
    btn.disabled = true; btn.textContent = tr("app.fb.sending");
    msg("");

    const res = await FEEDBACK.send({
      cat, stars, text, screen: window.__curView || "home",
    });

    sending = false;
    btn.disabled = false; btn.textContent = tr("app.fb.send");

    if (res.ok) {
      msg(tr("app.fb.ok"), "ok");
      el("fb-text").value = "";
      el("fb-count").textContent = "0";
      setTimeout(() => { if (!el("fb-sheet").hidden) close(); }, 1800);
      return;
    }
    if (res.limit) {
      msg(tr("app.fb.limit"), "bad");
      return;
    }
    if (res.queued) {
      // 서버에 못 닿았을 뿐 내용은 폰에 남아 있다 — 사라졌다고 오해하지 않게 분명히 말한다
      msg(tr("app.fb.queued"), "bad");
      el("fb-text").value = "";
      el("fb-count").textContent = "0";
      return;
    }
    msg(res.err ? tr("app.fb.fail.err", { err: res.err }) : tr("app.fb.fail"), "bad");
  }

  document.addEventListener("click", (e) => {
    const chip = e.target.closest("#fb-cats .pi-chip");
    if (chip) {
      cat = chip.dataset.cat;
      document.querySelectorAll("#fb-cats .pi-chip").forEach((b) => b.classList.toggle("on", b === chip));
      msg("");
      return;
    }
    const st = e.target.closest("#fb-stars button");
    if (st) { stars = Number(st.dataset.s); refreshStars(); }
  });

  el("fb-text")?.addEventListener("input", (e) => {
    el("fb-count").textContent = String(e.target.value.length);
  });
  el("fb-send")?.addEventListener("click", submit);
  el("fb-close")?.addEventListener("click", close);
  el("fb-sheet")?.addEventListener("click", (e) => { if (e.target === el("fb-sheet")) close(); });

  return { open, close };
})();

$("#fb-open")?.addEventListener("click", () => FB_UI.open());
$("#fb-open-foot")?.addEventListener("click", () => FB_UI.open());
document.querySelector(".beta-badge")?.addEventListener("click", () => FB_UI.open());

/* ---------- 시작 ---------- */
document.querySelector(".beta-badge").textContent = "BETA " + APP_VER;
document.querySelector(".beta-badge").title = tr("app.beta.title");
{ const cv = document.getElementById("consent-ver"); if (cv) cv.textContent = APP_VER; }

/* 버전이 올라갔으면 무엇이 바뀌었는지 잠깐 알려준다 */
(function showUpdateNotice() {
  const KEY = "riweather.lastver";
  const prev = localStorage.getItem(KEY);
  localStorage.setItem(KEY, APP_VER);
  if (!prev || prev === APP_VER) return;      // 첫 실행이거나 같은 버전이면 조용히
  const t = document.getElementById("update-toast");
  if (!t) return;
  document.getElementById("ut-ver").textContent = APP_VER;
  document.getElementById("ut-note").textContent = APP_NOTE || "";
  t.hidden = false;
  const close = () => {
    t.classList.add("hide");
    setTimeout(() => { t.hidden = true; t.classList.remove("hide"); }, 300);
  };
  t.addEventListener("click", close);
  setTimeout(close, 4500);
})();
renderHome();

/* ---------- PWA 자동 업데이트 ----------
 *
 * 목표(사장님 2026-07-31): **앱을 껐다 켜지 않아도** 새 버전이 저절로 적용될 것.
 * 알림(푸시)을 보낼 수 없는 환경이라, 앱이 눈앞에 있을 때 스스로 챙겨야 한다.
 *
 * 예전에 안 되던 이유 세 가지:
 *  ① 새 버전 확인을 **앱을 처음 열 때와 1시간마다**만 했다. 폰에서 홈으로 나갔다
 *     돌아오면 화면은 그대로 살아 있고 스크립트가 다시 돌지 않는다 —
 *     게다가 iOS 는 백그라운드에서 타이머를 멈춰 1시간 간격도 안 온다.
 *     → **화면이 다시 보일 때마다** 확인한다(visibilitychange · pageshow).
 *  ② 첫 방문에도 controllerchange 가 떠서 **쓸데없이 한 번 새로고침**됐다.
 *     → 원래 컨트롤러가 있었을 때(= 진짜 업데이트)만 새로고침한다.
 *  ③ 피팅 문항을 채우는 도중에 새로고침되면 답이 다 날아간다.
 *     → 그런 화면에서는 **미뤘다가** 빠져나오는 순간 적용한다.
 */
if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;   // 첫 설치인지 업데이트인지
  let reloading = false, pending = false;

  /* 지금 새로고침하면 사용자가 하던 걸 잃는 화면인가 */
  const busy = () => {
    const v = viewStack[viewStack.length - 1];
    if (v === "clubfit") {
      // 결과 화면까지 간 상태면 잃을 게 없다 — 문항을 채우는 중일 때만 미룬다
      return !document.querySelector("#cf-screen [data-savebag]");
    }
    if (v === "score") return !!document.querySelector("#score-form:not([hidden])");
    return false;
  };

  const applyUpdate = () => {
    if (reloading) return;
    if (busy()) { pending = true; return; }     // 하던 일이 끝나면 그때
    reloading = true;
    location.reload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;                 // 첫 설치는 새로고침할 이유가 없다
    applyUpdate();
  });

  navigator.serviceWorker.register("sw.js").then((reg) => {
    const check = () => { try { reg.update(); } catch (_) {} };
    check();
    /* 화면이 다시 보일 때마다 확인 — 이게 "껐다 켜지 않아도" 를 만드는 핵심이다.
       너무 잦은 호출은 의미가 없으니 30초 안에 두 번은 건너뛴다. */
    let last = 0;
    const checkThrottled = () => {
      const now = Date.now();
      if (now - last < 30000) return;
      last = now;
      check();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      checkThrottled();
      if (pending && !busy()) { pending = false; applyUpdate(); }
    });
    window.addEventListener("pageshow", checkThrottled);   // iOS 복원(bfcache)
    window.addEventListener("focus", checkThrottled);
    setInterval(check, 30 * 60 * 1000);                    // 계속 켜둔 경우 대비
  }).catch(() => {});

  /* 미뤄둔 업데이트를 놓치지 않도록 — 화면을 옮길 때마다 적용 가능한지 본다.
     showOnly() 가 이 함수를 불러준다(피팅 문항을 빠져나오는 순간이 여기다). */
  window.__applyPendingUpdate = () => {
    if (pending && !busy()) { pending = false; applyUpdate(); }
  };
  window.addEventListener("popstate", window.__applyPendingUpdate);
}
