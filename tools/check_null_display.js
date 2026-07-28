/* 실측 스펙(clubdb.js)을 넣었을 때 화면에 null/undefined 가 찍히지 않는지 검증
 *   node tools/check_null_display.js
 * 킥포인트·타감처럼 제조사가 공개하지 않는 값이 그대로 노출되면 실패로 잡는다.
 */
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:8734';

const BAD = /null|undefined|NaN|\[object|킥 \s*·|·\s*·/;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(URL + '/?nulltest', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('riweather.consent', JSON.stringify({ v: '1.0', at: 'x', age14: true, tos: true }));
  });
  await page.reload({ waitUntil: 'networkidle' });

  // 실측 데이터를 엔진에 주입해 결과 문구를 만들어 본다
  const res = await page.evaluate(async () => {
    const r = await fetch('js/clubdb.js').then((x) => x.text());
    const fn = new Function('globalThis', r + '; return globalThis.CLUBDB || CLUBDB;');
    const DB = fn(globalThis);
    const out = { checked: 0, bad: [], sample: [] };

    // 킥·타감이 비어 있는 실측 샤프트를 골라 결과 문구를 생성
    const nullK = (DB.SHAFTS || []).filter((s) => s.k == null).slice(0, 3);
    const nullFeel = (DB.IRON_SHAFTS || []).filter((s) => s.feel == null).slice(0, 3);

    for (const [kind, list] of [['driver', nullK], ['iron', nullFeel]]) {
      for (const s of list) {
        out.checked++;
        // 결과 화면이 쓰는 요약줄 형식을 그대로 재현
        const line = kind === 'driver'
          ? [s.b, s.w != null ? s.w + 'g' : null, s.fx,
             s.tq != null ? '토크 ' + s.tq + '°' : null,
             s.k != null ? '킥 ' + s.k : null].filter(Boolean).join(' · ')
          : [s.b, s.mat, '약 ' + s.w + 'g', s.fx,
             s.k != null ? '킥 ' + s.k : null,
             s.feel != null ? s.feel : null].filter(Boolean).join(' · ');
        out.sample.push(`[${kind}] ${s.m} → ${line}`);
        if (/null|undefined/.test(line)) out.bad.push(line);
      }
    }
    return out;
  });

  console.log(`빈 값이 있는 실측 항목 ${res.checked}개로 문구 생성`);
  res.sample.forEach((s) => console.log('  ' + s));
  console.log(res.bad.length ? `\n✖ null 노출 ${res.bad.length}건` : '\n✔ null 노출 없음');

  // 실제 피팅 결과 화면도 한 번 통과시켜 본다 (엔진 문법 오류 검출)
  const engineOk = await page.evaluate(() => {
    try {
      if (typeof window.__cfTest !== 'function') return 'no-test-fn';
      const r = window.__cfTest({ gender: 'M', age: '50s', years: '5~10년', avg: 90,
        h: 175, wrist: 84, glove: 25, fit: 'mid', tempo: 'mid', cond: 'ok', play: 'course',
        carry7: 140, flight: 'mid', start: 'straight', curve: 'straight', tee: 'mid',
        strikeV: 'center', strikeH: 'center', dispersion: 'mid', ball: 'mid', budget: 'mid' });
      return r && r.shaft1 ? 'ok:' + (r.shaft1.m || '?') : 'no-result';
    } catch (e) { return 'err:' + e.message.slice(0, 80); }
  });
  console.log('엔진 실행:', engineOk);

  if (errors.length) console.log('JS 오류:', errors.slice(0, 3).join(' / '));
  await browser.close();
  process.exit(res.bad.length === 0 && !String(engineOk).startsWith('err') ? 0 : 1);
})().catch((e) => { console.error('실행 실패:', e.message); process.exit(1); });
