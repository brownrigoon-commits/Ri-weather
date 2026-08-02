/* 관리자 통계 백엔드 검사 — 누굴 빼고 누굴 세는가, 오늘과 누적이 맞는가.
 *
 * 왜 이 검사가 있나: 이 로직이 틀리면 사장님이 보는 숫자가 통째로 틀린다.
 * 그런데 Apps Script 는 구글 서버에서만 돌고, 재배포는 손으로 하는 일이라
 * "틀렸네" 를 알아차리는 시점이 너무 늦다. tools/appsscript_sandbox.js 로
 * 구글 서비스를 흉내 내어 여기서 먼저 돌려 본다.
 *
 *   node tools/verify_ops_stats.js
 *
 * ⚠️ 규칙을 하나 고치거나 더하면 여기 시험도 같이 늘려야 한다.
 *    특히 '진짜 이용자를 잘못 빼지 않는가'(오판) 쪽을 반드시 넣을 것 —
 *    잡음이 남는 것보다 진짜 이용자를 잃는 쪽이 훨씬 나쁘다.
 */
"use strict";

const { load } = require("./appsscript_sandbox.js");

const GS = "tools/apps_script/Code.gs";
const KST = 9 * 3600000, DAY = 86400000;
const HEAD = ["시각", "cid", "이벤트", "이름", "버전", "기기", "연령대", "성별", "지역"];

const now = Date.now();
const todayStart = Math.floor((now + KST) / DAY) * DAY - KST;   // 한국 오늘 00:00
const T = (ms) => new Date(todayStart + ms);                     // 오늘 00:00 기준
const 어제 = (ms) => new Date(todayStart - DAY + ms);

let fails = 0, run = 0;
function ok(cond, what, detail) {
  run++;
  if (!cond) fails++;
  console.log((cond ? "  ✔ " : "  ✖ ") + what + (cond || !detail ? "" : "  → " + detail));
}
function eq(got, want, what) { ok(got === want, what, "받은 값: " + JSON.stringify(got)); }

/* 시험용 기록 한 줄 */
function row(t, cid, ev, name, opt) {
  opt = opt || {};
  return [t, cid, ev, name || "", opt.ver || "", opt.dev || "PC", opt.age || "", opt.gen || "", opt.reg || ""];
}

function build(rows, props, fb) {
  const sheets = { log: [HEAD].concat(rows) };
  if (fb) sheets.fb = [["시각", "cid", "분류", "별점", "내용", "화면", "버전", "기기"]].concat(fb);
  const S = load(GS, { sheets, props: props || {} });
  return { S, sum: () => S.__json(S.summary_()), cids: () => S.__json(S.cidList_()) };
}
const find = (list, cid) => list.rows.filter((r) => r.cid === cid)[0];

/* ──────────────────────────────────────────────────────────────
   1. 기본 — 진짜 이용자는 세고, 손으로 뺀 기기는 안 센다
   ────────────────────────────────────────────────────────────── */
{
  console.log("\n■ 1. 기본 집계");
  const t = build([
    row(어제(10 * 3600000), "user1", "visit", "", { dev: "iOS" }),
    row(어제(10 * 3600000 + 5000), "user1", "course", "한림안성CC", { dev: "iOS", reg: "경기남부" }),
    row(T(9 * 3600000), "user1", "visit", "", { dev: "iOS" }),
    row(T(9 * 3600000 + 4000), "user1", "feature", "weather", { dev: "iOS" }),
    row(T(9 * 3600000), "mypc", "visit", "", { dev: "PC" }),
    row(T(9 * 3600000 + 3000), "mypc", "course", "서서울CC", { dev: "PC" }),
  ], { DEV_CIDS: JSON.stringify(["mypc"]) });
  const s = t.sum();

  eq(s.scope, "day+all", "scope 를 알려준다(화면이 나누어 보기를 켜는 신호)");
  eq(s.uniq, 1, "누적 사용자 = 1명 (뺀 기기는 안 셈)");
  eq(s.today.users, 1, "오늘 온 사람 = 1명");
  eq(s.today.hits, 1, "오늘 앱을 연 횟수 = 1회");
  eq(s.excluded.devices, 1, "뺀 기기 1대라고 화면에 적는다");
  eq(s.excluded.rows, 2, "뺀 기록 2건");
  eq(JSON.stringify(s.courses), '[["한림안성CC",1]]', "누적 인기 골프장에 뺀 기기 것이 없다");
  eq(JSON.stringify(s.today.courses), "[]", "오늘은 골프장 조회가 없었다");
  eq(s.today.newUsers, 0, "오늘 처음 온 사람 0명 (user1 은 어제부터 왔다)");
  eq(s.total, 6, "시트 원본 줄 수는 뺀 것까지 그대로 6");
  eq(s.counted, 4, "실제 집계에 들어간 줄 수 4");
}

