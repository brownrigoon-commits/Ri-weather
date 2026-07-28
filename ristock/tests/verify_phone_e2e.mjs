/* =====================================================================
 * verify_phone_e2e.mjs — Ri_Stock 앱 실동작 검증 (사장님 폰 기준)
 *
 * ■ 무엇을 보는가
 *   "내가 만든 게 잘 돈다"가 아니라 **"사장님이 폰에서 눌렀을 때 깨지는 곳"** 을 찾습니다.
 *   아이폰 크기(375×812)와 태블릿(768×1024) **두 뷰포트 모두**에서 같은 시나리오를 돌립니다.
 *
 *     ① 첫 진입 — 브리핑에 진짜 숫자·섹터명이 뜨는가 (undefined·NaN·null 이 화면에 없는가)
 *     ② 탭 4개 순서대로 + 무작위로 오가도 상태가 안 깨지는가
 *     ③ 전략 8종 전부 열어 한국·미국 결과 확인 (0건이면 안내가 뜨는가)
 *     ④ 시장 전환 · 검색(한글·티커·영문) · 섹터 필터 · 정렬
 *     ⑤ ☆ 관심종목 → 새로고침 후에도 남는가
 *     ⑥ 내 전략 필터 토글 즉시 반영 · 저장 · 새로고침 후 유지
 *     ⑦ CSV 내보내기 (BOM·CRLF·한글·티커 앞자리 0 보존)
 *     ⑧ 오프라인(서비스워커 캐시) · ⑨ 데이터 404 · 부분 실패 · 뉴스 없음
 *     ⑩ 모든 버튼을 `document.elementFromPoint` 로 확인 (CLAUDE.md 3-1)
 *     ⑪ 가로 스크롤 0 · ⑫ 콘솔 에러 0
 *     ⑬ 폰에서만 드러나는 것들 — 입력칸 글자 16px(아이폰 자동 확대), 시트 배경 잠금,
 *        로딩 중 거짓 "데이터 없음" 안내, 주요 뉴스 나라 쏠림
 *
 * ■ 실행
 *     python3 -m http.server 8791 --bind 127.0.0.1      # 저장소 최상단에서
 *     node ristock/tests/verify_phone_e2e.mjs
 *
 *     BASE=http://호스트/경로/ristock/index.html node ...   # 다른 주소
 *     SHOTS=/원하는/폴더 node ...                           # 스크린샷 위치(커밋하지 않습니다)
 *     PLAYWRIGHT=/usr/lib/node_modules/playwright/index.js node ...   # 전역 설치본 지정
 *
 * ■ 준비물:  npm i -g playwright && playwright install chromium
 *
 * ■ 참고 — `verify_pwa.mjs` 는 화면 뼈대·터치 지점 위주의 검사이고,
 *   이 파일은 **사람이 실제로 하는 조작 흐름**을 끝까지 따라가는 검사입니다. 둘 다 통과해야 합니다.
 *
 * ■ 알아 둘 것: 헤드리스 크로미움에서 blob 다운로드의 `suggestedFilename()` 은 항상
 *   "download" 로 나옵니다(브라우저 쪽 한계). 파일 이름이 맞는지는 `a[download]` 값으로 봐야 하며,
 *   실제 아이폰/PC 사파리·크롬에서는 정상적으로 `Ri_Stock_....csv` 로 저장됩니다.
 *
 * 종료코드 0 = 전부 통과. 하나라도 실패하면 1.
 * ===================================================================== */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

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

const BASE = process.env.BASE || 'http://127.0.0.1:8791/ristock/index.html';
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'ristock_phone_shots');
fs.mkdirSync(SHOTS, { recursive: true });
// ⚠ `new URL(…).pathname` 을 그대로 쓰면 윈도우에서 `C:\C:\Users\%EB%94%94…` 가 됩니다
//   (앞 슬래시 + 한글 폴더 퍼센트 인코딩). 집 PC 에서 이 검사를 돌리려면 변환이 필요합니다.
const 데이터폴더 = fileURLToPath(new URL('../data/', import.meta.url));

let 실패 = 0, 통과 = 0;
const 문제 = [];
function 확인(이름, 조건, 상세 = '') {
  if (조건) { 통과++; console.log(`  PASS  ${이름}${상세 ? ' — ' + 상세 : ''}`); }
  else { 실패++; 문제.push(이름 + (상세 ? ' — ' + 상세 : '')); console.log(`! FAIL  ${이름}${상세 ? ' — ' + 상세 : ''}`); }
}
function 섹션(t) { console.log(`\n===== ${t} =====`); }

/* CLAUDE.md 3-1 — 실제 터치 지점 확인 */
const 터치코드 = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return { 있음: false };
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const hit = document.elementFromPoint(cx, cy);
  return {
    있음: true,
    크기: [Math.round(r.width), Math.round(r.height)],
    진짜눌림: !!hit && (hit === el || el.contains(hit) || hit.contains(el)),
    덮은것: hit ? (hit.tagName + '.' + (hit.className || '').toString().slice(0,40)) : null,
    화면안: r.top >= 0 && r.bottom <= window.innerHeight + 0.5 && r.left >= -0.5 && r.right <= window.innerWidth + 0.5,
    충분한크기: r.width >= 40 && r.height >= 30,
    사각형: [Math.round(r.top), Math.round(r.bottom), Math.round(window.innerHeight)]
  };
};

async function 터치확인(p, 이름, sel) {
  const r = await p.evaluate(터치코드, sel);
  if (!r.있음) { 확인(`터치:${이름}`, false, '요소 없음 ' + sel); return r; }
  확인(`터치:${이름}`, r.진짜눌림 && r.화면안,
    `${r.진짜눌림 ? '' : '덮임(' + r.덮은것 + ') '}${r.화면안 ? '' : '화면밖 top=' + r.사각형[0] + ' bottom=' + r.사각형[1] + ' vh=' + r.사각형[2]}`);
  return r;
}

/** 화면에 절대 나오면 안 되는 문자열 */
const 금지어 = ['undefined', 'NaN', '[object Object]', 'Infinity', '{{', '}}', 'null%', ' null', 'null건', 'null조'];
function 금지어검사(이름, 글) {
  const 걸린 = 금지어.filter(w => 글.includes(w));
  확인(`문구:${이름}`, 걸린.length === 0, 걸린.join(' , ') + (걸린.length ? ' | ' + 글.split('\n').filter(l => 걸린.some(w => l.includes(w))).slice(0, 3).join(' // ') : ''));
}

async function 가로스크롤(p, 이름) {
  const v = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, bsw: document.body.scrollWidth }));
  확인(`가로스크롤:${이름}`, v.sw <= v.iw + 0.5, `scrollWidth=${v.sw} innerWidth=${v.iw}`);
}

