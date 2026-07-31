/* ============================================================
 * 투어리스트(구 골프라이프·Ri-Weather) 백엔드 — Google Apps Script
 * ※ service:"golflife-backend" 는 내부 식별자라 바꾸지 않는다(verify_backend 가 대조)
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
var BACKEND_VER = "2026-07-31d";   // b: 메일 제목 개명 / c: 비밀번호 변경(fn=setpw) / d: 개발기기 제외·지역군

/* 관리자 비밀번호 — 스크립트 속성 ADMIN_PW 가 정본이다.
   (코드에 적으면 저장소를 공개로 돌리는 순간 그대로 노출된다)
   속성이 없으면 아래 기본값을 쓰므로 지금 동작이 끊기지는 않는다.
   ⚠️ 이제 **관리자 화면에서 직접 바꿀 수 있다**(fn=setpw) — Apps Script 를 열 필요가 없다.
      사장님 요청 2026-07-31: "수시로 비번을 바꾸는 게 쉽지 않다". */
function adminPw_() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty("ADMIN_PW");
    if (v) return v;
  } catch (e) {}
  return ADMIN_PW;
}

/* 비밀번호 확인 — 틀린 횟수를 세어 무차별 대입을 막는다.
   실패 10회면 15분 잠금. 캐시라 서버가 재시작해도 오래 남지 않는다. */
var PW_FAIL_MAX = 10, PW_LOCK_SEC = 900;

function pwGate_(pw) {
  var cache = CacheService.getScriptCache();
  var n = parseInt(cache.get("pwfail") || "0", 10);
  if (n >= PW_FAIL_MAX) return { ok: false, err: "잠시 후 다시 시도해 주세요(로그인 시도 초과)" };
  if (String(pw || "") !== adminPw_()) {
    cache.put("pwfail", String(n + 1), PW_LOCK_SEC);
    return { ok: false, err: "비밀번호가 틀립니다" };
  }
  cache.remove("pwfail");
  return { ok: true };
}

/* 관리자 비밀번호 변경 — 지금 비밀번호를 맞혀야만 바꿀 수 있다.
   바꾸면 다른 기기에 저장된 로그인은 자동으로 풀린다(그 비밀번호로는 더 이상 조회가 안 되므로). */
function setPw_(oldPw, newPw) {
  var g = pwGate_(oldPw);
  if (!g.ok) return json_(g);
  newPw = String(newPw || "");
  if (newPw.length < 8) return json_({ ok: false, err: "새 비밀번호는 8자 이상이어야 합니다" });
  if (newPw.length > 64) return json_({ ok: false, err: "너무 깁니다(64자 이내)" });
  if (/\s/.test(newPw)) return json_({ ok: false, err: "공백은 쓸 수 없습니다" });
  if (newPw === adminPw_()) return json_({ ok: false, err: "지금 쓰는 것과 같습니다" });
  try {
    PropertiesService.getScriptProperties().setProperty("ADMIN_PW", newPw);
  } catch (e) {
    return json_({ ok: false, err: "저장하지 못했습니다 — " + String(e).slice(0, 80) });
  }
  /* 바뀐 사실만 알린다 — 비밀번호 자체는 메일에 절대 싣지 않는다.
     남이 몰래 바꿨을 때 사장님이 알아차릴 수 있어야 하므로 알림은 보낸다. */
  try {
    MailApp.sendEmail({
      to: ADMIN_MAIL,
      subject: "[투어리스트] 관리자 비밀번호가 변경되었습니다",
      body: "관리자 화면에서 비밀번호가 변경되었습니다.\n" +
            "시각: " + Utilities.formatDate(new Date(), "Asia/Seoul", "M월 d일 HH:mm") +
            "\n\n본인이 바꾼 것이 아니라면 즉시 다시 변경하세요." +
            "\n(이 메일에는 비밀번호를 적지 않습니다)",
    });
  } catch (e) { /* 메일 실패는 삼킨다 — 변경은 이미 끝났다 */ }
  return json_({ ok: true });
}

var ADMIN_PW = "golf2026!";   // 관리자 통계 조회 비밀번호 — 설치 때 꼭 바꾸세요
var ADMIN_MAIL = "brown.rigoon@gmail.com";   // 베타 피드백 알림 받는 주소
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
    sh.appendRow(["시각", "cid", "이벤트", "이름", "버전", "기기", "연령대", "성별", "지역"]);
    return sh;
  }
  // 이미 있는 시트에 '지역'(9번째) 칸을 한 번만 붙인다.
  // ⚠️ 여기 들어가는 건 시/도 이름("경기")뿐이다. 좌표는 앱에서도 서버에서도 다루지 않는다.
  if (!sh.getRange(1, 9).getValue()) sh.getRange(1, 9).setValue("지역");
  return sh;
}

