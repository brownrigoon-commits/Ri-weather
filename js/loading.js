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
  const SCRIPTS = {
    // MY스코어 저장·분석
    score: {
      sub: "잠시만 기다려 주세요",
      msgs: [
        "이번 라운딩도 고생하셨어요",
        "방금 치신 기록을 적고 있어요",
        "지난 라운딩들과 나란히 놓아볼게요",
        "평균 타수를 다시 계산하는 중이에요",
        "거의 다 정리했어요",
      ],
    },
    // AI 캐디 코스 공략
    caddie: {
      sub: "홀 정보와 오늘 날씨를 함께 봅니다",
      msgs: [
        "이 홀을 살펴보고 있어요",
        "오늘 바람과 기온을 확인하는 중이에요",
        "골퍼님 평균 타수에 맞춰 생각하고 있어요",
        "어느 클럽이 좋을지 고르는 중이에요",
        "공략을 정리하고 있어요",
      ],
    },
    // 클럽 피팅 판정 — 피팅샵에 클럽을 맡긴 것처럼 과정을 들려준다.
    // (사장님 지시 2026-07-27: "클럽을 당신에게 맞추고 있다"는 느낌이 나야 함)
    clubfit: {
      sub: "답해주신 내용으로 후보를 좁힙니다",
      msgs: [
        "지금 당신의 스윙을 분석하고 있어요",
        "피팅샵 문을 열고 들어갔어요",
        "클럽 강도와 무게를 확인하는 중이에요",
        "당신 스윙에 맞게 샤프트를 깎고 있어요",
        "마지막으로 그립을 감고 있어요",
        "거의 다 됐어요",
      ],
    },
    // 주변 맛집
    food: {
      sub: "라운딩 끝나고 가실 곳을 찾습니다",
      msgs: [
        "골프장 주변을 둘러보고 있어요",
        "별점 높은 곳부터 모으는 중이에요",
        "가게 사진을 가져오고 있어요",
        "거의 다 왔어요",
      ],
    },
    // 숙박 — 라운딩 뒤 어디서 잘지
    stay: {
      sub: "골프장에서 가까운 곳부터 봅니다",
      msgs: [
        "골프장 주변 숙소를 찾고 있어요",
        "평점이 좋은 곳부터 모으는 중이에요",
        "숙소 사진을 가져오고 있어요",
        "거의 다 왔어요",
      ],
    },
    // 날씨 불러오기
    weather: {
      sub: "기상청 자료를 받아옵니다",
      msgs: [
        "골프장 하늘을 확인하고 있어요",
        "시간대별 날씨를 정리하는 중이에요",
        "비구름이 지나가는지 보고 있어요",
      ],
    },
    // 기록 백업·복원
    backup: {
      sub: "안전하게 옮기는 중입니다",
      msgs: [
        "소중한 기록을 옮기고 있어요",
        "하나도 빠뜨리지 않게 확인하는 중이에요",
        "거의 다 됐어요",
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
