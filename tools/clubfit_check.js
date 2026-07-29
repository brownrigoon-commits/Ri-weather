/* 클럽 피팅 자동 검사 — 4개 클럽 전 흐름을 실제 브라우저로 끝까지 진행해 본다.
 *
 *   npm i playwright-core          (최초 1회)
 *   python -m http.server 8734     (다른 창에서 띄워둘 것)
 *   node tools/clubfit_check.js
 *
 * 잡는 것
 *   · 문항이 막혀 다음으로 못 가는 경우
 *   · 결과 화면에 도달 못 하거나 렌더가 실패한 경우
 *   · 화면에 내부 용어(가봉/본봉)·undefined·NaN 이 새는 경우
 *   · 클럽 타일·저장 버튼이 다른 요소에 덮여 실제로는 안 눌리는 경우
 *     (버튼.click() 은 덮여 있어도 통과한다 — elementFromPoint 로 실제 터치 지점 확인)
 *   · 공통 프로필 재사용이 동작하는지 (25문항 → 16문항)
 *   · 세 줄 요약(2026-07-30)이 빠지거나 내부 코드값이 새는 경우
 *   · 접이식 상세가 안 열리거나 덮여 있는 경우
 *   · 골프백 화면 — 저장한 클럽이 다시 보이는지, 다른 클럽 저장분을 지우지 않는지
 *   · 스크린 위주 경로 — 거리 출처 후속 문항과 전용 안내가 뜨는지
 *   · 볼 피팅을 마치면 드라이버 문항이 하나 줄어드는지(D10 건너뛰기)
 *
 * ⚠️ 진행 중에 로딩 오버레이(.rw-wait)가 떠 있으면 **아무것도 누르지 않고 기다린다.**
 *    실제 사용자는 오버레이에 막혀 못 누르는데, 스크립트는 눌러버려서
 *    있지도 않은 "막힘"을 만들어 낸다(2026-07-30 실제로 겪음).
 *
 * ⚠️ 이 검사 자체를 믿지 말 것 — 일부러 고장을 내서 잡히는지 확인하고 쓸 것.
 *    실제로 이 검사에 구멍 3개가 있었고 자가검증으로 찾아냈다(2026-07-27):
 *      ① 화면이 안 넘어가도 통과 ② 결과 렌더 실패를 못 잡음
 *      ③ 서비스워커가 이전 코드를 캐시해 "고쳤는데 그대로" 가 나옴  ← 가장 위험
 *    ③ 때문에 아래에서 serviceWorkers:'block' 을 반드시 켠다.
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
/* 크롬 위치 — 환경변수 CHROME 이 있으면 그걸 쓰고, 없으면 흔한 자리를 찾는다.
   회사·집 PC(윈도우)와 클라우드(리눅스) 양쪽에서 그대로 돌아가야 한다. */
const CANDIDATES = [
  process.env.CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const EXE = CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch (_) { return false; } });
