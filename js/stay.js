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

/* 날짜·인원 — 숙소는 "언제 몇 명"이 정해져야 빈방을 알 수 있다(사장님 지적 2026-07-28).
   우리가 빈방을 알 수는 없지만, 고른 조건을 예약 사이트로 그대로 넘겨
   유저가 같은 조건을 두 번 입력하지 않게 한다.
   기본값 = 내일 하루 1박·성인 2명 (골퍼가 가장 많이 쓰는 조합). */
const STAY_VIEW = { sort: "reco", cat: "전체", nights: 1, adults: 2, rooms: 1, inDate: null };
const stayCache = new Map();

/* 숙소 종류 — 카카오 카테고리와 상호를 함께 본다.
 *
 * 무인텔은 카카오가 따로 분류하지 않고 전부 "여관,모텔"로 넣는다
 * (아리아무인텔·더자라무인텔·블랙앤화이트무인텔 실측 확인, 2026-07-28).
 * 골퍼가 실제로 많이 쓰는 유형이라 상호에서 잡아 따로 보여준다.
 */
function stayKind(cat, name) {
  const c = cat || "", n = name || "";
  if (/무인/.test(n)) return "무인텔";
  if (/리조트|콘도/.test(c) || /리조트|콘도|골프텔/.test(n)) return "리조트";
  if (/호텔/.test(c) || /호텔/.test(n)) return "호텔";
  if (/모텔|여관/.test(c) || /모텔|여관/.test(n)) return "모텔";
  if (/펜션|풀빌라/.test(c) || /펜션|풀빌라/.test(n)) return "펜션";
  if (/게스트/.test(c) || /게스트하우스/.test(n)) return "게스트하우스";
  // 한옥숙소도 소규모 가정형 숙소라 민박으로 묶는다 (카카오 분류상 별개, 수가 적음)
  if (/민박|한옥/.test(c) || /민박/.test(n)) return "민박";
  if (/캠핑|글램핑|카라반/.test(c)) return "캠핑";
  return "기타";
}

/* 라운딩 전후로 하룻밤 묵는 곳만 보여준다.
   펜션·캠핑·글램핑은 골프 목적에 맞지 않아 제외, 게스트하우스·민박은 포함
   (사장님 판단 2026-07-28). 업종 미상("기타")도 뺀다 — 무엇인지 모르는 곳을 권할 순 없다. */
const STAY_ALLOW = ["무인텔", "모텔", "호텔", "리조트", "게스트하우스", "민박"];

const STAY_ICON = {
  "리조트": "🏨", "호텔": "🏨", "무인텔": "🔑", "모텔": "🛏️",
  "게스트하우스": "🏠", "민박": "🏠", "펜션": "🏡", "캠핑": "⛺", "기타": "🛏️",
};

/* 유형별 키워드로 나눠 찾는다.
 *
 * 예전엔 숙박 카테고리(AD5) 하나로 훑었는데, 카카오가 **45건에서 자르기 때문에**
 * 가까운 펜션·캠핑장이 그 45칸을 채워버리고 정작 모텔이 밀려났다.
 * 실측(2026-07-28): 알프스대영CC 는 200m 앞에 모텔이 있는데도 카테고리 검색엔
 * 안 잡혔고, 신라CC 는 쓸 만한 곳이 2곳뿐이었다.
 * 키워드별로 따로 부르면 각각 45건씩 받으므로 신라CC 2곳 → 81곳이 된다.
 */
const STAY_KEYWORDS = ["모텔", "무인텔", "호텔", "여관", "리조트", "게스트하우스", "민박"];

/* 사진 확인은 한 곳당 요청 1건이라 가까운 순으로 잘라 쓴다.
   그런데 거리만으로 자르면 한 유형이 자리를 다 먹는다 — 민박을 넣자마자
   가까운 민박들이 40칸을 채워 모텔·호텔이 밀려나 목록이 25→18곳으로 줄었다.
   그래서 주력 유형 몫을 먼저 채우고 게스트하우스·민박을 거기에 더한다. (2026-07-28)
   한 곳당 0.5초(8개 병렬)이므로 최대 52곳이면 약 26초. */
const STAY_MAX = 40;                                     // 주력 유형 몫
const STAY_CORE = ["무인텔", "모텔", "호텔", "리조트"];
const STAY_SIDE_MAX = 12;                                // 게스트하우스·민박은 여기에 더해서

