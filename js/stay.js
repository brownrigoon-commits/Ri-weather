/* =========================================================
 * 숙박 — 골프장 주변 숙소
 *
 * 2박 3일 투어처럼 "어디서 자지?"가 라운딩만큼 큰 고민이라는
 * 사장님 경험에서 출발한 메뉴 (2026-07-27).
 *
 * 검색 기준은 **골프장**이다. 지역명이 아니라 그 골프장 좌표에서
 * 가까운 순으로 찾고, 거리도 골프장 기준으로 표시한다.
 *
 * ⚠️ 가격은 넣지 않는다.
 *    카카오 로컬에는 숙박 요금이 없고, 야놀자·여기어때·트립닷컴은
 *    공개 API 를 주지 않는다. 확인할 수 없는 값을 지어내느니
 *    각 예약 사이트로 바로 넘어가는 버튼을 두어 실제 요금을 보게 한다.
 *    (틀릴 수 있으면 표시하지 않는다 — 앱의 절대 원칙)
 * ========================================================= */

const STAY_VIEW = { sort: "reco", cat: "전체" };
const stayCache = new Map();

/* 숙소 종류 — 카카오 카테고리 문자열을 우리 말로 묶는다 */
function stayKind(cat) {
  const c = cat || "";
  if (/리조트|콘도/.test(c)) return "리조트";
  if (/호텔/.test(c)) return "호텔";
  if (/펜션|풀빌라/.test(c)) return "펜션";
  if (/모텔|여관/.test(c)) return "모텔";
  if (/게스트|민박|한옥/.test(c)) return "게스트하우스";
  if (/캠핑|글램핑/.test(c)) return "캠핑";
  return "기타";
}
const STAY_ICON = {
  "리조트": "🏨", "호텔": "🏨", "펜션": "🏡", "모텔": "🛏️",
  "게스트하우스": "🏠", "캠핑": "⛺", "기타": "🛏️",
};

async function fetchKakaoStay(course) {
  const ck = course.lat.toFixed(3) + "," + course.lon.toFixed(3);
  if (stayCache.has(ck)) return stayCache.get(ck);
  const out = [];
  // 숙소는 식당보다 드물어 반경을 넓게(10km) 잡는다
  const pages = await Promise.all([1, 2, 3].map((page) =>
    kakaoApi("https://dapi.kakao.com/v2/local/search/category.json" +
      `?category_group_code=AD5&x=${course.lon}&y=${course.lat}&radius=10000&sort=distance&page=${page}&size=15`)
      .catch(() => ({}))));
  const seen = new Set();
  pages.forEach((j) => {
    (j.documents || []).forEach((d) => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      out.push({
        id: d.id,
        name: d.place_name,
        cat: (d.category_name || "").split(">").pop().trim(),
        kind: stayKind(d.category_name),
        phone: d.phone || "",
        addr: d.road_address_name || d.address_name || "",
        lat: parseFloat(d.y), lon: parseFloat(d.x),
        dist: parseInt(d.distance) || 0,
        url: d.place_url || "",
      });
    });
  });
  out.sort((a, b) => a.dist - b.dist);
  stayCache.set(ck, out);
  return out;
}

/* 예약 사이트 검색 링크 — 실제로 열리는 주소만 쓴다 (2026-07-27 응답코드 확인) */
function bookingLinks(name) {
  const q = encodeURIComponent(name);
  return [
    ["야놀자", "https://www.yanolja.com/search/" + q, "bk-ya"],
    ["여기어때", "https://www.goodchoice.kr/product/search/1?keyword=" + q, "bk-gc"],
    ["트립닷컴", "https://kr.trip.com/hotels/list?keyword=" + q, "bk-tc"],
  ];
}

