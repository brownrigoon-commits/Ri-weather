/* ============================================================
 * Ri-Weather(골프라이프) 백엔드 — Google Apps Script
 *
 * 기능 1) 이용 통계 수집·조회  (관리자 모드)
 * 기능 2) 카카오 플레이스 사진 프록시 (맛집 — '그 가게' 사진만 정확히)
 *
 * 설치법은 docs/백엔드_설치안내.md 참고 (약 5분)
 * ⚠️ 위치 좌표(위도·경도)는 어떤 경우에도 다루지 않는다.
 * ============================================================ */

/* ⚠️ 이 값을 바꾸면 반드시 Apps Script 를 재배포할 것.
   (배포 관리 → 기존 배포 수정 → 새 버전. 저장만으로는 서버에 반영되지 않는다)
   tools/verify_deploy.py 가 이 값을 서버에서 읽어와 로컬과 대조한다.
   두 번이나 "코드는 고쳤는데 배포를 안 해서" 기능이 죽어 있었다:
     · 기록 백업·복구 (2026-07-27)  · 숙소 객실사진 우선 (2026-07-28) */
var BACKEND_VER = "2026-07-30b";

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

/* ---------- 기록 백업 (즐겨찾기·스코어 지키기) ----------
 * 앱을 지웠다 다시 깔거나 폰을 바꿔도 '복구 코드'만 있으면 기록이 돌아온다.
 * 코드는 앱이 만든 임의 12자리 숫자 — 이름·연락처 등 개인 식별 정보는 없다. */
function backupSheet_() {
  var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("backup");
  if (!sh) {
    sh = ss.insertSheet("backup");
    sh.appendRow(["코드", "갱신시각", "크기", "데이터"]);
  }
  return sh;
}

function backupSave_(code, data) {
  code = String(code || "").replace(/[^0-9]/g, "");
  if (code.length < 10 || code.length > 16) return json_({ ok: false, err: "코드 형식" });
  var payload = JSON.stringify(data || {});
  if (payload.length < 2 || payload.length > 45000)      // 시트 셀 한도(5만자) 안전선
    return json_({ ok: false, err: "데이터 크기" });
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = backupSheet_();
    var codes = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues();
    for (var i = 1; i < codes.length; i++) {
      if (String(codes[i][0]) === code) {                // 기존 코드 → 덮어쓰기
        sh.getRange(i + 1, 2, 1, 3).setValues([[new Date(), payload.length, payload]]);
        return json_({ ok: true, updated: true });
      }
    }
    sh.appendRow([code, new Date(), payload.length, payload]);
    return json_({ ok: true, created: true });
  } finally {
    lock.releaseLock();
  }
}

function backupLoad_(code) {
  code = String(code || "").replace(/[^0-9]/g, "");
  if (!code) return json_({ ok: false });
  var sh = backupSheet_();
  var last = sh.getLastRow();
  if (last < 2) return json_({ ok: false, err: "없음" });
  var rows = sh.getRange(2, 1, last - 1, 4).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === code) {
      try { return json_({ ok: true, updated: rows[i][1], data: JSON.parse(rows[i][3]) }); }
      catch (e) { return json_({ ok: false, err: "손상" }); }
    }
  }
  return json_({ ok: false, err: "없음" });
}

/* ---------- 통계 수집 (앱 → 서버) ---------- */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    if (body.fn === "backup") return backupSave_(body.code, body.data);
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
  if (p.fn === "placephotos") return placePhotos_(p.id, p.kind);
  if (p.fn === "placemeta") return placeMeta_(p.ids);
  if (p.fn === "restore") return backupLoad_(p.code);
  if (p.fn === "summary") {
    if (p.pw !== ADMIN_PW) return json_({ err: "비밀번호가 틀립니다" });
    return summary_();
  }
  if (p.fn === "tts") return tts_(p.text, p.speaker, p.speed);
  return json_({ ok: true, service: "golflife-backend", ver: BACKEND_VER,
                 tts: ttsKeys_() ? "on" : "off" });
}