/* 모든 보이는 버튼 터치 검사 */
async function 전체버튼터치(p, 이름) {
  const 결과 = await p.evaluate(() => {
    const out = [];
    // 시트(모달)가 열려 있으면 뒤 화면은 덮여 있는 게 정상 — 시트 안만 검사합니다.
    const 시트열림 = !document.getElementById('sheet-back').hidden;
    const 뿌리 = 시트열림 ? document.getElementById('sheet-back') : document;
    const els = Array.from(뿌리.querySelectorAll('button, select, input, a[href]'));
    for (const el of els) {
      if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
      const 뷰 = el.closest('.view');
      if (뷰 && 뷰.hidden) continue;
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      const ok = !!hit && (hit === el || el.contains(hit) || hit.contains(el));
      const 안 = r.top >= 0 && r.bottom <= window.innerHeight + 0.5;
      const 작음 = r.height < 28 || r.width < 28;
      if (!ok || !안 || 작음) {
        out.push({
          태그: el.tagName, act: el.dataset ? (el.dataset.act || '') : '', 글: (el.textContent || '').trim().slice(0, 24),
          클래스: (el.className || '').toString().slice(0, 30),
          덮임: !ok, 덮은것: hit ? hit.tagName + '.' + (hit.className || '').toString().slice(0, 30) : 'null',
          화면밖: !안, 작음, 크기: [Math.round(r.width), Math.round(r.height)],
          위치: [Math.round(r.top), Math.round(r.bottom), Math.round(window.innerHeight)]
        });
      }
    }
    return out;
  });
  const 심각 = 결과.filter(x => x.덮임 || x.화면밖);
  확인(`전체버튼터치:${이름}`, 심각.length === 0, JSON.stringify(심각).slice(0, 900));
  const 작은것 = 결과.filter(x => x.작음 && !x.덮임 && !x.화면밖);
  if (작은것.length) console.log(`     (참고) 터치 영역이 작은 요소 ${작은것.length}개: ` + JSON.stringify(작은것.slice(0, 4)));
  return 결과;
}

/* ================================================================= */
const 브라우저 = await chromium.launch();

const 뷰포트들 = [
  { 이름: '폰375', v: { width: 375, height: 812 }, 모바일: true },
  { 이름: '태블릿768', v: { width: 768, height: 1024 }, 모바일: false }
];