/* ---------- 개발·테스트 기록 제외 (2026-07-31 사장님 지시) ----------
 *
 * "우리가 테스트로 들어가서 본 내용은 통계에서 빼 달라 — 헷갈린다."
 *
 * ⚠️ **기록을 지우지 않는다.** 집계에서만 뺀다.
 *    지워 버리면 잘못 뺀 걸 알아차렸을 때 되돌릴 방법이 없다.
 *    스크립트 속성 DEV_CIDS(기기ID 목록)에 넣고 빼는 것이 전부이고,
 *    관리자 화면에서 버튼으로 켜고 끌 수 있으니 콘솔을 열 일은 없다.
 *
 * 앞으로 쌓이는 것은 앱이 막는다(js/stats.js — localhost, `?dev=1`).
 * 여기서 빼는 것은 그 장치가 없던 때(v170 이전)에 이미 쌓인 기록이다.
 */
var DEV_PROP = "DEV_CIDS";

function devCids_() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty(DEV_PROP);
    var a = v ? JSON.parse(v) : [];
    return Object.prototype.toString.call(a) === "[object Array]" ? a : [];
  } catch (e) { return []; }
}

function devMark_(cid, on) {
  cid = String(cid || "").slice(0, 20);
  if (!cid) return json_({ ok: false, err: "기기ID가 없습니다" });
  var list = devCids_(), i = list.indexOf(cid);
  if (on && i < 0) list.push(cid);
  if (!on && i >= 0) list.splice(i, 1);
  PropertiesService.getScriptProperties().setProperty(DEV_PROP, JSON.stringify(list.slice(0, 200)));
  return json_({ ok: true, n: list.length });
}

/* 손대지 않아도 늘 빼는 것 — 우리 검사 스크립트가 남긴 기록.
   (fb 시트의 `verify-pc` 2건이 여기 걸린다) */
function autoDev_(cid) { return /^(verify|test|dev)[-_]/i.test(String(cid || "")); }

/* 검사하려고 지어낸 가짜 골프장. 실제 등록 구장 231곳에 '테스트'가 든 이름은 없다
   — 인기 골프장 3위에 '테스트CC 35건'이 올라와 있었다. */
function isTestName_(name) { return /테스트/.test(String(name || "")); }

/* 이 기록을 집계에서 뺄 것인가 */
function skipCid_(cid, devMap) { return !!(devMap[cid] || autoDev_(cid)); }

/* ---------- 베타 피드백 ---------- */
var FB_CATS = { "오류": 1, "불편": 1, "아이디어": 1, "칭찬": 1 };
var FB_PER_USER_DAY = 5;    // 한 기기가 하루에 보낼 수 있는 건수 (도배 방지)
var FB_MAIL_PER_DAY = 30;   // 알림 메일 상한 (구글 개인계정 하루 100통 — 여유를 둔다)

function fbSheet_() {
  var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("fb");
  if (!sh) {
    sh = ss.insertSheet("fb");
    sh.appendRow(["시각", "cid", "분류", "별점", "내용", "화면", "버전", "기기"]);
    sh.setColumnWidth(5, 460);
  }
  return sh;
}

/* 최근 h시간 동안의 건수 — 전체(메일 상한용)와 이 기기 것(도배 방지용).
   CacheService 는 최대 6시간이라 '하루' 를 셀 수 없어서 시트를 직접 센다. */
function fbCount_(sh, cid, h) {
  var last = sh.getLastRow();
  if (last < 2) return { mine: 0, all: 0 };
  var from = Math.max(2, last - 500);
  var v = sh.getRange(from, 1, last - from + 1, 2).getValues();
  var cut = Date.now() - h * 3600000;
  var mine = 0, all = 0;
  for (var i = 0; i < v.length; i++) {
    var t = new Date(v[i][0]).getTime();
    if (!(t >= cut)) continue;
    all++;
    if (String(v[i][1]) === cid) mine++;
  }
  return { mine: mine, all: all };
}