async function fetchKakaoStay(course) {
  const ck = course.lat.toFixed(3) + "," + course.lon.toFixed(3);
  if (stayCache.has(ck)) return stayCache.get(ck);

  const reqs = [];
  STAY_KEYWORDS.forEach((kw) => {
    [1, 2, 3].forEach((page) => {
      reqs.push(kakaoApi("https://dapi.kakao.com/v2/local/search/keyword.json" +
        `?query=${encodeURIComponent(kw)}&category_group_code=AD5` +
        `&x=${course.lon}&y=${course.lat}&radius=20000&sort=distance&page=${page}&size=15`)
        .catch(() => ({})));
    });
  });
  const pages = await Promise.all(reqs);

  const out = [], seen = new Set();
  pages.forEach((j) => {
    (j.documents || []).forEach((d) => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      const kind = stayKind(d.category_name, d.place_name);
      if (STAY_ALLOW.indexOf(kind) < 0) return;      // 펜션·캠핑·게하 등은 제외
      out.push({
        id: d.id,
        name: d.place_name,
        cat: (d.category_name || "").split(">").pop().trim(),
        kind: kind,
        phone: d.phone || "",
        addr: d.road_address_name || d.address_name || "",
        lat: parseFloat(d.y), lon: parseFloat(d.x),
        dist: parseInt(d.distance) || 0,
        url: d.place_url || "",
      });
    });
  });
  out.sort((a, b) => a.dist - b.dist);
  // 주력 유형이 자리를 잃지 않도록 몫을 나눠 자른다
  // 게스트하우스·민박은 항상 뒤 — 호텔·모텔·무인텔이 먼저 나와야 한다
  const core = out.filter((x) => STAY_CORE.indexOf(x.kind) >= 0).slice(0, STAY_MAX);
  const side = out.filter((x) => STAY_CORE.indexOf(x.kind) < 0).slice(0, STAY_SIDE_MAX);
  const near = core.concat(side);
  stayCache.set(ck, near);
  return near;
}

/* 예약 앱 검색어 만들기 — "숙소명만 넣으면 헛친다"를 고치는 부분.
 *
 * 카카오맵 상호는 간판·사업자명이고 예약앱 상호는 마케팅명이라 서로 다르다.
 * (카카오 "몽마르뜨모텔" ↔ 야놀자 "원주 몽마르뜨" 처럼)
 * 그래서 ① 업종어를 떼고 ② 시·군 이름을 붙인다.
 * 이름이 너무 짧거나 흔하면(2S, 궁 …) 검색엔진이 엉뚱한 광고를 물어오므로
 * 아예 이름을 빼고 **지역 숙소 목록**으로 보낸다 — 그러면 "결과 없음"이 나올 수 없다.
 * (사장님 신고 사례: 몽마르뜨모텔·2S모텔·뷰티모텔 — 2026-07-28)
 */
const STAY_BIZWORD = /(무인호텔|무인텔|모텔|호텔|여관|여인숙|파크텔|골프텔|리조트|콘도|게스트하우스|호스텔|민박|한옥|펜션|풀빌라|스테이|인|INN)/gi;
const STAY_GENERIC = /^(그랜드|뉴|파크|로얄|로얄|프린스|킹|퀸|스타|럭키|자유|시티|센트럴|중앙|대한|한국)$/;

function stayRegion(addr) {
  // "강원특별자치도 원주시 소초면 …" → "원주"  /  "경기 이천시 장호원읍 …" → "이천"
  const m = String(addr || "").match(/([가-힣]{2,10}?)(시|군)(?=\s|$)/);
  return m ? m[1] : "";
}

/* 날짜 계산 — 로컬 기준 (toISOString 은 UTC 라 밤에 하루 밀린다) */
function ymd(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
         "-" + String(d.getDate()).padStart(2, "0");
}
function stayDates() {
  const inD = STAY_VIEW.inDate ? new Date(STAY_VIEW.inDate + "T12:00:00")
                               : new Date(Date.now() + 864e5);          // 기본: 내일
  const outD = new Date(inD.getTime() + Math.max(1, STAY_VIEW.nights) * 864e5);
  return { ci: ymd(inD), co: ymd(outD) };
}

