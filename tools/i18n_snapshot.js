/* 한국어 화면이 **한 글자도 안 변했는지** 확인하는 스냅샷 게이트 (2026-07-31 신설)
 *
 * 왜 필요한가 — 다국어 작업(Phase 2)은 화면 문구를 통째로 사전으로 옮기는 일이다.
 * 옮기다 오타 하나만 나도 한국 이용자 화면이 바뀌는데, 사람 눈으로는 5,500줄을 못 본다.
 * 그래서 **옮기기 전에** 기준 스냅샷을 떠 두고, 옮긴 뒤 같은 화면이 나오는지 기계가 본다.
 *
 *   node tools/i18n_snapshot.js --save   기준 스냅샷 + 네트워크 픽스처 기록 (작업 시작 전 1회)
 *   node tools/i18n_snapshot.js          기준과 비교 — 다르면 무엇이 달라졌는지 찍고 종료코드 1
 *
 * 전제: 로컬 서버가 떠 있어야 한다 →  python -m http.server 8734
 *
 * 흔들리지 않게 하려고 세 가지를 고정한다:
 *   ① 시각   — Date.now()/new Date() 를 고정값으로 (예보·요일·"오늘" 문구가 날마다 달라짐)
 *   ② 난수   — Math.random() 을 씨앗 고정 (로딩 문구를 무작위로 고르는 곳이 있음)
 *   ③ 네트워크 — 바깥 요청은 --save 때 받은 응답을 그대로 다시 먹인다(기록·재생)
 *
 * DOM 글자만 보면 '완전 동일'이 아니다. 다음도 함께 뜬다:
 *   · placeholder / aria-label / alt / title 속성   · document.title
 *   · alert()·confirm() 로 뜨는 문구 (DOM 밖이라 화면 검사로는 영영 안 잡힘)
 *
 * ⚠️ serviceWorkers:'block' — 안 그러면 캐시된 옛 버전이 서빙된다(실제 사고 있었음)
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE || "http://localhost:8734";
const DIR = path.join(__dirname, "i18n_baseline");
const SNAP = path.join(DIR, "snapshot.json");
const FIX = path.join(DIR, "fixtures.json");
const SAVE = process.argv.includes("--save");

/* 고정 시각: 2026-08-01(토) 09:00 KST. 토요일이라 부킹 화면의 '다가오는 토요일'도 안정적이다. */
const FROZEN = Date.UTC(2026, 7, 1, 0, 0, 0);

/* 바깥 요청 키 — 캐시깨기 파라미터(t/x/_/timestamp)는 매번 달라지므로 빼고 맞춘다 */
function keyOf(url) {
  try {
    const u = new URL(url);
    ["t", "x", "_", "ts", "timestamp"].forEach((k) => u.searchParams.delete(k));
    return u.origin + u.pathname + (u.searchParams.toString() ? "?" + u.searchParams.toString() : "");
  } catch (_) { return url; }
}

const initScript = ({ frozen, consent }) => {
  /* 페이지의 첫 스크립트보다 먼저 돈다 — app.js 가 Date 를 읽기 전에 고정해야 한다 */
  const RealDate = Date;
  function FakeDate(...a) {
    if (!(this instanceof FakeDate)) return new RealDate(frozen).toString();
    return a.length ? new RealDate(...a) : new RealDate(frozen);
  }
  FakeDate.prototype = RealDate.prototype;
  FakeDate.now = () => frozen;
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  window.Date = FakeDate;

  let seed = 42;                                   // 씨앗 고정 난수 (선형 합동법)
  Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

  window.__dialogs = [];                           // DOM 밖 문구도 잡는다
  window.alert = (m) => { window.__dialogs.push("alert: " + m); };
  window.confirm = (m) => { window.__dialogs.push("confirm: " + m); return false; };
  window.prompt = (m) => { window.__dialogs.push("prompt: " + m); return null; };

  try {
    localStorage.setItem("riweather.consent", consent);
    localStorage.setItem("riweather.backup", JSON.stringify({ nudged: true }));
    localStorage.setItem("riweather.dev", "1");     // 통계에 우리 접속이 안 쌓이게
  } catch (_) {}
};

/* 화면마다 내용이 실제로 그려지도록 한 바퀴 돌린다.
   실패해도 멈추지 않는다 — 그 화면은 '못 연 상태' 그대로 스냅샷에 남고, 그 사실이 비교된다. */
const COURSE = { id: "snap-1", name: "파주CC", addr: "경기 파주시", lat: 37.8, lon: 126.8, c: "KR" };
const STEPS = [
  ["home", "saveCourses([C]); renderHome();"],
  ["hub", "openHub(C);"],
  ["detail", "openDetail(C);"],
  ["course", "openCourseView();"],
  ["food", "openFoodView();"],
  ["stay", "openStayView();"],
  ["booking", "openBookingView();"],
  ["score", "openScoreView();"],
  ["clubfit", "openClubfitView();"],
  ["spirit", "openSpiritView();"],
];
/* 화면을 새로 만들면 여기에도 한 줄 추가할 것 — 안 넣으면 그 화면의 문구는
   기준 스냅샷에 '빈 화면'으로 잡혀 다국어 작업 중 바뀌어도 안 잡힌다.
   (VIEWS 등록부·sweep MUST 와 같은 성격의 등록부다) */