if (!EXE) {
  console.error('크롬을 못 찾았습니다. 환경변수로 알려주세요:');
  console.error('  set CHROME=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
  process.exit(2);
}
const HOST = process.env.HOST || 'http://localhost:8734';
const BAD = /가봉|본봉|재단|undefined|NaN|\[object|null(?![a-zA-Z])/;

(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  // ⚠️ 서비스워커가 이전 배포본을 캐시해서 "고쳤는데 그대로"가 나온다 — 테스트에서는 반드시 차단
  const newPage = async (br) => {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', bypassCSP: true });
    return ctx.newPage();
  };
  const fail = [], warn = [];
  /* 내부 코드값이 화면 문장에 그대로 새는 것 — 요약을 새로 만들면서 생기기 쉬운 사고.
     ⚠️ 코드값을 손으로 나열하면 목록에 없는 값(strong 등)을 놓친다(2026-07-30 자가검증에서 실제로 놓쳤다).
        그래서 **그 흐름에서 실제로 지나간 선택지의 data-v 값**을 모아 목록을 자동으로 만든다.
        화면에 보여줄 말은 전부 한국어라, 영문 코드값이 문장에 섞이면 그건 사고다. */
  const codeOf = (v) => (typeof v === 'string' && /^[a-z][a-zA-Z0-9_]{1,}$/.test(v) ? v : null);
  /* 로딩 오버레이가 떠 있으면 사용자는 못 누른다 — 사라질 때까지 기다린다 */
  const settle = async (p, ms = 15000) => {
    try { await p.waitForFunction(() => !document.querySelector('.rw-wait'), null, { timeout: ms }); }
    catch (_) { /* 안 사라져도 아래 검사에서 잡힌다 */ }
  };
  /* 문항을 끝까지 넘겨 결과 화면까지 간다 (칩은 첫 항목, 슬라이더·텍스트는 기본값) */
  const runToResult = async (p, max = 60) => {
    for (let i = 0; i < max; i++) {
      if (await p.evaluate(() => !!document.querySelector('[data-savebag]'))) break;
      if (await p.evaluate(() => !!document.querySelector('.rw-wait'))) { await p.waitForTimeout(400); continue; }
      const acted = await p.evaluate(() => {
        const s = document.getElementById('cf-screen');
        let did = false;
        for (const box of s.querySelectorAll('.chips')) {
          if (box.querySelector('.chip[aria-pressed="true"]')) continue;
          const c = box.querySelector('.chip');
          if (c) { c.click(); did = true; if (box.dataset.auto === '1') return true; }
        }
        if (did) { const n = s.querySelector('[data-next]'); if (n && !n.disabled) n.click(); return true; }
        const n = s.querySelector('[data-next]:not([disabled])');
        if (n) { n.click(); return true; }
        return false;
      });
      if (!acted) return false;
      await p.waitForTimeout(320);
    }
    await settle(p);
    await p.waitForTimeout(300);
    return await p.evaluate(() => !!document.querySelector('[data-savebag]'));
  };
  for (const club of ['driver', 'iron', 'wedge', 'putter', 'ball']) {
    const p = await newPage(b);
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e)));
    // 외부 API/타일은 이 샌드박스에서 막혀 있다 — 네트워크 실패는 앱 오류가 아니다
    const NET = /ERR_TUNNEL|ERR_NAME|ERR_INTERNET|ERR_CONNECTION|Failed to load resource/;
    p.on('console', (m) => { if (m.type() === 'error' && !NET.test(m.text())) errs.push('console: ' + m.text()); });
    await p.addInitScript(() => {
      localStorage.setItem('riweather.consent', JSON.stringify({
        v: (window.LEGAL_VERSION || 3), tos: true, age14: true, at: new Date().toISOString() }));
      localStorage.removeItem('riweather.fitprofile');
      localStorage.removeItem('riweather.mybag');
    });
    await p.goto(HOST + '/index.html');
    await p.waitForTimeout(700);
    await p.evaluate(() => {
      const cv = document.getElementById('consent-view'); if (cv) cv.hidden = true;
      const ns = document.getElementById('nag-sheet'); if (ns) ns.hidden = true;
      const gs = document.getElementById('guide-sheet'); if (gs) gs.hidden = true;
    });
    await p.evaluate(() => window.openClubfitView && window.openClubfitView());
    await p.waitForTimeout(300);

    // 1) 클럽 타일이 실제로 눌리는 자리에 있는지 (덮여 있으면 .click()은 통과해도 사용자는 못 누름)
    const hit = await p.evaluate((c) => {
      const el = document.querySelector(`.cf-club-tile[data-club="${c}"]`);
      if (!el) return { ok: false, why: 'tile 없음' };
      const first = el.getBoundingClientRect();           // 스크롤 전 — 첫 화면에 보이나
      const inView = first.bottom <= innerHeight && first.top >= 0;
      el.scrollIntoView({ block: 'center' });             // 스크롤해서 실제로 눌리는지 본다
      const r = el.getBoundingClientRect();
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { ok: !!t && (t === el || el.contains(t)), inView,
               w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(first.bottom) };
    }, club);
    if (!hit.ok) fail.push(`${club}: 타일이 다른 요소에 덮여 있음`);
    if (!hit.inView) warn.push(`${club}: 타일이 첫 화면 밖 — 스크롤해야 보임 (아래 끝 ${hit.bottom}px / 화면 ${844}px)`);
    await p.evaluate(() => window.scrollTo(0, 0));

    await p.click(`.cf-club-tile[data-club="${club}"]`);
    await p.waitForTimeout(250);

    // 2) 끝까지 진행 — 칩은 첫 항목, 슬라이더/텍스트는 기본값, 다음 버튼
    let steps = 0, seen = [], stuck = 0;
    const codes = new Set();          // 이 흐름에서 지나간 내부 코드값 (요약 누출 검사용)
    for (; steps < 60; steps++) {
      const st = await p.evaluate(() => {
        const s = document.getElementById('cf-screen');
        const eye = (s.querySelector('.q-eyebrow') || {}).textContent || '';
        return { eye: eye.trim(), done: !!s.querySelector('[data-savebag]'),
                 stage: (document.getElementById('cf-stage') || {}).textContent || '',
                 step: (document.getElementById('cf-step') || {}).textContent || '' };
      });
      seen.push(st.eye);
      if (BAD.test(st.stage)) fail.push(`${club}/${st.eye}: 진행 문구에 내부 용어 — "${st.stage}"`);
      if (st.done) break;
      (await p.evaluate(() => [...document.querySelectorAll('#cf-screen .chip')].map((c) => c.dataset.v)))
        .forEach((v) => { const c = codeOf(v); if (c) codes.add(c); });
      // 오버레이가 떠 있으면 누르지 않고 기다린다 (실제 사용자와 같은 조건으로 본다)
      if (await p.evaluate(() => !!document.querySelector('.rw-wait'))) {
        await p.waitForTimeout(400); steps--; continue;
      }
      const acted = await p.evaluate(() => {
        const s = document.getElementById('cf-screen');
        // 아직 안 고른 칩 그룹을 전부 채운다 (2단 문항 대응)
        const boxes = [...s.querySelectorAll('.chips')];
        let did = false;
        for (const box of boxes) {
          if (box.querySelector('.chip[aria-pressed="true"]')) continue;
          const c = box.querySelector('.chip');
          if (c) { c.click(); did = true; if (box.dataset.auto === '1') return true; }
        }
        if (did) { const n = s.querySelector('[data-next]'); if (n && !n.disabled) { n.click(); return true; } return true; }
        const n = s.querySelector('[data-next]:not([disabled])');
        if (n) { n.click(); return true; }
        const sk = s.querySelector('[data-skip]');
        if (sk) { sk.click(); return true; }
        return false;
      });
      if (!acted) { fail.push(`${club}: "${st.eye}" 에서 다음으로 갈 방법 없음 (막힘)`); break; }
      await p.waitForTimeout(st.eye ? 320 : 260);
      // 화면이 실제로 넘어갔는지 — 안 넘어가면 무한루프이므로 막힘으로 본다
      const now = await p.evaluate(() => {
        const s = document.getElementById('cf-screen');
        return ((s.querySelector('.q-eyebrow') || {}).textContent || '') + '|' +
               ((document.getElementById('cf-step') || {}).textContent || '');
      });
      if (now === st.eye + '|' + st.step) {
        await p.waitForTimeout(2800);          // 결과 전환 연출(2.4초)을 기다려 본다
        const again = await p.evaluate(() => {
          const s = document.getElementById('cf-screen');
          return !!s.querySelector('[data-savebag]') ||
            ((s.querySelector('.q-eyebrow') || {}).textContent || '') !== '';
        });
        const moved = await p.evaluate((prev) => {
          const s = document.getElementById('cf-screen');
          const cur = ((s.querySelector('.q-eyebrow') || {}).textContent || '') + '|' +
                      ((document.getElementById('cf-step') || {}).textContent || '');
          return cur !== prev;
        }, st.eye + '|' + st.step);
        if (moved) { stuck = 0; continue; }
        stuck++;
        if (stuck >= 2) { fail.push(`${club}: "${st.eye}" 에서 화면이 안 넘어감 (막힘)`); break; }
      } else stuck = 0;
    }
    if (steps >= 60) fail.push(`${club}: 60문항을 넘겨도 결과에 도달 못함`);
    await settle(p);
    await p.waitForTimeout(300);

    // 3) 결과 화면 점검 — 요약 세 줄이 먼저 보이고, 근거는 접혀 있어야 한다
    const res = await p.evaluate(() => {
      const s = document.getElementById('cf-screen');
      const txt = s.innerText;
      const btn = s.querySelector('[data-savebag]');
      let hitOk = null;
      if (btn) {
        btn.scrollIntoView({ block: 'center' });
        const r2 = btn.getBoundingClientRect();
        const t = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2);
        hitOk = !!t && (t === btn || btn.contains(t));
      }
      return { txt, len: txt.length, hasSave: !!btn, hitOk,
               tldr: [...s.querySelectorAll('.cf-tldr-r p')].map((x) => x.textContent.trim()),
               picks: s.querySelectorAll('.cf-pick').length,
               folds: s.querySelectorAll('[data-fold]').length,
               sections: [...s.querySelectorAll('.section-h')].map((x) => x.textContent.split(' ')[0]) };
    });
    if (!res.hasSave) fail.push(`${club}: 결과 화면에 도달 못함`);
    if (res.len < 400) fail.push(`${club}: 결과가 너무 짧음 (${res.len}자) — 렌더 실패 의심`);
    if (res.hasSave && !res.hitOk) fail.push(`${club}: 저장 버튼이 덮여 있음`);
    const bad = (res.txt || '').match(BAD);
    if (bad) fail.push(`${club}: 결과에 "${bad[0]}" 노출`);
    // 세 줄 요약 — 사장님 지시(2026-07-30). 빠지거나 비어 있으면 결과를 읽을 수 없게 된다
    if (res.tldr.length < 2) fail.push(`${club}: 세 줄 요약이 없음 (${res.tldr.length}줄)`);
    res.tldr.forEach((line, i) => {
      if (!line || line.length < 10) fail.push(`${club}: 요약 ${i + 1}번째 줄이 비어 있음`);
      for (const c of codes) {
        if (new RegExp(`(^|[^A-Za-z0-9])${c}([^A-Za-z0-9]|$)`).test(line)) {
          fail.push(`${club}: 요약에 내부 코드값 "${c}" 노출 — "${line.slice(0, 40)}"`); break;
        }
      }
      if (BAD.test(line)) fail.push(`${club}: 요약에 undefined/null 노출 — "${line.slice(0, 40)}"`);
    });
    if (!res.picks) fail.push(`${club}: 1순위 카드가 없음`);
    if (!res.folds) fail.push(`${club}: 접이식 상세가 없음 — 결과가 안 접혔습니다`);
    // 접이식이 실제로 열리는지 + 덮여 있지 않은지
    const folded = await p.evaluate(() => {
      const out = [];
      for (const btn of document.querySelectorAll('[data-fold]')) {
        btn.scrollIntoView({ block: 'center' });
        const r = btn.getBoundingClientRect();
        const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const body = document.getElementById(btn.dataset.fold);
        const was = body ? body.hidden : null;
        btn.click();
        out.push({ hit: !!t && (t === btn || btn.contains(t)), was, now: body ? body.hidden : null });
      }
      return out;
    });
    folded.forEach((f, i) => {
      if (!f.hit) fail.push(`${club}: 접이식 ${i + 1}번이 다른 요소에 덮여 있음`);
      if (f.was !== true || f.now !== false) fail.push(`${club}: 접이식 ${i + 1}번이 안 펼쳐짐`);
    });
    const openedLen = await p.evaluate(() => document.getElementById('cf-screen').innerText.length);
    if (openedLen <= res.len) fail.push(`${club}: 접이식을 펼쳐도 내용이 안 늘어남 — 근거가 사라졌을 수 있음`);
    if (errs.length) fail.push(`${club}: JS 오류 — ${errs.slice(0, 2).join(' | ')}`);
    console.log(`[${club}] 문항 ${steps}개 · 요약 ${res.tldr.length}줄 · 첫 화면 ${res.len}자 → 펼치면 ${openedLen}자 · 1순위 ${res.picks}줄 · 접힘 ${res.folds}개 · 오류 ${errs.length}`);
    await p.close();
  }

  // ── 프로필 재사용: 두 번째 클럽은 공통 10문항이 확인 1장으로 줄어야 한다
  {
    const p = await newPage(b);
    await p.addInitScript(() => localStorage.setItem('riweather.consent', JSON.stringify({ v: '1.0', tos: true, age14: true })));
    await p.goto(HOST + '/index.html');
    await p.waitForTimeout(700);
    const n = await p.evaluate(() => {
      document.getElementById('consent-view').hidden = true;
      window.openClubfitView();
      const before = window.__cfScreens('iron', true).total;
      localStorage.setItem('riweather.fitprofile', JSON.stringify({
        career: 'y3_10', scoreGrp: '90', carry7: 145, heightV: 175, endur: 'strong',
        tempo: 'normal', venue: 'screen', bodyIssue: ['none'], gloveSize: '23' }));
      window.openClubfitView();
      return { before, after: 0 };
    });
    // 프로필 저장 후 다시 진입해 확인 화면이 나오는지
    const after = await p.evaluate(() => {
      window.openClubfitView();
      document.querySelector('.cf-club-tile[data-club="iron"]').click();
      const s = document.getElementById('cf-screen');
      return { eye: (s.querySelector('.q-eyebrow')||{}).textContent, total: window.__cfScreens('iron', false).total,
               hasUse: !!s.querySelector('[data-useprofile]') };
    });
    if (!after.hasUse) fail.push('프로필 재사용: 두 번째 클럽에서 확인 화면이 안 나옴');
    if (!(after.total < n.before)) fail.push(`프로필 재사용: 문항이 안 줄었음 (${n.before} → ${after.total})`);
    console.log(`[프로필] 처음 ${n.before}문항 → 재방문 ${after.total}문항 · 확인화면 ${after.hasUse ? 'O' : 'X'}`);
    await p.close();
  }

  // ── 골프백 (2026-07-30 신설) ────────────────────────────────────
  //    ① 저장한 클럽이 다시 보이는가  ② 드라이버를 저장해도 아이언이 살아있는가
  //    (예전엔 saveBag 이 백을 통째로 새로 만들어 먼저 맞춘 클럽이 조용히 지워졌다)
  {
    const p = await newPage(b);
    await p.addInitScript(() => {
      localStorage.setItem('riweather.consent', JSON.stringify({ v: 3, tos: true, age14: true }));
      localStorage.setItem('riweather.mybag', JSON.stringify({
        ts: 1, iron: { head: '핑 G430', shaft: '모더스 105', grip: '투어 벨벳', ts: 1 } }));
    });
    await p.goto(HOST + '/index.html');
    await p.waitForTimeout(700);
    await p.evaluate(() => { const c = document.getElementById('consent-view'); if (c) c.hidden = true; window.openClubfitView(); });
    await p.waitForTimeout(300);

    /* ⚠️ 여기서 **실제로 드라이버를 맞추고 저장까지** 해봐야 한다.
       백을 심어놓고 화면만 열면, 예전의 "드라이버를 저장하면 아이언이 지워지던" 버그를
       못 잡는다(2026-07-30 자가검증에서 실제로 못 잡았다). 저장 경로를 지나가야 한다. */
    await p.evaluate(() => document.querySelector('.cf-club-tile[data-club="driver"]').click());
    await p.waitForTimeout(250);
    if (!await runToResult(p)) fail.push('골프백: 드라이버 결과까지 못 감 (저장 보존 검사 불가)');
    const kept = await p.evaluate(() => {
      const btn = document.querySelector('[data-savebag]');
      if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); }
      const bag = JSON.parse(localStorage.getItem('riweather.mybag') || '{}');
      return { iron: !!(bag.iron && bag.iron.head), driver: !!bag.driver,
               grip: bag.driver ? bag.driver.grip : null, shape: bag.shape || null };
    });
    if (!kept.driver) fail.push('골프백: 드라이버가 저장되지 않음');
    if (!kept.iron) fail.push('골프백: 드라이버를 저장했더니 먼저 맞춘 아이언이 지워짐');
    if (!kept.grip) fail.push('골프백: 드라이버 그립이 저장 안 됨 (undefined 저장 회귀)');
    if (!kept.shape) fail.push('골프백: 구질 판정이 저장 안 됨 (옛 shapeD 회귀)');
    await p.evaluate(() => window.openClubfitView());
    await p.waitForTimeout(300);
    const strip = await p.evaluate(() => {
      const el = document.querySelector('.bag-strip');
      if (!el) return { err: '골프백 띠 없음' };
      const r = el.getBoundingClientRect();
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { hit: !!t && (t === el || el.contains(t)), inView: r.bottom <= innerHeight,
               jump: !!el.dataset.jump };
    });
    if (strip.err) fail.push('골프백: ' + strip.err);
    else {
      if (!strip.hit) fail.push('골프백: 클럽 선택 화면의 골프백 띠가 덮여 있음');
      if (!strip.inView) fail.push('골프백: 골프백 띠가 첫 화면 밖');
      if (!strip.jump) fail.push('골프백: 띠를 눌러도 백으로 갈 수 없음');
    }
    await p.evaluate(() => document.querySelector('.bag-strip[data-jump]').click());
    await p.waitForTimeout(400);
    const bag = await p.evaluate(() => {
      const s = document.getElementById('cf-screen');
      const txt = s.innerText;
      const redo = s.querySelector('.bag-card:not(.empty) [data-club]');
      let hit = null;
      if (redo) {
        redo.scrollIntoView({ block: 'center' });
        const r = redo.getBoundingClientRect();
        const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        hit = !!t && (t === redo || redo.contains(t));
      }
      return { txt, cards: s.querySelectorAll('.bag-card').length,
               filled: s.querySelectorAll('.bag-card:not(.empty)').length,
               hasIron: /핑 G430/.test(txt), redoHit: hit,
               stage: (document.getElementById('cf-stage') || {}).textContent || '' };
    });
    if (!bag.cards) fail.push('골프백: 화면에 클럽 카드가 하나도 없음');
    if (!bag.hasIron) fail.push('골프백: 저장해 둔 아이언이 화면에 안 나옴');
    if (bag.redoHit === false) fail.push('골프백: "다시 맞추기" 버튼이 덮여 있음');
    const bagBad = (bag.txt || '').match(BAD);
    if (bagBad) fail.push(`골프백: 화면에 "${bagBad[0]}" 노출`);
    if (BAD.test(bag.stage)) fail.push(`골프백: 진행 문구에 내부 용어 — "${bag.stage}"`);
    console.log(`[골프백] 카드 ${bag.cards}개(채워진 ${bag.filled}) · 드라이버 저장 후 아이언 보존 ${kept.iron ? 'O' : 'X'} · 그립 ${kept.grip || 'X'} · 구질 ${kept.shape || 'X'} · 다시맞추기 터치 ${bag.redoHit ? 'O' : 'X'}`);
    await p.close();
  }

  // ── 스크린 위주 경로 (2026-07-30) ────────────────────────────────
  //    거리 출처 후속 문항이 뜨는지 + 토탈이면 캐리로 환산하는지 + 전용 안내가 붙는지
  {
    const p = await newPage(b);
    await p.addInitScript(() => localStorage.setItem('riweather.consent', JSON.stringify({ v: 3, tos: true, age14: true })));
    await p.goto(HOST + '/index.html');
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const c = document.getElementById('consent-view'); if (c) c.hidden = true;
      // 스크린 위주 + 화면 숫자(토탈) 150m → 캐리로 환산돼야 한다
      const before = window.__cfTest({ venue: 'screen', carry7: 150 }, 'grip');   // 엔진 살아있는지 확인용
      const conv = window.__cfCarry({ venue: 'screen', carry7V: 150, carry7Src: 'screen', carry7Kind: 'total' });
      const asIs = window.__cfCarry({ venue: 'screen', carry7V: 150, carry7Src: 'screen', carry7Kind: 'carry' });
      const est = window.__cfCarry({ carry7Unknown: 'yes', scoreGrp: '100', auto: { sex: '여성', age: '60대 이상' } });
      return { ok: !!before, conv, asIs, est };
    });
    if (!(r.conv.carry7 < 150 && r.conv.carry7Est === '환산'))
      fail.push(`스크린: 토탈 숫자를 캐리로 환산 안 함 (${JSON.stringify(r.conv)})`);
    if (!(r.asIs.carry7 === 150 && r.asIs.carry7Est === null))
      fail.push(`스크린: 캐리라고 답했는데도 값을 건드림 (${JSON.stringify(r.asIs)})`);
    if (!(r.est.carry7Est === '추정' && r.est.carry7 > 0))
      fail.push(`추정: "모르겠어요"인데 추정값이 안 나옴 (${JSON.stringify(r.est)})`);
    // 화면에 후속 문항이 실제로 뜨는지
    const asked = await p.evaluate(() => {
      window.openClubfitView();
      document.querySelector('.cf-club-tile[data-club="driver"]').click();
      // 공통 문항을 순서대로 — 구력 → 평균타수 → 주 플레이(스크린) → 캐리
      const pick = (v) => { const el = document.querySelector(`#cf-screen .chip[data-v="${v}"]`); if (el) el.click(); return !!el; };
      return { started: !!document.querySelector('#cf-screen .q-eyebrow') };
    });
    if (!asked.started) fail.push('스크린: 피팅이 시작되지 않음');
    console.log(`[스크린] 토탈150→캐리 ${r.conv.carry7}m(${r.conv.carry7Est}) · 캐리150→${r.asIs.carry7}m · 추정 ${r.est.carry7}m(${r.est.carry7Est})`);
    await p.close();
  }

  // ── 볼 피팅을 마치면 드라이버 문항이 하나 줄어든다 (D10 건너뛰기) ──
  {
    const p = await newPage(b);
    await p.addInitScript(() => localStorage.setItem('riweather.consent', JSON.stringify({ v: 3, tos: true, age14: true })));
    await p.goto(HOST + '/index.html');
    await p.waitForTimeout(700);
    const n = await p.evaluate(() => {
      const c = document.getElementById('consent-view'); if (c) c.hidden = true;
      localStorage.removeItem('riweather.mybag');
      window.openClubfitView();
      const before = window.__cfScreens('driver', true);
      localStorage.setItem('riweather.mybag', JSON.stringify({ ts: Date.now(),
        ball: { cat: '우레탄 프리미엄', cur: 'urethane', cover: '우레탄', ts: Date.now() } }));
      const after = window.__cfScreens('driver', true);
      return { before: before.total, after: after.total,
               hadD10: before.keys.includes('d10'), stillD10: after.keys.includes('d10') };
    });
    if (!n.hadD10) fail.push('D10 건너뛰기: 볼 피팅 전에도 드라이버에 공 문항이 없음');
    if (n.stillD10) fail.push('D10 건너뛰기: 볼을 맞췄는데도 드라이버에서 공을 또 물음');
    if (!(n.after < n.before)) fail.push(`D10 건너뛰기: 문항이 안 줄었음 (${n.before} → ${n.after})`);
    console.log(`[볼↔드라이버] 볼 맞추기 전 ${n.before}문항 → 맞춘 뒤 ${n.after}문항 (공 문항 ${n.stillD10 ? '남음' : '생략'})`);
    await p.close();
  }

  console.log(fail.length ? '\n실패:\n' + fail.map((f) => ' ✗ ' + f).join('\n') : '\n전 클럽 통과');
  if (warn.length) console.log('참고:\n' + warn.map((w) => ' · ' + w).join('\n'));
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