function renderStayList(list, course) {
  const el = document.querySelector("#stay-list");
  el.innerHTML = "";
  if (!list.length) {
    el.innerHTML = '<p class="food-osm-empty">골프장 10km 안에서 숙소를 찾지 못했습니다.</p>';
    return;
  }

  const hasRatings = list.some((it) => (it.rating || 0) > 0);
  if (STAY_VIEW.sort === "reco" && !hasRatings) STAY_VIEW.sort = "dist";

  /* 정렬·종류 칩 */
  const bar = document.createElement("div");
  bar.className = "food-filter";
  const sorts = hasRatings ? [["reco", "⭐ 추천순"], ["dist", "📍 가까운순"]] : [["dist", "📍 가까운순"]];
  sorts.forEach(([v, t]) => {
    const b = document.createElement("button");
    b.className = "ff-chip" + (STAY_VIEW.sort === v ? " on" : "");
    b.textContent = t;
    b.addEventListener("click", () => { STAY_VIEW.sort = v; renderStayList(list, course); });
    bar.appendChild(b);
  });
  const kinds = ["전체", ...[...new Set(list.map((x) => x.kind))]];
  const row2 = document.createElement("div");
  row2.className = "food-filter";
  kinds.forEach((k) => {
    const b = document.createElement("button");
    b.className = "ff-chip" + (STAY_VIEW.cat === k ? " on" : "");
    b.textContent = k;
    b.addEventListener("click", () => { STAY_VIEW.cat = k; renderStayList(list, course); });
    row2.appendChild(b);
  });
  el.appendChild(bar);
  el.appendChild(row2);

  const note = document.createElement("p");
  note.className = "food-osm-sub";
  note.innerHTML = `${course.name} 기준 가까운 순 · 카카오맵 평점·리뷰로 추천순 정렬<br>` +
    `<b>요금은 예약 사이트에서 확인</b>하세요 — 실시간 요금은 앱에서 알 수 없습니다.`;
  el.appendChild(note);

  let arr = list.filter((x) => STAY_VIEW.cat === "전체" || x.kind === STAY_VIEW.cat);
  arr = arr.slice().sort((a, b) =>
    STAY_VIEW.sort === "reco" ? recoScore(b) - recoScore(a) : a.dist - b.dist);

  arr.slice(0, 30).forEach((it) => {
    const card = document.createElement("div");
    card.className = "food-item v2";
    const km = it.dist >= 1000 ? (it.dist / 1000).toFixed(1) + "km" : it.dist + "m";
    const star = it.rating ? `<span class="fi-star">⭐ ${it.rating.toFixed(1)}</span>
        <span class="fi-rc">(${it.reviews || 0})</span>` : "";
    card.innerHTML = `
      <div class="fi-head">
        <span class="fi-ico">${STAY_ICON[it.kind] || "🛏️"}</span>
        <div class="fi-title">
          <div class="fi-name">${it.name}</div>
          <div class="fi-meta">${it.kind} ${star}</div>
        </div>
        <span class="fi-addr-dist">${km}</span>
      </div>
      <div class="fi-photos" data-pid="${it.id}"></div>
      <div class="fi-addr">📍 ${it.addr}</div>
      <div class="fi-acts">
        ${it.phone ? `<a class="fa-btn fa-tel" href="tel:${it.phone}">📞 전화</a>` : ""}
        <a class="fa-btn fa-kakao" href="${it.url}" target="_blank" rel="noopener">카카오맵</a>
      </div>
      <div class="fi-acts stay-book">
        ${bookingLinks(it.name).map(([t, u, c]) =>
          `<a class="fa-btn ${c}" href="${u}" target="_blank" rel="noopener">${t} 요금보기</a>`).join("")}
      </div>`;
    el.appendChild(card);
    // 사진은 맛집과 같은 백엔드(가게 ID 기반 공식 사진첩)를 그대로 쓴다
    loadStayPhotos(it, card.querySelector(".fi-photos"));
  });
  if (typeof staggerIn === "function") staggerIn(el);
}

/* 숙소 사진 — 맛집과 같은 백엔드·같은 캐시를 쓴다.
   (맛집 쪽 로더는 그 함수 안에 숨어 있어 재사용이 안 되므로 여기서 따로 부른다) */
async function loadStayPhotos(it, box) {
  if (!box) return;
  const pid = it.id || foodPid(it);
  if (!window.RIW_BACKEND || !pid) {
    if (it.url) box.innerHTML = `<a class="fi-place-mini" href="${it.url}" target="_blank" rel="noopener">📷 카카오맵에서 사진 보기</a>`;
    return;
  }
  const LS = "riweather.placeph5." + pid;
  let arr = null;
  try {
    const c = JSON.parse(localStorage.getItem(LS) || "null");
    if (c && Date.now() - c.t < 7 * 864e5) arr = c.d;
  } catch (_) {}
  if (!arr) {
    try {
      const r = await fetchT(window.RIW_BACKEND + "?fn=placephotos&id=" + pid, null, 8000);
      arr = genuinePhotos((await r.json()).photos).slice(0, 10);
      try { localStorage.setItem(LS, JSON.stringify({ t: Date.now(), d: arr })); } catch (_) {}
    } catch (_) { arr = []; }
  }
  const ok = genuinePhotos(arr).slice(0, 6);
  if (!ok.length) {
    box.innerHTML = it.url
      ? `<a class="fi-place-mini" href="${it.url}" target="_blank" rel="noopener">📷 카카오맵에서 사진 보기</a>` : "";
    return;
  }
  box.innerHTML = ok.map((u) =>
    `<img src="${foodThumb(u)}" alt="" loading="lazy" data-full="${u}">`).join("");
  box.querySelectorAll("img").forEach((im) => {
    im.addEventListener("click", () => {
      if (typeof openLightbox === "function") openLightbox(ok, ok.indexOf(im.dataset.full));
    });
  });
}

async function openStayView() {
  const course = currentCourse;
  if (viewStack[viewStack.length - 1] !== "stay") pushView("stay");
  document.querySelector("#stay-title").textContent = "숙박";
  document.querySelector("#stay-desc").textContent = `${course.name} 주변 숙소`;
  document.querySelector("#stay-list").innerHTML = "";

  const alive = () => currentCourse === course && viewStack[viewStack.length - 1] === "stay";
  if (!getKakaoKey()) {
    document.querySelector("#stay-list").innerHTML =
      '<p class="food-osm-empty">숙소 정보를 불러올 수 없습니다.</p>';
    return;
  }

  const w = WAIT.open("stay", { msgs: [`${course.name} 주변 숙소를 찾고 있어요`] });
  try {
    w.say(`${course.name} 주변 숙소를 찾고 있어요`, 12);
    const list = await fetchKakaoStay(course);
    if (!alive()) { w.close(); return; }

    if (!list.length) { w.close(); renderStayList([], course); return; }
    w.say(`숙소 ${list.length}곳을 찾았어요<br>평점을 확인하고 있어요`, 42);
    try { await attachFoodRatings(list); } catch (_) {}
    if (!alive()) { w.close(); return; }

    w.say("숙소 사진을 모으고 있어요", 70);
    try { await prefetchFoodPhotos(list); } catch (_) {}
    if (!alive()) { w.close(); return; }

    w.say("추천순으로 정리하고 있어요", 92);
    STAY_VIEW.sort = "reco";
    STAY_VIEW.cat = "전체";
    renderStayList(list, course);
  } catch (e) {
    document.querySelector("#stay-list").innerHTML =
      '<p class="food-osm-empty">숙소를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
  } finally {
    w.close();
  }
}

window.openStayView = openStayView;
