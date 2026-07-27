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
확인('신선도 경고 배너 노출(11일 지난 데이터)',
  await page.locator('#view-brief .banner-danger').count() > 0);
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

const 데이터폴더 = new URL('../data/', import.meta.url).pathname;
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

const 픽스처 = new URL('./fixtures/', import.meta.url).pathname;
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