for (const 뷰 of 뷰포트들) {
  섹션(`뷰포트 ${뷰.이름}`);
  const ctx = await 브라우저.newContext({
    viewport: 뷰.v, isMobile: 뷰.모바일, hasTouch: 뷰.모바일,
    deviceScaleFactor: 뷰.모바일 ? 3 : 2, locale: 'ko-KR', timezoneId: 'Asia/Seoul',
    acceptDownloads: true
  });
  const p = await ctx.newPage();
  const 콘솔 = [], 오류 = [], 실패요청 = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') 콘솔.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => 오류.push(e.message));
  p.on('requestfailed', r => 실패요청.push(r.url() + ' ' + (r.failure()?.errorText || '')));
  p.on('response', r => { if (r.status() >= 400) 실패요청.push('HTTP' + r.status() + ' ' + r.url()); });

  /* --- 1. 첫 진입 --- */
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('#view-brief .card', { timeout: 8000 });
  const 브리핑글 = await p.locator('#view-brief').innerText();
  금지어검사('브리핑', 브리핑글);
  확인('브리핑:시장분위기 문장', /뉴스\s*\d+건/.test(브리핑글) && 브리핑글.includes('섹터'));
  확인('브리핑:섹터 Top5 5줄', (await p.locator('#view-brief .sector-btn').count()) === 5);
  확인('브리핑:섹터명 실제값', 브리핑글.includes('AI·반도체'));
  확인('브리핑:국가별 뉴스 10개국', (await p.locator('#view-brief .country').count()) === 10);
  확인('브리핑:하단 고지', (await p.locator('.disclaimer').isVisible()));
  await 가로스크롤(p, '브리핑');
  await 전체버튼터치(p, '브리핑');
  await p.screenshot({ path: `${SHOTS}/${뷰.이름}-brief.png`, fullPage: true });

  // 섹터 펼치기
  await p.locator('#view-brief .sector-btn').first().click();
  await p.waitForTimeout(200);
  확인('브리핑:섹터 대표뉴스 펼침', (await p.locator('#view-brief .sector-news li').count()) > 0);
  await p.locator('#view-brief .sector-btn').first().click();
  await p.waitForTimeout(200);
  확인('브리핑:섹터 다시 접힘', (await p.locator('#view-brief .sector-news li').count()) === 0);

  /* --- 2. 탭 순회 + 무작위 --- */
  섹션(`${뷰.이름} · 탭 이동`);
  const 탭 = { brief: '브리핑', strategy: '전략', stocks: '종목', my: '내 전략' };
  for (const t of ['brief', 'strategy', 'stocks', 'my']) {
    await p.locator(`#tabbar button[data-tab="${t}"]`).click();
    await p.waitForTimeout(250);
    const 보임 = await p.evaluate((t) => {
      const on = document.getElementById('view-' + t);
      const 나머지 = ['brief', 'strategy', 'stocks', 'my'].filter(x => x !== t)
        .map(x => document.getElementById('view-' + x)).filter(e => !e.hidden);
      return { 켜짐: !on.hidden, 글자수: on.innerText.trim().length, 다른것: 나머지.map(e => e.id) };
    }, t);
    확인(`탭:${탭[t]} 표시`, 보임.켜짐 && 보임.글자수 > 50 && 보임.다른것.length === 0, JSON.stringify(보임).slice(0, 200));
    금지어검사(`탭:${탭[t]}`, await p.locator('#view-' + t).innerText());
    await 가로스크롤(p, `탭:${탭[t]}`);
    await 전체버튼터치(p, `탭:${탭[t]}`);
    await p.screenshot({ path: `${SHOTS}/${뷰.이름}-tab-${t}.png`, fullPage: true });
  }
  // 무작위 순서
  const 무작위 = ['stocks', 'brief', 'my', 'strategy', 'my', 'stocks', 'strategy', 'brief', 'stocks', 'my'];
  for (const t of 무작위) { await p.locator(`#tabbar button[data-tab="${t}"]`).click(); await p.waitForTimeout(90); }
  const 무작위후 = await p.evaluate(() => ({
    보이는: ['brief', 'strategy', 'stocks', 'my'].filter(x => !document.getElementById('view-' + x).hidden),
    현재탭: Array.from(document.querySelectorAll('#tabbar button')).filter(b => b.getAttribute('aria-current')).map(b => b.dataset.tab)
  }));
  확인('탭:무작위 이동 후 정확히 1개만 보임', 무작위후.보이는.length === 1 && 무작위후.현재탭.length === 1 && 무작위후.보이는[0] === 무작위후.현재탭[0], JSON.stringify(무작위후));

  /* --- 3. 전략 8개 전부 --- */
  섹션(`${뷰.이름} · 전략 8종`);
  await p.locator('#tabbar button[data-tab="strategy"]').click();
  await p.waitForTimeout(250);
  const 전략수 = await p.locator('.strategy-card').count();
  확인('전략:목록 8개', 전략수 === 8, String(전략수));
  const 전략표 = [];
  for (let i = 0; i < 전략수; i++) {
    await p.locator('#tabbar button[data-tab="strategy"]').click();  // 목록으로
    await p.waitForTimeout(150);
    const 카드 = p.locator('.strategy-card').nth(i);
    const 이름 = (await 카드.locator('.st-name').innerText()).trim();
    await 카드.click();
    await p.waitForTimeout(350);
    const 한국카드 = await p.locator('#view-strategy .stock-card').count();
    const 한국빔 = await p.locator('#view-strategy .empty').count();
    // 미국 전환
    await p.locator('#view-strategy .seg button[data-market="미국"]').click();
    await p.waitForTimeout(300);
    const 미국카드 = await p.locator('#view-strategy .stock-card').count();
    const 미국빔 = await p.locator('#view-strategy .empty').count();
    await p.locator('#view-strategy .seg button[data-market="한국"]').click();
    await p.waitForTimeout(200);
    전략표.push({ 이름, 한국카드, 한국빔, 미국카드, 미국빔 });
    const 글 = await p.locator('#view-strategy').innerText();
    금지어검사(`전략:${이름}`, 글);
    확인(`전략:${이름} 결과 또는 안내`, 한국카드 > 0 || 한국빔 > 0, `카드${한국카드} 빈안내${한국빔}`);
    확인(`전략:${이름} 미국 결과 또는 안내`, 미국카드 > 0 || 미국빔 > 0, `카드${미국카드} 빈안내${미국빔}`);
    await 가로스크롤(p, `전략:${이름}`);
    if (i === 0 || i === 7) await 전체버튼터치(p, `전략:${이름}`);
  }
  console.log('\n  전략별 결과 요약');
  전략표.forEach(x => console.log(`   ${x.이름.padEnd(24)} 한국 ${String(x.한국카드).padStart(2)}종목  미국 ${String(x.미국카드).padStart(2)}종목`));
  확인('전략:모든 전략이 0건은 아님', 전략표.some(x => x.한국카드 > 0), '');

  /* --- 4. 종목: 시장/검색/섹터/정렬 --- */
  섹션(`${뷰.이름} · 종목 화면`);
  await p.locator('#tabbar button[data-tab="stocks"]').click();
  await p.waitForTimeout(300);
  /* 목록은 50행씩 끊어 그립니다 (구형 폰에서 300행 일괄 렌더가 검색을 멈춰 세웁니다 —
     app.js `표시단위` 주석의 실측값 참고). 개수는 목록 위 카운트에 그대로 나와야 하고,
     "더 보기"를 끝까지 누르면 정확히 300종목에 닿아야 합니다. */
  const 전체행 = await p.locator('#view-stocks .stock-row').count();
  확인('종목:한국 첫 50행만 렌더', 전체행 === 50, String(전체행));
  확인('종목:한국 총 300종목 표기', (await p.locator('#stock-count').innerText()).includes('300종목'),
    await p.locator('#stock-count').innerText());
  let 더누름 = 0;
  while (await p.locator('#view-stocks [data-act="더보기"]').count()) {
    await p.locator('#view-stocks [data-act="더보기"]').click();
    await p.waitForTimeout(120);
    if (++더누름 > 12) break;
  }
  확인('종목:더 보기로 300종목 전부 도달',
    (await p.locator('#view-stocks .stock-row').count()) === 300,
    `${더누름}번 눌러 ${await p.locator('#view-stocks .stock-row').count()}행`);
  await 가로스크롤(p, '종목 300행 전부');
  await p.locator('#tabbar button[data-tab="stocks"]').click();   // 화면을 새로 열면 다시 50행
  await p.waitForTimeout(350);
  확인('종목:화면을 다시 열면 50행부터',
    (await p.locator('#view-stocks .stock-row').count()) === 50,
    String(await p.locator('#view-stocks .stock-row').count()));
  await p.locator('#view-stocks .seg button[data-market="미국"]').click();
  await p.waitForTimeout(400);
  const 미국행 = await p.locator('#view-stocks .stock-row').count();
  확인('종목:미국도 50행부터', 미국행 === 50, String(미국행));
  확인('종목:미국 총 300종목 표기', (await p.locator('#stock-count').innerText()).includes('300종목'),
    await p.locator('#stock-count').innerText());
  const 미국첫 = await p.locator('#view-stocks .stock-row').first().innerText();
  확인('종목:미국 첫 행에 티커', /[A-Z]{1,5}/.test(미국첫), 미국첫.replace(/\n/g, ' '));
  await p.locator('#view-stocks .seg button[data-market="한국"]').click();
  await p.waitForTimeout(400);

  // 검색 — 한글
  await p.fill('#stock-search', '삼성');
  await p.waitForTimeout(300);
  const 삼성행 = await p.locator('#view-stocks .stock-row').count();
  const 삼성글 = await p.locator('#view-stocks').innerText();
  확인('검색:한글 "삼성"', 삼성행 > 0 && 삼성행 < 50 && 삼성글.includes('삼성전자'), `${삼성행}행`);
  // 검색 — 티커
  await p.fill('#stock-search', '005930');
  await p.waitForTimeout(300);
  확인('검색:티커 005930', (await p.locator('#view-stocks .stock-row').count()) === 1, String(await p.locator('#view-stocks .stock-row').count()));
  // 검색 — 대소문자 무시 (한국 데이터는 기업명이 한글이라 영문 검색 대상이 아님)
  await p.fill('#stock-search', '하이닉스');
  await p.waitForTimeout(300);
  확인('검색:한글 부분일치 "하이닉스"', (await p.locator('#view-stocks .stock-row').count()) >= 1);
  // 검색 — 없는 것
  await p.fill('#stock-search', 'zzzzz없는종목');
  await p.waitForTimeout(300);
  확인('검색:결과 없음 안내', (await p.locator('#view-stocks .empty').count()) === 1);
  await p.fill('#stock-search', '');
  await p.waitForTimeout(250);
  // 미국 영문/티커 검색
  await p.locator('#view-stocks .seg button[data-market="미국"]').click();
  await p.waitForTimeout(350);
  await p.fill('#stock-search', 'AAPL');
  await p.waitForTimeout(300);
  확인('검색:미국 티커 AAPL', (await p.locator('#view-stocks .stock-row').count()) >= 1);
  await p.fill('#stock-search', 'apple');
  await p.waitForTimeout(300);
  확인('검색:미국 소문자 apple', (await p.locator('#view-stocks .stock-row').count()) >= 1);
  await p.fill('#stock-search', '');
  await p.locator('#view-stocks .seg button[data-market="한국"]').click();
  await p.waitForTimeout(350);

  // 섹터 필터
  const 섹터옵션 = await p.locator('#stock-sector option').allInnerTexts();
  확인('섹터:옵션 2개 이상', 섹터옵션.length > 2, String(섹터옵션.length));
  await p.selectOption('#stock-sector', { index: 1 });
  await p.waitForTimeout(300);
  const 섹터명 = 섹터옵션[1];
  const 섹터행수 = await p.locator('#view-stocks .stock-row').count();
  const 섹터맞음 = await p.evaluate((s) => Array.from(document.querySelectorAll('#view-stocks .stock-row .sb')).every(e => e.textContent.includes(s)), 섹터명);
  확인(`섹터필터:${섹터명}`, 섹터행수 > 0 && 섹터행수 < 300 && 섹터맞음, `${섹터행수}행`);

  // 정렬 변경
  await p.selectOption('#stock-sort', '총점');
  await p.waitForTimeout(300);
  const 총점들 = await p.evaluate(() => Array.from(document.querySelectorAll('#view-stocks .stock-row .tot')).map(e => e.textContent.trim()));
  const 숫자만 = 총점들.filter(x => x !== '미평가').map(Number);
  const 내림차순 = 숫자만.every((v, i) => i === 0 || 숫자만[i - 1] >= v);
  확인('정렬:총점 내림차순', 내림차순 && 숫자만.length > 0, 총점들.slice(0, 5).join(','));
  const 미평가맨뒤 = 총점들.findIndex(x => x === '미평가');
  확인('정렬:미평가는 뒤로', 미평가맨뒤 === -1 || 총점들.slice(미평가맨뒤).every(x => x === '미평가'), `첫 미평가 index=${미평가맨뒤}`);
  await p.selectOption('#stock-sort', '시총순위');
  await p.selectOption('#stock-sector', '');
  await p.waitForTimeout(300);

  // 상세 시트
  await p.locator('#view-stocks .stock-row').first().click();
  await p.waitForTimeout(300);
  const 시트글 = await p.locator('#sheet').innerText();
  확인('상세:시트 열림', (await p.locator('#sheet-back').isVisible()) && 시트글.length > 100);
  금지어검사('상세시트', 시트글);
  확인('상세:주요 지표 표시', 시트글.includes('PER') && 시트글.includes('ROE'));
  await 전체버튼터치(p, '상세시트');
  await p.screenshot({ path: `${SHOTS}/${뷰.이름}-sheet.png` });
  await p.locator('#sheet [data-act="시트닫기"]').click();
  await p.waitForTimeout(250);
  확인('상세:닫기', !(await p.locator('#sheet-back').isVisible()));

  /* --- 5. 관심종목 + 새로고침 --- */
  섹션(`${뷰.이름} · 관심종목 지속`);
  await p.locator('#view-stocks .stock-row').first().click();
  await p.waitForTimeout(300);
  const 대상티커 = await p.locator('#sheet .fav-btn').getAttribute('data-ticker');
  await p.locator('#sheet .fav-btn').click();
  await p.waitForTimeout(250);
  확인('관심:별표 켜짐', (await p.locator('#sheet .fav-btn').getAttribute('aria-pressed')) === 'true');
  const 저장값 = await p.evaluate(() => localStorage.getItem('ristock.관심종목.v1'));
  확인('관심:localStorage 기록', !!저장값 && 저장값.includes(대상티커), String(저장값));
  await p.locator('#sheet [data-act="시트닫기"]').click();
  await p.waitForTimeout(200);
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.locator('#tabbar button[data-tab="stocks"]').click();
  await p.waitForTimeout(400);
  const 별표남음 = await p.evaluate((t) => {
    const rows = Array.from(document.querySelectorAll('#view-stocks .stock-row'));
    const r = rows.find(x => x.dataset.ticker === t);
    return r ? r.innerText.includes('★') : null;
  }, 대상티커);
  확인('관심:새로고침 후에도 유지', 별표남음 === true, String(별표남음));
  // 관심종목만 보기
  await p.locator('#view-stocks [data-act="관심만"]').click();
  await p.waitForTimeout(300);
  확인('관심:관심만 필터 1종목', (await p.locator('#view-stocks .stock-row').count()) === 1, String(await p.locator('#view-stocks .stock-row').count()));
  await p.locator('#view-stocks [data-act="관심만"]').click();
  await p.waitForTimeout(250);

  /* --- 6. 내 전략 --- */
  섹션(`${뷰.이름} · 내 전략`);
  await p.locator('#tabbar button[data-tab="my"]').click();
  await p.waitForTimeout(400);
  확인('내전략:토글 8개', (await p.locator('#view-my .toggle-row').count()) === 8, String(await p.locator('#view-my .toggle-row').count()));
  const 전결과 = await p.locator('#view-my .stock-card').count();
  await p.locator('#view-my [data-act="내필터"][data-key="미네르비니만"]').click();
  await p.waitForTimeout(400);
  const 후결과 = await p.locator('#view-my .stock-card').count();
  확인('내전략:필터 토글 즉시 반영', 전결과 !== 후결과 || 후결과 === 0, `전 ${전결과} → 후 ${후결과}`);
  확인('내전략:토글 상태 표시', (await p.locator('#view-my [data-act="내필터"][data-key="미네르비니만"]').getAttribute('aria-pressed')) === 'true');
  // rank_by 변경
  await p.selectOption('#my-rank', '전고점');
  await p.waitForTimeout(400);
  확인('내전략:순위기준 변경 반영', (await p.locator('#view-my').innerText()).length > 200);
  await p.selectOption('#my-rank', '마법공식');
  await p.waitForTimeout(500);
  금지어검사('내전략:마법공식', await p.locator('#view-my').innerText());
  await p.selectOption('#my-rank', '총점');
  await p.waitForTimeout(300);
  // 저장
  await p.fill('#my-name', '테스트 눌림목');
  await p.locator('#view-my [data-act="내전략저장"]').click();
  await p.waitForTimeout(400);
  확인('내전략:저장 목록에 표시', (await p.locator('#view-my .saved-item').count()) === 1);
  const 저장된 = await p.evaluate(() => localStorage.getItem('ristock.내전략.v1'));
  확인('내전략:localStorage 저장', !!저장된 && 저장된.includes('테스트 눌림목'));
  // 새로고침 후
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.locator('#tabbar button[data-tab="my"]').click();
  await p.waitForTimeout(400);
  확인('내전략:새로고침 후 저장목록 유지', (await p.locator('#view-my .saved-item').count()) === 1);
  const 토글상태 = await p.evaluate(() => Array.from(document.querySelectorAll('#view-my [data-act="내필터"]')).map(b => [b.dataset.key, b.getAttribute('aria-pressed')]));
  확인('내전략:새로고침 후 켜둔 조건 유지', 토글상태.some(x => x[0] === '미네르비니만' && x[1] === 'true'), JSON.stringify(토글상태));
  // 불러오기
  await p.locator('#view-my [data-act="내전략불러오기"]').click();
  await p.waitForTimeout(400);
  const 불러온후 = await p.evaluate(() => Array.from(document.querySelectorAll('#view-my [data-act="내필터"]')).filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.key));
  확인('내전략:불러오기 반영', 불러온후.includes('미네르비니만'), JSON.stringify(불러온후));
  await 전체버튼터치(p, '내전략');
  await p.screenshot({ path: `${SHOTS}/${뷰.이름}-my.png`, fullPage: true });
  // 삭제
  await p.locator('#view-my [data-act="내전략삭제"]').click();
  await p.waitForTimeout(400);
  확인('내전략:삭제', (await p.locator('#view-my .saved-item').count()) === 0);

  /* --- 7. CSV --- */
  섹션(`${뷰.이름} · CSV 내보내기`);
  async function CSV받기(이름, 누르기) {
    const [다운] = await Promise.all([
      p.waitForEvent('download', { timeout: 8000 }).catch(() => null),
      누르기()
    ]);
    if (!다운) { 확인(`CSV:${이름} 다운로드`, false, 'download 이벤트 없음'); return null; }
    const 경로 = `${SHOTS}/${뷰.이름}-${이름}.csv`;
    await 다운.saveAs(경로);
    const buf = fs.readFileSync(경로);
    const 글 = buf.toString('utf8');
    확인(`CSV:${이름} 다운로드`, true, 다운.suggestedFilename() + ` ${buf.length}바이트`);
    확인(`CSV:${이름} BOM`, buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF, [buf[0], buf[1], buf[2]].join(','));
    확인(`CSV:${이름} 한글 안 깨짐`, /[가-힣]/.test(글) && !글.includes('�'), 글.split('\r\n')[0].slice(0, 60));
    확인(`CSV:${이름} CRLF`, 글.includes('\r\n'));
    확인(`CSV:${이름} 내용 있음`, 글.split('\r\n').length > 3, `${글.split('\r\n').length}줄`);
    return 글;
  }
  await p.locator('#tabbar button[data-tab="strategy"]').click();
  await p.waitForTimeout(200);
  await p.locator('.strategy-card').first().click();
  await p.waitForTimeout(400);
  const csv1 = await CSV받기('전략', () => p.locator('#view-strategy [data-act="전략CSV"]').click());
  if (csv1) 확인('CSV:전략 티커 문자열 보존', csv1.includes('="'), csv1.split('\r\n')[3]?.slice(0, 80));
  await p.locator('#tabbar button[data-tab="stocks"]').click();
  await p.waitForTimeout(400);
  const csv2 = await CSV받기('종목', () => p.locator('#view-stocks [data-act="종목CSV"]').click());
  if (csv2) {
    const 줄 = csv2.split('\r\n');
    확인('CSV:종목 300행+머리', 줄.length >= 303, `${줄.length}줄`);
    확인('CSV:종목 점수 열', 줄[2].includes('점수:모멘텀') && 줄[2].includes('지표:PER'));
  }
  await p.locator('#tabbar button[data-tab="my"]').click();
  await p.waitForTimeout(400);
  await CSV받기('내전략', () => p.locator('#view-my [data-act="내전략CSV"]').click());

  /* --- 12. 콘솔 --- */
  섹션(`${뷰.이름} · 콘솔`);
  확인('콘솔:페이지 오류 없음', 오류.length === 0, 오류.slice(0, 3).join(' | '));
  확인('콘솔:error/warning 없음', 콘솔.length === 0, 콘솔.slice(0, 5).join(' | '));
  const 진짜실패 = 실패요청.filter(u => !u.includes('favicon'));
  확인('네트워크:실패 요청 없음', 진짜실패.length === 0, 진짜실패.slice(0, 5).join(' | '));

  await ctx.close();
}

