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
var BACKEND_VER = "2026-08-02f";   // a: 우리 기록 자동 제외 + 오늘/누적 / f: 차단막 1단계 — 사용량 상한 + 요청 서명

/* ============ 차단막 1단계 (2026-08-02 사장님 지시) ============
 * 이 주소는 앱 소스에 공개돼 있어서, 누구든 복사해 fn=tts 를 반복 호출하면
 * **우리 구글 요금이 나간다.** 두 겹으로 막는다.
 *
 * ① 사용량 상한 — 기능별로 6시간 창 안에서 몇 번까지만 받는다.
 *    (CacheService 의 최대 수명이 6시간이라 창이 6시간이다. 하루 최대 = 상한×4)
 *    카운터가 고장 나도 서비스는 계속된다 — 상한은 최후 방어선이지 관문이 아니다.
 * ② 요청 서명 — 앱이 오늘 날짜(UTC)로 만든 토큰(k)을 붙이고, 여기서 같은 식으로
 *    만들어 대조한다. 식이 앱 소스에 보이므로 작정한 공격자는 못 막는다(정직하게).
 *    막는 것은 "주소만 복사해 돌리는 스크립트"다. 시차·자정 걸침 때문에 어제·내일
 *    토큰도 받아준다.
 *    ⚠️ 옛 버전 앱(캐시)이 토큰 없이 부르는 동안은 통과시킨다 — GRACE 까지.
 */
var GUARD_GRACE_UNTIL = "2026-08-17";       // 이날부터 토큰 없는 요청 거절
var GUARD_QUOTA = {                         // 6시간 창 상한 (베타 100명 기준 넉넉히)
  tts: 2000, placemeta: 800, placephotos: 2000,
  restore: 300, backup: 600, feedback: 200, stats: 3000,
};