/* 예약 사이트는 '방 하나에 몇 명'으로 검색한다(국내 숙박은 객실 단위 판매).
   그래서 '2명이 방 2개'는 인원 2가 아니라 **1인 기준**으로 찾아야 1인실 요금이 보인다.
   확인(2026-07-28): 여기어때는 room 같은 객실 수 파라미터를 받지 않는다 → 인원으로 환산한다. */
function perRoom() {
  return Math.max(1, Math.ceil(STAY_VIEW.adults / Math.max(1, STAY_VIEW.rooms)));
}

function stayQuery(it) {
  const region = stayRegion(it.addr);
  let core = String(it.name || "")
    .replace(/\(.*?\)/g, " ")
    .replace(/(^|\s)\S*점(?=\s|$)/g, " ")     // "브라운도트 영천점" → "브라운도트"
    .replace(STAY_BIZWORD, " ")
    .replace(/[^0-9A-Za-z가-힣\s]/g, " ")
    .replace(/\s+/g, " ").trim();
  // 너무 짧거나 흔한 이름은 검색이 엉뚱한 광고를 물어온다 → 지역 목록으로.
  // 한글은 1자까지만 폴백("궁"). 2자는 "자바"처럼 충분히 특정되는 이름이 많다.
  const tooShort = /^[가-힣]?$/.test(core) || /^[0-9A-Za-z]{0,2}$/.test(core);
  if (!core || tooShort || STAY_GENERIC.test(core)) return { q: region, byName: false };
  return { q: (region ? region + " " : "") + core, byName: true };
}

/* 예약 앱 3종 — 딥링크(앱 스킴)는 쓰지 않는다.
   야놀자·여기어때 모두 유니버설링크 설정 파일이 없어(404) 앱이 없으면 오류 화면이 뜬다. */
function bookingLinks(it) {
  const { q, byName } = stayQuery(it);
  const e = encodeURIComponent(q);
  const tail = byName ? "" : " 숙소";
  /* ⚠️ 날짜·인원을 링크에 붙이지 않는다.
     붙였더니 "옵션 없을 때는 나오던 숙소가 안 나온다"는 확인을 받았다(2026-07-28).
     여기어때는 파라미터가 없어도 항상 오늘~내일 날짜가 걸려 있고, 조건을 좁힐수록
     재고 없는 숙소가 목록에서 빠진다. 링크의 목적은 "그 숙소를 찾아주는 것"이므로
     조건보다 '찾아지는 것'이 먼저다. 조건은 예약 사이트에서 바꾸면 된다. */
  const out = [];
  // 카카오 예약 연동이 있는 곳은 여기가 가장 확실하다 — 검색이 아니라 그 숙소 페이지로 바로 간다.
  // 실제 요금과 예약 탭이 이 페이지에 있다(치악산호텔 60,000원 확인).
  if (typeof it.vendor === "number" && it.vendor > 0 && it.url) {
    out.push(["카카오 예약", it.url, "bk-kk", ""]);
  }
  out.push(
    ["야놀자", `https://nol.yanolja.com/results?keyword=${e}`, "bk-ya", tail],
    ["여기어때", `https://www.yeogi.com/domestic-accommodations?searchType=KEYWORD&keyword=${e}`, "bk-gc", tail],
    ["네이버", `https://search.naver.com/search.naver?query=${encodeURIComponent(q + " 숙박")}`, "bk-nv", tail]
  );
  return out;
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
  // "요금 보기"라고 쓰면 요금이 있다고 단정하는 셈이다. 실제로는 검색만 해줄 뿐이라
  // 없는 숙소일 때 사용자가 속았다고 느낀다 → "검색"으로 정직하게 쓴다. (2026-07-28)
  return bookingLinks(it).map(([t, u, c, tail]) =>
    `<a class="fa-btn ${c}" href="${u}" target="_blank" rel="noopener">${t}${tail}</a>`).join("");
}

/* 예약 '창구'가 있는지만 알려준다 — 날짜별 빈방 여부가 아니다.
   vendor = 카카오 예약하기가 제공한 공식 객실사진 수.
   실측(2026-07-28): 치악산호텔 7, 무인호텔하루 12 → 온라인 예약 채널 O
                     치악산모텔·카라반리조트 0 → 채널 X (예약앱에서도 안 나옴)

   ⚠️ "예약 가능" 이라고 쓰면 안 된다. 방이 있는지는 날짜·인원을 넣어야 알 수 있고
      우리는 그 정보를 갖고 있지 않다. 아는 것(=예약 창구의 종류)만 말한다.
      vendor 가 null 이면 옛 백엔드라 판단 불가 → 아무것도 표시하지 않는다. */
