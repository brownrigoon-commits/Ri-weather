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
    // 클럽 피팅 판정
    clubfit: {
      sub: "답해주신 내용으로 후보를 좁힙니다",
      msgs: [
        "지금 당신의 스윙을 분석하고 있어요",
        "헤드 스피드 대역을 계산하는 중이에요",
        "후반 체력까지 고려해 무게를 잡고 있어요",
        "선호하시는 브랜드부터 찾아볼게요",
        "다른 브랜드에도 좋은 게 있는지 보는 중이에요",
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

  function build(script) {
    const el = document.createElement("div");
    el.className = "rw-wait";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML =
      '<div class="rw-wait-dots"><i></i><i></i><i></i></div>' +
      '<div class="rw-wait-msg"><span></span></div>' +
      '<div class="rw-wait-sub"></div>' +
      '<div class="rw-wait-bar"><i></i></div>';
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
    const barEl = box.querySelector(".rw-wait-bar i");
    const list = (opts && opts.msgs) || script.msgs;
    let i = 0;

    const paint = () => {
      // 새 span 으로 갈아끼워야 등장 애니메이션이 다시 재생된다
      msgEl.innerHTML = "<span>" + list[i] + "</span>";
      // 진행바는 마지막 문구에서 92%까지만 — 100%는 실제로 끝났을 때
      barEl.style.width = Math.min(92, ((i + 1) / list.length) * 92) + "%";
    };
    paint();
    timer = setInterval(() => {
      if (i < list.length - 1) { i++; paint(); }
      else clearInterval(timer);      // 마지막 문구는 끝날 때까지 유지
    }, HOLD);

    return { close: () => close() };
  }

  /* 너무 빨리 끝나면 화면이 번쩍이기만 한다 → 최소 550ms 는 보여준다 */
  function close(now) {
    if (!box) return;
    if (timer) { clearInterval(timer); timer = null; }
    const el = box;
    box = null;
    if (closing) { clearTimeout(closing); closing = null; }

    const finish = () => {
      const bar = el.querySelector(".rw-wait-bar i");
      if (bar) bar.style.width = "100%";
      el.classList.add("is-closing");
      setTimeout(() => { el.remove(); document.body.style.overflow = ""; }, 220);
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