/* ---------- 캐디 음성 (구글 TTS 우선, 클로바는 예비) ----------
 *
 * 왜 백엔드를 거치는가: API 키를 앱에 넣으면 누구나 꺼내 쓸 수 있다.
 * 키는 여기 **스크립트 속성**에만 둔다 — 코드에 적지 않는다.
 *   Apps Script 편집기 → 프로젝트 설정(⚙) → 스크립트 속성 →
 *     GOOGLE_TTS_KEY = 구글 클라우드 API 키 (Cloud Text-to-Speech 전용으로 제한 권장)
 *     CLOVA_ID / CLOVA_SECRET = 네이버 키 (예비 — 구글 키가 없을 때만 사용)
 *   (아무 키도 없으면 tts:"off" 를 돌려주고, 앱은 기기 음성으로 그대로 동작한다)
 *
 * 왜 구글이 기본인가(2026-07-30 사장님 결정): 클로바 프리미엄은 호출 0건이어도
 * **월 기본료 9만원**이 붙는다(NCP 콘솔 팝업으로 확인). 구글은 기본료가 없고
 * Chirp3-HD 기준 월 100만 자까지 영구 무료 — 우리 사용량(라운드당 ~5,400자)이면 0원.
 *
 * ⚠️ 음성이 안 나오는 것보다 나쁜 건 없다. 어떤 실패에서도 에러를 감추지 말고
 *    이유를 돌려준다 — 앱이 그걸 보고 기기 음성으로 되돌아간다.
 */
function ttsKeys_() {
  var pr = PropertiesService.getScriptProperties();
  var g = pr.getProperty("GOOGLE_TTS_KEY");
  if (g) return { google: g };
  var id = pr.getProperty("CLOVA_ID"), sec = pr.getProperty("CLOVA_SECRET");
  return (id && sec) ? { id: id, sec: sec } : null;
}

function tts_(text, speaker, speed) {
  text = String(text || "").slice(0, 400);          // 한 번에 너무 긴 건 받지 않는다
  if (!text) return json_({ ok: false, why: "no-text" });
  var k = ttsKeys_();
  if (!k) return json_({ ok: false, why: "no-key" });

  speaker = speaker || "nara";                      // 여성 차분한 톤 (캐디 기본)
  speed = String(speed === undefined || speed === "" ? "0" : speed);

  /* 같은 문장은 다시 만들지 않는다 — 요금과 지연을 함께 줄인다.
     CacheService 는 한 항목 100KB 제한이라 큰 건 그냥 건너뛴다. */
  var cache = CacheService.getScriptCache();
  var key = "tts:" + (k.google ? "g" : "c") + ":" + speaker + ":" + speed + ":" +
            Utilities.base64Encode(Utilities.computeDigest(
              Utilities.DigestAlgorithm.MD5, text, Utilities.Charset.UTF_8));
  var hit = cache.get(key);
  if (hit) return json_({ ok: true, mp3: hit, cached: true });

  var out = k.google ? googleTts_(k.google, text, speed) : clovaTts_(k, text, speaker, speed);
  if (!out.ok) return json_(out);
  if (out.mp3.length < 95000) { try { cache.put(key, out.mp3, 21600); } catch (e) {} }   // 6시간
  return json_(out);
}

/* 구글 Cloud Text-to-Speech.
 * 화자: ko-KR-Chirp3-HD-Kore (여성, 차분·자연) — 최신 HD 계열이라 클로바급이다.
 * 앱이 보내는 speed 는 클로바 눈금(-5 빠름 ~ 5 느림, 0 보통)이므로 구글의
 * speakingRate(배속)로 환산한다: 0 → 1.0, 한 눈금당 5%.
 * ⚠️ Chirp3-HD 가 요청 항목을 거부하면(파라미터 미지원 등) Neural2 여성으로 한 번 더
 *    시도한다 — 미리보기 계열은 지원 항목이 바뀌곤 해서 한 발 물러날 곳을 둔다.
 */
