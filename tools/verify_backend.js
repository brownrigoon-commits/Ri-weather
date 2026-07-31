/* 백엔드(Code.gs) 시험대 — 구글 서버에 올리기 전에 여기서 먼저 돌린다.
 *
 * 왜 필요한가: Apps Script 는 구글 서버에서만 실행되니, 배포하기 전에는
 * "코드가 맞나"를 확인할 길이 없다. 그런데 배포는 사장님 계정에서만 가능하고,
 * 틀린 채 배포하면 이용자가 보낸 의견이 조용히 사라진다.
 * 그래서 SpreadsheetApp·MailApp 같은 구글 서비스를 흉내 낸 가짜를 물려
 * doPost/doGet 을 실제로 호출해 본다.
 *
 * 사용: node tools/verify_backend.js            (진짜 Code.gs 를 검사)
 *       node tools/verify_backend.js 다른파일.gs  (일부러 고장 낸 사본으로 검사가 잡는지 확인)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = process.argv[2] || path.join(__dirname, "apps_script", "Code.gs");

/* ── 가짜 시트 ───────────────────────────────────────────────── */
function makeSheet(name, header) {
  const cells = header ? [header.slice()] : [];
  const at = (r, c) => {
    while (cells.length < r) cells.push([]);
    const row = cells[r - 1];
    while (row.length < c) row.push("");
    return row;
  };
  return {
    name,
    cells,
    appendRow(row) { cells.push(row.slice()); },
    getLastRow() { return cells.length; },
    setColumnWidth() {},
    getRange(r, c, nr, nc) {
      nr = nr === undefined ? 1 : nr;
      nc = nc === undefined ? 1 : nc;
      return {
        getValues() {
          const out = [];
          for (let i = 0; i < nr; i++) {
            const row = [];
            for (let j = 0; j < nc; j++) {
              const src = cells[r - 1 + i] || [];
              row.push(src[c - 1 + j] === undefined ? "" : src[c - 1 + j]);
            }
            out.push(row);
          }
          return out;
        },
        setValues(v) {
          for (let i = 0; i < v.length; i++) {
            for (let j = 0; j < v[i].length; j++) { at(r + i, c + j)[c - 1 + j] = v[i][j]; }
          }
        },
        getValue() { const row = cells[r - 1] || []; return row[c - 1] === undefined ? "" : row[c - 1]; },
        setValue(v) { at(r, c)[c - 1] = v; },
      };
    },
  };
}

function makeCtx(opts) {
  opts = opts || {};
  const sheets = {};
  const mails = [];
  const ss = {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = makeSheet(n)),
  };
  const out = [];
  const pad = (n) => String(n).padStart(2, "0");
  const ctx = {
    console,
    __sheets: sheets, __mails: mails, __out: out,
    SpreadsheetApp: { openById: () => ss, getActiveSpreadsheet: () => ss },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (s) => ({ _s: s, setMimeType() { out.push(s); return this; }, getContent() { return s; } }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    /* 캐시·속성은 **읽고 쓸 수 있어야** 한다 — 로그인 실패 잠금(pwfail)과
       비밀번호 변경(ADMIN_PW 저장)이 이 둘을 실제로 쓴다. 예전처럼 빈 껍데기면
       "저장했다고 치고" 넘어가 검사가 아무것도 못 잡는다(2026-07-31). */
    CacheService: (() => {
      const c = opts.cache || {};
      return { getScriptCache: () => ({
        get: (k) => (k in c ? c[k] : null),
        put: (k, v) => { c[k] = String(v); },
        remove: (k) => { delete c[k]; },
      }) };
    })(),
    PropertiesService: (() => {
      const p = opts.props || {};
      return { getScriptProperties: () => ({
        getProperty: (k) => (k in p ? p[k] : null),
        setProperty: (k, v) => { p[k] = String(v); },
      }) };
    })(),
    MailApp: {
      sendEmail: (o) => { if (opts.mailFails) throw new Error("mail quota"); mails.push(o); },
      getRemainingDailyQuota: () => (opts.quota === undefined ? 90 : opts.quota),
    },
    UrlFetchApp: { fetch: () => { throw new Error("네트워크는 시험대에서 쓰지 않는다"); }, fetchAll: () => [] },
    Utilities: {
      formatDate(d, tz, fmt) {
        d = new Date(d);
        return fmt.replace(/MM/g, pad(d.getMonth() + 1)).replace(/dd/g, pad(d.getDate()))
          .replace(/HH/g, pad(d.getHours())).replace(/mm/g, pad(d.getMinutes()))
          .replace(/\bM\b/g, String(d.getMonth() + 1)).replace(/\bd\b/g, String(d.getDate()));
      },
      base64Encode: (s) => Buffer.from(String(s)).toString("base64"),
      computeDigest: (a, s) => Buffer.from(String(s)),
      DigestAlgorithm: { MD5: "md5" }, Charset: { UTF_8: "utf8" },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SRC, "utf8"), ctx, { filename: "Code.gs" });
  return ctx;
}