/* ================================================================= */
/* --- 8. 오프라인 --- */
섹션('오프라인 (서비스워커 캐시)');
{
  const ctx = await 브라우저.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'ko-KR' });
  const p = await ctx.newPage();
  const 오류 = []; p.on('pageerror', e => 오류.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  // 서비스워커 등록 대기
  const sw준비 = await p.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active).catch(() => false));
  확인('오프라인:서비스워커 등록', sw준비 === true, String(sw준비));
  await p.waitForTimeout(1500);   // 캐시 채우기
  // 한 번 더 방문해 data JSON 도 캐시에 들어가게
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);

  await ctx.setOffline(true);
  await p.reload({ waitUntil: 'domcontentloaded' }).catch(e => console.log('  reload 오류:', e.message));
  await p.waitForTimeout(2500);
  const 글 = await p.locator('#app').innerText().catch(() => '');
  const 껍데기 = await p.evaluate(() => !!document.querySelector('#tabbar'));
  확인('오프라인:앱 껍데기가 열림', 껍데기, '');
  확인('오프라인:빈 화면 아님', 글.trim().length > 80, `${글.trim().length}자: ` + 글.slice(0, 160).replace(/\n/g, ' / '));
  const 데이터살아있나 = 글.includes('시장 분위기') || 글.includes('섹터');
  const 안내떴나 = 글.includes('데이터') && (글.includes('불러오지') || 글.includes('다시 시도') || 글.includes('없습니다'));
  확인('오프라인:데이터 또는 안내 중 하나', 데이터살아있나 || 안내떴나, `데이터=${데이터살아있나} 안내=${안내떴나}`);
  await p.screenshot({ path: `${SHOTS}/offline.png`, fullPage: true });
  await ctx.setOffline(false);
  await ctx.close();
}

