/* 클럽 피팅 화면을 옆 창에서 그대로 눌러볼 수 있는 한 장짜리 데모를 만든다.
   앱의 style.css / clubfit.js / loading.js 를 그대로 넣는다 — 데모가 실제와
   달라 보이면 보는 의미가 없다. 이미지는 CSP 때문에 data URI 로 박는다. */
const fs = require('fs');
const R = '/home/user/Ri-weather/';
const OUT = '/tmp/claude-0/-home-user-Ri-weather/487b87eb-cd5d-5f52-abc3-ead0bde63a4e/scratchpad/clubfit-demo.html';

const html = fs.readFileSync(R + 'index.html', 'utf8').split('\n');
const a = html.findIndex((l) => l.includes('<main id="clubfit-view"'));
const b = html.findIndex((l, i) => i > a && l.trim() === '</main>');
let view = html.slice(a, b + 1).join('\n').replace(' hidden>', '>');

let css = fs.readFileSync(R + 'css/style.css', 'utf8');
for (const n of ['golfer', 'iron', 'wedge', 'putter']) {
  const d = fs.readFileSync(R + `assets/${n}.png`).toString('base64');
  css = css.split(`url("../assets/${n}.png")`).join(`url("data:image/png;base64,${d}")`);
}
// 남은 외부 참조는 전부 끊는다 (아티팩트는 외부 호스트를 못 받는다)
css = css.replace(/url\(\s*["']?\.\.\/[^"')]+["']?\s*\)/g, 'none');

const clubfit = fs.readFileSync(R + 'js/clubfit.js', 'utf8');
const loading = fs.readFileSync(R + 'js/loading.js', 'utf8');

const page = `<title>골프라이프 — 클럽 피팅 미리보기</title>
<style>
${css}
/* ── 데모 껍데기 — 앱 화면은 손대지 않고 바깥만 감싼다 ───────────── */
.demo-wrap { max-width: 430px; margin: 0 auto; }
.demo-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 16px; border-bottom: 1px solid var(--line); background: var(--card);
}
.demo-bar .t { font-size: 14px; font-weight: 800; letter-spacing: -0.02em; }
.demo-bar .s { font-size: 11.5px; color: var(--text-faint); }
.demo-reset {
  border: 1px solid var(--line); background: transparent; color: var(--text-dim);
  font: inherit; font-size: 12px; padding: 7px 12px; border-radius: 999px; cursor: pointer;
}
.demo-reset:active { transform: scale(0.97); }
.demo-reset:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
#clubfit-view { display: block; padding-bottom: 40px; }
</style>

<div class="demo-wrap">
  <div class="demo-bar">
    <div>
      <div class="t">클럽 피팅 — 실제 화면</div>
      <div class="s">눌러서 끝까지 진행해 보세요. 저장은 이 미리보기 안에만 남습니다.</div>
    </div>
    <button class="demo-reset" id="demo-reset" type="button">처음부터</button>
  </div>
  ${view}
</div>

<script>
/* 앱 본체(app.js)에서 오는 것들만 최소로 흉내 낸다 — 피팅 로직은 원본 그대로 돈다 */
window.pushView = function () {};
window.STATS = { hit: function () {} };
window.loadScores = function () { return []; };
window.loadProfile = function () { return { ageBand: "50대", sex: "남성" }; };
window.CONSENT = { get: function () { return { age: "50대", sex: "남성" }; } };
</script>
<script>
${loading}
</script>
<script>
${clubfit}
</script>
<script>
(function () {
  function start() {
    document.getElementById('clubfit-view').hidden = false;
    window.openClubfitView();
  }
  start();
  document.getElementById('demo-reset').addEventListener('click', function () {
    try {
      localStorage.removeItem('riweather.fitprofile');
      localStorage.removeItem('riweather.mybag');
    } catch (e) {}
    start();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
</script>`;

fs.writeFileSync(OUT, page);
console.log('written', (page.length / 1024).toFixed(0) + 'KB', '→', OUT);
