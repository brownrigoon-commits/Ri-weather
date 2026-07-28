/* 라운드2 — 신규기기 복구 / 문서 스크롤 / 작은화면 / 카톡 / 재동의 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HOST = 'http://localhost:8734';
const OUT = [];
const log = (...a) => { const s = a.join(' '); OUT.push(s); console.log(s); };
const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  kakao: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.5.0',
};
async function mk(b, o = {}) {
  const ctx = await b.newContext({ viewport: o.vp || { width: 390, height: 844 }, userAgent: o.ua || UA.iphoneSafari,
    serviceWorkers: 'block', isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push('pageerror: ' + e));
  p.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) p.errs.push('console: ' + m.text()); });
  if (o.route) await ctx.route('**script.google.com/**', o.route);
  if (o.init) await p.addInitScript(o.init);
  return p;
}
async function hit(p, sel) {
  return p.evaluate(s => {
    const el = document.querySelector(s);
    if (!el) return { sel: s, missing: true };
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    const covered = !(top === el || el.contains(top) || (top && top.contains(el)));
    return { sel: s, w: +r.width.toFixed(1), h: +r.height.toFixed(1), covered,
      by: covered ? (top ? (top.id || top.className || top.tagName) : 'NULL(화면밖)') : null };
  }, sel);
}
const RESTORE_OK = async (route) => {
  const u = route.request().url();
  if (/fn=restore/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {
    v: 1, t: Date.now(),
    courses: [{ name: '테스트CC', lat: 37.5, lon: 127.0, addr: '서울' }, { name: '두번째CC', lat: 36, lon: 128 }],
    scores: [{ id: 'x1', date: '2026-07-01', course: '테스트CC', total: 88 }],
    profile: { years: '3~5년' }, defaultTee: 'white' } }) });
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

  /* ── A. 앱 재설치 후 복구 (백업 켠 적 없는 새 기기) ── */
  log('=== A. 재설치 후 복구 (새 기기, 백업 켠 적 없음) ===');
  let p = await mk(b, { route: RESTORE_OK });
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2200);
  log('  첫화면: consent hidden =', await p.evaluate(() => document.querySelector('#consent-view').hidden));
  log('  이 상태에서 backup-open-empty 누를 수 있나:', JSON.stringify(await hit(p, '#backup-open-empty')));
  // 동의 완료 후 복구
  await p.click('#c-age'); await p.click('#c-tos'); await p.click('#c-start');
  await p.waitForTimeout(700);
  await p.click('#backup-open'); await p.waitForTimeout(500);
  log('  복구 전 bk-state:', JSON.stringify(await p.evaluate(() => document.querySelector('#bk-state').textContent)));
  await p.fill('#bk-restore-input', '1111-2222-3333');
  await p.click('#bk-restore-btn'); await p.waitForTimeout(1600);
  log('  복구 msg:', await p.evaluate(() => document.querySelector('#bk-restore-msg').textContent));
  log('  ▶ 복구 직후 화면상태:', JSON.stringify(await p.evaluate(() => ({
    bkState: document.querySelector('#bk-state').textContent,
    enableHidden: document.querySelector('#bk-enable').hidden,
    codeWrapHidden: document.querySelector('#bk-code-wrap').hidden,
    code: document.querySelector('#bk-code').textContent,
    ls: localStorage.getItem('riweather.backup'),
  }))));
  log('  courses.v1:', await p.evaluate(() => localStorage.getItem('riweather.courses.v1')));
  log('  scores.v1:', await p.evaluate(() => localStorage.getItem('riweather.scores.v1')));
  log('  profile:', await p.evaluate(() => localStorage.getItem('riweather.profile')));
  log('  defaultTee:', await p.evaluate(() => localStorage.getItem('riweather.defaultTee')));
  // 시트를 닫고 홈이 실제로 갱신됐는지
  await p.click('#bk-close'); await p.waitForTimeout(600);
  log('  홈 카드 개수:', await p.evaluate(() => document.querySelectorAll('#course-list > *').length),
      ' empty-state hidden =', await p.evaluate(() => document.querySelector('#empty-state').hidden));
  // 다시 열어보면?
  await p.click('#backup-open'); await p.waitForTimeout(400);
  log('  재오픈 bk-state:', JSON.stringify(await p.evaluate(() => document.querySelector('#bk-state').textContent)));
  log('  errs:', JSON.stringify(p.errs));
  await p.context().close();

  /* ── B. 복구 후 새 기록 추가 시 자동백업이 실제로 도는가 ── */
  log('\n=== B. 복구 후 자동백업 발동 ===');
  const posts = [];
  p = await mk(b, { route: async (route) => {
    const req = route.request();
    if (req.method() === 'POST') { posts.push(req.postData()?.slice(0, 80)); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    return RESTORE_OK(route);
  } });
  await p.addInitScript(() => localStorage.setItem('riweather.consent', JSON.stringify({ v: '1.0', tos: true, age14: true })));
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  await p.click('#backup-open'); await p.waitForTimeout(300);
  await p.fill('#bk-restore-input', '1111-2222-3333');
  await p.click('#bk-restore-btn'); await p.waitForTimeout(1500);
  posts.length = 0;
  await p.evaluate(() => { const c = loadCourses(); c.push({ name: '새로추가CC', lat: 35, lon: 129 }); saveCourses(c); });
  await p.waitForTimeout(6000);
  log('  자동백업 POST 횟수:', posts.length, JSON.stringify(posts));
  log('  bk-state:', JSON.stringify(await p.evaluate(() => document.querySelector('#bk-state').textContent)));
  await p.context().close();

  /* ── C. 문서 시트 스크롤 ── */
  log('\n=== C. 약관 문서 스크롤 ===');
  p = await mk(b);
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  await p.click('#consent-view .c-view[data-doc="tos"]'); await p.waitForTimeout(500);
  const sc = await p.evaluate(() => {
    const el = document.querySelector('#doc-body');
    const st = getComputedStyle(el);
    el.scrollTop = 99999;
    return { overflowY: st.overflowY, maxH: st.maxHeight, height: st.height,
      scrollTop: el.scrollTop, scrollH: el.scrollHeight, clientH: el.clientHeight,
      바닥도달: el.scrollTop + el.clientHeight >= el.scrollHeight - 2 };
  });
  log('  doc-body:', JSON.stringify(sc));
  // 문서 맨 끝 내용이 보이는가 (연락처 표)
  log('  문서 끝 텍스트:', JSON.stringify(await p.evaluate(() => document.querySelector('#doc-body').textContent.slice(-160).replace(/\s+/g, ' '))));
  // 회사정보 표에 빈칸이 노출되는지
  log('  연락처표 HTML:', JSON.stringify(await p.evaluate(() => {
    const t = document.querySelector('#doc-body table');
    return t ? t.innerText.replace(/\n/g, ' | ') : null;
  })));
  await p.click('#doc-close');
  // 개인정보 처리방침도
  await p.click('.consent-actions .c-view[data-doc="privacy"]'); await p.waitForTimeout(500);
  log('  privacy 표:', JSON.stringify(await p.evaluate(() => {
    const ts = [...document.querySelectorAll('#doc-body table')];
    return ts.map(t => t.innerText.replace(/\n/g, ' | ').slice(0, 200));
  })));
  await p.context().close();

  /* ── D. 작은 화면 (iPhone SE 375x667) ── */
  log('\n=== D. iPhone SE 375x667 ===');
  p = await mk(b, { vp: { width: 375, height: 667 } });
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  log('  c-start 위치:', JSON.stringify(await p.evaluate(() => {
    const r = document.querySelector('#c-start').getBoundingClientRect();
    return { top: +r.top.toFixed(0), bottom: +r.bottom.toFixed(0), vh: innerHeight, 화면안: r.bottom <= innerHeight };
  })));
  log('  마지막 항목(c-mkt)까지 스크롤 가능:', JSON.stringify(await p.evaluate(() => {
    const s = document.querySelector('.consent-scroll');
    s.scrollTop = 99999;
    const r = document.querySelector('#c-mkt').closest('li').getBoundingClientRect();
    return { scrollTop: s.scrollTop, scrollH: s.scrollHeight, clientH: s.clientHeight, mktTop: +r.top.toFixed(0), mktBottom: +r.bottom.toFixed(0), vh: innerHeight };
  })));
  log('  c-mkt hit:', JSON.stringify(await hit(p, '#c-mkt')));
  await p.evaluate(() => { document.querySelector('#c-age').click(); document.querySelector('#c-tos').click(); });
  await p.click('#c-start'); await p.waitForTimeout(600);
  await p.click('#backup-open'); await p.waitForTimeout(500);
  log('  SE 백업시트:', JSON.stringify(await p.evaluate(() => {
    const s = document.querySelector('#backup-sheet .sheet');
    const st = getComputedStyle(s);
    const inp = document.querySelector('#bk-restore-input').getBoundingClientRect();
    const btn = document.querySelector('#bk-restore-btn').getBoundingClientRect();
    const close = document.querySelector('#bk-close').getBoundingClientRect();
    return { sheetH: +s.getBoundingClientRect().height.toFixed(0), vh: innerHeight, overflowY: st.overflowY, maxH: st.maxHeight,
      scrollH: s.scrollHeight, clientH: s.clientHeight,
      입력칸bottom: +inp.bottom.toFixed(0), 복구버튼bottom: +btn.bottom.toFixed(0), 닫기bottom: +close.bottom.toFixed(0) };
  })));
  log('  SE hit bk-restore-btn:', JSON.stringify(await hit(p, '#bk-restore-btn')));
  log('  SE hit bk-close:', JSON.stringify(await hit(p, '#bk-close')));
  await p.screenshot({ path: 'C:/Users/PC/AppData/Local/Temp/claude/C--Users-PC-Desktop---------250703------------/bea100c1-44b1-4d5d-8367-54600f717107/scratchpad/se_backup.png' });
  await p.context().close();

  /* ── E. 카카오톡 인앱 ── */
  log('\n=== E. 카카오톡 인앱 UA ===');
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA.kakao, serviceWorkers: 'block', isMobile: true, hasTouch: true });
    const q = await ctx.newPage();
    const navs = [];
    q.on('framenavigated', f => { if (f === q.mainFrame()) navs.push(f.url()); });
    q.on('pageerror', e => log('  kakao pageerror:', String(e)));
    try { await q.goto(HOST + '/index.html', { waitUntil: 'commit', timeout: 15000 }); } catch (e) { log('  goto:', e.message.split('\n')[0]); }
    await q.waitForTimeout(4000);
    log('  현재 URL:', q.url());
    log('  네비 기록:', JSON.stringify(navs));
    try {
      log('  consent 보임 =', await q.evaluate(() => document.querySelector('#consent-view') ? !document.querySelector('#consent-view').hidden : 'DOM없음'));
    } catch (e) { log('  evaluate 실패:', e.message.split('\n')[0]); }
    await ctx.close();
  }

  /* ── F. 약관 버전 올라가면 재동의 ── */
  log('\n=== F. LEGAL_VERSION 변경 시 재동의 ===');
  p = await mk(b, { init: () => localStorage.setItem('riweather.consent', JSON.stringify({ v: '0.9', tos: true, age14: true, loc: true })) });
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  log('  옛버전 동의 → consent hidden =', await p.evaluate(() => document.querySelector('#consent-view').hidden));
  log('  체크박스 복원:', JSON.stringify(await p.evaluate(() => ({
    age: document.getElementById('c-age').checked, tos: document.getElementById('c-tos').checked, loc: document.getElementById('c-loc').checked }))));
  log('  위치권한 상태 allowsLocation =', await p.evaluate(() => CONSENT.allowsLocation()));
  await p.context().close();

  /* ── G. 저장 실패(시크릿모드 흉내) ── */
  log('\n=== G. localStorage 저장 실패 ===');
  p = await mk(b, { init: () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (String(k).indexOf('riweather.consent') === 0) throw new Error('QuotaExceeded'); return orig.call(this, k, v); };
  } });
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  await p.evaluate(() => { document.getElementById('c-age').click(); document.getElementById('c-tos').click(); });
  await p.click('#c-start'); await p.waitForTimeout(600);
  log('  시작하기 후 consent hidden =', await p.evaluate(() => document.querySelector('#consent-view').hidden));
  log('  안내 문구 있나:', await p.evaluate(() => document.body.innerText.includes('저장') ? '?' : 'none'));
  log('  errs:', JSON.stringify(p.errs));
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
  log('  새로고침 후 consent 다시 뜸 =', await p.evaluate(() => !document.querySelector('#consent-view').hidden));
  await p.context().close();

  /* ── H. 동의화면이 홈을 실제로 막는가 ── */
  log('\n=== H. 동의화면 차단성 ===');
  p = await mk(b);
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  log('  검색창 위치에 뭐가 있나:', JSON.stringify(await p.evaluate(() => {
    const r = document.querySelector('#search-input').getBoundingClientRect();
    const el = document.elementFromPoint(r.left + 10, r.top + r.height / 2);
    return { tag: el && el.tagName, id: el && el.id, cls: el && String(el.className).slice(0, 40) };
  })));
  log('  consent z-index:', await p.evaluate(() => getComputedStyle(document.querySelector('#consent-view')).zIndex));
  await p.context().close();

  /* ── I. 복구코드 입력 여러 형태 ── */
  log('\n=== I. 복구코드 입력 형태 ===');
  const asked = [];
  p = await mk(b, { route: async (route) => {
    const u = route.request().url();
    if (/fn=restore/.test(u)) { asked.push(/code=([^&]*)/.exec(u)?.[1]); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false,"err":"없음"}' }); }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  }, init: () => localStorage.setItem('riweather.consent', JSON.stringify({ v: '1.0', tos: true, age14: true })) });
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  await p.click('#backup-open'); await p.waitForTimeout(300);
  for (const v of ['1111222233', '11112222333', '111122223333', '1111-2222-3333-4444', 'abcd', '  1111 2222 3333  ']) {
    await p.fill('#bk-restore-input', '');
    await p.evaluate(t => { const i = document.querySelector('#bk-restore-input'); i.value = t; }, v);
    await p.click('#bk-restore-btn'); await p.waitForTimeout(900);
    log(`  입력 "${v}" → 입력칸실제값="${await p.evaluate(() => document.querySelector('#bk-restore-input').value)}" msg="${await p.evaluate(() => document.querySelector('#bk-restore-msg').textContent)}"`);
  }
  log('  서버로 보낸 코드:', JSON.stringify(asked));
  // 키보드 입력으로 maxlength 확인
  await p.fill('#bk-restore-input', '');
  await p.click('#bk-restore-input');
  await p.keyboard.type('111122223333');
  log('  타이핑 12자리 후 값:', await p.evaluate(() => document.querySelector('#bk-restore-input').value));
  log('  errs:', JSON.stringify(p.errs));
  await p.context().close();

  await b.close();
  fs.writeFileSync(process.argv[2] || 'out2.txt', OUT.join('\n'), 'utf8');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
