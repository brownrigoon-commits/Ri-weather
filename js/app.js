/* =========================================================
 * Ri-Weather — 골프장 날씨 베타
 * 데이터: Open-Meteo(예보/대기질), RainViewer(레이더), Nominatim(검색)
 * ========================================================= */
"use strict";

const APP_VER = "v86"; // 배포 버전 (홈 화면 배지에 표시)
const APP_NOTE = "옛 구장명 검색 별칭 15건 추가"; // 이번 업데이트 내용 — 배포 시 자동 갱신됨
const STORAGE_KEY = "riweather.courses.v1";
const GEM_KEY = "riweather.gemini"; // 정밀 인식(비전 AI) 개인 키 저장소
// 기본 제공 키 (무료 한도 공유) — 개인 키를 설정하면 그 키가 우선됩니다
const EMBED_GEM_B64 = "QVEuQWI4Uk42S29NMXN6VU9DbnE3UUpCQUc2b1FtUU1hMnc5RnpONnF3WnlVUG43WjdHMXc=";
const getGemKey = () => localStorage.getItem(GEM_KEY) || atob(EMBED_GEM_B64);

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
  // 홈이 아니면 플로팅 뒤로가기 버튼 표시
  const fb = document.getElementById("float-back-btn");
  if (fb) fb.hidden = name === "home";
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
    showOnly(viewStack[viewStack.length - 1]);
  }
});
function goBack() {
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
        el.innerHTML =
          '<div class="dist-denied">📍 위치를 가져오지 못했습니다.' +
          '<small>휴대폰 설정에서 브라우저의 위치 권한을 <b>허용</b>으로 바꾼 뒤 다시 시도해 주세요.</small></div>' +
          '<button class="dist-btn">다시 시도</button>';
        el.querySelector(".dist-btn").addEventListener("click", ask);
      },
      { timeout: 9000, maximumAge: 300000 }
    );
  };
  if (!("geolocation" in navigator)) { el.innerHTML = ""; return; }

  // 위치 이용에 동의했으면 버튼 없이 바로 표시
  if (CONSENT.allowsLocation()) { ask(); return; }

  const showButton = () => {
    el.innerHTML = '<button class="dist-btn">📍 내 위치에서 거리·이동시간 보기</button>';
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
  ok.textContent = "동의하고 거리 보기";
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
function saveProfile(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }

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

  let txt = `파${h.par} · 약 ${h.len}m`;
  const bendDir = Math.abs(turn) > 28 ? (turn > 0 ? "우" : "좌") : null;
  if (bendDir) {
    txt += ` · ${bendDir}측 도그레그.\n`;
    if (shapeBend === bendDir) {
      txt += `${shape} 구질과 꺾임 방향이 같아 유리한 홀 — 코너를 따라 자연스럽게 태우세요.\n`;
    } else if (shapeBend) {
      txt += `${shape} 구질과 반대로 꺾이는 홀 — 코너 공략 욕심 내지 말고 바깥쪽 안전 라인으로 가세요.\n`;
    }
  } else {
    txt += " · 직선 홀.\n";
  }

  if (h.par >= 4) {
    const drv = Math.min(prof.dist || 200, Math.round(h.len * 0.85));
    const land = pointAtDist(h.line, drv);
    const L = [], R = [];
    bunkers.forEach((b) => { if (distM(b, land) < 65) (sideOfPlay(tee, green, b) === "좌측" ? L : R).push("벙커"); });
    waters.forEach((w) => { if (distM(w, land) < 85) (sideOfPlay(tee, green, w) === "좌측" ? L : R).push("워터해저드"); });
    txt += `\n🚩 티샷 (내 비거리 ${drv}m 낙하지점 기준): `;
    const uniq = (a) => [...new Set(a)].join("·");
    if (L.length && R.length) {
      txt += `양쪽에 위험(좌 ${uniq(L)} / 우 ${uniq(R)}) — 드라이버 대신 우드로 짧게 끊어가는 게 확률적으로 안전합니다.`;
    } else if (L.length || R.length) {
      const danger = L.length ? "좌측" : "우측";
      const aim = L.length ? "우측" : "좌측";
      const hz = uniq(L.length ? L : R);
      txt += `${danger}에 ${hz}. `;
      const risky = (danger === "우측" && (shape === "슬라이스" || shape === "페이드")) ||
                    (danger === "좌측" && (shape === "훅" || shape === "드로우"));
      if (risky) txt += `${shape} 구질이라 특히 조심 — ${aim} 러프 라인을 보고 치면 휘어 들어와도 페어웨이에 남습니다.`;
      else txt += `${aim} 절반을 조준하면 안전합니다.`;
    } else {
      txt += shapeBend
        ? `낙하지점 주변 큰 위험 없음 — ${shapeBend === "우" ? "좌측" : "우측"} 가장자리를 보고 치면 ${shape}가 중앙으로 들어옵니다.`
        : "낙하지점 주변 큰 위험 없음 — 페어웨이 센터 조준.";
    }
    const remain = Math.max(0, h.len - drv);
    if (remain > 30) txt += `\n\n⛳ 세컨: 남은 약 ${remain}m.`;
  } else {
    txt += `\n🚩 티샷: 그린까지 ${h.len}m — 핀보다 그린 중앙을 보세요.`;
  }

  // 그린 주변 벙커 (앞/좌/우)
  const gb = bunkers.filter((b) => distM(b, green) < 38);
  if (gb.length) {
    const tags = [...new Set(gb.map((b) =>
      distM(b, tee) < distM(green, tee) - 10 ? "앞" : sideOfPlay(tee, green, b)))];
    txt += ` 그린 ${tags.join("·")}에 벙커`;
    if (tags.includes("앞")) txt += " — 짧으면 잡히니 반 클럽 길게 보세요.";
    else txt += ` — ${tags[0] === "좌측" ? "우측" : "좌측"} 절반이 안전합니다.`;
  } else if (h.par >= 4) {
    txt += " 그린 주변 벙커 없음 — 핀을 직접 노려도 됩니다.";
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
  $("#course-title").textContent = course.name;
  $("#course-status").textContent = "코스 데이터 불러오는 중...";
  $("#hole-list-card").hidden = true;
  $("#hole-detail-card").hidden = true;
  $("#course-note").hidden = true;
  ensureCourseMap(course.lat, course.lon);
  clearCourseLayers();
  setTimeout(() => courseMap.invalidateSize(), 60);

  // 공식 홀맵 이미지가 있는 구장: 홈페이지 홀맵 그대로 표시 + AI 캐디
  const imgdb = (typeof HOLEIMG_DB !== "undefined" && HOLEIMG_DB[course.name]) || null;
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

  courseHoles = builtin
    ? builtin.map((h) => ({ ref: String(h.ref), par: h.par || 0, name: h.name || "", line: h.line, len: h.len || 0, tip: h.tip || "", gf: h.gf || null }))
    : ways.filter((w) => w.tags.golf === "hole")
        .map((w) => ({
          ref: w.tags.ref || "?", par: parseInt(w.tags.par) || 0,
          name: w.tags.name || "", line: pts(w),
        }))
        .sort((a, b) => (parseInt(a.ref) || 99) - (parseInt(b.ref) || 99));

  if (!courseHoles.length) {
    // 공식 자료가 없는 구장 — 추정 정보는 만들지 않고 위성 전경만 보여준다
    $("#course-status").textContent = "위성 전경";
    $("#hole-list-card").hidden = true;
    $("#hole-detail-card").hidden = true;
    $("#course-note").innerHTML =
      "이 골프장은 <b>홀별 공략을 준비 중</b>입니다.<br>공식 홀 자료가 확보되는 대로 추가됩니다. 아래는 위성 전경입니다.";
    $("#course-note").hidden = false;
    // 코스 전체가 보이도록 지도 맞춤 (OSM 코스 도형이 있으면 그 범위로)
    setTimeout(() => {
      courseMap.invalidateSize();
      const layers = courseLayers.filter((l) => l.getBounds);
      let fitted = false;
      if (layers.length) {
        const b = layers.reduce((acc, l) => acc ? acc.extend(l.getBounds()) : L.latLngBounds(l.getBounds()), null);
        if (b && b.isValid()) { courseMap.fitBounds(b.pad(0.12)); fitted = true; }
      }
      if (!fitted) courseMap.setView([course.lat, course.lon], 15);
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
    mk.on("click", () => selectHole(i));
    courseLayers.push(mk.addTo(courseMap));
  });
  courseMap.fitBounds(allBounds.pad(0.08));
  $("#course-status").textContent = courseHoles.length + "개 홀 등록됨";
  // (위성 추정 홀 배치는 폐지 — HOLES_DB는 비어 있고, 여기는 OSM 공개 홀 데이터만 사용)

  const grid = $("#hole-grid");
  grid.innerHTML = "";
  courseHoles.forEach((h, i) => {
    if (!h.len) h.len = Math.round(lineLen(h.line)); // 공식 거리가 있으면 유지
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
    // 선택한 홀만 선명하게: 어두운 외곽선 + 밝은 라인
    holeLayers.push(L.polyline(h.line, { color: "#08130c", weight: 9, opacity: 0.7, lineCap: "round" }).addTo(courseMap));
    holeLayers.push(L.polyline(h.line, { color: "#4ade80", weight: 4, opacity: 1, lineCap: "round" }).addTo(courseMap));
    const tee = h.line[0], green = h.line[h.line.length - 1];
    holeLayers.push(L.marker(tee, { icon: L.divIcon({ className: "", html: '<div class="course-dot" style="background:#fff59d"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false }).addTo(courseMap));
    holeLayers.push(L.marker(green, { icon: L.divIcon({ className: "", html: "⛳", iconSize: [22, 22], iconAnchor: [11, 20] }), interactive: false }).addTo(courseMap));
    // 지도는 전체 코스 뷰 유지 — 홀 상세는 아래 세로 홀 뷰(캔버스)로 표시
    renderHoleCanvas(h, course.name + "|" + h.name + h.ref);

    // 내 구질·비거리 기반 맞춤 공략 생성
    aiHoleCtx = { h, bunkers, waters, courseName: course.name };
    lastHoleSelect = () => selectHole(i);
    $("#ai-strategy").hidden = true; $("#ai-strategy").textContent = "";
    $("#hole-detail-title").textContent = `${h.ref}번홀 공략` + (h.name ? ` · ${h.name}` : "");
    $("#hole-strategy").hidden = false;
    $("#hole-strategy").textContent = buildHoleStrategy(h, bunkers, waters) +
      (h.tip ? "\n\n💡 코스 공략 포인트: " + h.tip : "");
    $("#hole-video").hidden = false;
    $("#hole-video").href = "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(`${course.name} ${h.ref}번홀 공략`);
    $("#hole-detail-card").hidden = false;
  }
  selectHole(0);
}

/* ---------- 공식 홀맵 이미지 모드 (홈페이지 홀맵 그대로 + AI 캐디) ---------- */
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
    label.textContent = c.name + " 코스";
    grid.appendChild(label);
    c.holes.forEach((h) => {
      const i = flat.length;
      flat.push({ ...h, cname: c.name });
      const b = document.createElement("button");
      b.className = "hole-btn";
      b.innerHTML = `${h.no}<small>파${h.par}</small>`;
      b.addEventListener("click", () => sel(i));
      grid.appendChild(b);
    });
  });
  $("#hole-list-card").querySelector(".card-title").innerHTML =
    `<span class="ic">⛳</span> 홀 선택`;
  $("#hole-list-card").hidden = false;

  function sel(i) {
    const h = flat[i];
    grid.querySelectorAll(".hole-btn").forEach((b, j) => b.classList.toggle("active", j === i));
    $("#hole-detail-title").textContent = `${h.cname} ${h.no}번홀 공략`;
    const img = $("#hole-img");
    if (h.img) {
      img.src = h.img;
      img.hidden = false;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
    }
    // 홀 3D 영상 — AI 캐디 아래에 배치, 탭할 때만 로드(데이터 절약)
    const vp = $("#hole-video-player"), vw = $("#hole-video-wrap");
    vp.pause?.();
    if (h.video) {
      vp.src = h.video;
      vw.hidden = false;
    } else {
      vp.removeAttribute("src");
      vw.hidden = true;
    }
    $("#hole-img-src").textContent = "홀맵 출처: " + db.source;
    $("#hole-img-src").hidden = false;
    if (h.green) {
      $("#hole-green-img").src = h.green;
      $("#hole-green-wrap").hidden = false;
    } else {
      $("#hole-green-wrap").hidden = true;
    }
    let infoHtml = "";
    if (h.dist) {
      const row = (g, a) => `<b>${g}그린</b> 백 ${a[0]} · 레귤러 ${a[1]} · 프론트 ${a[2]} · 레이디 ${a[3]}m`;
      infoHtml += `<b>📏 티별 거리</b><br>${row("L", h.dist.L)}<br>${row("R", h.dist.R)}<br><br>`;
    } else if (h.tees) {
      const elev = h.elev
        ? ` <span class="hole-elev">· 티→그린 ${h.elev > 0 ? "오르막 +" : "내리막 "}${h.elev}m</span>`
        : "";
      infoHtml += `<b>📏 티별 거리</b><br>${h.tees.map((t) => `${t.name} ${t.m}`).join(" · ")}m${elev}<br><br>`;
    } else if (h.len) {
      infoHtml += `<b>📏 전장</b> ${h.len}m${h.hdcp ? " · 핸디캡 " + h.hdcp : ""}<br><br>`;
    }
    if (h.tip) {
      const safeTip = h.tip.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      infoHtml += "<b>⛳ 공식 코스공략 TIP</b><br>" + safeTip;
    }
    if (infoHtml) {
      $("#hole-strategy").hidden = false;
      $("#hole-strategy").innerHTML = infoHtml;
    } else {
      $("#hole-strategy").textContent = "";
      $("#hole-strategy").hidden = true;
    }
    $("#ai-strategy").hidden = true;
    $("#ai-strategy").textContent = "";
    aiHoleCtx = { imgHole: h, courseName: course.name };
    lastHoleSelect = () => sel(i);
    $("#hole-video").hidden = true; // 홀별 영상 선별 불가 — 신뢰 문제로 미표시
    $("#hole-detail-card").hidden = false;
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
        jobs.push(fetch(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`)
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
    if (token === holeCanvasToken) { loading.textContent = "위성 이미지를 불러오지 못했습니다"; }
  }
}

/* 홀 영역 위성 타일을 합성해 티(노랑)·그린(빨강) 표시된 이미지 생성 */
async function holeSatelliteDataUrl(h) {
  const lats = h.line.map((p) => p[0]), lons = h.line.map((p) => p[1]);
  const dLat = Math.max(Math.max(...lats) - Math.min(...lats), 0.0008);
  const dLon = Math.max(Math.max(...lons) - Math.min(...lons), 0.0008);
  const bb = {
    latMin: Math.min(...lats) - dLat * 0.2, latMax: Math.max(...lats) + dLat * 0.2,
    lonMin: Math.min(...lons) - dLon * 0.2, lonMax: Math.max(...lons) + dLon * 0.2,
  };
  let z = 18, tx0, tx1, ty0, ty1;
  while (z > 14) {
    tx0 = Math.floor(lon2tx(bb.lonMin, z)); tx1 = Math.floor(lon2tx(bb.lonMax, z));
    ty0 = Math.floor(lat2ty(bb.latMax, z)); ty1 = Math.floor(lat2ty(bb.latMin, z));
    if (tx1 - tx0 < 4 && ty1 - ty0 < 4) break;
    z--;
  }
  const cv = document.createElement("canvas");
  cv.width = (tx1 - tx0 + 1) * 256; cv.height = (ty1 - ty0 + 1) * 256;
  const ctx = cv.getContext("2d");
  const jobs = [];
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      jobs.push(fetch(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`)
        .then((r) => r.blob()).then(createImageBitmap)
        .then((bmp) => ctx.drawImage(bmp, (tx - tx0) * 256, (ty - ty0) * 256)));
    }
  }
  await Promise.all(jobs);
  const px = (p) => [(lon2tx(p[1], z) - tx0) * 256, (lat2ty(p[0], z) - ty0) * 256];
  // 홀 라인 + 티/그린 마커
  ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
  ctx.beginPath();
  h.line.forEach((p, i) => { const [X, Y] = px(p); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
  ctx.stroke(); ctx.setLineDash([]);
  const dot = (p, color) => {
    const [X, Y] = px(p);
    ctx.fillStyle = color; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(X, Y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  };
  dot(h.line[0], "#ffd60a");
  dot(h.line[h.line.length - 1], "#ff3b30");
  return cv.toDataURL("image/jpeg", 0.85);
}

/* 동의받은 연령대·성별을 AI 캐디 공략에 실제로 반영한다 */
function playerTraits() {
  const c = CONSENT.get() || {};
  const p = loadProfile();
  const bits = [];
  if (c.age) bits.push(c.age);
  if (c.gender && c.gender !== "선택 안 함") bits.push(c.gender);
  if (p.years) bits.push("구력 " + p.years);
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
        b.textContent = t;
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
  if (!aiHoleCtx) return;
  if (AI_PROFILE.need()) { AI_PROFILE.ask(() => runAiCaddie()); return; }
  return runAiCaddie();
}

async function runAiCaddie() {
  if (!aiHoleCtx) return;
  const btn = $("#ai-strategy-btn"), out = $("#ai-strategy");
  btn.disabled = true; btn.textContent = "🤖 AI 캐디가 홀을 분석 중... (3~8초)";

  // 공식 홀맵 이미지 모드
  if (aiHoleCtx.imgHole) {
    const hh = aiHoleCtx.imgHole;
    const prof2 = loadProfile();
    try {
      const hasImg = !!hh.img;
      const data = hasImg ? await imgToB64($("#hole-img")) : null;
      // 홀 3D 영상에서 뽑아둔 실제 코스 장면 (티→중간→그린)
      const frameData = [];
      for (const src of (hh.frames || [])) {
        try {
          const b = await fetch(src).then((r) => r.blob());
          frameData.push(await new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(String(fr.result).split(",")[1]);
            fr.onerror = rej;
            fr.readAsDataURL(b);
          }));
        } catch { /* 프레임 없으면 건너뜀 */ }
      }
      const elevTxt = hh.elev
        ? `티에서 그린까지 ${hh.elev > 0 ? "오르막 " + hh.elev : "내리막 " + Math.abs(hh.elev)}m. ` : "";
      const frameTxt = frameData.length
        ? `이어지는 ${frameData.length}장은 이 홀의 실제 3D 코스 영상에서 뽑은 장면입니다(티잉구역 → 페어웨이 중간 → 그린 접근 순서). 페어웨이 폭·굴곡, 나무·러프 경계, 해저드, 그린 주변 지형을 이 장면들에서 직접 확인하고 조언에 반영하세요. `
        : "";
      const prompt = hasImg ?
        `당신은 투어 경력의 친절한 한국인 캐디입니다. 첨부 이미지 1번은 ${aiHoleCtx.courseName} ${hh.cname}코스 ${hh.no}번홀(파${hh.par})의 공식 홀맵입니다. ` +
        `홀맵에는 홀 모양, 벙커·해저드 위치, 그린까지 거리선(50/100/150M)이 표시되어 있습니다. ` + frameTxt + elevTxt :
        `당신은 투어 경력의 친절한 한국인 캐디입니다. ${aiHoleCtx.courseName} ${hh.cname}코스 ${hh.no}번홀(파${hh.par})을 안내합니다. ` +
        `홀맵 그림은 없고 아래 수치 정보만 있습니다. 사진이 있는 것처럼 지형·벙커 위치를 지어내지 말고, 주어진 파·거리·고도차와 플레이어 구질만으로 조언하세요. ` + elevTxt;
      const promptTail =
        (hh.dist ? `티별 거리(m): L그린 백${hh.dist.L[0]}/레귤러${hh.dist.L[1]}/프론트${hh.dist.L[2]}/레이디${hh.dist.L[3]}, R그린 백${hh.dist.R[0]}/레귤러${hh.dist.R[1]}/프론트${hh.dist.R[2]}/레이디${hh.dist.R[3]}. ` :
         hh.tees ? `티별 거리: ${hh.tees.map((t) => t.name + " " + t.m + "m").join(", ")}. ` :
         hh.len ? `전장 ${hh.len}m${hh.hdcp ? ", 핸디캡 " + hh.hdcp : ""}. ` : "") +
        (hh.tip ? `골프장 공식 공략 TIP: "${hh.tip}" ` : "") +
        `플레이어: 구질 ${prof2.shape || "스트레이트"}, 드라이버 평균 ${prof2.dist || 200}m${playerTraits()}. ` +
        playerTraitGuide() +
        `가장 중요한 것은 구질 맞춤입니다 — 이 플레이어의 구질(${prof2.shape || "스트레이트"})이 이 홀에서 유리한지 불리한지 판단하고, ` +
        `구질을 감안한 구체적인 조준점(예: 슬라이스면 좌측 OO를 보고)과 위험 구역 회피법을 반드시 포함하세요. ` +
        `주어진 정보만 근거로 ①티샷(구질 맞춤 조준점·클럽) ②세컨샷 ③그린 주변 순서로 4~6문장, 친근한 존댓말로 조언하세요. ` +
        `확인할 수 없는 정보(그린 경사, 잔디 상태 등)는 절대 지어내지 마세요.`;
      const parts = [{ text: prompt + promptTail }];
      if (hasImg) parts.push({ inline_data: { mime_type: "image/jpeg", data } });
      frameData.forEach((d2) => parts.push({ inline_data: { mime_type: "image/jpeg", data: d2 } }));
      const text = await geminiGenerate(parts, 0.4);
      out.textContent = text.trim();
      out.hidden = false;
    } catch (e) {
      out.textContent = "AI 캐디 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.";
      out.hidden = false;
    }
    btn.disabled = false; btn.textContent = "🤖 AI 캐디 상세 공략 보기";
    return;
  }

  const { h, bunkers, waters, courseName } = aiHoleCtx;
  const prof = loadProfile();
  const facts = `${courseName} ${h.ref}번홀, 파${h.par}, 길이 약 ${h.len}m, 홀 주변 벙커 ${bunkers.length}개·워터해저드 ${waters.length}곳. 플레이어: 구질 ${prof.shape || "스트레이트"}, 드라이버 평균 ${prof.dist || 200}m${playerTraits()}. ${playerTraitGuide()}`;
  const basePrompt =
    `당신은 투어 경력의 친절한 한국인 캐디입니다. ${facts}\n` +
    `첨부된 위성사진이 이 홀입니다 (흰 점선=홀 진행선, 노란 점=티잉구역, 빨간 점=그린).\n` +
    `사진에서 실제로 보이는 지형(페어웨이 폭·모양, 해저드 위치, 도그레그)과 플레이어의 구질·비거리를 근거로 ` +
    `①티샷 조준점 ②세컨샷 ③그린 주변 순서로 4~6문장 존댓말 조언을 하세요. ` +
    `사진으로 확인할 수 없는 것(그린 경사, 잔디 상태 등)은 절대 지어내지 마세요.`;
  try {
    let parts;
    try {
      const img = await holeSatelliteDataUrl(h);
      parts = [{ text: basePrompt }, { inline_data: { mime_type: "image/jpeg", data: img.split(",")[1] } }];
    } catch {
      parts = [{ text: basePrompt.replace(/첨부된 위성사진.*?\n/, "위성사진 없이 위 정보만으로 조언하세요.\n") }];
    }
    const text = await geminiGenerate(parts, 0.4);
    out.textContent = text.trim();
    out.hidden = false;
  } catch (e) {
    out.textContent = "AI 캐디 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    out.hidden = false;
  }
  btn.disabled = false; btn.textContent = "🤖 AI 캐디 상세 공략 보기";
}
$("#ai-strategy-btn").addEventListener("click", aiCaddie);

/* 앱 공유 버튼 — 모든 화면 공통 */
(function initAppShare() {
  const APP_URL = "https://brownrigoon-commits.github.io/Ri-weather/";
  const btn = $("#app-share-btn"), toast = $("#app-share-toast");
  if (!btn) return;
  let toastTimer = null;
  btn.addEventListener("click", async () => {
    const data = {
      title: "Ri-Weather 골프장 날씨",
      text: "골프장 날씨·홀별 코스공략·AI캐디까지 한 번에 — Ri-Weather",
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
const EMBED_KAKAO_B64 = "OTg0N2VjNWU5YTRkMTEyN2M1NzY1MDY1YjNlNzFmZjI=";   // Ri-Weather 공용 키
const getKakaoKey = () => localStorage.getItem(KAKAO_KEY_LS) ||
  (EMBED_KAKAO_B64 ? atob(EMBED_KAKAO_B64) : "");

async function kakaoApi(url) {
  const key = getKakaoKey();
  if (!key) throw new Error("no-kakao-key");
  const r = await fetch(url, { headers: { Authorization: "KakaoAK " + key } });
  if (!r.ok) throw new Error("kakao " + r.status);
  return r.json();
}

/* 골프장 주변 음식점 (카카오맵 등록 기준, 가까운 순) */
const kakaoFoodCache = new Map();
async function fetchKakaoFood(course) {
  const ck = course.lat.toFixed(3) + "," + course.lon.toFixed(3);
  if (kakaoFoodCache.has(ck)) return kakaoFoodCache.get(ck);
  const out = [];
  for (let page = 1; page <= 3; page++) {
    const j = await kakaoApi("https://dapi.kakao.com/v2/local/search/category.json" +
      `?category_group_code=FD6&x=${course.lon}&y=${course.lat}&radius=5000&sort=distance&page=${page}&size=15`);
    (j.documents || []).forEach((d) => out.push({
      name: d.place_name,
      cat: (d.category_name || "").split(">").pop().trim(),
      phone: d.phone || "",
      addr: d.road_address_name || d.address_name || "",
      lat: parseFloat(d.y), lon: parseFloat(d.x),
      dist: parseInt(d.distance) || 0,
      url: d.place_url || "",
    }));
    if (j.meta && j.meta.is_end) break;
  }
  out.sort((a, b) => a.dist - b.dist);
  kakaoFoodCache.set(ck, out);
  return out;
}

/* 식당 사진 (카카오 이미지 검색) */
const foodImgCache = new Map();
async function fetchFoodImages(name, region) {
  const q = (region ? region + " " : "") + name;
  if (foodImgCache.has(q)) return foodImgCache.get(q);
  const j = await kakaoApi("https://dapi.kakao.com/v2/search/image?sort=accuracy&size=12&query=" +
    encodeURIComponent(q));
  const imgs = (j.documents || [])
    .filter((d) => d.thumbnail_url)
    .map((d) => ({ t: d.thumbnail_url, u: d.image_url || d.thumbnail_url }));
  foodImgCache.set(q, imgs);
  return imgs;
}

/* ---------- 사진 크게 보기 (라이트박스) ---------- */
let lbList = [], lbIdx = 0;
function lbShow(i) {
  if (!lbList.length) return;
  lbIdx = (i + lbList.length) % lbList.length;
  const im = lbList[lbIdx];
  const el = $("#lb-img");
  el.onerror = () => { el.onerror = null; el.src = im.t; };   // 원본 실패 시 썸네일
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
  lbShow(i);
}
function closeLightbox() {
  $("#img-lightbox").hidden = true;
  document.body.style.overflow = "";
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
  $("#food-title").textContent = "주변맛집";
  $("#food-desc").textContent = `${course.name} 주변 식당`;
  const listEl = $("#food-list");
  listEl.innerHTML = '<p class="loading-line">주변 식당을 찾는 중...</p>';
  $("#food-note").hidden = true;

  const region = (course.addr || "").split(" ").slice(0, 2).join(" ");
  // 1순위: 카카오맵 등록 맛집 (가까운 순 · 사진/전화 제공)
  if (getKakaoKey()) {
    try {
      const list = await fetchKakaoFood(course);
      if (currentCourse !== course || viewStack[viewStack.length - 1] !== "food") return;
      if (list.length) { renderFoodList(list, region, true); return; }
    } catch (e) {
      if (String(e.message).indexOf("kakao") === 0) console.warn("kakao food:", e.message);
    }
  }

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
function renderFoodList(list, region, fromKakao) {
  const listEl = $("#food-list");
  listEl.innerHTML = "";
  if (!list.length) {
    const p = document.createElement("p");
    p.className = "food-osm-empty";
    p.textContent = "주변 5km 안에 등록된 식당을 찾지 못했습니다.";
    listEl.appendChild(p);
    return;
  }
  const sub = document.createElement("p");
  sub.className = "food-osm-sub";
  sub.textContent = fromKakao
    ? "가까운 순 · 이름을 누르면 사진이 열립니다"
    : "가까운 순 (지도 등록 기준) · 이름을 누르면 상세가 열립니다";
  listEl.appendChild(sub);

  list.forEach((it) => {
    const km = it.dist < 950 ? it.dist + "m" : (it.dist / 1000).toFixed(1) + "km";
    const tel = (it.phone || "").replace(/[^0-9+]/g, "");
    const div = document.createElement("div");
    div.className = "food-item";
    div.innerHTML = `
      <div class="fi-row">
        <span class="fi-emoji">${catEmoji(it.cat)}</span>
        <div style="flex:1;min-width:0">
          <div class="fi-name">${it.name}</div>
          <div class="fi-sub">${it.cat || "식당"}</div>
        </div>
        <span class="fi-dist">${km}</span>
      </div>
      <div class="fi-detail">
        <div class="fi-photos" hidden></div>
        <div class="fi-addr">${it.addr ? "📍 " + it.addr + " " : ""}<span class="fi-addr-dist">· 골프장에서 ${km}</span></div>
        ${tel ? `<a class="fi-phone" href="tel:${tel}">📞 ${it.phone} <span>영업확인</span></a>` : ""}
        <div class="fi-links">
          <a class="kakaonavi" href="kakaomap://route?ep=${it.lat},${it.lon}&by=CAR">🚗 카카오내비</a>
          <a class="tmapnavi" href="tmap://route?goalname=${encodeURIComponent(it.name)}&goaly=${it.lat}&goalx=${it.lon}">🚗 T맵</a>
        </div>
      </div>`;
    const photos = div.querySelector(".fi-photos");
    let loaded = false;
    div.querySelector(".fi-row").addEventListener("click", async () => {
      div.classList.toggle("open");
      if (!div.classList.contains("open") || loaded || !getKakaoKey()) return;
      loaded = true;
      photos.hidden = false;
      photos.innerHTML = '<div class="fi-photo-loading">사진 불러오는 중...</div>';
      try {
        const imgs = await fetchFoodImages(it.name, region);
        if (!imgs.length) {
          photos.innerHTML = '<div class="fi-photo-loading">등록된 사진이 없습니다</div>';
          return;
        }
        photos.innerHTML = imgs
          .map((im, k) => `<img src="${im.t}" data-k="${k}" alt="${it.name}" loading="lazy">`)
          .join("");
        photos.querySelectorAll("img").forEach((el) => {
          el.addEventListener("click", () => openLightbox(imgs, +el.dataset.k));
        });
      } catch {
        photos.innerHTML = '<div class="fi-photo-loading">사진을 불러오지 못했습니다</div>';
      }
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
const saveScores = (l) => localStorage.setItem(SCORE_KEY, JSON.stringify(l));

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
        '<option value="">코스 선택 ▾</option>' +
        names.map((n) => `<option value="${n}">${n}</option>`).join("") +
        '<option value="__direct">직접 입력...</option>';
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
  $("#sf-title").textContent = "라운딩 기록 추가";
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
  btn.textContent = personal ? "🔑 정밀 인식 ON (내 키)" : "🔑 정밀 인식 ON";
  btn.style.color = "#34d399";
  btn.style.borderColor = "#34d399";
}
$("#ai-key-btn").addEventListener("click", () => {
  const cur = localStorage.getItem(GEM_KEY) || "";
  const v = prompt(
    "정밀 AI 인식은 기본으로 켜져 있습니다 (공용 무료 한도 사용).\n\n본인 전용 키를 쓰려면 여기에 입력하세요:\n1) aistudio.google.com/apikey 접속\n2) 구글 로그인 → 'API 키 만들기'\n3) 키 복사 후 붙여넣기\n\n(비우고 확인하면 공용 키로 돌아갑니다)",
    cur);
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
  $("#hg-sum").textContent = `전반 ${36 + f} · 후반 ${36 + b} · 합계 ${72 + f + b}타`;
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
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` + encodeURIComponent(key),
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
  if (g.date && /^\d{4}-\d{2}-\d{2}$/.test(g.date)) { $("#sf-date").value = g.date; filled.push("날짜"); }
  if (g.teeTime && /^\d{1,2}:\d{2}$/.test(g.teeTime)) {
    $("#sf-time").value = g.teeTime.padStart(5, "0");
    $("#sf-time-unknown").checked = false; $("#sf-time").disabled = false;
    filled.push("티업시간");
  }
  if (g.club) {
    const hit = searchGolfDB(g.club);
    $("#sf-course").value = hit.length ? (hit[0].k || hit[0].n) : g.club;
    filled.push("골프장");
  }
  if (g.front) $("#sf-front").value = g.front;
  if (g.back) $("#sf-back").value = g.back;
  if (g.front || g.back) filled.push("코스");
  if (g.tee) { $("#sf-tee").value = g.tee; filled.push("티"); }
  if (Array.isArray(g.companions) && g.companions.length) {
    g.companions.slice(0, 4).forEach((n, i) => { $("#sf-f" + (i + 1)).value = String(n); });
    filled.push("동반자");
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
      else { $("#sf-score").value = p.total; $("#hg-sum").textContent = `${p.holes.length}홀 인식 · 합계 ${p.total}타`; }
      filled.push("홀별 스코어");
    }
    if (p.total) { $("#sf-score").value = p.total; filled.push("총타수 " + p.total); }
  }
  syncCourseSelectUI();
  return { filled, cartPlayers };
}

/* 여러 명 인식 시 본인 선택 칩 (기본·정밀 인식 공용) */
function renderCartChips(cartPlayers) {
  const chips = $("#ocr-chips");
  chips.innerHTML = '<span class="chip-label">인식된 플레이어 (본인 선택 시 나머지는 동반자로 입력)</span>';
  cartPlayers.forEach((p) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ocr-chip";
    b.textContent = `${p.name} · ${p.total}타`;
    b.addEventListener("click", () => {
      holeInputs.forEach((h, i) => {
        h.value = i < p.holes.length && p.holes[i] != null ? p.holes[i] : "";
      });
      $("#holes-grid").hidden = false;
      $("#sf-score").value = p.total;
      const nFilled = p.holes.filter((v) => v != null).length;
      $("#hg-sum").textContent = nFilled < 18 ? `${nFilled}홀 인식 · 합계 ${p.total}타` : "";
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
async function geminiGenerate(parts, temperature = 0.3) {
  const key = getGemKey();
  if (!key) throw new Error("no key");
  const body = { contents: [{ parts }], generationConfig: { temperature } };
  const models = ["gemini-flash-latest", "gemini-flash-lite-latest"];
  let lastErr = null;
  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` + encodeURIComponent(key),
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { lastErr = new Error("HTTP " + r.status); continue; }
      const j = await r.json();
      const t = j.candidates?.[0]?.content?.parts?.[0]?.text;
      if (t) return t;
      lastErr = new Error("빈 응답");
    } catch (e) { lastErr = e; }
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
    filled.push("날짜");
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
    filled.push("티업시간");
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
        if (h) { $("#sf-front").value = h[1]; filled.push("코스(" + h[1] + ")"); break; }
      }
      if (pars.length >= 5) parsedPars = pars.slice(0, 9); // 스코어판 PAR 줄 표시용
      filled.push(`카트 스코어보드 · ${players.length}명 인식`);
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
    filled.push("골프장");
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
    filled.push("코스");
  } else {
    // ② "남, 동" / "East, West" / "망무봉 OUT, 망무봉 IN" 형태의 줄에서 직접 추출
    const BAD = /^(putt|gir|fwhit|par|hole|tee|white|red|blue|black|total)$/i;
    // 주의: \s는 줄바꿈까지 매칭하므로 공백/탭만 허용 (같은 줄 안에서만 코스 추출)
    const seg = "[A-Za-z가-힣0-9]{1,10}(?: [A-Za-z가-힣0-9]{1,8})?";
    const cm = text.match(new RegExp(`^[ \\t]*(${seg})[ \\t]*[,·/][ \\t]*(${seg})[ \\t]*$`, "m"));
    if (cm && !BAD.test(cm[1].trim()) && !BAD.test(cm[2].trim()) &&
        !/^\d+$/.test(cm[1]) && !/^\d+$/.test(cm[2])) {
      $("#sf-front").value = cm[1].trim(); $("#sf-back").value = cm[2].trim();
      filled.push("코스");
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
      filled.push("동반자");
      break;
    }
  }

  // 티: "White Tee" 등 인식
  const teeM = text.match(/(white|red|blue|black|gold|yellow|lady)\s*tee/i);
  if (teeM) {
    const teeMap = { white: "화이트", red: "레드", blue: "블루", black: "블랙", gold: "골드", yellow: "옐로우", lady: "레이디" };
    $("#sf-tee").value = teeMap[teeM[1].toLowerCase()] || "";
    filled.push("티");
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
      filled.push("홀별 스코어·총타수 " + $("#sf-score").value);
    }
  } else if (rows.length === 1 && rows[0].verified) {
    // 9홀 라운드 (후반 없음)
    rows[0].nine.forEach((v, i) => { holeInputs[i].value = v; });
    const t9 = 36 + rows[0].nine.reduce((s, v) => s + v, 0);
    $("#holes-grid").hidden = false;
    $("#sf-score").value = t9;
    $("#hg-sum").textContent = `9홀 라운드 · 합계 ${t9}타`;
    holesFilled = true;
    filled.push("9홀 스코어 " + t9);
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
    if (best) { $("#sf-score").value = best; filled.push("총타수 " + best); }
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
      st.textContent = "🤖 정밀 AI가 사진을 분석 중... (2~5초)";
      try {
        const g = await geminiRecognize(photoThumb);
        if (g) {
          const { filled, cartPlayers } = applyGeminiResult(g);
          if (cartPlayers && cartPlayers.length) {
            st.textContent = "✅ 정밀 AI 인식 완료 — 아래에서 본인 이름을 탭하세요";
            renderCartChips(cartPlayers);
          } else if (filled.length) {
            st.textContent = `✅ 정밀 AI 자동 입력: ${filled.join(" · ")} — 확인 후 저장하세요`;
          } else {
            st.textContent = "정밀 AI가 스코어보드를 찾지 못했어요 — 직접 입력해 주세요";
          }
          return; // 정밀 인식 성공 시 기본 인식 생략
        }
      } catch (e) {
        st.textContent = "정밀 AI 연결 실패 — 기본 인식으로 전환합니다";
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
        st.textContent = `🤖 AI가 스코어보드를 읽는 중... (${i + 1}/4)`;
        const { data } = await worker.recognize(vars[i]);
        mergedText += "\n" + cardRegion(data.text);
      }
      // 상단 띠(동반자·날짜·시간) 정밀 재인식 — 결과를 앞쪽에 배치해 우선 사용
      st.textContent = "🤖 AI가 스코어보드를 읽는 중... (4/4)";
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
        st.textContent = "✅ 카트 스코어보드 인식 — 아래에서 본인 이름을 탭하세요";
        renderCartChips(cartPlayers);
      } else if (filled.length) {
        st.textContent = `✅ AI 자동 입력: ${filled.join(" · ")} — 확인 후 틀린 부분만 고쳐주세요`;
      } else {
        st.textContent = "자동 인식이 어려운 사진이에요 — 직접 입력해 주세요 (사진은 기록에 첨부됩니다)";
      }
      const rawBtn = document.createElement("button");
      rawBtn.type = "button"; rawBtn.className = "ocr-raw-btn"; rawBtn.textContent = "🔍 인식 원문";
      rawBtn.addEventListener("click", () => $("#ocr-raw").classList.toggle("show"));
      st.appendChild(rawBtn);
      if (candidates.length) {
        st.textContent += " / 총타수는 아래에서 탭하세요";
        const chips = $("#ocr-chips");
        chips.innerHTML = '<span class="chip-label">인식된 총타수 후보</span>';
        candidates.forEach((n) => {
          const b = document.createElement("button");
          b.type = "button"; b.className = "ocr-chip"; b.textContent = n + "타";
          b.addEventListener("click", () => { $("#sf-score").value = n; });
          chips.appendChild(b);
        });
        chips.hidden = false;
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
  resetScoreForm(); // 첨부 사진·입력값 정리
  $("#score-form").hidden = true;
  renderScores();
});

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

/* ---------- 기록 공유: 카드 이미지 생성 → 공유/저장 ---------- */
async function shareScoreCard(r) {
  const W = 720, H = 900;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d");

  // 배경
  const bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#4a5a6c"); bg.addColorStop(1, "#2c3744");
  x.fillStyle = bg; x.fillRect(0, 0, W, H);

  x.textAlign = "center"; x.fillStyle = "#fff";
  x.font = "700 44px -apple-system, 'Malgun Gothic', sans-serif";
  x.fillText(r.course, W / 2, 110);
  x.fillStyle = "rgba(255,255,255,0.65)";
  x.font = "400 26px -apple-system, sans-serif";
  const sub = r.date + (r.teeTime ? " · " + r.teeTime + " 티업" : "") + (r.tee ? " · " + r.tee + "티" : "");
  x.fillText(sub, W / 2, 155);
  if (r.front || r.back) {
    x.fillText((r.front || "전반") + " · " + (r.back || "후반"), W / 2, 192);
  }

  // 대형 스코어
  x.fillStyle = "#fff";
  x.font = "200 190px -apple-system, sans-serif";
  x.fillText(String(r.score), W / 2, 400);
  x.font = "400 34px -apple-system, sans-serif";
  x.fillStyle = "#34d399";
  x.fillText("타", W / 2 + 130, 395);

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
      x.fillStyle = "rgba(0,0,0,0.25)";
      x.fillRect(50, y, W - 100, 54);
      x.font = "600 18px -apple-system, sans-serif";
      x.fillStyle = "rgba(255,255,255,0.6)";
      x.textAlign = "left";
      x.fillText(label, 60, y + 33, 100); // 폭 초과 시 자동 압축 (망무봉 OUT 등)
      x.textAlign = "center";
      x.font = "600 22px -apple-system, sans-serif";
      nine.forEach((v, i) => {
        x.fillStyle = v > 0 ? "#ff9c9c" : v < 0 ? "#7fd4ff" : "#fff";
        x.fillText(v == null ? "·" : v > 0 ? "+" + v : String(v), cellsX0 + cell * i + cell / 2, y + 34);
      });
      const parT = pars.length === 9 ? pars.reduce((s, v) => s + v, 0) : 36;
      const t = parT + nine.reduce((s, v) => s + (v || 0), 0);
      x.fillStyle = "#34d399";
      x.font = "800 26px -apple-system, sans-serif";
      x.fillText(String(t), W - 92, y + 35);
      y += 62;
    });
    y += 20;
  }

  // 그날 날씨
  if (r.wx) {
    x.fillStyle = "rgba(255,255,255,0.75)";
    x.font = "400 26px -apple-system, sans-serif";
    x.fillText(`${wmoDesc(r.wx.code)} · ${r.wx.tmin}~${r.wx.tmax}° · 비 ${r.wx.rain}mm · 바람 ${r.wx.wind}m/s`, W / 2, y + 30);
    y += 70;
  }
  if (r.friends) {
    x.fillStyle = "rgba(255,255,255,0.55)";
    x.font = "400 24px -apple-system, sans-serif";
    x.fillText("함께한 사람 · " + r.friends, W / 2, y + 30, W - 100);
    y += 52;
  }
  if (r.memo) {
    x.fillStyle = "rgba(255,255,255,0.75)";
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
  x.fillStyle = "#34d399";
  x.font = "700 26px -apple-system, sans-serif";
  x.fillText("⛳ Ri-Weather", W / 2, H - 50);

  return new Promise((resolve) => {
    cv.toBlob(async (blob) => {
      const file = new File([blob], `score-${r.date}.png`, { type: "image/png" });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `${r.course} ${r.score}타` });
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
    ${r.front || r.back ? `<div class="sb-courses">⚑ ${r.front || "전반"} - ${r.back || "후반"}</div>` : ""}
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
           <span>🌬 최대 ${r.wx.wind}m/s</span>
         </div>` : "";
    div.innerHTML = `
      <div class="si-top">
        <div>
          <div class="si-course">${r.course}</div>
          <div class="si-date">${r.date}${r.teeTime ? " · ⛳ " + r.teeTime + " 티업" : ""}${r.tee ? " · " + r.tee + "티" : ""}</div>
        </div>
        ${r.holes ? "" : `<div class="si-score">${r.score}<small>타</small></div>`}
      </div>
      ${r.friends ? `<div class="si-friends">👥 ${r.friends}</div>` : ""}
      ${r.memo ? `<div class="si-memo">"${r.memo}"</div>` : ""}
      ${r.holes ? scorecardHtml(r) : ""}
      ${wx}
      ${r.photo ? `<img class="si-photo" src="${r.photo}" alt="스코어보드">` : ""}
      <div class="si-actions">
        <button class="si-edit2">✏️ 수정</button>
        <button class="si-share">📤 공유·저장</button>
        ${r.photo ? '<button class="si-photo-toggle">📷 사진</button>' : ""}
        <button class="si-del2">🗑 삭제</button>
      </div>`;
    div.querySelector(".si-share").addEventListener("click", () => shareScoreCard(r));
    div.querySelector(".si-del2").addEventListener("click", () => {
      if (!confirm(`${r.date} ${r.course} 기록을 삭제할까요?`)) return;
      saveScores(loadScores().filter((x) => x.id !== r.id));
      renderScores();
    });
    const pt = div.querySelector(".si-photo-toggle");
    if (pt) pt.addEventListener("click", () => {
      const open = div.classList.toggle("show-photo");
      pt.textContent = open ? "📷 사진 접기" : "📷 사진 보기";
    });
    div.querySelector(".si-edit2").addEventListener("click", () => {
      resetScoreForm();
      editingId = r.id;
      $("#sf-title").textContent = "기록 수정";
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
      window.scrollTo(0, 0);
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
    localStorage.setItem(this.KEY, JSON.stringify(d));
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
  let pickedAge = null, pickedGender = null;

  const chips = (host, items, get, set) => {
    host.innerHTML = "";
    items.forEach((t) => {
      const b = document.createElement("button");
      b.className = "pi-chip" + (get() === t ? " on" : "");
      b.type = "button";
      b.textContent = t;
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
    chips($("#pi-age"), AGES, () => pickedAge, (v) => { pickedAge = v; });
    chips($("#pi-gender"), GENDERS, () => pickedGender, (v) => { pickedGender = v; });
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
    // 필수 항목이 빠졌으면 어디를 눌러야 하는지 알려준다
    if (!b.age.checked || !b.tos.checked) {
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
      first.closest("li").scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
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
    $("#guide-copy").textContent = "✅ 복사됐어요 — 브라우저에 붙여넣으세요";
    setTimeout(() => { $("#guide-copy").textContent = "🔗 주소 복사하기"; }, 2500);
  });

  /* ---- 기기별 동작 ---- */
  function handleClick() {
    if (inApp) {
      openSheet(
        "브라우저로 열어주세요",
        "지금은 카카오톡 같은 앱 <b>안에서</b> 보고 있어서 홈 화면 추가가 되지 않습니다.",
        [
          `화면 오른쪽 아래 ${ICO("⋯")} 또는 ${ICO("⋮")} 버튼을 누르세요`,
          "<b>‘다른 브라우저로 열기’</b>(사파리·크롬)를 선택하세요",
          "열린 화면에서 <b>홈 화면에 추가</b>를 다시 누르면 됩니다",
        ],
        true
      );
      return;
    }
    if (iosOtherBrowser) {
      openSheet(
        "사파리로 열어야 추가돼요",
        "아이폰은 <b>사파리(Safari)</b>에서만 홈 화면 추가가 가능합니다.",
        [
          "아래 <b>주소 복사하기</b>를 누르세요",
          "<b>사파리</b>를 열고 주소창에 붙여넣어 이동하세요",
          "사파리에서 <b>홈 화면에 추가</b>를 다시 누르면 됩니다",
        ],
        true
      );
      return;
    }
    if (isIOS) {
      openSheet(
        "아이폰 홈 화면에 추가",
        "3초면 끝납니다. 앱처럼 아이콘으로 바로 열려요.",
        [
          isIPad
            ? `화면 <b>오른쪽 위</b>의 공유 버튼 ${ICO("⬆︎")} 을 누르세요`
            : `화면 <b>아래쪽 가운데</b> 공유 버튼 ${ICO("⬆︎")} 을 누르세요`,
          "목록을 위로 넘겨 <b>‘홈 화면에 추가’</b>를 누르세요",
          "오른쪽 위 <b>‘추가’</b>를 누르면 끝!",
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
      "홈 화면에 추가",
      "브라우저 메뉴에서 한 번만 눌러주면 됩니다.",
      [
        `브라우저 <b>메뉴</b> ${ICO("⋮")} 를 누르세요`,
        "<b>‘홈 화면에 추가’</b> 또는 <b>‘앱 설치’</b>를 누르세요",
        "<b>‘추가’</b>를 누르면 끝!",
      ],
      false
    );
  }

  /* ---- 노출 여부 판단 ---- */
  function refresh() {
    if (installed()) { cta.hidden = true; return; }
    if (snoozed()) { cta.hidden = true; return; }
    if (inApp) {
      $("#install-title").textContent = "홈 화면에 추가";
      $("#install-sub").textContent = "브라우저로 열면 앱처럼 쓸 수 있어요";
    } else if (isIOS) {
      $("#install-title").textContent = "홈 화면에 추가";
      $("#install-sub").textContent = "아이폰에서 3초면 끝나요";
    } else if (isAndroid) {
      $("#install-title").textContent = "홈 화면에 추가";
      $("#install-sub").textContent = "앱처럼 바로 열려요";
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

/* ---------- 시작 ---------- */
document.querySelector(".beta-badge").textContent = "Ri-Weather BETA " + APP_VER;
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

/* PWA 서비스 워커 — 새 버전이 올라오면 자동으로 최신 화면으로 교체 */
if ("serviceWorker" in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;              // 새로고침 무한반복 방지
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register("sw.js").then((reg) => {
    reg.update().catch(() => {});       // 실행할 때마다 새 버전 확인
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
}
