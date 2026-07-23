/* ============================================================
 * Ri-Weather(골프라이프) 백엔드 — Google Apps Script
 *
 * 기능 1) 이용 통계 수집·조회  (관리자 모드)
 * 기능 2) 카카오 플레이스 사진 프록시 (맛집 — '그 가게' 사진만 정확히)
 *
 * 설치법은 docs/백엔드_설치안내.md 참고 (약 5분)
 * ⚠️ 위치 좌표(위도·경도)는 어떤 경우에도 다루지 않는다.
 * ============================================================ */

var ADMIN_PW = "golf2026!";   // 관리자 통계 조회 비밀번호 — 설치 때 꼭 바꾸세요
var SHEET_ID = "1XQ6pbcO9pMnxvpL3K-WiMCgqd5WVIupHgi9uS-vmxcM";   // '골프라이프 통계' 시트

/* ---------- 공통 ---------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("log");
  if (!sh) {
    sh = ss.insertSheet("log");
    sh.appendRow(["시각", "cid", "이벤트", "이름", "버전", "기기", "연령대", "성별"]);
  }
  return sh;
}

/* ---------- 통계 수집 (앱 → 서버) ---------- */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    var rows = body.rows || [];
    if (!rows.length || rows.length > 100) return json_({ ok: false });
    var sh = sheet_();
    var out = [];
    rows.forEach(function (r) {
      // 좌표성 데이터는 서버에서도 한 번 더 차단
      var s = JSON.stringify(r);
      if (/lat|lon|coord|위도|경도/i.test(s)) return;
      out.push([
        new Date(r.t || Date.now()),
        String(r.cid || "").slice(0, 20),
        String(r.ev || "").slice(0, 20),
        String(r.name || "").slice(0, 60),
        String(r.ver || "").slice(0, 10),
        String(r.dev || "").slice(0, 10),
        String(r.age || "").slice(0, 10),
        String(r.gen || "").slice(0, 6),
      ]);
    });
    if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, 8).setValues(out);
    return json_({ ok: true, n: out.length });
  } catch (err) {
    return json_({ ok: false, err: String(err) });
  }
}

/* ---------- 조회 (관리자 화면 / 사진 프록시) ---------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.fn === "placephotos") return placePhotos_(p.id);
  if (p.fn === "placemeta") return placeMeta_(p.ids);
  if (p.fn === "summary") {
    if (p.pw !== ADMIN_PW) return json_({ err: "비밀번호가 틀립니다" });
    return summary_();
  }
  return json_({ ok: true, service: "golflife-backend" });
}

/* 카카오 플레이스 사진 — 가게 ID 기반이라 다른 가게 사진이 섞일 수 없음 */
function placePhotos_(id) {
  id = String(id || "").replace(/\D/g, "");
  if (!id) return json_({ photos: [] });
  var cache = CacheService.getScriptCache();
  var hit = cache.get("p3" + id);
  if (hit) return json_(JSON.parse(hit));
  var out = { photos: [], rating: 0, reviews: 0 };
  var dbg = { code: 0, len: 0 };
  try {
    // 카카오는 브라우저처럼 보이는 요청만 허용 — Referer·UA 필수
    var r = UrlFetchApp.fetch("https://place-api.map.kakao.com/places/panel3/" + id, {
      headers: {
        pf: "web",
        Accept: "application/json",
        Referer: "https://place.map.kakao.com/" + id,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      },
      muteHttpExceptions: true,
    });
    dbg.code = r.getResponseCode();
    var txt = r.getContentText();
    dbg.len = txt.length;
    if (dbg.code === 200) {
      // 사진: '그 가게 리뷰에 첨부된 카카오맵 등록 사진'만 채택.
      // 블로그 글 썸네일(postfiles·mblogthumb)은 가게와 무관한 장식 이미지가 섞여 절대 쓰지 않는다.
      // profile 은 리뷰 작성자 프로필이므로 제외하고 review 사진만.
      var m = txt.match(/https?:[^"\\]*kakaomapPhoto\/review[^"\\]*/g) || [];
      var seen = {};
      m.forEach(function (u) {
        if (!seen[u]) { seen[u] = 1; out.photos.push(u); }
      });
      out.photos = out.photos.slice(0, 10);
      // 평점·리뷰수: 추천순 정렬용
      try {
        var j = JSON.parse(txt);
        var sc = (j.kakaomap_review || {}).score_set || {};
        out.rating = sc.average_score || 0;
        out.reviews = sc.review_count || 0;
      } catch (e2) {}
    }
  } catch (err) { dbg.err = String(err).slice(0, 80); }
  out.dbg = dbg;
  cache.put("p3" + id, JSON.stringify(out), 21600);   // 6시간 캐시
  return json_(out);
}

