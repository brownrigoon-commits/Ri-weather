/* 앱이 '우리 접속'을 정말 안 보내는지 실제 브라우저로 확인한다.
 *
 * 2026-08-02 개편: localhost 만 막던 방식 → **우리 배포 주소일 때만 보낸다**.
 * 이 뒤집기가 잘못되면 두 가지로 망한다.
 *   ① 너무 조이면 → 통계가 한 건도 안 쌓인다 (아무 오류도 안 나서 며칠을 모른다)
 *   ② 너무 풀면  → 7/28 처럼 우리 검사 흔적으로 새 기기가 100대씩 쌓인다
 * 그래서 배포 주소를 **흉내 내서** 양쪽을 다 눌러 본다.
 *
 *   python -m http.server 8734        (저장소 최상단에서)
 *   node tools/verify_stats_guard.js
 */
"use strict";

const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const ROOT = path.dirname(__dirname);
const CHROME = [
  process.env.CHROME,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/opt/pw-browsers/chromium",
  "/usr/bin/chromium",
].filter((p) => p && fs.existsSync(p))[0];
if (!CHROME) { console.error("크롬을 찾지 못했습니다. CHROME 환경변수로 경로를 알려 주세요."); process.exit(2); }

const PROD = "https://brownrigoon-commits.github.io/Ri-weather/";
const LOCAL = process.env.BASE || "http://localhost:8734";

const fails = [];
const ok = (cond, what, detail) => {
  console.log((cond ? "  ✔ " : "  ✖ ") + what + (cond || !detail ? "" : "  → " + detail));
  if (!cond) fails.push(what);
};

const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
                ".json": "application/json", ".webmanifest": "application/manifest+json" };

/* 배포 주소를 흉내 낸다 — 저장소 파일을 그 주소인 것처럼 돌려준다.
   이래야 location.hostname 이 진짜 배포 호스트가 되어 허용목록 판정을 그대로 태울 수 있다. */
async function makePage(browser, opts) {
  opts = opts || {};
  /* 진짜 이용자 흉내는 **두 가지를 같이** 해야 한다.
     헤드리스 크롬은 navigator.webdriver 뿐 아니라 UA 에도 HeadlessChrome 이 박혀 있어서
     한쪽만 가리면 여전히 자동화로 잡힌다(2026-08-02 이 검사를 처음 쓸 때 실제로 걸렸다). */
  const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 " +
                 "(KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1";
  const ctx = await browser.newContext(Object.assign(
    { serviceWorkers: "block", viewport: { width: 390, height: 844 } },
    opts.realUser ? { userAgent: IOS_UA } : {}));
  if (opts.realUser) {
    // navigator.webdriver 가 아예 없는 옛 브라우저(구형 사파리·안드로이드 웹뷰) 흉내
    await ctx.addInitScript(() => {
      try { Object.defineProperty(navigator, "webdriver", { get: () => undefined, configurable: true }); } catch (_) {}
    });
  }
  const page = await ctx.newPage();
  const posts = [];

  await page.route("**/*", (r) => {           // 먼저 등록 = 나중에 검사됨(그물 밖은 전부 막는다)
    const u = r.request().url();
    if (u.indexOf(LOCAL) === 0) return r.continue();
    return r.abort();
  });
  await page.route("**/macros/s/**", (r) => {  // 백엔드 — 보냈는지만 기록하고 성공으로 답한다
    if (r.request().method() === "POST") posts.push(r.request().postData() || "");
    return r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"n":1}' });
  });
  await page.route(PROD + "**", (r) => {       // 마지막 등록 = 가장 먼저 검사됨
    const rel = decodeURIComponent(new URL(r.request().url()).pathname.replace("/Ri-weather/", "")) || "index.html";
    const f = path.join(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory())
      return r.fulfill({ status: 404, body: "" });
    return r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || "text/plain",
                       body: fs.readFileSync(f) });
  });
  return { ctx, page, posts };
}