/* ──────────────────────────────────────────────────────────────
   2. 자정 경계 — 여기가 틀리면 '오늘'이 통째로 밀린다
   ────────────────────────────────────────────────────────────── */
{
  console.log("\n■ 2. 오늘의 경계 (한국 시각)");
  const t = build([
    row(new Date(todayStart - 1), "before", "visit", "", { dev: "iOS" }),        // 어제 23:59:59.999
    row(new Date(todayStart), "edge", "visit", "", { dev: "iOS" }),              // 오늘 00:00:00.000
    row(new Date(todayStart + DAY - 1), "late", "visit", "", { dev: "iOS" }),    // 오늘 23:59:59.999
  ]);
  const s = t.sum();
  eq(s.today.users, 2, "오늘 00:00 과 23:59 는 오늘, 어제 23:59 는 아니다");
  eq(s.todayKey, new Date(todayStart + KST).toISOString().slice(0, 10), "서버가 판단한 오늘 날짜");
  eq(s.today.hours.length, 24, "시간대 배열은 24칸");
  eq(s.today.hours.reduce((a, b) => a + b, 0), 2, "시간대 합계 = 오늘 연 횟수");
  eq(s.today.hours[0], 1, "00시에 1회");
  eq(s.today.hours[23], 1, "23시에 1회");
}

/* ──────────────────────────────────────────────────────────────
   3. A2 — 없는 골프장을 본 기기 (오판 불가능한 규칙)
   ────────────────────────────────────────────────────────────── */
{
  console.log("\n■ 3. A2 — 앱으로 갈 수 없는 이름을 본 기기");
  const t = build([
    row(T(1000), "fakeviewer", "visit", ""),
    row(T(9000), "fakeviewer", "course", "한림안성CC"),    // 대표구장은 진짜 이름
    row(T(20000), "fakeviewer", "course", "테스트CC"),     // ⚠️ 나중에 본 가짜
    row(T(1000), "real", "visit", ""),
    row(T(9000), "real", "course", "한림안성CC"),
  ]);
  const s = t.sum(), c = t.cids();
  eq(s.uniq, 1, "가짜 골프장을 본 기기는 자동으로 빠진다");
  eq(find(c, "fakeviewer").state, "auto", "상태 = 자동 제외");
  eq(find(c, "fakeviewer").rule, "A2", "규칙 A2");
  ok(/테스트CC/.test(find(c, "fakeviewer").why), "왜 뺐는지 사유가 붙는다", find(c, "fakeviewer").why);
  eq(find(c, "real").state, "on", "진짜 이용자는 그대로 센다");
  eq(s.excluded.byRule.A2, 3, "A2 로 뺀 줄 수를 규칙별로 적는다");
}

/* ──────────────────────────────────────────────────────────────
   4. 보호신호 — 자동 규칙에 걸려도 사람 흔적이 있으면 빼지 않는다
   ────────────────────────────────────────────────────────────── */
{
  console.log("\n■ 4. 보호신호(veto) — 애매하면 빼지 않는다");
  const t = build([
    row(T(1000), "hasage", "visit", "", { age: "40대", gen: "남성" }),
    row(T(9000), "hasage", "course", "테스트CC", { age: "40대", gen: "남성" }),
  ]);
  const s = t.sum(), c = t.cids();
  eq(find(c, "hasage").state, "candidate", "연령을 입력한 기기는 '확인 필요'로만 올린다");
  ok(/연령/.test(find(c, "hasage").veto), "보호신호를 밝힌다", find(c, "hasage").veto);
  eq(s.uniq, 1, "여전히 집계에 들어간다 (조용히 빼지 않는다)");
  eq(s.candidates.n, 1, "확인 필요 기기 수를 알려준다");

  // 의견을 남긴 기기도 같다
  const t2 = build(
    [row(T(1000), "wrote", "visit", ""), row(T(9000), "wrote", "course", "테스트CC")],
    {},
    [[T(5000), "wrote", "아이디어", 5, "이런 기능 있으면 좋겠어요", "home", "v187", "iOS"]]
  );
  eq(find(t2.cids(), "wrote").state, "candidate", "직접 의견을 남긴 기기도 확인 필요로만");
}