/* --- 9. manifest.json 404 --- */
섹션('데이터 없음 (manifest 404)');
{
  const ctx = await 브라우저.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'ko-KR', serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const 오류 = []; p.on('pageerror', e => 오류.push(e.message));
  await p.route('**/data/manifest.json*', r => r.fulfill({ status: 404, body: 'Not Found' }));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const 글 = await p.locator('#view-brief').innerText();
  확인('404:빈 화면 아님', 글.trim().length > 40, `${글.trim().length}자`);
  확인('404:안내 문구', 글.includes('아직 데이터가 없습니다') || 글.includes('불러오지'), 글.slice(0, 140).replace(/\n/g, ' / '));
  확인('404:다시 시도 버튼', (await p.locator('#view-brief [data-act="다시읽기"]').count()) === 1);
  await 터치확인(p, '404 다시시도', '#view-brief [data-act="다시읽기"]');
  await 가로스크롤(p, '404 화면');
  // 다른 탭도 안내가 뜨는가
  for (const t of ['strategy', 'stocks', 'my']) {
    await p.locator(`#tabbar button[data-tab="${t}"]`).click();
    await p.waitForTimeout(250);
    const g = await p.locator('#view-' + t).innerText();
    확인(`404:${t} 탭 안내`, g.trim().length > 40 && (g.includes('데이터') || g.includes('없습니다')), g.slice(0, 80).replace(/\n/g, ' / '));
  }
  // 복구: 라우트 해제 후 다시 시도
  await p.unroute('**/data/manifest.json*');
  await p.locator('#tabbar button[data-tab="brief"]').click();
  await p.waitForTimeout(250);
  await p.locator('#view-brief [data-act="다시읽기"]').click();
  await p.waitForTimeout(1500);
  const 복구 = await p.locator('#view-brief').innerText();
  확인('404:다시 시도로 복구', 복구.includes('시장 분위기'), 복구.slice(0, 100).replace(/\n/g, ' / '));
  확인('404:페이지 오류 없음', 오류.length === 0, 오류.join(' | '));
  await p.screenshot({ path: `${SHOTS}/nodata.png`, fullPage: true });
  await ctx.close();
}