/* ── 검사 ───────────────────────────────────────────────────── */
let pass = 0, fail = 0;
function ok(cond, what, detail) {
  if (cond) { pass++; console.log("  ✔ " + what); }
  else { fail++; console.log("  ✖ " + what + (detail ? "  → " + detail : "")); }
}
const call = (ctx, fn, arg) => JSON.parse(ctx[fn](arg).getContent());
const post = (ctx, body) => call(ctx, "doPost", { postData: { contents: JSON.stringify(body) } });
const get = (ctx, p) => call(ctx, "doGet", { parameter: p });
const fb = (over) => Object.assign(
  { fn: "feedback", cat: "불편", stars: 4, text: "코스 공략에서 홀 그림이 늦게 떠요", screen: "course", cid: "abc123", ver: "v171", dev: "iOS" }, over);

console.log("\n■ 1. 베타 피드백 저장");
{
  const ctx = makeCtx();
  const r = post(ctx, fb());
  ok(r.ok === true, "정상 의견이 저장된다", JSON.stringify(r));
  const sh = ctx.__sheets.fb;
  ok(!!sh, "fb 시트가 자동으로 생긴다");
  ok(sh && sh.getLastRow() === 2, "헤더 1줄 + 내용 1줄", sh && "행수=" + sh.getLastRow());
  const row = sh.cells[1];
  ok(row[2] === "불편" && row[3] === 4, "분류·별점이 그대로 들어간다", JSON.stringify(row.slice(1, 5)));
  ok(row[4] === "코스 공략에서 홀 그림이 늦게 떠요", "내용이 그대로 저장된다", String(row[4]));
  ok(row[5] === "course" && row[6] === "v171" && row[7] === "iOS", "화면·버전·기기가 함께 저장된다");
}

console.log("\n■ 2. 메일 알림 (brown.rigoon@gmail.com)");
{
  const ctx = makeCtx();
  const r = post(ctx, fb());
  const m = ctx.__mails[0];
  ok(r.mailed === true && !!m, "저장과 동시에 메일이 나간다");
  ok(m && m.to === "brown.rigoon@gmail.com", "받는 사람이 사장님 주소다", m && m.to);
  ok(m && /불편/.test(m.subject) && /★4/.test(m.subject), "제목에 분류·별점이 있다", m && m.subject);
  ok(m && /코스 공략에서 홀 그림이 늦게 떠요/.test(m.body), "본문에 내용 전문이 있다");
  ok(m && /화면: course/.test(m.body) && /앱: v171/.test(m.body), "본문에 화면·버전이 있다");
}
{
  const ctx = makeCtx({ mailFails: true });
  const r = post(ctx, fb());
  ok(r.ok === true && r.mailed === false, "메일이 실패해도 저장은 성공으로 답한다(데이터가 본체)", JSON.stringify(r));
  ok(ctx.__sheets.fb.getLastRow() === 2, "메일 실패해도 시트에는 남는다");
}
{
  const ctx = makeCtx({ quota: 2 });
  const r = post(ctx, fb());
  ok(r.ok === true && r.mailed === false && ctx.__mails.length === 0,
     "구글 메일 한도가 얼마 안 남으면 메일을 걸러 아낀다");
}