async function walk(page, inflight) {
  const log = [];
  for (const [name, code] of STEPS) {
    const r = await page.evaluate(async ({ code, C }) => {
      try { await (new Function("C", "return (async()=>{" + code + "})()"))(C); return "ok"; }
      catch (e) { return "실패:" + String(e && e.message).slice(0, 40); }
    }, { code, C: COURSE });
    log.push(r === "ok" ? name : name + r);
    /* 한 화면이 끝나고 다음으로 — 화면끼리 겹쳐 돌면 결과가 실행마다 달라진다.
       상한을 넉넉히 준다: --save 는 진짜 네트워크라 느린데, 여기서 끊기면
       기준 스냅샷만 '덜 그려진 상태'로 굳어 매번 어긋난다(숙박 화면에서 실제로 겪음). */
    const ok = await settle(page, inflight, { quiet: 700, cap: 45000 });
    if (!ok) console.log(`  ※ [${name}] 요청이 안 멎어 대기를 끊었습니다 — 이 화면은 결과가 흔들릴 수 있습니다`);
  }
  return log;
}

/* 요청이 완전히 멎을 때까지 기다린다.
   이게 없으면 게이트가 흔들린다 — 픽스처 재생은 실제 네트워크보다 훨씬 빨라서,
   같은 '몇 초 대기'로도 화면이 더 멀리 진행돼 버린다(사진이 더 붙거나, 빈 결과
   안내가 더 일찍 뜬다). 실제로 첫 시험에서 food·stay 두 화면이 이것 때문에 어긋났다. */
async function settle(page, inflight, { quiet = 900, cap = 25000 } = {}) {
  const t0 = Date.now();
  let since = Date.now();
  for (;;) {
    await page.waitForTimeout(150);
    if (inflight.n > 0) since = Date.now();
    else if (Date.now() - since >= quiet) return true;
    if (Date.now() - t0 > cap) return false;        // 계속 무언가 돌면 그만 기다린다
  }
}

async function snapshot(page) {
  return await page.evaluate(() => {
    /* 버전 번호(BETA v178 등)는 배포마다 바뀐다 — 문구 회귀를 보는 게이트라
       이걸 그대로 두면 배포할 때마다 기준이 무효가 된다. 비교에서만 가린다. */
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim().replace(/\bv\d+\b/g, "v#");
    const out = { title: document.title, lang: document.documentElement.lang, views: {}, dialogs: [] };
    const names = typeof VIEWS !== "undefined" ? Object.keys(VIEWS) : [];
    const was = names.map((k) => VIEWS[k].hidden);
    for (const k of names) {
      names.forEach((n) => { VIEWS[n].hidden = n !== k; });   // 한 화면만 켜고 읽는다
      const el = VIEWS[k];
      const attrs = [];
      /* alt 는 일부러 뺀다 — 화면에 붙는 alt 는 대부분 '가게 이름' 같은 **데이터**라
         실행마다 달라져 게이트가 흔들린다. index.html 에 박힌 정적 alt 6개는
         파일을 직접 훑는 정적 검사(check_brand·check_hangul) 쪽에서 본다. */
      el.querySelectorAll("[placeholder],[aria-label],[title]").forEach((n) => {
        for (const a of ["placeholder", "aria-label", "title"]) {
          const v = n.getAttribute(a);
          if (v && v.trim()) attrs.push(`${n.tagName.toLowerCase()}#${n.id || ""}.${(n.className || "").toString().split(" ")[0]}|${a}=${norm(v)}`);
        }
      });
      out.views[k] = { text: norm(el.innerText), attrs: attrs.sort() };
    }
    names.forEach((k, i) => { VIEWS[k].hidden = was[i]; });   // 원래대로
    out.dialogs = (window.__dialogs || []).slice(0, 30);
    return out;
  });
}

function diff(base, cur) {
  const bad = [];
  if (base.title !== cur.title) bad.push(`document.title: "${base.title}" → "${cur.title}"`);
  if (base.lang !== cur.lang) bad.push(`html lang: "${base.lang}" → "${cur.lang}"`);
  const keys = [...new Set([...Object.keys(base.views), ...Object.keys(cur.views)])];
  for (const k of keys) {
    const b = base.views[k], c = cur.views[k];
    if (!b) { bad.push(`화면 추가됨: ${k}`); continue; }
    if (!c) { bad.push(`화면 없어짐: ${k}`); continue; }
    if (b.text !== c.text) {
      let i = 0;
      while (i < b.text.length && b.text[i] === c.text[i]) i++;
      bad.push(`[${k}] 글자 다름 (${i}자째부터)\n      기준: …${b.text.slice(Math.max(0, i - 30), i + 60)}\n      지금: …${c.text.slice(Math.max(0, i - 30), i + 60)}`);
    }
    const ba = b.attrs.join("\n"), ca = c.attrs.join("\n");
    if (ba !== ca) {
      const gone = b.attrs.filter((x) => !c.attrs.includes(x));
      const add = c.attrs.filter((x) => !b.attrs.includes(x));
      bad.push(`[${k}] 속성 다름 — 없어짐 ${gone.length}건 ${gone.slice(0, 2).join(" / ")} · 생김 ${add.length}건 ${add.slice(0, 2).join(" / ")}`);
    }
  }
  const bd = (base.dialogs || []).join("\n"), cd = (cur.dialogs || []).join("\n");
  if (bd !== cd) bad.push(`alert/confirm 문구 다름:\n      기준: ${bd || "(없음)"}\n      지금: ${cd || "(없음)"}`);
  return bad;
}

