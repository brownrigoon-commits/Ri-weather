/* ⛔ 지금은 쓰지 않는 옛 방식입니다 — 돌리면 배포 중인 아이콘이 덮어써집니다.
 *
 * 현재 아이콘 4종은 **python tools/make_club_icons_src.py** 가 만듭니다
 * (여백 없이 딱 잘라 세로 400px, CSS 가 mask-size 로 크기를 정함).
 * 이 스크립트는 260×300 캔버스에 여백을 두고 넣는 옛 방식이라 결과가 다릅니다.
 * 기록으로만 남겨 둡니다. **실행하지 마세요.**
 *
 * ── 아래는 당시 기록 ─────────────────────────────────────────────
 * 클럽 피팅 아이콘 만들기 — assets/src/ 원본 → assets/*.png (마스크용)
 *
 *   node tools/build_club_icons.js
 *
 * ⚠️ 반드시 **원본(assets/src)** 에서 만든다. 이미 만들어진 assets/*.png 를
 *    다시 돌리면 크기·자르기가 누적돼 그림이 망가진다(실제로 한 번 그랬음).
 *
 * 하는 일
 *   ① 흰 배경 제거 — 밝기를 알파로 바꾼다. 흰색만 지우면 가장자리가 계단이 된다
 *   ② 원본 테두리 선·발밑 지면선 제거 (가로로 넓고 얇은 띠)
 *   ③ 알파를 단단하게 — 반투명이 남으면 그 아이콘만 회색으로 떠 보인다
 *      (golfer.png 는 픽셀의 100%가 반투명이라 혼자 흐렸다)
 *   ④ 색을 순수 검정으로 통일
 *   ⑤ 공통 캔버스에 아래·가운데 정렬 — CSS 에서 클럽별로 크기를 만지지 않아도 된다
 *
 * 크기를 바꾸려면 아래 FIT 만 고치면 된다.
 */
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'src');
const OUT = path.join(ROOT, 'assets');
const CANVAS_W = 260, CANVAS_H = 300;

/* h = 캔버스 높이 대비 / w = 캔버스 너비 대비.
   사장님 지시(2026-07-27): 드라이버 90% · 웨지 120% · 퍼터 90%,
   아이언은 클럽 헤드가 잘리지 않게.
   웨지 120%가 캔버스를 넘치므로 웨지를 1.0 으로 두고 나머지를 같은 비율로 낮췄다
   — 서로의 크기 관계는 지시 그대로다. 화면에서 실제로 커 보이도록
   CSS 아이콘 상자도 52x60 → 62x72 로 함께 키웠다. */
const FIT = {
  golfer: { file: 'golfer.png', h: 0.689 },   // 드라이버
  // 아이언은 클럽이 옆으로 길어 가로 기준으로 맞춘다 — 헤드까지 전부 담긴다.
  // 0.833 → 0.958 (+15%, 사장님 지시). 캔버스 가로의 96% 라 아직 여유가 있어
  // 캔버스를 넓히지 않았다. 더 키워야 하면 CANVAS_W 를 늘리고 나머지 세 개의
  // h 값도 같은 비율로 낮춰야 서로의 크기 관계가 유지된다.
  iron:   { file: 'iron.jpg',   w: 0.958 },
  wedge:  { file: 'wedge.jpg',  h: 1.00 },
  putter: { file: 'putter.jpg', h: 0.566 },
};

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'],
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  await p.goto('about:blank');

  for (const [name, fit] of Object.entries(FIT)) {
    const file = path.join(SRC, fit.file);
    if (!fs.existsSync(file)) { console.log(`건너뜀 — 원본 없음: ${fit.file}`); continue; }
    const mime = fit.file.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const d = fs.readFileSync(file).toString('base64');

    const r = await p.evaluate(async ({ d, mime, fit, CW, CH }) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:${mime};base64,` + d; });
      const W = img.width, H = img.height;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const im = x.getImageData(0, 0, W, H), a = im.data;
      const hadAlpha = mime === 'image/png';

      // ① 배경 제거 + ③ 알파 단단하게 + ④ 검정
      for (let i = 0; i < a.length; i += 4) {
        let al;
        if (hadAlpha) {
          al = a[i + 3];
        } else {
          const lum = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
          al = lum >= 235 ? 0 : lum <= 200 ? 255 : Math.round((235 - lum) / 35 * 255);
        }
        a[i + 3] = al >= 200 ? 255 : al <= 60 ? 0 : Math.round((al - 60) / 140 * 255);
        a[i] = a[i + 1] = a[i + 2] = 0;
      }
      const A = (px, py) => a[(py * W + px) * 4 + 3];

      // ② 가로로 넓고 얇은 띠 = 테두리 선 / 지면선 → 제거
      let minX = W, maxX = 0;
      for (let y = 0; y < H; y++) for (let px = 0; px < W; px++)
        if (A(px, y) > 40) { if (px < minX) minX = px; if (px > maxX) maxX = px; }
      const figW = Math.max(1, maxX - minX + 1);
      const wipe = (y) => { for (let px = 0; px < W; px++) a[(y * W + px) * 4 + 3] = 0; };
      const wide = (y) => {
        let n = 0; for (let px = 0; px < W; px++) if (A(px, y) > 40) n++;
        return n > figW * 0.55;
      };
      let cut = 0, run = 0;
      for (let y = H - 1; y > H * 0.80; y--) { if (wide(y)) { wipe(y); cut++; run++; } else if (run) break; }
      run = 0;
      for (let y = 0; y < H * 0.10; y++) { if (wide(y)) { wipe(y); cut++; run++; } else if (run) break; }
      x.putImageData(im, 0, 0);

      // ⑤ 경계 상자 → 공통 캔버스에 아래·가운데 정렬
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (let y = 0; y < H; y++) for (let px = 0; px < W; px++)
        if (A(px, y) > 40) {
          if (px < x0) x0 = px; if (px > x1) x1 = px;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      const scale = fit.w ? (CW * fit.w) / bw : (CH * fit.h) / bh;
      const dw = bw * scale, dh = bh * scale;
      const out = document.createElement('canvas'); out.width = CW; out.height = CH;
      const o = out.getContext('2d');
      o.imageSmoothingQuality = 'high';
      o.drawImage(c, x0, y0, bw, bh, (CW - dw) / 2, CH - dh, dw, dh);

      // 잘려 나간 게 있으면 알려준다 — 조용히 자르면 나중에 원인을 못 찾는다
      const over = Math.max(0, Math.round(dw - CW)) + Math.max(0, Math.round(dh - CH));
      return { png: out.toDataURL('image/png').split(',')[1],
               src: `${W}x${H}`, box: `${bw}x${bh}`,
               drawn: `${Math.round(dw)}x${Math.round(dh)}`, cut, over };
    }, { d, mime, fit, CW: CANVAS_W, CH: CANVAS_H });

    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.png, 'base64'));
    console.log(`${name.padEnd(7)} ${fit.file.padEnd(11)} ${r.src} → 도형 ${r.box} → ${r.drawn}` +
      (r.cut ? ` · 선 ${r.cut}줄 제거` : '') +
      (r.over ? `  ⚠️ 캔버스 밖으로 ${r.over}px 잘림` : ''));
  }
  await b.close();
})();