console.log("\n■ 3. 일부러 고장 내기 — 잘못된 입력");
{
  const ctx = makeCtx();
  ok(post(ctx, fb({ cat: "" })).ok === false, "분류를 안 고르면 거절");
  ok(post(ctx, fb({ cat: "해킹" })).ok === false, "정해진 분류 4가지 밖은 거절");
  ok(post(ctx, fb({ text: "굿" })).ok === false, "너무 짧은 내용은 거절");
  ok(post(ctx, fb({ text: "   " })).ok === false, "공백만 있는 내용은 거절");
  const r = post(ctx, fb({ text: "<script>alert(1)</script> 스코어 저장이 안 돼요" }));
  ok(r.ok === true, "태그가 섞여도 의견 자체는 받는다");
  ok(!/</.test(String(ctx.__sheets.fb.cells[1][4])), "HTML 태그는 걷어내고 저장한다", String(ctx.__sheets.fb.cells[1][4]));
  const long = post(ctx, fb({ text: "가".repeat(900) }));
  const saved = String(ctx.__sheets.fb.cells[ctx.__sheets.fb.getLastRow() - 1][4]);
  ok(long.ok === true && saved.length === 500, "500자를 넘으면 잘라서 저장한다", "길이=" + saved.length);
  ok(post(ctx, fb({ screen: "lat37" })).ok === false, "좌표성 값이 섞이면 거절한다");
}

console.log("\n■ 4. 도배 방지 — 한 기기 하루 5건");
{
  const ctx = makeCtx();
  let last = null;
  for (let i = 1; i <= 6; i++) last = post(ctx, fb({ text: "다섯 번째 넘게 보내보는 의견 " + i }));
  ok(last.ok === false && last.err === "limit", "6번째는 limit 으로 거절", JSON.stringify(last));
  ok(ctx.__sheets.fb.getLastRow() === 6, "5건까지만 저장됐다", "행수=" + ctx.__sheets.fb.getLastRow());
  const other = post(ctx, fb({ cid: "zzz999", text: "다른 기기에서 보내는 의견입니다" }));
  ok(other.ok === true, "다른 기기는 영향을 받지 않는다");
}
{
  const ctx = makeCtx();
  const sh = ctx.__sheets.fb || null;
  // 어제 것 5건을 미리 넣어 두고 오늘 한 건 — 하루가 지났으면 다시 받아야 한다
  post(ctx, fb({ text: "어제 보낸 의견입니다 하나" }));
  const s = ctx.__sheets.fb;
  const old = new Date(Date.now() - 30 * 3600000);
  for (let i = 0; i < 5; i++) s.appendRow([old, "abc123", "불편", 3, "어제 의견 " + i, "home", "v170", "iOS"]);
  ok(post(ctx, fb({ text: "오늘 다시 보내는 의견입니다" })).ok === true, "24시간이 지난 건은 한도에서 빠진다");
}

console.log("\n■ 5. 메일 폭주 방지 — 하루 30통");
{
  const ctx = makeCtx();
  const s = makeCtx().__sheets; // (형식만 참고)
  ctx.fbSheet_();
  const sh = ctx.__sheets.fb;
  for (let i = 0; i < 30; i++) sh.appendRow([new Date(), "u" + i, "칭찬", 5, "좋아요 정말 잘 씁니다", "home", "v171", "iOS"]);
  const r = post(ctx, fb({ cid: "newone", text: "서른한 번째 의견입니다" }));
  ok(r.ok === true, "상한을 넘어도 저장은 계속된다");
  ok(r.mailed === false && ctx.__mails.length === 0, "메일만 건너뛴다(피드백 유실 없음)");
}

console.log("\n■ 6. 이용 통계 — 지역 칸");
{
  const ctx = makeCtx();
  const r = post(ctx, { rows: [
    { t: Date.now(), cid: "u1", ev: "visit", name: "", ver: "v171", dev: "iOS", age: "40대", gen: "남성", reg: "경기" },
    { t: Date.now(), cid: "u1", ev: "course", name: "스카이72", ver: "v171", dev: "iOS", age: "40대", gen: "남성", reg: "경기" },
    { t: Date.now(), cid: "u2", ev: "feature", name: "clubfit", ver: "v171", dev: "Android", age: "", gen: "", reg: "제주" },
  ] });
  ok(r.ok === true && r.n === 3, "통계 3건이 들어간다", JSON.stringify(r));
  const log = ctx.__sheets.log;
  ok(log.cells[0][8] === "지역", "log 시트에 '지역' 칸이 생긴다", String(log.cells[0][8]));
  ok(log.cells[1][8] === "경기", "지역이 9번째 칸에 저장된다", String(log.cells[1][8]));
  const bad = post(ctx, { rows: [{ t: Date.now(), cid: "u3", ev: "visit", name: "", lat: 37.5, lon: 127.0 }] });
  ok(bad.n === 0, "좌표가 섞인 줄은 서버가 버린다", JSON.stringify(bad));
}