/* --- 9-2. 종목 JSON 한쪽만 404 (부분 실패) --- */
섹션('부분 실패 (미국 JSON 404)');
{
  const ctx = await 브라우저.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'ko-KR', serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const 오류 = []; p.on('pageerror', e => 오류.push(e.message));
  await p.route('**/data/stocks_US.json*', r => r.fulfill({ status: 404, body: 'x' }));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const 글 = await p.locator('#view-brief').innerText();
  확인('부분실패:경고 배너', 글.includes('일부 데이터를 불러오지 못했습니다'), 글.slice(0, 120).replace(/\n/g, ' / '));
  await p.locator('#tabbar button[data-tab="stocks"]').click();
  await p.waitForTimeout(400);
  const 세그 = await p.locator('#view-stocks .seg button').allInnerTexts();
  확인('부분실패:종목 세그에 한국만', JSON.stringify(세그) === '["한국"]', JSON.stringify(세그));
  확인('부분실패:한국 목록 정상',
    (await p.locator('#view-stocks .stock-row').count()) === 50 &&
    (await p.locator('#stock-count').innerText()).includes('300종목'),
    await p.locator('#stock-count').innerText());
  await p.locator('#tabbar button[data-tab="strategy"]').click();
  await p.waitForTimeout(250);
  await p.locator('.strategy-card').first().click();
  await p.waitForTimeout(400);
  const 전략글 = await p.locator('#view-strategy').innerText();
  금지어검사('부분실패:전략', 전략글);
  확인('부분실패:전략 화면 살아있음', (await p.locator('#view-strategy .stock-card').count()) > 0 || (await p.locator('#view-strategy .empty').count()) > 0);
  확인('부분실패:페이지 오류 없음', 오류.length === 0, 오류.join(' | '));
  await ctx.close();
}

/* --- 9-3. market.json 404 (뉴스 없음 → 전략 계산 근거 상실) --- */
섹션('뉴스 없음 (market.json 404)');
{
  const ctx = await 브라우저.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'ko-KR', serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const 오류 = []; p.on('pageerror', e => 오류.push(e.message));
  await p.route('**/data/market.json*', r => r.fulfill({ status: 404, body: 'x' }));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const 글 = await p.locator('#view-brief').innerText();
  금지어검사('뉴스없음:브리핑', 글);
  확인('뉴스없음:브리핑 안내', 글.includes('요약을 만들지 못했습니다') || 글.includes('불러오지'), 글.slice(0, 150).replace(/\n/g, ' / '));
  await p.locator('#tabbar button[data-tab="strategy"]').click();
  await p.waitForTimeout(250);
  await p.locator('.strategy-card').first().click();
  await p.waitForTimeout(400);
  const 전략글 = await p.locator('#view-strategy').innerText();
  확인('뉴스없음:전략 안내', 전략글.includes('뉴스') || (await p.locator('#view-strategy .empty').count()) > 0, 전략글.slice(0, 150).replace(/\n/g, ' / '));
  확인('뉴스없음:페이지 오류 없음', 오류.length === 0, 오류.join(' | '));
  await ctx.close();
}

/* --- 신선도 배너: 오늘 데이터인 척 --- */
섹션('신선도 배너 (오늘 데이터)');
{
  const ctx = await 브라우저.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'ko-KR', serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const 오늘 = new Date();
  const ymd = `${오늘.getFullYear()}${String(오늘.getMonth() + 1).padStart(2, '0')}${String(오늘.getDate()).padStart(2, '0')}`;
  const 원본 = JSON.parse(fs.readFileSync(데이터폴더 + 'manifest.json', 'utf8'));
  await p.route('**/data/manifest.json*', r => { 원본.기준일 = ymd; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(원본) }); });
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const 글 = await p.locator('#view-brief').innerText();
  확인('신선도:오늘이면 경고 배너 없음', !글.includes('일 전 데이터입니다') && 글.includes('오늘 데이터입니다'), 글.slice(0, 120).replace(/\n/g, ' / '));
  await ctx.close();
}


