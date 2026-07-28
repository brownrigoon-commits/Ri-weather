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

/* 예약 버튼 — 링크 하나만 단다. 요금 금액은 아직 표시하지 않는다.
 *
 * 2026-07-28 조사 결론:
 *  · 야놀자·여기어때에는 외부 공개 요금 API가 없다. 화면을 긁는 건 양사 약관 위반이고
 *    성과도용으로 민사 10억원 배상 판결 전례가 있다(서울중앙지법 2018가합508729, 항소기각).
 *    법인 명의 서비스에서 할 수 없다.
 *  · 네이버·카카오 공개 API에는 숙박 요금 필드 자체가 없다.
 *  · 공공데이터 TourAPI 요금은 실판매가가 아니라 최대 5년 묵은 신고 정가이고
 *    성수기 기간 정의도 없어 오늘 요금을 알 수 없다 → "틀릴 수 있으면 표시 안 함" 원칙에 걸린다.
 *  · 합법적으로 실시간 실판매가를 얻는 유일한 길은 아고다 제휴 API(lt_v1)이고,
 *    사장님이 partners.agoda.com 승인을 받아야 열린다.
 * 요금이 확보되면 이 함수와 STAY_SORTS 두 곳만 고치면 된다.
 */
function bookBtn(it) {
  // 야놀자 — 국내 펜션·모텔 재고가 가장 넓어 검색이 헛치는 경우가 적다
  const [t, u, c] = bookingLinks(it.name)[0];
  return `<a class="fa-btn ${c}" href="${u}" target="_blank" rel="noopener">🛎️ ${t}에서 요금 보기</a>`;
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

  /* 정렬·종류 칩 — 칩은 반드시 .ff-row(flex·wrap) 안에 넣는다.
     .food-filter 는 여백만 주는 껍데기라 여기에 바로 넣으면 줄바꿈이 깨진다. */
  const bar = document.createElement("div");
  bar.className = "food-filter";
  const mk = (parent, items, cur, set) => {
    const row = document.createElement("div");
    row.className = "ff-row";
    items.forEach(([v, t]) => {
      const b = document.createElement("button");
      b.className = "ff-chip" + (cur === v ? " on" : "");
      b.textContent = t;
      b.addEventListener("click", () => { set(v); renderStayList(list, course); });
      row.appendChild(b);
    });
    parent.appendChild(row);
  };
  const sorts = [["dist", "📍 가까운순"]];
  if (hasRatings) sorts.push(["reco", "⭐ 추천순"]);
  mk(bar, sorts, STAY_VIEW.sort, (v) => { STAY_VIEW.sort = v; });
  mk(bar, ["전체", ...new Set(list.map((x) => x.kind))].map((k) => [k, k]),
    STAY_VIEW.cat, (v) => { STAY_VIEW.cat = v; });
  el.appendChild(bar);

  const note = document.createElement("p");
  note.className = "food-osm-sub";
  note.innerHTML = `${course.name} 기준 가까운 순 · 사진이 등록된 숙소만 보여줍니다<br>` +
    `<b>요금은 예약 사이트에서 확인</b>하세요 — 날짜·인원에 따라 달라집니다.`;
  el.appendChild(note);

  let arr = list.filter((x) => STAY_VIEW.cat === "전체" || x.kind === STAY_VIEW.cat);
  arr = arr.slice().sort((a, b) =>
    STAY_VIEW.sort === "reco" ? recoScore(b) - recoScore(a) : a.dist - b.dist);

  arr.slice(0, 30).forEach((it) => {
    const card = document.createElement("div");
    card.className = "food-item v2";
    const km = it.dist >= 1000 ? (it.dist / 1000).toFixed(1) + "km" : it.dist + "m";
    const tel = (it.phone || "").replace(/[^0-9+]/g, "");
    const star = it.rating
      ? ` <span class="fi-star">⭐ ${it.rating.toFixed(1)} <em>(${it.reviews || 0})</em></span>` : "";
    // 카드 구조는 맛집(.fi-row/.fi-actions)과 똑같이 맞춘다.
    // 예전엔 .fi-head/.fi-ico/.fi-acts 를 썼는데 CSS 에 없는 이름이라
    // flex 가 안 걸려 아이콘·거리가 세로로 쌓이고 버튼이 겹쳤다. (2026-07-28)
    card.innerHTML = `
      <div class="fi-row">
        <span class="fi-emoji">${STAY_ICON[it.kind] || "🛏️"}</span>
        <div style="flex:1;min-width:0">
          <div class="fi-name">${it.name}</div>
          <div class="fi-sub">${it.kind}${star}</div>
        </div>
        <span class="fi-dist">${km}</span>
      </div>
      <div class="fi-photos" data-pid="${it.id}"></div>
      <div class="fi-meta">📍 ${it.addr}</div>
      <div class="fi-actions">
        ${tel ? `<a class="fa-btn fa-tel" href="tel:${tel}">📞 전화</a>` : ""}
        <a class="fa-btn fa-kakao" href="kakaomap://route?ep=${it.lat},${it.lon}&by=CAR">카카오내비</a>
        <a class="fa-btn fa-tmap" href="tmap://route?goalname=${encodeURIComponent(it.name)}&goaly=${it.lat}&goalx=${it.lon}">T맵</a>
        <a class="fa-btn fa-naver" href="https://m.search.naver.com/search.naver?query=${encodeURIComponent(it.name)}" target="_blank" rel="noopener"><b>N</b>리뷰</a>
      </div>
      <div class="fi-actions stay-book">${bookBtn(it)}</div>`;
    el.appendChild(card);
    // 사진은 맛집과 같은 백엔드(가게 ID 기반 공식 사진첩)를 그대로 쓴다
    loadStayPhotos(it, card.querySelector(".fi-photos"));
  });
  if (typeof staggerIn === "function") staggerIn(el);
}