(async () => {
  if (!SAVE && !fs.existsSync(SNAP)) {
    console.error("기준 스냅샷이 없습니다 — 먼저 `node tools/i18n_snapshot.js --save` 를 돌리세요.");
    process.exit(1);
  }
  const fixtures = !SAVE && fs.existsSync(FIX) ? JSON.parse(fs.readFileSync(FIX, "utf-8")) : {};
  const recorded = {};
  const missed = new Set();

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(initScript, {
    frozen: FROZEN,
    consent: JSON.stringify({ v: "1.0", at: "2026-08-01T00:00:00.000Z", age14: true, tos: true }),
  });

  /* 바깥 요청 기록·재생 — 같은 출처(우리 파일)는 그대로 통과시킨다 */
  await ctx.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(BASE)) return route.continue();
    /* 바깥 '그림'은 아예 안 받는다. 우리가 보는 건 글자인데, 사진은 수십 장이 동시에
       날아와 느리고 개수도 매번 달라서 게이트를 흔든다(첫 시험에서 숙박 화면이 이것 때문에
       실행마다 달라졌다). 막는 것도 양쪽 실행에 똑같이 적용되므로 비교는 공정하다. */
    if (route.request().resourceType() === "image") return route.abort();
    const k = keyOf(url);
    if (SAVE) {
      try {
        const res = await route.fetch({ timeout: 15000 });
        const body = await res.text();
        recorded[k] = { status: res.status(), ct: res.headers()["content-type"] || "application/json", body: body.slice(0, 200000) };
        return route.fulfill({ status: res.status(), contentType: recorded[k].ct, body });
      } catch (_) {
        recorded[k] = { status: 599, ct: "application/json", body: "" };
        return route.abort();
      }
    }
    const f = fixtures[k];
    if (!f) { missed.add(k); return route.abort(); }
    if (f.status === 599) return route.abort();
    return route.fulfill({ status: f.status, contentType: f.ct, body: f.body });
  });

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("JS: " + e.message));
  const inflight = { n: 0 };
  page.on("request", () => { inflight.n++; });
  page.on("requestfinished", () => { inflight.n--; });
  page.on("requestfailed", () => { inflight.n--; });

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await settle(page, inflight);
  const opened = await walk(page, inflight);
  const settled = await settle(page, inflight);
  const snap = await snapshot(page);
  if (!settled) console.log("  ※ 요청이 계속 이어져 대기를 끊었습니다 — 결과가 흔들릴 수 있습니다");

  if (SAVE) {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(SNAP, JSON.stringify(snap, null, 1), "utf-8");
    fs.writeFileSync(FIX, JSON.stringify(recorded, null, 1), "utf-8");
    const n = Object.keys(snap.views).length;
    console.log(`기준 스냅샷 저장: 화면 ${n}개 · 바깥 응답 ${Object.keys(recorded).length}건`);
    console.log("연 화면:", opened.join(", "));
    if (errors.length) console.log("⚠️ 페이지 오류:", errors.slice(0, 3).join(" | "));
    console.log("→", SNAP);
  } else {
    const base = JSON.parse(fs.readFileSync(SNAP, "utf-8"));
    const bad = diff(base, snap);
    if (missed.size) console.log(`  ※ 픽스처에 없던 바깥 요청 ${missed.size}건(차단함): ${[...missed].slice(0, 2).join(", ")}`);
    if (errors.length) console.log("  ※ 페이지 오류:", errors.slice(0, 3).join(" | "));
    if (bad.length) {
      console.log(`✖ 한국어 화면이 달라졌습니다 ${bad.length}건`);
      bad.slice(0, 12).forEach((s) => console.log("   -", s));
      if (bad.length > 12) console.log(`   … 외 ${bad.length - 12}건`);
      console.log("  문구를 옮기다 바뀐 것이면 되돌리세요.");
      console.log("  의도한 화면 변경이면 `node tools/i18n_snapshot.js --save` 로 기준을 새로 뜨세요.");
      await browser.close();
      process.exit(1);
    }
    console.log(`한국어 화면 스냅샷 동일 — 화면 ${Object.keys(snap.views).length}개, 문구·속성·타이틀 전부 그대로`);
  }
  await browser.close();
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
