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

/* ---------- 공통 ---------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
  var hit = cache.get("ph" + id);
  if (hit) return json_(JSON.parse(hit));
  var out = { photos: [] };
  try {
    var r = UrlFetchApp.fetch("https://place-api.map.kakao.com/places/panel3/" + id, {
      headers: { pf: "web", Accept: "application/json" },
      muteHttpExceptions: true,
    });
    if (r.getResponseCode() === 200) {
      var txt = r.getContentText();
      // JSON 전체에서 사진 URL만 수집 (리뷰 사진·대표 사진)
      var m = txt.match(/https?:\\?\/\\?\/[^"]*(?:kakaomapPhoto|postfiles\.pstatic|mblogthumb)[^"]*/g) || [];
      var seen = {};
      m.forEach(function (u) {
        u = u.replace(/\\\//g, "/").replace(/\\u0026/g, "&");
        if (!seen[u]) { seen[u] = 1; out.photos.push(u); }
      });
      out.photos = out.photos.slice(0, 10);
    }
  } catch (err) { /* 실패 시 빈 목록 — 앱은 카카오맵 버튼으로 대체 표시 */ }
  cache.put("ph" + id, JSON.stringify(out), 21600);   // 6시간 캐시
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
