/* 2026-07-28 점검 수정분 검증 — 실제 브라우저로 재현
 *   node tools/verify_fixes.js
 * ⚠️ serviceWorkers:'block' 필수 (캐시된 옛 버전이 서빙되면 거짓 통과)
 */
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:8734';

const ok = (b) => (b ? '✔' : '✖');
let fail = 0;
const check = (name, cond, detail = '') => {
  if (!cond) fail++;
  console.log(`  ${ok(cond)} ${name}${detail ? '  — ' + detail : ''}`);
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({
    serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 100)); });

  await page.goto(URL + '/?verify', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('riweather.consent', JSON.stringify(
      { v: '1.0', at: new Date().toISOString(), age14: true, tos: true }));
    localStorage.setItem('riweather.backup', JSON.stringify({ nudged: true }));
  });
  await page.reload({ waitUntil: 'networkidle' });

  // ── ① 프로필 병합 (평균타수가 사라지지 않는가) ──────────────
  console.log('\n[1] 프로필 저장이 다른 값을 지우지 않는가');
  const prof = await page.evaluate(() => {
    localStorage.removeItem('riweather.profile');
    saveProfile({ avg: 95 });                 // 평균타수 먼저
    saveProfile({ shape: '슬라이스', dist: 210 });  // 구질·비거리 나중
    const after = loadProfile();
    saveProfile({ avg: null });               // 값 지우기도 되는지
    return { after, cleared: loadProfile() };
  });
  check('평균타수 유지', prof.after.avg === 95, JSON.stringify(prof.after));
  check('구질·비거리도 함께', prof.after.shape === '슬라이스' && prof.after.dist === 210);
  check('값 지우기 동작', prof.cleared.avg === null && prof.cleared.shape === '슬라이스');

  // ── ② 스크롤 컨테이너 (sticky 헤더 복구) ────────────────────
  console.log('\n[2] 스크롤 컨테이너 · sticky 헤더');
  await page.evaluate(() => {
    saveCourses([{ name: '서서울CC', lat: 37.6, lon: 126.8, addr: '경기 김포시', c: 'KR' }]);
    renderHome();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('.course-card')?.click());
  await page.waitForTimeout(1200);
  // 카드를 누르면 허브로 간다 — 날씨 상세는 거기서 한 번 더 들어가야 한다
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#hub-view button')]
      .find((x) => /시간별|날씨|예보/.test(x.textContent));
    b?.click();
  });
  await page.waitForTimeout(2500);
  const scrollInfo = await page.evaluate(async () => {
    document.body.scrollTop = 400;
    window.scrollTo(0, 400);
    await new Promise((r) => setTimeout(r, 400));
    const hdr = document.querySelector('#detail-view .detail-header');
    const mini = document.getElementById('detail-title-mini');
    const save = document.getElementById('btn-save');
    const sr = save?.getBoundingClientRect();
    const hit = sr ? document.elementFromPoint(sr.left + sr.width / 2, sr.top + sr.height / 2) : null;
    return {
      viewOverflowX: getComputedStyle(document.querySelector('#detail-view')).overflowX,
      hdrTop: hdr ? Math.round(hdr.getBoundingClientRect().top) : null,
      miniShown: mini?.classList.contains('show'),
      saveClickable: !!(save && hit && (save === hit || save.contains(hit))),
      scrolled: Math.round(window.scrollY || document.body.scrollTop),
      hScroll: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  check('.view overflow-x 제거됨', scrollInfo.viewOverflowX !== 'hidden', scrollInfo.viewOverflowX);
  check('헤더가 화면 위에 고정', scrollInfo.hdrTop !== null && scrollInfo.hdrTop >= 0 && scrollInfo.hdrTop < 60, 'top=' + scrollInfo.hdrTop);
  check('스크롤 후 미니 타이틀 표시', scrollInfo.miniShown === true, '스크롤=' + scrollInfo.scrolled);
  check('저장(★) 버튼 눌림', scrollInfo.saveClickable);
  check('가로 스크롤 없음', !scrollInfo.hScroll);

  // ── ③ 홀 선택 시 공략이 화면에 보이는가 ─────────────────────
  console.log('\n[3] 홀을 누르면 공략이 화면에 보이는가');
  await page.evaluate(() => history.back());
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#hub-view button')].find((x) => /코스공략/.test(x.textContent));
    b?.click();
  });
  await page.waitForTimeout(2500);
  const holeInfo = await page.evaluate(async () => {
    const btns = [...document.querySelectorAll('.hole-btn')];
    if (btns.length < 5) return { err: '홀 버튼 없음 ' + btns.length };
    btns[4].click();                                   // 5번 홀
    await new Promise((r) => setTimeout(r, 900));
    const card = document.getElementById('hole-detail-card');
    const r = card.getBoundingClientRect();
    const visible = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    return { holes: btns.length, top: Math.round(r.top), visible: Math.round(visible), hidden: card.hidden };
  });
  check('홀 공략 카드가 실제로 보임', holeInfo.visible > 200, `보이는높이 ${holeInfo.visible}px (top=${holeInfo.top})`);

  // ── ④ 해외 구장 레이더 ──────────────────────────────────────
  console.log('\n[4] 해외 골프장에 한국 기상청 레이더가 뜨지 않는가');
  const kr = await page.evaluate(() => {
    const save = currentCourse;
    currentCourse = { name: '테스트JP', lat: 43.0, lon: 141.4, c: 'JP' };
    const jp = isKRCourse();
    currentCourse = { name: '테스트KR', lat: 37.5, lon: 127.0, c: 'KR' };
    const k = isKRCourse();
    currentCourse = { name: '쓰시마', lat: 34.2, lon: 129.3, c: 'JP' };  // 위경도만 보면 한국권
    const tsushima = isKRCourse();
    currentCourse = save;
    return { jp, kr: k, tsushima };
  });
  check('일본 구장 → 기상청 안 씀', kr.jp === false);
  check('한국 구장 → 기상청 사용', kr.kr === true);
  check('쓰시마(위경도 함정) → 일본으로 판정', kr.tsushima === false);

  console.log('\n' + '─'.repeat(50));
  console.log(errors.length ? `⚠️ JS 오류 ${errors.length}건:\n  ` + errors.slice(0, 4).join('\n  ') : 'JS 오류 없음');
  console.log(fail === 0 ? '✅ 전부 통과' : `✖ 실패 ${fail}건`);
  await browser.close();
  process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
})().catch((e) => { console.error('실행 실패:', e.message); process.exit(1); });
