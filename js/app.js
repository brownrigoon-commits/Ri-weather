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
/* 429(요청 한도) 등 일시적 실패 시 재시도 */
async function fetchJSON(url, { retries = 2, delay = 1200 } = {}) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise((r) => setTimeout(r, delay * (attempt + 1)));
      continue;
    }
    if (res.ok) return res.json();
    // 429/503 등은 잠시 후 재시도
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await new Promise((r) => setTimeout(r, delay * (attempt + 1)));
      continue;
    }
    throw new Error("HTTP " + res.status);
  }
}

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
  return fetchJSON(url, { retries: 3, delay: 1500 }); // 메인 날씨는 반드시 성공하도록
}

async function fetchAir(lat, lon) {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.search = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: "pm10,pm2_5",
    timezone: "Asia/Seoul",
  });
  return fetchJSON(url, { retries: 1 });
}

/* 전국 격자(약 0.5°)의 시간별 강수 예보 — 예보 지도 렌더링용 */
/* 예보 격자 — 선택한 지점을 중심으로 동적 생성 (해외 골프장도 그대로 동작) */
const GRID_STEP = 0.5; // 약 55km 간격 — API 요청량을 줄여 한도(429) 회피
function makeGrid(centerLat, centerLon) {
  const halfLat = 3.0, halfLon = 3.5; // 선택 지점 중심 약 ±350km 커버
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

async function fetchPrecipGrid(GRID) {
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
      timezone: "Asia/Seoul",
      forecast_days: "3",
    });
    jobs.push(fetchJSON(url, { retries: 2, delay: 1500 }));
  }
  const parts = await Promise.all(jobs);
  return parts.flatMap((p) => (Array.isArray(p) ? p : [p]));
}