const state = (page) => page.evaluate(() => ({
  off: window.RIW_STATS_OFF,
  mark: window.RIW_STATS_MARK,
  cid: localStorage.getItem("riweather.cid"),
  dev: localStorage.getItem("riweather.dev"),
  q: localStorage.getItem("riweather.statq"),
}));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });

  // ── 1. 우리 주소가 아니면 한 건도 안 보낸다 ──────────────────────
  {
    console.log("\n■ 1. 배포 주소가 아닌 곳 (로컬 미리보기)");
    const { ctx, page, posts } = await makePage(browser);
    await page.goto(LOCAL + "/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);          // 4초 뒤 전송을 시도할 시간을 준다
    const s = await state(page);
    ok(s.off === "not-prod", "왜 껐는지 남긴다", JSON.stringify(s));
    ok(posts.length === 0, "서버로 한 건도 보내지 않는다", "보낸 건수 " + posts.length);
    ok(!s.q, "보내려고 쌓아 두지도 않는다", String(s.q));
    await ctx.close();
  }

  // ── 2. 배포 주소 + 헤드리스 = 표시해서 보낸다 ────────────────────
  {
    console.log("\n■ 2. 배포 주소를 자동화 브라우저로 열었을 때");
    const { ctx, page, posts } = await makePage(browser);
    await page.goto(PROD + "index.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    const s = await state(page);
    ok(s.mark === "wd", "자동화 브라우저라고 표시한다", JSON.stringify(s));
    ok(/^dev-wd-/.test(s.cid || ""), "기기ID에 새겨 서버가 알아보게 한다", String(s.cid));
    ok(s.off === "", "여기서 버리지 않는다 — 보내야 되돌릴 수 있다");
    ok(posts.length > 0, "보내기는 보낸다(서버가 자동으로 뺀다)", "보낸 건수 " + posts.length);
    ok(/dev-wd-/.test(posts.join("")), "보낸 내용에도 표시가 들어 있다");
    await ctx.close();
  }

  // ── 3. 진짜 이용자 — 막히면 절대 안 된다 ────────────────────────
  {
    console.log("\n■ 3. 진짜 이용자 (webdriver 속성이 없는 옛 브라우저)");
    const { ctx, page, posts } = await makePage(browser, { realUser: true });
    await page.goto(PROD + "index.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    const s = await state(page);
    ok(s.off === "", "막지 않는다", JSON.stringify(s));
    ok(s.mark === "", "자동화로 오해하지 않는다");
    ok(!/^dev-/.test(s.cid || ""), "기기ID를 건드리지 않는다", String(s.cid));
    ok(posts.length > 0, "통계가 정상으로 쌓인다", "보낸 건수 " + posts.length);
    await ctx.close();
  }

  // ── 4. ?dev=1 — 사장님 폰·개발 PC ───────────────────────────────
  {
    console.log("\n■ 4. ?dev=1 로 표시한 기기");
    const { ctx, page, posts } = await makePage(browser, { realUser: true });
    await page.goto(PROD + "index.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    const before = await state(page);
    ok(posts.length > 0, "표시 전에는 보내고 있었다");

    await page.goto(PROD + "index.html?dev=1", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    const s = await state(page);
    ok(s.off === "dev-device", "표시 뒤에는 끈다", JSON.stringify(s));
    ok(s.dev === "1", "저장소에 표시를 남긴다");
    ok(s.cid === "dev-" + before.cid, "기기ID에도 새긴다(저장소가 지워져도 서버가 알아본다)",
       s.cid + " ← " + before.cid);

    const n = posts.length;
    await page.goto(PROD + "index.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    ok(posts.length === n, "다음에 그냥 열어도 계속 빠진다(?dev=1 을 다시 붙일 필요 없음)",
       "추가로 보낸 건수 " + (posts.length - n));

    // ?reset=hard 로 저장소를 비워도 표시는 살아 있어야 한다
    await page.goto(PROD + "index.html?reset=hard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await page.goto(PROD + "index.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    const after = await state(page);
    ok(after.dev === "1" && /^dev-/.test(after.cid || ""),
       "?reset=hard 를 써도 '우리 기기' 표시는 살아남는다", JSON.stringify(after));

    // ?dev=0 으로 해제
    await page.goto(PROD + "index.html?dev=0", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const off = await state(page);
    ok(off.off === "" && !/^dev-/.test(off.cid || ""), "?dev=0 으로 되돌릴 수 있다", JSON.stringify(off));
    await ctx.close();
  }

  await browser.close();
  console.log("\n" + (fails.length ? "✖ 실패 " + fails.length + "건" : "✅ 전부 통과"));
  process.exit(fails.length ? 1 : 0);
})();
