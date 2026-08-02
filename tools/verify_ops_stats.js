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
  console.log("\n■ 5. A3 — 0.15초 안에 연달아 누른 기록 (같은 날)");
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
  eq(find(build(few).cids(), "few").state, "on", "하루 기록이 5건 미만이면 A3 를 적용하지 않는다");

  /* 빠른 손가락은 0.3초 간격 탭이 실제로 나온다(재검증 실측) — 걸리면 안 된다.
     기계(검사 도구)는 0.03초라 0.15초 기준이면 확실히 갈린다. */
  const tapper = [row(T(1000), "tapper", "visit", "")];
  for (let i = 0; i < 8; i++) tapper.push(row(T(5000 + i * 300), "tapper", "feature", "spirit_tab_" + i));
  eq(find(build(tapper).cids(), "tapper").state, "on", "0.3초 간격으로 빠르게 탭한 진짜 이용자는 빼지 않는다");

  /* 짝은 '같은 날' 안에서만 센다 — 날을 넘겨 쌓이면 오래 쓴 이용자가 언젠가 걸린다 */
  const twoday = [row(T(1000), "twoday", "visit", "")];
  for (let d = 0; d < 2; d++) {
    const base = T(5000 + d * 86400000).getTime();
    for (let i = 0; i < 3; i++) twoday.push(row(new Date(base + i * 100), "twoday", "feature", "t" + d + i));
    twoday.push(row(new Date(base + 60000), "twoday", "feature", "x" + d));
    twoday.push(row(new Date(base + 120000), "twoday", "feature", "y" + d));
  }
  eq(find(build(twoday).cids(), "twoday").state, "on",
     "이틀에 걸쳐 나눠 쌓인 빠른 짝(하루 2개씩)은 합쳐 세지 않는다");
}

/* ──────────────────────────────────────────────────────────────
   6. 클럽 피팅을 빨리 훑는 것은 정상 사용이다 (A4 폐기 확인)
   ────────────────────────────────────────────────────────────── */
{
  console.log("\n■ 6. 피팅 4종 빨리 훑기 = 정상 사용 (A4 는 폐기됨)");
  /* 재검증 실측: 진짜 이용자가 피팅 화면에서 클럽 탭 4개를 구경하는 데 터치 8번·5.3초.
     예전 A4(4종 10분)는 이걸 자동 제외했다 — 그래서 폐기했다. 되살아나면 이 시험이 잡는다. */
  const clubs = ["driver", "iron", "wedge", "putter"];
  const browse = [row(T(1000), "browser1", "visit", "")];
  clubs.forEach((c, i) => browse.push(row(T(5000 + i * 1300), "browser1", "feature", "clubfit_start_" + c)));
  eq(find(build(browse).cids(), "browser1").state, "on",
     "피팅 4종을 5초 만에 훑은 진짜 이용자도 그대로 센다");

  const slow = [row(T(1000), "slowuser", "visit", "")];
  clubs.forEach((c, i) => slow.push(row(T(3600000 * (1 + i * 3)), "slowuser", "feature", "clubfit_start_" + c)));
  eq(find(build(slow).cids(), "slowuser").state, "on", "3시간씩 띄워 본 이용자도 그대로 센다");
}

/* ──────────────────────────────────────────────────────────────
   6-1. 가짜 골프장 줄은 기기와 무관하게 순위에서 빠진다
   ────────────────────────────────────────────────────────────── */
{
  console.log("\n■ 6-1. 가짜 골프장 이름이 순위에 새지 않는가");
  // 연령을 입력한(=보호신호) 기기가 가나CC(폭우)를 봤다 — 기기는 세지만 그 줄은 빠져야 한다
  const t = build([
    row(T(1000), "vetoed", "visit", "", { age: "40대" }),
    row(T(9000), "vetoed", "course", "가나CC(폭우)", { age: "40대" }),
    row(T(20000), "vetoed", "course", "한림안성CC", { age: "40대" }),
  ]);
  const s = t.sum();
  eq(s.uniq, 1, "기기 자체는 세고 있다 (보호신호)");
  ok(!s.courses.some((c) => c[0] === "가나CC(폭우)"),
     "가나CC(폭우) 는 인기 골프장에 나오지 않는다", JSON.stringify(s.courses));
  ok(s.courses.some((c) => c[0] === "한림안성CC"), "진짜 구장 조회는 남는다");
  eq(s.excluded.test, 1, "뺀 줄 수로 세어진다");
}