function fbSave_(b) {
  var cat = String(b.cat || "");
  if (!FB_CATS[cat]) return json_({ ok: false, err: "분류를 선택해 주세요" });

  // 사용자가 직접 쓴 글이라 HTML 태그만 걷어낸다(관리자 화면에서 그대로 보여주므로).
  var text = String(b.text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 5) return json_({ ok: false, err: "내용을 조금만 더 적어 주세요" });
  text = text.slice(0, 500);

  var cid = String(b.cid || "").slice(0, 20);
  var stars = Math.max(0, Math.min(5, parseInt(b.stars, 10) || 0));
  var screen = String(b.screen || "").slice(0, 20);
  var ver = String(b.ver || "").slice(0, 10);
  var dev = String(b.dev || "").slice(0, 10);
  // 화면 이름 같은 기계값에는 좌표성 항목이 들어올 자리가 없다 — 그래도 한 번 막는다
  if (/lat|lon|coord|위도|경도/i.test(screen + " " + ver + " " + dev))
    return json_({ ok: false, err: "형식" });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var cnt;
  try {
    var sh = fbSheet_();
    cnt = fbCount_(sh, cid, 24);
    if (cid && cnt.mine >= FB_PER_USER_DAY)
      return json_({ ok: false, err: "limit" });   // 앱이 '내일 다시' 안내
    sh.appendRow([new Date(), cid, cat, stars || "", text, screen, ver, dev]);
  } finally {
    lock.releaseLock();
  }

  /* 알림 메일 — 저장이 본체, 메일은 부가 기능이다.
     메일이 실패해도 피드백은 이미 시트에 있으므로 성공으로 답한다. */
  var mailed = false;
  try {
    var quotaOk = true;
    try { quotaOk = MailApp.getRemainingDailyQuota() > 5; } catch (e) {}
    if (quotaOk && cnt.all < FB_MAIL_PER_DAY) {
      MailApp.sendEmail({
        to: ADMIN_MAIL,
        subject: "[투어리스트 베타] " + cat + (stars ? " ★" + stars : "") + " — " + text.slice(0, 30),
        body: text +
          "\n\n────────────────────────" +
          "\n분류: " + cat + (stars ? "   별점: " + stars + "/5" : "") +
          "\n화면: " + (screen || "-") + "   앱: " + (ver || "-") + "   기기: " + (dev || "-") +
          "\n기기ID: " + (cid || "-") + " (개인 식별 불가)" +
          "\n시각: " + Utilities.formatDate(new Date(), "Asia/Seoul", "M월 d일 HH:mm") +
          "\n\n오늘 받은 피드백: " + (cnt.all + 1) + "건",
      });
      mailed = true;
    }
  } catch (e) { /* 메일 실패는 삼킨다 — 데이터는 이미 저장됐다 */ }

  return json_({ ok: true, mailed: mailed });
}