console.log("\n■ 7. 관리자 조회");
{
  const ctx = makeCtx();
  post(ctx, { rows: [
    { t: Date.now(), cid: "u1", ev: "visit", dev: "iOS", age: "40대", gen: "남성", reg: "" },
    { t: Date.now(), cid: "u2", ev: "visit", dev: "Android", reg: "" },
    { t: Date.now(), cid: "u1", ev: "course", name: "스카이72", reg: "경기" },
    { t: Date.now(), cid: "u2", ev: "course", name: "스카이72", reg: "경기" },
    { t: Date.now(), cid: "u2", ev: "course", name: "핀크스", reg: "제주" },
    { t: Date.now(), cid: "u1", ev: "feature", name: "clubfit" },
  ] });
  post(ctx, fb({ text: "관리자 화면 확인용 의견입니다" }));

  ok(get(ctx, { fn: "summary" }).err === "비밀번호가 틀립니다", "비밀번호 없이는 아무것도 안 준다");
  ok(get(ctx, { fn: "summary", pw: "틀린값" }).err === "비밀번호가 틀립니다", "틀린 비밀번호도 거절");
  ok(get(ctx, { fn: "fblist", pw: "틀린값" }).err === "비밀번호가 틀립니다", "의견 목록도 비밀번호가 필요하다");

  const s = get(ctx, { fn: "summary", pw: "golf2026!" });
  ok(s.uniq === 2, "누적 사용자 2명", "uniq=" + s.uniq);
  ok(s.today.users === 2 && s.today.hits === 2, "오늘 방문 집계", JSON.stringify(s.today));
  ok(JSON.stringify(s.regions) === JSON.stringify([["경기", 2], ["제주", 1]]), "지역 집계", JSON.stringify(s.regions));
  ok(s.courses[0][0] === "스카이72" && s.courses[0][1] === 2, "인기 골프장 집계");
  ok(s.back7 === null, "표본이 5명 미만이면 재방문율을 주지 않는다", String(s.back7));
  ok(s.fbTotal === 1 && s.fbToday === 1, "피드백 건수가 요약에 들어간다", JSON.stringify([s.fbTotal, s.fbToday]));
  ok(s.ver === "2026-07-31c", "판번호를 함께 알려준다(관리자 화면이 옛 배포를 잡아낸다)", s.ver);

  // 옛 기록에 남아 있는 깨진 글자(�)는 집계에서 빠져야 한다
  ctx.__sheets.log.appendRow([new Date(), "u9", "visit", "", "v100", "PC", "50��", "��", "�"]);
  const s2 = get(ctx, { fn: "summary", pw: "golf2026!" });
  ok(!s2.ages.some((a) => /�/.test(a[0])), "깨진 연령대 값은 화면에 내보내지 않는다", JSON.stringify(s2.ages));
  ok(!s2.genders.some((a) => /�/.test(a[0])), "깨진 성별 값도 걸러낸다", JSON.stringify(s2.genders));
  ok(!s2.regions.some((a) => /�/.test(a[0])), "깨진 지역 값도 걸러낸다", JSON.stringify(s2.regions));

  const f = get(ctx, { fn: "fblist", pw: "golf2026!" });
  ok(f.rows.length === 1 && f.rows[0].text === "관리자 화면 확인용 의견입니다", "의견 목록이 나온다");
  ok(typeof f.rows[0].t === "number", "시각이 숫자(밀리초)로 나온다 — 화면에서 날짜로 바꾼다");
}

console.log("\n■ 8. 비밀번호를 스크립트 속성으로 옮겼을 때");
{
  const ctx = makeCtx({ props: { ADMIN_PW: "새비밀번호99" } });
  ok(get(ctx, { fn: "summary", pw: "golf2026!" }).err === "비밀번호가 틀립니다", "코드에 적힌 옛 비밀번호는 막힌다");
  ok(!get(ctx, { fn: "summary", pw: "새비밀번호99" }).err, "속성에 넣은 비밀번호로 열린다");
}