function tok_(dayStr) {                     // 앱(js/stats.js RIW_TOK)과 같은 식이어야 한다
  var s = dayStr + "|tourlist-guard-1";
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function tokOk_(k) {
  if (!k) return new Date() < new Date(GUARD_GRACE_UNTIL + "T00:00:00Z");   // 유예기간만 통과
  for (var d = -1; d <= 1; d++) {
    var t = new Date(Date.now() + d * 864e5);
    if (k === tok_(Utilities.formatDate(t, "UTC", "yyyyMMdd"))) return true;
  }
  return false;
}

function overQuota_(fn) {
  try {
    var c = CacheService.getScriptCache();
    var key = "q:" + fn;
    var n = parseInt(c.get(key) || "0", 10) + 1;
    c.put(key, String(n), 21600);           // 6시간 창
    return n > (GUARD_QUOTA[fn] || 1000);
  } catch (e) { return false; }             // 카운터 고장 ≠ 서비스 중단
}

/* 관문 하나로 묶는다 — 순서 중요: 상한 검사가 먼저다(토큰이 맞아도 폭주면 막는다) */
function guard_(fn, k) {
  if (overQuota_(fn)) return json_({ ok: false, why: "quota" });
  if (!tokOk_(k)) return json_({ ok: false, why: "denied" });
  return null;                              // 통과
}

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

/* ---------- 우리 기록 빼기 — 실제 이용자 것만 남긴다 (2026-08-02 사장님 지시) --------
 *
 * "내 폰이랑 개발 PC로 우리가 눌러 본 건 다 빼고, 써보라고 준 사람들 것만 보여 달라."
 *
 * 예전에는 기기를 하나씩 손으로 [안 셈] 눌러야 했다. 목록이 150대인데 그럴 수는 없다.
 * 그래서 **우리 자국이 분명한 것만** 자동으로 뺀다.
 *
 * ⚠️ 세 가지를 지킨다.
 *   1) 기록을 지우지 않는다 — 집계에서만 뺀다. 잘못 뺐으면 되돌릴 수 있어야 한다.
 *   2) 조용히 빼지 않는다 — 몇 대를 왜 뺐는지 화면에 그대로 적는다.
 *   3) 애매하면 빼지 않는다 — '확인 필요'로 두고 사장님이 정한다.
 *      진짜 이용자를 잘못 빼면 베타를 하는 의미가 없어진다. 잡음이 조금 남는 편이 낫다.
 *
 * ⛔ 여기 없는 규칙과 그 이유 (2026-08-02 설계 검토에서 코드 근거로 기각된 것들)
 *   · "본 앱 버전 수가 많으면 개발 기기" → **틀렸다.** 두 가지 이유로 그렇다.
 *       ① visit 기록의 버전 칸은 **항상 비어 있다**. index.html 이 stats.js 를 app.js 보다
 *          먼저 싣기 때문에 첫 hit("visit") 시점에는 APP_VER 이 아직 없다.
 *       ② js/app.js 의 서비스워커가 새 버전을 만나면 **스스로 location.reload()** 한다.
 *          즉 '본 버전 수'는 이용자의 성실함이 아니라 **우리가 배포한 횟수**의 함수다.
 *          하루 13번 배포한 주에는 열성 이용자일수록 숫자가 커진다 — 앱이 시킨 행동으로
 *          이용자를 벌주는 규칙이 된다.
 *   · "golfdb.js 에 없는 골프장을 봤으면 가짜" → **틀렸다.** 자유로CC 는 golfdb.js 에 없고
 *     js/app.js 의 EXTRA_CLUBS 에 있는 **진짜 구장**이다. 이용자는 검색으로 아무 이름이나 열 수도 있다.
 *   · "하루만 쓰고 사라진 기기는 테스트" → **자동 제외는 안 한다.** 한 번 열어보고 안 돌아온
 *     진짜 베타 이용자와 모양이 똑같다. 이걸 지우면 재방문율이 거짓으로 올라간다(자기기만).
 *     아래 B2 로 '확인 필요'에만 올린다.
 */
var DEV_PROP = "DEV_CIDS";      // 사람이 [안 셈] 을 누른 기기
var KEEP_PROP = "KEEP_CIDS";    // 사람이 [이건 진짜 사용자] 로 되돌린 기기
var B2OFF_PROP = "B2_ALL_OFF";  // "1" 이면 B2(하루살이 무더기)를 통째로 뺀다 — 스위치 하나
var LIST_MAX = 400;             // 스크립트 속성 한 칸이 9KB — 12자 기기ID 400개면 약 6KB
var ROW_WINDOW = 20000;         // 한 번에 읽는 최근 기록 수

/* 검사하려고 지어낸 가짜 골프장 — 앱으로는 도달할 수 없는 이름이다.
   저장소 전체에 grep 0건으로 확인했다(골프장 DB·홀맵·영상 어디에도 없다).
   ⚠️ '테스트' 부분일치로 넓히지 말 것 — 이용자는 검색으로 아무 이름이나 열 수 있다. */
var FAKE_COURSES = { "테스트CC": 1, "테스트미등록GC": 1, "가나CC(폭우)": 1, "테스트CC(폭우)": 1 };

/* 앱에 ?dev=1 · 헤드리스 표시 장치가 붙기 전 시절. 이 날짜까지의 하루살이 기기는
   '확인 필요'로 올린다(자동 제외는 안 한다). 앞으로 오는 이용자는 여기 걸리지 않는다. */
var NOISE_UNTIL = "2026-08-01";

function readList_(prop) {
  try {
    var v = PropertiesService.getScriptProperties().getProperty(prop);
    var a = v ? JSON.parse(v) : [];
    return Object.prototype.toString.call(a) === "[object Array]" ? a : [];
  } catch (e) { return []; }
}

function listMap_(prop) {
  var m = {};
  readList_(prop).forEach(function (c) { m[c] = 1; });
  return m;
}

/* 목록에 넣고 빼기. 한 기기는 DEV_CIDS·KEEP_CIDS 중 **한 곳에만** 있는다 —
   그래야 "마지막에 누른 것이 이긴다"가 되어 우선순위 다툼이 생기지 않는다.
   ⚠️ 예전 devMark_ 는 slice(0,200) 으로 넘치는 것을 조용히 잘라 놓고 ok:true 를 줬다.
      목록이 차면 뺐다고 믿은 기기가 계속 세어진다. 조용히 자르지 말고 분명히 거절한다. */
function listMark_(prop, cids, on) {
  var other = prop === DEV_PROP ? KEEP_PROP : DEV_PROP;
  var list = readList_(prop), oth = readList_(other), changed = 0;
  if (Object.prototype.toString.call(cids) !== "[object Array]") cids = [cids];
  for (var k = 0; k < cids.length; k++) {
    var c = String(cids[k] || "").slice(0, 24);
    if (!c) continue;
    var i = list.indexOf(c), j = oth.indexOf(c);
    if (on) {
      if (i < 0) { list.push(c); changed++; }
      if (j >= 0) oth.splice(j, 1);
    } else if (i >= 0) { list.splice(i, 1); changed++; }
  }
  if (!changed && !cids.length) return json_({ ok: false, err: "기기ID가 없습니다" });
  if (list.length > LIST_MAX)
    return json_({ ok: false, err: "목록이 가득 찼습니다(" + LIST_MAX + "대). 규칙으로 빼 주세요." });
  var pr = PropertiesService.getScriptProperties();
  pr.setProperty(prop, JSON.stringify(list));
  pr.setProperty(other, JSON.stringify(oth));
  return json_({ ok: true, n: list.length, changed: changed });
}

/* 손댈 수 없이 늘 빠지는 것 — 우리 검사 스크립트가 남긴 기록.
   ⚠️ 'dev' 접두사는 여기서 뺐다. ?dev=1 로 붙는 표시라 되돌릴 수 있어야 하기 때문이다(A1). */
function alwaysDev_(cid) { return /^(verify|test)[-_]/i.test(String(cid || "")); }

/* 행 하나에 든 골프장 이름이 가짜인가 (기기 판정이 아니라 그 줄만 빼는 용도) */
function isTestName_(name) { return /테스트/.test(String(name || "")); }

/* ---------- 한국 시각 ----------
   한국은 1988년 이후 서머타임이 없다 → UTC+9 고정. 2만 번의 formatDate 호출을
   정수 계산으로 바꾼다(45초 제한에 걸린 이력이 있어 이건 그냥 이득이다). */
var KST = 9 * 3600000, DAY_MS = 86400000;
function kday_(t) { return new Date(t + KST).toISOString().slice(0, 10); }   // "2026-08-02"
function khour_(t) { return Math.floor(((t + KST) % DAY_MS) / 3600000); }    // 0~23

/* ---------- 기기 한 대에 대한 판정 ----------
 *
 * 우선순위 — 위에서부터 처음 맞는 것으로 끝난다.
 *   1. verify-/test- 로 시작        → 늘 빠짐 (되돌릴 수 없음)
 *   2. KEEP_CIDS 에 있다            → 센다 (모든 자동 규칙을 이긴다)
 *   3. DEV_CIDS 에 있다             → 뺀다 (사람이 직접 누른 것)
 *   4. 자동 규칙에 걸렸고 보호신호가 없다 → 뺀다
 *   5. 자동 규칙에 걸렸지만 보호신호가 있다 → **세면서** '확인 필요'로 올린다
 *   6. 그 외                         → 센다
 */

/* 보호신호 — 하나라도 있으면 자동으로 빼지 않는다. 사람이 직접 보고 정할 일이다. */
function vetoOf_(o) {
  if (o.profile) return "연령·성별을 입력한 기기";   // 우리 검사 스크립트는 이 값을 채우지 않는다
  if (o.fb) return "직접 의견을 남긴 기기";
  if (o.dayCount >= 3) return "사흘 이상 다시 온 기기";
  return "";
}

/* 자동 규칙 — 우리 자국이 분명한 것만 */
function autoRuleOf_(o) {
  /* hard 가 붙은 규칙은 **사실**이라 보호신호(추측)가 뒤집지 못한다.
     A1 은 우리가 직접 붙인 표시이고, A2 의 가짜 구장은 앱으로 도달 자체가 불가능하다.
     되돌리기는 사람 몫([이건 진짜 사용자] = KEEP)으로만 열어 둔다. (2026-08-02 반박 검증) */
  // A1 — 앱이 스스로 붙인 표시. dev-wd- 는 자동화 브라우저(헤드리스), dev- 는 ?dev=1
  if (/^dev-wd-/.test(o.cid)) return { rule: "A1", hard: true, why: "자동화 브라우저로 보고된 기기(헤드리스)" };
  if (/^dev-/.test(o.cid)) return { rule: "A1", hard: true, why: "?dev=1 로 직접 표시한 기기" };

  // A2 — 앱으로는 갈 수 없는 이름을 봤다
  if (o.fake) return { rule: "A2", hard: true, why: "없는 골프장 '" + o.fake + "' 를 봄 — 앱으로는 갈 수 없는 이름" };

  /* A3 — 사람 손으로는 나올 수 없는 간격. 중복 전송을 걷어낸 뒤에 센다(scan_ 의 dedup 참고).
     ⚠️ 기준은 0.15초·같은 날이다. 처음에는 0.4초로 했다가 재검증에서 걸렸다(2026-08-02):
        빠른 손가락은 0.3초 간격 탭이 실제로 나온다. 우리 검사 도구는 0.03초로 누르므로
        0.15초면 기계만 걸린다. '같은 날' 조건이 없으면 짝이 평생 누적되어
        이틀만 부지런히 쓴 이용자도 언젠가 3짝을 채운다.
     ⚠️ 이 규칙은 **손가락 한 번에 기록이 한 건**이라는 전제 위에 서 있다.
        (2026-08-02 확인: js/app.js·booking.js·clubfit.js·spirit.js 의 STATS.hit 호출은
         전부 각각 다른 클릭 핸들러 안에 있고, 화면을 그릴 때 저절로 부르는 곳은 없다)
        앞으로 '화면을 열면 자동으로 기록되는' 계측을 추가하면 이 전제가 깨지고,
        진짜 이용자가 A3 에 걸리기 시작한다. 그런 계측을 넣을 때는 이 규칙을 같이 손볼 것.

     ⛔ 여기 있던 A4(클럽 피팅 4종을 10분 안에 시작)는 재검증에서 **폐기**했다:
        진짜 이용자가 피팅 화면을 구경만 해도(터치 8번·5.3초) 걸리는 것이 실측됐고,
        검사 도구가 남긴 그 무더기는 어차피 A3(0.03초 간격)와 B2(하루살이)가 잡는다. */
  if (o.fastPairs >= 3)
    return { rule: "A3", why: "0.15초 안에 연달아 누른 기록 " + o.fastPairs + "번(하루 안) — 사람 손으로는 나올 수 없음" };

  return null;
}

function verdictOf_(o, devMap, keepMap, b2off) {
  if (alwaysDev_(o.cid))
    return { skip: true, state: "always", rule: "X1", why: "검사 스크립트 — 늘 빠짐" };
  if (keepMap[o.cid])
    return { skip: false, state: "keep", rule: "", why: "진짜 사용자로 되돌려 둠" };
  if (devMap[o.cid])
    return { skip: true, state: "manual", rule: "manual", why: "직접 [안 셈] 으로 표시함" };

  var hit = autoRuleOf_(o);
  if (hit) {
    var veto = hit.hard ? "" : vetoOf_(o);   // 사실 규칙(A1·A2)은 추측이 뒤집지 못한다
    if (!veto) return { skip: true, state: "auto", rule: hit.rule, why: hit.why };
    return { skip: false, state: "candidate", rule: hit.rule, why: hit.why, veto: veto };
  }

  /* B2 — 장치가 붙기 전(8/1 이전)에 하루만 쓰고 사라진 기기.
     한 번 열어보고 안 온 진짜 이용자와 모양이 같으므로 **세면서** 확인만 요청한다.
     ⚠️ 단, 사람 흔적(연령·성별 입력, 직접 쓴 의견)이 있으면 확인 목록에도 올리지 않는다.
        우리 검사 도구는 그 값을 채우는 법이 없다 — 채워져 있으면 사람이다.
        이걸 빼먹으면 [전부 안 셈] 버튼이 그날 한 번 써 보고 떠난 진짜 이용자까지 쓸어간다
        (2026-08-02 재검증에서 모의 자료로 실제로 재현된 구멍). */
  if (o.dayCount === 1 && o.visits <= 3 && o.firstDay <= NOISE_UNTIL && !vetoOf_(o)) {
    var md = o.firstDay.slice(5).split("-");   // "07-28" → 7월 28일 (앞 0 을 뗀다)
    var whyB2 = Number(md[0]) + "월 " + Number(md[1]) + "일 하루만 쓰고 사라진 기기";
    /* [전부 안 셈] 은 기기ID 목록이 아니라 **스위치 하나**(B2_ALL_OFF)다.
       무더기가 몇백 대라 목록(상한 400)에 다 넣을 수 없고, 넣을 필요도 없다 —
       조건이 곧 명단이다. 되돌리기도 스위치 하나로 전부 돌아온다.
       개별 구제는 KEEP 이 이 분기보다 먼저라 [이건 진짜 사용자] 가 그대로 통한다. */
    if (b2off) return { skip: true, state: "auto", rule: "B2", why: whyB2 + " — [전부 안 셈] 처리됨" };
    return { skip: false, state: "candidate", rule: "B2", why: whyB2 };
  }

  return { skip: false, state: "on", rule: "", why: "" };
}

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
  /* 우리 검사로 넣은 의견은 목록에서도 뺀다 (fb 시트의 `verify-pc` 2건).
     ⚠️ 여기서는 통계처럼 무거운 판정(scan_)을 돌리지 않는다 — 의견 목록은 가볍게 떠야 한다.
        기기ID만으로 알 수 있는 것(검사용 접두사·직접 표시)만 본다. 되돌려 둔 기기는 남긴다. */
  var devMap = listMap_(DEV_PROP), keepMap = listMap_(KEEP_PROP);
  var hide = function (c) {
    if (alwaysDev_(c)) return true;
    if (keepMap[c]) return false;
    return !!devMap[c] || /^dev-/.test(c);
  };
  var rows = v.filter(function (r) {
    return !hide(String(r[1] || ""));
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
    if (body.fn === "backup") {
      var gb = guard_("backup", body.k); if (gb) return gb;
      return backupSave_(body.code, body.data);
    }
    if (body.fn === "feedback") {
      var gf = guard_("feedback", body.k); if (gf) return gf;
      return fbSave_(body);
    }
    // 비밀번호 변경은 POST 로만 받는다 — GET 이면 주소창·서버 로그에 새 비밀번호가 남는다
    if (body.fn === "setpw") return setPw_(body.pw, body.newPw);
    /* 기기 표시 (관리자만) — 한 대씩(cid)도, 여러 대 묶음(cids)도 받는다.
         devcid  = [안 셈]           → 집계에서 뺀다
         keepcid = [이건 진짜 사용자] → 자동 규칙을 무시하고 센다
       옛 화면은 {cid} 하나만 보내므로 그 형태도 그대로 받는다. */
    if (body.fn === "devcid" || body.fn === "keepcid") {
      var g = pwGate_(body.pw);
      if (!g.ok) return json_({ ok: false, err: g.err });
      var list = body.cids || [body.cid];
      return listMark_(body.fn === "devcid" ? DEV_PROP : KEEP_PROP, list, !!body.on);
    }
    /* B2 무더기 전체를 스위치 하나로 켜고 끈다 — 몇백 대라 목록으로는 못 담는다(상한 400) */
    if (body.fn === "b2all") {
      var g4 = pwGate_(body.pw);
      if (!g4.ok) return json_({ ok: false, err: g4.err });
      PropertiesService.getScriptProperties().setProperty(B2OFF_PROP, body.on ? "1" : "0");
      return json_({ ok: true, on: !!body.on });
    }
    var rows = body.rows || [];
    if (!rows.length || rows.length > 100) return json_({ ok: false });
    var gs = guard_("stats", body.k); if (gs) return gs;
    var sh = sheet_();
    var out = [];
    rows.forEach(function (r) {
      /* 좌표성 데이터는 서버에서도 한 번 더 차단.
         ⚠️ 행 전체를 JSON 으로 뭉쳐 검사하면 안 된다(2026-08-02 재검증에서 발견) —
            무작위 기기ID 약 3,900대 중 1대는 'lat' 같은 글자가 우연히 들어가고,
            그 이용자의 기록은 통째로, ok:true 를 돌려주면서 조용히 사라진다.
            좌표가 실제로 들어올 수 있는 칸만 본다. 골프장 이름은 숫자 좌표 모양만 막는다
            (영어 구장명에는 PLATEAU 처럼 'lat' 이 든 진짜 이름이 있다). */
      if (/lat|lon|coord|위도|경도/i.test(Object.keys(r).join(" "))) return;   // 좌표 '칸'이 있는 줄
      if (/lat|lon|coord|위도|경도/i.test([r.ev, r.reg, r.age, r.gen].join(" "))) return;
      if (/\d{2,}\.\d{3,}/.test(String(r.name || ""))) return;
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
  // 돈이 나가는 대리호출·개인 백업 조회는 관문을 먼저 지난다 (차단막 1단계)
  if (p.fn === "placephotos") {
    var g4 = guard_("placephotos", p.k); if (g4) return g4;
    return placePhotos_(p.id, p.kind);
  }
  if (p.fn === "placemeta") {
    var g5 = guard_("placemeta", p.k); if (g5) return g5;
    return placeMeta_(p.ids);
  }
  if (p.fn === "restore") {
    var g6 = guard_("restore", p.k); if (g6) return g6;
    return backupLoad_(p.code);
  }
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
  if (p.fn === "tts") {
    var g7 = guard_("tts", p.k); if (g7) return g7;
    return tts_(p.text, p.speaker, p.speed);
  }
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
/* ---------- 시트 한 번 읽어 기기별로 정리하기 ----------
 *
 * 통계(summary_)와 기기 목록(cidList_)이 **같은 판정**을 써야 한다.
 * 두 곳에 규칙을 따로 적으면 "화면에는 뺐다고 나오는데 숫자는 그대로"가 된다.
 * 그래서 읽기·판정을 여기 한 곳에 모은다.
 */

/* ⛔ 여기 있던 clubfitSweep_(피팅 4종 10분 규칙, A4)는 2026-08-02 재검증에서 지웠다.
   진짜 이용자가 피팅 화면을 구경만 해도(클럽 탭 4번 = 터치 8번·5.3초) 걸리는 것이
   실제 브라우저 실측으로 확인됐다. 검사 도구의 그 무더기는 A3·B2 가 어차피 잡는다.
   피팅을 빨리 훑는 것은 **정상 사용**이다 — 그걸 벌주는 규칙을 되살리지 말 것. */

/* 오래된 기록 몇 줄에 글자가 깨진 값(�)이 남아 있다. 세어 봐야 '50�' 가 화면에 뜰 뿐이다. */
function okv_(x) { return x && String(x).indexOf("�") < 0; }

function scan_() {
  var sh = sheet_(), last = sh.getLastRow();
  var out = { cids: {}, rows: [], total: Math.max(0, last - 1), dupes: 0,
              windowFull: true, lastAt: 0 };
  if (last < 2) return out;
  var from = Math.max(2, last - ROW_WINDOW);
  out.windowFull = (from <= 2);
  var v = sh.getRange(from, 1, last - from + 1, 9).getValues();

  // 의견을 남긴 기기 — 사람이 직접 글을 쓴 증거라 보호신호로 쓴다
  var fbCids = {};
  try {
    var fs = fbSheet_(), fl = fs.getLastRow();
    if (fl >= 2) {
      var ff = Math.max(2, fl - 300);
      fs.getRange(ff, 2, fl - ff + 1, 1).getValues().forEach(function (r) {
        var c = String(r[0] || ""); if (c) fbCids[c] = 1;
      });
    }
  } catch (e) {}

  /* ⚠️ 중복 전송을 먼저 걷어낸다. 이걸 안 하면 아래 A3(0.4초 규칙)가 진짜 이용자를 잡는다.
     js/stats.js 는 4초마다 모아 보내는데, 그 fetch 가 날아가는 중에 화면이 꺼지면
     sendBeacon 이 **아직 안 비워진 같은 큐**를 한 번 더 보낸다. 기록 시각(t)은 누른 순간에
     찍히므로 두 행의 시각이 밀리초까지 똑같아진다 = 간격 0ms. 통신이 나쁜 폰일수록 자주 난다. */
  var seen = {}, verByDay = {};
  for (var i = 0; i < v.length; i++) {
    var r = v[i];
    var t = new Date(r[0]).getTime();
    if (!t) continue;
    var cid = String(r[1] || ""); if (!cid) continue;
    var ev = String(r[2] || ""), name = String(r[3] || ""), ver = String(r[4] || "");
    var key = cid + "|" + t + "|" + ev + "|" + name;
    if (seen[key]) { out.dupes++; continue; }
    seen[key] = 1;

    var d = kday_(t);
    if (t > out.lastAt) out.lastAt = t;
    if (ver) { if (!verByDay[d]) verByDay[d] = {}; verByDay[d][ver] = 1; }

    var o = out.cids[cid];
    if (!o) {
      o = out.cids[cid] = { cid: cid, n: 0, visits: 0, first: t, last: t, dev: "",
                            course: "", fake: "", profile: false, fb: !!fbCids[cid],
                            _days: {}, _vers: {}, _acts: [] };
    }
    o.n++;
    if (ev === "visit") o.visits++;
    else o._acts.push({ t: t, k: ev + "|" + name });   // A3 은 visit 을 빼고 본다(새 버전 자동 새로고침 때문)
    if (t < o.first) o.first = t;
    if (t > o.last) o.last = t;
    o._days[d] = 1;
    if (r[5]) o.dev = String(r[5]);
    if (ver) o._vers[ver] = 1;
    if (okv_(r[6]) || (okv_(r[7]) && r[7] !== "선택 안 함")) o.profile = true;
    if (ev === "course" && name) {
      if (!o.course) o.course = name;
      if (!o.fake && FAKE_COURSES[name]) o.fake = name;   // ⚠️ 대표구장이 아니라 **전부** 훑어야 한다
    }
    out.rows.push([t, d, cid, ev, name, r[5], r[6], r[7], r[8]]);
  }

  var devMap = listMap_(DEV_PROP), keepMap = listMap_(KEEP_PROP);
  var b2off = false;
  try { b2off = PropertiesService.getScriptProperties().getProperty(B2OFF_PROP) === "1"; } catch (e) {}
  var vdays = Object.keys(verByDay).sort();
  Object.keys(out.cids).forEach(function (k) {
    var o = out.cids[k];
    var ds = Object.keys(o._days).sort();
    o.dayCount = ds.length;
    o.firstDay = ds[0];
    o.lastDay = ds[ds.length - 1];
    o.vers = Object.keys(o._vers).length;

    /* A3 재료 — 같은 날 안에서만 짝을 센다. 하루 기록이 5건은 되어야 '연달아'를 말할 수
       있고(두세 건의 우연은 근거가 못 된다), 날을 넘겨 누적하면 오래 쓴 이용자가 억울해진다.
       ⚠️ **같은 버튼**의 연타는 짝으로 세지 않는다 — 화면이 제자리에서 다시 그려지는 탭을
          답답해서 한 번 더 누르면 0.12초짜리 같은 이름 두 줄이 진짜로 나온다(실측).
          검사 도구는 서로 **다른** 버튼을 0.03초 간격으로 훑으므로 이 조건에 안 걸린다. */
    o._acts.sort(function (a, b) { return a.t - b.t; });
    o.fastPairs = 0;
    var dayActs = 1, dayFp = 0;
    for (var j = 1; j <= o._acts.length; j++) {
      var sameDay = j < o._acts.length && kday_(o._acts[j].t) === kday_(o._acts[j - 1].t);
      if (sameDay) {
        dayActs++;
        if (o._acts[j].t - o._acts[j - 1].t < 150 && o._acts[j].k !== o._acts[j - 1].k) dayFp++;
      }
      if (!sameDay) {                 // 날이 바뀌거나 끝 — 그날 치 결산
        if (dayActs >= 5 && dayFp > o.fastPairs) o.fastPairs = dayFp;
        dayActs = 1; dayFp = 0;
      }
    }
    /* '본 버전 N개'만으로는 아무것도 알 수 없다 — 그 사이 우리가 몇 개를 내보냈는지 같이 봐야 한다.
       (하루 13번 배포한 주에는 열성 이용자도 숫자가 커진다) */
    var seenV = {};
    for (var q2 = 0; q2 < vdays.length; q2++) {
      if (vdays[q2] < o.firstDay || vdays[q2] > o.lastDay) continue;
      Object.keys(verByDay[vdays[q2]]).forEach(function (x) { seenV[x] = 1; });
    }
    o.versOut = Object.keys(seenV).length;

    delete o._days; delete o._vers; delete o._acts;
    o.v = verdictOf_(o, devMap, keepMap, b2off);
  });
  return out;
}

/* ---------- 기기 목록 — '이건 우리 테스트' 를 골라내는 자리 ----------
 *
 * 이제 대부분은 서버가 알아서 판정한다. 사람이 할 일은
 *   · 자동 판정이 틀렸을 때 되돌리는 것([이건 진짜 사용자])
 *   · '확인 필요'로 올라온 것을 한 번에 빼는 것
 * 둘뿐이다.
 *
 * ⚠️ 예전에는 상위 150대만 내려보냈다. 기기가 419대인데 269대는 버튼이 **아예 없었다**.
 *    빠져 있거나 확인이 필요한 기기는 전부 보내고, 정상적으로 세는 기기만 상위 150대로 줄인다.
 */
function cidList_() {
  var sc = scan_();
  var keys = Object.keys(sc.cids);
  if (!keys.length) return json_({ ok: true, rows: [], totalCids: 0, shown: 0 });

  var pick = [], rest = [];
  keys.forEach(function (k) {
    var o = sc.cids[k];
    (o.v.state === "on" ? rest : pick).push(o);
  });
  var byN = function (a, b) { return b.n - a.n; };
  pick.sort(byN); rest.sort(byN);
  var rows = pick.slice(0, 500).concat(rest.slice(0, 150)).map(function (o) {
    return {
      cid: o.cid, n: o.n, visits: o.visits, first: o.first, last: o.last,
      dev: o.dev, vers: o.vers, versOut: o.versOut, course: o.course,
      days: o.dayCount,
      state: o.v.state,            // always | manual | auto | candidate | keep | on
      rule: o.v.rule || "",
      why: o.v.why || "",
      veto: o.v.veto || "",
      off: !!o.v.skip,             // 옛 화면 호환 — 지금 빠져 있나
      auto: o.v.state === "always", //   〃      손댈 수 없는 것인가
    };
  });
  return json_({ ok: true, rows: rows, totalCids: keys.length, shown: rows.length });
}

/* ---------- 통계 요약 — 관리자 화면용 ----------
 *
 * 집계 기준(관리자 화면에도 같은 문구를 띄운다):
 *   · 방문(hits)   = visit 기록 수 — 같은 사람이 여러 번 열면 여러 번 센다
 *   · 사람 수(users) = 그 날 방문한 서로 다른 기기 수
 *   · 연령·성별    = '맞춤 정보 제공'에 동의한 이용자만 → 전체와 수가 다른 게 정상
 *   · 지역         = 이용자가 조회한 골프장의 지역군. 이용자의 실제 위치가 아니다.
 *
 * 최상위 = 누적, today{} 안 = 오늘(한국 시각 00:00~24:00).
 * 최상위 키의 의미는 예전과 하나도 바꾸지 않았다 — 옛 화면도 그대로 돈다.
 */
function newAgg_() {
  return { hits: 0, users: {}, courses: {}, feats: {}, devs: {}, ages: {}, gens: {},
           regs: {}, courseSet: {} };
}

function feed_(a, r) {
  var ev = r[3], name = r[4];
  if (ev === "visit") { a.hits++; a.users[r[2]] = 1; }
  if (ev === "course" && name) { a.courses[name] = (a.courses[name] || 0) + 1; a.courseSet[name] = 1; }
  if (ev === "feature" && name) a.feats[name] = (a.feats[name] || 0) + 1;
  if (okv_(r[5])) a.devs[r[5]] = (a.devs[r[5]] || 0) + 1;
  if (okv_(r[6])) a.ages[r[6]] = (a.ages[r[6]] || 0) + 1;
  if (okv_(r[7]) && r[7] !== "선택 안 함") a.gens[r[7]] = (a.gens[r[7]] || 0) + 1;
  if (okv_(r[8])) a.regs[r[8]] = (a.regs[r[8]] || 0) + 1;
}

function top_(o, n) {
  return Object.keys(o).map(function (k) { return [k, o[k]]; })
    .sort(function (a, b) { return b[1] - a[1]; }).slice(0, n);
}

function summary_() {
  var sc = scan_();
  var nowMs = Date.now(), todayKey = kday_(nowMs);
  var all = newAgg_(), day = newAgg_();
  var days = {}, uniqDay = {}, seenCid = {}, cidDays = {}, firstDayOf = {};
  var hours = []; for (var h = 0; h < 24; h++) hours.push(0);
  var cut7 = nowMs - 7 * DAY_MS;
  var exRows = 0, exCids = {}, exTest = 0, byRule = {};
  var dExRows = 0, dExCids = {}, dExTest = 0;
  var counted = 0;

  sc.rows.forEach(function (r) {
    var t = r[0], d = r[1], cid = r[2], ev = r[3], name = r[4];
    var vd = sc.cids[cid].v;
    var isToday = (d === todayKey);
    if (vd.skip) {
      exRows++; exCids[cid] = 1;
      byRule[vd.rule] = (byRule[vd.rule] || 0) + 1;
      if (isToday) { dExRows++; dExCids[cid] = 1; }
      return;
    }
    /* 검사용 골프장 줄은 기기와 무관하게 뺀다 — 보호신호로 살아남은 기기의 기록이라도
       '가나CC(폭우)' 같은 이름이 인기 골프장 순위에 오르면 안 된다(2026-08-02 재검증에서 발견). */
    if (ev === "course" && (isTestName_(name) || FAKE_COURSES[name])) {
      exTest++; if (isToday) dExTest++; return;
    }
    counted++;

    feed_(all, r);
    if (ev === "visit") {
      days[d] = (days[d] || 0) + 1;
      uniqDay[d + "|" + cid] = 1;
      seenCid[cid] = 1;
      if (t >= cut7) { if (!cidDays[cid]) cidDays[cid] = {}; cidDays[cid][d] = 1; }
    }
    if (!firstDayOf[cid] || d < firstDayOf[cid]) firstDayOf[cid] = d;

    if (isToday) {
      feed_(day, r);
      if (ev === "visit") hours[khour_(t)]++;
    }
  });

  var uniqDays = {};
  Object.keys(uniqDay).forEach(function (k) {
    var d = k.split("|")[0]; uniqDays[d] = (uniqDays[d] || 0) + 1;
  });

  // 7일 재방문율 — 표본이 5명 미만이면 요동쳐 오해를 부르니 아예 주지 않는다
  var base = Object.keys(cidDays), rep = 0;
  base.forEach(function (c) { if (Object.keys(cidDays[c]).length >= 2) rep++; });
  var back7 = base.length >= 5 ? Math.round((rep / base.length) * 100) : null;

  // 오늘 처음 온 사람 — 창(최근 2만 건) 안에서만 알 수 있다. 창이 꽉 찼으면 숫자를 감춘다
  var newUsers = 0;
  Object.keys(day.users).forEach(function (c) { if (firstDayOf[c] === todayKey) newUsers++; });

  // '확인이 필요합니다' 묶음 — 세고 있지만 사장님이 한 번 봐 주셔야 하는 기기
  var cand = { n: 0, byRule: {}, cids: [] };
  Object.keys(sc.cids).forEach(function (k) {
    var vd = sc.cids[k].v;
    if (vd.state !== "candidate") return;
    cand.n++;
    cand.byRule[vd.rule] = (cand.byRule[vd.rule] || 0) + 1;
  });

  /* 피드백 건수 (오늘 / 전체) — 뺀 기기의 의견은 세지 않는다.
     ⚠️ 목록(fbList_)과 **같은 기준**이어야 한다. 기준이 다르면 카드는 2건인데 목록엔 1건이
        떠서 사장님이 "하나가 사라졌다"고 읽는다(2026-08-02 재검증에서 실제 재현).
        그래서 dev- 표시 기기도 목록과 똑같이 뺀다(되돌려 둔 기기는 양쪽 다 남긴다). */
  var fbTotal = 0, fbToday = 0;
  try {
    var devMapFb = listMap_(DEV_PROP), keepMapFb = listMap_(KEEP_PROP);
    var fs = fbSheet_(), fl = fs.getLastRow();
    if (fl >= 2) {
      var ff = Math.max(2, fl - 299);   // 최근 300줄 (fl-300 이면 301줄이라 보정분과 1건 겹친다)
      fs.getRange(ff, 1, fl - ff + 1, 2).getValues().forEach(function (r) {
        var c = String(r[1] || "");
        var o = sc.cids[c];
        if (alwaysDev_(c)) return;
        if (!keepMapFb[c] && (devMapFb[c] || /^dev-/.test(c))) return;
        if (o && o.v.skip) return;
        fbTotal++;
        var ft = new Date(r[0]).getTime();
        if (ft && kday_(ft) === todayKey) fbToday++;
      });
      // 300건이 넘으면 그 앞쪽은 세지 못하므로 더해 준다(제외 대상은 초기 몇 건뿐)
      if (fl - 1 > 300) fbTotal += (fl - 1 - 300);
    }
  } catch (e) {}

  return json_({
    ver: BACKEND_VER,
    scope: "day+all",            // ★ 이 키가 있으면 화면이 '오늘/누적 나누어 보기'를 켠다
    tz: "Asia/Seoul",
    asOf: nowMs,
    todayKey: todayKey,
    lastAt: sc.lastAt,

    // ── 누적 ──
    total: sc.total,             // 시트에 있는 원본 줄 수 (뺀 것 포함)
    counted: counted,            // 실제로 집계에 들어간 줄 수
    windowFull: sc.windowFull,   // false 면 '누적'은 최근 2만 건 기준이다
    uniq: Object.keys(seenCid).length,
    back7: back7,
    excluded: {
      devices: Object.keys(exCids).length, rows: exRows, test: exTest,
      dupes: sc.dupes, byRule: byRule,
    },
    candidates: { n: cand.n, byRule: cand.byRule },
    fbTotal: fbTotal, fbToday: fbToday,
    days: Object.keys(days).sort().slice(-30).map(function (d) {
      return { d: d, hits: days[d], users: uniqDays[d] || 0 };
    }),
    courses: top_(all.courses, 20), features: top_(all.feats, 14),
    devices: top_(all.devs, 5), ages: top_(all.ages, 8), genders: top_(all.gens, 3),
    regions: top_(all.regs, 12),

    // ── 오늘 (한국 시각) ──
    today: {
      hits: day.hits,
      users: Object.keys(day.users).length,
      newUsers: newUsers,
      newUsersExact: sc.windowFull,
      courseCount: Object.keys(day.courseSet).length,
      hours: hours,
      excluded: { devices: Object.keys(dExCids).length, rows: dExRows, test: dExTest },
      courses: top_(day.courses, 20), features: top_(day.feats, 14),
      devices: top_(day.devs, 5), ages: top_(day.ages, 8), genders: top_(day.gens, 3),
      regions: top_(day.regs, 12),
    },
  });
}
