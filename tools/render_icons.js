/* 아이콘 SVG → 마스크용 PNG 렌더 + 미리보기 시트
 *
 *   node tools/render_icons.js            PNG 만들기
 *   node tools/render_icons.js --sheet    미리보기 한 장 (눈으로 확인용)
 *
 * 왜 SVG 로 갈아탔나: 기존 assets/src/*.jpg 는 출처 불명 스톡 이미지였고
 * putter.jpg 에는 123RF 워터마크가 박혀 있었다(2026-07-28 발견). 저작권 위험을
 * 없애려고 직접 그린 SVG 로 전부 교체했다. 원본은 assets/*.svg 뿐이다.
 *
 * 마스크로 쓰이므로 알파가 단단해야 한다 — 반투명이 남으면 그 아이콘만 흐리게 보인다.
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const AS = path.join(ROOT, 'assets');
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const ICONS = ['golfer', 'iron', 'wedge', 'putter'];
const W = 300, H = 390;          // 3:3.9 — 기존 PNG 비율 유지 (mask-size: contain)

(async () => {
  const sheet = process.argv.includes('--sheet');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

  for (const name of ICONS) {
    const svgPath = path.join(AS, name + '.svg');
    if (!fs.existsSync(svgPath)) { console.log(`✖ ${name}.svg 없음`); continue; }
    const svg = fs.readFileSync(svgPath, 'utf8');
    await page.setContent(
      `<body style="margin:0;background:#fff">
         <div style="width:${W}px;height:${H}px;display:flex;align-items:flex-end;justify-content:center">
           <div style="width:100%;height:100%">${svg.replace('<svg', '<svg width="100%" height="100%" preserveAspectRatio="xMidYMax meet"')}</div>
         </div>
       </body>`);
    const out = path.join(AS, name + '.png');
    await page.screenshot({ path: out, omitBackground: false });

    // 알파 검사 — 마스크는 흑백이 선명해야 한다
    const stat = fs.statSync(out);
    console.log(`✔ ${name}.png  ${(stat.size / 1024).toFixed(1)}KB`);
  }

  if (sheet) {
    const parts = ICONS.map((n) => {
      const svg = fs.readFileSync(path.join(AS, n + '.svg'), 'utf8');
      return `<div style="text-align:center">
        <div style="width:120px;height:156px;margin:0 auto;background:#191f28;
             -webkit-mask:url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') no-repeat bottom center/contain;
             mask:url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') no-repeat bottom center/contain"></div>
        <div style="font:14px sans-serif;margin-top:8px;color:#4e5968">${n}</div>
      </div>`;
    }).join('');
    await page.setViewportSize({ width: 640, height: 260 });
    await page.setContent(
      `<body style="margin:0;background:#f2f4f6;display:flex;gap:24px;align-items:flex-end;
         justify-content:center;padding:24px 0">${parts}</body>`);
    const sp = path.join(ROOT, 'scratchpad_icons.png');
    await page.screenshot({ path: sp });
    console.log('미리보기:', sp);
  }

  await browser.close();
})();
