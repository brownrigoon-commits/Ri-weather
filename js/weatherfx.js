/* =========================================================
 * 하늘 효과 — 비·눈을 캔버스 입자로 그린다
 *
 * CSS 배경 타일이나 요소를 흩뿌리는 방식으로 두 번 시도했지만
 * 격자무늬가 보이거나 빗줄기가 굵어 어색했다(2026-07-27 두 차례 지적).
 * 비가 비처럼 보이려면 세 가지가 필요하다:
 *   1) 깊이 — 가까운 비는 굵고 빠르고 진하게, 먼 비는 가늘고 느리고 흐리게
 *   2) 모션 블러 — 한 방울이 '점'이 아니라 흐른 '선'으로 보여야 한다
 *   3) 불규칙 — 위치·속도·길이가 모두 조금씩 달라야 한다
 * 이 셋은 캔버스로 그려야 제대로 나온다.
 *
 * 쓰는 법: 하늘 장면을 DOM 에 넣은 뒤 WXFX.scan(부모요소) 한 번만 부르면 된다.
 * ========================================================= */
const WXFX = (() => {
  const live = [];                 // 현재 그리고 있는 캔버스들
  let raf = null, last = 0;
  const reduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const rnd = (a, b) => a + Math.random() * (b - a);

  function makeRain(w, h, heavy) {
    const n = Math.round((w * h) / (heavy ? 380 : 620));   // 눈으로 맞춘 밀도
    const ps = [];
    for (let i = 0; i < n; i++) {
      const depth = Math.random();                  // 0 = 멀다, 1 = 가깝다
      ps.push({
        x: rnd(-0.15 * w, 1.15 * w),
        y: rnd(-h, h),
        // 가까울수록 길고 빠르고 진하다
        len: rnd(6, 11) + depth * (heavy ? 16 : 12),
        v: (heavy ? 780 : 560) * (0.45 + depth * 0.9),
        a: 0.10 + depth * (heavy ? 0.42 : 0.34),
        w: 0.7 + depth * 0.9,
      });
    }
    return ps;
  }

  function makeSnow(w, h) {
    const n = Math.round((w * h) / 1150);
    const ps = [];
    for (let i = 0; i < n; i++) {
      const depth = Math.random();
      ps.push({
        x: rnd(0, w), y: rnd(-h, h),
        r: 0.7 + depth * 1.7,
        v: 16 + depth * 34,
        a: 0.28 + depth * 0.55,
        sw: rnd(6, 16),                             // 좌우로 흔들리는 폭
        ph: rnd(0, Math.PI * 2),
        sp: rnd(0.5, 1.2),
      });
    }
    return ps;
  }

  const TILT = 0.22;                                // 바람에 기운 정도

  function draw(fx, dt, t) {
    const { ctx, w, h, kind } = fx;
    ctx.clearRect(0, 0, w, h);
    if (kind === "snow") {
      ctx.fillStyle = "#fff";
      for (const p of fx.ps) {
        p.y += p.v * dt;
        if (p.y - p.r > h) { p.y = -p.r; p.x = rnd(0, w); }
        const x = p.x + Math.sin(t * p.sp + p.ph) * p.sw;
        ctx.globalAlpha = p.a;
        ctx.beginPath();
        ctx.arc(x, p.y, p.r, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }
    // 비 — 한 방울을 '흐른 선'으로 그린다. 끝으로 갈수록 진해져 떨어지는 방향이 읽힌다.
    ctx.lineCap = "round";
    for (const p of fx.ps) {
      p.y += p.v * dt;
      p.x -= p.v * TILT * dt;
      if (p.y - p.len > h || p.x < -0.2 * w) {
        p.y = -p.len - rnd(0, h * 0.3);
        p.x = rnd(-0.15 * w, 1.15 * w);
      }
      const x2 = p.x + p.len * TILT, y1 = p.y - p.len;
      const g = ctx.createLinearGradient(x2, y1, p.x, p.y);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(255,255,255," + p.a.toFixed(3) + ")");
      ctx.strokeStyle = g;
      ctx.lineWidth = p.w;
      ctx.beginPath();
      ctx.moveTo(x2, y1);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);   // 탭 복귀 시 순간이동 방지
    last = now;
    const t = now / 1000;
    for (const fx of live) if (fx.on) draw(fx, dt, t);
    raf = live.length ? requestAnimationFrame(tick) : null;
  }

  function size(fx) {
    const r = fx.cv.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    fx.w = r.width; fx.h = r.height;
    fx.cv.width = Math.round(r.width * dpr);
    fx.cv.height = Math.round(r.height * dpr);
    fx.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx.ps = fx.kind === "snow" ? makeSnow(fx.w, fx.h)
                               : makeRain(fx.w, fx.h, fx.kind === "storm");
    return true;
  }

  const ro = ("ResizeObserver" in window)
    ? new ResizeObserver((es) => {
        es.forEach((e) => {
          const fx = live.find((f) => f.cv === e.target);
          if (fx && !fx.w && size(fx)) ro.unobserve(e.target);
        });
      })
    : null;

  /* 화면 밖으로 나가면 그리지 않는다 — 목록에 카드가 여러 장이어도 부담이 없다 */
  const io = ("IntersectionObserver" in window)
    ? new IntersectionObserver((es) => {
        es.forEach((e) => {
          const fx = live.find((f) => f.cv === e.target);
          if (fx) fx.on = e.isIntersecting;
        });
      }, { rootMargin: "80px" })
    : null;

  function attach(slot) {
    const kind = slot.dataset.fx;
    const cv = document.createElement("canvas");
    cv.className = "wx-fx";
    slot.replaceWith(cv);
    const fx = { cv, ctx: cv.getContext("2d"), kind, on: true, ps: [], w: 0, h: 0 };
    // 숨겨진 화면에서 만들어지면 크기가 0 이라 영영 안 그려진다.
    // 크기가 생기는 순간(화면에 나타날 때) 다시 잡아준다.
    if (!size(fx) && ro) ro.observe(cv);
    live.push(fx);
    if (io) io.observe(cv);
    if (reduced) { draw(fx, 0, 0); return; }          // 모션 최소화 설정이면 한 장면만
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }

  /* DOM 에서 떨어져 나간 캔버스는 목록에서 치운다 (카드 다시 그릴 때 쌓이지 않게) */
  function sweep() {
    for (let i = live.length - 1; i >= 0; i--) {
      if (!live[i].cv.isConnected) { if (io) io.unobserve(live[i].cv); live.splice(i, 1); }
    }
  }

  function scan(root) {
    sweep();
    (root || document).querySelectorAll("[data-fx]").forEach(attach);
  }

  window.addEventListener("resize", () => { live.forEach(size); });
  /* 검사용 — rAF 가 안 도는 환경(숨겨진 창)에서도 한 프레임을 강제로 그린다.
     '그려지긴 하는가'를 자동 검사로 확인할 수 있게 뚫어둔 구멍. */
  function _frame(dt) {
    live.forEach((fx) => { if (!fx.w) size(fx); draw(fx, dt || 0.05, performance.now() / 1000); });
    return live.length;
  }

  return { scan, sweep, _frame };
})();

window.WXFX = WXFX;
