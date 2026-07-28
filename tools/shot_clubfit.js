/* 클럽 피팅 첫 화면 스크린샷 — 아이콘이 실제로 어떻게 보이는지 확인용
 *   node tools/shot_clubfit.js [출력경로]
 * ⚠️ serviceWorkers:'block' — 안 그러면 캐시된 옛 버전이 서빙된다(실제 사고 있었음)
 */
const { chromium } = require('playwright-core');
const path = require('path');

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = process.argv[2] || path.join(__dirname, '..', 'shot_clubfit.png');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('JS: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('콘솔: ' + m.text().slice(0, 120)); });

  await page.goto('http://localhost:8734/?shot', { waitUntil: 'networkidle' });
  // 약관 통과
  await page.evaluate(() => {
    localStorage.setItem('riweather.consent', JSON.stringify(
      { v: '1.0', at: new Date().toISOString(), age14: true, tos: true }));
  });
  await page.reload({ waitUntil: 'networkidle' });

  // 골프장 하나 저장 → 허브 → 클럽 피팅
  await page.evaluate(() => {
    // 백업 권유 시트가 화면을 덮지 않게 미리 '안내함' 처리
    localStorage.setItem('riweather.backup', JSON.stringify({ nudged: true }));
    saveCourses([{ name: '서서울CC', lat: 37.6, lon: 126.8, addr: '경기 김포시' }]);
    renderHome();
    document.querySelectorAll('.sheet-back').forEach((s) => { s.hidden = true; });
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector('.course-card')?.click());
  await page.waitForTimeout(1200);
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#hub-view button')].find((x) => /클럽 피팅|피팅/.test(x.textContent));
    if (b) { b.click(); return true; }
    return false;
  });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const v = [...document.querySelectorAll('main')].find((m) => !m.hidden);
    const icons = [...document.querySelectorAll('.cf-club-ico')].map((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return `${el.className.replace('cf-club-ico ', '')} ${Math.round(r.width)}x${Math.round(r.height)} mask=${(cs.maskImage || cs.webkitMaskImage || '').slice(-24)}`;
    });
    return { view: v?.id, icons, text: (v?.textContent || '').replace(/\s+/g, ' ').slice(0, 120) };
  });

  await page.screenshot({ path: OUT, fullPage: false });
  console.log('화면:', info.view, '| 피팅열림:', opened);
  console.log('아이콘:', JSON.stringify(info.icons, null, 1));
  console.log('본문:', info.text);
  if (errors.length) console.log('⚠️ 오류:\n  ' + errors.slice(0, 5).join('\n  '));
  else console.log('오류 없음');
  console.log('저장:', OUT);
  await browser.close();
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
