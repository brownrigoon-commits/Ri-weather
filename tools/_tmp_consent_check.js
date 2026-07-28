/* 약관 동의 + 기록 백업/복구 + 홈화면 추가 검사 (신규 사용자 상태) */
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe']
  .find(p => { try { return fs.existsSync(p); } catch (_) { return false; } });
const HOST = 'http://localhost:8734';
const OUT = [];
const log = (...a) => { const s = a.join(' '); OUT.push(s); console.log(s); };

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  kakao: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.5.0',
  naver: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 1000; 12.0)',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

async function mk(b, ua, opts = {}) {
  const ctx = await b.newContext({
    viewport: opts.viewport || { width: 390, height: 844 },
    userAgent: ua, serviceWorkers: 'block', bypassCSP: true,
    isMobile: opts.mobile !== false, hasTouch: opts.mobile !== false,
    deviceScaleFactor: 2,
  });
  const p = await ctx.newPage();
  const errs = [];
  const NET = /ERR_TUNNEL|ERR_NAME|ERR_INTERNET|ERR_CONNECTION|Failed to load resource|net::/;
  p.on('pageerror', e => errs.push('pageerror: ' + String(e)));
  p.on('console', m => { if (m.type() === 'error' && !NET.test(m.text())) errs.push('console: ' + m.text()); });
  p.errs = errs;
  // 백엔드 호출은 라우트로 가로채 실서버에 쓰지 않는다
  if (opts.route) await ctx.route('**script.google.com/**', opts.route);
  return p;
}

// 화면에 실제로 보이는 텍스트에 사고 문구가 있는지
const BADRE = /undefined|NaN|\[object|\bnull\b/;
async function scanBad(p, tag) {
  const hits = await p.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const t = (n.nodeValue || '').trim();
      if (!t) continue;
      const el = n.parentElement;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none' || st.opacity === '0') continue;
      if (/undefined|NaN|\[object|\bnull\b/.test(t)) out.push(el.id + '|' + el.className + '|' + t.slice(0, 90));
    }
    return out;
  });
  if (hits.length) log(`  [BAD:${tag}]`, JSON.stringify(hits));
  return hits;
}

async function hitTest(p, sel) {
  return p.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return { sel: s, missing: true };
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return { sel: s, zero: true };
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    const covered = !(top === el || el.contains(top) || (top && top.contains(el)));
    return { sel: s, w: +r.width.toFixed(1), h: +r.height.toFixed(1), covered,
      topId: covered && top ? (top.id || top.className || top.tagName) : null,
      inView: r.top >= 0 && r.bottom <= innerHeight };
  }, sel);
}

async function overflowCheck(p) {
  return p.evaluate(() => {
    const de = document.documentElement;
    const over = de.scrollWidth > de.clientWidth + 1;
    const bad = [];
    if (over) {
      document.querySelectorAll('*').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width && r.right > de.clientWidth + 1 && getComputedStyle(el).visibility !== 'hidden')
          bad.push((el.id || el.className || el.tagName) + ' right=' + r.right.toFixed(0));
      });
    }
    return { over, scrollW: de.scrollWidth, clientW: de.clientWidth, bad: bad.slice(0, 8) };
  });
}

