/* 클럽 아이콘 4장을 같은 규격으로 맞춘다.
   ① 알파를 단단하게 — 반투명이 남아 있으면 그 아이콘만 흐려 보인다
      (golfer.png 은 픽셀의 100%가 반투명이라 혼자 회색으로 보였다)
   ② 그림 바깥 여백을 잘라내고, 세로를 기준 높이에 맞춘 뒤
      모두 같은 크기의 캔버스에 아래·가운데 정렬로 얹는다
      → 마스크 크기를 클럽마다 따로 만질 필요가 없어진다 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const A = '/home/user/Ri-weather/assets/';
const CANVAS_W = 260, CANVAS_H = 300;
// 사람 키가 비슷해 보이도록 클럽마다 다르게 키운다.
// (아이언은 클럽이 옆으로 길어 가로가 넓고, 웨지는 클럽이 머리 위로 솟아 세로가 길다)
const FIT = {
  golfer: { h: 0.90 },          // 기준 — 드라이버 피니시
  // 아이언은 클럽이 오른쪽으로 길어, 가로에 맞추면 사람이 작아진다.
  // 높이를 기준으로 키우고 왼쪽에 붙여 클럽 끝만 프레임 밖으로 내보낸다.
  iron:   { h: 0.88, anchor: 'left' },
  wedge:  { h: 0.98 },          // 클럽까지 세로로 길다 → 높이를 채운다
  putter: { h: 0.74 },          // 쭈그린 자세라 덩어리가 크다 → 줄인다
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.goto('about:blank');
  for (const [name, fit] of Object.entries(FIT)) {
    const d = fs.readFileSync(A + name + '.png').toString('base64');
    const r = await p.evaluate(async ({ d, fit, CW, CH }) => {
      const img = new Image();
      await new Promise((res) => { img.onload = res; img.src = 'data:image/png;base64,' + d; });
      const W = img.width, H = img.height;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const im = x.getImageData(0, 0, W, H), a = im.data;

      // ① 알파 단단하게 — 200 이상은 완전 불투명, 60 이하는 완전 투명, 사이만 부드럽게
      let before = 0, on = 0;
      for (let i = 3; i < a.length; i += 4) {
        if (a[i] > 0) { on++; if (a[i] < 250) before++; }
        const v = a[i] >= 200 ? 255 : a[i] <= 60 ? 0 : Math.round((a[i] - 60) / 140 * 255);
        a[i] = v;
        a[i - 3] = a[i - 2] = a[i - 1] = 0;      // 색은 순수 검정으로 통일
      }
      x.putImageData(im, 0, 0);

      // ② 경계 상자
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (let y = 0; y < H; y++) for (let px = 0; px < W; px++) {
        if (a[(y * W + px) * 4 + 3] > 40) {
          if (px < x0) x0 = px; if (px > x1) x1 = px;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;

      // ③ 공통 캔버스에 아래·가운데 정렬
      const scale = fit.w ? (CW * fit.w) / bw : (CH * fit.h) / bh;
      const dw = bw * scale, dh = bh * scale;
      const out = document.createElement('canvas'); out.width = CW; out.height = CH;
      const o = out.getContext('2d');
      o.imageSmoothingQuality = 'high';
      const dx = fit.anchor === 'left' ? CW * 0.04 : (CW - dw) / 2;
      o.drawImage(c, x0, y0, bw, bh, dx, CH - dh, dw, dh);
      return { png: out.toDataURL('image/png').split(',')[1],
               src: `${W}x${H}`, box: `${bw}x${bh}`,
               softPct: (before / on * 100).toFixed(0),
               drawn: `${Math.round(dw)}x${Math.round(dh)}` };
    }, { d, fit, CW: CANVAS_W, CH: CANVAS_H });
    fs.writeFileSync(A + name + '.png', Buffer.from(r.png, 'base64'));
    console.log(`${name.padEnd(7)} 원본 ${r.src} · 도형 ${r.box} · 반투명 ${r.softPct}% → ${CANVAS_W}x${CANVAS_H} 안에 ${r.drawn}`);
  }
  await b.close();
})();