function googleTts_(apiKey, text, speed) {
  var rate = 1 - (parseFloat(speed) || 0) * 0.05;
  rate = Math.max(0.5, Math.min(1.5, rate));
  var voices = ["ko-KR-Chirp3-HD-Kore", "ko-KR-Neural2-A"];
  var last = "";
  for (var i = 0; i < voices.length; i++) {
    try {
      var res = UrlFetchApp.fetch(
        "https://texttospeech.googleapis.com/v1/text:synthesize?key=" + encodeURIComponent(apiKey), {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          input: { text: text },
          voice: { languageCode: "ko-KR", name: voices[i] },
          audioConfig: { audioEncoding: "MP3", speakingRate: rate },
        }),
        muteHttpExceptions: true,
      });
      var code = res.getResponseCode();
      if (code === 200) {
        var mp3 = (JSON.parse(res.getContentText()) || {}).audioContent;
        if (mp3) return { ok: true, mp3: mp3, voice: voices[i] };
        last = "google-200-but-empty";
      } else {
        last = "google-" + code + " " + String(res.getContentText()).slice(0, 150);
        if (code === 401 || code === 403) break;   // 키 문제는 화자를 바꿔도 소용없다
      }
    } catch (err) {
      last = "fetch-fail " + String(err).slice(0, 150);
    }
  }
  return { ok: false, why: "google-tts", msg: last };
}