function bookableTag(it) {
  if (typeof it.vendor !== "number") return "";
  return it.vendor > 0
    ? ' <span class="stay-ok">온라인 예약</span>'
    : ' <span class="stay-tel">전화 예약</span>';
}

function renderStayList(list, course) {
  const el = document.querySelector("#stay-list");
  el.innerHTML = "";
  if (!list.length) {
    el.innerHTML = '<p class="food-osm-empty">골프장 20km 안에서 묵을 만한 곳을 찾지 못했습니다.<br>' +
      '<small>호텔·모텔·무인텔·게스트하우스 위주로 찾습니다.</small></p>';
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
  /* 고른 조건 요약 — 바꾸려면 조건 화면으로 되돌아간다 */
  const { ci, co } = stayDates();
  const sum = document.createElement("div");
  sum.className = "stay-cond";
  sum.innerHTML = `<span>🗓 ${ci} → ${co} · 성인 ${STAY_VIEW.adults}명 · 방 ${STAY_VIEW.rooms}개</span>
    <button type="button" class="sc-edit">조건 변경</button>`;
  sum.querySelector(".sc-edit").addEventListener("click", () => renderStayForm(course));
  bar.appendChild(sum);

  const sorts = [["dist", "📍 가까운순"]];
  if (hasRatings) sorts.push(["reco", "⭐ 추천순"]);
  mk(bar, sorts, STAY_VIEW.sort, (v) => { STAY_VIEW.sort = v; });
  // 칩 순서는 STAY_ALLOW 를 따른다 — 목록에 들어온 순서대로 두면 갈 때마다 자리가 바뀐다
  const have = new Set(list.map((x) => x.kind));
  mk(bar, ["전체", ...STAY_ALLOW.filter((k) => have.has(k))].map((k) => [k, k]),
    STAY_VIEW.cat, (v) => { STAY_VIEW.cat = v; });
  el.appendChild(bar);

  const note = document.createElement("p");
  note.className = "food-osm-sub";
  note.innerHTML = `${course.name} 기준 가까운 순 · 하룻밤 묵기 좋은 곳만 골랐습니다 (펜션·캠핑 제외)<br>` +
    `<b>요금은 예약 사이트에서 확인</b>하세요 — 날짜·인원에 따라 달라집니다.`;
  el.appendChild(note);

  let arr = list.filter((x) => STAY_VIEW.cat === "전체" || x.kind === STAY_VIEW.cat);
  // 어떤 정렬을 고르든 게스트하우스·민박은 뒤로 밀어 둔다.
  // 골퍼가 찾는 건 하룻밤 자고 나가는 호텔·모텔·무인텔이고,
  // 게하·민박은 그런 곳이 없을 때 보이는 대안이다. (사장님 지시 2026-07-28)
  const side = (x) => (STAY_CORE.indexOf(x.kind) < 0 ? 1 : 0);
  arr = arr.slice().sort((a, b) => (side(a) - side(b)) ||
    (STAY_VIEW.sort === "reco" ? recoScore(b) - recoScore(a) : a.dist - b.dist));

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
          <div class="fi-sub">${it.kind}${star}${bookableTag(it)}</div>
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

/* 숙박은 조건부터 받는다.
   "언제 몇 명"이 정해져야 예약 사이트에서 빈방을 볼 수 있고,
   조건도 모르는 채로 25초짜리 검색을 먼저 돌리는 건 낭비다. (사장님 지시 2026-07-28) */
function openStayView() {
  const course = currentCourse;
  if (viewStack[viewStack.length - 1] !== "stay") pushView("stay");
  document.querySelector("#stay-title").textContent = "숙박";
  document.querySelector("#stay-desc").textContent = `${course.name} 주변 숙소`;
  renderStayForm(course);
}

/* 고른 조건을 사람 말로 — 방을 나눠 잡으면 왜 1인 기준으로 검색하는지도 알려준다.
   (같이 자기 불편해 방을 따로 잡는 경우가 많다 — 사장님 지적 2026-07-28) */
function stayCondText() {
  const d = stayDates();
  const base = `${d.ci} → ${d.co} · 성인 ${STAY_VIEW.adults}명 · 방 ${STAY_VIEW.rooms}개`;
  if (STAY_VIEW.rooms <= 1) return base;
  const n = perRoom();
  return base + `<br><b>방 하나에 ${n}명</b> 기준으로 찾습니다 — 예약은 방 수만큼 나눠서 하세요.`;
}

function renderStayForm(course) {
  const el = document.querySelector("#stay-list");
  const { ci, co } = stayDates();
  el.innerHTML = `
    <div class="stay-form">
      <div class="sf-title">언제, 몇 분이<br>묵으시나요?</div>
      <div class="sf-sub">이 조건에 맞는 숙소를 골프장 주변에서 찾아드립니다.<br>
        <b>실제 빈방과 요금은 예약 사이트에서</b> 확인하세요.</div>
      <div class="stay-when">
        <div class="sw-row">
          <label class="sw-f"><span>체크인</span>
            <input type="date" id="sw-in" value="${ci}" min="${ymd(new Date())}"></label>
          <label class="sw-f sw-n"><span>숙박</span>
            <select id="sw-nights">${[1,2,3,4].map((n) =>
              `<option value="${n}"${n === STAY_VIEW.nights ? " selected" : ""}>${n}박</option>`).join("")}</select></label>
          <label class="sw-f sw-n"><span>인원</span>
            <select id="sw-adults">${[1,2,3,4,5,6].map((n) =>
              `<option value="${n}"${n === STAY_VIEW.adults ? " selected" : ""}>${n}명</option>`).join("")}</select></label>
        </div>
        <div class="sw-row sw-room">
          <label class="sw-f"><span>객실</span>
            <select id="sw-rooms">${[1,2,3,4].map((n) =>
              `<option value="${n}"${n === STAY_VIEW.rooms ? " selected" : ""}>${n}개 방</option>`).join("")}</select></label>
        </div>
        <div class="sw-note" id="sw-note">${stayCondText()}</div>
      </div>
      <button class="cf-btn" id="sw-go">${course.name} 주변 숙소 찾기</button>
    </div>`;

  const sync = () => {
    STAY_VIEW.inDate = el.querySelector("#sw-in").value || null;
    STAY_VIEW.nights = +el.querySelector("#sw-nights").value;
    STAY_VIEW.adults = +el.querySelector("#sw-adults").value;
    STAY_VIEW.rooms = +el.querySelector("#sw-rooms").value;
    el.querySelector("#sw-note").innerHTML = stayCondText();
  };
  ["#sw-in", "#sw-nights", "#sw-adults", "#sw-rooms"].forEach((q) =>
    el.querySelector(q).addEventListener("change", sync));
  el.querySelector("#sw-go").addEventListener("click", () => { sync(); runStaySearch(course); });
}

async function runStaySearch(course) {
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
    w.say(`숙소 ${list.length}곳을 찾았어요<br>묵어본 사람들 평을 확인하고 있어요`, 34);
    try { await attachFoodRatings(list); } catch (_) {}
    if (!alive()) { w.close(); return; }

    // 사진 없는 숙소는 목록에서 뺀다 — 사진으로 고르는 화면이라 이름만 있는 카드는 의미가 없다
    // 오래 걸리는 구간이라 "내가 이만큼 발품 팔고 있다"를 문구로 계속 바꿔가며 보여준다
    const STEPS = [
      "숙소를 하나씩 찾아가 보고 있어요",
      "객실이 어떤지 사진을 모으는 중이에요",
      "잠자리 컨디션을 살펴보고 있어요",
      "주차·시설은 어떤지 확인하고 있어요",
      "골프장에서 얼마나 가까운지 재고 있어요",
      "사진이 없는 곳은 걸러내고 있어요",
      "보기 좋게 줄 세우고 있어요",
    ];
    w.say(STEPS[0], 46);
    let shown = [];
    try {
      shown = await attachPhotos(list, "stay", (d, t) => {
        const i = Math.min(STEPS.length - 1, Math.floor((d / t) * STEPS.length));
        w.say(`${STEPS[i]} (${d}/${t})`, 46 + Math.round((d / t) * 44));
      });
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
