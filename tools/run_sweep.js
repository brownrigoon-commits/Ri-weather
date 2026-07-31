/* 전체 검사(tools/sweep.js)를 명령줄에서 돌린다 — 2026-07-31 신설
 *
 *   node tools/run_sweep.js          결과 요약 (버그 있으면 종료코드 1)
 *   node tools/run_sweep.js --json   원본 JSON 그대로
 *
 * 전제: 로컬 서버가 떠 있어야 한다 →  python -m http.server 8734
 *
 * 왜 만들었나 — sweep.js 는 브라우저 콘솔에 붙여 돌려 왔는데, **창이 화면에 안 보이면
 * 크롬이 타이머를 5배 이상 늦춘다.** 같은 검사가 45초에도, 376초에도 끝나고 심하면
 * 멈춘 것처럼 보인다(HANDOFF 에 기록된 실제 증상). 헤드리스로 돌리면 그 영향이 없다.
 * **검사 내용은 tools/sweep.js 그대로다** — 여기서는 실어서 돌리기만 한다.
 *
 * ⚠️ serviceWorkers:'block' — 안 그러면 캐시된 옛 버전이 검사된다(실제 사고 있었음)
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE || "http://localhost:8734";
const JSON_OUT = process.argv.includes("--json");

(async () => {
  const src = fs.readFileSync(path.join(__dirname, "sweep.js"), "utf-8");
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("JS: " + e.message));

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  let raw;
  try {
    raw = await page.evaluate(src);              // sweep.js 는 결과 JSON 문자열을 돌려준다
  } catch (e) {
    console.error("검사 실행 실패:", e.message);
    await browser.close();
    process.exit(1);
  }
  await browser.close();

  if (JSON_OUT) { console.log(raw); }
  const r = JSON.parse(raw);
  const bugs = r["버그"] || [];
  const runtime = r["런타임오류"] || [];
  console.log(`조합 ${r["엔진조합수"]} · 런타임오류 ${runtime.length} · 버그 ${r["발견버그수"]}`);
  if (runtime.length) runtime.slice(0, 5).forEach((s) => console.log("  런타임:", s));
  if (bugs.length) {
    bugs.slice(0, 25).forEach((b) => console.log(`  - [${b.kind}] ${b.where} — ${b.detail}`));
    console.log("✖ 버그가 있습니다");
    process.exit(1);
  }
  if (errs.length) console.log("  ※ 페이지 오류:", errs.slice(0, 3).join(" | "));
  console.log("✅ 전체 검사 통과");
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