/* ──────────────────────────────────────────────────────────────
   5. A3 — 사람 손으로 불가능한 간격. 그리고 그 오판 방지
   ────────────────────────────────────────────────────────────── */
{
  console.log("\n■ 5. A3 — 0.4초 안에 연달아 누른 기록");
  const fast = [row(T(1000), "robot", "visit", "")];
  for (let i = 0; i < 6; i++) fast.push(row(T(5000 + i * 30), "robot", "feature", "f" + i));
  const t = build(fast);
  eq(find(t.cids(), "robot").state, "auto", "30ms 간격으로 6번 누른 기기는 자동 제외");
  eq(find(t.cids(), "robot").rule, "A3", "규칙 A3");

  /* ⚠️ 가장 중요한 오판 시험.
     통신이 나쁜 폰은 같은 기록을 두 번 보낸다(fetch + sendBeacon 경쟁).
     시각이 밀리초까지 같은 행이 생기는데, 이걸 안 걷어내면 진짜 이용자가 A3 에 걸린다. */
  const dup = [row(T(1000), "badnet", "visit", "")];
  for (let i = 0; i < 6; i++) {
    const at = T(5000 + i * 1000);
    dup.push(row(at, "badnet", "feature", "f" + i));
    dup.push(row(at, "badnet", "feature", "f" + i));   // 똑같은 줄이 한 번 더
  }
  const t2 = build(dup);
  const s2 = t2.sum();
  eq(find(t2.cids(), "badnet").state, "on", "중복 전송된 진짜 이용자는 빠지지 않는다");
  eq(s2.excluded.dupes, 6, "합친 중복 줄 수를 화면에 적는다");
  eq(s2.uniq, 1, "그대로 집계된다");

  // 두세 건짜리 우연은 근거가 못 된다
  const few = [row(T(1000), "few", "visit", ""),
               row(T(5000), "few", "feature", "a"), row(T(5010), "few", "feature", "b"),
               row(T(5020), "few", "feature", "c"), row(T(5030), "few", "feature", "d")];
  eq(find(build(few).cids(), "few").state, "on", "기록이 5건 미만이면 A3 를 적용하지 않는다");
}

/* ──────────────────────────────────────────────────────────────
   6. A4 — 클럽 피팅 4종 10분 안에 전부 시작 (검사 스크립트의 자국)
   ────────────────────────────────────────────────────────────── */
{
  console.log("\n■ 6. A4 — 클럽 피팅 4종 훑기");
  const clubs = ["driver", "iron", "wedge", "putter"];
  const sweep = [row(T(1000), "sweeper", "visit", "")];
  clubs.forEach((c, i) => sweep.push(row(T(60000 + i * 20000), "sweeper", "feature", "clubfit_start_" + c)));
  eq(find(build(sweep).cids(), "sweeper").state, "auto", "1분 안에 4종을 다 시작하면 자동 제외");
  eq(find(build(sweep).cids(), "sweeper").rule, "A4", "규칙 A4");

  // 진짜 이용자는 하루에 걸쳐 천천히 본다
  const slow = [row(T(1000), "slowuser", "visit", "")];
  clubs.forEach((c, i) => slow.push(row(T(3600000 * (1 + i * 3)), "slowuser", "feature", "clubfit_start_" + c)));
  eq(find(build(slow).cids(), "slowuser").state, "on", "3시간씩 띄워 본 이용자는 빼지 않는다");
}

/* ──────────────────────────────────────────────────────────────
   7. 되돌리기와 우선순위
   ────────────────────────────────────────────────────────────── */
{
  console.log("\n■ 7. 되돌리기(KEEP)와 우선순위");
  const rows = [
    row(T(1000), "wrongly", "visit", ""),
    row(T(9000), "wrongly", "course", "테스트CC"),      // A2 에 걸릴 기기
    row(T(1000), "verify-pc", "visit", ""),
    row(T(9000), "verify-pc", "course", "한림안성CC"),
  ];
  const t = build(rows, { KEEP_CIDS: JSON.stringify(["wrongly", "verify-pc"]) });
  const c = t.cids(), s = t.sum();
  eq(find(c, "wrongly").state, "keep", "되돌린 기기는 자동 규칙을 이긴다");
  eq(s.uniq, 1, "되돌린 기기만 집계에 들어간다");
  eq(find(c, "verify-pc").state, "always", "검사용 기기ID는 되돌리기로도 살릴 수 없다");

  // 손으로 뺀 것보다 되돌린 것이 이긴다(둘 다 들어 있어도)
  const t2 = build(rows, { DEV_CIDS: JSON.stringify(["wrongly"]), KEEP_CIDS: JSON.stringify(["wrongly"]) });
  eq(find(t2.cids(), "wrongly").state, "keep", "KEEP 이 DEV 보다 앞선다");
}