async function searchPlaces(q) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q, format: "jsonv2", "accept-language": "ko",
    countrycodes: "kr,jp,cn", limit: "8",
  });
  const res = await fetch(url);
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
    lat, lon, format: "jsonv2", "accept-language": "ko", zoom: "10",
  });
  const res = await fetch(url);
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
  if (mmh < 0.1) return ["비 걱정 없어요", "grade-good"];
  if (mmh < 0.5) return ["이슬비 — 라운딩 가능, 우비 챙기세요", "grade-normal"];
  if (mmh < 3)   return ["우산·우비 필수, 그린이 느려져요", "grade-bad"];
  if (mmh < 8)   return ["라운딩이 힘든 비예요", "grade-worst"];
  return ["폭우 — 라운딩 불가 수준", "grade-worst"];
}
function evalHumidity(rh) {
  if (rh < 40) return ["건조 — 공이 잘 날아가요", "grade-good"];
  if (rh < 65) return ["쾌적한 라운딩 습도예요", "grade-good"];
  if (rh < 80) return ["약간 습해요 — 수건 챙기세요", "grade-normal"];
  if (rh < 90) return ["습해서 땀이 잘 안 말라요", "grade-bad"];
  return ["매우 습함 — 그립 미끄러짐 주의", "grade-worst"];
}
function evalWind(ms) {
  if (ms < 2) return ["바람 영향 거의 없어요", "grade-good"];
  if (ms < 4) return ["약풍 — 반 클럽 정도 영향", "grade-good"];
  if (ms < 6) return ["한 클럽 더 잡으세요", "grade-normal"];
  if (ms < 9) return ["강풍 — 두 클럽 이상 봐야 해요", "grade-bad"];
  return ["매우 강한 바람 — 라운딩 힘들어요", "grade-worst"];
}
function evalVis(km) {
  if (km >= 10) return ["시야 좋음 — 공 끝까지 보여요", "grade-good"];
  if (km >= 5)  return ["약간 뿌옇지만 지장 없어요", "grade-normal"];
  if (km >= 2)  return ["연무 — 공 찾기 어려울 수 있어요", "grade-bad"];
  return ["짙은 안개 — 낙하지점이 안 보여요", "grade-worst"];
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
    card.addEventListener("click", () => openHub(c));
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

/* Nominatim 결과의 행정 단위 → 한글 라벨 */
const ADDR_TYPE_KO = {
  province: "도", state: "도", city: "시", county: "군", borough: "구",
  town: "읍·면", village: "리·마을", suburb: "동", neighbourhood: "동네",
  hamlet: "마을", road: "도로", building: "건물", house: "건물",
  amenity: "시설", leisure: "시설",
};

function renderResultItem(entry) {
  const li = document.createElement("li");
  const flag = entry.flag ? entry.flag + " " : "";
  const tag = entry.golf
    ? '<span class="r-tag">⛳ 골프장</span>'
    : `<span class="r-tag r-tag-area">📍 ${entry.typeKo || "지역"}</span>`;
  const note = entry.centerNote
    ? ' <span class="r-note">· 해당 지역 중심 기준</span>' : "";
  const sub = entry.addr || entry.alias || "";
  li.innerHTML = `
    <div class="r-name">${flag}${entry.name}${tag}</div>
    ${sub || note ? `<div class="r-addr">${sub}${note}</div>` : ""}`;
  li.addEventListener("click", () => {
    hideSearchUI();
    searchInput.value = "";
    searchClear.hidden = true;
    openHub({ id: entry.id, name: entry.name, addr: entry.addr || "", lat: entry.lat, lon: entry.lon });
  });
  return li;
}

const runSearch = debounce(async (q) => {
  if (q.length < 2) { hideSearchUI(); return; }

  /* 1) 내장 골프장 DB — 즉시 표시 (한글 표기명 우선) */
  const golf = searchGolfDB(q).map((g) => ({
    id: "gdb-" + g.lat + "," + g.lon,
    name: g.k || g.n,                       // 한국어 우선
    addr: "", lat: g.lat, lon: g.lon, golf: true,
    flag: COUNTRY_FLAG[g.c] || "",
    alias: g.k ? g.n : (g.a ? g.a.split(" ")[0] : ""),  // 부제: 현지어 원어명
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
      const typeKo = ADDR_TYPE_KO[r.addresstype] || ADDR_TYPE_KO[r.type] || "지역";
      // 검색어에 번지 등 숫자가 있는데 마을/동 단위로만 매칭된 경우 안내
      const centerNote = /\d/.test(q) && /리·마을|동|읍·면|마을|동네/.test(typeKo);
      return {
        id: "osm-" + r.place_id, name, addr, typeKo, centerNote,
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

/* ---------- 화면 전환 (뒤로가기 스택 + 스와이프) ---------- */
const VIEWS = {
  home: homeView, hub: $("#hub-view"), detail: detailView,
  course: $("#course-view"), food: $("#food-view"), score: $("#score-view"),
};
let viewStack = ["home"];

function showOnly(name) {
  for (const k in VIEWS) VIEWS[k].hidden = k !== name;
  window.scrollTo(0, 0);
  if (name !== "detail") stopPlay();
  if (name === "home") renderHome();
}
function pushView(name) {
  viewStack.push(name);
  showOnly(name);
  history.pushState({ depth: viewStack.length }, "");
}
let lastPopAt = 0;
window.addEventListener("popstate", () => {
  lastPopAt = Date.now();
  if (viewStack.length > 1) {
    viewStack.pop();
    showOnly(viewStack[viewStack.length - 1]);
  }
});
function goBack() {
  if (viewStack.length > 1) history.back();
}
document.querySelectorAll(".btn-back-any").forEach((b) => b.addEventListener("click", goBack));

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
  $("#hub-name").textContent = course.name;
  $("#hub-title-mini").textContent = course.name;
  $("#hub-addr").textContent = course.addr || "";
  $("#hub-now").textContent = "";
  refreshStars();

  if (!course.addr) {
    reverseGeocode(course.lat, course.lon).then((addr) => {
      if (currentCourse !== course || !addr) return;
      course.addr = addr;
      $("#hub-addr").textContent = addr;
      const list = loadCourses();
      const saved = list.find((c) => c.id === course.id);
      if (saved && !saved.addr) { saved.addr = addr; saveCourses(list); }
    }).catch(() => {});
  }
  fetchForecast(course.lat, course.lon).then((d) => {
    if (currentCourse !== course) return;
    $("#hub-now").innerHTML =
      `<b>${Math.round(d.current.temperature_2m)}°</b> ${wmoDesc(d.current.weather_code)}` +
      ` · 최고 ${Math.round(d.daily.temperature_2m_max[0])}° 최저 ${Math.round(d.daily.temperature_2m_min[0])}°`;
  }).catch(() => {});
  prefetchFood(course); // 맛집 메뉴를 누르기 전에 미리 로딩 → 즉시 표시

  pushView("hub");
}

document.querySelectorAll(".hub-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const m = btn.dataset.menu;
    if (m === "weather") openDetail(currentCourse);
    else if (m === "course") openCourseView();
    else if (m === "food") openFoodView();
    else if (m === "score") openScoreView();
  });
});

// 스크롤 시 상단 미니 타이틀 표시
window.addEventListener("scroll", () => {
  $("#detail-title-mini").classList.toggle("show", window.scrollY > 140);
});

async function openDetail(course) {
  currentCourse = course;
  if (viewStack[viewStack.length - 1] !== "detail") pushView("detail"); // 재시도 시 중복 방지
  refreshStars();

  $("#hero-name").textContent = course.name;
  $("#detail-title-mini").textContent = course.name;
  $("#hero-addr").textContent = course.addr || "";
  $("#hero-temp").textContent = "--°";
  $("#hero-desc").textContent = "불러오는 중...";
  $("#hero-minmax").textContent = "";
  $("#summary-text").textContent = "예보를 불러오는 중입니다...";
  $("#hourly-scroll").innerHTML = "";
  $("#precip-scroll").innerHTML = "";

  updateDistCard(course);      // 내 위치 → 골프장 거리/이동시간
  resetMapState(course);
  initRadar();                 // 실황 레이더 프레임 로드 (백그라운드)
  const airP = fetchAir(course.lat, course.lon).catch(() => null);

  let data;
  try {
    data = await fetchForecast(course.lat, course.lon);
  } catch (e) {
    $("#hero-desc").textContent = "일시적으로 불러오지 못했습니다";
    $("#summary-text").innerHTML =
      '날씨 데이터를 일시적으로 불러오지 못했습니다.<br>' +
      '<button class="retry-btn" id="btn-retry">다시 시도</button>';
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
  return m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

function updateDistCard(course) {
  const el = $("#dist-content");
  const fresh = userPos && Date.now() - userPosAt < 300000; // 5분 캐시
  if (fresh) { renderDist(course, el); return; }
  // 권한이 이미 허용돼 있으면 자동, 아니면 버튼으로 요청
  const ask = () => {
    el.innerHTML = '<span class="dist-loading">📍 내 위치 확인 중...</span>';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userPos = [pos.coords.latitude, pos.coords.longitude];
        userPosAt = Date.now();
        if (currentCourse === course) renderDist(course, el);
      },
      () => {
        el.innerHTML = '<button class="dist-btn">📍 위치 권한이 꺼져 있어요 — 다시 시도</button>';
        el.querySelector(".dist-btn").addEventListener("click", ask);
      },
      { timeout: 9000, maximumAge: 300000 }
    );
  };
  if (!("geolocation" in navigator)) { el.innerHTML = ""; return; }
  if (navigator.permissions?.query) {
    navigator.permissions.query({ name: "geolocation" })
      .then((p) => {
        if (p.state === "granted") ask();
        else {
          el.innerHTML = '<button class="dist-btn">📍 내 위치에서 거리·이동시간 보기</button>';
          el.querySelector(".dist-btn").addEventListener("click", ask);
        }
      })
      .catch(ask);
  } else { ask(); }
}

async function renderDist(course, el) {
  const straight = distM(userPos, [course.lat, course.lon]);
  // 카카오맵 앱의 길안내를 직접 실행 (키 불필요 · 웹 중간 페이지 없음)
  const kakaoUrl = `kakaomap://route?ep=${course.lat},${course.lon}&by=CAR`;
  const tmapUrl = `tmap://route?goalname=${encodeURIComponent(course.name)}&goaly=${course.lat}&goalx=${course.lon}`;
  const show = (km, mins, approx) => {
    el.innerHTML = `
      <div class="dist-main">🚗 내 위치에서 <b>${km}km</b> · 차로 약 <b>${mins}</b>
        <small>${approx ? "직선거리 기준 추정" : "실제 도로 경로 기준"}</small>
      </div>
      <div class="dist-navs">
        <a class="dist-nav kakao" href="${kakaoUrl}">카카오내비</a>
        <a class="dist-nav tmap" href="${tmapUrl}">T맵</a>
      </div>`;
  };
  const key = userPos[0].toFixed(3) + "|" + course.lat.toFixed(4) + "," + course.lon.toFixed(4);
  const cached = routeCache.get(key);
  if (cached) { show(cached.km, cached.mins, cached.approx); return; }

  el.innerHTML = '<span class="dist-loading">🚗 이동 시간 계산 중...</span>';
  try {
    const r = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${userPos[1]},${userPos[0]};${course.lon},${course.lat}?overview=false`);
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
  setEval("#m-precip-eval", evalPrecip(cur.precipitation ?? 0));
  $("#m-precip-sub").textContent = `오늘 예상 누적 ${todayPrecip ?? 0}mm`;

  const curIdx = Math.max(0, startIdx);
  $("#m-humidity").innerHTML = `${cur.relative_humidity_2m}<small> %</small>`;
  setEval("#m-humidity-eval", evalHumidity(cur.relative_humidity_2m));
  $("#m-humidity-sub").textContent = `이슬점 ${Math.round(d.hourly.dew_point_2m[curIdx])}° · 체감 ${Math.round(cur.apparent_temperature)}°`;

  const ws = Math.round(cur.wind_speed_10m * 10) / 10;
  const gust = Math.round(cur.wind_gusts_10m * 10) / 10;
  $("#m-wind").innerHTML = `${ws}<small> m/s</small>`;
  setEval("#m-wind-eval", evalWind(ws));
  $("#m-wind-arrow").style.transform = `rotate(${(cur.wind_direction_10m + 180) % 360}deg)`;
  $("#m-wind-sub").textContent = `${windDirKo(cur.wind_direction_10m)}풍 · 돌풍 ${gust}m/s`;

  const visKm = d.hourly.visibility[curIdx] / 1000;
  $("#m-vis").innerHTML = `${visKm >= 10 ? Math.round(visKm) : visKm.toFixed(1)}<small> km</small>`;
  setEval("#m-vis-eval", evalVis(visKm));
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

/* 주요 도시 라벨 (현지 언어) — 지도에 한글/일본어/중국어로 표시 */
const CITY_LABELS = [
  // 한국
  ["서울", 37.566, 126.978], ["인천", 37.456, 126.705], ["수원", 37.263, 127.029],
  ["춘천", 37.881, 127.730], ["강릉", 37.752, 128.876], ["대전", 36.351, 127.385],
  ["청주", 36.642, 127.489], ["천안", 36.815, 127.114], ["전주", 35.824, 127.148],
  ["광주", 35.160, 126.851], ["목포", 34.812, 126.392], ["여수", 34.760, 127.662],
  ["대구", 35.872, 128.601], ["안동", 36.568, 128.730], ["포항", 36.019, 129.343],
  ["부산", 35.180, 129.076], ["울산", 35.538, 129.311], ["창원", 35.228, 128.681],
  ["제주", 33.500, 126.531], ["원주", 37.342, 127.920],
  // 일본 (한글 표기)
  ["도쿄", 35.690, 139.692], ["오사카", 34.694, 135.502], ["나고야", 35.181, 136.907],
  ["삿포로", 43.062, 141.354], ["후쿠오카", 33.590, 130.402], ["센다이", 38.268, 140.872],
  ["히로시마", 34.386, 132.456], ["교토", 35.012, 135.768], ["니가타", 37.916, 139.036],
  ["나하", 26.212, 127.681], ["가고시마", 31.560, 130.558], ["치토세", 42.821, 141.652],
  // 중국 (한글 표기)
  ["베이징", 39.905, 116.407], ["상하이", 31.230, 121.474], ["광저우", 23.129, 113.264],
  ["선전", 22.543, 114.058], ["청두", 30.573, 104.067], ["항저우", 30.274, 120.155],
  ["난징", 32.060, 118.796], ["칭다오", 36.067, 120.383], ["다롄", 38.914, 121.615],
  ["톈진", 39.343, 117.361], ["우한", 30.593, 114.305], ["시안", 34.342, 108.940],
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
  // 라벨 없는 다크 지도 (영문 지명 제거)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OSM &copy; CARTO",
    subdomains: "abcd", maxZoom: 15, minZoom: 5,
  }).addTo(map);
  // 현지 언어 도시 라벨을 강수 오버레이 위에 표시
  const labelPane = map.createPane("labels");
  labelPane.style.zIndex = 450;
  labelPane.style.pointerEvents = "none";
  CITY_LABELS.forEach(([name, la, lo]) => {
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
  $("#radar-updated").textContent = "예보 지도 생성 중...";
  const GRID = makeGrid(currentCourse.lat, currentCourse.lon); // 골프장 중심 격자
  const cacheKey = currentCourse.lat.toFixed(2) + "," + currentCourse.lon.toFixed(2);
  const openedFor = currentCourse;
  let grid = gridCache.get(cacheKey);
  if (!grid) {
    try {
      grid = await fetchPrecipGrid(GRID);
      gridCache.set(cacheKey, grid);
      if (gridCache.size > 12) gridCache.delete(gridCache.keys().next().value);
    } catch {
      $("#radar-updated").textContent = "예보 지도는 잠시 후 다시 시도됩니다";
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

let courseMap = null, courseLayers = [], holeLayers = [], courseHoles = [], courseHazards = [];
const courseCache = new Map();

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
  $("#course-title").textContent = course.name;
  $("#course-status").textContent = "코스 데이터 불러오는 중...";
  $("#hole-list-card").hidden = true;
  $("#hole-detail-card").hidden = true;
  $("#course-note").hidden = true;
  ensureCourseMap(course.lat, course.lon);
  clearCourseLayers();
  setTimeout(() => courseMap.invalidateSize(), 60);

  const key = course.lat.toFixed(4) + "," + course.lon.toFixed(4);
  let data = courseCache.get(key);
  if (!data) {
    try {
      data = await overpassQuery(
        `[out:json][timeout:25];way["golf"~"hole|green|tee|fairway|bunker|water_hazard|lateral_water_hazard"](around:1500,${course.lat},${course.lon});out geom;`);
      courseCache.set(key, data);
    } catch {
      $("#course-status").textContent = "";
      $("#course-note").textContent = "코스 데이터 서버가 혼잡합니다. 잠시 후 다시 열어주세요.";
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

  courseHoles = ways.filter((w) => w.tags.golf === "hole")
    .map((w) => ({
      ref: w.tags.ref || "?", par: parseInt(w.tags.par) || 0,
      name: w.tags.name || "", line: pts(w),
    }))
    .sort((a, b) => (parseInt(a.ref) || 99) - (parseInt(b.ref) || 99));

  if (!courseHoles.length) {
    $("#course-status").textContent = "위성 전경";
    $("#course-note").innerHTML =
      "이 골프장은 아직 홀별 상세 데이터가 지도에 등록되지 않았습니다.<br>위성 지도로 코스 전경을 확인하실 수 있어요.";
    $("#course-note").hidden = false;
    return;
  }

  // 홀 라인 + 그리드
  const allBounds = L.latLngBounds(courseHoles.flatMap((h) => h.line));
  courseHoles.forEach((h) => {
    courseLayers.push(L.polyline(h.line, { color: "#ffffff", weight: 2, dashArray: "6 6", opacity: 0.85 }).addTo(courseMap));
  });
  courseMap.fitBounds(allBounds.pad(0.08));
  $("#course-status").textContent = courseHoles.length + "개 홀 등록됨";

  const grid = $("#hole-grid");
  grid.innerHTML = "";
  courseHoles.forEach((h, i) => {
    h.len = Math.round(lineLen(h.line));
    if (!h.par) h.par = h.len < 230 ? 3 : h.len < 430 ? 4 : 5;
    const b = document.createElement("button");
    b.className = "hole-btn";
    b.innerHTML = `${h.ref}<small>파${h.par}</small>`;
    b.addEventListener("click", () => selectHole(i));
    grid.appendChild(b);
  });
  $("#hole-list-card").hidden = false;

  function selectHole(i) {
    const h = courseHoles[i];
    grid.querySelectorAll(".hole-btn").forEach((b, j) => b.classList.toggle("active", j === i));
    holeLayers.forEach((l) => courseMap.removeLayer(l));
    holeLayers = [];
    holeLayers.push(L.polyline(h.line, { color: "#34d399", weight: 4, opacity: 0.95 }).addTo(courseMap));
    const tee = h.line[0], green = h.line[h.line.length - 1];
    holeLayers.push(L.marker(tee, { icon: L.divIcon({ className: "", html: '<div class="course-dot" style="background:#fff59d"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false }).addTo(courseMap));
    holeLayers.push(L.marker(green, { icon: L.divIcon({ className: "", html: "⛳", iconSize: [20, 20], iconAnchor: [10, 18] }), interactive: false }).addTo(courseMap));
    courseMap.fitBounds(L.latLngBounds(h.line).pad(0.25));

    // 공략 요약 자동 생성
    const nearLine = (pt) => h.line.some((v) => distM(v, pt) < 70);
    const nb = bunkers.filter(nearLine).length;
    const nw = waters.filter(nearLine).length;
    const mid = h.line[Math.floor(h.line.length / 2)];
    const turn = ((bearing(mid, green) - bearing(tee, mid) + 540) % 360) - 180;
    let txt = `파${h.par} · 약 ${h.len}m. `;
    if (Math.abs(turn) > 28) {
      txt += `${turn > 0 ? "오른쪽" : "왼쪽"} 도그레그 홀입니다 — 티샷은 코너 ${turn > 0 ? "왼쪽" : "오른쪽"} 페어웨이를 노리세요. `;
    } else {
      txt += "비교적 직선 홀 — 페어웨이 센터를 공략하세요. ";
    }
    if (nw) txt += `워터해저드가 ${nw}곳 걸려 있어 무리한 공략보다 안전한 레이업을 고려하세요. `;
    if (nb) txt += `벙커 ${nb}개가 배치되어 있습니다 — 지도의 노란 구역을 피해 가세요.`;
    if (!nw && !nb) txt += "큰 해저드는 없는 홀입니다.";
    $("#hole-detail-title").textContent = `${h.ref}번홀 공략` + (h.name ? ` · ${h.name}` : "");
    $("#hole-strategy").textContent = txt;
    $("#hole-video").href = "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(`${course.name} ${h.ref}번홀 공략`);
    $("#hole-detail-card").hidden = false;
  }
  selectHole(0);
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

// 맛집 화면이 오류 상태로 보이는 중에 앱으로 돌아오면 자동 재시도
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && viewStack[viewStack.length - 1] === "food" && !$("#food-note").hidden) {
    openFoodView();
  }
});

async function openFoodView() {
  const course = currentCourse;
  if (viewStack[viewStack.length - 1] !== "food") pushView("food");
  $("#food-title").textContent = "주변맛집";
  $("#food-desc").textContent = `${course.name} 주변 5km 이내 식당`;
  const listEl = $("#food-list");
  listEl.innerHTML = '<p class="loading-line">주변 식당을 찾는 중...</p>';
  $("#food-note").hidden = true;

  let data;
  try {
    data = await fetchFoodData(course);
  } catch {
    listEl.innerHTML = "";
    const note = $("#food-note");
    note.innerHTML = "식당 데이터 서버가 혼잡합니다.<br>";
    const b = document.createElement("button");
    b.className = "retry-btn";
    b.textContent = "다시 시도";
    b.addEventListener("click", () => openFoodView());
    note.appendChild(b);
    note.hidden = false;
    return;
  }
  if (currentCourse !== course || viewStack[viewStack.length - 1] !== "food") return;
  $("#food-note").hidden = true;

  const region = (course.addr || "").split(" ").slice(0, 2).join(" ");
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

  listEl.innerHTML = "";
  if (!items.length) {
    $("#food-note").innerHTML = "주변 5km 안에 등록된 식당 데이터가 없습니다.<br>아래 버튼으로 카카오맵에서 바로 찾아보세요.";
    $("#food-note").hidden = false;
    const a = document.createElement("a");
    a.className = "video-btn";
    a.style.margin = "0 4px";
    a.target = "_blank"; a.rel = "noopener";
    a.textContent = "🗺 카카오맵에서 주변 맛집 검색";
    a.href = "https://map.kakao.com/link/search/" + encodeURIComponent(region + " 맛집");
    listEl.appendChild(a);
    return;
  }

  items.forEach((it) => {
    const [cuiKo, emoji] = cuisineInfo(it.tags.cuisine);
    const km = it.dist < 950 ? Math.round(it.dist) + "m" : (it.dist / 1000).toFixed(1) + "km";
    const addr = it.tags["addr:full"] ||
      [it.tags["addr:city"], it.tags["addr:district"], it.tags["addr:street"], it.tags["addr:housenumber"]].filter(Boolean).join(" ");
    const div = document.createElement("div");
    div.className = "food-item";
    div.innerHTML = `
      <div class="fi-row">
        <span class="fi-emoji">${emoji}</span>
        <div style="flex:1;min-width:0">
          <div class="fi-name">${it.name}</div>
          <div class="fi-sub">${cuiKo}</div>
        </div>
        <span class="fi-dist">${km}</span>
      </div>
      <div class="fi-detail">
        ${addr ? "📍 " + addr + "<br>" : ""}
        ${it.tags.phone || it.tags["contact:phone"] ? "📞 " + (it.tags.phone || it.tags["contact:phone"]) + "<br>" : ""}
        ${it.tags.opening_hours ? "🕐 " + it.tags.opening_hours + "<br>" : ""}
        골프장에서 <b>${km}</b> 거리 · <span class="fi-verify">방문 전 아래에서 영업 여부를 확인하세요</span>
        <div class="fi-links">
          <a class="kakao" href="kakaomap://search?q=${encodeURIComponent(it.name)}&p=${it.lat},${it.lon}">카카오맵 (영업·사진)</a>
          <a class="naver" target="_blank" rel="noopener" href="https://search.naver.com/search.naver?query=${encodeURIComponent(region + " " + it.name)}">네이버 검색</a>
        </div>
        <div class="fi-links">
          <a class="kakaonavi" href="kakaomap://route?ep=${it.lat},${it.lon}&by=CAR">🚗 카카오 길안내</a>
          <a class="tmapnavi" href="tmap://route?goalname=${encodeURIComponent(it.name)}&goaly=${it.lat}&goalx=${it.lon}">🚗 T맵</a>
        </div>
      </div>`;
    div.querySelector(".fi-row").addEventListener("click", () => div.classList.toggle("open"));
    listEl.appendChild(div);
  });
}

/* =========================================================
 * MY스코어 — 라운딩 기록 + 그날 날씨 자동 저장
 * ========================================================= */
const SCORE_KEY = "riweather.scores.v1";
const GOAL_KEY = "riweather.goalhandi.v1";
const loadScores = () => { try { return JSON.parse(localStorage.getItem(SCORE_KEY)) || []; } catch { return []; } };
const saveScores = (l) => localStorage.setItem(SCORE_KEY, JSON.stringify(l));

let editingId = null;       // 수정 중인 기록 id
let selectedYear = "전체";
let photoThumb = null;      // 첨부 사진 (압축본)

function openScoreView() {
  pushView("score");
  resetScoreForm();
  $("#score-form").hidden = true;
  renderScores();
}
function resetScoreForm() {
  editingId = null;
  photoThumb = null;
  $("#sf-title").textContent = "라운딩 기록 추가";
  $("#sf-date").value = new Date().toISOString().slice(0, 10);
  $("#sf-time").value = ""; $("#sf-time-unknown").checked = false; $("#sf-time").disabled = false;
  $("#sf-course").value = currentCourse ? currentCourse.name : "";
  $("#sf-score").value = ""; $("#sf-memo").value = "";
  $("#sf-front").value = ""; $("#sf-back").value = ""; $("#sf-tee").value = "";
  ["#sf-f1", "#sf-f2", "#sf-f3", "#sf-f4"].forEach((s) => { $(s).value = ""; });
  holeInputs.forEach((i) => { i.value = ""; });
  $("#holes-grid").hidden = true; $("#hg-sum").textContent = "";
  $("#sf-photo-preview").hidden = true;
  $("#ocr-status").hidden = true; $("#ocr-chips").hidden = true;
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
  $("#hg-sum").textContent = `전반 ${36 + f} · 후반 ${36 + b} · 합계 ${72 + f + b}타`;
}

/* ---------- 스코어보드 사진 AI 인식 ---------- */
let ocrWorkerP = null;
function getOcrWorker() {
  if (!ocrWorkerP) {
    ocrWorkerP = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js";
      s.onload = () => resolve(Tesseract.createWorker("eng"));
      s.onerror = reject;
      document.head.appendChild(s);
    }).then((p) => p);
  }
  return ocrWorkerP;
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

    // AI 숫자 인식
    const st = $("#ocr-status");
    st.hidden = false;
    st.textContent = "🤖 AI가 스코어보드를 읽는 중... (10~20초)";
    try {
      const worker = await getOcrWorker();
      const { data } = await worker.recognize(photoThumb);
      const nums = [...new Set((data.text.match(/\d{2,3}/g) || [])
        .map(Number).filter((n) => n >= 55 && n <= 150))];
      if (nums.length) {
        st.textContent = "✅ 인식된 스코어 후보 — 본인 총타수를 탭하세요";
        const chips = $("#ocr-chips");
        chips.innerHTML = '<span class="chip-label"></span>';
        nums.sort((a, b) => a - b).slice(0, 8).forEach((n) => {
          const b = document.createElement("button");
          b.type = "button"; b.className = "ocr-chip"; b.textContent = n + "타";
          b.addEventListener("click", () => { $("#sf-score").value = n; });
          chips.appendChild(b);
        });
        chips.hidden = false;
      } else {
        st.textContent = "숫자를 인식하지 못했어요 — 아래에 직접 입력해 주세요 (사진은 기록에 첨부됩니다)";
      }
    } catch {
      st.textContent = "AI 인식 실패 — 직접 입력해 주세요 (사진은 기록에 첨부됩니다)";
    }
  };
  img.src = url;
});

$("#score-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#sf-save-btn");
  btn.disabled = true; btn.textContent = "저장 중...";
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
        wind_speed_unit: "ms", timezone: "Asia/Seoul",
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
    alert("저장 공간이 부족해 사진 없이 저장했습니다.");
  }
  btn.disabled = false; btn.textContent = "저장 (그날 날씨 자동 기록)";
  $("#score-form").hidden = true;
  renderScores();
});

/* ---------- 통계: 평균·핸디·목표 ---------- */
function calcStats(records) {
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
    b.textContent = y === "전체" ? "전체" : y + "년";
    b.addEventListener("click", () => { selectedYear = y; renderScores(); });
    tabs.appendChild(b);
  });

  const filtered = selectedYear === "전체" ? all : all.filter((r) => r.date.startsWith(selectedYear));
  const st = calcStats(filtered);
  $("#st-avg").textContent = st ? st.avg : "-";
  $("#st-rounds").textContent = st ? `${selectedYear === "전체" ? "전체" : selectedYear + "년"} ${st.n}라운드` : "";
  $("#st-handi").textContent = st ? st.handi : "-";

  const goal = localStorage.getItem(GOAL_KEY);
  $("#st-goal").textContent = goal ?? "설정";
  $("#st-gap").textContent = goal && st ? `현재와 ${Math.round((st.handi - goal) * 10) / 10}타 차이` : "탭해서 설정";
  return filtered;
}
$("#goal-box").addEventListener("click", () => {
  const cur = localStorage.getItem(GOAL_KEY) || "";
  const v = prompt("최종 목표 핸디를 입력하세요 (예: 3)", cur);
  if (v === null) return;
  const n = parseFloat(v);
  if (isNaN(n) || n < 0 || n > 54) { alert("0~54 사이 숫자로 입력해 주세요."); return; }
  localStorage.setItem(GOAL_KEY, String(n));
  renderScores();
});

/* 스코어카드 표 (홀별 입력이 있는 기록) — 스마트스코어 스타일 */
function scorecardHtml(r) {
  const f = r.holes.slice(0, 9), b = r.holes.slice(9);
  const sum = (a) => a.reduce((s, x) => s + (x || 0), 0);
  const cell = (v) =>
    `<span class="sc-c${v > 0 ? " over" : v < 0 ? " under" : ""}">${v == null ? "·" : v > 0 ? "+" + v : v}</span>`;
  const head = Array.from({ length: 9 }, (_, i) => `<span>${i + 1}</span>`).join("");
  return `<div class="sc-table">
    <div class="sc-head"><span>HOLE</span>${head}<span>T</span></div>
    <div class="sc-row"><span>${r.front || "전반"}</span>${f.map(cell).join("")}<span class="sc-t">${36 + sum(f)}</span></div>
    <div class="sc-row"><span>${r.back || "후반"}</span>${b.map(cell).join("")}<span class="sc-t">${36 + sum(b)}</span></div>
  </div>`;
}

function renderScores() {
  const all = loadScores();
  const filtered = renderStats(all) || [];
  const el = $("#score-list");
  el.innerHTML = "";
  $("#score-empty").hidden = all.length > 0;
  const list = selectedYear === "전체" ? all : filtered;
  list.forEach((r) => {
    const div = document.createElement("div");
    div.className = "score-item";
    const wx = r.wx
      ? `<div class="si-wx">
           <span>${wmoIcon(r.wx.code)} ${wmoDesc(r.wx.code)}</span>
           <span>🌡 ${r.wx.tmin}~${r.wx.tmax}°</span>
           <span>🌧 ${r.wx.rain}mm</span>
           <span>🌬 최대 ${r.wx.wind}m/s</span>
         </div>` : "";
    div.innerHTML = `
      <button class="si-edit" aria-label="수정">✏️</button>
      <button class="si-del" aria-label="삭제">✕</button>
      <div class="si-top">
        <div>
          <div class="si-course">${r.course}</div>
          <div class="si-date">${r.date}${r.teeTime ? " · ⛳ " + r.teeTime + " 티업" : ""}${r.tee ? " · " + r.tee + "티" : ""}</div>
        </div>
        <div class="si-score">${r.score}<small>타</small></div>
      </div>
      ${r.friends ? `<div class="si-friends">👥 ${r.friends}</div>` : ""}
      ${r.memo ? `<div class="si-memo">"${r.memo}"</div>` : ""}
      ${r.holes ? scorecardHtml(r) : ""}
      ${wx}
      ${r.photo ? `<img class="si-photo" src="${r.photo}" alt="스코어보드">` : ""}`;
    div.querySelector(".si-del").addEventListener("click", () => {
      if (!confirm(`${r.date} ${r.course} 기록을 삭제할까요?`)) return;
      saveScores(loadScores().filter((x) => x.id !== r.id));
      renderScores();
    });
    div.querySelector(".si-edit").addEventListener("click", () => {
      resetScoreForm();
      editingId = r.id;
      $("#sf-title").textContent = "기록 수정";
      $("#sf-date").value = r.date;
      if (r.teeTime) { $("#sf-time").value = r.teeTime; }
      else { $("#sf-time-unknown").checked = true; $("#sf-time").disabled = true; }
      $("#sf-course").value = r.course;
      $("#sf-front").value = r.front || ""; $("#sf-back").value = r.back || "";
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
      window.scrollTo(0, 0);
    });
    el.appendChild(div);
  });
}

/* ---------- 홈 화면 설치 안내 ---------- */
(function () {
  const dismissed = localStorage.getItem("riweather.ig.dismissed");
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (!dismissed && !standalone) $("#install-guide").hidden = false;
  $("#ig-close").addEventListener("click", () => {
    $("#install-guide").hidden = true;
    localStorage.setItem("riweather.ig.dismissed", "1");
  });
})();

/* ---------- 시작 ---------- */
renderHome();

/* PWA 서비스 워커 (HTTPS 또는 localhost에서만 동작) */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
