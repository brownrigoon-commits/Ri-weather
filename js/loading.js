/* =========================================================
 * 대기 화면 — 토스식 "읽는 동안 기다림이 지워지는" 로딩
 *
 * 빙글빙글 도는 스피너는 남은 시간을 알려주지 않아 실제보다 길게 느껴진다.
 * 토스는 그 자리에 말을 건다. 사용자가 문장을 읽는 동안 시간이 지나가고,
 * 문구가 바뀌면 "뭔가 진행되고 있다"는 신호가 된다.
 *
 * 쓰는 법:
 *   const w = WAIT.open("score");        // 상황 키
 *   ... 오래 걸리는 일 ...
 *   w.close();                           // 반드시 닫을 것 (finally 권장)
 *
 *   WAIT.run("caddie", async () => { ... });   // 자동으로 열고 닫음
 * ========================================================= */
const WAIT = (() => {
  /* 상황별 문구.
     원칙 세 가지 —
     1) 첫 줄은 사용자를 향한 인사·공감 (기다리라는 말이 아니라 말을 거는 것)
     2) 가운데는 "지금 무엇을 하고 있는지" (진행 중이라는 증거)
     3) 마지막은 곧 끝난다는 신호
     각 문구는 약 1.9초씩 머문다. 마지막 문구는 끝날 때까지 유지된다. */
  /* 바깥 키(score·caddie·food…)는 문구가 아니라 '값'이다.
     WAIT.open("food") 처럼 호출하는 쪽이 이 이름으로 상황을 고른다 — 번역하지 않는다.
     문구만 tr() 로 사전(js/i18n/src/ko.loading.json)에서 꺼낸다. */
  const SCRIPTS = {
    // MY스코어 저장·분석
    score: {
      sub: tr("wait.score.sub"),
      msgs: [
        tr("wait.score.1"),
        tr("wait.score.2"),
        tr("wait.score.3"),
        tr("wait.score.4"),
        tr("wait.score.5"),
      ],
    },
    // AI 캐디 코스 공략
    // ⚠ 여기 문구는 실제로 하는 일만 적는다. 예전에 "오늘 바람과 기온을 확인" 이라고
    //   적혀 있었지만 캐디는 날씨를 보지 않는다(프롬프트에 날씨가 없다). 2026-07-29 교정.
    caddie: {
      sub: tr("wait.caddie.sub"),
      msgs: [
        tr("wait.caddie.1"),
        tr("wait.caddie.2"),
        tr("wait.caddie.3"),
      ],
    },
    // 클럽 피팅 판정 — 피팅샵에 클럽을 맡긴 것처럼 과정을 들려준다.
    // (사장님 지시 2026-07-27: "클럽을 당신에게 맞추고 있다"는 느낌이 나야 함)
    clubfit: {
      sub: tr("wait.clubfit.sub"),
      msgs: [
        tr("wait.clubfit.1"),
        tr("wait.clubfit.2"),
        tr("wait.clubfit.3"),
        tr("wait.clubfit.4"),
        tr("wait.clubfit.5"),
        tr("wait.clubfit.6"),
      ],
    },
    // 주변 맛집
    food: {
      sub: tr("wait.food.sub"),
      msgs: [
        tr("wait.food.1"),
        tr("wait.food.2"),
        tr("wait.food.3"),
        tr("wait.food.4"),
      ],
    },
    // 숙박 — 라운딩 뒤 어디서 잘지
    stay: {
      sub: tr("wait.stay.sub"),
      msgs: [
        tr("wait.stay.1"),
        tr("wait.stay.2"),
        tr("wait.stay.3"),
        tr("wait.stay.4"),
      ],
    },
    // 날씨 불러오기
    weather: {
      // 실제 출처는 Open-Meteo 다. "기상청 자료"라고 쓰면 사실과 다르다. (2026-07-28)
      sub: tr("wait.weather.sub"),
      msgs: [
        tr("wait.weather.1"),
        tr("wait.weather.2"),
        tr("wait.weather.3"),
      ],
    },
    // 기록 백업·복원
    backup: {
      sub: tr("wait.backup.sub"),
      msgs: [
        tr("wait.backup.1"),
        tr("wait.backup.2"),
        tr("wait.backup.3"),
      ],
    },
  };

  const HOLD = 1900;      // 문구 하나가 머무는 시간
  let box = null, timer = null, openedAt = 0, closing = null;
  let shown = 0;          // 화면에 표시 중인 퍼센트 (뒤로 가지 않게 유지)
  let driven = false;     // true = 호출한 쪽이 say() 로 직접 진행을 몰고 있음

  /* 진행률은 원 안의 숫자로 — 막대보다 "얼마나 남았는지"가 한눈에 읽힌다 (토스 방식) */
  const R = 44, CIRC = 2 * Math.PI * R;
  function build(script) {
    const el = document.createElement("div");
    el.className = "rw-wait";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML =
      '<div class="rw-ring">' +
        '<svg viewBox="0 0 100 100" aria-hidden="true">' +
          '<circle class="rw-ring-bg" cx="50" cy="50" r="' + R + '"></circle>' +
          '<circle class="rw-ring-fg" cx="50" cy="50" r="' + R + '"' +
            ' stroke-dasharray="' + CIRC + '" stroke-dashoffset="' + CIRC + '"></circle>' +
        '</svg>' +
        '<span class="rw-ring-pct">0<i>%</i></span>' +
      '</div>' +
      '<div class="rw-wait-msg"><span></span></div>' +
      '<div class="rw-wait-sub"></div>';
    el.querySelector(".rw-wait-sub").textContent = script.sub || "";
    return el;
  }

  function open(kind, opts) {
    const script = SCRIPTS[kind] || SCRIPTS.weather;
    close(true);                       // 겹쳐 열리는 사고 방지
    box = build(script);
    document.body.appendChild(box);
    document.body.style.overflow = "hidden";
    openedAt = Date.now();

    const msgEl = box.querySelector(".rw-wait-msg");
    const ringEl = box.querySelector(".rw-ring-fg");
    const pctEl = box.querySelector(".rw-ring-pct");
    const list = (opts && opts.msgs) || script.msgs;
    let i = 0;

    const setPct = (p) => {
      shown = Math.max(shown, Math.min(100, Math.round(p)));   // 진행률은 되돌아가지 않는다
      if (ringEl) ringEl.style.strokeDashoffset = CIRC * (1 - shown / 100);
      if (pctEl) pctEl.innerHTML = shown + "<i>%</i>";
    };
    const say = (text, p) => {
      // 새 span 으로 갈아끼워야 등장 애니메이션이 다시 재생된다
      if (text) msgEl.innerHTML = "<span>" + text + "</span>";
      if (typeof p === "number") setPct(p);
    };
    shown = 0;
    // 처음부터 큰 숫자를 보여주면 거짓말이 된다. 문구가 하나뿐인 경우(직접 제어)도 낮게 시작.
    say(list[0], list.length > 1 ? 92 / list.length : 6);

    // 호출한 쪽이 실제 진행을 알려주지 않으면(=say 미사용) 시간에 따라 알아서 넘긴다
    timer = setInterval(() => {
      if (driven) return;                       // 수동 제어 중이면 자동 전환 중단
      if (i < list.length - 1) { i++; say(list[i], (i + 1) / list.length * 92); }
      else clearInterval(timer);                // 마지막 문구는 끝날 때까지 유지
    }, HOLD);

    return {
      close: () => close(),
      /* 실제 진행에 맞춰 문구·퍼센트를 직접 넘긴다 (맛집처럼 단계가 분명한 작업용) */
      say: (text, p) => { driven = true; say(text, p); },
    };
  }

  /* 너무 빨리 끝나면 화면이 번쩍이기만 한다 → 최소 550ms 는 보여준다 */
  function close(now) {
    if (!box) return;
    if (timer) { clearInterval(timer); timer = null; }
    const el = box;
    box = null; driven = false;
    if (closing) { clearTimeout(closing); closing = null; }

    const finish = () => {
      // 끝났을 때만 100% — 그전에 100%를 보여주면 거짓말이 된다
      const ring = el.querySelector(".rw-ring-fg"), pct = el.querySelector(".rw-ring-pct");
      if (ring) ring.style.strokeDashoffset = 0;
      if (pct) pct.innerHTML = '100<i>%</i>';
      setTimeout(() => {
        el.classList.add("is-closing");
        setTimeout(() => { el.remove(); document.body.style.overflow = ""; }, 220);
      }, 260);                                   // 100% 를 잠깐 보여주고 닫는다
    };
    const left = 550 - (Date.now() - openedAt);
    if (now || left <= 0) finish();
    else closing = setTimeout(finish, left);
  }

  /* 실패해도 반드시 닫히도록 감싸서 실행 */
  async function run(kind, fn, opts) {
    const w = open(kind, opts);
    try { return await fn(); }
    finally { w.close(); }
  }

  return { open, close, run, SCRIPTS };
})();

/* 리스트가 위에서부터 차례로 나타나게 (맛집·스코어 목록 등)
   — 이미 그려진 요소에 클래스만 붙이면 CSS 가 순차 등장을 맡는다 */
function staggerIn(el) {
  if (!el) return;
  el.classList.remove("stagger");
  void el.offsetWidth;
  el.classList.add("stagger");
}

window.WAIT = WAIT;
window.staggerIn = staggerIn;
