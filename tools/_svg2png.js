/* SVG → PNG (크롬 렌더). make_club_icons.py 가 내부적으로 부른다.
 *   node tools/_svg2png.js <입력.svg> <출력.png> <가로> <세로>
 */
const { chromium } = require('playwright-core');
const fs = require('fs');

const [, , src, out, w, h] = process.argv;
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const svg = fs.readFileSync(src, 'utf8');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({
    viewport: { width: Number(w), height: Number(h) },
    deviceScaleFactor: 2,
  });
  // SVG 에 붙어 있는 width/height 를 지우고 컨테이너에 맞춘다.
  // (안 지우면 원래 크기대로 그려져 화면 밖으로 잘린다 — 실제로 겪음)
  const fitted = svg
    .replace(/\s(width|height)="[^"]*"/g, '')
    .replace('<svg', `<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet"`);
  await page.setContent(
    `<body style="margin:0;width:${w}px;height:${h}px;display:flex;
       align-items:center;justify-content:center">
       <div style="width:88%;height:88%">${fitted}</div></body>`);
  await page.screenshot({ path: out, omitBackground: true });
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
