/* =====================================================================
 * verify_pwa.mjs — Ri_Stock PWA 실기기 렌더 검증 (헤드리스 크로미움 375×812)
 *
 * ■ 왜 필요한가
 *   `버튼.click()` 으로만 테스트하면 **다른 요소가 버튼을 덮고 있어도 통과**합니다.
 *   그래서 CLAUDE.md 3-1 규칙대로 `document.elementFromPoint` 로 실제 터치 지점을 확인하고,
 *   버튼이 화면 밖으로 밀려나지 않았는지(`r.bottom <= innerHeight`)도 같이 봅니다.
 *
 * ■ 실행 방법
 *     python3 -m http.server 8791 --bind 127.0.0.1     # 저장소 최상단에서
 *     node ristock/tests/verify_pwa.mjs
 *
 *   다른 주소를 보려면:  BASE=http://호스트/경로/ristock/index.html node ...
 *   스크린샷 위치:       SHOTS=/원하는/폴더 node ...   (스크린샷은 커밋하지 마세요)
 *
 * ■ 준비물
 *     npm i -g playwright && playwright install chromium
 *     (전역 설치본을 쓰면 PLAYWRIGHT=/usr/lib/node_modules/playwright/index.js 로 지정)
 *
 * 종료코드 0 = 전부 통과. 하나라도 실패하면 1.
 * ===================================================================== */

/* Ri_Stock PWA 실기기 검증 — 헤드리스 크로미움 375x812
 * CLAUDE.md 3-1: 버튼은 .click() 이 아니라 document.elementFromPoint 로 실제 터치 지점을 확인한다. */
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

/**
 * 이 파일 기준 경로 → **실제 파일시스템 경로**.
 *
 * `new URL(…, import.meta.url).pathname` 을 그대로 쓰면 윈도우에서 깨집니다.
 * 앞에 슬래시가 붙고(`/C:/…`) 한글 폴더가 퍼센트 인코딩(`%EB%94%94…`)으로 남아
 * `C:\C:\Users\%EB%94%94…` 같은 경로가 만들어집니다(2026-07-28 집 PC 에서 확인).
 * 리눅스에서는 우연히 같은 값이라 그동안 드러나지 않았습니다.
 */
const 여기부터 = (상대) => fileURLToPath(new URL(상대, import.meta.url));

// 프로젝트에 playwright 가 설치돼 있으면 그것을, 없으면 전역 설치본을 씁니다.
const require_ = createRequire(import.meta.url);
const 후보 = [process.env.PLAYWRIGHT, 'playwright',
  '/opt/node22/lib/node_modules/playwright/index.js',
  '/usr/lib/node_modules/playwright/index.js'].filter(Boolean);
let chromium = null;
for (const c of 후보) {
  try { chromium = require_(c).chromium; break; } catch (e) { /* 다음 후보 */ }
}
if (!chromium) {
  console.error('playwright 를 찾지 못했습니다.  npm i -g playwright && playwright install chromium');
  process.exit(2);
}

const 기준주소 = process.env.BASE || 'http://127.0.0.1:8791/ristock/index.html';
const 샷폴더 = process.env.SHOTS || '/tmp/ristock_shots';   // 저장소에 커밋하지 않습니다
fs.mkdirSync(샷폴더, { recursive: true });

const 콘솔오류 = [], 페이지오류 = [], 요청실패 = [];
const 결과 = { 탭: {}, 터치: [], 흐름: [] };
let 실패 = 0;

function 확인(이름, 조건, 상세) {
  결과.흐름.push({ 이름, 통과: !!조건, 상세: 상세 ?? '' });
  if (!조건) 실패++;
  console.log(`${조건 ? 'PASS' : 'FAIL'}  ${이름}${상세 ? '  — ' + 상세 : ''}`);
}

const 터치검사코드 = `([sel, idx]) => {
  const els = document.querySelectorAll(sel);
  const el = els[idx || 0];
  if (!el) return { 있음: false };
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const hit = document.elementFromPoint(cx, cy);
  return {
    있음: true,
    라벨: (el.textContent || '').trim().slice(0, 24),
    진짜눌림: !!hit && (hit === el || el.contains(hit)),
    가린놈: hit ? (hit.tagName + '.' + (hit.className || '')).slice(0, 60) : 'null',
    화면안: r.bottom <= innerHeight && r.top >= 0 && r.left >= 0 && r.right <= innerWidth,
    rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) },
    뷰포트: { w: innerWidth, h: innerHeight }
  };
}`;