/* --- 10-2. 폼 컨트롤 확대 방지 / 시트 배경 잠금 / 로딩 안내 / 뉴스 나라 섞기 --- */
섹션('폰에서만 드러나는 것들');
{
  const ctx = await 브라우저.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'ko-KR' });
  const p = await ctx.newPage();
  const 오류 = []; p.on('pageerror', e => 오류.push(e.message));

  // (가) 아이폰 사파리는 16px 미만 input/select 를 누르면 화면을 확대하고 되돌리지 않습니다
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const 작은글씨 = [];
  for (const t of ['stocks', 'my']) {
    await p.locator(`#tabbar button[data-tab="${t}"]`).click();
    await p.waitForTimeout(400);
    const r = await p.evaluate((t) => {
      const out = [];
      document.querySelectorAll('#view-' + t + ' input, #view-' + t + ' select, #view-' + t + ' textarea').forEach(el => {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 16) out.push({ id: el.id || el.tagName, fontSize: fs });
      });
      return out;
    }, t);
    작은글씨.push(...r);
  }
  확인('아이폰:입력칸 글자 16px 이상 (자동 확대 방지)', 작은글씨.length === 0, JSON.stringify(작은글씨));

  // (나) 검색칸은 가장자리를 눌러도 커서가 들어와야 합니다
  await p.locator('#tabbar button[data-tab="stocks"]').click();
  await p.waitForTimeout(400);
  const 검색칸 = await p.evaluate(() => {
    const box = document.querySelector('.search-box');
    const r = box.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width - 6, r.top + r.height / 2);
    return { 박스높이: Math.round(r.height), 라벨: box.tagName, 맞은것: hit ? hit.tagName : null };
  });
  await p.mouse.click(340, await p.evaluate(() => { const r = document.querySelector('.search-box').getBoundingClientRect(); return r.top + r.height / 2; }));
  await p.waitForTimeout(200);
  const 포커스 = await p.evaluate(() => document.activeElement && document.activeElement.id);
  확인('검색칸:가장자리를 눌러도 커서 진입', 포커스 === 'stock-search', `label=${검색칸.라벨} 높이=${검색칸.박스높이} focus=${포커스}`);

  // (다) 시트를 연 채 어두운 배경을 쓸어내려도 뒤 목록이 움직이면 안 됩니다
  await p.evaluate(() => window.scrollTo(0, 300));
  await p.locator('#view-stocks .stock-row').nth(3).click();
  await p.waitForTimeout(400);
  await p.mouse.move(180, 40);
  await p.mouse.wheel(0, 900);
  await p.waitForTimeout(400);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  const 되돌아옴 = await p.evaluate(() => Math.round(window.scrollY));
  확인('시트:배경 스크롤 잠김 + 닫으면 제자리', Math.abs(되돌아옴 - 300) <= 5, `scrollY=${되돌아옴} (기대 300)`);

  // (라) 데이터를 받아오는 중에는 "아직 데이터가 없습니다" 라고 단정하면 안 됩니다
  const ctx2 = await 브라우저.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'ko-KR', serviceWorkers: 'block' });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', e => 오류.push(e.message));
  await p2.route('**/data/*.json*', async r => { await new Promise(x => setTimeout(x, 1800)); r.continue(); });
  await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(400);
  await p2.locator('#tabbar button[data-tab="stocks"]').click();
  await p2.waitForTimeout(300);
  const 로딩중글 = (await p2.locator('#view-stocks').innerText()).trim();
  확인('로딩중:거짓 "데이터 없음" 안내가 뜨지 않음',
    !로딩중글.includes('아직 데이터가 없습니다') && 로딩중글.includes('불러오는 중'),
    로딩중글.slice(0, 60).replace(/\n/g, ' / '));
  await p2.waitForTimeout(6000);
  확인('로딩끝:종목 목록이 채워짐',
    (await p2.locator('#view-stocks .stock-row').count()) === 50 &&
    (await p2.locator('#stock-count').innerText()).includes('300종목'),
    await p2.locator('#stock-count').innerText());
  await ctx2.close();

  // (마) 주요 뉴스가 한 나라로만 채워지면 안 됩니다
  await p.locator('#tabbar button[data-tab="brief"]').click();
  await p.waitForTimeout(500);
  const 나라들 = await p.evaluate(() =>
    Array.from(document.querySelectorAll('#view-brief .news-item .nc')).map(e => e.textContent.replace(/[()]/g, '')));
  const 유일 = Array.from(new Set(나라들));
  확인('브리핑:주요 뉴스에 한국 기사도 포함', 유일.includes('한국') && 유일.length >= 2, JSON.stringify(나라들));

  확인('폰검사:페이지 오류 없음', 오류.length === 0, 오류.join(' | '));
  await ctx.close();
}

/* --- 11. 뒤로가기와 상세 시트 ------------------------------------------------
 * 폰에서는 무언가 덮여 있을 때 뒤로가기를 누르면 **덮인 것부터 닫히는 것**이 관례입니다
 * (안드로이드 하드웨어 버튼이 특히 그렇습니다).
 * 예전에는 뒤로가기 한 번에 시트가 닫히면서 보던 탭과 스크롤 위치까지 함께 날아갔고,
 * 탭으로 해석되지 않는 해시(#외부링크 …)로 바뀌면 시트가 화면에 그대로 남고
 * 배경 잠금(body.sheet-open)이 안 풀려 스크롤이 통째로 죽었습니다. */
