/* 실측 스펙 연결 검증 — 앱이 clubdb.js 를 실제로 쓰는지, 화면이 깨지지 않는지
 *   node tools/verify_clubdb.js
 * ⚠️ serviceWorkers:'block' 필수
 */
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:8734';

let fail = 0;
const check = (n, c, d = '') => { if (!c) fail++; console.log(`  ${c ? '✔' : '✖'} ${n}${d ? '  — ' + d : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('JS: ' + e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/429|404|Service Worker/.test(t)) errors.push(t.slice(0, 110));
  });

  await page.goto(URL + '/?clubdb', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('riweather.consent', JSON.stringify({ v: '1.0', at: 'x', age14: true, tos: true }));
  });
  await page.reload({ waitUntil: 'networkidle' });

  console.log('\n[1] 실측 데이터가 로드되고 엔진이 쓰는가');
  const loaded = await page.evaluate(() => {
    const D = globalThis.CLUBDB;
    if (!D) return { ok: false };
    return {
      ok: true,
      shafts: (D.SHAFTS || []).length,
      ironShafts: (D.IRON_SHAFTS || []).length,
      wedges: (D.WEDGES || []).length,
      putters: (D.PUTTERS || []).length,
      verified: (D.SHAFTS || []).filter((s) => s.verified).length,
    };
  });
  check('clubdb.js 로드됨', loaded.ok);
  check('드라이버 샤프트 실측', loaded.shafts > 500, `${loaded.shafts}행 (실측 ${loaded.verified})`);
  check('아이언 샤프트 실측', loaded.ironShafts > 200, `${loaded.ironShafts}행`);

  console.log('\n[2] 피팅 결과에 null 이 노출되지 않는가');
  // 여러 조합으로 엔진을 돌려 결과 문구를 검사
  const engine = await page.evaluate(() => {
    if (typeof window.__cfTest !== 'function') return { err: '__cfTest 없음' };
    const base = {
      gender: 'M', age: '50s', years: '5~10년', avg: 90, h: 175, wrist: 84, glove: 25,
      fit: 'mid', tempo: 'mid', cond: 'ok', play: 'course', carry7: 140,
      flight: 'mid', start: 'straight', curve: 'straight', tee: 'mid',
      strikeV: 'center', strikeH: 'center', dispersion: 'mid', ball: 'mid', budget: 'mid',
    };
    const out = { runs: 0, bad: [], samples: [] };
    const variants = [
      {}, { flight: 'low' }, { flight: 'balloon' }, { tempo: 'fast' },
      { budget: 'stock' }, { gender: 'F', carry7: 110 }, { avg: 105 }, { avg: 78 },
    ];
    for (const kind of [undefined, 'iron', 'wedge', 'putter']) {
      for (const v of variants) {
        try {
          const r = window.__cfTest(Object.assign({}, base, v), kind);
          out.runs++;
          // 화면에 보이는 문자열만 검사한다.
          // priceShaft/olderShaft 같은 필드는 __cfTest 전용 출력이고,
          // 값이 없다는 뜻의 null 은 정상이다(가격은 제조사가 공개하지 않음).
          const shown = [r.shaft1, r.shaftBrand1, r.head, r.grip, r.loft, r.length,
                         r.shaftAlt, r.headAlt].filter((x) => x != null).join(' | ');
          if (/null|undefined|NaN/.test(shown)) {
            out.bad.push(`${kind || 'driver'} ${JSON.stringify(v)} → ${shown.slice(0, 90)}`);
          }
          if (out.samples.length < 3 && r && r.shaft1) {
            out.samples.push(`${kind || 'driver'}: ${r.shaft1.m || '?'} ${r.shaft1.sp || ''}`);
          }
        } catch (e) {
          out.bad.push(`${kind || 'driver'} ${JSON.stringify(v)} → 예외 ${e.message.slice(0, 70)}`);
        }
      }
    }
    return out;
  });
  if (engine.err) { check('엔진 실행', false, engine.err); }
  else {
    check(`엔진 ${engine.runs}조합 실행`, engine.runs >= 30, `${engine.runs}회`);
    check('결과에 null/undefined 없음', engine.bad.length === 0,
      engine.bad.length ? engine.bad.slice(0, 3).join(' | ') : '');
    engine.samples.forEach((s) => console.log('    예: ' + s));
  }

  console.log('\n[3] 클럽 피팅 화면이 실제로 열리는가');
  const screen = await page.evaluate(async () => {
    saveCourses([{ name: '서서울CC', lat: 37.6, lon: 126.8, addr: '경기', c: 'KR' }]);
    renderHome();
    await new Promise((r) => setTimeout(r, 400));
    document.querySelector('.course-card')?.click();
    await new Promise((r) => setTimeout(r, 1200));
    const b = [...document.querySelectorAll('#hub-view button')].find((x) => /피팅/.test(x.textContent));
    if (!b) return { err: '피팅 타일 없음' };
    b.click();
    await new Promise((r) => setTimeout(r, 1500));
    const v = [...document.querySelectorAll('main')].find((m) => !m.hidden);
    const txt = (v?.textContent || '').replace(/\s+/g, ' ');
    return { view: v?.id, tiles: document.querySelectorAll('.cf-club-tile').length, hasNull: /null|undefined|NaN/.test(txt) };
  });
  check('클럽 피팅 화면 열림', screen.view === 'clubfit-view', screen.view || screen.err);
  // 볼 피팅 타일이 추가돼 5종이 됐다(v159, 2026-07-30). 4로 남아 있어 정상인데 실패로 떴었다.
  check('클럽 5종 표시(드라이버·아이언·웨지·퍼터·볼)', screen.tiles === 5, String(screen.tiles));
  check('화면에 null 없음', !screen.hasNull);

  console.log('\n' + '─'.repeat(52));
  console.log(errors.length ? `⚠️ JS 오류:\n  ${errors.slice(0, 4).join('\n  ')}` : 'JS 오류 없음');
  console.log(fail === 0 && errors.length === 0 ? '✅ 전부 통과' : `✖ 실패 ${fail}건`);
  await browser.close();
  process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
})().catch((e) => { console.error('실행 실패:', e.message); process.exit(1); });