/* 관리자 화면용 피드백 목록 (최근 200건, 최신순) */
function fbList_() {
  var sh = fbSheet_();
  var last = sh.getLastRow();
  if (last < 2) return json_({ rows: [], total: 0 });
  var from = Math.max(2, last - 199);
  var v = sh.getRange(from, 1, last - from + 1, 8).getValues();
  // 우리 검사로 넣은 의견은 목록에서도 뺀다 (fb 시트의 `verify-pc` 2건)
  var devMap = {};
  devCids_().forEach(function (c) { devMap[c] = 1; });
  var rows = v.filter(function (r) {
    return !skipCid_(String(r[1] || ""), devMap);
  }).map(function (r) {
    return {
      t: new Date(r[0]).getTime(), cid: String(r[1] || ""), cat: String(r[2] || ""),
      stars: r[3] || 0, text: String(r[4] || ""), screen: String(r[5] || ""),
      ver: String(r[6] || ""), dev: String(r[7] || ""),
    };
  }).reverse();
  return json_({ rows: rows, total: rows.length });
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
    if (body.fn === "feedback") return fbSave_(body);
    // 비밀번호 변경은 POST 로만 받는다 — GET 이면 주소창·서버 로그에 새 비밀번호가 남는다
    if (body.fn === "setpw") return setPw_(body.pw, body.newPw);
    // 개발·테스트 기기 표시 (관리자만)
    if (body.fn === "devcid") {
      var g = pwGate_(body.pw);
      if (!g.ok) return json_({ ok: false, err: g.err });
      return devMark_(body.cid, !!body.on);
    }
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
        String(r.reg || "").slice(0, 10),   // 시/도 이름만 (좌표 아님)
      ]);
    });
    if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, 9).setValues(out);
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
    var g1 = pwGate_(p.pw);
    if (!g1.ok) return json_({ err: g1.err });
    return summary_();
  }
  if (p.fn === "fblist") {
    var g2 = pwGate_(p.pw);
    if (!g2.ok) return json_({ err: g2.err });
    return fbList_();
  }
  if (p.fn === "cids") {
    var g3 = pwGate_(p.pw);
    if (!g3.ok) return json_({ err: g3.err });
    return cidList_();
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

/* 기기별 목록 — 관리자 화면에서 '이건 우리 테스트' 를 골라내라고 주는 자료.
 *
 * 기기ID(cid)만 보고는 누구인지 알 수 없다. 그래서 판단할 근거를 같이 준다:
 *   · 본 앱 버전 수 — 개발 기기의 가장 뚜렷한 자국이다.
 *     진짜 이용자는 배포된 버전을 한두 개 본다. v150~v175 를 다 본 기기는 우리다.
 *   · 접속 수 / 처음·마지막 / 기기 종류 / 대표로 본 골프장
 * 자동 판정은 하지 않는다 — 헤비 이용자를 개발자로 오해해 지워 버리면 되돌릴 수 없다.
 */
function cidList_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return json_({ ok: true, rows: [] });
  var from = Math.max(2, last - 20000);
  var v = sh.getRange(from, 1, last - from + 1, 9).getValues();
  var m = {};
  v.forEach(function (r) {
    var cid = String(r[1] || "");
    if (!cid) return;
    var o = m[cid];
    if (!o) o = m[cid] = { cid: cid, n: 0, visits: 0, first: 0, last: 0,
                           dev: "", vers: {}, course: "" };
    o.n++;
    if (r[2] === "visit") o.visits++;
    var t = new Date(r[0]).getTime();
    if (!o.first || t < o.first) o.first = t;
    if (t > o.last) o.last = t;
    if (r[5]) o.dev = String(r[5]);
    if (r[4]) o.vers[String(r[4])] = 1;
    if (r[2] === "course" && r[3] && !o.course) o.course = String(r[3]);
  });
  var devMap = {};
  devCids_().forEach(function (c) { devMap[c] = 1; });
  var rows = Object.keys(m).map(function (k) {
    var o = m[k];
    o.vers = Object.keys(o.vers).length;
    o.auto = autoDev_(k);            // 손댈 수 없는 자동 제외(검사 스크립트)
    o.off = !!devMap[k] || o.auto;   // 지금 빠져 있나
    return o;
  }).sort(function (a, b) { return b.n - a.n; }).slice(0, 150);
  return json_({ ok: true, rows: rows });
}

/* 통계 요약 — 관리자 화면용
 *
 * 집계 기준을 여기 적어 둔다(관리자 화면에도 같은 문구를 띄운다):
 *   · 방문(hits)   = visit 이벤트 수 — 같은 사람이 여러 번 열면 여러 번 센다
 *   · 사용자(users)= 그 날 방문한 서로 다른 기기 수
 *   · 연령·성별    = '맞춤 정보 제공'에 동의한 이용자만 → 전체와 수가 다른 게 정상
 *   · 지역         = 이용자가 조회한 골프장의 시/도. 이용자의 실제 위치가 아니다.
 */
