/* 관리자 화면 검사 — '오늘 / 전체 누적' 전환과 기기 목록이 실제로 눌리는가.
 *
 * 백엔드(Apps Script)는 가짜로 세운다. 진짜 서버를 부르면 비밀번호가 필요하고,
 * 무엇보다 **새벽에는 오늘 기록이 0건**이라 정작 봐야 할 화면을 못 본다.
 * 가짜로 세우면 '오늘 0건인 새벽'도, '백엔드가 옛 배포인 상태'도 마음대로 만들 수 있다.
 *
 *   python -m http.server 8734        (저장소 최상단에서)
 *   node tools/verify_ops_view.js
 *
 * ⚠️ 버튼이 눌리는지는 `.click()` 으로 확인하지 않는다 — 다른 요소가 덮고 있어도 통과한다.
 *    실제 좌표에서 elementFromPoint 로 확인한다(CLAUDE.md 3-1).
 */
"use strict";

const { chromium } = require("playwright-core");
const fs = require("fs");
const BASE = process.env.BASE || "http://localhost:8734";

/* 집·회사 PC(윈도우 크롬)와 리눅스 양쪽에서 그냥 돌게 한다.
   CHROME 환경변수로 언제든 덮어쓸 수 있다. */
const CHROME = [
  process.env.CHROME,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/opt/pw-browsers/chromium",
  "/usr/bin/chromium",
].filter((p) => p && fs.existsSync(p))[0];
if (!CHROME) {
  console.error("크롬을 찾지 못했습니다. CHROME 환경변수로 경로를 알려 주세요.");
  process.exit(2);
}

const fails = [];
const ok = (cond, what, detail) => {
  console.log((cond ? "  ✔ " : "  ✖ ") + what + (cond || !detail ? "" : "  → " + detail));
  if (!cond) fails.push(what);
};

const KST = 9 * 3600000, DAY = 86400000;
const now = Date.now();
const todayKey = new Date(now + KST).toISOString().slice(0, 10);
const yKey = new Date(now + KST - DAY).toISOString().slice(0, 10);

/* 백엔드가 줄 법한 응답 — 새 판(scope 있음) */
function newSummary(todayEmpty) {
  const hours = new Array(24).fill(0);
  if (!todayEmpty) { hours[9] = 3; hours[10] = 5; }
  return {
    ver: "2026-08-02a", scope: "day+all", tz: "Asia/Seoul",
    asOf: now, todayKey, lastAt: now - 3600000,
    total: 2804, counted: 1883, windowFull: true, uniq: 287, back7: 46,
    excluded: { devices: 132, rows: 830, test: 91, dupes: 17, byRule: { A2: 300, A3: 400, A1: 130 } },
    candidates: { n: 88, byRule: { B2: 88 } },
    fbTotal: 17, fbToday: 1,
    days: [{ d: yKey, hits: 132, users: 38 }, { d: todayKey, hits: todayEmpty ? 0 : 8, users: todayEmpty ? 0 : 3 }],
    courses: [["한림안성CC", 87], ["알프스대영CC", 38]],
    features: [["weather", 215], ["course", 166]],
    devices: [["PC", 1540], ["iOS", 1023]],
    ages: [["40대", 668]], genders: [["남성", 673]], regions: [["경기북부", 14]],
    today: {
      hits: todayEmpty ? 0 : 8, users: todayEmpty ? 0 : 3,
      newUsers: todayEmpty ? 0 : 2, newUsersExact: true,
      courseCount: todayEmpty ? 0 : 4, hours,
      excluded: { devices: todayEmpty ? 0 : 1, rows: todayEmpty ? 0 : 12, test: 0, dupes: 0 },
      courses: todayEmpty ? [] : [["파주CC", 6]],
      features: todayEmpty ? [] : [["weather", 20]],
      devices: todayEmpty ? [] : [["iOS", 21]],
      ages: [], genders: [], regions: todayEmpty ? [] : [["경기북부", 14]],
    },
  };
}

/* 옛 배포(2026-07-31d) — scope 가 없다 */
function oldSummary() {
  const s = newSummary(false);
  delete s.scope; delete s.counted; delete s.windowFull; delete s.candidates;
  s.ver = "2026-07-31d";
  s.today = { hits: 8, users: 3 };
  s.excluded = { devices: 1, rows: 2, test: 0 };
  s.days = [{ d: "08-01", hits: 132, users: 38 }];
  return s;
}