/* 숙소 사진 — attachPhotos() 가 미리 받아 둔 it.photos 를 그린다.
   목록에 오른 곳은 사진이 있음이 보장되므로 대체 링크는 두지 않는다. */
function loadStayPhotos(it, box) {
  if (!box) return;
  const ok = genuinePhotos(it.photos).slice(0, 6);
  box.hidden = !ok.length;
  if (!ok.length) return;
  // 라이트박스는 {t:썸네일, u:원본} 형태를 받는다. 예전엔 문자열을 넘겨 확대가 빈 화면이었다.
  const imgs = ok.map((u) => ({ t: foodThumb(u), u: u }));
  box.innerHTML = imgs.map((im, k) =>
    `<img src="${im.t}" data-k="${k}" alt="${it.name}" loading="lazy">`).join("");
  box.querySelectorAll("img").forEach((im) => {
    im.addEventListener("click", () => {
      if (typeof openLightbox === "function") openLightbox(imgs, +im.dataset.k);
    });
    im.addEventListener("error", () => im.remove());
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

    // 사진 없는 숙소는 목록에서 뺀다 — 사진으로 고르는 화면이라 이름만 있는 카드는 의미가 없다
    w.say("숙소 사진을 모으고 있어요", 70);
    let shown = [];
    try {
      shown = await attachPhotos(list, "stay",
        (d, t) => w.say(`숙소 사진을 모으고 있어요 (${d}/${t})`, 70 + Math.round((d / t) * 20)));
    } catch (_) { shown = []; }
    if (!alive()) { w.close(); return; }
    if (!shown.length) {
      document.querySelector("#stay-list").innerHTML =
        '<p class="food-osm-empty">사진이 등록된 숙소를 찾지 못했습니다.<br>잠시 후 다시 열어 주세요.</p>';
      w.close();
      return;
    }

    w.say("가까운 순으로 정리하고 있어요", 92);
    STAY_VIEW.sort = "dist";
    STAY_VIEW.cat = "전체";
    renderStayList(shown, course);
  } catch (e) {
    document.querySelector("#stay-list").innerHTML =
      '<p class="food-osm-empty">숙소를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
  } finally {
    w.close();
  }
}

window.openStayView = openStayView;