섹션('뒤로가기 · 상세 시트');
{
  const ctx = await 브라우저.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'ko-KR' });
  const p = await ctx.newPage();
  const 오류 = []; p.on('pageerror', e => 오류.push(e.message));
  const 상태 = () => p.evaluate(() => ({
    시트: !document.getElementById('sheet-back').hidden,
    잠금: document.body.classList.contains('sheet-open'),
    해시: location.hash,
    y: Math.round(window.scrollY),
    탭: (document.querySelector('#tabbar button[aria-current]') || {}).dataset.tab
  }));
  const 시트열기 = async (n = 3) => {
    await p.locator('#view-stocks .stock-row').nth(n).click();
    await p.waitForSelector('#sheet-back:not([hidden])');
    await p.waitForTimeout(250);
  };

  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('#view-brief .card');
  await p.locator('#tabbar button[data-tab="stocks"]').click();
  await p.waitForSelector('#view-stocks .stock-row');
  await p.waitForTimeout(300);
  await p.evaluate(() => window.scrollTo(0, 600));
  await p.waitForTimeout(150);

  // (가) 뒤로가기 1회 = 시트만 닫힘. 탭도 스크롤도 그대로여야 합니다.
  await 시트열기(5);
  const 열린뒤 = await 상태();
  확인('뒤로가기:시트가 열렸다', 열린뒤.시트 && 열린뒤.잠금, JSON.stringify(열린뒤));
  await p.goBack();
  await p.waitForTimeout(400);
  const 한번 = await 상태();
  확인('뒤로가기:1회 → 시트만 닫힘 (탭·스크롤 유지)',
    !한번.시트 && !한번.잠금 && 한번.탭 === 'stocks' && Math.abs(한번.y - 600) <= 5,
    JSON.stringify(한번));

  // (나) 한 번 더 누르면 그제야 이전 화면으로 (뒤로가기가 먹통이 되면 안 됩니다)
  await p.goBack();
  await p.waitForTimeout(400);
  const 두번 = await 상태();
  확인('뒤로가기:2회 → 이전 탭으로 이동', 두번.탭 === 'brief', JSON.stringify(두번));

  // (다) 닫기 버튼으로 닫으면 히스토리도 함께 정리 — 그 뒤 뒤로가기 한 번에 이전 탭
  await p.locator('#tabbar button[data-tab="stocks"]').click();
  await p.waitForSelector('#view-stocks .stock-row');
  await p.waitForTimeout(300);
  await 시트열기(2);
  await p.locator('#sheet [data-act="시트닫기"]').click();
  await p.waitForTimeout(350);
  확인('뒤로가기:닫기 버튼으로 닫힘', !(await 상태()).시트);
  await p.goBack();
  await p.waitForTimeout(400);
  확인('뒤로가기:닫기 뒤 뒤로가기가 한 번에 먹음 (죽은 뒤로가기 없음)',
    (await 상태()).탭 === 'brief', JSON.stringify(await 상태()));

  // (라) ESC · 배경 탭도 같아야 합니다
  for (const [이름, 닫기] of [['ESC', async () => p.keyboard.press('Escape')],
                             ['배경 탭', async () => p.mouse.click(187, 60)]]) {
    await p.locator('#tabbar button[data-tab="stocks"]').click();
    await p.waitForSelector('#view-stocks .stock-row');
    await p.waitForTimeout(300);
    await 시트열기(1);
    await 닫기();
    await p.waitForTimeout(350);
    확인(`뒤로가기:${이름} 으로 닫힘`, !(await 상태()).시트);
    await p.goBack();
    await p.waitForTimeout(400);
    확인(`뒤로가기:${이름} 뒤 뒤로가기 한 번에 이전 탭`, (await 상태()).탭 === 'brief',
      JSON.stringify(await 상태()));
  }

  // (마) 시트가 열려 있는 동안 탭바는 실제로 눌리지 않아야 합니다 (모달이니까 — CLAUDE.md 3-1)
  await p.locator('#tabbar button[data-tab="stocks"]').click();
  await p.waitForSelector('#view-stocks .stock-row');
  await p.waitForTimeout(300);
  await 시트열기(1);
  const 덮임 = await p.evaluate(() => {
    const b = document.querySelector('#tabbar button[data-tab="my"]');
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { 눌림: hit === b || b.contains(hit), 맞은것: hit ? (hit.id || hit.className) : null };
  });
  확인('뒤로가기:시트가 열려 있으면 탭바가 눌리지 않음(모달)', !덮임.눌림, JSON.stringify(덮임));

  // (바) 그래도 화면이 바뀌면(키보드 엔터 등) 시트는 닫히고 히스토리가 오염되면 안 됩니다
  await p.evaluate(() => document.querySelector('#tabbar button[data-tab="my"]').click());
  await p.waitForTimeout(450);
  const 탭이동후 = await 상태();
  확인('뒤로가기:시트 연 채 화면이 바뀌면 시트도 닫힘',
    !탭이동후.시트 && !탭이동후.잠금 && 탭이동후.탭 === 'my', JSON.stringify(탭이동후));
  await p.goBack();
  await p.waitForTimeout(400);
  확인('뒤로가기:그 뒤 뒤로가기도 한 번에 먹음', (await 상태()).탭 === 'stocks',
    JSON.stringify(await 상태()));

  // (사) 탭으로 해석되지 않는 해시로 바뀌어도 시트는 남으면 안 됩니다
  await p.locator('#tabbar button[data-tab="stocks"]').click();
  await p.waitForSelector('#view-stocks .stock-row');
  await p.waitForTimeout(300);
  await 시트열기(1);
  await p.evaluate(() => { location.hash = '#다른곳'; });
  await p.waitForTimeout(400);
  const 모르는해시 = await 상태();
  확인('뒤로가기:모르는 해시로 바뀌어도 시트가 남지 않음',
    !모르는해시.시트 && !모르는해시.잠금, JSON.stringify(모르는해시));
  const 스크롤살아있나 = await p.evaluate(() => {
    window.scrollTo(0, 400);
    return Math.round(window.scrollY);
  });
  확인('뒤로가기:배경 잠금이 풀려 스크롤이 살아 있음', 스크롤살아있나 > 0, `scrollY=${스크롤살아있나}`);

  확인('뒤로가기:페이지 오류 없음', 오류.length === 0, 오류.join(' | '));
  await ctx.close();
}

/* --- 12. 구형 폰 검색 반응 (CPU 4배 스로틀링) --------------------------------
 * 300행을 한 번에 그리던 시절 실측: 검색어 "0" 한 글자에 587ms, 전부 지우면 529ms.
 * 한 글자당 0.5초는 그냥 멈춘 것으로 느껴집니다. 50행씩 끊어 그려 100ms 아래로 내렸고,
 * 누군가 그 제한을 되돌리면 이 검사가 먼저 걸립니다. */
섹션('구형 폰 검색 반응 (CPU 4배)');
{
  const ctx = await 브라우저.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'ko-KR' });
  const p = await ctx.newPage();
  const 오류 = []; p.on('pageerror', e => 오류.push(e.message));
  const cdp = await ctx.newCDPSession(p);

  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('#view-brief .card');
  await p.locator('#tabbar button[data-tab="stocks"]').click();
  await p.waitForSelector('#view-stocks .stock-row');
  await p.waitForTimeout(400);

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  // 한 글자씩 넣으며 입력 핸들러가 붙잡고 있는 시간을 잽니다 (레이아웃까지 강제로 끝낸 뒤 정지)
  const 측정 = async (글) => {
    await p.evaluate(() => {
      const el = document.getElementById('stock-search');
      el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await p.waitForTimeout(250);
    const 기록 = [];
    for (const ch of 글) {
      기록.push(await p.evaluate((ch) => {
        const el = document.getElementById('stock-search');
        el.value += ch;
        const t0 = performance.now();
        el.dispatchEvent(new Event('input', { bubbles: true }));
        void document.getElementById('stock-list').offsetHeight;
        return Math.round(performance.now() - t0);
      }, ch));
    }
    return 기록;
  };

  // "0" 은 한국 티커 300개에 전부 걸리는 최악의 검색어입니다
  const 최악 = await 측정('00593');
  console.log(`     한 글자당 ms: ${최악.join(', ')}`);
  확인('구형폰:검색 한 글자당 200ms 이하', Math.max(...최악) <= 200,
    `최대 ${Math.max(...최악)}ms (제한 없던 시절 587ms)`);

  // 검색어를 전부 지워 목록이 되돌아오는 순간도 무거운 지점입니다
  await p.evaluate(() => {
    const el = document.getElementById('stock-search');
    el.value = '삼'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await p.waitForTimeout(300);
  const 지우기 = await p.evaluate(() => {
    const el = document.getElementById('stock-search');
    el.value = '';
    const t0 = performance.now();
    el.dispatchEvent(new Event('input', { bubbles: true }));
    void document.getElementById('stock-list').offsetHeight;
    return { ms: Math.round(performance.now() - t0), 행: document.querySelectorAll('#view-stocks .stock-row').length };
  });
  확인('구형폰:검색어를 지워도 200ms 이하', 지우기.ms <= 200,
    `${지우기.ms}ms · ${지우기.행}행 (제한 없던 시절 529ms / 300행)`);
  확인('구형폰:지운 뒤 첫 50행부터 다시', 지우기.행 === 50, `${지우기.행}행`);

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  확인('구형폰:페이지 오류 없음', 오류.length === 0, 오류.join(' | '));
  await ctx.close();
}

await 브라우저.close();

섹션('종합');
console.log(`통과 ${통과} · 실패 ${실패}`);
if (문제.length) { console.log('\n실패 목록:'); 문제.forEach(x => console.log(' - ' + x)); }
process.exit(실패 ? 1 : 0);
