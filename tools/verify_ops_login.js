/* 관리자 화면 로그인이 '확인 중…' 에서 멈추지 않는지 실제로 눌러 확인한다.
   tools/run_sweep.js 와 같은 방식(헤드리스 크롬). */
const { chromium } = require("playwright-core");
const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE || "http://localhost:8734";

const fails = [];
const ok = (cond, what, detail) => {
  console.log((cond ? "  ✔ " : "  ✖ ") + what + (cond || !detail ? "" : "  → " + detail));
  if (!cond) fails.push(what);
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });

  // ── 1. 틀린 비밀번호 — 멈추지 않고 이유가 떠야 한다
  {
    const ctx = await browser.newContext({ serviceWorkers: "block" });
    const p = await ctx.newPage();
    await p.goto(BASE + "/ops-k58zq.html", { waitUntil: "domcontentloaded" });
    await p.fill("#pw", "틀린비밀번호12345");
    await p.click("#go");
    const t0 = Date.now();
    let msg = "";
    for (let i = 0; i < 60; i++) {
      msg = await p.textContent("#gate-err");
      if (msg && msg !== "확인 중…" && !/한 번 더/.test(msg)) break;   // 재시도 중이면 계속 기다린다
      await p.waitForTimeout(500);
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log("\n■ 1. 틀린 비밀번호 (실제 백엔드 호출)");
    ok(msg !== "확인 중…", "'확인 중…' 에서 멈추지 않는다 (" + secs + "초)", "지금 문구: " + msg);
    ok(/비밀번호/.test(msg || ""), "비밀번호가 틀렸다고 알려준다", msg);
    ok(await p.isVisible("#gate"), "로그인 화면에 그대로 있다");
    await ctx.close();
  }

  // ── 2. 서버가 응답하지 않을 때 — 시간 제한이 걸려 이유가 떠야 한다
  {
    const ctx = await browser.newContext({ serviceWorkers: "block" });
    const p = await ctx.newPage();
    // 백엔드 요청을 통째로 물고 응답하지 않는다 = 폰에서 겪은 상황 재현
    await p.route("**/macros/s/**", () => { /* 아무 응답도 주지 않음 */ });
    await p.addInitScript(() => { window.__TESTMS = 4000; });
    await p.goto(BASE + "/ops-k58zq.html", { waitUntil: "domcontentloaded" });
    // 시험을 빨리 끝내려고 제한시간만 4초로 줄여 같은 경로를 태운다
    await p.evaluate(() => {
      const orig = window.get;
      window.get = function (fn) { return orig(fn, 4000); };
    });
    await p.fill("#pw", "아무거나12345678");
    await p.click("#go");
    const t0 = Date.now();
    let msg = "";
    for (let i = 0; i < 80; i++) {
      msg = await p.textContent("#gate-err");
      if (msg && msg !== "확인 중…" && !/한 번 더/.test(msg)) break;   // 재시도 중이면 계속 기다린다
      await p.waitForTimeout(500);
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log("\n■ 2. 서버가 응답하지 않을 때 (폰에서 겪은 상황 재현)");
    ok(msg !== "확인 중…", "영원히 멈추지 않는다 (" + secs + "초 만에 결론)", "지금 문구: " + msg);
    ok(/응답|연결|브라우저/.test(msg || ""), "무슨 일인지 화면에 적는다", msg);
    await ctx.close();
  }

  // ── 3. 자동 로그인 — 연결 문제로는 저장된 비밀번호를 지우지 않는다
  {
    const ctx = await browser.newContext({ serviceWorkers: "block" });
    const p = await ctx.newPage();
    await p.goto(BASE + "/ops-k58zq.html", { waitUntil: "domcontentloaded" });
    await p.evaluate(() => localStorage.setItem("riwadmin.pw", "저장된비밀번호"));
    await p.route("**/macros/s/**", (r) => r.abort("failed"));   // 연결 실패
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(3000);
    const kept = await p.evaluate(() => localStorage.getItem("riwadmin.pw"));
    const msg = await p.textContent("#gate-err");
    console.log("\n■ 3. 자동 로그인 중 연결 실패");
    ok(kept === "저장된비밀번호", "연결 문제로는 저장된 비밀번호를 지우지 않는다", "남은 값: " + kept);
    ok(!!msg && msg !== "불러오는 중…", "왜 못 들어갔는지 알려준다", msg);
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (fails.length ? "✖ 실패 " + fails.length + "건" : "✅ 전부 통과"));
  process.exit(fails.length ? 1 : 0);
})();
