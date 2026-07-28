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
  for (const club of ['driver', 'iron', 'wedge', 'putter']) {
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
      const r = el.getBoundingClientRect();
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { ok: !!t && (t === el || el.contains(t)), inView: r.bottom <= innerHeight && r.top >= 0,
               w: Math.round(r.width), h: Math.round(r.height) };
    }, club);
    if (!hit.ok) fail.push(`${club}: 타일이 다른 요소에 덮여 있음`);
    if (!hit.inView) warn.push(`${club}: 타일이 첫 화면 밖 (${hit.h}px)`);

    await p.click(`.cf-club-tile[data-club="${club}"]`);
    await p.waitForTimeout(250);

    // 2) 끝까지 진행 — 칩은 첫 항목, 슬라이더/텍스트는 기본값, 다음 버튼
    let steps = 0, seen = [], stuck = 0;
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
    await p.waitForTimeout(2800);

    // 3) 결과 화면 점검
    const res = await p.evaluate(() => {
      const s = document.getElementById('cf-screen');
      const txt = s.innerText;
      const btn = s.querySelector('[data-savebag]');
      let hitOk = null;
      if (btn) {
        const r = btn.getBoundingClientRect();
        btn.scrollIntoView({ block: 'center' });
        const r2 = btn.getBoundingClientRect();
        const t = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2);
        hitOk = !!t && (t === btn || btn.contains(t));
      }
      return { txt, len: txt.length, hasSave: !!btn, hitOk,
               sections: [...s.querySelectorAll('.section-h')].map((x) => x.textContent.split(' ')[0]) };
    });
    if (!res.hasSave) fail.push(`${club}: 결과 화면에 도달 못함`);
    if (res.len < 500) fail.push(`${club}: 결과가 너무 짧음 (${res.len}자) — 렌더 실패 의심`);
    if (res.hasSave && !res.hitOk) fail.push(`${club}: 저장 버튼이 덮여 있음`);
    const bad = (res.txt || '').match(BAD);
    if (bad) fail.push(`${club}: 결과에 "${bad[0]}" 노출`);
    if (errs.length) fail.push(`${club}: JS 오류 — ${errs.slice(0, 2).join(' | ')}`);
    console.log(`[${club}] 문항 ${steps}개 · 결과 ${res.len}자 · 섹션 ${res.sections.join(',')} · 오류 ${errs.length}`);
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

  console.log(fail.length ? '\n실패:\n' + fail.map((f) => ' ✗ ' + f).join('\n') : '\n전 클럽 통과');
  if (warn.length) console.log('참고:\n' + warn.map((w) => ' · ' + w).join('\n'));
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