function summary_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  var empty = { days: [], courses: [], features: [], devices: [], ages: [], genders: [],
                regions: [], total: 0, uniq: 0, back7: null, today: { hits: 0, users: 0 },
                fbTotal: 0, fbToday: 0, ver: BACKEND_VER };
  if (last < 2) return json_(empty);
  var from = Math.max(2, last - 20000);              // 최근 2만 건
  var v = sh.getRange(from, 1, last - from + 1, 9).getValues();
  var days = {}, courses = {}, feats = {}, devs = {}, ages = {}, gens = {}, regs = {};
  var uniq = {}, seen = {}, cidDays = {};
  var today = Utilities.formatDate(new Date(), "Asia/Seoul", "MM-dd");
  var cut7 = Date.now() - 7 * 86400000;
  /* 아주 오래된 기록 몇 줄에 글자가 깨진 값(�)이 남아 있다.
     세어 봐야 '50�' 같은 항목이 화면에 뜰 뿐이라 집계에서 뺀다.
     (2026-07-31 기준 2,556건 중 2건 — 새로 들어오는 기록에는 없다) */
  var okv = function (x) { return x && String(x).indexOf("�") < 0; };
  /* 개발·테스트 기기는 통째로 건너뛴다 — 방문·기기·연령까지 전부 (2026-07-31) */
  var devMap = {};
  devCids_().forEach(function (c) { devMap[c] = 1; });
  var exRows = 0, exCids = {}, exTest = 0;
  v.forEach(function (r) {
    var when = new Date(r[0]);
    var d = Utilities.formatDate(when, "Asia/Seoul", "MM-dd");
    var cid = r[1], ev = r[2], name = r[3];
    if (skipCid_(cid, devMap)) { exRows++; exCids[cid] = 1; return; }
    if (ev === "course" && isTestName_(name)) { exTest++; return; }
    if (ev === "visit") {
      days[d] = (days[d] || 0) + 1;
      uniq[d + "|" + cid] = 1;
      seen[cid] = 1;
      // 최근 7일 안에서 '서로 다른 날' 방문 수 — 재방문율 계산용
      if (when.getTime() >= cut7 && cid) {
        if (!cidDays[cid]) cidDays[cid] = {};
        cidDays[cid][d] = 1;
      }
    }
    if (ev === "course" && name) courses[name] = (courses[name] || 0) + 1;
    if (ev === "feature" && name) feats[name] = (feats[name] || 0) + 1;
    if (okv(r[5])) devs[r[5]] = (devs[r[5]] || 0) + 1;
    if (okv(r[6])) ages[r[6]] = (ages[r[6]] || 0) + 1;
    if (okv(r[7]) && r[7] !== "선택 안 함") gens[r[7]] = (gens[r[7]] || 0) + 1;
    if (okv(r[8])) regs[r[8]] = (regs[r[8]] || 0) + 1;
  });
  var uniqDays = {};
  Object.keys(uniq).forEach(function (k) { var d = k.split("|")[0]; uniqDays[d] = (uniqDays[d] || 0) + 1; });

  // 7일 재방문율 = 최근 7일에 방문한 기기 중 '이틀 이상' 방문한 비율.
  // 표본이 너무 작으면(5명 미만) 숫자가 요동쳐 오해를 부르니 아예 주지 않는다.
  var base = Object.keys(cidDays), rep = 0;
  base.forEach(function (c) { if (Object.keys(cidDays[c]).length >= 2) rep++; });
  var back7 = base.length >= 5 ? Math.round((rep / base.length) * 100) : null;

  var top = function (o, n) {
    return Object.keys(o).map(function (k) { return [k, o[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; }).slice(0, n);
  };

  // 피드백 건수 (오늘 / 전체)
  var fbTotal = 0, fbToday = 0;
  try {
    var fs = fbSheet_(), fl = fs.getLastRow();
    if (fl >= 2) {
      // 우리 검사로 넣은 의견은 빼고 센다 — 시각뿐 아니라 기기ID(2번째 칸)도 읽는다
      var ff = Math.max(2, fl - 300);
      fs.getRange(ff, 1, fl - ff + 1, 2).getValues().forEach(function (r) {
        if (skipCid_(String(r[1] || ""), devMap)) return;
        fbTotal++;
        if (Utilities.formatDate(new Date(r[0]), "Asia/Seoul", "MM-dd") === today) fbToday++;
      });
      // 300건 넘게 쌓이면 그 앞쪽은 세지 못하므로 더해 준다(제외 대상은 초기 2건뿐이라 무시 가능)
      if (fl - 1 > 300) fbTotal += (fl - 1 - 300);
    }
  } catch (e) {}

  return json_({
    ver: BACKEND_VER,
    total: last - 1,
    // 집계에서 뺀 것 — 화면에 그대로 적어 준다. 조용히 빼면 숫자가 줄어든 이유를 알 수 없다.
    excluded: { devices: Object.keys(exCids).length, rows: exRows, test: exTest },
    uniq: Object.keys(seen).length,
    back7: back7,
    today: { hits: days[today] || 0, users: uniqDays[today] || 0 },
    fbTotal: fbTotal, fbToday: fbToday,
    days: Object.keys(days).sort().slice(-30).map(function (d) {
      return { d: d, hits: days[d], users: uniqDays[d] || 0 };
    }),
    courses: top(courses, 20), features: top(feats, 14),
    devices: top(devs, 5), ages: top(ages, 8), genders: top(gens, 3),
    regions: top(regs, 12),
  });
}