/* ──────────────────────────────────────────────────────────────
   8. 목록에 넣고 빼기 — 가득 차면 조용히 자르지 않는다
   ────────────────────────────────────────────────────────────── */
{
  console.log("\n■ 8. 기기 목록 넣고 빼기");
  const t = build([row(T(1000), "a", "visit", "")]);
  const S = t.S;

  let r = S.__json(S.listMark_(S.DEV_PROP, ["x1", "x2"], true));
  ok(r.ok && r.n === 2, "여러 대를 한 번에 뺀다", JSON.stringify(r));

  r = S.__json(S.listMark_(S.KEEP_PROP, ["x1"], true));
  ok(r.ok, "되돌리면 KEEP 으로 옮겨진다");
  eq(JSON.parse(S.__props.DEV_CIDS).indexOf("x1"), -1, "DEV 목록에서는 빠진다 (한 곳에만 있는다)");
  eq(JSON.parse(S.__props.KEEP_CIDS).indexOf("x1"), 0, "KEEP 목록에 들어간다");

  const many = [];
  for (let i = 0; i < 401; i++) many.push("c" + i);
  r = S.__json(S.listMark_(S.DEV_PROP, many, true));
  ok(!r.ok && /가득/.test(r.err || ""), "상한을 넘으면 조용히 자르지 않고 분명히 거절한다", JSON.stringify(r));
}

/* ──────────────────────────────────────────────────────────────
   9. B2 — 장치 붙기 전 하루살이 기기는 '확인 필요'까지만
   ────────────────────────────────────────────────────────────── */
{
  console.log("\n■ 9. B2 — 하루만 쓰고 사라진 기기");
  const old = new Date("2026-07-28T03:00:00Z");   // 한국 7/28 12시
  const t = build([
    row(old, "oneday", "visit", ""),
    row(new Date(+old + 60000), "oneday", "course", "서서울CC"),
  ]);
  const c = t.cids(), s = t.sum();
  eq(find(c, "oneday").state, "candidate", "자동으로 빼지 않는다 (한 번 써본 진짜 이용자와 구별 불가)");
  eq(find(c, "oneday").rule, "B2", "규칙 B2");
  eq(s.uniq, 1, "여전히 세고 있다");
  eq(s.candidates.byRule.B2, 1, "확인 필요 묶음에 규칙별로 센다");
}

/* ──────────────────────────────────────────────────────────────
   10. 옛 화면 호환 — 예전 키의 의미가 바뀌지 않았는가
   ────────────────────────────────────────────────────────────── */
{
  console.log("\n■ 10. 옛 관리자 화면도 그대로 도는가");
  const t = build([
    row(T(1000), "u", "visit", "", { dev: "iOS", age: "40대", gen: "남성", reg: "경기북부" }),
    row(T(9000), "u", "course", "한림안성CC", { dev: "iOS", reg: "경기북부" }),
    row(T(12000), "u", "feature", "weather", { dev: "iOS" }),
  ]);
  const s = t.sum();
  ["ver", "total", "uniq", "back7", "today", "fbTotal", "fbToday",
   "days", "courses", "features", "devices", "ages", "genders", "regions", "excluded"]
    .forEach((k) => ok(k in s, "예전 키 '" + k + "' 가 그대로 있다"));
  eq(typeof s.today.hits, "number", "today.hits 그대로");
  eq(typeof s.today.users, "number", "today.users 그대로");
  ok(/^\d{4}-\d{2}-\d{2}$/.test(s.days[0].d), "날짜 키는 연도까지 — 연말에 안 깨진다", s.days[0].d);
  eq(s.excluded.devices, 0, "뺀 것이 없으면 0");

  const c = t.cids();
  ok("off" in find(c, "u") && "auto" in find(c, "u"), "기기 목록의 옛 키(off·auto)도 남겨 둔다");
}

console.log("\n" + (fails ? "✖ 실패 " + fails + "건 / " + run + "검사"
                          : "✅ 전부 통과 (" + run + "검사)"));
process.exit(fails ? 1 : 0);