const CIDS_NEW = {
  ok: true, totalCids: 419, shown: 6,
  rows: [
    { cid: "5zjav7voehrn", n: 232, visits: 86, first: now - 5 * DAY, last: now - DAY, dev: "PC",
      vers: 13, versOut: 50, course: "솔라고컨트리클럽", days: 4, state: "auto", rule: "A3",
      why: "0.15초 안에 연달아 누른 기록 9번(하루 안) — 사람 손으로는 나올 수 없음", veto: "", off: true, auto: false },
    { cid: "b0awfmojc7ei", n: 64, visits: 44, first: now - 6 * DAY, last: now - 5 * DAY, dev: "PC",
      vers: 5, versOut: 30, course: "테스트CC", days: 2, state: "auto", rule: "A2",
      why: "없는 골프장 '테스트CC' 를 봄 — 앱으로는 갈 수 없는 이름", veto: "", off: true, auto: false },
    { cid: "oneday1", n: 12, visits: 2, first: now - 5 * DAY, last: now - 5 * DAY, dev: "PC",
      vers: 1, versOut: 12, course: "서서울CC", days: 1, state: "candidate", rule: "B2",
      why: "7월 28일 하루만 쓰고 사라진 기기", veto: "", off: false, auto: false },
    { cid: "oneday2", n: 11, visits: 2, first: now - 5 * DAY, last: now - 5 * DAY, dev: "PC",
      vers: 1, versOut: 12, course: "스카이72", days: 1, state: "candidate", rule: "B2",
      why: "7월 28일 하루만 쓰고 사라진 기기", veto: "", off: false, auto: false },
    { cid: "verify-pc", n: 4, visits: 2, first: now - 8 * DAY, last: now - 8 * DAY, dev: "PC",
      vers: 1, versOut: 4, course: "", days: 1, state: "always", rule: "X1",
      why: "검사 스크립트 — 늘 빠짐", veto: "", off: true, auto: true },
    { cid: "realuser01", n: 85, visits: 19, first: now - 7 * DAY, last: now, dev: "iOS",
      vers: 5, versOut: 40, course: "파주CC", days: 5, state: "on", rule: "", why: "", veto: "",
      off: false, auto: false },
  ],
};

/* 화면이 이 요소를 정말 누를 수 있는가 — 좌표에서 확인한다(.click() 은 덮여 있어도 통과한다) */
async function reallyClickable(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el || el.hidden) return { ok: false, why: "요소가 없음" };
    /* 사장님이 하듯 화면 가운데로 스크롤한 다음에 잰다.
       가운데로 보내는 이유 — 위에 붙어 있는 전환 막대(sticky)가 덮는지도 같이 보려면
       화면 끝이 아니라 가운데에 두고 봐야 한다. */
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return { ok: false, why: "크기가 0" };
    if (r.top < 0 || r.bottom > innerHeight) return { ok: false, why: "화면 밖으로 밀려남" };
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { ok: hit === el || el.contains(hit) || (hit && hit.contains(el)),
             why: hit ? "덮고 있는 것: " + hit.tagName + "." + hit.className : "아무 것도 없음",
             h: r.height };
  }, sel);
}