(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

  /* ══════════ 1. 신규 사용자 첫 진입 ══════════ */
  log('=== 1. 신규 사용자 첫 진입 (iPhone Safari) ===');
  let p = await mk(b, UA.iphoneSafari);
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  log('  localStorage keys:', JSON.stringify(await p.evaluate(() => Object.keys(localStorage))));
  log('  consent-view hidden =', await p.evaluate(() => document.querySelector('#consent-view').hidden));
  log('  APP_VER =', await p.evaluate(() => window.APP_VER), ' consent-ver 표시 =', await p.evaluate(() => document.querySelector('#consent-ver').textContent));
  await scanBad(p, 'consent');
  log('  가로스크롤:', JSON.stringify(await overflowCheck(p)));

  // 동의화면 위 요소 히트테스트 + 크기
  for (const s of ['#c-all', '#c-age', '#c-tos', '#c-loc', '#c-profile', '#c-mkt', '#c-start', '#c-later']) {
    log('  hit', JSON.stringify(await hitTest(p, s)));
  }
  // 체크박스/라벨 실제 터치영역
  const tapSizes = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('#consent-view button, #consent-view input[type=checkbox]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const lab = el.closest('label');
      const lr = lab ? lab.getBoundingClientRect() : null;
      out.push({ id: el.id || el.className, w: +r.width.toFixed(1), h: +r.height.toFixed(1),
        labelH: lr ? +lr.height.toFixed(1) : null });
    });
    return out;
  });
  log('  터치영역:', JSON.stringify(tapSizes));
  log('  errs:', JSON.stringify(p.errs));

  /* ── 시작하기 미체크 상태로 누르기 ── */
  log('--- 필수 미체크 상태로 시작하기 ---');
  await p.click('#c-start');
  await p.waitForTimeout(900);
  log('  warn:', JSON.stringify(await p.evaluate(() => { const w = document.querySelector('#c-warn'); return w ? { txt: w.textContent, vis: !!w.getBoundingClientRect().height } : null; })));
  log('  consent-view 여전히 열림 =', await p.evaluate(() => !document.querySelector('#consent-view').hidden));

  /* ── 전체 동의 ── */
  log('--- 전체 동의하기 ---');
  await p.click('#c-all');
  await p.waitForTimeout(400);
  log('  체크상태:', JSON.stringify(await p.evaluate(() => ({
    all: c('c-all'), age: c('c-age'), tos: c('c-tos'), loc: c('c-loc'), profile: c('c-profile'), mkt: c('c-mkt'),
    profileInputHidden: document.querySelector('#profile-input').hidden,
    startOff: document.querySelector('#c-start').classList.contains('is-off'),
  })).catch(() => null) || {}));
  // c() 안전판
  const st1 = await p.evaluate(() => {
    const g = id => document.getElementById(id).checked;
    return { all: g('c-all'), age: g('c-age'), tos: g('c-tos'), loc: g('c-loc'), profile: g('c-profile'), mkt: g('c-mkt'),
      profileInputHidden: document.querySelector('#profile-input').hidden,
      startOff: document.querySelector('#c-start').classList.contains('is-off') };
  });
  log('  체크상태2:', JSON.stringify(st1));
  await scanBad(p, 'after-all');
  log('  가로스크롤(전체동의후):', JSON.stringify(await overflowCheck(p)));
  // 프로필 칩 터치영역
  log('  칩 개수/크기:', JSON.stringify(await p.evaluate(() => {
    const out = {};
    ['pi-age', 'pi-gender', 'pi-years', 'pi-avg'].forEach(id => {
      const h = document.getElementById(id);
      const cs = [...h.querySelectorAll('.pi-chip')];
      const r = cs[0] && cs[0].getBoundingClientRect();
      out[id] = { n: cs.length, h: r ? +r.height.toFixed(1) : null, w: r ? +r.width.toFixed(1) : null };
    });
    return out;
  })));

  /* ── 전체동의 해제 → 개별 해제 시 all 동기화 ── */
  await p.click('#c-mkt');   // 하나 끄기
  await p.waitForTimeout(200);
  log('  개별해제 후 all =', await p.evaluate(() => document.getElementById('c-all').checked));

  /* ── 약관 4종 보기 ── */
  log('--- 약관 4종 보기 ---');
  for (const doc of ['tos', 'loc', 'profile', 'privacy']) {
    const btn = `#consent-view .c-view[data-doc="${doc}"], .consent-actions .c-view[data-doc="${doc}"]`;
    const has = await p.evaluate(s => !!document.querySelector(s), btn);
    if (!has) { log('  [MISS] 버튼 없음', doc); continue; }
    const ht = await hitTest(p, btn.split(',')[0].trim());
    await p.click(btn.split(',')[0].trim(), { force: false }).catch(async () => { await p.click(btn.split(',')[1].trim()); });
    await p.waitForTimeout(600);
    const info = await p.evaluate(() => {
      const sh = document.querySelector('#doc-sheet');
      const body = document.querySelector('#doc-body');
      return { hidden: sh.hidden, title: document.querySelector('#doc-title').textContent,
        len: body.textContent.length, scrollH: body.scrollHeight, clientH: body.clientHeight,
        head: body.textContent.slice(0, 60).replace(/\s+/g, ' '),
        emptyRow: /<th><\/th>|<td><\/td>/.test(body.innerHTML) };
    });
    log(`  [${doc}]`, JSON.stringify({ ...info, hit: ht }));
    await scanBad(p, 'doc-' + doc);
    // 닫기 버튼 히트테스트
    log('    close hit:', JSON.stringify(await hitTest(p, '#doc-close')));
    await p.click('#doc-close');
    await p.waitForTimeout(300);
    log('    닫힘 =', await p.evaluate(() => document.querySelector('#doc-sheet').hidden));
  }

  /* ── 시작하기 ── */
  log('--- 시작하기 (필수 체크됨) ---');
  await p.click('#c-start');
  await p.waitForTimeout(800);
  log('  consent-view hidden =', await p.evaluate(() => document.querySelector('#consent-view').hidden));
  log('  저장된 consent:', await p.evaluate(() => localStorage.getItem('riweather.consent')));
  log('  errs:', JSON.stringify(p.errs));
  await scanBad(p, 'home-after-consent');
  log('  홈 가로스크롤:', JSON.stringify(await overflowCheck(p)));
  log('  install-cta:', JSON.stringify(await p.evaluate(() => {
    const c = document.querySelector('#install-cta');
    return { hidden: c.hidden, title: document.querySelector('#install-title').textContent,
      sub: document.querySelector('#install-sub').textContent };
  })));
  await p.context().close();

  /* ══════════ 2. '나중에 하기' 흐름 ══════════ */
  log('\n=== 2. 나중에 하기 → nag ===');
  p = await mk(b, UA.iphoneSafari);
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2200);
  await p.click('#c-later');
  await p.waitForTimeout(400);
  log('  consent hidden =', await p.evaluate(() => document.querySelector('#consent-view').hidden));
  log('  nag storage =', await p.evaluate(() => localStorage.getItem('riweather.consent.nag')));
  // 새로고침 시 다시 안 뜨는지
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  log('  재진입 consent hidden =', await p.evaluate(() => document.querySelector('#consent-view').hidden));
  // nag bump 5회
  const bumped = await p.evaluate(() => {
    if (typeof CONSENT_NAG === 'undefined') return 'CONSENT_NAG not global';
    for (let i = 0; i < 5; i++) CONSENT_NAG.bump();
    return document.querySelector('#nag-sheet').hidden;
  });
  log('  bump5 후 nag-sheet hidden =', bumped);
  const nagVis = await p.evaluate(() => document.querySelector('#nag-sheet').hidden);
  if (!nagVis) {
    log('  nag hit:', JSON.stringify(await hitTest(p, '#nag-go')), JSON.stringify(await hitTest(p, '#nag-later')));
    await p.click('#nag-go'); await p.waitForTimeout(500);
    log('  nag-go → consent 열림 =', await p.evaluate(() => !document.querySelector('#consent-view').hidden));
  }
  log('  errs:', JSON.stringify(p.errs));
  await p.context().close();

  /* ══════════ 3. 기록 지키기 — 백엔드 정상 ══════════ */
  log('\n=== 3. 기록 지키기 (백엔드 정상 응답 모킹) ===');
  const okRoute = async (route) => {
    const u = route.request().url();
    if (/fn=restore/.test(u)) {
      const code = /code=(\d+)/.exec(u)?.[1];
      if (code === '111122223333') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {
          v: 1, t: Date.now(),
          courses: [{ name: '테스트CC', lat: 37.5, lon: 127.0, addr: '서울' }],
          scores: [{ id: 'x1', date: '2026-07-01', course: '테스트CC', total: 88 }],
          profile: { years: '3~5년' }, defaultTee: 'white' } }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, err: '없음' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  };
  p = await mk(b, UA.iphoneSafari, { route: okRoute });
  await p.addInitScript(() => {
    localStorage.setItem('riweather.consent', JSON.stringify({ v: '1.0', tos: true, age14: true, at: new Date().toISOString() }));
  });
  await p.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2200);
  log('  empty-state hidden =', await p.evaluate(() => document.querySelector('#empty-state').hidden));
  log('  backup-open-empty hit:', JSON.stringify(await hitTest(p, '#backup-open-empty')));
  log('  backup-open hit:', JSON.stringify(await hitTest(p, '#backup-open')));
  await p.click('#backup-open');
  await p.waitForTimeout(500);
  log('  sheet hidden =', await p.evaluate(() => document.querySelector('#backup-sheet').hidden));
  log('  bk-state:', JSON.stringify(await p.evaluate(() => document.querySelector('#bk-state').textContent)));
  for (const s of ['#bk-enable', '#bk-restore-input', '#bk-restore-btn', '#bk-close', '#bk-copy'])
    log('  hit', JSON.stringify(await hitTest(p, s)));
  log('  input fontSize:', await p.evaluate(() => getComputedStyle(document.querySelector('#bk-restore-input')).fontSize));
  await scanBad(p, 'backup-sheet');
  log('  sheet 가로스크롤:', JSON.stringify(await overflowCheck(p)));

  // 백업 켜기
  await p.click('#bk-enable');
  await p.waitForTimeout(1800);
  log('  백업켜기 후 state:', JSON.stringify(await p.evaluate(() => ({
    state: document.querySelector('#bk-state').textContent,
    codeWrapHidden: document.querySelector('#bk-code-wrap').hidden,
    code: document.querySelector('#bk-code').textContent,
    enableHidden: document.querySelector('#bk-enable').hidden,
    ls: localStorage.getItem('riweather.backup'),
  }))));
  await scanBad(p, 'backup-on');

  // 복구 — 잘못된 코드
  await p.fill('#bk-restore-input', '1234');
  await p.click('#bk-restore-btn'); await p.waitForTimeout(600);
  log('  짧은코드 msg:', await p.evaluate(() => document.querySelector('#bk-restore-msg').textContent));
  await p.fill('#bk-restore-input', '9999-8888-7777');
  await p.click('#bk-restore-btn'); await p.waitForTimeout(1200);
  log('  없는코드 msg:', await p.evaluate(() => document.querySelector('#bk-restore-msg').textContent));
  // 복구 — 성공
  await p.fill('#bk-restore-input', '1111-2222-3333');
  log('  input에 실제 들어간 값:', await p.evaluate(() => document.querySelector('#bk-restore-input').value));
  await p.click('#bk-restore-btn'); await p.waitForTimeout(1500);
  log('  성공 msg:', await p.evaluate(() => document.querySelector('#bk-restore-msg').textContent));
  log('  복구 후 courses:', await p.evaluate(() => localStorage.getItem('riweather.courses')));
  log('  복구 후 backup ls:', await p.evaluate(() => localStorage.getItem('riweather.backup')));
  log('  errs:', JSON.stringify(p.errs));
  await scanBad(p, 'after-restore');
  await p.context().close();

  /* ══════════ 4. 기록 지키기 — 백엔드 실패/구버전 ══════════ */
  log('\n=== 4. 백엔드 실패 케이스 ===');
  for (const [name, route] of [
    ['연결실패', async r => r.abort()],
    ['구버전백엔드(service만)', async r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ service: 'riweather' }) })],
    ['ok:false', async r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, err: 'no sheet' }) })],
  ]) {
    const q = await mk(b, UA.iphoneSafari, { route });
    await q.addInitScript(() => localStorage.setItem('riweather.consent', JSON.stringify({ v: '1.0', tos: true, age14: true })));
    await q.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
    await q.waitForTimeout(2000);
    await q.click('#backup-open'); await q.waitForTimeout(400);
    await q.click('#bk-enable');
    await q.waitForTimeout(3000);
    log(`  [${name}] 백업켜기 →`, JSON.stringify(await q.evaluate(() => ({
      state: document.querySelector('#bk-state').textContent.replace(/\n/g, ' / '),
      enableTxt: document.querySelector('#bk-enable').textContent,
      enableDisabled: document.querySelector('#bk-enable').disabled,
      enableHidden: document.querySelector('#bk-enable').hidden,
      ls: localStorage.getItem('riweather.backup'),
    }))));
    await q.fill('#bk-restore-input', '1111-2222-3333');
    await q.click('#bk-restore-btn'); await q.waitForTimeout(2500);
    log(`  [${name}] 복구 msg:`, await q.evaluate(() => document.querySelector('#bk-restore-msg').textContent));
    log(`  [${name}] errs:`, JSON.stringify(q.errs));
    await q.context().close();
  }

  /* ══════════ 5. 홈화면 추가 — 기기별 ══════════ */
  log('\n=== 5. 홈화면 추가 기기별 ===');
  for (const [name, ua, mobile] of [
    ['iPhone Safari', UA.iphoneSafari, true],
    ['iPhone Chrome', UA.iphoneChrome, true],
    ['Android Chrome', UA.android, true],
    ['KakaoTalk 인앱', UA.kakao, true],
    ['Naver 인앱', UA.naver, true],
    ['PC Chrome', UA.desktop, false],
  ]) {
    const q = await mk(b, ua, { mobile, viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 } });
    await q.addInitScript(() => localStorage.setItem('riweather.consent', JSON.stringify({ v: '1.0', tos: true, age14: true })));
    await q.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
    await q.waitForTimeout(2200);
    const cta = await q.evaluate(() => {
      const c = document.querySelector('#install-cta');
      const r = c.getBoundingClientRect();
      return { hidden: c.hidden, title: document.querySelector('#install-title').textContent,
        sub: document.querySelector('#install-sub').textContent, h: +r.height.toFixed(1) };
    });
    log(`  [${name}] cta:`, JSON.stringify(cta));
    if (!cta.hidden) {
      log(`    btn hit:`, JSON.stringify(await hitTest(q, '#btn-install')));
      log(`    x hit:`, JSON.stringify(await hitTest(q, '#install-dismiss')));
      await q.click('#btn-install'); await q.waitForTimeout(600);
      const g = await q.evaluate(() => {
        const s = document.querySelector('#guide-sheet');
        return { hidden: s.hidden, title: document.querySelector('#guide-title').textContent,
          desc: document.querySelector('#guide-desc').textContent.replace(/\s+/g, ' '),
          steps: [...document.querySelectorAll('#guide-steps li')].map(l => l.textContent.replace(/\s+/g, ' ')),
          copyHidden: document.querySelector('#guide-copy').hidden };
      });
      log(`    guide:`, JSON.stringify(g));
      await scanBad(q, 'guide-' + name);
      if (!g.hidden) {
        log('    close hit:', JSON.stringify(await hitTest(q, '#guide-close')));
        await q.click('#guide-close'); await q.waitForTimeout(300);
        log('    닫힘 =', await q.evaluate(() => document.querySelector('#guide-sheet').hidden));
      }
      // 닫기(X) → 스누즈
      await q.click('#install-dismiss'); await q.waitForTimeout(300);
      log('    dismiss 후 hidden =', await q.evaluate(() => document.querySelector('#install-cta').hidden),
        ' snooze =', await q.evaluate(() => localStorage.getItem('riweather.install.snooze')));
      await q.reload({ waitUntil: 'domcontentloaded' }); await q.waitForTimeout(1800);
      log('    재진입 hidden =', await q.evaluate(() => document.querySelector('#install-cta').hidden));
    }
    log(`  [${name}] errs:`, JSON.stringify(q.errs));
    await q.context().close();
  }

  /* ══════════ 6. standalone(홈화면앱) 최초진입 안내문 ══════════ */
  log('\n=== 6. standalone 최초진입 ===');
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA.iphoneSafari,
      serviceWorkers: 'block', isMobile: true, hasTouch: true });
    const q = await ctx.newPage();
    q.errs = []; q.on('pageerror', e => q.errs.push(String(e)));
    await q.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
    await q.goto(HOST + '/index.html', { waitUntil: 'domcontentloaded' });
    await q.waitForTimeout(2200);
    log('  consent hidden =', await q.evaluate(() => document.querySelector('#consent-view').hidden));
    log('  standalone-note hidden =', await q.evaluate(() => document.querySelector('#consent-standalone-note').hidden));
    log('  install-cta hidden =', await q.evaluate(() => document.querySelector('#install-cta').hidden));
    await ctx.close();
  }

  await b.close();
  fs.writeFileSync(process.argv[2] || 'out.txt', OUT.join('\n'), 'utf8');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