async function 터치(page, 이름, sel, idx = 0) {
  const r = await page.evaluate(eval(터치검사코드), [sel, idx]);
  결과.터치.push({ 이름, sel, ...r });
  const ok = r.있음 && r.진짜눌림 && r.화면안;
  if (!ok) 실패++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  [터치] ${이름} (${sel})  ` +
    (r.있음 ? `눌림=${r.진짜눌림} 화면안=${r.화면안} rect=${JSON.stringify(r.rect)} hit=${r.가린놈}` : '요소없음'));
  return ok;
}

async function 화면통계(page) {
  return page.evaluate(() => {
    const v = document.querySelector('.view:not([hidden])');
    if (!v) return { 텍스트노드: 0, 글자수: 0, 카드: 0, 버튼: 0 };
    const w = document.createTreeWalker(v, NodeFilter.SHOW_TEXT);
    let n = 0, 글자 = 0, node;
    while ((node = w.nextNode())) {
      const t = node.nodeValue.trim();
      if (t) { n++; 글자 += t.length; }
    }
    return {
      텍스트노드: n, 글자수: 글자,
      카드: v.querySelectorAll('.card, .stock-card, .strategy-card, .stock-row, .empty').length,
      버튼: v.querySelectorAll('button').length,
      가로밀림: document.documentElement.scrollWidth > innerWidth + 1
    };
  });
}

const 브라우저 = await chromium.launch();
const 컨텍스트 = await 브라우저.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ko-KR',
  acceptDownloads: true
});
const page = await 컨텍스트.newPage();

page.on('console', (m) => { if (m.type() === 'error') 콘솔오류.push(m.text()); });
page.on('pageerror', (e) => 페이지오류.push(String(e && e.message || e)));
page.on('requestfailed', (r) => 요청실패.push(r.url() + ' :: ' + (r.failure()?.errorText || '')));

await page.goto(기준주소, { waitUntil: 'networkidle' });
await page.waitForSelector('#view-brief .card', { timeout: 15000 });

/* ─────────────────────────── 1. 브리핑 ─────────────────────────── */
console.log('\n=== ① 브리핑 ===');
결과.탭.brief = await 화면통계(page);
console.log(JSON.stringify(결과.탭.brief));
확인('브리핑 텍스트 렌더', 결과.탭.brief.텍스트노드 >= 40, `텍스트노드 ${결과.탭.brief.텍스트노드}개 / ${결과.탭.brief.글자수}자`);
확인('브리핑 카드 렌더', 결과.탭.brief.카드 >= 4, `카드 ${결과.탭.brief.카드}개`);
확인('가로 스크롤 없음(브리핑)', !결과.탭.brief.가로밀림);
/* 신선도 배너는 **데이터가 오래됐을 때만** 떠야 합니다.
 * 예전에는 '항상 뜬다'로 못박아 두었는데, 그때 저장소에 커밋돼 있던 데이터가
 * 마침 11일 지난 것이었기 때문입니다. 자동 수집이 제대로 도는 날에는 오늘 데이터라
 * 배너가 없는 것이 정상인데도 이 검사만 빨갛게 떴습니다(2026-07-28 확인).
 * 그래서 manifest 의 기준일을 읽어 **있어야 할 때 있는지**를 봅니다(기준은 js/data.js 신선도: 7일). */
const 배너기준일 = (() => {
  try {
    return String(JSON.parse(fs.readFileSync(여기부터('../data/') + 'manifest.json', 'utf8')).기준일 || '');
  } catch { return ''; }
})();
const 배너경과일 = (() => {
  if (!/^\d{8}$/.test(배너기준일)) return null;
  const 그날 = new Date(+배너기준일.slice(0, 4), +배너기준일.slice(4, 6) - 1, +배너기준일.slice(6, 8));
  const 오늘 = new Date(); 오늘.setHours(0, 0, 0, 0);
  return Math.round((오늘 - 그날) / 86400000);
})();
확인(`신선도 경고 배너는 오래된 데이터일 때만 (기준일 ${배너기준일 || '?'} · ${배너경과일 ?? '?'}일 전)`,
  (await page.locator('#view-brief .banner-danger').count() > 0) === (배너경과일 !== null && 배너경과일 >= 7));
확인('투자권유 아님 고지 고정 노출',
  await page.locator('.app-footer .disclaimer').isVisible());

await 터치(page, '탭바-브리핑', '#tabbar button', 0);
await 터치(page, '섹터 펼치기 1위', '.sector-btn', 0);

const 뉴스전 = await page.locator('#view-brief .sector-news li').count();
await page.locator('.sector-btn').first().click();
await page.waitForTimeout(200);
const 뉴스후 = await page.locator('#view-brief .sector-news li').count();
확인('섹터 대표뉴스 펼치기 동작', 뉴스후 > 뉴스전, `${뉴스전} → ${뉴스후}줄`);
확인('어제 대비 변화 카드 존재',
  (await page.locator('#view-brief .card').allInnerTexts()).some((t) => t.includes('어제 대비 변화')));
await page.screenshot({ path: `${샷폴더}/01_브리핑.png`, fullPage: true });

/* ─────────────────────────── 2. 전략 ─────────────────────────── */
console.log('\n=== ② 전략 ===');
await 터치(page, '탭바-전략', '#tabbar button', 1);
await page.locator('#tabbar button').nth(1).click();
await page.waitForSelector('#view-strategy .strategy-card');
결과.탭.strategy = await 화면통계(page);
console.log(JSON.stringify(결과.탭.strategy));
const 전략수 = await page.locator('.strategy-card').count();
확인('전략 8종 카드', 전략수 === 8, `${전략수}개`);
확인('전략 목록 텍스트 렌더', 결과.탭.strategy.텍스트노드 >= 40, `텍스트노드 ${결과.탭.strategy.텍스트노드}개`);
await 터치(page, '전략 카드 1번', '.strategy-card', 0);
await 터치(page, '전략 카드 8번', '.strategy-card', 7);
await page.screenshot({ path: `${샷폴더}/02_전략목록.png`, fullPage: true });

await page.locator('.strategy-card').first().click();
await page.waitForSelector('#view-strategy .seg button');
await page.waitForTimeout(150);
const 상세 = await 화면통계(page);
결과.탭.strategy상세 = 상세;
console.log('전략 상세 ' + JSON.stringify(상세));
const 종목카드수 = await page.locator('#view-strategy .stock-card').count();
확인('전략 상세 종목카드 렌더', 종목카드수 >= 5, `${종목카드수}개`);
const 막대수 = await page.locator('#view-strategy .stock-card').first().locator('.bar').count();
확인('점수 막대 13항목', 막대수 === 13, `${막대수}개`);
확인('블록 최대 3개', (await page.locator('#view-strategy .block-head').count()) <= 3,
  `${await page.locator('#view-strategy .block-head').count()}블록`);
await 터치(page, '시장 세그(한국)', '#view-strategy .seg button', 0);
await 터치(page, '시장 세그(미국)', '#view-strategy .seg button', 1);
await 터치(page, '관심 별표(전략카드)', '#view-strategy .fav-btn', 0);
await 터치(page, '자세히 보기 버튼', '#view-strategy [data-act="상세"]', 0);
await 터치(page, 'CSV 내려받기 버튼', '#view-strategy [data-act="전략CSV"]', 0);
await page.screenshot({ path: `${샷폴더}/03_전략상세.png`, fullPage: true });

// 미국 탭 전환
await page.locator('#view-strategy .seg button').nth(1).click();
await page.waitForTimeout(200);
const 미국카드 = await page.locator('#view-strategy .stock-card').count();
const 미국비었나 = await page.locator('#view-strategy .empty').count();
확인('미국 시장 전환 렌더', 미국카드 > 0 || 미국비었나 > 0, `카드 ${미국카드}개 / 안내 ${미국비었나}개`);
await page.locator('#view-strategy .seg button').nth(0).click();
await page.waitForTimeout(150);

// 관심 별표 토글
const 별표 = page.locator('#view-strategy .fav-btn').first();
const 전 = await 별표.getAttribute('aria-pressed');
await 별표.click();
await page.waitForTimeout(120);
확인('관심종목 별표 토글', (await 별표.getAttribute('aria-pressed')) !== 전,
  `${전} → ${await 별표.getAttribute('aria-pressed')}`);

// 상세 시트
await page.locator('#view-strategy [data-act="상세"]').first().click();
await page.waitForSelector('#sheet-back:not([hidden])');
await page.waitForTimeout(200);
const 시트글자 = (await page.locator('#sheet').innerText()).length;
확인('종목 상세 시트 내용', 시트글자 > 200, `${시트글자}자`);
await 터치(page, '시트 닫기 버튼', '#sheet [data-act="시트닫기"]', 0);
await page.screenshot({ path: `${샷폴더}/04_종목상세시트.png`, fullPage: false });
await page.locator('#sheet [data-act="시트닫기"]').click();
await page.waitForTimeout(200);
확인('시트 닫힘', await page.locator('#sheet-back').isHidden());

// CSV 내려받기
const [다운] = await Promise.all([
  page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
  page.locator('#view-strategy [data-act="전략CSV"]').click()
]);
확인('전략 CSV 내려받기', !!다운, 다운 ? 다운.suggestedFilename() : '다운로드 이벤트 없음');
if (다운) {
  const p = `${샷폴더}/${다운.suggestedFilename()}`;
  await 다운.saveAs(p);
  const buf = fs.readFileSync(p);
  확인('CSV UTF-8 BOM', buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf,
    `앞 3바이트 ${[...buf.slice(0, 3)].map((b) => b.toString(16)).join(' ')}`);
}

/* ─────────────────────────── 3. 종목 ─────────────────────────── */
console.log('\n=== ③ 종목 ===');
await 터치(page, '탭바-종목', '#tabbar button', 2);
await page.locator('#tabbar button').nth(2).click();
await page.waitForSelector('#view-stocks .stock-row');
결과.탭.stocks = await 화면통계(page);
console.log(JSON.stringify(결과.탭.stocks));
/* 목록은 50행씩 끊어 그립니다(구형 폰 대응 — app.js `표시단위` 주석 참고).
   그래서 "처음에 몇 행이 그려졌나"가 아니라 **"더 보기로 300개를 다 볼 수 있나"** 를 봅니다. */
const 첫행수 = await page.locator('#view-stocks .stock-row').count();
확인('종목 첫 화면은 50행만 렌더(구형 폰 대응)', 첫행수 === 50, `${첫행수}행`);
확인('종목 개수 표시는 300종목', (await page.locator('#stock-count').innerText()).includes('300종목'),
  await page.locator('#stock-count').innerText());
async function 끝까지펼치기(pg = page) {
  let 누른횟수 = 0;
  while (await pg.locator('#view-stocks [data-act="더보기"]').count()) {
    await pg.locator('#view-stocks [data-act="더보기"]').click();
    await pg.waitForTimeout(120);
    if (++누른횟수 > 12) break;      // 무한 루프 방지
  }
  return 누른횟수;
}
await 터치(page, '더 보기 버튼', '#view-stocks [data-act="더보기"]', 0);
const 누름 = await 끝까지펼치기();
const 행수 = await page.locator('#view-stocks .stock-row').count();
확인('더 보기로 300종목 전부 도달', 행수 === 300, `${누름}번 눌러 ${행수}행`);
확인('전부 펼치면 더 보기 버튼이 사라짐',
  (await page.locator('#view-stocks [data-act="더보기"]').count()) === 0);
결과.탭.stocks전체 = await 화면통계(page);
확인('종목 화면 텍스트 렌더(전부 펼친 뒤)', 결과.탭.stocks전체.텍스트노드 >= 300,
  `텍스트노드 ${결과.탭.stocks전체.텍스트노드}개`);
// 검색을 건드리면 다시 처음부터 (300행을 들고 다니면 한 글자마다 그걸 다시 그립니다)
await page.fill('#stock-search', '삼');
await page.waitForTimeout(250);
await page.fill('#stock-search', '');
await page.waitForTimeout(250);
확인('검색을 지우면 다시 50행부터',
  (await page.locator('#view-stocks .stock-row').count()) === 50,
  `${await page.locator('#view-stocks .stock-row').count()}행`);
확인('가로 스크롤 없음(종목)', !결과.탭.stocks.가로밀림);
await 터치(page, '검색창', '#stock-search', 0);
await 터치(page, '종목 행 1번', '#view-stocks .stock-row', 0);
await 터치(page, '관심종목만 버튼', '#view-stocks [data-act="관심만"]', 0);

await page.fill('#stock-search', '삼성');
await page.waitForTimeout(250);
const 검색행 = await page.locator('#view-stocks .stock-row').count();
확인('검색 동작(삼성)', 검색행 > 0 && 검색행 < 300, `${검색행}행`);
await page.fill('#stock-search', '005930');
await page.waitForTimeout(250);
확인('티커 검색 동작(005930)', (await page.locator('#view-stocks .stock-row').count()) === 1,
  `${await page.locator('#view-stocks .stock-row').count()}행`);
await page.fill('#stock-search', '');
await page.waitForTimeout(200);

await page.selectOption('#stock-sector', { index: 1 });
await page.waitForTimeout(200);
const 섹터행 = await page.locator('#view-stocks .stock-row').count();
확인('섹터 필터 동작', 섹터행 > 0 && 섹터행 < 300, `${섹터행}행`);
await page.selectOption('#stock-sector', '');
await page.selectOption('#stock-sort', '총점');
await page.waitForTimeout(200);
const 첫총점 = await page.locator('#view-stocks .stock-row .tot').first().innerText();
확인('총점 정렬 동작', parseFloat(첫총점) > 50, `1위 ${첫총점}`);
await page.selectOption('#stock-sort', '시총순위');
await page.waitForTimeout(200);

await page.locator('#view-stocks .stock-row').first().click();
await page.waitForSelector('#sheet-back:not([hidden])');
await page.waitForTimeout(200);
const 시트2 = (await page.locator('#sheet').innerText());
확인('종목 상세 시트(종목탭)', 시트2.length > 200 && 시트2.includes('주요 지표'), `${시트2.length}자`);
await 터치(page, '시트 관심 별표', '#sheet .fav-btn', 0);
await page.screenshot({ path: `${샷폴더}/05_종목상세.png`, fullPage: false });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
확인('ESC 로 시트 닫힘', await page.locator('#sheet-back').isHidden());
await page.screenshot({ path: `${샷폴더}/06_종목.png`, fullPage: false });

/* ─────────────────────────── 4. 내 전략 ─────────────────────────── */
console.log('\n=== ④ 내 전략 ===');
await 터치(page, '탭바-내전략', '#tabbar button', 3);
await page.locator('#tabbar button').nth(3).click();
await page.waitForSelector('#view-my .toggle-row');
await page.waitForTimeout(200);
결과.탭.my = await 화면통계(page);
console.log(JSON.stringify(결과.탭.my));
const 토글수 = await page.locator('#view-my .toggle-row').count();
확인('필터 토글 8개', 토글수 === 8, `${토글수}개`);
확인('내 전략 텍스트 렌더', 결과.탭.my.텍스트노드 >= 40, `텍스트노드 ${결과.탭.my.텍스트노드}개`);
await 터치(page, '필터 토글 1번', '#view-my .toggle-row', 0);
await 터치(page, '필터 토글 8번', '#view-my .toggle-row', 7);
await 터치(page, '순위기준 select', '#my-rank', 0);
await 터치(page, '전략 이름 입력', '#my-name', 0);
await 터치(page, '저장 버튼', '#view-my [data-act="내전략저장"]', 0);

const 전결과 = await page.locator('#view-my .stock-card').count();
await page.locator('#view-my .toggle-row').nth(4).click();   // 미네르비니만 켜기
await page.waitForTimeout(300);
const 후결과 = await page.locator('#view-my .stock-card').count();
확인('필터 토글 → 즉시 재계산', 후결과 !== 전결과 || 후결과 >= 0, `${전결과} → ${후결과}종목`);
확인('필터 토글 상태 반영',
  (await page.locator('#view-my .toggle-row').nth(4).getAttribute('aria-pressed')) === 'true');

await page.selectOption('#my-rank', '마법공식');
await page.waitForTimeout(300);
확인('순위기준 변경 재계산', (await page.locator('#view-my .stock-card, #view-my .empty').count()) > 0);
await page.selectOption('#my-rank', '총점');
await page.locator('#view-my .toggle-row').nth(4).click();
await page.waitForTimeout(250);

await page.fill('#my-name', '테스트 저장 전략');
await page.locator('#view-my [data-act="내전략저장"]').click();
await page.waitForTimeout(350);
확인('내 전략 저장', (await page.locator('#view-my .saved-item').count()) === 1,
  `${await page.locator('#view-my .saved-item').count()}건`);
await 터치(page, '저장목록 불러오기', '#view-my [data-act="내전략불러오기"]', 0);
await 터치(page, '저장목록 삭제', '#view-my [data-act="내전략삭제"]', 0);
await page.screenshot({ path: `${샷폴더}/07_내전략.png`, fullPage: true });
await page.locator('#view-my [data-act="내전략삭제"]').click();
await page.waitForTimeout(300);
확인('내 전략 삭제', (await page.locator('#view-my .saved-item').count()) === 0);
await 터치(page, '내전략 CSV 버튼', '#view-my [data-act="내전략CSV"]', 0);

/* ────────────── 2-2. 전략 8종 × 시장 2개 전수 렌더 ──────────────
   조건이 까다로운 전략은 결과가 0종목인 날이 있습니다. 그때도 **빈 화면이 아니라 안내**여야 합니다. */
console.log('\n=== ②-2 전략 8종 전수 ===');
/** 전략 탭의 첫 화면(목록)으로 확실히 돌아간다 — 상세를 보던 중이면 목록 버튼을 한 번 더 누른다 */
async function 전략목록으로() {
  await page.locator('#tabbar button').nth(1).click();
  await page.waitForTimeout(150);
  if (await page.locator('#view-strategy [data-act="전략목록"]').count()) {
    await page.locator('#view-strategy [data-act="전략목록"]').click();
  }
  await page.waitForSelector('.strategy-card');
}
await 전략목록으로();
const 전략이름들 = await page.locator('.strategy-card .st-name').allInnerTexts();
확인('전략 8종 이름 수집', 전략이름들.length === 8, `${전략이름들.length}종`);
for (let i = 0; i < 전략이름들.length; i++) {
  await 전략목록으로();
  await page.locator('.strategy-card').nth(i).click();
  await page.waitForSelector('#view-strategy .seg button');
  for (const [m, 시장] of [[0, '한국'], [1, '미국']]) {
    await page.locator('#view-strategy .seg button').nth(m).click();
    await page.waitForTimeout(150);
    const n = await page.locator('#view-strategy .stock-card').count();
    const e = await page.locator('#view-strategy .empty').count();
    확인(`전략 「${전략이름들[i]}」 ${시장} 렌더`, n > 0 || e > 0, n > 0 ? `${n}종목` : '결과없음 안내');
  }
}
await 전략목록으로();
await page.locator('.strategy-card').first().click();
await page.waitForSelector('#view-strategy .stock-card');

/* ────────────── 3-2. 미평가 종목 상세 (점수가 없는 종목) ────────────── */
console.log('\n=== ③-2 미평가 종목 ===');
await page.locator('#tabbar button').nth(2).click();
await page.waitForSelector('#view-stocks .stock-row');
await page.waitForTimeout(200);
const 미평가행 = page.locator('#view-stocks .stock-row').filter({ hasText: '미평가' }).first();
확인('미평가 종목이 목록에 존재', (await 미평가행.count()) > 0);
await 미평가행.click();
await page.waitForSelector('#sheet-back:not([hidden])');
await page.waitForTimeout(250);
const 미평가시트 = await page.locator('#sheet').innerText();
확인('미평가 종목 상세도 안내와 함께 렌더',
  미평가시트.includes('점수가 없는 종목') && 미평가시트.includes('주요 지표'),
  `${미평가시트.length}자`);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

/* ────────────── 4-2. 스크롤 회귀 검사 ──────────────
   body 에 height:100% + overflow-x:hidden 를 걸면 body 가 스크롤 컨테이너가 되어
   window.scrollTo(0,0) 이 죽습니다. 탭을 바꿔도 이전 위치에 그대로 남는 버그였습니다. */
console.log('\n=== ④-2 스크롤 ===');
const 스크롤 = await page.evaluate(() => ({
  문서스크롤: document.documentElement.scrollHeight > document.documentElement.clientHeight,
  body오버플로: getComputedStyle(document.body).overflowY
}));
확인('문서(window)가 스크롤 주체', 스크롤.문서스크롤 && 스크롤.body오버플로 === 'visible',
  JSON.stringify(스크롤));
await page.evaluate(() => window.scrollTo(0, 900));
await page.waitForTimeout(200);
const 내림 = await page.evaluate(() => window.scrollY);
확인('window.scrollTo 동작', 내림 > 500, `scrollY=${내림}`);
await page.locator('#tabbar button').nth(0).click();
await page.waitForTimeout(300);
확인('탭 전환 시 맨 위로 복귀', (await page.evaluate(() => window.scrollY)) === 0,
  `scrollY=${await page.evaluate(() => window.scrollY)}`);

/* ────────────── 4-3. 하단 고정 푸터가 마지막 내용을 가리지 않는가 ──────────────
   --footer-h 가 실제 푸터보다 작으면 각 화면 맨 아래 버튼이 탭바에 깔립니다. */
console.log('\n=== ④-3 하단 여백 ===');
const 푸터 = await page.evaluate(() => {
  const f = document.querySelector('.app-footer').getBoundingClientRect();
  const 선언 = getComputedStyle(document.documentElement).getPropertyValue('--footer-h').trim();
  return { 실제높이: Math.round(f.height), 선언값: 선언, top: Math.round(f.top) };
});
확인('--footer-h 가 실제 푸터를 덮음', parseFloat(푸터.선언값) >= 푸터.실제높이,
  `선언 ${푸터.선언값} / 실제 ${푸터.실제높이}px`);

for (const [이름, i] of [['브리핑', 0], ['전략', 1], ['종목', 2], ['내전략', 3]]) {
  await page.locator('#tabbar button').nth(i).click();
  await page.waitForTimeout(350);
  const 끝 = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    return new Promise((r) => setTimeout(() => {
      const v = document.querySelector('.view:not([hidden])');
      const 마지막 = v.lastElementChild.getBoundingClientRect();
      const f = document.querySelector('.app-footer').getBoundingClientRect();
      r({ 마지막bottom: Math.round(마지막.bottom), 푸터top: Math.round(f.top), 가림: 마지막.bottom > f.top });
    }, 250));
  });
  확인(`${이름} 화면 맨 아래 내용이 탭바에 안 가림`, !끝.가림, JSON.stringify(끝));
  await page.evaluate(() => window.scrollTo(0, 0));
}
await page.locator('#tabbar button').nth(0).click();
await page.waitForTimeout(250);

/* ────────────── 5. 데이터 없음(404) 처리 ────────────── */
console.log('\n=== ⑤ 데이터 없음 처리 ===');
// 서비스워커가 캐시로 대신 응답하면 404 상황을 못 만듭니다 → SW 를 막은 새 컨텍스트로 검사
const 컨텍스트2 = await 브라우저.newContext({
  viewport: { width: 375, height: 812 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true, locale: 'ko-KR', serviceWorkers: 'block'
});
const page2 = await 컨텍스트2.newPage();
const 콘솔2 = [];
page2.on('console', (m) => { if (m.type() === 'error') 콘솔2.push(m.text()); });
page2.on('pageerror', (e) => 페이지오류.push('[404화면] ' + String(e && e.message || e)));
await page2.route('**/data/**', (route) => route.fulfill({ status: 404, body: 'not found' }));
await page2.goto(기준주소, { waitUntil: 'domcontentloaded' });
await page2.waitForSelector('#view-brief .empty', { timeout: 10000 });
const 안내 = await page2.locator('#view-brief .empty').innerText();
확인('manifest 404 → 안내 화면', 안내.includes('데이터'), 안내.replace(/\s+/g, ' ').slice(0, 70));
확인('404 화면에서도 탭 이동 가능', true);
for (let i = 1; i < 4; i++) {
  await page2.locator('#tabbar button').nth(i).click();
  await page2.waitForTimeout(120);
  const 보임 = await page2.locator('.view:not([hidden]) .empty').count();
  확인(`404 화면 탭${i + 1} 안내 노출`, 보임 > 0, `${보임}개`);
}
await page2.screenshot({ path: `${샷폴더}/08_데이터없음.png`, fullPage: false });
await page2.close();
await 컨텍스트2.close();

/* ────────────── 5-2. 부분 실패 (뉴스 수집만 실패) ──────────────
   설계서 4.1: 한쪽 수집이 실패해도 나머지는 살아 있어야 합니다. */
console.log('\n=== ⑤-2 뉴스(market.json)만 실패 ===');
const 컨텍스트4 = await 브라우저.newContext({
  viewport: { width: 375, height: 812 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true, locale: 'ko-KR', serviceWorkers: 'block'
});
const page4 = await 컨텍스트4.newPage();
page4.on('pageerror', (e) => 페이지오류.push('[부분실패] ' + String(e && e.message || e)));
await page4.route('**/data/market.json*', (route) => route.fulfill({ status: 500, body: 'boom' }));
await page4.goto(기준주소, { waitUntil: 'domcontentloaded' });
await page4.waitForSelector('#view-brief .card', { timeout: 10000 });
const 브리핑글 = await page4.locator('#view-brief').innerText();
확인('뉴스 실패 시 브리핑이 경고와 함께 뜸',
  브리핑글.includes('일부 데이터를 불러오지 못했습니다') && 브리핑글.includes('섹터 순위'),
  `${브리핑글.length}자`);
await page4.locator('#tabbar button').nth(1).click();
await page4.waitForSelector('.strategy-card');
await page4.locator('.strategy-card').first().click();
await page4.waitForTimeout(400);
const 전략글 = await page4.locator('#view-strategy').innerText();
확인('뉴스 실패 시 전략 화면이 사유를 설명함',
  전략글.includes('뉴스 수집이 실패했을 수 있습니다'), 전략글.slice(0, 60).replace(/\s+/g, ' '));
await page4.locator('#tabbar button').nth(2).click();
await page4.waitForSelector('#view-stocks .stock-row');
확인('뉴스 실패해도 종목 화면은 정상',
  (await page4.locator('#view-stocks .stock-row').count()) === 50 &&
  (await page4.locator('#stock-count').innerText()).includes('300종목'),
  await page4.locator('#stock-count').innerText());
await page4.screenshot({ path: `${샷폴더}/13_뉴스실패.png` });
await page4.close();
await 컨텍스트4.close();

/* ────────────── 6. changes.json 이 있을 때(전일 대비 편입/이탈) ────────────── */
console.log('\n=== ⑥ 전일 대비 변화 ===');
const 컨텍스트3 = await 브라우저.newContext({
  viewport: { width: 375, height: 812 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true, locale: 'ko-KR', serviceWorkers: 'block'
});
const page3 = await 컨텍스트3.newPage();
const 콘솔3 = [];
page3.on('console', (m) => { if (m.type() === 'error') 콘솔3.push(m.text()); });
page3.on('pageerror', (e) => 페이지오류.push('[변화화면] ' + String(e && e.message || e)));

const 데이터폴더 = 여기부터('../data/');
const 원본manifest = JSON.parse(fs.readFileSync(데이터폴더 + 'manifest.json', 'utf8'));
await page3.route('**/data/manifest.json*', (route) =>
  route.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ ...원본manifest, 이전기준일: '20260715' }) }));
await page3.route('**/data/changes.json*', (route) =>
  route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    기준일: '20260716', 이전기준일: '20260715',
    전략별: {
      total: { 한국: { 신규: [{ 티커: '005930', 기업명: '삼성전자', 섹터: '반도체' }], 이탈: [{ 티커: '000660', 기업명: 'SK하이닉스', 섹터: '반도체' }] } },
      magic: { 미국: { 신규: [{ 티커: 'AAPL', 기업명: 'Apple Inc.', 섹터: 'IT·기술' }], 이탈: [] } }
    } }) }));
await page3.goto(기준주소, { waitUntil: 'domcontentloaded' });
await page3.waitForSelector('#view-brief .chg-block', { timeout: 10000 });
const 변화글 = await page3.locator('#view-brief .card', { hasText: '어제 대비 변화' }).innerText();
확인('changes.json 신규 편입 표시', 변화글.includes('삼성전자') && 변화글.includes('신규'), 변화글.replace(/\s+/g, ' ').slice(0, 80));
확인('changes.json 이탈 표시', 변화글.includes('SK하이닉스') && 변화글.includes('이탈'));
확인('changes.json 전략 이름으로 표시', 변화글.includes('종합점수') || 변화글.includes('마법공식'));
확인('변화 화면 콘솔 에러 0건', 콘솔3.length === 0, `${콘솔3.length}건` + (콘솔3.length ? ' :: ' + 콘솔3.join(' | ') : ''));
await page3.screenshot({ path: `${샷폴더}/09_전일대비변화.png`, fullPage: false });
await page3.close();
await 컨텍스트3.close();

/* ────────────── ⑥-2. 엔진이 실제로 만든 changes.json ──────────────
   위 ⑥ 은 손으로 적은 두 줄짜리입니다. 화면 코드가 "우리가 상상한 모양"에만 맞고
   엔진이 진짜로 뱉는 파일에는 안 맞는 일이 흔해서, 여기서는 **엔진 산출물 그대로**를 씁니다.

   fixtures/ 의 두 파일은 지어낸 것이 아니라 사장님 원본 xlsx(7/15 · 7/16)를
   `engine/seed_from_xlsx.py` → `engine/pipeline.변화쓰기()` 에 통과시켜 나온 실제 산출물입니다.
   (manifest 도 `emit.write_manifest()` 가 쓴 것 — 변화파일·이전기준일 키가 실제로 이렇게 들어옵니다)  */
console.log('\n=== ⑥-2 엔진이 만든 진짜 changes.json ===');
const 컨텍스트5 = await 브라우저.newContext({
  viewport: { width: 375, height: 812 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true, locale: 'ko-KR', serviceWorkers: 'block'
});
const page5 = await 컨텍스트5.newPage();
const 콘솔5 = [];
page5.on('console', (m) => { if (m.type() === 'error') 콘솔5.push(m.text()); });
page5.on('pageerror', (e) => 페이지오류.push('[진짜변화] ' + String(e && e.message || e)));

const 픽스처 = 여기부터('./fixtures/');
const 진짜manifest = fs.readFileSync(픽스처 + 'manifest_변화있음.json', 'utf8');
const 진짜changes = fs.readFileSync(픽스처 + 'changes_real.json', 'utf8');
const 진짜 = JSON.parse(진짜changes);
확인('엔진 changes.json 규격 (설계서 2.5)',
  !!진짜.기준일 && !!진짜.이전기준일 && !!진짜.전략별 &&
  Object.values(진짜.전략별).every((v) => Object.values(v).every((x) => Array.isArray(x.신규) && Array.isArray(x.이탈))),
  `전략 ${Object.keys(진짜.전략별).length}종 · ${진짜.이전기준일} → ${진짜.기준일}`);
확인('엔진 manifest 에 변화파일·이전기준일',
  JSON.parse(진짜manifest).변화파일 === 'changes.json' && !!JSON.parse(진짜manifest).이전기준일,
  JSON.parse(진짜manifest).변화파일 + ' / ' + JSON.parse(진짜manifest).이전기준일);

// changes.json 은 **manifest 가 알려 줄 때만** 읽어야 합니다 — 실제로 요청이 나갔는지 셉니다
let 변화요청 = 0;
page5.on('request', (r) => { if (r.url().includes('changes.json')) 변화요청++; });
await page5.route('**/data/manifest.json*', (route) =>
  route.fulfill({ contentType: 'application/json', body: 진짜manifest }));
await page5.route('**/data/changes.json*', (route) =>
  route.fulfill({ contentType: 'application/json', body: 진짜changes }));
await page5.goto(기준주소, { waitUntil: 'domcontentloaded' });
await page5.waitForSelector('#view-brief .chg-block', { timeout: 10000 });
확인('manifest.변화파일 을 보고 changes.json 을 실제로 요청', 변화요청 > 0, `${변화요청}회`);

const 진짜글 = await page5.locator('#view-brief .card', { hasText: '어제 대비 변화' }).innerText();
const 블록수 = await page5.locator('#view-brief .chg-block').count();
확인('진짜 changes.json → 브리핑 변화 카드가 켜짐', 블록수 >= 4, `${블록수}블록`);
확인('진짜 changes.json 기간 표기', 진짜글.includes('2026.07.15') && 진짜글.includes('2026.07.16'),
  진짜글.split('\n')[0]);
// 파일 안에 실제로 들어 있는 종목명이 화면에 그대로 나와야 합니다
const 표본 = (진짜.전략별.total?.한국?.신규 || [])[0];
const 표본이탈 = (진짜.전략별.total?.한국?.이탈 || [])[0];
확인('진짜 신규 편입 종목명 노출', !!표본 && 진짜글.includes(표본.기업명), 표본 ? 표본.기업명 : '없음');
확인('진짜 이탈 종목명 노출', !!표본이탈 && 진짜글.includes(표본이탈.기업명), 표본이탈 ? 표본이탈.기업명 : '없음');
확인('전략 id 가 아니라 전략 이름으로 표시',
  진짜글.includes('종합점수') && !진짜글.includes('pullback'),
  진짜글.replace(/\s+/g, ' ').slice(0, 90));
확인('한국·미국 양쪽 표시', 진짜글.includes('한국 신규') && 진짜글.includes('미국 신규'));
const 진짜금지 = ['undefined', 'NaN', '[object Object]', '{{'].filter((w) => 진짜글.includes(w));
확인('진짜 변화 카드에 undefined·NaN 없음', 진짜금지.length === 0, 진짜금지.join(','));
확인('진짜 변화 화면 콘솔 에러 0건', 콘솔5.length === 0, 콘솔5.join(' | '));
await page5.screenshot({ path: `${샷폴더}/14_진짜변화.png`, fullPage: true });
await page5.close();
await 컨텍스트5.close();

/* ────────────── ⑦. 시장별 데이터 신선도 (설계서 2.1 시장.<시장>.기준일) ──────────────
   한국 수집만 네이버 차단으로 며칠 멈추고 미국은 매일 갱신되는 날이 실제로 옵니다.
   그때 최상단 기준일은 새것이라 전체 배너가 안 뜨므로, **그 시장 화면에만** 안내가 붙어야 합니다. */
console.log('\n=== ⑦ 시장별 신선도 ===');
async function 시장신선도화면(이름, manifest꾸미기) {
  const c = await 브라우저.newContext({
    viewport: { width: 375, height: 812 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, locale: 'ko-KR', serviceWorkers: 'block'
  });
  const pg = await c.newPage();
  pg.on('pageerror', (e) => 페이지오류.push(`[${이름}] ` + String(e && e.message || e)));
  const m = JSON.parse(fs.readFileSync(데이터폴더 + 'manifest.json', 'utf8'));
  await pg.route('**/data/manifest.json*', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(manifest꾸미기(m)) }));
  await pg.goto(기준주소, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#view-brief .card', { timeout: 10000 });
  return { c, pg };
}
const 오늘ymd = (() => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; })();
const 엿새전 = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; })();

// (가) 한국만 6일 멈춤 — 미국·최상단은 오늘
{
  const { c, pg } = await 시장신선도화면('한국만낡음', (m) => ({
    ...m, 기준일: 오늘ymd,
    시장: { 한국: { ...m.시장.한국, 기준일: 엿새전 }, 미국: { ...m.시장.미국, 기준일: 오늘ymd } }
  }));
  const 브리핑 = await pg.locator('#view-brief').innerText();
  확인('시장별신선도: 최상단이 오늘이면 전체 경고 배너는 없음',
    !브리핑.includes('일 전 데이터입니다'), 브리핑.slice(0, 70).replace(/\s+/g, ' '));

  await pg.locator('#tabbar button').nth(2).click();           // 종목 탭 (한국)
  await pg.waitForSelector('#view-stocks .stock-row');
  const 종목한국 = await pg.locator('#view-stocks').innerText();
  확인('시장별신선도: 종목 탭 한국에 안내', 종목한국.includes('한국 데이터는 6일 전 기준입니다'),
    종목한국.split('\n').find((l) => l.includes('기준입니다')) || 종목한국.slice(0, 60));
  await pg.locator('#view-stocks .seg button[data-market="미국"]').click();
  await pg.waitForTimeout(300);
  const 종목미국 = await pg.locator('#view-stocks').innerText();
  확인('시장별신선도: 미국으로 바꾸면 안내가 사라짐',
    !종목미국.includes('데이터는') || !종목미국.includes('기준입니다'),
    종목미국.split('\n').find((l) => l.includes('기준입니다')) || '없음');

  await pg.locator('#tabbar button').nth(1).click();           // 전략 탭
  await pg.waitForSelector('.strategy-card');
  await pg.locator('.strategy-card').first().click();
  await pg.waitForSelector('#view-strategy .seg button');
  const 전략한국 = await pg.locator('#view-strategy').innerText();
  확인('시장별신선도: 전략 탭 한국에 안내', 전략한국.includes('한국 데이터는 6일 전 기준입니다'));
  await pg.locator('#view-strategy .seg button[data-market="미국"]').click();
  await pg.waitForTimeout(300);
  const 전략미국 = await pg.locator('#view-strategy').innerText();
  확인('시장별신선도: 전략 탭 미국은 깨끗', !전략미국.includes('데이터는 6일 전 기준입니다'));
  // 배너가 버튼을 덮거나 화면 밖으로 밀지 않는가 (CLAUDE.md 3-1)
  await pg.locator('#view-strategy .seg button[data-market="한국"]').click();
  await pg.waitForTimeout(250);
  const 덮임 = await pg.evaluate(eval(터치검사코드), ['#view-strategy .seg button', 0]);
  확인('시장별신선도: 배너가 시장 세그를 덮지 않음', 덮임.있음 && 덮임.진짜눌림, 덮임.가린놈);
  await pg.screenshot({ path: `${샷폴더}/15_시장별신선도.png`, fullPage: true });
  await pg.close(); await c.close();
}

// (나) 구 데이터 호환 — 시장별 기준일이 아예 없으면 예전처럼 최상단 값만 쓴다
{
  const { c, pg } = await 시장신선도화면('구데이터', (m) => ({
    ...m, 기준일: 오늘ymd,
    시장: { 한국: { 파일: 'stocks_KR.json' }, 미국: { 파일: 'stocks_US.json' } }
  }));
  await pg.locator('#tabbar button').nth(2).click();
  await pg.waitForSelector('#view-stocks .stock-row');
  const 글 = await pg.locator('#view-stocks').innerText();
  확인('시장별신선도: 시장별 기준일이 없으면 아무 안내도 안 뜸(구 데이터 호환)',
    !글.includes('기준입니다'), 글.split('\n').find((l) => l.includes('기준입니다')) || '없음');
  확인('시장별신선도: 구 데이터에서도 종목 목록 정상',
    (await pg.locator('#view-stocks .stock-row').count()) > 0);
  await pg.close(); await c.close();
}

/* (다) **엔진이 실제로 뱉는 모양** — 최상단 기준일 = 시장별 중 가장 오래된 값
   위 (가)는 최상단에 '오늘'을 넣어 만든 손수 만든 manifest 라, 엔진 산출물과 다릅니다.
   `emit.대표기준일()` 은 최상단을 **min(시장별 기준일)** 로 씁니다. 그래서 "최상단보다
   오래됐는가"로 물으면 정의상 참이 될 수 없고, 한국이 6일 멈춰도 배너가 영영 안 붙었습니다
   (2026-07-27 엔드투엔드에서 실제 재현). 비교 상대는 '가장 최근에 갱신된 시장'이어야 합니다. */
{
  const { c, pg } = await 시장신선도화면('엔진산출모양', (m) => ({
    ...m, 기준일: 엿새전,                       // ← 엔진과 같이 min(한국,미국)
    시장: { 한국: { ...m.시장.한국, 기준일: 엿새전 }, 미국: { ...m.시장.미국, 기준일: 오늘ymd } }
  }));
  await pg.locator('#tabbar button').nth(2).click();
  await pg.waitForSelector('#view-stocks .stock-row');
  const 글한국 = await pg.locator('#view-stocks').innerText();
  확인('시장별신선도(엔진 모양): 최상단=가장 오래된 값이어도 한국에 안내가 뜬다',
    글한국.includes('한국 데이터는 6일 전 기준입니다'),
    글한국.split('\n').find((l) => l.includes('기준입니다')) || '없음');
  await pg.locator('#view-stocks .seg button[data-market="미국"]').click();
  await pg.waitForTimeout(300);
  const 글미국 = await pg.locator('#view-stocks').innerText();
  확인('시장별신선도(엔진 모양): 갱신된 미국에는 안 뜬다',
    !글미국.includes('기준입니다'),
    글미국.split('\n').find((l) => l.includes('기준입니다')) || '없음');
  await pg.close(); await c.close();
}

/* (라) 양쪽이 똑같이 낡은 날 — 전체 배너 하나면 충분하고, 시장별 배너는 겹쳐 뜨지 않는다 */
{
  const { c, pg } = await 시장신선도화면('양쪽같이낡음', (m) => ({
    ...m, 기준일: 엿새전,
    시장: { 한국: { ...m.시장.한국, 기준일: 엿새전 }, 미국: { ...m.시장.미국, 기준일: 엿새전 } }
  }));
  await pg.locator('#tabbar button').nth(2).click();
  await pg.waitForSelector('#view-stocks .stock-row');
  const 글 = await pg.locator('#view-stocks').innerText();
  확인('시장별신선도: 양쪽이 같이 낡으면 시장별 배너는 안 뜸(전체 배너만)',
    !글.includes('기준입니다'), 글.split('\n').find((l) => l.includes('기준입니다')) || '없음');
  await pg.close(); await c.close();
}

/* =====================================================================
 * 아이폰 앱 전환 (홈 화면에 추가) — 스플래시 · 설치 안내 · manifest
 *
 * 아이폰에는 설치 버튼도 `beforeinstallprompt` 도 없습니다.
 * "공유 → 홈 화면에 추가" 를 앱이 직접 알려 주지 않으면 사장님은 그 경로를 모릅니다.
 * 그런데 안내를 아무 때나 띄우면 성가시므로, **띄우지 않아야 할 때 안 뜨는지**도 같이 봅니다.
 * ===================================================================== */

const 저장소루트 = 여기부터('../../');   // …/Ri-weather/

/** PNG 앞머리 24바이트에서 실제 가로·세로를 읽습니다 (파일 이름만 믿지 않습니다) */
function png크기(경로) {
  const b = fs.readFileSync(경로).subarray(0, 24);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { 가로: b.readUInt32BE(16), 세로: b.readUInt32BE(20) };
}

/* (마) iOS 스플래시 — 파일이 실제로 있고 해상도가 선언과 맞는가.
   하나라도 어긋나면 그 기기에서는 앱 실행 순간 흰 화면이 그대로 보입니다. */
{
  const html = fs.readFileSync(저장소루트 + 'ristock/index.html', 'utf8');
  const 태그 = [...html.matchAll(/rel="apple-touch-startup-image"\s+href="([^"]+)"\s*\n?\s*media="([^"]+)"/g)];
  확인('스플래시: apple-touch-startup-image 태그가 있다', 태그.length >= 6, `${태그.length}개`);

  let 어긋남 = [], 총합 = 0;
  for (const [, href, media] of 태그) {
    const 경로 = 저장소루트 + 'ristock/' + href;
    if (!fs.existsSync(경로)) { 어긋남.push(`${href} 파일 없음`); continue; }
    총합 += fs.statSync(경로).size;
    const 실제 = png크기(경로);
    const 이름 = /splash-(\d+)x(\d+)\.png$/.exec(href);
    const 폭 = /device-width:\s*(\d+)px/.exec(media);
    const 높이 = /device-height:\s*(\d+)px/.exec(media);
    const 배율 = /device-pixel-ratio:\s*(\d+)/.exec(media);
    if (!실제 || !이름 || !폭 || !높이 || !배율) { 어긋남.push(`${href} 형식 이상`); continue; }
    // 파일 이름 ↔ 실제 PNG ↔ media 쿼리(논리크기×배율) 세 값이 전부 같아야 합니다
    if (실제.가로 !== +이름[1] || 실제.세로 !== +이름[2]) {
      어긋남.push(`${href} 실제 ${실제.가로}x${실제.세로}`);
    } else if (+폭[1] * +배율[1] !== 실제.가로 || +높이[1] * +배율[1] !== 실제.세로) {
      어긋남.push(`${href} media(${폭[1]}x${높이[1]}@${배율[1]}) 불일치`);
    }
  }
  확인('스플래시: 파일·해상도·media 쿼리가 전부 일치', 어긋남.length === 0,
    어긋남.length ? 어긋남.join(', ') : `${태그.length}장 모두 일치`);
  확인('스플래시: 합계 300KB 이하', 총합 <= 300 * 1024, `${Math.round(총합 / 1024)}KB`);

  // 아이폰이 흔히 쓰는 해상도가 빠지면 그 기기만 조용히 흰 화면이 됩니다
  const 있는것 = 태그.map(([, h]) => h);
  for (const 필수 of ['1125x2436', '1170x2532', '1290x2796']) {
    확인(`스플래시: ${필수} 포함`, 있는것.some((h) => h.includes(필수)), '');
  }
}

/* (바) manifest — 설치 요건과 maskable 아이콘 */
{
  const mf = JSON.parse(fs.readFileSync(저장소루트 + 'ristock/manifest.webmanifest', 'utf8'));
  확인('manifest: id 선언', typeof mf.id === 'string' && mf.id.length > 0, String(mf.id));
  확인('manifest: display=standalone', mf.display === 'standalone', String(mf.display));
  확인('manifest: name·short_name 있음', !!mf.name && !!mf.short_name, mf.short_name);
  const 아이콘들 = mf.icons || [];
  확인('manifest: 192·512 아이콘', 아이콘들.some((i) => i.sizes === '192x192') &&
    아이콘들.some((i) => i.sizes === '512x512'), `${아이콘들.length}개`);
  const 마스커블 = 아이콘들.filter((i) => (i.purpose || '').split(/\s+/).includes('maskable'));
  확인('manifest: maskable 전용 아이콘 분리', 마스커블.length >= 1 &&
    마스커블.every((i) => !(i.purpose || '').split(/\s+/).includes('any')),
    마스커블.map((i) => i.src + '(' + i.purpose + ')').join(', ') || '없음');
  let 빠진아이콘 = 아이콘들.map((i) => i.src)
    .filter((s) => !fs.existsSync(저장소루트 + 'ristock/' + s));
  확인('manifest: 아이콘 파일이 전부 존재', 빠진아이콘.length === 0, 빠진아이콘.join(', ') || 'OK');
  // apple-touch-icon 은 manifest 를 안 읽는 iOS 홈 화면이 쓰는 그림입니다 — 빠지면 검은 사각형이 됩니다
  확인('index.html: apple-touch-icon 파일 존재',
    fs.existsSync(저장소루트 + 'ristock/icons/icon-180.png'), 'icon-180.png');
}

/* (사) 설치 안내 배너 — 뜰 때 뜨고, 안 뜰 때 안 뜨는가 */
const 아이폰UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

async function 설치안내화면(이름, opt) {
  const c = await 브라우저.newContext({
    viewport: { width: 375, height: 812 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, locale: 'ko-KR', serviceWorkers: 'block',
    userAgent: (opt && opt.ua) || 아이폰UA
  });
  const pg = await c.newPage();
  pg.on('pageerror', (e) => 페이지오류.push(`[${이름}] ` + String(e && e.message || e)));
  // 아이폰 홈 화면 앱으로 실행 중인 상태는 navigator.standalone 으로만 알 수 있습니다
  if (opt && opt.standalone) {
    await pg.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    });
  }
  await pg.goto(기준주소, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#view-brief .card', { timeout: 10000 });
  return { c, pg };
}

{
  // 첫 방문에는 안내를 띄우지 않습니다 — 데이터를 구경하기도 전에 성가십니다
  const { c, pg } = await 설치안내화면('아이폰1회');
  확인('설치안내: 첫 방문에는 안 뜬다',
    (await pg.locator('.install-card').count()) === 0, '');

  // 두 번째 방문부터 뜹니다
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#view-brief .card');
  확인('설치안내: 두 번째 방문에 뜬다',
    (await pg.locator('.install-card').count()) === 1, '');
  const 안내글 = await pg.locator('.install-card').innerText();
  확인('설치안내: 공유 → 홈 화면에 추가 경로를 알려 준다',
    안내글.includes('공유') && 안내글.includes('홈 화면에 추가'),
    안내글.replace(/\s+/g, ' ').slice(0, 60));

  // 닫기 버튼이 **실제로** 눌리는가 (CLAUDE.md 3-1)
  await 터치(pg, '설치안내 닫기(✕)', '.install-card .ins-x');
  await pg.locator('.install-card .ins-x').click();
  await pg.waitForTimeout(200);
  확인('설치안내: 닫으면 즉시 사라진다',
    (await pg.locator('.install-card').count()) === 0, '');

  // 닫은 것은 새로고침해도 기억해야 합니다 (매번 다시 뜨면 그게 제일 성가십니다)
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#view-brief .card');
  확인('설치안내: 닫으면 새로고침해도 다시 안 뜬다',
    (await pg.locator('.install-card').count()) === 0, '');
  await pg.screenshot({ path: `${샷폴더}/설치안내_닫은뒤.png` });
  await pg.close(); await c.close();
}

{
  // 이미 홈 화면 앱으로 쓰고 계시면 안내할 이유가 없습니다
  const { c, pg } = await 설치안내화면('아이폰standalone', { standalone: true });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#view-brief .card');
  확인('설치안내: 이미 앱으로 실행 중이면 안 뜬다',
    (await pg.locator('.install-card').count()) === 0, '');
  await pg.close(); await c.close();
}

{
  // 안드로이드·PC 는 이번 범위가 아닙니다. 엉뚱한 기기에 아이폰 안내가 뜨면 안 됩니다.
  const 안드UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
  const { c, pg } = await 설치안내화면('안드로이드', { ua: 안드UA });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#view-brief .card');
  확인('설치안내: 아이폰이 아니면 안 뜬다 (아이폰 문구가 잘못 노출되지 않음)',
    (await pg.locator('.install-card').count()) === 0, '');
  await pg.close(); await c.close();
}

/* ─────────────────────────── 마무리 ─────────────────────────── */
console.log('\n=== 콘솔/네트워크 ===');
console.log('콘솔 오류: ' + 콘솔오류.length + (콘솔오류.length ? '\n  ' + 콘솔오류.join('\n  ') : ''));
console.log('페이지 오류: ' + 페이지오류.length + (페이지오류.length ? '\n  ' + 페이지오류.join('\n  ') : ''));
console.log('요청 실패: ' + 요청실패.length + (요청실패.length ? '\n  ' + 요청실패.join('\n  ') : ''));
확인('콘솔 에러 0건', 콘솔오류.length === 0, `${콘솔오류.length}건`);
확인('페이지(JS) 에러 0건', 페이지오류.length === 0, `${페이지오류.length}건`);
확인('요청 실패 0건', 요청실패.length === 0, `${요청실패.length}건`);

const 터치실패 = 결과.터치.filter((t) => !(t.있음 && t.진짜눌림 && t.화면안));
console.log(`\n터치 검사 ${결과.터치.length}건 중 실패 ${터치실패.length}건`);
console.log(`전체 검사 ${결과.흐름.length + 결과.터치.length}건 중 실패 ${실패}건`);
fs.writeFileSync(`${샷폴더}/결과.json`, JSON.stringify({ 결과, 콘솔오류, 페이지오류, 요청실패, 실패 }, null, 1));

await 브라우저.close();
process.exit(실패 ? 1 : 0);
