/* 라운드3 — 동의설정 철회 / 카카오 상세 / 네이버·PC / 스크롤 bleed / 연타 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HOST = 'http://localhost:8734';
const SS = 'C:/Users/PC/AppData/Local/Temp/claude/C--Users-PC-Desktop---------250703------------/bea100c1-44b1-4d5d-8367-54600f717107/scratchpad/';
const OUT = [];
const log = (...a) => { const s = a.join(' '); OUT.push(s); console.log(s); };
const UA = {
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  kakao: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.5.0',
  naver: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 1000; 12.0)',
  insta: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0',
  pc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};
async function mk(b, o = {}) {
  const ctx = await b.newContext({ viewport: o.vp || { width: 390, height: 844 }, userAgent: o.ua || UA.ios,
    serviceWorkers: 'block', isMobile: o.mobile !== false, hasTouch: o.mobile !== false, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push('pageerror: ' + e));
  p.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) p.errs.push('console: ' + m.text()); });
  if (o.route) await ctx.route('**script.google.com/**', o.route);
  if (o.init) await p.addInitScript(o.init);
  return p;
}
const CONSENTED = () => localStorage.setItem('riweather.consent', JSON.stringify({
  v: '1.0', at: '2026-07-25T00:00:00.000Z', age14: true, tos: true, loc: true, profile: true, age: '40대', gender: '남성', mkt: true }));

(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

  /* J. 동의 설정에서 선택 항목 철회 시도 */
  log('=== J. 동의 설정에서 위치 동의 철회 ===');
  let p = await mk(b, { init: CONSENTED });
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2200);
  log('  진입 시 consent hidden =', await p.evaluate(() => document.querySelector('#consent-view').hidden));
  log('  allowsLocation 초기 =', await p.evaluate(() => CONSENT.allowsLocation()));
  await p.click('#consent-settings'); await p.waitForTimeout(600);
  log('  동의설정 열림 =', await p.evaluate(() => !document.querySelector('#consent-view').hidden));
  log('  복원된 체크:', JSON.stringify(await p.evaluate(() => ({
    age: c('c-age'), })).catch(() => 'x')));
  log('  복원된 체크2:', JSON.stringify(await p.evaluate(() => {
    const g = i => document.getElementById(i).checked;
    return { age: g('c-age'), tos: g('c-tos'), loc: g('c-loc'), profile: g('c-profile'), mkt: g('c-mkt'), all: g('c-all') };
  })));
  log('  프로필 칩 복원:', JSON.stringify(await p.evaluate(() => ({
    age: [...document.querySelectorAll('#pi-age .pi-chip.on')].map(x => x.textContent),
    gender: [...document.querySelectorAll('#pi-gender .pi-chip.on')].map(x => x.textContent) }))));
  // 위치 체크 해제 후 '나중에 하기'(= 사용자 눈엔 닫기)
  await p.click('#c-loc'); await p.waitForTimeout(200);
  await p.click('#c-later'); await p.waitForTimeout(500);
  log('  ▶ 위치해제+나중에 → allowsLocation =', await p.evaluate(() => CONSENT.allowsLocation()),
      ' 저장값 =', await p.evaluate(() => localStorage.getItem('riweather.consent')));
  log('  ▶ nag 플래그 =', await p.evaluate(() => localStorage.getItem('riweather.consent.nag')));
  // 정상 경로: 해제 후 시작하기
  await p.click('#consent-settings'); await p.waitForTimeout(500);
  await p.click('#c-loc'); await p.waitForTimeout(150);
  await p.click('#c-start'); await p.waitForTimeout(600);
  log('  위치해제+시작하기 → allowsLocation =', await p.evaluate(() => CONSENT.allowsLocation()));
  // 필수 해제 시도(철회)
  await p.click('#consent-settings'); await p.waitForTimeout(500);
  await p.click('#c-tos'); await p.waitForTimeout(150);
  await p.click('#c-start'); await p.waitForTimeout(600);
  log('  필수(약관) 해제 후 시작하기 → consent 여전히 열림 =', await p.evaluate(() => !document.querySelector('#consent-view').hidden),
      ' warn=', await p.evaluate(() => document.querySelector('#c-warn')?.textContent || 'none'));
  log('  → 철회 경로 존재?  나중에하기 말고 닫기 버튼:', await p.evaluate(() =>
    [...document.querySelectorAll('#consent-view button')].map(x => (x.id || x.className) + ':' + x.textContent.trim().slice(0, 12)).join(' | ')));
  log('  errs:', JSON.stringify(p.errs));
  await p.context().close();

  /* K. 이미 동의한 사용자 → 동의설정 → 나중에 → 이후 약관버전 상승 */
  log('\n=== K. 동의설정에서 나중에 누른 뒤 약관 버전 상승 ===');
  p = await mk(b, { init: () => {
    localStorage.setItem('riweather.consent', JSON.stringify({ v: '0.9', age14: true, tos: true }));
    localStorage.setItem('riweather.consent.nag', JSON.stringify({ later: true, n: 0 }));
  } });
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2200);
  log('  옛버전 + later 플래그 → consent 자동으로 뜨나 =', await p.evaluate(() => !document.querySelector('#consent-view').hidden));
  log('  nag-sheet 떴나 =', await p.evaluate(() => !document.querySelector('#nag-sheet').hidden));
  await p.context().close();

  /* L. 카카오톡 인앱 상세 */
  log('\n=== L. 카카오톡 인앱 상세 ===');
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA.kakao, serviceWorkers: 'block', isMobile: true, hasTouch: true });
    const q = await ctx.newPage();
    try { await q.goto(HOST + '/index.html', { waitUntil: 'commit', timeout: 12000 }); } catch (e) { log('  goto:', e.message.split('\n')[0]); }
    await q.waitForTimeout(5000);
    const s = await q.evaluate(() => ({ url: location.href, ready: document.readyState,
      bodyLen: document.body ? document.body.innerHTML.length : -1,
      hasConsent: !!document.getElementById('consent-view'),
      scripts: document.querySelectorAll('script').length,
      text: (document.body ? document.body.innerText : '').slice(0, 120) })).catch(e => 'evaluate fail: ' + e.message.split('\n')[0]);
    log('  상태:', JSON.stringify(s));
    await q.screenshot({ path: SS + 'kakao.png' }).catch(() => {});
    await ctx.close();
  }

  /* M. 네이버 인앱 / 인스타 / PC */
  log('\n=== M. 네이버·인스타·PC 홈화면추가 ===');
  for (const [name, ua, mobile] of [['Naver인앱', UA.naver, true], ['Instagram인앱', UA.insta, true], ['PC Chrome', UA.pc, false]]) {
    const q = await mk(b, { ua, mobile, vp: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, init: CONSENTED });
    await q.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
    await q.waitForTimeout(2200);
    const cta = await q.evaluate(() => ({ hidden: document.querySelector('#install-cta').hidden,
      title: document.querySelector('#install-title').textContent, sub: document.querySelector('#install-sub').textContent }));
    log(`  [${name}]`, JSON.stringify(cta));
    if (!cta.hidden) {
      await q.click('#btn-install'); await q.waitForTimeout(600);
      log(`    guide:`, JSON.stringify(await q.evaluate(() => ({
        hidden: document.querySelector('#guide-sheet').hidden,
        title: document.querySelector('#guide-title').textContent,
        steps: [...document.querySelectorAll('#guide-steps li')].map(l => l.textContent.replace(/\s+/g, ' ')),
        copyHidden: document.querySelector('#guide-copy').hidden }))));
      // 주소 복사 버튼 실제 동작
      const copyShown = await q.evaluate(() => !document.querySelector('#guide-copy').hidden);
      if (copyShown) {
        await q.click('#guide-copy'); await q.waitForTimeout(700);
        log('    복사버튼 텍스트:', await q.evaluate(() => document.querySelector('#guide-copy').textContent));
        log('    클립보드:', await q.evaluate(() => navigator.clipboard.readText().catch(e => 'read fail')).catch(() => 'n/a'));
      }
      await q.screenshot({ path: SS + 'guide_' + name + '.png' });
    }
    log(`  [${name}] errs:`, JSON.stringify(q.errs));
    await q.context().close();
  }

  /* N. 시트 열린 상태에서 배경 스크롤 bleed */
  log('\n=== N. 시트 배경 스크롤 ===');
  p = await mk(b, { init: CONSENTED });
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2200);
  await p.click('#backup-open'); await p.waitForTimeout(500);
  const before = await p.evaluate(() => window.scrollY);
  await p.mouse.move(195, 200); await p.mouse.wheel(0, 400); await p.waitForTimeout(400);
  log('  백업시트 열린 채 배경 스크롤:', before, '→', await p.evaluate(() => window.scrollY),
      ' body overflow=', await p.evaluate(() => getComputedStyle(document.body).overflow));
  await p.screenshot({ path: SS + 'backup_sheet.png' });
  await p.click('#bk-close'); await p.waitForTimeout(300);
  // 문서 시트
  await p.click('.home-foot .c-view[data-doc="privacy"]'); await p.waitForTimeout(600);
  log('  privacy 시트 열림 =', await p.evaluate(() => !document.querySelector('#doc-sheet').hidden));
  await p.screenshot({ path: SS + 'doc_privacy.png' });
  await p.click('#doc-close');
  await p.context().close();

  /* O. 백업 켜기 연타 */
  log('\n=== O. 백업 켜기 연타 ===');
  let nPost = 0;
  p = await mk(b, { init: CONSENTED, route: async (r) => {
    if (r.request().method() === 'POST') { nPost++; await new Promise(z => setTimeout(z, 1200)); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  } });
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2200);
  await p.click('#backup-open'); await p.waitForTimeout(400);
  await p.evaluate(() => { const b2 = document.querySelector('#bk-enable'); b2.click(); b2.click(); b2.click(); });
  await p.waitForTimeout(4000);
  log('  POST 횟수:', nPost, ' 코드:', await p.evaluate(() => document.querySelector('#bk-code').textContent),
      ' ls:', await p.evaluate(() => localStorage.getItem('riweather.backup')));
  log('  버튼 상태:', JSON.stringify(await p.evaluate(() => ({ txt: document.querySelector('#bk-enable').textContent, dis: document.querySelector('#bk-enable').disabled, hidden: document.querySelector('#bk-enable').hidden }))));
  await p.context().close();

  /* P. 백업 켠 뒤 다시 열었을 때 / 복구코드 재발급 여부 */
  log('\n=== P. 백업 켠 뒤 시트 재오픈 + 끄기 경로 ===');
  p = await mk(b, { init: CONSENTED, route: async r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }) });
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2200);
  await p.click('#backup-open'); await p.waitForTimeout(400);
  await p.click('#bk-enable'); await p.waitForTimeout(2500);
  const code1 = await p.evaluate(() => document.querySelector('#bk-code').textContent);
  await p.click('#bk-close'); await p.waitForTimeout(300);
  await p.click('#backup-open'); await p.waitForTimeout(400);
  log('  코드 유지:', code1, '→', await p.evaluate(() => document.querySelector('#bk-code').textContent));
  log('  백업 끄기 버튼 존재?', await p.evaluate(() => [...document.querySelectorAll('#backup-sheet button')].map(x => (x.id || x.className) + ':' + x.textContent.trim().slice(0, 14)).join(' | ')));
  log('  bk-copy hit:', JSON.stringify(await p.evaluate(() => {
    const el = document.querySelector('#bk-copy'); const r = el.getBoundingClientRect();
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), covered: !(t === el || el.contains(t)) };
  })));
  await p.click('#bk-copy'); await p.waitForTimeout(600);
  log('  복사 후 버튼:', await p.evaluate(() => document.querySelector('#bk-copy').textContent));
  await p.screenshot({ path: SS + 'backup_on.png' });
  log('  errs:', JSON.stringify(p.errs));
  await p.context().close();

  /* Q. 동의화면 스크린샷 */
  log('\n=== Q. 스크린샷 ===');
  p = await mk(b);
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2200);
  await p.screenshot({ path: SS + 'consent_top.png' });
  await p.evaluate(() => { document.querySelector('.consent-scroll').scrollTop = 99999; });
  await p.waitForTimeout(300);
  await p.screenshot({ path: SS + 'consent_bottom.png' });
  await p.click('#c-all'); await p.waitForTimeout(400);
  await p.screenshot({ path: SS + 'consent_all.png' });
  await p.context().close();

  await b.close();
  fs.writeFileSync(process.argv[2] || 'out3.txt', OUT.join('\n'), 'utf8');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