async function openOps(browser, summary, cids) {
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route("**/macros/s/**", async (route) => {
    const req = route.request();
    const json = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
    if (req.method() === "POST") return json({ ok: true, n: 1, changed: 1 });
    const u = new URL(req.url());
    const fn = u.searchParams.get("fn");
    if (fn === "summary") return json(summary);
    if (fn === "cids") return json(cids || CIDS_NEW);
    if (fn === "fblist") return json({ rows: [] });
    return json({ ok: true });
  });
  await page.goto(BASE + "/ops-k58zq.html", { waitUntil: "domcontentloaded" });
  await page.fill("#pw", "아무거나12345678");
  await page.click("#go");
  await page.waitForSelector("#main:not([hidden])", { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll("#cards .card").length > 0);
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });

  // ── 1. 새 백엔드 · 오늘/전체 전환 ─────────────────────────────
  {
    console.log("\n■ 1. 오늘 / 전체 누적 전환");
    const { ctx, page } = await openOps(browser, newSummary(false));

    ok(await page.$eval("#m-day", (e) => e.classList.contains("on")), "열면 '오늘'이 기본으로 선택돼 있다");
    ok(!(await page.$eval("#m-day", (e) => e.disabled)), "새 백엔드에서는 전환 버튼이 켜져 있다");

    const hit = await reallyClickable(page, "#m-all");
    ok(hit.ok, "'전체 누적' 버튼이 실제 좌표에서 눌린다", hit.why);
    ok(hit.h >= 44, "버튼 높이가 손가락에 맞는다(44px 이상)", "높이 " + hit.h);

    let big = await page.$$eval("#cards .v", (es) => es.map((e) => e.textContent.trim()));
    ok(/^3명/.test(big[0]), "오늘 카드 = 오늘 숫자(3명)", big.join(" | "));
    ok(/^2명/.test(big[1]), "오늘 처음 온 사람 2명", big[1]);
    ok(/^4곳/.test(big[2]), "오늘 본 골프장 4곳", big[2]);

    const scopeWords = await page.$$eval(".scope", (es) => es.map((e) => e.textContent));
    ok(scopeWords.every((w) => w === "오늘"), "구역 제목마다 '오늘'이 붙는다", scopeWords.join(","));
    ok(await page.$eval("#courses", (e) => /파주CC/.test(e.textContent)), "인기 골프장이 오늘 것으로 그려진다");
    ok(!(await page.$eval("#sec-hours", (e) => e.hidden)), "오늘은 시간대별 그림이 보인다");
    ok((await page.$$("#hours .day")).length === 24, "시간대 막대는 24칸");
    ok(await page.$eval("#sub", (e) => /^오늘/.test(e.textContent)), "요약줄이 '오늘' 기준임을 밝힌다",
       await page.$eval("#sub", (e) => e.textContent));

    await page.click("#m-all");
    await page.waitForFunction(() => document.querySelector("#m-all").classList.contains("on"));
    big = await page.$$eval("#cards .v", (es) => es.map((e) => e.textContent.trim()));
    ok(/^287명/.test(big[0]), "전체 카드 = 누적 숫자(287명)", big.join(" | "));
    ok(/^46%/.test(big[1]), "7일 재방문율 46%", big[1]);
    ok(await page.$eval("#courses", (e) => /한림안성CC/.test(e.textContent)), "인기 골프장이 누적 것으로 바뀐다");
    ok(await page.$eval("#sec-hours", (e) => e.hidden), "전체에서는 시간대별 그림을 감춘다");
    ok(!(await page.$eval("#sec-days", (e) => e.hidden)), "30일 추이는 두 모드 모두 그대로 있다");
    const sub = await page.$eval("#sub", (e) => e.textContent);
    ok(/시트 2,804건/.test(sub) && /집계 1,883건/.test(sub), "시트 줄 수와 집계 줄 수를 구분해 적는다", sub);
    ok(/뺀 기기 132대 830건/.test(sub), "무엇을 얼마나 뺐는지 적는다", sub);
    ok(/중복 전송 17건/.test(sub), "합친 중복 전송도 적는다", sub);
    await ctx.close();
  }

  // ── 2. 새벽 — 오늘 기록이 아직 0건 ─────────────────────────────
  {
    console.log("\n■ 2. 오늘 기록이 0건인 새벽");
    const { ctx, page } = await openOps(browser, newSummary(true));
    ok(!(await page.$eval("#sec-empty", (e) => e.hidden)), "'오늘 기록이 아직 없습니다' 안내가 뜬다");
    const ranks = await page.$$eval("section.rank", (es) => es.map((e) => e.hidden));
    ok(ranks.every(Boolean), "'데이터 없음'을 여섯 번 반복하지 않고 순위 구역을 접는다");
    const note = await page.$eval("#empty-note", (e) => e.textContent);
    ok(/마지막 기록/.test(note), "언제까지 기록이 있었는지 알려준다", note);
    ok(/직전 기록일/.test(note), "직전 기록일 숫자를 같이 준다", note);
    const big = await page.$$eval("#cards .v", (es) => es.map((e) => e.textContent.trim()));
    ok(/^0명/.test(big[0]), "0 은 '집계 전'이 아니라 '0명' 이라고 쓴다 (0 은 사실이다)", big[0]);

    await page.click("#go-all");
    await page.waitForFunction(() => !document.querySelector("section.rank").hidden);
    ok(await page.$eval("#courses", (e) => /한림안성CC/.test(e.textContent)), "'전체 누적 보기'가 동작한다");
    await ctx.close();
  }

  // ── 3. 옛 백엔드 — 재배포 전에도 화면이 살아 있어야 한다 ──────────
  {
    console.log("\n■ 3. 백엔드를 아직 재배포하지 않은 상태");
    const { ctx, page } = await openOps(browser, oldSummary(), { ok: true, rows: [] });
    ok(await page.$eval("#m-day", (e) => e.disabled), "전환 버튼은 눌리지 않게 막는다");
    ok(await page.$eval("#modenote", (e) => /배포/.test(e.textContent)), "왜 못 쓰는지, 무엇을 해야 하는지 적는다");
    ok(await page.$eval("#modenote", (e) => /2026-08-02a/.test(e.textContent)), "필요한 판번호를 알려준다");
    ok(await page.$eval("#m-all", (e) => e.classList.contains("on")), "전체 누적으로 자동 전환된다");
    ok(await page.$eval("#courses", (e) => /한림안성CC/.test(e.textContent)), "지금까지처럼 누적 통계는 그대로 보인다");
    const big = await page.$$eval("#cards .v", (es) => es.map((e) => e.textContent.trim()));
    ok(/^287명/.test(big[0]), "누적 사용자 카드가 정상", big[0]);
    ok(await page.$eval("#days", (e) => e.children.length > 0), "옛 날짜 형식(MM-dd)도 그대로 그려진다");
    await ctx.close();
  }

  // ── 4. 기기 목록 — 묶음과 사유 ────────────────────────────────
  {
    console.log("\n■ 4. 기기 목록 묶음");
    const { ctx, page } = await openOps(browser, newSummary(false));
    await page.waitForFunction(() => document.querySelectorAll("#cids .grp").length > 0);
    const txt = await page.$eval("#cids", (e) => e.textContent);
    ok(/확인이 필요합니다 \(2대\)/.test(txt), "확인 필요 묶음이 개수와 함께 뜬다");
    ok(/자동으로 뺀 기기 \(2대\)/.test(txt), "자동 제외 묶음이 뜬다");
    ok(/검사 스크립트 \(1대\)/.test(txt), "늘 빠지는 묶음이 따로 뜬다");
    ok(/없는 골프장 '테스트CC' 를 봄/.test(txt), "왜 뺐는지 사유가 기기마다 적혀 있다");
    ok(/그 사이 나간 버전 50개 중 13개 봄/.test(txt), "버전 수를 분모와 함께 적는다(오해 방지)");
    ok(/지금은 세고 있습니다/.test(txt), "확인 필요는 아직 세고 있다고 분명히 밝힌다");

    ok((await page.$$('#cids button[data-bulk]')).length >= 2, "묶음 처리 버튼이 있다");
    const foldBtn = await page.$('#cids button[data-fold="on"]');
    ok(!!foldBtn, "세고 있는 기기는 접어 둔다(목록이 길어지지 않게)");

    const bulkHit = await reallyClickable(page, '#cids button[data-bulk="dev"]');
    ok(bulkHit.ok, "'전부 안 셈' 버튼이 실제 좌표에서 눌린다", bulkHit.why);

    // 확인창 없이 실행되면 안 된다
    let asked = "";
    page.on("dialog", (d) => { asked = d.message(); d.dismiss(); });
    await page.click('#cids button[data-bulk="dev"]');
    await page.waitForTimeout(400);
    ok(/하루만 쓰고 사라진 기기 2대/.test(asked), "누르기 전에 무엇을 몇 대 빼는지 확인을 받는다", asked);
    ok(/되돌릴 수 있습니다/.test(asked), "되돌릴 수 있다고 알려준다", asked);

    const meHit = await reallyClickable(page, "#mark-me");
    ok(meHit.ok, "'이 기기는 우리 것' 버튼이 실제 좌표에서 눌린다", meHit.why);
    await ctx.close();
  }

  // ── 5. [이 기기는 우리 것] — 앞으로도 계속 빠지고, 버튼은 다시 안 나온다 ──
  {
    console.log("\n■ 5. 이 기기 영구 제외");
    const { ctx, page } = await openOps(browser, newSummary(false));
    await page.evaluate(() => localStorage.setItem("riweather.cid", "myphone123"));
    await page.waitForFunction(() => document.querySelectorAll("#cids .grp").length > 0);
    await page.click("#mark-me");
    await page.waitForFunction(() => /표시되어 있습니다/.test(document.querySelector("#mark-me-box").textContent),
                               { timeout: 8000 });
    const after = await page.evaluate(() => ({
      dev: localStorage.getItem("riweather.dev"),
      cid: localStorage.getItem("riweather.cid"),
      q: localStorage.getItem("riweather.statq"),
      btn: !!document.querySelector("#mark-me"),
    }));
    ok(after.dev === "1", "앱이 앞으로 이 기기 기록을 보내지 않도록 표시한다", JSON.stringify(after));
    ok(after.cid === "dev-myphone123", "기기ID에도 표시를 새긴다(저장소가 지워져도 서버가 알아본다)", after.cid);
    ok(!after.q, "보내려고 모아 둔 것도 버린다", String(after.q));
    ok(!after.btn, "누른 즉시 버튼이 '표시됨' 안내로 바뀐다");

    /* 사장님 지시(8/2): 한 번 누른 기기에서는 다음부터 버튼이 나오지 않아야 한다 */
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.fill("#pw", "아무거나12345678");
    await page.click("#go");
    await page.waitForSelector("#main:not([hidden])", { timeout: 15000 });
    const again = await page.evaluate(() => ({
      btn: !!document.querySelector("#mark-me"),
      note: /표시되어 있습니다/.test(document.querySelector("#mark-me-box").textContent),
      undo: !!document.querySelector("#unmark-me"),
    }));
    ok(!again.btn, "다시 열어도 버튼이 나오지 않는다", JSON.stringify(again));
    ok(again.note, "대신 '표시되어 있습니다' 안내가 떠 있다");
    ok(again.undo, "실수했을 때를 위한 [되돌리기]가 있다");

    // [되돌리기] — 표시가 풀리고 버튼이 돌아온다
    page.on("dialog", (d) => d.accept());
    await page.click("#unmark-me");
    await page.waitForFunction(() => !!document.querySelector("#mark-me"), { timeout: 8000 });
    const undone = await page.evaluate(() => ({
      dev: localStorage.getItem("riweather.dev"),
      cid: localStorage.getItem("riweather.cid"),
    }));
    ok(undone.dev === null && undone.cid === "myphone123",
       "[되돌리기]가 표시를 풀고 기기ID를 원래대로 되돌린다", JSON.stringify(undone));
    await ctx.close();
  }

  // ── 6. 앱 기록이 없는 브라우저 (홈 화면 설치 앱은 저장공간이 따로) ──────
  {
    console.log("\n■ 6. 앱을 연 적 없는 브라우저에서 눌렀을 때");
    const { ctx, page } = await openOps(browser, newSummary(false));   // cid 를 심지 않는다
    await page.waitForFunction(() => !!document.querySelector("#mark-me"));
    let told = "";
    page.on("dialog", (d) => { told = d.message(); d.accept(); });
    await page.click("#mark-me");
    await page.waitForFunction(() => /표시되어 있습니다/.test(document.querySelector("#mark-me-box").textContent),
                               { timeout: 8000 });
    ok(/홈 화면/.test(told) && /안 셈/.test(told),
       "설치 앱은 따로라는 것과, 목록 [안 셈]으로 빼라는 안내가 뜬다", told);
    const st = await page.evaluate(() => ({
      dev: localStorage.getItem("riweather.dev"),
      cid: localStorage.getItem("riweather.cid"),
    }));
    ok(st.dev === "1" && /^dev-/.test(st.cid || ""),
       "이 브라우저는 그 자리에서 표시되어 앞으로 잡음을 안 만든다", JSON.stringify(st));
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (fails.length ? "✖ 실패 " + fails.length + "건" : "✅ 전부 통과"));
  process.exit(fails.length ? 1 : 0);
})();
