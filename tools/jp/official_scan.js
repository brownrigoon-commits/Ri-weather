/* 일본 구장 공식 홈페이지 — 브라우저로 열어 홀맵 후보를 긁는다 (2026-08-01 신설)
 *
 * 왜 브라우저인가: 정적 HTML 만 읽었더니 씨앗 20곳 중 1곳밖에 못 찾았다.
 * 원인은 홀맵이 없어서가 아니라 **자바스크립트로 그려지기 때문**이었다
 * (슬라이더·모달·지연로드). 실제로 렌더링해서 DOM 의 이미지를 본다.
 *
 *   node tools/jp/official_scan.js            씨앗 전체
 *   node tools/jp/official_scan.js --limit 20 앞 20곳만
 *   node tools/jp/official_scan.js --only 相模 특정 구장
 *
 * 결과: coursedata/homepages_jp/_scan/official_dom.json
 *       (여기까지가 '긁기'. 홀맵 판정·내려받기·등록은 official_collect.py 가 한다)
 *
 * 예절: 한 사이트에 최대 6페이지, 페이지마다 1.2초 이상 간격, 동시 1개.
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const ROOT = path.dirname(path.dirname(__dirname));
const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SEEDS = path.join(ROOT, "coursedata", "homepages_jp", "_scan", "official_seeds.json");
const OUT = path.join(ROOT, "coursedata", "homepages_jp", "_scan", "official_dom.json");

const GUIDE = /(course|hole|layout|guide|コース|ホール|攻略|レイアウト)/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const args = process.argv.slice(2);
  const limit = args.includes("--limit") ? +args[args.indexOf("--limit") + 1] : 0;
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

  let seeds = JSON.parse(fs.readFileSync(SEEDS, "utf-8"));
  if (only) seeds = seeds.filter((s) => s.golfdb.includes(only) || s.osm.includes(only));
  if (limit) seeds = seeds.slice(0, limit);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const out = [];

  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    const rec = { golfdb: s.golfdb, osm: s.osm, site: s.site, pages: [] };
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                 "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      locale: "ja-JP",
      ignoreHTTPSErrors: true,              // 인증서 만료 구장 사이트가 많다
    });
    const page = await ctx.newPage();

    const grab = async (url) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      // 지연 로드를 깨우기 위해 아래까지 훑고 잠깐 기다린다
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 700) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
      }).catch(() => {});
      await page.waitForTimeout(900);
      return page.evaluate(() => {
        const abs = (u) => { try { return new URL(u, location.href).href; } catch (_) { return null; } };
        const imgs = new Set();
        document.querySelectorAll("img").forEach((el) => {
          for (const a of ["src", "data-src", "data-original", "data-lazy-src"]) {
            const v = el.getAttribute(a);
            if (v) { const u = abs(v); if (u) imgs.add(u); }
          }
          if (el.currentSrc) imgs.add(el.currentSrc);
        });
        document.querySelectorAll("a[href]").forEach((el) => {
          if (/\.(jpg|jpeg|png|gif|svg)(\?|$)/i.test(el.href)) imgs.add(el.href);
        });
        // 배경 이미지도 홀맵인 경우가 있다
        document.querySelectorAll("*").forEach((el) => {
          const b = getComputedStyle(el).backgroundImage;
          if (b && b !== "none") {
            const m = b.match(/url\(["']?([^"')]+)/);
            if (m) { const u = abs(m[1]); if (u) imgs.add(u); }
          }
        });
        const links = [];
        document.querySelectorAll("a[href]").forEach((el) => {
          links.push({ href: el.href, text: (el.textContent || "").trim().slice(0, 40) });
        });
        return { url: location.href, title: document.title,
                 imgs: [...imgs], links, text: document.body.innerText.slice(0, 20000) };
      });
    };

    try {
      const top = await grab(s.site);
      rec.pages.push({ url: top.url, title: top.title, imgs: top.imgs, text: top.text });
      const host = new URL(top.url).host;
      const cands = [];
      for (const l of top.links) {
        try {
          const u = new URL(l.href);
          if (u.host !== host) continue;
          if (/\.(jpg|png|pdf|zip)$/i.test(u.pathname)) continue;
          if (GUIDE.test(u.href) || GUIDE.test(l.text)) {
            if (!cands.includes(u.href) && u.href !== top.url) cands.push(u.href);
          }
        } catch (_) {}
      }
      for (const u of cands.slice(0, 5)) {
        await sleep(1200);
        try {
          const p = await grab(u);
          rec.pages.push({ url: p.url, title: p.title, imgs: p.imgs, text: p.text });
        } catch (_) {}
      }
    } catch (e) {
      rec.error = String(e).slice(0, 120);
    }
    await ctx.close();
    out.push(rec);
    const n = rec.pages.reduce((a, p) => a + p.imgs.length, 0);
    console.log(`[${i + 1}/${seeds.length}] ${rec.golfdb.slice(0, 20)} · 페이지 ${rec.pages.length} · 이미지 ${n}` +
                (rec.error ? ` · ${rec.error.slice(0, 40)}` : ""));
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1), "utf-8");
  }
  await browser.close();
  console.log(`\n저장: ${path.relative(ROOT, OUT)} (${out.length}곳)`);
})();