/* 네이버 클로바 보이스 (예비 — GOOGLE_TTS_KEY 가 없을 때만) */
function clovaTts_(k, text, speaker, speed) {
  try {
    var res = UrlFetchApp.fetch("https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts", {
      method: "post",
      headers: { "X-NCP-APIGW-API-KEY-ID": k.id, "X-NCP-APIGW-API-KEY": k.sec },
      payload: { speaker: speaker, text: text, format: "mp3", speed: speed, volume: "0", pitch: "0" },
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    if (code !== 200) {
      return { ok: false, why: "clova-" + code,
               msg: String(res.getContentText()).slice(0, 200) };
    }
    return { ok: true, mp3: Utilities.base64Encode(res.getContent()) };
  } catch (err) {
    return { ok: false, why: "fetch-fail", msg: String(err).slice(0, 200) };
  }
}

/* 카카오 플레이스 사진 — 카카오맵 '사진 탭'(가게 ID 기반 공식 사진첩) 그대로.
   카카오맵 앱에서 보이는 바로 그 사진들이라 다른 가게 사진이 섞일 수 없다. */
function kakaoHeaders_(id) {
  return {
    pf: "web",
    Accept: "application/json",
    Referer: "https://place.map.kakao.com/" + id,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  };
}

function placePhotos_(id, kind) {
  id = String(id || "").replace(/\D/g, "");
  if (!id) return json_({ photos: [] });
  var stay = String(kind || "") === "stay";
  var cache = CacheService.getScriptCache();
  var ck = (stay ? "s5" : "p5") + id;
  var hit = cache.get(ck);
  if (hit) return json_(JSON.parse(hit));
  var out = { photos: [], rating: 0, reviews: 0, vendor: null };
  var dbg = { code: 0 };
  try {
    // 카카오맵 '사진 탭'을 분류별로 병렬 조회.
    // 맛집: 음식 → 메뉴판 → 실내 → 실외 → 기타
    // 숙박: 예약사진(VENDOR) → 업주등록(MYSTORE) → 실내 → 이용후기 → 실외 → 기타
    //   카카오에 '객실' 태그는 없다. 실물 확인 결과(2026-07-28):
    //     VENDOR  = '카카오 예약하기 제공' 공식 객실컷 → 방 컨디션이 바로 보인다
    //     MYSTORE = 업주 대표컷 → 건물 외관인 경우가 많다
    //     INDOOR  = 블로그 실내컷 → 객실·부엌·소품이 뒤섞임
    //   그래서 방이 보이는 순서로 VENDOR 를 맨 앞에 둔다.
    var base = "https://place-api.map.kakao.com/places/tab/photos/" + id;
    var tags = stay ? ["VENDOR", "MYSTORE", "INDOOR", "KAKAOMAP_REVIEW", "OUTDOOR", ""]
                    : ["FOOD", "MENU", "INDOOR", "OUTDOOR", ""];
    var reqs = tags.map(function (t) {
      return { url: base + "?page=1" + (t ? "&tag=" + t : ""),
               headers: kakaoHeaders_(id), muteHttpExceptions: true };
    });
    var rs = UrlFetchApp.fetchAll(reqs);
    var seen = {};
    rs.forEach(function (r, i) {
      if (r.getResponseCode() !== 200) return;
      dbg.code = 200;
      try {
        var body = JSON.parse(r.getContentText());
        // VENDOR = '카카오 예약하기 제공' 공식 객실사진. 이게 0 이면 온라인 예약 연동이
        // 없는 곳이라 예약앱에서도 대개 검색되지 않는다. 사장님이 야놀자에서 실패한
        // 몽마르뜨모텔·2S모텔·뷰티모텔 전부 vendor=0 이었다. (2026-07-28)
        if (stay && tags[i] === "VENDOR") out.vendor = (body.photos || []).length;
        (body.photos || []).forEach(function (p) {
          if (p && p.url && p.media_type !== "VOD" && !seen[p.url] && out.photos.length < 10) {
            seen[p.url] = 1;
            out.photos.push(p.url);
          }
        });
      } catch (e2) {}
    });
    // 사진 탭이 완전히 비면: 리뷰에 첨부된 사진으로 대체
    if (!out.photos.length) {
      var r2 = UrlFetchApp.fetch("https://place-api.map.kakao.com/places/panel3/" + id,
        { headers: kakaoHeaders_(id), muteHttpExceptions: true });
      if (r2.getResponseCode() === 200) {
        var m = r2.getContentText().match(/https?:[^"\\]*kakaomapPhoto\/review[^"\\]*/g) || [];
        m.forEach(function (u) {
          if (!seen[u] && out.photos.length < 10) { seen[u] = 1; out.photos.push(u); }
        });
      }
    }
  } catch (err) { dbg.err = String(err).slice(0, 80); }
  out.dbg = dbg;
  cache.put(ck, JSON.stringify(out), 21600);   // 6시간 캐시
  return json_(out);
}

/* 여러 가게의 평점·리뷰수 일괄 조회 — 맛집 '추천순' 정렬용 (가게 ID 기반 = 정확) */
function placeMeta_(ids) {
  ids = String(ids || "").split(",").map(function (x) { return x.replace(/\D/g, ""); })
    .filter(Boolean).slice(0, 60);
  var cache = CacheService.getScriptCache();
  var out = {}, need = [];
  ids.forEach(function (id) {
    var hit = cache.get("m3" + id);
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
            var d = JSON.parse(r.getContentText());
            var sc = (d.kakaomap_review || {}).score_set || {};
            v = { r: sc.average_score || 0, c: sc.review_count || 0 };
            // 숙박: '카카오 예약하기'에 올라온 객실 목록.
            //   같은 요청에 이미 들어 있어 추가 호출 없이 얻는다.
            //   ⚠️ 이건 '판매중인 객실 카탈로그'이지 특정 날짜의 빈방이 아니다.
            //      날짜를 넣어도 응답이 바뀌지 않는 것을 확인했다(2026-07-28).
            var ar = d.available_rooms || {};
            var rooms = [], bk = "";
            (ar.stores || []).forEach(function (st) {
              if (!bk && st.landing_link) bk = st.landing_link;
              (st.rooms || []).forEach(function (rm) {
                if (rooms.length >= 8) return;
                var rp = rm.rate_plan || {}, oc = rm.occupancy || {};
                rooms.push({
                  n: String(rm.name || "").slice(0, 24),          // 더블룸 / 트윈룸 …
                  s: oc.standard || 0,                            // 기준 인원
                  m: oc.maximum || oc.standard || 0,              // 최대 인원
                  p: rp.sales_price || 0,                         // 실판매가
                  o: rp.product_sale_status === "ON_SALE" ? 1 : 0 // 판매중인가
                });
              });
            });
            if (rooms.length) { v.rooms = rooms; v.bk = bk; }
          }
        } catch (e2) {}
        out[need[i]] = v;
        cache.put("m3" + need[i], JSON.stringify(v), 10800);   // 3시간 (요금이 바뀔 수 있다)
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