/* ──────────────────────────────────────────────────────────────
   6-2. 의견 건수(카드)와 의견 목록이 같은 기준으로 걸러지는가
   ────────────────────────────────────────────────────────────── */
{
  console.log("\n■ 6-2. 의견 카드 숫자 = 의견 목록 개수");
  const fb = [
    [T(1000), "realuser", "칭찬", 5, "정말 잘 쓰고 있습니다 감사합니다", "home", "v190", "iOS"],
    [T(2000), "dev-mypc", "오류", 0, "버튼이 안 눌리는 것 같은데요", "course", "v190", "PC"],
    [T(3000), "verify-pc", "오류", 0, "검사 스크립트가 남긴 의견입니다", "home", "v190", "PC"],
  ];
  const t = build([row(T(500), "realuser", "visit", "")], {}, fb);
  const s = t.sum();
  const list = t.S.__json(t.S.fbList_());
  eq(s.fbTotal, 1, "카드: 진짜 이용자 의견 1건만 센다 (dev-·verify- 제외)");
  eq(list.rows.length, 1, "목록: 같은 1건만 보여준다");
  eq(list.rows[0].cid, "realuser", "남는 것은 진짜 이용자의 의견이다");
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

  /* ⚠️ 사람 흔적이 있는 하루살이는 확인 목록에도 올리지 않는다.
     안 그러면 [전부 안 셈] 이 그날 한 번 써 보고 떠난 진짜 이용자를 쓸어간다
     (2026-08-02 재검증에서 모의 자료 353대로 실제 재현했던 구멍). */
  const t2 = build([
    row(old, "humanday", "visit", "", { age: "40대", gen: "남성" }),
    row(new Date(+old + 60000), "humanday", "course", "서서울CC", { age: "40대" }),
  ]);
  eq(find(t2.cids(), "humanday").state, "on", "연령을 입력한 하루살이는 그냥 센다 (묻지도 않음)");

  const t3 = build(
    [row(old, "fbday", "visit", ""), row(new Date(+old + 60000), "fbday", "course", "서서울CC")],
    {},
    [[old, "fbday", "칭찬", 5, "앱이 정말 좋아요 잘 쓰겠습니다", "home", "v160", "iOS"]]
  );
  eq(find(t3.cids(), "fbday").state, "on", "의견을 남긴 하루살이도 그냥 센다");
}

/* ──────────────────────────────────────────────────────────────
   11. 7/28 무더기 종합 재현 — 사장님이 실제로 보신 353명이 어떻게 되나
   ────────────────────────────────────────────────────────────── */
{
  console.log("\n■ 11. 7/28 무더기 353대 종합 재현");
  const D = new Date("2026-07-28T03:00:00Z").getTime();   // 한국 7/28 정오
  const rows = [];
  let n = 0;
  // 가짜 골프장을 본 검사 기기 30 + 기계 속도 검사 기기 40 + 하루살이 검사 기기 280
  for (let i = 0; i < 30; i++) {
    const c = "fk" + n++;
    rows.push(row(new Date(D + i * 9000), c, "visit", ""));
    rows.push(row(new Date(D + i * 9000 + 3000), c, "course", "테스트CC"));
  }
  for (let i = 0; i < 40; i++) {
    const c = "fs" + n++, t = D + 400000 + i * 9000;
    rows.push(row(new Date(t), c, "visit", ""));
    for (let k = 0; k < 6; k++) rows.push(row(new Date(t + 3000 + k * 30), c, "feature", "f" + k));
  }
  for (let i = 0; i < 280; i++) {
    const c = "od" + n++, t = D + 900000 + i * 7000;
    rows.push(row(new Date(t), c, "visit", ""));
    rows.push(row(new Date(t + 15000), c, "course", ["한림안성CC", "서서울CC", "스카이72"][i % 3]));
  }
  // 진짜 이용자 4명 — 7/28 하루만 온 사람 2명(연령 입력), 이틀 온 사람 1명, 다른 날 1명
  rows.push(row(new Date(D + 5e6), "realA", "visit", "", { dev: "iOS", age: "40대", gen: "남성" }));
  rows.push(row(new Date(D + 5e6 + 6e4), "realA", "course", "파주CC", { dev: "iOS", age: "40대" }));
  rows.push(row(new Date(D + 6e6), "realB", "visit", "", { dev: "iOS", age: "30대" }));
  rows.push(row(new Date(D + 6e6 + 6e4), "realB", "course", "파주CC", { dev: "iOS", age: "30대" }));
  rows.push(row(new Date(D + 7e6), "realC", "visit", "", { dev: "iOS" }));
  rows.push(row(new Date(D + 86400000 * 4), "realC", "visit", "", { dev: "iOS" }));    // 8/1 재방문
  rows.push(row(new Date(D - 86400000), "realD", "visit", "", { dev: "Android", gen: "여성" }));

  const t = build(rows);
  const day = (r) => (r.sum().days.find((x) => x.d === "2026-07-28") || { users: 0 }).users;
  eq(day(t), 353 - 70, "자동 판정만으로 353명 → 283명 (검사기기 70대 즉시 제외)");
  eq(t.sum().candidates.n, 280, "무더기 280대가 '확인 필요'로 올라온다 (진짜 이용자는 안 섞임)");

  // [전부 안 셈] 재현 — 확인 필요 기기를 전부 DEV 목록에 넣는다
  const cand = t.cids().rows.filter((r) => r.state === "candidate").map((r) => r.cid);
  const t2 = build(rows, { DEV_CIDS: JSON.stringify(cand) });
  eq(day(t2), 3, "[전부 안 셈] 뒤 7/28 = 진짜 이용자 3명만 남는다");
  eq(t2.sum().uniq, 4, "누적 사용자도 진짜 4명만");
  ["realA", "realB", "realC", "realD"].forEach((c) =>
    ok(!find(t2.cids(), c).off, "진짜 이용자 " + c + " 는 살아 있다"));
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
