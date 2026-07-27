/* 사장님이 올려주신 흰 배경 JPG → 마스크용 투명 PNG
   · 흰 배경을 알파 0 으로 뺀다 (밝기 그대로 알파에 매핑 → 가장자리 계단 없음)
   · 발밑 지면선(가로로 길고 얇은 덩어리)을 지운다
   · 그림 바깥 여백을 잘라낸다 */
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const REPO = '/home/user/Ri-weather/assets/';
const JOBS = [
  ['아이언_이미지.jpg', 'iron.png'],
  ['웨지_이미지.jpg', 'wedge.png'],
  ['퍼터이미지.jpg', 'putter.png'],
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.goto('about:blank');
  for (const [src, out] of JOBS) {
    const b64 = fs.readFileSync(REPO + src).toString('base64');
    const res = await p.evaluate(async (d) => {
      const img = new Image();
      await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = 'data:image/jpeg;base64,' + d; });
      const W = img.width, H = img.height;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const im = x.getImageData(0, 0, W, H), a = im.data;

      // ① 흰 배경 → 투명. 어두울수록 불투명 (안티에일리어싱 보존)
      for (let i = 0; i < a.length; i += 4) {
        const lum = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
        // 235 이상은 완전 배경, 200 이하는 완전 도형, 사이는 부드럽게
        let al = lum >= 235 ? 0 : lum <= 200 ? 255 : Math.round((235 - lum) / 35 * 255);
        a[i] = a[i + 1] = a[i + 2] = 0;
        a[i + 3] = al;
      }
      const A = (px, py) => a[(py * W + px) * 4 + 3];

      // ② 도형의 가로 폭을 알아야 '지면선'을 판별할 수 있다
      let minX = W, maxX = 0;
      for (let y = 0; y < H; y++) for (let px = 0; px < W; px++)
        if (A(px, y) > 40) { if (px < minX) minX = px; if (px > maxX) maxX = px; }
      const figW = Math.max(1, maxX - minX + 1);

      // ③ 가로로 넓게 퍼진 얇은 띠 = 지면선 또는 원본 테두리 → 지운다
      //    (아래쪽 지면선뿐 아니라 위쪽 테두리 선도 같은 방식으로 걸린다)
      const wipe = (y) => { for (let px = 0; px < W; px++) a[(y * W + px) * 4 + 3] = 0; };
      const wide = (y) => {
        let cnt = 0;
        for (let px = 0; px < W; px++) if (A(px, y) > 40) cnt++;
        return cnt > figW * 0.55;
      };
      let removed = 0;
      for (let y = H - 1; y > H * 0.80; y--) {          // 아래에서 위로 — 지면선
        if (wide(y)) { wipe(y); removed++; } else if (removed) break;
      }
      let topGone = 0;
      for (let y = 0; y < H * 0.10; y++) {              // 위에서 아래로 — 테두리 선
        if (wide(y)) { wipe(y); topGone++; removed++; } else if (topGone) break;
      }

      // ④ 남은 그림의 경계로 잘라낸다
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (let y = 0; y < H; y++) for (let px = 0; px < W; px++)
        if (A(px, y) > 40) {
          if (px < x0) x0 = px; if (px > x1) x1 = px;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      x.putImageData(im, 0, 0);
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
      const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
      c2.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
      return { png: c2.toDataURL('image/png').split(',')[1], W, H, cw, ch, removed };
    }, b64);
    fs.writeFileSync(REPO + out, Buffer.from(res.png, 'base64'));
    console.log(`${src} → ${out}  원본 ${res.W}x${res.H} → ${res.cw}x${res.ch} · 지면선 ${res.removed}줄 제거`);
  }
  await b.close();
})();