/* 여러 가게의 평점·리뷰수 일괄 조회 — 맛집 '추천순' 정렬용 (가게 ID 기반 = 정확) */
function placeMeta_(ids) {
  ids = String(ids || "").split(",").map(function (x) { return x.replace(/\D/g, ""); })
    .filter(Boolean).slice(0, 60);
  var cache = CacheService.getScriptCache();
  var out = {}, need = [];
  ids.forEach(function (id) {
    var hit = cache.get("m2" + id);
    if (hit) out[id] = JSON.parse(hit);
    else need.push(id);
  });
  if (need.length) {
    var reqs = need.map(function (id) {
      return {
        url: "https://place-api.map.kakao.com/places/panel3/" + id,
        headers: {
          pf: "web", Accept: "application/json",
          Referer: "https://place.map.kakao.com/" + id,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        },
        muteHttpExceptions: true,
      };
    });
    try {
      var rs = UrlFetchApp.fetchAll(reqs);
      rs.forEach(function (r, i) {
        var v = { r: 0, c: 0 };
        try {
          if (r.getResponseCode() === 200) {
            var sc = (JSON.parse(r.getContentText()).kakaomap_review || {}).score_set || {};
            v = { r: sc.average_score || 0, c: sc.review_count || 0 };
          }
        } catch (e2) {}
        out[need[i]] = v;
        cache.put("m2" + need[i], JSON.stringify(v), 21600);
      });
    } catch (err) { /* 실패한 것은 생략 — 앱은 평점 없이 거리순 유지 */ }
  }
  return json_(out);
}

/* 통계 요약 — 관리자 화면용 */
function summary_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return json_({ days: [], courses: [], features: [], devices: [], ages: [], genders: [], total: 0 });
  var from = Math.max(2, last - 20000);              // 최근 2만 건
  var v = sh.getRange(from, 1, last - from + 1, 8).getValues();
  var days = {}, courses = {}, feats = {}, devs = {}, ages = {}, gens = {}, uniq = {};
  v.forEach(function (r) {
    var d = Utilities.formatDate(new Date(r[0]), "Asia/Seoul", "MM-dd");
    var cid = r[1], ev = r[2], name = r[3];
    if (ev === "visit") { days[d] = (days[d] || 0) + 1; uniq[d + "|" + cid] = 1; }
    if (ev === "course" && name) courses[name] = (courses[name] || 0) + 1;
    if (ev === "feature" && name) feats[name] = (feats[name] || 0) + 1;
    if (r[5]) devs[r[5]] = (devs[r[5]] || 0) + 1;
    if (r[6]) ages[r[6]] = (ages[r[6]] || 0) + 1;
    if (r[7] && r[7] !== "선택 안 함") gens[r[7]] = (gens[r[7]] || 0) + 1;
  });
  var uniqDays = {};
  Object.keys(uniq).forEach(function (k) { var d = k.split("|")[0]; uniqDays[d] = (uniqDays[d] || 0) + 1; });
  var top = function (o, n) {
    return Object.keys(o).map(function (k) { return [k, o[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; }).slice(0, n);
  };
  return json_({
    total: last - 1,
    days: Object.keys(days).sort().slice(-30).map(function (d) {
      return { d: d, hits: days[d], users: uniqDays[d] || 0 };
    }),
    courses: top(courses, 20), features: top(feats, 10),
    devices: top(devs, 5), ages: top(ages, 8), genders: top(gens, 3),
  });
}