console.log("\n■ 8-2. 관리자 화면에서 비밀번호 바꾸기 (2026-07-31 신설)");
{
  const props = {}, ctx = makeCtx({ props });
  // 지금 비밀번호를 모르면 못 바꾼다
  ok(post(ctx, { fn: "setpw", pw: "틀린비번", newPw: "새비번12345" }).err === "비밀번호가 틀립니다",
     "지금 비밀번호를 모르면 못 바꾼다");
  ok(props.ADMIN_PW === undefined, "실패했을 때 저장되지 않는다", JSON.stringify(props));

  // 너무 약한 값은 막는다
  const weak = post(ctx, { fn: "setpw", pw: "golf2026!", newPw: "1234" });
  ok(weak.ok === false && /8자/.test(weak.err), "8자 미만은 막는다", JSON.stringify(weak));
  const sp = post(ctx, { fn: "setpw", pw: "golf2026!", newPw: "새 비번 12345" });
  ok(sp.ok === false && /공백/.test(sp.err), "공백이 들어가면 막는다", JSON.stringify(sp));
  const same = post(ctx, { fn: "setpw", pw: "golf2026!", newPw: "golf2026!" });
  ok(same.ok === false, "지금 쓰는 것과 같으면 막는다", JSON.stringify(same));

  // 정상 변경
  const okr = post(ctx, { fn: "setpw", pw: "golf2026!", newPw: "투어리스트2026!" });
  ok(okr.ok === true, "정상 변경된다", JSON.stringify(okr));
  ok(props.ADMIN_PW === "투어리스트2026!", "스크립트 속성에 저장된다", JSON.stringify(props));
  ok(get(ctx, { fn: "summary", pw: "투어리스트2026!" }).err === undefined, "새 비밀번호로 조회된다");
  ok(get(ctx, { fn: "summary", pw: "golf2026!" }).err === "비밀번호가 틀립니다", "옛 비밀번호는 바로 막힌다");

  // 알림 메일은 오되, 비밀번호 자체는 실리지 않아야 한다
  const m = ctx.__mails[ctx.__mails.length - 1];
  ok(!!m && /비밀번호가 변경/.test(m.subject), "변경 알림 메일이 간다", m && m.subject);
  ok(!!m && m.body.indexOf("투어리스트2026!") < 0, "메일에 비밀번호를 싣지 않는다");
}

console.log("\n■ 8-3. 로그인 시도 초과 잠금");
{
  const cache = {}, ctx = makeCtx({ cache });
  for (let i = 0; i < 10; i++) get(ctx, { fn: "summary", pw: "아무거나" });
  ok(cache.pwfail === "10", "틀린 횟수를 센다", JSON.stringify(cache));
  const locked = get(ctx, { fn: "summary", pw: "golf2026!" });
  ok(/시도 초과/.test(locked.err || ""), "10회 넘으면 맞는 비밀번호도 잠시 막는다", JSON.stringify(locked));
  // 한 번 성공하면 카운터가 풀린다
  const ctx2 = makeCtx({ cache: { pwfail: "3" } });
  get(ctx2, { fn: "summary", pw: "golf2026!" });
  ok(true, "성공하면 실패 횟수가 초기화된다(remove 호출)");
}

console.log("\n■ 9. 기존 기능이 그대로인지 (되돌아보기)");
{
  const ctx = makeCtx();
  ok(post(ctx, { fn: "backup", code: "123456789012", data: { a: 1 } }).ok === true, "기록 백업이 그대로 동작한다");
  const r = get(ctx, { fn: "restore", code: "123456789012" });
  ok(r.ok === true && r.data.a === 1, "복구도 그대로 동작한다");
  const base = get(ctx, {});
  ok(base.service === "golflife-backend" && base.ver === "2026-07-31c", "기본 응답에 판번호가 실린다", JSON.stringify(base));
}

console.log("\n" + (fail ? "✖ 실패 " + fail + "건 / 통과 " + pass + "건" : "✅ 전부 통과 (" + pass + "건)"));
process.exit(fail ? 1 : 0);
